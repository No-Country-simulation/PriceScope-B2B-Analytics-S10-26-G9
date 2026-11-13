// Typed client for the PriceScope API. Requests go to /api/v1 on this origin
// and next.config.ts rewrites them to the backend.

import type { ProductCategory } from "@/lib/categories"

export type Role = "client" | "admin"
export type UserStatus = "pending" | "active" | "blocked" | "deactivated"
export type OrganizationType = "retail" | "fund" | "media" | "other"
export type StoreCategory = "supermarket" | "electronics" | "fashion"

export type Page<T> = {
  items: T[]
  total: number
  page: number
  size: number
}

export type TokenOutput = {
  access_token: string
  token_type: string
  expires_in: number
  role: Role
}

export type CurrentUser = {
  id: string
  name: string
  company: string
  email: string
  role: Role
  store_ids: string[]
}

export type ProfileDetails = Pick<CurrentUser, "name" | "company">
export type PasswordChange = { current_password: string; new_password: string }
export type AccountDeactivation = {
  current_password: string
  confirmation: "ELIMINAR MI CUENTA"
}

export type TokenType = "set_password" | "reset_password"

// Answer of /auth/token/verify. email and company only come for a valid link.
export type TokenStatus = {
  status: "valid" | "expired" | "invalid"
  type: TokenType | null
  email: string | null
  company: string | null
}

export type AdminUser = {
  id: string
  name: string
  company: string
  email: string
  role: Role
  status: UserStatus
  last_access_at: string | null
  created_at: string
  store_count: number
}

export type Store = {
  id: string
  name: string
  slug: string
  base_url: string
  category: StoreCategory
  active: boolean
}

// What a client sees of a store (GET /stores): no scraping details.
export type ClientStore = Pick<Store, "id" | "name" | "slug" | "category">

// GET /rates/latest. Decimals come as strings to keep their precision.
export type RateQuote = {
  source: string
  buy: string | null
  sell: string
  quoted_at: string
}

export type LatestRates = {
  official: RateQuote | null
  blue: RateQuote | null
  gap_pct: string | null
}

// GET /matrix. Money comes as decimal strings.
export type MatrixCell = {
  store_slug: string
  price: string | null
  regular_price: string | null
  local_price: string
  usd_price: string | null
  is_promo: boolean
  available: boolean
  captured_at: string
  content: string | null
  shrinkflation: Shrinkflation | null
}

export type MatrixRow = {
  product_id: string
  ean: string
  name: string
  category: ProductCategory | null
  brand: string | null
  content: string | null
  prices: MatrixCell[]
  spread: {
    cheapest_store_slug: string | null
    most_expensive_store_slug: string | null
    percentage: string
  } | null
  variation_30d: string | null
  has_promotion: boolean
  shrinkflation: boolean
}

export type MatrixOutput = Page<MatrixRow> & {
  currency: "ars" | "usd"
  rate: "official" | "blue" | null
  stores: { slug: string; name: string }[]
  summary: {
    products: number
    average_spread: string | null
    with_promotion: number
    with_shrinkflation: number
  }
}

export type Shrinkflation = { before: string; after: string; changed_at: string }

// GET /products and GET /products/{id}.
export type ProductSummary = {
  id: string
  ean: string
  name: string
  brand: string | null
  content: string | null
  category: ProductCategory | null
}

export type ProductStore = {
  store_slug: string
  store_name: string
  url: string
  local_price: string
  regular_price: string
  is_promo: boolean
  available: boolean
  captured_at: string
  usd_official: string | null
  usd_blue: string | null
  content: string | null
  price_per_unit: string | null
  unit: "g" | "ml" | "u" | null
  shrinkflation: Shrinkflation | null
}

export type ProductDetail = ProductSummary & { stores: ProductStore[] }

// GET /products/{id}/history: one point per store and day.
export type ProductHistoryPoint = {
  date: string
  store_slug: string
  price: string
  regular_price: string
  is_promo: boolean
  content: string | null
  usd_price: string | null
  fx: string | null
  quoted_at: string | null
}

export type ProductHistory = {
  rate: "official" | "blue"
  start: string
  end: string
  stores: { slug: string; name: string }[]
  points: ProductHistoryPoint[]
}

// GET /dashboard: price index by category vs. the dollar. Percentages in %.
export type DashboardRow = {
  category: ProductCategory
  products: number
  ars: number
  usd: number | null
  gap: number | null
}

export type DashboardSummary = {
  days: number
  products: number
  ars: number
  usd: number | null
  devaluation: number | null
  gap: number | null
  rate_from: number | null
  rate_to: number | null
  rows: DashboardRow[]
}

export type DashboardPoint = {
  date: string
  ars: number
  usd: number | null
  rate: number | null
  categories: Partial<Record<ProductCategory, number>>
}

