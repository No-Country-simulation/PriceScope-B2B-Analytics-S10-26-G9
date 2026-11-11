"use client"

import * as React from "react"
import { CircleAlertIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError, type ProfileDetails } from "@/lib/api"
import { useAuth } from "@/lib/auth"

const profileSchema = z.object({
  name: z.string().trim().min(2, "Ingresá al menos 2 caracteres.").max(120, "El nombre admite hasta 120 caracteres."),
  company: z.string().trim().min(2, "Ingresá al menos 2 caracteres.").max(160, "La empresa admite hasta 160 caracteres."),
})

export function ProfileForm({ profile }: { profile: ProfileDetails }) {
  const { updateProfile } = useAuth()
  const [values, setValues] = React.useState(profile)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ProfileDetails, string>>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const submitting = React.useRef(false)
  const dirty = values.name.trim() !== profile.name || values.company.trim() !== profile.company

  function edit(field: keyof ProfileDetails, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  function cancel() {
    setValues(profile)
    setErrors({})
    setError(null)
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !dirty) return
    const parsed = profileSchema.safeParse(values)
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setErrors({ name: fields.name?.[0], company: fields.company?.[0] })
      return
    }
    submitting.current = true
    setSaving(true)
    setErrors({})
    setError(null)
    try {
      await updateProfile(parsed.data)
      toast.success("Guardaste tus datos.")
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status < 500
        ? cause.message
        : "No pudimos guardar los cambios. Tus datos siguen en el formulario; intentá nuevamente.")
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return <Card className="min-w-0 shadow-xs">
    <CardHeader>
      <CardTitle><h3>Datos personales y de la empresa</h3></CardTitle>
      <CardDescription>Se usan en tus informes y para contactarte.</CardDescription>
    </CardHeader>
    <form onSubmit={save} noValidate aria-busy={saving}>
      <CardContent className="pb-5">
        <FieldGroup className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="profile-name">Nombre y apellido</FieldLabel>
            <Input id="profile-name" name="name" autoComplete="name" required minLength={2} maxLength={120}
              value={values.name} disabled={saving} onChange={(event) => edit("name", event.target.value)}
              aria-invalid={!!errors.name} aria-describedby={errors.name ? "profile-name-error" : undefined} />
            {errors.name && <FieldError id="profile-name-error">{errors.name}</FieldError>}
          </Field>
          <Field data-invalid={!!errors.company}>
            <FieldLabel htmlFor="profile-company">Empresa</FieldLabel>
            <Input id="profile-company" name="company" autoComplete="organization" required minLength={2} maxLength={160}
              value={values.company} disabled={saving} onChange={(event) => edit("company", event.target.value)}
              aria-invalid={!!errors.company} aria-describedby={errors.company ? "profile-company-error" : undefined} />
            {errors.company && <FieldError id="profile-company-error">{errors.company}</FieldError>}
          </Field>
          <PendingContactFields />
        </FieldGroup>
        {error && <Alert variant="destructive" className="mt-5">
          <CircleAlertIcon /><AlertDescription>{error}</AlertDescription>
        </Alert>}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 py-4">
        <p className="text-sm text-muted-foreground" role="status">
          {saving ? "Guardando…" : dirty ? "Tenés cambios sin guardar." : "Sin cambios pendientes."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={cancel} disabled={!dirty || saving}>Cancelar</Button>
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </CardFooter>
    </form>
  </Card>
}

// Campos visuales de UX08: independientes del estado, la validación y el PATCH.
// Para retirarlos solo hay que quitar <PendingContactFields /> del formulario.
function PendingContactFields() {
  return <>
    <Field>
      <FieldLabel htmlFor="profile-position">Cargo</FieldLabel>
      <Input id="profile-position" placeholder="Cargo" disabled />
    </Field>
    <Field>
      <FieldLabel htmlFor="profile-phone">Teléfono</FieldLabel>
      <Input id="profile-phone" type="tel" placeholder="Teléfono de contacto" disabled />
    </Field>
  </>
}
