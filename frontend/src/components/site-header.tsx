import type { ReactNode } from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({ title, section, children }: {
  title: string
  section?: string
  children?: ReactNode
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex min-w-0 w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        {section && <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{section} /</span>}
        <h1 className="min-w-0 truncate text-base font-medium">{title}</h1>
        {children && <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">{children}</div>}
      </div>
    </header>
  )
}
