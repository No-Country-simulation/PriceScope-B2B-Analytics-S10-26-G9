import type { Metadata } from "next"
import Link from "next/link"
import {
  BellIcon,
  ChartLineIcon,
  ChartNoAxesColumnIncreasingIcon,
  CircleDollarSignIcon,
  ClockIcon,
  Grid3x3Icon,
  ScaleIcon,
  TagIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Faq } from "@/components/landing/faq"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHeader } from "@/components/landing/landing-header"
import { Team } from "@/components/landing/team"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "PriceScope · Inflación real en pesos y en dólares",
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Marquee />
        <Problem />
        <Features />
        <HowItWorks />
        <Section id="equipo" className="flex flex-col gap-12">
          <SectionHeading
            eyebrow="Equipo"
            title="Las personas detrás de PriceScope."
            lead="Economistas e ingenieros que miden precios todos los días."
            center
          />
          <Team />
        </Section>
        <Section id="faq" className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            eyebrow="Preguntas"
            title="Preguntas frecuentes"
            lead="¿No encontrás lo que buscás? Lo vemos en la llamada."
          />
          <Faq />
        </Section>
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  )
}

/* ------------------------------------------------------------------ layout */

function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16">
      <div className={cn("mx-auto max-w-[1240px] border-x border-b px-5 py-18 sm:px-8 sm:py-24", className)}>
        {children}
      </div>
    </section>
  )
}

function SectionHeading({
  eyebrow,
  title,
  lead,
  center,
}: {
  eyebrow: string
  title: string
  lead?: string
  center?: boolean
}) {
  return (
    <div className={cn("flex max-w-[640px] flex-col gap-3.5", center && "mx-auto items-center text-center")}>
      <span className="text-xs font-medium text-muted-foreground">{eyebrow}</span>
      <h2 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">{title}</h2>
      {lead && <p className="text-base leading-relaxed text-muted-foreground">{lead}</p>}
    </div>
  )
}

function CallButton({ className }: { className?: string }) {
  return (
    <Button size="lg" className={cn("h-10 px-4", className)} nativeButton={false} render={<Link href="/demo" />}>
      Agendar una llamada
    </Button>
  )
}

function Icon({ icon: I }: { icon: LucideIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80">
      <I className="size-[18px]" aria-hidden="true" />
    </span>
  )
}

/* -------------------------------------------------------------------- hero */

const kpis = [
  { label: "Inflación en pesos", value: "+18,4 %", note: "últimos 180 días" },
  { label: "Dólar blue", value: "+14,8 %", note: "$ 1.320 → $ 1.515", mono: true },
  { label: "Inflación en dólares", value: "+3,1 %", note: "los precios le ganan al dólar", alert: true },
]

