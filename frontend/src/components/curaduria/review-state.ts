import { z } from "zod"
import { CANONICAL_CATALOG, HISTORY, REVIEW_QUEUE, type CurationHistoryEntry, type CurationSnapshot, type ProductSnapshot, type ReviewItem } from "./data"

export type ReviewDecision = "confirmed" | "separated"
export type ReviewState = CurationSnapshot & { history: CurationHistoryEntry[] }
export type Audit = { id: string; at: string; admin: string }
export type CatalogOperation =
  | { type: "choose"; reviewId: string; targetCode: string }
  | { type: "create"; reviewId: string; product: z.infer<typeof canonicalDraftSchema> }
  | { type: "merge"; sourceCode: string; targetCode: string }

export const canonicalDraftSchema = z.object({
  name: z.string().trim().min(2, "Ingresá al menos 2 caracteres.").max(255),
  brand: z.string().trim().min(1, "Ingresá una marca.").max(120),
  content: z.string().trim().min(1, "Ingresá el contenido o formato.").max(120),
  category: z.string().trim().min(1, "Ingresá una categoría.").max(160),
  code: z.string().trim().min(3, "Ingresá un código de al menos 3 caracteres.").max(120),
})
export type CanonicalDraft = z.infer<typeof canonicalDraftSchema>

export function initialReviewState(): ReviewState {
  return { pending: [...REVIEW_QUEUE], catalog: [...CANONICAL_CATALOG], links: {}, history: [...HISTORY] }
}

function snapshot(state: ReviewState): CurationSnapshot {
  return { pending: state.pending, catalog: state.catalog, links: state.links }
}

export function latestReversibleEntry(state: ReviewState) {
  return state.history.find((entry) => entry.undo && !entry.reverted)
}

// Los snapshots se restauran en orden inverso para conservar las dependencias.
export function revertReview(state: ReviewState, entryId: string, audit: Audit): ReviewState {
  const entry = latestReversibleEntry(state)
  if (!entry || entry.id !== entryId || !entry.undo) return state
  return {
    ...entry.undo,
    history: state.history.map((item) => item.id === entryId
      ? { ...item, undo: undefined, reverted: { at: audit.at, admin: audit.admin } }
      : item),
  }
}

// Transición local y atómica: una publicación sale una sola vez de pendientes.
// El snapshot conserva el estado anterior para poder revertir la acción.
export function resolveReview(
  state: ReviewState,
  reviewId: string,
  decision: ReviewDecision,
  audit: Audit,
): ReviewState {
  const item = state.pending.find((entry) => entry.id === reviewId)
  if (!item) return state
  const publication = `${item.listing.name} · ${item.store}`
  const entry: CurationHistoryEntry = {
    ...audit,
    action: decision,
    before: `${publication} → ${item.suggested.name} ${item.suggested.content} (sin confirmar)`,
    after: decision === "confirmed"
      ? `${publication} → ${item.suggested.name} ${item.suggested.content}`
      : `${publication} → sin vinculación`,
    undo: snapshot(state),
  }
  return {
    ...state,
    pending: state.pending.filter((candidate) => candidate.id !== reviewId),
    links: { ...state.links, [reviewId]: decision === "confirmed" ? item.suggested.code : null },
    history: [entry, ...state.history],
  }
}

export function applyCatalogOperation(state: ReviewState, operation: CatalogOperation, audit: Audit): ReviewState {
  const undo = snapshot(state)
  if (operation.type === "merge") {
    if (operation.sourceCode === operation.targetCode) throw new Error("Elegí dos canónicos distintos.")
    const source = state.catalog.find((item) => item.code === operation.sourceCode)
    const target = state.catalog.find((item) => item.code === operation.targetCode)
    if (!source || !target) throw new Error("Uno de los canónicos ya no está disponible.")
    return {
      catalog: state.catalog.filter((item) => item.code !== source.code),
      pending: state.pending.map((item) => item.suggested.code === source.code ? { ...item, suggested: target, manual: true } : item),
      links: Object.fromEntries(Object.entries(state.links).map(([id, code]) => [id, code === source.code ? target.code : code])),
      history: [{ ...audit, action: "merged", before: `${source.name} (${source.code}) + ${target.name} (${target.code})`,
        after: `${target.name} · ${target.content} (${target.code})`, undo }, ...state.history],
    }
  }
  const review = state.pending.find((item) => item.id === operation.reviewId)
  if (!review) throw new Error("La publicación ya no está pendiente de revisión.")
  let target: ProductSnapshot
  let catalog = state.catalog
  if (operation.type === "create") {
    const parsed = canonicalDraftSchema.safeParse(operation.product)
    if (!parsed.success) throw new Error("Revisá los campos del nuevo canónico.")
    const normalized = (code: string) => code.trim().replace(/\s+/g, " ").toUpperCase()
    if (catalog.some((item) => normalized(item.code) === normalized(parsed.data.code))) {
      throw new Error("Ya existe un canónico con ese código. Usá Elegir otro canónico.")
    }
    target = { ...parsed.data, price: review.listing.price }
    catalog = [...catalog, target]
  } else {
    const found = catalog.find((item) => item.code === operation.targetCode)
    if (!found) throw new Error("El canónico seleccionado ya no está disponible.")
    if (found.code === review.suggested.code) throw new Error("Ese canónico ya está propuesto.")
    target = found
  }
  return {
    ...state, catalog,
    pending: state.pending.map((item) => item.id === review.id ? { ...item, suggested: target, manual: true } : item),
    history: [{ ...audit, action: operation.type === "create" ? "created" : "chosen",
      before: `${review.listing.name} → ${review.suggested.name} (${review.suggested.code})`,
      after: `${review.listing.name} → ${target.name} (${target.code}) (pendiente de confirmar)`, undo }, ...state.history],
  }
}

export function nextReviewId(queue: readonly ReviewItem[], selectedId: string) {
  if (queue.length < 2) return undefined
  const index = queue.findIndex((item) => item.id === selectedId)
  return queue[(index + 1) % queue.length]?.id
}
