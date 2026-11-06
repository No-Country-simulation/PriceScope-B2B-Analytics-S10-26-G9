import Link from "next/link"

import { Logo } from "@/components/landing/landing-header"

const footerLinks = [
  {
    title: "Producto",
    links: [
      { href: "/#funcionalidades", label: "Funcionalidades" },
      { href: "/#como", label: "Cómo funciona" },
      { href: "/#faq", label: "Preguntas" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/ingresar", label: "Iniciar sesión" },
      { href: "/demo", label: "Agendar una llamada" },
    ],
  },
]

export function LandingFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-10 border-x px-5 pt-14 pb-8 sm:px-8">
        <div className="flex max-w-[320px] flex-col gap-3">
          <Logo />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Monitor de inflación real multimoneda para empresas.
          </p>
        </div>
        <div className="flex flex-wrap gap-16">
          {footerLinks.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3 text-sm">
              <span className="font-medium">{col.title}</span>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
    </footer>
  )
}