function Hero() {
  return (
    <section id="inicio">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-6.5 border-x px-5 pt-20 text-center sm:px-8 sm:pt-26">
        <span className="inline-flex h-7.5 items-center gap-2 rounded-full border px-3 text-xs text-foreground/80">
          <span className="size-2 rounded-full bg-success-fill" aria-hidden="true" />
          Precios actualizados todos los días
        </span>
        <h1 className="max-w-[840px] text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Inflación real en pesos y en dólares, todos los días.
        </h1>
        <p className="max-w-[620px] text-base leading-relaxed text-pretty text-muted-foreground">
          PriceScope mide los precios de las tiendas online que elegís, limpia promociones y reduflación, y los cruza
          con el dólar oficial y blue. Sin planillas ni carga manual.
        </p>
        <CallButton />

        <div
          role="img"
          aria-label="Vista previa: inflación en pesos contra dólar blue, últimos 180 días, datos de ejemplo"
          className="-mb-px mt-10 w-full max-w-[1000px] overflow-hidden rounded-t-[14px] border text-left shadow-[0_8px_30px_rgba(9,9,11,.06)]"
        >
          <div className="grid border-b sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col gap-1 border-t px-6 py-5.5 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <span className="font-mono text-2xl font-medium tracking-tight tabular-nums">{k.value}</span>
                <span className={cn("text-xs", k.alert ? "text-red-700" : "text-muted-foreground", k.mono && "font-mono")}>
                  {k.note}
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 pt-5 pb-6">
            <div className="mb-3 flex gap-4.5 text-xs text-foreground/70">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-2.5 bg-primary" />
                Precios (ARS)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-2.5 bg-zinc-400" />
                Dólar blue
              </span>
            </div>
            <svg viewBox="0 0 600 170" width="100%" height="200" preserveAspectRatio="none" aria-hidden="true">
              {[40, 85, 130].map((y) => (
                <line key={y} x1="0" y1={y} x2="600" y2={y} className="stroke-muted" />
              ))}
              <path
                d="M0,160 L50,152 L100,146 L150,135 L200,128 L250,117 L300,108 L350,96 L400,84 L450,72 L500,58 L550,45 L600,32 L600,170 L0,170 Z"
                className="fill-muted"
              />
              <path
                d="M0,160 L50,158 L100,150 L150,148 L200,140 L250,138 L300,126 L350,121 L400,112 L450,106 L500,98 L550,90 L600,84"
                fill="none"
                className="stroke-zinc-400"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M0,160 L50,152 L100,146 L150,135 L200,128 L250,117 L300,108 L350,96 L400,84 L450,72 L500,58 L550,45 L600,32"
                fill="none"
                className="stroke-primary"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- marquee */

const measured: [LucideIcon, string][] = [
  [TrendingUpIcon, "Inflación ARS"],
  [CircleDollarSignIcon, "Inflación USD"],
  [ChartLineIcon, "Devaluación"],
  [ChartNoAxesColumnIncreasingIcon, "Picos por categoría"],
  [Grid3x3Icon, "Spread entre tiendas"],
  [TriangleAlertIcon, "Reduflación"],
  [TagIcon, "Promociones"],
  [ClockIcon, "Cotización con hora"],
]

function Marquee() {
  return (
    <section aria-label="Qué medimos">
      <div className="group mx-auto max-w-[1240px] overflow-hidden border">
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {/* La lista va dos veces para que la cinta dé la vuelta sin salto. */}
          {[false, true].map((copy) => (
            <ul key={String(copy)} aria-hidden={copy || undefined} className="flex">
              {measured.map(([I, label]) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 border-r px-10 py-5 text-sm whitespace-nowrap text-foreground/80"
                >
                  <I className="size-[18px]" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- problem */

function Rows({ items }: { items: { lead: React.ReactNode; title: string; text: string }[] }) {
  return (
    <ul>
      {items.map((it) => (
        <li key={it.title} className="flex items-start gap-3.5 border-t py-4.5 first:border-t-0 first:pt-0">
          {it.lead}
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-medium">{it.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{it.text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Problem() {
  return (
    <Section id="problema" className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <SectionHeading
        eyebrow="El problema"
        title="Medir precios a mano ya no alcanza."
        lead="En un mercado con el dólar en movimiento, un dato de hace tres días ya es viejo."
      />
      <Rows
        items={[
          {
            lead: <Icon icon={ClockIcon} />,
            title: "Días de atraso",
            text: "Relevar 15 tiendas dos veces por semana deja el dato desactualizado.",
          },
          {
            lead: <Icon icon={TriangleAlertIcon} />,
            title: "Errores de tipeo",
            text: "Pasar miles de precios a una planilla multiplica los errores.",
          },
          {
            lead: <Icon icon={TagIcon} />,
            title: "Ofertas que confunden",
            text: "Una promo temporal se registra como baja de precio y distorsiona el índice.",
          },
        ]}
      />
    </Section>
  )
}

/* ---------------------------------------------------------------- features */

const features: [LucideIcon, string, string][] = [
  [TrendingUpIcon, "Inflación en dos monedas", "La variación acumulada en pesos y en dólares, lado a lado."],
  [ClockIcon, "Cotización del momento", "Cada precio se convierte con el dólar oficial o blue vigente a esa hora."],
  [TagIcon, "Promociones aparte", "Detectamos el precio tachado y lo dejamos fuera del índice."],
  [ScaleIcon, "Reduflación", "Si el envase achica, calculamos el precio por unidad de medida."],
  [Grid3x3Icon, "Matriz de precios", "Compará el mismo producto entre tiendas y encontrá el spread."],
  [BellIcon, "Alertas", "Te avisamos cuando una categoría o producto supera el umbral que definas."],
]

function Features() {
  return (
    <Section id="funcionalidades" className="flex flex-col gap-12">
      <SectionHeading eyebrow="Funcionalidades" title="Todo lo que necesitás para ajustar precios." center />
      <div className="grid overflow-hidden rounded-[14px] border sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([I, title, text]) => (
          // Bordes internos de la grilla: cada celda dibuja su línea superior e izquierda.
          <div key={title} className="-mt-px -ml-px flex flex-col gap-3 border-t border-l px-7 py-8">
            <Icon icon={I} />
            <h3 className="text-base font-medium">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------ how it works */

const steps = [
  { title: "Elegimos las tiendas juntos", text: "En la llamada definimos los comercios y categorías que querés seguir." },
  { title: "Recolectamos todos los días", text: "Capturamos precios y cotizaciones de forma automática, con fecha y hora." },
  { title: "Mirás la inflación real", text: "Entrás a tu tablero y ves precios en pesos y en dólares, con alertas." },
]

function HowItWorks() {
  return (
    <Section id="como" className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col items-start gap-6">
        <SectionHeading
          eyebrow="Cómo funciona"
          title="De la llamada a tu tablero en tres pasos."
          lead="Nosotros nos ocupamos de la recolección. Vos mirás los datos."
        />
        <CallButton />
      </div>
      <Rows
        items={steps.map((s, i) => ({
          ...s,
          lead: (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-foreground/80">
              {i + 1}
            </span>
          ),
        }))}
      />
    </Section>
  )
}

/* --------------------------------------------------------- closing + footer */

function ClosingCta() {
  return (
    <Section className="flex flex-col items-center gap-5.5 text-center sm:py-26">
      <h2 className="max-w-[640px] text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
        Dejá de medir a mano. Empezá a ver la inflación real.
      </h2>
      <p className="max-w-[520px] text-base leading-relaxed text-muted-foreground">
        Una llamada de 30 minutos para conocer tu caso y armar tu tablero.
      </p>
      <CallButton />
    </Section>
  )
}
