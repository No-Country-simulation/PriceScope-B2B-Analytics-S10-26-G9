"use client"

import * as React from "react"
import { ChevronRightIcon, InboxIcon } from "lucide-react"

import { ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  DEFAULT_PERIOD,
  LOG_ENTRIES,
  LOG_KIND_LABEL,
  PERIOD_LABEL,
  SEVERITY_TONE,
  STORES,
  type LogEntry,
} from "./data"

const kindItems = [
  { label: "Todos", value: "all" },
  ...Object.entries(LOG_KIND_LABEL).map(([value, label]) => ({ label, value })),
]

const storeItems = [
  { label: "Todas", value: "all" },
  ...STORES.map((store) => ({ label: store, value: store })),
]

const periodItems = ["24", "72", "168"].map((value) => ({
  label: PERIOD_LABEL[value],
  value,
}))

// UX10 · Operación: log de errores de los scrapers, filtrable por tienda, tipo
// y período. La fila expandido muestra la salida cruda del worker.
export function ErrorLog({
  entries = LOG_ENTRIES,
  store,
  onStoreChange,
}: {
  entries?: LogEntry[]
  store: string
  onStoreChange: (store: string) => void
}) {
  const [kind, setKind] = React.useState("all")
  const [period, setPeriod] = React.useState(DEFAULT_PERIOD)
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const filtered = entries.filter(
    (entry) =>
      (store === "all" || entry.store === store) &&
      (kind === "all" || entry.kind === kind) &&
      entry.age <= Number(period)
  )

  const hasFilters =
    store !== "all" || kind !== "all" || period !== DEFAULT_PERIOD

  function clearFilters() {
    onStoreChange("all")
    setKind("all")
    setPeriod(DEFAULT_PERIOD)
  }

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">Log de errores</h3>
          <p className="text-xs text-muted-foreground">
            {PERIOD_LABEL[period]} · {filtered.length}{" "}
            {filtered.length === 1 ? "error" : "errores"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            id="operacion-store"
            prefix="Tienda"
            items={storeItems}
            value={store}
            onChange={(value) => onStoreChange(value)}
          />
          <FilterSelect
            id="operacion-kind"
            prefix="Tipo"
            items={kindItems}
            value={kind}
            onChange={setKind}
          />
          <FilterSelect
            id="operacion-period"
            prefix="Período"
            items={periodItems}
            value={period}
            onChange={setPeriod}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <Table aria-label="Log de errores" className="min-w-[820px]">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-10 pl-4">
              <span className="sr-only">Detalle</span>
            </TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tienda</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="pr-4">Mensaje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <InboxIcon className="size-6" />
                  {entries.length === 0 ? (
                    <p>No hubo errores en este período.</p>
                  ) : (
                    <>
                      <p>Ningún error coincide con los filtros.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Limpiar filtros
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((entry) => {
              const open = expanded === entry.id
              const detailId = `operacion-detail-${entry.id}`
              return (
                <React.Fragment key={entry.id}>
                  <TableRow data-state={open ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setExpanded(open ? null : entry.id)
                        }
                        aria-expanded={open}
                        aria-controls={detailId}
                        aria-label={
                          open ? "Ocultar detalle" : `Ver detalle de ${entry.message}`
                        }
                      >
                        <ChevronRightIcon
                          className={cn("transition-transform", open && "rotate-90")}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {entry.date}
                    </TableCell>
                    <TableCell>{entry.store}</TableCell>
                    <TableCell>
                      <ToneBadge tone={SEVERITY_TONE[entry.severity]}>
                        {LOG_KIND_LABEL[entry.kind]}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="pr-4 text-muted-foreground">
                      {entry.message}
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow id={detailId} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={4} className="py-3 pr-4">
                        <pre className="ml-6 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                          {entry.detail}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </Card>
  )
}

function FilterSelect({
  id,
  prefix,
  items,
  value,
  onChange,
}: {
  id: string
  prefix: string
  items: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {prefix}
      </label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => next && onChange(next)}
      >
        <SelectTrigger id={id} className="w-auto">
          <span className="text-muted-foreground">{prefix}:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  )
}
