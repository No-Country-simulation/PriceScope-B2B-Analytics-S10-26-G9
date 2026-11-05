import type { Metadata } from "next"
import { Suspense } from "react"

import { CenteredShell } from "@/components/auth/centered-shell"
import { SetPasswordForm } from "@/components/auth/set-password-form"

export const metadata: Metadata = {
  title: "Restablecer contraseña · PriceScope",
}

// Landing page of the reset link sent by email (/restablecer/{token}).
export default function RestablecerPage() {
  return (
    <CenteredShell
      footer={
        <p className="text-[13px] text-muted-foreground">
          ¿Problemas? Escribinos a soporte@pricescope.example
        </p>
      }
    >
      <Suspense>
        <SetPasswordForm mode="reset" />
      </Suspense>
    </CenteredShell>
  )
}
