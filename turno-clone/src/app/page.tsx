"use client"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Sparkles, Calendar, Users, Star, CheckCircle2, ArrowRight, Clock,
  Shield, Zap, BarChart3, Bell, Play, Check, Home,
} from "lucide-react"

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }
const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">
              BDG <span className="text-blue-600">Cleaning</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Features", "How It Works", "Pricing", "Testimonials"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all hover:shadow-md hover:shadow-blue-200">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center max-w-4xl mx-auto">
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-800/60 text-blue-200 text-sm font-medium rounded-full border border-blue-700/50">
                <span className="w-2 h-2 bg-blue-400 rounded-full status-pulse" />
                Trusted by 12,000+ vacation rental hosts
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] mb-6">
              Never miss a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
                turnover
              </span>{" "}
              again
            </motion.h1>
            <motion.p variants={fadeUp} className="text-xl text-blue-200 max-w-2xl mx-auto mb-10 leading-relaxed">
              Auto-schedule cleanings based on your Airbnb and VRBO bookings. Connect with vetted local cleaners and streamline every property turnover.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold text-lg rounded-2xl hover:bg-blue-50 transition-all hover:shadow-xl hover:shadow-blue-900/30 group">
                Start for free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="inline-flex items-center gap-3 px-8 py-4 bg-blue-800/50 text-white font-semibold text-lg rounded-2xl hover:bg-blue-800 transition-colors border border-blue-700/50">
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
                Watch demo
              </button>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-6 text-blue-400 text-sm">
              Free 14-day trial · No credit card required · Cancel anytime
            </motion.p>
          </motion.div>

          {/* Dashboard mockup */}
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 20 }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className="mt-16 relative max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/10 p-3 shadow-2xl">
              <div className="bg-slate-900 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <div className="flex-1 mx-4 bg-slate-700 rounded-md px-3 py-1 text-slate-400 text-xs">
                    app.bdgcleaning.com/dashboard
                  </div>
                </div>
                <div className="p-4 flex gap-3">
                  <div className="w-40 bg-blue-950 rounded-xl p-3 space-y-2 flex-shrink-0">
                    <div className="h-6 bg-white/10 rounded-lg" />
                    <div className="space-y-1 pt-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-7 rounded-lg ${i === 1 ? "bg-white/20" : "bg-white/5"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { color: "bg-blue-500" }, { color: "bg-emerald-500" },
                        { color: "bg-purple-500" }, { color: "bg-amber-500" },
                      ].map((s, i) => (
                        <div key={i} className="bg-slate-800 rounded-xl p-3">
                          <div className={`w-6 h-6 ${s.color} rounded-lg mb-2`} />
                          <div className="h-4 bg-slate-700 rounded mb-1" />
                          <div className="h-6 bg-slate-600 rounded w-3/4" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-800 rounded-xl p-3 h-28">
                        <div className="h-3 bg-slate-700 rounded w-1/2 mb-3" />
                        <div className="space-y-1.5">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <div className="w-6 h-6 bg-blue-900 rounded-lg flex-shrink-0" />
                              <div className="flex-1 h-3 bg-slate-700 rounded" />
                              <div className="w-12 h-4 bg-emerald-900 rounded-full" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-xl p-3 h-28">
                        <div className="h-3 bg-slate-700 rounded w-2/3 mb-3" />
                        <div className="grid grid-cols-7 gap-0.5">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <div key={i} className={`h-4 rounded-sm ${[3,7,10,14,18,21,25].includes(i) ? "bg-blue-600" : [4,11,19,26].includes(i) ? "bg-blue-400" : "bg-slate-700"}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute -left-8 top-16 bg-white rounded-2xl shadow-xl p-3 hidden lg:flex items-center gap-3 animate-fade-in" style={{ animationDelay: "0.8s" }}>
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Cleaning Complete</p>
                <p className="text-xs text-slate-500">Oceanview Retreat</p>
              </div>
            </div>
            <div className="absolute -right-8 bottom-16 bg-white rounded-2xl shadow-xl p-3 hidden lg:flex items-center gap-3 animate-fade-in" style={{ animationDelay: "1s" }}>
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Auto-scheduled</p>
                <p className="text-xs text-slate-500">3 new cleanings synced</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-10 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-slate-400 font-medium mb-6">Syncs with your booking platforms</p>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            {[{name:"Airbnb",color:"text-rose-500"},{name:"VRBO",color:"text-blue-600"},{name:"Booking.com",color:"text-blue-800"},{name:"HomeAway",color:"text-green-600"},{name:"TripAdvisor",color:"text-emerald-600"}].map((p) => (
              <span key={p.name} className={`text-xl font-black ${p.color} opacity-60 hover:opacity-100 transition-opacity cursor-default`}>{p.name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[{value:"12,000+",label:"Active Hosts",icon:Home},{value:"48,000+",label:"Cleanings Completed",icon:CheckCircle2},{value:"3,200+",label:"Vetted Cleaners",icon:Users},{value:"4.9/5",label:"Average Rating",icon:Star}].map((stat) => (
              <motion.div key={stat.label} variants={fadeUp} className="text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">How It Works</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-black text-slate-900 mb-4">Set it up once. Run on autopilot.</motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-slate-500 max-w-2xl mx-auto">From booking sync to clean completion in minutes.</motion.p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid md:grid-cols-3 gap-8">
            {[
              { step:"01", icon:Calendar, title:"Connect Your Calendar", desc:"Paste your Airbnb or VRBO iCal link. We automatically detect checkout dates and schedule cleanings." },
              { step:"02", icon:Users, title:"Assign Your Cleaner", desc:"Browse our marketplace of vetted cleaners near you. Read reviews, compare rates, and hire with one click." },
              { step:"03", icon:CheckCircle2, title:"Track & Get Paid", desc:"Cleaners check in, follow photo checklists, and you receive a completion report before your next guest arrives." },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="relative bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-4xl font-black text-slate-100">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Features</motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl font-black text-slate-900 mb-4">Everything you need to manage turnovers</motion.h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon:Zap, title:"Auto-Scheduling", desc:"Sync with Airbnb, VRBO, and Booking.com. Cleanings are auto-created on checkout dates.", color:"bg-amber-50 text-amber-600" },
              { icon:Users, title:"Cleaner Marketplace", desc:"Browse 3,200+ vetted professionals. Filter by location, rating, and price. Hire with confidence.", color:"bg-blue-50 text-blue-600" },
              { icon:CheckCircle2, title:"Photo Checklists", desc:"Cleaners follow room-by-room checklists and submit photos so you can verify remotely.", color:"bg-emerald-50 text-emerald-600" },
              { icon:Bell, title:"Smart Notifications", desc:"Get alerts when a cleaner checks in, completes a room, or finishes — all in real time.", color:"bg-purple-50 text-purple-600" },
              { icon:BarChart3, title:"Earnings & Reports", desc:"Cleaners get transparent earnings dashboards. Hosts see spending reports per property.", color:"bg-cyan-50 text-cyan-600" },
              { icon:Shield, title:"Secure Payments", desc:"Payments held in escrow until job completion. Dispute resolution built-in for peace of mind.", color:"bg-rose-50 text-rose-600" },
            ].map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="group p-6 rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all">
                <div className={`w-12 h-12 ${f.color} rounded-2xl flex items-center justify-center mb-4`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="text-4xl font-black text-slate-900">Loved by hosts and cleaners</h2>
            </motion.div>
            <motion.div variants={stagger} className="grid md:grid-cols-3 gap-6">
              {[
                { name:"Sarah Johnson", role:"Airbnb Superhost · 8 properties", avatar:"SJ", rating:5, text:"Before BDG Cleaning, I was manually texting my cleaners for every checkout. Now everything syncs automatically and I get a photo report before my next guest. Complete game changer." },
                { name:"Maria Garcia", role:"Professional Cleaner · 4 years", avatar:"MG", rating:5, text:"The app gives me a clear schedule, checklists for every property, and same-day payouts. I've doubled my bookings since joining and the hosts I work with are so organized now." },
                { name:"Mike Thompson", role:"VRBO Host · 3 properties", avatar:"MT", rating:5, text:"Found a trusted cleaner within 24 hours of signing up. Three months later she's cleaned 40+ times across all my properties with zero issues. The review system works." },
              ].map((t) => (
                <motion.div key={t.name} variants={fadeUp} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed mb-6 text-sm">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm">{t.avatar}</div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                      <p className="text-slate-400 text-xs">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-4xl font-black text-slate-900 mb-4">Simple, transparent pricing</h2>
              <p className="text-xl text-slate-500">Start free. Scale as you grow.</p>
            </motion.div>
            <motion.div variants={stagger} className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                { name:"Starter", price:"Free", period:"forever", desc:"Perfect for getting started with one property", features:["1 property","5 jobs/month","Cleaner marketplace","Basic checklists","Email support"], cta:"Start free", featured:false },
                { name:"Professional", price:"$29", period:"per month", desc:"For hosts with multiple properties", features:["Up to 10 properties","Unlimited jobs","Calendar sync (Airbnb, VRBO)","Photo checklists","Priority support","Earnings reports"], cta:"Start 14-day trial", featured:true },
                { name:"Enterprise", price:"$79", period:"per month", desc:"For property managers and teams", features:["Unlimited properties","Unlimited jobs","Team management","Custom checklists","Dedicated support","API access"], cta:"Contact sales", featured:false },
              ].map((plan) => (
                <motion.div key={plan.name} variants={fadeUp}
                  className={`rounded-3xl p-8 border ${plan.featured ? "bg-blue-600 border-blue-600 shadow-2xl shadow-blue-200 scale-105" : "bg-white border-slate-200"}`}>
                  <p className={`font-bold text-sm mb-2 ${plan.featured ? "text-blue-200" : "text-slate-500"}`}>{plan.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-4xl font-black ${plan.featured ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                    <span className={`text-sm mb-1.5 ${plan.featured ? "text-blue-200" : "text-slate-400"}`}>/{plan.period}</span>
                  </div>
                  <p className={`text-sm mb-8 ${plan.featured ? "text-blue-200" : "text-slate-500"}`}>{plan.desc}</p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm">
                        <Check className={`w-4 h-4 flex-shrink-0 ${plan.featured ? "text-blue-200" : "text-blue-600"}`} />
                        <span className={plan.featured ? "text-blue-100" : "text-slate-600"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className={`block text-center py-3 px-6 rounded-2xl font-semibold text-sm transition-all ${plan.featured ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                    {plan.cta}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 bg-gradient-to-r from-blue-900 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black text-white mb-6">Ready to automate your turnovers?</motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-blue-200 mb-10">Join 12,000+ hosts who have taken the stress out of vacation rental cleaning.</motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-bold text-lg rounded-2xl hover:bg-blue-50 transition-all">
                Get started free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-800/50 text-white font-semibold text-lg rounded-2xl hover:bg-blue-800 transition-colors border border-blue-600">
                Sign in to your account
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm">BDG Cleaning</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">Smart cleaning management for vacation rental hosts.</p>
            </div>
            {[
              { title:"Product", links:["Features","How it works","Pricing","Changelog"] },
              { title:"Company", links:["About","Blog","Careers","Press"] },
              { title:"Support", links:["Help center","Contact us","Privacy policy","Terms"] },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-semibold text-white text-sm mb-4">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs">© 2024 BDG Cleaning. All rights reserved.</p>
            <p className="text-xs">Made with care for vacation rental hosts everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
