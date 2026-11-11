"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleIcon,
  Loader2Icon,
  LinkIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, apiFetch, type TokenStatus, type TokenType } from "@/lib/api"
import { cn } from "@/lib/utils"
import { passwordRules } from "@/lib/password"
import { PasswordField } from "@/components/auth/password-field"

// "define": first password, from the welcome email the admin triggers.
// "reset": new password, from the link the user asked for in /recuperar.
type Mode = "define" | "reset"

const TOKEN_TYPE: Record<Mode, TokenType> = {
  define: "set_password",
  reset: "reset_password",
}

const COPY = {
  define: {
    title: "Definí tu contraseña",
    description: (company: string) => (
      <>
        El equipo de PriceScope creó tu cuenta para{" "}
        <strong className="text-foreground">{company}</strong>. Elegí una
        contraseña para ingresar.
      </>
    ),
    cta: "Guardar y continuar",
    footnote:
      "Este enlace se usa una sola vez y vence en 72 horas. Si venció, pedile uno nuevo al equipo de PriceScope.",
    doneTitle: "Contraseña guardada",
    doneDescription:
      "Tu cuenta ya está activa. Ingresá con tu correo y la contraseña que elegiste.",
    expiredDescription:
      "Pedile uno nuevo al equipo de PriceScope para activar tu cuenta.",
  },
  reset: {
    title: "Restablecé tu contraseña",
    description: (company: string) => (
      <>
        Elegí una contraseña nueva para tu cuenta de{" "}
        <strong className="text-foreground">{company}</strong>.
      </>
    ),
    cta: "Guardar contraseña",
    footnote:
      "Este enlace se usa una sola vez y vence en 1 hora. Si venció, pedí uno nuevo.",
    doneTitle: "Contraseña actualizada",
    doneDescription:
      "Tu contraseña quedó guardada. Ya podés ingresar con la nueva.",
    expiredDescription: "Pedí un enlace nuevo para restablecer tu contraseña.",
  },
} satisfies Record<Mode, unknown>

// Same rules the backend enforces. The submit stays disabled until all pass.

type LinkState =
  | { state: "loading" }
  | { state: "offline" }
  | { state: "expired" | "invalid" }
  | { state: "valid"; email: string; company: string }

export function SetPasswordForm({ mode }: { mode: Mode }) {
  const { token } = useParams<{ token: string }>()
  const copy = COPY[mode]

  const [link, setLink] = React.useState<LinkState>({ state: "loading" })
  const [attempt, setAttempt] = React.useState(0)
  const [done, setDone] = React.useState(false)

  // Check the link before showing the form, so an expired or used one says
  // so up front instead of after the visitor typed a password.
  React.useEffect(() => {
    let cancelled = false
    apiFetch<TokenStatus>("/auth/token/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((result): LinkState => {
        // A welcome link opened as a reset one (or the reverse) is treated
        // as invalid: the copy and the expiry on screen would be wrong.
        if (result.status !== "valid" || result.type !== TOKEN_TYPE[mode]) {
          return { state: result.status === "expired" ? "expired" : "invalid" }
        }
        return {
          state: "valid",
          email: result.email ?? "",
          company: result.company ?? "",
        }
      })
      // A malformed token fails validation (422): it's just an invalid link.
      .catch((err): LinkState =>
        err instanceof ApiError && err.status < 500
          ? { state: "invalid" }
          : { state: "offline" }
      )
      .then((next) => {
        if (!cancelled) setLink(next)
      })
    return () => {
      cancelled = true
    }
  }, [token, mode, attempt])

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          <CircleCheckIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {copy.doneTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy.doneDescription}
          </p>
        </div>
        <Link
          href="/ingresar"
          className={buttonVariants({ size: "lg", className: "h-10" })}
        >
          Ir a ingresar
        </Link>
      </div>
    )
  }

  if (link.state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (link.state === "offline") {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>
            No pudimos conectar con el servidor. Probá de nuevo.
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10"
          onClick={() => {
            setLink({ state: "loading" })
            setAttempt((value) => value + 1)
          }}
        >
          Reintentar
        </Button>
        <BackToLogin />
      </div>
    )
  }

  if (link.state !== "valid") {
    return (
      <div role="alert" className="flex flex-col gap-5">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          <LinkIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {link.state === "expired"
              ? "El enlace venció"
              : "El enlace no es válido"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {link.state === "invalid" ? "Puede que ya se haya usado. " : null}
            {copy.expiredDescription}
          </p>
        </div>
        {mode === "reset" ? (
          <Link
            href="/recuperar"
            className={buttonVariants({ size: "lg", className: "h-10" })}
          >
            Pedir un enlace nuevo
          </Link>
        ) : null}
        <BackToLogin />
      </div>
    )
  }

  return (
    <PasswordForm
      mode={mode}
      token={token}
      email={link.email}
      company={link.company}
      onDone={() => setDone(true)}
    />
  )
}

function PasswordForm({
  mode,
  token,
  email,
  company,
  onDone,
}: {
  mode: Mode
  token: string
  email: string
  company: string
  onDone: () => void
}) {
  const copy = COPY[mode]

  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const rules = passwordRules(password, confirmation)
  const allOk = rules.every((rule) => rule.ok)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allOk) return
    setPending(true)
    setError(null)
    try {
      await apiFetch("/auth/password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      })
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(err.message)
      } else {
        setError("No pudimos conectar con el servidor. Probá de nuevo.")
      }
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.description(company)}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        {/* Read-only, and named "username" so password managers file the
            new password under the right account. */}
        <Input
          id="email"
          name="username"
          type="email"
          autoComplete="username"
          value={email}
          readOnly
          className="h-10 bg-muted text-muted-foreground"
        />
      </div>

      <PasswordField
        id="password"
        label="Nueva contraseña"
        value={password}
        onChange={setPassword}
      />

      <ul
        id="password-rules"
        className="flex flex-col gap-1.5 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm"
      >
        {rules.map((rule) => (
          <li key={rule.label} className="flex items-center gap-2">
            {rule.ok ? (
              <CheckIcon className="size-4 shrink-0 text-success" />
            ) : (
              <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                rule.ok ? "text-foreground" : "text-muted-foreground"
              )}
            >
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
        className="h-10"
        disabled={pending || !allOk}
      >
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "Guardando…" : copy.cta}
      </Button>

      <p className="text-sm text-muted-foreground">{copy.footnote}</p>
    </form>
  )
}

function BackToLogin() {
  return (
    <Link
      href="/ingresar"
      className="flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeftIcon className="size-4" />
      Volver a ingresar
    </Link>
  )
}
