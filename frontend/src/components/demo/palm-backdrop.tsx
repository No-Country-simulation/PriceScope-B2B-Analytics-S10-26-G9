import { cn } from "@/lib/utils"

type Pt = [number, number]

type Frond = {
  base: Pt // fuera del lienzo: la fronda entra desde el borde
  angle: number // grados, 0 = derecha, 90 = abajo
  len: number
  bend: number // cuánto se arquea hacia abajo
  leaflet: number // largo máximo de cada folíolo
  opacity: number
  sway: [string, string] // duración y retraso del vaivén
}

const LEAF = "#2f7d4f"

// Siluetas grandes que entran desde las esquinas; las más tenues quedan detrás.
const FRONDS: Frond[] = [
  { base: [-60, -40], angle: 28, len: 520, bend: 70, leaflet: 150, opacity: 0.1, sway: ["11s", "-2s"] },
  { base: [-80, 240], angle: -8, len: 430, bend: 90, leaflet: 130, opacity: 0.16, sway: ["9s", "-6s"] },
  { base: [-40, 820], angle: -38, len: 470, bend: 60, leaflet: 140, opacity: 0.12, sway: ["10s", "-4s"] },
  { base: [1300, -60], angle: 150, len: 540, bend: 70, leaflet: 155, opacity: 0.12, sway: ["12s", "-1s"] },
  { base: [1320, 300], angle: 186, len: 420, bend: 90, leaflet: 130, opacity: 0.18, sway: ["9.5s", "-3s"] },
  { base: [1290, 830], angle: -142, len: 500, bend: 60, leaflet: 145, opacity: 0.1, sway: ["10.5s", "-7s"] },
  { base: [-30, 60], angle: 52, len: 330, bend: 50, leaflet: 105, opacity: 0.2, sway: ["8s", "-5s"] },
  { base: [1270, 20], angle: 128, len: 340, bend: 50, leaflet: 110, opacity: 0.22, sway: ["8.5s", "-2.5s"] },
]

const r = (n: number) => Math.round(n * 10) / 10
const p = ([x, y]: Pt) => `${r(x)} ${r(y)}`
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k]
const norm = ([x, y]: Pt): Pt => {
  const m = Math.hypot(x, y) || 1
  return [x / m, y / m]
}

function frond(f: Frond) {
  const a = (f.angle * Math.PI) / 180
  const dir: Pt = [Math.cos(a), Math.sin(a)]
  const tip = add(f.base, dir, f.len)
  // La perpendicular que apunta hacia abajo hace que la fronda caiga por su peso.
  let perp: Pt = [-dir[1], dir[0]]
  if (perp[1] < 0) perp = [-perp[0], -perp[1]]
  const ctrl = add(add(f.base, dir, f.len / 2), perp, f.bend)

  const at = (t: number): Pt => {
    const u = 1 - t
    return [
      u * u * f.base[0] + 2 * u * t * ctrl[0] + t * t * tip[0],
      u * u * f.base[1] + 2 * u * t * ctrl[1] + t * t * tip[1],
    ]
  }
  const tangent = (t: number): Pt =>
    norm([
      2 * (1 - t) * (ctrl[0] - f.base[0]) + 2 * t * (tip[0] - ctrl[0]),
      2 * (1 - t) * (ctrl[1] - f.base[1]) + 2 * t * (tip[1] - ctrl[1]),
    ])

  let d = ""
  const count = 24
  for (let i = 0; i < count; i++) {
    const t = 0.08 + (0.9 * i) / (count - 1)
    const o = at(t)
    const td = tangent(t)
    const n: Pt = [-td[1], td[0]]
    // Largos en el primer tercio, se afinan hacia la punta.
    const len = f.leaflet * Math.max(0.22, 1 - Math.abs(t - 0.32) * 1.1)
    for (const s of [-1, 1]) {
      const spread = 0.62 - t * 0.28
      const ld = norm(add([td[0] * Math.cos(spread), td[1] * Math.cos(spread)], n, s * Math.sin(spread)))
      // Cada folíolo cuelga: la punta cae más que el medio.
      const end = add(add(o, ld, len), [0, 1], len * 0.35)
      const mid = add(add(o, ld, len * 0.5), [0, 1], len * 0.06)
      const w: Pt = [-ld[1], ld[0]]
      const c1 = add(mid, w, len * 0.09)
      const c2 = add(mid, w, -len * 0.09)
      d += `M${p(o)}Q${p(c1)} ${p(end)}Q${p(c2)} ${p(o)}Z`
    }
  }

  return { leaflets: d, rachis: `M${p(f.base)}Q${p(ctrl)} ${p(tip)}` }
}

const SHAPES = FRONDS.map((f) => ({ ...f, ...frond(f) }))

/** Fondo de hojas de palmera en silueta, tono sobre tono. Cubre a su contenedor. */
export function PalmBackdrop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1240 780"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full select-none", className)}
    >
      {SHAPES.map((s, i) => (
        <g
          key={i}
          fill={LEAF}
          stroke={LEAF}
          opacity={s.opacity}
          className="animate-sway motion-reduce:animate-none"
          style={{
            transformOrigin: `${s.base[0]}px ${s.base[1]}px`,
            transformBox: "view-box",
            animationDuration: s.sway[0],
            animationDelay: s.sway[1],
          }}
        >
          {/* Mismo color en folíolos y nervio para que se lea como una sola silueta. */}
          <path d={s.leaflets} strokeWidth={0.6} strokeLinejoin="round" />
          <path d={s.rachis} fill="none" strokeWidth={5} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}
