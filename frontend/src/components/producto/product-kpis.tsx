import { TrendingUpIcon, TrendingDownIcon, ArrowUpDownIcon, ClockIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatArs, formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"

import { CURRENT_PRICES, PRODUCT } from "./data"

export function ProductKpis() {
  const prices = CURRENT_PRICES.filter((p): p is number => p != null)
  const min = prices.length > 0 ? Math.min(...prices) : 0
  const max = prices.length > 0 ? Math.max(...prices) : 0
  const spread = min > 0 ? ((max - min) / min) * 100 : 0

  const cards = [
    {
      label: "Precio más bajo",
      value: formatArs(min),
      hint: "Supermercado Delta",
      icon: <TrendingDownIcon />,
      tone: "text-[#15803d]",
    },
    {
      label: "Precio más alto",
      value: formatArs(max),
      hint: "Mercado Norte",
      icon: <TrendingUpIcon />,
      tone: "text-[#b91c1c]",
    },
    {
      label: "Spread entre tiendas",
      value: spread.toFixed(1).replace(".", ",") + " %",
      hint: "Diferencia de precio entre el más barato y el más caro",
      icon: <ArrowUpDownIcon />,
      tone: "text-foreground",
    },
    {
      label: "Variación 30 días",
      value: "▲ " + formatPct(PRODUCT.v30),
      hint: "Promedio de las tiendas",
      icon: <ClockIcon />,
      tone: "text-[#b91c1c]",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card shadow-xs">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            <CardAction>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg bg-muted",
                  card.tone
                )}
              >
                {card.icon}
              </span>
            </CardAction>
            <p className="col-span-full pt-1 text-sm text-muted-foreground">
              {card.hint}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
