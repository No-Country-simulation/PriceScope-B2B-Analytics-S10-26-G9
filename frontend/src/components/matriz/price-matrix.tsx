"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  SearchIcon,
  TagIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
import { formatArs, formatPct, formatUsd } from "@/lib/format"
import { QUOTES, type Quote } from "@/lib/quotes"
import { cn } from "@/lib/utils"

import { CATEGORIES, PRODUCTS, STORES, type Product } from "./data"

const PAGE_SIZE = 25

// Etiquetas de la maqueta: la referencia pinta la barata en verde, la cara en
// rojo, la promo en violeta y la reduflación en ámbar.
const TONES = {
  down: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  up: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  promo: "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]",
  redu: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
  muted: "border-[#f4f4f5] bg-[#f4f4f5] text-[#3f3f46]",
} as const

type Rank = keyof Pick<typeof TONES, "down" | "up">
type SortKey = "name" | "spread" | "var"

type Cell = {
  main: string
  sub: string
  bg: string
  muted?: boolean
  rank?: Rank
  promo?: string
  redu?: string
  title?: string
}

type Row = {
  product: Product
  cells: Cell[]
  spread: number | null
  spreadLabel: string
  varLabel: string
  varTone: keyof typeof TONES
}

// Matriz de precios por tienda: toolbar de filtros, leyenda, tabla con las
// columnas fijas y paginación. Maqueta local, sin llamadas a la API.
export function PriceMatrix({
  quote,
  onQuoteChange,
}: {
  quote: Quote
  onQuoteChange: (quote: Quote) => void
}) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<string | null>(null)
  const [currency, setCurrency] = React.useState<"ARS" | "USD">("ARS")
  const [promoOnly, setPromoOnly] = React.useState(false)
  const [reduOnly, setReducOnly] = React.useState(false)
  const [sort, setSort] = React.useState<SortKey>("var")
  const [page, setPage] = React.useState(1)

  const rate = QUOTES[quote]

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = PRODUCTS.filter((product) => {
      if (
        needle &&
        !product.name.toLowerCase().includes(needle) &&
        !product.cat.toLowerCase().includes(needle)
      ) {
        return false
      }
      if (category && product.cat !== category) return false
      if (promoOnly && !product.promo?.some(Boolean)) return false
      if (reduOnly && !product.redu?.some(Boolean)) return false
      return true
    })

    const mapped: Row[] = filtered.map((product) => {
      const values = product.p.filter((value): value is number => value != null)
      const min = values.length > 0 ? Math.min(...values) : null
      const max = values.length > 0 ? Math.max(...values) : null
      const spread =
        min != null && max != null && values.length > 1
          ? ((max - min) / min) * 100
          : null

      const cells: Cell[] = product.p.map((price, store): Cell => {
        if (price == null || min == null || max == null) {
          return {
            main: "Sin dato",
            sub: "no publicado",
            bg: "bg-[#fafafa]",
            muted: true,
            title: "Sin precio en esta tienda",
          }
        }

        const promo = product.promo?.[store]
        const redu = product.redu?.[store]
        const cheap = price === min
        const expensive = price === max

        return {
          main: currency === "USD" ? formatUsd(price, rate) : formatArs(price),
          sub: currency === "USD" ? formatArs(price) : formatUsd(price, rate),
          bg: cheap
            ? "bg-[#f0fdf4]"
            : expensive
              ? "bg-[#fef2f2]"
              : "bg-background",
          rank: cheap ? "down" : expensive ? "up" : undefined,
          promo: promo
            ? currency === "USD"
              ? formatUsd(promo, rate)
              : formatArs(promo)
            : undefined,
          redu: redu ?? undefined,
          title: promo
            ? `Precio regular ${formatArs(promo)} · promo vigente`
            : redu
              ? `Contenido anterior y actual: ${redu}`
              : undefined,
        }
      })

      return {
        product,
        cells,
        spread,
        spreadLabel:
          spread == null ? "—" : spread.toFixed(1).replace(".", ",") + " %",
        varLabel: "▲ " + formatPct(product.v),
        varTone: product.v > 8 ? "up" : "muted",
      }
    })

    mapped.sort((a, b) => {
      if (sort === "name") return a.product.name.localeCompare(b.product.name)
      if (sort === "spread") return (b.spread ?? -1) - (a.spread ?? -1)
      return b.product.v - a.product.v
    })

    return mapped
  }, [query, category, promoOnly, reduOnly, currency, rate, sort])

  // Cambiar un filtro vuelve a la primera página: el estado de página se
  // resetea en cada handler, no en un efecto.
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  function clearFilters() {
    setQuery("")
    setCategory(null)
    setPromoOnly(false)
    setReducOnly(false)
    setPage(1)
  }

  function exportCsv() {
    downloadCsv(
      "matriz-de-precios.csv",
      ["Producto", "Categoría", "Formato", ...STORES, "Spread", "Var. 30 d"],
      rows.map((row) => [
        row.product.name,
        row.product.cat,
        row.product.size,
        ...row.product.p.map((price) =>
          price == null ? "Sin dato" : Math.round(price)
        ),
        row.spreadLabel,
        row.varLabel,
      ])
    )
  }

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-tight">
            Matriz de precios
          </h1>
          <p className="text-sm text-muted-foreground">
            El mismo producto en tus tiendas. {PRODUCTS.length} productos
            canónicos · {STORES.length} tiendas asignadas.
          </p>
        </div>
        <Button variant="outline" className="h-9" onClick={exportCsv}>
          <DownloadIcon data-icon="inline-start" />
          Exportar CSV
        </Button>
      </div>

      <Card className="flex flex-row flex-wrap items-center gap-2.5 rounded-[12px] border border-border px-3 py-2.5 shadow-[0_1px_2px_rgba(9,9,11,0.05)] ring-0">
        <div className="relative min-w-[260px] max-w-[360px] flex-1">
          <label htmlFor="matrix-search" className="sr-only">
            Buscar producto
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="matrix-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar producto…"
            className="h-9 pl-[34px]"
          />
        </div>

        <ToolbarTag icon={<CalendarDaysIcon className="size-3.5" />}>
          Últimos 30 días
        </ToolbarTag>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-8">
                Categorías
                <Badge
                  variant="secondary"
                  className="h-5 rounded-md px-1.5 font-normal"
                >
                  {category ?? "Todas"}
                </Badge>
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => {
                setCategory(null)
                setPage(1)
              }}
            >
              Todas
            </DropdownMenuItem>
            {CATEGORIES.map((value) => (
              <DropdownMenuItem
                key={value}
                onClick={() => {
                  setCategory(value)
                  setPage(1)
                }}
              >
                {value}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToggleGroup
          aria-label="Moneda"
          value={[currency]}
          onValueChange={(next) => {
            if (next[0]) setCurrency(next[0] as "ARS" | "USD")
          }}
          className="rounded-[9px] bg-[#f4f4f5] p-[3px]"
        >
          <ToggleGroupItem
            value="ARS"
            className="h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            ARS
          </ToggleGroupItem>
          <ToggleGroupItem
            value="USD"
            className="h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            USD
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          aria-label="Cotización"
          value={[quote]}
          onValueChange={(next) => {
            if (next[0]) onQuoteChange(next[0] as Quote)
          }}
          className="rounded-[9px] bg-[#f4f4f5] p-[3px]"
        >
          <ToggleGroupItem
            value="oficial"
            className="h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            Oficial
          </ToggleGroupItem>
          <ToggleGroupItem
            value="blue"
            className="h-7 rounded-md px-2.5 text-xs aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            Blue
          </ToggleGroupItem>
        </ToggleGroup>

        <Separator
          orientation="vertical"
          className="h-6 data-vertical:self-auto"
        />

        <Button
          variant={promoOnly ? "default" : "outline"}
          size="sm"
          className="h-8"
          aria-pressed={promoOnly}
          onClick={() => {
            setPromoOnly((value) => !value)
            setPage(1)
          }}
        >
          <TagIcon data-icon="inline-start" />
          Solo con promo
        </Button>
        <Button
          variant={reduOnly ? "default" : "outline"}
          size="sm"
          className="h-8"
          aria-pressed={reduOnly}
          onClick={() => {
            setReducOnly((value) => !value)
            setPage(1)
          }}
        >
          <TriangleAlertIcon data-icon="inline-start" />
          Solo con reduflación
        </Button>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#3f3f46]">
        <span className="font-medium">Referencias:</span>
        <Badge variant="outline" className={cn("h-[22px] rounded-md", TONES.down)}>
          ▼ más barato
        </Badge>
        <Badge variant="outline" className={cn("h-[22px] rounded-md", TONES.up)}>
          ▲ más caro
        </Badge>
        <span className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("h-[22px] rounded-md", TONES.promo)}
          >
            Promo
          </Badge>
          <span className="text-muted-foreground">
            precio regular al pasar el cursor
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("h-[22px] rounded-md", TONES.redu)}
          >
            Reduflación
          </Badge>
          <span className="text-muted-foreground">
            cambió el contenido neto
          </span>
        </span>
        <Badge
          variant="outline"
          className={cn("h-[22px] rounded-md", TONES.muted)}
        >
          Sin dato
        </Badge>
      </div>

      <section className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_2px_rgba(9,9,11,0.05)]">
        <div className="matrix-scroll">
          <Table
            className="min-w-[1000px] table-fixed text-sm"
            aria-label="Matriz de precios por tienda"
          >
            <TableHeader className="bg-[#fafafa] [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead
                  aria-sort={sort === "name" ? "ascending" : "none"}
                  className="sticky top-0 left-0 z-30 h-11 w-[260px] border-r border-border bg-[#fafafa] px-3"
                >
                  <HeaderSort
                    label="Producto"
                    active={sort === "name"}
                    direction="asc"
                    onClick={() => setSort("name")}
                  />
                </TableHead>
                {STORES.map((store) => (
                  <TableHead
                    key={store}
                    className="sticky top-0 z-20 h-11 bg-[#fafafa] px-3"
                  >
                    {store}
                  </TableHead>
                ))}
                <TableHead
                  aria-sort={sort === "spread" ? "descending" : "none"}
                  className="sticky top-0 z-20 h-11 bg-[#fafafa] px-3 text-right"
                >
                  <HeaderSort
                    label="Spread"
                    active={sort === "spread"}
                    direction="desc"
                    onClick={() => setSort("spread")}
                  />
                </TableHead>
                <TableHead
                  aria-sort={sort === "var" ? "descending" : "none"}
                  className="sticky top-0 z-20 h-11 bg-[#fafafa] px-3 text-right"
                >
                  <HeaderSort
                    label="Var. 30 d"
                    active={sort === "var"}
                    direction="desc"
                    onClick={() => setSort("var")}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {visible.map((row) => (
                <TableRow
                  key={row.product.name}
                  className="border-muted hover:bg-transparent"
                >
                  <TableCell className="sticky left-0 z-10 border-r border-border bg-background px-3 py-2.5">
                    <Link
                      href="/producto"
                      className="flex flex-col gap-0.5 underline-offset-3 hover:text-foreground"
                    >
                      <span className="font-medium underline decoration-[#d4d4d8]">
                        {row.product.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.product.cat} · {row.product.size}
                      </span>
                    </Link>
                  </TableCell>

                  {row.cells.map((cell, index) => (
                    <TableCell
                      key={STORES[index]}
                      title={cell.title}
                      className={cn("px-3 py-2.5", cell.bg)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "font-mono font-medium",
                            cell.muted && "text-muted-foreground"
                          )}
                        >
                          {cell.main}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {cell.sub}
                        </span>
                        {(cell.rank || cell.promo || cell.redu) && (
                          <span className="flex flex-wrap gap-1 pt-0.5">
                            {cell.rank && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 rounded-md px-1.5 text-[11px]",
                                  TONES[cell.rank]
                                )}
                              >
                                {cell.rank === "down"
                                  ? "▼ más barato"
                                  : "▲ más caro"}
                              </Badge>
                            )}
                            {cell.promo && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 rounded-md px-1.5 text-[11px]",
                                  TONES.promo
                                )}
                              >
                                Promo ·{" "}
                                <s className="font-mono">{cell.promo}</s>
                              </Badge>
                            )}
                            {cell.redu && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 rounded-md px-1.5 text-[11px]",
                                  TONES.redu
                                )}
                              >
                                Reduflación {cell.redu}
                              </Badge>
                            )}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  ))}

                  <TableCell className="px-3 text-right font-mono">
                    {row.spreadLabel}
                  </TableCell>
                  <TableCell className="px-3 text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-[22px] rounded-md font-mono",
                        TONES[row.varTone]
                      )}
                    >
                      {row.varLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <SearchIcon className="size-7 text-muted-foreground" />
              <span className="font-semibold">No encontramos «{query}»</span>
              <span className="text-sm text-muted-foreground">
                Probá con otro nombre o limpiá los filtros.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 mt-1"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs">
          <span className="text-muted-foreground">
            Mostrando {rows.length} de {PRODUCTS.length} productos
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Filas por página</span>
            {/* La maqueta no tiene selector de tamaño de página todavía. */}
            <span className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 font-medium tabular-nums">
              {PAGE_SIZE}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="font-mono tabular-nums">
              {currentPage} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página siguiente"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function HeaderSort({
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        active && "text-foreground"
      )}
    >
      {label}
      <span aria-hidden="true" className="text-muted-foreground">
        {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  )
}

// Muestra estática del toolbar con la forma de los botones: el rango de fechas
// todavía no tiene selector.
function ToolbarTag({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium">
      {icon}
      {children}
    </span>
  )
}
