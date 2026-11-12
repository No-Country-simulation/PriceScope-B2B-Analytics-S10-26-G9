// Productos de muestra para las alertas (UX07), que todavía no tienen API.
// Antes alimentaban la matriz; la matriz y la ficha ya leen GET /matrix y
// GET /products. Se borra cuando se conecten las alertas.

export const STORES = [
  "Supermercado Delta",
  "Hiper Sur",
  "Mercado Norte",
] as const

export type Product = {
  name: string
  cat: string
  size: string
  /** Variación porcentual de los últimos 30 días. */
  v: number
  /** Precio por tienda, en ARS. `null` cuando la tienda no lo publica. */
  p: (number | null)[]
  /** Precio regular cuando hay promo vigente, por tienda. */
  promo?: (number | null)[]
  /** Cambio de contenido neto (reduflación), por tienda. */
  redu?: (string | null)[]
}

export const PRODUCTS: Product[] = [
  {
    name: "Café molido",
    cat: "Almacén",
    size: "500 g",
    v: 12.4,
    p: [8990, 8450, 9300],
    redu: [null, "500 → 450 g", null],
  },
  {
    name: "Zapatillas running",
    cat: "Indumentaria",
    size: "talle 42",
    v: 14.2,
    p: [89990, 94500, 85000],
  },
  {
    name: "Jean clásico",
    cat: "Indumentaria",
    size: "talle 40",
    v: 11.7,
    p: [45990, 42500, 48900],
  },
  {
    name: "Queso cremoso",
    cat: "Lácteos",
    size: "1 kg",
    v: 10.9,
    p: [11800, 12900, null],
  },
  {
    name: "Aceite de girasol",
    cat: "Almacén",
    size: "1,5 L",
    v: 9.8,
    p: [3890, 4250, 3999],
  },
  {
    name: "Arroz largo fino",
    cat: "Almacén",
    size: "1 kg",
    v: 8.8,
    p: [1890, 1750, 1820],
  },
  {
    name: "Yerba mate",
    cat: "Almacén",
    size: "1 kg",
    v: 7.1,
    p: [5200, 4890, 5450],
    promo: [null, 5600, null],
  },
  {
    name: "Leche entera",
    cat: "Lácteos",
    size: "1 L",
    v: 6.2,
    p: [1390, 1450, 1420],
  },
  {
    name: "Detergente",
    cat: "Limpieza",
    size: "750 ml",
    v: 5.3,
    p: [2350, 2190, 2400],
    redu: [null, "750 → 700 ml", null],
  },
  {
    name: "Gaseosa cola",
    cat: "Bebidas",
    size: "2,25 L",
    v: 4.8,
    p: [3100, 2790, 3250],
    promo: [null, 3300, null],
  },
  {
    name: "Heladera no frost",
    cat: "Electro",
    size: "360 L",
    v: 3.4,
    p: [1299000, 1349000, 1315000],
  },
  {
    name: "Smart TV 4K",
    cat: "Electro",
    size: '50"',
    v: 2.1,
    p: [689999, 719000, 649999],
    promo: [null, null, 739999],
  },
]

export const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.cat)))
