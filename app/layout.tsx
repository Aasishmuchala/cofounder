import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// TT Neoris is a trial font on the real site — substituting Hanken Grotesk,
// a free variable geometric grotesque with the same friendly, soft character.
const neoris = Hanken_Grotesk({
  variable: "--font-neoris",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Helm lets you run an entire company with agents",
  description:
    "Helm is an agent orchestration platform designed to help you run an entire business. Run engineering, sales, marketing, design, finance, and ops.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${neoris.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
