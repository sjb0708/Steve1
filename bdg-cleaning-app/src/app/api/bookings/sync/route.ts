import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureJobForBooking } from "@/lib/jobs"
import { alertAdmins } from "@/lib/notify"
import { adminAlertEmail } from "@/lib/email"
import { isWithinAlertWindow } from "@/lib/alert-window"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Same reason as /api/reminders: a cached response would mean the calendar
// silently stops syncing while every run still reports success.
export const dynamic = "force-dynamic"

async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    const querySecret = new URL(req.url).searchParams.get("secret")
    if (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret) {
      return null
    }
  }

  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

// Simple iCal parser — handles Airbnb and VRBO formats
function parseIcal(text: string): {
  uid: string
  summary: string
  dtstart: Date | null
  dtend: Date | null
}[] {
  const events: { uid: string; summary: string; dtstart: Date | null; dtend: Date | null }[] = []
  const lines = text.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r?\n/)

  let current: Partial<{ uid: string; summary: string; dtstart: string; dtend: string }> | null = null

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {}
    } else if (line.startsWith("END:VEVENT") && current) {
      if (current.dtstart && current.dtend) {
        events.push({
          uid: current.uid || crypto.randomUUID(),
          summary: current.summary || "Booking",
          dtstart: parseIcalDate(current.dtstart),
          dtend: parseIcalDate(current.dtend),
        })
      }
      current = null
    } else if (current) {
      if (line.startsWith("UID:")) current.uid = line.slice(4).trim()
      else if (line.startsWith("SUMMARY:")) current.summary = line.slice(8).trim()
      else if (line.startsWith("DTSTART")) current.dtstart = line.split(":").slice(1).join(":").trim()
      else if (line.startsWith("DTEND")) current.dtend = line.split(":").slice(1).join(":").trim()
    }
  }

  return events
}

function parseIcalDate(str: string): Date | null {
  try {
    // Date only format: 20240115
    if (/^\d{8}$/.test(str)) {
      const y = str.slice(0, 4)
      const m = str.slice(4, 6)
      const d = str.slice(6, 8)
      return new Date(`${y}-${m}-${d}T12:00:00.000Z`)
    }
    // DateTime format: 20240115T120000Z
    if (/^\d{8}T\d{6}Z$/.test(str)) {
      return new Date(
        `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${str.slice(9, 11)}:${str.slice(11, 13)}:${str.slice(13, 15)}Z`
      )
    }
    return new Date(str)
  } catch {
    return null
  }
}

type SyncProperty = {
  id: string
  hostId: string
  name: string
  cleaningDuration: number
  checklistTemplate: { items: { label: string; room: string | null; order: number }[] } | null
}

