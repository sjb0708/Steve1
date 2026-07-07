import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfWeek, endOfWeek } from "date-fns"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const now = new Date()
    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)

    const [totalProperties, unassignedJobs, assignedJobs, upcomingThisWeek, openIssues, pendingSupplies] = await Promise.all([
      prisma.property.count({ where: { hostId: user.userId } }),
      prisma.job.count({ where: { hostId: user.userId, status: "UNASSIGNED" } }),
      prisma.job.count({ where: { hostId: user.userId, status: { in: ["ASSIGNED", "PENDING_ACCEPTANCE", "IN_PROGRESS"] } } }),
      prisma.job.count({
        where: {
          hostId: user.userId,
          scheduledDate: { gte: weekStart, lte: weekEnd },
          status: { notIn: ["CANCELLED"] },
        },
      }),
      prisma.issueReport.count({
        where: { property: { hostId: user.userId }, status: "OPEN" },
      }),
      prisma.supplyRequest.count({
        where: { property: { hostId: user.userId }, status: "PENDING" },
      }),
    ])

    return NextResponse.json({ totalProperties, unassignedJobs, assignedJobs, upcomingThisWeek, openIssues, pendingSupplies })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
