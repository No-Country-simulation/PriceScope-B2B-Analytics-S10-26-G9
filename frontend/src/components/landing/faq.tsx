"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  [
    "¿Qué es PriceScope?",
    "Un servicio que recolecta a diario los precios de las tiendas online que elegís, los cruza con el dólar oficial y blue, y te muestra la inflación real en pesos y en dólares.",
  ],
  [
    "¿Qué tiendas pueden monitorear?",
    "Las que definimos juntos en la llamada: supermercados, electrodomésticos o moda. Cada cliente ve solo sus tiendas asignadas.",
  ],
  ["¿Cada cuánto se actualizan los datos?", "Los precios se recolectan todos los días y las cotizaciones cada hora."],
  [
    "¿Cómo tratan las promociones?",
    "Detectamos el precio tachado y usamos el precio regular para el índice. La promo igual se ve marcada.",
  ],
  [
    "¿Qué cotización usan para pasar a dólares?",
    "La oficial o la blue, a tu elección, vigente en el momento exacto de cada captura.",
  ],
  [
    "¿Cómo obtengo una cuenta?",
    "Agendás una llamada y, después de la llamada, nuestro equipo te crea la cuenta. Te llega un correo para definir tu contraseña.",
  ],
]

export function Faq() {
  return (
    <Accordion defaultValue={["faq-0"]} className="border-y">
      {faqs.map(([q, a], i) => (
        <AccordionItem key={q} value={`faq-${i}`}>
          <AccordionTrigger className="py-4 text-sm hover:no-underline">{q}</AccordionTrigger>
          <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
