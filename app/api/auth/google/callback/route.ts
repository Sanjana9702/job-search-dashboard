import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId passed as state

  if (!code) {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }

  // Double-check: verify the session user matches the state userId
  const sessionUserId = await getUserId();
  const userId = sessionUserId instanceof NextResponse ? state : sessionUserId;

  if (!userId) {
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    await prisma.oAuthToken.upsert({
      where: { userId },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        userId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return NextResponse.redirect(new URL("/?connected=gmail", request.url));
  } catch (e) {
    console.error("OAuth callback error:", e);
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
