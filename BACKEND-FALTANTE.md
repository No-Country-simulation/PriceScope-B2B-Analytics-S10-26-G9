# Backend que le falta al frontend

Relevamiento al 12/11/2026, rama `feat/backend-datos-reales`. Varias pantallas del front ya están maquetadas pero muestran **datos de muestra** (archivos `data.ts` y `lib/quotes.ts`). Este documento lista, pantalla por pantalla, qué endpoint falta, qué hay que agregar al modelo y en qué orden conviene hacerlo.

Convenciones: las mismas que ya usa `backend/` (FastAPI async, SQLAlchemy 2, Alembic, ARQ, `services/` sin HTTP, `api/` sin reglas de negocio, prefijo `/api/v1`, esquema en inglés).

## 1. Resumen

| Pantalla | Ruta del front | Fuente actual | Backend | Estado |
| --- | --- | --- | --- | --- |
| Login, recuperar, definir contraseña | `/ingresar`, `/recuperar`, … | API | `/auth/*` | ✅ Conectada |
| Solicitar demo | `/demo` | API | `POST /demo/requests` | ✅ Conectada |
| Mi cuenta | `/user/perfil` | API | `/account/*` | ✅ Conectada |
| Admin · Solicitudes, Usuarios | `/admin/solicitudes`, `/admin/usuarios` | API | `/admin/demo-requests`, `/admin/users` | ✅ Conectada |
| ~~**Cotización del dólar** (sidebar)~~ | todas las de `/user` | API | `GET /rates/latest`, `GET /rates/history` | ✅ Conectada (PR 2) |
| ~~**Matriz de precios**~~ | `/user/matriz` | API | `GET /matrix` | ✅ Conectada (PR 3) |
| ~~**Ficha de producto**~~ | `/user/producto?id=…` | API | `GET /products/{id}`, `/history`, `GET /products` | ✅ Conectada (PR 4) |
| ~~**Dashboard**~~ | `/user/dashboard` | API | `GET /dashboard`, `GET /dashboard/options` | ✅ Conectada (PR 5) |
| ~~**Alertas y reglas**~~ | `/user/alertas`, `/user/regla-nueva`, campana | API | `/alert-rules/*`, `/alerts/*`, tarea `evaluate_alert_rules` | ✅ Conectada (PR 6), ver [ALERTAS-BACKEND.md](ALERTAS-BACKEND.md) |
| **Curaduría** | `/admin/curaduria` | `curaduria/data.ts` | — | ❌ Falta todo |
| **Operación** | `/admin/operacion` | `operacion/data.ts` | `GET /admin/scraping/runs`, `POST /admin/scraping/run` **existen** | 🟡 Falta resumen por tienda y log de errores |

## 2. Dependencias transversales

Bloquean varias pantallas a la vez. Conviene resolverlas primero.

### ~~2.1 Categoría del producto canónico~~ ✅

El dashboard, la matriz, la ficha y las alertas filtran y agrupan por categoría (Almacén, Bebidas, Lácteos, Limpieza, Electro, Indumentaria). ~~Hoy `canonical_products` solo tiene `ean` y `name`~~; `listings.source_category` guarda la categoría tal como la publica cada tienda (`"Almacén > Infusiones"`, `"Electro > TV"`).

**Hecho (PR 1):**

- Enum `ProductCategory` (`almacen`, `bebidas`, `lacteos`, `limpieza`, `electro`, `indumentaria`) y columna `canonical_products.category` (VARCHAR + CHECK, como `StoreCategory`). Se eligió enum y no tabla porque las 6 categorías son fijas y así no hay que sembrar nada; los colores quedan en el front.
- `services/catalog.classify_category` mapea el árbol de la tienda (`"/Almacén/Infusiones/"`, `"Electro > TV"`) por palabras clave. Gana el segmento más alto, salvo que sea Almacén y haya uno más específico abajo (`"/Almacen/Lacteos/"` → Lácteos). Lo que no matchea queda `null` (Curaduría).

