"use client"

import Link from "next/link"
import { ChartNoAxesCombinedIcon, MenuIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export const sections = [
  { href: "/#problema", label: "El problema" },
  { href: "/#funcionalidades", label: "Funcionalidades" },
  { href: "/#como", label: "Cómo funciona" },
  { href: "/#equipo", label: "Equipo" },
  { href: "/#faq", label: "Preguntas" },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={className ?? "flex items-center gap-2 font-semibold"}>
      <span className="flex size-7 items-center justify-center rounded-md bg-brand text-white">
        <ChartNoAxesCombinedIcon className="size-4" />
      </span>
      PriceScope
    </Link>
  )
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 border-x px-4 py-3 sm:gap-6 sm:px-6">
        <div className="flex flex-1">
          <Logo />
        </div>

        <nav aria-label="Secciones" className="hidden items-center gap-0.5 lg:flex">
          {sections.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Button variant="ghost" size="lg" className="hidden px-4 sm:inline-flex" nativeButton={false} render={<Link href="/ingresar" />}>
            Iniciar sesión
          </Button>
          <Button size="lg" className="px-4" nativeButton={false} render={<Link href="/demo" />}>
            Agendar<span className="hidden sm:inline">una llamada</span>
          </Button>
          <Sheet>
            <SheetTrigger
              render={<Button variant="outline" size="icon-lg" className="lg:hidden" aria-label="Abrir menú" />}
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>PriceScope</SheetTitle>
              </SheetHeader>
              <nav aria-label="Secciones" className="flex flex-col gap-1 px-4">
                {sections.map((s) => (
                  <SheetClose
                    key={s.href}
                    render={<a href={s.href} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")} />}
                  >
                    {s.label}
                  </SheetClose>
                ))}
                <Separator className="my-2" />
                <Button variant="outline" nativeButton={false} render={<Link href="/ingresar" />}>
                  Iniciar sesión
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
