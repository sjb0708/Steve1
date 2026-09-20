import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Bailey Development Group | Cleaning Management",
  description: "Private cleaning management for Bailey Development Group vacation rental properties.",
  // "Add to Home Screen" support — gives a real icon and a full-screen app
  // window instead of a bookmark that opens with the browser bar showing.
  manifest: "/manifest.webmanifest",
  applicationName: "BDG Cleaning",
  appleWebApp: {
    capable: true,
    title: "BDG Cleaning",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  // In-house tool on a public URL — keep it out of search results.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
  // Let people pinch-zoom; locking it out hurts anyone reading small text.
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}>
        {children}
      </body>
    </html>
  )
}
