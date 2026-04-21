import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const token = await prisma.oAuthToken.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ connected: !!token });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
