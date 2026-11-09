import type { Metadata } from "next"

import { RuleForm } from "@/components/alertas/rule-form"

export const metadata: Metadata = {
  title: "Nueva regla · PriceScope",
}

// Maqueta UX07 · Nueva regla de alerta: solo front, sin backend. Las opciones
// y la vista previa salen de datos de muestra (components/alertas/rule-data.ts).
export default function NuevaReglaPage() {
  return <RuleForm />
}
