import { ClientShell } from "@/components/cliente/client-shell"
import { ThemeProvider } from "@/components/theme-provider"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ClientShell>{children}</ClientShell>
    </ThemeProvider>
  )
}
