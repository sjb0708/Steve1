import { NextRequest, NextResponse, after } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { scanMarket } from "@/lib/market-analysis"

// Called by Vercel Cron once a day for every active market (GET,
// Authorization: Bearer <CRON_SECRET>), or from the page's "Update now"
// button for one market (POST { marketId }).
export const dynamic = "force-dynamic"
export const maxDuration = 300

async function isAdmin() {
  const user = await getCurrentUser()
  return !!user && user.role === "ADMIN"
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const viaCron =
    !!cronSecret &&
    (req.headers.get("authorization") === `Bearer ${cronSecret}` ||
      req.nextUrl.searchParams.get("secret") === cronSecret)
  if (!viaCron && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await scanMarket()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const marketId = typeof body.marketId === "string" ? body.marketId : undefined
  after(async () => {
    const result = await scanMarket(marketId)
    if (!result.ok) console.error("[market-analysis/collect]", result.message)
  })
  return NextResponse.json({ started: true })
}
