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
| **Cotización del dólar** (sidebar) | todas las de `/user` | `dashboard/data.ts` (`SNAPSHOT_QUOTES`) | Solo existe `GET /admin/rates` (admin) | ❌ Falta endpoint para cliente |
| **Matriz de precios** | `/user/matriz` | `matriz/data.ts` | `GET /matrix` **existe** | 🟡 Falta categoría, variación, reduflación y conectar |
| **Ficha de producto** | `/user/producto?p=…` | `producto/data.ts` | — | ❌ Falta todo |
| **Dashboard** | `/user/dashboard` | `dashboard/data.ts` | — | ❌ Falta todo |
| **Alertas y reglas** | `/user/alertas`, `/user/regla-nueva`, campana | `alertas/data.ts`, `rule-data.ts` | Solo tablas | ❌ Ver [ALERTAS-BACKEND.md](ALERTAS-BACKEND.md) |
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

### 2.4 Reduflación

La matriz, la ficha y las alertas marcan cuando una tienda achica el contenido neto (`"500 → 450 g"`). `MatrixRowOutput.shrinkflation` hoy es siempre `false`.

- Depende de 2.2: con `prices.grammage` poblado, se detecta comparando el último gramaje de cada `listing` con el anterior distinto.
- Servicio `services/shrinkflation.py` → `latest_change(listing_id) -> { before, after, changed_at } | None`.
- Se expone en la matriz (por celda) y en la ficha (marca en el gráfico).

### 2.5 Índice de precios por categoría (base del dashboard)

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

### 2.6 Cotizaciones históricas

El dashboard y la ficha grafican el dólar día a día. `exchange_rates` ya es hypertable y se llena cada hora (`cron(ingest_rates)`). Falta un endpoint de lectura para el cliente (ver §3.1).

## 3. Pantalla por pantalla

### 3.1 Cotización del dólar (sidebar del cliente)

**Front:** `components/cliente/quotes-card.tsx` (lee `SNAPSHOT_QUOTES`), `lib/quotes.ts` (`QUOTES`, usado por la matriz y la ficha para pasar ARS → USD).

**Falta:**

| Endpoint | Respuesta |
| --- | --- |
| `GET /rates/latest` (cualquier usuario logueado) | `{ official: { sell, quoted_at }, blue: { sell, quoted_at }, gap_pct }` |
| `GET /rates/history?type=blue&start=&end=` | `[{ date, sell }]`, último valor de cada día |

Reusa `services/rates.latest_rates`. El de admin (`GET /admin/rates`) puede quedar como está.

**Front a cambiar:** `quotes-card.tsx` y `lib/quotes.ts` pasan a leer de la API (hook `useRates()`), y se borra `SNAPSHOT_QUOTES`.

### 3.2 Matriz de precios (`/user/matriz`)

**Front:** `components/matriz/price-matrix.tsx` + `matriz/data.ts`.

**Ya existe:** `GET /matrix?currency=&rate=&q=&min_stores=&page=&size=` con último precio por tienda, promo, disponibilidad y spread.

**Lo que el front usa y la API no da:**

| Dato del front | Qué agregar |
| --- | --- |
| `cat` y filtro por categoría | `category` en cada fila y parámetro `category=` (depende de 2.1) |
| `size` (formato) | `content` en cada fila (depende de 2.2) |
| `v`: variación de 30 días y orden por variación | `variation_30d` por fila (precio regular promedio hoy vs. hace 30 días, desde `daily_prices`) y `sort=variation\|spread\|name` |
| `redu` por tienda y filtro "Con reduflación" | `shrinkflation: { before, after } \| null` por celda y `signal=promo\|shrinkflation` (depende de 2.4) |
| Columnas = tiendas del usuario | ✅ ya viene en `stores` |
| `slug` para el link a la ficha | Usar `product_id` en la URL: `/user/producto?id=<uuid>` |

**Front a cambiar:** reemplazar `PRODUCTS`/`STORES` por la respuesta paginada; la búsqueda, filtros y orden pasan al servidor; el CSV puede seguir armándose en el cliente con la página actual o pedir `size=100`.

### 3.3 Ficha de producto (`/user/producto`)

**Front:** `components/producto/product-detail.tsx` + `producto/data.ts` (`historyFor()` inventa 365 días de precios).

**Falta:**

| Endpoint | Respuesta |
| --- | --- |
| `GET /products/{id}` | `{ id, ean, name, brand, content, category, stores: [{ slug, name, price, regular_price, is_promo, available, captured_at, content, price_per_unit, shrinkflation }] }` |
| `GET /products/{id}/history?days=30\|90\|180\|365&rate=blue` | `[{ date, rate, stores: { <slug>: { price, regular_price, is_promo, content } } }]` diario, desde `daily_prices` + `exchange_rates` |
| `GET /products?q=&category=&limit=` | Búsqueda para el selector "Comparar con" y para el formulario de reglas |

Solo devuelve tiendas visibles para el usuario; si el producto no tiene publicaciones en ninguna, `404`.

