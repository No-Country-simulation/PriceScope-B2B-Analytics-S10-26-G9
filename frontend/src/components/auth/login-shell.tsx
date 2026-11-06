import * as React from "react"

import { BrandLogo } from "@/components/auth/brand-logo"

// Layout de dos columnas para UX03 · Ingresar: formulario a la izquierda,
// panel oscuro de marketing a la derecha.
export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-wrap bg-white">
      {/* Columna del formulario */}
      <div className="flex min-w-0 flex-1 basis-[480px] flex-col px-8 py-8 md:px-10">
        <BrandLogo />
        <div className="flex flex-1 items-center justify-center py-10">
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Las cuentas las crea el equipo de PriceScope después de la demo.
        </p>
      </div>

      {/* Panel oscuro */}
      <div className="flex min-w-0 flex-1 basis-[480px] flex-col justify-between gap-8 bg-[#18181b] p-10 text-[#fafafa]">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-[26px] items-center rounded-full border border-[#3f3f46] px-2.5 text-xs text-[#d4d4d8]">
            Actualización diaria
          </span>
          <span className="inline-flex h-[26px] items-center rounded-full border border-[#3f3f46] px-2.5 text-xs text-[#d4d4d8]">
            Oficial y blue con hora
          </span>
        </div>

        {/* Card del gráfico */}
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#3f3f46] bg-[#27272a] p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[#a1a1aa]">
              Brecha precios vs dólar blue
            </span>
            <span className="font-mono text-[22px] font-semibold tabular-nums text-[#fca5a5]">
              +3,6 p.p.
            </span>
          </div>
          <svg
            viewBox="0 0 400 140"
            className="h-auto w-full"
            aria-hidden="true"
          >
            <line x1="0" x2="400" y1="130" y2="130" stroke="#3f3f46" />
            <path
              d="M0 125 L40 120 L80 117 L120 108 L160 104 L200 92 L240 86 L280 74 L320 66 L360 52 L400 40"
              fill="none"
              stroke="#fafafa"
              strokeWidth="2.5"
            />
            <path
              d="M0 125 L40 122 L80 118 L120 114 L160 108 L200 100 L240 96 L280 88 L320 80 L360 70 L400 62"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          </svg>
          <div className="flex gap-4 text-xs text-[#d4d4d8]">
            <span>— Índice de precios</span>
            <span className="text-[#fbbf24]">- - Dólar blue</span>
          </div>
        </div>

        {/* Texto de marketing */}
        <div className="flex flex-col gap-2">
          <p className="text-[22px] font-medium leading-[1.35] tracking-[-0.01em]">
            Inflación real en pesos y en dólares, de las tiendas que elegiste
            monitorear.
          </p>
          <p className="text-sm text-[#a1a1aa]">
            Promociones fuera del índice · reduflación detectada · comparación
            entre tiendas.
          </p>
        </div>
      </div>
    </div>
  )
}
