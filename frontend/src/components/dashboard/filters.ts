import type { DashboardOptions } from "@/lib/api"
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/categories"
import type { Quote } from "@/lib/quotes"

export const PERIODS = [7, 30, 90, 180, 365] as const
export type Currency = "ARS" | "USD"

const DAY = 86_400_000

export type DashboardFilters = {
  start: string
  end: string
  stores: string[] // slugs
  categories: ProductCategory[]
  currency: Currency
  quote: Quote
}

export function startForPeriod(end: string, days: number) {
  return new Date(Date.parse(end) - days * DAY).toISOString().slice(0, 10)
}

// The latest day with prices, or today when there are none yet.
export function lastDay(options: DashboardOptions) {
  return options.max_date ?? new Date().toISOString().slice(0, 10)
}

export function categoriesOf(options: DashboardOptions) {
  return PRODUCT_CATEGORIES.filter((category) => options.categories.includes(category.value))
}

export function defaultFilters(options: DashboardOptions): DashboardFilters {
  const end = lastDay(options)
  return {
    start: startForPeriod(end, 180),
    end,
    stores: options.stores.map((store) => store.slug),
    categories: [...options.categories],
    currency: "ARS",
    quote: "blue",
  }
}

export function validFilters(filters: DashboardFilters) {
  return filters.start < filters.end && filters.stores.length > 0 && filters.categories.length > 0
}

// localStorage puede contener una versión anterior, datos editados a mano o
// tiendas que el usuario ya no tiene asignadas.
export function parseSavedFilters(value: unknown, options: DashboardOptions): DashboardFilters | null {
  if (!value || typeof value !== "object") return null
  const saved = value as Record<string, unknown>
  const validDate = (date: unknown): date is string => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
    const timestamp = Date.parse(date)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
  }
  const validSelection = <T extends string>(items: unknown, allowed: readonly T[]): items is T[] =>
    Array.isArray(items) && items.length > 0 && items.length <= allowed.length
      && new Set(items).size === items.length
      && items.every((item) => typeof item === "string" && allowed.includes(item as T))
  if (!validDate(saved.start) || !validDate(saved.end)
    || saved.start >= saved.end || saved.end > lastDay(options)
    || !validSelection(saved.stores, options.stores.map((store) => store.slug))
    || !validSelection(saved.categories, options.categories)
    || (saved.currency !== "ARS" && saved.currency !== "USD")
    || (saved.quote !== "blue" && saved.quote !== "oficial")) return null
  return {
    start: saved.start, end: saved.end,
    stores: [...saved.stores], categories: [...saved.categories],
    currency: saved.currency, quote: saved.quote,
  }
}
