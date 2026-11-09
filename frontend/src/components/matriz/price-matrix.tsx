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
import { downloadCsv } from "@/lib/csv"
import { formatArs, formatPct, formatUsd } from "@/lib/format"
import { QUOTES, QUOTE_LABEL, type Quote } from "@/lib/quotes"
import { cn } from "@/lib/utils"

import { slugOf } from "@/components/producto/data"

import { CATEGORIES, PRODUCTS, STORES, type Product } from "./data"

const PAGE_SIZES = [10, 20, 50]

type Currency = "ARS" | "USD"
type Signal = "all" | "promo" | "redu"
type SortKey = "name" | "spread" | "var"

const categoryItems = [
  { label: "Todas", value: "all" },
  ...CATEGORIES.map((value) => ({ label: value, value })),
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

const quoteItems = (Object.keys(QUOTES) as Quote[]).map((value) => ({
  label: `${QUOTE_LABEL[value]} · ${formatArs(QUOTES[value])}`,
  value,
}))

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

type Row = {
  product: Product
  cells: Cell[]
  spread: number | null
}

function spreadOf(product: Product) {
  const values = product.p.filter((value): value is number => value != null)
  if (values.length < 2) return null
  const min = Math.min(...values)
  return ((Math.max(...values) - min) / min) * 100
}

function formatSpread(spread: number | null) {
  return spread == null ? "—" : spread.toFixed(1).replace(".", ",") + " %"
}

// Matriz de precios (UX05): the same product across the client's stores.
// Same layout as the admin users panel: header, KPIs, then one card with
// filters, toolbar, table and pagination.
export function PriceMatrix() {
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState("all")
  const [signal, setSignal] = React.useState<Signal>("all")
  const [currency, setCurrency] = React.useState<Currency>("ARS")
  const [quote, setQuote] = React.useState<Quote>("blue")
  const [sort, setSort] = React.useState<SortKey>("var")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0])

  const rate = QUOTES[quote]
  const hasFilters = search !== "" || category !== "all" || signal !== "all"

  const rows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const money = (value: number) =>
      currency === "USD" ? formatUsd(value, rate) : formatArs(value)
    const other = (value: number) =>
      currency === "USD" ? formatArs(value) : formatUsd(value, rate)

    const result: Row[] = PRODUCTS.filter((product) => {
      if (
        needle &&
        !product.name.toLowerCase().includes(needle) &&
        !product.cat.toLowerCase().includes(needle)
      ) {
        return false
      }
      if (category !== "all" && product.cat !== category) return false
      if (signal === "promo" && !product.promo?.some(Boolean)) return false
      if (signal === "redu" && !product.redu?.some(Boolean)) return false
      return true
    }).map((product) => {
      const values = product.p.filter((v): v is number => v != null)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const ranked = values.length > 1 && min !== max

      const cells = product.p.map((price, store): Cell => {
        if (price == null) return { kind: "missing" }
        const promo = product.promo?.[store]
        return {
          kind: "price",
          main: money(price),
          sub: other(price),
          rank: !ranked
            ? undefined
            : price === min
              ? "cheap"
              : price === max
                ? "expensive"
                : undefined,
          promo: promo ? money(promo) : undefined,
          promoTitle: promo
            ? `Precio regular ${formatArs(promo)} · promo vigente`
            : undefined,
          redu: product.redu?.[store] ?? undefined,
        }
      })

      return { product, cells, spread: spreadOf(product) }
    })

    result.sort((a, b) => {
      if (sort === "name") return a.product.name.localeCompare(b.product.name)
      if (sort === "spread") return (b.spread ?? -1) - (a.spread ?? -1)
      return b.product.v - a.product.v
    })
    return result
  }, [search, category, signal, currency, rate, sort])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function clearFilters() {
    setSearch("")
    setCategory("all")
    setSignal("all")
    setPage(1)
  }

  function exportCsv() {
    downloadCsv(
      `matriz-de-precios-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Producto", "Categoría", "Formato", ...STORES, "Spread", "Var. 30 d"],
      rows.map((row) => [
        row.product.name,
        row.product.cat,
        row.product.size,
        ...row.product.p.map((price) =>
          price == null ? "Sin dato" : Math.round(price)
        ),
        formatSpread(row.spread),
        formatPct(row.product.v),
      ])
    )
  }

  return (
    <>
      <PageHeader
        title="Matriz de precios"
        description={`El mismo producto en tus ${STORES.length} tiendas asignadas.`}
      />

      <MatrixKpis />

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
              Buscar producto o categoría
            </Label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="matrix-search"
              type="search"
              placeholder="Buscar producto o categoría"
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
              disabled={rows.length === 0}
            >
              <DownloadIcon data-icon="inline-start" />
              Exportar
            </Button>
          </div>
        </div>

        <Legend />

        <Table className="min-w-[960px]" aria-label="Matriz de precios por tienda">
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
                  onClick={() => setSort("name")}
                />
              </TableHead>
              {STORES.map((store) => (
                <TableHead key={store}>{store}</TableHead>
              ))}
              <TableHead
                aria-sort={sort === "spread" ? "descending" : "none"}
                className="text-right"
              >
                <SortButton
                  label="Spread"
                  active={sort === "spread"}
                  direction="desc"
                  onClick={() => setSort("spread")}
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
                  onClick={() => setSort("var")}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={STORES.length + 3} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageSearchIcon className="size-6" />
                    {hasFilters ? (
                      <>
                        <p>Ningún producto coincide con la búsqueda.</p>
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          Limpiar filtros
                        </Button>
                      </>
                    ) : (
                      <p>Todavía no hay productos en tus tiendas.</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.product.name} className="group/row">
                  <TableCell className="sticky left-0 z-10 border-r bg-card py-3 pl-(--card-spacing) group-hover/row:bg-muted">
                    <Link
                      href={`/user/producto?p=${slugOf(row.product.name)}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.product.name}
                    </Link>
                    <div className="text-muted-foreground">
                      {row.product.cat} · {row.product.size}
                    </div>
                  </TableCell>
                  {row.cells.map((cell, index) => (
                    <PriceCell key={STORES[index]} cell={cell} />
                  ))}
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatSpread(row.spread)}
                  </TableCell>
                  <TableCell className="pr-(--card-spacing) text-right">
                    <ToneBadge
                      tone={row.product.v > HIGH_VARIATION ? "red" : "neutral"}
                      className="font-mono"
                    >
                      {row.product.v >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                      {formatPct(row.product.v)}
                    </ToneBadge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="border-t p-(--card-spacing)">
          <TablePagination
            page={currentPage}
            size={pageSize}
            total={rows.length}
            noun={rows.length === 1 ? "producto" : "productos"}
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

// Counted from the sample catalogue; they move to the API with the data.
function MatrixKpis() {
  const spreads = PRODUCTS.map(spreadOf).filter(
    (value): value is number => value != null
  )
  const avgSpread =
    spreads.reduce((sum, value) => sum + value, 0) / Math.max(1, spreads.length)

  const cards: {
    label: string
    value: string
    hint: string
    tone: Tone
    icon: React.ReactNode
  }[] = [
    {
      label: "Productos comparados",
      value: String(PRODUCTS.length),
      hint: `Con precio en al menos una de tus ${STORES.length} tiendas`,
      tone: "brand",
      icon: <PackageSearchIcon />,
    },
    {
      label: "Spread promedio",
      value: formatSpread(avgSpread),
      hint: "Distancia entre la tienda más cara y la más barata",
      tone: "sky",
      icon: <PercentIcon />,
    },
    {
      label: "Con promo vigente",
      value: String(PRODUCTS.filter((p) => p.promo?.some(Boolean)).length),
      hint: "En al menos una tienda",
      tone: "violet",
      icon: <TagIcon />,
    },
    {
      label: "Con reduflación",
      value: String(PRODUCTS.filter((p) => p.redu?.some(Boolean)).length),
      hint: "Mismo precio o más, menos contenido",
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
              {card.value}
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
