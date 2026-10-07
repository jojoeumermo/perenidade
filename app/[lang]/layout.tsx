import type { Metadata } from "next";
import { EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
import { A11yWidget } from "@/components/A11yWidget";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { I18nProvider } from "@/components/I18n";
import { Shortcuts } from "@/components/Shortcuts";
import { PrefsScript } from "@/components/ThemeToggle";
import { loadLang } from "@/i18n";
import { htmlLang, locales } from "@/i18n/config";
import { site } from "@/lib/site";

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
    alternates: { languages: Object.fromEntries(locales.map((code) => [htmlLang[code], `/${code}`])) },
    openGraph: { type: "website", locale: htmlLang[lang], siteName: site.name, title: t.meta.title, description: t.meta.description },
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
        <I18nProvider lang={lang} t={t}>
          <Header lang={lang} t={t} />
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <Footer lang={lang} t={t} />
          <A11yWidget />
          <Shortcuts />
        </I18nProvider>
      </body>
    </html>
  );
}
