import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import bcrypt from "bcryptjs"

const url = process.env.DATABASE_URL!
let prisma: PrismaClient

if (url.startsWith("file:")) {
  const adapter = new PrismaBetterSqlite3({ url })
  prisma = new PrismaClient({ adapter })
} else {
  const adapter = new PrismaNeon({ connectionString: url })
  prisma = new PrismaClient({ adapter })
}

function d(year: number, month: number, day: number, hour = 10, min = 0) {
  return new Date(year, month - 1, day, hour, min)
}

async function main() {
  console.log("Seeding database…")

  // ── Clear existing data ────────────────────────────────────────────────────
  await prisma.payment.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.checklistItem.deleteMany()
  await prisma.checklistTemplateItem.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.supplyRequest.deleteMany()
  await prisma.issuePhoto.deleteMany()
  await prisma.issueReport.deleteMany()
  await prisma.job.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.property.deleteMany()
  await prisma.user.deleteMany()

  // ── Passwords ──────────────────────────────────────────────────────────────
  const adminPw   = await bcrypt.hash("Admin1234!", 12)
  const cleanerPw = await bcrypt.hash("Cleaner123!", 12)

  // ── Admin ──────────────────────────────────────────────────────────────────
  const steve = await prisma.user.create({
    data: {
      name: "Steve Bailey",
      email: "stevebailey130@gmail.com",
      password: adminPw,
      role: "ADMIN",
      approved: true,
      phone: "352-555-0100",
      location: "Ocala, FL",
    },
  })

  // ── Cleaners ───────────────────────────────────────────────────────────────
  const maria = await prisma.user.create({
    data: {
      name: "Maria Garcia",
      email: "maria@cleaners.com",
      password: cleanerPw,
      role: "CLEANER",
      approved: true,
      phone: "352-555-0101",
      location: "Ocala, FL",
      bio: "5 years of vacation rental cleaning experience. Specializes in deep cleans and quick turnovers. Reliable and detail-oriented.",
    },
  })

  const james = await prisma.user.create({
    data: {
      name: "James Wilson",
      email: "james@cleaners.com",
      password: cleanerPw,
      role: "CLEANER",
      approved: true,
      phone: "352-555-0202",
      location: "Ocala, FL",
      bio: "Former hotel housekeeping supervisor with 8 years of experience. Expert in linen management and staging for guest arrival.",
    },
  })

  const lisa = await prisma.user.create({
    data: {
      name: "Lisa Rodriguez",
      email: "lisa@cleaners.com",
      password: cleanerPw,
      role: "CLEANER",
      approved: true,
      phone: "352-555-0303",
      location: "Gainesville, FL",
      bio: "Licensed cleaning professional. Certified in eco-friendly cleaning products. Available weekends and holidays.",
    },
  })

  // Pending cleaner
  await prisma.user.create({
    data: {
      name: "Sofia Chen",
      email: "sofia@cleaners.com",
      password: cleanerPw,
      role: "CLEANER",
      approved: false,
    },
  })

  // ── Properties ─────────────────────────────────────────────────────────────
  const p1 = await prisma.property.create({
    data: {
      hostId: steve.id,
      name: "Creekside Manor",
      address: "1420 SW 80th Avenue",
      city: "Ocala",
      state: "FL",
      bedrooms: 4,
      bathrooms: 3,
      description: "Stunning 4-bedroom equestrian estate with heated pool, fully equipped kitchen, and direct trail access. Perfect for HITS competitors and families. Sleeps 10 comfortably.",
      cleaningDuration: 240,
      cleaningFee: 225,
      accessInstructions: "Key lockbox is on the right side of the front gate — code is 4821. Ring doorbell upon arrival; spare key is also under the ceramic pot by the back door.\n\nPool equipment shed is to the left of the garage (unlocked). Pool heat is set to 84°F — do not adjust thermostat.\n\nWiFi: CreeksideGuest / password: HorsePower2024\n\nNote: Leave back porch light on after cleaning.",
    },
  })

  const p2 = await prisma.property.create({
    data: {
      hostId: steve.id,
      name: "Magnolia Cottage",
      address: "312 NE Magnolia Loop",
      city: "Ocala",
      state: "FL",
      bedrooms: 2,
      bathrooms: 2,
      description: "Charming 2-bedroom cottage nestled in a quiet neighborhood, 10 minutes from HITS showgrounds. Wraparound porch, fully stocked kitchen, and private backyard with fire pit.",
      cleaningDuration: 120,
      cleaningFee: 120,
      accessInstructions: "Smart lock on front door — entry code is 7392. Backup key is in the magnetic box under the front steps.\n\nAll cleaning supplies are in the laundry closet off the kitchen. Extra linens on the top shelf of the master closet.\n\nWiFi: MagnoliaGuest / password: CottageLove88",
    },
  })

  const p3 = await prisma.property.create({
    data: {
      hostId: steve.id,
      name: "Polo Pines Estate",
      address: "8840 NW Highway 225",
      city: "Reddick",
      state: "FL",
      bedrooms: 5,
      bathrooms: 4,
      description: "Expansive 5-bedroom luxury estate on 5 acres with a resort-style pool, outdoor kitchen, and barn with 4 horse stalls. Accommodates up to 12 guests. Ideal for large riding groups.",
      cleaningDuration: 360,
      cleaningFee: 350,
      accessInstructions: "Main gate code: 2291 (punch in and wait 10 seconds for gate to open). Front door uses a Schlage smart lock — code 5574.\n\nPool pump is in the equipment room behind the cabana. Run the vacuum before leaving.\n\nOutdoor kitchen propane: check gauge on south tank. If below 20%, note it in the job comments.\n\nWiFi: PoloPinesEstate / password: GreenAcres2025\n\nHousekeeper storage closet is at the end of the east hallway — all supplies are labeled.",
    },
  })

  const p4 = await prisma.property.create({
    data: {
      hostId: steve.id,
      name: "Gator Hollow House",
      address: "5678 SE 36th Street",
      city: "Ocala",
      state: "FL",
      bedrooms: 3,
      bathrooms: 2,
      description: "Comfortable 3-bedroom Florida home with screened lanai, community pool access, and easy access to I-75. Great for guests who want a home base near Ocala's dining and shopping.",
      cleaningDuration: 180,
      cleaningFee: 175,
      accessInstructions: "Keypad entry on front door — code is 1138. Dead bolt requires key (hanging inside front door on hook).\n\nCommunity pool key is on the hook by the back door (blue lanyard). Please return it after cleaning.\n\nExtra towels and paper goods in the hall closet. Trash pickup is Tuesday — roll bin to curb if cleaning on a Monday.\n\nWiFi: GatorHollow / password: Swamp2024!",
    },
  })

  // ── Checklist templates ────────────────────────────────────────────────────
  function buildChecklist(bedrooms: number, bathrooms: number) {
    const items: { label: string; room: string; order: number }[] = [
      { label: "Vacuum all carpets and rugs", room: "General", order: 0 },
      { label: "Sweep and mop all hard floors", room: "General", order: 1 },
      { label: "Empty and reline all trash cans", room: "General", order: 2 },
      { label: "Wipe down all light switches and door handles", room: "General", order: 3 },
      { label: "Dust all ceiling fans and light fixtures", room: "General", order: 4 },
      { label: "Clean all windows and sliding glass doors", room: "General", order: 5 },
      { label: "Clean kitchen countertops and backsplash", room: "Kitchen", order: 6 },
      { label: "Clean inside microwave (turntable too)", room: "Kitchen", order: 7 },
      { label: "Wipe down stovetop, oven exterior, and range hood", room: "Kitchen", order: 8 },
      { label: "Clean and sanitize sink; shine faucet", room: "Kitchen", order: 9 },
      { label: "Wipe down all appliance exteriors (fridge, dishwasher)", room: "Kitchen", order: 10 },
      { label: "Restock dish soap, sponge, and hand soap", room: "Kitchen", order: 11 },
      { label: "Run and empty dishwasher if needed", room: "Kitchen", order: 12 },
    ]
    for (let i = 1; i <= bedrooms; i++) {
      const room = i === 1 ? "Master Bedroom" : `Bedroom ${i}`
      const base = items.length
      items.push(
        { label: "Make bed with fresh, pressed linens", room, order: base },
        { label: "Dust all surfaces and furniture", room, order: base + 1 },
        { label: "Wipe down nightstands and lamps", room, order: base + 2 },
        { label: "Clean mirrors and glass surfaces", room, order: base + 3 },
        { label: "Empty closets of any guest items left behind", room, order: base + 4 },
      )
    }
    const bathCount = Math.ceil(bathrooms)
    for (let i = 1; i <= bathCount; i++) {
      const room = i === 1 ? "Master Bathroom" : `Bathroom ${i}`
      const base = items.length
      items.push(
        { label: "Scrub and disinfect toilet inside and out", room, order: base },
        { label: "Clean and scrub shower/tub; remove any soap scum", room, order: base + 1 },
        { label: "Clean sink, countertop, and shine faucet", room, order: base + 2 },
        { label: "Clean mirror and wipe down all surfaces", room, order: base + 3 },
        { label: "Replace towels, hand towels, and washcloths", room, order: base + 4 },
        { label: "Restock toilet paper, shampoo, conditioner, body wash", room, order: base + 5 },
      )
    }
    items.push(
      { label: "Check all doors and windows are locked", room: "General", order: items.length },
      { label: "Take photos of each room for admin records", room: "General", order: items.length + 1 },
      { label: "Final walkthrough — everything guest-ready", room: "General", order: items.length + 2 },
    )
    return items
  }

  await prisma.checklistTemplate.create({ data: { propertyId: p1.id, items: { create: buildChecklist(4, 3) } } })
  await prisma.checklistTemplate.create({ data: { propertyId: p2.id, items: { create: buildChecklist(2, 2) } } })
  await prisma.checklistTemplate.create({ data: { propertyId: p3.id, items: { create: buildChecklist(5, 4) } } })
  await prisma.checklistTemplate.create({ data: { propertyId: p4.id, items: { create: buildChecklist(3, 2) } } })

  // ── Bookings ───────────────────────────────────────────────────────────────
  // Creekside Manor (p1)
  const b1  = await prisma.booking.create({ data: { propertyId: p1.id, guestName: "Thompson Family",    checkIn: d(2026,3,1),  checkOut: d(2026,3,5),  platform: "AIRBNB", externalId: "airbnb-p1-001" } })
  const b2  = await prisma.booking.create({ data: { propertyId: p1.id, guestName: "Harrington Group",   checkIn: d(2026,3,7),  checkOut: d(2026,3,11), platform: "AIRBNB", externalId: "airbnb-p1-002" } })
  const b3  = await prisma.booking.create({ data: { propertyId: p1.id, guestName: "Williams Family",    checkIn: d(2026,3,13), checkOut: d(2026,3,18), platform: "VRBO",   externalId: "vrbo-p1-003" } })
  const b4  = await prisma.booking.create({ data: { propertyId: p1.id, guestName: "Larson Equestrian",  checkIn: d(2026,3,20), checkOut: d(2026,3,25), platform: "AIRBNB", externalId: "airbnb-p1-004" } })
  const b5  = await prisma.booking.create({ data: { propertyId: p1.id, guestName: "Davis & Party",      checkIn: d(2026,3,27), checkOut: d(2026,4,1),  platform: "VRBO",   externalId: "vrbo-p1-005" } })

  // Magnolia Cottage (p2)
  const b6  = await prisma.booking.create({ data: { propertyId: p2.id, guestName: "Rodriguez Couple",   checkIn: d(2026,3,3),  checkOut: d(2026,3,6),  platform: "AIRBNB", externalId: "airbnb-p2-001" } })
  const b7  = await prisma.booking.create({ data: { propertyId: p2.id, guestName: "Kim Family",          checkIn: d(2026,3,9),  checkOut: d(2026,3,12), platform: "AIRBNB", externalId: "airbnb-p2-002" } })
  const b8  = await prisma.booking.create({ data: { propertyId: p2.id, guestName: "Patel Party",         checkIn: d(2026,3,14), checkOut: d(2026,3,17), platform: "VRBO",   externalId: "vrbo-p2-003" } })
  const b9  = await prisma.booking.create({ data: { propertyId: p2.id, guestName: "Nguyen Group",        checkIn: d(2026,3,22), checkOut: d(2026,3,26), platform: "AIRBNB", externalId: "airbnb-p2-004" } })

  // Polo Pines Estate (p3)
  const b10 = await prisma.booking.create({ data: { propertyId: p3.id, guestName: "Westfield Stables",  checkIn: d(2026,3,5),  checkOut: d(2026,3,10), platform: "VRBO",   externalId: "vrbo-p3-001" } })
  const b11 = await prisma.booking.create({ data: { propertyId: p3.id, guestName: "Premier Riders LLC",  checkIn: d(2026,3,13), checkOut: d(2026,3,20), platform: "VRBO",   externalId: "vrbo-p3-002" } })
  const b12 = await prisma.booking.create({ data: { propertyId: p3.id, guestName: "Oakmont Equestrian",  checkIn: d(2026,3,22), checkOut: d(2026,3,29), platform: "AIRBNB", externalId: "airbnb-p3-003" } })
  const b13 = await prisma.booking.create({ data: { propertyId: p3.id, guestName: "Blue Ribbon Group",   checkIn: d(2026,4,2),  checkOut: d(2026,4,8),  platform: "VRBO",   externalId: "vrbo-p3-004" } })

  // Gator Hollow House (p4)
  const b14 = await prisma.booking.create({ data: { propertyId: p4.id, guestName: "Santos Family",       checkIn: d(2026,3,6),  checkOut: d(2026,3,9),  platform: "AIRBNB", externalId: "airbnb-p4-001" } })
  const b15 = await prisma.booking.create({ data: { propertyId: p4.id, guestName: "McCarthy Group",      checkIn: d(2026,3,11), checkOut: d(2026,3,15), platform: "AIRBNB", externalId: "airbnb-p4-002" } })
  const b16 = await prisma.booking.create({ data: { propertyId: p4.id, guestName: "Jensen Party",        checkIn: d(2026,3,18), checkOut: d(2026,3,22), platform: "VRBO",   externalId: "vrbo-p4-003" } })
  const b17 = await prisma.booking.create({ data: { propertyId: p4.id, guestName: "Nguyen & Tran",       checkIn: d(2026,3,25), checkOut: d(2026,3,29), platform: "AIRBNB", externalId: "airbnb-p4-004" } })

  // ── Checklist helpers ──────────────────────────────────────────────────────
  const doneItems = (n: number) => Array.from({ length: n }, (_, i) => ({
    label: `Task ${i + 1}`, room: "General", order: i, completed: true,
  }))

  const partialItems = (total: number, donePct: number) => Array.from({ length: total }, (_, i) => ({
    label: `Task ${i + 1}`, room: i < 3 ? "General" : i < 7 ? "Kitchen" : "Bedroom",
    order: i, completed: i < Math.floor(total * donePct),
  }))

  const freshItems = (n: number) => Array.from({ length: n }, (_, i) => ({
    label: `Task ${i + 1}`, room: i < 3 ? "General" : i < 7 ? "Kitchen" : "Bedroom",
    order: i, completed: false,
  }))

  // ── COMPLETED jobs (past) ──────────────────────────────────────────────────
  // p1 – b1 checkout Mar 5 → cleaned Mar 5
  const j1 = await prisma.job.create({
    data: {
      propertyId: p1.id, hostId: steve.id, cleanerId: maria.id, bookingId: b1.id,
      scheduledDate: d(2026,3,5), duration: 240, status: "COMPLETED",
      completedAt: d(2026,3,5,13,30),
      checklistItems: { create: doneItems(18) },
    },
  })
  await prisma.payment.create({ data: { jobId: j1.id, cleanerId: maria.id, propertyId: p1.id, amount: 225, status: "PAID", paidAt: d(2026,3,6,9) } })

  // p2 – b6 checkout Mar 6 → cleaned Mar 6
  const j2 = await prisma.job.create({
    data: {
      propertyId: p2.id, hostId: steve.id, cleanerId: james.id, bookingId: b6.id,
      scheduledDate: d(2026,3,6), duration: 120, status: "COMPLETED",
      completedAt: d(2026,3,6,12,0),
      checklistItems: { create: doneItems(14) },
    },
  })
  await prisma.payment.create({ data: { jobId: j2.id, cleanerId: james.id, propertyId: p2.id, amount: 120, status: "PAID", paidAt: d(2026,3,7,10) } })

  // p3 – b10 checkout Mar 10 → cleaned Mar 10
  const j3 = await prisma.job.create({
    data: {
      propertyId: p3.id, hostId: steve.id, cleanerId: lisa.id, bookingId: b10.id,
      scheduledDate: d(2026,3,10), duration: 360, status: "COMPLETED",
      completedAt: d(2026,3,10,16,0),
      checklistItems: { create: doneItems(22) },
    },
  })
  await prisma.payment.create({ data: { jobId: j3.id, cleanerId: lisa.id, propertyId: p3.id, amount: 350, status: "UNPAID" } })

  // p4 – b14 checkout Mar 9 → cleaned Mar 9
  const j4 = await prisma.job.create({
    data: {
      propertyId: p4.id, hostId: steve.id, cleanerId: maria.id, bookingId: b14.id,
      scheduledDate: d(2026,3,9), duration: 180, status: "COMPLETED",
      completedAt: d(2026,3,9,13,0),
      checklistItems: { create: doneItems(16) },
    },
  })
  await prisma.payment.create({ data: { jobId: j4.id, cleanerId: maria.id, propertyId: p4.id, amount: 175, status: "PAID", paidAt: d(2026,3,10,8) } })

  // p1 – b2 checkout Mar 11 → cleaned Mar 11 (today — IN PROGRESS)
  const j5 = await prisma.job.create({
    data: {
      propertyId: p1.id, hostId: steve.id, cleanerId: james.id, bookingId: b2.id,
      scheduledDate: d(2026,3,11), duration: 240, status: "IN_PROGRESS",
      checklistItems: { create: partialItems(18, 0.4) },
    },
  })

  // p4 – b15 checkout Mar 15, cleaned Mar 15 — ASSIGNED
  const j6 = await prisma.job.create({
    data: {
      propertyId: p4.id, hostId: steve.id, cleanerId: maria.id, bookingId: b15.id,
      scheduledDate: d(2026,3,15), duration: 180, status: "ASSIGNED",
      checklistItems: { create: freshItems(16) },
    },
  })

  // p2 – b7 checkout Mar 12 — ASSIGNED
  const j7 = await prisma.job.create({
    data: {
      propertyId: p2.id, hostId: steve.id, cleanerId: james.id, bookingId: b7.id,
      scheduledDate: d(2026,3,12), duration: 120, status: "ASSIGNED",
      checklistItems: { create: freshItems(14) },
    },
  })

  // p3 – b11 checkout Mar 20 — PENDING_ACCEPTANCE for Lisa
  const j8 = await prisma.job.create({
    data: {
      propertyId: p3.id, hostId: steve.id, cleanerId: lisa.id, bookingId: b11.id,
      scheduledDate: d(2026,3,20), duration: 360, status: "PENDING_ACCEPTANCE",
      checklistItems: { create: freshItems(22) },
    },
  })

  // p1 – b3 checkout Mar 18 — ASSIGNED (Maria)
  const j9 = await prisma.job.create({
    data: {
      propertyId: p1.id, hostId: steve.id, cleanerId: maria.id, bookingId: b3.id,
      scheduledDate: d(2026,3,18), duration: 240, status: "ASSIGNED",
      checklistItems: { create: freshItems(18) },
    },
  })

  // UNASSIGNED upcoming jobs
  const j10 = await prisma.job.create({
    data: {
      propertyId: p1.id, hostId: steve.id, bookingId: b4.id,
      scheduledDate: d(2026,3,25), duration: 240, status: "UNASSIGNED",
      checklistItems: { create: freshItems(18) },
    },
  })
  const j11 = await prisma.job.create({
    data: {
      propertyId: p2.id, hostId: steve.id, bookingId: b8.id,
      scheduledDate: d(2026,3,17), duration: 120, status: "UNASSIGNED",
      checklistItems: { create: freshItems(14) },
    },
  })
  const j12 = await prisma.job.create({
    data: {
      propertyId: p3.id, hostId: steve.id, bookingId: b12.id,
      scheduledDate: d(2026,3,29), duration: 360, status: "UNASSIGNED",
      checklistItems: { create: freshItems(22) },
    },
  })
  const j13 = await prisma.job.create({
    data: {
      propertyId: p4.id, hostId: steve.id, bookingId: b16.id,
      scheduledDate: d(2026,3,22), duration: 180, status: "UNASSIGNED",
      checklistItems: { create: freshItems(16) },
    },
  })

  // April jobs (Polo Pines + p1)
  await prisma.job.create({
    data: {
      propertyId: p3.id, hostId: steve.id, bookingId: b13.id,
      scheduledDate: d(2026,4,8), duration: 360, status: "UNASSIGNED",
      checklistItems: { create: freshItems(22) },
    },
  })
  await prisma.job.create({
    data: {
      propertyId: p1.id, hostId: steve.id, bookingId: b5.id,
      scheduledDate: d(2026,4,1), duration: 240, status: "UNASSIGNED",
      checklistItems: { create: freshItems(18) },
    },
  })

  // ── Issue Reports ──────────────────────────────────────────────────────────
  // Completed job j3 (Polo Pines) — Lisa reported a broken item (HIGH, OPEN)
  const issue1 = await prisma.issueReport.create({
    data: {
      jobId: j3.id, propertyId: p3.id, reportedById: lisa.id,
      type: "BROKEN_ITEM", severity: "HIGH", status: "OPEN",
      description: "The towel bar in the master bathroom is completely detached from the wall — looks like it was pulled off. Screws are still in the drywall but the bracket is cracked. Will need replacement hardware and likely a drywall patch before next guests arrive.",
    },
  })

  // Completed job j1 (Creekside Manor) — Maria reported a stain (MEDIUM, REVIEWED)
  await prisma.issueReport.create({
    data: {
      jobId: j1.id, propertyId: p1.id, reportedById: maria.id,
      type: "STAIN", severity: "MEDIUM", status: "REVIEWED",
      description: "Large red wine stain on the living room rug, approximately 12 inches across. I treated it with the stain remover under the kitchen sink and it faded significantly but not fully removed. Recommend professional cleaning before the next booking if possible.",
    },
  })

  // Completed job j4 (Gator Hollow) — Maria reported damage (LOW, RESOLVED)
  await prisma.issueReport.create({
    data: {
      jobId: j4.id, propertyId: p4.id, reportedById: maria.id,
      type: "DAMAGE", severity: "LOW", status: "RESOLVED",
      description: "Small gouge in the drywall near the bedroom 2 door, about the size of a doorknob. Looks like a door was opened too hard without a stopper. Not visible unless you're looking for it. Added a door stopper to prevent recurrence.",
    },
  })

  // ── Supply Requests ────────────────────────────────────────────────────────
  // j5 (Creekside in-progress, James) — PENDING
  await prisma.supplyRequest.create({
    data: {
      jobId: j5.id, propertyId: p1.id, requestedById: james.id,
      items: JSON.stringify(["Bed Linens", "Towels", "Hand Towels", "Toilet Paper", "Paper Towels"]),
      notes: "Running very low on everything after a full week of guests. Please restock before the March 13 check-in.",
      status: "PENDING",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  })

  // j3 (Polo Pines completed, Lisa) — ORDERED
  await prisma.supplyRequest.create({
    data: {
      jobId: j3.id, propertyId: p3.id, requestedById: lisa.id,
      items: JSON.stringify(["Bleach", "Multi-Surface Cleaner", "Dish Soap", "Laundry Detergent", "Trash Bags"]),
      notes: "Restocked cleaning supplies completely. Need a full resupply kit for the next guests.",
      status: "ORDERED",
    },
  })

  // j2 (Magnolia, James) — DELIVERED
  await prisma.supplyRequest.create({
    data: {
      jobId: j2.id, propertyId: p2.id, requestedById: james.id,
      items: JSON.stringify(["Shampoo / Conditioner", "Hand Soap", "Coffee / Tea", "Sponges"]),
      notes: "Guest amenities almost empty.",
      status: "DELIVERED",
    },
  })

  // ── Notifications ──────────────────────────────────────────────────────────
  // For Steve (admin)
  await prisma.notification.create({
    data: {
      userId: steve.id, jobId: j5.id, type: "GENERAL",
      title: "Supplies Needed — Creekside Manor",
      message: "James Wilson requested supplies at Creekside Manor: Bed Linens, Towels, Hand Towels, +2 more.",
    },
  })
  await prisma.notification.create({
    data: {
      userId: steve.id, jobId: j3.id, type: "GENERAL",
      title: "Issue Reported — Polo Pines Estate",
      message: "Lisa Rodriguez reported a high-severity broken item at Polo Pines Estate. The master bathroom towel bar is detached and needs replacement.",
    },
  })
  await prisma.notification.create({
    data: {
      userId: steve.id, type: "GENERAL",
      title: "4 jobs need a cleaner assigned",
      message: "You have 4 upcoming jobs with no cleaner assigned for late March.",
      read: true,
    },
  })
  await prisma.notification.create({
    data: {
      userId: steve.id, jobId: j8.id, type: "GENERAL",
      title: "Lisa Rodriguez accepted the Polo Pines job",
      message: "Lisa accepted the cleaning job at Polo Pines Estate on Friday, March 20 at 10:00 AM.",
      read: true,
    },
  })

  // For Lisa (PENDING_ACCEPTANCE)
  await prisma.notification.create({
    data: {
      userId: lisa.id, jobId: j8.id, type: "JOB_ASSIGNED",
      title: "New Job — Action Required",
      message: "You've been assigned a cleaning job at Polo Pines Estate on Friday, March 20 at 10:00 AM (6 hrs). Please accept or decline.",
    },
  })

  // For James (in-progress job today)
  await prisma.notification.create({
    data: {
      userId: james.id, jobId: j5.id, type: "JOB_ASSIGNED",
      title: "Job Reminder — Creekside Manor Today",
      message: "You have a cleaning job at Creekside Manor today, March 11 at 10:00 AM (4 hrs). Harrington Group checks out this morning.",
      read: true,
    },
  })

  // For Maria (upcoming job)
  await prisma.notification.create({
    data: {
      userId: maria.id, jobId: j6.id, type: "JOB_ASSIGNED",
      title: "New Job Assigned — Gator Hollow House",
      message: "You've been assigned the Gator Hollow House cleaning on Sunday, March 15 at 10:00 AM (3 hrs). McCarthy Group checks out that day.",
    },
  })

  console.log("✓ Admin:    stevebailey130@gmail.com / Admin1234!")
  console.log("✓ Cleaner1: maria@cleaners.com / Cleaner123!")
  console.log("✓ Cleaner2: james@cleaners.com / Cleaner123!")
  console.log("✓ Cleaner3: lisa@cleaners.com / Cleaner123!")
  console.log("✓ Pending:  sofia@cleaners.com (not approved)")
  console.log("✓ 4 properties, 17 bookings, 15 jobs across March–April 2026")
  console.log("✓ Jobs: 4 completed, 1 in-progress, 3 assigned, 1 pending-acceptance, 6 unassigned")
  console.log("✓ 3 issue reports (1 open, 1 reviewed, 1 resolved)")
  console.log("✓ 3 supply requests (1 pending, 1 ordered, 1 delivered)")
  console.log("✓ 8 notifications across all users")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
