import * as React from "react"

import { BrandLogo } from "@/components/auth/brand-logo"
import { cn } from "@/lib/utils"

// Layout centrado para UX03 · Recuperar acceso y UX03 · Definir/Restablecer
// contraseña: logo arriba, card centrada, fondo #fafafa.
export function CenteredShell({
  children,
  cardClassName,
  footer,
}: {
  children: React.ReactNode
  cardClassName?: string
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[#fafafa] px-4 py-10">
      <BrandLogo />
      <div className={cn("flex w-full max-w-[420px] flex-col", cardClassName)}>
        {children}
      </div>
      {footer}
    </div>
  )
}
