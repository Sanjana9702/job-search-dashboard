import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcFollowUpDate } from "@/lib/follow-up";
import { Status, STATUS_ORDER } from "@/types";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
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
    return NextResponse.json(app);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const body = await request.json();
    const current = await prisma.application.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    // Simple scalar fields
    if (body.company !== undefined) data.company = body.company;
    if (body.role !== undefined) data.role = body.role;
    if (body.jobUrl !== undefined) data.jobUrl = body.jobUrl || null;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.appliedDate !== undefined) data.appliedDate = new Date(body.appliedDate);

    // Manual follow-up override
    if ("followUpDate" in body) {
      data.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
    }

    // Status — forward-only, auto recalculate follow-up
    if (body.status && body.status !== current.status) {
      const currentRank = STATUS_ORDER[current.status as Status] ?? 0;
      const newRank = STATUS_ORDER[body.status as Status] ?? 0;
      if (newRank > currentRank) {
        data.status = body.status;
        // Only recalculate follow-up if not manually set in same request
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
  try {
    await prisma.application.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
