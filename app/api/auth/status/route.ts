import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

export async function GET() {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return NextResponse.json({ connected: false });

  try {
    const token = await prisma.oAuthToken.findUnique({ where: { userId } });
    return NextResponse.json({ connected: !!token });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
