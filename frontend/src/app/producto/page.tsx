import type { Metadata } from "next"

import { ProductDetailScreen } from "@/components/producto/product-detail-screen"

export const metadata: Metadata = {
  title: "Ficha de producto · PriceScope",
}

// Maqueta local de UX06: sin sesión ni llamadas al backend por ahora.
export default function Page() {
  return <ProductDetailScreen />
}
