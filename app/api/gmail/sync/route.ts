import { NextResponse } from "next/server";
import { google, gmail_v1 } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { calcFollowUpDate } from "@/lib/follow-up";
import { Status, STATUS_ORDER } from "@/types";
import { getUserId } from "@/lib/session";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ParsedEmail {
  company: string;
  role: string;
  email_type: "confirmation" | "phone_screen" | "interview" | "offer" | "rejection" | "unknown";
  confidence: number;
  applied_date: string | null;
}

const EMAIL_TYPE_TO_STATUS: Record<string, Status> = {
  confirmation: "Applied",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejection: "Rejected",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|the|a|an)\b/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Looser: match if company names are close, even if roles differ.
 *  Used as a fallback when role extraction is ambiguous. */
function companyOnlyMatch(appCompany: string, parsedCompany: string): boolean {
  return fuzzyMatch(appCompany, parsedCompany);
}

/** Recursively extract plain text from a Gmail message part tree. */
function extractBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";

  // Leaf with data
  if (part.body?.data) {
    try {
      const raw = Buffer.from(part.body.data, "base64url").toString("utf-8");
      if (part.mimeType === "text/html") {
        // Strip tags, collapse whitespace
        return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      }
      return raw.trim();
    } catch {
      return "";
    }
  }

  // Prefer text/plain, fall back to text/html, then recurse
  const parts = part.parts ?? [];
  const plain = parts.find((p) => p.mimeType === "text/plain");
  if (plain) {
    const t = extractBody(plain);
    if (t) return t;
  }
  const html = parts.find((p) => p.mimeType === "text/html");
  if (html) {
    const t = extractBody(html);
    if (t) return t;
  }
  for (const p of parts) {
    const t = extractBody(p);
    if (t) return t;
  }
  return "";
}

