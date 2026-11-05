"use client"

import * as React from "react"
import {
  BellIcon,
  BellRingIcon,
  CheckCheckIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  ALERT_TYPE_LABELS,
  ALERT_TYPE_TONES,
  ALERTS,
  STATUS_LABELS,
  STATUS_TONES,
  type AlertStatus,
  type AlertType,
} from "./data"

const QUOTE = "blue" as const

const typeItems = [
  { label: "Todos", value: "all" },
  ...Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => ({ label, value })),
]

const statusItems = [
  { label: "Todos", value: "all" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
]

// Pantalla UX07 · Alertas. Lista las alertas del mercado: subas de precio,
// reduflación, promociones y reapariciones de productos. Maqueta local, sin
// llamadas a la API.
export function AlertsScreen() {
  const [search, setSearch] = React.useState("")
  const [type, setType] = React.useState<AlertType | "all">("all")
  const [status, setStatus] = React.useState<AlertStatus | "all">("all")
  const [alerts, setAlerts] = React.useState(ALERTS)

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return alerts.filter((alert) => {
      if (type !== "all" && alert.type !== type) return false
      if (status !== "all" && alert.status !== status) return false
      if (
        term &&
        !alert.product.toLowerCase().includes(term) &&
        !alert.store.toLowerCase().includes(term) &&
        !alert.message.toLowerCase().includes(term)
      ) {
        return false
      }
      return true
    })
  }, [alerts, search, type, status])

  const hasFilters = search !== "" || type !== "all" || status !== "all"
  const newCount = alerts.filter((a) => a.new).length
  const activeCount = alerts.filter((a) => a.status === "active").length
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length

  function acknowledge(id: string) {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "acknowledged" as AlertStatus, new: false }
          : a
      )
    )
  }

  function resolve(id: string) {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "resolved" as AlertStatus, new: false }
          : a
      )
    )
  }

  function acknowledgeAll() {
    setAlerts((prev) =>
      prev.map((a) =>
        a.status === "active"
          ? { ...a, status: "acknowledged" as AlertStatus, new: false }
          : a
      )
    )
  }

  function clearFilters() {
    setSearch("")
    setType("all")
    setStatus("all")
  }

  return (
    <AppShell section="Seguimiento" title="Alertas" quote={QUOTE}>
      <div className="flex w-full max-w-[1280px] flex-col gap-6 p-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-tight">Alertas</h1>
              {newCount > 0 && (
                <Badge className="rounded-md bg-brand px-2 text-white">
                  {newCount} {newCount === 1 ? "nueva" : "nuevas"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Subas de precio, reduflación, promociones y productos que
              reaparecieron.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-9"
            onClick={acknowledgeAll}
            disabled={activeCount === 0}
          >
            <CheckCheckIcon data-icon="inline-start" />
            Marcar todas como vistas
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
          <Card className="@container/card shadow-xs">
            <CardHeader>
              <CardDescription>Activas</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {activeCount}
              </CardTitle>
              <CardAction>
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#fef2f2] text-[#b91c1c]">
                  <BellRingIcon />
                </span>
              </CardAction>
            </CardHeader>
          </Card>
          <Card className="@container/card shadow-xs">
            <CardHeader>
              <CardDescription>Nuevas sin leer</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {newCount}
              </CardTitle>
              <CardAction>
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#f5f3ff] text-[#6d28d9]">
                  <BellIcon />
                </span>
              </CardAction>
            </CardHeader>
          </Card>
          <Card className="@container/card shadow-xs">
            <CardHeader>
              <CardDescription>Resueltas</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {resolvedCount}
              </CardTitle>
              <CardAction>
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#f0fdf4] text-[#15803d]">
                  <CheckCheckIcon />
                </span>
              </CardAction>
            </CardHeader>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Label htmlFor="alerts-search" className="sr-only">
              Buscar alerta
            </Label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="alerts-search"
              type="search"
              placeholder="Buscar por producto, tienda o mensaje"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Label htmlFor="alerts-type" className="sr-only">
            Tipo
          </Label>
          <Select
            items={typeItems}
            value={type}
            onValueChange={(v) => setType((v ?? "all") as AlertType | "all")}
          >
            <SelectTrigger id="alerts-type" className="h-9 w-44">
              <span className="text-muted-foreground">Tipo:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Label htmlFor="alerts-status" className="sr-only">
            Estado
          </Label>
          <Select
            items={statusItems}
            value={status}
            onValueChange={(v) => setStatus((v ?? "all") as AlertStatus | "all")}
          >
            <SelectTrigger id="alerts-status" className="h-9 w-36">
              <span className="text-muted-foreground">Estado:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla de alertas */}
        <Card className="overflow-hidden py-0 shadow-xs">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-4">Tipo</TableHead>
                <TableHead className="px-4">Producto</TableHead>
                <TableHead className="px-4">Tienda</TableHead>
                <TableHead className="px-4">Mensaje</TableHead>
                <TableHead className="px-4">Detectada</TableHead>
                <TableHead className="px-4">Estado</TableHead>
                <TableHead className="px-4 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <TriangleAlertIcon className="size-6" />
                      {hasFilters ? (
                        <>
                          <p>Ninguna alerta coincide con la búsqueda.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                          >
                            Limpiar filtros
                          </Button>
                        </>
                      ) : (
                        <p>No hay alertas para mostrar.</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((alert) => (
                  <TableRow
                    key={alert.id}
                    data-state={alert.new ? "selected" : undefined}
                    className={cn(alert.new && "bg-brand/5")}
                  >
                    <TableCell className="px-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-[22px] rounded-md",
                          ALERT_TYPE_TONES[alert.type]
                        )}
                      >
                        {ALERT_TYPE_LABELS[alert.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alert.product}</span>
                        {alert.new && (
                          <Badge className="rounded-md bg-brand px-1.5 text-[10px] text-white">
                            Nueva
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {alert.cat}
                      </span>
                    </TableCell>
                    <TableCell className="px-4">{alert.store}</TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">
                      {alert.message}
                    </TableCell>
                    <TableCell className="px-4 tabular-nums text-muted-foreground">
                      {new Date(alert.triggered_at).toLocaleString("es-AR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-[22px] rounded-md",
                          STATUS_TONES[alert.status]
                        )}
                      >
                        {STATUS_LABELS[alert.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {alert.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledge(alert.id)}
                          >
                            Vista
                          </Button>
                        )}
                        {alert.status !== "resolved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolve(alert.id)}
                          >
                            Resolver
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  )
}
