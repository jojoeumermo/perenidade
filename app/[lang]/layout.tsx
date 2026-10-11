// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
import { A11yWidget } from "@/components/A11yWidget";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { I18nProvider } from "@/components/I18n";
import { OfflineSupport } from "@/components/Offline";
import { OpeningNotice } from "@/components/OpeningNotice";
import { RadioPlayer } from "@/components/RadioPlayer";
import { Shortcuts } from "@/components/Shortcuts";
import { PrefsScript } from "@/components/ThemeToggle";
import abertura from "@/content/abertura.json";
import { loadLang } from "@/i18n";
import { pickCore } from "@/i18n/core";
import { htmlLang, locales } from "@/i18n/config";
import { site } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";

// O chinês usa as fontes do próprio sistema; o russo, o recorte cirílico das mesmas famílias.
const serif = EB_Garamond({ variable: "--font-serif-display", subsets: ["latin", "latin-ext", "cyrillic"] });
const ui = Inter({ variable: "--font-ui", subsets: ["latin", "latin-ext", "cyrillic"] });
const mono = IBM_Plex_Mono({ variable: "--font-archive", subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500"] });

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: `%s — ${site.name}` },
    description: t.meta.description,
    // A imagem do cartão (app/opengraph-image.png) e o ícone (app/icon.png) entram sozinhos.
    openGraph: { type: "website", locale: htmlLang[lang], siteName: site.name, title: t.meta.title, description: t.meta.description },
    twitter: { card: "summary_large_image" },
    applicationName: site.name,
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang, t } = await loadLang(params);
  return (
    <html
      lang={htmlLang[lang]}
      className={`${serif.variable} ${ui.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <PrefsScript />
      </head>
      <body className="paper min-h-full flex flex-col">
        <I18nProvider lang={lang} t={pickCore(t)}>
          <Header lang={lang} t={t} />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <Footer lang={lang} t={t} />
          <RadioPlayer />
          <A11yWidget />
          <BottomNav />
          <OpeningNotice initial={abertura} close={t.a11y.close} />
          <Shortcuts />
          <OfflineSupport />
          {/* A contagem anônima de visitas só existe no site publicado. */}
          {process.env.NODE_ENV === "production" && <Analytics />}
        </I18nProvider>
      </body>
    </html>
  );
}