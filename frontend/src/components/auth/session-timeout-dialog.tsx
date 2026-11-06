"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

// UX03 · Sesión por vencer: diálogo modal con cuenta regresiva antes de
// cerrar la sesión por inactividad. Se monta cuando se muestra y se
// desmonta al cerrar, así el timer arranca limpio cada vez.
export function SessionTimeoutDialog({
  onExtend,
  onLogout,
  seconds = 60,
}: {
  onExtend: () => void
  onLogout: () => void
  seconds?: number
}) {
  const [remaining, setRemaining] = React.useState(seconds)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const clock = "0:" + String(remaining).padStart(2, "0")
  const pct = (remaining / seconds) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-desc"
        className="w-[420px] max-w-full rounded-xl border border-border bg-card p-6 shadow-[0_20px_50px_rgba(9,9,11,0.3)]"
      >
        {/* Ícono */}
        <span className="flex size-10 items-center justify-center rounded-full bg-[#fffbeb] text-[#b45309]">
          <ClockIcon className="size-5" />
        </span>

        {/* Título */}
        <h2
          id="session-timeout-title"
          className="mt-3.5 text-lg font-semibold"
        >
          Tu sesión está por vencer
        </h2>

        {/* Descripción con countdown */}
        <p
          id="session-timeout-desc"
          className="mt-1 text-sm text-muted-foreground"
        >
          Por seguridad, cerramos la sesión tras 30 minutos sin actividad. Se
          cerrará en{" "}
          <span
            className="font-mono font-semibold text-foreground"
            aria-live="polite"
          >
            {clock}
          </span>
          .
        </p>

        {/* Barra de progreso */}
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]">
          <div
            className="h-1.5 rounded-full bg-[#d97706] transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Botones */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="h-9" onClick={onLogout}>
            Cerrar sesión
          </Button>
          <Button className="h-9" onClick={onExtend}>
            Seguir conectado
          </Button>
        </div>
      </div>
    </div>
  )
}
