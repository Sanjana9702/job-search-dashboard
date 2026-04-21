import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicationId, name, role, platform = "linkedin", outreachDate, notes } = body;

    if (!applicationId || !name || !outreachDate) {
      return NextResponse.json(
        { error: "applicationId, name, and outreachDate are required" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        applicationId,
        name: name.trim(),
        role: role?.trim() || null,
        platform,
        outreachDate: new Date(outreachDate),
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
