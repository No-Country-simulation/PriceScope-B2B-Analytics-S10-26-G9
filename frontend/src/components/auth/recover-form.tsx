"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  Loader2Icon,
  MailIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";

export function RecoverForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      // The API answers the same whether or not the account exists.
      await apiFetch("/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        setError(err.message);
      } else {
        setError("No pudimos conectar con el servidor. Probá de nuevo.");
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-5">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted">
          <MailIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Revisá tu correo
          </h1>
          <p className="text-sm text-muted-foreground">
            Si <strong className="text-foreground">{email}</strong> tiene una
            cuenta en PriceScope, vas a recibir un enlace para restablecer la
            contraseña. Vence en 1 hora.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10"
          onClick={() => setSent(false)}
        >
          Usar otro correo
        </Button>
        <BackToLogin />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresá tu correo y te enviamos un enlace para restablecerla.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10"
        />
      </div>

      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>

      <BackToLogin />
    </form>
  );
}

function BackToLogin() {
  return (
    <Link
      href="/ingresar"
      className="flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeftIcon className="size-4" />
      Volver a ingresar
    </Link>
  );
}
