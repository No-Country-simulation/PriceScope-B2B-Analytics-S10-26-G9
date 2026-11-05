"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type DemoFormData = {
  empresa: string
  nombre: string
  mail: string
  tipo: string
  comentario: string
  day: number
  slot: number
  when: string
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie"]
const DATES = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13]
const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"]

const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Formulario de UX02 · Agendar demo: datos de contacto, calendario de días,
// horarios y comentario. Sin stepper: todo en una sola pantalla.
export function DemoBookingForm({
  orgTypes,
  onSubmit,
}: {
  orgTypes: string[]
  onSubmit: (data: DemoFormData) => void
}) {
  const [empresa, setEmpresa] = React.useState("")
  const [nombre, setNombre] = React.useState("")
  const [mail, setMail] = React.useState("")
  const [tipo, setTipo] = React.useState(orgTypes[0])
  const [comentario, setComentario] = React.useState("")
  const [day, setDay] = React.useState(2)
  const [slot, setSlot] = React.useState(3)
  const [touched, setTouched] = React.useState(false)
  const [sendError, setSendError] = React.useState(false)

  const mailOk = MAIL_RE.test(mail)
  const personal = /@(gmail|hotmail|yahoo|outlook)\./i.test(mail)

  const errors = {
    empresa: touched && !empresa.trim(),
    nombre: touched && !nombre.trim(),
    mail: touched && (!mailOk || personal),
    mailMsg: !mailOk
      ? "Ingresá un correo válido, por ejemplo nombre@empresa.com."
      : "Usá tu correo laboral.",
  }

  const valid = empresa.trim() && nombre.trim() && mailOk && !personal

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid) {
      setSendError(false)
      return
    }
    // Maqueta: no llamamos al backend, solo armamos los datos.
    const when = `${WEEKDAYS[day % 5]} ${DATES[day]}/11/2026 · ${SLOTS[slot]} h`
    onSubmit({
      empresa,
      nombre,
      mail,
      tipo,
      comentario,
      day,
      slot,
      when,
    })
  }

  const days = DATES.map((n, i) => ({
    w: WEEKDAYS[i % 5],
    n: n + "/11",
  }))

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-w-0 flex-1 basis-[480px] flex-col gap-[18px] rounded-[14px] border border-border bg-card p-7 shadow-sm"
    >
      {/* Datos de contacto */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Field
          id="demo-empresa"
          label="Empresa"
          error={errors.empresa ? "Ingresá el nombre de tu empresa." : null}
        >
          <Input
            id="demo-empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-10"
          />
        </Field>
        <Field
          id="demo-nombre"
          label="Nombre y apellido"
          error={errors.nombre ? "Ingresá tu nombre." : null}
        >
          <Input
            id="demo-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="h-10"
          />
        </Field>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Field
          id="demo-mail"
          label="Correo laboral"
          error={errors.mail ? errors.mailMsg : null}
        >
          <Input
            id="demo-mail"
            type="email"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            className="h-10"
          />
        </Field>
        <Field id="demo-tipo" label="Tipo de organización">
          <select
            id="demo-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {orgTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Calendario */}
      <fieldset className="flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2.5 text-sm font-medium">
          Fecha y hora preferidas{" "}
          <span className="font-normal text-muted-foreground">
            · lunes a viernes, 9 a 18 h
          </span>
        </legend>
        <div className="grid grid-cols-5 gap-1.5">
          {days.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDay(i)}
              aria-pressed={day === i}
              className={cn(
                "flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border text-center transition-colors",
                day === i
                  ? "border-[#18181b] bg-[#18181b] text-[#fafafa]"
                  : "border-border bg-white text-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-[11px] opacity-80">{d.w}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {d.n}
              </span>
            </button>
          ))}
        </div>
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
          {SLOTS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setSlot(i)}
              aria-pressed={slot === i}
              className={cn(
                "flex h-[34px] items-center justify-center rounded-lg border font-mono text-[13px] transition-colors",
                slot === i
                  ? "border-[#18181b] bg-[#18181b] text-[#fafafa]"
                  : "border-border bg-white text-foreground hover:bg-muted/50"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Comentario */}
      <Field id="demo-com" label="Comentario (opcional)">
        <textarea
          id="demo-com"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="¿Qué te gustaría monitorear?"
          className="h-[84px] w-full resize-y rounded-lg border border-input bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>

      {/* Error de envío */}
      {sendError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-[13px] text-[#b91c1c]"
        >
          No pudimos enviar la solicitud. Revisá tu conexión y probá de nuevo.
        </div>
      )}

      <button
        type="submit"
        className="h-10 w-full rounded-lg bg-[#18181b] text-sm font-medium text-[#fafafa] hover:bg-[#27272a]"
      >
        Solicitar demo
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Te escribimos para confirmar. No compartimos tus datos.
      </p>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <span className="text-xs text-[#b91c1c]">{error}</span>}
    </div>
  )
}
