import { NextRequest, NextResponse, after } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAnthropicApiKey } from "@/lib/app-settings"
import { airbnbListingIdFromIcal } from "@/lib/airbnb-listing"
import { runRiskAssessment, STALE_RUN_MS } from "@/lib/risk-assessment"

// The run continues in after() once the response is sent; research with web
// search typically takes a few minutes.
export const maxDuration = 300

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await prisma.riskAssessment.updateMany({
      where: { status: "RUNNING", createdAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
      data: {
        status: "FAILED",
        error: "The assessment didn't finish (the server stopped it). Run it again.",
        completedAt: new Date(),
      },
    })

    const properties = await prisma.property.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, address: true, city: true, state: true,
        airbnbIcalUrl: true, vrboIcalUrl: true,
        airbnbListingText: true, airbnbListingPulledAt: true, vrboListingText: true, otherPolicies: true,
        riskAssessments: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    })

    return NextResponse.json({
      aiKeySet: !!(await getAnthropicApiKey()),
      // iCal URLs carry a private token; the page only needs to know they exist
      properties: properties.map(({ airbnbIcalUrl, vrboIcalUrl, ...p }) => ({
        ...p,
        canPullAirbnb: !!airbnbListingIdFromIcal(airbnbIcalUrl),
        onAirbnb: !!airbnbIcalUrl,
        onVrbo: !!vrboIcalUrl,
      })),
    })
  } catch (error) {
    console.error("[risk-assessments]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { propertyId } = await req.json()
    const property = await prisma.property.findUnique({ where: { id: String(propertyId ?? "") } })
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

    if (!(await getAnthropicApiKey())) {
      return NextResponse.json({ error: "Add your Claude API key in Settings → AI Assistant first." }, { status: 400 })
    }
    if (!property.airbnbListingText?.trim() && !property.vrboListingText?.trim()) {
      return NextResponse.json(
        { error: "Pull the Airbnb listing or paste the VRBO listing first, so there's something to review." },
        { status: 400 },
      )
    }

    const running = await prisma.riskAssessment.findFirst({
      where: { propertyId: property.id, status: "RUNNING", createdAt: { gte: new Date(Date.now() - STALE_RUN_MS) } },
    })
    if (running) {
      return NextResponse.json({ error: "An assessment is already running for this property." }, { status: 409 })
    }

    const assessment = await prisma.riskAssessment.create({ data: { propertyId: property.id } })
    after(() => runRiskAssessment(assessment.id))
    return NextResponse.json({ assessment })
  } catch (error) {
    console.error("[risk-assessments]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
