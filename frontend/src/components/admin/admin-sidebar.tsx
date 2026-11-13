"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  ChartNoAxesCombinedIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  UsersIcon,
} from "lucide-react"

import {
  OperationStatusBadge,
  useOperationStatus,
} from "@/components/admin/operation-status"
import { SidebarCredits } from "@/components/sidebar-credits"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { CurrentUser } from "@/lib/api"

export const adminNav = [
  { title: "Solicitudes de demo", url: "/admin/solicitudes", icon: InboxIcon },
  { title: "Usuarios", url: "/admin/usuarios", icon: UsersIcon },
  { title: "Curaduría", url: "/admin/curaduria", icon: ListChecksIcon },
  { title: "Operación", url: "/admin/operacion", icon: ActivityIcon },
]

export function adminPageTitle(pathname: string) {
  return (
    adminNav.find((item) => pathname.startsWith(item.url))?.title ??
    "Backoffice"
  )
}

export function AdminSidebar({
  user,
  ...props
}: { user: CurrentUser | null } & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/admin/solicitudes" />}
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-brand text-white">
                <ChartNoAxesCombinedIcon className="size-4" />
              </span>
              <span className="text-base font-semibold">PriceScope</span>
              <span className="ml-auto text-xs text-muted-foreground">
                Admin
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {/* The active item depends on the path, which is request data on
                dynamic routes; the fallback is the same menu, none active. */}
            <React.Suspense fallback={<AdminNavMenu pathname={null} />}>
              <ActiveAdminNavMenu />
            </React.Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user?.role === "admin" && (
          <SwitchAppLink
            href="/user/dashboard"
            title="Ir al dashboard"
            icon={LayoutDashboardIcon}
          />
        )}
        <SidebarCredits />
      </SidebarFooter>
    </Sidebar>
  )
}

// Jump between the backoffice (/admin) and the client app (/user). Callers
// only render it for admins.
export function SwitchAppLink({
  href,
  title,
  icon: Icon,
}: {
  href: string
  title: string
  icon: React.ComponentType
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={title} render={<Link href={href} />}>
          <Icon />
          <span>{title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function ActiveAdminNavMenu() {
  return <AdminNavMenu pathname={usePathname()} />
}

const OPERATION_URL = "/admin/operacion"

function AdminNavMenu({ pathname }: { pathname: string | null }) {
  // Scraper health at a glance next to "Operación" (see operation-status.tsx).
  const operation = useOperationStatus()
  return (
    <SidebarMenu>
      {adminNav.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            tooltip={
              item.url === OPERATION_URL && operation
                ? `${item.title} · ${operation.label}`
                : item.title
            }
            isActive={pathname?.startsWith(item.url) ?? false}
            render={<Link href={item.url} />}
            className="data-active:bg-brand/10 data-active:text-brand-deep dark:data-active:text-indigo-300"
          >
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
          {item.url === OPERATION_URL && operation && (
            <SidebarMenuBadge title={operation.label}>
              <OperationStatusBadge status={operation} />
            </SidebarMenuBadge>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
