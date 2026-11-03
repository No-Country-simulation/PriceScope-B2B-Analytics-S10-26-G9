// Cotizaciones que usa la interfaz para pasar de ARS a USD. Son de muestra
// (UX05 · Matriz de precios): cuando entre la API, el valor y la hora del
// header salen de ahí.

export const QUOTES = {
  blue: 1515,
  oficial: 1010,
} as const

export type Quote = keyof typeof QUOTES

export const QUOTE_LABEL: Record<Quote, string> = {
  blue: "Blue",
  oficial: "Oficial",
}
