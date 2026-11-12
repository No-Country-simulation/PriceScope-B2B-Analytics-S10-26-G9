"use client"

import { DollarSignIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatArs, formatQuoteTime } from "@/lib/format"
import { QUOTE_LABEL, type Quote } from "@/lib/quotes"
import { useRates } from "@/lib/rates"

const QUOTE_ORDER: { quote: Quote; key: "official" | "blue" }[] = [
  { quote: "oficial", key: "official" },
  { quote: "blue", key: "blue" },
]

// Latest official and blue rates from GET /rates/latest.
export function QuotesCard() {
  const { status, latest } = useRates()
  const quotedAt = latest?.blue?.quoted_at ?? latest?.official?.quoted_at
  const gap = latest?.gap_pct != null ? Number(latest.gap_pct) : null

  return (
    <section
      aria-label="Cotización del dólar"
      aria-busy={status === "loading"}
      className="flex flex-col gap-3 rounded-lg border bg-background p-3 shadow-xs group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium">
          <span className="flex size-5 items-center justify-center rounded-md bg-brand/10 text-brand-deep dark:bg-brand/20 dark:text-indigo-300">
            <DollarSignIcon className="size-3" />
          </span>
          Cotización del dólar
        </span>
      </div>
      {status === "error" ? (
        <p className="text-xs text-muted-foreground">No pudimos cargar la cotización.</p>
      ) : (
        <>
          <dl className="flex flex-col gap-1.5">
            {QUOTE_ORDER.map(({ quote, key }) => {
              const sell = latest?.[key]?.sell
              return (
                <div key={quote} className="flex items-center justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground">{QUOTE_LABEL[quote]}</dt>
                  <dd className="font-mono font-medium tabular-nums">
                    {status === "loading" ? <Skeleton className="h-4 w-16" /> : sell != null ? formatArs(Number(sell)) : "—"}
                  </dd>
                </div>
              )
            })}
          </dl>
          <p className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span>{gap != null ? `Brecha ${gap.toFixed(1).replace(".", ",")} %` : "Brecha —"}</span>
            <span className="font-mono tabular-nums">{quotedAt ? formatQuoteTime(quotedAt) : ""}</span>
          </p>
        </>
      )}
    </section>
  )
}
