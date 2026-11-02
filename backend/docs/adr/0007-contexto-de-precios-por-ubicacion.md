
# ADR-0007: Contexto de precios por ubicación

- Estado: Propuesto
- Fecha: 2026-10-31
- Relacionado: ADR-0006, épica E08

## Contexto

El MVP de PriceScope compara precios de productos
entre diferentes cadenas comerciales.

Los supermercados pueden presentar distintos precios,
promociones y disponibilidad según la sucursal, región,
canal de venta o modalidad de entrega.

Por lo tanto, un precio obtenido sin identificar su
contexto comercial no debe atribuirse a una sucursal.

## Decisión propuesta

1. Store representa una cadena comercial.

2. StoreLocation representa una sucursal física o un
   contexto de entrega perteneciente a una tienda.

3. Listing conserva el identificador del producto
   dentro de la cadena comercial.

4. Price incorpora location_id opcional para conservar
   precios históricos cuya ubicación se desconoce.

5. Las modalidades iniciales son pickup y delivery.

6. Para delivery se contempla region_id y sales_channel.
   Sus valores deben verificarse para cada proveedor.

7. El soporte específico de puntos de retiro queda
   pendiente de validar con la API correspondiente.

8. Los precios regionales solo podrán persistirse
   automáticamente cuando el origen y contexto de la
   respuesta hayan sido verificados.

## Implementación actual

Se incorporaron modelos, migraciones, validaciones,
endpoints administrativos y un cliente VTEX regional.

Las pruebas de integración actuales utilizan respuestas
simuladas y una base PostgreSQL de pruebas.

La extracción externa permanece deshabilitada
por defecto.

## Verificaciones pendientes

- Confirmar condiciones de uso de las fuentes.
- Identificar vendedores propios mediante sellerId.
- Verificar regionId y sales channel reales.
- Comprobar si se necesita country y zip-code.
- Comparar una muestra con los precios visibles
  para la misma ubicación y modalidad de compra.
- Validar la persistencia automática por ubicación.
- Revisar la identidad de registros históricos cuando
  diferentes ubicaciones se capturan simultáneamente.

## Consecuencias

El sistema podrá distinguir precios de una misma
publicación según su ubicación.

Aumentan la precisión y utilidad de las comparaciones,
pero también la complejidad del scraping y del modelo
de precios.

Las capturas sin ubicación verificada conservarán
location_id = NULL.

Este ADR complementa al ADR-0006 y no acredita
autorización para utilizar ninguna fuente externa.