### ~~2.2 Datos del canónico que muestra el front~~ ✅

La matriz y la ficha muestran **marca** y **formato** (`"500 g"`, `"talle 42"`, `'50"'`). Agregar a `canonical_products`:

- ~~`brand` `String(120)` nullable.~~
- ~~`content` `String(40)` nullable (texto para mostrar) + `grammage` `Numeric(12,3)` y `unit` `String(10)` nullable (para el precio por gramo).~~

**Hecho (PR 1):** VTEX trae `measurementUnit = "un"` casi siempre, así que el contenido neto se lee del nombre (`services/catalog.parse_net_content`: `"x450g"`, `"1,5 L"`, `"750 cc"`). `record_observation` lo guarda en cada `prices.grammage/unit` y, junto con la marca (`brand` de VTEX) y la categoría, en el canónico. El canónico solo completa los campos vacíos: nunca pisa un valor ya cargado o curado. Para los canónicos existentes: `uv run python -m scripts.backfill_catalog` (la marca se completa en la próxima extracción).

### ~~2.3 Tiendas del cliente~~ ✅

Varias pantallas listan las tiendas del usuario (columnas de la matriz, filtro del dashboard, selector de la regla). `/auth/me` devuelve solo `store_ids`. Hace falta el nombre:

- ~~`GET /stores` → `[{ id, slug, name, category }]` con las tiendas visibles para el usuario.~~ **Hecho (PR 1)**, admin ve todas. Conectado en Mi cuenta → Tiendas asignadas (`client-profile.tsx`), que antes solo mostraba la cantidad.

### ~~2.4 Reduflación~~ ✅

La matriz, la ficha y las alertas marcan cuando una tienda achica el contenido neto (`"500 → 450 g"`). ~~`MatrixRowOutput.shrinkflation` hoy es siempre `false`.~~

- ~~Depende de 2.2: con `prices.grammage` poblado, se detecta comparando el último gramaje de cada `listing` con el anterior distinto.~~ **Hecho (PR 3)** en `services/matrix._shrinkflation`: últimos 90 días, misma unidad, contenido actual menor que uno anterior. Cuenta también unidades (`15 → 12 u`).
- ~~Se expone en la matriz (por celda) y en la ficha (marca en el gráfico).~~ ✅ **Hecho (PR 4):** `services/shrinkflation.shrinkflation_by_listing`, compartido por la matriz y la ficha.

### ~~2.5 Índice de precios por categoría (base del dashboard)~~ ✅

> **Decisión (PR 3):** la matriz calcula la variación de 30 días con consultas directas (último precio regular antes del corte), sin continuous aggregate: los tests arman el esquema con `create_all` y no podrían probarlo. El continuous aggregate queda para el dashboard (PR 5), si hace falta por rendimiento.

El dashboard necesita una serie diaria por categoría y tienda. Calcularla en cada request sobre la hypertable `prices` puede ser caro; proponemos un **continuous aggregate** de TimescaleDB:

```sql
-- precio regular diario por canónico y tienda (ignora promos, ver §4 de la consigna)
CREATE MATERIALIZED VIEW daily_prices
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', captured_at) AS day,
       listing_id,
       last(coalesce(regular_price, local_price), captured_at) AS regular_price,
       last(local_price, captured_at)  AS price,
       last(price_usd_official, captured_at) AS usd_official,
       last(price_usd_blue, captured_at)     AS usd_blue
FROM prices
GROUP BY day, listing_id;
```

Con eso, el índice de una categoría entre `start` y `end` es la media (geométrica o ponderada por cantidad de productos) de `precio_end / precio_start` de los canónicos que tienen precio en ambas fechas. Usar el **precio regular**, no el de promo, para que una oferta temporal no distorsione la inflación base.

**Hecho (PR 5)**, sin continuous aggregate (misma razón que la matriz). `services/dashboard.py` arma un índice **Jevons encadenado diario** por categoría:

