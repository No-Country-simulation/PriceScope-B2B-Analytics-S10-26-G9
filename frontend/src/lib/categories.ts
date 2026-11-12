// Client categories (ProductCategory in the backend). Colors match the
// dashboard so a category looks the same on every screen.
export type ProductCategory =
  | "almacen"
  | "bebidas"
  | "lacteos"
  | "limpieza"
  | "electro"
  | "indumentaria"

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string; color: string }[] = [
  { value: "almacen", label: "Almacén", color: "#6366f1" },
  { value: "bebidas", label: "Bebidas", color: "#f59e0b" },
  { value: "lacteos", label: "Lácteos", color: "#14b8a6" },
  { value: "limpieza", label: "Limpieza", color: "#a78bfa" },
  { value: "electro", label: "Electro", color: "#38bdf8" },
  { value: "indumentaria", label: "Indumentaria", color: "#f472b6" },
]

export const CATEGORY_LABEL = Object.fromEntries(
  PRODUCT_CATEGORIES.map((category) => [category.value, category.label])
) as Record<ProductCategory, string>
