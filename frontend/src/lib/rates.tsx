"use client"

import * as React from "react"

import { type LatestRates } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { QUOTES, type Quote } from "@/lib/quotes"

// Rates are ingested hourly; checking every half hour keeps the header fresh
// without hammering the API.
const REFRESH_MS = 30 * 60 * 1000

type RatesStatus = "loading" | "ready" | "error"

type RatesContextValue = {
  status: RatesStatus
  latest: LatestRates | null
}

const RatesContext = React.createContext<RatesContextValue | null>(null)

// One request for the whole client app: the sidebar card and every screen
// that converts ARS → USD read the same value.
export function RatesProvider({ children }: { children: React.ReactNode }) {
  const { request } = useAuth()
  const [value, setValue] = React.useState<RatesContextValue>({ status: "loading", latest: null })

  React.useEffect(() => {
    let cancelled = false
    const load = () =>
      request<LatestRates>("/rates/latest")
        .then((latest) => { if (!cancelled) setValue({ status: "ready", latest }) })
        // Keep the last good value if a refresh fails.
        .catch(() => { if (!cancelled) setValue((prev) => prev.latest ? prev : { status: "error", latest: null }) })
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [request])

  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>
}

export function useRates(): RatesContextValue {
  const value = React.useContext(RatesContext)
  if (!value) throw new Error("useRates must be used inside RatesProvider")
  return value
}

const API_KEY: Record<Quote, "official" | "blue"> = { oficial: "official", blue: "blue" }

/** Sell rate of each quote: the API value when there is one, the sample otherwise.
    `live` tells the UI whether it is showing real rates. */
export function useQuoteValues(): { values: Record<Quote, number>; live: boolean } {
  const { latest } = useRates()
  return React.useMemo(() => {
    const values = { ...QUOTES } as Record<Quote, number>
    let live = false
    for (const quote of Object.keys(API_KEY) as Quote[]) {
      const sell = latest?.[API_KEY[quote]]?.sell
      if (sell != null) {
        values[quote] = Number(sell)
        live = true
      }
    }
    return { values, live }
  }, [latest])
}
