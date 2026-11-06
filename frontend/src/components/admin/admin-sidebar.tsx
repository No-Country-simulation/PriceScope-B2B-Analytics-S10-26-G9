"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  ChartNoAxesCombinedIcon,
  EllipsisVerticalIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  LogOutIcon,
  UsersIcon,
} from "lucide-react"

import { InitialsAvatar } from "@/components/admin/tone"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { CurrentUser } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export const adminNav = [
  { title: "Solicitudes de demo", url: "/admin/solicitudes", icon: InboxIcon },
  { title: "Usuarios", url: "/admin/usuarios", icon: UsersIcon },
]

// Sections from E12 · Panel de administración v2, shown but not reachable yet.
const adminNavLater = [
  { title: "Curaduría", icon: ListChecksIcon },
  { title: "Operación", icon: ActivityIcon },
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
        <SidebarGroup>
          <SidebarGroupLabel>Próximamente</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavLater.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    disabled
                    aria-disabled
                    className="text-muted-foreground"
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>v2</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
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

function AdminNavMenu({ pathname }: { pathname: string | null }) {
  return (
    <SidebarMenu>
      {adminNav.map((item) => (
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
  )
}

export function AdminUserMenu({ user }: { user: CurrentUser }) {
  const { isMobile } = useSidebar()
  const { logout } = useAuth()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <InitialsAvatar name={user.name} className="size-8" />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-foreground/70">
                {user.email}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="grid px-1 py-1.5 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOutIcon />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
