"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  BellPlusIcon,
  CalendarSearchIcon,
  ExternalLinkIcon,
  GitCompareArrowsIcon,
  PackageSearchIcon,
  TagIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts"

import { PageHeader } from "@/components/admin/page-header"
import { TablePagination } from "@/components/admin/table-pagination"
import { ToneBadge } from "@/components/admin/tone"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ApiError,
  query,
  type ProductDetail as ProductData,
  type ProductHistory,
  type ProductHistoryPoint,
  type ProductStore,
  type ProductSummary,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { CATEGORY_LABEL } from "@/lib/categories"
import {
  formatArs,
  formatPct,
  formatPP,
  formatQuoteTime,
  formatUsdAmount,
} from "@/lib/format"
import { cn } from "@/lib/utils"

type Currency = "ARS" | "USD"

const PERIODS = [30, 90, 180, 365] as const
type Period = (typeof PERIODS)[number]

const STORE_COLORS = ["#6366f1", "#14b8a6", "#f472b6", "#f59e0b", "#38bdf8"]
const PAGE_SIZE = 10
// Prices on the cards and the daily table use the blue rate of capture time.
const RATE = "blue"

const dateLabel = (date: string) => date.split("-").reverse().join("/")
const axisDate = (date: string) => dateLabel(date).slice(0, 5)
const decimal = (value: number) => value.toFixed(1).replace(".", ",")
const periodLabel = (days: number) => (days === 365 ? "12 m" : `${days} d`)
const UNIT_LABEL = { g: "g", ml: "ml", u: "u" } as const

function useApi<T>(path: string | null) {
  const { request } = useAuth()
  const [state, setState] = React.useState<{
    path: string | null
    data: T | null
    error: ApiError | Error | null
  }>({ path: null, data: null, error: null })

  React.useEffect(() => {
    if (!path) return
    let cancelled = false
    request<T>(path)
      .then((data) => { if (!cancelled) setState({ path, data, error: null }) })
      .catch((error) => { if (!cancelled) setState({ path, data: null, error }) })
    return () => { cancelled = true }
  }, [request, path])

  // Data from a previous path stays on screen while the new one loads.
  return {
    data: state.data,
    error: state.path === path ? state.error : null,
    loading: state.path !== path,
  }
}

/** Average regular price of the stores with a price on each day. */
function averageByDate(points: ProductHistoryPoint[]) {
  const days = new Map<string, number[]>()
  for (const point of points) {
    const list = days.get(point.date) ?? []
    list.push(Number(point.regular_price))
    days.set(point.date, list)
  }
  return new Map(
    [...days].map(([date, values]) => [date, values.reduce((a, b) => a + b, 0) / values.length])
  )
}

// UX06 · Ficha de producto: el mismo producto en las tiendas del cliente,
// su historial, una comparación opcional y el detalle día por día.
export function ProductDetail() {
  const params = useSearchParams()
  const id = params.get("id")
  if (!id) return <NoProduct message="Elegí un producto desde la matriz de precios." />
  // Al cambiar de producto la ficha arranca de cero (período, comparación…).
  return <ProductLoader key={id} id={id} />
}

function NoProduct({ message }: { message: string }) {
  return (
    <Card className="items-center gap-3 py-12 text-center shadow-xs">
      <PackageSearchIcon className="size-6 text-muted-foreground" />
      <p className="text-muted-foreground">{message}</p>
      <Link href="/user/matriz" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Ir a la matriz de precios
      </Link>
    </Card>
  )
}

function ProductLoader({ id }: { id: string }) {
  const { data: product, error } = useApi<ProductData>(`/products/${id}`)
  if (error) {
    return (
      <NoProduct
        message={
          error instanceof ApiError && (error.status === 404 || error.status === 422)
            ? "Este producto no existe o no está en tus tiendas."
            : "No pudimos cargar el producto. Probá de nuevo."
        }
      />
    )
  }
  if (!product) return <ProductDetailSkeleton />
  return <ProductView product={product} />
}

