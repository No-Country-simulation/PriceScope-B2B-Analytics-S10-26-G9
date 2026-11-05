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
import { ApiError } from "@/lib/api"
import { HOME_BY_ROLE, safeNextPath, useAuth } from "@/lib/auth"

// Test account shown on the login page; the alert is hidden when unset.
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD

// UX03 · Ingresar: formulario de login con datos del nuevo diseño.
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status, user, expired, login } = useAuth()

  const [showPassword, setShowPassword] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [invalid, setInvalid] = React.useState(false)

  const next = safeNextPath(searchParams.get("next"))
  const sessionExpired =
    expired || searchParams.get("motivo") === "sesion-vencida"

  React.useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(next ?? HOME_BY_ROLE[user.role])
    }
  }, [status, user, next, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    setInvalid(false)
    try {
      await login(String(form.get("email")), String(form.get("password")))
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
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Iniciar sesión"
      className="flex w-full max-w-[360px] flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Ingresá a tu cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Usá el correo con el que te dimos de alta.
        </p>
      </div>

      {DEMO_EMAIL && DEMO_PASSWORD ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            <p>
              Cuenta de prueba: <strong>{DEMO_EMAIL}</strong> · contraseña{" "}
              <strong>{DEMO_PASSWORD}</strong>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : sessionExpired ? (
        <Alert role="status">
          <ClockIcon />
          <AlertDescription>
            Tu sesión venció por inactividad. Volvé a ingresar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/recuperar"
            className="text-[13px] underline underline-offset-2 hover:text-muted-foreground"
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
            className="h-10 pr-11"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
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

      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>

      {/* Botones del prototipo */}
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        prototipo: ingresar como
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/dashboard" />}>
          Cliente
        </Button>
        <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/admin/solicitudes" />}>
          Administrador
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        ¿Todavía no sos cliente?{" "}
        <Link
          href="/demo"
          className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
        >
          Agendá una demo
        </Link>
      </p>
    </form>
  )
}
