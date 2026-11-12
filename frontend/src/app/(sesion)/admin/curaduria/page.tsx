import type { Metadata } from "next"
import { CurationBoard } from "@/components/curaduria/curation-board"

export const metadata: Metadata = { title: "Curaduría · PriceScope" }

export default function CuraduriaPage() {
  return <CurationBoard />
}
