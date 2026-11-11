"use client"

import * as React from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordField({ id, label, value, onChange, autoComplete = "new-password", disabled = false, describedBy = "password-rules" }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: "current-password" | "new-password"
  disabled?: boolean
  describedBy?: string
}) {
  const [shown, setShown] = React.useState(false)
  return <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input id={id} name={id} type={shown ? "text" : "password"} autoComplete={autoComplete}
        required maxLength={128} value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy || undefined} className="h-10 pr-10" />
      <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
        onClick={() => setShown((current) => !current)}
        aria-label={`${shown ? "Ocultar" : "Mostrar"}: ${label.toLowerCase()}`} aria-pressed={shown}>
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  </div>
}
