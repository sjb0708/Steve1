// How far ahead an alert is allowed to shout.
//
// Bookings sync months ahead, so alerting on every newly created cleaning
// means an October turnover pages you in August — noise you can't act on
// yet, which trains you to ignore the alerts that matter.
//
// The window is the rest of the CURRENT month. Once you're within two weeks
// of month end, it opens up to include next month too — two weeks being
// enough runway to actually reach cleaners and get next month staffed,
// rather than scrambling in the last few days.
//
// Cleanings past the window aren't dropped — they still file an in-app bell
// notification. They just don't send email or texts until the window reaches
// them, and the month-ahead digest (see /api/reminders) sweeps up anything
// that synced early so nothing is silently missed.

export const MONTH_AHEAD_LEAD_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

function endOfMonth(year: number, monthIndex: number) {
  // Day 0 of the next month is the last day of this one; JS normalizes a
  // month index of 12 into January of the following year.
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
}

export function alertHorizon(now: Date = new Date()) {
  const thisMonthEnd = endOfMonth(now.getFullYear(), now.getMonth())
  const daysLeftInMonth = (thisMonthEnd.getTime() - now.getTime()) / DAY_MS

  if (daysLeftInMonth <= MONTH_AHEAD_LEAD_DAYS) {
    return {
      end: endOfMonth(now.getFullYear(), now.getMonth() + 1),
      extendedToNextMonth: true,
    }
  }

  return { end: thisMonthEnd, extendedToNextMonth: false }
}

export function isWithinAlertWindow(date: Date, now: Date = new Date()) {
  return date.getTime() <= alertHorizon(now).end.getTime()
}

// True on the days when next month's schedule should get its one heads-up.
export function isMonthAheadLeadTime(now: Date = new Date()) {
  return alertHorizon(now).extendedToNextMonth
}

export function nextMonthRange(now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
  const end = endOfMonth(now.getFullYear(), now.getMonth() + 1)
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  return { start, end, label }
}
