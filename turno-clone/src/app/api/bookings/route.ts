import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get("propertyId")

    const bookings = await prisma.booking.findMany({
      where: propertyId ? { propertyId } : {},
      include: {
        property: { select: { id: true, name: true, bedrooms: true, bathrooms: true } },
        jobs: {
          include: {
            cleaner: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { checkIn: "asc" },
    })

    return NextResponse.json({ bookings })
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
    const { propertyId, platform, guestName, checkIn, checkOut, notes } = body

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json({ error: "Property, check-in and check-out are required" }, { status: 400 })
    }

    const booking = await prisma.booking.create({
      data: {
        propertyId,
        platform: platform || "MANUAL",
        guestName: guestName || null,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        notes: notes || null,
      },
      include: {
        property: { select: { id: true, name: true } },
        jobs: true,
      },
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
