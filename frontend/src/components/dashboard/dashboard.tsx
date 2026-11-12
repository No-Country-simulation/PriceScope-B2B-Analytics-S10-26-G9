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
import { Skeleton } from "@/components/ui/skeleton"
import { query, type DashboardData, type DashboardOptions } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import { useAuth } from "@/lib/auth"
import { CATEGORY_LABEL, PRODUCT_CATEGORIES } from "@/lib/categories"
import { formatArs, formatPct, formatPP } from "@/lib/format"
import { QUOTE_LABEL, type Quote } from "@/lib/quotes"
import { useQuoteValues } from "@/lib/rates"
import { cn } from "@/lib/utils"

import { DashboardCharts } from "./dashboard-charts"
import {
  PERIODS,
  categoriesOf,
  defaultFilters,
  lastDay,
  parseSavedFilters,
  startForPeriod,
  validFilters,
  type Currency,
  type DashboardFilters,
} from "./filters"

const signedPP = (value: number) =>
  `${value >= 0 ? "+" : "−"}${formatPP(value)}`
const maybePct = (value: number | null) =>
  value === null ? "—" : formatPct(value)
const dateLabel = (date: string) => date.split("-").reverse().join("/")
const API_RATE: Record<Quote, "official" | "blue"> = {
  oficial: "official",
  blue: "blue",
}
const COLOR = Object.fromEntries(
  PRODUCT_CATEGORIES.map((category) => [category.value, category.color])
)

const currencyItems = [
  { label: "Pesos (ARS)", value: "ARS" },
  { label: "Dólares (USD)", value: "USD" },
]

const periodItems = PERIODS.map((days) => ({
  value: String(days),
  label: days === 365 ? "12 m" : `${days} d`,
}))

// Dashboard de inflación (UX04). Same building blocks as the price matrix:
// header, one filters card, KPI cards, then the charts and the table.
export function Dashboard() {
  const { user, request } = useAuth()
  const [options, setOptions] = React.useState<DashboardOptions | null>(null)
  const [optionsError, setOptionsError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    request<DashboardOptions>("/dashboard/options")
      .then((next) => { if (!cancelled) setOptions(next) })
      .catch(() => { if (!cancelled) setOptionsError(true) })
    return () => { cancelled = true }
  }, [request])

  if (optionsError) {
    return (
      <>
        <PageHeader title="Dashboard de inflación" />
        <StatusCard
          title="No pudimos cargar el dashboard."
          detail="Revisa tu conexión y vuelve a intentarlo."
        />
      </>
    )
  }
  if (!options || !user) return <DashboardSkeleton />
  // The index compares days: it needs prices on at least two of them.
  if (!options.stores.length || !options.max_date || options.min_date === options.max_date) {
    return (
      <>
        <PageHeader title="Dashboard de inflación" />
        <StatusCard
          title="Todavía no hay precios para mostrar."
          detail={!options.stores.length
            ? "Tu cuenta no tiene tiendas asignadas. Pídele a un administrador que te asigne al menos una."
            : !options.max_date
              ? "Tus tiendas aún no tienen precios relevados."
              : `Hay precios del ${dateLabel(options.max_date)}. El índice necesita al menos dos días de relevamiento.`}
        />
      </>
    )
  }
  return <DashboardView options={options} userId={user.id} />
}

