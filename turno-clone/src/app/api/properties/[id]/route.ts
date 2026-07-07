import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        jobs: { where: { status: { in: ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS"] } }, orderBy: { scheduledDate: "asc" } },
        bookings: { orderBy: { checkOut: "asc" } },
        checklistTemplate: { include: { items: { orderBy: { order: "asc" } } } },
      },
    })

    if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ property })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.address !== undefined) updateData.address = body.address
    if (body.city !== undefined) updateData.city = body.city
    if (body.state !== undefined) updateData.state = body.state
    if (body.description !== undefined) updateData.description = body.description
    if (body.airbnbIcalUrl !== undefined) updateData.airbnbIcalUrl = body.airbnbIcalUrl || null
    if (body.vrboIcalUrl !== undefined) updateData.vrboIcalUrl = body.vrboIcalUrl || null
    if (body.cleaningDuration !== undefined) updateData.cleaningDuration = parseInt(body.cleaningDuration)
    if (body.cleaningFee !== undefined) updateData.cleaningFee = parseFloat(body.cleaningFee) || 0
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null
    if (body.accessInstructions !== undefined) updateData.accessInstructions = body.accessInstructions || null

    const property = await prisma.property.update({
      where: { id },
      data: updateData,
      include: {
        checklistTemplate: { include: { items: { orderBy: { order: "asc" } } } },
      },
    })

    return NextResponse.json({ property })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await prisma.property.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
