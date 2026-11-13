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
import { shareOperationOverview } from "@/components/admin/operation-status"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ApiError,
  type OperationError,
  type OperationOverview,
  type StoreOverview,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatCount, formatQuoteTime } from "@/lib/format"
import { useApi } from "@/lib/use-api"

import { ErrorLog } from "./error-log"
import { pickedUp, statusOf } from "./labels"
import { RatesPanel } from "./rates-panel"
import { ScraperCard } from "./scraper-card"

// While a run is queued or in progress the screen checks every few seconds;
// otherwise once a minute, to catch the scheduled runs.
const FAST_POLL_MS = 5_000
const SLOW_POLL_MS = 60_000

// UX10 · Operación: estado de los scrapers y de la ingesta de cotizaciones.
export function OperationBoard() {
  const { request } = useAuth()
  const overview = useApi<OperationOverview>("/admin/scraping/overview")
  const errors72 = useApi<OperationError[]>("/admin/scraping/errors?hours=72")
  const errors24 = useApi<OperationError[]>("/admin/scraping/errors?hours=24")
  const [queued, setQueued] = React.useState<Record<string, string>>({})
  const [pending, setPending] = React.useState<StoreOverview | null>(null)
  const [logStore, setLogStore] = React.useState("all")
  const [logVersion, setLogVersion] = React.useState(0)
  const logRef = React.useRef<HTMLDivElement>(null)

  const stores = React.useMemo(
    () => overview.data?.stores ?? [],
    [overview.data]
  )
  const statuses = Object.fromEntries(
    stores.map((store) => [
      store.store_slug,
      statusOf(store, queued[store.store_slug]),
    ])
  )
  const busy = Object.values(statuses).some(
    (status) => status === "run" || status === "queued"
  )

  // Keep the sidebar badge in step with this screen's faster polling.
  React.useEffect(() => {
    if (overview.data) shareOperationOverview(overview.data)
  }, [overview.data])

  const { reload: reloadOverview } = overview
  const { reload: reloadErrors72 } = errors72
  const { reload: reloadErrors24 } = errors24
  const reloadErrors = React.useCallback(() => {
    reloadErrors72()
    reloadErrors24()
  }, [reloadErrors72, reloadErrors24])
  React.useEffect(() => {
    const timer = window.setInterval(
      reloadOverview,
      busy ? FAST_POLL_MS : SLOW_POLL_MS
    )
    return () => window.clearInterval(timer)
  }, [busy, reloadOverview])

  // A requested run that the worker picked up and finished: tell the admin.
  React.useEffect(() => {
    const done = stores.filter((store) => {
      const at = queued[store.store_slug]
      return at && pickedUp(store, at) && store.last_run?.status !== "running"
    })
    if (!done.length) return
    for (const store of done) {
      const run = store.last_run!
      if (run.status === "success") {
        toast.success(`Terminó la extracción de ${store.store_name}.`, {
          description: `${formatCount(run.observations_saved)} precios guardados.`,
        })
      } else {
        toast.error(`Falló la extracción de ${store.store_name}.`, {
          description: "Revisá el log de errores.",
        })
      }
    }
    // Sincroniza la cola local con lo que reporta el servidor.
    React.startTransition(() => {
      setQueued((current) => {
        const next = { ...current }
        done.forEach((store) => delete next[store.store_slug])
        return next
      })
      setLogVersion((n) => n + 1)
    })
    reloadErrors()
  }, [stores, queued, reloadErrors])

  async function enqueue(targets: StoreOverview[]) {
    const results = await Promise.allSettled(
      targets.map((store) =>
        request<{ store_slug: string; queued_at: string }>(
          `/admin/scraping/stores/${store.store_slug}/enqueue`,
          { method: "POST" }
        )
      )
    )
    const accepted: Record<string, string> = {}
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        accepted[result.value.store_slug] = result.value.queued_at
      } else {
        const reason = result.reason
        toast.error(`No se pudo encolar ${targets[index].store_name}.`, {
          description: reason instanceof ApiError ? reason.message : undefined,
        })
      }
    })
    if (Object.keys(accepted).length) {
      setQueued((current) => ({ ...current, ...accepted }))
      toast.info(
        Object.keys(accepted).length === 1
          ? "Extracción en cola. Te avisamos cuando termine."
          : `${Object.keys(accepted).length} extracciones en cola. Te avisamos cuando terminen.`
      )
      reloadOverview()
    }
  }

  function showLog(slug: string) {
    setLogStore(slug)
    logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (overview.error && !overview.data) {
    return (
      <>
        <PageHeader
          title="Operación"
          description="Estado de los scrapers y de la ingesta de cotizaciones."
        />
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>No pudimos cargar el estado de los scrapers.</AlertTitle>
          <AlertDescription>Probá de nuevo en unos minutos.</AlertDescription>
        </Alert>
      </>
    )
  }
  if (!overview.data) return <OperationSkeleton />

  const failed = stores.filter((store) => statuses[store.store_slug] === "fail")
  const incident = failed[0]
  const enqueueable = stores.filter(
    (store) =>
      store.can_enqueue &&
      statuses[store.store_slug] !== "run" &&
      statuses[store.store_slug] !== "queued"
  )
  const errorList = errors72.data ?? []
  const errorCount = errorList.filter(
    (entry) => entry.severity === "error"
  ).length
  const recentFailures = errors24.data?.length ?? 0
  const affectedStores = new Set(errorList.map((entry) => entry.store_slug))
    .size
  const todayProducts = stores.reduce(
    (sum, store) => sum + (store.trend_7d.at(-1)?.products ?? 0),
    0
  )
  const expectedProducts = stores.reduce(
    (sum, store) => sum + (store.expected ?? 0),
    0
  )
  const next = stores
    .filter((store) => store.next_run_at)
    .sort((a, b) => Date.parse(a.next_run_at!) - Date.parse(b.next_run_at!))[0]
  const rates = overview.data.rates

  return (
    <>
      <PageHeader
        title="Operación"
        description="Estado de la ingesta del dólar y de los scrapers."
      />

      <section
        aria-labelledby="operacion-dolar"
        className="flex flex-col gap-3"
      >
        <h2 id="operacion-dolar" className="text-base font-semibold">
          Dólar
        </h2>
        <RatesPanel status={rates} onRefreshed={reloadOverview} />
      </section>

      <section
        aria-labelledby="operacion-scrapers"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="operacion-scrapers" className="text-base font-semibold">
            Scrapers
          </h2>
          <Button
            variant="outline"
            onClick={() => void enqueue(enqueueable)}
            disabled={busy || enqueueable.length === 0}
            title={
              stores.some((store) => store.can_enqueue)
                ? undefined
                : "La extracción programada no está habilitada"
            }
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={busy ? "animate-spin" : undefined}
            />
            Ejecutar todo
          </Button>
        </div>

        {incident && (
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/5 py-3"
          >
            <CircleAlertIcon />
            <AlertTitle>
              {incident.store_name} falló en la última ejecución
            </AlertTitle>
            <AlertDescription>
              {incident.last_success_at
                ? `Los clientes con esta tienda ven precios del ${formatQuoteTime(incident.last_success_at)}.`
                : "Esta tienda todavía no tiene una extracción exitosa."}{" "}
              {recentFailures} {recentFailures === 1 ? "falla" : "fallas"} en
              las últimas 24 h.
            </AlertDescription>
            {incident.can_enqueue && (
              <AlertAction>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setPending(incident)}
                >
                  Reintentar
                </Button>
              </AlertAction>
            )}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <KpiCard
            label="Fuentes con fallo"
            value={String(failed.length)}
            hint={
              failed.length
                ? `${failed.map((store) => store.store_name).join(", ")} · sin datos nuevos`
                : `Las ${stores.length} fuentes terminaron bien su última ejecución`
            }
            tone={failed.length ? "red" : "emerald"}
            icon={<TriangleAlertIcon />}
          />
          <KpiCard
            label="Precios guardados hoy"
            value={formatCount(todayProducts)}
            hint={
              expectedProducts
                ? `De ${formatCount(expectedProducts)} esperados en ${stores.length} tiendas`
                : `En ${stores.length} tiendas`
            }
            tone="sky"
            icon={<PackageIcon />}
          />
          <KpiCard
            label="Fallas en 72 h"
            value={String(errorList.length)}
            hint={
              errorList.length
                ? `${errorCount} sin resolver · ${affectedStores} ${affectedStores === 1 ? "fuente afectada" : "fuentes afectadas"}`
                : "Ninguna fuente falló"
            }
            tone="amber"
            icon={<CircleAlertIcon />}
          />
          <KpiCard
            label="Próxima ejecución"
            value={next ? formatQuoteTime(next.next_run_at!).slice(-5) : "—"}
            hint={
              next
                ? `${next.store_name} · ${formatQuoteTime(next.next_run_at!).slice(0, 5)}`
                : "Sin ejecuciones programadas"
            }
            tone="violet"
            icon={<CalendarClockIcon />}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {stores.map((store) => (
            <ScraperCard
              key={store.store_slug}
              store={store}
              status={statuses[store.store_slug]}
              onRetry={() => setPending(store)}
              onShowLog={() => showLog(store.store_slug)}
            />
          ))}
        </div>

        <div ref={logRef}>
          <ErrorLog
            stores={stores.map((store) => ({
              slug: store.store_slug,
              name: store.store_name,
            }))}
            store={logStore}
            onStoreChange={setLogStore}
            version={logVersion}
          />
        </div>
      </section>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ¿Reintentar la extracción de {pending?.store_name}?
            </DialogTitle>
            <DialogDescription>
              Se encola ahora la misma extracción que corre todos los días.
              Tarda unos minutos y no afecta la ejecución programada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pending) void enqueue([pending])
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

function OperationSkeleton() {
  return (
    <>
      <PageHeader
        title="Operación"
        description="Estado de los scrapers y de la ingesta de cotizaciones."
      />
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </>
  )
}
