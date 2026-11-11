import type { Metadata } from "next"

import { OperationBoard } from "@/components/operacion/operation-board"

export const metadata: Metadata = {
  title: "Operación · PriceScope",
}

// Maqueta UX10 · Operación: solo front, sin backend. Los scrapers y el log son
// de muestra (components/operacion/data.ts) y el estado vive en el navegador.
export default function OperacionPage() {
  return <OperationBoard />
}
