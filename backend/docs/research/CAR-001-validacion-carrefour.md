# CAR-001 — Validación exploratoria de precios regionales de Carrefour

**Proyecto:** PriceScope B2B Analytics — NoCountry  
**Épica:** E08 — Extracción de precios de e-commerce  
**Fuente:** Carrefour Argentina (VTEX)  
**Fecha de observación:** 31/10/2026  
**Estado:** Validación manual completada. Integración regional automatizada pendiente.

## 1. Objetivo

Investigar si Carrefour Argentina presenta diferencias de precios según la ubicación seleccionada y determinar qué información es necesaria para implementar la extracción de precios regionales en PriceScope.

## 2. Metodología

Se realizaron pruebas manuales utilizando la interfaz pública de Carrefour y las herramientas de desarrollo de Chrome.

Se seleccionó la modalidad de envío a domicilio y se compararon dos zonas geográficas: Ciudad Autónoma de Buenos Aires y Córdoba Capital.

La prueba utilizó la secuencia CABA → Córdoba → CABA para comprobar si el precio volvía a su valor inicial.

Se inspeccionaron respuestas JSON de VTEX, sin ejecutar un proceso automatizado de extracción durante esta investigación.

## 3. Producto de referencia

- Producto: Leche Protein La Serenísima 1 L.
- Identificador de producto VTEX: `676752`.
- SKU: `42896`.
- Vendedor de catálogo: `sellerId = 1` (`CARREFOUR`).

## 4. Resultados observados

| Prueba | Ubicación | Precio |
|---|---|---|
| A | CABA | ARS 3.245 |
| B | Córdoba Capital | ARS 2.689 |
| A | Regreso a CABA | ARS 3.245 |

La diferencia observada entre ambas zonas fue de ARS 556, aproximadamente un 17,1 % respecto del precio de CABA.

Al regresar a CABA, el precio volvió al valor inicial. Esto constituye evidencia de que la ubicación seleccionada influye en el precio mostrado por la tienda.

## 5. Vendedores regionales

Las respuestas de consulta regional mostraron diferentes vendedores asociados a las zonas:

| Ubicación | Vendedor regional | Identificador |
|---|---|---|
| CABA | Hiper Salguero | `carrefourar0006` |
| Córdoba | Hiper Córdoba Jardín | `carrefourar0024` |

En las muestras de búsqueda analizadas, el vendedor de las ofertas de catálogo se identificó como `sellerId = 1`.

No se asume que este identificador sea equivalente al identificador del vendedor regional.

## 6. Consideraciones técnicas

Carrefour utiliza tecnología VTEX para presentar productos, precios y ofertas.

Durante la investigación se identificaron respuestas estructuradas con datos de productos, SKUs, vendedores y ofertas comerciales.

Las variables explícitas de las solicitudes GraphQL examinadas no incluyeron un `regionId` ni un código postal, por lo que se requiere investigar el mecanismo utilizado para aplicar el contexto regional.

La arquitectura actual de PriceScope dispone de:

- Cliente VTEX basado en HTTPX.
- Validación de vendedores.
- Modelo `StoreLocation`.
- Asociación opcional de precios con `location_id`.
- Cliente de Intelligent Search v1.
- Pruebas automatizadas con respuestas simuladas.

## 7. Alcance y permisos

El equipo informó que NoCountry autorizó la ejecución de scraping dentro de la simulación laboral.

El alcance específico de las condiciones de acceso de cada comercio debe quedar documentado antes de activar sus consultas automatizadas.

Las muestras originales pueden contener información de sesión y no deben incorporarse directamente al repositorio público.

## 8. Próximos pasos

1. Verificar el mecanismo autorizado para consultar productos regionalizados.
2. Ejecutar una prueba controlada con una pequeña cantidad de productos.
3. Comparar los resultados con la interfaz del comercio para la misma ubicación y momento.
4. Validar la asociación entre oferta, vendedor y región.
5. Persistir observaciones regionales únicamente después de comprobar su procedencia y contexto.

## 9. Conclusión

La investigación manual permitió identificar diferencias reproducibles de precios entre CABA y Córdoba Capital para un mismo producto.

Los resultados respaldan la necesidad de incorporar contexto regional al modelo de precios de PriceScope.

La reproducción automática de esos resultados todavía requiere validación técnica adicional.

## Integración real del catálogo — 02/11/2026

Se realizó exitosamente una extracción de productos de Carrefour Argentina mediante la API pública de catálogo VTEX.

La operación fue ejecutada desde el endpoint administrativo de PriceScope y devolvió HTTP 200.

**Resultados:**
- 5 productos recibidos.
- 5 observaciones guardadas en PostgreSQL.
- 0 duplicados detectados durante la ejecución.
- Vendedor identificado: `sellerId = 1`.
- Clasificación de productos almacenada correctamente.

Por decisión del equipo, la validación regional queda fuera del alcance actual. Las observaciones se almacenan sin atribuirlas a una ubicación específica (`location_id = NULL`).

La consulta del árbol completo de categorías devolvió HTTP 429, por lo que se suspendieron nuevas solicitudes a esa ruta. La extracción principal de productos funciona independientemente de dicho endpoint.

**Estado:** Integración básica de Carrefour validada. Pendiente completar la validación de paginación, los controles de frecuencia y la estrategia de actualización periódica.