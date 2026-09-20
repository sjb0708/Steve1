import { NextRequest, NextResponse, after } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { collectMarketData } from "@/lib/market-data"

// Called by Vercel Cron once a day (GET, Authorization: Bearer <CRON_SECRET>),
// or from the Price Evaluation page's "Update now" button (POST).
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
  const result = await collectMarketData()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  after(async () => {
    const result = await collectMarketData()
    if (!result.ok) console.error("[price-evaluation/collect]", result.message)
  })
  return NextResponse.json({ started: true })
}
