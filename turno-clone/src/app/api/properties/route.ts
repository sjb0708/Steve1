import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const properties = await prisma.property.findMany({
      include: {
        jobs: {
          where: { status: { in: ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS"] } },
          orderBy: { scheduledDate: "asc" },
        },
        bookings: { orderBy: { checkOut: "asc" } },
        checklistTemplate: { include: { items: { orderBy: { order: "asc" } } } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ properties })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { name, address, city, state, bedrooms, bathrooms, description, imageUrl, airbnbIcalUrl, vrboIcalUrl, cleaningDuration, cleaningFee } = body

    if (!name || !address || !city || !state) {
      return NextResponse.json({ error: "Name, address, city and state are required" }, { status: 400 })
    }

    const beds = parseInt(bedrooms) || 1
    const baths = parseFloat(bathrooms) || 1

    const property = await prisma.property.create({
      data: {
        hostId: user.userId,
        name,
        address,
        city,
        state,
        bedrooms: beds,
        bathrooms: baths,
        description: description || null,
        imageUrl: imageUrl || null,
        airbnbIcalUrl: airbnbIcalUrl || null,
        vrboIcalUrl: vrboIcalUrl || null,
        cleaningDuration: parseInt(cleaningDuration) || 180,
        cleaningFee: parseFloat(cleaningFee) || 0,
      },
    })

    // Auto-create checklist template based on room count
    const items: { label: string; room: string; order: number }[] = [
      { label: "Vacuum all floors", room: "General", order: 0 },
      { label: "Mop hard floors", room: "General", order: 1 },
      { label: "Empty all trash cans", room: "General", order: 2 },
      { label: "Wipe down light switches and door handles", room: "General", order: 3 },
      { label: "Clean kitchen counters and appliances", room: "Kitchen", order: 4 },
      { label: "Clean inside microwave", room: "Kitchen", order: 5 },
      { label: "Wipe down stovetop and oven", room: "Kitchen", order: 6 },
      { label: "Clean and sanitize sink", room: "Kitchen", order: 7 },
    ]

    for (let i = 1; i <= beds; i++) {
      const room = i === 1 ? "Master Bedroom" : `Bedroom ${i}`
      items.push(
        { label: "Make bed with fresh linens", room, order: items.length },
        { label: "Dust all surfaces", room, order: items.length + 1 },
      )
    }

    const bathCount = Math.ceil(baths)
    for (let i = 1; i <= bathCount; i++) {
      const room = i === 1 ? "Master Bathroom" : `Bathroom ${i}`
      items.push(
        { label: "Clean and disinfect toilet", room, order: items.length },
        { label: "Clean shower/tub", room, order: items.length + 1 },
        { label: "Clean sink and mirror", room, order: items.length + 2 },
        { label: "Replace towels and toiletries", room, order: items.length + 3 },
      )
    }

    items.push({ label: "Final walkthrough", room: "General", order: items.length })

    await prisma.checklistTemplate.create({
      data: {
        propertyId: property.id,
        items: { create: items },
      },
    })

    return NextResponse.json({ property }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
