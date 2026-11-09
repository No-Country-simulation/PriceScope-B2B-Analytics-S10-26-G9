import { DollarSignIcon } from "lucide-react"

import { SNAPSHOT_QUOTES } from "@/components/dashboard/data"
import { formatArs } from "@/lib/format"
import { QUOTE_LABEL, type Quote } from "@/lib/quotes"

// Cotizaciones de muestra (mismo snapshot que UX04). Cuando entre la API, el
// valor y la hora salen de ahí.
const QUOTE_ORDER: Quote[] = ["oficial", "blue"]
const gap = ((SNAPSHOT_QUOTES.blue - SNAPSHOT_QUOTES.oficial) / SNAPSHOT_QUOTES.oficial) * 100

export function QuotesCard() {
  return (
    <section
      aria-label="Cotización del dólar"
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
      <dl className="flex flex-col gap-1.5">
        {QUOTE_ORDER.map((quote) => (
          <div key={quote} className="flex items-center justify-between gap-2 text-sm">
            <dt className="text-muted-foreground">{QUOTE_LABEL[quote]}</dt>
            <dd className="font-mono font-medium tabular-nums">
              {formatArs(SNAPSHOT_QUOTES[quote])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
        <span>Brecha {gap.toFixed(1).replace(".", ",")} %</span>
        <span className="font-mono tabular-nums">29/10 · 06:00</span>
      </p>
    </section>
  )
}
