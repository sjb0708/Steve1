import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    if (user.role === "ADMIN") {
      const payments = await prisma.payment.findMany({
        where: jobId ? { jobId } : undefined,
        include: {
          job: {
            include: {
              property: true,
              cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          property: true,
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ payments })
    }

    // Cleaner: only their own payments
    const payments = await prisma.payment.findMany({
      where: { cleanerId: user.userId },
      include: {
        job: {
          include: {
            property: true,
          },
        },
        property: true,
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ payments })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { jobId, cleanerId, propertyId, amount } = body

    if (!jobId || !cleanerId || !propertyId || amount === undefined) {
      return NextResponse.json({ error: "jobId, cleanerId, propertyId, and amount are required" }, { status: 400 })
    }

    const payment = await prisma.payment.create({
      data: {
        jobId,
        cleanerId,
        propertyId,
        amount: parseFloat(amount),
      },
      include: {
        job: { include: { property: true } },
        cleaner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        property: true,
      },
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