/** Parse email with Claude. Returns null on any failure. */
async function parseEmail(
  from: string,
  subject: string,
  body: string
): Promise<ParsedEmail | null> {
  // Truncate body — 2 000 chars is plenty for Claude to classify
  const bodySnip = body.slice(0, 2000);

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a job-application email classifier. Return ONLY valid JSON — no markdown, no explanation.

Shape:
{"company":string,"role":string,"email_type":"confirmation"|"phone_screen"|"interview"|"offer"|"rejection"|"unknown","confidence":number,"applied_date":string|null}

Rules:
• company — the HIRING company name (not the ATS platform like Greenhouse, Lever, Workday, etc.)
  Extract from the email body/subject. If it's unclear, use the sender domain (strip common ATS domains).
• role — the exact job title. Use "Unknown Role" only if truly absent.
• email_type:
  - "confirmation" → application received / submitted successfully
  - "phone_screen" → recruiter reach-out, scheduling an intro or phone call
  - "interview" → interview scheduled or confirmed (any round)
  - "offer" → offer extended
  - "rejection" → not moving forward / no longer being considered
  - "unknown" → none of the above, or a generic newsletter/job-board digest
• confidence (0–1):
  - 0.85+ : clearly a job-application email, company & role obvious
  - 0.7–0.85 : probably a job email, company/role reasonably clear
  - < 0.7 : uncertain — set email_type to "unknown"
  Do NOT return < 0.7 confidence with a non-unknown email_type.
• applied_date — ISO date (YYYY-MM-DD) if the email says when the application was submitted, else null.`,
      messages: [
        {
          role: "user",
          content: `From: ${from}\nSubject: ${subject}\n\nBody:\n${bodySnip}`,
        },
      ],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    // Strip accidental markdown fences
    const cleaned = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned) as ParsedEmail;
  } catch (e) {
    console.error("Claude parse error:", e);
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────

export async function POST() {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const tokenRecord = await prisma.oAuthToken.findUnique({ where: { userId } });
    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Gmail not connected. Please connect Gmail first." },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
      expiry_date: tokenRecord.expiresAt?.getTime(),
    });
    oauth2Client.on("tokens", async (tokens) => {
      await prisma.oAuthToken.update({
        where: { id: "singleton" },
        data: {
          accessToken: tokens.access_token ?? tokenRecord.accessToken,
          refreshToken: tokens.refresh_token ?? tokenRecord.refreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : tokenRecord.expiresAt,
        },
      });
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // ── Three queries: ATS senders + job subjects + rejection body language ──
    const queries = [
      // 1. ATS auto-responses by sender domain
      "from:(greenhouse.io OR lever.co OR workday.com OR taleo.net OR icims.com OR jobvite.com OR smartrecruiters.com OR myworkdayjobs.com OR successfactors.com OR brassring.com OR ashbyhq.com OR rippling.com OR bamboohr.com OR recruitee.com OR dover.com OR gem.com OR hiring.amazon.com OR jobs.apple.com OR careers.google.com OR meta.com OR microsoft.com) newer_than:90d",
      // 2. Subject-line patterns (confirmations, interviews, offers)
      'subject:("application received" OR "application submitted" OR "thank you for applying" OR "thanks for applying" OR "we received your application" OR "your application" OR "application confirmation" OR "application for" OR "applied for" OR interview OR "phone screen" OR "phone interview" OR "video interview" OR "next steps" OR "moving forward" OR "not moving forward" OR "no longer" OR "other candidates" OR offer OR "job offer") newer_than:90d',
      // 3. Rejection-specific body language — catches "update on your application" style emails
      // that have rejection phrases IN the body but vague subjects
      '("not moving forward" OR "decided to move forward with other" OR "other candidates" OR "we will not be moving forward" OR "unfortunately we" OR "unfortunately, we" OR "at this time we" OR "no longer being considered" OR "position has been filled" OR "we won\'t be moving forward" OR "not selected" OR "not be proceeding" OR "have chosen to move forward with another" OR "will not be moving forward") newer_than:90d',
    ];

    // Collect unique message IDs across both queries
    const messageIdSet = new Set<string>();
    for (const q of queries) {
      let pageToken: string | undefined;
      do {
        const res = await gmail.users.messages.list({
          userId: "me",
          q,
          maxResults: 100,
          pageToken,
        });
        for (const m of res.data.messages ?? []) {
          if (m.id) messageIdSet.add(m.id);
        }
        pageToken = res.data.nextPageToken ?? undefined;
        // Cap at 400 emails total to keep sync fast
        if (messageIdSet.size >= 400) break;
      } while (pageToken && messageIdSet.size < 400);
    }

    const messageIds = Array.from(messageIdSet);
    console.log(`Gmail sync: ${messageIds.length} candidate emails`);

    let updated = 0;
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    const existingApps = await prisma.application.findMany({ where: { userId } });

    for (const id of messageIds) {
      try {
        // Fetch full message so we can decode the body
        const detail = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = detail.data.payload?.headers ?? [];
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
        const from = headers.find((h) => h.name === "From")?.value ?? "";
        const dateHeader = headers.find((h) => h.name === "Date")?.value;

        // Parse email date (fall back to internalDate, then today)
        let emailDate: Date = new Date();
        if (dateHeader) {
          const d = new Date(dateHeader);
          if (!isNaN(d.getTime())) emailDate = d;
        } else if (detail.data.internalDate) {
          emailDate = new Date(parseInt(detail.data.internalDate));
        }

        const body = extractBody(detail.data.payload ?? {});

        const parsed = await parseEmail(from, subject, body);

        if (!parsed || parsed.confidence < 0.7 || parsed.email_type === "unknown") {
          skipped++;
          continue;
        }

        const inferredStatus = EMAIL_TYPE_TO_STATUS[parsed.email_type];
        if (!inferredStatus) {
          skipped++;
          continue;
        }

        // Determine appliedDate
        const appliedDate =
          parsed.applied_date ? new Date(parsed.applied_date) : emailDate;

        // Try to match existing application:
        // 1st priority: company + role both match
        // 2nd priority (rejections only): company match alone — role text often
        //   differs between confirmation and rejection emails
        let match = existingApps.find(
          (app) =>
            fuzzyMatch(app.company, parsed.company) &&
            fuzzyMatch(app.role, parsed.role)
        );
        if (!match && parsed.email_type === "rejection") {
          // For rejections, fall back to company-only match (pick most recent)
          const companyMatches = existingApps.filter((app) =>
            companyOnlyMatch(app.company, parsed.company)
          );
          if (companyMatches.length === 1) {
            match = companyMatches[0];
          } else if (companyMatches.length > 1) {
            // If multiple roles at same company, pick the one not yet rejected
            match =
              companyMatches.find((a) => a.status !== "Rejected") ??
              companyMatches[0];
          }
        }

        if (match) {
          const currentRank = STATUS_ORDER[match.status as Status] ?? 0;
          const newRank = STATUS_ORDER[inferredStatus] ?? 0;
          if (newRank > currentRank) {
            const followUpDate = calcFollowUpDate(inferredStatus, new Date());
            await prisma.application.update({
              where: { id: match.id },
              data: { status: inferredStatus, followUpDate, source: "gmail_sync" },
            });
            await prisma.timeline.create({
              data: {
                applicationId: match.id,
                status: inferredStatus,
                note: `Updated via Gmail sync (${parsed.email_type})`,
              },
            });
            match.status = inferredStatus;
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Lower threshold for creating new apps — 0.75 is enough to trust it
          const followUpDate = calcFollowUpDate(inferredStatus, appliedDate);
          const newApp = await prisma.application.create({
            data: {
              userId,
              company: parsed.company,
              role: parsed.role,
              status: inferredStatus,
              appliedDate,
              followUpDate,
              source: "gmail_sync",
              timeline: {
                create: {
                  status: inferredStatus,
                  note: `Created via Gmail sync (${parsed.email_type})`,
                },
              },
            },
          });
          existingApps.push(newApp);
          created++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${id}: ${msg}`);
        skipped++;
      }
    }

    console.log(`Gmail sync done — updated:${updated} created:${created} skipped:${skipped}`);

    return NextResponse.json({
      updated,
      created,
      skipped,
      total: messageIds.length,
      ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
    });
  } catch (e) {
    console.error("Gmail sync error:", e);
    const msg = e instanceof Error ? e.message : "Gmail sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
