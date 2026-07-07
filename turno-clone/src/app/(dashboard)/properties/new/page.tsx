"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { motion } from "framer-motion"
import { Building2, Link2, MapPin, Bed, Bath, Clock, Check, DollarSign } from "lucide-react"

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]

export default function NewPropertyPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "FL",
    bedrooms: "3", bathrooms: "2",
    cleaningDuration: "180",
    cleaningFee: "",
    description: "",
    airbnbIcalUrl: "",
    vrboIcalUrl: "",
  })

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 2) { setStep(step + 1); return }

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create property")
        setLoading(false)
        return
      }
      router.push("/properties")
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  const steps = [
    { label: "Property Info", icon: Building2 },
    { label: "iCal & Setup", icon: Link2 },
  ]

  return (
    <div className="min-h-screen">
      <Header title="Add New Property" subtitle="Connect a new vacation rental" />

      <div className="p-6 max-w-2xl">
        {/* Stepper */}
        <div className="flex items-center gap-0 mb-8">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm transition-all duration-300 ${i + 1 < step ? "bg-blue-600 text-white" : i + 1 === step ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-slate-100 text-slate-400"}`}>
                  {i + 1 < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium ${i + 1 <= step ? "text-blue-600" : "text-slate-400"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mb-5 mx-2 transition-all duration-300 ${i + 1 < step ? "bg-blue-600" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Property Information</h2>
                    <p className="text-sm text-slate-500">Basic details about your rental property.</p>
                  </div>
                  <Input label="Property name" placeholder="e.g. Beautiful Home with Pool" value={form.name}
                    onChange={(e) => update("name", e.target.value)} required />
                  <Input label="Street address" icon={MapPin} placeholder="123 Main St"
                    value={form.address} onChange={(e) => update("address", e.target.value)} required />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="City" placeholder="Ocala" value={form.city}
                      onChange={(e) => update("city", e.target.value)} required />
                    <Select label="State" value={form.state} onChange={(e) => update("state", e.target.value)}
                      options={US_STATES.map((s) => ({ value: s, label: s }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Bedrooms" type="number" icon={Bed} value={form.bedrooms}
                      onChange={(e) => update("bedrooms", e.target.value)} min="1" max="20" required />
                    <Input label="Bathrooms" type="number" icon={Bath} value={form.bathrooms}
                      onChange={(e) => update("bathrooms", e.target.value)} min="1" max="20" step="0.5" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                    <textarea placeholder="Describe your property for cleaners..." value={form.description}
                      onChange={(e) => update("description", e.target.value)} rows={3}
                      className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-300 transition-all placeholder:text-slate-400" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1">iCal & Cleaning Setup</h2>
                    <p className="text-sm text-slate-500">Connect your booking calendars and set cleaning time.</p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-sm font-semibold text-blue-800 mb-1">How to find your iCal URL</p>
                    <p className="text-sm text-blue-600">
                      Airbnb: Calendar → Export Calendar<br />
                      VRBO: Calendar → Subscribe — copy the .ics link
                    </p>
                  </div>

                  <Input label="Airbnb iCal URL (optional)" icon={Link2}
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    value={form.airbnbIcalUrl} onChange={(e) => update("airbnbIcalUrl", e.target.value)} />

                  <Input label="VRBO iCal URL (optional)" icon={Link2}
                    placeholder="https://www.vrbo.com/calendar/ical/..."
                    value={form.vrboIcalUrl} onChange={(e) => update("vrboIcalUrl", e.target.value)} />

                  <Input
                    label="Cleaning Fee ($)"
                    type="number"
                    icon={DollarSign}
                    placeholder="0.00"
                    value={form.cleaningFee}
                    onChange={(e) => update("cleaningFee", e.target.value)}
                    min="0"
                    step="0.01"
                  />

                  <div>
                    <Select label="Cleaning duration" value={form.cleaningDuration}
                      onChange={(e) => update("cleaningDuration", e.target.value)}
                      options={[
                        { value: "60", label: "1 hour" },
                        { value: "90", label: "1.5 hours" },
                        { value: "120", label: "2 hours" },
                        { value: "150", label: "2.5 hours" },
                        { value: "180", label: "3 hours" },
                        { value: "240", label: "4 hours" },
                        { value: "300", label: "5 hours" },
                        { value: "360", label: "6 hours" },
                      ]} />
                  </div>

                  <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
                    <p className="font-semibold text-emerald-800">Summary</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label: "Property", value: form.name || "—" },
                        { label: "Location", value: form.city && form.state ? `${form.city}, ${form.state}` : "—" },
                        { label: "Size", value: `${form.bedrooms} bed / ${form.bathrooms} bath` },
                        { label: "Airbnb iCal", value: form.airbnbIcalUrl ? "Connected" : "Not set" },
                        { label: "VRBO iCal", value: form.vrboIcalUrl ? "Connected" : "Not set" },
                        { label: "Clean Duration", value: `${parseInt(form.cleaningDuration) / 60} hr${parseInt(form.cleaningDuration) > 60 ? "s" : ""}` },
                        { label: "Cleaning Fee", value: form.cleaningFee ? `$${parseFloat(form.cleaningFee).toFixed(2)}` : "Not set" },
                      ].map((row) => (
                        <div key={row.label}>
                          <p className="text-emerald-600 text-xs">{row.label}</p>
                          <p className="font-semibold text-emerald-900 text-sm">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                {step > 1 && (
                  <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>
                    Back
                  </Button>
                )}
                <Button type="submit" size="lg" className="flex-1" loading={loading}>
                  {step < 2 ? "Continue" : "Add Property"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </form>
      </div>
    </div>
  )
}