**Front a cambiar:** `findProduct(slug)` → `GET /products/{id}`; `historyFor()` → `/history`; `compareCandidates()` → `/products?category=`.

### 3.4 Dashboard (`/user/dashboard`)

**Front:** `components/dashboard/dashboard.tsx` y `dashboard-charts.tsx` + `dashboard/data.ts` (`summarize()` y `chartData()` generan todo con fórmulas).

Filtros que manda el front: `start`, `end`, `stores[]`, `categories[]`, `currency` (`ARS`/`USD`), `quote` (`blue`/`oficial`).

**Falta (depende de 2.1, 2.5 y 2.6):**

| Endpoint | Alimenta | Respuesta |
| --- | --- | --- |
| `GET /dashboard/summary` | 4 KPIs + tabla por categoría + CSV | `{ days, ars, usd, devaluation, gap, rate_from, rate_to, rows: [{ category, color, products, ars, usd, gap }] }` (filas ordenadas por `gap` desc) |
| `GET /dashboard/series` | Gráfico de evolución (índice base 100 + dólar) y gráfico por categoría | `[{ date, ars, usd, rate, categories: { <name>: index } }]` |
| `GET /dashboard/scatter` | Dispersión precio vs. dólar | `[{ category, month, price, fx }]`, un punto por categoría y mes |
| `GET /dashboard/peaks` | "Picos por categoría" y marcas ▼ | `[{ category, date, value }]`: suba de más de 3 % en 7 días del índice ARS |
| `GET /dashboard/options` | Filtros y fecha máxima | `{ stores, categories, min_date, max_date }` (hoy `SNAPSHOT_DATE` está fijo) |

Alternativa más simple: un solo `GET /dashboard?…` que devuelva `{ summary, series, scatter, peaks }`, que es como lo consume hoy el front (una sola llamada por cambio de filtro). **Recomendado empezar así** y separar solo si el payload pesa.

Definiciones (para que coincidan con lo que muestra el front):

- `ars`: variación del índice ponderado de precios regulares entre `start` y `end`.
- `devaluation`: `rate_to / rate_from − 1` del dólar elegido.
- `usd`: `(1 + ars) / (rate_to / rate_from) − 1`.
- `gap`: `ars − devaluation`, en puntos porcentuales.
- `products` por categoría: canónicos con precio en las tiendas filtradas.

**Front a cambiar:** `summarize()`/`chartData()` se reemplazan por un fetch; la validación de filtros guardados en `localStorage` usa `options` en vez de las constantes. El botón "Crear alerta de pico" debe pasar `?category=` al formulario (ver ALERTAS-BACKEND.md §9).

### 3.5 Alertas y reglas

Ya está detallado en [ALERTAS-BACKEND.md](ALERTAS-BACKEND.md). Resumen de lo que falta: servicio `alerts.py`, CRUD de reglas + `preview` + `options`, endpoints de alertas disparadas (`/alerts`, `summary`, `seen`), tarea ARQ `evaluate_alert_rules`. Depende de 2.1 (categorías) y de `GET /products?q=` (§3.3).

La campana del header (`client-header-actions.tsx`) importa `ALERTS` directo; pasa a `GET /alerts/summary`.

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
2. **Cotizaciones para el cliente:** `GET /rates/latest` y `/rates/history`; conectar `quotes-card.tsx` y `lib/quotes.ts`. (§3.1)
3. **Matriz completa:** categoría, contenido, `variation_30d`, filtros y orden en `/matrix`; continuous aggregate `daily_prices`; conectar `/user/matriz`. (§2.5, §3.2)
4. **Ficha de producto:** `/products`, `/products/{id}`, `/products/{id}/history`; reduflación (§2.4); conectar `/user/producto`. (§3.3)
5. **Dashboard:** `GET /dashboard` (summary + series + scatter + peaks + options); conectar `/user/dashboard`. (§3.4)
6. **Alertas:** PRs 2 a 5 de [ALERTAS-BACKEND.md](ALERTAS-BACKEND.md) §11. (§3.5)
7. **Operación:** `overview`, `errors` y `scraping_events`; conectar `/admin/operacion`. (§3.7)
8. **Curaduría:** `listing_matches`, `curation_events`, sugerencias con `pg_trgm` y endpoints; conectar `/admin/curaduria`. (§3.6)

Operación (7) no depende de nada y se puede hacer en paralelo con 1–5.

## 5. Del lado del front, al conectar

- Cada `data.ts` de muestra se borra cuando su pantalla queda conectada (`matriz`, `producto`, `dashboard`, `alertas`, `curaduria`, `operacion`) junto con `SNAPSHOT_QUOTES` y `QUOTES`.
- Las llamadas van por `lib/api.ts` (ya maneja token y refresh).
- Agregar estados de carga (`Skeleton`) y vacío: con datos reales puede no haber precios para un rango o una tienda.
- El vínculo a la ficha pasa de `?p=<slug>` a `?id=<uuid>`; `productHref()` se usa en alertas y regla nueva.
