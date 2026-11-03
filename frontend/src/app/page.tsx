import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PriceScope · La inflación real, en pesos y en dólares",
};

const features = [
  {
    title: "Inflación en pesos y en dólares",
    text: "Dos monedas, dos historias. Medí la inflación real con la brecha contra el oficial y el blue, sin depender de un solo número.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9 9.5c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 2-3 2-3 .9-3 2 1.3 2 3 2 3-.9 3-2" />
      </>
    ),
  },
  {
    title: "Promociones y reduflación",
    text: "Tratamos las promociones y la reduflación para que el índice no se distorsione. El precio real, sin engaños.",
    icon: (
      <>
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
      </>
    ),
  },
  {
    title: "Alertas de mercado",
    text: "Notificaciones para productos que suben más que la devaluación y para hitos como CyberWeek. Enterate antes.",
    icon: (
      <>
        <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
      </>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-3 text-[15px] font-semibold tracking-[.22em]">
          <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#1C1D2B" />
            <path d="M6 20 L11 13 L15 16 L22 7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          PRICESCOPE
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/demo" className="rounded-lg border border-line px-4 py-2 text-[13.5px] font-medium text-ink transition-colors hover:bg-lilac">
            Ver demo
          </Link>
          <Link href="/ingresar" className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-medium text-white shadow-[0_8px_20px_-12px_rgba(74,91,219,.9)] transition-colors hover:bg-brand-deep">
            Ingresar
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden bg-navy text-white [background-image:radial-gradient(ellipse_70%_55%_at_80%_0%,rgba(98,112,255,.35),transparent_70%)]">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-14 px-8 py-24 lg:grid-cols-2 lg:py-32">
            <div className="flex flex-col gap-8">
              <h1 className="m-0 font-serif text-[clamp(44px,5.5vw,76px)] font-light leading-[1.02] tracking-[-0.03em] text-balance">
                Volvé a ver la inflación <em className="text-periwinkle">real</em>.
              </h1>
              <p className="m-0 max-w-[480px] text-[17px] leading-relaxed text-[#B8BDD4]">
                PriceScope es la herramienta de análisis de precios para equipos que necesitan tomar decisiones con datos confiables, no con índices distorsionados.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/demo" className="inline-flex min-h-[52px] items-center rounded-xl bg-white px-7 text-[15.5px] font-medium text-navy transition-colors hover:bg-[#E8EAFF]">
                  Agendar demo
                </Link>
              </div>
            </div>
            <svg viewBox="0 0 520 200" width="100%" aria-hidden="true" className="block max-w-[560px] justify-self-end overflow-visible">
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8A98FF" stopOpacity=".35" />
                  <stop offset="1" stopColor="#8A98FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon fill="url(#heroGrad)" points="0,160 60,152 120,155 180,130 240,118 300,98 360,82 420,58 480,38 480,200 0,200" />
              <polyline fill="none" stroke="#6A6F9E" strokeWidth="2" strokeDasharray="6 5" points="0,160 60,158 120,150 180,138 240,128 300,114 360,96 420,76 480,62" />
              <polyline fill="none" stroke="#AEB8FF" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points="0,160 60,152 120,155 180,130 240,118 300,98 360,82 420,58 480,38" />
              <circle cx="480" cy="38" r="5" fill="#fff" />
            </svg>
          </div>
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-12 border-t border-line-dark px-8 py-8">
            <div>
              <div className="text-[11.5px] tracking-[.16em] text-periwinkle-soft">EN PESOS</div>
              <div className="mt-1 text-[32px] font-light tracking-[-0.03em] font-[var(--font-inter)]">+11,7 %</div>
            </div>
            <div>
              <div className="text-[11.5px] tracking-[.16em] text-periwinkle-soft">EN DÓLARES</div>
              <div className="mt-1 text-[32px] font-light tracking-[-0.03em] font-[var(--font-inter)]">+2,0 %</div>
            </div>
            <div className="flex items-end">
              <p className="m-0 text-[13px] leading-snug text-[#8A90B8]">
                Datos ilustrativos · Actualización mensual
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-8 py-24">
          <div className="mb-14 flex flex-col items-center gap-3 text-center">
            <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-brand">Por qué PriceScope</span>
            <h2 className="m-0 font-serif text-[clamp(32px,4vw,48px)] font-light leading-[1.08] tracking-[-0.03em]">
              Tres razones para dejar de mirar solo el IPC.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="flex flex-col gap-5 rounded-2xl border border-[#E4E7F0] bg-white p-8">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-lilac text-brand-deep">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="m-0 text-[18px] font-semibold leading-snug">{f.title}</h3>
                <p className="m-0 text-[14.5px] leading-relaxed text-ink-soft">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-lilac [background-image:radial-gradient(ellipse_70%_60%_at_20%_100%,rgba(98,112,255,.18),transparent_70%)]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-6 px-8 py-24 text-center">
            <h2 className="m-0 max-w-[640px] font-serif text-[clamp(32px,4vw,52px)] font-light leading-[1.06] tracking-[-0.03em] text-balance">
              Mirá PriceScope con datos de tu sector.
            </h2>
            <p className="m-0 max-w-[520px] text-[16px] leading-relaxed text-ink-soft">
              En 30 minutos recorremos el dashboard, la matriz de precios y las alertas con datos de tu rubro.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              <Link href="/demo" className="inline-flex min-h-[52px] items-center rounded-xl bg-brand px-7 text-[15.5px] font-medium text-white shadow-[0_12px_24px_-14px_rgba(74,91,219,.9)] transition-colors hover:bg-brand-deep">
                Agendar demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E4E7F0]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-8 py-8 text-[13px] text-ink-soft">
          <span className="flex items-center gap-2.5 font-semibold tracking-[.18em] text-ink">
            <svg width="20" height="20" viewBox="0 0 28 28" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="#1C1D2B" />
              <path d="M6 20 L11 13 L15 16 L22 7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PRICESCOPE
          </span>
          <span>La inflación real, en pesos y en dólares.</span>
        </div>
      </footer>
    </div>
  );
}
