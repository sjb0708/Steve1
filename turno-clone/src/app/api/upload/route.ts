import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { storeFile } from "@/lib/storage"
import { randomUUID } from "crypto"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll("files") as File[]

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }
    if (files.length > 5) {
      return NextResponse.json({ error: "Maximum 5 photos allowed" }, { status: 400 })
    }

    const urls: string[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File ${file.name} exceeds 10MB limit` }, { status: 400 })
      }
      // Accept common image types including HEIC from iPhone
      const isImage = ALLOWED_TYPES.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)
      if (!isImage) {
        return NextResponse.json({ error: `File ${file.name} is not a supported image type` }, { status: 400 })
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const filename = `${randomUUID()}.${ext}`
      const bytes = await file.arrayBuffer()
      urls.push(await storeFile("issues", filename, Buffer.from(bytes), file.type || undefined))
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
