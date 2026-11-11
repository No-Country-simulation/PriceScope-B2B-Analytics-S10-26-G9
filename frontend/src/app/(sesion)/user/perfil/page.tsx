import type { Metadata } from "next"

import { ClientProfile } from "@/components/cliente/client-profile"

export const metadata: Metadata = {
  title: "Mi cuenta · PriceScope",
}

export default function PerfilPage() {
  return <ClientProfile />
}
