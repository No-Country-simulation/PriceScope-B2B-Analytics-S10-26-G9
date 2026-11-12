// UX07 · Nueva regla: opciones y estimación de muestra (sample-products.ts).
// Cuando entre la API, la vista previa la calcula el backend con los precios
// reales del día.

import { CATEGORIES, PRODUCTS, STORES } from "./sample-products"
import type { Quote } from "@/lib/quotes"

export const ANY_STORE = "cualquier tienda"
export const RULE_STORES: readonly string[] = STORES
export const RULE_CATEGORIES: readonly string[] = CATEGORIES
export const RULE_PRODUCTS: readonly string[] = PRODUCTS.map(
  (product) => `${product.name} ${product.size}`
)

export const PERIODS = [7, 30, 90] as const
export type Period = (typeof PERIODS)[number]

export type HitoId = "cyberweek" | "hotsale" | "blackfriday" | "custom"

export const HITOS: { id: HitoId; label: string; from: string; to: string }[] = [
  { id: "cyberweek", label: "CyberWeek", from: "2026-11-03", to: "2026-11-09" },
  { id: "blackfriday", label: "Black Friday", from: "2026-11-27", to: "2026-11-30" },
  { id: "hotsale", label: "Hot Sale", from: "2027-05-10", to: "2027-05-12" },
  { id: "custom", label: "Fecha personalizada", from: "", to: "" },
]

/** Devaluación de muestra por cotización y período, en %. */
export const DEVALUATION: Record<Quote, Record<Period, number>> = {
  blue: { 7: 0.9, 30: 4.1, 90: 11.6 },
  oficial: { 7: 0.6, 30: 1.9, 90: 6.8 },
}

export type RuleDraft = {
  kind: "devaluation" | "hit"
  scope: "category" | "product"
  /** Categoría o producto, según el alcance. */
  target: string
  store: string
  period: Period
  /** Tal cual lo tipea el usuario; acepta coma decimal. */
  threshold: string
  quote: Quote
  hito: HitoId
  from: string
  to: string
}

export type RuleMatch = { product: string; store: string; variation: number }

// La matriz trae la variación de 30 días; para 7 y 90 se escala, y cada
// tienda se corre un poco para que la muestra no sea idéntica entre tiendas.
const PERIOD_FACTOR: Record<Period, number> = { 7: 0.3, 30: 1, 90: 2.4 }
const STORE_OFFSET = [0.8, 0, -0.9]

export function matchesFor(
  draft: RuleDraft,
  devaluation: number,
  threshold: number
): RuleMatch[] {
  const factor = draft.kind === "hit" ? PERIOD_FACTOR[7] : PERIOD_FACTOR[draft.period]

  return PRODUCTS.flatMap((product) => {
    const label = `${product.name} ${product.size}`
    const inScope =
      draft.scope === "category" ? product.cat === draft.target : label === draft.target
    if (!inScope) return []

    return STORES.flatMap((store, index) => {
      if (draft.store !== ANY_STORE && draft.store !== store) return []
      if (product.p[index] === null) return []
      const variation = product.v * factor + STORE_OFFSET[index]
      return variation - devaluation > threshold
        ? [{ product: label, store, variation }]
        : []
    })
  }).sort((a, b) => b.variation - a.variation)
}

/** Los productos de muestra no existen en la API: el link lleva a la matriz. */
export function productHref(label: string) {
  void label
  return "/user/matriz"
}
