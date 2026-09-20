import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { archivePastJobs } from "@/lib/jobs"

// Manual "Archive past jobs" — the nightly cron does this automatically, but
// clearing a backlog shouldn't mean waiting until tomorrow morning.
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const count = await archivePastJobs()
    return NextResponse.json({ count })
  } catch (error) {
    console.error("[jobs/archive]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
