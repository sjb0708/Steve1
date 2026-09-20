import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const items = await prisma.propertySupplyItem.findMany({
      where: { propertyId: id },
      orderBy: { order: "asc" },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Replace-all, same pattern as the checklist template endpoint — the admin
// edits the whole list at once rather than issuing per-item CRUD calls.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { items } = await req.json()

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Items must be an array" }, { status: 400 })
    }

    const names = items.map((n: string) => n.trim()).filter(Boolean)

    await prisma.propertySupplyItem.deleteMany({ where: { propertyId: id } })
    if (names.length > 0) {
      await prisma.propertySupplyItem.createMany({
        data: names.map((name: string, index: number) => ({ propertyId: id, name, order: index })),
      })
    }

    const updated = await prisma.propertySupplyItem.findMany({
      where: { propertyId: id },
      orderBy: { order: "asc" },
    })

    return NextResponse.json({ items: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
