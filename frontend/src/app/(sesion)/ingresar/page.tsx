import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginShell } from "@/components/auth/login-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Ingresar · PriceScope",
}

export default function IngresarPage() {
  return (
    <LoginShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </LoginShell>
  )
}