- Cada día el índice se mueve según la media geométrica de la variación día a día de cada publicación (`listing`), con el **precio regular** (`coalesce(regular_price, local_price)`).
- Si los dos días publican contenido neto en la misma unidad, compara **precio por gramo/ml/unidad**: la reduflación cuenta como suba.
- Una publicación arrastra su último precio hasta 7 días (el scraper puede saltear un día); después sale del índice hasta que vuelve. Los productos nuevos entran sin mover el índice.
- Variaciones diarias mayores a ×3 o menores a ÷3 se descartan como error de scraping.
- Índice general = promedio de los índices por categoría ponderado por cantidad de productos.

Si con un catálogo grande se pone lento, leer los precios diarios desde el continuous aggregate de arriba en vez de `prices`.

### ~~2.6 Cotizaciones históricas~~ ✅

El dashboard y la ficha grafican el dólar día a día. `exchange_rates` ya es hypertable y se llena cada hora (`cron(ingest_rates)`). ~~Falta un endpoint de lectura para el cliente (ver §3.1).~~ **Hecho (PR 2):** `GET /rates/history`.

## 3. Pantalla por pantalla

### ~~3.1 Cotización del dólar (sidebar del cliente)~~ ✅

**Front:** `components/cliente/quotes-card.tsx` (lee `SNAPSHOT_QUOTES`), `lib/quotes.ts` (`QUOTES`, usado por la matriz y la ficha para pasar ARS → USD).

**Hecho (PR 2):**

| Endpoint | Respuesta |
| --- | --- |
| ~~`GET /rates/latest` (cualquier usuario logueado)~~ ✅ | `{ official: { source, buy, sell, quoted_at }, blue: {…}, gap_pct }` (`null` si no hay cotización) |
| ~~`GET /rates/history?type=blue&start=&end=`~~ ✅ | `[{ date, sell }]`, último valor de cada día en hora argentina. Por defecto, últimos 30 días; máximo 366 |

~~**Front a cambiar:** `quotes-card.tsx` y `lib/quotes.ts` pasan a leer de la API (hook `useRates()`).~~ ✅ `lib/rates.tsx` (`RatesProvider` en `ClientShell`, refresca cada 30 min; `useRates()` y `useQuoteValues()`). La tarjeta del sidebar y el selector de cotización de la matriz ya usan valores reales.

~~Queda: `SNAPSHOT_QUOTES` sigue anclando los datos de muestra del dashboard (PR 5).~~ ✅ Se borró en el PR 5: el selector de cotización del dashboard usa `useQuoteValues()`. ~~`QUOTES` en la ficha~~ ✅ la ficha ya usa la cotización de cada captura (PR 4).

### ~~3.2 Matriz de precios (`/user/matriz`)~~ ✅

**Front:** `components/matriz/price-matrix.tsx` + `matriz/data.ts`.

~~**Ya existe:** `GET /matrix?currency=&rate=&q=&min_stores=&page=&size=` con último precio por tienda, promo, disponibilidad y spread.~~

~~**Lo que el front usa y la API no da:**~~ ✅ Todo hecho en el PR 3:

| Dato del front | Qué agregar |
| --- | --- |
| ~~`cat` y filtro por categoría~~ ✅ | `category` en cada fila y parámetro `category=` |
| ~~`size` (formato)~~ ✅ | `content` (canónico) y `content` por celda (lo que publica cada tienda) |
| ~~`v`: variación de 30 días y orden por variación~~ ✅ | `variation_30d` (promedio por tienda del precio regular, sin promos, vs. el último de hace 30 días; `null` sin historial) y `sort=variation\|spread\|name` |
| ~~`redu` por tienda y filtro "Con reduflación"~~ ✅ | `shrinkflation: { before, after, changed_at } \| null` por celda y `signal=promo\|shrinkflation` |
| ~~Columnas = tiendas del usuario~~ ✅ | `stores` |
| ~~Precio en la otra moneda~~ ✅ | `local_price` y `usd_price` por celda (USD con la cotización del momento de la captura) |
| ~~KPIs de la pantalla~~ ✅ | `summary: { products, average_spread, with_promotion, with_shrinkflation }` sobre todo lo visible, antes de filtros |
| ~~`slug` para el link a la ficha~~ ✅ | `/user/producto?id=<uuid>` |

