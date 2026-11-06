import Link from "next/link"
import { ChartNoAxesCombinedIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Frame shared by the access screens. "split" (login, password recovery)
// puts the form on the left and a panel on the right; "centered" (the
// screens opened from an email link) drops the panel and centers the form.
export function AuthShell({
  children,
  layout = "split",
}: {
  children: React.ReactNode
  layout?: "split" | "centered"
}) {
  const split = layout === "split"
  return (
    <div className={cn("grid min-h-svh", split && "lg:grid-cols-2")}>
      <div className="flex flex-col gap-4 px-6 py-8 md:px-10">
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-90 flex-col gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 self-start font-semibold"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-brand text-white">
                <ChartNoAxesCombinedIcon className="size-4" />
              </span>
              PriceScope
            </Link>
            {children}
          </div>
        </div>
        <p className="mx-auto w-full max-w-90 text-xs text-muted-foreground">
          Las cuentas las crea el equipo de PriceScope después de la demo.
        </p>
      </div>
      {/* Reserved for the product visual; left blank for now. */}
      {split ? <div className="hidden bg-muted lg:block" /> : null}
    </div>
  )
}
