import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

// Turns "Pigeon Forge, TN" into coordinates plus its county and state, so a
// market can be added by name. OpenStreetMap's geocoder: free, no key, and
// its usage policy asks for an identifying User-Agent.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const query = req.nextUrl.searchParams.get("q")?.trim()
    if (!query) return NextResponse.json({ error: "Type a city and state." }, { status: 400 })

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us`
    const res = await fetch(url, {
      headers: { "User-Agent": "BDG-Cleaning-App/1.0 (short-term rental analysis)" },
      cache: "no-store",
    })
    if (!res.ok) return NextResponse.json({ error: `Location lookup returned status ${res.status}.` }, { status: 502 })

    const raw = (await res.json()) as {
      display_name: string
      lat: string
      lon: string
      address?: { city?: string; town?: string; village?: string; county?: string; state?: string }
    }[]

    const places = raw.map((r) => {
      const city = r.address?.city ?? r.address?.town ?? r.address?.village ?? r.display_name.split(",")[0]
      const state = r.address?.state ?? null
      return {
        label: state ? `${city}, ${state}` : city,
        displayName: r.display_name,
        latitude: Number(r.lat),
        longitude: Number(r.lon),
        county: r.address?.county ?? null,
        state,
      }
    })
    return NextResponse.json({ places })
  } catch (error) {
    console.error("[market-analysis/geocode]", error)
    return NextResponse.json({ error: "Location lookup failed." }, { status: 502 })
  }
}
