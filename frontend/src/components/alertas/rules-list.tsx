"use client"

import * as React from "react"
import Link from "next/link"
import {
  BellIcon,
  BellOffIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { IconTile, ToneBadge } from "@/components/admin/tone"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"

import type { AlertRule } from "@/lib/api"
import { formatDateTime } from "@/lib/format"

const RULE_KIND_LABEL: Record<AlertRule["kind"], string> = {
  devaluation: "Sube más que la devaluación",
  milestone: "Hito",
}

// UX07 · Alertas, pestaña "Mis reglas": pausar/activar, editar y borrar con
// confirmación.
export function RulesList({
  rules,
  onToggle,
  onDelete,
}: {
  rules: AlertRule[]
  onToggle: (rule: AlertRule) => void
  onDelete: (rule: AlertRule) => void
}) {
  const [pending, setPending] = React.useState<AlertRule | null>(null)

  return (
    <>
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="border-b py-(--card-spacing)">
          <CardTitle>
            <h3>Mis reglas</h3>
          </CardTitle>
          <CardDescription>
            Pausá una regla para dejar de recibir sus alertas sin perderla.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/user/regla-nueva" />}
            >
              <PlusIcon data-icon="inline-start" />
              Nueva regla
            </Button>
          </CardAction>
        </CardHeader>

        {rules.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
            <BellOffIcon className="size-6" />
            <p>
              No tenés reglas. Creá una para que te avisemos cuando algo suba
              más que la devaluación.
            </p>
          </div>
        ) : (
          <ItemGroup className="gap-0 p-2">
            {rules.map((rule, index) => (
              <React.Fragment key={rule.id}>
                {index > 0 && <ItemSeparator className="my-1" />}
                <Item className={rule.active ? undefined : "opacity-70"}>
                  <ItemMedia>
                    <IconTile tone={rule.active ? "brand" : "neutral"}>
                      {rule.active ? <BellIcon /> : <BellOffIcon />}
                    </IconTile>
                  </ItemMedia>
                  <ItemContent className="min-w-0 basis-72">
                    <ItemTitle className="flex-wrap">
                      {rule.name}
                      <ToneBadge tone={rule.kind === "milestone" ? "sky" : "neutral"}>
                        {RULE_KIND_LABEL[rule.kind]}
                      </ToneBadge>
                    </ItemTitle>
                    <ItemDescription>{rule.phrase}</ItemDescription>
                    <span className="text-xs text-muted-foreground">
                      Última vez:{" "}
                      {rule.last_fired_at ? formatDateTime(rule.last_fired_at) : "nunca"}
                    </span>
                  </ItemContent>
                  <ItemActions>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-14 text-right">
                        {rule.active ? "Activa" : "Pausada"}
                      </span>
                      <Switch
                        checked={rule.active}
                        onCheckedChange={() => onToggle(rule)}
                        aria-label={`Activar o pausar la regla ${rule.name}`}
                      />
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                        aria-label={`Más acciones para ${rule.name}`}
                      >
                        <EllipsisVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem
                          render={<Link href={`/user/regla-nueva?rule=${rule.id}`} />}
                        >
                          <PencilIcon />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPending(rule)}
                        >
                          <Trash2Icon />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ItemActions>
                </Item>
              </React.Fragment>
            ))}
          </ItemGroup>
        )}
      </Card>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar la regla «{pending?.name}»?</DialogTitle>
            <DialogDescription>
              Dejarás de recibir estas alertas y se borran de la bandeja
              las que ya disparó. Esta acción no se puede deshacer. Si solo
              querés dejar de recibirlas, pausala.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending) onDelete(pending)
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
