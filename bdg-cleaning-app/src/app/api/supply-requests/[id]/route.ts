import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const { status } = await req.json()

    const valid = ["PENDING", "ORDERED", "DELIVERED"]
    if (!valid.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const request = await prisma.supplyRequest.update({
      where: { id },
      data: { status },
      include: {
        property: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        job: { select: { id: true, scheduledDate: true } },
      },
    })

    return NextResponse.json({ request })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
