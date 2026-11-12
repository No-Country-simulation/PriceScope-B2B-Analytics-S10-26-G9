"use client"

import * as React from "react"
import { MailIcon, StoreIcon } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { IconTile } from "@/components/admin/tone"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { STORE_CATEGORY_LABELS } from "@/components/admin/user-labels"
import { type ClientStore } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

import { ProfileForm } from "./profile-form"
import { ChangePasswordForm } from "./change-password-form"
import { DeactivateAccount } from "./deactivate-account"

const SECTIONS = [
  { id: "personal", label: "Datos personales" },
  { id: "stores", label: "Tiendas asignadas" },
  { id: "security", label: "Seguridad" },
]

export function ClientProfile() {
  const { user } = useAuth()
  const [active, setActive] = React.useState("personal")

  return <>
    <PageHeader title="Mi cuenta" description="Tus datos, la seguridad del acceso y tus tiendas." />
    {!user ? <div className="grid items-start gap-6 lg:grid-cols-[180px_minmax(0,1fr)]" role="status" aria-label="Cargando tu cuenta">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div> : <div className="grid items-start gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
      <nav aria-label="Secciones de Mi cuenta" className="flex flex-wrap gap-1 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:flex-col">
        {SECTIONS.map((section) => <a key={section.id} href={`#account-${section.id}`}
          onClick={() => setActive(section.id)} aria-current={active === section.id ? "location" : undefined}
          className={cn("rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", active === section.id && "bg-muted font-medium text-foreground")}>
          {section.label}
        </a>)}
        <a href="#account-danger" onClick={() => setActive("danger")}
          aria-current={active === "danger" ? "location" : undefined}
          className={cn("rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10", active === "danger" && "bg-destructive/10 font-medium")}>
          Zona de peligro
        </a>
      </nav>

      <div className="flex min-w-0 flex-col gap-5">
        <section id="account-personal" className="scroll-mt-[calc(var(--header-height)+1.5rem)]" aria-label="Datos personales">
          <ProfileForm key={JSON.stringify([user.id, user.name, user.company])}
            profile={{ name: user.name, company: user.company }} />
        </section>

        <section id="account-stores" className="scroll-mt-[calc(var(--header-height)+1.5rem)]" aria-labelledby="account-stores-title">
          <Card className="min-w-0 shadow-xs">
            <CardHeader>
              <CardTitle><h3 id="account-stores-title">Tiendas asignadas</h3></CardTitle>
              <CardDescription>Para cambiar tus tiendas, contactá al equipo de PriceScope.</CardDescription>
            </CardHeader>
            <CardContent>
              <AssignedStores />
            </CardContent>
          </Card>
        </section>

        <section id="account-security" className="scroll-mt-[calc(var(--header-height)+1.5rem)]" aria-labelledby="account-security-title">
          <Card className="min-w-0 gap-0 pb-0 shadow-xs">
            <CardHeader className="border-b">
              <CardTitle><h3 id="account-security-title">Seguridad</h3></CardTitle>
              <CardDescription>Tu correo de acceso y tu contraseña.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 border-b py-5">
              <h4 className="text-sm font-semibold">Correo de acceso</h4>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <MailIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 wrap-anywhere">{user.email}</span>
              </div>
            </CardContent>
            <CardContent className="space-y-3 py-5">
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </section>
        <DeactivateAccount />
      </div>
    </div>}
  </>
}

// Names come from GET /stores; /auth/me only has the ids.
function AssignedStores() {
  const { request } = useAuth()
  const [stores, setStores] = React.useState<ClientStore[] | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    request<ClientStore[]>("/stores")
      .then((data) => { if (!cancelled) setStores(data) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [request])

  if (failed) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">No pudimos cargar tus tiendas. Probá de nuevo más tarde.</p>
  }
  if (!stores) {
    return <div role="status" aria-label="Cargando tus tiendas" className="flex flex-col gap-2">
      <Skeleton className="h-16 rounded-lg" />
    </div>
  }
  if (stores.length === 0) {
    return <div className="flex items-center gap-3 rounded-lg border p-4">
      <IconTile tone="brand"><StoreIcon /></IconTile>
      <p className="min-w-0 font-medium">Todavía no tenés tiendas asignadas</p>
    </div>
  }
  return <ul className="flex flex-col gap-2" aria-label="Tus tiendas">
    {stores.map((store) => <li key={store.id} className="flex items-center gap-3 rounded-lg border p-4">
      <IconTile tone="brand"><StoreIcon /></IconTile>
      <div className="min-w-0">
        <p className="truncate font-medium">{store.name}</p>
        <p className="text-sm text-muted-foreground">{STORE_CATEGORY_LABELS[store.category]}</p>
      </div>
    </li>)}
  </ul>
}
