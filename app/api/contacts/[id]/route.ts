export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

type Params = { params: { id: string } };

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    // Verify ownership via the parent application
    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      include: { application: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (contact.application.userId && contact.application.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.contact.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
