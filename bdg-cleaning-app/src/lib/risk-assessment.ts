// Runs the AI risk assessment for one property: Claude researches the
// current state/county/city rules and platform policies on the web, reviews
// the listing material, and submits a structured report.

import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { getAnthropicApiKey } from "@/lib/app-settings"
import type { Prisma, Property } from "@/generated/prisma/client"
import {
  RISK_MODEL, RISK_CATEGORIES, SEVERITIES, OVERALL_RISKS,
  type RiskAssessmentResult, type RiskFinding, type RiskCategory, type Severity, type OverallRisk,
} from "@/lib/risk-assessment-types"

const SUBMIT_TOOL = "submit_risk_assessment"

// A run that's still RUNNING after this long was killed by the host
// (serverless time limit or a restart) and will never finish.
export const STALE_RUN_MS = 15 * 60 * 1000

const SYSTEM_PROMPT = `You are a short-term rental compliance and risk analyst working for the owner of vacation rental homes. The owner wants the review a careful real estate attorney and an experienced insurance risk manager would give together: find what could get them fined, sued, delisted, denied an insurance claim, or stuck losing a dispute with a guest, and tell them exactly how to fix it.

How to work:
1. Research the current rules for the property's exact location before judging anything. Use web search and web fetch to find official sources: state statutes and agency pages, county and city code and zoning, tax authority pages, and the current Airbnb and VRBO host policies. Prefer government and platform help-center pages over blogs. Laws, tax rates, and platform policies change, so verify specifics rather than relying on memory, and cite the page you used.
2. Review every piece of listing material provided: house rules, descriptions, disclosed amenities and safety devices, and any other documents. Compare the Airbnb and VRBO versions against each other.
3. Deliver the report by calling the ${SUBMIT_TOOL} tool. That tool call is the entire deliverable; don't also write the report as text.

Areas to cover (leave out any that genuinely don't apply):
- State licensing or registration for vacation rentals, and whether a license number must appear on listings
- Lodging taxes: state sales tax and county tourist development tax, and what the platforms collect versus what the owner must still register for and file
- County and city rules: registration, zoning, occupancy limits, parking, noise, trash, local contact person, and HOA restrictions worth checking
- Airbnb and VRBO host policies the listing must follow: service and assistance animals, cameras and recording devices, parties, fee disclosure, non-discrimination, cancellation
- Fair housing and accessibility: service animals, wording that could read as discriminatory
- Guest safety and premises liability: pools and hot tubs, smoke and carbon monoxide alarms, fire extinguishers, emergency and hurricane information, water hazards
- Liability and insurance: whether the rules support a damage or liability claim, short-term-rental insurance, a rental agreement or guest acknowledgement
- Rule clarity and enforceability: vague rules, rules with no stated consequence, penalties the platforms won't enforce, rules that contradict each other or platform policy

Standards for findings:
- Be specific to this property and quote the exact listing wording you're flagging.
- Severity: HIGH means a likely fine, delisting, lawsuit exposure, or safety hazard. MEDIUM means a real gap that weakens the owner's position. LOW means a clarity or best-practice improvement.
- Recommendations must be concrete enough to act on this week. When a rule should be rewritten or added, put ready-to-paste wording in suggestedText; otherwise leave suggestedText empty.
- If the material can't tell you something (for example, whether a state license is held), don't assume it's missing: put it in missingInformation and describe the risk conditionally.
- Separate what you verified from what needs a lawyer to confirm; put the latter in attorneyQuestions.
- List genuine strengths briefly so the owner knows what to keep.
- Write in plain English for a business owner, not for a lawyer.
- score is 0-100, where higher means more risk exposure.`

const sourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "url"],
  properties: { title: { type: "string" }, url: { type: "string" } },
}

const findingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "severity", "category", "issue", "whyItMatters", "recommendation", "suggestedText", "sources"],
  properties: {
    title: { type: "string", description: "Short headline for the problem" },
    severity: { type: "string", enum: [...SEVERITIES] },
    category: { type: "string", enum: Object.keys(RISK_CATEGORIES) },
    issue: { type: "string", description: "What is wrong or missing, quoting the listing wording involved" },
    whyItMatters: { type: "string", description: "The concrete consequence: fine, delisting, lawsuit, denied claim, lost dispute" },
    recommendation: { type: "string", description: "What to do about it" },
    suggestedText: { type: "string", description: "Ready-to-paste rule or listing wording, or empty string" },
    sources: { type: "array", items: sourceSchema, description: "Pages that support this finding" },
  },
}

const submitTool: Anthropic.Beta.BetaTool = {
  name: SUBMIT_TOOL,
  description: "Submit the finished risk assessment for this property. Call this exactly once, after research is complete.",
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "overallRisk", "score", "summary", "jurisdictionNotes", "findings",
      "platformGaps", "strengths", "missingInformation", "attorneyQuestions",
    ],
    properties: {
      overallRisk: { type: "string", enum: [...OVERALL_RISKS] },
      score: { type: "integer", description: "0-100, higher means more risk exposure" },
      summary: { type: "string", description: "3-5 sentence bottom line for the owner" },
      jurisdictionNotes: { type: "string", description: "Which state, county, and city rules apply and the key requirements found" },
      findings: { type: "array", items: findingSchema },
      platformGaps: { type: "array", items: { type: "string" }, description: "Places the Airbnb and VRBO listings disagree or one is missing something" },
      strengths: { type: "array", items: { type: "string" } },
      missingInformation: { type: "array", items: { type: "string" }, description: "Facts the owner should supply to make the review complete" },
      attorneyQuestions: { type: "array", items: { type: "string" }, description: "Questions to confirm with a local attorney" },
    },
  },
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : []
}

