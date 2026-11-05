import type { Metadata } from "next"

import { AlertsScreen } from "@/components/alertas/alerts-screen"

export const metadata: Metadata = {
  title: "Alertas · PriceScope",
}

// Maqueta local de UX07: sin sesión ni llamadas al backend por ahora.
export default function Page() {
  return <AlertsScreen />
}
