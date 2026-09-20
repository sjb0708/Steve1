// The "before you leave" text sent to whoever is cleaning today.
//
// Built for cleaners who will never log into the app: everything they need
// arrives as a text message, so there's no checklist to open and nothing to
// remember. Shared by the 2 PM cron and the manual "Text the cleaner" button
// so both send the identical message.

export interface ClosingJob {
  property: {
    name: string
    closingInstructions: string | null
    supplyClosetCode: string | null
  } | null
  cleaner: { name: string } | null
}

export function closingSmsBody(job: ClosingJob): string | null {
  const instructions = job.property?.closingInstructions?.trim()
  // No list on file means nothing worth sending — a generic "remember to
  // lock up" trains people to ignore the message.
  if (!instructions) return null

  const first = job.cleaner?.name?.split(" ")[0]
  const greeting = first ? `${first}, ` : ""
  return `BDG Cleaning: ${greeting}before you leave ${job.property?.name} — ${instructions}`
}

export function closingEmailIntro(job: ClosingJob): string {
  return `Here's the before-you-leave list for ${job.property?.name}.`
}
