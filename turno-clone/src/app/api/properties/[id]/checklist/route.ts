import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const template = await prisma.checklistTemplate.findUnique({
      where: { propertyId: id },
      include: { items: { orderBy: { order: "asc" } } },
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { items } = await req.json()

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Items must be an array" }, { status: 400 })
    }

    // Upsert the template
    const template = await prisma.checklistTemplate.upsert({
      where: { propertyId: id },
      create: { propertyId: id },
      update: {},
    })

    // Replace all items
    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: template.id } })
    await prisma.checklistTemplateItem.createMany({
      data: items.map((item: { label: string; room?: string }, index: number) => ({
        templateId: template.id,
        label: item.label,
        room: item.room || null,
        order: index,
      })),
    })

    const updated = await prisma.checklistTemplate.findUnique({
      where: { id: template.id },
      include: { items: { orderBy: { order: "asc" } } },
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
