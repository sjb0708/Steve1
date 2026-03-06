import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where = user.role === "HOST"
      ? { hostId: user.userId, ...(status ? { status: status as never } : {}) }
      : { cleanerId: user.userId, ...(status ? { status: status as never } : {}) }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        property: true,
        host: { select: { id: true, name: true, email: true, avatarUrl: true, rating: true } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true, rating: true } },
        checklistItems: true,
        review: true,
      },
      orderBy: { scheduledDate: "asc" },
      take: limit,
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { propertyId, scheduledDate, notes, checkoutDate, checkinDate, platform } = body

    const property = await prisma.property.findUnique({ where: { id: propertyId } })
    if (!property || property.hostId !== user.userId) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const job = await prisma.job.create({
      data: {
        propertyId,
        hostId: user.userId,
        scheduledDate: new Date(scheduledDate),
        duration: property.cleaningDuration,
        price: property.cleaningRate,
        notes: notes || null,
        checkoutDate: checkoutDate ? new Date(checkoutDate) : null,
        checkinDate: checkinDate ? new Date(checkinDate) : null,
        platform: platform || "MANUAL",
        status: "OPEN",
        checklistItems: {
          create: [
            { label: "Vacuum all floors", room: "General" },
            { label: "Mop hard floors", room: "General" },
            { label: "Clean bathrooms (toilet, sink, shower/tub)", room: "Bathroom" },
            { label: "Replace towels and toiletries", room: "Bathroom" },
            { label: "Make all beds with fresh linens", room: "Bedroom" },
            { label: "Dust all surfaces and furniture", room: "Bedroom" },
            { label: "Clean kitchen counters and appliances", room: "Kitchen" },
            { label: "Clean inside/outside of microwave", room: "Kitchen" },
            { label: "Empty all trash cans", room: "General" },
            { label: "Wipe down mirrors and glass surfaces", room: "General" },
            { label: "Check and restock supplies", room: "General" },
            { label: "Final walkthrough and staging", room: "General" },
          ],
        },
      },
      include: { property: true, checklistItems: true },
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
