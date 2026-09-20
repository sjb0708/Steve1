// Outbound notification fan-out.
//
// Two audiences, same rules: always email (unless that person turned email
// off), plus a free carrier-gateway text whenever a phone + carrier are on
// file. Twilio is only a fallback for a phone with no carrier saved.
//
// Admin alerts go to EVERY approved admin, not just the property's host.
// Routing them to property.hostId meant a second owner on the account (e.g.
// a co-host) silently received nothing — the bell row and the email both
// landed on one person.

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSMSViaCarrierGateway, sendSMSViaTwilio } from "@/lib/sms"
import { getFlag, CLEANER_NOTIFICATIONS_PAUSED } from "@/lib/app-settings"

interface Recipient {
  name?: string
  email: string | null
  phone?: string | null
  carrier?: string | null
  emailNotifications?: boolean
  smsNotifications?: boolean
}

interface NotifyOptions {
  subject: string
  emailHtml: string
  smsBody: string
}

export interface NotifyResult {
  emailOk: boolean
  smsOk: boolean
  // Why a channel didn't send, in words a non-engineer can act on.
  problems: string[]
}

// Sends on every channel this person is reachable on and hasn't opted out of,
// and reports what actually landed — "no error thrown" is not the same as
// "delivered", and a silently dropped alert is the whole failure mode here.
export async function notifyUser(
  person: Recipient,
  { subject, emailHtml, smsBody }: NotifyOptions
): Promise<NotifyResult> {
  const problems: string[] = []
  let emailOk = false
  let smsOk = false

  if (!person.phone) problems.push("No mobile number is saved.")
  else if (person.smsNotifications === false) problems.push("Text notifications are turned off.")
  else {
    smsOk = await sendSMSViaCarrierGateway(person.phone, person.carrier, smsBody)
    if (!smsOk) {
      smsOk = await sendSMSViaTwilio(person.phone, smsBody)
      if (!smsOk) {
        problems.push(
          person.carrier
            ? "The text couldn't be delivered to that number and carrier."
            : "No mobile carrier is selected, so the free text gateway can't be used."
        )
      }
    }
  }

  if (!person.email) problems.push("No email address is saved.")
  else if (person.emailNotifications === false) problems.push("Email notifications are turned off.")
  else {
    const result = await sendEmail({ to: person.email, subject, html: emailHtml })
    emailOk = result.ok
    if (!emailOk) problems.push(result.detail)
  }

  return { emailOk, smsOk, problems }
}

// Cleaner-facing sends, which can be paused wholesale from Settings while
// the schedule is still being sorted out. In-app bell notifications are
// unaffected — only email and text are held back.
export async function notifyCleaner(person: Recipient, options: NotifyOptions): Promise<NotifyResult> {
  if (await getFlag(CLEANER_NOTIFICATIONS_PAUSED)) {
    return { emailOk: false, smsOk: false, problems: ["Cleaner notifications are paused in Settings."] }
  }
  return notifyUser(person, options)
}

export interface AdminRecipient {
  id: string
  name: string
  email: string | null
  phone: string | null
  carrier: string | null
  emailNotifications: boolean
  smsNotifications: boolean
}

interface AdminAlert {
  // In-app bell row
  type?: string
  title: string
  message: string
  jobId?: string | null
  // Outbound. emailHtml takes the admin so templates can greet them by name.
  emailSubject?: string
  emailHtml: (admin: AdminRecipient) => string
  smsBody: string
  // Skip the person who caused the alert — no point emailing yourself about
  // the button you just pressed.
  excludeUserId?: string | null
  // Skip anyone already told about this exact thing recently (cron reminders).
  dedupeWithinHours?: number
  // File the in-app bell row but send no email and no text. For things worth
  // recording that aren't worth interrupting anyone over yet — e.g. a
  // cleaning booked beyond the current alert window (lib/alert-window.ts).
  quiet?: boolean
}

export async function getAdmins(excludeUserId?: string | null): Promise<AdminRecipient[]> {
  return prisma.user.findMany({
    where: {
      role: "ADMIN",
      approved: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
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
}

// Files the in-app notification AND sends email/text to every admin.
// Returns how many admins were actually alerted.
export async function alertAdmins(alert: AdminAlert): Promise<number> {
  const admins = await getAdmins(alert.excludeUserId)
  let count = 0

  for (const admin of admins) {
    // One admin with a bad address must not swallow the alert for the others,
    // and must never take down the request that triggered it.
    try {
      if (alert.dedupeWithinHours) {
        const since = new Date(Date.now() - alert.dedupeWithinHours * 60 * 60 * 1000)
        const recent = await prisma.notification.findFirst({
          where: { userId: admin.id, title: alert.title, createdAt: { gte: since } },
        })
        if (recent) continue
      }

      await prisma.notification.create({
        data: {
          userId: admin.id,
          jobId: alert.jobId ?? null,
          type: alert.type ?? "GENERAL",
          title: alert.title,
          message: alert.message,
        },
      })

      if (!alert.quiet) {
        const result = await notifyUser(admin, {
          subject: alert.emailSubject ?? alert.title,
          emailHtml: alert.emailHtml(admin),
          smsBody: alert.smsBody,
        })
        // The bell row above is already written by this point, so an alert that
        // reached nobody still LOOKS delivered in the app. Say so out loud —
        // production sat with bad Gmail credentials for a month and every send
        // failed in silence because this result was thrown away.
        if (!result.emailOk && !result.smsOk) {
          console.error(
            `[alertAdmins] "${alert.title}" reached ${admin.name} on NO channel: ${result.problems.join(" ")}`
          )
        }
      }
      count++
    } catch (err) {
      console.error(`[alertAdmins] failed for ${admin.email ?? admin.id}:`, err)
    }
  }

  return count
}
