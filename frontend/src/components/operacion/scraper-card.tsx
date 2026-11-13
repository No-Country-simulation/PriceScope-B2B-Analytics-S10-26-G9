import { Loader2Icon, RotateCwIcon, ScrollTextIcon, ServerIcon } from "lucide-react"

import { IconTile, ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { StoreOverview } from "@/lib/api"
import { formatQuoteTime } from "@/lib/format"

import { STATUS_LABEL, STATUS_TONE, type ScraperStatus } from "./labels"

function duration(store: StoreOverview) {
  const run = store.last_run
  if (!run?.finished_at) return "—"
  const seconds = Math.round((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000)
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} s`
}

// UX10 · Operación: una fuente de datos por tarjeta, con su última ejecución,
// los productos de los últimos 7 días y las acciones de reintento.
export function ScraperCard({
  store,
  status,
  onRetry,
  onShowLog,
}: {
  store: StoreOverview
  status: ScraperStatus
  onRetry: () => void
  onShowLog: () => void
}) {
  const running = status === "run" || status === "queued"
  const run = store.last_run
  const trend = store.trend_7d.map((point) => point.products)
  const labels = store.trend_7d.map((point) => point.date.slice(8))
  const max = Math.max(...trend, store.expected ?? 0, 1)

  const productsText =
    running || !run
      ? "…"
      : status === "fail"
        ? store.expected
          ? `0 de ${formatCount(store.expected)}`
          : "0"
        : formatCount(run.observations_saved)
  const lastRun = status === "queued" ? "en cola" : run ? formatQuoteTime(run.started_at) : "—"

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile tone={STATUS_TONE[status]}>
            <ServerIcon />
          </IconTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">{store.store_name}</span>
            <span className="text-xs text-muted-foreground">
              VTEX · {store.schedule ?? "sin horario programado"}
            </span>
          </div>
        </div>
        <ToneBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</ToneBadge>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t p-4">
        <Stat label="Última ejecución" value={lastRun} />
        <Stat label="Duración" value={running ? "—" : duration(store)} />
        <Stat label="Productos" value={productsText} />
      </dl>

      <div className="flex flex-col gap-2 border-t px-4 pt-3 pb-4">
        <span className="text-xs text-muted-foreground">
          Últimos 7 días · productos extraídos
        </span>
        <div
          role="img"
          aria-label={`Productos extraídos por día (0 = sin extracción exitosa): ${trend.join(", ")}`}
          className="flex h-11 items-end gap-1"
        >
          {trend.map((value, index) => (
            <span
              key={labels[index]}
              className={cn(
                "min-h-1.5 flex-1 rounded-xs",
                running && index === trend.length - 1
                  ? "bg-brand"
                  : value === 0
                    ? "bg-muted"
                    : "bg-muted-foreground/40"
              )}
              title={value === 0 ? `${labels[index]}: sin extracción exitosa` : `${labels[index]}: ${formatCount(value)} productos`}
              style={{ height: `${Math.max(6, (value / max) * 44)}px` }}
            />
          ))}
        </div>
        <div className="flex gap-1 text-[10px] leading-none text-muted-foreground tabular-nums">
          {labels.map((label) => (
            <span key={label} className="flex-1 text-center">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={running || !store.can_enqueue}
          title={store.can_enqueue ? undefined : "La extracción programada no está habilitada para esta tienda"}
          aria-label={`Reintentar la extracción de ${store.store_name}`}
        >
          {running ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          {running ? STATUS_LABEL[status] : "Reintentar"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowLog}>
          <ScrollTextIcon data-icon="inline-start" />
          Ver log
        </Button>
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-sm tabular-nums">{value}</dd>
    </div>
  )
}
