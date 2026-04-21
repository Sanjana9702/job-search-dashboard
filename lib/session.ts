import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Returns the current session's userId, or a 401 NextResponse if not authenticated.
 * Usage in API routes:
 *   const result = await getUserId();
 *   if (result instanceof NextResponse) return result;
 *   const userId = result;
 */
export async function getUserId(): Promise<string | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user.id;
}
