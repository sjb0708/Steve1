import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { loadMarketAnalysisData } from "@/lib/market-analysis"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(await loadMarketAnalysisData())
  } catch (error) {
    console.error("[market-analysis]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
