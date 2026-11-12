"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CalendarRangeIcon,
  CheckIcon,
  SparklesIcon,
  TrendingUpIcon,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatPct, formatPP } from "@/lib/format"
import { QUOTE_LABEL, type Quote } from "@/lib/quotes"

import {
  ANY_STORE,
  DEVALUATION,
  HITOS,
  PERIODS,
  RULE_CATEGORIES,
  RULE_PRODUCTS,
  RULE_STORES,
  matchesFor,
  type HitoId,
  type Period,
  type RuleDraft,
  productHref,
} from "./rule-data"

const KIND_OPTIONS = [
  {
    value: "devaluation",
    title: "Sube más que la devaluación",
    description: "Compara la suba del precio con la del dólar en un período.",
    icon: <TrendingUpIcon />,
  },
  {
    value: "hit",
    title: "Hito comercial",
    description: "CyberWeek, Hot Sale u otra fecha con rango propio.",
    icon: <CalendarRangeIcon />,
  },
] as const

const SCOPE_ITEMS = [
  { value: "category", label: "Categoría" },
  { value: "product", label: "Producto" },
]

const INITIAL: RuleDraft = {
  kind: "devaluation",
  scope: "category",
  target: RULE_CATEGORIES[0],
  store: ANY_STORE,
  period: 30,
  threshold: "2",
  quote: "blue",
  hito: "cyberweek",
  from: HITOS[0].from,
  to: HITOS[0].to,
}

// UX07 · Nueva regla de alerta: el formulario arma la frase de la regla en
// vivo y estima con datos de muestra cuántos productos la dispararían hoy.
// Solo front: "Crear regla" avisa y vuelve a Alertas sin guardar nada.
export function RuleForm() {
  const router = useRouter()
  const [draft, setDraft] = React.useState<RuleDraft>(INITIAL)
  const [customName, setCustomName] = React.useState<string | null>(null)
  const [notifyBell, setNotifyBell] = React.useState(true)
  const [submitted, setSubmitted] = React.useState(false)

  const update = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const threshold = Number(draft.threshold.replace(",", "."))
  const thresholdInvalid =
    draft.threshold.trim() === "" || !Number.isFinite(threshold) || threshold < 0
  const rangeInvalid =
    draft.kind === "hit" && (!draft.from || !draft.to || draft.from > draft.to)

  const suggestedName = suggestName(draft)
  const name = customName ?? suggestedName
  const nameInvalid = name.trim() === ""

  const devaluation = DEVALUATION[draft.quote][draft.kind === "hit" ? 7 : draft.period]
  const matches = thresholdInvalid
    ? []
    : matchesFor(draft, devaluation, threshold)
  const storesHit = new Set(matches.map((match) => match.store)).size

  function pickScope(scope: RuleDraft["scope"]) {
    setDraft((current) => ({
      ...current,
      scope,
      target: scope === "category" ? RULE_CATEGORIES[0] : RULE_PRODUCTS[0],
    }))
  }

  function pickHito(id: HitoId) {
    const hito = HITOS.find((item) => item.id === id)!
    setDraft((current) => ({
      ...current,
      hito: id,
      from: hito.from || current.from,
      to: hito.to || current.to,
    }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (thresholdInvalid || rangeInvalid || nameInvalid) return
    toast.success("Regla creada", {
      description: `“${name.trim()}” ya está activa. Te vamos a avisar en la campana.`,
    })
    router.push("/user/alertas")
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Nueva regla de alerta"
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
              onValueChange={(value) => update("kind", value as RuleDraft["kind"])}
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

            {draft.kind === "hit" && (
              <FieldGroup className="grid gap-4 @xl/main:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="rule-hito">Hito</FieldLabel>
                  <Select
                    items={HITOS.map((hito) => ({ value: hito.id, label: hito.label }))}
                    value={draft.hito}
                    onValueChange={(value) => value && pickHito(value as HitoId)}
                  >
                    <SelectTrigger id="rule-hito" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HITOS.map((hito) => (
                        <SelectItem key={hito.id} value={hito.id}>
                          {hito.label}
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
                  onValueChange={(value) =>
                    value && pickScope(value as RuleDraft["scope"])
                  }
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
              <Field>
                <FieldLabel htmlFor="rule-target">
                  {draft.scope === "category" ? "Categoría" : "Producto"}
                </FieldLabel>
                <OptionSelect
                  id="rule-target"
                  options={draft.scope === "category" ? RULE_CATEGORIES : RULE_PRODUCTS}
                  value={draft.target}
                  onChange={(value) => update("target", value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-store">Tienda</FieldLabel>
                <OptionSelect
                  id="rule-store"
                  options={[ANY_STORE, ...RULE_STORES]}
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
                    {formatPct(devaluation)}
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
                  <Phrase draft={draft} />
                </h3>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-3 py-4">
              <span className="text-sm font-medium">
                Con datos de hoy se dispararía con
              </span>
              <div className="grid grid-cols-2 divide-x rounded-lg border">
                <PreviewStat label="Productos" value={matches.length} />
                <PreviewStat label="Tiendas" value={storesHit} />
              </div>

              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {thresholdInvalid
                    ? "Completá el umbral para ver la estimación."
                    : "Hoy ningún producto supera este umbral. La regla queda vigilando."}
                </p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {matches.slice(0, 4).map((match) => (
                    <li
                      key={`${match.product}-${match.store}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={productHref(match.product)}
                          className="block truncate font-medium underline-offset-4 hover:underline"
                        >
                          {match.product}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {match.store}
                        </span>
                      </div>
                      <ToneBadge tone="red" className="font-mono">
                        <ArrowUpIcon />
                        {formatPP(match.variation - devaluation)}
                      </ToneBadge>
                    </li>
                  ))}
                  {matches.length > 4 && (
                    <li className="pt-2 text-xs text-muted-foreground">
                      y {matches.length - 4} más
                    </li>
                  )}
                </ul>
              )}
            </CardContent>

            <CardFooter className="border-t text-xs text-muted-foreground">
              Estimación con datos de muestra. Revisamos los precios todos los
              días a las 06:00.
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
            <Button type="submit" size="lg">
              <CheckIcon data-icon="inline-start" />
              Crear regla
            </Button>
          </div>
        </aside>
      </div>
    </form>
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
  options,
  value,
  onChange,
}: {
  id: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
}) {
  const items = options.map((option) => ({ value: option, label: option }))
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

function Phrase({ draft }: { draft: RuleDraft }) {
  const target =
    draft.scope === "category" ? (
      <>
        un producto de <Hl>{draft.target}</Hl>
      </>
    ) : (
      <>
        <Hl>{draft.target}</Hl>
      </>
    )
  const threshold = draft.threshold.trim() || "—"
  const quote = <Hl>dólar {QUOTE_LABEL[draft.quote].toLowerCase()}</Hl>
  const store = <Hl>{draft.store}</Hl>

  if (draft.kind === "hit") {
    const hito = HITOS.find((item) => item.id === draft.hito)!
    return (
      <>
        Avisame si durante <Hl>{hito.id === "custom" ? "el rango elegido" : hito.label}</Hl>{" "}
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

function suggestName(draft: RuleDraft) {
  if (draft.kind === "hit") {
    const hito = HITOS.find((item) => item.id === draft.hito)!
    return `${hito.id === "custom" ? "Hito" : hito.label} · ${draft.target}`
  }
  return `${draft.target} supera al ${QUOTE_LABEL[draft.quote].toLowerCase()} · ${draft.period} d`
}
