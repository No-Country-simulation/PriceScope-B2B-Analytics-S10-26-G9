// UX06 · Ficha de producto: historial de muestra derivado del catálogo de la
// matriz (components/matriz/data.ts). Todavía no hay API: cuando entre el
// backend, el historial real reemplaza a historyFor().

import { PRODUCTS, STORES, type Product } from "@/components/matriz/data"
import { QUOTES } from "@/lib/quotes"

export { STORES }
export type { Product }

export const SNAPSHOT_DATE = "2026-10-29"
export const PERIODS = [30, 90, 180, 365] as const
export type Period = (typeof PERIODS)[number]
export const MAX_DAYS = 365

const DAY = 86_400_000
// Fecha del cambio de gramaje en las tiendas con reduflación.
export const REDU_DATE = "2026-09-19"

export function slugOf(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function findProduct(slug: string | null) {
  return PRODUCTS.find((product) => slugOf(product.name) === slug) ?? PRODUCTS[0]
}

/** Enlace a la ficha desde un texto como "Café molido 500 g"; la matriz si no está en el catálogo. */
export function productHref(label: string) {
  const product = PRODUCTS.find((item) => label.startsWith(item.name))
  return product ? `/user/producto?p=${slugOf(product.name)}` : "/user/matriz"
}

export function canonicalId(product: Product) {
  return `PC-${String(418 + PRODUCTS.indexOf(product)).padStart(5, "0")}`
}

export function compareCandidates(product: Product) {
  const others = PRODUCTS.filter((item) => item !== product)
  // Primero los de la misma categoría, que son los que más se comparan.
  return [
    ...others.filter((item) => item.cat === product.cat),
    ...others.filter((item) => item.cat !== product.cat),
  ]
}

/** "500 → 450 g" → { before: "500 g", after: "450 g" } */
export function parseRedu(redu: string) {
  const [before, after] = redu.split("→").map((part) => part.trim())
  const unit = after.replace(/^[\d.,]+\s*/, "")
  return { before: /\D$/.test(before) ? before : `${before} ${unit}`, after }
}

/** Gramos o mililitros de un formato ("500 g", "1,5 L", "1 kg"); null si no aplica. */
export function unitAmount(size: string) {
  const match = size.match(/^([\d.,]+)\s*(g|kg|ml|l)\b/i)
  if (!match) return null
  const value = Number(match[1].replace(",", "."))
  const unit = match[2].toLowerCase()
  return { amount: unit === "kg" || unit === "l" ? value * 1000 : value, unit: unit.startsWith("k") || unit === "g" ? "g" : "ml" }
}

/** Formato vigente en cada tienda (cambia en las que tuvieron reduflación). */
export function storeSize(product: Product, store: number) {
  const redu = product.redu?.[store]
  return redu ? parseRedu(redu).after : product.size
}

export function rateOn(daysBack: number) {
  // Mismo ritmo que el dólar blue del dashboard (UX04): +14,8 % en 180 días.
  return QUOTES.blue * Math.pow(1.148, -daysBack / 180)
}

export type HistoryPoint = {
  date: string
  daysBack: number
  rate: number
  /** Precio regular por tienda, en ARS; null si la tienda no lo publica. */
  prices: (number | null)[]
}

// Precios semanales: hoy el de la matriz, hacia atrás deshaciendo la variación
// de 30 días (más lenta antes del último mes), redondeados a $ 10.
function priceOn(today: number, monthly: number, daysBack: number) {
  const weeks = Math.floor(daysBack / 7)
  const recent = Math.min(weeks, 4)
  const older = Math.max(0, weeks - 4)
  const weekly = Math.pow(1 + monthly / 100, 7 / 30)
  const slow = Math.pow(1 + monthly / 200, 7 / 30)
  return Math.round(today / Math.pow(weekly, recent) / Math.pow(slow, older) / 10) * 10
}

export function historyFor(product: Product): HistoryPoint[] {
  const end = Date.parse(SNAPSHOT_DATE)
  return Array.from({ length: MAX_DAYS + 1 }, (_, index) => {
    const daysBack = MAX_DAYS - index
    return {
      date: new Date(end - daysBack * DAY).toISOString().slice(0, 10),
      daysBack,
      rate: rateOn(daysBack),
      prices: product.p.map((price, store) => {
        if (price == null) return null
        // Cada tienda se mueve un poco distinto, siempre igual para el mismo producto.
        const jitter = ((product.name.length + store * 7) % 5) - 2
        const regular = product.promo?.[store] ?? price
        return priceOn(regular, product.v + jitter * 0.6, daysBack)
      }),
    }
  })
}

export function averageOf(prices: (number | null)[]) {
  const values = prices.filter((value): value is number => value != null)
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

export const dateLabel = (date: string) => date.split("-").reverse().join("/")
