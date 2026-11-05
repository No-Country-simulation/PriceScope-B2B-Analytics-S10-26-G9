import type { Metadata } from "next"

import { CenteredShell } from "@/components/auth/centered-shell"
import { RecoverForm } from "@/components/auth/recover-form"

export const metadata: Metadata = {
  title: "Recuperar acceso · PriceScope",
}

export default function RecuperarPage() {
  return <CenteredShell><RecoverForm /></CenteredShell>
}
