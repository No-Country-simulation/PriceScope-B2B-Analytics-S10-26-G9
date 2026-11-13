import type { Metadata } from "next"

import { AlertsBoard } from "@/components/alertas/alerts-board"

export const metadata: Metadata = {
  title: "Alertas · PriceScope",
}

// UX07 · Alertas: bandeja de alertas disparadas y reglas del usuario (API).
export default function AlertasPage() {
  return <AlertsBoard />
}
