"use client"

import * as React from "react"
import Link from "next/link"
import { BellIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { ToneBadge, type Tone } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

import { RULE_KIND_LABEL, type AlertRule } from "./data"

const KIND_TONE: Record<AlertRule["kind"], Tone> = {
  devaluation: "neutral",
  hit: "sky",
}

// UX07 · Alertas, pestaña "Mis reglas": altas, pausas y borrado con
// confirmación. Las reglas todavía son de muestra; el alta entra después.
export function RulesList({
  rules,
  onToggle,
  onDelete,
}: {
  rules: AlertRule[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [pending, setPending] = React.useState<AlertRule | null>(null)

  return (
    <>
      <Card className="gap-0 py-0 shadow-xs">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No tenés reglas activas. Creá una para que te avisemos cuando algo
              suba más que la devaluación.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/user/regla-nueva" />}
            >
              <PlusIcon data-icon="inline-start" />
              Nueva regla
            </Button>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center gap-4 border-b px-5 py-4 last:border-b-0"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <BellIcon className="size-4" />
              </span>

              <div className="flex min-w-0 flex-1 basis-[360px] flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{rule.name}</span>
                  <ToneBadge tone={KIND_TONE[rule.kind]}>
                    {RULE_KIND_LABEL[rule.kind]}
                  </ToneBadge>
                  <ToneBadge tone={rule.active ? "emerald" : "neutral"}>
                    {rule.active ? "Activa" : "Pausada"}
                  </ToneBadge>
                </span>
                <span className="text-sm text-muted-foreground">
                  {rule.phrase}
                </span>
                <span className="text-xs text-muted-foreground">
                  Última vez: {rule.lastFired ?? "nunca"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {rule.active ? "Activa" : "Pausada"}
                </span>
                <Switch
                  checked={rule.active}
                  onCheckedChange={() => onToggle(rule.id)}
                  aria-label={`Activar o pausar la regla ${rule.name}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/user/regla-nueva" />}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPending(rule)}
                  aria-label={`Eliminar la regla ${rule.name}`}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿Eliminar la regla «{pending?.name}»?
            </DialogTitle>
            <DialogDescription>
              Dejarás de recibir estas alertas. Las alertas que ya se dispararon
              quedan en la bandeja. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pending) onDelete(pending.id)
                setPending(null)
              }}
            >
              Eliminar regla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
