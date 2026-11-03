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
import { Card } from "@/components/ui/card"
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

// Access screen from mockup 03 · Iniciar sesión: warm paper frame shared
// with the screens opened from an email link, 460px card, pill CTA.
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
    <>
      <Card className="gap-6 rounded-[32px] bg-white p-9 shadow-[0_24px_64px_rgba(120,90,40,0.12)] ring-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-[-0.035em]">
            Iniciar sesión
          </h1>
          <p className="text-base leading-relaxed text-ink-soft">
            Ingresá con el correo de tu cuenta.
          </p>
        </div>

        {DEMO_EMAIL && DEMO_PASSWORD ? (
          <Alert className="border-brand/20 bg-brand/5">
            <InfoIcon className="text-brand" />
            <AlertDescription>
              <p>
                Usá <strong className="text-foreground">{DEMO_EMAIL}</strong>{" "}
                con la contraseña{" "}
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

        <form
          onSubmit={handleSubmit}
          aria-label="Iniciar sesión"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="font-semibold">
              Correo
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.com"
              required
              aria-invalid={invalid || undefined}
              className="h-14 rounded-[14px] border-paper-line bg-paper px-4 text-base focus-visible:ring-0 md:text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="font-semibold">
              Contraseña
            </Label>
            <div className="flex gap-2">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-invalid={invalid || undefined}
                className="h-14 min-w-0 flex-1 rounded-[14px] border-paper-line bg-paper px-4 text-base focus-visible:ring-0 md:text-base"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-14 shrink-0 rounded-[14px] border-paper-line bg-white text-ink-soft hover:bg-paper hover:text-ink focus-visible:ring-0"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-5" />
                ) : (
                  <EyeIcon className="size-5" />
                )}
              </Button>
            </div>
          </div>

          <Link
            href="/recuperar"
            className="self-end text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>

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
            className="h-[56px] rounded-full px-6 text-base font-semibold shadow-[0_10px_24px_rgba(28,28,30,0.22)]"
            disabled={pending || captchaMissing}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {pending ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>

        <p className="border-t border-[#F3F0EA] pt-5 text-center text-base leading-relaxed text-ink-soft">
          ¿Todavía no sos cliente?{" "}
          <Link
            href="/demo"
            className="font-semibold text-ink underline-offset-4 hover:text-black"
          >
            Agendá una demo
          </Link>
        </p>
      </Card>

      <p className="mt-5 text-center text-sm text-ink-soft">
        Las cuentas las crea el equipo de PriceScope después de la demo.
      </p>
    </>
  )
}
