// Shared between the server (which asks Claude for this shape) and the
// Risk Assessment page (which renders it). No server-only imports here.

export const RISK_MODEL = "claude-opus-5"

export const RISK_CATEGORIES = {
  STATE_LICENSING: "State licensing & registration",
  LOCAL_ORDINANCE: "County / city rules & zoning",
  TAXES: "Lodging taxes",
  PLATFORM_POLICY: "Airbnb / VRBO policy",
  FAIR_HOUSING: "Discrimination & accessibility",
  PRIVACY: "Cameras & privacy",
  SAFETY: "Guest safety",
  LIABILITY: "Liability & insurance",
  RULE_CLARITY: "Rule clarity & enforceability",
  CONSISTENCY: "Airbnb vs VRBO mismatch",
} as const

export type RiskCategory = keyof typeof RISK_CATEGORIES
export const SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const
export type Severity = (typeof SEVERITIES)[number]
export const OVERALL_RISKS = ["LOW", "MODERATE", "ELEVATED", "HIGH"] as const
export type OverallRisk = (typeof OVERALL_RISKS)[number]

export interface RiskSource {
  title: string
  url: string
}

export interface RiskFinding {
  title: string
  severity: Severity
  category: RiskCategory
  issue: string
  whyItMatters: string
  recommendation: string
  suggestedText: string
  sources: RiskSource[]
}

export interface RiskAssessmentResult {
  overallRisk: OverallRisk
  score: number
  summary: string
  jurisdictionNotes: string
  findings: RiskFinding[]
  platformGaps: string[]
  strengths: string[]
  missingInformation: string[]
  attorneyQuestions: string[]
}
