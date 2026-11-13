"use client"

import * as React from "react"
import { DollarSignIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { IconTile, ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, query, type OperationOverview } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatArs, formatQuoteTime } from "@/lib/format"
import { useApi } from "@/lib/use-api"

type AdminRate = {
  source: string
  type: "official" | "blue"
  buy: string | null
  sell: string
  quoted_at: string
}

const HISTORY_DAYS = 7
const SOURCE_LABEL: Record<string, string> = {
  dolarapi: "DolarAPI",
  bluelytics: "Bluelytics",
}
const TYPES = [
  { type: "official", label: "Oficial" },
  { type: "blue", label: "Blue" },
] as const
const chartConfig = {
  official: { label: "Oficial", color: "#4a5bdb" },
  blue: { label: "Blue", color: "#38bdf8" },
} satisfies ChartConfig

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const dayLabel = (date: string) => date.slice(8, 10) + "/" + date.slice(5, 7)

// UX10 · Operación, sección del dólar: franja con los últimos valores, la
// brecha, la semana y la salud de la ingesta horaria, más un botón para pedir
// la cotización ahora sin esperar al worker.
export function RatesPanel({
  status,
  onRefreshed,
}: {
  status: OperationOverview["rates"]
  onRefreshed: () => void
}) {
  const { request } = useAuth()
  const latest = useApi<AdminRate[]>("/admin/rates")
  const [range] = React.useState(() => {
    const end = new Date()
    const start = new Date(end.getTime() - HISTORY_DAYS * 86_400_000)
    return { start: isoDate(start), end: isoDate(end) }
  })
  const official = useApi<{ date: string; sell: string }[]>(
    `/rates/history${query({ type: "official", ...range })}`
  )
  const blue = useApi<{ date: string; sell: string }[]>(
    `/rates/history${query({ type: "blue", ...range })}`
  )
  const [refreshing, setRefreshing] = React.useState(false)

  const rate = (type: AdminRate["type"]) =>
    latest.data?.find((item) => item.type === type)
  const officialSell = Number(rate("official")?.sell ?? NaN)
  const blueSell = Number(rate("blue")?.sell ?? NaN)
  const gap =
    officialSell && blueSell ? (blueSell / officialSell - 1) * 100 : null

  const series = React.useMemo(() => {
    const byDay = new Map<
      string,
      { date: string; official?: number; blue?: number }
    >()
    for (const point of official.data ?? []) {
      byDay.set(point.date, {
        ...byDay.get(point.date),
        date: point.date,
        official: Number(point.sell),
      })
    }
    for (const point of blue.data ?? []) {
      byDay.set(point.date, {
        ...byDay.get(point.date),
        date: point.date,
        blue: Number(point.sell),
      })
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [official.data, blue.data])

  async function refresh() {
    setRefreshing(true)
    try {
      const rates = await request<AdminRate[]>("/admin/rates/refresh", {
        method: "POST",
      })
      const value = (type: AdminRate["type"]) =>
        rates.find((item) => item.type === type)?.sell
      toast.success("Cotización actualizada.", {
        description: TYPES.filter(({ type }) => value(type))
          .map(
            ({ type, label }) => `${label} ${formatArs(Number(value(type)))}`
          )
          .join(" · "),
      })
      latest.reload()
      official.reload()
      blue.reload()
      onRefreshed()
    } catch (error) {
      toast.error("No pudimos actualizar la cotización.", {
        description: error instanceof ApiError ? error.message : undefined,
      })
    } finally {
      setRefreshing(false)
    }
  }

  const tone = status.last_quoted_at ? (status.ok ? "emerald" : "amber") : "red"
  const source = status.source
    ? (SOURCE_LABEL[status.source] ?? status.source)
    : null

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile tone={tone}>
            <DollarSignIcon />
          </IconTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              Cotización del dólar
              <ToneBadge tone={tone}>
                {!status.last_quoted_at
                  ? "Sin datos"
                  : status.ok
                    ? "OK"
                    : "Atrasada"}
              </ToneBadge>
            </span>
            <span className="text-xs text-muted-foreground">
              {source ? `${source} · ` : ""}ingesta cada hora
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            Actualizada{" "}
            <span className="font-mono text-foreground tabular-nums">
              {status.last_quoted_at
                ? formatQuoteTime(status.last_quoted_at)
                : "—"}
            </span>
          </span>
          <span>
            Ingestas 24 h{" "}
            <span className="font-mono text-foreground tabular-nums">
              {status.ingestions_24h} de 24
            </span>
          </span>
          {!status.ok && status.ingestions_24h < 2 && (
            <span>¿Está corriendo el worker?</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing}
            title="Consulta el dólar oficial y blue ahora, sin esperar la ingesta horaria"
          >
            {refreshing ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            Actualizar dólar
          </Button>
        </div>
      </div>

      <div className="grid divide-y @3xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1.6fr)] @3xl/main:divide-x @3xl/main:divide-y-0">
        {TYPES.map(({ type, label }) => {
          const item = rate(type)
          return (
            <div key={type} className="flex flex-col gap-1 px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: chartConfig[type].color }}
                  aria-hidden="true"
                />
                {label} · venta
              </span>
              {latest.data ? (
                <>
                  <span className="font-mono text-2xl font-semibold tabular-nums">
                    {item ? formatArs(Number(item.sell)) : "—"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    Compra {item?.buy ? formatArs(Number(item.buy)) : "—"}
                  </span>
                </>
              ) : (
                <Skeleton className="h-12 w-32" />
              )}
            </div>
          )
        })}
        <div className="flex flex-col gap-1 px-4 py-3">
          <span className="text-xs text-muted-foreground">Brecha</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {gap === null ? "—" : `${gap.toFixed(1).replace(".", ",")} %`}
          </span>
          <span className="text-xs text-muted-foreground">
            Blue sobre oficial
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Últimos 7 días · venta
          </span>
          {series.length >= 2 ? (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-16 w-full"
              role="img"
              aria-label="Dólar oficial y blue de los últimos 7 días"
            >
              <LineChart
                data={series}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => dayLabel(String(label))}
                      formatter={(value, name) => (
                        <span>
                          {chartConfig[name as keyof typeof chartConfig]
                            ?.label ?? String(name)}
                          :{" "}
                          <span className="font-mono">
                            {formatArs(Number(value))}
                          </span>
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  dataKey="official"
                  stroke="var(--color-official)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  dataKey="blue"
                  stroke="var(--color-blue)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="flex h-16 items-center text-xs text-muted-foreground">
              {official.data && blue.data
                ? "El gráfico aparece con al menos dos días de cotizaciones."
                : "Cargando…"}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
