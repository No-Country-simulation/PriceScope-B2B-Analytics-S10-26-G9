"use client"

import { TagIcon, TriangleAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatArs, formatUsd } from "@/lib/format"
import { QUOTES, type Quote } from "@/lib/quotes"
import { cn } from "@/lib/utils"

import {
  CURRENT_PRICES,
  PRICE_EVENTS,
  REDUCTION,
  REGULAR_PRICES,
  STORES,
} from "./data"

const TONES = {
  down: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  up: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  promo: "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]",
  redu: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
  muted: "border-[#f4f4f5] bg-[#f4f4f5] text-[#3f3f46]",
} as const

export function PriceComparisonTable({ quote }: { quote: Quote }) {
  const rate = QUOTES[quote]
  const prices = CURRENT_PRICES.filter((p): p is number => p != null)
  const min = prices.length > 0 ? Math.min(...prices) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Tabla de precios por tienda */}
      <Card className="overflow-hidden py-0 shadow-xs">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Precio actual por tienda</h2>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4">Tienda</TableHead>
              <TableHead className="px-4 text-right">Precio ARS</TableHead>
              <TableHead className="px-4 text-right">En USD ({quote})</TableHead>
              <TableHead className="px-4">Etiquetas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STORES.map((store, i) => {
              const price = CURRENT_PRICES[i]
              const regular = REGULAR_PRICES[i]
              const redu = REDUCTION[i]

              if (price == null) {
                return (
                  <TableRow key={store}>
                    <TableCell className="px-4 font-medium">{store}</TableCell>
                    <TableCell className="px-4 text-right text-muted-foreground">
                      Sin dato
                    </TableCell>
                    <TableCell className="px-4 text-right text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant="outline" className={cn("h-[22px] rounded-md", TONES.muted)}>
                        No publicado
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              }

              const cheap = price === min
              const hasPromo = regular != null
              const hasRedu = redu != null

              return (
                <TableRow key={store}>
                  <TableCell className="px-4 font-medium">{store}</TableCell>
                  <TableCell className="px-4 text-right font-mono tabular-nums">
                    {formatArs(price)}
                    {hasPromo && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        <s>{formatArs(regular!)}</s>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-muted-foreground tabular-nums">
                    {formatUsd(price, rate)}
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="flex flex-wrap gap-1">
                      {cheap && (
                        <Badge variant="outline" className={cn("h-[22px] rounded-md", TONES.down)}>
                          ▼ más barato
                        </Badge>
                      )}
                      {hasPromo && (
                        <Badge variant="outline" className={cn("h-[22px] rounded-md", TONES.promo)}>
                          <TagIcon className="size-3" /> Promo
                        </Badge>
                      )}
                      {hasRedu && (
                        <Badge variant="outline" className={cn("h-[22px] rounded-md", TONES.redu)}>
                          <TriangleAlertIcon className="size-3" /> {redu}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Línea de tiempo de eventos */}
      <Card className="overflow-hidden py-0 shadow-xs">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Eventos del período</h2>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4">Fecha</TableHead>
              <TableHead className="px-4">Tienda</TableHead>
              <TableHead className="px-4">Tipo</TableHead>
              <TableHead className="px-4">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRICE_EVENTS.map((event, i) => (
              <TableRow key={i}>
                <TableCell className="px-4 tabular-nums text-muted-foreground">
                  {new Date(event.date).toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="px-4 font-medium">{event.store}</TableCell>
                <TableCell className="px-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-[22px] rounded-md",
                      event.type === "price-up" && TONES.up,
                      event.type === "promo" && TONES.promo,
                      event.type === "redu" && TONES.redu
                    )}
                  >
                    {event.type === "price-up" && "Suba de precio"}
                    {event.type === "promo" && "Promoción"}
                    {event.type === "redu" && "Reduflación"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4">
                  <div className="font-medium">{event.label}</div>
                  <div className="text-xs text-muted-foreground">{event.detail}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
