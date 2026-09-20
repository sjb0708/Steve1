import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail, adminAlertEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Forgot username / password. You enter your EMAIL (the thing you're most
// likely to remember), and we send a link that both reminds you of your
// username and lets you set a new password.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const normalized = (email ?? "").toLowerCase().trim()

    // Always answer the same way, whether or not the address is on file —
    // otherwise this page becomes a way to discover who has an account.
    const genericResponse = NextResponse.json({
      message: "If that email is on file, we've sent a link to reset your password.",
    })

    if (!normalized) return genericResponse

    const user = await prisma.user.findUnique({ where: { email: normalized } })
    if (!user) return genericResponse

    const token = crypto.randomBytes(24).toString("hex")
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetExpiry: expiry },
    })

    const resetUrl = `${APP_URL}/set-password?reset=${token}`

    await sendEmail({
      to: normalized,
      subject: "Reset your BDG Cleaning password",
      html: adminAlertEmail({
        recipientName: user.name.split(" ")[0],
        heading: "Reset Your Password",
        intro: "You asked to get back into BDG Cleaning. Your username is below — tap the button to set a new password.",
        details: [
          { label: "YOUR USERNAME", value: user.username ?? user.email ?? "—" },
        ],
        bullets: ["This link works for one hour, then it stops working."],
        ctaLabel: "Set a New Password",
        ctaUrl: resetUrl,
        tone: "info",
      }),
    })

    return genericResponse
  } catch (error) {
    console.error("[auth/forgot]", error)
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
