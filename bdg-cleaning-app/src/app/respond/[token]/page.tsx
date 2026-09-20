import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { MapPin, Calendar, Clock, StickyNote, Zap } from "lucide-react"
import RespondButtons from "./respond-buttons"
import { isSameDayTurnover } from "@/lib/jobs"

// Public landing page for one-click job responses from email.
// No auth — access is the single-use token itself.
export default async function RespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const job =
    token.length >= 32
      ? await prisma.job.findUnique({
          where: { actionToken: token },
          include: {
            property: true,
            cleaner: { select: { name: true } },
            host: { select: { name: true, phone: true } },
          },
        })
      : null

  const expired = job?.actionTokenExpiry ? job.actionTokenExpiry < new Date() : false
  const valid = job && job.status === "PENDING_ACCEPTANCE" && !expired
  const turnover = valid ? await isSameDayTurnover(job.propertyId, new Date(job.scheduledDate), job.bookingId) : false

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-blue-800 rounded-t-2xl px-6 py-5">
          <h1 className="text-white text-lg font-bold">Cleaning Job Request</h1>
          <p className="text-blue-200 text-sm">Bailey Development Group</p>
        </div>
        <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 px-6 py-6 shadow-sm">
          {!valid ? (
            <div className="text-center py-6">
              <p className="text-slate-700 font-medium mb-2">
                {expired ? "This link has expired." : "This link is no longer valid."}
              </p>
              <p className="text-slate-500 text-sm">
                The job may have already been responded to or reassigned.
                {job?.host?.phone ? ` Questions? Call ${job.host.name} at ${job.host.phone}.` : ""}
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-700 mb-5">
                Hi <span className="font-semibold">{job.cleaner?.name}</span> — you&apos;ve been offered this
                cleaning job. Please respond below.
              </p>
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                <div>
                  <p className="text-base font-bold text-slate-900">{job.property.name}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.property.address}, {job.property.city}, {job.property.state}
                  </p>
                </div>
                <p className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {format(new Date(job.scheduledDate), "EEEE, MMMM d")}
                </p>
                <p className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Checkout: {job.property.checkoutTime} &middot; About {Math.round(job.duration / 60 * 10) / 10} hours to clean
                </p>
                <p className="text-sm text-slate-500 pl-5">
                  {job.property.bedrooms} bed / {job.property.bathrooms} bath
                </p>
                {job.notes && (
                  <p className="text-sm text-slate-700 flex items-start gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    {job.notes}
                  </p>
                )}
              </div>
              {turnover && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3 mb-6">
                  <Zap className="w-4 h-4 text-orange-600 mt-0.5 shrink-0 fill-current" />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Same-day turnover</p>
                    <p className="text-xs text-orange-700 mt-0.5">A new guest checks in today — this one needs a quick turnaround.</p>
                  </div>
                </div>
              )}
              <RespondButtons token={token} />
              {job.host?.phone && (
                <p className="text-xs text-slate-400 text-center mt-5">
                  Questions? Call {job.host.name} at {job.host.phone}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
