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
  GitCompareArrowsIcon,
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
import { formatArs, formatPct, formatPP, formatUsd } from "@/lib/format"
import { QUOTES } from "@/lib/quotes"
import { cn } from "@/lib/utils"

import {
  PERIODS,
  REDU_DATE,
  SNAPSHOT_DATE,
  STORES,
  averageOf,
  canonicalId,
  compareCandidates,
  dateLabel,
  findProduct,
  historyFor,
  parseRedu,
  storeSize,
  unitAmount,
  type HistoryPoint,
  type Period,
  type Product,
} from "./data"

type Currency = "ARS" | "USD"

const STORE_COLORS = ["#6366f1", "#14b8a6", "#f472b6"]
const PAGE_SIZE = 10
// La promo vigente de la matriz se muestra en los últimos 7 días.
const PROMO_DAYS = 7

const axisDate = (date: string) => dateLabel(date).slice(0, 5)
const decimal = (value: number) => value.toFixed(1).replace(".", ",")
const periodLabel = (days: number) => (days === 365 ? "12 m" : `${days} d`)

function money(value: number, currency: Currency, rate: number) {
  return currency === "USD" ? formatUsd(value, rate) : formatArs(value)
}

// UX06 · Ficha de producto: el mismo producto en las tiendas del cliente,
// su historial, una comparación opcional y el detalle día por día.
export function ProductDetail() {
  const params = useSearchParams()
  const product = findProduct(params.get("p"))
  // Al cambiar de producto la ficha arranca de cero (período, comparación…).
  return <ProductView key={product.name} product={product} />
}

function ProductView({ product }: { product: Product }) {
  const [currency, setCurrency] = React.useState<Currency>("ARS")
  const [period, setPeriod] = React.useState<Period>(90)
  const [compareWith, setCompareWith] = React.useState<string | null>(null)

  const history = React.useMemo(() => historyFor(product), [product])
  const visible = history.slice(-(period + 1))
  const reduStores = STORES.flatMap((store, index) =>
    product.redu?.[index] ? [{ store, index, ...parseRedu(product.redu[index]!) }] : []
  )
  const candidates = compareCandidates(product)

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
        description={`${product.cat} · ${product.size} · ID canónico ${canonicalId(product)}`}
        badge={
          reduStores.length > 0 && (
            <ToneBadge tone="amber">
              <TriangleAlertIcon />
              Reduflación en {reduStores.map((item) => item.store).join(", ")}
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
            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                setCompareWith(compareWith ? null : candidates[0].name)
              }
            >
              {compareWith ? (
                <XIcon data-icon="inline-start" />
              ) : (
                <GitCompareArrowsIcon data-icon="inline-start" />
              )}
              {compareWith ? "Quitar comparación" : "Comparar"}
            </Button>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/user/regla-nueva" />}
            >
              <BellPlusIcon data-icon="inline-start" />
              Crear alerta
            </Button>
          </>
        }
      />

      <StoreCards product={product} currency={currency} />

      <HistoryCard
        history={visible}
        product={product}
        currency={currency}
        period={period}
        onPeriodChange={setPeriod}
      />

      {compareWith && (
        <CompareCard
          product={product}
          other={candidates.find((item) => item.name === compareWith) ?? candidates[0]}
          candidates={candidates}
          period={period}
          onChange={setCompareWith}
        />
      )}

      <DailyTable product={product} history={visible} />
    </>
  )
}

