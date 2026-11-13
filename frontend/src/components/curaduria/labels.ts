import type { CanonicalProduct, CurationAction, CurationItem } from "@/lib/api"
import type { Tone } from "@/components/admin/tone"
import { CATEGORY_LABEL } from "@/lib/categories"

// Thresholds of the suggestion score (services/curation.py: name 70 %, brand and content 15 % each).
export function confidenceOf(score: string | null, manual = false) {
  if (manual) return { label: "Manual", tone: "sky" } as const
  if (score === null) return { label: "Sin propuesta", tone: "neutral" } as const
  const value = Number(score)
  if (value < 0.5) return { label: "Baja", tone: "red" } as const
  if (value < 0.8) return { label: "Media", tone: "amber" } as const
  return { label: "Alta", tone: "emerald" } as const
}

export function formatScore(score: string) {
  return Number(score).toFixed(2).replace(".", ",")
}

export function categoryLabel(category: CanonicalProduct["category"]) {
  return category ? CATEGORY_LABEL[category] : "Sin categoría"
}

export function canonicalCode(product: Pick<CanonicalProduct, "ean">) {
  return product.ean ? `EAN ${product.ean}` : "Sin EAN"
}

export function canonicalLabel(product: Pick<CanonicalProduct, "name" | "content">) {
  return [product.name, product.content].filter(Boolean).join(" · ")
}

export const HISTORY_LABELS: Record<CurationAction, { label: string; tone: Tone }> = {
  merged: { label: "Unido", tone: "brand" },
  confirmed: { label: "Confirmado", tone: "emerald" },
  separated: { label: "Separado", tone: "neutral" },
  chosen: { label: "Propuesto", tone: "sky" },
  created: { label: "Creado", tone: "violet" },
}

export function nextItemId(items: readonly CurationItem[], currentId: string) {
  if (items.length < 2) return undefined
  const index = items.findIndex((item) => item.id === currentId)
  return items[(index + 1) % items.length]?.id
}
