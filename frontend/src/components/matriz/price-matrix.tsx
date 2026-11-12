"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  PackageSearchIcon,
  PercentIcon,
  SearchIcon,
  TagIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { TablePagination } from "@/components/admin/table-pagination"
import { IconTile, ToneBadge, type Tone } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ApiError,
  fetchAllPages,
  query,
  type MatrixCell,
  type MatrixOutput,
  type MatrixRow,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { CATEGORY_LABEL, PRODUCT_CATEGORIES } from "@/lib/categories"
import { downloadCsv } from "@/lib/csv"
import { formatArs, formatPct, formatUsdAmount } from "@/lib/format"
import { QUOTE_LABEL, type Quote } from "@/lib/quotes"
import { useQuoteValues } from "@/lib/rates"
import { cn } from "@/lib/utils"

const PAGE_SIZES = [10, 20, 50]
const SEARCH_DELAY_MS = 300

type Currency = "ARS" | "USD"
type Signal = "all" | "promo" | "redu"
type SortKey = "name" | "spread" | "var"

// UI values → GET /matrix parameters.
const API_SIGNAL: Record<Signal, string | null> = { all: null, promo: "promo", redu: "shrinkflation" }
const API_SORT: Record<SortKey, string> = { name: "name", spread: "spread", var: "variation" }
const API_RATE: Record<Quote, string> = { oficial: "official", blue: "blue" }

const categoryItems = [
  { label: "Todas", value: "all" },
  ...PRODUCT_CATEGORIES.map((category) => ({ label: category.label, value: category.value })),
]

const signalItems = [
  { label: "Todas", value: "all" },
  { label: "Con promo vigente", value: "promo" },
  { label: "Con reduflación", value: "redu" },
]

const currencyItems = [
  { label: "Pesos (ARS)", value: "ARS" },
  { label: "Dólares (USD)", value: "USD" },
]

function quoteItemsFor(values: Record<Quote, number>) {
  return (Object.keys(values) as Quote[]).map((value) => ({
    label: `${QUOTE_LABEL[value]} · ${formatArs(values[value])}`,
    value,
  }))
}

const pageSizeItems = PAGE_SIZES.map((size) => ({
  label: String(size),
  value: String(size),
}))

// A var. over this threshold is flagged red; below it stays neutral.
const HIGH_VARIATION = 8

type Cell =
  | { kind: "missing" }
  | {
      kind: "price"
      main: string
      sub: string
      rank?: "cheap" | "expensive"
      promo?: string
      promoTitle?: string
      redu?: string
    }

function formatSpread(spread: number | null) {
  return spread == null ? "—" : spread.toFixed(1).replace(".", ",") + " %"
}

function toCell(cell: MatrixCell | undefined, row: MatrixRow, currency: Currency): Cell {
  if (!cell) return { kind: "missing" }
  const ars = Number(cell.local_price)
  const usd = cell.usd_price != null ? Number(cell.usd_price) : null
  const money = (value: number) => (currency === "USD" ? formatUsdAmount(value) : formatArs(value))
  const regular = cell.is_promo && cell.regular_price != null ? Number(cell.regular_price) : null
  const spread = row.spread
  return {
    kind: "price",
    main: currency === "USD" ? (usd != null ? formatUsdAmount(usd) : "Sin cotización") : formatArs(ars),
    sub: currency === "USD" ? formatArs(ars) : usd != null ? formatUsdAmount(usd) : "",
    rank: !spread
      ? undefined
      : spread.cheapest_store_slug === cell.store_slug
        ? "cheap"
        : spread.most_expensive_store_slug === cell.store_slug
          ? "expensive"
          : undefined,
    promo: regular != null ? money(regular) : undefined,
    promoTitle: regular != null ? `Precio regular ${money(regular)} · promo vigente` : undefined,
    redu: cell.shrinkflation ? `${cell.shrinkflation.before} → ${cell.shrinkflation.after}` : undefined,
  }
}

