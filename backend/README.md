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
| Mailpit      | 8025         | Bandeja de entrada de correos de prueba (http://localhost:8025) |

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

El worker envía los correos (que aparecen en Mailpit: http://localhost:8025) y ejecuta la ingesta de
cotizaciones cada hora. Sin él, la API responde bien pero las tareas quedan encoladas en Redis y no
se procesan: ningún correo (alta de usuario, reenvío de acceso, restablecer contraseña) llega a
Mailpit. Al levantarlo, procesa lo que haya quedado en la cola.

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

## Correo en staging y producción (Resend)

En local los correos van a Mailpit. En staging y producción se envían con
[Resend](https://resend.com) por SMTP: solo cambian las variables de entorno, el código es el mismo.

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxxx
SMTP_TLS=true
MAIL_SENDER="PriceScope <no-responder@tu-dominio-verificado.com>"
```

- `SMTP_PASSWORD` es la API key de Resend. Cárgala como secret del entorno de deploy, nunca en el repo.
- Usa el puerto 587: el worker abre la conexión con STARTTLS (`SMTP_TLS=true`). El puerto 465 usa TLS
  implícito y no funciona con esta configuración.
- `MAIL_SENDER` tiene que usar un dominio verificado en Resend (registros SPF y DKIM).
  `onboarding@resend.dev` solo entrega al email de la cuenta de Resend, no a usuarios reales.
- Los envíos siguen pasando por la cola de ARQ, con sus reintentos: el worker tiene que estar corriendo.

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
