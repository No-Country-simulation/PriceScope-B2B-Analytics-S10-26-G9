// UX09: datos de muestra para la maqueta. No se consulta ni modifica la API.
export type ProductSnapshot = {
  name: string
  brand: string
  content: string
  category: string
  code: string
  price: number
}

export type ReviewItem = {
  id: string
  store: string
  score: number
  listing: ProductSnapshot
  suggested: ProductSnapshot
  manual?: boolean
}

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "coffee-sur", store: "Hiper Sur", score: 0.41,
    listing: { name: "Café Molido Intenso x450g", brand: "Aroma Andino", content: "450 g", category: "Almacén > Infusiones", code: "EAN 07790000000418", price: 8450 },
    suggested: { name: "Café molido", brand: "Aroma Andino", content: "500 g", category: "Almacén", code: "EAN 07790000000401", price: 8990 },
  },
  {
    id: "detergent-sur", store: "Hiper Sur", score: 0.48,
    listing: { name: "Detergente Limón 700", brand: "Brillo Hogar", content: "700 ml", category: "Limpieza", code: "EAN 07790000002231", price: 2190 },
    suggested: { name: "Detergente", brand: "Brillo Hogar", content: "750 ml", category: "Limpieza", code: "EAN 07790000002231", price: 2350 },
  },
  {
    id: "tv-norte", store: "Mercado Norte", score: 0.67,
    listing: { name: "TV LED 50 UHD Smart", brand: "Visiontek", content: '50"', category: "Electro > TV", code: "MOD VT50U-24", price: 649999 },
    suggested: { name: 'Smart TV 4K 50"', brand: "Visiontek", content: '50"', category: "Electro", code: "MOD VT50U-23", price: 689999 },
  },
  {
    id: "yerba-norte", store: "Mercado Norte", score: 0.72,
    listing: { name: "Yerba Mate Suave 1kg", brand: "Monte Verde", content: "1 kg", category: "Almacén", code: "EAN 07790000000777", price: 5450 },
    suggested: { name: "Yerba mate", brand: "Monte Verde", content: "1 kg", category: "Almacén", code: "EAN 07790000000770", price: 5180 },
  },
  {
    id: "running-delta", store: "Supermercado Delta", score: 0.74,
    listing: { name: "Zapatilla Running Hombre", brand: "Pista", content: "talle 42", category: "Indumentaria > Calzado", code: "SKU PST-R42", price: 89990 },
    suggested: { name: "Zapatillas running", brand: "Pista", content: "talle 42", category: "Indumentaria", code: "SKU PST-R42", price: 89830 },
  },
  {
    id: "milk-sur", store: "Hiper Sur", score: 0.86,
    listing: { name: "Leche Entera Larga Vida 1L", brand: "La Pradera", content: "1 L", category: "Lácteos", code: "EAN 07790000003310", price: 1450 },
    suggested: { name: "Leche entera", brand: "La Pradera", content: "1 L", category: "Lácteos", code: "EAN 07790000003310", price: 1420 },
  },
]

export type CurationSnapshot = {
  pending: ReviewItem[]
  catalog: ProductSnapshot[]
  links: Record<string, string | null>
}

export type CurationHistoryEntry = {
  id: string
  at: string
  admin: string
  action: "merged" | "confirmed" | "separated" | "chosen" | "created"
  before: string
  after: string
  undo?: CurationSnapshot
  reverted?: { at: string; admin: string }
}

// Incluye una variante duplicada para probar la unión sin alterar los pendientes.
export const CANONICAL_CATALOG: ProductSnapshot[] = [
  ...REVIEW_QUEUE.map((item) => item.suggested),
  { name: "Café molido clásico", brand: "Aroma Andino", content: "500 g", category: "Almacén", code: "EAN 07790000000419", price: 8990 },
]

export const HISTORY: CurationHistoryEntry[] = [
  { id: "history-oil", at: "2026-10-28T17:42:00-03:00", admin: "Tomás H.", action: "merged", before: "Aceite girasol 1,5 L (×2 canónicos)", after: "Aceite de girasol 1,5 L" },
  { id: "history-rice", at: "2026-10-28T12:05:00-03:00", admin: "Sofía M.", action: "confirmed", before: "Arroz Largo Fino 1Kg → sin confirmar", after: "Arroz Largo Fino 1Kg → Arroz largo fino 1 kg" },
  { id: "history-jeans", at: "2026-10-27T16:30:00-03:00", admin: "Tomás H.", action: "separated", before: "Jean clásico (talles 38–44)", after: "Jean clásico talle 40 · Jean clásico talle 42" },
]

// Umbrales de presentación de la maqueta, pendientes del contrato de curaduría.
export function confidenceOf(score: number, manual = false) {
  if (manual) return { label: "Manual", tone: "sky" } as const
  if (score < 0.5) return { label: "Baja", tone: "red" } as const
  if (score < 0.8) return { label: "Media", tone: "amber" } as const
  return { label: "Alta", tone: "emerald" } as const
}

export function reviewCategory(item: ReviewItem) {
  return item.listing.category.split(">")[0].trim()
}

// Los filtros solo afectan a pendientes; nunca alteran el historial ni el catálogo.
export function filterReviewQueue(items: readonly ReviewItem[], store: string, category: string) {
  return items.filter((item) => (store === "all" || item.store === store)
    && (category === "all" || reviewCategory(item) === category))
    .sort((a, b) => Number(!!b.manual) - Number(!!a.manual) || a.score - b.score)
}
