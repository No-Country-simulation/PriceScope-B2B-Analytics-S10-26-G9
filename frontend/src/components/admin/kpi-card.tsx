import * as React from "react"

import { IconTile, type Tone } from "@/components/admin/tone"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

// KPI card shared by the client screens (dashboard, matriz, alertas): label,
// big number, a soft icon tile and a one-line hint.
export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
  mono = false,
}: {
  label: string
  value: string
  hint: React.ReactNode
  tone: Tone
  icon: React.ReactNode
  mono?: boolean
}) {
  return (
    <Card className="@container/card shadow-xs">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
            mono && "font-mono"
          )}
        >
          {value}
        </CardTitle>
        <CardAction>
          <IconTile tone={tone}>{icon}</IconTile>
        </CardAction>
        <p className="col-span-full pt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      </CardHeader>
    </Card>
  )
}
