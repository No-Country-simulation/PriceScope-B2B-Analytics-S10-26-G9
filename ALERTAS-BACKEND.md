# Alertas (UX07): qué tiene que hacer el backend

El frontend de Alertas ya está conectado a la API (ver Estado). Este documento describe del lado del backend para que funcione con datos reales: tablas, endpoints, el cálculo y el worker. Sigue las convenciones que ya usa `backend/` (FastAPI async, SQLAlchemy 2, Alembic, ARQ, `services/` sin HTTP y `api/` sin reglas de negocio).

**Alcance de esta versión: las alertas solo se muestran dentro de la app** (bandeja de Alertas y campana del header). El aviso por correo queda para después, pero el modelo ya lo contempla para no tener que migrar de nuevo (ver [Correo](#8-correo-más-adelante)).

## Estado (al 12/11/2026)

Están hechos los **PR 1 a 5** de la [§11](#11-orden-sugerido-de-prs): modelos (PR #30) y, en `feat/alertas-datos-reales`, servicio, endpoints, worker, prellenado y el front conectado. Solo falta el correo (§8), que sigue fuera de alcance.

| § | Qué | Estado | Dónde |
| --- | --- | --- | --- |
| 3 | Tablas `alert_rules`, `fired_alerts`, `fired_alert_items` con CHECKs, UNIQUE e índices | ✅ Hecho | `app/models/alert_rule.py`, `app/models/fired_alert.py`, migración `20261110_1727-828e90f76869_add_alert_tables.py` |
| 3 | Enums `AlertRuleKind`, `AlertRuleScope`, `MilestoneKey` | ✅ Hecho | `app/models/enums.py` |
| 3 | Modelos importados en `app/models/__init__.py` | ✅ Hecho | |
| 10 | Tests de modelo: regla válida, rechazo de combinaciones inválidas, una alerta por regla y día | ✅ Hecho | `tests/test_alert_models.py` |
| 4 | ~~Servicio `app/services/alerts.py` (`evaluate_rule`, devaluación, variación, reduflación, regla de 7 días, constante de hitos)~~ | ✅ Hecho | `app/services/alerts.py` |
| 5.1 | ~~Endpoints de reglas (CRUD, `preview`, `options`) + `app/schemas/alerts.py` + router registrado~~ | ✅ Hecho | `app/api/v1/alerts.py` (`rules_router`) |
| 5.2 | ~~Endpoints de alertas disparadas (`/alerts`, `/alerts/{id}`, `summary`, `seen`)~~ | ✅ Hecho | `app/api/v1/alerts.py` (`alerts_router`) |
| 6 | ~~Tarea ARQ `evaluate_alert_rules` y su cron~~ | ✅ Hecho | `app/workers/tasks.py`, 10:30 UTC |
| 9 | ~~Prellenado desde la ficha y el dashboard~~ | ✅ Hecho | `?product=`, `?category=`, `?rule=` en `rule-form.tsx` |
| 10 | ~~`tests/test_alerts.py` (CRUD, aislamiento, validaciones, cálculo, worker)~~ | ✅ Hecho | 31 tests |
| — | ~~Front: bandeja, reglas, formulario y campana con la API~~ | ✅ Hecho | se borraron `alertas/data.ts`, `rule-data.ts` y `sample-products.ts` |
| 8 | Correo | Fuera de alcance | |

Diferencias con lo que dice este documento:

- `milestone_key` quedó como enum (`enum_column`, VARCHAR + CHECK) en lugar de `String(30)`.
- El índice de la bandeja es `(user_id, fired_at)` sin `DESC`. No cambia nada, porque Postgres puede recorrer el índice en orden inverso.
- **Categoría:** `alert_rules.category` guarda el valor de `ProductCategory` (`almacen`, no `Almacén`). La columna sigue siendo texto, así que no hizo falta migración; la API la valida con el enum.
- **Validaciones:** las combinaciones inválidas vuelven como `422` con un único `detail` en español (no la lista de Pydantic), así el front puede mostrar el mensaje tal cual.
- **Campana apagada** (`notify_in_app = false`): la alerta igual se guarda en la bandeja, pero ya vista, así no suma a la campana.
- **Borrar una regla borra su historial** (`ON DELETE CASCADE` de §3.2). El diálogo de confirmación del front lo avisa y sugiere pausarla.
- **Reduflación (§4.3):** si el contenido neto se conoce en un solo extremo, el listing se descarta (no se puede saber si cambió).
- **Vista previa:** sin caché en Redis por ahora. Son dos consultas `DISTINCT ON` acotadas a 8 días; si con el catálogo completo se pone lenta, agregar el caché de §5.1.
- **Hitos:** `GET /alert-rules/options` devuelve las próximas fechas de cada hito desde una constante (`MILESTONE_DATES`, 2026 y 2027). Hay que actualizarla una vez por año o pasarla a una tabla.
- **Fuente de la cotización (§7.2):** sigue sin fijarse; se usa la última cotización del tipo pedido, igual que el resto de la app.
- **`?store=`** desde la ficha no se implementó: la ficha no tiene el id de la tienda, solo el slug.

## 1. Pantallas que consumen esto
## 1. Pantallas que consumen esto

| Ruta | Archivo del front | Qué necesita |
| --- | --- | --- |
| `/user/alertas` | `frontend/src/components/alertas/alerts-board.tsx` | KPIs, bandeja de alertas disparadas, detalle con productos, marcar vistas |
| `/user/alertas` → pestaña «Mis reglas» | `frontend/src/components/alertas/rules-list.tsx` | Listar reglas, pausar/activar, eliminar, ir a editar |
| `/user/regla-nueva` | `frontend/src/components/alertas/rule-form.tsx` | Opciones del formulario, vista previa en vivo, crear y editar |
| `/user/producto?p=…` | `frontend/src/components/producto/product-detail.tsx` | Botón «Crear alerta»: abre el formulario con el producto ya elegido |
| `/user/dashboard` | `frontend/src/components/dashboard/dashboard-charts.tsx` | Botón «Crear alerta de pico»: abre el formulario con la categoría ya elegida |
| Header (campana) | `frontend/src/components/cliente/client-header-actions.tsx` | Cantidad de alertas sin ver y las últimas alertas |

Los datos de muestra que hoy usa el front (`components/alertas/data.ts` y `components/alertas/rule-data.ts`) muestran la forma esperada de las respuestas.

## 2. Qué es una regla

Una regla responde a: **«avisame cuando [qué] en [dónde] suba más de [X p.p.] por encima del [dólar] en [cuándo]»**.

| Parte | Opciones | Notas |
| --- | --- | --- |
| Tipo | `devaluation` (sube más que la devaluación) · `milestone` (hito comercial) | En el front el hito hoy se llama `hit`; se renombra a `milestone` cuando se conecte |
| Alcance | Una **categoría** o un **producto canónico** | Producto = `canonical_products.id` |
| Tienda | Una tienda asignada al usuario, o `null` = cualquiera de sus tiendas | `null` se resuelve **al evaluar**, así que si le asignan una tienda nueva, la regla la incluye |
| Umbral | Puntos porcentuales ≥ 0 (ej. `2.0`) | Diferencia entre la suba del producto y la del dólar |
| Cotización | `official` · `blue` | Reusa el enum `RateType` |
| Período (solo `devaluation`) | 7, 30 o 90 días | Ventana móvil hasta hoy |
| Rango (solo `milestone`) | `starts_on` y `ends_on` (fechas) | Hitos predefinidos (CyberWeek, Black Friday, Hot Sale) o fecha personalizada |

Ejemplo de frase que genera el front: *«Avisame cuando un producto de Almacén en cualquier tienda suba más de 2 p.p. por encima del dólar blue en los últimos 30 días.»*

## 3. Tablas nuevas

Ya estaban previstas en `backend/docs/pricescope-db-tablas.md` (§4) como `reglas_alerta` y `alertas_disparadas`. Acá van con el esquema en inglés que adoptó la migración `english_schema`. Son tablas normales, no hypertables.

### 3.1 `alert_rules`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID PK | `WithId` |
| `user_id` | FK `users.id` `ON DELETE CASCADE`, index | Dueño de la regla |
| `name` | `String(80)` | El front lo sugiere; el usuario puede cambiarlo |
| `kind` | enum `alert_rule_kind`: `devaluation` · `milestone` | `enum_column` (VARCHAR + CHECK) |
| `scope` | enum `alert_rule_scope`: `category` · `product` | |
| `category` | `String(160)` nullable | Obligatoria si `scope = category` (ver [Dependencia: categorías](#7-dependencias-y-decisiones-pendientes)) |
| `canonical_product_id` | FK `canonical_products.id` `ON DELETE CASCADE`, nullable | Obligatorio si `scope = product` |
| `store_id` | FK `stores.id` `ON DELETE CASCADE`, nullable | `null` = cualquiera de las tiendas del usuario |
| `rate_type` | `RateType` (`official` · `blue`) | |
| `threshold_pp` | `Numeric(5,2)` | `CHECK (threshold_pp >= 0)` |
| `period_days` | `SmallInteger` nullable | `CHECK (period_days IN (7, 30, 90))`, obligatorio si `kind = devaluation` |
| `milestone_key` | `String(30)` nullable | `cyberweek` · `black_friday` · `hot_sale` · `custom` |
| `starts_on`, `ends_on` | `Date` nullable | Obligatorios si `kind = milestone`; `CHECK (starts_on <= ends_on)` |
| `notify_in_app` | `bool`, default `true` | El checkbox «Mostrar en la campana» |
| `notify_email` | `bool`, default `false` | Hoy siempre `false` (ver §8) |
| `active` | `bool`, default `true` | Pausar = `false` |
| `last_fired_at` | `DateTime(tz)` nullable | Se actualiza al disparar; el front lo muestra como «Última vez» |
| `created_at`, `updated_at` | | `WithTimestamps` |

CHECKs de consistencia (para que la base rechace combinaciones inválidas, aunque la API ya las valide):

```sql
CHECK ((scope = 'category' AND category IS NOT NULL AND canonical_product_id IS NULL)
    OR (scope = 'product'  AND canonical_product_id IS NOT NULL AND category IS NULL))
CHECK ((kind = 'devaluation' AND period_days IS NOT NULL)
    OR (kind = 'milestone'   AND starts_on IS NOT NULL AND ends_on IS NOT NULL))
```

Índice para el worker: `INDEX (active) WHERE active` o `INDEX (user_id, active)`.

### 3.2 `fired_alerts`

Una fila por cada vez que una regla se cumple. Guarda una **foto** de los números y la frase, para que el historial no cambie si después se edita la regla.

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID PK | |
| `rule_id` | FK `alert_rules.id` `ON DELETE CASCADE`, index | Si se borra la regla, se borra su historial |
| `user_id` | FK `users.id` `ON DELETE CASCADE` | Copia de `rule.user_id`: la bandeja filtra por usuario sin JOIN |
| `fired_at` | `DateTime(tz)` | |
| `evaluated_on` | `Date` | Día (hora Argentina) de la corrida que la disparó |
| `rule_name` | `String(80)` | Foto del nombre |
| `scope_label` | `String(200)` | Ej. «Almacén · todas las tiendas · 30 días» |
| `phrase` | `Text` | Foto de la frase, en pasado: «Productos de Almacén en cualquier tienda subieron más de 2 p.p. …» |
| `devaluation_pct` | `Numeric(7,2)` | Suba del dólar en el período |
| `average_pct` | `Numeric(7,2)` | Suba promedio de los productos que la dispararon |
| `products_count` | `Integer` | |
| `seen_at` | `DateTime(tz)` nullable | `null` = sin ver (punto rojo y badge «Nueva») |

- `UNIQUE (rule_id, evaluated_on)`: si el worker corre dos veces el mismo día, no duplica.
- `INDEX (user_id, fired_at DESC)` para la bandeja e `INDEX (user_id) WHERE seen_at IS NULL` para la campana.

### 3.3 `fired_alert_items`

Los productos que dispararon cada alerta (la tabla del detalle).

| Columna | Tipo | Notas |
| --- | --- | --- |
| `fired_alert_id` | FK `fired_alerts.id` `ON DELETE CASCADE` | PK compuesta con `listing_id` |
| `listing_id` | FK `listings.id` `ON DELETE CASCADE` | |
| `canonical_product_id` | UUID nullable | Para que el front arme el link a la ficha |
| `product_name` | `String(255)` | Foto |
| `category` | `String(160)` nullable | Foto |
| `store_name` | `String(120)` | Foto |
| `price_start`, `price_end` | `Numeric(14,2)` | Precio regular al inicio y al final del período |
| `variation_pct` | `Numeric(7,2)` | |

Recordatorio de `pricescope-backend-guia-v2.md`: cada modelo nuevo se importa en `app/models/__init__.py` o Alembic genera la migración vacía.

## 4. Cómo se calcula si una regla se cumple

Todo en un servicio nuevo, `app/services/alerts.py`, con una función pura que reciben **tanto el worker como la vista previa**. Así el número de la vista previa coincide con lo que después dispara.

```python
async def evaluate_rule(db: AsyncSession, rule: RuleSpec, user: User, today: date) -> Evaluation:
    """Devuelve la devaluación del período y los listings que superan el umbral."""
```

(`RuleSpec` es la regla sin guardar: sirve para `alert_rules` y para el body de la vista previa.)

### 4.1 Ventana de tiempo

| Tipo | Inicio | Fin |
| --- | --- | --- |
| `devaluation` | `today - period_days` | `today` |
| `milestone` | último precio **antes** de `starts_on` (la base, para detectar si inflaron el precio regular antes del descuento) | `min(today, ends_on)` |

Un `milestone` solo se evalúa si `starts_on <= today <= ends_on + 1 día`. Fuera del rango no hace nada (la regla sigue activa y espera al año siguiente, o el usuario la edita).

### 4.2 Devaluación del período

```
devaluation_pct = (venta_fin / venta_inicio - 1) * 100
```

`venta_*` es el `sell` de `exchange_rates` del `rate_type` de la regla, el último con `quoted_at <=` cada extremo. Hay que usar **una sola fuente** por tipo (la misma que muestra el header del front; hoy `latest_rates` toma la más reciente sin mirar la fuente). Conviene fijarla en `settings`.

### 4.3 Variación de cada producto

Para cada `listing` dentro del alcance:

1. **Tiendas:** `rule.store_id` si tiene una, si no `stores.visible_store_ids(db, user)`. Si el usuario perdió acceso a la tienda de la regla, esa regla no evalúa nada y no dispara.
2. **Alcance:** `listings.canonical_product_id = rule.canonical_product_id`, o la categoría (ver §7).
3. **Precios:** el último `prices.regular_price` (si es `null`, `local_price`) con `captured_at <=` cada extremo y `available = true`. Se usa el **precio regular**, no el promocional, igual que el índice de inflación (decisión de diseño 2 del README).
4. **Reduflación:** si `grammage` cambió entre los dos extremos y los dos son conocidos, se compara **precio por unidad** (precio / gramaje). Si no se puede, se descarta el listing (lo cubre la alerta de reduflación, no esta).
5. Si falta alguno de los dos precios, el listing se ignora.

```
variation_pct = (precio_fin / precio_inicio - 1) * 100
dispara si   variation_pct - devaluation_pct > threshold_pp
```

`average_pct` = promedio de `variation_pct` de los listings que dispararon.

Las consultas de «último precio antes de X» se pueden hacer con `DISTINCT ON (listing_id) … ORDER BY listing_id, captured_at DESC` sobre la hypertable, filtrando `captured_at` a una ventana acotada (ej. 7 días antes de cada extremo) para que Timescale descarte chunks.

### 4.4 Cuándo disparar (para no repetir lo mismo todos los días)

Una regla de 30 días que hoy se cumple, mañana probablemente también se cumpla. Para no llenar la bandeja:

- Se dispara como máximo **una vez por día** por regla (`UNIQUE (rule_id, evaluated_on)`).
- Un listing que ya apareció en una alerta de **esa misma regla** en los últimos **7 días** no cuenta de nuevo. Si después de sacar esos no queda ninguno, no se dispara.
- Al disparar: se insertan `fired_alerts` + `fired_alert_items` y se actualiza `alert_rules.last_fired_at`, todo en una transacción.

## 5. Endpoints

Todos bajo `/api/v1`, con `CurrentUser` (`app/api/deps.py`). Un usuario **solo ve y toca sus propias reglas y alertas**: si el `id` es de otro usuario, se responde **404**, no 403, para no revelar que existe. Los errores van como `BusinessError` con `detail` en español, igual que el resto de la API.

Archivos nuevos: `app/api/v1/alerts.py`, `app/schemas/alerts.py` y `app/services/alerts.py`. Registrar el router en `app/api/v1/router.py`.

### 5.1 Reglas

| Método y ruta | Para qué | Respuesta |
| --- | --- | --- |
| `GET /alert-rules` | Pestaña «Mis reglas» | `list[AlertRuleOutput]`, ordenadas por `created_at DESC` |
| `GET /alert-rules/{id}` | Abrir el formulario en modo edición | `AlertRuleOutput` |
| `POST /alert-rules` | «Crear regla» | `201` + `AlertRuleOutput` |
| `PATCH /alert-rules/{id}` | Editar, o pausar/activar (`{"active": false}`) | `AlertRuleOutput` |
| `DELETE /alert-rules/{id}` | Eliminar (el front ya pide confirmación) | `204` |
| `POST /alert-rules/preview` | Vista previa «Con datos de hoy se dispararía con…» | `RulePreviewOutput` (no guarda nada) |
| `GET /alert-rules/options` | Llenar los selects del formulario | `RuleOptionsOutput` |

**Body de crear o editar** (`AlertRuleInput`; en `PATCH` todos los campos son opcionales):

```json
{
  "name": "Almacén supera al blue · 30 d",
  "kind": "devaluation",
  "scope": "category",
  "category": "Almacén",
  "canonical_product_id": null,
  "store_id": null,
  "rate_type": "blue",
  "threshold_pp": 2,
  "period_days": 30,
  "milestone_key": null,
  "starts_on": null,
  "ends_on": null,
  "notify_in_app": true
}
```

Validaciones (Pydantic + servicio), con estos mensajes, que el front muestra tal cual:

| Caso | Respuesta |
| --- | --- |
| `name` vacío o más de 80 caracteres | 422 · «Ponele un nombre a la regla.» |
| `threshold_pp < 0` | 422 · «Ingresá un número igual o mayor a 0.» |
| `starts_on > ends_on` | 422 · «Revisá el rango: la fecha “hasta” no puede ser anterior a “desde”.» |
| Falta `category` o `canonical_product_id` según `scope`, o falta `period_days` o el rango según `kind` | 422 |
| `store_id` que no está en `visible_store_ids(user)` | 400 · «Esa tienda no está asignada a tu cuenta.» |
| `canonical_product_id` que no existe o que no tiene listings en las tiendas del usuario | 400 · «Ese producto no está en tus tiendas.» |
| `notify_email = true` | 400 · «El aviso por correo todavía no está disponible.» (o se ignora; ver §8) |
| Más de 50 reglas por usuario | 400 · «Llegaste al máximo de 50 reglas.» (límite sugerido, para cuidar el worker) |

**`AlertRuleOutput`**: lo que se guarda más dos campos calculados para la lista:

```json
{
  "id": "…",
  "name": "Almacén supera al blue",
  "kind": "devaluation",
  "scope": "category",
  "category": "Almacén",
  "canonical_product_id": null,
  "product_name": null,
  "store_id": null,
  "store_name": null,
  "rate_type": "blue",
  "threshold_pp": 2.0,
  "period_days": 30,
  "milestone_key": null,
  "starts_on": null,
  "ends_on": null,
  "notify_in_app": true,
  "notify_email": false,
  "active": true,
  "phrase": "Avisame cuando un producto de Almacén en cualquier tienda suba más de 2 p.p. por encima del dólar blue en los últimos 30 días.",
  "last_fired_at": "2026-10-29T09:10:00Z",
  "created_at": "…"
}
```

La `phrase` la arma el backend con la misma plantilla que el componente `Phrase` de `rule-form.tsx`, para que la lista y la bandeja digan lo mismo que vio el usuario al crearla.

**`POST /alert-rules/preview`**: mismo body que crear, sin `name`. Responde:

```json
{
  "devaluation_pct": 4.1,
  "products_count": 7,
  "stores_count": 2,
  "items": [
    { "canonical_product_id": "…", "product_name": "Café molido 500 g", "store_name": "Supermercado Delta", "variation_pct": 12.4 }
  ]
}
```

`items` va ordenado por `variation_pct DESC` y limitado a 10 (el front muestra 4 y «y N más» con `products_count`). El front la llama con debounce (~400 ms) cada vez que cambia un campo, así que tiene que ser rápida: cachear en Redis por `hash(body) + user_id + fecha` unos minutos es suficiente.

**`GET /alert-rules/options`**:

```json
{
  "stores": [{ "id": "…", "name": "Supermercado Delta" }],
  "categories": ["Almacén", "Bebidas", "Electro", "Indumentaria", "Lácteos", "Limpieza"],
  "milestones": [
    { "key": "cyberweek", "label": "CyberWeek", "starts_on": "2026-11-03", "ends_on": "2026-11-09" },
    { "key": "black_friday", "label": "Black Friday", "starts_on": "2026-11-27", "ends_on": "2026-11-30" },
    { "key": "hot_sale", "label": "Hot Sale", "starts_on": "2027-05-10", "ends_on": "2027-05-12" }
  ]
}
```

- `stores` = las del usuario (`stores_of_user`).
- `categories` = solo las que tienen productos en esas tiendas.
- `milestones`: por ahora una constante en el backend (`app/services/alerts.py`), con las **próximas** fechas de cada hito. Más adelante puede pasar a una tabla que edite el admin.
- Los productos **no** van acá (pueden ser miles): el selector de producto busca con `GET /products?q=…&limit=20`, que es parte de la épica de producto/matriz. Si ese endpoint todavía no existe, crear uno mínimo: `id`, `name`, `category`, solo de las tiendas del usuario.

### 5.2 Alertas disparadas

| Método y ruta | Para qué | Respuesta |
| --- | --- | --- |
| `GET /alerts?page=1&size=20&unseen=false` | Bandeja | `Page[FiredAlertOutput]` (usa `Page[T]` de `schemas/common.py`), `fired_at DESC` |
| `GET /alerts/{id}` | Detalle con la tabla de productos | `FiredAlertDetailOutput` (incluye `items`) |
| `GET /alerts/summary` | KPIs de la pantalla y número de la campana | `AlertsSummaryOutput` |
| `POST /alerts/{id}/seen` | Al abrir una alerta en el detalle, queda vista | `204` (idempotente) |
| `POST /alerts/seen` | Botón «Marcar vistas» | `204`: marca todas las del usuario |

`FiredAlertOutput` (fila de la bandeja; mismos nombres que `FiredAlert` en `frontend/src/components/alertas/data.ts`, en snake_case):

```json
{
  "id": "…",
  "rule_id": "…",
  "rule_name": "Almacén supera al blue",
  "fired_at": "2026-10-29T09:10:00Z",
  "scope_label": "Almacén · todas las tiendas · 30 días",
  "phrase": "Productos de Almacén en cualquier tienda subieron más de 2 p.p. por encima del dólar blue en los últimos 30 días.",
  "products_count": 7,
  "devaluation_pct": 4.1,
  "average_pct": 8.7,
  "seen": false
}
```

`FiredAlertDetailOutput` = lo anterior + `items: [{ canonical_product_id, product_name, category, store_name, variation_pct }]`. La «Diferencia» la calcula el front (`variation_pct - devaluation_pct`).

`AlertsSummaryOutput`:

```json
{ "unseen": 3, "total": 5, "active_rules": 3, "rules": 4, "affected_products": 31, "max_gap_pp": 4.6 }
```

`affected_products` y `max_gap_pp` se calculan sobre las alertas de los últimos 30 días. La campana del header muestra `unseen` y un desplegable con las últimas alertas (`GET /alerts?size=5`). El front los consulta al cargar y cada 5 minutos; no hace falta WebSocket en esta versión.

## 6. Worker: evaluación diaria

Una tarea ARQ nueva en `app/workers/tasks.py`:

```python
async def evaluate_alert_rules(ctx: dict) -> dict[str, int]:
    """Evalúa todas las reglas activas con los precios del día. Idempotente."""
```

- **Cuándo:** `cron(evaluate_alert_rules, hour=10, minute=30, unique=True)` (10:30 UTC = 07:30 Argentina), después de los scrapers de Carrefour (06:00) y Jumbo (06:30). Si se agregan tiendas con horarios más tarde, mover el cron o, mejor, encolarla al final de `finish_scraping_run` cuando terminaron todos los runs del día.
- **Qué hace:** recorre `alert_rules WHERE active` en lotes, llama a `evaluate_rule` y guarda las que disparan (§4.4). Un error en una regla se loguea y **no** corta las demás.
- **Usuarios:** saltear las reglas de usuarios con `status != active`.
- **Idempotencia:** la `UNIQUE (rule_id, evaluated_on)` permite reintentar la tarea sin duplicar (`ON CONFLICT DO NOTHING`).
- **Devuelve** `{"evaluated": n, "fired": m, "errors": k}` para verlo en los logs, igual que los scrapers.

El texto de la ficha del producto («Revisamos los precios todos los días a las 06:00») ya asume que la evaluación es diaria.

## 7. Dependencias y decisiones pendientes

1. **Categorías normalizadas.** Hoy no hay tabla `categories` ni categoría en `canonical_products`; solo existe `listings.source_category`, que es el texto de cada tienda («Almacén» en una, «Despensa» en otra). Para las reglas por categoría hace falta una categoría única por producto canónico. **Propuesta:** agregar `canonical_products.category` (texto de una lista cerrada) como parte de la épica de normalización. Mientras tanto se puede usar un mapeo `source_category → categoría` en código; `alert_rules.category` guarda el texto normalizado, así que no cambia cuando llegue la tabla.
2. **Fuente de la cotización.** Definir cuál fuente (`dolarapi` o `bluelytics`) es la oficial de la app para blue y oficial, y usar la misma en alertas, dashboard y matriz.
3. **Endpoint de búsqueda de productos** (`GET /products?q=`) para el selector de producto, si no lo cubre otra épica.
4. **Admins:** un admin ve todas las tiendas (`visible_store_ids`), así que podría crear reglas sobre todo el catálogo. Sugerido: permitirlo, pero no es prioridad.

## 8. Correo (más adelante)

Fuera de alcance ahora; el front muestra «Enviarme un correo» deshabilitado con el badge «Próximamente». Cuando se haga:

- La columna `notify_email` ya existe, así que no hace falta migración.
- Al disparar una alerta con `notify_email = true`, el worker encola la tarea `send_email` que ya existe (la misma que usan los correos de acceso), con un resumen y el link a `/user/alertas`.
- Agregar en `fired_alerts` un `emailed_at` para no reenviar si la tarea se reintenta.
- El front habilita el checkbox y deja de mandar `false` fijo.

## 9. Ficha de producto y dashboard → formulario prellenado

El botón «Crear alerta» de la ficha (`product-detail.tsx`) y «Crear alerta de pico» del dashboard hoy van a `/user/regla-nueva` sin datos. Cuando haya backend:

| Desde | Link | El formulario arranca con |
| --- | --- | --- |
| Ficha de producto | `/user/regla-nueva?product=<canonical_product_id>` | Alcance = Producto, ese producto elegido |
| Ficha, con una tienda abierta | `…?product=<id>&store=<store_id>` | Además, esa tienda |
| Dashboard (categoría) | `/user/regla-nueva?category=Almacén` | Alcance = Categoría, esa categoría |
| Editar desde «Mis reglas» o desde el detalle | `/user/regla-nueva?rule=<rule_id>` | Todo cargado desde `GET /alert-rules/{id}`; el botón dice «Guardar cambios» y hace `PATCH` |

Lo que necesita el backend para esto:

- `GET /products/{id}` (o que la ficha ya traiga el `canonical_product_id`) para mostrar el nombre en el select sin tener que buscarlo.
- Validar en `POST /alert-rules` que el producto tenga listings en las tiendas del usuario (§5.1): la ficha solo muestra productos de sus tiendas, pero el link se puede editar a mano.

Los cambios en el front (leer los query params y cambiar las URLs de los botones) los hacemos nosotros cuando estén los endpoints.

## 10. Tests mínimos (`backend/tests/test_alerts.py`)

- CRUD de reglas: crear, listar, editar, pausar, borrar.
- Aislamiento: el usuario A recibe 404 al pedir, editar o borrar reglas y alertas del usuario B.
- Validaciones de §5.1, una por caso, incluida una tienda no asignada.
- `evaluate_rule` con precios y cotizaciones sembrados:
  - dispara cuando `variation - devaluation > threshold` y no dispara en el límite exacto;
  - usa el precio regular e ignora el promocional;
  - con `store_id = null` toma todas las tiendas del usuario y no otras;
  - `milestone` fuera de rango no evalúa;
  - reduflación: compara precio por unidad.
- Worker: correrlo dos veces el mismo día no duplica, y el listing repetido dentro de los 7 días no vuelve a disparar.
- La vista previa devuelve los mismos productos que dispararía el worker ese día.
- `POST /alerts/seen` y `GET /alerts/summary` (el `unseen` baja).

## 11. Orden sugerido de PRs

1. ✅ Modelos + migración (`alert_rules`, `fired_alerts`, `fired_alert_items`) + enums. *(Hecho en el PR #30.)*
2. ~~CRUD de reglas + `options` + tests. Con esto el front ya puede crear, listar, pausar y borrar.~~ ✅
3. ~~`services/alerts.evaluate_rule` + `preview` + tests del cálculo.~~ ✅
4. ~~Worker `evaluate_alert_rules` + endpoints de alertas disparadas (`/alerts`, `summary`, `seen`).~~ ✅
5. ~~Prellenado desde la ficha y el dashboard (§9), coordinado con el front.~~ ✅
6. Correo (§8), cuando se priorice.
