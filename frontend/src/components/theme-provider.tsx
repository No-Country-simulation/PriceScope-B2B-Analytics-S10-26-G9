"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Light by default; the choice is saved in localStorage and applied as the
// `.dark` class on <html>, which is what globals.css keys the dark tokens on.
//
// Only the app (/user, /admin) follows it, so this provider lives in those layouts
// instead of the root one: the public pages mix theme tokens with fixed brand colors
// and always render light. Deciding by layout (not with usePathname) keeps dynamic
// routes prerenderable with Cache Components.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Leaving the app for a public page: drop the dark class so it renders light.
  React.useEffect(
    () => () => {
      const root = document.documentElement
      root.classList.remove("dark")
      root.style.colorScheme = ""
    },
    []
  )

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
