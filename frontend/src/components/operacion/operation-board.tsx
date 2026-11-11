"use client"

import * as React from "react"
import {
  CalendarClockIcon,
  CircleAlertIcon,
  PackageIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { KpiCard } from "@/components/admin/kpi-card"
import { PageHeader } from "@/components/admin/page-header"
import { ToneBadge } from "@/components/admin/tone"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCount } from "@/lib/format"

import { ErrorLog } from "./error-log"
import { ScraperCard } from "./scraper-card"
import {
  LOG_ENTRIES,
  SCRAPERS,
  durationOf,
  productsOf,
  type Scraper,
  type ScraperStatus,
} from "./data"

// Una ejecución manual tarda unos minutos; en la maqueta se resuelve solo.
const RUN_MS = 2500

// UX10 · Operación: estado de los scrapers y de la ingesta de cotizaciones.
// Todo el estado vive acá y los datos son de muestra (components/operacion):
// todavía no hay API.
export function OperationBoard() {
  const [statuses, setStatuses] = React.useState<
    Record<string, ScraperStatus>
  >(() => Object.fromEntries(SCRAPERS.map((s) => [s.id, s.status])))
  const [pending, setPending] = React.useState<Scraper | null>(null)
  const [logStore, setLogStore] = React.useState("all")
  const logRef = React.useRef<HTMLDivElement>(null)
  const timers = React.useRef<number[]>([])

  React.useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer))
    },
    []
  )

  const failedScrapers = SCRAPERS.filter((s) => statuses[s.id] === "fail")
  const incident = failedScrapers[0]
  const running = SCRAPERS.some((s) => statuses[s.id] === "run")

  const errors72 = LOG_ENTRIES.filter((entry) => entry.age <= 72)
  const errors24 = LOG_ENTRIES.filter((entry) => entry.age <= 24).length
  const affectedStores = new Set(errors72.map((entry) => entry.store)).size

  const todayProducts = SCRAPERS.reduce(
    (sum, scraper) => sum + (productsOf(scraper, statuses[scraper.id]) ?? 0),
    0
  )
  const expectedProducts = SCRAPERS.reduce(
    (sum, scraper) => sum + scraper.expected,
    0
  )

  function withStatus(
    current: Record<string, ScraperStatus>,
    ids: string[],
    status: ScraperStatus
  ) {
    const next = { ...current }
    ids.forEach((id) => {
      next[id] = status
    })
    return next
  }

  function run(ids: string[], onDone: () => void) {
    setStatuses((current) => withStatus(current, ids, "run"))
    timers.current.push(
      window.setTimeout(() => {
        setStatuses((current) => withStatus(current, ids, "ok"))
        onDone()
      }, RUN_MS)
    )
  }

  function retry(scraper: Scraper) {
    run([scraper.id], () => {
      toast.success(`Terminó la extracción de ${scraper.store}.`, {
        description: `${formatCount(productsOf(scraper, "ok") ?? 0)} productos en ${durationOf(scraper, "ok")}.`,
      })
    })
  }

  function runAll() {
    run(
      SCRAPERS.map((scraper) => scraper.id),
      () => {
        const total = SCRAPERS.reduce(
          (sum, scraper) => sum + (productsOf(scraper, "ok") ?? 0),
          0
        )
        toast.success(`Terminaron las ${SCRAPERS.length} ejecuciones.`, {
          description: `${formatCount(total)} productos en total.`,
        })
      }
    )
  }

  function showLog(store: string) {
    setLogStore(store)
    logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <PageHeader
        title="Operación"
        description="Estado de los scrapers y de la ingesta de cotizaciones."
        badge={
          <ToneBadge tone="neutral" className="font-mono">
            Ingesta 29/10 06:00 · OK
          </ToneBadge>
        }
        actions={
          <Button variant="outline" onClick={runAll} disabled={running}>
            <RefreshCwIcon
              data-icon="inline-start"
              className={running ? "animate-spin" : undefined}
            />
            Ejecutar todo
          </Button>
        }
      />

      {incident && (
        <Alert
          variant="destructive"
          className="border-destructive/30 bg-destructive/5 py-3"
        >
          <CircleAlertIcon />
          <AlertTitle>{incident.store} falló en la última ejecución</AlertTitle>
          <AlertDescription>
            Los clientes con esta tienda ven datos de ayer. {errors24}{" "}
            {errors24 === 1 ? "error" : "errores"} en las últimas 24 h.
          </AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => setPending(incident)}>
              Reintentar
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <KpiCard
          label="Fuentes con fallo"
          value={String(failedScrapers.length)}
          hint={
            failedScrapers.length
              ? `${failedScrapers.map((s) => s.store).join(", ")} · sin datos nuevos`
              : `Las ${SCRAPERS.length} fuentes terminaron bien su última ejecución`
          }
          tone={failedScrapers.length ? "red" : "emerald"}
          icon={<TriangleAlertIcon />}
        />
        <KpiCard
          label="Productos extraídos hoy"
          value={formatCount(todayProducts)}
          hint={`De ${formatCount(expectedProducts)} esperados en ${SCRAPERS.length} tiendas`}
          tone="sky"
          icon={<PackageIcon />}
        />
        <KpiCard
          label="Errores en 72 h"
          value={String(errors72.length)}
          hint={`${affectedStores} ${affectedStores === 1 ? "fuente afectada" : "fuentes afectadas"}`}
          tone="amber"
          icon={<CircleAlertIcon />}
        />
        <KpiCard
          label="Próxima ejecución"
          value="05:00"
          hint="Supermercado Delta · mañana"
          tone="violet"
          icon={<CalendarClockIcon />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {SCRAPERS.map((scraper) => (
          <ScraperCard
            key={scraper.id}
            scraper={scraper}
            status={statuses[scraper.id]}
            onRetry={() => setPending(scraper)}
            onShowLog={() => showLog(scraper.store)}
          />
        ))}
      </div>

      <div ref={logRef}>
        <ErrorLog store={logStore} onStoreChange={setLogStore} />
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿Reintentar la extracción de {pending?.store}?
            </DialogTitle>
            <DialogDescription>
              Se lanza una ejecución manual ahora. Tarda unos minutos y no
              afecta la ejecución programada de mañana.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pending) retry(pending)
                setPending(null)
              }}
            >
              Reintentar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
