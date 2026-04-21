import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcFollowUpDate } from "@/lib/follow-up";
import { Status } from "@/types";

export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(applications);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { company, role, jobUrl, status = "Applied", appliedDate, notes } = body;

    if (!company || !role || !appliedDate) {
      return NextResponse.json({ error: "company, role, and appliedDate are required" }, { status: 400 });
    }

    const applied = new Date(appliedDate);
    const followUpDate = calcFollowUpDate(status as Status, applied);

    const application = await prisma.application.create({
      data: {
        company: company.trim(),
        role: role.trim(),
        jobUrl: jobUrl?.trim() || null,
        status,
        appliedDate: applied,
        followUpDate,
        notes: notes?.trim() || null,
        source: "manual",
        timeline: { create: { status, note: "Application created" } },
      },
      include: { _count: { select: { contacts: true } } },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
