import Link from "next/link"

export const metadata = {
  title: "Terms of Use — BDG Cleaning",
}

const EFFECTIVE_DATE = "July 12, 2026"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">← Back to BDG Cleaning</Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-4">Terms of Use</h1>
        <p className="text-sm text-slate-500 mt-1">BDG Cleaning · Bailey Development Group · Effective {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-8 text-slate-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">What this app is</h2>
            <p>
              BDG Cleaning is a private tool for scheduling and managing cleaning work on
              properties managed by Bailey Development Group. Accounts are for our administrators
              and the cleaners who work with us. It is not a marketplace or a consumer service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Your account</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keep your login credentials private and your profile information accurate.</li>
              <li>You're responsible for activity under your account.</li>
              <li>You can delete your account at any time in Settings; we may deactivate accounts that are no longer working with us.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Acceptable use</h2>
            <p>
              Use the app only for legitimate work purposes. Don't upload content that is
              unlawful, misleading (e.g. photos that aren't from the actual job), or that
              infringes anyone's rights. Don't attempt to access other users' data or disrupt the
              service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Jobs and payments</h2>
            <p>
              Job offers, acceptances, and completion records in the app help us coordinate work —
              they are records, not a payment system. Payment amounts shown are tracked for
              bookkeeping; actual payment happens outside the app through the method on your
              profile. The app does not create an employment relationship or guarantee any volume
              of work.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Disclaimers</h2>
            <p>
              The app is provided "as is." We work to keep it available and accurate but don't
              guarantee uninterrupted service, and we're not liable for indirect damages arising
              from its use, to the extent permitted by law. These terms are governed by the laws
              of the State of Florida.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Contact</h2>
            <p>
              Questions:{" "}
              <a href="mailto:stevebailey130@gmail.com" className="text-blue-600 hover:underline">
                stevebailey130@gmail.com
              </a>. See also our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
