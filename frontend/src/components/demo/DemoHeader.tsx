import Link from "next/link";

export function DemoHeader() {
  return (
    <header className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-4 px-8 py-4">
      <Link href="/" className="logo" style={{ color: "#0F1218" }}>
        <span className="lm">
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="M16 16l4 4M8 12l2-2 2 1 2-3" />
          </svg>
        </span>
        PriceScope
      </Link>
      <span className="flex-1" />
      <Link href="/" className="btn g">
        Volver al inicio
      </Link>
      <Link href="/ingresar" className="btn">
        Ingresar
      </Link>
    </header>
  );
}
