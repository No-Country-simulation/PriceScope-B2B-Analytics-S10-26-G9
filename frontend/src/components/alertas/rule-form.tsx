"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CalendarRangeIcon,
  CheckIcon,
  SearchIcon,
  SparklesIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ApiError,
  query,
  type AlertRule,
  type AlertRuleInput,
  type AlertRuleKind,
  type AlertRuleScope,
  type MilestoneKey,
  type ProductSummary,
  type RuleConditions,
  type RuleOptions,
  type RulePreview,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/categories"
import { formatPct, formatPP } from "@/lib/format"
import { QUOTE_LABEL, type Quote } from "@/lib/quotes"
import { notifyAlertsChanged, useApi } from "@/lib/use-api"

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]
const ANY_STORE = "any"
const API_RATE = { blue: "blue", oficial: "official" } as const
const QUOTE_OF = { blue: "blue", official: "oficial" } as const
const PREVIEW_DELAY_MS = 400

type Draft = {
  kind: AlertRuleKind
  scope: AlertRuleScope
  category: ProductCategory | null
  product: { id: string; name: string } | null
  /** Store id, or ANY_STORE. */
  store: string
  period: Period
  /** Tal cual lo tipea el usuario; acepta coma decimal. */
  threshold: string
  quote: Quote
  milestone: MilestoneKey
  from: string
  to: string
}

const KIND_OPTIONS = [
  {
    value: "devaluation",
    title: "Sube más que la devaluación",
    description: "Compara la suba del precio con la del dólar en un período.",
    icon: <TrendingUpIcon />,
  },
  {
    value: "milestone",
    title: "Hito comercial",
    description: "CyberWeek, Hot Sale u otra fecha con rango propio.",
    icon: <CalendarRangeIcon />,
  },
] as const

const SCOPE_ITEMS = [
  { value: "category", label: "Categoría" },
  { value: "product", label: "Producto" },
]

function milestoneItems(options: RuleOptions) {
  return [
    ...options.milestones.map((m) => ({ key: m.key, label: m.label, from: m.starts_on, to: m.ends_on })),
    { key: "custom" as const, label: "Fecha personalizada", from: "", to: "" },
  ]
}

function initialDraft(
  options: RuleOptions,
  { rule, product, category }: {
    rule: AlertRule | null
    product: ProductSummary | null
    category: ProductCategory | null
  }
): Draft {
  const first = options.milestones[0]
  const base: Draft = {
    kind: "devaluation",
    scope: "category",
    category: category ?? options.categories[0] ?? null,
    product: null,
    store: ANY_STORE,
    period: 30,
    threshold: "2",
    quote: "blue",
    milestone: first?.key ?? "custom",
    from: first?.starts_on ?? "",
    to: first?.ends_on ?? "",
  }
  if (product) {
    return { ...base, scope: "product", product: { id: product.id, name: product.name } }
  }
  if (!rule) return base
  return {
    kind: rule.kind,
    scope: rule.scope,
    category: rule.category ?? base.category,
    product: rule.canonical_product_id
      ? { id: rule.canonical_product_id, name: rule.product_name ?? "Producto" }
      : null,
    store: rule.store_id ?? ANY_STORE,
    period: (rule.period_days ?? 30) as Period,
    threshold: String(Number(rule.threshold_pp)).replace(".", ","),
    quote: QUOTE_OF[rule.rate_type],
    milestone: rule.milestone_key ?? base.milestone,
    from: rule.starts_on ?? base.from,
    to: rule.ends_on ?? base.to,
  }
}

function conditions(draft: Draft, threshold: number): RuleConditions {
  const milestone = draft.kind === "milestone"
  return {
    kind: draft.kind,
    scope: draft.scope,
    category: draft.scope === "category" ? draft.category : null,
    canonical_product_id: draft.scope === "product" ? draft.product?.id ?? null : null,
    store_id: draft.store === ANY_STORE ? null : draft.store,
    rate_type: API_RATE[draft.quote],
    threshold_pp: String(threshold),
    period_days: milestone ? null : draft.period,
    milestone_key: milestone ? draft.milestone : null,
    starts_on: milestone ? draft.from : null,
    ends_on: milestone ? draft.to : null,
  }
}