function subtitleOf(row: MatrixRow) {
  return [row.category ? CATEGORY_LABEL[row.category] : "Sin categoría", row.content ?? row.brand]
    .filter(Boolean)
    .join(" · ")
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Matriz de precios (UX05): the same product across the client's stores,
// from GET /matrix. Search, filters, sort and pagination run in the API.
export function PriceMatrix() {
  const { request } = useAuth()
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [signal, setSignal] = React.useState<Signal>("all")
  const [currency, setCurrency] = React.useState<Currency>("ARS")
  const [quote, setQuote] = React.useState<Quote>("blue")
  const [sort, setSort] = React.useState<SortKey>("var")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0])
  const [data, setData] = React.useState<MatrixOutput | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  // Key of the request whose answer is on screen: loading while it differs.
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [exporting, setExporting] = React.useState(false)

  const { values: quoteValues } = useQuoteValues()
  const quoteItems = React.useMemo(() => quoteItemsFor(quoteValues), [quoteValues])
  const debouncedSearch = useDebounced(search.trim(), SEARCH_DELAY_MS)
  const hasFilters = search !== "" || category !== "all" || signal !== "all"

  // The API asks for at least 2 characters.
  const filters = React.useMemo(
    () => ({
      currency: currency.toLowerCase(),
      rate: API_RATE[quote],
      q: debouncedSearch.length >= 2 ? debouncedSearch : null,
      category: category === "all" ? null : category,
      signal: API_SIGNAL[signal],
      sort: API_SORT[sort],
    }),
    [currency, quote, debouncedSearch, category, signal, sort]
  )

  const path = `/matrix${query({ ...filters, page, size: pageSize })}`
  const requestKey = `${path}#${reloadKey}`
  const loading = loadedKey !== requestKey

  React.useEffect(() => {
    let cancelled = false
    request<MatrixOutput>(path)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
        setLoadedKey(requestKey)
        // The page can fall out of range when the data changes.
        const pages = Math.max(1, Math.ceil(result.total / pageSize))
        if (page > pages) setPage(pages)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : "No pudimos cargar la matriz.")
        setLoadedKey(requestKey)
      })
    return () => { cancelled = true }
  }, [request, path, requestKey, pageSize, page])

  const stores = React.useMemo(() => data?.stores ?? [], [data])
  const rows = React.useMemo(
    () =>
      (data?.items ?? []).map((row) => {
        const bySlug = new Map(row.prices.map((cell) => [cell.store_slug, cell]))
        return {
          row,
          cells: stores.map((store) => toCell(bySlug.get(store.slug), row, currency)),
          spread: row.spread ? Number(row.spread.percentage) : null,
          variation: row.variation_30d != null ? Number(row.variation_30d) : null,
        }
      }),
    [data, stores, currency]
  )

  function clearFilters() {
    setSearch("")
    setCategory("all")
    setSignal("all")
    setPage(1)
  }

  // Every row that matches the filters, not just this page.
  async function exportCsv() {
    setExporting(true)
    try {
      const all = await fetchAllPages<MatrixRow>(request, "/matrix", filters)
      downloadCsv(
        `matriz-de-precios-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Producto", "EAN", "Categoría", "Formato", ...stores.map((store) => store.name), "Spread", "Var. 30 d"],
        all.map((row) => {
          const bySlug = new Map(row.prices.map((cell) => [cell.store_slug, cell]))
          return [
            row.name,
            row.ean,
            row.category ? CATEGORY_LABEL[row.category] : "",
            row.content ?? "",
            ...stores.map((store) => {
              const price = bySlug.get(store.slug)?.price
              return price == null ? "Sin dato" : price
            }),
            formatSpread(row.spread ? Number(row.spread.percentage) : null),
            row.variation_30d == null ? "—" : formatPct(Number(row.variation_30d)),
          ]
        })
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos exportar la matriz.")
    } finally {
      setExporting(false)
    }
  }

  const total = data?.total ?? 0

  return (
    <>
      <PageHeader
        title="Matriz de precios"
        description={
          data
            ? `El mismo producto en tus ${stores.length} ${stores.length === 1 ? "tienda asignada" : "tiendas asignadas"}.`
            : "El mismo producto en tus tiendas asignadas."
        }
      />

      <MatrixKpis summary={data?.summary ?? null} storeCount={stores.length} />

      <Card className="gap-0 py-0 shadow-xs">
        <div className="grid gap-4 border-b p-(--card-spacing) sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            id="matrix-category"
            label="Categoría"
            items={categoryItems}
            value={category}
            onChange={(value) => {
              setCategory(value)
              setPage(1)
            }}
          />
          <FilterSelect
            id="matrix-signal"
            label="Señales"
            items={signalItems}
            value={signal}
            onChange={(value) => {
              setSignal(value as Signal)
              setPage(1)
            }}
          />
          <FilterSelect
            id="matrix-currency"
            label="Moneda"
            items={currencyItems}
            value={currency}
            onChange={(value) => setCurrency(value as Currency)}
          />
          <FilterSelect
            id="matrix-quote"
            label="Cotización"
            items={quoteItems}
            value={quote}
            onChange={(value) => setQuote(value as Quote)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b p-(--card-spacing)">
          <div className="relative w-full sm:w-72">
            <Label htmlFor="matrix-search" className="sr-only">
              Buscar producto, marca o EAN
            </Label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="matrix-search"
              type="search"
              placeholder="Buscar producto, marca o EAN"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Label htmlFor="matrix-page-size" className="sr-only">
              Filas por página
            </Label>
            <Select
              items={pageSizeItems}
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger id="matrix-page-size" className="h-9! w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pageSizeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="lg"
              onClick={exportCsv}
              disabled={total === 0 || exporting}
            >
              <DownloadIcon data-icon="inline-start" />
              {exporting ? "Exportando…" : "Exportar"}
            </Button>
          </div>
        </div>

        <Legend />

        <Table
          className="min-w-[960px]"
          aria-label="Matriz de precios por tienda"
          aria-busy={loading}
        >
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead
                aria-sort={sort === "name" ? "ascending" : "none"}
                className="sticky left-0 z-10 w-64 border-r bg-muted pl-(--card-spacing)"
              >
                <SortButton
                  label="Producto"
                  active={sort === "name"}
                  direction="asc"
                  onClick={() => { setSort("name"); setPage(1) }}
                />
              </TableHead>
              {stores.map((store) => (
                <TableHead key={store.slug}>{store.name}</TableHead>
              ))}
              <TableHead
                aria-sort={sort === "spread" ? "descending" : "none"}
                className="text-right"
              >
                <SortButton
                  label="Spread"
                  active={sort === "spread"}
                  direction="desc"
                  onClick={() => { setSort("spread"); setPage(1) }}
                />
              </TableHead>
              <TableHead
                aria-sort={sort === "var" ? "descending" : "none"}
                className="pr-(--card-spacing) text-right"
              >
                <SortButton
                  label="Var. 30 d"
                  active={sort === "var"}
                  direction="desc"
                  onClick={() => { setSort("var"); setPage(1) }}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={stores.length + 3} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TriangleAlertIcon className="size-6" />
                    <p>{error}</p>
                    <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
                      Reintentar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : !data ? (
              Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4} className="py-3 pl-(--card-spacing)">
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={stores.length + 3} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageSearchIcon className="size-6" />
                    {hasFilters ? (
                      <>
                        <p>Ningún producto coincide con la búsqueda.</p>
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          Limpiar filtros
                        </Button>
                      </>
                    ) : stores.length === 0 ? (
                      <p>Todavía no tenés tiendas asignadas.</p>
                    ) : (
                      <p>Todavía no hay productos en tus tiendas.</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ row, cells, spread, variation }) => (
                <TableRow key={row.product_id} className={cn("group/row", loading && "opacity-60")}>
                  <TableCell className="sticky left-0 z-10 border-r bg-card py-3 pl-(--card-spacing) group-hover/row:bg-muted">
                    <Link
                      href={`/user/producto?id=${row.product_id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-muted-foreground">{subtitleOf(row)}</div>
                  </TableCell>
                  {cells.map((cell, index) => (
                    <PriceCell key={stores[index].slug} cell={cell} />
                  ))}
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatSpread(spread)}
                  </TableCell>
                  <TableCell className="pr-(--card-spacing) text-right">
                    {variation == null ? (
                      <span
                        className="text-muted-foreground"
                        title="Todavía no hay un precio de hace 30 días para comparar"
                      >
                        —
                      </span>
                    ) : (
                      <ToneBadge
                        tone={variation > HIGH_VARIATION ? "red" : "neutral"}
                        className="font-mono"
                      >
                        {variation >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                        {formatPct(variation)}
                      </ToneBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="border-t p-(--card-spacing)">
          <TablePagination
            page={page}
            size={pageSize}
            total={total}
            noun={total === 1 ? "producto" : "productos"}
            onPageChange={setPage}
          />
        </div>
      </Card>
    </>
  )
}

function PriceCell({ cell }: { cell: Cell }) {
  if (cell.kind === "missing") {
    return (
      <TableCell className="py-3">
        <ToneBadge tone="neutral">Sin dato</ToneBadge>
      </TableCell>
    )
  }

  return (
    <TableCell
      className={cn(
        "py-3 align-top",
        cell.rank === "cheap" && "bg-emerald-500/5",
        cell.rank === "expensive" && "bg-red-500/5"
      )}
    >
      <div className="font-mono font-medium tabular-nums">{cell.main}</div>
      <div className="font-mono text-xs text-muted-foreground tabular-nums">
        {cell.sub}
      </div>
      {(cell.rank || cell.promo || cell.redu) && (
        <div className="flex flex-wrap gap-1 pt-1.5">
          {cell.rank === "cheap" && (
            <ToneBadge tone="emerald">
              <ArrowDownIcon />
              Más barato
            </ToneBadge>
          )}
          {cell.rank === "expensive" && (
            <ToneBadge tone="red">
              <ArrowUpIcon />
              Más caro
            </ToneBadge>
          )}
          {cell.promo && (
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <ToneBadge tone="violet">
                  <TagIcon />
                  Promo · <s className="font-mono">{cell.promo}</s>
                </ToneBadge>
              </TooltipTrigger>
              <TooltipContent>{cell.promoTitle}</TooltipContent>
            </Tooltip>
          )}
          {cell.redu && (
            <ToneBadge tone="amber">
              <TriangleAlertIcon />
              {cell.redu}
            </ToneBadge>
          )}
        </div>
      )}
    </TableCell>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-(--card-spacing) py-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Referencias</span>
      <span className="flex items-center gap-1.5">
        <ToneBadge tone="emerald">
          <ArrowDownIcon />
          Más barato
        </ToneBadge>
        entre tus tiendas
      </span>
      <span className="flex items-center gap-1.5">
        <ToneBadge tone="red">
          <ArrowUpIcon />
          Más caro
        </ToneBadge>
        entre tus tiendas
      </span>
      <span className="flex items-center gap-1.5">
        <ToneBadge tone="violet">
          <TagIcon />
          Promo
        </ToneBadge>
        precio regular tachado
      </span>
      <span className="flex items-center gap-1.5">
        <ToneBadge tone="amber">
          <TriangleAlertIcon />
          Reduflación
        </ToneBadge>
        cambió el contenido neto
      </span>
    </div>
  )
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: "asc" | "desc"
  onClick: () => void
}) {
  const Icon = !active
    ? ArrowUpDownIcon
    : direction === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "-mx-2 font-medium",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      <Icon data-icon="inline-end" />
    </Button>
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

// KPIs from GET /matrix: every visible product, before search and filters.
function MatrixKpis({
  summary,
  storeCount,
}: {
  summary: MatrixOutput["summary"] | null
  storeCount: number
}) {
  const value = (text: string) => (summary ? text : null)
  const cards: {
    label: string
    value: string | null
    hint: string
    tone: Tone
    icon: React.ReactNode
  }[] = [
    {
      label: "Productos comparados",
      value: value(String(summary?.products ?? 0)),
      hint: `Con precio en al menos una de tus ${storeCount} ${storeCount === 1 ? "tienda" : "tiendas"}`,
      tone: "brand",
      icon: <PackageSearchIcon />,
    },
    {
      label: "Spread promedio",
      value: value(
        formatSpread(summary?.average_spread != null ? Number(summary.average_spread) : null)
      ),
      hint: "Distancia entre la tienda más cara y la más barata",
      tone: "sky",
      icon: <PercentIcon />,
    },
    {
      label: "Con promo vigente",
      value: value(String(summary?.with_promotion ?? 0)),
      hint: "En al menos una tienda",
      tone: "violet",
      icon: <TagIcon />,
    },
    {
      label: "Con reduflación",
      value: value(String(summary?.with_shrinkflation ?? 0)),
      hint: "Menos contenido neto en los últimos 90 días",
      tone: "amber",
      icon: <TriangleAlertIcon />,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card shadow-xs">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value ?? <Skeleton className="h-8 w-20" />}
            </CardTitle>
            <CardAction>
              <IconTile tone={card.tone}>{card.icon}</IconTile>
            </CardAction>
            <p className="col-span-full pt-1 text-sm text-muted-foreground">
              {card.hint}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