~~**Front a cambiar:** reemplazar `PRODUCTS`/`STORES` por la respuesta paginada; la búsqueda, filtros y orden pasan al servidor.~~ ✅ Búsqueda (nombre, marca o EAN, sin acentos) con espera de 300 ms; el CSV baja todas las filas filtradas (`fetchAllPages`).

**Pendiente:**

- ~~La ficha todavía lee `?p=<slug>` de los datos de muestra: hasta el PR 4, el link desde la matriz abre la ficha de ejemplo.~~ ✅ Resuelto en el PR 4.
- ~~`matriz/data.ts` no se puede borrar todavía.~~ ✅ PR 4: pasó a `alertas/sample-products.ts`, solo para los mocks de alertas (se borra en el PR 6).
- La matriz calcula todo lo visible en cada request y después pagina (para poder ordenar por spread y variación). Alcanza para unos miles de productos; si el catálogo crece, cachear o precalcular.

### ~~3.3 Ficha de producto (`/user/producto`)~~ ✅

**Front:** `components/producto/product-detail.tsx` + `producto/data.ts` (`historyFor()` inventa 365 días de precios).

**Hecho (PR 4):**

| Endpoint | Respuesta |
| --- | --- |
| ~~`GET /products/{id}`~~ ✅ | `{ id, ean, name, brand, content, category, stores: [{ store_slug, store_name, url, local_price, regular_price, is_promo, available, captured_at, usd_official, usd_blue, content, price_per_unit, unit, shrinkflation }] }` |
| ~~`GET /products/{id}/history?days=30\|90\|180\|365&rate=blue`~~ ✅ | `{ rate, start, end, stores, points: [{ date, store_slug, price, regular_price, is_promo, content, usd_price, fx, quoted_at }] }`: último precio de cada tienda y día (hora argentina), con la cotización vigente al capturarlo. Consulta directa a `prices`, sin continuous aggregate |
| ~~`GET /products?q=&category=&exclude=&limit=`~~ ✅ | Búsqueda por nombre, marca o EAN (sin acentos). La usa "Comparar con"; queda lista para el formulario de reglas |

Solo devuelve tiendas visibles para el usuario; si el producto no tiene publicaciones en ninguna, `404`.

~~**Front a cambiar:** `findProduct(slug)` → `GET /products/{id}`; `historyFor()` → `/history`; `compareCandidates()` → `/products?category=`.~~ ✅ `product-detail.tsx` lee `?id=`, con estados de carga, vacío y "no está en tus tiendas". Se borró `producto/data.ts`. La comparación usa los días en que los dos productos tienen precio (base 100 = el primero).

### ~~3.4 Dashboard (`/user/dashboard`)~~ ✅

**Front:** `components/dashboard/dashboard.tsx` y `dashboard-charts.tsx` + ~~`dashboard/data.ts` (`summarize()` y `chartData()` generan todo con fórmulas)~~ `dashboard/filters.ts`.

Filtros que manda el front: `start`, `end`, `stores[]`, `categories[]`, `currency` (`ARS`/`USD`), `quote` (`blue`/`oficial`).

~~**Falta (depende de 2.1, 2.5 y 2.6):**~~ Se resolvió con un solo endpoint (abajo); estos quedan como referencia si hay que separarlo.