function DashboardView({ options, userId }: { options: DashboardOptions; userId: string }) {
  const { request } = useAuth()
  const initial = React.useMemo(() => defaultFilters(options), [options])
  const [filters, setFilters] = React.useState<DashboardFilters>(initial)
  // v2: stores and categories are saved by slug and API value.
  const storageKey = `pricescope:dashboard:view:v2:${userId}`
  const [restoredKey, setRestoredKey] = React.useState<string | null>(null)
  const { values: quotes } = useQuoteValues()
  const quoteLabel = QUOTE_LABEL[filters.quote]
  const end = lastDay(options)
  const categories = categoriesOf(options)
  const storeName = Object.fromEntries(options.stores.map((store) => [store.slug, store.name]))
  const period =
    PERIODS.find(
      (days) => filters.start === startForPeriod(end, days) && filters.end === end
    ) ?? null

  React.useEffect(() => {
    let restored = initial
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = parseSavedFilters(JSON.parse(raw), options)
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
  }, [storageKey, options, initial])

  const path = validFilters(filters)
    ? `/dashboard${query({
        start: filters.start,
        end: filters.end,
        stores: filters.stores.join(","),
        categories: filters.categories.join(","),
        rate: API_RATE[filters.quote],
      })}`
    : null
  const [result, setResult] = React.useState<{
    path: string
    data: DashboardData | null
    error: boolean
  } | null>(null)

  React.useEffect(() => {
    if (!path || restoredKey !== storageKey) return
    let cancelled = false
    request<DashboardData>(path)
      .then((data) => { if (!cancelled) setResult({ path, data, error: false }) })
      .catch(() => { if (!cancelled) setResult({ path, data: null, error: true }) })
    return () => { cancelled = true }
  }, [request, path, restoredKey, storageKey])

  const loading = path !== null && result?.path !== path
  // While the next answer arrives, keep showing the previous one (dimmed).
  const data = result?.data ?? null
  const summary = path && data ? data.summary : null

  const quoteItems = (Object.keys(QUOTE_LABEL) as Quote[]).map((value) => ({
    label: `${QUOTE_LABEL[value]} · ${formatArs(quotes[value])}`,
    value,
  }))

  function saveView() {
    if (restoredKey !== storageKey) return
    const valid = parseSavedFilters(filters, options)
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
    if (!summary || !data) return
    const fixed = (value: number | null) => (value === null ? "" : value.toFixed(2))
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
        data.start ?? filters.start,
        data.end ?? filters.end,
        filters.stores.map((slug) => storeName[slug] ?? slug).join(" / "),
        quoteLabel,
        CATEGORY_LABEL[row.category],
        row.products,
        fixed(row.ars),
        fixed(row.usd),
        fixed(row.gap),
      ])
    )
  }

  let content: React.ReactNode
  if (!path) {
    content = (
      <StatusCard
        title="No hay datos para esta selección."
        detail="Selecciona al menos una tienda y una categoría, con una fecha inicial anterior a la final."
        onReset={() => setFilters(initial)}
      />
    )
  } else if (result?.path === path && result.error) {
    content = (
      <StatusCard
        title="No pudimos calcular el índice."
        detail="Vuelve a intentarlo en unos minutos."
      />
    )
  } else if (!data) {
    content = <ContentSkeleton />
  } else if (!summary) {
    content = (
      <StatusCard
        title="No hay precios en este período."
        detail="Prueba con un rango más amplio u otras tiendas."
        onReset={() => setFilters(initial)}
      />
    )
  } else {
    const shortPeriod = data.start !== filters.start
    content = (
      <div
        className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}
        aria-busy={loading}
      >
        {shortPeriod && data.start && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
            Hay precios desde el {dateLabel(data.start)}: el índice empieza ese día.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <KpiCard mono
            label="Inflación acumulada ARS"
            value={formatPct(summary.ars)}
            hint={`Índice 100 → ${(100 + summary.ars).toFixed(1).replace(".", ",")} en ${summary.days} días · ${summary.products} productos`}
            tone="brand"
            icon={<ChartNoAxesCombinedIcon />}
          />
          <KpiCard mono
            label="Inflación acumulada USD"
            value={maybePct(summary.usd)}
            hint={`Convertido al dólar ${quoteLabel.toLowerCase()} del día`}
            tone="sky"
            icon={<DollarSignIcon />}
          />
          <KpiCard mono
            label="Devaluación del período"
            value={maybePct(summary.devaluation)}
            hint={summary.rate_from !== null && summary.rate_to !== null
              ? `${formatArs(summary.rate_from)} → ${formatArs(summary.rate_to)} · ${quoteLabel}`
              : "Sin cotizaciones en el período"}
            tone="amber"
            icon={<ArrowRightLeftIcon />}
          />
          <KpiCard mono
            label="Brecha precios vs dólar"
            value={summary.gap === null ? "—" : signedPP(summary.gap)}
            hint={summary.gap === null
              ? "Sin cotizaciones en el período"
              : `Los precios subieron ${formatPP(summary.gap)} ${summary.gap >= 0 ? "más" : "menos"} que el dólar ${quoteLabel.toLowerCase()}.`}
            tone={(summary.gap ?? 0) >= 0 ? "red" : "emerald"}
            icon={<ScaleIcon />}
          />
        </div>

        <DashboardCharts filters={filters} data={data} />

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
                <TableRow key={row.category}>
                  <TableCell className="py-3 pl-(--card-spacing) font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ backgroundColor: COLOR[row.category] }}
                        aria-hidden="true"
                      />
                      {CATEGORY_LABEL[row.category]}
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
                    {maybePct(row.usd)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.gap === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ToneBadge
                        tone={row.gap >= 0 ? "red" : "emerald"}
                        className="ml-auto font-mono"
                      >
                        {row.gap >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                        {signedPP(row.gap)}
                      </ToneBadge>
                    )}
                  </TableCell>
                  <TableCell className="w-48 pr-(--card-spacing)">
                    <span
                      className="block h-1.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          (row.gap ?? 0) >= 0
                            ? "bg-red-500/60"
                            : "bg-emerald-500/60"
                        )}
                        style={{
                          width: `${Math.min(100, (Math.abs(row.gap ?? 0) / 18) * 100)}%`,
                        }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard de inflación"
        description={`¿Los precios suben más o menos que el dólar? Datos al ${dateLabel(end)}.`}
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={saveView}
              disabled={!path || restoredKey !== storageKey}
            >
              <BookmarkIcon data-icon="inline-start" />
              Guardar vista
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={exportCsv}
              disabled={!summary || loading}
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
            items={options.stores.map((store) => ({ value: store.slug, label: store.name }))}
            selected={filters.stores}
            onChange={(stores) => setFilters({ ...filters, stores })}
          />
          <MultiFilter
            id="dashboard-categories"
            label="Categorías"
            items={categories}
            selected={filters.categories}
            onChange={(selected) =>
              setFilters({
                ...filters,
                categories: categories
                  .map((category) => category.value)
                  .filter((value) => selected.includes(value)),
              })
            }
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
                start: startForPeriod(end, Number(next[0])),
                end,
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
              max={filters.end || end}
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
              max={end}
              onChange={(event) =>
                setFilters({ ...filters, end: event.target.value })
              }
            />
          </div>
          <Button
            variant="ghost"
            size="lg"
            className="sm:ml-auto"
            onClick={() => setFilters(initial)}
          >
            <XIcon data-icon="inline-start" />
            Limpiar filtros
          </Button>
        </div>

        <p className="flex items-center gap-2 px-(--card-spacing) py-3 text-xs text-muted-foreground">
          <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
          El índice usa el precio regular (las promociones no se incluyen) y
          el precio por gramo o unidad, así que la reduflación cuenta como
          suba.
        </p>
      </Card>

      {content}
    </>
  )
}

function StatusCard({ title, detail, onReset }: {
  title: string
  detail: string
  onReset?: () => void
}) {
  return (
    <Card className="shadow-xs" role="status">
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <SearchXIcon className="size-6" />
        <p className="font-medium text-foreground">{title}</p>
        <p>{detail}</p>
        {onReset && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onReset}>
            Restablecer filtros
          </Button>
        )}
      </div>
    </Card>
  )
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeader title="Dashboard de inflación" />
      <Skeleton className="h-40 rounded-xl" />
      <ContentSkeleton />
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
  items: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const summary =
    selected.length === items.length
      ? "Todas"
      : selected.length === 0
        ? "Ninguna"
        : selected.length === 1
          ? (items.find((item) => item.value === selected[0])?.label ?? selected[0])
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
              key={item.value}
              checked={selected.includes(item.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, item.value]
                    : selected.filter((value) => value !== item.value)
                )
              }
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
