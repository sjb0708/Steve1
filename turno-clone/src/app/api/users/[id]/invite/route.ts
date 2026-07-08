import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail, loginInviteEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Lets an admin send an EXISTING cleaner (created with an unknown random
// password via Add Cleaner) a link to set their own password and actually
// log into the app — separate from the per-job tap-to-respond links, which
// don't require any login at all.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.user.update({
      where: { id },
      data: { inviteToken: token, inviteExpiry: expiry },
    })

    const inviteUrl = `${APP_URL}/register?invite=${token}`

    await sendEmail({
      to: target.email,
      subject: "Set up your login — Bailey Development Group",
      html: loginInviteEmail(target.name, inviteUrl),
    })

    return NextResponse.json({ inviteUrl })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