| Endpoint | Alimenta | Respuesta |
| --- | --- | --- |
| ~~`GET /dashboard/summary`~~ | 4 KPIs + tabla por categoría + CSV | `{ days, ars, usd, devaluation, gap, rate_from, rate_to, rows: [{ category, color, products, ars, usd, gap }] }` (filas ordenadas por `gap` desc) |
| ~~`GET /dashboard/series`~~ | Gráfico de evolución (índice base 100 + dólar) y gráfico por categoría | `[{ date, ars, usd, rate, categories: { <name>: index } }]` |
| ~~`GET /dashboard/scatter`~~ | Dispersión precio vs. dólar | `[{ category, month, price, fx }]`, un punto por categoría y mes |
| ~~`GET /dashboard/peaks`~~ | "Picos por categoría" y marcas ▼ | `[{ category, date, value }]`: suba de más de 3 % en 7 días del índice ARS |
| ~~`GET /dashboard/options`~~ ✅ | Filtros y fecha máxima | `{ stores, categories, min_date, max_date }` (~~hoy `SNAPSHOT_DATE` está fijo~~) |

~~Alternativa más simple: un solo `GET /dashboard?…` que devuelva `{ summary, series, scatter, peaks }`, que es como lo consume hoy el front (una sola llamada por cambio de filtro). **Recomendado empezar así** y separar solo si el payload pesa.~~ ✅ Elegida.

Definiciones (para que coincidan con lo que muestra el front), ✅ implementadas así:

- `ars`: variación del índice ponderado de precios regulares entre `start` y `end`.
- `devaluation`: `rate_to / rate_from − 1` del dólar elegido.
- `usd`: `(1 + ars) / (rate_to / rate_from) − 1`.
- `gap`: `ars − devaluation`, en puntos porcentuales.
- `products` por categoría: canónicos con precio en las tiendas filtradas.

**Hecho (PR 5)** con la alternativa simple:

| Endpoint | Respuesta |
| --- | --- |
| `GET /dashboard?start=&end=&stores=a,b&categories=x,y&rate=blue\|official` | `{ rate, start, end, summary, series, scatter, peaks }`. `start`/`end` son el primer y último día con precios dentro del rango pedido (el índice arranca ahí). `summary` es `null` si no hay al menos dos días con precios. `usd`, `devaluation` y `gap` son `null` si no hay cotizaciones. Rango máximo 366 días; por defecto, últimos 180 |
| `GET /dashboard/options` | `{ stores: [{ slug, name }], categories, min_date, max_date }` |

- Los índices por categoría de `series` vienen en ARS; el front los pasa a USD con `rate` del día y `summary.rate_from`. Los colores de cada categoría siguen en el front (`lib/categories.ts`).
- `peaks`: la mayor suba en hasta 7 días de cada categoría, si supera 3 %.

~~**Front a cambiar:** `summarize()`/`chartData()` se reemplazan por un fetch; la validación de filtros guardados en `localStorage` usa `options` en vez de las constantes.~~ ✅ Se borró `dashboard/data.ts` (queda `dashboard/filters.ts`). La vista guardada pasó a `v2` (tiendas por slug y categorías por valor de la API). Mientras llega la respuesta de un cambio de filtro se sigue mostrando la anterior, atenuada.

~~**Pendiente:** el botón "Crear alerta de pico" ya pasa `?category=<valor>` (la categoría del pico más alto), pero el formulario de reglas todavía no lo lee (ALERTAS-BACKEND.md §9, PR 6).~~ ✅ El formulario lo lee desde el PR 6.

### ~~3.5 Alertas y reglas~~ ✅

Ya está detallado en [ALERTAS-BACKEND.md](ALERTAS-BACKEND.md). ~~Resumen de lo que falta: servicio `alerts.py`, CRUD de reglas + `preview` + `options`, endpoints de alertas disparadas (`/alerts`, `summary`, `seen`), tarea ARQ `evaluate_alert_rules`. Depende de 2.1 (categorías) y de `GET /products?q=` (§3.3).~~ ✅ **Hecho (PR 6)**: todo eso, más el prellenado del formulario desde la ficha (`?product=`), el dashboard (`?category=`) y la edición (`?rule=`). Detalle y diferencias con el plan en ALERTAS-BACKEND.md.

