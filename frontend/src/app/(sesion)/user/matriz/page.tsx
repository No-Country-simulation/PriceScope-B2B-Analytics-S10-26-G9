import type { Metadata } from "next"

import { PriceMatrix } from "@/components/matriz/price-matrix"

export const metadata: Metadata = {
  title: "Matriz de precios · PriceScope",
}

// Datos de GET /matrix.
export default function MatrizPage() {
  return <PriceMatrix />
}
