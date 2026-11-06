"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BellIcon,
  ChartNoAxesCombinedIcon,
  Grid3X3Icon,
  LayoutDashboardIcon,
  PackageIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { AdminUserMenu, SwitchAppLink } from "@/components/admin/admin-sidebar"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { CurrentUser } from "@/lib/api"

export const clientNav = [
  {
    label: "Análisis",
    items: [
      { title: "Dashboard", url: "/user/dashboard", icon: LayoutDashboardIcon },
      { title: "Matriz de precios", url: "/user/matriz", icon: Grid3X3Icon },
      { title: "Ficha de producto", url: "/user/producto", icon: PackageIcon },
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

export function clientPageTitle(pathname: string) {
  return (
    clientNav
      .flatMap((group) => group.items)
      .find((item) => pathname.startsWith(item.url))?.title ??
    "PriceScope"
  )
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
        {user ? (
          <AdminUserMenu user={user} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              {/* Not SidebarMenuSkeleton: its random width breaks hydration. */}
              <div className="flex h-12 items-center gap-2 p-2">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-4 flex-1" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
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
                isActive={pathname?.startsWith(item.url) ?? false}
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
