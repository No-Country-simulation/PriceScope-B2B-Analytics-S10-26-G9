// Typed client for the PriceScope API. Requests go to /api/v1 on this origin
// and next.config.ts rewrites them to the backend.

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
