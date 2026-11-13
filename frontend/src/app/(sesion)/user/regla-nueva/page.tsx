import type { Metadata } from "next"
import { Suspense } from "react"

import { RuleForm, RuleFormSkeleton } from "@/components/alertas/rule-form"

export const metadata: Metadata = {
  title: "Regla de alerta · PriceScope",
}

// UX07 · Nueva regla de alerta, o edición con ?rule=. También llega con
// ?product= (ficha) o ?category= (dashboard); leerlos es dato de la request,
// así que queda detrás de Suspense.
export default function NuevaReglaPage() {
  return (
    <Suspense fallback={<RuleFormSkeleton />}>
      <RuleForm />
    </Suspense>
  )
}
