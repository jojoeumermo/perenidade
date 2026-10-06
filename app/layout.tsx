import type { Metadata } from "next";
import { EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ThemeScript } from "@/components/ThemeToggle";
import { site } from "@/lib/site";

const serif = EB_Garamond({ variable: "--font-serif-display", subsets: ["latin"] });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-archive", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Perenidade — a biblioteca comunitária", template: "%s — Perenidade" },
  description: site.description,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: site.name,
    title: "Perenidade — a biblioteca comunitária",
    description: site.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${serif.variable} ${ui.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="paper min-h-full flex flex-col">
        <Header />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
