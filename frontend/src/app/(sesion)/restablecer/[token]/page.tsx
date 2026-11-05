import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { SetPasswordForm } from "@/components/auth/set-password-form"

export const metadata: Metadata = {
  title: "Restablecer contraseña · PriceScope",
}

// Landing page of the reset link sent by email (/restablecer/{token}).
export default function RestablecerPage() {
  return (
    <AuthShell layout="centered">
      <Suspense>
        <SetPasswordForm mode="reset" />
      </Suspense>
    </AuthShell>
  )
}
