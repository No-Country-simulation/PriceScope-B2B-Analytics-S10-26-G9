"use client"

import * as React from "react"
import { CircleAlertIcon, Loader2Icon } from "lucide-react"

import { PasswordField } from "@/components/auth/password-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"

const CONFIRMATION = "ELIMINAR MI CUENTA"

export function DeactivateAccount() {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  if (!user) return null
  const isAdmin = user.role === "admin"

  return <section id="account-danger" className="scroll-mt-[calc(var(--header-height)+1.5rem)]" aria-labelledby="account-danger-title">
    <Card className="ring-destructive/30 shadow-xs">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1 sm:flex-1">
          <h3 id="account-danger-title" className="font-semibold text-destructive">Eliminar mi cuenta</h3>
          <p id="account-deactivation-description" className="text-sm text-muted-foreground">
            {isAdmin
              ? "Las cuentas de administrador no pueden darse de baja desde Mi cuenta."
              : "La baja desactiva tu cuenta y cierra tus sesiones. Perderás el acceso a PriceScope."}
          </p>
        </div>
        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isAdmin} aria-describedby="account-deactivation-description"
          onClick={() => setOpen(true)}>Dar de baja mi cuenta</Button>
      </CardContent>
    </Card>
    {!isAdmin && <DeactivationDialog open={open} onOpenChange={setOpen} />}
  </section>
}

function DeactivationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { deactivateAccount } = useAuth()
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const submitting = React.useRef(false)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const valid = password.length > 0 && password.length <= 128 && confirmation === CONFIRMATION

  function changeOpen(next: boolean) {
    if (submitting.current) return
    if (!next) {
      setPassword("")
      setConfirmation("")
      setError(null)
    }
    onOpenChange(next)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting.current) return
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      await deactivateAccount({ current_password: password, confirmation: CONFIRMATION })
      setPassword("")
      setConfirmation("")
      // El guard de sesión redirige al login con el aviso de baja.
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status < 500 ? cause.message
        : "No pudimos confirmar la baja. Si perdiste el acceso, contactá al equipo de PriceScope.")
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent showCloseButton={!pending} initialFocus={cancelRef}
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>¿Dar de baja tu cuenta?</DialogTitle>
        <DialogDescription>Se desactivará tu cuenta y se cerrarán todas tus sesiones. Ya no podrás acceder al tablero ni a tus alertas.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={pending}>
        <PasswordField id="deactivate-password" label="Contraseña actual" autoComplete="current-password"
          value={password} disabled={pending} describedBy="" onChange={(value) => { setPassword(value); setError(null) }} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="deactivate-confirmation" className="flex-wrap leading-relaxed">Escribí <span className="font-mono">{CONFIRMATION}</span> para confirmar</Label>
          <Input id="deactivate-confirmation" value={confirmation} autoComplete="off" spellCheck={false}
            maxLength={CONFIRMATION.length} disabled={pending} onChange={(event) => { setConfirmation(event.target.value); setError(null) }} />
        </div>
        {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Cancelar</Button>
          <Button type="submit" className="bg-destructive text-white hover:bg-destructive/90" disabled={!valid || pending}>
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {pending ? "Procesando baja…" : "Confirmar baja de mi cuenta"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
