"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { formatArs } from "@/lib/format"
import type { Quote } from "@/lib/quotes"

import { PRICE_HISTORY } from "./data"

const chartConfig = {
  delta: { label: "Supermercado Delta", color: "var(--chart-1)" },
  hiper: { label: "Hiper Sur", color: "var(--chart-2)" },
  norte: { label: "Mercado Norte", color: "var(--chart-3)" },
} satisfies ChartConfig

const storeKeys = ["delta", "hiper", "norte"] as const

// Gráfico de historial de precios del producto. Muestra los últimos 30 días
// con una línea por tienda. Maqueta local, sin llamadas a la API.
export function PriceHistoryChart({
  quote,
  onQuoteChange,
}: {
  quote: Quote
  onQuoteChange: (quote: Quote) => void
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Historial de precios</CardTitle>
        <CardDescription>ARS · últimos 30 días</CardDescription>
        <CardAction>
          <ToggleGroup
            aria-label="Cotización"
            multiple={false}
            value={[quote]}
            onValueChange={(next) => {
              if (next[0]) onQuoteChange(next[0] as Quote)
            }}
            className="rounded-[9px] bg-[#f4f4f5] p-[3px]"
          >
            <ToggleGroupItem
              value="oficial"
              className="h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm"
            >
              Oficial
            </ToggleGroupItem>
            <ToggleGroupItem
              value="blue"
              className="h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm"
            >
              Blue
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={PRICE_HISTORY}>
            <defs>
              {storeKeys.map((key) => (
                <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={70}
              tickFormatter={(value) => formatArs(Number(value))}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("es-AR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })
                  }
                  formatter={(value) => formatArs(Number(value))}
                  indicator="dot"
                />
              }
            />
            {storeKeys.map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="stepAfter"
                fill={`url(#fill-${key})`}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
