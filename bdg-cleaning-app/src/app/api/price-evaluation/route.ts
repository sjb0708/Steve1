import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { airbnbListingIdFromIcal } from "@/lib/airbnb-listing"
import { buildPriceEvaluation } from "@/lib/price-evaluation"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const properties = await prisma.property.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, airbnbIcalUrl: true },
    })
    const requested = req.nextUrl.searchParams.get("propertyId")
    const selectedId = properties.find((p) => p.id === requested)?.id ?? properties[0]?.id ?? null

    const [evaluation, lastRun] = await Promise.all([
      selectedId ? buildPriceEvaluation(selectedId) : null,
      prisma.marketRun.findFirst({ orderBy: { startedAt: "desc" } }),
    ])

    return NextResponse.json({
      properties: properties.map((p) => ({
        id: p.id,
        name: p.name,
        trackable: !!airbnbListingIdFromIcal(p.airbnbIcalUrl),
      })),
      selectedId,
      evaluation,
      lastRun,
    })
  } catch (error) {
    console.error("[price-evaluation]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
