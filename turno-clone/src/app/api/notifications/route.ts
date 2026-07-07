import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const notifications = await prisma.notification.findMany({
      where: { userId: user.userId },
      include: {
        job: { include: { property: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: user.userId, read: false },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()

    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.userId, read: false },
        data: { read: true },
      })
    } else if (body.id) {
      await prisma.notification.update({
        where: { id: body.id, userId: user.userId },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
