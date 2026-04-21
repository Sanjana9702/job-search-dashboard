import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcFollowUpDate } from "@/lib/follow-up";
import { Status, STATUS_ORDER } from "@/types";
import { getUserId } from "@/lib/session";

type Params = { params: { id: string } };

async function getOwnedApp(id: string, userId: string) {
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) return null;
  // Allow access if app belongs to user, or is an unowned legacy record
  if (app.userId && app.userId !== userId) return null;
  return app;
}

export async function GET(_req: Request, { params }: Params) {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const app = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        contacts: { orderBy: { outreachDate: "desc" } },
        timeline: { orderBy: { createdAt: "asc" } },
        _count: { select: { contacts: true } },
      },
    });
    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (app.userId && app.userId !== userId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(app);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const current = await getOwnedApp(params.id, userId);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (body.company !== undefined) data.company = body.company;
    if (body.role !== undefined) data.role = body.role;
    if (body.jobUrl !== undefined) data.jobUrl = body.jobUrl || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.appliedDate !== undefined) data.appliedDate = new Date(body.appliedDate);
    if ("followUpDate" in body) {
      data.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
    }

    if (body.status && body.status !== current.status) {
      const currentRank = STATUS_ORDER[current.status as Status] ?? 0;
      const newRank = STATUS_ORDER[body.status as Status] ?? 0;
      if (newRank > currentRank) {
        data.status = body.status;
        if (!("followUpDate" in body)) {
          data.followUpDate = calcFollowUpDate(body.status as Status, new Date());
        }
        await prisma.timeline.create({
          data: { applicationId: params.id, status: body.status },
        });
      }
    }

    const updated = await prisma.application.update({
      where: { id: params.id },
      data,
      include: {
        contacts: { orderBy: { outreachDate: "desc" } },
        timeline: { orderBy: { createdAt: "asc" } },
        _count: { select: { contacts: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const current = await getOwnedApp(params.id, userId);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.application.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
