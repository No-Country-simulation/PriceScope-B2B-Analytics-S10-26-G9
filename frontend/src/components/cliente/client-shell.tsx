"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import {
  ClientSidebar,
  clientPage,
} from "@/components/cliente/client-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ClientHeaderActions } from "@/components/cliente/client-header-actions"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { SESSION_EXPIRED_PARAM, useAuth } from "@/lib/auth"
import { RatesProvider } from "@/lib/rates"

// Client-side guard for the client app (/user), same shape as AdminShell.
// Any logged-in user may enter, admins included; only a missing session is
// sent to the login. The backend still has to enforce access to real data.
export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { status, user, expired, sessionNotice } = useAuth()

  React.useEffect(() => {
    if (status === "anonymous") {
      const next = `next=${encodeURIComponent(window.location.pathname)}`
      router.replace(
        sessionNotice
          ? `/ingresar?motivo=${sessionNotice}&${next}`
          : expired
          ? `/ingresar?${SESSION_EXPIRED_PARAM}&${next}`
          : `/ingresar?${next}`
      )
    }
  }, [status, expired, sessionNotice, router])

  // While the session is being restored the shell renders as usual; only a
  // missing session blocks the page.
  if (status === "anonymous") {
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
    <RatesProvider>
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 16)",
        } as React.CSSProperties
      }
    >
      <ClientSidebar user={user} />
      <SidebarInset>
        <React.Suspense fallback={<SiteHeader title=""><ClientHeaderActions /></SiteHeader>}>
          <ClientHeader />
        </React.Suspense>
        <div className="flex flex-1 flex-col">
          <div className="@container/main mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
            {children}
          </div>
        </div>
      </SidebarInset>
      <Toaster position="top-center" />
    </SidebarProvider>
    </RatesProvider>
  )
}

function ClientHeader() {
  const pathname = usePathname()
  const { title, section } = clientPage(pathname)
  return (
    <SiteHeader title={title} section={section}>
      <ClientHeaderActions />
    </SiteHeader>
  )
}
