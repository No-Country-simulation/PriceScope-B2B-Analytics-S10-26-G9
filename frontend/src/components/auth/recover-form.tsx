"use client"

import * as React from "react"
import Link from "next/link"
import {
  CircleAlertIcon,
  Loader2Icon,
  MailIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, apiFetch } from "@/lib/api"

// UX03 · Recuperar acceso: pide el correo y envía un enlace para
// restablecer la contraseña. La API responde lo mismo exista o no la cuenta.
export function RecoverForm() {
  const [email, setEmail] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await apiFetch("/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(err.message)
      } else {
        setError("No pudimos conectar con el servidor. Probá de nuevo.")
      }
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-[14px] border border-border bg-card p-7 text-center shadow-sm"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[#f4f4f5]">
          <MailIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Revisá tu correo
          </h1>
          <p className="text-sm text-muted-foreground">
            Si <strong className="text-foreground">{email}</strong> tiene una
            cuenta en PriceScope, vas a recibir un enlace para restablecer la
            contraseña. Vence en 1 hora.
          </p>
        </div>
        <Button className="h-10 w-full" nativeButton={false} render={<Link href="/restablecer/mock-token" />}>
          Abrir el enlace (prototipo)
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full border-0"
          onClick={() => setSent(false)}
        >
          Usar otro correo
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-7 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresá tu correo y te enviamos un enlace para restablecerla.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recover-email">Correo</Label>
        <Input
          id="recover-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10"
        />
      </div>

      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>

      <Link
        href="/ingresar"
        className="text-center text-sm underline underline-offset-2 hover:text-muted-foreground"
      >
        Volver a ingresar
      </Link>
    </form>
  )
}
