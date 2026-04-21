export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getUserId } from "@/lib/session";

export async function GET() {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return userId;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Pass userId as OAuth state so the callback knows who to associate the token with
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state: userId,
  });

  return NextResponse.redirect(authUrl);
}
