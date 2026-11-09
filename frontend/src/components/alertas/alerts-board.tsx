"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpIcon,
  BellRingIcon,
  CheckCheckIcon,
  ChartNoAxesCombinedIcon,
  InboxIcon,
  ListChecksIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  ZapIcon,
} from "lucide-react"

import { KpiCard } from "@/components/admin/kpi-card"
import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge } from "@/components/admin/tone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPct, formatPP } from "@/lib/format"
import { cn } from "@/lib/utils"

import { productHref } from "@/components/producto/data"

import { ALERTS, RULES, type AlertRule, type FiredAlert } from "./data"
import { RulesList } from "./rules-list"

// UX07 · Alertas: KPIs, bandeja de alertas disparadas + detalle de la elegida,
// y el listado de reglas con activar/pausar y eliminar. Todo el estado vive
// acá y los datos son de muestra (components/alertas/data.ts): no hay API.
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
  const activeRules = rules.filter((rule) => rule.active).length
  const affected = ALERTS.reduce((sum, alert) => sum + alert.products, 0)
  const worstGap = Math.max(
    ...ALERTS.map((alert) => alert.average - alert.devaluation)
  )

  // Como en la maqueta: abrir una alerta en el detalle ya la deja por vista.
  function pickAlert(id: string) {
    setSelectedId(id)
    setSeen((current) => (current.includes(id) ? current : [...current, id]))
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
        actions={
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/user/regla-nueva" />}
          >
            <PlusIcon data-icon="inline-start" />
            Nueva regla
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <KpiCard
          label="Sin ver"
          value={String(unseenIds.length)}
          hint={`De ${ALERTS.length} alertas disparadas en la bandeja`}
          tone="red"
          icon={<BellRingIcon />}
        />
        <KpiCard
          label="Reglas activas"
          value={`${activeRules} de ${rules.length}`}
          hint="Las pausadas no disparan alertas"
          tone="emerald"
          icon={<ZapIcon />}
        />
        <KpiCard
          label="Productos afectados"
          value={String(affected)}
          hint="Sumando todas las alertas de la bandeja"
          tone="amber"
          icon={<PackageIcon />}
        />
        <KpiCard
          label="Mayor diferencia"
          value={`+${formatPP(worstGap)}`}
          hint="Suba promedio por encima del dólar"
          tone="brand"
          icon={<ChartNoAxesCombinedIcon />}
          mono
        />
      </div>

      <Tabs defaultValue="fired" className="gap-4">
        <TabsList>
          <TabsTrigger value="fired">
            <InboxIcon />
            Alertas disparadas
            {unseenIds.length > 0 && (
              <Badge variant="destructive" className="tabular-nums">
                {unseenIds.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ListChecksIcon />
            Mis reglas
            <Badge variant="secondary" className="tabular-nums">
              {rules.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="fired"
          className="grid items-start gap-4 @5xl/main:grid-cols-[360px_1fr]"
        >
          <Inbox
            alerts={ALERTS}
            unseenIds={unseenIds}
            selectedId={selected.id}
            onPick={pickAlert}
            onMarkAllSeen={() => setSeen(ALERTS.map((alert) => alert.id))}
          />
          <AlertDetail alert={selected} />
        </TabsContent>

        <TabsContent value="rules">
          <RulesList rules={rules} onToggle={toggleRule} onDelete={deleteRule} />
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
    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle>
          <h3>Bandeja</h3>
        </CardTitle>
        <CardDescription>
          {unseenIds.length === 0
            ? "Estás al día"
            : `${unseenIds.length} ${unseenIds.length === 1 ? "alerta sin ver" : "alertas sin ver"}`}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllSeen}
            disabled={unseenIds.length === 0}
          >
            <CheckCheckIcon data-icon="inline-start" />
            Marcar vistas
          </Button>
        </CardAction>
      </CardHeader>
      {/* Con muchas alertas la bandeja scrollea adentro de su card. */}
      <ItemGroup className="max-h-[34rem] gap-1 overflow-y-auto p-2">
        {alerts.map((alert) => {
          const unseen = unseenIds.includes(alert.id)
          const active = alert.id === selectedId
          return (
            <Item
              key={alert.id}
              size="sm"
              render={<button type="button" />}
              onClick={() => onPick(alert.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "items-start text-left hover:bg-muted/50",
                active && "bg-muted hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  unseen ? "bg-destructive" : "bg-border"
                )}
                aria-hidden="true"
              />
              <ItemContent className="min-w-0">
                <ItemTitle
                  className={cn(
                    "w-full justify-between",
                    unseen ? "font-semibold" : "font-medium"
                  )}
                >
                  <span className="truncate">{alert.rule}</span>
                  <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground tabular-nums">
                    {alert.firedAt.slice(0, 5)} · {alert.firedAt.slice(11)}
                  </span>
                </ItemTitle>
                <ItemDescription className="line-clamp-1">
                  {alert.scope}
                </ItemDescription>
                <span className="flex flex-wrap gap-1.5 pt-0.5">
                  <ToneBadge tone="neutral">{alert.products} productos</ToneBadge>
                  {unseen && <ToneBadge tone="sky">Nueva</ToneBadge>}
                </span>
              </ItemContent>
            </Item>
          )
        })}
      </ItemGroup>
    </Card>
  )
}

function AlertDetail({ alert }: { alert: FiredAlert }) {
  const gap = alert.average - alert.devaluation

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardDescription className="font-mono text-xs tabular-nums">
          {alert.firedAt}
        </CardDescription>
        <CardTitle className="text-lg tracking-tight">
          <h3>{alert.rule}</h3>
        </CardTitle>
        <CardAction className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/user/regla-nueva" />}
          >
            <PencilIcon data-icon="inline-start" />
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
        </CardAction>
        <p className="col-span-full text-sm text-muted-foreground">
          {alert.phrase}
        </p>
      </CardHeader>

      <dl className="grid divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="Devaluación del período" value={formatPct(alert.devaluation)} />
        <Stat label="Suba promedio" value={formatPct(alert.average)} />
        <Stat
          label="Diferencia"
          value={
            <ToneBadge tone="red" className="h-7 px-2.5 font-mono text-base">
              <ArrowUpIcon />
              {formatPP(gap)}
            </ToneBadge>
          }
        />
      </dl>

      <Table
        aria-label="Productos que dispararon la alerta"
        className="min-w-[640px]"
      >
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-(--card-spacing)">
              Producto que la disparó
            </TableHead>
            <TableHead>Tienda</TableHead>
            <TableHead className="text-right">Variación</TableHead>
            <TableHead className="text-right">Devaluación</TableHead>
            <TableHead className="pr-(--card-spacing) text-right">
              Diferencia
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alert.items.map((item) => (
            <TableRow key={`${alert.id}-${item.product}`}>
              <TableCell className="py-3 pl-(--card-spacing)">
                <Link
                  href={productHref(item.product)}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {item.product}
                </Link>
                <div className="text-muted-foreground">{item.category}</div>
              </TableCell>
              <TableCell>{item.store}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatPct(item.variation)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                {formatPct(alert.devaluation)}
              </TableCell>
              <TableCell className="pr-(--card-spacing) text-right">
                <ToneBadge tone="red" className="ml-auto font-mono">
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-(--card-spacing) py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex h-7 items-center font-mono text-xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  )
}
