import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

// Storage: Vercel Blob in production (BLOB_READ_WRITE_TOKEN present),
// local public/uploads on dev machines. Local disk does NOT work on Vercel —
// the serverless filesystem is ephemeral.
export async function storeFile(folder: string, filename: string, bytes: Buffer, contentType?: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob")
    const blob = await put(`${folder}/${filename}`, bytes, {
      access: "public",
      contentType,
    })
    return blob.url
  }

  const dir = join(process.cwd(), "public", "uploads", folder)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), bytes)
  return `/uploads/${folder}/${filename}`
}
