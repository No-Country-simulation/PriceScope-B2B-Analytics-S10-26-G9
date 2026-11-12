"use client"

import * as React from "react"
import { CheckIcon, ListChecksIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge, type Tone } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatArs, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"

import { REVIEW_QUEUE, confidenceOf, filterReviewQueue, reviewCategory, type CurationHistoryEntry, type ProductSnapshot, type ReviewItem } from "./data"
import { applyCatalogOperation, initialReviewState, latestReversibleEntry, nextReviewId, resolveReview, revertReview, type CatalogOperation, type ReviewDecision } from "./review-state"
import { CatalogDialog, type CatalogMode } from "./catalog-dialog"

const STORE_OPTIONS = [
  { value: "all", label: "Todas las tiendas" },
  ...Array.from(new Set(REVIEW_QUEUE.map((item) => item.store))).sort().map((store) => ({ value: store, label: store })),
]
const CATEGORY_OPTIONS = [
  { value: "all", label: "Todas las categorías" },
  ...Array.from(new Set(REVIEW_QUEUE.map(reviewCategory))).sort().map((category) => ({ value: category, label: category })),
]

const COMPARISON_FIELDS: { key: keyof ProductSnapshot; label: string; compare?: boolean; numeric?: boolean }[] = [
  { key: "name", label: "Nombre" },
  { key: "brand", label: "Marca", compare: true },
  { key: "content", label: "Contenido", compare: true },
  { key: "category", label: "Categoría", compare: true },
  { key: "code", label: "Código", compare: true, numeric: true },
  { key: "price", label: "Precio", numeric: true },
]
const HISTORY_LABELS: Record<CurationHistoryEntry["action"], { label: string; tone: Tone }> = {
  merged: { label: "Unido", tone: "brand" },
  confirmed: { label: "Confirmado", tone: "emerald" },
  separated: { label: "Separado", tone: "neutral" },
  chosen: { label: "Propuesto", tone: "sky" },
  created: { label: "Creado", tone: "violet" },
}

