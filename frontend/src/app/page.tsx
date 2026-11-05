import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  BellIcon,
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
import { PalmSilhouette } from "@/components/landing/palm-silhouette"
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
        <LogoMarquee label="Tiendas que monitoreamos" items={stores} dark />
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
        <LogoMarquee label="Tecnologías con las que construimos PriceScope" items={stack} />
        <Section id="faq" tinted className="grid gap-10 lg:grid-cols-2 lg:gap-16">
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

function Section({ id, className, tinted, children }: { id?: string; className?: string; tinted?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16">
      <div className={cn("mx-auto max-w-[1240px] border-x border-b px-5 py-18 sm:px-8 sm:py-24", tinted && "bg-neutral-50 dark:bg-muted/40", className)}>
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

function Hero() {
  return (
    <section id="inicio">
      <div className="relative isolate mx-auto flex max-w-[1240px] flex-col items-center gap-6.5 overflow-hidden border-x px-5 pt-20 text-center sm:px-8 sm:pt-26">
        {/* El PNG trae una palmera cortada en su borde izquierdo: ese borde va siempre contra el costado de la sección. */}
        <PalmSilhouette className="-right-56 -z-10 h-[720px] -scale-x-100 opacity-20" />
        <PalmSilhouette className="-left-44 -z-10 h-[580px] opacity-15" />
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

        <div className="-mb-px mt-10 w-full max-w-[1000px] overflow-hidden rounded-t-[14px] border bg-background shadow-[0_8px_30px_rgba(9,9,11,.06)]">
          {/* Captura de la matriz de precios (/user/matriz) con datos de ejemplo. */}
          <Image
            src="/hero-matriz.png"
            alt="Matriz de precios de PriceScope: el mismo producto en tres tiendas, con el más barato, el más caro, promos y reduflación marcados"
            width={2940}
            height={1554}
            sizes="(min-width: 1060px) 1000px, 100vw"
            preload
            className="-mt-px h-auto w-full"
          />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- marquee */

// Logos monocromos de Simple Icons en /public, usados como máscara para teñirlos de blanco.
type Logo = { name: string; logo?: string }

// Mercado Libre usa el ícono de Mercado Pago (mismo apretón de manos).
// shortcut: Jumbo y Coto no están en Simple Icons; van solo con el nombre hasta tener su SVG.
const stores: Logo[] = [
  { name: "Mercado Libre", logo: "/stores/mercadolibre.svg" },
  { name: "Jumbo" },
  { name: "Carrefour", logo: "/stores/carrefour.svg" },
  { name: "Adidas", logo: "/stores/adidas.svg" },
  { name: "Nike", logo: "/stores/nike.svg" },
  { name: "Coto" },
]

const stack: Logo[] = [
  ["Next.js", "nextdotjs"],
  ["React", "react"],
  ["TypeScript", "typescript"],
  ["Tailwind CSS", "tailwindcss"],
  ["Python", "python"],
  ["FastAPI", "fastapi"],
  ["Pydantic", "pydantic"],
  ["SQLAlchemy", "sqlalchemy"],
  ["PostgreSQL", "postgresql"],
  ["Redis", "redis"],
  ["Docker", "docker"],
  ["Jira", "jira"],
  ["Discord", "discord"],
  ["Figma", "figma"],
  ["Claude", "claude"],
].map(([name, slug]) => ({ name, logo: `/tech/${slug}.svg` }))

// dark: cinta destacada (tiendas). Sin dark: cinta liviana y compacta, como la original (tecnologías).
function LogoMarquee({ label, items, dark }: { label: string; items: Logo[]; dark?: boolean }) {
  return (
    <section aria-label={label}>
      <div className={cn("mx-auto max-w-[1240px] border-x border-b", dark ? "bg-neutral-950 py-10" : "py-6")}>
        {/* La cinta (con sus bordes) se desvanece hacia los costados. */}
        <div
          className={cn(
            "group overflow-hidden border-y [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]",
            dark && "border-white/15"
          )}
        >
          {/* La duración fija el tiempo por vuelta, no la velocidad: la cinta liviana (~2300px) usa 55s
              para ir a ~43px/s, igual que la del equipo (7 tarjetas de 244px en 40s). */}
          <div
            className={cn(
              "flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none",
              !dark && "[animation-duration:55s]"
            )}
          >
            {/* La lista va dos veces para que la cinta dé la vuelta sin salto. */}
            {[false, true].map((copy) => (
              <ul key={String(copy)} aria-hidden={copy || undefined} className="flex">
                {items.map((item) => (
                  <li
                    key={item.name}
                    className={cn(
                      "flex items-center border-r whitespace-nowrap",
                      dark
                        ? "gap-3 border-white/15 px-12 py-5 text-base font-semibold text-white/80"
                        : "gap-2.5 px-8 py-4 text-sm text-foreground/80"
                    )}
                  >
                    {item.logo && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "[mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
                          dark ? "size-7 bg-white/80" : "size-[18px] bg-foreground/80"
                        )}
                        style={{ maskImage: `url(${item.logo})` }}
                      />
                    )}
                    {item.name}
                  </li>
                ))}
              </ul>
            ))}
          </div>
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
    <Section id="problema" tinted className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="max-w-md">
        <SectionHeading
          eyebrow="El problema"
          title="Medir precios a mano ya no alcanza."
          lead="En un mercado con el dólar en movimiento, un dato de hace tres días ya es viejo."
        />
      </div>
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
    <Section id="como" tinted className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="flex max-w-md flex-col items-start gap-6">
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
    <Section className="relative isolate flex flex-col items-center gap-5.5 overflow-hidden bg-neutral-950 text-center text-white sm:py-26">
      <PalmSilhouette className="-right-40 -z-10 h-[480px] -scale-x-100 opacity-45" />
      <PalmSilhouette className="-left-32 -z-10 h-[420px] opacity-40" />
      <h2 className="max-w-[640px] text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
        Dejá de medir a mano. Empezá a ver la inflación real.
      </h2>
      <p className="max-w-[520px] text-base leading-relaxed text-neutral-400">
        Una llamada de 30 minutos para conocer tu caso y armar tu tablero.
      </p>
      <CallButton className="bg-white text-neutral-950 hover:bg-neutral-200" />
    </Section>
  )
}
