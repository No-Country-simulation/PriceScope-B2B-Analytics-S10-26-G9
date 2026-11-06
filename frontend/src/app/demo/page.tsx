import type { Metadata } from "next"

import { DemoBooking } from "@/components/demo/DemoBooking"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHeader } from "@/components/landing/landing-header"
import { PalmSilhouette } from "@/components/landing/palm-silhouette"

export const metadata: Metadata = {
  title: "Agendar demo · PriceScope",
}

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex flex-1 flex-col">
        <div className="relative mx-auto w-full max-w-[1240px] flex-1 overflow-hidden border-x border-b px-5 py-20 sm:px-8 sm:py-40">
          <PalmSilhouette className="-right-5 h-[55%] -scale-x-100 opacity-30" />
          <PalmSilhouette className="-left-8 h-[38%] opacity-20" />
          <div className="relative mx-auto w-full max-w-[860px]">
            <DemoBooking />
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
