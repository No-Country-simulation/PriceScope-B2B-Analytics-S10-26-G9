"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CircleAlertIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  Loader2Icon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Turnstile } from "@/components/auth/turnstile"
import { ApiError } from "@/lib/api"
import { HOME_BY_ROLE, safeNextPath, useAuth } from "@/lib/auth"

// Test account shown on the login page; the alert is hidden when unset.
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD
// Cloudflare Turnstile site key; the challenge is skipped when unset.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status, user, expired, login } = useAuth()

  const [showPassword, setShowPassword] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [invalid, setInvalid] = React.useState(false)
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  // Bumped after a failed attempt to remount the widget: each token is
  // single-use, so the next try needs a fresh challenge.
  const [captchaKey, setCaptchaKey] = React.useState(0)
  const captchaMissing = Boolean(TURNSTILE_SITE_KEY) && !captchaToken

  const next = safeNextPath(searchParams.get("next"))
  const sessionExpired =
    expired || searchParams.get("motivo") === "sesion-vencida"

  // Someone who already has a session goes straight to their home.
  React.useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(next ?? HOME_BY_ROLE[user.role])
    }
  }, [status, user, next, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (captchaMissing) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    setInvalid(false)
    try {
      await login(String(form.get("email")), String(form.get("password")))
      // The effect above redirects once the session is in place.
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Correo o contraseña incorrectos.")
        setInvalid(true)
      } else if (err instanceof ApiError && err.status < 500) {
        setError(err.message)
      } else {
        setError("No pudimos conectar con el servidor. Probá de nuevo.")
      }
      setPending(false)
      setCaptchaToken(null)
      setCaptchaKey((key) => key + 1)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ingresá a tu cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Usá el correo con el que te dimos de alta.
        </p>
      </div>

      {DEMO_EMAIL && DEMO_PASSWORD ? (
        <Alert className="border-brand/20 bg-brand/5">
          <InfoIcon className="text-brand" />
          <AlertDescription>
            <p>
              Usá <strong className="text-foreground">{DEMO_EMAIL}</strong> con
              la contraseña{" "}
              <strong className="text-foreground">{DEMO_PASSWORD}</strong>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : sessionExpired ? (
        <Alert>
          <ClockIcon />
          <AlertDescription>
            Tu sesión venció por inactividad. Volvé a ingresar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com"
          required
          aria-invalid={invalid || undefined}
          className="h-10"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/recuperar"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={invalid || undefined}
            className="h-10 pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </div>
      </div>

      {TURNSTILE_SITE_KEY ? (
        <Turnstile
          key={captchaKey}
          siteKey={TURNSTILE_SITE_KEY}
          onToken={setCaptchaToken}
        />
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-10"
        disabled={pending || captchaMissing}
      >
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>

      <p className="text-sm text-muted-foreground">
        ¿Todavía no sos cliente?{" "}
        <Link
          href="/demo"
          className="text-foreground underline underline-offset-4"
        >
          Agendá una demo
        </Link>
      </p>
    </form>
  )
}
