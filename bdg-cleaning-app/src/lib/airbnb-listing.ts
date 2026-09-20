// Pulls the public Airbnb listing page and turns the parts that matter for a
// compliance review (description, house rules, safety devices, amenities,
// guest limit) into plain text. Airbnb embeds the page data as JSON in a
// <script id="data-deferred-state-0"> tag; there's no official API for this.

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

export class ListingFetchError extends Error {}

// The iCal URL already carries the listing number:
// https://www.airbnb.com/calendar/ical/52737175.ics?s=...
export function airbnbListingIdFromIcal(url?: string | null): string | null {
  return url?.match(/airbnb\.[a-z.]+\/calendar\/ical\/(\d+)\.ics/i)?.[1] ?? null
}

type Node = Record<string, unknown>

function walk(value: unknown, visit: (node: Node) => void) {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const v of value) walk(v, visit)
    return
  }
  visit(value as Node)
  for (const v of Object.values(value)) walk(v, visit)
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function fetchAirbnbListing(listingId: string): Promise<string> {
  const url = `https://www.airbnb.com/rooms/${listingId}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html" },
      cache: "no-store",
    })
  } catch {
    throw new ListingFetchError("Couldn't reach Airbnb. Try again in a minute.")
  }
  if (!res.ok) {
    throw new ListingFetchError(
      `Airbnb refused the request (status ${res.status}). Paste the listing text in by hand instead.`,
    )
  }

  const html = await res.text()
  const script = html.match(/<script id="data-deferred-state-0"[^>]*>([\s\S]*?)<\/script>/)
  if (!script) {
    throw new ListingFetchError(
      "Airbnb sent back a page without the listing details (it may be blocking automated requests). Paste the listing text in by hand instead.",
    )
  }
  let data: unknown
  try {
    data = JSON.parse(script[1])
  } catch {
    throw new ListingFetchError("Airbnb's page format has changed. Paste the listing text in by hand instead.")
  }

  const title = htmlToText(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "")
  let maxGuests: number | null = null
  const description: string[] = []
  const detailGroups = new Map<string, string[]>()
  const amenityGroups = new Map<string, string[]>()

  walk(data, (node) => {
    if (maxGuests === null && typeof node.maxGuestCapacity === "number") maxGuests = node.maxGuestCapacity

    if (node.sectionComponentType === "PDP_DESCRIPTION_MODAL" && node.section && typeof node.section === "object") {
      const items = (node.section as Node).items
      if (Array.isArray(items)) {
        for (const item of items as Node[]) {
          const body = htmlToText(text((item.html as Node | null)?.htmlText))
          if (!body) continue
          const heading = text(item.title)
          description.push(heading ? `${heading}\n${body}` : body)
        }
      }
    }

    // House rules, check-in/out, and "Safety & property" groups
    if (node.__typename === "StaysPdpDetailGroup" && Array.isArray(node.items)) {
      const heading = text(node.title)
      if (!heading || detailGroups.has(heading)) return
      const lines = (node.items as Node[])
        .map((item) => {
          const itemTitle = text(item.title)
          if (!itemTitle) return ""
          const detail = text(((item.description as Node | null)?.content as Node | null)?.localizedString)
          return detail ? `${itemTitle}: ${detail}` : itemTitle
        })
        .filter(Boolean)
      if (lines.length) detailGroups.set(heading, lines)
    }

    if (node.__typename === "AmenityItemsGroup") {
      const heading = text(node.title)
      if (!heading || amenityGroups.has(heading)) return
      const lines: string[] = []
      walk(node, (child) => {
        if (child.__typename !== "AmenityItem") return
        const name = text(child.title)
        if (name) lines.push(child.available === false ? `NOT PROVIDED: ${name}` : name)
      })
      if (lines.length) amenityGroups.set(heading, lines)
    }
  })

  if (!description.length && !detailGroups.size) {
    throw new ListingFetchError(
      "Airbnb's page loaded but the house rules weren't in it. Paste the listing text in by hand instead.",
    )
  }

  const out: string[] = [`Source: ${url}`]
  if (title) out.push(`Title: ${title}`)
  if (maxGuests !== null) out.push(`Maximum guests: ${maxGuests}`)
  if (description.length) out.push("", "== Listing description ==", ...description.flatMap((d) => [d, ""]))
  for (const [heading, lines] of detailGroups) {
    out.push("", `== ${heading} ==`, ...lines.map((l) => `- ${l}`))
  }
  if (amenityGroups.size) {
    out.push("", "== Amenities ==")
    for (const [heading, lines] of amenityGroups) out.push(`${heading}: ${lines.join("; ")}`)
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}
