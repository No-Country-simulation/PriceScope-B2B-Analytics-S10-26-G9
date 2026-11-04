# SCR-002 — Reintentos automáticos de scraping

## Objetivo

Implementar reintentos automáticos y limitados para las extracciones programadas de Carrefour y Jumbo utilizando ARQ y Redis, ante errores temporales de la fuente de datos.

La solución reutiliza el cliente VTEX, los controles de autorización, los bloqueos por tienda y el historial de ejecuciones existentes.

## Política de reintentos

Se permiten como máximo tres intentos totales por trabajo:

| Intento | Comportamiento |
|---|---|
| 1 | Ejecución inicial |
| 2 | Reintento después de 60 segundos |
| 3 | Reintento después de 120 segundos |

Después del tercer intento fallido, el trabajo termina con error.

### Errores que permiten reintentos

- HTTP 500 — Internal Server Error
- HTTP 502 — Bad Gateway
- HTTP 503 — Service Unavailable
- HTTP 504 — Gateway Timeout
- Errores temporales de conexión y solicitudes HTTP

### Errores sin reintentos automáticos

- HTTP 429 — Too Many Requests
- HTTP 401/403 — Problemas de autenticación o autorización
- HTTP 404 — Recurso inexistente
- Errores de validación
- JSON inválido
- Errores de persistencia en PostgreSQL

El encabezado `Retry-After` se conserva cuando está disponible, pero no se utiliza para reintentar automáticamente ante HTTP 429.

## Implementación

Se amplió `VtexFetchError` para incorporar información estructurada sobre códigos HTTP, errores de red y `Retry-After`.

Se agregó `app/services/scraping_retry.py`, responsable de determinar si un error es elegible para reintento.

Se integró esta política con ARQ mediante `Retry(defer=...)` y `job_try`.

Las tareas de Carrefour y Jumbo permiten hasta tres intentos totales.

## Persistencia y auditoría

Cada intento que llega a iniciar una extracción crea un registro independiente en `scraping_runs`.

Los errores se registran antes de solicitar un reintento.

Las operaciones de almacenamiento mantienen el control transaccional existente y los bloqueos por tienda.

La reutilización de una publicación entre capturas se realiza mediante el identificador de tienda y SKU.

## Pruebas automatizadas

Se verificaron:

- Clasificación de errores temporales y no reintentables.
- Reintentos con esperas progresivas.
- Límite máximo de intentos.
- Comportamiento ante HTTP 429.
- Recuperación después de un fallo HTTP 503.
- Persistencia del precio sin duplicaciones dentro del escenario de prueba.
- Registro de intentos fallidos y exitosos.
- Funcionamiento real de la reprogramación de ARQ mediante Redis.
- Integración con Carrefour y Jumbo utilizando respuestas HTTP simuladas.

Las pruebas de integración utilizaron una cola Redis independiente, PostgreSQL de pruebas y `httpx.MockTransport`.

**Resultado:** dos pruebas de integración con Redis aprobadas.

## Configuración y seguridad

Las extracciones programadas permanecen deshabilitadas por defecto:

`SCRAPING_JOBS_ENABLED=false`

Los reintentos no modifican los permisos de las tiendas ni habilitan nuevas fuentes.

No se realizaron consultas externas a los supermercados durante las pruebas automatizadas.

## Limitaciones

- Los reintentos se aplican a las tareas automáticas del worker; las solicitudes manuales desde Swagger no se reintentan automáticamente.
- HTTP 429 requiere revisión de las restricciones del proveedor.
- No se implementó la recuperación automática de ejecuciones programadas mientras el worker estuvo apagado.
- La extracción continúa utilizando una muestra pequeña del catálogo.
- La validación realizada corresponde a un entorno de pruebas, no a una operación prolongada de producción.
- ARQ 0.25.0 presenta una advertencia de deprecación relacionada con el cierre de conexiones Redis.

## Conclusión

Se verificó que Carrefour y Jumbo pueden recuperarse de fallos HTTP temporales mediante reintentos limitados de ARQ, con registro de las ejecuciones y persistencia controlada de precios.

La funcionalidad queda preparada para revisión e integración con la extracción diaria programada.