"use client"

import { useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, MailIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

// shortcut: nombres y bios de ejemplo del mockup, reemplazar por el equipo real antes de publicar.
const team = [
  { name: "Martina Ruiz", role: "CEO y cofundadora", bio: "Economista. Pasó diez años analizando precios y consumo para cadenas minoristas." },
  { name: "Tomás Herrera", role: "CTO y cofundador", bio: "Lidera la recolección automática de precios y la infraestructura de datos." },
  { name: "Lucía Fernández", role: "Head of Data", bio: "Diseña la metodología del índice: canastas, promociones y reduflación." },
  { name: "Joaquín Acosta", role: "Customer Success", bio: "Acompaña a cada cliente desde la primera llamada hasta su tablero." },
]

const perPage = 2
const pages = Math.ceil(team.length / perPage)

export function Team() {
  const [page, setPage] = useState(0)

  return (
    <div className="flex flex-col gap-12">
      <div className="grid gap-12 lg:grid-cols-2">
        {team.slice(page * perPage, page * perPage + perPage).map((m) => (
          <div key={m.name} className="flex flex-col gap-7 sm:flex-row sm:items-center">
            <div
              role="img"
              aria-label={`Foto de ${m.name} (pendiente)`}
              className="h-[270px] w-full shrink-0 rounded-2xl border bg-muted sm:w-[220px]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h3 className="text-base font-semibold">{m.name}</h3>
              <span className="text-sm text-muted-foreground">{m.role}</span>
              <span className="my-3.5 h-px w-16 bg-border" />
              <p className="text-sm leading-relaxed text-muted-foreground">{m.bio}</p>
              <div className="mt-3.5 flex gap-2">
                <Button variant="outline" size="icon" className="rounded-full" aria-label={`LinkedIn de ${m.name}`} nativeButton={false} render={<a href="#" />}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </Button>
                <Button variant="outline" size="icon" className="rounded-full" aria-label={`Correo de ${m.name}`} nativeButton={false} render={<a href="#" />}>
                  <MailIcon />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3.5">
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Anteriores" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeftIcon />
        </Button>
        <span className="relative h-1 w-30 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className="absolute inset-y-0 rounded-full bg-primary transition-[left]"
            style={{ left: `${(page * 100) / pages}%`, width: `${100 / pages}%` }}
          />
        </span>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Siguientes" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
