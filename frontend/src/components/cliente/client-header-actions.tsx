"use client"

import Link from "next/link"
import { BellIcon, ChevronsUpDownIcon, LogOutIcon, UserIcon } from "lucide-react"

import { InitialsAvatar, ToneBadge } from "@/components/admin/tone"
import { ALERTS } from "@/components/alertas/data"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

// Right side of the client header: notifications and the account menu.
// Las alertas son las mismas de muestra que UX07; no consulta el backend.
export function ClientHeaderActions() {
  return (
    <>
      <NotificationsMenu />
      <Separator
        orientation="vertical"
        className="mx-1 h-6 data-vertical:self-auto"
      />
      <UserMenu />
    </>
  )
}

function NotificationsMenu() {
  const newCount = ALERTS.filter((alert) => alert.isNew).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={`Notificaciones, ${newCount} nuevas`}
      >
        <BellIcon />
        {newCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
            aria-hidden="true"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2">
            <span className="flex items-center justify-between gap-2 text-sm text-foreground">
              Notificaciones
              <ToneBadge tone="neutral">{newCount} nuevas</ToneBadge>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {ALERTS.map((alert) => (
            <DropdownMenuItem
              key={alert.id}
              render={<Link href="/user/alertas" />}
              className="items-start gap-3 px-3 py-3"
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  alert.isNew ? "bg-destructive" : "bg-border"
                )}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span
                  className={cn(
                    "text-sm",
                    alert.isNew ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {alert.rule}
                </span>
                <span className="text-xs text-muted-foreground">
                  {alert.products} productos · {alert.firedAt}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/user/alertas" />}
          className="justify-center py-2 font-medium"
        >
          Ver todas las alertas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()

  if (!user) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="hidden h-4 w-24 md:block" />
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto gap-2 px-2 py-1.5 aria-expanded:bg-muted"
          />
        }
        aria-label={`Cuenta de ${user.name}`}
      >
        <InitialsAvatar name={user.name} className="size-8" />
        <span className="hidden min-w-0 flex-col text-left leading-tight md:flex">
          <span className="max-w-40 truncate text-sm font-medium">
            {user.name}
          </span>
          <span className="max-w-40 truncate text-xs font-normal text-muted-foreground">
            {user.company}
          </span>
        </span>
        <ChevronsUpDownIcon className="hidden size-4 text-muted-foreground md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <InitialsAvatar name={user.name} className="size-8" />
              <div className="grid min-w-0 text-left text-sm leading-tight">
                <span className="truncate font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/user/perfil" />}>
          <UserIcon />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOutIcon />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
