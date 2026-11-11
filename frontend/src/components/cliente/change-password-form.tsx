"use client"

import * as React from "react"
import { CheckIcon, CircleAlertIcon, CircleIcon, Loader2Icon } from "lucide-react"

import { PasswordField } from "@/components/auth/password-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { passwordRules } from "@/lib/password"
import { cn } from "@/lib/utils"

export function ChangePasswordForm() {
  const { user, changePassword } = useAuth()
  const [current, setCurrent] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const submitting = React.useRef(false)
  const rules = [
    ...passwordRules(password, confirmation),
    { label: "Distinta de la actual", ok: current.length > 0 && password.length > 0 && current !== password },
  ]
  const valid = current.length > 0 && current.length <= 128 && password.length <= 128
    && rules.every((rule) => rule.ok)
  const hasValues = !!(current || password || confirmation)

  function edit(set: React.Dispatch<React.SetStateAction<string>>, value: string) {
    set(value)
    setError(null)
  }

  function cancel() {
    setCurrent("")
    setPassword("")
    setConfirmation("")
    setError(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting.current) return
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      await changePassword({ current_password: current, new_password: password })
      // El guard de sesión lleva al login con el aviso de contraseña actualizada.
      cancel()
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status < 500 ? cause.message
        : "No pudimos confirmar el cambio de contraseña. Intentá nuevamente; si ya se aplicó, ingresá con la nueva contraseña.")
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={pending}>
    <h4 className="text-sm font-semibold">Cambiar contraseña</h4>
    <p id="account-password-notice" className="text-sm text-muted-foreground">
      Al actualizarla se cerrarán tus sesiones en todos los dispositivos y tendrás que ingresar nuevamente.
    </p>
    <input type="text" name="username" autoComplete="username" value={user?.email ?? ""} readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
    <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <PasswordField id="account-current-password" label="Contraseña actual" autoComplete="current-password"
        value={current} onChange={(value) => edit(setCurrent, value)} disabled={pending} describedBy="account-password-notice" />
      <PasswordField id="account-new-password" label="Nueva contraseña"
        value={password} onChange={(value) => edit(setPassword, value)} disabled={pending} describedBy="account-password-rules" />
      <PasswordField id="account-password-confirmation" label="Confirmar contraseña"
        value={confirmation} onChange={(value) => edit(setConfirmation, value)} disabled={pending} describedBy="account-password-rules" />
    </div>
    <ul id="account-password-rules" className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {rules.map((rule) => <li key={rule.label} className={cn("flex items-center gap-1.5", rule.ok ? "text-success" : "text-muted-foreground")}>
        {rule.ok ? <CheckIcon className="size-3.5 shrink-0" aria-hidden="true" /> : <CircleIcon className="size-3.5 shrink-0" aria-hidden="true" />}
        {rule.label}
      </li>)}
    </ul>
    {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="outline" disabled={!valid || pending}>
        {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
        {pending ? "Actualizando…" : "Actualizar contraseña"}
      </Button>
      <Button type="button" variant="ghost" disabled={!hasValues || pending} onClick={cancel}>Cancelar</Button>
    </div>
  </form>
}
