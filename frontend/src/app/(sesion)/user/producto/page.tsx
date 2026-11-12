import type { Metadata } from "next"
import { Suspense } from "react"

import {
  ProductDetail,
  ProductDetailSkeleton,
} from "@/components/producto/product-detail"

export const metadata: Metadata = {
  title: "Ficha de producto · PriceScope",
}

// El producto llega por ?id= desde la matriz; leerlo es dato de la request,
// así que queda detrás de Suspense. Datos de GET /products/{id}.
export default function ProductoPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  )
}
