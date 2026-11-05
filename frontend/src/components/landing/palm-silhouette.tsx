import { cn } from "@/lib/utils"

/**
 * Palmeras de /palms.png usadas como máscara: la silueta toma el color del logo.
 * La posición, el alto y la opacidad los define quien lo usa.
 */
export function PalmSilhouette({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-0 hidden aspect-[1564/1840] bg-linear-to-b from-brand to-brand-deep [mask-image:url(/palms.png)] [mask-position:bottom] [mask-repeat:no-repeat] [mask-size:contain] md:block",
        className
      )}
    />
  )
}
