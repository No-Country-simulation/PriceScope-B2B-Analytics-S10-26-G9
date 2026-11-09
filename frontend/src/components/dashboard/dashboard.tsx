"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowRightLeftIcon,
  ArrowUpIcon,
  BookmarkIcon,
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  DollarSignIcon,
  DownloadIcon,
  InfoIcon,
  ScaleIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { KpiCard } from "@/components/admin/kpi-card"
import { ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { downloadCsv } from "@/lib/csv"
import { useAuth } from "@/lib/auth"
import { formatArs, formatPct, formatPP } from "@/lib/format"
import { QUOTE_LABEL } from "@/lib/quotes"
import { cn } from "@/lib/utils"

import { DashboardCharts } from "./dashboard-charts"
import {
  CATEGORIES,
  DEFAULT_FILTERS,
  PERIODS,
  SNAPSHOT_DATE,
  SNAPSHOT_QUOTES,
  STORES,
  parseSavedFilters,
  startForPeriod,
  summarize,
  type Currency,
  type Quote,
} from "./data"

const signedPP = (value: number) =>
  `${value >= 0 ? "+" : "−"}${formatPP(value)}`

const currencyItems = [
  { label: "Pesos (ARS)", value: "ARS" },
  { label: "Dólares (USD)", value: "USD" },
]

const quoteItems = (Object.keys(SNAPSHOT_QUOTES) as Quote[]).map((value) => ({
  label: `${QUOTE_LABEL[value]} · ${formatArs(SNAPSHOT_QUOTES[value])}`,
  value,
}))

const periodItems = PERIODS.map((days) => ({
  value: String(days),
  label: days === 365 ? "12 m" : `${days} d`,
}))

// Dashboard de inflación (UX04). Same building blocks as the price matrix:
// header, one filters card, KPI cards, then the charts and the table.
export function Dashboard() {
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS)
  const { user } = useAuth()
  const storageKey = user ? `pricescope:dashboard:view:v1:${user.id}` : null
  const [restoredKey, setRestoredKey] = React.useState<string | null>(null)
  const summary = summarize(filters)
  const quoteLabel = QUOTE_LABEL[filters.quote]
  const period =
    PERIODS.find(
      (days) =>
        filters.start === startForPeriod(days) && filters.end === SNAPSHOT_DATE
    ) ?? null

  React.useEffect(() => {
    if (!storageKey) return
    let restored = DEFAULT_FILTERS
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = parseSavedFilters(JSON.parse(raw))
        if (parsed) restored = parsed
        else
          toast.warning(
            "La vista guardada ya no es válida. Usamos los filtros iniciales."
          )
      }
    } catch {
      toast.warning(
        "No pudimos recuperar la vista guardada. Puedes seguir usando los filtros."
      )
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
      toast.error(
        "Revisa las fechas y selecciona al menos una tienda y una categoría."
      )
      return
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(valid))
      toast.success("Vista guardada", {
        description:
          "Recuperaremos estos filtros cuando vuelvas con esta cuenta en este navegador.",
      })
    } catch {
      toast.error(
        "No pudimos guardar la vista. Comprueba que el navegador permita almacenamiento local."
      )
    }
  }

  function exportCsv() {
    if (!summary) return
    downloadCsv(
      "inflacion-por-categoria.csv",
      [
        "Desde",
        "Hasta",
        "Tiendas",
        "Cotización",
        "Categoría",
        "Productos",
        "Inflación ARS (%)",
        "Inflación USD (%)",
        "Brecha (p.p.)",
      ],
      summary.rows.map((row) => [
        filters.start,
        filters.end,
        filters.stores.join(" / "),
        quoteLabel,
        row.name,
        row.products,
        row.ars.toFixed(2),
        row.usd.toFixed(2),
        row.gap.toFixed(2),
      ])
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard de inflación"
        description="¿Los precios suben más o menos que el dólar? Datos al 29/10/2026 06:00."
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={saveView}
              disabled={!summary || !storageKey || restoredKey !== storageKey}
            >
              <BookmarkIcon data-icon="inline-start" />
              Guardar vista
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={exportCsv}
              disabled={!summary}
            >
              <DownloadIcon data-icon="inline-start" />
              Exportar
            </Button>
          </>
        }
      />

      <Card className="gap-0 py-0 shadow-xs">
        <div className="grid gap-4 border-b p-(--card-spacing) sm:grid-cols-2 lg:grid-cols-4">
          <MultiFilter
            id="dashboard-stores"
            label="Tiendas"
            items={STORES}
            selected={filters.stores}
            onChange={(stores) => setFilters({ ...filters, stores })}
          />
          <MultiFilter
            id="dashboard-categories"
            label="Categorías"
            items={CATEGORIES.map((category) => category.name)}
            selected={filters.categories}
            onChange={(categories) => setFilters({ ...filters, categories })}
          />
          <FilterSelect
            id="dashboard-currency"
            label="Moneda principal"
            items={currencyItems}
            value={filters.currency}
            onChange={(currency) =>
              setFilters({ ...filters, currency: currency as Currency })
            }
          />
          <FilterSelect
            id="dashboard-quote"
            label="Cotización"
            items={quoteItems}
            value={filters.quote}
            onChange={(quote) =>
              setFilters({ ...filters, quote: quote as Quote })
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b p-(--card-spacing)">
          <ToggleGroup
            aria-label="Período"
            value={period ? [String(period)] : []}
            variant="outline"
            spacing={0}
            onValueChange={(next) => {
              if (!next.length) return
              setFilters({
                ...filters,
                start: startForPeriod(Number(next[0])),
                end: SNAPSHOT_DATE,
              })
            }}
          >
            {periodItems.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className="h-9 px-3"
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Label
              htmlFor="dashboard-start"
              className="text-muted-foreground"
            >
              Desde
            </Label>
            <Input
              id="dashboard-start"
              type="date"
              className="h-9 w-38"
              value={filters.start}
              max={filters.end || SNAPSHOT_DATE}
              onChange={(event) =>
                setFilters({ ...filters, start: event.target.value })
              }
            />
            <Label htmlFor="dashboard-end" className="text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="dashboard-end"
              type="date"
              className="h-9 w-38"
              value={filters.end}
              min={filters.start}
              max={SNAPSHOT_DATE}
              onChange={(event) =>
                setFilters({ ...filters, end: event.target.value })
              }
            />
          </div>
          <Button
            variant="ghost"
            size="lg"
            className="sm:ml-auto"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            <XIcon data-icon="inline-start" />
            Limpiar filtros
          </Button>
        </div>

        <p className="flex items-center gap-2 px-(--card-spacing) py-3 text-xs text-muted-foreground">
          <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
          El índice se calcula con el precio regular; las promociones no se
          incluyen.
        </p>
      </Card>

      {summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <KpiCard mono
              label="Inflación acumulada ARS"
              value={formatPct(summary.ars)}
              hint={`Índice 100 → ${(100 + summary.ars).toFixed(1).replace(".", ",")} en ${summary.days} días`}
              tone="brand"
              icon={<ChartNoAxesCombinedIcon />}
            />
            <KpiCard mono
              label="Inflación acumulada USD"
              value={formatPct(summary.usd)}
              hint={`Convertido al dólar ${quoteLabel.toLowerCase()} del día`}
              tone="sky"
              icon={<DollarSignIcon />}
            />
            <KpiCard mono
              label="Devaluación del período"
              value={formatPct(summary.devaluation)}
              hint={`${formatArs(summary.rateFrom)} → ${formatArs(summary.rateTo)} · ${quoteLabel}`}
              tone="amber"
              icon={<ArrowRightLeftIcon />}
            />
            <KpiCard mono
              label="Brecha precios vs dólar"
              value={signedPP(summary.gap)}
              hint={`Los precios subieron ${formatPP(summary.gap)} ${summary.gap >= 0 ? "más" : "menos"} que el dólar ${quoteLabel.toLowerCase()}.`}
              tone={summary.gap >= 0 ? "red" : "emerald"}
              icon={<ScaleIcon />}
            />
          </div>

          <DashboardCharts filters={filters} summary={summary} />

          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="border-b py-(--card-spacing)">
              <CardTitle>
                <h3>Inflación acumulada por categoría</h3>
              </CardTitle>
              <CardDescription>
                Ordenado por brecha · moneda principal {filters.currency} ·
                comparación con dólar {quoteLabel.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <Table
              aria-label="Inflación acumulada por categoría"
              className="min-w-[760px]"
            >
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-(--card-spacing)">Categoría</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Inflación ARS</TableHead>
                  <TableHead className="text-right">Inflación USD</TableHead>
                  <TableHead className="text-right" aria-sort="descending">
                    <span className="inline-flex items-center gap-1">
                      Brecha
                      <ArrowDownIcon className="size-3.5" aria-hidden="true" />
                    </span>
                  </TableHead>
                  <TableHead className="pr-(--card-spacing)">
                    vs {quoteLabel}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="py-3 pl-(--card-spacing) font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-sm"
                          style={{ backgroundColor: row.color }}
                          aria-hidden="true"
                        />
                        {row.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                      {row.products}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        filters.currency === "ARS"
                          ? "font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatPct(row.ars)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        filters.currency === "USD"
                          ? "font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatPct(row.usd)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ToneBadge
                        tone={row.gap >= 0 ? "red" : "emerald"}
                        className="ml-auto font-mono"
                      >
                        {row.gap >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                        {signedPP(row.gap)}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="w-48 pr-(--card-spacing)">
                      <span
                        className="block h-1.5 overflow-hidden rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            row.gap >= 0
                              ? "bg-red-500/60"
                              : "bg-emerald-500/60"
                          )}
                          style={{
                            width: `${Math.min(100, (Math.abs(row.gap) / 18) * 100)}%`,
                          }}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <Card className="shadow-xs" role="status">
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <SearchXIcon className="size-6" />
            <p className="font-medium text-foreground">
              No hay datos para esta selección.
            </p>
            <p>
              Selecciona al menos una tienda y una categoría, con una fecha
              inicial anterior a la final.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Restablecer filtros
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}

function FilterSelect({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string
  label: string
  items: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => next && onChange(next)}
      >
        <SelectTrigger id={id} className="h-9! w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function MultiFilter({
  id,
  label,
  items,
  selected,
  onChange,
}: {
  id: string
  label: string
  items: readonly string[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const summary =
    selected.length === items.length
      ? "Todas"
      : selected.length === 0
        ? "Ninguna"
        : selected.length === 1
          ? selected[0]
          : `${selected.length} de ${items.length}`

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              id={id}
              variant="outline"
              className="h-9 w-full justify-between font-normal"
            />
          }
        >
          <span className="truncate">{summary}</span>
          <ChevronDownIcon
            data-icon="inline-end"
            className="text-muted-foreground"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-(--anchor-width)">
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item}
              checked={selected.includes(item)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, item]
                    : selected.filter((value) => value !== item)
                )
              }
            >
              {item}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
