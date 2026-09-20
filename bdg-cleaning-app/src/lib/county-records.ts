// Marion County Property Appraiser lookups: find a parcel by street address,
// then read its Property Record Card for values, exemptions, zoning, building
// details, and every recorded sale. Public records; no login required.

import type { CountyRecord } from "@/lib/deal-analysis"
import { sleep } from "@/lib/market-data"

const BASE = "https://www.pa.marion.fl.us"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" })
  if (!res.ok) throw new Error(`The Property Appraiser site returned status ${res.status}.`)
  return res.text()
}

function cellText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
}

// Cells become " | " and rows become new lines, so each table row can be
// matched with a regular expression.
function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(tr|p|div|h\d|table)>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
}

function money(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v.replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : null
}

export function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/\s*(#|UNIT|APT|STE)\s*\S+$/, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseRecordCard(html: string, prcUrl: string, owner: string | null): CountyRecord {
  const t = pageText(html)
  // Land, buildings, misc, just, assessed, exemptions, taxable[, school taxable].
  // Exemptions print in parentheses when present, e.g. ($51,411).
  const values =
    t.match(/Current Value\s*\|[^|]*\|\s*((?:\(?\$[\d,]+\)?\s*)+)/)?.[1].match(/\$[\d,]+/g) ?? []

  const valueHistory: CountyRecord["valueHistory"] = []
  for (const m of t.matchAll(/\|\s*(\d{4})\s*\|\s*\$([\d,]+)\s*\|\s*\$([\d,]+)\s*\|\s*\$([\d,]+)\s*\|\s*\$([\d,]+)\s*\|\s*\$([\d,]+)\s*\|\s*\$([\d,]+)\s*\|\s*\$([\d,]+)/g)) {
    valueHistory.push({ year: Number(m[1]), just: money(m[5])!, assessed: money(m[6])!, taxable: money(m[8])! })
  }

  const sales: CountyRecord["sales"] = []
  for (const m of t.matchAll(/\|\s*\d+\/\d+\s*\|\s*(\d{2})\/(\d{4})\s*\|\s*([^|]+?)\s*\|\s*[^|]*?\|\s*([QU])\s*\|\s*[VI]\s*\|\s*\$([\d,]+)/g)) {
    sales.push({
      date: `${m[2]}-${m[1]}`,
      price: money(m[5])!,
      instrument: m[3].replace(/^\d+\s*/, "").trim(),
      qualified: m[4] === "Q",
    })
  }

  const num = (re: RegExp) => {
    const v = t.match(re)?.[1]
    return v ? Number(v.replace(/,/g, "")) : null
  }

  return {
    parcel: t.match(/Property Record Card\s*\n?\s*(\d{4,6}-\d{3}-\d{2,3})/)?.[1] ?? t.match(/\b(\d{4,6}-\d{3}-\d{2,3})\b/)?.[1] ?? "",
    prcUrl,
    owner,
    justValue: money(values[3]),
    assessedValue: money(values[4]),
    exemptions: money(values[5]),
    taxableValue: money(values[6]),
    zoning: t.match(/Verify Zoning[^\n]*\n\s*\|\s*\d+\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([A-Z0-9-]+)\s*\|/)?.[1] ?? null,
    yearBuilt: num(/Year Built\s+(\d{4})/),
    bedrooms: num(/Bedrooms:\s*(\d+)/),
    livingArea: num(/\|\s*RES\s*\|\s*\d+\s*\|[^|]*\|[^|]*\|\s*\d{4}\s*\|[^|]*\|[^|]*\|[^|]*\|\s*[\d,]+\s*\|\s*([\d,]+)/),
    pool: /SWIM POOL/i.test(t),
    acres: num(/Acres:\s*([\d.]+)/),
    millageGroup: t.match(/Millage:\s*([^|\n]+?)\s*\|/)?.[1]?.trim() ?? null,
    valueHistory,
    sales,
  }
}

// Returns null when the address isn't a Marion County parcel
export async function lookupCountyRecord(address: string): Promise<CountyRecord | null> {
  const street = normalizeAddress(address)
  const houseNumber = street.match(/^(\d+)\s/)?.[1]
  if (!houseNumber) return null
  const tokens = street.split(" ")
  const query = tokens.slice(0, 3).join(" ")

  const searchHtml = await getHtml(`${BASE}/PropertySearch.aspx?SearchBy=Address&Parms=${encodeURIComponent(query)}`)
  const candidates: { key: string; year: string; owner: string | null; situs: string }[] = []
  for (const row of searchHtml.split(/<tr/i)) {
    const link = row.match(/PRC\.aspx\?key=(\d+)&(?:amp;)?YR=(\d+)/i)
    if (!link) continue
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)(?=<td|<\/tr|$)/gi)].map((m) => cellText(m[1]))
    const situsIdx = cells.findIndex((c) => new RegExp(`^${houseNumber}\\s+\\S`).test(c))
    if (situsIdx === -1) continue
    candidates.push({
      key: link[1],
      year: link[2],
      owner: situsIdx > 0 ? cells[situsIdx - 1] || null : null,
      situs: normalizeAddress(cells[situsIdx]),
    })
  }
  if (!candidates.length) return null

  // Prefer the parcel whose street name matches beyond the house number
  const streetWords = tokens.slice(1, 3)
  const best =
    candidates.find((c) => streetWords.every((w) => c.situs.split(" ").some((s) => s.startsWith(w)))) ?? candidates[0]

  await sleep(600)
  const prcUrl = `${BASE}/PRC.aspx?key=${best.key}&YR=${best.year}&mName=False&mSitus=False`
  return parseRecordCard(await getHtml(prcUrl), prcUrl, best.owner)
}
