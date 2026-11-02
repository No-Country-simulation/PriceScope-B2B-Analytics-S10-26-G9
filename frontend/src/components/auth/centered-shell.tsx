import Link from "next/link"

// Frame shared by the screens opened from an email link (mockup 03b ·
// Definir contraseña): warm paper backdrop, brand pill on top, card below.
// The `.paper-link-screen` class scopes the mint focus ring in globals.css.
export function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-link-screen flex min-h-svh w-full flex-col items-center gap-7 bg-[linear-gradient(180deg,#F5EEE2_0%,#FBF8F3_45%,#F7F6F3_100%)] px-4 py-14 font-[family-name:var(--font-inter)] text-ink">
      <BrandPill />
      <div className="flex w-full max-w-lg flex-col">{children}</div>
    </div>
  )
}

function BrandPill() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-ink py-1.5 pr-5 pl-1.5 text-base font-bold text-white shadow-[0_12px_32px_rgba(28,28,30,0.18)]"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-white">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 17l5-6 4 3 8-9" stroke="#1F8A70" />
          <circle cx="20" cy="5" r="1.6" fill="#F59E0B" />
        </svg>
      </span>
      PriceScope
    </Link>
  )
}
