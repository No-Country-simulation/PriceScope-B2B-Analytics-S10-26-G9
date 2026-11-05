import type { Metadata } from "next"

import { DemoBooking } from "@/components/demo/DemoBooking"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHeader } from "@/components/landing/landing-header"

export const metadata: Metadata = {
  title: "Agendar demo · PriceScope",
}

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1240px] flex-1 border-x border-b px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto w-full max-w-[860px]">
            <DemoBooking />
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
