"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpIcon } from "lucide-react"
import {
  Area, Brush, CartesianGrid, ComposedChart, Line, LineChart,
  ReferenceDot, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis,
} from "recharts"

import { ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatArs, formatPct } from "@/lib/format"
import { QUOTE_LABEL } from "@/lib/quotes"
import { CATEGORIES, chartData, type DashboardFilters, type DashboardSummary } from "./data"

const dateLabel = (date: string) => date.slice(0, 10).split("-").reverse().join("/")
const axisDate = (date: string) => dateLabel(date).slice(0, 5)
const decimal = (value: number) => value.toFixed(1).replace(".", ",")
const evolutionConfig = {
  ars: { label: "Índice ARS", color: "var(--foreground)" },
  usd: { label: "Índice USD", color: "#2563eb" },
  rate: { label: "Cotización", color: "#ea580c" },
} satisfies ChartConfig
const scatterConfig = {
  above: { label: "Subió más que el dólar", color: "#ea580c" },
  below: { label: "Subió menos que el dólar", color: "#2563eb" },
  fx: { label: "Variación del dólar" },
  price: { label: "Variación del precio" },
} satisfies ChartConfig

export function DashboardCharts({ filters, summary }: {
  filters: DashboardFilters; summary: DashboardSummary
}) {
  const data = React.useMemo(() => chartData(filters, summary), [filters, summary])
  const categoryConfig = Object.fromEntries(CATEGORIES
    .filter((category) => filters.categories.includes(category.name))
    .map((category) => [category.name, { label: category.name, color: category.color }])) satisfies ChartConfig
  const categorySeries = data.series.map((point) => ({ date: point.date, ...point.categories }))
  const above = data.scatter.filter((point) => point.price > point.fx)
  const below = data.scatter.filter((point) => point.price <= point.fx)
  const fxMax = Math.max(1, Math.ceil(Math.max(...data.scatter.map((point) => point.fx)) * 1.1))
  const priceMax = Math.max(1, Math.ceil(Math.max(...data.scatter.map((point) => point.price)) * 1.1))
  const diagonalMax = Math.min(fxMax, priceMax)

  return (
    <>
      <div className="grid min-w-0 gap-4 @5xl/main:grid-cols-[2fr_1fr]">
        <Card className="min-w-0 shadow-xs">
          <CardHeader>
            <CardTitle><h3>Evolución de precios</h3></CardTitle>
            <CardDescription>Índice base 100 = {dateLabel(filters.start)} · eje derecho: dólar {QUOTE_LABEL[filters.quote].toLowerCase()} ($ por US$)</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <EvolutionChart key={`${filters.start}-${filters.end}-${filters.quote}-${filters.currency}-${filters.categories.join()}`}
              series={data.series} currency={filters.currency} />
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-xs">
          <CardHeader>
            <CardTitle><h3>Picos del período</h3></CardTitle>
            <CardDescription>Saltos en hasta 7 días mayores a 3 % · precio en ARS</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            {data.peaks.length ? <ul className="divide-y">
              {data.peaks.map((peak) => <li key={peak.category} className="flex items-center gap-3 py-3">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: peak.color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{peak.category}</p>
                  <p className="font-mono text-xs text-muted-foreground">{dateLabel(peak.date)}</p>
                </div>
                <ToneBadge tone="red" className="font-mono"><ArrowUpIcon />{formatPct(peak.value)}</ToneBadge>
              </li>)}
            </ul> : <p className="py-6 text-sm text-muted-foreground">No se detectaron picos mayores a 3 % en esta selección.</p>}
            <Button variant="outline" size="sm" className="mt-auto" nativeButton={false}
              render={<Link href="/user/regla-nueva" />}>Crear alerta de pico</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 @5xl/main:grid-cols-2">
        <Card className="min-w-0 shadow-xs">
          <CardHeader>
            <CardTitle><h3>Precio vs tipo de cambio</h3></CardTitle>
            <CardDescription>Cada punto: una categoría en un mes (extremos parciales). {above.length} de {data.scatter.length} subieron más que el dólar {QUOTE_LABEL[filters.quote].toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={scatterConfig} className="h-80 w-full aspect-auto" role="img"
              aria-label="Dispersión de variación mensual de precios en ARS frente al dólar">
              <ScatterChart margin={{ top: 16, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis type="number" dataKey="fx" name="Variación del dólar" domain={[0, fxMax]} tickCount={5}
                  tickFormatter={(value: number) => `${decimal(value)} %`} tickLine={false}
                  label={{ value: "Variación mensual del dólar", position: "bottom", offset: 8 }} />
                <YAxis type="number" dataKey="price" name="Variación del precio" domain={[0, priceMax]} tickCount={5}
                  tickFormatter={(value: number) => `${decimal(value)} %`} tickLine={false} axisLine={false} width={50} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: diagonalMax, y: diagonalMax }]}
                  stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                  const point = payload?.[0]?.payload
                  if (!active || !point) return null
                  return <div className="rounded-lg border bg-background p-3 text-xs shadow-md">
                    <p className="mb-1 font-medium">{point.category} · {point.month}</p>
                    <p>Precio ARS: {formatPct(point.price)}</p>
                    <p>Dólar: {formatPct(point.fx)}</p>
                  </div>
                }} />
                <Scatter name="above" data={above} fill="var(--color-above)" isAnimationActive={false} />
                <Scatter name="below" data={below} fill="var(--background)" stroke="var(--color-below)" strokeWidth={2} isAnimationActive={false} />
              </ScatterChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-orange-500" />Subió más que el dólar</span>
              <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full border-2 border-blue-500" />Subió menos que el dólar</span>
              <span>Línea punteada: igual variación</span>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-xs">
          <CardHeader>
            <CardTitle><h3>Índice por categoría</h3></CardTitle>
            <CardDescription>Base 100 · {filters.currency} · ▼ marca un pico del precio en ARS</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={categoryConfig} className="h-80 w-full aspect-auto" role="img"
              aria-label={`Índice de precios por categoría en ${filters.currency}`}>
              <LineChart data={categorySeries} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={axisDate} minTickGap={30} tickLine={false} axisLine={false} />
                <YAxis domain={["auto", "auto"]} tickFormatter={decimal} tickLine={false} axisLine={false} width={45} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => dateLabel(String(label))}
                  formatter={(value, name) => <span>{String(name)}: <span className="font-mono">{decimal(Number(value))}</span></span>} />} />
                <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
                {Object.keys(categoryConfig).map((name) => <Line key={name} dataKey={name} type="linear"
                  stroke={`var(--color-${name})`} strokeWidth={2} dot={false} isAnimationActive={false} />)}
                {data.peaks.map((peak) => <ReferenceDot key={peak.category} x={peak.date}
                  y={data.series.find((point) => point.date === peak.date)!.categories[peak.category]}
                  r={3} fill="var(--foreground)" stroke="var(--background)"
                  label={{ value: "▼", position: "top", fill: "var(--foreground)", fontSize: 12 }} />)}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function EvolutionChart({ series, currency }: {
  series: ReturnType<typeof chartData>["series"]; currency: DashboardFilters["currency"]
}) {
  const [range, setRange] = React.useState({ startIndex: 0, endIndex: series.length - 1 })
  return <>
    <ChartContainer config={evolutionConfig} className="h-80 w-full aspect-auto" role="img"
      aria-label="Evolución del índice ARS, índice USD y cotización del dólar">
      <ComposedChart data={series} margin={{ top: 12, right: 6, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={axisDate} minTickGap={30} tickLine={false} axisLine={false} />
        <YAxis yAxisId="index" domain={["auto", "auto"]} tickFormatter={decimal} tickLine={false} axisLine={false} width={45} />
        <YAxis yAxisId="fx" orientation="right" domain={["auto", "auto"]} tickFormatter={formatArs}
          tickLine={false} axisLine={false} width={70} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => dateLabel(String(label))}
          formatter={(value, name) => <span>{evolutionConfig[name as keyof typeof evolutionConfig]?.label ?? String(name)}: <span className="font-mono">{name === "rate" ? formatArs(Number(value)) : decimal(Number(value))}</span></span>} />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
        <Area yAxisId="index" dataKey="ars" fill="var(--color-ars)" fillOpacity={0.04} stroke="none" legendType="none" tooltipType="none" isAnimationActive={false} />
        <Line yAxisId="index" dataKey="ars" stroke="var(--color-ars)" strokeWidth={2} strokeOpacity={currency === "ARS" ? 1 : 0.4} dot={false} isAnimationActive={false} />
        <Line yAxisId="index" dataKey="usd" stroke="var(--color-usd)" strokeWidth={2} strokeOpacity={currency === "USD" ? 1 : 0.5} dot={false} isAnimationActive={false} />
        <Line yAxisId="fx" dataKey="rate" stroke="var(--color-rate)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        <Brush dataKey="date" height={36} stroke="var(--muted-foreground)" fill="var(--background)"
          tickFormatter={axisDate} travellerWidth={8} startIndex={range.startIndex} endIndex={range.endIndex}
          onChange={(next) => setRange({ startIndex: next.startIndex ?? 0, endIndex: next.endIndex ?? series.length - 1 })}>
          <LineChart data={series}>
            <Line dataKey="ars" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </Brush>
      </ComposedChart>
    </ChartContainer>
    <p className="mt-2 text-xs text-muted-foreground">Rango visible: {dateLabel(series[range.startIndex].date)} – {dateLabel(series[range.endIndex].date)}. El selector inferior amplía solo este gráfico; los indicadores mantienen el período de los filtros.</p>
  </>
}
