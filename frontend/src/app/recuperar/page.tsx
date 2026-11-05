import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { RecoverForm } from "@/components/auth/recover-form"

export const metadata: Metadata = {
  title: "Recuperar acceso · PriceScope",
}

export default function RecuperarPage() {
  return (
    <AuthShell>
      <RecoverForm />
    </AuthShell>
  )
}
