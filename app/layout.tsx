import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";


// Geist (Vercel, SIL Open Font License 1.1), the free typeface closest to Tesla's Universal Sans:
// same clean grotesque shapes, large x-height, open letters. Served from this app by next/font.
const sans = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Orbit · for Yale",
  description: "Tell Orbit what you are building toward. It lights up the events of your week that move you there, and the friends to go with.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", sans.variable)}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
