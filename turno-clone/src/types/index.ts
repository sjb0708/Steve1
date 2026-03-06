export type Role = "HOST" | "CLEANER"

export type JobStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  phone?: string | null
  avatarUrl?: string | null
  bio?: string | null
  location?: string | null
  hourlyRate?: number | null
  rating: number
  reviewCount: number
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
  icalUrl?: string | null
  cleaningDuration: number
  cleaningRate: number
  platform?: string | null
  createdAt: string
  host?: User
  jobs?: Job[]
}

export interface Job {
  id: string
  propertyId: string
  hostId: string
  cleanerId?: string | null
  status: JobStatus
  scheduledDate: string
  duration: number
  price: number
  notes?: string | null
  checkoutDate?: string | null
  checkinDate?: string | null
  platform?: string | null
  completedAt?: string | null
  createdAt: string
  property?: Property
  host?: User
  cleaner?: User | null
  checklistItems?: ChecklistItem[]
  review?: Review | null
}

export interface ChecklistItem {
  id: string
  jobId: string
  label: string
  completed: boolean
  room?: string | null
}

export interface Review {
  id: string
  jobId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment?: string | null
  createdAt: string
  reviewer?: User
  reviewee?: User
}

export interface JwtPayload {
  userId: string
  email: string
  role: Role
  name: string
}