~~La campana del header (`client-header-actions.tsx`) importa `ALERTS` directo; pasa a `GET /alerts/summary`.~~ ✅ Lee `GET /alerts/summary` y las últimas 5 alertas, cada 5 minutos y al instante cuando la pantalla de Alertas cambia algo.

### 3.6 Curaduría (`/admin/curaduria`)

**Front:** `components/curaduria/curation-board.tsx`, `review-state.ts` + `curaduria/data.ts`. Toda la lógica (cola, decisiones, historial, deshacer) vive en el estado del cliente.

Hoy un `listing` se vincula al canónico **solo si trae EAN** (`record_observation` hace upsert por `ean`). Las publicaciones sin EAN quedan con `canonical_product_id = null` y no aparecen en ningún lado. Curaduría es la cola para resolverlas.

**Modelo nuevo:**

- `listing_matches`: `id`, `listing_id` (unique), `suggested_canonical_id` nullable, `score` `Numeric(4,3)`, `status` (`pending` · `confirmed` · `separated`), `manual` bool, `decided_by`, `decided_at`.
- `curation_events` (historial auditable): `id`, `admin_id`, `action` (`merged` · `confirmed` · `separated` · `chosen` · `created` · `reverted`), `before` y `after` (texto), `payload` JSONB con lo necesario para revertir, `reverted_at`, `reverted_by`.
- Servicio de sugerencias: al guardar un listing sin EAN (o con EAN que no coincide con su nombre), buscar el canónico más parecido con `pg_trgm` (`similarity(name)` + misma marca + mismo contenido) y crear el `listing_match` `pending`.

**Endpoints (`/admin/curation`, solo admin):**

| Endpoint | Acción del front |
| --- | --- |
| `GET /queue?store=&category=` | Cola de pendientes ordenada por manual y luego score ascendente: `[{ id, store, score, manual, listing: {…}, suggested: {…} }]` |
| `POST /queue/{id}/confirm` | "Confirmar mapeo" → `listings.canonical_product_id = suggested` |
| `POST /queue/{id}/separate` | "Separar" → el listing queda sin vínculo |
| `POST /queue/{id}/choose` `{ canonical_id }` | "Elegir otro canónico" (queda pendiente, `manual = true`) |
| `POST /queue/{id}/create` `{ name, brand, content, category, ean? }` | "Crear canónico nuevo" y proponerlo |
| `POST /canonical/merge` `{ source_id, target_id }` | "Unir duplicados": mueve listings, matches y reglas de alerta al principal y borra el duplicado |
| `GET /canonical?q=` | Buscador del diálogo de catálogo |
| `GET /history?limit=` | Tabla de historial |
| `POST /history/{id}/revert` | "Revertir" (solo el último no revertido, igual que el front) |

### 3.7 Operación (`/admin/operacion`)

**Front:** `components/operacion/operation-board.tsx`, `scraper-card.tsx`, `error-log.tsx` + `operacion/data.ts`.

**Ya existe:**

- `GET /admin/scraping/runs?store_slug=&status=&limit=&offset=` (historial).
- `POST /admin/scraping/run` (disparar extracción).
- `GET /admin/scraping/stores/readiness`.

**Lo que el front usa y falta:**

| Dato del front | Qué agregar |
| --- | --- |
| Tarjeta por tienda: estado, última ejecución, duración, productos, esperados, horario | `GET /admin/scraping/overview` → `[{ store_slug, store_name, schedule, last_run: {status, started_at, finished_at, observations_saved}, expected, trend_7d: [int] }]`. `expected` = mediana de `observations_saved` de los últimos 7 runs exitosos; `schedule` sale de los `cron_jobs` del worker (dejarlo en una constante compartida) |
| Barras "últimos 7 días" | `trend_7d` en el mismo endpoint (suma de `observations_saved` por día) |
| "Reintentar" y "Ejecutar todos" | Ya está `POST /admin/scraping/run`; verificar que acepte "todas las tiendas" o hacer N llamadas. El front debe hacer polling de `/runs` hasta que el estado deje de ser `running` |
| Log de errores con tipo (`timeout`, `block`, `markup`, `invalid`), severidad y detalle | `GET /admin/scraping/errors?hours=24\|72\|168&store=&kind=`. Se puede armar desde `scraping_runs.error_code`/`error_message` mapeando códigos a `kind`; para los avisos (reintentos exitosos, precios descartados) hace falta una tabla `scraping_events` (`run_id`, `severity`, `kind`, `message`, `detail`, `created_at`) que escriban los scrapers |

