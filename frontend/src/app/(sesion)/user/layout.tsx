import { ClientShell } from "@/components/cliente/client-shell"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>
}
