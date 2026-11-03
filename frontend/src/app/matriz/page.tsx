import type { Metadata } from "next"

import { MatrizScreen } from "@/components/matriz/matriz-screen"

export const metadata: Metadata = {
  title: "Matriz de precios · PriceScope",
}

// Maqueta local de UX05: sin sesión ni llamadas al backend por ahora.
export default function Page() {
  return <MatrizScreen />
}