async function fetchAndSync(property: SyncProperty, icalUrl: string, platform: string) {
  const res = await fetch(icalUrl, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Failed to fetch iCal from ${icalUrl}`)
  const text = await res.text()
  const events = parseIcal(text)

  let created = 0
  let skipped = 0
  let jobsCreated = 0
  let jobsRescheduled = 0
  // Actual checkout dates, so the alert says WHEN a cleaning is needed
  // instead of just how many appeared.
  const newCleaningDates: Date[] = []

  for (const event of events) {
    if (!event.dtstart || !event.dtend) { skipped++; continue }

    // Skip blocked/unavailable entries (Airbnb uses "Airbnb (Not available)")
    const summaryLower = event.summary.toLowerCase()
    if (summaryLower.includes("not available") || summaryLower.includes("unavailable") || summaryLower.includes("blocked")) {
      skipped++
      continue
    }

    try {
      const booking = await prisma.booking.upsert({
        where: { propertyId_externalId: { propertyId: property.id, externalId: event.uid } },
        create: {
          propertyId: property.id,
          platform,
          externalId: event.uid,
          guestName: event.summary !== "Airbnb" && event.summary !== "VRBO" ? event.summary : null,
          checkIn: event.dtstart,
          checkOut: event.dtend,
        },
        update: {
          checkIn: event.dtstart,
          checkOut: event.dtend,
          guestName: event.summary !== "Airbnb" && event.summary !== "VRBO" ? event.summary : null,
        },
      })
      created++

      // Auto-create/reschedule the turnover cleaning job for this booking
      const jobResult = await ensureJobForBooking(property, booking)
      if (jobResult === "created") {
        jobsCreated++
        newCleaningDates.push(booking.checkOut)
      }
      if (jobResult === "rescheduled") jobsRescheduled++
    } catch {
      skipped++
    }
  }

  // One summary alert per property per sync — not one per booking. Split by
  // the alert window so a December booking synced in August files quietly
  // instead of texting about a cleaning nobody can staff yet.
  if (newCleaningDates.length > 0 || jobsRescheduled > 0) {
    const sorted = [...newCleaningDates].sort((a, b) => a.getTime() - b.getTime())
    const soon = sorted.filter((d) => isWithinAlertWindow(d))
    const later = sorted.filter((d) => !isWithinAlertWindow(d))
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })

    if (soon.length > 0) {
      const summary = `${property.name}: ${soon.length} new cleaning${soon.length > 1 ? "s" : ""} scheduled from ${platform} bookings.`
      const dateList = soon.map(fmt)
      await alertAdmins({
        title: "New Cleaning Needed",
        message: `${summary} They need a cleaner assigned.`,
        emailSubject: `Cleaning needed at ${property.name} — ${dateList[0]}`,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: "New Cleaning Needed",
            intro: `${summary} Nobody is assigned yet.`,
            details: [{ label: "PROPERTY", value: property.name }],
            bullets: dateList.map((d) => `Cleaning needed <b>${d}</b>`),
            ctaLabel: "Assign a Cleaner",
            ctaUrl: `${APP_URL}/jobs`,
            tone: "action",
          }),
        smsBody: `BDG Cleaning: ${summary} Dates: ${dateList.join("; ")}. Assign a cleaner: ${APP_URL}/jobs`,
      })
    }

    // Bookings landing beyond the alert window. These used to be bell-only, on
    // the theory that an October turnover shouldn't page you in August. That
    // went too far: in practice almost every new booking arrives months out, so
    // "a new booking came in" — the one thing worth knowing every time — was the
    // event that reliably sent nothing. July had six sync days that created
    // bookings and not one of them emailed.
    //
    // So it emails now, always. The urgency stays scaled, not the delivery: the
    // in-window alert above is an action item ("needs a cleaner"), this one is a
    // receipt ("booked, nothing to do yet"). Still ONE message per property per
    // sync, only when something actually changed, so a quiet week stays quiet.
    if (later.length > 0 || jobsRescheduled > 0) {
      const parts = []
      if (later.length > 0) parts.push(`${later.length} future cleaning${later.length > 1 ? "s" : ""} added`)
      if (jobsRescheduled > 0) parts.push(`${jobsRescheduled} moved to a new date`)
      const headline = `${property.name}: ${parts.join(", ")} from ${platform} bookings.`
      const laterList = later.map(fmt)

      await alertAdmins({
        title: "New Booking Added",
        message: `${headline}${later.length > 0 ? ` Cleaning needed ${laterList.join("; ")}. Nothing to do yet — you'll be reminded when the date comes into range.` : ""}`,
        emailSubject:
          later.length > 0
            ? `New booking at ${property.name} — cleaning ${laterList[0]}`
            : `Booking dates changed at ${property.name}`,
        emailHtml: (admin) =>
          adminAlertEmail({
            recipientName: admin.name,
            heading: later.length > 0 ? "New Booking Added" : "Booking Dates Changed",
            intro:
              later.length > 0
                ? `${headline} No action needed yet — these are far enough out that they'll come back to you closer to the date.`
                : headline,
            details: [
              { label: "PROPERTY", value: property.name },
              { label: "SOURCE", value: platform === "airbnb" ? "Airbnb" : "VRBO" },
            ],
            bullets: laterList.map((d) => `Cleaning needed <b>${d}</b>`),
            ctaLabel: "View the Schedule",
            ctaUrl: `${APP_URL}/jobs`,
            tone: "info",
          }),
        smsBody: `BDG Cleaning: ${headline}${laterList.length > 0 ? ` ${laterList.slice(0, 3).join("; ")}${laterList.length > 3 ? `; +${laterList.length - 3} more` : ""}.` : ""} No action needed yet. ${APP_URL}/jobs`,
      })
    }
  }

  return { created, skipped, total: events.length, jobsCreated, jobsRescheduled }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await authorize(req)
    if (denied) return denied

    const properties = await prisma.property.findMany({
      where: {
        OR: [
          { airbnbIcalUrl: { not: null } },
          { vrboIcalUrl: { not: null } },
        ],
      },
      include: { checklistTemplate: { include: { items: { orderBy: { order: "asc" } } } } },
    })

    const results: { propertyId: string; name: string; platform: string; synced: number; jobsCreated: number; errors: string[] }[] = []

    for (const property of properties) {
      if (property.airbnbIcalUrl) {
        try {
          const r = await fetchAndSync(property, property.airbnbIcalUrl, "airbnb")
          results.push({ propertyId: property.id, name: property.name, platform: "airbnb", synced: r.created, jobsCreated: r.jobsCreated, errors: [] })
        } catch (e) {
          results.push({ propertyId: property.id, name: property.name, platform: "airbnb", synced: 0, jobsCreated: 0, errors: [(e as Error).message] })
        }
      }

      if (property.vrboIcalUrl) {
        try {
          const r = await fetchAndSync(property, property.vrboIcalUrl, "vrbo")
          results.push({ propertyId: property.id, name: property.name, platform: "vrbo", synced: r.created, jobsCreated: r.jobsCreated, errors: [] })
        } catch (e) {
          results.push({ propertyId: property.id, name: property.name, platform: "vrbo", synced: 0, jobsCreated: 0, errors: [(e as Error).message] })
        }
      }

      await prisma.property.update({
        where: { id: property.id },
        data: { lastSyncedAt: new Date() },
      })
    }

    return NextResponse.json({ results, syncedAt: new Date().toISOString() })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET for cron/background use
export async function GET(req: NextRequest) {
  return POST(req)
}
