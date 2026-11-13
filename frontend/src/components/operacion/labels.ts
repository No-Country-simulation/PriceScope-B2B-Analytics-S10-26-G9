import type { Tone } from "@/components/admin/tone"
import type { OperationErrorKind, StoreOverview } from "@/lib/api"

// queued: a manual run was requested and the worker has not picked it up yet.
export type ScraperStatus = "ok" | "fail" | "run" | "queued" | "never"

export const STATUS_LABEL: Record<ScraperStatus, string> = {
  ok: "OK",
  fail: "Con fallo",
  run: "En curso…",
  queued: "En cola…",
  never: "Sin ejecuciones",
}

export const STATUS_TONE: Record<ScraperStatus, Tone> = {
  ok: "emerald",
  fail: "red",
  run: "sky",
  queued: "sky",
  never: "neutral",
}

/** A requested run counts as picked up once a run started after (or close to) the request. */
export function pickedUp(store: StoreOverview, queuedAt: string) {
  const run = store.last_run
  return run !== null && Date.parse(run.started_at) >= Date.parse(queuedAt) - 5_000
}

export function statusOf(store: StoreOverview, queuedAt: string | undefined): ScraperStatus {
  if (queuedAt && !pickedUp(store, queuedAt)) return "queued"
  const run = store.last_run
  if (!run) return "never"
  if (run.status === "running") return "run"
  return run.status === "success" ? "ok" : "fail"
}

export const LOG_KIND_LABEL: Record<OperationErrorKind, string> = {
  timeout: "Timeout",
  network: "Error de red",
  block: "Bloqueo (403/429)",
  server: "Error del sitio (5xx)",
  markup: "Formato inesperado",
  interrupted: "Interrumpida",
  other: "Otro",
}

export const SEVERITY_TONE: Record<"error" | "warning", Tone> = {
  error: "red",
  warning: "amber",
}

export const DEFAULT_PERIOD = "72"

export const PERIOD_LABEL: Record<string, string> = {
  "24": "Últimas 24 horas",
  "72": "Últimas 72 horas",
  "168": "Últimos 7 días",
}
