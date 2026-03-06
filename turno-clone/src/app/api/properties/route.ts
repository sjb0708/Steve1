import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const properties = await prisma.property.findMany({
      where: { hostId: user.userId },
      include: { jobs: { where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } }, take: 1, orderBy: { scheduledDate: "asc" } } },
      orderBy: { createdAt: "desc" },
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
    if (!user || user.role !== "HOST") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { name, address, city, state, bedrooms, bathrooms, description, imageUrl, icalUrl, cleaningDuration, cleaningRate, platform } = body

    if (!name || !address || !city || !state) {
      return NextResponse.json({ error: "Name, address, city and state are required" }, { status: 400 })
    }

    const property = await prisma.property.create({
      data: {
        hostId: user.userId,
        name, address, city, state,
        bedrooms: parseInt(bedrooms),
        bathrooms: parseFloat(bathrooms),
        description: description || null,
        imageUrl: imageUrl || null,
        icalUrl: icalUrl || null,
        cleaningDuration: parseInt(cleaningDuration) || 180,
        cleaningRate: parseFloat(cleaningRate) || 100,
        platform: platform || "MANUAL",
      },
    })

    return NextResponse.json({ property }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
