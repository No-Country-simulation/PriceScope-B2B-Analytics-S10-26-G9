"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BellIcon,
  Grid3X3Icon,
  LayoutDashboardIcon,
  PackageIcon,
  PlusIcon,
  TrendingUpIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { formatArs } from "@/lib/format"
import { QUOTES, QUOTE_LABEL, type Quote } from "@/lib/quotes"
import { SessionTimeoutDialog } from "@/components/auth/session-timeout-dialog"

// Navegación del app cliente (mockup). Las rutas ya tienen pantalla: ver el
// README para el listado completo.
type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  badge?: string
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Análisis",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Matriz de precios", url: "/matriz", icon: Grid3X3Icon },
      { title: "Ficha de producto", url: "/producto", icon: PackageIcon },
    ],
  },
  {
    label: "Seguimiento",
    items: [
      { title: "Alertas", url: "/alertas", icon: BellIcon, badge: "3" },
      { title: "Nueva regla", url: "/regla-nueva", icon: PlusIcon },
    ],
  },
  {
    label: "Cuenta",
    items: [{ title: "Mi cuenta", url: "/cuenta", icon: UserIcon }],
  },
]

const USER = {
  initials: "LF",
  name: "Lucía Fernández",
  email: "lucia@andinoretail.com",
}

// Marco de las pantallas del app cliente: sidebar con las secciones del
// producto, header con la ruta, la cotización vigente y el usuario.
// Incluye el diálogo de sesión por vencer (UX03) tras inactividad.
const IDLE_TIMEOUT_MS = 25 * 60 * 1000 // 25 min — ajustar para pruebas

export function AppShell({
  section,
  title,
  quote,
  children,
}: {
  section: string
  title: string
  quote: Quote
  children: React.ReactNode
}) {
  const [showTimeout, setShowTimeout] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => setShowTimeout(true), IDLE_TIMEOUT_MS)
    }
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"]
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-6 md:h-[56px]">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <Separator orientation="vertical" className="h-4 data-vertical:self-auto" />
          <nav aria-label="Ruta" className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{section}</span>
            <span className="text-muted-foreground" aria-hidden="true">
              /
            </span>
            <span className="font-medium">{title}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="secondary"
              className="h-7 rounded-md px-2 font-mono text-[#3f3f46]"
            >
              {QUOTE_LABEL[quote]} {formatArs(QUOTES[quote])} · 06:00
            </Badge>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Notificaciones, 3 nuevas"
              nativeButton={false}
              render={<Link href="/alertas" />}
            >
              <BellIcon />
            </Button>
            <Avatar className="size-8">
              <AvatarFallback className="bg-[#e4e4e7] text-xs font-semibold">
                {USER.initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
      {showTimeout && (
        <SessionTimeoutDialog
          onExtend={() => setShowTimeout(false)}
          onLogout={() => {
            setShowTimeout(false)
            router.push("/ingresar?motivo=sesion-vencida")
          }}
        />
      )}
    </SidebarProvider>
  )
}

function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#18181b] text-[#fafafa]">
            <TrendingUpIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">PriceScope</span>
            <span className="text-xs text-muted-foreground">
              Grupo Andino Retail
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="h-auto px-2.5 pt-3 pb-1 text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                      className="h-[34px] rounded-lg px-2.5 text-[#3f3f46]"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="rounded-md bg-[#18181b] px-1.5 text-[#fafafa]">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 px-2 pt-4 pb-1.5 group-data-[collapsible=icon]:hidden">
          <Avatar className="size-8">
            <AvatarFallback className="bg-[#e4e4e7] text-xs font-semibold">
              {USER.initials}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{USER.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {USER.email}
            </span>
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
