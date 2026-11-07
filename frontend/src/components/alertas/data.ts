// UX07 · Alertas: datos de muestra. La pantalla ya vive detrás de la sesión,
// pero todavía no llama a la API; cuando entre el backend, alertas y reglas
// salen de ahí y este archivo se borra (mismo camino que components/matriz).

export type AlertItem = {
  product: string
  category: string
  store: string
  /** Variación del período, en %. */
  variation: number
}

export type FiredAlert = {
  id: string
  rule: string
  /** Fecha y hora del disparo, en la zona del negocio. */
  firedAt: string
  /** Cuántos productos de la regla se movieron por encima de la devaluación. */
  products: number
  isNew: boolean
  /** Alcance de la regla, para leer de un vistazo de qué se trata. */
  scope: string
  phrase: string
  /** Dólar del período, en %. */
  devaluation: number
  /** Suba promedio de los productos, en %. */
  average: number
  items: AlertItem[]
}

export type AlertRule = {
  id: string
  name: string
  kind: "devaluation" | "hit"
  phrase: string
  /** Última vez que se disparó; null si nunca se disparó. */
  lastFired: string | null
  active: boolean
}

export const RULE_KIND_LABEL: Record<AlertRule["kind"], string> = {
  devaluation: "Sube más que la devaluación",
  hit: "Hito",
}

export const ALERTS: FiredAlert[] = [
  {
    id: "almacen-blue-2910",
    rule: "Almacén supera al blue",
    firedAt: "29/10/2026 06:10",
    products: 7,
    isNew: true,
    scope: "Almacén · todas las tiendas · 30 días",
    phrase:
      "Productos de Almacén en cualquier tienda subieron más de 2 p.p. por encima del dólar blue en los últimos 30 días.",
    devaluation: 4.1,
    average: 8.7,
    items: [
      {
        product: "Café molido 500 g",
        category: "Almacén",
        store: "Supermercado Delta",
        variation: 12.4,
      },
      {
        product: "Aceite de girasol 1,5 L",
        category: "Almacén",
        store: "Hiper Sur",
        variation: 9.8,
      },
      {
        product: "Arroz largo fino 1 kg",
        category: "Almacén",
        store: "Supermercado Delta",
        variation: 8.8,
      },
      {
        product: "Yerba mate 1 kg",
        category: "Almacén",
        store: "Mercado Norte",
        variation: 7.1,
      },
      {
        product: "Fideos secos 500 g",
        category: "Almacén",
        store: "Hiper Sur",
        variation: 6.6,
      },
    ],
  },
  {
    id: "cyberweek-electro-2810",
    rule: "CyberWeek · Electro",
    firedAt: "28/10/2026 22:00",
    products: 12,
    isNew: true,
    scope: "Hito CyberWeek · Electro · 03/11 a 09/11",
    phrase:
      "Durante CyberWeek, productos de Electro subieron su precio regular antes de aplicar el descuento.",
    devaluation: 1.2,
    average: 5.4,
    items: [
      {
        product: 'Smart TV 4K 50"',
        category: "Electro",
        store: "Mercado Norte",
        variation: 7.9,
      },
      {
        product: "Heladera no frost 360 L",
        category: "Electro",
        store: "Hiper Sur",
        variation: 5.1,
      },
      {
        product: "Lavarropas 8 kg",
        category: "Electro",
        store: "Supermercado Delta",
        variation: 4.6,
      },
    ],
  },
  {
    id: "indumentaria-pico-2710",
    rule: "Indumentaria · pico",
    firedAt: "27/10/2026 06:00",
    products: 4,
    isNew: true,
    scope: "Indumentaria · Supermercado Delta · 7 días",
    phrase:
      "Productos de Indumentaria en Supermercado Delta subieron más de 3 p.p. por encima del dólar blue en 7 días.",
    devaluation: 0.6,
    average: 6.8,
    items: [
      {
        product: "Zapatillas running",
        category: "Indumentaria",
        store: "Supermercado Delta",
        variation: 9.4,
      },
      {
        product: "Jean clásico",
        category: "Indumentaria",
        store: "Supermercado Delta",
        variation: 6.1,
      },
    ],
  },
  {
    id: "lacteos-oficial-2410",
    rule: "Lácteos supera al oficial",
    firedAt: "24/10/2026 06:00",
    products: 3,
    isNew: false,
    scope: "Lácteos · todas las tiendas · 30 días",
    phrase:
      "Productos de Lácteos subieron más de 1 p.p. por encima del dólar oficial en 30 días.",
    devaluation: 1.9,
    average: 5.2,
    items: [
      {
        product: "Queso cremoso 1 kg",
        category: "Lácteos",
        store: "Hiper Sur",
        variation: 10.9,
      },
      {
        product: "Leche entera 1 L",
        category: "Lácteos",
        store: "Mercado Norte",
        variation: 6.2,
      },
    ],
  },
  {
    id: "almacen-blue-1510",
    rule: "Almacén supera al blue",
    firedAt: "15/10/2026 06:10",
    products: 5,
    isNew: false,
    scope: "Almacén · todas las tiendas · 30 días",
    phrase:
      "Productos de Almacén en cualquier tienda subieron más de 2 p.p. por encima del dólar blue en los últimos 30 días.",
    devaluation: 3.8,
    average: 6.9,
    items: [
      {
        product: "Aceite de girasol 1,5 L",
        category: "Almacén",
        store: "Supermercado Delta",
        variation: 7.4,
      },
    ],
  },
]

export const RULES: AlertRule[] = [
  {
    id: "almacen-blue",
    name: "Almacén supera al blue",
    kind: "devaluation",
    phrase:
      "Avisame cuando un producto de Almacén en cualquier tienda suba más de 2 p.p. por encima del dólar blue en los últimos 30 días.",
    lastFired: "29/10/2026 06:10",
    active: true,
  },
  {
    id: "cyberweek-electro",
    name: "CyberWeek · Electro",
    kind: "hit",
    phrase:
      "Avisame si durante CyberWeek (03/11 al 09/11) un producto de Electro sube su precio regular más de 1 p.p. por encima del dólar oficial.",
    lastFired: "28/10/2026 22:00",
    active: true,
  },
  {
    id: "bebidas-hiper-sur",
    name: "Bebidas en Hiper Sur",
    kind: "devaluation",
    phrase:
      "Avisame cuando un producto de Bebidas en Hiper Sur suba más de 3 p.p. por encima del dólar blue en los últimos 7 días.",
    lastFired: null,
    active: false,
  },
  {
    id: "indumentaria-pico",
    name: "Indumentaria · pico",
    kind: "devaluation",
    phrase:
      "Avisame cuando un producto de Indumentaria en Supermercado Delta suba más de 3 p.p. por encima del dólar blue en los últimos 7 días.",
    lastFired: "27/10/2026 06:00",
    active: true,
  },
]
