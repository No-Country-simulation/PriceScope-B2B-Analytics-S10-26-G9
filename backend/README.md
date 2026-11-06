# PriceScope — Backend

Todos los comandos se ejecutan desde la carpeta `backend/`.

## Requisitos

- [Docker](https://www.docker.com/) (con `docker compose`)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) para manejar Python y las dependencias (Python 3.12 o superior)

## 1. Crear el `.env`

Mac / Linux:

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
copy .env.example .env
```

Abre el `.env` y complétalo con los mismos campos que tiene `.env.example`
(como mínimo `POSTGRES_PASSWORD` y `JWT_SECRET`).

## 2. Levantar los servicios de Docker

```bash
docker compose up -d
```

Esto levanta:

| Servicio     | Puerto local | Uso                                     |
|--------------|--------------|-----------------------------------------|
| TimescaleDB  | 5432         | Base de datos (PostgreSQL 16 + Timescale) |
| Redis        | 6379         | Cola de trabajos (ARQ) y caché          |

Los correos no usan Docker: salen por Resend también en local (ver
[Correo con Resend](#correo-con-resend)).

## 3. Instalar las dependencias

```bash
uv sync
```

## 4. Aplicar las migraciones

Crea las tablas y la extensión de TimescaleDB:

```bash
uv run alembic upgrade head
```

## 5. Crear el administrador y el catálogo de tiendas

```bash
uv run python -m scripts.seed
```

El script pide el email, nombre y contraseña del administrador. Para no ser interactivo, puedes
definir `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` y `SEED_ADMIN_PASSWORD` antes de ejecutarlo.
Es seguro correrlo más de una vez.

## 6. Levantar la API

```bash
uv run uvicorn app.main:app --reload
```

- Documentación interactiva: http://localhost:8000/docs
- Estado del sistema (base de datos y Redis): http://localhost:8000/health

## 7. Levantar el worker

En otra terminal:

```bash
uv run arq app.workers.tasks.WorkerSettings
```

El worker envía los correos por Resend y ejecuta la ingesta de cotizaciones cada hora. Sin él, la API
responde bien pero las tareas quedan encoladas en Redis y no se procesan: ningún correo (alta de
usuario, reenvío de acceso, restablecer contraseña) sale. Al levantarlo, procesa lo que haya quedado
en la cola.

## Extracción diaria de supermercados

PriceScope utiliza ARQ y Redis para programar extracciones
controladas del catálogo de supermercados.

### Tiendas y horarios

| Tienda | Horario UTC | Horario Argentina |
|---|---|---|
| Carrefour | 09:00 | 06:00 |
| Jumbo | 09:30 | 06:30 |

La zona horaria del worker se configura explícitamente en UTC.

### Requisitos

- PostgreSQL/TimescaleDB disponible.
- Redis disponible.
- Migraciones aplicadas.
- Worker ARQ en ejecución.
- Tiendas y vendedores autorizados configurados.

### Configuración

Las extracciones automáticas están deshabilitadas por defecto.

Para habilitarlas en un entorno autorizado:

```dotenv
SCRAPING_ENABLED=true
SCRAPING_ALLOWED_STORES='["carrefour","jumbo"]'
SCRAPING_SELLER_IDS='{"carrefour":["1"],"jumbo":["1"]}'
SCRAPING_JOBS_ENABLED=true
```

Reiniciar el worker después de modificar la configuración.

### Ejecutar el worker

Desde `backend/`:

```bash
docker compose up -d
uv run arq app.workers.tasks.WorkerSettings
```

El worker también procesa otras tareas existentes del proyecto.

### Seguridad y comportamiento

- Cada tienda utiliza una tarea independiente.
- Solo se permiten dominios y vendedores autorizados.
- Las ejecuciones utilizan bloqueos por tienda.
- Los resultados se registran en `scraping_runs`.
- Las tareas no realizan scraping al iniciar el worker.
- Si la extracción programada está deshabilitada,
  no se realizan solicitudes al supermercado.
- Si el worker está apagado durante el horario previsto,
  no se recupera automáticamente la ejecución perdida.

### Reintentos automáticos

Las tareas programadas de Carrefour y Jumbo permiten hasta
tres intentos totales ante fallos temporales.

- Primer intento: ejecución normal.
- Segundo intento: después de 60 segundos.
- Tercer intento: después de 120 segundos.
- No se reintentan automáticamente errores HTTP 429,
  401, 403, 404 o respuestas JSON inválidas.
- Cada intento iniciado queda registrado en `scraping_runs`.
- Los reintentos se encuentran deshabilitados si
  `SCRAPING_JOBS_ENABLED=false`.

Los reintentos utilizan ARQ y Redis. No se aplican
automáticamente a las solicitudes manuales desde Swagger.

### Alcance actual

La extracción diaria utiliza una muestra controlada:

- Término de búsqueda: `leche`.
- Tamaño de página: 5 productos.
- Máximo de páginas: 1.

La extracción de múltiples categorías o del catálogo completo
se implementará en una etapa posterior.

### Pruebas

```bash
uv run pytest -v tests/test_scraping_daily_schedule.py
uv run pytest -v tests/test_scraping_carrefour_worker.py
uv run pytest -v tests/test_scraping_jumbo_worker.py
```

Los tests utilizan respuestas simuladas y no consultan
los supermercados reales.

## Correo con Resend

Todos los entornos (local, staging y producción) envían con [Resend](https://resend.com) por SMTP.
Los correos son reales también en local. El código ya trae host, puerto, usuario y TLS de Resend;
solo hace falta la API key:

```env
SMTP_PASSWORD=re_xxxxxxxxx
# Opcional, con un dominio verificado en Resend:
# MAIL_SENDER="PriceScope <no-responder@tu-dominio-verificado.com>"
```

- `SMTP_PASSWORD` es la API key de Resend. En local va en tu `.env`; en Railway, en las variables
  del worker. Nunca en el repo.
- El remitente por defecto es `onboarding@resend.dev`, que solo entrega al email de la cuenta de
  Resend. Para mandar a usuarios reales, verifica un dominio (SPF y DKIM) y cambia `MAIL_SENDER`.
- Cada prueba en local manda un correo de verdad y cuenta para el límite del plan de Resend.
- Si sobreescribes el puerto, usa 587: el worker abre la conexión con STARTTLS (`SMTP_TLS=true`).
  El puerto 465 usa TLS implícito y no funciona con esta configuración.
- Los envíos pasan por la cola de ARQ, con sus reintentos: el worker tiene que estar corriendo.

## Deploy en Railway

Producción corre en [Railway](https://railway.com) con cuatro servicios en el mismo proyecto. El
frontend está en Vercel y llama a la API a través de su rewrite `/api/v1` (ver
[`frontend/README.md`](../frontend/README.md)).

| Servicio | Origen | Para qué |
|---|---|---|
| `timescaledb` | Docker Image `timescale/timescaledb:2.26.1-pg16` + volumen | Base de datos |
| `Redis` | Database → Redis | Cola de ARQ y rate limit del scraping |
| API | Este repo, con el [`Dockerfile`](Dockerfile) | FastAPI (uvicorn en `$PORT`) |
| `worker` | Este repo, con el mismo `Dockerfile` | ARQ: correos y crons |

La configuración se carga a mano en cada servicio (**Settings** y **Variables**), no hay
config-as-code.

### `timescaledb`

- Volumen montado en `/var/lib/postgresql/data`.
- Variables:

  ```env
  POSTGRES_USER=pricescope
  POSTGRES_PASSWORD=<contraseña larga>
  POSTGRES_DB=pricescope
  PGDATA=/var/lib/postgresql/data/pgdata
  TIMESCALEDB_TELEMETRY=off
  ```

  `PGDATA` apunta a una subcarpeta porque el volumen de Railway trae `lost+found` y Postgres no
  inicializa en una carpeta que no está vacía.

### API y worker

Los dos usan **Root Directory** `/backend` y las mismas variables (el worker sin `PORT`):

```env
POSTGRES_HOST=${{timescaledb.RAILWAY_PRIVATE_DOMAIN}}
POSTGRES_PORT=5432
POSTGRES_USER=${{timescaledb.POSTGRES_USER}}
POSTGRES_PASSWORD=${{timescaledb.POSTGRES_PASSWORD}}
POSTGRES_DB=${{timescaledb.POSTGRES_DB}}
REDIS_URL=${{Redis.REDIS_URL}}
ENVIRONMENT=production
JWT_SECRET=<openssl rand -hex 32, el mismo en los dos>
FRONTEND_URL=https://<front>.vercel.app
PORT=8080
SCRAPING_ENABLED=false
SMTP_PASSWORD=<API key de Resend>   # la usa el worker; ver "Correo con Resend"
```

| Setting | API | worker |
|---|---|---|
| Pre-deploy Command | `/app/.venv/bin/alembic upgrade head` | vacío |
| Custom Start Command | vacío (usa el `CMD` del Dockerfile) | `/app/.venv/bin/arq app.workers.tasks.WorkerSettings` |
| Networking | Generate Domain (puerto 8080) | sin dominio |

- Los comandos usan la ruta completa `/app/.venv/bin/...` porque la consola de Railway no hereda el
  `PATH` del Dockerfile.
- Si el worker arranca sin su Start Command, corre otra copia de la API y no procesa la cola. En sus
  logs tiene que aparecer `Starting worker for ... functions`, no `Uvicorn running`.

### Primer deploy: crear el administrador

En el servicio de la API → pestaña **Console**:

```bash
/app/.venv/bin/python -m scripts.seed
```

### Verificar

`https://<api>.up.railway.app/health` tiene que responder `"status": "ok"`, con `database`, `redis`
y la versión de `timescaledb`. Ese chequeo no confirma que las migraciones hayan corrido (la
extensión ya viene en la imagen): revisa el log de **Pre-deploy** del deploy.

## Día a día

Con los servicios de Docker arriba (`docker compose up -d`), dos terminales en `backend/`:

```bash
uv run uvicorn app.main:app --reload         # API
uv run arq app.workers.tasks.WorkerSettings  # worker de correos
```

## Tests

Los tests usan una base aparte llamada `pricescope_test`. Créala una sola vez (con los servicios de Docker arriba):

```bash
docker exec pricescope-timescaledb-1 psql -U pricescope -d pricescope -c "CREATE DATABASE pricescope_test"
```

Luego:

```bash
uv run pytest -q
```

Si tu `POSTGRES_USER` o el nombre del contenedor son distintos, ajusta el comando de `docker exec`.