// UX07 · Nueva regla de alerta. Arranca vacía, con una regla (?rule=, para
// editar), un producto (?product=, desde la ficha) o una categoría
// (?category=, desde el dashboard).
export function RuleForm() {
  const params = useSearchParams()
  const ruleId = params.get("rule")
  const productId = params.get("product")
  const categoryParam = params.get("category")
  const options = useApi<RuleOptions>("/alert-rules/options")
  const rule = useApi<AlertRule>(ruleId ? `/alert-rules/${ruleId}` : null)
  const product = useApi<ProductSummary>(!ruleId && productId ? `/products/${productId}` : null)

  const failed = options.error || rule.error
  if (failed) {
    return (
      <FormShell editing={Boolean(ruleId)}>
        <Card className="items-center gap-3 py-12 text-center text-sm text-muted-foreground shadow-xs">
          {rule.error instanceof ApiError && rule.error.status === 404
            ? "Esta regla no existe o ya fue eliminada."
            : "No pudimos cargar el formulario. Probá de nuevo."}
        </Card>
      </FormShell>
    )
  }
  const waiting =
    !options.data || (ruleId && !rule.data) || (!ruleId && productId && product.loading)
  if (waiting) return <RuleFormSkeleton editing={Boolean(ruleId)} />
  const opts = options.data!
  if (!opts.stores.length) {
    return (
      <FormShell editing={false}>
        <Card className="items-center gap-3 py-12 text-center text-sm text-muted-foreground shadow-xs">
          Tu cuenta no tiene tiendas asignadas. Pedile a un administrador que te
          asigne al menos una para crear reglas.
        </Card>
      </FormShell>
    )
  }

  const category = (opts.categories as string[]).includes(categoryParam ?? "")
    ? (categoryParam as ProductCategory)
    : null
  const initial = initialDraft(opts, {
    rule: rule.data,
    // A product outside the user's stores (edited link) just starts empty.
    product: product.error ? null : product.data,
    category,
  })
  return (
    <RuleEditor
      key={ruleId ?? productId ?? categoryParam ?? "new"}
      options={opts}
      rule={rule.data}
      initial={initial}
    />
  )
}

function FormShell({ editing, children }: { editing: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title={editing ? "Editar regla de alerta" : "Nueva regla de alerta"}
        description="Definí qué querés vigilar. Solo se ofrecen tus tiendas asignadas."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/user/alertas" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a alertas
          </Button>
        }
      />
      {children}
    </div>
  )
}

export function RuleFormSkeleton({ editing = false }: { editing?: boolean }) {
  return (
    <FormShell editing={editing}>
      <div className="grid items-start gap-4 @5xl/main:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </FormShell>
  )
}