export function CurationBoard() {
  const { user, status } = useAuth()
  const [reviews, setReviews] = React.useState(initialReviewState)
  const [pendingAction, setPendingAction] = React.useState<{ item: ReviewItem; decision: ReviewDecision } | null>(null)
  const [catalogAction, setCatalogAction] = React.useState<{ mode: CatalogMode; item: ReviewItem } | null>(null)
  const [reverting, setReverting] = React.useState<CurationHistoryEntry | null>(null)
  const applying = React.useRef(false)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const [store, setStore] = React.useState("all")
  const [category, setCategory] = React.useState("all")
  const queue = React.useMemo(() => filterReviewQueue(reviews.pending, store, category), [reviews.pending, store, category])
  const [selectedId, setSelectedId] = React.useState<string | undefined>()
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0]
  const hasFilters = store !== "all" || category !== "all"
  const canAct = status === "authenticated" && user?.role === "admin"
  const reversible = latestReversibleEntry(reviews)

  function applyReversion() {
    if (!reverting || !canAct || !user || applying.current) return
    const next = revertReview(reviews, reverting.id, { id: crypto.randomUUID(), at: new Date().toISOString(), admin: user.name })
    if (next === reviews) return
    applying.current = true
    setReviews(next)
    setSelectedId(undefined)
    setReverting(null)
    toast.success("Cambio revertido.")
  }

  function requestCatalog(mode: CatalogMode) {
    if (!selected || !canAct) return
    applying.current = false
    setCatalogAction({ mode, item: selected })
  }

  function applyCatalog(operation: CatalogOperation): string | null {
    if (!canAct || !user || applying.current) return "La acción no está disponible en esta sesión."
    try {
      const next = applyCatalogOperation(reviews, operation, { id: crypto.randomUUID(), at: new Date().toISOString(), admin: user.name })
      applying.current = true
      setReviews(next)
      setCatalogAction(null)
      toast.success(operation.type === "merge" ? "Duplicados unidos. Se conservaron las referencias al principal." : "Propuesta actualizada. Revisá y confirmá el mapeo.")
      return null
    } catch (error) {
      return error instanceof Error ? error.message : "No pudimos aplicar la acción."
    }
  }

  function requestDecision(decision: ReviewDecision) {
    if (!selected || !canAct) return
    applying.current = false
    setPendingAction({ item: selected, decision })
  }

  function applyDecision() {
    if (!pendingAction || !canAct || !user || applying.current) return
    const { item, decision } = pendingAction
    if (!reviews.pending.some((candidate) => candidate.id === item.id)) return
    applying.current = true
    const audit = { id: crypto.randomUUID(), at: new Date().toISOString(), admin: user.name }
    setReviews((current) => resolveReview(current, item.id, decision, audit))
    setSelectedId(queue.find((candidate) => candidate.id !== item.id)?.id)
    setPendingAction(null)
    toast.success(decision === "confirmed" ? "Mapeo confirmado." : "Sugerencia separada. La publicación queda sin vinculación.")
  }

  function skipReview() {
    if (!selected || !canAct) return
    const next = nextReviewId(queue, selected.id)
    if (next) setSelectedId(next)
  }

  function clearFilters() {
    setStore("all")
    setCategory("all")
    setSelectedId(undefined)
  }

  return <>
    <PageHeader title="Curaduría de productos"
      description="Revisá los emparejamientos dudosos entre tiendas para que las comparaciones sean confiables."
      actions={<div className="flex flex-wrap items-end gap-3">
        <ReviewFilter id="curation-store" label="Tienda" value={store} items={STORE_OPTIONS}
          onChange={(value) => { setStore(value); setSelectedId(undefined) }} />
        <ReviewFilter id="curation-category" label="Categoría" value={category} items={CATEGORY_OPTIONS}
          onChange={(value) => { setCategory(value); setSelectedId(undefined) }} />
        <Button variant="ghost" disabled={!hasFilters} onClick={clearFilters}><XIcon data-icon="inline-start" />Limpiar filtros</Button>
      </div>} />

    <div className="grid min-w-0 items-start gap-4 @5xl/main:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
      <Card className="min-w-0 gap-0 py-0 shadow-xs">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b py-4">
          <CardTitle><h3>Cola de revisión</h3></CardTitle>
          <span className="text-xs text-muted-foreground" role="status">{queue.some((item) => item.manual) ? "Manuales primero" : "Menor confianza primero"} · {queue.length} de {reviews.pending.length}</span>
        </CardHeader>
        {queue.length ? <ul className="max-h-[32rem] divide-y overflow-y-auto">
          {queue.map((item) => {
            const confidence = confidenceOf(item.score, item.manual)
            const active = item.id === selected?.id
            return <li key={item.id}>
              <button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={active}
                aria-controls="curation-comparison" className={cn("flex w-full items-start gap-3 border-l-2 border-transparent px-4 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", active && "border-l-foreground bg-muted/60")}>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium wrap-anywhere">{item.listing.name}</span>
                  <span className="text-xs wrap-anywhere text-muted-foreground">{item.store} → {item.suggested.name} {item.suggested.content}</span>
                </span>
                <ToneBadge tone={confidence.tone}>{confidence.label}</ToneBadge>
              </button>
            </li>
          })}
        </ul> : <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground" role="status">
          <ListChecksIcon className="size-6" aria-hidden="true" />
          <p>{reviews.pending.length === 0 ? "No quedan productos pendientes de revisión." : "No hay productos con estos filtros."}</p>
        </div>}
      </Card>

      {selected ? <Comparison item={selected} canAct={canAct} canSkip={queue.length > 1}
        onDecision={requestDecision} onSkip={skipReview} onCatalog={requestCatalog} /> : <Card id="curation-comparison" className="min-w-0 shadow-xs">
        <CardHeader>
          <CardTitle><h3>{reviews.pending.length === 0 ? "Revisión completada" : "Sin productos para comparar"}</h3></CardTitle>
          <CardDescription>{reviews.pending.length === 0 ? "Todos los pendientes fueron revisados. Podés consultar las decisiones en el historial." : "Probá otra tienda o categoría para continuar con la revisión."}</CardDescription>
        </CardHeader>
        {hasFilters && <CardFooter><Button variant="outline" onClick={clearFilters}>Restablecer filtros</Button></CardFooter>}
      </Card>}
    </div>

    <Card className="min-w-0 gap-0 py-0 shadow-xs">
      <CardHeader className="py-5">
        <CardTitle><h3>Historial de cambios</h3></CardTitle>
        <CardDescription>Historial general de cambios de mapeo entre publicaciones y productos canónicos. Revertí los cambios comenzando por el más reciente.</CardDescription>
      </CardHeader>
      <Table aria-label="Historial de cambios de curaduría" className="min-w-[860px]">
        <TableHeader><TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">Fecha</TableHead><TableHead>Administrador</TableHead><TableHead>Acción</TableHead>
          <TableHead>Antes</TableHead><TableHead>Después</TableHead><TableHead className="pr-5 text-right">Reversión</TableHead>
        </TableRow></TableHeader>
        <TableBody>{reviews.history.map((entry) => <TableRow key={entry.id}>
          <TableCell className="py-3 pl-5 text-xs text-muted-foreground"><time dateTime={entry.at}>{formatDateTime(entry.at)}</time></TableCell>
          <TableCell className="py-3">{entry.admin}</TableCell>
          <TableCell className="py-3"><ToneBadge tone={HISTORY_LABELS[entry.action].tone}>{HISTORY_LABELS[entry.action].label}</ToneBadge></TableCell>
          <TableCell className="max-w-64 whitespace-normal text-muted-foreground">{entry.before}</TableCell>
          <TableCell className="max-w-64 whitespace-normal">{entry.after}</TableCell>
          <TableCell className="pr-5 text-right">{entry.reverted
            ? <span className="text-xs text-muted-foreground">Revertido por {entry.reverted.admin}<br /><time dateTime={entry.reverted.at}>{formatDateTime(entry.reverted.at)}</time></span>
            : <Button variant="outline" size="sm" disabled={!canAct || reversible?.id !== entry.id}
              title={!entry.undo ? "Sin datos para revertir este cambio" : reversible?.id !== entry.id ? "Revertí primero los cambios posteriores" : undefined}
              onClick={() => { applying.current = false; setReverting(entry) }}>Revertir</Button>}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </Card>

    {catalogAction && <CatalogDialog mode={catalogAction.mode} item={catalogAction.item} catalog={reviews.catalog}
      onClose={() => setCatalogAction(null)} onApply={applyCatalog} />}

    <Dialog open={reverting !== null} onOpenChange={(open) => { if (!open) setReverting(null) }}>
      <DialogContent initialFocus={cancelRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Revertir este cambio?</DialogTitle>
          <DialogDescription>Se restaurarán los pendientes, los canónicos y sus vínculos al estado anterior a esta acción. El cambio seguirá visible como revertido en el historial.</DialogDescription>
        </DialogHeader>
        {reverting && <dl className="grid gap-3 rounded-lg border p-4 text-sm">
          <div><dt className="text-muted-foreground">Cambio actual</dt><dd className="wrap-anywhere">{reverting.after}</dd></div>
          <div><dt className="text-muted-foreground">Estado anterior</dt><dd className="wrap-anywhere">{reverting.before}</dd></div>
        </dl>}
        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => setReverting(null)}>Cancelar</Button>
          <Button disabled={!canAct || reversible?.id !== reverting?.id} onClick={applyReversion}>Revertir cambio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
      <DialogContent initialFocus={cancelRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pendingAction?.decision === "confirmed" ? "¿Confirmar este mapeo?" : "¿Separar esta sugerencia?"}</DialogTitle>
          <DialogDescription>{pendingAction?.decision === "confirmed"
            ? "La publicación quedará asociada al canónico sugerido. Revisá las diferencias antes de confirmar."
            : "Se rechazará el emparejamiento sugerido y la publicación quedará sin vinculación. No se creará un canónico nuevo ni se eliminará ningún producto."}</DialogDescription>
        </DialogHeader>
        {pendingAction && <dl className="grid gap-3 rounded-lg border p-4 text-sm">
          <div><dt className="text-muted-foreground">Publicación · {pendingAction.item.store}</dt><dd className="font-medium wrap-anywhere">{pendingAction.item.listing.name}</dd></div>
          <div><dt className="text-muted-foreground">Canónico sugerido</dt><dd className="font-medium wrap-anywhere">{pendingAction.item.suggested.name} · {pendingAction.item.suggested.content}</dd></div>
        </dl>}
        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
          <Button disabled={!canAct} onClick={applyDecision}>{pendingAction?.decision === "confirmed" ? "Confirmar mapeo" : "Separar sugerencia"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

function Comparison({ item, canAct, canSkip, onDecision, onSkip, onCatalog }: {
  item: ReviewItem
  canAct: boolean
  canSkip: boolean
  onDecision: (decision: ReviewDecision) => void
  onSkip: () => void
  onCatalog: (mode: CatalogMode) => void
}) {
  const confidence = confidenceOf(item.score, item.manual)
  const differences = COMPARISON_FIELDS.filter((field) => field.compare && item.listing[field.key] !== item.suggested[field.key]).length
  return <Card id="curation-comparison" className="min-w-0 gap-0 py-0 shadow-xs" aria-labelledby="curation-comparison-title">
    <CardHeader className="gap-2 py-5">
      <CardTitle><h3 id="curation-comparison-title">¿Es el mismo producto?</h3></CardTitle>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">Confianza del emparejamiento:
          <ToneBadge tone={confidence.tone}>{confidence.label}{!item.manual && ` (${item.score.toFixed(2).replace(".", ",")})`}</ToneBadge>
        </span>
        <span className="text-xs text-muted-foreground">{differences === 0 ? "Sin diferencias en los campos clave" : `${differences} ${differences === 1 ? "diferencia resaltada" : "diferencias resaltadas"}`}</span>
      </div>
      <p className="sr-only" role="status">Comparando {item.listing.name}, de {item.store}, con {item.suggested.name} {item.suggested.content}.</p>
    </CardHeader>
    <Table aria-label={`Comparación de ${item.listing.name} con el canónico sugerido`} className="min-w-[540px] table-fixed">
      <TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableHead className="w-28 pl-5">Campo</TableHead><TableHead className="whitespace-normal">Publicación · {item.store}</TableHead>
        <TableHead className="whitespace-normal pr-5">Canónico sugerido</TableHead>
      </TableRow></TableHeader>
      <TableBody>{COMPARISON_FIELDS.map((field) => {
        const different = !!field.compare && item.listing[field.key] !== item.suggested[field.key]
        const value = (product: ProductSnapshot) => field.key === "price" ? formatArs(product.price) : product[field.key]
        return <TableRow key={field.key} className={cn("hover:bg-transparent", different && "bg-amber-500/5 hover:bg-amber-500/5")}>
          <TableCell className="py-4 pl-5 align-top text-muted-foreground">{field.label}</TableCell>
          <TableCell className={cn("py-4 align-top whitespace-normal wrap-anywhere", field.numeric && "font-mono text-xs")}>{value(item.listing)}</TableCell>
          <TableCell className={cn("py-4 pr-5 align-top whitespace-normal wrap-anywhere", field.numeric && "font-mono text-xs")}>
            <span className="inline-flex flex-wrap items-center gap-2">{value(item.suggested)}{field.key === "price" && " (promedio)"}
              {different && <ToneBadge tone="amber">Distinto</ToneBadge>}
            </span>
          </TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
    <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 py-4">
      <Button disabled={!canAct} onClick={() => onDecision("confirmed")}><CheckIcon data-icon="inline-start" />Confirmar mapeo</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onCatalog("choose")}>Elegir otro canónico</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onCatalog("create")}>Crear canónico nuevo</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onCatalog("merge")}>Unir duplicados</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onDecision("separated")}>Separar</Button>
      <Button variant="ghost" className="sm:ml-auto" disabled={!canAct || !canSkip} onClick={onSkip}>Saltar →</Button>
    </CardFooter>
  </Card>
}

function ReviewFilter({ id, label, items, value, onChange }: {
  id: string
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={id}>{label}</Label>
    <Select items={items} value={value} onValueChange={(next) => { if (next) onChange(next) }}>
      <SelectTrigger id={id} className="w-48 max-w-full"><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>
        {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  </div>
}
