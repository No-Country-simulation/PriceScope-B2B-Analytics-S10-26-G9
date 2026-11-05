import type { Metadata } from "next"

import { PriceMatrix } from "@/components/matriz/price-matrix"

export const metadata: Metadata = {
  title: "Matriz de precios · PriceScope",
}

// Los precios todavía son de muestra (components/matriz/data.ts): la pantalla
// ya vive detrás de la sesión, pero no llama a la API.
export default function MatrizPage() {
  return <PriceMatrix />
}