// With eager input streaming the API doesn't validate the tool input, so
// check the shape here before anything is saved or rendered.
function parseAssessment(input: unknown): RiskAssessmentResult {
  if (!input || typeof input !== "object") throw new Error("Claude's assessment came back empty. Run it again.")
  const o = input as Record<string, unknown>
  if (!OVERALL_RISKS.includes(o.overallRisk as OverallRisk) || !Array.isArray(o.findings)) {
    throw new Error("Claude's assessment came back incomplete. Run it again.")
  }
  const findings: RiskFinding[] = (o.findings as Record<string, unknown>[])
    .filter((f) => f && typeof f === "object" && str(f.title))
    .map((f) => ({
      title: str(f.title),
      severity: SEVERITIES.includes(f.severity as Severity) ? (f.severity as Severity) : "MEDIUM",
      category: (f.category as string) in RISK_CATEGORIES ? (f.category as RiskCategory) : "RULE_CLARITY",
      issue: str(f.issue),
      whyItMatters: str(f.whyItMatters),
      recommendation: str(f.recommendation),
      suggestedText: str(f.suggestedText),
      sources: Array.isArray(f.sources)
        ? (f.sources as Record<string, unknown>[])
            .map((s) => ({ title: str(s?.title), url: str(s?.url) }))
            .filter((s) => /^https?:\/\//.test(s.url))
        : [],
    }))
  const score = Math.round(Number(o.score))
  return {
    overallRisk: o.overallRisk as OverallRisk,
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 50,
    summary: str(o.summary),
    jurisdictionNotes: str(o.jurisdictionNotes),
    findings,
    platformGaps: strList(o.platformGaps),
    strengths: strList(o.strengths),
    missingInformation: strList(o.missingInformation),
    attorneyQuestions: strList(o.attorneyQuestions),
  }
}

function buildUserMessage(p: Property): string {
  const block = (tag: string, body: string | null) =>
    `<${tag}>\n${body?.trim() || "(not provided)"}\n</${tag}>`
  return [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "PROPERTY",
    `Name: ${p.name}`,
    `Address: ${p.address}, ${p.city}, ${p.state}`,
    `Bedrooms / bathrooms: ${p.bedrooms} / ${p.bathrooms}`,
    `Checkout time: ${p.checkoutTime}`,
    `Listed on Airbnb: ${p.airbnbIcalUrl ? "yes" : "no"}`,
    `Listed on VRBO: ${p.vrboIcalUrl ? "yes" : "no"}`,
    "",
    block("airbnb_listing", p.airbnbListingText),
    "",
    block("vrbo_listing", p.vrboListingText),
    "",
    block("other_documents", p.otherPolicies),
    "",
    "Run the risk assessment for this property.",
  ].join("\n")
}

// Approximate list-price cost of a run: Opus 5 tokens plus $10 per 1,000
// web searches. Good enough to show the owner what a run costs.
function estimateCost(u: { input: number; cacheWrite: number; cacheRead: number; output: number; searches: number }) {
  const usd =
    (u.input * 5 + u.cacheWrite * 6.25 + u.cacheRead * 0.5 + u.output * 25) / 1_000_000 +
    u.searches * 0.01
  return Math.round(usd * 100) / 100
}

async function assess(apiKey: string, property: Property) {
  const client = new Anthropic({ apiKey })
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: buildUserMessage(property) },
  ]
  const usage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, searches: 0 }
  let nudged = false

  // Server-side web search pauses the turn after a batch of tool calls
  // (stop_reason "pause_turn"); sending the partial turn back resumes it.
  for (let round = 0; round < 8; round++) {
    const stream = client.beta.messages.stream({
      model: RISK_MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 10,
          user_location: { type: "approximate", city: property.city, region: property.state, country: "US" },
        },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
        submitTool,
      ],
      messages,
    })
    const message = await stream.finalMessage()

    usage.input += message.usage.input_tokens
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0
    usage.output += message.usage.output_tokens
    usage.searches += message.usage.server_tool_use?.web_search_requests ?? 0

    if (message.stop_reason === "refusal") {
      throw new Error("Claude declined to complete this assessment. Try running it again.")
    }

    const call = message.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === SUBMIT_TOOL,
    )
    if (call) {
      if (message.stop_reason === "max_tokens") {
        throw new Error("The assessment was cut off before it finished. Run it again.")
      }
      return { result: parseAssessment(call.input), costUsd: estimateCost(usage), model: message.model }
    }

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content })
      continue
    }
    if (message.stop_reason === "end_turn" && !nudged) {
      // Finished researching but answered in prose; ask once for the tool call.
      nudged = true
      messages.push({ role: "assistant", content: message.content })
      messages.push({ role: "user", content: `Submit the assessment now by calling ${SUBMIT_TOOL}.` })
      continue
    }
    throw new Error(`The assessment stopped early (${message.stop_reason}). Run it again.`)
  }
  throw new Error("The assessment took too many rounds to finish. Run it again.")
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Anthropic rejected the API key. Paste a new one in Settings → AI Assistant."
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return `This API key can't use ${RISK_MODEL}. Check the key's workspace in the Anthropic Console.`
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Anthropic is rate-limiting this key right now. Wait a minute and run it again."
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic returned an error (${err.status ?? "no status"}): ${err.message}`
  }
  return err instanceof Error ? err.message : "Something went wrong running the assessment."
}

export async function runRiskAssessment(assessmentId: string) {
  const row = await prisma.riskAssessment.findUnique({
    where: { id: assessmentId },
    include: { property: true },
  })
  if (!row) return

  try {
    const ai = await getAnthropicApiKey()
    if (!ai) throw new Error("No Claude API key is set. Add one in Settings → AI Assistant.")
    const { result, costUsd, model } = await assess(ai.key, row.property)
    await prisma.riskAssessment.update({
      where: { id: assessmentId },
      data: {
        status: "COMPLETE",
        overallRisk: result.overallRisk,
        score: result.score,
        result: result as unknown as Prisma.InputJsonValue,
        costUsd,
        model,
        completedAt: new Date(),
      },
    })
  } catch (err) {
    console.error("[risk-assessment]", err)
    await prisma.riskAssessment.update({
      where: { id: assessmentId },
      data: { status: "FAILED", error: friendlyError(err), completedAt: new Date() },
    })
  }
}
