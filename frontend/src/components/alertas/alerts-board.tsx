"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpIcon, PlusIcon } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatArs, formatPct, formatPP } from "@/lib/format"
import { QUOTES, QUOTE_LABEL } from "@/lib/quotes"
import { cn } from "@/lib/utils"

import { ALERTS, RULES, type AlertRule, type FiredAlert } from "./data"
import { RulesList } from "./rules-list"

// UX07 · Alertas: bandeja de alertas disparadas + detalle de la última, y el
// listado de reglas con activar/pausar y eliminar. Todo el estado vive acá y
// los datos son de muestra (components/alertas/data.ts): todavía no hay API.
export function AlertsBoard() {
  const [seen, setSeen] = React.useState<string[]>([])
  const [selectedId, setSelectedId] = React.useState(ALERTS[0].id)
  const [rules, setRules] = React.useState<AlertRule[]>(() =>
    RULES.map((rule) => ({ ...rule }))
  )

  const selected = ALERTS.find((alert) => alert.id === selectedId) ?? ALERTS[0]
  const unseenIds = ALERTS.filter(
    (alert) => alert.isNew && !seen.includes(alert.id)
  ).map((alert) => alert.id)

  function markAllSeen() {
    setSeen(ALERTS.map((alert) => alert.id))
  }

  function toggleRule(id: string) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === id ? { ...rule, active: !rule.active } : rule
      )
    )
  }

  function deleteRule(id: string) {
    setRules((current) => current.filter((rule) => rule.id !== id))
  }

  return (
    <>
      <PageHeader
        title="Alertas"
        description="Te avisamos cuando un producto o categoría sube más que la devaluación."
        badge={
          <ToneBadge tone="neutral" className="font-mono">
            {QUOTE_LABEL.blue} {formatArs(QUOTES.blue)} · 06:00
          </ToneBadge>
        }
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/user/regla-nueva" />}
          >
            <PlusIcon data-icon="inline-start" />
            Nueva regla
          </Button>
        }
      />

      <Tabs defaultValue="fired" className="gap-4">
        <TabsList>
          <TabsTrigger value="fired">
            Alertas disparadas
            <Badge>{unseenIds.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rules">
            Mis reglas
            <Badge variant="secondary">{rules.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fired" className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row">
            <Inbox
              alerts={ALERTS}
              unseenIds={unseenIds}
              selectedId={selected.id}
              onPick={setSelectedId}
              onMarkAllSeen={markAllSeen}
            />
            <AlertDetail alert={selected} />
          </div>
        </TabsContent>

        <TabsContent value="rules" className="flex flex-col gap-4">
          <RulesList
            rules={rules}
            onToggle={toggleRule}
            onDelete={deleteRule}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

function Inbox({
  alerts,
  unseenIds,
  selectedId,
  onPick,
  onMarkAllSeen,
}: {
  alerts: FiredAlert[]
  unseenIds: string[]
  selectedId: string
  onPick: (id: string) => void
  onMarkAllSeen: () => void
}) {
  return (
    <Card className="min-w-0 flex-1 basis-[340px] gap-0 py-0 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <h3 className="text-sm font-semibold">Bandeja</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAllSeen}
          disabled={unseenIds.length === 0}
        >
          Marcar todas como vistas
        </Button>
      </div>
      <div className="flex flex-col">
        {alerts.map((alert) => {
          const unseen = unseenIds.includes(alert.id)
          const selected = alert.id === selectedId
          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => onPick(alert.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex w-full gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",
                selected && "bg-muted hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  unseen ? "bg-destructive" : "bg-border"
                )}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm",
                      unseen ? "font-semibold" : "font-medium"
                    )}
                  >
                    {alert.rule}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {alert.firedAt}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {alert.scope}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <ToneBadge tone="neutral">
                    {alert.products} productos
                  </ToneBadge>
                  {unseen && <ToneBadge tone="sky">Nueva</ToneBadge>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function AlertDetail({ alert }: { alert: FiredAlert }) {
  const gap = alert.average - alert.devaluation

  return (
    <Card className="min-w-0 flex-[2] basis-[520px] gap-0 py-0 shadow-xs">
      <div className="flex flex-col gap-3.5 border-b p-5">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {alert.firedAt}
            </span>
            <h3 className="text-lg font-semibold tracking-tight">
              {alert.rule}
            </h3>
            <p className="text-sm text-muted-foreground">{alert.phrase}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/user/regla-nueva" />}
            >
              Editar regla
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/user/dashboard" />}
            >
              Ver en dashboard
            </Button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <Stat label="Devaluación del período" value={formatPct(alert.devaluation)} />
          <Stat label="Suba promedio" value={formatPct(alert.average)} />
          <Stat
            label="Diferencia"
            value={formatPP(gap)}
            up
          />
        </div>
      </div>

      <Table
        aria-label="Productos que dispararon la alerta"
        className="min-w-[640px]"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Producto que la disparó</TableHead>
            <TableHead>Tienda</TableHead>
            <TableHead className="text-right">Variación</TableHead>
            <TableHead className="text-right">Devaluación</TableHead>
            <TableHead className="pr-5 text-right">Diferencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alert.items.map((item) => (
            <TableRow key={`${alert.id}-${item.product}`}>
              <TableCell className="py-2.5 pl-5 align-top">
                <Link
                  href="/user/producto"
                  className="flex flex-col font-medium underline-offset-4 hover:underline"
                >
                  {item.product}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {item.category}
                </span>
              </TableCell>
              <TableCell className="py-2.5 align-top">{item.store}</TableCell>
              <TableCell className="py-2.5 text-right align-top font-mono tabular-nums">
                {formatPct(item.variation)}
              </TableCell>
              <TableCell className="py-2.5 text-right align-top font-mono tabular-nums text-muted-foreground">
                {formatPct(alert.devaluation)}
              </TableCell>
              <TableCell className="py-2.5 pr-5 text-right align-top">
                <ToneBadge tone="red" className="font-mono">
                  <ArrowUpIcon />
                  {formatPP(item.variation - alert.devaluation)}
                </ToneBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function Stat({
  label,
  value,
  up = false,
}: {
  label: string
  value: string
  up?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        up
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
          : "text-foreground"
      )}
    >
      <span
        className={cn(
          "text-xs",
          up
            ? "text-red-700 dark:text-red-400"
            : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-1 font-mono text-xl font-semibold tabular-nums">
        {up && <ArrowUpIcon className="size-4" aria-hidden="true" />}
        {value}
      </span>
    </div>
  )
}
