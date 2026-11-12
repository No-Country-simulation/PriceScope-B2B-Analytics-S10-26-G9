# PriceScope — Monitor de Inflación Real Multimoneda

**FinTech / Inteligencia de Mercado (B2B Analytics) · Tablero de Inflación Real vs Divisa**

Sistema de monitoreo continuo de precios para una firma de analítica económica que provee informes
a cadenas minoristas, fondos de inversión y medios en mercados de alta volatilidad cambiaria.
Reemplaza el relevamiento manual (15 portales, 2 veces por semana, +10.000 productos) con scrapers
programados, ingesta de cotizaciones y un dashboard ejecutivo de actualización diaria.

> 📄 **Documentación oficial del proyecto:** Puedes consultar la guía y consigna completa brindada por No-Country [en este enlace](https://github.com/No-Country-simulation/PriceScope-B2B-Analytics-S10-26-G9/blob/main/data/priecescope-nocountry.pdf).
> 
<details>
<summary>Problema</summary>

- Recolección manual de precios en e-commerce → retrasos de días y errores de tipeo.
- Conversión manual al tipo de cambio del día (oficial y paralelo) → pérdida de trazabilidad.
- Ofertas temporales y reduflación sin control → distorsionan la tasa de inflación.

</details>

<details>
<summary>Decisiones de diseño</summary>

1. **Identidad de productos**: modelo de *producto canónico* con alias por tienda (SKU, nombre normalizado,
   categoría) para comparar el mismo modelo entre competidores.
2. **Promos y reduflación**: flag de promoción + precio regular desagregados; el índice de inflación se
   calcula sobre precio regular, y el precio promocional se registra por separado. El cambio de gramaje/contenido
   neto dispara una alerta de reduflación en lugar de registrar una variación de precio.
3. **Sincronización cambiaria**: cada captura guarda su `timestamp` y el tipo de cambio de la vía más
   cercana a ese instante, garantizando un `precio_usd` reproducible aún con volatilidad intradía.

</details>

<details>
<summary>Stack</summary>

- **Scraping / Pipeline**: Python (Playwright, Scrapy, BeautifulSoup) o Node.js (Puppeteer, Crawlee) + Celery / BullMQ
- **Backend**: FastAPI / Django o Express / NestJS
- **Base de datos**: PostgreSQL + TimescaleDB (series temporales)
- **Frontend**: React / Next.js / Vue con Chart.js, Recharts o Tremor
- **Divisas**: DolarAPI, Open Exchange Rates, Bluelytics

</details>

<details>
<summary>Equipo</summary>

| Rol | Integrante |
|---|---|
| Project Manager | Maria Laura Filco |
| Full Stack Developer | Angel Villalba |
| Frontend Developer | [Erika Helfenstern](https://www.linkedin.com/in/hevieri/) |
| Backend Developer | [Gabriel Parra](https://www.linkedin.com/in/gaboparra) |
| Backend Developer | Michael Gonzales Liñan |
| Backend Developer | Luciano Castillo |
| QA | [Bruno Nicolás Álvarez](https://www.linkedin.com/in/bruno-nicol%C3%A1s-alvarez) |

</details>
