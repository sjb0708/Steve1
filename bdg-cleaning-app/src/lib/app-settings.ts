// App-wide switches, stored in the DB so an admin can flip them from
// Settings without a redeploy or an env var change.

import { prisma } from "@/lib/prisma"

export const CLEANER_NOTIFICATIONS_PAUSED = "cleanerNotificationsPaused"
export const ANTHROPIC_API_KEY = "anthropicApiKey"

export async function getFlag(key: string, fallback = false): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } })
    if (!row) return fallback
    return row.value === "true"
  } catch (err) {
    // A missing table or an unreachable DB must not decide policy by
    // accident — fall back to the stated default and say so in the log.
    console.error(`[app-settings] could not read "${key}":`, err)
    return fallback
  }
}

export async function setFlag(key: string, value: boolean) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  })
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value || null
}

// null removes the setting
export async function setSetting(key: string, value: string | null) {
  if (value === null) {
    await prisma.appSetting.deleteMany({ where: { key } })
    return
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

// The key pasted in Settings wins; the env var is a fallback for deployments
// that would rather keep it out of the database.
export async function getAnthropicApiKey(): Promise<{ key: string; source: "settings" | "env" } | null> {
  const saved = await getSetting(ANTHROPIC_API_KEY)
  if (saved) return { key: saved, source: "settings" }
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: "env" }
  return null
}
