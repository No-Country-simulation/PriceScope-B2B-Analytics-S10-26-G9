"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  BellIcon,
  MailIcon,
  PercentIcon,
  ScaleIcon,
  TagIcon,
  TriangleAlertIcon,
} from "lucide-react"
import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const QUOTE = "blue" as const

const productItems = [
  { label: "Todos los productos", value: "*" },
  { label: "Café molido · 500 g", value: "cafe-molido-500g" },
  { label: "Yerba mate · 1 kg", value: "yerba-mate-1kg" },
  { label: "Aceite de girasol · 1,5 L", value: "aceite-girasol-1.5l" },
  { label: "Arroz largo fino · 1 kg", value: "arroz-1kg" },
  { label: "Leche entera · 1 L", value: "leche-entera-1l" },
  { label: "Queso cremoso · 1 kg", value: "queso-cremoso-1kg" },
  { label: "Detergente · 750 ml", value: "detergente-750ml" },
]

const conditionItems = [
  { label: "Suba de precio mayor a", value: "price-spike", icon: <PercentIcon /> },
  { label: "Reduflación (cambio de contenido)", value: "reduflation", icon: <TriangleAlertIcon /> },
  { label: "Nueva promoción", value: "promo", icon: <TagIcon /> },
  { label: "Producto sin precio", value: "out-of-stock", icon: <ScaleIcon /> },
]

const storeItems = [
  { label: "Todas las tiendas", value: "*" },
  { label: "Supermercado Delta", value: "delta" },
  { label: "Hiper Sur", value: "hiper-sur" },
  { label: "Mercado Norte", value: "mercado-norte" },
]

// Pantalla UX08 · Nueva regla. Formulario para crear una regla de alerta.
// Maqueta local: el botón "Crear regla" muestra un toast y no llama al backend.
export function NewRuleScreen() {
  const [product, setProduct] = React.useState("*")
  const [condition, setCondition] = React.useState("price-spike")
  const [threshold, setThreshold] = React.useState("2")
  const [store, setStore] = React.useState("*")
  const [emailNotify, setEmailNotify] = React.useState(true)
  const [pushNotify, setPushNotify] = React.useState(false)

  const needsThreshold = condition === "price-spike"

  const preview = React.useMemo(() => {
    const productName = productItems.find((p) => p.value === product)?.label ?? "Todos los productos"
    const storeName = storeItems.find((s) => s.value === store)?.label ?? "Todas las tiendas"
    const condLabel = conditionItems.find((c) => c.value === condition)?.label ?? ""

    if (condition === "price-spike") {
      return `${condLabel} ${threshold}% en ${productName} (${storeName})`
    }
    return `${condLabel} en ${productName} (${storeName})`
  }, [product, condition, threshold, store])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    toast.success("Regla creada", {
      description: preview,
    })
  }

  return (
    <AppShell section="Seguimiento" title="Nueva regla" quote={QUOTE}>
      <div className="flex w-full max-w-[720px] flex-col gap-6 p-6">
        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <Link
            href="/alertas"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Volver a alertas"
          >
            <ArrowLeftIcon />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-semibold tracking-tight">
              Nueva regla de alerta
            </h1>
            <p className="text-sm text-muted-foreground">
              Definí qué querés vigilar y cuándo avisarte.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Producto */}
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle>¿Qué vigilamos?</CardTitle>
              <CardDescription>
                Elegí un producto o dejá «Todos» para vigilar toda la categoría.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-product">Producto</Label>
                <Select
                  items={productItems}
                  value={product}
                  onValueChange={(v) => v && setProduct(v)}
                >
                  <SelectTrigger id="rule-product" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {productItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-store">Tienda</Label>
                <Select
                  items={storeItems}
                  value={store}
                  onValueChange={(v) => v && setStore(v)}
                >
                  <SelectTrigger id="rule-store" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {storeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Condición */}
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle>¿Cuándo avisamos?</CardTitle>
              <CardDescription>
                La condición que tiene que cumplirse para disparar la alerta.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-condition">Condición</Label>
                <Select
                  items={conditionItems.map((c) => ({
                    label: c.label,
                    value: c.value,
                  }))}
                  value={condition}
                  onValueChange={(v) => v && setCondition(v)}
                >
                  <SelectTrigger id="rule-condition" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {conditionItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          <span className="flex items-center gap-2">
                            <span className="text-muted-foreground">{item.icon}</span>
                            {item.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {needsThreshold && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rule-threshold">Umbral (%)</Label>
                  <Input
                    id="rule-threshold"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="h-9 max-w-[120px] font-mono tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se dispara cuando el precio sube más de este porcentaje en una sola captura.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notificaciones */}
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle>¿Cómo avisarte?</CardTitle>
              <CardDescription>
                Elegí los canales donde querés recibir la alerta.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3",
                  emailNotify && "border-brand bg-brand/5"
                )}
              >
                <span className="flex items-center gap-3">
                  <MailIcon className="size-4 text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Correo electrónico</span>
                    <span className="text-xs text-muted-foreground">
                      A lucia@andinoretail.com
                    </span>
                  </span>
                </span>
                <Switch
                  checked={emailNotify}
                  onCheckedChange={setEmailNotify}
                />
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3",
                  pushNotify && "border-brand bg-brand/5"
                )}
              >
                <span className="flex items-center gap-3">
                  <BellIcon className="size-4 text-muted-foreground" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">Notificación en la plataforma</span>
                    <span className="text-xs text-muted-foreground">
                      Aparece en el panel y en la campana del header
                    </span>
                  </span>
                </span>
                <Switch
                  checked={pushNotify}
                  onCheckedChange={setPushNotify}
                />
              </label>
            </CardContent>
          </Card>

          {/* Vista previa */}
          <Card className="shadow-xs border-brand/30 bg-brand/5">
            <CardHeader>
              <CardTitle className="text-sm">Vista previa de la regla</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{preview}</p>
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/alertas"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Cancelar
            </Link>
            <Button type="submit" size="lg">
              Crear regla
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
