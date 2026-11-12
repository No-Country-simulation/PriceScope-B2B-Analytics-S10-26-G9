"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { AdminSidebar, adminPageTitle } from "@/components/admin/admin-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { HOME_BY_ROLE, SESSION_EXPIRED_PARAM, useAuth } from "@/lib/auth"

// Client-side guard for the backoffice. The backend enforces the admin role
// on every /admin endpoint; this only keeps other users out of the UI.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { status, user, expired } = useAuth()

  React.useEffect(() => {
    if (status === "anonymous") {
      // Read here rather than with usePathname(): on dynamic routes the path
      // is request data, and the shell must not wait on it to render.
      const next = `next=${encodeURIComponent(window.location.pathname)}`
      router.replace(
        expired
          ? `/ingresar?${SESSION_EXPIRED_PARAM}&${next}`
          : `/ingresar?${next}`
      )
    } else if (status === "authenticated" && user && user.role !== "admin") {
      router.replace(HOME_BY_ROLE[user.role])
    }
  }, [status, user, expired, router])

  // While the session is being restored the shell and the page render as
  // usual (pages show their own loading state and their requests wait for
  // the session). Only a missing session or the wrong role blocks them.
  if (status === "anonymous" || (user && user.role !== "admin")) {
    return (
      <div
        className="flex min-h-svh flex-1 items-center justify-center text-muted-foreground"
        role="status"
      >
        <Loader2Icon className="size-5 animate-spin" />
        <span className="sr-only">Cargando…</span>
      </div>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AdminSidebar user={user} />
      <SidebarInset>
        <React.Suspense fallback={<SiteHeader title="" />}>
          <AdminHeader />
        </React.Suspense>
        <div className="flex flex-1 flex-col">
          <div className="@container/main mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
            {children}
          </div>
        </div>
      </SidebarInset>
      <Toaster position="top-center" />
    </SidebarProvider>
  )
}

function AdminHeader() {
  const pathname = usePathname()
  return <SiteHeader title={adminPageTitle(pathname)} section={pathname.startsWith("/admin/curaduria") ? "Calidad de datos" : undefined} />
}
