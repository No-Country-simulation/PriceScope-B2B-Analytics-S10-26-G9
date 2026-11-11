"use client"

import * as React from "react"

import {
  ApiError,
  apiFetch,
  type CurrentUser,
  type ProfileDetails,
  type PasswordChange,
  type AccountDeactivation,
  type Role,
  type TokenOutput,
} from "@/lib/api"

// Where each role lands after logging in: admins go to the backoffice,
// everyone else to the client app under /user.
export const HOME_BY_ROLE: Record<Role, string> = {
  admin: "/admin",
  client: "/user",
}

export const SESSION_EXPIRED_PARAM = "motivo=sesion-vencida"

type Status = "loading" | "authenticated" | "anonymous"
type SessionNotice = "contrasena-actualizada" | "cuenta-desactivada" | null

type AuthContextValue = {
  status: Status
  user: CurrentUser | null
  // True when a session we had stopped being accepted (inactivity or
  // expiry), as opposed to never having logged in.
  expired: boolean
  sessionNotice: SessionNotice
  login: (email: string, password: string) => Promise<CurrentUser>
  logout: () => Promise<void>
  request: <T>(path: string, init?: RequestInit) => Promise<T>
  updateProfile: (profile: ProfileDetails) => Promise<void>
  changePassword: (data: PasswordChange) => Promise<void>
  deactivateAccount: (data: AccountDeactivation) => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

// The backend rotates the refresh token on every call and rejects the old
// one, so concurrent refreshes (two requests hitting 401 at once, or React
// running an effect twice in development) must share a single call.
let refreshInFlight: Promise<TokenOutput | null> | null = null

function refreshAccess(): Promise<TokenOutput | null> {
  refreshInFlight ??= apiFetch<TokenOutput>("/auth/refresh", { method: "POST" })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const tokenRef = React.useRef<string | null>(null)
  const [status, setStatus] = React.useState<Status>("loading")
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [expired, setExpired] = React.useState(false)
  const [sessionNotice, setSessionNotice] = React.useState<SessionNotice>(null)
  // Settles once the session from a previous visit has been restored (or
  // found missing). request() waits on it, so pages can mount and start
  // loading before the session is known.
  const [ready] = React.useState(() => {
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))
    return { promise, resolve }
  })

  React.useEffect(() => {
    let cancelled = false
    refreshAccess()
      .then(async (token) => {
        if (!token) return null
        tokenRef.current = token.access_token
        return apiFetch<CurrentUser>("/auth/me", { token: token.access_token })
      })
      .catch(() => null)
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus(me ? "authenticated" : "anonymous")
        ready.resolve()
      })
    return () => {
      cancelled = true
    }
  }, [ready])

  const actions = React.useMemo(() => {
    async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
      await ready.promise
      // No session at all: fail without touching `expired`, which is only for
      // sessions that stopped being accepted.
      if (!tokenRef.current) throw new ApiError(401, "No autenticado")
      try {
        return await apiFetch<T>(path, { ...init, token: tokenRef.current })
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error
        const fresh = await refreshAccess()
        if (!fresh) {
          tokenRef.current = null
          setUser(null)
          setExpired(true)
          setStatus("anonymous")
          throw error
        }
        tokenRef.current = fresh.access_token
        return apiFetch<T>(path, { ...init, token: fresh.access_token })
      }
    }

    async function login(email: string, password: string) {
      const token = await apiFetch<TokenOutput>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      tokenRef.current = token.access_token
      const me = await apiFetch<CurrentUser>("/auth/me", {
        token: token.access_token,
      })
      setUser(me)
      setExpired(false)
      setSessionNotice(null)
      setStatus("authenticated")
      return me
    }

    async function logout() {
      try {
        // Through request() so an expired access token is refreshed first and
        // the backend can revoke the session and clear the refresh cookie.
        await request<void>("/auth/logout", { method: "POST" })
      } catch {
        // The session may already be gone; logging out locally is enough.
      }
      tokenRef.current = null
      setUser(null)
      setExpired(false)
      setSessionNotice(null)
      setStatus("anonymous")
    }

    async function updateProfile(profile: ProfileDetails) {
      const updated = await request<ProfileDetails>("/account/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      })
      // El menú y la ficha comparten los datos devueltos por el servidor.
      setUser((current) => current ? { ...current, ...updated } : null)
    }

    function endRevokedSession(notice: SessionNotice) {
      // La API ya revocó todas las sesiones y borró la cookie de refresco.
      // No llamar a logout(): intentaría refrescar una sesión ya revocada.
      tokenRef.current = null
      setUser(null)
      setExpired(false)
      setSessionNotice(notice)
      setStatus("anonymous")
    }

    async function changePassword(data: PasswordChange) {
      await request<{ message: string }>("/account/password", {
        method: "PATCH",
        body: JSON.stringify(data),
      })
      endRevokedSession("contrasena-actualizada")
    }

    async function deactivateAccount(data: AccountDeactivation) {
      await request<{ message: string }>("/account", {
        method: "DELETE",
        body: JSON.stringify(data),
      })
      endRevokedSession("cuenta-desactivada")
    }

    return { request, login, logout, updateProfile, changePassword, deactivateAccount }
  }, [ready])

  const value = React.useMemo(
    () => ({ status, user, expired, sessionNotice, ...actions }),
    [status, user, expired, sessionNotice, actions]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

// Only same-site paths are valid redirect targets after login.
export function safeNextPath(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null
}
