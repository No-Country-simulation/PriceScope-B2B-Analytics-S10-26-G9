import type { Metadata } from "next"

import { DemoScreen } from "@/components/demo/demo-screen"

export const metadata: Metadata = {
  title: "Agendar demo · PriceScope",
}

// UX02 · Agendar demo. Maqueta del nuevo diseño (sin demo.css).
export default function DemoPage() {
  return <DemoScreen />
}
