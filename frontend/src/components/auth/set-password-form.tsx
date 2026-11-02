"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckIcon,
  CircleCheckIcon,
  CircleIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// "define": first password, from the welcome email the admin triggers.
// "reset": new password, from the link the user asked for in /recuperar.
type Mode = "define" | "reset"

// Account of the design reference (mockup 03b · Definir contraseña). This
// screen is still a maqueta: the real name, company and email travel with
// the welcome link.
const ACCOUNT = {
  name: "Lucía",
  company: "Comercial del Sur S.A.",
  email: "lucia@comercialdelsur.com",
}

type Copy = {
  badge: string | null
  title: string
  description: React.ReactNode
  cta: string
  footnote: string
  doneTitle: string
  doneDescription: string
}

const COPY: Record<Mode, Copy> = {
  define: {
    badge: "Cuenta creada",
    title: `Bienvenida, ${ACCOUNT.name}`,
    description: (
      <>
        El equipo de PriceScope creó tu cuenta para{" "}
        <strong className="text-ink">{ACCOUNT.company}</strong>. Definí tu
        contraseña para ingresar.
      </>
    ),
    cta: "Guardar y continuar",
    footnote:
      "Este enlace se usa una sola vez y vence en 72 horas. Si venció, pedile uno nuevo al equipo de PriceScope.",
    doneTitle: "Contraseña guardada",
    doneDescription:
      "Tu cuenta ya está activa. Ingresá con tu correo y la contraseña que elegiste.",
  },
  reset: {
    badge: null,
    title: "Restablecé tu contraseña",
    description: (
      <>
        Elegí una contraseña nueva para{" "}
        <strong className="text-ink">{ACCOUNT.company}</strong>.
      </>
    ),
    cta: "Guardar contraseña",
    footnote:
      "Este enlace se usa una sola vez y vence en 1 hora. Si venció, pedí uno nuevo.",
    doneTitle: "Contraseña actualizada",
    doneDescription:
      "Tu contraseña quedó guardada. Ya podés ingresar con la nueva.",
  },
}

// Checklist under the fields. The submit stays disabled until all four pass.
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

// Four segments: the three required rules plus a bonus one (a symbol, or a
// password of 12+ characters). "Precios2026" from the mockup scores 3 → buena.
const STRENGTH = [
  { label: "muy débil", tone: "text-ink-soft", fill: "" },
  { label: "débil", tone: "text-destructive", fill: "bg-destructive" },
  { label: "regular", tone: "text-warning", fill: "bg-warning" },
  { label: "buena", tone: "text-success", fill: "bg-success-fill" },
  { label: "excelente", tone: "text-success", fill: "bg-success-fill" },
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
      <Card className="gap-6 rounded-[32px] bg-white p-9 shadow-[0_24px_64px_rgba(120,90,40,0.12)] ring-0">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
            <CircleCheckIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-2.5">
            <h1 className="text-4xl font-extrabold tracking-[-0.035em]">
              {copy.doneTitle}
            </h1>
            <p className="text-base leading-relaxed text-ink-soft">
              {copy.doneDescription}
            </p>
          </div>
          <Link
            href="/ingresar"
            className={buttonVariants({
              size: "lg",
              className:
                "h-[56px] w-full rounded-full px-6 text-base font-semibold shadow-[0_10px_24px_rgba(28,28,30,0.22)]",
            })}
          >
            Ir a ingresar
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card className="gap-6 rounded-[32px] bg-white p-9 shadow-[0_24px_64px_rgba(120,90,40,0.12)] ring-0">
      {copy.badge ? (
        <Badge className="h-auto self-start rounded-full border-success-line bg-success-bg px-3 py-[5px] font-bold tracking-[0.08em] text-success uppercase">
          {copy.badge}
        </Badge>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <h1 className="text-4xl font-extrabold tracking-[-0.035em]">
          {copy.title}
        </h1>
        <p className="text-base leading-relaxed text-ink-soft">
          {copy.description}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-label={mode === "define" ? "Definir contraseña" : "Restablecer contraseña"}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="font-semibold">
            Correo
          </Label>
          <Input
            id="email"
            type="email"
            value={ACCOUNT.email}
            readOnly
            autoComplete="email"
            className="h-14 rounded-[14px] border-paper-line bg-paper-field px-4 text-ink-soft focus-visible:ring-0 md:text-base"
          />
        </div>

        <PasswordField
          id="password"
          label="Nueva contraseña"
          value={password}
          onChange={setPassword}
        />

        <StrengthMeter password={password} />

        <ul
          id="password-rules"
          className="flex flex-col gap-2 rounded-[16px] bg-paper px-4 py-3.5 text-sm"
        >
          {rules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-2.5">
              {rule.ok ? (
                <CheckIcon className="size-4 shrink-0 text-success" />
              ) : (
                <CircleIcon className="size-4 shrink-0 text-ink-soft" />
              )}
              <span className={rule.ok ? "text-ink" : "text-ink-soft"}>
                {rule.label}
              </span>
            </li>
          ))}
        </ul>

        <PasswordField
          id="confirmation"
          label="Repetí la contraseña"
          value={confirmation}
          onChange={setConfirmation}
        />

        <Button
          type="submit"
          size="lg"
          className="h-[56px] rounded-full px-6 text-base font-semibold shadow-[0_10px_24px_rgba(28,28,30,0.22)]"
          disabled={!allOk}
        >
          {copy.cta}
        </Button>
      </form>

      <p className="text-sm leading-relaxed text-ink-soft">{copy.footnote}</p>
    </Card>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby="password-rules"
          className="h-14 rounded-[14px] border-paper-line bg-paper px-4 pr-11 focus-visible:ring-0 md:text-base"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-soft"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={shown}
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
    </div>
  )
}

function StrengthMeter({ password }: { password: string }) {
  const score = strengthScore(password)
  const level = STRENGTH[score]
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full",
              index < score ? level.fill : "bg-paper-line",
            )}
          />
        ))}
      </div>
      <span aria-live="polite" className={cn("text-sm font-semibold", level.tone)}>
        Fortaleza: {level.label}
      </span>
    </div>
  )
}
