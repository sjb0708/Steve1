import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfWeek, endOfWeek } from "date-fns"
import { alertHorizon } from "@/lib/alert-window"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const now = new Date()
    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)
    // Action counts only look at today onward — a past checkout that never got
    // a cleaner isn't actionable anymore and just inflates the numbers
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // Same horizon the alerts use: this month, opening to next month in the
    // final two weeks. A count that reaches into next spring isn't a to-do
    // list, it's just a big number — bookings arrive unassigned by default,
    // so without this the tile only ever grows.
    const { end: horizonEnd, extendedToNextMonth } = alertHorizon(now)
    const horizonLabel = horizonEnd.toLocaleDateString("en-US", { month: "long" })

    const [totalProperties, unassignedJobs, unassignedLater, assignedJobs, upcomingThisWeek, openIssues, pendingSupplies] = await Promise.all([
      prisma.property.count(),
      prisma.job.count({
        where: { status: "UNASSIGNED", archivedAt: null, scheduledDate: { gte: todayStart, lte: horizonEnd } },
      }),
      prisma.job.count({
        where: { status: "UNASSIGNED", archivedAt: null, scheduledDate: { gt: horizonEnd } },
      }),
      prisma.job.count({ where: { status: { in: ["ASSIGNED", "PENDING_ACCEPTANCE", "IN_PROGRESS"] }, archivedAt: null, scheduledDate: { gte: todayStart } } }),
      // "Upcoming cleanings" this week = today through end of week, not days
      // of the week that have already passed
      prisma.job.count({
        where: {
          archivedAt: null,
          scheduledDate: { gte: todayStart > weekStart ? todayStart : weekStart, lte: weekEnd },
          status: { notIn: ["CANCELLED"] },
        },
      }),
      prisma.issueReport.count({
        where: { status: "OPEN" },
      }),
      prisma.supplyRequest.count({
        where: { status: "PENDING" },
      }),
    ])

    return NextResponse.json({
      totalProperties,
      unassignedJobs,
      unassignedLater,
      horizonLabel,
      horizonIncludesNextMonth: extendedToNextMonth,
      assignedJobs,
      upcomingThisWeek,
      openIssues,
      pendingSupplies,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
