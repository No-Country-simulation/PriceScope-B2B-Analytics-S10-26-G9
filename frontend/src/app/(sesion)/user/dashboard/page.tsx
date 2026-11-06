import type { Metadata } from "next"

import { PageHeader } from "@/components/admin/page-header"

export const metadata: Metadata = {
  title: "Dashboard · PriceScope",
}

export default function DashboardPage() {
  return <PageHeader title="Dashboard" />
}
