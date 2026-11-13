"use client"

import * as React from "react"

import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"

/** GET `path` with the session token. `null` skips the request.
    Data from a previous path (or load) stays on screen while the new one arrives. */
export function useApi<T>(path: string | null) {
  const { request } = useAuth()
  const [version, setVersion] = React.useState(0)
  const [state, setState] = React.useState<{
    key: string | null
    data: T | null
    error: ApiError | Error | null
  }>({ key: null, data: null, error: null })
  const key = path === null ? null : `${version}:${path}`

  React.useEffect(() => {
    if (!path || !key) return
    let cancelled = false
    request<T>(path)
      .then((data) => { if (!cancelled) setState({ key, data, error: null }) })
      .catch((error) => { if (!cancelled) setState({ key, data: null, error }) })
    return () => { cancelled = true }
  }, [request, path, key])

  const reload = React.useCallback(() => setVersion((n) => n + 1), [])
  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: key !== null && state.key !== key,
    reload,
  }
}

// The alerts screen and the header bell read the same data: whoever changes it
// (marks seen, deletes a rule) tells the others to reload.
const ALERTS_CHANGED = "pricescope:alerts-changed"

export function notifyAlertsChanged() {
  window.dispatchEvent(new Event(ALERTS_CHANGED))
}

export function useOnAlertsChanged(callback: () => void) {
  React.useEffect(() => {
    window.addEventListener(ALERTS_CHANGED, callback)
    return () => window.removeEventListener(ALERTS_CHANGED, callback)
  }, [callback])
}
