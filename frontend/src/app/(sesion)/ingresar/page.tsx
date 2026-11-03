import type { Metadata } from "next"
import { Suspense } from "react"

import { CenteredShell } from "@/components/auth/centered-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Ingresar · PriceScope",
}

export default function IngresarPage() {
  return (
    <CenteredShell cardClassName="max-w-[460px]">
      <Suspense>
        <LoginForm />
      </Suspense>
    </CenteredShell>
  )
}
