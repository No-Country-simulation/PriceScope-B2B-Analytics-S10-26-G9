"use client"

import * as React from "react"
import Link from "next/link"

import { BrandLogo } from "@/components/auth/brand-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { DemoBookingForm, type DemoFormData } from "./demo-booking-form"

const ORG_TYPES = [
  "Cadena minorista",
  "Fondo de inversión",
  "Medio de comunicación",
  "Otro",
]

// UX02 · Agendar demo: página con header, columna de marketing y formulario.
export function DemoScreen() {
  const [submitted, setSubmitted] = React.useState<DemoFormData | null>(null)

  return (
    <div className="flex min-h-svh flex-col bg-[#fafafa]">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-white px-8">
        <BrandLogo />
        <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/ingresar" />}>
          Iniciar sesión
        </Button>
      </header>

      {/* Contenido */}
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-start gap-12 px-6 py-12">
        {/* Columna de marketing */}
        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-6 pt-2">
          <span className="inline-flex h-[26px] self-start items-center rounded-full border border-border bg-white px-2.5 text-xs font-medium">
            Demo de 30 minutos
          </span>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em]">
            Agendá una demo y te mostramos la inflación real de tus tiendas.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Contanos quién sos y cuándo te queda cómodo. Te escribimos para
            confirmar el horario.
          </p>
          <ol className="flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-white font-mono text-[13px]">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{step.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {step.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Formulario o confirmación */}
        {submitted ? (
          <DemoConfirmation
            data={submitted}
            onEdit={() => setSubmitted(null)}
          />
        ) : (
          <DemoBookingForm
            orgTypes={ORG_TYPES}
            onSubmit={setSubmitted}
          />
        )}
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: "Llamada de demo",
    text: "Vemos el tablero con datos de ejemplo.",
  },
  {
    title: "Elegimos tus tiendas",
    text: "Definimos juntos qué e-commerce monitorear.",
  },
  {
    title: "Te creamos la cuenta",
    text: "Recibís un correo para definir tu contraseña.",
  },
]

// Pantalla de confirmación tras enviar la solicitud.
function DemoConfirmation({
  data,
  onEdit,
}: {
  data: DemoFormData
  onEdit: () => void
}) {
  const rows = [
    { label: "Empresa", value: data.empresa },
    { label: "Nombre", value: data.nombre },
    { label: "Correo", value: data.mail },
    { label: "Organización", value: data.tipo },
    { label: "Preferencia", value: data.when, mono: true },
  ]

  return (
    <div
      role="status"
      className="flex min-w-0 flex-1 basis-[480px] flex-col gap-4 rounded-[14px] border border-border bg-card p-8 shadow-sm"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[#f0fdf4] text-[#15803d]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h2 className="text-[22px] font-semibold">Recibimos tu solicitud</h2>
      <p className="text-[15px] text-muted-foreground">
        Te vamos a contactar para confirmar el horario.
      </p>
      <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2.5 border-t border-border pt-4 text-sm">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn("m-0", row.mono && "font-mono tabular-nums")}>
              {row.value}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={onEdit}>
          Editar solicitud
        </Button>
        <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/admin/solicitudes" />}>
          Ver en backoffice (prototipo)
        </Button>
      </div>
    </div>
  )
}
