"use client"

import Link from "next/link"
import {
  BuildingIcon,
  KeyRoundIcon,
  MailIcon,
  StoreIcon,
} from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { IconTile, InitialsAvatar, ToneBadge } from "@/components/admin/tone"
import { RoleLabel } from "@/components/admin/user-labels"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth"

// Perfil del cliente: la misma ficha que /admin/usuarios/[id], en solo
// lectura. Un cliente solo puede leer /auth/me, así que se arma con la sesión.
export function ClientProfile() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        title="Perfil"
        description="Tus datos de acceso a PriceScope."
      />

      {!user ? (
        <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="shadow-xs">
            <CardContent className="flex flex-col items-center gap-3 pt-2 text-center">
              <InitialsAvatar name={user.name} size="lg" />
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  {user.name}
                </h2>
                <p className="text-sm break-all text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <RoleLabel role={user.role} />
                <ToneBadge tone="emerald">Activo</ToneBadge>
              </div>
            </CardContent>

            <CardContent className="grid grid-cols-2 gap-3">
              <Stat
                tone="brand"
                icon={<StoreIcon />}
                value={String(user.store_ids.length)}
                label={user.store_ids.length === 1 ? "Tienda" : "Tiendas"}
              />
              <Stat
                tone="sky"
                icon={<BuildingIcon />}
                value={user.company}
                label="Empresa"
              />
            </CardContent>

            <CardContent className="flex flex-col gap-3">
              <Separator />
              <h3 className="text-sm font-semibold">Datos</h3>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Empresa</dt>
                <dd>{user.company}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{user.email}</dd>
                <dt className="text-muted-foreground">Contraseña</dt>
                <dd>Definida</dd>
              </dl>
            </CardContent>

            <CardFooter className="text-sm text-muted-foreground">
              Para cambiar tus datos o tus tiendas, pedíselo a un administrador.
            </CardFooter>
          </Card>

          <Tabs defaultValue="stores" className="min-w-0 gap-4">
            <TabsList>
              <TabsTrigger value="stores">
                <StoreIcon />
                Tiendas
              </TabsTrigger>
              <TabsTrigger value="access">
                <KeyRoundIcon />
                Acceso
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stores">
              <Card className="shadow-xs">
                <CardHeader>
                  <CardTitle>Tiendas asignadas</CardTitle>
                  <CardDescription>
                    Los precios que ves en el dashboard y la matriz salen de
                    estas tiendas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <IconTile tone="brand">
                      <StoreIcon />
                    </IconTile>
                    <div className="flex flex-col">
                      <span className="font-semibold tabular-nums">
                        {user.store_ids.length}{" "}
                        {user.store_ids.length === 1
                          ? "tienda asignada"
                          : "tiendas asignadas"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Las asigna un administrador desde el backoffice.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access" className="flex flex-col gap-4">
              <Card className="shadow-xs">
                <CardHeader>
                  <CardTitle>Email</CardTitle>
                  <CardDescription>
                    Es el que usás para ingresar y donde te llegan las alertas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <MailIcon className="size-4 text-muted-foreground" />
                    <span className="break-all">{user.email}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-xs">
                <CardHeader>
                  <CardTitle>Contraseña</CardTitle>
                  <CardDescription>
                    Te enviamos un enlace por email para definir una nueva.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/recuperar" />}
                  >
                    <KeyRoundIcon data-icon="inline-start" />
                    Cambiar contraseña
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  )
}

function Stat({
  tone,
  icon,
  value,
  label,
}: {
  tone: "brand" | "sky"
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="flex min-w-0 flex-col text-left">
        <span className="truncate font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
