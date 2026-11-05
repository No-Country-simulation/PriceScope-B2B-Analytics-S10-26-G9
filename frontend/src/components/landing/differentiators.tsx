"use client"

import { ArrowRightIcon, CalendarCheckIcon, ClockIcon, PackageMinusIcon, TagIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tone } from "./tones"

const items = [
  { value: "dia", icon: CalendarCheckIcon, title: "Precios del día", text: "Recolección diaria, publicada cada mañana." },
  { value: "promos", icon: TagIcon, title: "Promociones fuera del índice", text: "Calculamos con el precio regular." },
  { value: "reduflacion", icon: PackageMinusIcon, title: "Reduflación detectada", text: "Comparamos por gramo cuando el paquete cambia." },
  { value: "cotizacion", icon: ClockIcon, title: "Cotización con hora exacta", text: "Cada precio con el dólar de su momento." },
]

const stores = [
  { name: "Supermercado Delta", at: "hoy 05:14 · 612 prod." },
  { name: "Hiper Sur", at: "hoy 05:33 · 548 prod." },
  { name: "Mercado Norte", at: "hoy 05:42 · 475 prod." },
]

export function Differentiators() {
  return (
    <Tabs defaultValue="dia" orientation="vertical" className="flex-col gap-6 lg:flex-row">
      <TabsList variant="line" className="w-full gap-1.5 lg:w-[380px] lg:shrink-0">
        {items.map((it) => (
          <TabsTrigger
            key={it.value}
            value={it.value}
            className="group/dif h-auto w-full items-start justify-start gap-3.5 rounded-xl border p-4 text-left whitespace-normal after:hidden data-active:border-border data-active:shadow-sm hover:bg-muted/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground group-data-active/dif:bg-brand group-data-active/dif:text-white">
              <it.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-base font-semibold text-foreground">{it.title}</span>
              <span className="text-sm font-normal text-muted-foreground">{it.text}</span>
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex min-h-[380px] flex-1 items-center justify-center rounded-2xl bg-muted px-6 py-12 sm:px-8">
        <div className="w-full max-w-[460px]">
          <TabsContent value="dia">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Última actualización</CardTitle>
                <CardAction>
                  <Badge variant="outline" className={tone.down}>Al día</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-xs">
                {stores.map((s) => (
                  <span key={s.name} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-mono text-muted-foreground">{s.at}</span>
                  </span>
                ))}
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className="h-5 flex-1 rounded-sm bg-primary" />
                  ))}
                </div>
                <span className="text-muted-foreground">Últimos 7 días con datos completos</span>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promos">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Yerba mate 1 kg</CardTitle>
                <CardDescription>Hiper Sur · 29/10 06:10</CardDescription>
                <CardAction>
                  <Badge variant="outline" className={tone.promo}>Promo 2x1</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2.5">
                <Figure label="Precio publicado" value="$ 4.890" note={<s>$ 5.600</s>} />
                <Figure label="Usado en el índice" value="$ 5.600" note="precio regular" className="border-foreground" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reduflacion">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Café molido</CardTitle>
                <CardDescription>Hiper Sur · detectado el 19/09</CardDescription>
                <CardAction>
                  <Badge variant="outline" className={tone.redu}>Reduflación</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center gap-2.5">
                <Figure label="Antes" value="500 g" note="$ 16,90 / g" className="flex-1" />
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Figure label="Ahora" value="450 g" note="$ 18,78 / g · +11,1 %" className={`flex-1 ${tone.redu}`} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cotizacion">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Captura · Aceite de girasol 1,5 L</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 text-xs">
                <Row label="Precio capturado" value="$ 3.890 · 06:12" />
                <Row label="Cotización blue usada" value="$ 1.515 · 06:00" />
                <Row label="Cotización oficial usada" value="$ 1.452 · 06:00" />
                <Separator />
                <span className="flex justify-between font-medium">
                  <span>Precio en USD (blue)</span>
                  <span className="font-mono font-semibold">US$ 2,57</span>
                </span>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  )
}

function Figure({
  label,
  value,
  note,
  className,
}: {
  label: string
  value: string
  note: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border p-2.5 ${className ?? ""}`}>
      <span className="text-xs opacity-80">{label}</span>
      <span className="font-mono text-lg font-semibold">{value}</span>
      <span className="font-mono text-xs opacity-80">{note}</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  )
}
