# PriceScope Backend · Bitácora de progreso

Última actualización: 2026-10-27

## Qué estamos logrando

Implementar el backend de las tres épicas en curso, siguiendo `PriceScope Backend — Guía de configuración v1.md` (base) y `pricescope-backend-guia-v2.md` (funcionalidades). Esquema de tablas en `pricescope-db-tablas.md`.

| Épica Jira | Qué es |
| --- | --- |
| PSB2BA-269 · E02 | Solicitar una demo |
| PSB2BA-270 · E03 | Ingresar a la plataforma (login, sesión, recuperación, alta de usuario) |
| PSB2BA-278 · E11 | Panel de administración v1 |

## Estado por guía

- [x] **v1 completa:** uv, dependencias, `.env`, Docker (TimescaleDB 2.26.1, Redis 7.4), config, `/health`, Alembic, Ruff y pytest.
- [x] **v2 completa (secciones 3 a 15):** Mailpit, modelos, migración, seed, seguridad, servicios, endpoints, worker ARQ y tests.
- [ ] v2 sección 16-17: contrato al frontend (ya está en la guía) y ADRs → ADR 0001 a 0003 escritos; faltan 0004 (ARQ) y 0005 (scraping).

## Estado por ticket [BACK]

Código listo y probado a mano + tests automáticos. Falta: pasar por Pull Request/Code Review y mover en Jira.

| Ticket | Qué | Endpoints / entregable | Estado |
| --- | --- | --- | --- |
| 285 | Spike roles | `docs/adr/0002` | Listo (ADR) |
| 286 | Spike JWT vs sesiones | `docs/adr/0001` | Listo (ADR) |
| 521 | Spike usuario–tiendas | `docs/adr/0003` + tablas | Listo (ADR) |
| 336 | Rutas protegidas por rol | `UsuarioActual`, `AdminActual` | Listo |
| 502 | API solicitudes de demo | `POST /demo/solicitudes`, `GET /admin/solicitudes` | Listo |
| 315 | Crear usuario | `POST /admin/usuarios` | Listo |
| 318 | Correo de acceso | tarea ARQ `enviar_correo`, `POST /admin/usuarios/{id}/reenviar-acceso` | Listo |
| 321 | Login | `POST /auth/login`, `GET /auth/yo` | Listo |
| 333 | Login de administrador | mismo login + `scripts/seed.py` | Listo |
| 325 | Cierre y expiración de sesión | `POST /auth/refresh`, `POST /auth/logout` | Listo |
| 329 | Recuperación de contraseña | `/auth/recuperar`, `/auth/token/verificar`, `/auth/password` | Listo |
| 437 | Listar y buscar usuarios | `GET /admin/usuarios`, `GET /admin/usuarios/{id}` | Listo |
| 522 | Vincular usuario con tiendas | `GET /admin/tiendas`, `GET/POST/DELETE /admin/usuarios/{id}/tiendas` | Listo |

## Verificación realizada (2026-10-27)

- `docker compose ps`: timescaledb, redis y mailpit `healthy`.
- `alembic current`: `f71711ae915c (head)`; 6 tablas + `alembic_version`; TimescaleDB 2.26.1.
- `/health`: `status: ok` (database, timescaledb 2.26.1, redis).
- `ruff check .`: sin errores. `pytest`: 13 pasan.
- Prueba manual: seed → login admin → crear usuario → correo recibido en Mailpit vía worker → endpoint admin sin token da 401.

## Cómo levantar todo

```bash
docker compose up -d
uv run alembic upgrade head
uv run python -m scripts.seed            # una vez por base local
uv run uvicorn app.main:app --reload --port 8000     # terminal 2
uv run arq app.workers.tareas.WorkerSettings --watch app   # terminal 3
```

- API / Swagger: http://localhost:8000/docs · Mailpit: http://localhost:8025
- Base de tests (una vez): `docker compose exec timescaledb createdb -U pricescope pricescope_test`

## Diferencias con la guía / cosas a saber

- El repo **no** tiene carpeta `backend/`: el backend es la raíz. Los comandos se corren desde la raíz.
- Se corrigieron typos del `.env.example`: `ENVIROMENT` → `ENVIRONMENT`, `POSTGRES_USER=pricesope` → `pricescope`.
- `scripts/seed.py` acepta `SEED_ADMIN_CORREO`, `SEED_ADMIN_NOMBRE` y `SEED_ADMIN_PASSWORD` para correr sin preguntas.
- Ruff excluye `docs/` (para que no reformatee los bloques de código de las guías) y `migrations/versions`.
- Admin de desarrollo creado en la base local: `admin@example.com` / `Admin12345`. **Solo local**; creá el tuyo con el seed.

## Pendiente

- [ ] Commit inicial y Pull Request (el repo aún no tiene commits). Ver nota abajo.
- [ ] Mover los tickets [BACK] en Jira cuando pasen Code Review.
- [ ] ADR 0004 (cola ARQ) y 0005 (scraping).
- [ ] Siguiente guía: baja/bloqueo (E12), rate limiting, productos/precios/cotizaciones, Dockerizar API y CI.
