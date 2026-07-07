export type Role = "ADMIN" | "CLEANER"

export type JobStatus = "UNASSIGNED" | "PENDING_ACCEPTANCE" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export type NotificationType = "JOB_ASSIGNED" | "JOB_UPDATED" | "JOB_REMINDER" | "JOB_CANCELLED" | "GENERAL"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  phone?: string | null
  avatarUrl?: string | null
  bio?: string | null
  location?: string | null
  approved: boolean
  emailNotifications: boolean
  appNotifications: boolean
  createdAt: string
}

export interface Property {
  id: string
  hostId: string
  name: string
  address: string
  city: string
  state: string
  bedrooms: number
  bathrooms: number
  description?: string | null
  imageUrl?: string | null
  airbnbIcalUrl?: string | null
  vrboIcalUrl?: string | null
  cleaningDuration: number
  cleaningFee?: number
  accessInstructions?: string | null
  lastSyncedAt?: string | null
  createdAt: string
  host?: User
  jobs?: Job[]
  bookings?: Booking[]
  checklistTemplate?: ChecklistTemplate | null
}

export interface Booking {
  id: string
  propertyId: string
  platform: string
  externalId?: string | null
  guestName?: string | null
  checkIn: string
  checkOut: string
  notes?: string | null
  createdAt: string
  property?: Property
  jobs?: Job[]
}

export interface Job {
  id: string
  propertyId: string
  hostId: string
  cleanerId?: string | null
  bookingId?: string | null
  status: JobStatus
  scheduledDate: string
  duration: number
  notes?: string | null
  completedAt?: string | null
  createdAt: string
  property?: Property
  host?: User
  cleaner?: User | null
  booking?: Booking | null
  checklistItems?: ChecklistItem[]
}

export interface ChecklistTemplate {
  id: string
  propertyId: string
  items: ChecklistTemplateItem[]
}

export interface ChecklistTemplateItem {
  id: string
  templateId: string
  label: string
  room?: string | null
  order: number
}

export interface ChecklistItem {
  id: string
  jobId: string
  label: string
  completed: boolean
  room?: string | null
  order: number
}

export interface Notification {
  id: string
  userId: string
  jobId?: string | null
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
  job?: Job | null
}

export type IssueType = "DAMAGE" | "BROKEN_ITEM" | "STAIN" | "PEST" | "OTHER"
export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH"
export type IssueStatus = "OPEN" | "REVIEWED" | "RESOLVED"

export interface IssuePhoto {
  id: string
  issueReportId: string
  url: string
  createdAt: string
}

export interface IssueReport {
  id: string
  jobId: string
  propertyId: string
  reportedById: string
  type: IssueType
  severity: IssueSeverity
  description: string
  status: IssueStatus
  createdAt: string
  updatedAt: string
  job?: { id: string; scheduledDate: string }
  property?: { id: string; name: string; address?: string; city?: string; state?: string }
  reportedBy?: { id: string; name: string; avatarUrl?: string | null; phone?: string | null }
  photos: IssuePhoto[]
}

export interface SupplyRequest {
  id: string
  jobId: string
  propertyId: string
  requestedById: string
  items: string // JSON array
  notes?: string | null
  status: "PENDING" | "ORDERED" | "DELIVERED"
  createdAt: string
  updatedAt: string
  job?: { id: string; scheduledDate: string }
  property?: { id: string; name: string }
  requestedBy?: { id: string; name: string; avatarUrl?: string | null }
}

export interface JwtPayload {
  userId: string
  email: string
  role: Role
  name: string
}
