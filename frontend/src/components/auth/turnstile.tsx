"use client"

import * as React from "react"
import Script from "next/script"

// Cloudflare requires api.js to be loaded from this exact URL: proxying or
// caching it breaks the widget when they ship updates.
const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type TurnstileOptions = {
  sitekey: string
  theme?: "light" | "dark" | "auto"
  size?: "normal" | "flexible" | "compact"
  language?: string
  callback?: (token: string) => void
  "expired-callback"?: () => void
  "error-callback"?: () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string
      remove: (widgetId: string) => void
    }
  }
}

type TurnstileProps = {
  siteKey: string
  // Receives the token once the challenge passes, and null when it expires
  // or fails so the form can block submission again.
  onToken: (token: string | null) => void
}

export function Turnstile({ siteKey, onToken }: TurnstileProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const widgetRef = React.useRef<string | null>(null)
  // Read through a ref so a new callback identity doesn't re-render the
  // widget and make the visitor solve it again.
  const onTokenRef = React.useRef(onToken)
  React.useEffect(() => {
    onTokenRef.current = onToken
  })

  const [scriptReady, setScriptReady] = React.useState(
    () => typeof window !== "undefined" && Boolean(window.turnstile)
  )

  React.useEffect(() => {
    const container = containerRef.current
    if (!scriptReady || !container || !window.turnstile) return
    widgetRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      // The app has no dark mode, so don't follow the OS theme.
      theme: "light",
      size: "flexible",
      language: "es",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    })
    return () => {
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [scriptReady, siteKey])

  return (
    <>
      <Script src={SCRIPT_URL} onReady={() => setScriptReady(true)} />
      {/* Fixed to the widget's height: the inline iframe otherwise adds
          line-height below it and the gap under it grows. */}
      <div ref={containerRef} className="h-[65px]" />
    </>
  )
}