export function ProductDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 @3xl/main:grid-cols-3">
        {STORES.map((store) => (
          <Skeleton key={store} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </>
  )
}

function StoreCards({
  product,
  currency,
}: {
  product: Product
  currency: Currency
}) {
  const rate = QUOTES.blue
  const known = product.p.filter((value): value is number => value != null)
  const min = Math.min(...known)
  const max = Math.max(...known)
  const ranked = known.length > 1 && min !== max

  // Precio por gramo/ml de cada tienda, para detectar la reduflación.
  const perUnit = product.p.map((price, store) => {
    const unit = unitAmount(storeSize(product, store))
    return price != null && unit ? { value: price / unit.amount, unit: unit.unit } : null
  })
  const unitValues = perUnit.flatMap((item) => (item ? [item.value] : []))
  const maxUnit = Math.max(...unitValues)

  return (
    <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
      {STORES.map((store, index) => {
        const price = product.p[index]
        const unit = perUnit[index]
        const regular = product.promo?.[index]
        const redu = product.redu?.[index]
        return (
          <Card key={store} className="@container/card shadow-xs">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: STORE_COLORS[index] }}
                  aria-hidden="true"
                />
                {store}
              </CardDescription>
              <CardTitle className="font-mono text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {price == null ? "—" : money(price, currency, rate)}
              </CardTitle>
              <CardAction>
                {price == null ? (
                  <ToneBadge tone="neutral">Sin dato</ToneBadge>
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
              {price != null && (
                <div className="col-span-full flex flex-col gap-2 pt-1 text-sm text-muted-foreground">
                  <p className="font-mono text-xs tabular-nums">
                    {money(price, currency === "ARS" ? "USD" : "ARS", rate)} ·{" "}
                    {storeSize(product, index)}
                    {unit &&
                      ` · $ ${unit.value.toFixed(2).replace(".", ",")} / ${unit.unit}`}
                  </p>
                  {(regular || redu) && (
                    <div className="flex flex-wrap gap-1.5">
                      {regular && (
                        <ToneBadge tone="violet">
                          <TagIcon />
                          Promo · regular <s className="font-mono">{formatArs(regular)}</s>
                        </ToneBadge>
                      )}
                      {redu && (
                        <ToneBadge tone="amber">
                          <TriangleAlertIcon />
                          {redu}
                          {unit && unit.value === maxUnit && " · más caro por " + unit.unit}
                        </ToneBadge>
                      )}
                    </div>
                  )}
                </div>
              )}
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
}: {
  history: HistoryPoint[]
  product: Product
  currency: Currency
  period: Period
  onPeriodChange: (period: Period) => void
}) {
  const config = Object.fromEntries(
    STORES.map((store, index) => [
      `s${index}`,
      { label: store, color: STORE_COLORS[index] },
    ])
  ) satisfies ChartConfig

  const data = history.map((point) => ({
    date: point.date,
    ...Object.fromEntries(
      point.prices.map((price, index) => [
        `s${index}`,
        price == null ? null : currency === "USD" ? price / point.rate : price,
      ])
    ),
  }))
  const format = (value: number) =>
    currency === "USD"
      ? `US$ ${value.toFixed(2).replace(".", ",")}`
      : formatArs(value)

  const reduMarks = STORES.flatMap((_, index) => {
    if (!product.redu?.[index]) return []
    const point = data.find((item) => item.date === REDU_DATE)
    const value = point?.[`s${index}` as keyof typeof point]
    return typeof value === "number" ? [{ index, value }] : []
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
            onValueChange={(next) =>
              next.length && onPeriodChange(Number(next[0]) as Period)
            }
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
            {STORES.map((_, index) => (
              <Line
                key={index}
                dataKey={`s${index}`}
                type="stepAfter"
                stroke={`var(--color-s${index})`}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {reduMarks.map((mark) => (
              <ReferenceDot
                key={mark.index}
                x={REDU_DATE}
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
      </CardContent>
    </Card>
  )
}

function indexSeries(product: Product, period: Period) {
  const history = historyFor(product).slice(-(period + 1))
  const base = averageOf(history[0].prices)
  return history.map((point) => ({
    date: point.date,
    value: (averageOf(point.prices) / base) * 100,
  }))
}

function CompareCard({
  product,
  other,
  candidates,
  period,
  onChange,
}: {
  product: Product
  other: Product
  candidates: Product[]
  period: Period
  onChange: (name: string) => void
}) {
  const own = indexSeries(product, period)
  const theirs = indexSeries(other, period)
  const data = own.map((point, index) => ({
    date: point.date,
    a: point.value,
    b: theirs[index].value,
  }))
  const ownEnd = own[own.length - 1].value
  const theirEnd = theirs[theirs.length - 1].value
  const gap = ownEnd - theirEnd
  const config = {
    a: { label: product.name, color: "#4a5bdb" },
    b: { label: other.name, color: "#f59e0b" },
  } satisfies ChartConfig
  const items = candidates.map((item) => ({ label: item.name, value: item.name }))

  return (
    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle>
          <h3>Comparación</h3>
        </CardTitle>
        <CardDescription>
          Índice base 100 = promedio de tus tiendas hace {periodLabel(period)}
        </CardDescription>
        <CardAction className="w-56">
          <Label htmlFor="compare-with" className="sr-only">
            Comparar con
          </Label>
          <Select items={items} value={other.name} onValueChange={(next) => next && onChange(next)}>
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
      </CardHeader>

      <div className="grid @3xl/main:grid-cols-[280px_1fr]">
        <dl className="flex flex-col divide-y border-b @3xl/main:border-r @3xl/main:border-b-0">
          {[
            { item: product, end: ownEnd, color: config.a.color },
            { item: other, end: theirEnd, color: config.b.color },
          ].map(({ item, end, color }) => (
            <div key={item.name} className="flex flex-col gap-1 px-(--card-spacing) py-4">
              <dt className="flex items-center gap-2 text-sm font-medium">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                {item.name}
                <span className="font-normal text-muted-foreground">· {item.size}</span>
              </dt>
              <dd className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {decimal(end)}
                </span>
                <ToneBadge tone={end >= 100 ? "red" : "emerald"} className="font-mono">
                  {end >= 100 ? <ArrowUpIcon /> : <ArrowDownIcon />}
                  {formatPct(end - 100)}
                </ToneBadge>
              </dd>
              <dd className="text-xs text-muted-foreground">
                Promedio hoy {formatArs(averageOf(item.p))}
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
    </Card>
  )
}

function DailyTable({
  product,
  history,
}: {
  product: Product
  history: HistoryPoint[]
}) {
  const [store, setStore] = React.useState("all")
  const [until, setUntil] = React.useState("")
  const [page, setPage] = React.useState(1)
  const first = history[0].date

  const rows = React.useMemo(
    () =>
      [...history]
        .reverse()
        .filter((point) => !until || point.date <= until)
        .flatMap((point) =>
          STORES.flatMap((name, index) => {
            const price = point.prices[index]
            if (price == null || (store !== "all" && store !== String(index))) return []
            const promoOn = point.daysBack < PROMO_DAYS && product.promo?.[index]
            const promo = promoOn ? product.p[index] : null
            const redu = product.redu?.[index]
            const size =
              redu && point.date < REDU_DATE ? parseRedu(redu).before : storeSize(product, index)
            return [{ point, name, price, promo, size }]
          })
        ),
    [history, until, store, product]
  )
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const storeItems = [
    { label: "Todas las tiendas", value: "all" },
    ...STORES.map((name, index) => ({ label: name, value: String(index) })),
  ]

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle>
          <h3>Historial día por día</h3>
        </CardTitle>
        <CardDescription>
          Precio en USD con la cotización blue de cada día, tomada a las 06:00
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
            min={first}
            max={SNAPSHOT_DATE}
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
            <TableHead>Gramaje</TableHead>
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
            visible.map(({ point, name, price, promo, size }) => (
              <TableRow key={`${point.date}-${name}`}>
                <TableCell className="pl-(--card-spacing) font-mono tabular-nums">
                  {dateLabel(point.date)}
                </TableCell>
                <TableCell>{name}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {promo ? <s className="text-muted-foreground">{formatArs(price)}</s> : formatArs(price)}
                </TableCell>
                <TableCell className="text-right">
                  {promo ? (
                    <ToneBadge tone="violet" className="ml-auto font-mono">
                      {formatArs(promo)}
                    </ToneBadge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn(size !== product.size && "text-amber-700 dark:text-amber-400")}>
                  {size}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatUsd(promo ?? price, point.rate)}
                </TableCell>
                <TableCell className="pr-(--card-spacing) font-mono text-muted-foreground tabular-nums">
                  Blue {formatArs(point.rate)} · 06:00
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

