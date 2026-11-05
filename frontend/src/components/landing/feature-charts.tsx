"use client"

import { Bar, BarChart, LabelList, Line, LineChart, XAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const categoryConfig = {
  inflacion: { label: "Inflación acumulada", color: "var(--foreground)" },
} satisfies ChartConfig

const categories = [
  { cat: "Almacén", inflacion: 21.3, fill: "var(--foreground)" },
  { cat: "Electro", inflacion: 12.1, fill: "#a1a1aa" },
  { cat: "Indument.", inflacion: 24.6, fill: "#52525b" },
]

export function CategoryChart() {
  return (
    <ChartContainer config={categoryConfig} className="aspect-auto h-[130px] w-full">
      <BarChart data={categories} margin={{ top: 18, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="cat" tickLine={false} axisLine={false} tickMargin={6} fontSize={10} />
        <Bar dataKey="inflacion" radius={6} isAnimationActive={false}>
          <LabelList
            dataKey="inflacion"
            position="top"
            className="fill-foreground font-mono"
            fontSize={11}
            formatter={(v) => String(v).replace(".", ",")}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

const spikeConfig = {
  variacion: { label: "Variación semanal", color: "#d4d4d8" },
} satisfies ChartConfig

const spikes = [30, 36, 34, 42, 40, 95, 48, 50, 52, 56].map((v, i) => ({
  semana: i + 1,
  variacion: v,
  fill: i === 5 ? "#b91c1c" : "var(--color-variacion)",
}))

export function SpikesChart() {
  return (
    <ChartContainer config={spikeConfig} className="aspect-auto h-[130px] w-full">
      <BarChart data={spikes} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey="variacion" radius={3} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}

const historyConfig = {
  delta: { label: "Supermercado Delta", color: "var(--foreground)" },
  sur: { label: "Hiper Sur", color: "#2563eb" },
  norte: { label: "Mercado Norte", color: "#ea580c" },
} satisfies ChartConfig

const history = [
  [20, 14, 26],
  [22, 16, 30],
  [28, 18, 34],
  [30, 24, 38],
  [40, 26, 34],
  [44, 34, 48],
  [54, 38, 56],
  [62, 46, 70],
].map(([delta, sur, norte], i) => ({ dia: i, delta, sur, norte }))

export function HistoryChart() {
  return (
    <ChartContainer config={historyConfig} className="aspect-auto h-[130px] w-full">
      <LineChart data={history} margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
        {(Object.keys(historyConfig) as (keyof typeof historyConfig)[]).map((key) => (
          <Line
            key={key}
            dataKey={key}
            type="linear"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
