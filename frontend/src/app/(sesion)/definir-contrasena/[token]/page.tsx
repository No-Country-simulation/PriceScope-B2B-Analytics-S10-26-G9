import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { SetPasswordForm } from "@/components/auth/set-password-form"

export const metadata: Metadata = {
  title: "Definir contraseña · PriceScope",
}

// Landing page of the welcome link sent when an admin creates the account
// (/definir-contrasena/{token}).
export default function DefinirContrasenaPage() {
  return (
    <AuthShell layout="centered">
      <Suspense>
        <SetPasswordForm mode="define" />
      </Suspense>
    </AuthShell>
  )
}
