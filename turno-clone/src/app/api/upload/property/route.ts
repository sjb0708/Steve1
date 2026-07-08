import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { storeFile } from "@/lib/storage"
import { randomUUID } from "crypto"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 })

    const isImage = ALLOWED_TYPES.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)
    if (!isImage) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const filename = `${randomUUID()}.${ext}`
    const bytes = await file.arrayBuffer()
    const imageUrl = await storeFile("properties", filename, Buffer.from(bytes), file.type || undefined)

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
