"use client"

import * as React from "react"
import Link from "next/link"
import {
  CircleCheckIcon,
  CircleIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// UX03 · Definir / Restablecer contraseña. Define = primera contraseña
// desde el correo de bienvenida; reset = nueva contraseña desde /recuperar.
// Maqueta: la cuenta es de ejemplo, el token del URL no se consume todavía.

type Mode = "define" | "reset"

const ACCOUNT = {
  name: "Lucía",
  company: "Grupo Andino Retail",
  email: "lucia@andinoretail.com",
}

type Copy = {
  title: string
  subtitle: React.ReactNode
  cta: string
  doneTitle: string
  doneDescription: string
  badTitleExpired: string
  badSubExpired: string
  badTitleInvalid: string
  badSubInvalid: string
  badCta: string
  badHref: string
}

const COPY: Record<Mode, Copy> = {
  define: {
    title: "Te damos la bienvenida a PriceScope",
    subtitle: (
      <>
        {ACCOUNT.company} ya tiene su cuenta. Definí tu contraseña para
        ingresar.
      </>
    ),
    cta: "Definir contraseña e ingresar",
    doneTitle: "Contraseña guardada",
    doneDescription:
      "Tu cuenta ya está activa. Ingresá con tu correo y la contraseña que elegiste.",
    badTitleExpired: "El enlace venció",
    badSubExpired:
      "Los enlaces de bienvenida duran 72 horas. Pedile uno nuevo al equipo de PriceScope.",
    badTitleInvalid: "El enlace no es válido",
    badSubInvalid:
      "Revisá que hayas copiado el enlace completo del correo, o pedile uno nuevo al equipo de PriceScope.",
    badCta: "Volver a ingresar",
    badHref: "/ingresar",
  },
  reset: {
    title: "Restablecé tu contraseña",
    subtitle: (
      <>
        Elegí una contraseña nueva para{" "}
        <strong className="text-foreground">{ACCOUNT.email}</strong>.
      </>
    ),
    cta: "Guardar contraseña nueva",
    doneTitle: "Contraseña actualizada",
    doneDescription:
      "Tu contraseña quedó guardada. Ya podés ingresar con la nueva.",
    badTitleExpired: "El enlace venció",
    badSubExpired:
      "Los enlaces para restablecer duran 1 hora. Pedí uno nuevo.",
    badTitleInvalid: "El enlace no es válido",
    badSubInvalid:
      "Revisá que hayas copiado el enlace completo, o pedí uno nuevo.",
    badCta: "Pedir un enlace nuevo",
    badHref: "/recuperar",
  },
}

function passwordRules(password: string, confirmation: string) {
  return [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Una mayúscula", ok: /[A-ZÁÉÍÓÚÑ]/.test(password) },
    { label: "Un número", ok: /[0-9]/.test(password) },
    {
      label: "Las contraseñas coinciden",
      ok: password.length > 0 && password === confirmation,
    },
  ]
}

// Cuatro segmentos: las tres reglas obligatorias + bonus por 12+ caracteres.
const STRENGTH = [
  { label: "muy débil", color: "" },
  { label: "débil", color: "#dc2626" },
  { label: "aceptable", color: "#d97706" },
  { label: "buena", color: "#65a30d" },
  { label: "fuerte", color: "#15803d" },
]

function strengthScore(password: string) {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-ZÁÉÍÓÚÑ]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1
  return score
}

export function SetPasswordForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode]

  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [done, setDone] = React.useState(false)

  const rules = passwordRules(password, confirmation)
  const allOk = rules.every((rule) => rule.ok)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allOk) return
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[14px] border border-border bg-card p-7 text-center shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-full bg-[#f0fdf4] text-[#15803d]">
          <CircleCheckIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {copy.doneTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy.doneDescription}
          </p>
        </div>
        <Link
          href="/ingresar"
          className={cn(
            buttonVariants(),
            "h-10 w-full"
          )}
        >
          Ir a ingresar
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={mode === "define" ? "Definir contraseña" : "Restablecer contraseña"}
      className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-7 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {copy.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      {/* Nueva contraseña */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <PasswordField
          id="new-password"
          value={password}
          onChange={setPassword}
        />
        <StrengthMeter password={password} />
      </div>

      {/* Confirmar */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Confirmar contraseña</Label>
        <PasswordField
          id="confirm-password"
          value={confirmation}
          onChange={setConfirmation}
        />
      </div>

      {/* Reglas */}
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className="flex items-center gap-2"
            style={{ color: rule.ok ? "#15803d" : "#71717a" }}
          >
            {rule.ok ? (
              <CircleCheckIcon className="size-4 shrink-0" />
            ) : (
              <CircleIcon className="size-4 shrink-0" />
            )}
            {rule.label}
          </li>
        ))}
      </ul>

      <Button type="submit" className="h-10 w-full" disabled={!allOk}>
        {copy.cta}
      </Button>
    </form>
  )
}

function PasswordField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        autoComplete="new-password"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="password-rules"
        className="h-10 pr-11"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1.5 -translate-y-1/2"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={shown}
      >
        {shown ? "Ocultar" : "Mostrar"}
      </Button>
    </div>
  )
}

function StrengthMeter({ password }: { password: string }) {
  const score = strengthScore(password)
  const level = STRENGTH[score]
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-1 rounded-full"
            style={{
              backgroundColor:
                index < score ? level.color : "#e4e4e7",
            }}
          />
        ))}
      </div>
      <span
        aria-live="polite"
        className="text-xs"
        style={{ color: score >= 3 ? "#15803d" : "#b45309" }}
      >
        Fortaleza: {level.label}
      </span>
    </div>
  )
}

// Estado de enlace inválido o vencido (maqueta: no se usa todavía, el token
// del URL no se consume, pero el componente está listo para cuando se active).
export function SetPasswordBadLink({
  mode,
  reason,
}: {
  mode: Mode
  reason: "expired" | "invalid"
}) {
  const copy = COPY[mode]
  return (
    <div className="flex flex-col items-center gap-4 rounded-[14px] border border-border bg-card p-7 text-center shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-full bg-[#fef2f2] text-[#b91c1c]">
        <TriangleAlertIcon className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          {reason === "expired" ? copy.badTitleExpired : copy.badTitleInvalid}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reason === "expired" ? copy.badSubExpired : copy.badSubInvalid}
        </p>
      </div>
      <Link
        href={copy.badHref}
        className={cn(buttonVariants({ variant: "outline" }), "h-10 w-full")}
      >
        {copy.badCta}
      </Link>
    </div>
  )
}
