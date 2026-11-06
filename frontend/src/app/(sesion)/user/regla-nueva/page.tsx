import type { Metadata } from "next"

import { PageHeader } from "@/components/admin/page-header"

export const metadata: Metadata = {
  title: "Nueva regla · PriceScope",
}

export default function NuevaReglaPage() {
  return <PageHeader title="Nueva regla" />
}
