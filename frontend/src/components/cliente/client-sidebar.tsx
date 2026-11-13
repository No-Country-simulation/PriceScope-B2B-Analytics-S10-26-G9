"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BellIcon,
  ChartNoAxesCombinedIcon,
  Grid3X3Icon,
  LayoutDashboardIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { SwitchAppLink } from "@/components/admin/admin-sidebar"
import { SidebarCredits } from "@/components/sidebar-credits"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { QuotesCard } from "@/components/cliente/quotes-card"
import type { CurrentUser } from "@/lib/api"

export const clientNav = [
  {
    label: "Análisis",
    items: [
      { title: "Dashboard", url: "/user/dashboard", icon: LayoutDashboardIcon },
      {
        title: "Matriz de precios",
        url: "/user/matriz",
        icon: Grid3X3Icon,
        // La ficha de producto se abre desde la matriz y la deja marcada.
        also: ["/user/producto"],
      },
    ],
  },
  {
    label: "Seguimiento",
    items: [
      { title: "Alertas", url: "/user/alertas", icon: BellIcon },
      { title: "Nueva regla", url: "/user/regla-nueva", icon: PlusIcon },
    ],
  },
]

// Pantallas fuera del menú: título y miga de pan propios.
const extraPages = [
  { url: "/user/producto", title: "Ficha de producto", section: "Matriz de precios" },
  { url: "/user/perfil", title: "Mi cuenta", section: "Cuenta" },
]

export function clientPage(pathname: string): { title: string; section?: string } {
  const extra = extraPages.find((page) => pathname.startsWith(page.url))
  if (extra) return extra
  for (const group of clientNav) {
    const item = group.items.find((entry) => pathname.startsWith(entry.url))
    if (item) return { title: item.title, section: group.label }
  }
  return { title: "PriceScope" }
}

export function ClientSidebar({
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
              render={<Link href="/user" />}
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-brand text-white">
                <ChartNoAxesCombinedIcon className="size-4" />
              </span>
              <span className="text-base font-semibold">PriceScope</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* The active item depends on the path, which is request data on
            dynamic routes; the fallback is the same menu, none active. */}
        <React.Suspense fallback={<ClientNavGroups pathname={null} />}>
          <ActiveClientNavGroups />
        </React.Suspense>
      </SidebarContent>
      <SidebarFooter>
        {user?.role === "admin" && (
          <SwitchAppLink
            href="/admin"
            title="Ir al backoffice"
            icon={ShieldCheckIcon}
          />
        )}
        <QuotesCard />
        <SidebarCredits />
      </SidebarFooter>
    </Sidebar>
  )
}

function ActiveClientNavGroups() {
  return <ClientNavGroups pathname={usePathname()} />
}

function ClientNavGroups({ pathname }: { pathname: string | null }) {
  return clientNav.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={
                  pathname != null &&
                  [item.url, ...(("also" in item && item.also) || [])].some((url) =>
                    pathname.startsWith(url)
                  )
                }
                render={<Link href={item.url} />}
                className="data-active:bg-brand/10 data-active:text-brand-deep dark:data-active:text-indigo-300"
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}
