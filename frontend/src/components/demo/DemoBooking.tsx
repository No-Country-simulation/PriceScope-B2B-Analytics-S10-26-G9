"use client";

import { useState } from "react";
import Link from "next/link";

const DAYS = [
  "Jueves 22/10",
  "Viernes 23/10",
  "Lunes 26/10",
  "Martes 27/10",
  "Miércoles 28/10",
];
const SLOTS = ["10:00", "11:30", "15:00", "16:30"];
const ORG_TYPES = [
  "Cadena minorista",
  "Fondo de inversión",
  "Medio de comunicación",
  "Otro",
];
const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function DemoBooking() {
  const [step, setStep] = useState(1);
  const [tried, setTried] = useState(false);
  const [day, setDay] = useState(-1);
  const [time, setTime] = useState(-1);
  const [f, setF] = useState({
    empresa: "",
    nombre: "",
    correo: "",
    tipo: ORG_TYPES[0],
  });

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<{ value: string }>) =>
      setF((prev) => ({ ...prev, [k]: e.target.value }));

  const okMail = MAIL_RE.test(f.correo);
  const errEmpresa = tried && !f.empresa.trim();
  const errNombre = tried && !f.nombre.trim();
  const errCorreo = tried && !okMail;

  const next1 = () => {
    if (f.empresa.trim() && f.nombre.trim() && okMail) {
      setStep(2);
      setTried(false);
    } else {
      setTried(true);
    }
  };

  const noDay = day < 0;
  const noSel = day < 0 || time < 0;

  return (
    <section className="card flex min-w-[360px] flex-1 basis-[460px] flex-col gap-5 p-7">
      <div className="stepper">
        <span className={`stp ${step === 1 ? "on" : ""}`}>
          <i>1</i>Tus datos
        </span>
        <span className="muted">›</span>
        <span className={`stp ${step === 2 ? "on" : ""}`}>
          <i>2</i>Fecha y hora
        </span>
        <span className="muted">›</span>
        <span className={`stp ${step === 3 ? "on" : ""}`}>
          <i>3</i>Confirmación
        </span>
      </div>

      {step === 1 && (
        <div className="flex flex-col">
          <div className="fld">
            <label className="lb" htmlFor="d-emp">
              Empresa
            </label>
            <input
              id="d-emp"
              className="inp"
              value={f.empresa}
              onChange={set("empresa")}
              placeholder="Nombre de tu empresa"
            />
            {errEmpresa && (
              <div className="err" role="alert">
                Contanos en qué empresa trabajás.
              </div>
            )}
          </div>
          <div className="fld">
            <label className="lb" htmlFor="d-nom">
              Nombre y apellido
            </label>
            <input
              id="d-nom"
              className="inp"
              value={f.nombre}
              onChange={set("nombre")}
              placeholder="Nombre y apellido"
            />
            {errNombre && (
              <div className="err" role="alert">
                Ingresá tu nombre.
              </div>
            )}
          </div>
          <div className="fld">
            <label className="lb" htmlFor="d-mail">
              Correo laboral
            </label>
            <input
              id="d-mail"
              className="inp"
              type="email"
              value={f.correo}
              onChange={set("correo")}
              placeholder="nombre@empresa.com"
            />
            {errCorreo && (
              <div className="err" role="alert">
                Revisá el correo: tiene que tener formato nombre@empresa.com.
              </div>
            )}
          </div>
          <div className="fld">
            <label className="lb" htmlFor="d-tipo">
              Tipo de organización
            </label>
            <select
              id="d-tipo"
              className="inp"
              value={f.tipo}
              onChange={set("tipo")}
            >
              {ORG_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label className="lb" htmlFor="d-com">
              Comentario{" "}
              <span className="muted" style={{ fontWeight: 400 }}>
                (opcional)
              </span>
            </label>
            <textarea
              id="d-com"
              className="inp"
              placeholder="¿Qué categorías te interesan?"
            />
          </div>
          <button className="btn p lg" onClick={next1}>
            Elegir fecha y hora
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-[18px]">
          <div>
            <div className="lb">Elegí un día</div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={`chip ${day === i ? "on" : ""}`}
                  onClick={() => {
                    setDay(i);
                    setTime(-1);
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="lb">
              Horarios disponibles{" "}
              <span className="muted" style={{ fontWeight: 400 }}>
                · hora de Buenos Aires
              </span>
            </div>
            {noDay ? (
              <p className="hint">Elegí primero un día para ver los horarios.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((s, i) => (
                  <button
                    key={s}
                    className={`chip ${time === i ? "on" : ""}`}
                    disabled={i === day % 4}
                    onClick={() => setTime(i)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className="btn" onClick={() => setStep(1)}>
              Volver
            </button>
            <button
              className="btn p"
              disabled={noSel}
              onClick={() => setStep(3)}
            >
              Confirmar demo
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-start gap-3.5">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--dnb)", color: "var(--dn)" }}
          >
            <svg
              className="ic"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{ width: 24, height: 24 }}
            >
              <path d="M5 12l4 4 10-10" />
            </svg>
          </span>
          <h2 className="h3" style={{ fontSize: 22 }}>
            ¡Listo, tu demo está agendada!
          </h2>
          <div
            className="card pad w-full"
            style={{ background: "#F8F9FB" }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Fecha y hora
            </div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {DAYS[day]} · {SLOTS[time]} h
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {f.nombre} · {f.empresa}
            </div>
          </div>
          <p className="muted">
            Te enviamos la confirmación a{" "}
            <b style={{ color: "var(--text)" }}>{f.correo}</b>.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/" className="btn">
              Volver al inicio
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
