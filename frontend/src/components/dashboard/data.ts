// UX04: fixture de demostración. No representa observaciones de la API.
export const SNAPSHOT_DATE = "2026-10-29"
export const SNAPSHOT_QUOTES = { blue: 1515, oficial: 1452 } as const
export const STORES = ["Supermercado Delta", "Hiper Sur", "Mercado Norte"] as const
export const PERIODS = [7, 30, 90, 180, 365] as const
export type Quote = "blue" | "oficial"
export type Currency = "ARS" | "USD"

export const CATEGORIES = [
  { name: "Almacén", inflation: 21.3, products: 412, color: "#2563eb" },
  { name: "Bebidas", inflation: 16.8, products: 238, color: "#ea580c" },
  { name: "Lácteos", inflation: 19.9, products: 176, color: "#0d9488" },
  { name: "Limpieza", inflation: 14.2, products: 204, color: "#9333ea" },
  { name: "Electro", inflation: 12.1, products: 318, color: "#ca8a04" },
  { name: "Indumentaria", inflation: 24.6, products: 287, color: "#db2777" },
] as const

const DAY = 86_400_000
const EVENTS = [
  { category: "Indumentaria", date: "2026-10-14", jump: 6.8 },
  { category: "Almacén", date: "2026-09-02", jump: 5.1 },
  { category: "Lácteos", date: "2026-08-26", jump: 4.4 },
  { category: "Electro", date: "2026-10-07", jump: 3.9 },
  { category: "Limpieza", date: "2026-07-22", jump: 3.2 },
]

function categoryIndex(category: (typeof CATEGORIES)[number], date: number) {
  const event = EVENTS.find((item) => item.category === category.name)
  const jump = event ? 1 + event.jump / 100 : 1
  const t = (date - Date.parse(SNAPSHOT_DATE)) / DAY / 180
  // Crecimiento continuo + salto; conserva el acumulado de UX04 a 180 días.
  return 100 * Math.pow((1 + category.inflation / 100) / jump, t)
    * (event && date < Date.parse(event.date) ? 1 / jump : 1)
}

function exchangeRate(date: number, quote: Quote) {
  const change = quote === "blue" ? 14.8 : 7.56
  const latest = SNAPSHOT_QUOTES[quote]
  return latest * Math.pow(1 + change / 100, (date - Date.parse(SNAPSHOT_DATE)) / DAY / 180)
}

export function startForPeriod(days: number) {
  return new Date(Date.parse(SNAPSHOT_DATE) - days * DAY).toISOString().slice(0, 10)
}

export const DEFAULT_FILTERS = {
  start: startForPeriod(180),
  end: SNAPSHOT_DATE,
  stores: [...STORES] as string[],
  categories: CATEGORIES.map((category) => category.name) as string[],
  currency: "ARS" as Currency,
  quote: "blue" as Quote,
}
export type DashboardFilters = typeof DEFAULT_FILTERS

// localStorage puede contener una versión anterior o datos editados manualmente.
export function parseSavedFilters(value: unknown): DashboardFilters | null {
  if (!value || typeof value !== "object") return null
  const saved = value as Record<string, unknown>
  const validDate = (date: unknown): date is string => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
    const timestamp = Date.parse(date)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
  }
  const validSelection = (items: unknown, allowed: readonly string[]): items is string[] =>
    Array.isArray(items) && items.length > 0 && items.length <= allowed.length
      && new Set(items).size === items.length
      && items.every((item) => typeof item === "string" && allowed.includes(item))
  if (!validDate(saved.start) || !validDate(saved.end)
    || saved.start >= saved.end || saved.end > SNAPSHOT_DATE
    || !validSelection(saved.stores, STORES)
    || !validSelection(saved.categories, CATEGORIES.map((category) => category.name))
    || (saved.currency !== "ARS" && saved.currency !== "USD")
    || (saved.quote !== "blue" && saved.quote !== "oficial")) return null
  return {
    start: saved.start, end: saved.end,
    stores: [...saved.stores], categories: [...saved.categories],
    currency: saved.currency, quote: saved.quote,
  }
}

