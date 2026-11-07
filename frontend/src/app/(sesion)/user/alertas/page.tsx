import type { Metadata } from "next"

import { AlertsBoard } from "@/components/alertas/alerts-board"

export const metadata: Metadata = {
  title: "Alertas · PriceScope",
}

// Maqueta UX07 · Alertas: solo front, sin backend. Las alertas y las reglas
// son de muestra (components/alertas/data.ts) y el estado vive en el navegador.
export default function AlertasPage() {
  return <AlertsBoard />
}
