// Dates are shown in Argentina time, whatever the admin's browser zone is,
// because demo calls are scheduled in that zone.
const TIME_ZONE = "America/Argentina/Buenos_Aires"

const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const date = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
})

const shortDate = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
})

const quoteTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

// "12/11 · 16:00": when a rate was quoted, in Argentina time.
export function formatQuoteTime(iso: string) {
  const parts = Object.fromEntries(
    quoteTime.formatToParts(new Date(iso)).map((part) => [part.type, part.value])
  )
  return `${parts.day}/${parts.month} · ${parts.hour}:${parts.minute}`
}

export function formatShortDate(iso: string) {
  return shortDate.format(new Date(iso))
}

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

export function formatDate(iso: string) {
  return date.format(new Date(iso))
}

// Miles con punto, siempre, para que el HTML del server coincida con el del
// browser (toLocaleString("es-AR") no es estable entre Node y Chromium).
function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

// Precios: ARS con miles separados por punto y USD con dos decimales, como en
// la maqueta UX05.
export function formatArs(value: number) {
  return "$ " + groupThousands(String(Math.round(value)))
}

export function formatUsd(value: number, rate: number) {
  const [whole, cents] = (value / rate).toFixed(2).split(".")
  return "US$ " + groupThousands(whole) + "," + cents
}

// An amount that is already in USD (for example, converted at capture time).
export function formatUsdAmount(value: number) {
  return formatUsd(value, 1)
}

// Conteos (productos, errores): mismo agrupado que los precios, para que el
// server y el browser coincidan.
export function formatCount(value: number) {
  return groupThousands(String(value))
}

// Variación porcentual: "+12,4 %" o "−3,1 %" (signo menos tipográfico).
export function formatPct(value: number) {
  const sign = value >= 0 ? "+" : "−"
  return sign + Math.abs(value).toFixed(1).replace(".", ",") + " %"
}

// Diferencia en puntos porcentuales: "4,6 p.p." Siempre se muestra en valor
// absoluto, porque es la distancia entre la suba y la devaluación (UX07).
export function formatPP(value: number) {
  return Math.abs(value).toFixed(1).replace(".", ",") + " p.p."
}
