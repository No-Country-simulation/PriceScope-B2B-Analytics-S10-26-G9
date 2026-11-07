"use client"

import Link from "next/link"
import { BellIcon } from "lucide-react"

import { InitialsAvatar, ToneBadge } from "@/components/admin/tone"
import { ALERTS } from "@/components/alertas/data"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { formatArs } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SNAPSHOT_QUOTES } from "./data"

// Mismas alertas de muestra que UX07; no consulta ni modifica el backend.
export function DashboardHeaderActions() {
  const { user } = useAuth()
  const newCount = ALERTS.filter((alert) => alert.isNew).length

  return <>
    <span className="hidden lg:inline-flex" title="Cotización oficial al 29/10/2026">
      <ToneBadge tone="neutral" className="h-7 font-mono">Oficial {formatArs(SNAPSHOT_QUOTES.oficial)}</ToneBadge>
    </span>
    <span className="hidden sm:inline-flex" title="Cotización blue al 29/10/2026 06:00">
      <ToneBadge tone="neutral" className="h-7 font-mono">Blue {formatArs(SNAPSHOT_QUOTES.blue)} · 06:00</ToneBadge>
    </span>

    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={`Notificaciones, ${newCount} nuevas`}>
        <BellIcon />
        {newCount > 0 && <span className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white" aria-hidden="true">{newCount}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2">
            <span className="flex items-center justify-between gap-2 text-sm text-foreground">
              Notificaciones<ToneBadge tone="neutral">{newCount} nuevas</ToneBadge>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <div className="px-3 pb-2 text-xs text-muted-foreground lg:hidden">
          Oficial {formatArs(SNAPSHOT_QUOTES.oficial)} · Blue {formatArs(SNAPSHOT_QUOTES.blue)} · 06:00
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {ALERTS.map((alert) => <DropdownMenuItem key={alert.id}
            render={<Link href="/user/alertas" />} className="items-start gap-3 px-3 py-3">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", alert.isNew ? "bg-destructive" : "bg-border")} aria-hidden="true" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={cn("text-sm", alert.isNew ? "font-semibold" : "text-muted-foreground")}>{alert.rule}</span>
              <span className="text-xs text-muted-foreground">{alert.products} productos · {alert.firedAt}</span>
            </span>
          </DropdownMenuItem>)}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/user/alertas" />} className="justify-center py-2 font-medium">
          Ver todas las alertas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {user ? <span title={`${user.name} · ${user.email}`} aria-label={`Sesión de ${user.name}`}>
      <InitialsAvatar name={user.name} className="size-8" />
    </span> : <Skeleton className="size-8 rounded-full" />}
  </>
}
