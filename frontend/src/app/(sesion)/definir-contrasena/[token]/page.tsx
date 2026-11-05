import type { Metadata } from "next"
import { Suspense } from "react"

import { CenteredShell } from "@/components/auth/centered-shell"
import { SetPasswordForm } from "@/components/auth/set-password-form"

export const metadata: Metadata = {
  title: "Definir contraseña · PriceScope",
}

// Landing page of the welcome link sent when an admin creates the account
// (/definir-contrasena/{token}).
export default function DefinirContrasenaPage() {
  return (
    <CenteredShell
      footer={
        <p className="text-[13px] text-muted-foreground">
          ¿Problemas? Escribinos a soporte@pricescope.example
        </p>
      }
    >
      <Suspense>
        <SetPasswordForm mode="define" />
      </Suspense>
    </CenteredShell>
  )
}
