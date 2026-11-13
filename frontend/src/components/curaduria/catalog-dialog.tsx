"use client"

import * as React from "react"
import { CircleAlertIcon } from "lucide-react"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { query, type CanonicalDraft, type CanonicalProduct, type CurationItem } from "@/lib/api"
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/categories"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

import { canonicalCode, canonicalLabel, categoryLabel } from "./labels"

export type CatalogMode = "choose" | "create" | "merge"
export type CatalogOperation =
  | { type: "choose"; canonicalId: string }
  | { type: "create"; product: CanonicalDraft }
  | { type: "merge"; sourceId: string }

const COPY = {
  choose: { title: "Elegir otro canónico", description: "Buscá el producto correspondiente. El mapeo quedará pendiente de confirmar.", action: "Usar como propuesta" },
  create: { title: "Crear canónico nuevo", description: "Revisá los datos del nuevo producto. Después podrás confirmar el mapeo.", action: "Crear y proponer" },
  merge: { title: "Unir duplicados", description: "Se conserva el principal. Las publicaciones, propuestas y reglas de alerta del duplicado pasarán a él, y su EAN seguirá apuntando al principal.", action: "Unir duplicados" },
}
const SEARCH_DELAY_MS = 300
const NO_CATEGORY = "none"

const optional = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`)
const draftSchema = z.object({
  name: z.string().trim().min(2, "Ingresá al menos 2 caracteres.").max(255),
  brand: optional(120),
  content: optional(40),
  category: z.string(),
  ean: z.string().trim().regex(/^(\d{8,14})?$/, "El EAN tiene que tener entre 8 y 14 dígitos."),
})
type Draft = z.infer<typeof draftSchema>
const TEXT_FIELDS: { key: Exclude<keyof Draft, "category">; label: string; max: number }[] = [
  { key: "name", label: "Nombre", max: 255 },
  { key: "brand", label: "Marca", max: 120 },
  { key: "content", label: "Contenido o formato", max: 40 },
  { key: "ean", label: "EAN (opcional)", max: 14 },
]
const CATEGORY_ITEMS = [
  { value: NO_CATEGORY, label: "Sin categoría" },
  ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
]

export function CatalogDialog({ mode, item, busy, onClose, onApply }: {
  mode: CatalogMode
  item: CurationItem
  busy: boolean
  onClose: () => void
  onApply: (operation: CatalogOperation) => Promise<string | null>
}) {
  const [selected, setSelected] = React.useState<CanonicalProduct | null>(null)
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(() => ({
    name: item.listing.name,
    brand: item.listing.brand ?? "",
    content: item.listing.content ?? "",
    category: item.listing.category ?? NO_CATEGORY,
    ean: "",
  }))
  const [errors, setErrors] = React.useState<Partial<Record<keyof Draft, string>>>({})
  const [error, setError] = React.useState<string | null>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const copy = COPY[mode]

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    let operation: CatalogOperation
    if (mode === "create") {
      const parsed = draftSchema.safeParse(draft)
      if (!parsed.success) {
        const fields = parsed.error.flatten().fieldErrors
        setErrors(Object.fromEntries(TEXT_FIELDS.map(({ key }) => [key, fields[key]?.[0]])))
        return
      }
      const { name, brand, content, category, ean } = parsed.data
      operation = { type: "create", product: {
        name, brand: brand || null, content: content || null, ean: ean || null,
        category: category === NO_CATEGORY ? null : category as ProductCategory,
      } }
    } else {
      if (!selected || (mode === "merge" && !acknowledged)) return
      operation = mode === "choose" ? { type: "choose", canonicalId: selected.id } : { type: "merge", sourceId: selected.id }
    }
    setError(await onApply(operation))
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent initialFocus={cancelRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
      <p className="text-sm wrap-anywhere"><span className="text-muted-foreground">Publicación · {item.store.name}: </span>{item.listing.name}</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {mode === "create" ? <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map(({ key, label, max }) => <Field key={key} data-invalid={!!errors[key]} className={key === "name" ? "sm:col-span-2" : undefined}>
            <FieldLabel htmlFor={`canonical-${key}`}>{label}</FieldLabel>
            <Input id={`canonical-${key}`} value={draft[key]} required={key === "name"} maxLength={max}
              inputMode={key === "ean" ? "numeric" : undefined}
              aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `canonical-${key}-error` : undefined}
              onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setErrors((current) => ({ ...current, [key]: undefined })); setError(null) }} />
            {errors[key] && <FieldError id={`canonical-${key}-error`}>{errors[key]}</FieldError>}
          </Field>)}
          <Field>
            <FieldLabel htmlFor="canonical-category">Categoría</FieldLabel>
            <Select items={CATEGORY_ITEMS} value={draft.category}
              onValueChange={(next) => { if (next) setDraft((current) => ({ ...current, category: next })) }}>
              <SelectTrigger id="canonical-category" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                {CATEGORY_ITEMS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
          </Field>
        </div> : <>
          {mode === "merge" && item.suggested && <ProductPreview product={item.suggested} label="Principal: se conserva" />}
          <CatalogPicker exclude={item.suggested?.id} value={selected}
            onChange={(product) => { setSelected(product); setAcknowledged(false); setError(null) }} />
          {selected && <ProductPreview product={selected} label={mode === "merge" ? "Duplicado: se unirá al principal y se borrará" : "Nueva propuesta"} />}
          {mode === "merge" && <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox id="merge-confirmation" checked={acknowledged} disabled={!selected} onCheckedChange={setAcknowledged} />
            <Label htmlFor="merge-confirmation" className="text-sm leading-relaxed">Revisé ambos canónicos y confirmo que representan el mismo producto.</Label>
          </div>}
        </>}
        {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy || (mode !== "create" && (!selected || (mode === "merge" && !acknowledged)))}>{copy.action}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

function CatalogPicker({ exclude, value, onChange }: {
  exclude: string | undefined
  value: CanonicalProduct | null
  onChange: (product: CanonicalProduct | null) => void
}) {
  const [text, setText] = React.useState("")
  const [search, setSearch] = React.useState("")
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSearch(text.trim()), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [text])
  const results = useApi<CanonicalProduct[]>(`/admin/curation/canonical${query({ q: search, exclude, limit: 20 })}`)
  const items = results.data ?? []

  return <div className="flex flex-col gap-2">
    <Label htmlFor="canonical-search">Buscar canónico</Label>
    <Input id="canonical-search" type="search" placeholder="Nombre, marca o EAN" value={text}
      onChange={(event) => { setText(event.target.value); onChange(null) }} />
    <p className="text-xs text-muted-foreground" role="status">
      {results.error ? "No pudimos buscar en el catálogo." : results.data ? `${items.length} resultados${items.length === 20 ? " (refiná la búsqueda para ver más)" : ""}` : "Buscando…"}
    </p>
    <ul className={cn("max-h-52 divide-y overflow-y-auto rounded-lg border", results.loading && results.data && "opacity-60")}>
      {!results.data && !results.error && [0, 1, 2].map((n) => <li key={n} className="p-3"><Skeleton className="h-8" /></li>)}
      {items.map((product) => <li key={product.id}>
        <button type="button" aria-pressed={value?.id === product.id} onClick={() => onChange(product)}
          className={cn("flex w-full flex-col gap-1 px-3 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", value?.id === product.id && "bg-muted")}>
          <span className="font-medium wrap-anywhere">{canonicalLabel(product)}</span>
          <span className="text-xs wrap-anywhere text-muted-foreground">{[product.brand, canonicalCode(product)].filter(Boolean).join(" · ")}</span>
        </button>
      </li>)}
      {results.data && !items.length && <li className="p-4 text-sm text-muted-foreground">No hay canónicos con esa búsqueda.</li>}
    </ul>
  </div>
}

function ProductPreview({ product, label }: { product: CanonicalProduct; label: string }) {
  return <div className="space-y-1 rounded-lg border bg-muted/20 p-3 text-sm">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium wrap-anywhere">{canonicalLabel(product)}</p>
    <p className="wrap-anywhere">{[product.brand, categoryLabel(product.category)].filter(Boolean).join(" · ")}</p>
    <p className="font-mono text-xs wrap-anywhere text-muted-foreground">{canonicalCode(product)}</p>
  </div>
}