// Una sola base para las tarjetas, la tabla y, después, los gráficos.
// Las tasas son sintéticas; los filtros nunca consultan el backend compartido.
export function summarize(filters: DashboardFilters) {
  const startDay = Date.parse(filters.start)
  const endDay = Date.parse(filters.end)
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || startDay >= endDay) {
    return null
  }
  if (!filters.stores.length || !filters.categories.length) return null
  const days = Math.round((endDay - startDay) / DAY)
  const rateFrom = exchangeRate(startDay, filters.quote)
  const rateTo = exchangeRate(endDay, filters.quote)
  const devaluation = (rateTo / rateFrom - 1) * 100
  const rows = CATEGORIES.filter((category) => filters.categories.includes(category.name))
    .map((category) => {
      // Participaciones sintéticas por tienda, constantes durante el período.
      const share = filters.stores.reduce((sum, store) => {
        const index = STORES.findIndex((name) => name === store)
        return sum + [0.4, 0.35, 0.25][index]
      }, 0)
      const ars = (categoryIndex(category, endDay) / categoryIndex(category, startDay) - 1) * 100
      return {
        name: category.name,
        color: category.color,
        products: Math.round(category.products * share),
        ars,
        usd: ((1 + ars / 100) / (rateTo / rateFrom) - 1) * 100,
        gap: ars - devaluation,
      }
    }).sort((a, b) => b.gap - a.gap)
  const products = rows.reduce((sum, row) => sum + row.products, 0)
  const ars = rows.reduce((sum, row) => sum + row.ars * row.products, 0) / products
  const usd = ((1 + ars / 100) / (rateTo / rateFrom) - 1) * 100
  return { days, rows, ars, usd, devaluation, gap: ars - devaluation, rateFrom, rateTo }
}

export type DashboardSummary = NonNullable<ReturnType<typeof summarize>>

export function chartData(filters: DashboardFilters, summary: DashboardSummary) {
  const start = Date.parse(filters.start)
  const selected = CATEGORIES.filter((category) => filters.categories.includes(category.name))
  const total = summary.rows.reduce((sum, row) => sum + row.products, 0)
  const series = Array.from({ length: summary.days + 1 }, (_, day) => {
    const timestamp = start + day * DAY
    const date = new Date(timestamp).toISOString().slice(0, 10)
    const categories: Record<string, number> = {}
    let ars = 0
    const rate = exchangeRate(timestamp, filters.quote)
    for (const category of selected) {
      const index = categoryIndex(category, timestamp) / categoryIndex(category, start) * 100
      const weight = summary.rows.find((row) => row.name === category.name)!.products / total
      ars += index * weight
      categories[category.name] = filters.currency === "USD" ? index * summary.rateFrom / rate : index
    }
    return { date, ars, usd: ars * summary.rateFrom / rate, rate, categories }
  })

  // Un punto por categoría y mes; los meses de los extremos pueden ser parciales.
  const scatter: { category: string; month: string; price: number; fx: number }[] = []
  let cursor = start
  const end = Date.parse(filters.end)
  while (cursor < end) {
    const current = new Date(cursor)
    const next = Math.min(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1), end)
    for (const category of selected) {
      scatter.push({
        category: category.name,
        month: new Date(cursor).toISOString().slice(0, 7),
        price: (categoryIndex(category, next) / categoryIndex(category, cursor) - 1) * 100,
        fx: (exchangeRate(next, filters.quote) / exchangeRate(cursor, filters.quote) - 1) * 100,
      })
    }
    cursor = next
  }
  const peaks = EVENTS.filter((event) => filters.categories.includes(event.category)
    && Date.parse(event.date) > start && Date.parse(event.date) <= end)
    .map((event) => {
      const category = selected.find((item) => item.name === event.category)!
      const timestamp = Date.parse(event.date)
      const before = Math.max(start, timestamp - 7 * DAY)
      const value = (categoryIndex(category, timestamp) / categoryIndex(category, before) - 1) * 100
      return { ...event, value, color: category.color }
    }).filter((event) => event.value > 3).sort((a, b) => b.value - a.value)
  return { series, scatter, peaks }
}