function ProductView({ product }: { product: ProductData }) {
  const [currency, setCurrency] = React.useState<Currency>("ARS")
  const [period, setPeriod] = React.useState<Period>(90)
  const [comparing, setComparing] = React.useState(false)

  const { data: history, loading: historyLoading } = useApi<ProductHistory>(
    `/products/${product.id}/history${query({ days: period, rate: RATE })}`
  )
  const colorOf = React.useMemo(() => {
    const slugs = [
      ...product.stores.map((store) => store.store_slug),
      ...(history?.stores.map((store) => store.slug) ?? []),
    ]
    const unique = [...new Set(slugs)]
    return (slug: string) => STORE_COLORS[unique.indexOf(slug) % STORE_COLORS.length]
  }, [product, history])

  const reduStores = product.stores.filter((store) => store.shrinkflation)
  const description = [
    product.category ? CATEGORY_LABEL[product.category] : "Sin categoría",
    product.content,
    product.brand,
    `EAN ${product.ean}`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <Link
        href="/user/matriz"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "-ml-2 -mb-2 w-fit text-muted-foreground",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Matriz de precios
      </Link>

      <PageHeader
        title={product.name}
        description={description}
        badge={
          reduStores.length > 0 && (
            <ToneBadge tone="amber">
              <TriangleAlertIcon />
              Reduflación en {reduStores.map((store) => store.store_name).join(", ")}
            </ToneBadge>
          )
        }
        actions={
          <>
            <ToggleGroup
              aria-label="Moneda"
              value={[currency]}
              variant="outline"
              spacing={0}
              onValueChange={(next) => next.length && setCurrency(next[0] as Currency)}
            >
              <ToggleGroupItem value="ARS" className="h-9 px-3">
                ARS
              </ToggleGroupItem>
              <ToggleGroupItem value="USD" className="h-9 px-3">
                USD
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="lg" onClick={() => setComparing(!comparing)}>
              {comparing ? (
                <XIcon data-icon="inline-start" />
              ) : (
                <GitCompareArrowsIcon data-icon="inline-start" />
              )}
              {comparing ? "Quitar comparación" : "Comparar"}
            </Button>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href={`/user/regla-nueva?product=${product.id}`} />}
            >
              <BellPlusIcon data-icon="inline-start" />
              Crear alerta
            </Button>
          </>
        }
      />

      <StoreCards product={product} currency={currency} colorOf={colorOf} />

      {!history ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className={cn("contents", historyLoading && "[&>*]:opacity-60")}>
          <HistoryCard
            history={history}
            product={product}
            currency={currency}
            period={period}
            onPeriodChange={setPeriod}
            colorOf={colorOf}
          />

          {comparing && <CompareCard product={product} history={history} period={period} />}

          <DailyTable product={product} history={history} />
        </div>
      )}
    </>
  )
}

export function ProductDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 @3xl/main:grid-cols-3">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </>
  )
}

function storeMoney(store: ProductStore, currency: Currency) {
  if (currency === "ARS") return formatArs(Number(store.local_price))
  return store.usd_blue != null ? formatUsdAmount(Number(store.usd_blue)) : "Sin cotización"
}

