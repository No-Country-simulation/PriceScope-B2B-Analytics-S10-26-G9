import Link from "next/link"
import { TrendingUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Logo de PriceScope: cuadrado oscuro con ícono de tendencia + wordmark.
// Común a todas las pantallas de acceso y demo del nuevo diseño.
export function BrandLogo({
  href = "/",
  className,
}: {
  href?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5", className)}
    >
      <span className="flex size-7 items-center justify-center rounded-[7px] bg-[#18181b] text-[#fafafa]">
        <TrendingUpIcon className="size-4" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">PriceScope</span>
    </Link>
  )
}
