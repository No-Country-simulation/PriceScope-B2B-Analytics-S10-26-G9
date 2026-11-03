"use client"

import * as React from "react"

import { AppShell } from "@/components/app-shell"
import type { Quote } from "@/lib/quotes"

import { PriceMatrix } from "./price-matrix"

// Pantalla UX05 · Matriz de precios. La cotización vive acá porque la ve tanto
// el header (badge con la blue vigente) como la tabla (conversión a USD).
export function MatrizScreen() {
  const [quote, setQuote] = React.useState<Quote>("blue")

  return (
    <AppShell section="Análisis" title="Matriz de precios" quote={quote}>
      <PriceMatrix quote={quote} onQuoteChange={setQuote} />
    </AppShell>
  )
}
