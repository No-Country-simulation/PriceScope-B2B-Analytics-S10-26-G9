import type { Metadata } from "next"

import { OperationBoard } from "@/components/operacion/operation-board"

export const metadata: Metadata = {
  title: "Operación · PriceScope",
}

// UX10 · Operación: estado de los scrapers, log de fallas y ejecuciones
// manuales (/admin/scraping/overview, /errors y /stores/{slug}/enqueue).
export default function OperacionPage() {
  return <OperationBoard />
}
