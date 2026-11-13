"use client"

import * as React from "react"

import type { OperationOverview } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// The sidebar checks once a minute; the Operation screen, which polls faster,
// shares what it reads so the badge does not lag behind it.
const REFRESH_MS = 60_000
const OPERATION_CHANGED = "pricescope:operation-changed"

export function shareOperationOverview(overview: OperationOverview) {
  window.dispatchEvent(new CustomEvent(OPERATION_CHANGED, { detail: overview }))
}

type OperationStatus =
  | { tone: "fail"; count: number; label: string }
  | { tone: "stale" | "running" | "ok"; label: string }

export function operationStatus(overview: OperationOverview): OperationStatus | null {
  const stores = overview.stores
  if (!stores.length) return null
  const failed = stores.filter((store) => store.last_run?.status === "failed").length
  if (failed) {
    return {
      tone: "fail",
      count: failed,
      label: failed === 1 ? "1 scraper con fallo" : `${failed} scrapers con fallo`,
    }
  }
  if (!overview.rates.ok) return { tone: "stale", label: "Cotizaciones atrasadas" }
  if (stores.some((store) => store.last_run?.status === "running")) {
    return { tone: "running", label: "Extracción en curso" }
  }
  return { tone: "ok", label: "Scrapers OK" }
}

export function useOperationStatus() {
  const { data, reload } = useApi<OperationOverview>("/admin/scraping/overview")
  const [shared, setShared] = React.useState<OperationOverview | null>(null)

  React.useEffect(() => {
    const timer = window.setInterval(reload, REFRESH_MS)
    const onShare = (event: Event) => setShared((event as CustomEvent<OperationOverview>).detail)
    window.addEventListener(OPERATION_CHANGED, onShare)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(OPERATION_CHANGED, onShare)
    }
  }, [reload])

  // Whichever arrived last: a shared value is cleared when the own poll answers.
  const [latest, setLatest] = React.useState<OperationOverview | null>(null)
  React.useEffect(() => {
    if (data) React.startTransition(() => { setLatest(data); setShared(null) })
  }, [data])
  const overview = shared ?? latest
  return overview ? operationStatus(overview) : null
}

const DOT: Record<Exclude<OperationStatus["tone"], "fail">, string> = {
  ok: "bg-emerald-500",
  stale: "bg-amber-500",
  running: "bg-sky-500 animate-pulse",
}

export function OperationStatusBadge({ status }: { status: OperationStatus }) {
  if (status.tone === "fail") {
    return (
      <span className="rounded-md bg-red-500/15 px-1.5 text-xs font-semibold text-red-700 tabular-nums dark:text-red-400">
        {status.count}
        <span className="sr-only"> {status.label}</span>
      </span>
    )
  }
  return (
    <span className="flex size-5 items-center justify-center">
      <span className={cn("size-2 rounded-full", DOT[status.tone])} aria-hidden="true" />
      <span className="sr-only">{status.label}</span>
    </span>
  )
}