export type DashboardData = {
  rate: "official" | "blue"
  start: string | null
  end: string | null
  summary: DashboardSummary | null
  series: DashboardPoint[]
  scatter: { category: ProductCategory; month: string; price: number; fx: number }[]
  peaks: { category: ProductCategory; date: string; value: number }[]
}

export type DashboardOptions = {
  stores: { slug: string; name: string }[]
  categories: ProductCategory[]
  min_date: string | null
  max_date: string | null
}

// Alert rules (/alert-rules) and fired alerts (/alerts). Decimals come as strings.
export type AlertRuleKind = "devaluation" | "milestone"
export type AlertRuleScope = "category" | "product"
export type MilestoneKey = "cyberweek" | "black_friday" | "hot_sale" | "custom"
export type RateType = "official" | "blue"

export type RuleConditions = {
  kind: AlertRuleKind
  scope: AlertRuleScope
  category: ProductCategory | null
  canonical_product_id: string | null
  store_id: string | null
  rate_type: RateType
  threshold_pp: string
  period_days: number | null
  milestone_key: MilestoneKey | null
  starts_on: string | null
  ends_on: string | null
}

export type AlertRuleInput = RuleConditions & {
  name: string
  notify_in_app: boolean
}

export type AlertRule = RuleConditions & {
  id: string
  name: string
  product_name: string | null
  store_name: string | null
  notify_in_app: boolean
  notify_email: boolean
  active: boolean
  phrase: string
  last_fired_at: string | null
  created_at: string
}

export type RulePreview = {
  devaluation_pct: string | null
  products_count: number
  stores_count: number
  evaluated: boolean
  items: {
    canonical_product_id: string | null
    product_name: string
    store_name: string
    variation_pct: string
  }[]
}

export type RuleOptions = {
  stores: { id: string; slug: string; name: string }[]
  categories: ProductCategory[]
  milestones: { key: MilestoneKey; label: string; starts_on: string; ends_on: string }[]
  max_rules: number
}

export type FiredAlert = {
  id: string
  rule_id: string
  rule_name: string
  fired_at: string
  scope_label: string
  phrase: string
  products_count: number
  devaluation_pct: string
  average_pct: string
  seen: boolean
}

export type FiredAlertDetail = FiredAlert & {
  items: {
    canonical_product_id: string | null
    product_name: string
    category: ProductCategory | null
    store_name: string
    price_start: string
    price_end: string
    variation_pct: string
  }[]
}

export type AlertsSummary = {
  unseen: number
  total: number
  active_rules: number
  rules: number
  affected_products: number
  max_gap_pp: string | null
}

// Admin · Operación (/admin/scraping/overview, /errors, /stores/{slug}/enqueue).
export type ScrapingRunStatus = "running" | "success" | "failed"

export type StoreOverview = {
  store_slug: string
  store_name: string
  schedule: string | null
  next_run_at: string | null
  last_run: {
    id: string
    status: ScrapingRunStatus
    started_at: string
    finished_at: string | null
    products_received: number
    observations_saved: number
    error_code: string | null
  } | null
  last_success_at: string | null
  expected: number | null
  trend_7d: { date: string; products: number }[]
  can_enqueue: boolean
}

export type OperationOverview = {
  stores: StoreOverview[]
  rates: {
    last_quoted_at: string | null
    ok: boolean
    source: string | null
    ingestions_24h: number
  }
}

export type OperationErrorKind =
  | "timeout"
  | "network"
  | "block"
  | "server"
  | "markup"
  | "interrupted"
  | "other"

export type OperationError = {
  id: string
  date: string
  store_slug: string
  store_name: string
  kind: OperationErrorKind
  severity: "error" | "warning"
  message: string
  detail: string
}

export type DemoRequest = {
  id: string
  company: string
  name: string
  email: string
  organization_type: OrganizationType
  comment: string | null
  preferred_date: string
  created_at: string
}

const BASE = "/api/v1"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = "No pudimos completar la acción. Probá de nuevo."
  try {
    const body = await res.json()
    if (typeof body.detail === "string") message = body.detail
  } catch {
    // Not JSON (for example, the backend is down and the proxy answered).
  }
  return new ApiError(res.status, message)
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = init
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function query(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  }
  const s = search.toString()
  return s ? `?${s}` : ""
}

const MAX_PAGE_SIZE = 100

// Loads every page of a paginated endpoint. Only for screens that need the
// whole set because the API has no filter or aggregate for what they show.
export async function fetchAllPages<T>(
  request: <R>(path: string) => Promise<R>,
  path: string,
  params: Record<string, string | number | null | undefined> = {}
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const data = await request<Page<T>>(
      `${path}${query({ ...params, page, size: MAX_PAGE_SIZE })}`
    )
    all.push(...data.items)
    if (data.items.length < MAX_PAGE_SIZE || all.length >= data.total) {
      return all
    }
  }
}
