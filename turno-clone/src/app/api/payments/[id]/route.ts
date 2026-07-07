import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const existing = await prisma.payment.findUnique({
      where: { id },
      include: { property: true },
    })
    if (!existing) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
      include: {
        job: { include: { property: true } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        property: true,
      },
    })

    // Notify cleaner
    await prisma.notification.create({
      data: {
        userId: payment.cleanerId,
        type: "GENERAL",
        title: "Payment Received",
        message: `You've been paid $${payment.amount.toFixed(2)} for ${payment.property.name}.`,
      },
    })

    return NextResponse.json({ payment })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
