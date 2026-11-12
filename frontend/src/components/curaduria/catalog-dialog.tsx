"use client"

import * as React from "react"
import { CircleAlertIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { ProductSnapshot, ReviewItem } from "./data"
import { canonicalDraftSchema, type CanonicalDraft, type CatalogOperation } from "./review-state"

export type CatalogMode = "choose" | "create" | "merge"
const COPY = {
  choose: { title: "Elegir otro canónico", description: "Buscá el producto correspondiente. El mapeo quedará pendiente de confirmar.", action: "Usar como propuesta" },
  create: { title: "Crear canónico nuevo", description: "Revisá los datos del nuevo producto. Después podrás confirmar el mapeo.", action: "Crear y proponer" },
  merge: { title: "Unir duplicados", description: "Se conserva el principal. Las propuestas y vinculaciones del duplicado pasarán a él.", action: "Unir duplicados" },
}
const FIELDS: { key: keyof CanonicalDraft; label: string; max: number }[] = [
  { key: "name", label: "Nombre", max: 255 }, { key: "brand", label: "Marca", max: 120 },
  { key: "content", label: "Contenido o formato", max: 120 }, { key: "category", label: "Categoría", max: 160 },
  { key: "code", label: "Código (EAN, SKU o modelo)", max: 120 },
]

export function CatalogDialog({ mode, item, catalog, onClose, onApply }: {
  mode: CatalogMode; item: ReviewItem; catalog: ProductSnapshot[]
  onClose: () => void; onApply: (operation: CatalogOperation) => string | null
}) {
  const [selectedCode, setSelectedCode] = React.useState("")
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [draft, setDraft] = React.useState<CanonicalDraft>(() => ({
    name: item.listing.name, brand: item.listing.brand, content: item.listing.content,
    category: item.listing.category.split(">")[0].trim(), code: item.listing.code,
  }))
  const [errors, setErrors] = React.useState<Partial<Record<keyof CanonicalDraft, string>>>({})
  const [error, setError] = React.useState<string | null>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const copy = COPY[mode]
  const candidates = catalog.filter((product) => product.code !== item.suggested.code)
  const selected = candidates.find((product) => product.code === selectedCode)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    let operation: CatalogOperation
    if (mode === "create") {
      const parsed = canonicalDraftSchema.safeParse(draft)
      if (!parsed.success) {
        const fields = parsed.error.flatten().fieldErrors
        setErrors(Object.fromEntries(FIELDS.map(({ key }) => [key, fields[key]?.[0]])))
        return
      }
      operation = { type: "create", reviewId: item.id, product: parsed.data }
    } else {
      if (!selected || (mode === "merge" && !acknowledged)) return
      operation = mode === "choose" ? { type: "choose", reviewId: item.id, targetCode: selected.code }
        : { type: "merge", sourceCode: selected.code, targetCode: item.suggested.code }
    }
    setError(onApply(operation))
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent initialFocus={cancelRef} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
      <p className="text-sm wrap-anywhere"><span className="text-muted-foreground">Publicación · {item.store}: </span>{item.listing.name}</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {mode === "create" ? <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, max }) => <Field key={key} data-invalid={!!errors[key]} className={key === "name" ? "sm:col-span-2" : undefined}>
            <FieldLabel htmlFor={`canonical-${key}`}>{label}</FieldLabel>
            <Input id={`canonical-${key}`} value={draft[key]} required maxLength={max}
              aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `canonical-${key}-error` : undefined}
              onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); setErrors((current) => ({ ...current, [key]: undefined })); setError(null) }} />
            {errors[key] && <FieldError id={`canonical-${key}-error`}>{errors[key]}</FieldError>}
          </Field>)}
        </div> : <>
          {mode === "merge" && <ProductPreview product={item.suggested} label="Principal: se conserva" />}
          <CatalogPicker items={candidates} value={selectedCode} onChange={(code) => { setSelectedCode(code); setAcknowledged(false); setError(null) }} />
          {selected && <ProductPreview product={selected} label={mode === "merge" ? "Duplicado: se unirá al principal" : "Nueva propuesta"} />}
          {mode === "merge" && <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox id="merge-confirmation" checked={acknowledged} disabled={!selected} onCheckedChange={setAcknowledged} />
            <Label htmlFor="merge-confirmation" className="text-sm leading-relaxed">Revisé ambos canónicos y confirmo que representan el mismo producto.</Label>
          </div>}
        </>}
        {error && <Alert variant="destructive"><CircleAlertIcon /><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mode !== "create" && (!selected || (mode === "merge" && !acknowledged))}>{copy.action}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

function CatalogPicker({ items, value, onChange }: { items: ProductSnapshot[]; value: string; onChange: (code: string) => void }) {
  const [query, setQuery] = React.useState("")
  const needle = query.trim().toLocaleLowerCase("es")
  const filtered = items.filter((product) => [product.name, product.brand, product.code, product.content]
    .some((text) => text.toLocaleLowerCase("es").includes(needle)))
  return <div className="flex flex-col gap-2">
    <Label htmlFor="canonical-search">Buscar canónico</Label>
    <Input id="canonical-search" type="search" placeholder="Nombre, marca, contenido o código" value={query}
      onChange={(event) => { setQuery(event.target.value); onChange("") }} />
    <p className="text-xs text-muted-foreground" role="status">{filtered.length} resultados</p>
    <ul className="max-h-52 divide-y overflow-y-auto rounded-lg border">
      {filtered.map((product) => <li key={product.code}>
        <button type="button" aria-pressed={value === product.code} onClick={() => onChange(product.code)}
          className={cn("flex w-full flex-col gap-1 px-3 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", value === product.code && "bg-muted")}>
          <span className="font-medium wrap-anywhere">{product.name} · {product.content}</span>
          <span className="text-xs wrap-anywhere text-muted-foreground">{product.brand} · {product.code}</span>
        </button>
      </li>)}
      {!filtered.length && <li className="p-4 text-sm text-muted-foreground">No hay canónicos con esa búsqueda.</li>}
    </ul>
  </div>
}

function ProductPreview({ product, label }: { product: ProductSnapshot; label: string }) {
  return <div className="space-y-1 rounded-lg border bg-muted/20 p-3 text-sm">
    <p className="text-xs text-muted-foreground">{label}</p><p className="font-medium wrap-anywhere">{product.name} · {product.content}</p>
    <p className="wrap-anywhere">{product.brand} · {product.category}</p><p className="font-mono text-xs wrap-anywhere text-muted-foreground">{product.code}</p>
  </div>
}
