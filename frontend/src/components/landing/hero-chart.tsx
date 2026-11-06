"use client"

import * as React from "react"
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts"

import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type Moneda = "ARS" | "USD"
type Cotizacion = "oficial" | "blue"

// Serie de ejemplo: 20 capturas a lo largo de 180 días, base 100.
const N = 20
const series = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1)
  const w = i > 0 && i < N - 1 ? 1 : 0
  return {
    dia: Math.round(t * 180),
    ars: 100 * (1 + 0.184 * Math.pow(t, 1.1)) + 0.5 * Math.sin(i * 1.3) * w,
    blue: 100 * (1 + 0.148 * Math.pow(t, 0.9)) + 0.6 * Math.sin(i * 0.9) * w,
    oficial: 100 * (1 + 0.0756 * t) + 0.2 * Math.sin(i * 0.7) * w,
  }
})

const f1 = (v: number) => Math.abs(v).toFixed(1).replace(".", ",")
const pct = (v: number) => `${v >= 0 ? "+" : "−"}${f1(v)} %`

export function HeroChart() {
  const [moneda, setMoneda] = React.useState<Moneda>("ARS")
  const [cot, setCot] = React.useState<Cotizacion>("blue")
  const isUSD = moneda === "USD"

  const data = series.map((p) => ({
    dia: p.dia,
    indice: isUSD ? (p.ars * 100) / p[cot] : p.ars,
    dolar: p[cot],
  }))
  const last = data[N - 1]
  const infl = last.indice - 100
  const dev = last.dolar - 100
  const brecha = isUSD ? infl : infl - dev
  const up = brecha >= 0

  const chartConfig = {
    indice: { label: `Índice en ${moneda}`, color: isUSD ? "#2563eb" : "var(--foreground)" },
    dolar: { label: `Dólar ${cot}`, color: "#d97706" },
  } satisfies ChartConfig

  const phrase = isUSD
    ? `Medidos en dólares ${cot}, los precios ${up ? "subieron" : "bajaron"} ${f1(infl)} % en 180 días.`
    : `Los precios subieron ${f1(brecha)} p.p. ${up ? "más" : "menos"} que el dólar ${cot}.`

  return (
    <Card className="shadow-xl">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2.5">
        <CardTitle>Canasta monitoreada · 180 días</CardTitle>
        <CardAction className="flex gap-1.5">
          <ToggleGroup
            aria-label="Moneda"
            variant="outline"
            size="sm"
            spacing={0}
            value={[moneda]}
            onValueChange={(v) => v.length && setMoneda(v[0] as Moneda)}
          >
            <ToggleGroupItem value="ARS">ARS</ToggleGroupItem>
            <ToggleGroupItem value="USD">USD</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            aria-label="Cotización"
            variant="outline"
            size="sm"
            spacing={0}
            value={[cot]}
            onValueChange={(v) => v.length && setCot(v[0] as Cotizacion)}
          >
            <ToggleGroupItem value="oficial">Oficial</ToggleGroupItem>
            <ToggleGroupItem value="blue">Blue</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Kpi label={`Inflación ${moneda}`} value={pct(infl)} />
          <Kpi label={`Dólar ${cot}`} value={pct(dev)} />
          <Kpi
            label="Brecha"
            value={isUSD ? pct(infl) : `${up ? "+" : "−"}${f1(brecha)} p.p.`}
            className={up ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}
          />
        </div>

        <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="fillIndice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-indice)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--color-indice)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" hide />
            <YAxis hide domain={[95, 125]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) => `Día ${payload?.[0]?.payload?.dia ?? ""}`}
                  formatter={(value, name) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label}
                      </span>
                      <span className="font-mono tabular-nums">{Number(value).toFixed(1).replace(".", ",")}</span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="indice"
              type="monotone"
              fill="url(#fillIndice)"
              stroke="var(--color-indice)"
              strokeWidth={2.5}
              isAnimationActive={false}
            />
            <Line
              dataKey="dolar"
              type="monotone"
              stroke="var(--color-dolar)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>

        <div className="flex flex-wrap justify-between gap-2.5 text-xs">
          <span className="flex gap-3.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-3.5" style={{ background: chartConfig.indice.color }} />
              Índice de precios en {moneda}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 border-t-2 border-dashed border-amber-600" />
              Dólar {cot}
            </span>
          </span>
          <span className="text-muted-foreground">Datos de ejemplo</span>
        </div>
      </CardContent>

      <CardFooter className="gap-2.5 text-sm text-muted-foreground">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px]",
            up ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700",
          )}
          aria-hidden="true"
        >
          {up ? "▲" : "▼"}
        </span>
        {phrase}
      </CardFooter>
    </Card>
  )
}

function Kpi({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border p-3", className)}>
      <span className={cn("text-xs", !className && "text-muted-foreground")}>{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums">{value}</span>
    </div>
  )
}
