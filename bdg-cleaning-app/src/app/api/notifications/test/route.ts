import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyUser } from "@/lib/notify"
import { adminAlertEmail } from "@/lib/email"
import { CARRIER_GATEWAYS } from "@/lib/carriers"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// "Send me a test" from Settings → Notifications. Sends the same shape of
// alert a real cleaning-needed notice uses, to the signed-in user only, and
// reports back exactly which channels it tried — so a silent text is
// diagnosable (no phone? no carrier? toggle off?) instead of a mystery.
export async function POST() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const me = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        carrier: true,
        emailNotifications: true,
        smsNotifications: true,
      },
    })
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const gatewayReady = !!me.phone && !!me.carrier && !!CARRIER_GATEWAYS[me.carrier]

    const result = await notifyUser(me, {
      subject: "Test alert from BDG Cleaning",
      emailHtml: adminAlertEmail({
        recipientName: me.name,
        heading: "Test Alert",
        intro:
          "This is a test. Real alerts look like this — a cleaning needed, a cleaner accepting or declining, supplies requested, or an issue reported.",
        details: [
          { label: "SENT TO", value: me.email ?? "—" },
          { label: "TEXT SENT TO", value: gatewayReady ? (me.phone ?? "—") : "Not sent" },
        ],
        ctaLabel: "Open the App",
        ctaUrl: APP_URL,
        tone: "good",
      }),
      smsBody: "BDG Cleaning: this is a test alert. Real alerts about cleanings will arrive here.",
    })

    await prisma.notification.create({
      data: {
        userId: me.id,
        type: "GENERAL",
        title: "Test Alert",
        message: "This is a test alert. If you also got an email or a text, those channels are working.",
      },
    })

    // "Accepted by the mail server" is the strongest claim we can make — it
    // can still be filtered into Spam on the way in, so say so rather than
    // promising it arrived.
    const skipped = [...result.problems]
    if (result.emailOk) skipped.push("If the email isn't in your inbox, check Spam and Promotions for 'baileydevelopmentgroup'.")

    return NextResponse.json({ emailSent: result.emailOk, smsSent: result.smsOk, skipped })
  } catch (error) {
    console.error("[notifications/test]", error)
    return NextResponse.json({ error: "Failed to send the test." }, { status: 500 })
  }
}
