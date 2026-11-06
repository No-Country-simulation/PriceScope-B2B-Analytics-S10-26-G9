import type { Metadata } from "next"

import { PageHeader } from "@/components/admin/page-header"

export const metadata: Metadata = {
  title: "Alertas · PriceScope",
}

export default function AlertasPage() {
  return <PageHeader title="Alertas" />
}
