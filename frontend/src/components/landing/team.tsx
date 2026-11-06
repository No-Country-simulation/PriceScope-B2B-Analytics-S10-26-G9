import { MailIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

// shortcut: faltan fotos y enlaces de LinkedIn/correo de cada integrante; mientras tanto, iniciales.
const team = [
  { name: "Erika Helfenstern", role: "Frontend Developer" },
  { name: "Luciano Castillo", role: "Backend Developer" },
  { name: "Bruno Alvarez", role: "QA Tester" },
  { name: "Gabriel Parra", role: "Backend Developer" },
  { name: "Angel Villalba", role: "Tech Lead" },
  { name: "Maria Laura Filco", role: "Project Manager" },
  { name: "Esther Kafira Guarachi", role: "Full Stack Developer" },
]

function initials(name: string) {
  const [first, second] = name.split(" ")
  return (first[0] + (second?.[0] ?? "")).toUpperCase()
}

export function Team() {
  return (
    <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="flex w-max animate-marquee [animation-duration:40s] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {/* La lista va dos veces para que la cinta dé la vuelta sin salto; la copia queda fuera del foco y de lectores. */}
        {[false, true].map((copy) => (
          <ul key={String(copy)} aria-hidden={copy || undefined} inert={copy || undefined} className="flex">
            {team.map((m) => (
              <li key={m.name} className="mr-5 flex w-56 flex-col items-center gap-1 rounded-2xl border bg-card px-5 py-7 text-center">
                <span
                  aria-hidden="true"
                  className="mb-3 flex size-16 items-center justify-center rounded-full bg-brand/10 text-lg font-semibold text-brand"
                >
                  {initials(m.name)}
                </span>
                <h3 className="text-sm font-semibold">{m.name}</h3>
                <span className="text-xs text-muted-foreground">{m.role}</span>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="icon-sm" className="rounded-full" aria-label={`LinkedIn de ${m.name}`} nativeButton={false} render={<a href="#" />}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
                      <rect x="2" y="9" width="4" height="12" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                  </Button>
                  <Button variant="outline" size="icon-sm" className="rounded-full" aria-label={`Correo de ${m.name}`} nativeButton={false} render={<a href="#" />}>
                    <MailIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
