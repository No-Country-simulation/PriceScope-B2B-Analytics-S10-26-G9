"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, BookmarkIcon, ChevronDownIcon, DownloadIcon, InfoIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { downloadCsv } from "@/lib/csv"
import { useAuth } from "@/lib/auth"
import { formatArs, formatPct, formatPP } from "@/lib/format"
import { QUOTE_LABEL } from "@/lib/quotes"
import { cn } from "@/lib/utils"
import { CATEGORIES, DEFAULT_FILTERS, PERIODS, SNAPSHOT_DATE, STORES, parseSavedFilters, startForPeriod, summarize, type Currency, type Quote } from "./data"
import { DashboardCharts } from "./dashboard-charts"

const signedPP = (value: number) => `${value >= 0 ? "+" : "−"}${formatPP(value)}`

export function Dashboard() {
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS)
  const { user } = useAuth()
  const storageKey = user ? `pricescope:dashboard:view:v1:${user.id}` : null
  const [restoredKey, setRestoredKey] = React.useState<string | null>(null)
  const summary = summarize(filters)
  const quoteLabel = QUOTE_LABEL[filters.quote]

  React.useEffect(() => {
    if (!storageKey) return
    let restored = DEFAULT_FILTERS
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = parseSavedFilters(JSON.parse(raw))
        if (parsed) restored = parsed
        else toast.warning("La vista guardada ya no es válida. Usamos los filtros iniciales.")
      }
    } catch {
      toast.warning("No pudimos recuperar la vista guardada. Puedes seguir usando los filtros.")
    }
    // Sincroniza los filtros con el almacenamiento externo al restaurar la sesión.
    React.startTransition(() => {
      setFilters(restored)
      setRestoredKey(storageKey)
    })
  }, [storageKey])

  function saveView() {
    if (!storageKey || restoredKey !== storageKey || !summary) return
    const valid = parseSavedFilters(filters)
    if (!valid) {
      toast.error("Revisa las fechas y selecciona al menos una tienda y una categoría.")
      return
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(valid))
      toast.success("Vista guardada", { description: "Recuperaremos estos filtros cuando vuelvas con esta cuenta en este navegador." })
    } catch {
      toast.error("No pudimos guardar la vista. Comprueba que el navegador permita almacenamiento local.")
    }
  }

  function exportCsv() {
    if (!summary) return
    downloadCsv("inflacion-por-categoria.csv",
      ["Desde", "Hasta", "Tiendas", "Cotización", "Categoría", "Productos", "Inflación ARS (%)", "Inflación USD (%)", "Brecha (p.p.)"],
      summary.rows.map((row) => [filters.start, filters.end, filters.stores.join(" / "), quoteLabel,
        row.name, row.products, row.ars.toFixed(2), row.usd.toFixed(2), row.gap.toFixed(2)]))
  }

  return (
    <>
      <PageHeader title="Dashboard de inflación"
        description="¿Los precios suben más o menos que el dólar? Datos al 29/10/2026 06:00."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveView} disabled={!summary || !storageKey || restoredKey !== storageKey}>
            <BookmarkIcon data-icon="inline-start" />Guardar vista
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!summary}>
            <DownloadIcon data-icon="inline-start" />Exportar CSV
          </Button>
        </div>} />

      <Card className="gap-4 p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Período</span>
            <Segments label="Período" value={String(PERIODS.find((days) => filters.start === startForPeriod(days) && filters.end === SNAPSHOT_DATE) ?? "custom")}
              items={PERIODS.map((days) => ({ value: String(days), label: days === 365 ? "12 m" : `${days} d` }))}
              onChange={(value) => setFilters({ ...filters, start: startForPeriod(Number(value)), end: SNAPSHOT_DATE })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dashboard-start">Desde</Label>
              <Input id="dashboard-start" type="date" className="w-36" value={filters.start} max={filters.end || SNAPSHOT_DATE}
                onChange={(event) => setFilters({ ...filters, start: event.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dashboard-end">Hasta</Label>
              <Input id="dashboard-end" type="date" className="w-36" value={filters.end} min={filters.start} max={SNAPSHOT_DATE}
                onChange={(event) => setFilters({ ...filters, end: event.target.value })} />
            </div>
          </div>
          <MultiFilter label="Tiendas" items={STORES} selected={filters.stores}
            onChange={(stores) => setFilters({ ...filters, stores })} />
          <MultiFilter label="Categorías" items={CATEGORIES.map((category) => category.name)} selected={filters.categories}
            onChange={(categories) => setFilters({ ...filters, categories })} />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Moneda principal</span>
            <Segments label="Moneda principal" value={filters.currency} items={[{ value: "ARS", label: "ARS" }, { value: "USD", label: "USD" }]}
              onChange={(currency) => setFilters({ ...filters, currency: currency as Currency })} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Cotización</span>
            <Segments label="Cotización" value={filters.quote} items={[{ value: "oficial", label: "Oficial" }, { value: "blue", label: "Blue" }]}
              onChange={(quote) => setFilters({ ...filters, quote: quote as Quote })} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            <XIcon data-icon="inline-start" />Limpiar filtros
          </Button>
        </div>
      </Card>

      {summary ? (
        <>
          <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <Metric label="Inflación acumulada ARS" value={formatPct(summary.ars)} change={summary.ars}
              hint={`Índice 100 → ${(100 + summary.ars).toFixed(1).replace(".", ",")} en ${summary.days} días`} />
            <Metric label="Inflación acumulada USD" value={formatPct(summary.usd)} change={summary.usd}
              hint={`Convertido al dólar ${quoteLabel.toLowerCase()} del día`} />
            <Metric label="Devaluación del período" value={formatPct(summary.devaluation)}
              badge={<ToneBadge tone="neutral">{quoteLabel}</ToneBadge>}
              hint={`${formatArs(summary.rateFrom)} → ${formatArs(summary.rateTo)}`} />
            <Metric label="Brecha" value={signedPP(summary.gap)} change={summary.gap} gap
              hint={`Los precios subieron ${formatPP(summary.gap)} ${summary.gap >= 0 ? "más" : "menos"} que el dólar ${quoteLabel.toLowerCase()}.`} />
          </div>

          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>El índice se calcula con el precio regular; las promociones no se incluyen.</p>
          </div>

          <DashboardCharts filters={filters} summary={summary} />

          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="py-5">
              <CardTitle><h3>Inflación acumulada por categoría</h3></CardTitle>
              <CardDescription>Ordenado por brecha · moneda principal: {filters.currency} · comparación con {quoteLabel}</CardDescription>
            </CardHeader>
            <Table aria-label="Inflación acumulada por categoría" className="min-w-[760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Categoría</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Inflación ARS</TableHead>
                  <TableHead className="text-right">Inflación USD</TableHead>
                  <TableHead className="text-right" aria-sort="descending">Brecha ↓</TableHead>
                  <TableHead className="pr-5">vs {quoteLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="py-4 pl-5 font-medium">
                      <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.name}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{row.products}</TableCell>
                    <TableCell className={cn("text-right font-mono", filters.currency === "ARS" && "font-semibold")}>{formatPct(row.ars)}</TableCell>
                    <TableCell className={cn("text-right font-mono", filters.currency === "USD" && "font-semibold")}>{formatPct(row.usd)}</TableCell>
                    <TableCell className="text-right"><ToneBadge tone={row.gap >= 0 ? "red" : "emerald"} className="ml-auto font-mono">
                      {row.gap >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}{signedPP(row.gap)}
                    </ToneBadge></TableCell>
                    <TableCell className="w-48 pr-5"><span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className={cn("block h-full rounded-full", row.gap >= 0 ? "bg-orange-500" : "bg-blue-500")}
                        style={{ width: `${Math.min(100, Math.abs(row.gap) / 18 * 100)}%` }} />
                    </span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center" role="status">
          <p className="font-medium">No hay datos para esta selección.</p>
          <p className="text-sm text-muted-foreground">Selecciona al menos una tienda y una categoría, con una fecha inicial anterior a la final.</p>
          <Button variant="outline" className="mx-auto" onClick={() => setFilters(DEFAULT_FILTERS)}>Restablecer filtros</Button>
        </Card>
      )}
    </>
  )
}

function Segments({ label, value, items, onChange }: {
  label: string; value: string; items: { value: string; label: string }[]; onChange: (value: string) => void
}) {
  return <ToggleGroup aria-label={label} value={[value]} size="sm" spacing={0} variant="outline"
    onValueChange={(next) => { if (next.length) onChange(next[0]) }}>
    {items.map((item) => <ToggleGroupItem key={item.value} value={item.value}>{item.label}</ToggleGroupItem>)}
  </ToggleGroup>
}

function MultiFilter({ label, items, selected, onChange }: {
  label: string; items: readonly string[]; selected: string[]; onChange: (value: string[]) => void
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
      {label} · {selected.length} de {items.length}<ChevronDownIcon data-icon="inline-end" />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="min-w-52">
      {items.map((item) => <DropdownMenuCheckboxItem key={item} checked={selected.includes(item)}
        onCheckedChange={(checked) => onChange(checked ? [...selected, item] : selected.filter((value) => value !== item))}>
        {item}
      </DropdownMenuCheckboxItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}

function Metric({ label, value, hint, badge, change, gap = false }: {
  label: string; value: string; hint: string; badge?: React.ReactNode; change?: number; gap?: boolean
}) {
  const up = change !== undefined && change >= 0
  return <Card className="shadow-xs">
    <CardHeader className="flex h-full flex-col gap-3">
      <div className="flex w-full flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        {badge ?? (change !== undefined && <ToneBadge tone={up ? "red" : "emerald"}>
          {up ? <ArrowUpIcon /> : <ArrowDownIcon />}{gap ? (up ? "precios > dólar" : "precios < dólar") : (up ? "sube" : "baja")}
        </ToneBadge>)}
      </div>
      <p className={cn("font-mono text-3xl font-semibold tracking-tight tabular-nums", gap && (up ? "text-red-700" : "text-emerald-700"))}>{value}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </CardHeader>
  </Card>
}
