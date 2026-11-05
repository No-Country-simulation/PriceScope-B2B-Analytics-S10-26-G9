// Muestra de la maqueta UX07 · Alertas. Sin API: las alertas y reglas son de
// ejemplo y se reemplazan por los datos reales cuando entre el backend.

export type AlertType = "price-spike" | "reduflation" | "promo" | "back-in-stock"
export type AlertStatus = "active" | "acknowledged" | "resolved"

export type Alert = {
  id: string
  type: AlertType
  product: string
  cat: string
  store: string
  message: string
  triggered_at: string
  status: AlertStatus
  new: boolean
}

export const ALERTS: Alert[] = [
  {
    id: "a-001",
    type: "price-spike",
    product: "Café molido",
    cat: "Almacén",
    store: "Supermercado Delta",
    message: "Subió 3,3 % en una captura, por encima del umbral de 2 %",
    triggered_at: "2025-11-06T06:12:00",
    status: "active",
    new: true,
  },
  {
    id: "a-002",
    type: "reduflation",
    product: "Detergente",
    cat: "Limpieza",
    store: "Hiper Sur",
    message: "Cambió el contenido neto: 750 → 700 ml",
    triggered_at: "2025-11-05T14:30:00",
    status: "active",
    new: true,
  },
  {
    id: "a-003",
    type: "promo",
    product: "Yerba mate",
    cat: "Almacén",
    store: "Hiper Sur",
    message: "Nueva promo: $4.890 (reg. $5.600), descuento del 12,7 %",
    triggered_at: "2025-11-04T09:00:00",
    status: "active",
    new: true,
  },
  {
    id: "a-004",
    type: "price-spike",
    product: "Aceite de girasol",
    cat: "Almacén",
    store: "Mercado Norte",
    message: "Subió 5,1 % en una captura, por encima del umbral de 2 %",
    triggered_at: "2025-11-03T18:45:00",
    status: "acknowledged",
    new: false,
  },
  {
    id: "a-005",
    type: "reduflation",
    product: "Café molido",
    cat: "Almacén",
    store: "Hiper Sur",
    message: "Cambió el contenido neto: 500 → 450 g",
    triggered_at: "2025-10-25T10:00:00",
    status: "resolved",
    new: false,
  },
  {
    id: "a-006",
    type: "back-in-stock",
    product: "Queso cremoso",
    cat: "Lácteos",
    store: "Mercado Norte",
    message: "Volvió a publicarse luego de 6 días sin dato",
    triggered_at: "2025-10-22T07:30:00",
    status: "resolved",
    new: false,
  },
]

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  "price-spike": "Suba de precio",
  reduflation: "Reduflación",
  promo: "Promoción",
  "back-in-stock": "Reapareció",
}

export const ALERT_TYPE_TONES: Record<AlertType, string> = {
  "price-spike": "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  reduflation: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
  promo: "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]",
  "back-in-stock": "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
}

export const STATUS_LABELS: Record<AlertStatus, string> = {
  active: "Activa",
  acknowledged: "Vista",
  resolved: "Resuelta",
}

export const STATUS_TONES: Record<AlertStatus, string> = {
  active: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  acknowledged: "border-[#e0e0e0] bg-[#f4f4f5] text-[#3f3f46]",
  resolved: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
}
