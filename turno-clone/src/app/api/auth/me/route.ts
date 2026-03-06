import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, avatarUrl: true, bio: true,
        location: true, hourlyRate: true,
        rating: true, reviewCount: true, createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Me error:", error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
