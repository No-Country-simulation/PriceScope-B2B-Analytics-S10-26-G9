"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, type DemoRequest, type OrganizationType } from "@/lib/api"
import { cn } from "@/lib/utils"

const SLOTS = ["10:00", "11:30", "15:00", "16:30"]
const ORG_TYPES: { label: string; value: OrganizationType }[] = [
  { label: "Cadena minorista", value: "retail" },
  { label: "Fondo de inversión", value: "fund" },
  { label: "Medio de comunicación", value: "media" },
  { label: "Otro", value: "other" },
]
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
// Buenos Aires is UTC-3 all year (no DST).
const BA_OFFSET = "-03:00"

type Day = { label: string; iso: string }

// Next `count` business days in Buenos Aires, starting tomorrow.
function nextBusinessDays(count: number): Day[] {
  const ba = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const days: Day[] = []
  for (let i = 1; days.length < count; i++) {
    const d = new Date(Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate() + i))
    const wd = d.getUTCDay()
    if (wd === 0 || wd === 6) continue
    const dd = String(d.getUTCDate()).padStart(2, "0")
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
    days.push({
      label: `${WEEKDAYS[wd]} ${dd}/${mm}`,
      iso: `${d.getUTCFullYear()}-${mm}-${dd}`,
    })
  }
  return days
}
const STEPS = [
  { title: "Tus datos", sub: "Empresa y contacto" },
  { title: "Fecha y hora", sub: "Elegí un horario" },
  { title: "Confirmación", sub: "Demo agendada" },
]
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function DemoBooking() {
  const [step, setStep] = useState(1)
  const [tried, setTried] = useState(false)
  const [day, setDay] = useState(-1)
  const [time, setTime] = useState(-1)
  // Computed when entering step 2, not during render: Date.now() at render
  // time would be frozen in the prerendered page.
  const [days, setDays] = useState<Day[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [f, setF] = useState({
    empresa: "",
    nombre: "",
    correo: "",
    tipo: ORG_TYPES[0].value as OrganizationType,
    comentario: "",
  })

  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<{ value: string }>) =>
      setF((prev) => ({ ...prev, [k]: e.target.value }))

  const okMail = MAIL_RE.test(f.correo)
  const errEmpresa = tried && !f.empresa.trim()
  const errNombre = tried && !f.nombre.trim()
  const errCorreo = tried && !okMail

  const next1 = () => {
    if (f.empresa.trim() && f.nombre.trim() && okMail) {
      const fresh = nextBusinessDays(5)
      if (fresh[day]?.iso !== days[day]?.iso) {
        setDay(-1)
        setTime(-1)
      }
      setDays(fresh)
      setStep(2)
      setTried(false)
    } else {
      setTried(true)
    }
  }

  const confirm = async () => {
    if (day < 0 || time < 0 || sending) return
    setSending(true)
    setSendError(null)
    try {
      await apiFetch<DemoRequest>("/demo/requests", {
        method: "POST",
        body: JSON.stringify({
          company: f.empresa.trim(),
          name: f.nombre.trim(),
          email: f.correo.trim(),
          organization_type: f.tipo,
          comment: f.comentario.trim() || null,
          preferred_date: `${days[day].iso}T${SLOTS[time]}:00${BA_OFFSET}`,
        }),
      })
      setStep(3)
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : "No pudimos enviar la solicitud. Probá de nuevo."
      )
    } finally {
      setSending(false)
    }
  }

  const noDay = day < 0
  const noSel = day < 0 || time < 0
  const done = step === 3

  return (
    <Card className="grid gap-0 py-0 md:grid-cols-[240px_1fr]">
      <ol className="flex gap-1 overflow-x-auto border-b p-3 md:flex-col md:gap-2 md:border-r md:border-b-0 md:p-5">
        {STEPS.map((s, i) => {
          const n = i + 1
          const state = n < step || done ? "done" : n === step ? "on" : "todo"
          // Solo se puede volver a pasos completados mientras no se confirmó.
          const canGo = n < step && !done
          return (
            <li key={s.title} className="shrink-0">
              <button
                type="button"
                disabled={!canGo}
                aria-current={n === step ? "step" : undefined}
                onClick={() => setStep(n)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium md:size-9",
                    state === "on" &&
                      "border-primary bg-primary text-primary-foreground",
                    state === "done" && "bg-muted text-foreground",
                    state === "todo" && "text-muted-foreground"
                  )}
                >
                  {state === "done" ? <CheckIcon className="size-4" /> : n}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      state === "todo" && "text-muted-foreground"
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">
                    {s.sub}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-8">
        {step === 1 && (
          <>
            <StepHeading
              title="Tus datos"
              lead="Contanos quién sos para preparar la demo con tu sector."
            />
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={errEmpresa || undefined}>
                <FieldLabel htmlFor="d-emp">Empresa</FieldLabel>
                <Input
                  id="d-emp"
                  value={f.empresa}
                  onChange={set("empresa")}
                  placeholder="Nombre de tu empresa"
                  aria-invalid={errEmpresa || undefined}
                />
                {errEmpresa && (
                  <FieldError>Contanos en qué empresa trabajás.</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="d-tipo">Tipo de organización</FieldLabel>
                <Select
                  items={ORG_TYPES}
                  value={f.tipo}
                  onValueChange={(v) =>
                    setF((prev) => ({ ...prev, tipo: v as OrganizationType }))
                  }
                >
                  <SelectTrigger id="d-tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={errNombre || undefined}>
                <FieldLabel htmlFor="d-nom">Nombre y apellido</FieldLabel>
                <Input
                  id="d-nom"
                  value={f.nombre}
                  onChange={set("nombre")}
                  placeholder="Nombre y apellido"
                  aria-invalid={errNombre || undefined}
                />
                {errNombre && <FieldError>Ingresá tu nombre.</FieldError>}
              </Field>
              <Field data-invalid={errCorreo || undefined}>
                <FieldLabel htmlFor="d-mail">Correo laboral</FieldLabel>
                <Input
                  id="d-mail"
                  type="email"
                  value={f.correo}
                  onChange={set("correo")}
                  placeholder="nombre@empresa.com"
                  aria-invalid={errCorreo || undefined}
                />
                {errCorreo && (
                  <FieldError>
                    Revisá el correo: tiene que tener formato
                    nombre@empresa.com.
                  </FieldError>
                )}
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="d-com">Comentario</FieldLabel>
                <Textarea
                  id="d-com"
                  value={f.comentario}
                  onChange={set("comentario")}
                  maxLength={1000}
                  placeholder="¿Qué categorías te interesan?"
                />
                <FieldDescription>
                  Opcional: nos ayuda a elegir los ejemplos.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <div className="mt-auto flex justify-end">
              <Button onClick={next1}>
                Siguiente
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading
              title="Fecha y hora"
              lead="La demo dura 30 minutos · hora de Buenos Aires."
            />
            <FieldGroup>
              <Field>
                <FieldTitle>Elegí un día</FieldTitle>
                <div className="flex flex-wrap gap-2">
                  {days.map((d, i) => (
                    <Button
                      key={d.iso}
                      variant={day === i ? "default" : "outline"}
                      aria-pressed={day === i}
                      onClick={() => {
                        setDay(i)
                        setTime(-1)
                        setSendError(null)
                      }}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </Field>
              <Field>
                <FieldTitle>Horarios disponibles</FieldTitle>
                {noDay ? (
                  <FieldDescription>
                    Elegí primero un día para ver los horarios.
                  </FieldDescription>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {SLOTS.map((s, i) => (
                      <Button
                        key={s}
                        variant={time === i ? "default" : "outline"}
                        aria-pressed={time === i}
                        onClick={() => {
                          setTime(i)
                          setSendError(null)
                        }}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </Field>
            </FieldGroup>
            {sendError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {sendError}
              </p>
            )}
            <div className="mt-auto flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={sending}
                onClick={() => setStep(1)}
              >
                Volver
              </Button>
              <Button disabled={noSel || sending} onClick={confirm}>
                {sending ? "Enviando…" : "Confirmar demo"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="flex flex-col items-start gap-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <CheckIcon className="size-5" />
            </span>
            <StepHeading
              title="¡Listo, recibimos tu solicitud!"
              lead={
                <>
                  Te vamos a escribir a{" "}
                  <span className="font-medium text-foreground">
                    {f.correo}
                  </span>{" "}
                  para confirmar el horario.
                </>
              }
            />
            <div className="flex w-full max-w-[420px] flex-col gap-1 rounded-lg border bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">
                Fecha y hora
              </span>
              <span className="text-base font-medium">
                {days[day]?.label} · {SLOTS[time]} h
              </span>
              <span className="text-sm text-muted-foreground">
                {f.nombre} · {f.empresa}
              </span>
            </div>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/" />}
            >
              Volver al inicio
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function StepHeading({
  title,
  lead,
}: {
  title: string
  lead: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{lead}</p>
    </div>
  )
}
