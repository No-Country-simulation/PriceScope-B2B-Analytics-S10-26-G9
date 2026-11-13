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
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AlertRule, AlertsSummary, FiredAlert, FiredAlertDetail, Page } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { CATEGORY_LABEL } from "@/lib/categories"
import { formatCount, formatDateTime, formatPct, formatPP } from "@/lib/format"
import { notifyAlertsChanged, useApi, useOnAlertsChanged } from "@/lib/use-api"
import { cn } from "@/lib/utils"

import { RulesList } from "./rules-list"

const INBOX_SIZE = 50

// UX07 · Alertas: KPIs, bandeja de alertas disparadas + detalle de la elegida,
// y el listado de reglas con activar/pausar y eliminar.
export function AlertsBoard() {
  const { request } = useAuth()
  const summary = useApi<AlertsSummary>("/alerts/summary")
  const inbox = useApi<Page<FiredAlert>>(`/alerts?size=${INBOX_SIZE}`)
  const rules = useApi<AlertRule[]>("/alert-rules")
  const [pickedId, setPickedId] = React.useState<string | null>(null)

  const alerts = inbox.data?.items ?? []
  const selectedId = pickedId ?? alerts[0]?.id ?? null
  const detail = useApi<FiredAlertDetail>(selectedId ? `/alerts/${selectedId}` : null)

  const { reload: reloadSummary } = summary
  const { reload: reloadInbox } = inbox
  const reloadAlerts = React.useCallback(() => {
    reloadSummary()
    reloadInbox()
  }, [reloadSummary, reloadInbox])
  useOnAlertsChanged(reloadAlerts)

  async function changed(action: Promise<unknown>, error: string) {
    try {
      await action
    } catch {
      toast.error(error)
    }
    reloadAlerts()
    rules.reload()
    notifyAlertsChanged()
  }

  // Como en la maqueta: abrir una alerta en el detalle ya la deja por vista.
  function pickAlert(alert: FiredAlert) {
    setPickedId(alert.id)
    if (!alert.seen) {
      void changed(
        request(`/alerts/${alert.id}/seen`, { method: "POST" }),
        "No pudimos marcar la alerta como vista."
      )
    }
  }

  function markAllSeen() {
    void changed(
      request("/alerts/seen", { method: "POST" }),
      "No pudimos marcar las alertas como vistas."
    )
  }

  function toggleRule(rule: AlertRule) {
    void changed(
      request(`/alert-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active }),
      }),
      "No pudimos cambiar la regla."
    )
  }

  function deleteRule(rule: AlertRule) {
    void changed(
      request(`/alert-rules/${rule.id}`, { method: "DELETE" }).then(() =>
        toast.success("Regla eliminada")
      ),
      "No pudimos eliminar la regla."
    )
    if (detail.data?.rule_id === rule.id) setPickedId(null)
  }

  const kpis = summary.data
  const unseen = kpis?.unseen ?? alerts.filter((alert) => !alert.seen).length
  const gap = kpis?.max_gap_pp == null ? null : Number(kpis.max_gap_pp)

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
        {kpis ? (
          <>
            <KpiCard
              label="Sin ver"
              value={String(kpis.unseen)}
              hint={`De ${kpis.total} alertas disparadas en la bandeja`}
              tone="red"
              icon={<BellRingIcon />}
            />
            <KpiCard
              label="Reglas activas"
              value={`${kpis.active_rules} de ${kpis.rules}`}
              hint="Las pausadas no disparan alertas"
              tone="emerald"
              icon={<ZapIcon />}
            />
            <KpiCard
              label="Productos afectados"
              value={formatCount(kpis.affected_products)}
              hint="En las alertas de los últimos 30 días"
              tone="amber"
              icon={<PackageIcon />}
            />
            <KpiCard
              label="Mayor diferencia"
              value={gap === null ? "—" : `+${formatPP(gap)}`}
              hint="Suba promedio por encima del dólar, últimos 30 días"
              tone="brand"
              icon={<ChartNoAxesCombinedIcon />}
              mono
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        )}
      </div>

      <Tabs defaultValue="fired" className="gap-4">
        <TabsList>
          <TabsTrigger value="fired">
            <InboxIcon />
            Alertas disparadas
            {unseen > 0 && (
              <Badge variant="destructive" className="tabular-nums">
                {unseen}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ListChecksIcon />
            Mis reglas
            {rules.data && (
              <Badge variant="secondary" className="tabular-nums">
                {rules.data.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="fired"
          className="grid items-start gap-4 @5xl/main:grid-cols-[360px_1fr]"
        >
          {inbox.error ? (
            <EmptyCard className="@5xl/main:col-span-2">
              No pudimos cargar las alertas. Probá de nuevo en unos minutos.
            </EmptyCard>
          ) : !inbox.data ? (
            <>
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </>
          ) : alerts.length === 0 ? (
            <EmptyCard className="@5xl/main:col-span-2">
              Todavía no se disparó ninguna alerta. Revisamos tus reglas todos
              los días a las 07:30.
            </EmptyCard>
          ) : (
            <>
              <Inbox
                alerts={alerts}
                total={inbox.data.total}
                unseen={unseen}
                selectedId={selectedId}
                onPick={pickAlert}
                onMarkAllSeen={markAllSeen}
              />
              {detail.data && detail.data.id === selectedId ? (
                <AlertDetail alert={detail.data} />
              ) : detail.error ? (
                <EmptyCard>No pudimos cargar el detalle de la alerta.</EmptyCard>
              ) : (
                <Skeleton className="h-96 rounded-xl" />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="rules">
          {rules.data ? (
            <RulesList rules={rules.data} onToggle={toggleRule} onDelete={deleteRule} />
          ) : rules.error ? (
            <EmptyCard>No pudimos cargar tus reglas.</EmptyCard>
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

function EmptyCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground shadow-xs", className)}>
      <InboxIcon className="size-6" />
      <p>{children}</p>
    </Card>
  )
}

function Inbox({
  alerts,
  total,
  unseen,
  selectedId,
  onPick,
  onMarkAllSeen,
}: {
  alerts: FiredAlert[]
  total: number
  unseen: number
  selectedId: string | null
  onPick: (alert: FiredAlert) => void
  onMarkAllSeen: () => void
}) {
  return (
    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle>
          <h3>Bandeja</h3>
        </CardTitle>
        <CardDescription>
          {unseen === 0
            ? "Estás al día"
            : `${unseen} ${unseen === 1 ? "alerta sin ver" : "alertas sin ver"}`}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllSeen}
            disabled={unseen === 0}
          >
            <CheckCheckIcon data-icon="inline-start" />
            Marcar vistas
          </Button>
        </CardAction>
      </CardHeader>
      {/* Con muchas alertas la bandeja scrollea adentro de su card. */}
      <ItemGroup className="max-h-[34rem] gap-1 overflow-y-auto p-2">
        {alerts.map((alert) => {
          const active = alert.id === selectedId
          return (
            <Item
              key={alert.id}
              size="sm"
              render={<button type="button" />}
              onClick={() => onPick(alert)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "items-start text-left hover:bg-muted/50",
                active && "bg-muted hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  alert.seen ? "bg-border" : "bg-destructive"
                )}
                aria-hidden="true"
              />
              <ItemContent className="min-w-0">
                <ItemTitle
                  className={cn(
                    "w-full justify-between",
                    alert.seen ? "font-medium" : "font-semibold"
                  )}
                >
                  <span className="truncate">{alert.rule_name}</span>
                  <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground tabular-nums">
                    {formatDateTime(alert.fired_at)}
                  </span>
                </ItemTitle>
                <ItemDescription className="line-clamp-1">
                  {alert.scope_label}
                </ItemDescription>
                <span className="flex flex-wrap gap-1.5 pt-0.5">
                  <ToneBadge tone="neutral">{alert.products_count} productos</ToneBadge>
                  {!alert.seen && <ToneBadge tone="sky">Nueva</ToneBadge>}
                </span>
              </ItemContent>
            </Item>
          )
        })}
        {total > alerts.length && (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            Se muestran las {alerts.length} más recientes de {total}.
          </p>
        )}
      </ItemGroup>
    </Card>
  )
}

function AlertDetail({ alert }: { alert: FiredAlertDetail }) {
  const devaluation = Number(alert.devaluation_pct)
  const average = Number(alert.average_pct)
  const gap = average - devaluation

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardDescription className="font-mono text-xs tabular-nums">
          {formatDateTime(alert.fired_at)}
        </CardDescription>
        <CardTitle className="text-lg tracking-tight">
          <h3>{alert.rule_name}</h3>
        </CardTitle>
        <CardAction className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/user/regla-nueva?rule=${alert.rule_id}`} />}
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
        <Stat label="Devaluación del período" value={formatPct(devaluation)} />
        <Stat label="Suba promedio" value={formatPct(average)} />
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
            <TableRow key={`${alert.id}-${item.product_name}-${item.store_name}`}>
              <TableCell className="py-3 pl-(--card-spacing)">
                {item.canonical_product_id ? (
                  <Link
                    href={`/user/producto?id=${item.canonical_product_id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.product_name}
                  </Link>
                ) : (
                  <span className="font-medium">{item.product_name}</span>
                )}
                <div className="text-muted-foreground">
                  {item.category ? CATEGORY_LABEL[item.category] : "Sin categoría"}
                </div>
              </TableCell>
              <TableCell>{item.store_name}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatPct(Number(item.variation_pct))}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                {formatPct(devaluation)}
              </TableCell>
              <TableCell className="pr-(--card-spacing) text-right">
                <ToneBadge tone="red" className="ml-auto font-mono">
                  <ArrowUpIcon />
                  {formatPP(Number(item.variation_pct) - devaluation)}
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
