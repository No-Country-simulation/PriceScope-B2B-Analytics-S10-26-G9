---
version: 1
slug: "frontend-src-app-page-tsx"
primary_target: "frontend/src/app/page.tsx"
related_targets: ["frontend/src/components/landing"]
---

# Landing (/)

Mode: Persuade. Audience: cadenas minoristas, fondos y medios, weighted equally. Action: Agendar una demo (/demo); secondary Iniciar sesión.
Constraint: built only with the house shadcn components and the app's tokens (neutral base-nova + brand #4a5bdb + Geist/Geist Mono). User found the previous version generic.

## Direction contract

THESIS: The headline's question is answered by the product's own chart, not by a mockup frame. Refuses the centered headline over an empty product screenshot and a row of icon cards.
OWN-WORLD: shadcn neutral surfaces, 1px borders, radius 0.375rem; Geist for prose, Geist Mono tabular for every number; brand #4a5bdb is the dollar line and the one committed field (closing band); red/green only for up/down.
STORY: Visitor sees prices outrunning the dollar, understands PriceScope measures that daily and cleanly (promos, reduflación, rate at capture time), picks their profile, books a demo.
FIRST VIEWPORT: Left-aligned H1 (~72px) with lead + CTAs on its right baseline; below, a full-width chart card (~480px tall) with ARS/USD and oficial/blue toggles, the gap annotated at the last point in large mono figures. Primary CTA top-right of the headline row.
FORM: chart-as-hero, position 7 of 7 on the grounded list; seed:6948aa5e9fb2679f. Signature interaction: toggling currency/rate redraws the series and the gap figure. Motion: one line draw on load, reduced-motion respected.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
