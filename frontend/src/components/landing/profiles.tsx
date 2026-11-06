"use client"

import { CheckIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const profiles = [
  {
    value: "minoristas",
    tab: "Cadenas minoristas",
    title: "Cadenas minoristas",
    desc: "Ajustá tus listas de precios mirando a la competencia y al dólar, con datos de hoy y no de la semana pasada.",
    items: [
      "Matriz con tus competidores, producto por producto",
      "Alertas en hitos como CyberWeek o Hot Sale",
      "Detección de reduflación en la competencia",
    ],
    caseTitle: "Tu competidor subió el café 12,4 % en 30 días, 8,3 p.p. por encima del blue.",
    kpis: [
      ["Tu precio", "$ 8.450"],
      ["Competidor más caro", "$ 9.300"],
    ],
    action: "Decisión: hay margen para subir sin quedar más caro que el mercado.",
  },
  {
    value: "fondos",
    tab: "Fondos de inversión",
    title: "Fondos de inversión",
    desc: "Medí la inflación en moneda dura y anticipá cuándo los precios le ganan a la devaluación para cubrir tus posiciones.",
    items: ["Inflación en USD oficial y blue", "Brecha precios vs dólar por categoría", "Series diarias con la cotización usada"],
    caseTitle: "Electro subió 2 p.p. menos que el blue en 90 días.",
    kpis: [
      ["Electro en ARS", "+12,1 %"],
      ["Dólar blue", "+14,8 %"],
    ],
    action: "Lectura: los durables se abarataron en dólares en el período.",
  },
  {
    value: "medios",
    tab: "Medios",
    title: "Medios de comunicación",
    desc: "Informá con datos diarios y trazables: cada precio con su fecha, su tienda y su cotización.",
    items: ["Historial día por día por producto", "Picos por categoría para detectar noticias", "Exportación de los datos filtrados"],
    caseTitle: "Indumentaria tuvo un salto de 6,8 % en una semana.",
    kpis: [
      ["Pico semanal", "+6,8 %"],
      ["Productos afectados", "42"],
    ],
    action: "Nota: con fuente, fecha y tiendas para citar.",
  },
]

export function Profiles() {
  return (
    <Tabs defaultValue="minoristas" className="items-center gap-8">
      <TabsList className="h-10! flex-wrap">
        {profiles.map((p) => (
          <TabsTrigger key={p.value} value={p.value} className="px-4">
            {p.tab}
          </TabsTrigger>
        ))}
      </TabsList>

      {profiles.map((p) => (
        <TabsContent key={p.value} value={p.value} className="w-full">
          <Card className="flex-col gap-0 overflow-hidden py-0 md:flex-row">
            <div className="flex flex-1 flex-col gap-4 p-6 sm:p-9">
              <h3 className="text-2xl font-semibold tracking-tight">{p.title}</h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{p.desc}</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center gap-2">
                    <CheckIcon className="size-4 shrink-0 text-green-700" aria-hidden="true" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-1 items-center justify-center border-t bg-muted/50 p-6 sm:p-9 md:border-t-0 md:border-l">
              <Card size="sm" className="w-full max-w-[420px]">
                <CardHeader>
                  <CardDescription className="text-xs font-semibold tracking-wider uppercase">Ejemplo de uso</CardDescription>
                  <CardTitle className="text-base leading-snug">{p.caseTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2.5">
                  {p.kpis.map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5 rounded-lg border p-2.5">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="font-mono text-lg font-semibold">{v}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">{p.action}</CardFooter>
              </Card>
            </div>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  )
}
