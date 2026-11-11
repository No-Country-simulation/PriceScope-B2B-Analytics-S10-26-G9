// Reglas compartidas por recuperación, alta y cambio de contraseña.
export function passwordRules(password: string, confirmation: string) {
  return [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Una mayúscula", ok: /\p{Lu}/u.test(password) },
    { label: "Un número", ok: /\p{Nd}/u.test(password) },
    { label: "Las contraseñas coinciden", ok: password.length > 0 && password === confirmation },
  ]
}