**Nota:** el front de muestra usa tiendas de ejemplo (Supermercado Delta, Hiper Sur, Mercado Norte). Las reales hoy son Carrefour y Jumbo.

## 4. Orden sugerido de PRs

Cada PR deja algo usable y con tests.

1. ~~**Base de catálogo:** enum `ProductCategory` + `canonical_products.category/brand/content/grammage/unit`, categoría y contenido neto automáticos al registrar precios, script de relleno y `GET /stores`. (§2.1–2.3)~~ ✅ Hecho en `feat/backend-datos-reales`.
2. ~~**Cotizaciones para el cliente:** `GET /rates/latest` y `/rates/history`; conectar `quotes-card.tsx` y `lib/quotes.ts`. (§3.1)~~ ✅ Hecho.
3. ~~**Matriz completa:** categoría, contenido, `variation_30d`, filtros y orden en `/matrix`; conectar `/user/matriz`. (§3.2)~~ ✅ Hecho (sin continuous aggregate, ver §2.5).
4. ~~**Ficha de producto:** `/products`, `/products/{id}`, `/products/{id}/history`; reduflación (§2.4); conectar `/user/producto`. (§3.3)~~ ✅ Hecho.
5. ~~**Dashboard:** `GET /dashboard` (summary + series + scatter + peaks + options); conectar `/user/dashboard`. (§3.4)~~ ✅ Hecho (sin continuous aggregate, ver §2.5).
6. ~~**Alertas:** PRs 2 a 5 de [ALERTAS-BACKEND.md](ALERTAS-BACKEND.md) §11. (§3.5)~~ ✅ Hecho.
7. **Operación:** `overview`, `errors` y `scraping_events`; conectar `/admin/operacion`. (§3.7)
8. **Curaduría:** `listing_matches`, `curation_events`, sugerencias con `pg_trgm` y endpoints; conectar `/admin/curaduria`. (§3.6)

Operación (7) no depende de nada y se puede hacer en paralelo con 1–5.

## 5. Problemas encontrados al probar con datos reales

- **Búsqueda con espacios en VTEX:** `POST /admin/scraping/run` con `term` de dos palabras (`"cafe molido"`) devuelve 502 en Carrefour y Jumbo; con una palabra funciona. Viene de `scrapers/vtex_client.py` (parámetro `ft`), no de estos PR. Revisar.
- **Hogar y textil:** las tiendas usan "textil" para blanquería; se sacó de las palabras clave de Indumentaria.

## 6. Del lado del front, al conectar

- Cada `data.ts` de muestra se borra cuando su pantalla queda conectada: ~~`matriz`~~ ✅, ~~`producto`~~ ✅, ~~`dashboard`~~ ✅ (junto con `SNAPSHOT_QUOTES`), ~~`alertas`~~ ✅ (`data.ts`, `rule-data.ts` y `sample-products.ts`), `curaduria`, `operacion`, y `QUOTES` (hoy solo es el valor de respaldo de `useQuoteValues()` mientras carga la cotización).
- Las llamadas van por `lib/api.ts` (ya maneja token y refresh).
- Agregar estados de carga (`Skeleton`) y vacío: con datos reales puede no haber precios para un rango o una tienda.
- ~~El vínculo a la ficha pasa de `?p=<slug>` a `?id=<uuid>`.~~ ✅ Las alertas también linkean a `/user/producto?id=` desde el PR 6.
