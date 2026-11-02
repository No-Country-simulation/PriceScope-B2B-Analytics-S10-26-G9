# JUM-001 — Validación del catálogo de Jumbo Argentina

## 1. Objetivo

Validar la integración de Jumbo Argentina como segunda fuente de precios reales para PriceScope, reutilizando el cliente de scraping VTEX implementado previamente.

La validación se centra en la extracción de productos y precios, sin segmentación regional y sin ejecución automática periódica.

**Fecha de validación:** 02/11/2026  
**Tienda:** Jumbo Argentina  
**Slug:** `jumbo`  
**URL base:** `https://www.jumbo.com.ar`  
**Tecnología utilizada:** VTEX Catalog API

## 2. Configuración de la tienda

Se verificó que Jumbo estuviera registrado en PostgreSQL con los siguientes valores:

- `slug`: `jumbo`
- `base_url`: `https://www.jumbo.com.ar`
- `scraper_key`: `jumbo`
- `active`: `True`

El dominio también se encuentra contemplado en la lista de orígenes aprobados del backend.

## 3. Validación del catálogo y vendedores

Se realizó una consulta controlada mediante el endpoint:

`GET /api/v1/admin/scraping/stores/jumbo/sellers/preview`

Parámetros utilizados:

- `term`: `leche`
- `page_size`: `5`
- `max_pages`: `1`

Resultado:

```json
{
  "store": "jumbo",
  "products_received": 5,
  "sellers": [
    {
      "seller_id": "1",
      "seller_name": "Jumbo Argentina IO",
      "sku_count": 5,
      "priced_sku_count": 5,
      "default_sku_count": 5
    }
  ]
}
```

**Conclusión:** la muestra respondió correctamente con HTTP 200 y permitió identificar el vendedor `1`, denominado `Jumbo Argentina IO`. Los cinco SKUs consultados tenían precios disponibles.

Este identificador se validó sobre la muestra observada y se configuró como vendedor propio para las pruebas controladas.

## 4. Extracción real y persistencia

Se ejecutó el endpoint:

`POST /api/v1/admin/scraping/run`

Con la solicitud:

```json
{
  "store_slug": "jumbo",
  "term": "leche",
  "page_size": 5,
  "max_pages": 1
}
```

Resultado:

```json
{
  "store": "jumbo",
  "products_received": 5,
  "observations_saved": 5,
  "skipped_duplicates": 0
}
```

La operación respondió con HTTP 200.

Posteriormente se consultaron las tablas `stores`, `listings` y `prices` de PostgreSQL, confirmando la persistencia de cinco observaciones.

## 5. Muestra de precios almacenados

| SKU | Producto | Precio registrado |
|---|---|---:|
| 352158 | Leche Descremada 2casanto 1l | $2.200,00 |
| 299465 | Crema La Serenisima Culinaria 330ml | $5.340,00 |
| 293197 | Crema La Serenisima Batir 330ml | $6.000,00 |
| 25731 | Chocolate Sabor Leche 150 Grs Milka | $12.600,00 |
| 238230 | Oblea Leche 4 Fingers 41.5 Grs Kitkat® | $3.000,00 |

Los precios corresponden a la muestra consultada el 02/11/2026 y pueden cambiar posteriormente.

En todas las observaciones verificadas, `location_id = NULL`, conforme al alcance actual sin regionalización.

## 6. Pruebas automatizadas

Se incorporaron pruebas para verificar:

- Extracción y almacenamiento independiente de productos de Carrefour y Jumbo.
- Identificación de publicaciones mediante la combinación de tienda y SKU.
- Almacenamiento de precios en la tienda correspondiente.
- Exclusión de vendedores externos no autorizados.
- Protección del endpoint administrativo ante tiendas no habilitadas.
- Funcionamiento de la integración con respuestas HTTP simuladas.

Archivos:

- `tests/test_scraping_multiple_stores.py`
- `tests/test_scraping_jumbo_endpoint.py`

Las pruebas específicas se ejecutaron correctamente.

## 7. Limitaciones actuales

- La integración se validó con una muestra pequeña de cinco productos.
- La búsqueda por término puede devolver productos de distintas categorías que contienen palabras relacionadas.
- Todavía no se validaron identificadores reales para la extracción por categorías de Jumbo.
- No se implementó extracción regional.
- No se realizan ejecuciones automáticas de Jumbo.
- No se implementaron reintentos automáticos frente a errores HTTP.
- La comparación entre productos equivalentes de diferentes tiendas requiere una etapa adicional de identificación y normalización.

## 8. Resultado y próximos pasos

La validación confirma que el cliente VTEX existente puede utilizarse para consultar el catálogo de Jumbo y guardar precios reales en PostgreSQL.

Con Carrefour y Jumbo se dispone de dos fuentes independientes de productos y observaciones de precios para el MVP.

Próximos pasos:

1. Incorporar esta documentación y las pruebas al repositorio.
2. Preparar el PR de integración de Jumbo.
3. Verificar que los cambios de Carrefour y Jumbo estén integrados en `main`.
4. Evaluar la incorporación de una tercera tienda, si el equipo lo considera necesario para E08.
5. Abordar por separado los tickets de extracción diaria programada y reintentos automáticos.

**Estado:** validación inicial exitosa; pendiente integración del PR al proyecto principal.