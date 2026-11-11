import { Loader2Icon, RotateCwIcon, ScrollTextIcon, ServerIcon } from "lucide-react"

import { IconTile, ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  STATUS_LABEL,
  STATUS_TONE,
  TREND_LABELS,
  durationOf,
  lastRunOf,
  productsOf,
  trendOf,
  type Scraper,
  type ScraperStatus,
} from "./data"

// UX10 · Operación: una fuente de datos por tarjeta, con su última ejecución,
// los productos de los últimos 7 días y las acciones de reintento.
export function ScraperCard({
  scraper,
  status,
  onRetry,
  onShowLog,
}: {
  scraper: Scraper
  status: ScraperStatus
  onRetry: () => void
  onShowLog: () => void
}) {
  const running = status === "run"
  const products = productsOf(scraper, status)
  const trend = trendOf(scraper, status)
  const max = Math.max(...trend, 1)

  const productsText =
    products === null
      ? "…"
      : status === "fail"
        ? `0 de ${formatCount(scraper.expected)}`
        : formatCount(products)

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile tone={STATUS_TONE[status]}>
            <ServerIcon />
          </IconTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">{scraper.store}</span>
            <span className="text-xs text-muted-foreground">{scraper.kind}</span>
          </div>
        </div>
        <ToneBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</ToneBadge>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-t p-4">
        <Stat label="Última ejecución" value={lastRunOf(scraper, status)} />
        <Stat label="Duración" value={durationOf(scraper, status)} />
        <Stat label="Productos" value={productsText} />
      </dl>

      <div className="flex flex-col gap-2 border-t px-4 pt-3 pb-4">
        <span className="text-xs text-muted-foreground">
          Últimos 7 días · productos extraídos
        </span>
        <div
          role="img"
          aria-label={`Productos extraídos por día: ${trend.join(", ")}`}
          className="flex h-11 items-end gap-1"
        >
          {trend.map((value, index) => (
            <span
              key={TREND_LABELS[index]}
              className={cn(
                "min-h-1.5 flex-1 rounded-xs",
                running && index === trend.length - 1
                  ? "bg-brand"
                  : value === 0
                    ? "bg-destructive"
                    : "bg-muted-foreground/40"
              )}
              style={{ height: `${Math.max(6, (value / max) * 44)}px` }}
            />
          ))}
        </div>
        <div className="flex gap-1 text-[10px] leading-none text-muted-foreground tabular-nums">
          {TREND_LABELS.map((label) => (
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
          disabled={running}
          aria-label={`Reintentar la extracción de ${scraper.store}`}
        >
          {running ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          {running ? "En curso…" : "Reintentar"}
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
