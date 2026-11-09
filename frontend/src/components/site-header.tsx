import type { ReactNode } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({
  title,
  section,
  children,
}: {
  title: string
  section?: string
  children?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 rounded-t-[inherit]">
      {/* Same width and gutters as the page container (@container/main), so
          the header lines up with the content when the sidebar toggles. */}
      <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-2" />
        <Separator
          orientation="vertical"
          className="mr-2 h-4 data-vertical:self-auto"
        />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {section && (
              <>
                <BreadcrumbItem className="hidden sm:inline-flex">
                  {section}
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
              </>
            )}
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate font-medium">
                <h1>{title}</h1>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {children && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}
