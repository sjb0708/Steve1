import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { airbnbListingIdFromIcal, fetchAirbnbListing, ListingFetchError } from "@/lib/airbnb-listing"

const listingFields = {
  airbnbListingText: true,
  airbnbListingPulledAt: true,
  vrboListingText: true,
  otherPolicies: true,
} as const

// POST: pull the latest text from the public Airbnb listing
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const property = await prisma.property.findUnique({ where: { id } })
    if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const listingId = airbnbListingIdFromIcal(property.airbnbIcalUrl)
    if (!listingId) {
      return NextResponse.json(
        { error: "This property has no Airbnb calendar link, so there's no listing to pull. Paste the text in instead." },
        { status: 400 },
      )
    }

    let text: string
    try {
      text = await fetchAirbnbListing(listingId)
    } catch (err) {
      if (err instanceof ListingFetchError) return NextResponse.json({ error: err.message }, { status: 502 })
      throw err
    }

    const updated = await prisma.property.update({
      where: { id },
      data: { airbnbListingText: text, airbnbListingPulledAt: new Date() },
      select: listingFields,
    })
    return NextResponse.json({ listing: updated })
  } catch (error) {
    console.error("[properties/listing]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: save pasted or edited listing text
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const data: Record<string, string | null> = {}
    for (const key of ["airbnbListingText", "vrboListingText", "otherPolicies"] as const) {
      if (typeof body[key] === "string") data[key] = body[key].trim() || null
    }

    const updated = await prisma.property.update({ where: { id }, data, select: listingFields })
    return NextResponse.json({ listing: updated })
  } catch (error) {
    console.error("[properties/listing]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
