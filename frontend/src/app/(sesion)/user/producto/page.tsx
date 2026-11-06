import type { Metadata } from "next"

import { PageHeader } from "@/components/admin/page-header"

export const metadata: Metadata = {
  title: "Ficha de producto · PriceScope",
}

export default function ProductoPage() {
  return <PageHeader title="Ficha de producto" />
}