function RuleEditor({
  options,
  rule,
  initial,
}: {
  options: RuleOptions
  rule: AlertRule | null
  initial: Draft
}) {
  const router = useRouter()
  const { request } = useAuth()
  const [draft, setDraft] = React.useState<Draft>(initial)
  const [customName, setCustomName] = React.useState<string | null>(rule?.name ?? null)
  const [notifyBell, setNotifyBell] = React.useState(rule?.notify_in_app ?? true)
  const [submitted, setSubmitted] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const milestones = milestoneItems(options)
  const storeName = (id: string) => options.stores.find((store) => store.id === id)?.name
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const threshold = Number(draft.threshold.replace(",", "."))
  const thresholdInvalid =
    draft.threshold.trim() === "" || !Number.isFinite(threshold) || threshold < 0 || threshold >= 1000
  const rangeInvalid =
    draft.kind === "milestone" && (!draft.from || !draft.to || draft.from > draft.to)
  const targetInvalid =
    draft.scope === "category" ? draft.category === null : draft.product === null

  const labels = {
    target: draft.scope === "category"
      ? draft.category ? CATEGORY_LABEL[draft.category] : "—"
      : draft.product?.name ?? "—",
    store: draft.store === ANY_STORE ? "cualquier tienda" : storeName(draft.store) ?? "—",
    milestone: milestones.find((m) => m.key === draft.milestone)?.label ?? "Hito",
  }
  const suggestedName = suggestName(draft, labels)
  const name = customName ?? suggestedName
  const nameInvalid = name.trim() === ""
  const invalid = thresholdInvalid || rangeInvalid || targetInvalid

  // Vista previa: el backend calcula con los precios de hoy, igual que el worker.
  const body = invalid ? null : JSON.stringify(conditions(draft, threshold))
  const [preview, setPreview] = React.useState<{
    body: string
    data: RulePreview | null
    error: string | null
  } | null>(null)
  React.useEffect(() => {
    if (!body) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      request<RulePreview>("/alert-rules/preview", { method: "POST", body })
        .then((data) => { if (!cancelled) setPreview({ body, data, error: null }) })
        .catch((error) => {
          if (!cancelled) {
            setPreview({
              body,
              data: null,
              error: error instanceof ApiError ? error.message : "No pudimos calcular la vista previa.",
            })
          }
        })
    }, PREVIEW_DELAY_MS)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [request, body])
  const current = body && preview?.body === body ? preview : null
  const previewLoading = body !== null && current === null
  const result = current?.data ?? null
  const devaluation = result?.devaluation_pct == null ? null : Number(result.devaluation_pct)

  function pickScope(scope: AlertRuleScope) {
    setDraft((current) => ({ ...current, scope }))
  }

  function pickMilestone(key: MilestoneKey) {
    const milestone = milestones.find((item) => item.key === key)!
    setDraft((current) => ({
      ...current,
      milestone: key,
      from: milestone.from || current.from,
      to: milestone.to || current.to,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (invalid || nameInvalid || saving) return
    const data: AlertRuleInput = {
      ...conditions(draft, threshold),
      name: name.trim(),
      notify_in_app: notifyBell,
    }
    setSaving(true)
    try {
      await request<AlertRule>(rule ? `/alert-rules/${rule.id}` : "/alert-rules", {
        method: rule ? "PATCH" : "POST",
        body: JSON.stringify(data),
      })
      notifyAlertsChanged()
      toast.success(rule ? "Regla actualizada" : "Regla creada", {
        description: rule
          ? `“${data.name}” ya usa los cambios.`
          : `“${data.name}” ya está activa. Te vamos a avisar en la campana.`,
      })
      router.push("/user/alertas")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No pudimos guardar la regla.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title={rule ? "Editar regla de alerta" : "Nueva regla de alerta"}
        description="Definí qué querés vigilar. Solo se ofrecen tus tiendas asignadas."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/user/alertas" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a alertas
          </Button>
        }
      />

      <div className="grid items-start gap-4 @5xl/main:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            step={1}
            title="Tipo de alerta"
            description="Qué tiene que pasar para que te avisemos."
          >
            <RadioGroup
              value={draft.kind}
              onValueChange={(value) => update("kind", value as AlertRuleKind)}
              className="grid gap-3 @xl/main:grid-cols-2"
              aria-label="Tipo de alerta"
            >
              {KIND_OPTIONS.map((option) => (
                <FieldLabel key={option.value} htmlFor={`kind-${option.value}`}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle className="[&>svg]:size-4 [&>svg]:text-muted-foreground">
                        {option.icon}
                        {option.title}
                      </FieldTitle>
                      <FieldDescription>{option.description}</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem
                      value={option.value}
                      id={`kind-${option.value}`}
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>

            {draft.kind === "milestone" && (
              <FieldGroup className="grid gap-4 @xl/main:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="rule-milestone">Hito</FieldLabel>
                  <Select
                    items={milestones.map((m) => ({ value: m.key, label: m.label }))}
                    value={draft.milestone}
                    onValueChange={(value) => value && pickMilestone(value as MilestoneKey)}
                  >
                    <SelectTrigger id="rule-milestone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {milestones.map((m) => (
                        <SelectItem key={m.key} value={m.key}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={(submitted && rangeInvalid) || undefined}>
                  <FieldLabel htmlFor="rule-from">Desde</FieldLabel>
                  <Input
                    id="rule-from"
                    type="date"
                    value={draft.from}
                    onChange={(event) => update("from", event.target.value)}
                    aria-invalid={(submitted && rangeInvalid) || undefined}
                    className="font-mono tabular-nums"
                  />
                </Field>
                <Field data-invalid={(submitted && rangeInvalid) || undefined}>
                  <FieldLabel htmlFor="rule-to">Hasta</FieldLabel>
                  <Input
                    id="rule-to"
                    type="date"
                    value={draft.to}
                    onChange={(event) => update("to", event.target.value)}
                    aria-invalid={(submitted && rangeInvalid) || undefined}
                    className="font-mono tabular-nums"
                  />
                </Field>
                {submitted && rangeInvalid && (
                  <FieldError className="@xl/main:col-span-3">
                    Revisá el rango: la fecha “hasta” no puede ser anterior a
                    “desde”.
                  </FieldError>
                )}
              </FieldGroup>
            )}
          </Section>

          <Section
            step={2}
            title="Alcance"
            description="Qué productos y en qué tiendas."
          >
            <FieldGroup className="grid gap-4 @xl/main:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="rule-scope">Vigilar por</FieldLabel>
                <Select
                  items={SCOPE_ITEMS}
                  value={draft.scope}
                  onValueChange={(value) => value && pickScope(value as AlertRuleScope)}
                >
                  <SelectTrigger id="rule-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={(submitted && targetInvalid) || undefined}>
                <FieldLabel htmlFor="rule-target">
                  {draft.scope === "category" ? "Categoría" : "Producto"}
                </FieldLabel>
                {draft.scope === "category" ? (
                  options.categories.length ? (
                    <OptionSelect
                      id="rule-target"
                      items={options.categories.map((value) => ({ value, label: CATEGORY_LABEL[value] }))}
                      value={draft.category ?? ""}
                      onChange={(value) => update("category", value as ProductCategory)}
                    />
                  ) : (
                    <FieldDescription>Tus tiendas todavía no tienen productos clasificados.</FieldDescription>
                  )
                ) : (
                  <ProductPicker
                    id="rule-target"
                    value={draft.product}
                    onChange={(product) => update("product", product)}
                  />
                )}
                {submitted && targetInvalid && (
                  <FieldError>
                    {draft.scope === "category" ? "Elegí una categoría." : "Elegí un producto."}
                  </FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-store">Tienda</FieldLabel>
                <OptionSelect
                  id="rule-store"
                  items={[
                    { value: ANY_STORE, label: "Cualquier tienda" },
                    ...options.stores.map((store) => ({ value: store.id, label: store.name })),
                  ]}
                  value={draft.store}
                  onChange={(value) => update("store", value)}
                />
              </Field>
            </FieldGroup>
          </Section>

          <Section
            step={3}
            title="Condición"
            description="Cuánto tiene que subir por encima del dólar."
          >
            <FieldGroup className="grid gap-4 @xl/main:grid-cols-2">
              {draft.kind === "devaluation" && (
                <Field className="@xl/main:col-span-2">
                  <FieldTitle>Período de comparación</FieldTitle>
                  <ToggleGroup
                    aria-label="Período de comparación"
                    value={[String(draft.period)]}
                    variant="outline"
                    spacing={0}
                    onValueChange={(next) => {
                      if (next.length) update("period", Number(next[0]) as Period)
                    }}
                  >
                    {PERIODS.map((days) => (
                      <ToggleGroupItem
                        key={days}
                        value={String(days)}
                        className="h-9 px-3"
                      >
                        {days} días
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              )}
              <Field data-invalid={(submitted && thresholdInvalid) || undefined}>
                <FieldLabel htmlFor="rule-threshold">
                  Umbral (p.p. por encima)
                </FieldLabel>
                <Input
                  id="rule-threshold"
                  inputMode="decimal"
                  value={draft.threshold}
                  onChange={(event) => update("threshold", event.target.value)}
                  aria-invalid={(submitted && thresholdInvalid) || undefined}
                  className="h-9 font-mono tabular-nums"
                />
                {submitted && thresholdInvalid ? (
                  <FieldError>Ingresá un número igual o mayor a 0.</FieldError>
                ) : (
                  <FieldDescription>
                    Diferencia entre la suba del producto y la del dólar.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldTitle>Cotización de referencia</FieldTitle>
                <ToggleGroup
                  aria-label="Cotización de referencia"
                  value={[draft.quote]}
                  variant="outline"
                  spacing={0}
                  onValueChange={(next) => {
                    if (next.length) update("quote", next[0] as Quote)
                  }}
                >
                  {(["blue", "oficial"] as const).map((quote) => (
                    <ToggleGroupItem key={quote} value={quote} className="h-9 px-3">
                      Dólar {QUOTE_LABEL[quote].toLowerCase()}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>
                  Devaluación del período:{" "}
                  <span className="font-mono tabular-nums">
                    {devaluation !== null
                      ? formatPct(devaluation)
                      : result && result.evaluated
                        ? "sin cotizaciones"
                        : "—"}
                  </span>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </Section>

          <Section
            step={4}
            title="Nombre y avisos"
            description="Cómo la vas a reconocer en tu bandeja."
          >
            <FieldGroup>
              <Field data-invalid={(submitted && nameInvalid) || undefined}>
                <FieldLabel htmlFor="rule-name">Nombre de la regla</FieldLabel>
                <Input
                  id="rule-name"
                  value={name}
                  onChange={(event) => setCustomName(event.target.value)}
                  aria-invalid={(submitted && nameInvalid) || undefined}
                  maxLength={80}
                  className="h-9"
                />
                {submitted && nameInvalid ? (
                  <FieldError>Ponele un nombre a la regla.</FieldError>
                ) : customName === null ? (
                  <FieldDescription>
                    Sugerido a partir de lo que elegiste. Podés cambiarlo.
                  </FieldDescription>
                ) : (
                  <FieldDescription>
                    <button
                      type="button"
                      onClick={() => setCustomName(null)}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Volver al nombre sugerido
                    </button>
                  </FieldDescription>
                )}
              </Field>
              <Separator />
              <Field orientation="horizontal">
                <Checkbox
                  id="rule-bell"
                  checked={notifyBell}
                  onCheckedChange={(checked) => setNotifyBell(checked === true)}
                />
                <FieldLabel htmlFor="rule-bell" className="font-normal">
                  Mostrar en la campana del tablero
                </FieldLabel>
              </Field>
              <Field orientation="horizontal" data-disabled="true">
                <Checkbox id="rule-mail" disabled />
                <FieldLabel htmlFor="rule-mail" className="font-normal">
                  Enviarme un correo
                  <ToneBadge tone="neutral">Próximamente</ToneBadge>
                </FieldLabel>
              </Field>
            </FieldGroup>
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 @5xl/main:sticky @5xl/main:top-[calc(var(--header-height)+1rem)]">
          <Card className="gap-0 py-0 shadow-xs">
            <CardHeader className="border-b py-(--card-spacing)">
              <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <SparklesIcon className="size-3.5" />
                Vista previa
              </CardDescription>
              <CardTitle className="text-base leading-relaxed font-normal text-muted-foreground">
                <h3>
                  <Phrase draft={draft} labels={labels} />
                </h3>
              </CardTitle>
            </CardHeader>

            <CardContent
              className="flex flex-col gap-3 py-4 transition-opacity data-[loading=true]:opacity-60"
              data-loading={previewLoading && result !== null}
              aria-busy={previewLoading}
            >
              <span className="text-sm font-medium">
                Con datos de hoy se dispararía con
              </span>
              <div className="grid grid-cols-2 divide-x rounded-lg border">
                <PreviewStat label="Productos" value={result?.products_count ?? 0} />
                <PreviewStat label="Tiendas" value={result?.stores_count ?? 0} />
              </div>

              {invalid ? (
                <p className="text-sm text-muted-foreground">
                  Completá el alcance y el umbral para ver la estimación.
                </p>
              ) : current?.error ? (
                <p className="text-sm text-destructive">{current.error}</p>
              ) : !result ? (
                <Skeleton className="h-16" />
              ) : !result.evaluated ? (
                <p className="text-sm text-muted-foreground">
                  El hito no está en curso: la regla se evalúa durante sus
                  fechas y el día siguiente.
                </p>
              ) : devaluation === null ? (
                <p className="text-sm text-muted-foreground">
                  No hay cotizaciones del dólar para este período, así que hoy
                  no se puede evaluar.
                </p>
              ) : result.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Hoy ningún producto supera este umbral. La regla queda vigilando.
                </p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {result.items.slice(0, 4).map((match) => (
                    <li
                      key={`${match.product_name}-${match.store_name}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        {match.canonical_product_id ? (
                          <Link
                            href={`/user/producto?id=${match.canonical_product_id}`}
                            className="block truncate font-medium underline-offset-4 hover:underline"
                          >
                            {match.product_name}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium">{match.product_name}</span>
                        )}
                        <span className="block truncate text-xs text-muted-foreground">
                          {match.store_name}
                        </span>
                      </div>
                      <ToneBadge tone="red" className="font-mono">
                        <ArrowUpIcon />
                        {formatPP(Number(match.variation_pct) - (devaluation ?? 0))}
                      </ToneBadge>
                    </li>
                  ))}
                  {result.products_count > 4 && (
                    <li className="pt-2 text-xs text-muted-foreground">
                      y {result.products_count - 4} más
                    </li>
                  )}
                </ul>
              )}
            </CardContent>

            <CardFooter className="border-t text-xs text-muted-foreground">
              Calculada con los precios y la cotización de hoy. Evaluamos las
              reglas todos los días a las 07:30.
            </CardFooter>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/user/alertas" />}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={saving}>
              <CheckIcon data-icon="inline-start" />
              {rule ? "Guardar cambios" : "Crear regla"}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  )
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Búsqueda por nombre, marca o EAN en las tiendas del usuario (GET /products).
function ProductPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: { id: string; name: string } | null
  onChange: (product: { id: string; name: string } | null) => void
}) {
  const [text, setText] = React.useState("")
  const term = useDebounced(text.trim(), 300)
  const results = useApi<ProductSummary[]>(
    !value && term.length >= 2 ? `/products${query({ q: term, limit: 8 })}` : null
  )

  if (value) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
        <span id={id} className="min-w-0 flex-1 truncate">{value.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cambiar producto"
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      </div>
    )
  }

  const items = term.length >= 2 ? results.data ?? [] : []
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <Input
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Buscar por nombre, marca o EAN"
        autoComplete="off"
        className="h-9 pl-8"
      />
      {term.length >= 2 && (
        <ul className="absolute inset-x-0 top-10 z-10 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {results.loading && items.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">Buscando…</li>
          ) : items.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">Sin resultados en tus tiendas.</li>
          ) : (
            items.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    onChange({ id: product.id, name: product.name })
                    setText("")
                  }}
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[product.brand, product.category ? CATEGORY_LABEL[product.category] : null]
                      .filter(Boolean)
                      .join(" · ") || product.ean || "Sin EAN"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="border-b py-(--card-spacing)">
        <CardTitle className="flex items-center gap-2.5">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground tabular-nums"
            aria-hidden="true"
          >
            {step}
          </span>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription className="pl-8.5">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-(--card-spacing)">
        {children}
      </CardContent>
    </Card>
  )
}

function OptionSelect({
  id,
  items,
  value,
  onChange,
}: {
  id: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <span className="font-mono text-xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Hl({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">
      {children}
    </span>
  )
}

type Labels = { target: string; store: string; milestone: string }

function Phrase({ draft, labels }: { draft: Draft; labels: Labels }) {
  const target =
    draft.scope === "category" ? (
      <>
        un producto de <Hl>{labels.target}</Hl>
      </>
    ) : (
      <Hl>{labels.target}</Hl>
    )
  const threshold = draft.threshold.trim() || "—"
  const quote = <Hl>dólar {QUOTE_LABEL[draft.quote].toLowerCase()}</Hl>
  const store = <Hl>{labels.store}</Hl>

  if (draft.kind === "milestone") {
    return (
      <>
        Avisame si durante{" "}
        <Hl>{draft.milestone === "custom" ? "el rango elegido" : labels.milestone}</Hl>{" "}
        {target} en {store} sube más de{" "}
        <Hl>{threshold.replace(".", ",")} p.p.</Hl> por encima del {quote}.
      </>
    )
  }

  return (
    <>
      Avisame cuando {target} en {store} suba más de{" "}
      <Hl>{threshold.replace(".", ",")} p.p.</Hl> por encima del {quote} en{" "}
      <Hl>los últimos {draft.period} días</Hl>.
    </>
  )
}

function suggestName(draft: Draft, labels: Labels) {
  const name =
    draft.kind === "milestone"
      ? `${draft.milestone === "custom" ? "Hito" : labels.milestone} · ${labels.target}`
      : `${labels.target} supera al ${QUOTE_LABEL[draft.quote].toLowerCase()} · ${draft.period} d`
  return name.slice(0, 80)
}
