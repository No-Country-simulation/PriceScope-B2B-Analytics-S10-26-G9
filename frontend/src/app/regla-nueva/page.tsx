import type { Metadata } from "next"

import { NewRuleScreen } from "@/components/regla/new-rule-screen"

export const metadata: Metadata = {
  title: "Nueva regla · PriceScope",
}

// Maqueta local de UX08: sin sesión ni llamadas al backend por ahora.
export default function Page() {
  return <NewRuleScreen />
}
