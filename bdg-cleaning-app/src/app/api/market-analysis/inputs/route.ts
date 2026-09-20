import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { saveInputs, resetInputs } from "@/lib/market-analysis"

async function isAdmin() {
  const user = await getCurrentUser()
  return !!user && user.role === "ADMIN"
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ inputs: await saveInputs(await req.json()) })
  } catch (error) {
    console.error("[market-analysis/inputs]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Reset everything to the starting assumptions
export async function DELETE() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ inputs: await resetInputs() })
  } catch (error) {
    console.error("[market-analysis/inputs]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
