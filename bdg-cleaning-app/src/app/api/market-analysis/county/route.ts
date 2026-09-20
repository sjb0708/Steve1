import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { lookupCountyRecord } from "@/lib/county-records"
import { refreshCountyRecord } from "@/lib/market-analysis"

export const maxDuration = 60

// { listingId } refreshes and saves a for-sale home's county record.
// { address } just looks one up (used to fill in an equity source's value).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json()

    if (typeof body.listingId === "string") {
      const listing = await refreshCountyRecord(body.listingId)
      if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 })
      return NextResponse.json({ county: listing.county, countyError: listing.countyError })
    }

    if (typeof body.address === "string" && body.address.trim()) {
      const record = await lookupCountyRecord(body.address)
      if (!record) {
        return NextResponse.json({ error: "No Marion County parcel found at that address." }, { status: 404 })
      }
      return NextResponse.json({ county: record })
    }

    return NextResponse.json({ error: "Send a listingId or an address." }, { status: 400 })
  } catch (error) {
    console.error("[market-analysis/county]", error)
    const message = error instanceof Error ? error.message : "County lookup failed."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
