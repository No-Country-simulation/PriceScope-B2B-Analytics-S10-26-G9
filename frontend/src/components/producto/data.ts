// Muestra de la maqueta UX06 · Ficha de producto. Sin API: los precios y el
// historial son de ejemplo y se reemplazan por los datos reales cuando entre
// el backend.

export const PRODUCT = {
  name: "Café molido",
  brand: "La Virginia",
  cat: "Almacén",
  size: "500 g",
  canonical: "cafe-molido-500g",
  v30: 12.4,
  v90: 28.7,
} as const

export const STORES = [
  "Supermercado Delta",
  "Hiper Sur",
  "Mercado Norte",
] as const

// Precio actual por tienda, en ARS. null = no lo publica.
export const CURRENT_PRICES: (number | null)[] = [8990, 8450, 9300]

// Precio regular cuando hay promo vigente, por tienda.
export const REGULAR_PRICES: (number | null)[] = [null, 5600, null]

// Cambio de contenido neto (reduflación), por tienda.
export const REDUCTION: (string | null)[] = [null, "500 → 450 g", null]

// Historial de precios por tienda (ARS). 12 puntos: una captura cada ~3 días
// durante el último mes. Maqueta, sin API.
export const PRICE_HISTORY = [
  { date: "2025-10-05", delta: 7990, hiper: 7800, norte: 8200 },
  { date: "2025-10-08", delta: 7990, hiper: 7800, norte: 8200 },
  { date: "2025-10-11", delta: 8200, hiper: 7800, norte: 8200 },
  { date: "2025-10-14", delta: 8200, hiper: 8000, norte: 8500 },
  { date: "2025-10-17", delta: 8200, hiper: 8000, norte: 8500 },
  { date: "2025-10-20", delta: 8450, hiper: 8000, norte: 8500 },
  { date: "2025-10-23", delta: 8450, hiper: 8000, norte: 8800 },
  { date: "2025-10-26", delta: 8450, hiper: 8250, norte: 8800 },
  { date: "2025-10-29", delta: 8700, hiper: 8250, norte: 9100 },
  { date: "2025-11-01", delta: 8990, hiper: 8450, norte: 9100 },
  { date: "2025-11-03", delta: 8990, hiper: 8450, norte: 9300 },
  { date: "2025-11-06", delta: 8990, hiper: 8450, norte: 9300 },
]

// Eventos del historial: promos, reduflación y saltos de precio.
export const PRICE_EVENTS = [
  {
    date: "2025-11-01",
    store: "Supermercado Delta",
    type: "price-up",
    label: "Subió de $8.700 a $8.990",
    detail: "+3,3 % en una captura",
  },
  {
    date: "2025-10-31",
    store: "Hiper Sur",
    type: "promo",
    label: "Promo: $5.600 (reg. $8.450)",
    detail: "Descuento del 33,7 %",
  },
  {
    date: "2025-10-25",
    store: "Hiper Sur",
    type: "redu",
    label: "Reduflación: 500 → 450 g",
    detail: "Bajó el contenido neto sin bajar el precio",
  },
  {
    date: "2025-10-20",
    store: "Supermercado Delta",
    type: "price-up",
    label: "Subió de $8.200 a $8.450",
    detail: "+3,0 % en una captura",
  },
] as const
