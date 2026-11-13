import { AdminShell } from "@/components/admin/admin-shell"
import { ThemeProvider } from "@/components/theme-provider"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <ThemeProvider>
      <AdminShell>{children}</AdminShell>
    </ThemeProvider>
  )
}
