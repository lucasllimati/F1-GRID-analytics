import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { THEME_INIT_SCRIPT } from "@/components/theme-toggle";
import { TimezoneProvider } from "@/components/timezone";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Apex Grid — Formula 1, decoded", template: "%s · Apex Grid" },
  description:
    "Calendário da Fórmula 1 no seu fuso, resultados, classificação, probabilidades de título e notícias com fontes verificadas.",
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Apex Grid" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" className={`${inter.variable} ${barlow.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <TimezoneProvider>
          <Header />
          <main id="conteudo">{children}</main>
          <Footer />
        </TimezoneProvider>
      </body>
    </html>
  );
}
