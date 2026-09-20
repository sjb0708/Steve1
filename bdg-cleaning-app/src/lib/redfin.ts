// Active for-sale listings from Redfin's search results download (the CSV
// behind "Download all" on a map search). The website itself blocks
// automated visits; this endpoint returns up to 350 homes per map box, so
// the search area is split into a grid and dense cells are split again.

import { sleep } from "@/lib/market-data"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
const MAX_PER_BOX = 350
const CELL_DEGREES = 0.1
const REQUEST_GAP_MS = 800

export interface RedfinListing {
  id: string
  url: string
  address: string
  city: string | null
  zip: string | null
  propertyType: string | null
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  lotSqft: number | null
  yearBuilt: number | null
  daysOnMarket: number | null
  hoaMonthly: number | null
  status: string | null
  source: string | null
  mlsNumber: string | null
  latitude: number
  longitude: number
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += ch
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function toNumber(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v.replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : null
}

function parseListings(csv: string): RedfinListing[] | null {
  const rows = parseCsv(csv)
  const header = rows[0]
  if (!header || header[0] !== "SALE TYPE") return null
  const col = (name: string) => header.findIndex((h) => h.startsWith(name))
  const idx = {
    type: col("PROPERTY TYPE"), address: col("ADDRESS"), city: col("CITY"), zip: col("ZIP"),
    price: col("PRICE"), beds: col("BEDS"), baths: col("BATHS"), sqft: col("SQUARE FEET"),
    lot: col("LOT SIZE"), year: col("YEAR BUILT"), dom: col("DAYS ON MARKET"), hoa: col("HOA"),
    status: col("STATUS"), url: col("URL"), source: col("SOURCE"), mls: col("MLS#"),
    lat: col("LATITUDE"), lng: col("LONGITUDE"),
  }
  const out: RedfinListing[] = []
  for (const r of rows.slice(1)) {
    if (r.length < header.length - 2) continue
    const url = r[idx.url] ?? ""
    const id = url.match(/\/home\/(\d+)/)?.[1]
    const price = toNumber(r[idx.price])
    const lat = toNumber(r[idx.lat])
    const lng = toNumber(r[idx.lng])
    if (!id || price === null || lat === null || lng === null || !r[idx.address]) continue
    // Builder floor plans ("Alford Plan") are listed without a street
    // address; they aren't specific homes and have no county record.
    if (!/^\d+\s/.test(r[idx.address].trim())) continue
    out.push({
      id,
      url,
      address: r[idx.address].trim(),
      city: r[idx.city] || null,
      zip: r[idx.zip] || null,
      propertyType: r[idx.type] || null,
      price,
      beds: toNumber(r[idx.beds]),
      baths: toNumber(r[idx.baths]),
      sqft: toNumber(r[idx.sqft]),
      lotSqft: toNumber(r[idx.lot]),
      yearBuilt: toNumber(r[idx.year]),
      daysOnMarket: toNumber(r[idx.dom]),
      hoaMonthly: toNumber(r[idx.hoa]),
      status: r[idx.status] || null,
      source: r[idx.source] || null,
      mlsNumber: r[idx.mls] || null,
      latitude: lat,
      longitude: lng,
    })
  }
  return out
}

async function fetchBox(west: number, south: number, east: number, north: number): Promise<RedfinListing[]> {
  const poly = `${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}`
  const params = new URLSearchParams({
    al: "1",
    num_homes: String(MAX_PER_BOX),
    ord: "redfin-recommended-asc",
    page_number: "1",
    poly,
    sf: "1,2,3,5,6,7",
    status: "9",
    uipt: "1,2,3",
    v: "8",
  })
  await sleep(REQUEST_GAP_MS)
  const res = await fetch(`https://www.redfin.com/stingray/api/gis-csv?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    cache: "no-store",
  })
  if (res.status === 429 || res.status === 403) {
    throw new Error(`Redfin is limiting requests right now (status ${res.status}). The next daily update will try again.`)
  }
  if (!res.ok) throw new Error(`Redfin returned status ${res.status}.`)
  const listings = parseListings(await res.text())
  if (!listings) throw new Error("Redfin's download came back in an unexpected format.")
  return listings
}

// All active listings within the search circle
export async function fetchForSaleListings(center: { lat: number; lng: number }, radiusMiles: number) {
  const dLat = radiusMiles / 69
  const dLng = radiusMiles / (69 * Math.cos((center.lat * Math.PI) / 180))
  const west = center.lng - dLng
  const south = center.lat - dLat
  const cols = Math.min(6, Math.max(1, Math.ceil((2 * dLng) / CELL_DEGREES)))
  const rows = Math.min(6, Math.max(1, Math.ceil((2 * dLat) / CELL_DEGREES)))
  const cellW = (2 * dLng) / cols
  const cellH = (2 * dLat) / rows

  const found = new Map<string, RedfinListing>()
  let requests = 0
  const scan = async (w: number, s: number, e: number, n: number, depth: number) => {
    const listings = await fetchBox(w, s, e, n)
    requests++
    if (listings.length >= MAX_PER_BOX - 10 && depth < 2) {
      const midLng = (w + e) / 2
      const midLat = (s + n) / 2
      await scan(w, s, midLng, midLat, depth + 1)
      await scan(midLng, s, e, midLat, depth + 1)
      await scan(w, midLat, midLng, n, depth + 1)
      await scan(midLng, midLat, e, n, depth + 1)
      return
    }
    for (const l of listings) found.set(l.id, l)
  }

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      await scan(west + c * cellW, south + r * cellH, west + (c + 1) * cellW, south + (r + 1) * cellH, 0)
    }
  }
  return { listings: [...found.values()], requests }
}
