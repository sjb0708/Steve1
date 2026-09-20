import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getCurrentUser } from "@/lib/auth"
import {
  getFlag, setFlag, CLEANER_NOTIFICATIONS_PAUSED,
  getAnthropicApiKey, setSetting, ANTHROPIC_API_KEY,
} from "@/lib/app-settings"
import { RISK_MODEL } from "@/lib/risk-assessment-types"

// Never send the key itself back to the browser — only whether one is set
// and its last four characters so the admin can tell which key it is.
async function currentSettings() {
  const ai = await getAnthropicApiKey()
  return {
    cleanerNotificationsPaused: await getFlag(CLEANER_NOTIFICATIONS_PAUSED),
    anthropicKey: ai
      ? { set: true, last4: ai.key.slice(-4), source: ai.source }
      : { set: false, last4: null, source: null },
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(await currentSettings())
  } catch (error) {
    console.error("[settings/app]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await req.json()
    if (typeof body.cleanerNotificationsPaused === "boolean") {
      await setFlag(CLEANER_NOTIFICATIONS_PAUSED, body.cleanerNotificationsPaused)
    }

    if (typeof body.anthropicApiKey === "string") {
      const key = body.anthropicApiKey.trim()
      if (!key) {
        await setSetting(ANTHROPIC_API_KEY, null)
      } else {
        // Check the key with Anthropic before saving, so a typo shows up
        // here instead of as a failed assessment later.
        try {
          await new Anthropic({ apiKey: key }).models.retrieve(RISK_MODEL)
        } catch (err) {
          if (err instanceof Anthropic.AuthenticationError) {
            return NextResponse.json(
              { error: "Anthropic rejected that key. Copy it again from console.anthropic.com and paste the whole thing." },
              { status: 400 },
            )
          }
          if (err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.NotFoundError) {
            return NextResponse.json(
              { error: `That key works but can't use ${RISK_MODEL}. Check the key's workspace in the Anthropic Console.` },
              { status: 400 },
            )
          }
          // Anthropic unreachable or rate-limited: the key may be fine, so
          // save it rather than blocking the admin.
          console.error("[settings/app] could not verify Anthropic key:", err)
        }
        await setSetting(ANTHROPIC_API_KEY, key)
      }
    }

    return NextResponse.json(await currentSettings())
  } catch (error) {
    console.error("[settings/app]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
