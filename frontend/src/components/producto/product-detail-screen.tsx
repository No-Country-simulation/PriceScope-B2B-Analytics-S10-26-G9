"use client"

import * as React from "react"

import { AppShell } from "@/components/app-shell"
import type { Quote } from "@/lib/quotes"

import { PriceComparisonTable } from "./price-comparison-table"
import { PriceHistoryChart } from "./price-history-chart"
import { ProductKpis } from "./product-kpis"
import { PRODUCT } from "./data"

// Pantalla UX06 · Ficha de producto. Muestra el detalle de un producto
// canónico: precios actuales por tienda, historial de precios y eventos.
export function ProductDetailScreen() {
  const [quote, setQuote] = React.useState<Quote>("blue")

  return (
    <AppShell section="Análisis" title="Ficha de producto" quote={quote}>
      <div className="flex w-full max-w-[1280px] flex-col gap-6 p-6">
        {/* Encabezado */}
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-tight">
            {PRODUCT.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {PRODUCT.brand} · {PRODUCT.cat} · {PRODUCT.size}
          </p>
        </div>

        {/* Tarjetas KPI */}
        <ProductKpis />

        {/* Gráfico de historial */}
        <PriceHistoryChart quote={quote} onQuoteChange={setQuote} />

        {/* Tabla comparativa de precios por tienda */}
        <PriceComparisonTable quote={quote} />
      </div>
    </AppShell>
  )
}
