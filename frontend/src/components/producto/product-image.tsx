"use client"

import * as React from "react"
import { PackageIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Product photo from the store, with a package icon when missing or broken. */
export function ProductImage({
  src,
  alt = "",
  className,
}: {
  src: string | null | undefined
  alt?: string
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)

  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white",
        className
      )}
    >
      {src && !failed ? (
        // External VTEX hosts vary per store, so next/image would need every domain allowlisted.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <PackageIcon className="size-1/2 max-h-8 max-w-8 text-muted-foreground" />
      )}
    </div>
  )
}
