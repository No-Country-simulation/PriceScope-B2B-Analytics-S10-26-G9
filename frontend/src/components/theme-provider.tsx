"use client"

import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Light by default; the choice is saved in localStorage and applied as the
// `.dark` class on <html>, which is what globals.css keys the dark tokens on.
// Only the app (/user, /admin) follows it: the public pages mix theme tokens
// with fixed brand colors, so they always render light.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const inApp = /^\/(user|admin)(\/|$)/.test(pathname)

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme={inApp ? undefined : "light"}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