function StoreCards({
  product,
  currency,
  colorOf,
}: {
  product: ProductData
  currency: Currency
  colorOf: (slug: string) => string
}) {
  if (product.stores.length === 0) {
    return (
      <Card className="py-8 text-center text-muted-foreground shadow-xs">
        Todavía no hay precios de este producto en tus tiendas.
      </Card>
    )
  }
  const available = product.stores.filter((store) => store.available)
  const prices = available.map((store) => Number(store.local_price))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const ranked = available.length > 1 && min !== max
  const unitValues = product.stores.flatMap((store) =>
    store.price_per_unit != null ? [Number(store.price_per_unit)] : []
  )
  const maxUnit = Math.max(...unitValues)

  return (
    <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
      {product.stores.map((store) => {
        const price = Number(store.local_price)
        const unit = store.price_per_unit != null && store.unit ? Number(store.price_per_unit) : null
        const regular = store.is_promo ? Number(store.regular_price) : null
        const redu = store.shrinkflation
        return (
          <Card key={store.store_slug} className="@container/card shadow-xs">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: colorOf(store.store_slug) }}
                  aria-hidden="true"
                />
                {store.store_name}
                <a
                  href={store.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Ver en ${store.store_name}`}
                >
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </CardDescription>
              <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {storeMoney(store, currency)}
              </CardTitle>
              <CardAction>
                {!store.available ? (
                  <ToneBadge tone="neutral">Sin stock</ToneBadge>
                ) : ranked && price === min ? (
                  <ToneBadge tone="emerald">
                    <ArrowDownIcon />
                    Más barato
                  </ToneBadge>
                ) : ranked && price === max ? (
                  <ToneBadge tone="red">
                    <ArrowUpIcon />
                    Más caro
                  </ToneBadge>
                ) : null}
              </CardAction>
              <div className="col-span-full flex flex-col gap-2 pt-1 text-sm text-muted-foreground">
                <p className="font-mono text-xs tabular-nums">
                  {storeMoney(store, currency === "ARS" ? "USD" : "ARS")}
                  {store.content && ` · ${store.content}`}
                  {unit != null &&
                    ` · $ ${unit.toFixed(2).replace(".", ",")} / ${UNIT_LABEL[store.unit!]}`}
                </p>
                <p className="text-xs">Actualizado {formatQuoteTime(store.captured_at)}</p>
                {(regular != null || redu) && (
                  <div className="flex flex-wrap gap-1.5">
                    {regular != null && (
                      <ToneBadge tone="violet">
                        <TagIcon />
                        Promo · regular <s className="font-mono">{formatArs(regular)}</s>
                      </ToneBadge>
                    )}
                    {redu && (
                      <ToneBadge tone="amber">
                        <TriangleAlertIcon />
                        {redu.before} → {redu.after}
                        {unit != null && unitValues.length > 1 && unit === maxUnit &&
                          ` · más caro por ${UNIT_LABEL[store.unit!]}`}
                      </ToneBadge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        )
      })}
    </div>
  )
}

function HistoryCard({
  history,
  product,
  currency,
  period,
  onPeriodChange,
  colorOf,
}: {
  history: ProductHistory
  product: ProductData
  currency: Currency
  period: Period
  onPeriodChange: (period: Period) => void
  colorOf: (slug: string) => string
}) {
  const config = Object.fromEntries(
    history.stores.map((store) => [store.slug, { label: store.name, color: colorOf(store.slug) }])
  ) satisfies ChartConfig

  const data = React.useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    for (const point of history.points) {
      const row = byDate.get(point.date) ?? { date: point.date }
      const regular = Number(point.regular_price)
      // Regular price in USD, scaled like the captured price.
      row[point.store_slug] =
        currency === "USD"
          ? point.usd_price != null
            ? (regular * Number(point.usd_price)) / Number(point.price)
            : NaN
          : regular
      byDate.set(point.date, row)
    }
    return [...byDate.values()]
  }, [history, currency])

  const format = (value: number) =>
    currency === "USD" ? `US$ ${value.toFixed(2).replace(".", ",")}` : formatArs(value)

  const reduMarks = product.stores.flatMap((store) => {
    if (!store.shrinkflation) return []
    const date = store.shrinkflation.changed_at.slice(0, 10)
    const row = data.find((item) => item.date >= date)
    const value = row?.[store.store_slug]
    return typeof value === "number" ? [{ slug: store.store_slug, date: String(row!.date), value }] : []
  })

  return (
    <Card className="min-w-0 shadow-xs">
      <CardHeader>
        <CardTitle>
          <h3>Historial de precios por tienda</h3>
        </CardTitle>
        <CardDescription>
          Precio regular en {currency} · últimos {periodLabel(period)}
          {reduMarks.length > 0 && " · ▲ cambio de gramaje"}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            aria-label="Período del historial"
            value={[String(period)]}
            variant="outline"
            size="sm"
            spacing={0}
            onValueChange={(next) => next.length && onPeriodChange(Number(next[0]) as Period)}
          >
            {PERIODS.map((days) => (
              <ToggleGroupItem key={days} value={String(days)}>
                {periodLabel(days)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="min-w-0">
        {data.length === 0 ? (
          <p className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No hay precios en este período.
          </p>
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto h-80 w-full"
            role="img"
            aria-label={`Historial de precios de ${product.name} por tienda`}
          >
            <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={axisDate}
                minTickGap={32}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={format}
                tickLine={false}
                axisLine={false}
                width={currency === "USD" ? 64 : 72}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => dateLabel(String(label))}
                    formatter={(value, name) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {config[name as keyof typeof config]?.label}
                        </span>
                        <span className="font-mono">{format(Number(value))}</span>
                      </span>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
              {history.stores.map((store) => (
                <Line
                  key={store.slug}
                  dataKey={store.slug}
                  type="stepAfter"
                  stroke={`var(--color-${store.slug})`}
                  strokeWidth={2}
                  dot={data.length === 1}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              {reduMarks.map((mark) => (
                <ReferenceDot
                  key={mark.slug}
                  x={mark.date}
                  y={mark.value}
                  r={4}
                  fill="#f59e0b"
                  stroke="var(--background)"
                  strokeWidth={2}
                  label={{ value: "▲", position: "top", fill: "#f59e0b", fontSize: 11 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function CompareCard({
  product,
  history,
  period,
}: {
  product: ProductData
  history: ProductHistory
  period: Period
}) {
  // Same category first, which is what usually gets compared.
  const { data: sameCategory } = useApi<ProductSummary[]>(
    `/products${query({ category: product.category, exclude: product.id, limit: 50 })}`
  )
  const [otherId, setOtherId] = React.useState<string | null>(null)
  const candidates = sameCategory ?? []
  const selectedId = otherId ?? candidates[0]?.id ?? null
  const other = candidates.find((item) => item.id === selectedId) ?? null
  const { data: otherHistory } = useApi<ProductHistory>(
    selectedId ? `/products/${selectedId}/history${query({ days: period, rate: RATE })}` : null
  )

  const own = averageByDate(history.points)
  const theirs = otherHistory && other ? averageByDate(otherHistory.points) : null
  // Only the days both products have a price; base 100 = the first of them.
  const dates = theirs ? [...own.keys()].filter((date) => theirs.has(date)).sort() : []
  const data = dates.map((date) => ({
    date,
    a: (own.get(date)! / own.get(dates[0])!) * 100,
    b: (theirs!.get(date)! / theirs!.get(dates[0])!) * 100,
  }))
  const ownEnd = data.at(-1)?.a ?? 100
  const theirEnd = data.at(-1)?.b ?? 100
  const gap = ownEnd - theirEnd
  const config = {
    a: { label: product.name, color: "#4a5bdb" },
    b: { label: other?.name ?? "", color: "#f59e0b" },
  } satisfies ChartConfig
  const items = candidates.map((item) => ({
    label: [item.name, item.content].filter(Boolean).join(" · "),
    value: item.id,
  }))

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle>
          <h3>Comparación</h3>
        </CardTitle>
        <CardDescription>
          Índice base 100 = primer día con precio de los dos productos, últimos{" "}
          {periodLabel(period)}
        </CardDescription>
        {items.length > 0 && (
          <CardAction className="w-56">
            <Label htmlFor="compare-with" className="sr-only">
              Comparar con
            </Label>
            <Select items={items} value={selectedId} onValueChange={(next) => next && setOtherId(next)}>
              <SelectTrigger id="compare-with" className="h-9! w-full">
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
          </CardAction>
        )}
      </CardHeader>

      {!sameCategory ? (
        <Skeleton className="m-(--card-spacing) h-64" />
      ) : !other ? (
        <p className="p-(--card-spacing) text-sm text-muted-foreground">
          No hay otros productos de esta categoría en tus tiendas para comparar.
        </p>
      ) : !otherHistory ? (
        <Skeleton className="m-(--card-spacing) h-64" />
      ) : data.length < 2 ? (
        <p className="p-(--card-spacing) text-sm text-muted-foreground">
          Todavía no hay suficientes días con precio de los dos productos para comparar.
        </p>
      ) : (
        <div className="grid @3xl/main:grid-cols-[280px_1fr]">
          <dl className="flex flex-col divide-y border-b @3xl/main:border-r @3xl/main:border-b-0">
            {[
              { name: product.name, content: product.content, end: ownEnd, avg: own.get(dates.at(-1)!)!, color: config.a.color },
              { name: other.name, content: other.content, end: theirEnd, avg: theirs!.get(dates.at(-1)!)!, color: config.b.color },
            ].map((item) => (
              <div key={item.name} className="flex flex-col gap-1 px-(--card-spacing) py-4">
                <dt className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  {item.name}
                  {item.content && (
                    <span className="font-normal text-muted-foreground">· {item.content}</span>
                  )}
                </dt>
                <dd className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-2xl font-semibold tabular-nums">
                    {decimal(item.end)}
                  </span>
                  <ToneBadge tone={item.end >= 100 ? "red" : "emerald"} className="font-mono">
                    {item.end >= 100 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    {formatPct(item.end - 100)}
                  </ToneBadge>
                </dd>
                <dd className="text-xs text-muted-foreground">
                  Promedio regular {formatArs(item.avg)}
                </dd>
              </div>
            ))}
            <p className="px-(--card-spacing) py-4 text-sm text-muted-foreground">
              {product.name} subió {formatPP(gap)} {gap >= 0 ? "más" : "menos"} que{" "}
              {other.name.toLowerCase()} en el período.
            </p>
          </dl>

          <div className="min-w-0 p-(--card-spacing)">
            <ChartContainer
              config={config}
              className="aspect-auto h-64 w-full"
              role="img"
              aria-label={`Índice de ${product.name} frente a ${other.name}`}
            >
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={axisDate} minTickGap={32} tickLine={false} axisLine={false} />
                <YAxis domain={["auto", "auto"]} tickFormatter={decimal} tickLine={false} axisLine={false} width={44} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => dateLabel(String(label))}
                      formatter={(value, name) => (
                        <span className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {config[name as keyof typeof config]?.label}
                          </span>
                          <span className="font-mono">{decimal(Number(value))}</span>
                        </span>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="a" type="stepAfter" stroke="var(--color-a)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="b" type="stepAfter" stroke="var(--color-b)" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      )}
    </Card>
  )
}

function DailyTable({
  product,
  history,
}: {
  product: ProductData
  history: ProductHistory
}) {
  const [store, setStore] = React.useState("all")
  const [until, setUntil] = React.useState("")
  const [page, setPage] = React.useState(1)
  const nameOf = Object.fromEntries(history.stores.map((item) => [item.slug, item.name]))

  const rows = React.useMemo(
    () =>
      [...history.points]
        .reverse()
        .filter((point) => (!until || point.date <= until) && (store === "all" || point.store_slug === store)),
    [history, until, store]
  )
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const storeItems = [
    { label: "Todas las tiendas", value: "all" },
    ...history.stores.map((item) => ({ label: item.name, value: item.slug })),
  ]

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle>
          <h3>Historial día por día</h3>
        </CardTitle>
        <CardDescription>
          Último precio de cada día. El USD usa la cotización blue vigente al capturar el precio.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-wrap items-center gap-2 border-b p-(--card-spacing)">
        <div className="relative w-full sm:w-48">
          <Label htmlFor="daily-until" className="sr-only">
            Ir a una fecha
          </Label>
          <CalendarSearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="daily-until"
            type="date"
            className="h-9 pl-8"
            value={until}
            min={history.start}
            max={history.end}
            onChange={(event) => {
              setUntil(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <Label htmlFor="daily-store" className="sr-only">
          Tienda
        </Label>
        <Select
          items={storeItems}
          value={store}
          onValueChange={(next) => {
            if (!next) return
            setStore(next)
            setPage(1)
          }}
        >
          <SelectTrigger id="daily-store" className="h-9! w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {storeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {(until || store !== "all") && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setUntil("")
              setStore("all")
              setPage(1)
            }}
          >
            <XIcon data-icon="inline-start" />
            Limpiar
          </Button>
        )}
      </div>

      <Table aria-label="Historial día por día" className="min-w-[820px]">
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-(--card-spacing)">Fecha</TableHead>
            <TableHead>Tienda</TableHead>
            <TableHead className="text-right">Precio regular</TableHead>
            <TableHead className="text-right">Precio promo</TableHead>
            <TableHead>Contenido</TableHead>
            <TableHead className="text-right">Precio USD</TableHead>
            <TableHead className="pr-(--card-spacing)">Cotización usada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                No hay precios para esa fecha y tienda.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((point) => (
              <TableRow key={`${point.date}-${point.store_slug}`}>
                <TableCell className="pl-(--card-spacing) font-mono tabular-nums">
                  {dateLabel(point.date)}
                </TableCell>
                <TableCell>{nameOf[point.store_slug] ?? point.store_slug}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {point.is_promo ? (
                    <s className="text-muted-foreground">{formatArs(Number(point.regular_price))}</s>
                  ) : (
                    formatArs(Number(point.regular_price))
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {point.is_promo ? (
                    <ToneBadge tone="violet" className="ml-auto font-mono">
                      {formatArs(Number(point.price))}
                    </ToneBadge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    point.content && product.content && point.content !== product.content &&
                      "text-amber-700 dark:text-amber-400"
                  )}
                >
                  {point.content ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {point.usd_price != null ? formatUsdAmount(Number(point.usd_price)) : "—"}
                </TableCell>
                <TableCell className="pr-(--card-spacing) font-mono text-muted-foreground tabular-nums">
                  {point.fx != null
                    ? `Blue ${formatArs(Number(point.fx))}${point.quoted_at ? ` · ${formatQuoteTime(point.quoted_at).split(" · ")[1]}` : ""}`
                    : "Sin cotización"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="border-t p-(--card-spacing)">
        <TablePagination
          page={current}
          size={PAGE_SIZE}
          total={rows.length}
          noun={rows.length === 1 ? "registro" : "registros"}
          onPageChange={setPage}
        />
      </div>
    </Card>
  )
}
