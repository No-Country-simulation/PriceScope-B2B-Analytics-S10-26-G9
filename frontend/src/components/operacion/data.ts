// UX10 · Operación: datos de muestra. La pantalla vive detrás de la sesión del
// backoffice, pero todavía no llama a la API; cuando entre el backend, scrapers
// y log salen de ahí y este archivo se borra (mismo camino que components/matriz).

import type { Tone } from "@/components/admin/tone"

export type ScraperStatus = "ok" | "fail" | "run"

export type Scraper = {
  id: string
  /** Tienda que alimenta: el mismo nombre que se usa en la matriz de precios. */
  store: string
  /** Motor y horario programado, p. ej. "Playwright · diario 05:00". */
  kind: string
  /** Estado de la última ejecución, antes de cualquier reintento manual. */
  status: ScraperStatus
  /** Última ejecución, en la zona del negocio. */
  lastRun: string
  duration: string
  /** Productos de la última ejecución; 0 cuando la ejecución falló. */
  products: number
  /** Cuántos productos esperaba encontrar. */
  expected: number
  /** Productos extraídos por día, de hace 6 días a hoy. */
  trend: number[]
  /** Cómo queda la ejecución cuando un reintento manual termina bien. */
  retry: { lastRun: string; duration: string; products: number }
}

export const STATUS_LABEL: Record<ScraperStatus, string> = {
  ok: "OK",
  fail: "Con fallo",
  run: "En curso…",
}

export const STATUS_TONE: Record<ScraperStatus, Tone> = {
  ok: "emerald",
  fail: "red",
  run: "sky",
}

/** Días de las barras de "últimos 7 días" (23/10 a 29/10). */
export const TREND_LABELS = ["23", "24", "25", "26", "27", "28", "29"]

export const SCRAPERS: Scraper[] = [
  {
    id: "delta",
    store: "Supermercado Delta",
    kind: "Playwright · diario 05:00",
    status: "ok",
    lastRun: "29/10 05:00",
    duration: "14 min",
    products: 612,
    expected: 620,
    trend: [598, 603, 605, 610, 608, 611, 612],
    retry: { lastRun: "29/10 09:42", duration: "11 min", products: 613 },
  },
  {
    id: "hiper-sur",
    store: "Hiper Sur",
    kind: "Playwright · diario 05:15",
    status: "ok",
    lastRun: "29/10 05:15",
    duration: "18 min",
    products: 548,
    expected: 560,
    trend: [540, 544, 546, 547, 545, 548, 548],
    retry: { lastRun: "29/10 09:44", duration: "17 min", products: 549 },
  },
  {
    id: "mercado-norte",
    store: "Mercado Norte",
    kind: "Scrapy · diario 05:30",
    status: "fail",
    lastRun: "29/10 05:30",
    duration: "3 min",
    products: 0,
    expected: 475,
    trend: [470, 472, 471, 474, 475, 468, 0],
    retry: { lastRun: "29/10 09:42", duration: "12 min", products: 475 },
  },
]

export const STORES = SCRAPERS.map((scraper) => scraper.store)

/** Un reintento manual que terminó bien tapa el estado inicial del scraper. */
function recovered(scraper: Scraper, status: ScraperStatus) {
  return status === "ok" && scraper.status === "fail"
}

/** Productos de la última ejecución; null mientras todavía corre. */
export function productsOf(scraper: Scraper, status: ScraperStatus) {
  if (status === "run") return null
  return recovered(scraper, status) ? scraper.retry.products : scraper.products
}

export function lastRunOf(scraper: Scraper, status: ScraperStatus) {
  if (status === "run") return "ahora"
  return recovered(scraper, status) ? scraper.retry.lastRun : scraper.lastRun
}

export function durationOf(scraper: Scraper, status: ScraperStatus) {
  if (status === "run") return "—"
  return recovered(scraper, status) ? scraper.retry.duration : scraper.duration
}

/** Serie de las barras: mientras corre apunta al objetivo, y tras un buen
    reintento cierra con lo que trajo. */
export function trendOf(scraper: Scraper, status: ScraperStatus) {
  const trend = scraper.trend.slice()
  const last = trend.length - 1
  if (status === "run") trend[last] = scraper.expected
  else if (recovered(scraper, status)) trend[last] = scraper.retry.products
  return trend
}

export type LogKind = "timeout" | "block" | "markup" | "invalid"

export type LogSeverity = "error" | "warning"

export type LogEntry = {
  id: string
  /** Fecha y hora en la zona del negocio. */
  date: string
  /** Horas desde la última ingesta: alimenta el filtro de período. */
  age: number
  store: string
  kind: LogKind
  severity: LogSeverity
  message: string
  /** Salida cruda del worker, para la fila expandida. */
  detail: string
}

export const LOG_KIND_LABEL: Record<LogKind, string> = {
  timeout: "Timeout",
  block: "Bloqueo (403)",
  markup: "Cambio de HTML",
  invalid: "Dato inválido",
}

export const SEVERITY_TONE: Record<LogSeverity, Tone> = {
  error: "red",
  warning: "amber",
}

export const DEFAULT_PERIOD = "72"

export const PERIOD_LABEL: Record<string, string> = {
  "24": "Últimas 24 horas",
  "72": "Últimas 72 horas",
  "168": "Últimos 7 días",
}

export const LOG_ENTRIES: LogEntry[] = [
  {
    id: "mn-timeout-2910",
    date: "29/10/2026 05:33",
    age: 4,
    store: "Mercado Norte",
    kind: "timeout",
    severity: "error",
    message: "La página de categoría no respondió en 30 s.",
    detail:
      "TimeoutError: page.goto: Timeout 30000ms exceeded.\n  url: /almacen?page=1\n  intento 3 de 3 · worker scrapy-02",
  },
  {
    id: "mn-403-2910",
    date: "29/10/2026 05:31",
    age: 4,
    store: "Mercado Norte",
    kind: "block",
    severity: "error",
    message: "El sitio devolvió 403 a la IP del worker.",
    detail:
      "HTTP 403 Forbidden\n  url: /lacteos?page=3\n  user-agent rotado · proxy pool B",
  },
  {
    id: "mn-selector-2810",
    date: "28/10/2026 05:44",
    age: 28,
    store: "Mercado Norte",
    kind: "markup",
    severity: "warning",
    message: "No se encontró el selector de precio en 7 productos.",
    detail:
      "SelectorNotFound: .price-box__regular\n  7 publicaciones afectadas · se usó el precio de ayer",
  },
  {
    id: "hs-precio-2710",
    date: "27/10/2026 05:20",
    age: 52,
    store: "Hiper Sur",
    kind: "invalid",
    severity: "warning",
    message: "Precio $ 0 descartado en 1 producto.",
    detail:
      "ValidationError: precio_local <= 0\n  publicación HS-88213 · marcado para revisión",
  },
  {
    id: "sd-timeout-2710",
    date: "27/10/2026 05:14",
    age: 52,
    store: "Supermercado Delta",
    kind: "timeout",
    severity: "warning",
    message: "Reintento automático exitoso.",
    detail:
      "TimeoutError en el intento 1 · OK en el intento 2\n  url: /bebidas?page=1 · worker pw-01",
  },
  {
    id: "sd-403-2610",
    date: "26/10/2026 05:02",
    age: 76,
    store: "Supermercado Delta",
    kind: "block",
    severity: "warning",
    message: "Bloqueo resuelto cambiando de proxy.",
    detail:
      "HTTP 403 en el intento 1 · proxy pool A\n  reintento 2 con proxy pool B · OK",
  },
]
