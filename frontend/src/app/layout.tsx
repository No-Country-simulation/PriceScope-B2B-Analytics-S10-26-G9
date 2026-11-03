import type { Metadata } from "next";
import { Geist, Inter, Inter_Tight, Newsreader } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Inter, Inter Tight and Newsreader are still used by the pages that predate
// shadcn (/, /demo) until they are migrated.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "PriceScope",
  description: "La inflación real, en pesos y en dólares",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={cn(
        "h-full font-sans antialiased",
        geist.variable,
        inter.variable,
        interTight.variable,
        newsreader.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
