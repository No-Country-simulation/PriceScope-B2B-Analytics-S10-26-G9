"use client"

import * as React from "react"
import { CheckIcon, CircleAlertIcon, ExternalLinkIcon, ListChecksIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge } from "@/components/admin/tone"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError, query, type CurationEvent, type CurationItem, type CurationQueue } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { CATEGORY_LABEL } from "@/lib/categories"
import { formatArs, formatDateTime } from "@/lib/format"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

import { CatalogDialog, type CatalogMode, type CatalogOperation } from "./catalog-dialog"
import { HISTORY_LABELS, canonicalCode, canonicalLabel, categoryLabel, confidenceOf, formatScore, nextItemId } from "./labels"

type Decision = "confirm" | "separate"
const BASE = "/admin/curation"

// UX09 · Curaduría: publicaciones que no se pudieron vincular por EAN.
export function CurationBoard() {
  const { user, status, request } = useAuth()
  const [store, setStore] = React.useState("all")
  const [category, setCategory] = React.useState("all")
  const queue = useApi<CurationQueue>(`${BASE}/queue${query({
    store: store === "all" ? null : store,
    category: category === "all" ? null : category,
  })}`)
  const history = useApi<CurationEvent[]>(`${BASE}/history?limit=50`)
  const [pendingAction, setPendingAction] = React.useState<{ item: CurationItem; decision: Decision } | null>(null)
  const [catalogAction, setCatalogAction] = React.useState<{ mode: CatalogMode; item: CurationItem } | null>(null)
  const [reverting, setReverting] = React.useState<CurationEvent | null>(null)
  const [busy, setBusy] = React.useState(false)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const [selectedId, setSelectedId] = React.useState<string | undefined>()

  const items = React.useMemo(() => queue.data?.items ?? [], [queue.data])
  const total = queue.data?.total ?? 0
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const hasFilters = store !== "all" || category !== "all"
  const canAct = status === "authenticated" && user?.role === "admin" && !busy
  const storeOptions = [
    { value: "all", label: "Todas las tiendas" },
    ...(queue.data?.stores ?? []).map((s) => ({ value: s.slug, label: s.name })),
  ]
  const categoryOptions = [
    { value: "all", label: "Todas las categorías" },
    ...(queue.data?.categories ?? []).map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
  ]

  // Every action goes to the API; on success the queue and the history reload.
  async function post(path: string, body?: unknown): Promise<string | null> {
    setBusy(true)
    try {
      await request(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })
      queue.reload()
      history.reload()
      return null
    } catch (error) {
      queue.reload()
      return error instanceof ApiError ? error.message : "No pudimos aplicar la acción. Probá de nuevo."
    } finally {
      setBusy(false)
    }
  }

  async function applyDecision() {
    if (!pendingAction || !canAct) return
    const { item, decision } = pendingAction
    const error = await post(`${BASE}/queue/${item.id}/${decision}`)
    setPendingAction(null)
    if (error) return void toast.error(error)
    setSelectedId(items.find((candidate) => candidate.id !== item.id)?.id)
    toast.success(decision === "confirm" ? "Mapeo confirmado." : "Sugerencia separada. La publicación queda sin vinculación.")
  }

  async function applyCatalog(operation: CatalogOperation): Promise<string | null> {
    if (!catalogAction || !canAct) return "La acción no está disponible en esta sesión."
    const { item } = catalogAction
    const error = operation.type === "merge"
      ? await post(`${BASE}/canonical/merge`, { source_id: operation.sourceId, target_id: item.suggested?.id })
      : operation.type === "choose"
        ? await post(`${BASE}/queue/${item.id}/choose`, { canonical_id: operation.canonicalId })
        : await post(`${BASE}/queue/${item.id}/create`, operation.product)
    if (error) return error
    setCatalogAction(null)
    toast.success(operation.type === "merge" ? "Duplicados unidos. Se conservaron las referencias al principal." : "Propuesta actualizada. Revisá y confirmá el mapeo.")
    return null
  }

  async function applyReversion() {
    if (!reverting || !canAct) return
    const error = await post(`${BASE}/history/${reverting.id}/revert`)
    setReverting(null)
    if (error) return void toast.error(error)
    setSelectedId(undefined)
    toast.success("Cambio revertido.")
  }

  function skip() {
    if (!selected) return
    const next = nextItemId(items, selected.id)
    if (next) setSelectedId(next)
  }

  function clearFilters() {
    setStore("all")
    setCategory("all")
    setSelectedId(undefined)
  }

  const header = <PageHeader title="Curaduría de productos"
    description="Revisá las publicaciones que no se pudieron vincular por EAN para que las comparaciones sean confiables."
    actions={<div className="flex flex-wrap items-end gap-3">
      <ReviewFilter id="curation-store" label="Tienda" value={store} items={storeOptions}
        onChange={(value) => { setStore(value); setSelectedId(undefined) }} />
      <ReviewFilter id="curation-category" label="Categoría" value={category} items={categoryOptions}
        onChange={(value) => { setCategory(value); setSelectedId(undefined) }} />
      <Button variant="ghost" disabled={!hasFilters} onClick={clearFilters}><XIcon data-icon="inline-start" />Limpiar filtros</Button>
    </div>} />

  if (queue.error && !queue.data) {
    return <>
      {header}
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>No pudimos cargar la cola de curaduría.</AlertTitle>
        <AlertDescription>Probá de nuevo en unos minutos.</AlertDescription>
      </Alert>
    </>
  }

  return <>
    {header}

    <div className={cn("grid min-w-0 items-start gap-4 @5xl/main:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]", queue.loading && queue.data && "opacity-60")}>
      <Card className="min-w-0 gap-0 py-0 shadow-xs">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b py-4">
          <CardTitle><h3>Cola de revisión</h3></CardTitle>
          {queue.data && <span className="text-xs text-muted-foreground" role="status">{items.some((item) => item.manual) ? "Manuales primero" : "Menor confianza primero"} · {items.length} de {total}</span>}
        </CardHeader>
        {!queue.data ? <div className="flex flex-col gap-3 p-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-12" />)}</div>
          : items.length ? <ul className="max-h-[32rem] divide-y overflow-y-auto">
            {items.map((item) => {
              const confidence = confidenceOf(item.score, item.manual)
              const active = item.id === selected?.id
              return <li key={item.id}>
                <button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={active}
                  aria-controls="curation-comparison" className={cn("flex w-full items-start gap-3 border-l-2 border-transparent px-4 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", active && "border-l-foreground bg-muted/60")}>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium wrap-anywhere">{item.listing.name}</span>
                    <span className="text-xs wrap-anywhere text-muted-foreground">{item.store.name} → {item.suggested ? canonicalLabel(item.suggested) : "sin propuesta"}</span>
                  </span>
                  <ToneBadge tone={confidence.tone}>{confidence.label}</ToneBadge>
                </button>
              </li>
            })}
          </ul> : <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground" role="status">
            <ListChecksIcon className="size-6" aria-hidden="true" />
            <p>{total === 0 ? "No quedan publicaciones pendientes de revisión." : "No hay publicaciones con estos filtros."}</p>
          </div>}
      </Card>

      {selected ? <Comparison item={selected} canAct={canAct} canSkip={items.length > 1}
        onDecision={(decision) => setPendingAction({ item: selected, decision })} onSkip={skip}
        onCatalog={(mode) => setCatalogAction({ mode, item: selected })} />
        : queue.data ? <Card id="curation-comparison" className="min-w-0 shadow-xs">
          <CardHeader>
            <CardTitle><h3>{total === 0 ? "Revisión completada" : "Sin publicaciones para comparar"}</h3></CardTitle>
            <CardDescription>{total === 0
              ? "Todas las publicaciones están vinculadas a un producto canónico. Las nuevas sin EAN aparecen acá después de cada extracción."
              : "Probá otra tienda o categoría para continuar con la revisión."}</CardDescription>
          </CardHeader>
          {hasFilters && <CardFooter><Button variant="outline" onClick={clearFilters}>Restablecer filtros</Button></CardFooter>}
        </Card> : <Skeleton className="h-96" />}
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
        <TableBody>
          {history.data?.map((entry) => <TableRow key={entry.id}>
            <TableCell className="py-3 pl-5 text-xs text-muted-foreground"><time dateTime={entry.at}>{formatDateTime(entry.at)}</time></TableCell>
            <TableCell className="py-3">{entry.admin}</TableCell>
            <TableCell className="py-3"><ToneBadge tone={HISTORY_LABELS[entry.action].tone}>{HISTORY_LABELS[entry.action].label}</ToneBadge></TableCell>
            <TableCell className="max-w-64 whitespace-normal text-muted-foreground">{entry.before}</TableCell>
            <TableCell className="max-w-64 whitespace-normal">{entry.after}</TableCell>
            <TableCell className="pr-5 text-right">{entry.reverted
              ? <span className="text-xs text-muted-foreground">Revertido por {entry.reverted.admin}<br /><time dateTime={entry.reverted.at}>{formatDateTime(entry.reverted.at)}</time></span>
              : <Button variant="outline" size="sm" disabled={!canAct || !entry.revertible}
                title={entry.revertible ? undefined : "Revertí primero los cambios posteriores"}
                onClick={() => setReverting(entry)}>Revertir</Button>}</TableCell>
          </TableRow>)}
          {history.data?.length === 0 && <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Todavía no hay cambios de curaduría.</TableCell>
          </TableRow>}
          {!history.data && <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-4 pl-5">{history.error ? "No pudimos cargar el historial." : <Skeleton className="h-6" />}</TableCell>
          </TableRow>}
        </TableBody>
      </Table>
    </Card>

    {catalogAction && <CatalogDialog mode={catalogAction.mode} item={catalogAction.item} busy={busy}
      onClose={() => setCatalogAction(null)} onApply={applyCatalog} />}

    <Dialog open={reverting !== null} onOpenChange={(open) => { if (!open) setReverting(null) }}>
      <DialogContent initialFocus={cancelRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Revertir este cambio?</DialogTitle>
          <DialogDescription>Se restaurarán la publicación, los canónicos y sus vínculos al estado anterior a esta acción. El cambio seguirá visible como revertido en el historial.</DialogDescription>
        </DialogHeader>
        {reverting && <dl className="grid gap-3 rounded-lg border p-4 text-sm">
          <div><dt className="text-muted-foreground">Cambio actual</dt><dd className="wrap-anywhere">{reverting.after}</dd></div>
          <div><dt className="text-muted-foreground">Estado anterior</dt><dd className="wrap-anywhere">{reverting.before}</dd></div>
        </dl>}
        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => setReverting(null)}>Cancelar</Button>
          <Button disabled={!canAct || !reverting?.revertible} onClick={applyReversion}>Revertir cambio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
      <DialogContent initialFocus={cancelRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pendingAction?.decision === "confirm" ? "¿Confirmar este mapeo?" : "¿Separar esta sugerencia?"}</DialogTitle>
          <DialogDescription>{pendingAction?.decision === "confirm"
            ? "La publicación quedará asociada al canónico sugerido. Revisá las diferencias antes de confirmar."
            : "Se rechazará el emparejamiento sugerido y la publicación quedará sin vinculación. No se creará un canónico nuevo ni se eliminará ningún producto."}</DialogDescription>
        </DialogHeader>
        {pendingAction && <dl className="grid gap-3 rounded-lg border p-4 text-sm">
          <div><dt className="text-muted-foreground">Publicación · {pendingAction.item.store.name}</dt><dd className="font-medium wrap-anywhere">{pendingAction.item.listing.name}</dd></div>
          <div><dt className="text-muted-foreground">Canónico sugerido</dt><dd className="font-medium wrap-anywhere">{pendingAction.item.suggested ? canonicalLabel(pendingAction.item.suggested) : "Sin propuesta"}</dd></div>
        </dl>}
        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => setPendingAction(null)}>Cancelar</Button>
          <Button disabled={!canAct} onClick={applyDecision}>{pendingAction?.decision === "confirm" ? "Confirmar mapeo" : "Separar sugerencia"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

type Row = { key: string; label: string; listing: string; suggested: string; compare?: boolean; mono?: boolean; hint?: string | null }

function Comparison({ item, canAct, canSkip, onDecision, onSkip, onCatalog }: {
  item: CurationItem
  canAct: boolean
  canSkip: boolean
  onDecision: (decision: Decision) => void
  onSkip: () => void
  onCatalog: (mode: CatalogMode) => void
}) {
  const confidence = confidenceOf(item.score, item.manual)
  const { listing, suggested } = item
  const missing = "—"
  const rows: Row[] = [
    { key: "name", label: "Nombre", listing: listing.name, suggested: suggested?.name ?? missing },
    { key: "brand", label: "Marca", listing: listing.brand ?? missing, suggested: suggested?.brand ?? missing, compare: true },
    { key: "content", label: "Contenido", listing: listing.content ?? missing, suggested: suggested?.content ?? missing, compare: true },
    { key: "category", label: "Categoría", listing: categoryLabel(listing.category), suggested: suggested ? categoryLabel(suggested.category) : missing, compare: true, hint: listing.source_category },
    { key: "code", label: "Código", listing: `Tienda ${listing.external_code}`, suggested: suggested ? canonicalCode(suggested) : missing, mono: true },
    { key: "price", label: "Precio", listing: listing.price ? formatArs(Number(listing.price)) : missing, suggested: suggested?.price ? `${formatArs(Number(suggested.price))} (promedio)` : missing, mono: true },
  ]
  const isDifferent = (row: Row) => !!suggested && !!row.compare && row.listing !== row.suggested
  const differences = rows.filter(isDifferent).length

  return <Card id="curation-comparison" className="min-w-0 gap-0 py-0 shadow-xs" aria-labelledby="curation-comparison-title">
    <CardHeader className="gap-2 py-5">
      <CardTitle><h3 id="curation-comparison-title">{suggested ? "¿Es el mismo producto?" : "Sin producto sugerido"}</h3></CardTitle>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">Confianza del emparejamiento:
          <ToneBadge tone={confidence.tone}>{confidence.label}{!item.manual && item.score !== null && ` (${formatScore(item.score)})`}</ToneBadge>
        </span>
        {suggested
          ? <span className="text-xs text-muted-foreground">{differences === 0 ? "Sin diferencias en los campos clave" : `${differences} ${differences === 1 ? "diferencia resaltada" : "diferencias resaltadas"}`}</span>
          : <span className="text-xs text-muted-foreground">No hay un canónico parecido. Elegí uno o creá uno nuevo.</span>}
      </div>
      <p className="sr-only" role="status">Comparando {listing.name}, de {item.store.name}, con {suggested ? canonicalLabel(suggested) : "ningún canónico"}.</p>
    </CardHeader>
    <Table aria-label={`Comparación de ${listing.name} con el canónico sugerido`} className="min-w-[540px] table-fixed">
      <TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableHead className="w-28 pl-5">Campo</TableHead>
        <TableHead className="whitespace-normal">
          <a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Publicación · {item.store.name}<ExternalLinkIcon className="size-3" aria-hidden="true" /></a>
        </TableHead>
        <TableHead className="whitespace-normal pr-5">Canónico sugerido</TableHead>
      </TableRow></TableHeader>
      <TableBody>{rows.map((row) => {
        const different = isDifferent(row)
        return <TableRow key={row.key} className={cn("hover:bg-transparent", different && "bg-amber-500/5 hover:bg-amber-500/5")}>
          <TableCell className="py-4 pl-5 align-top text-muted-foreground">{row.label}</TableCell>
          <TableCell className={cn("py-4 align-top whitespace-normal wrap-anywhere", row.mono && "font-mono text-xs")}>
            {row.listing}
            {row.hint && <span className="block text-xs text-muted-foreground">{row.hint}</span>}
          </TableCell>
          <TableCell className={cn("py-4 pr-5 align-top whitespace-normal wrap-anywhere", row.mono && "font-mono text-xs")}>
            <span className="inline-flex flex-wrap items-center gap-2">{row.suggested}
              {different && <ToneBadge tone="amber">Distinto</ToneBadge>}
            </span>
          </TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
    <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 py-4">
      <Button disabled={!canAct || !suggested} onClick={() => onDecision("confirm")}><CheckIcon data-icon="inline-start" />Confirmar mapeo</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onCatalog("choose")}>Elegir otro canónico</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onCatalog("create")}>Crear canónico nuevo</Button>
      <Button variant="outline" disabled={!canAct || !suggested} onClick={() => onCatalog("merge")}>Unir duplicados</Button>
      <Button variant="outline" disabled={!canAct} onClick={() => onDecision("separate")}>Separar</Button>
      <Button variant="ghost" className="sm:ml-auto" disabled={!canSkip} onClick={onSkip}>Saltar →</Button>
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
