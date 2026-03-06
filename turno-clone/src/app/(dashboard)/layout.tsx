import { AuthProvider } from "@/components/layout/Providers"
import { Sidebar } from "@/components/layout/Sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 lg:ml-60 min-h-screen pt-16 lg:pt-0">
          {children}
        </div>
      </div>
    </AuthProvider>
  )
}
