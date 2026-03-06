import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import bcrypt from "bcryptjs"

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
const adapter = new PrismaBetterSqlite3({ url })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database...")

  // Clear existing data
  await prisma.review.deleteMany()
  await prisma.checklistItem.deleteMany()
  await prisma.job.deleteMany()
  await prisma.property.deleteMany()
  await prisma.user.deleteMany()

  // Hash password
  const pw = await bcrypt.hash("password123", 12)

  // Create hosts
  const sarah = await prisma.user.create({
    data: {
      name: "Sarah Johnson",
      email: "sarah@example.com",
      password: pw,
      role: "HOST",
      phone: "(305) 555-0142",
      location: "Miami Beach, FL",
      bio: "Airbnb Superhost with 8 properties across South Florida and the Southeast. I take pride in providing exceptional guest experiences.",
      avatarUrl: null,
      rating: 4.9,
      reviewCount: 89,
    },
  })

  const mike = await prisma.user.create({
    data: {
      name: "Mike Thompson",
      email: "mike@example.com",
      password: pw,
      role: "HOST",
      phone: "(305) 555-0198",
      location: "Key West, FL",
      bio: "VRBO host with 3 properties in the Florida Keys. Love hosting families and couples looking for a paradise getaway.",
      avatarUrl: null,
      rating: 4.85,
      reviewCount: 54,
    },
  })

  // Create cleaners
  const maria = await prisma.user.create({
    data: {
      name: "Maria Garcia",
      email: "maria@example.com",
      password: pw,
      role: "CLEANER",
      phone: "(305) 555-0187",
      location: "Miami, FL",
      bio: "Experienced vacation rental specialist with 6 years in South Florida. I pay close attention to detail and always leave properties spotless.",
      hourlyRate: 28,
      rating: 4.97,
      reviewCount: 147,
    },
  })

  const david = await prisma.user.create({
    data: {
      name: "David Chen",
      email: "david@example.com",
      password: pw,
      role: "CLEANER",
      phone: "(312) 555-0234",
      location: "Chicago, IL",
      bio: "Professional cleaner specializing in downtown condos and lofts. Certified in hospitality standards.",
      hourlyRate: 26,
      rating: 4.92,
      reviewCount: 98,
    },
  })

  const emma = await prisma.user.create({
    data: {
      name: "Emma Wilson",
      email: "emma@example.com",
      password: pw,
      role: "CLEANER",
      phone: "(305) 555-0156",
      location: "Key West, FL",
      bio: "Former hotel housekeeper with 8 years experience. Reliable, punctual, and thorough.",
      hourlyRate: 25,
      rating: 4.88,
      reviewCount: 73,
    },
  })

  const james = await prisma.user.create({
    data: {
      name: "James Martinez",
      email: "james@example.com",
      password: pw,
      role: "CLEANER",
      phone: "(480) 555-0312",
      location: "Scottsdale, AZ",
      bio: "Luxury property specialist with expertise in high-end vacation homes. Fully insured and bonded.",
      hourlyRate: 30,
      rating: 4.94,
      reviewCount: 124,
    },
  })

  const lisa = await prisma.user.create({
    data: {
      name: "Lisa Park",
      email: "lisa@example.com",
      password: pw,
      role: "CLEANER",
      phone: "(530) 555-0089",
      location: "Lake Tahoe, CA",
      bio: "Mountain cabin and lakefront property expert. Available weekdays and weekends.",
      hourlyRate: 32,
      rating: 4.99,
      reviewCount: 61,
    },
  })

  // Create properties
  const p1 = await prisma.property.create({
    data: {
      hostId: sarah.id,
      name: "Oceanview Retreat",
      address: "1247 Collins Ave",
      city: "Miami Beach",
      state: "FL",
      bedrooms: 4,
      bathrooms: 3,
      description: "Stunning oceanfront property with 4 bedrooms, private pool, and breathtaking views of the Atlantic.",
      imageUrl: "https://picsum.photos/seed/oceanview/800/500",
      cleaningDuration: 180,
      cleaningRate: 185,
      platform: "AIRBNB",
      icalUrl: "https://www.airbnb.com/calendar/ical/example1.ics",
    },
  })

  const p2 = await prisma.property.create({
    data: {
      hostId: sarah.id,
      name: "Downtown Loft",
      address: "820 N Michigan Ave",
      city: "Chicago",
      state: "IL",
      bedrooms: 2,
      bathrooms: 2,
      description: "Modern industrial loft in the heart of Chicago with stunning skyline views.",
      imageUrl: "https://picsum.photos/seed/loft/800/500",
      cleaningDuration: 120,
      cleaningRate: 120,
      platform: "VRBO",
    },
  })

  const p3 = await prisma.property.create({
    data: {
      hostId: sarah.id,
      name: "Mountain Cabin Retreat",
      address: "44 Pisgah Forest Rd",
      city: "Asheville",
      state: "NC",
      bedrooms: 3,
      bathrooms: 2.5,
      description: "Cozy mountain cabin with hot tub, fireplace, and panoramic Blue Ridge Mountain views.",
      imageUrl: "https://picsum.photos/seed/cabin/800/500",
      cleaningDuration: 240,
      cleaningRate: 220,
      platform: "AIRBNB",
    },
  })

  const p4 = await prisma.property.create({
    data: {
      hostId: mike.id,
      name: "Beachside Bungalow",
      address: "392 Duval St",
      city: "Key West",
      state: "FL",
      bedrooms: 2,
      bathrooms: 1,
      description: "Charming Key West bungalow steps from Duval Street and the beach.",
      imageUrl: "https://picsum.photos/seed/bungalow/800/500",
      cleaningDuration: 150,
      cleaningRate: 160,
      platform: "VRBO",
    },
  })

  const p5 = await prisma.property.create({
    data: {
      hostId: mike.id,
      name: "Sunset Villa",
      address: "5019 Camelback Rd",
      city: "Scottsdale",
      state: "AZ",
      bedrooms: 5,
      bathrooms: 4,
      description: "Luxury desert villa with resort-style pool and stunning Camelback Mountain views.",
      imageUrl: "https://picsum.photos/seed/villa/800/500",
      cleaningDuration: 300,
      cleaningRate: 285,
      platform: "AIRBNB",
    },
  })

  // Checklist template
  const checklist = [
    { label: "Vacuum all floors", room: "General" },
    { label: "Mop hard floors", room: "General" },
    { label: "Clean bathrooms", room: "Bathroom" },
    { label: "Replace towels and toiletries", room: "Bathroom" },
    { label: "Make all beds with fresh linens", room: "Bedroom" },
    { label: "Dust all surfaces", room: "Bedroom" },
    { label: "Clean kitchen counters and appliances", room: "Kitchen" },
    { label: "Empty all trash cans", room: "General" },
    { label: "Final walkthrough", room: "General" },
  ]

  const now = new Date()
  const h = (hours: number) => new Date(now.getTime() + hours * 3600000)

  // Create jobs
  const j1 = await prisma.job.create({
    data: {
      propertyId: p1.id, hostId: sarah.id, cleanerId: maria.id,
      status: "ASSIGNED", scheduledDate: h(3),
      checkoutDate: h(2), checkinDate: h(9),
      duration: 180, price: 185, platform: "AIRBNB",
      notes: "Please pay special attention to the master bath. Fresh flowers in entryway if available.",
      checklistItems: { create: checklist },
    },
  })

  const j2 = await prisma.job.create({
    data: {
      propertyId: p2.id, hostId: sarah.id, cleanerId: david.id,
      status: "ASSIGNED", scheduledDate: h(26),
      checkoutDate: h(25), checkinDate: h(33),
      duration: 120, price: 120, platform: "VRBO",
      checklistItems: { create: checklist },
    },
  })

  const j3 = await prisma.job.create({
    data: {
      propertyId: p3.id, hostId: sarah.id,
      status: "OPEN", scheduledDate: h(50),
      checkoutDate: h(49), checkinDate: h(57),
      duration: 240, price: 220, platform: "AIRBNB",
      checklistItems: { create: checklist },
    },
  })

  const j4 = await prisma.job.create({
    data: {
      propertyId: p4.id, hostId: mike.id, cleanerId: emma.id,
      status: "IN_PROGRESS", scheduledDate: h(-0.5),
      checkoutDate: h(-1.5), checkinDate: h(3.5),
      duration: 150, price: 160, platform: "VRBO",
      checklistItems: { create: checklist.map((c, i) => ({ ...c, completed: i < 3 })) },
    },
  })

  const j5 = await prisma.job.create({
    data: {
      propertyId: p5.id, hostId: mike.id, cleanerId: james.id,
      status: "COMPLETED", scheduledDate: h(-48),
      checkoutDate: h(-50), checkinDate: h(-40),
      duration: 300, price: 285, platform: "AIRBNB", completedAt: h(-45),
      checklistItems: { create: checklist.map((c) => ({ ...c, completed: true })) },
    },
  })

  // Create review for completed job
  await prisma.review.create({
    data: {
      jobId: j5.id,
      reviewerId: mike.id,
      revieweeId: james.id,
      rating: 5,
      comment: "James did an outstanding job. The villa was spotless and perfectly staged for our next guests. Highly recommended!",
    },
  })

  console.log("✓ Created 2 hosts, 5 cleaners")
  console.log("✓ Created 5 properties")
  console.log("✓ Created 5 jobs (ASSIGNED, ASSIGNED, OPEN, IN_PROGRESS, COMPLETED)")
  console.log("✓ Created 1 review")
  console.log("")
  console.log("Demo accounts (password: password123):")
  console.log("  Host:    sarah@example.com")
  console.log("  Host:    mike@example.com")
  console.log("  Cleaner: maria@example.com")
  console.log("  Cleaner: david@example.com")
  console.log("  Cleaner: emma@example.com")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
