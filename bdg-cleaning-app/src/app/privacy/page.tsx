import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — BDG Cleaning",
}

const EFFECTIVE_DATE = "July 12, 2026"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">← Back to BDG Cleaning</Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-4">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mt-1">BDG Cleaning · Bailey Development Group · Effective {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-8 text-slate-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Who we are</h2>
            <p>
              BDG Cleaning is a private scheduling and job-management app operated by Bailey
              Development Group for cleaning work on properties we manage in and around Ocala,
              Florida. It is used by our administrators and the cleaners who work with us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Profile information:</strong> your name, and optionally your email address, phone number, mobile carrier, location, bio, and profile photo.</li>
              <li><strong>Payment preferences:</strong> how you'd like to be paid (e.g. a Zelle, PayPal, or Venmo handle). We do not collect bank card numbers and we do not process payments in the app.</li>
              <li><strong>Work records:</strong> jobs you're assigned, checklists you complete, photos you upload of finished work or issues, supply requests, and the amounts you're owed and paid.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">How we use it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Scheduling and assigning cleaning jobs, and tracking their completion.</li>
              <li>Notifying you about job offers, changes, and reminders by email and/or text message.</li>
              <li>Keeping records of what you're owed and what has been paid.</li>
            </ul>
            <p className="mt-2">
              We do not sell or rent your information, we do not use it for advertising, and we do
              not track you across other apps or websites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Emails and text messages — opting in and out</h2>
            <p>
              Job notifications are sent to the email address and/or phone number on your profile.
              By providing a phone number and carrier you agree to receive job-related text
              messages; message and data rates from your carrier may apply. You can opt out of
              email notifications any time in <strong>Settings → Notifications</strong>, and stop
              texts by removing your carrier from your profile or asking an administrator to
              remove your phone number. We never send marketing messages — only messages about
              your work.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Service providers</h2>
            <p>
              The app runs on Vercel (hosting and photo storage) with data stored in a managed
              PostgreSQL database (Neon). Emails are delivered via Resend, and text messages via
              your mobile carrier's email-to-text gateway or Twilio. These providers process data
              only to deliver the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Deleting your account</h2>
            <p>
              You can delete your account yourself at any time in{" "}
              <strong>Settings → Security → Delete Account</strong>. Deleting your account removes
              your personal information (name, email, phone, photos, payment handle) and releases
              any open jobs. Records of past payments are retained for bookkeeping and tax
              purposes, but are disconnected from your personal details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Data retention and security</h2>
            <p>
              We keep your information while your account is active. Access requires a password;
              connections are encrypted with HTTPS. Job and financial records are retained as
              business records even after a cleaner stops working with us, minus personal details
              when an account is deleted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Children</h2>
            <p>
              BDG Cleaning is a workplace tool for adults and is not directed at children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Contact</h2>
            <p>
              Questions or requests about your data: email{" "}
              <a href="mailto:stevebailey130@gmail.com" className="text-blue-600 hover:underline">
                stevebailey130@gmail.com
              </a>.
            </p>
          </section>

          <p className="text-xs text-slate-400 pt-4 border-t border-slate-200">
            We may update this policy as the app changes; the effective date above always reflects
            the current version. See also our <Link href="/terms" className="text-blue-600 hover:underline">Terms of Use</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
