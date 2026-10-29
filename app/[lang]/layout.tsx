// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata, Viewport } from "next";
import { Caveat, EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
import { A11yWidget } from "@/components/A11yWidget";
import { DadosEstruturados } from "@/components/DadosEstruturados";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { I18nProvider } from "@/components/I18n";
import { MaisGaveta } from "@/components/MaisGaveta";
import { OfflineSupport } from "@/components/Offline";
import { OpeningNotice } from "@/components/OpeningNotice";
import { OutsidePanel } from "@/components/OutsidePanel";
import { RadioPlayer } from "@/components/RadioPlayer";
import { Shortcuts } from "@/components/Shortcuts";
import { VoltarAoTopo } from "@/components/VoltarAoTopo";
import { PrefsScript } from "@/components/ThemeToggle";
import abertura from "@/content/abertura.json";
import { loadLang } from "@/i18n";
import { pickCore } from "@/i18n/core";
import { htmlLang, locales } from "@/i18n/config";
import { organizacao, siteWeb } from "@/lib/dados-estruturados";
import { secoesDoSite } from "@/lib/secoes-do-site";
import { site } from "@/lib/site";

// O chinês usa as fontes do próprio sistema; o russo, o recorte cirílico das mesmas famílias.
// `subsets` só diz o que o navegador baixa antes de tudo (preload): os recortes latin-ext e cirílico continuam no CSS e
// vêm sozinhos, pela faixa de caracteres, na página que precisar deles. Pré-carregar os três recortes custava 12
// arquivos (400 KB) a quem abre a página em português num plano de dados curto.
const serif = EB_Garamond({ variable: "--font-serif-display", subsets: ["latin"] });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-archive", subsets: ["latin"], weight: ["400", "500"] });
// A letra escrita à mão do estúdio de design (bilhetes, legendas de foto revelada): só carrega quando alguém usa.
const mao = Caveat({ variable: "--font-hand", subsets: ["latin", "latin-ext"], preload: false });

// A cor da barra do navegador acompanha o tema. O "viewport-fit=cover" (de borda a borda, sabendo onde ficam
// o relógio e os botões do aparelho) só é ligado no aplicativo, pelo prefsScript: no navegador ele fazia o
// Firefox do Android reservar o espaço da barra do sistema e a barra de abas do site ficava alta, com um vão embaixo.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    // No celular a barra do navegador continua a faixa preta de avisos do topo do site.
    { media: "(max-width: 767.98px)", color: "#1f1a14" },
    { media: "(prefers-color-scheme: light)", color: "#f4ecd8" },
    { media: "(prefers-color-scheme: dark)", color: "#17130e" },
  ],
};

// O idioma que não existe dá 404 em loadLang. Aqui fica liberado para as páginas abaixo decidirem por si: cada rota
// dinâmica diz o seu (dynamicParams = false na maioria). Com false aqui, valia para todas, e as que saem na primeira
// visita (aula e obra nos idiomas sem tradução, zine da aula, kit do núcleo, episódio de podcast) davam 404.
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: `%s — ${site.name}` },
    description: t.meta.description,
    // O ícone (app/icon.png) entra sozinho. A imagem do cartão de compartilhamento precisa ser dita aqui:
    // posta como arquivo solto em app/, ela se perde quando este layout define "openGraph".
    openGraph: {
      type: "website",
      locale: htmlLang[lang],
      siteName: site.name,
      title: t.meta.title,
      description: t.meta.description,
      images: [{ url: "/cartao-lucia.png", width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: "summary_large_image", images: ["/cartao-lucia.png"] },
    applicationName: site.name,
    // No iPhone, "Adicionar à Tela de Início" abre o site sem as barras do navegador.
    appleWebApp: { capable: true, title: site.name, statusBarStyle: "default" },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang, t } = await loadLang(params);
  return (
    <html
      lang={htmlLang[lang]}
      className={`${serif.variable} ${ui.variable} ${mono.variable} ${mao.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <PrefsScript />
      </head>
      <body className="paper min-h-full flex flex-col">
        <DadosEstruturados dados={[organizacao(), siteWeb(lang, t.meta.description)]} />
        <I18nProvider lang={lang} t={pickCore(t)}>
          {/* O painel da equipe é uma tela à parte: lá dentro o site público não aparece. */}
          <OutsidePanel>
            <Header lang={lang} t={t} />
          </OutsidePanel>
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <OutsidePanel>
            <Footer lang={lang} t={t} />
            <RadioPlayer />
            <BottomNav />
            <VoltarAoTopo label={t.lists.top} />
            <OpeningNotice initial={abertura} close={t.a11y.close} />
            <MaisGaveta
              secoes={secoesDoSite(lang, t)}
              textos={{
                titulo: t.more.title,
                busca: t.more.searchPlaceholder,
                maisUsadas: t.more.mostUsed,
                rodape: t.more.footnote,
                instagram: t.footer.instagram,
                comeceAqui: t.more.highlights,
                comeceTexto: t.more.startText,
                sigaTexto: t.more.followText,
                apoieTexto: t.more.supportText,
                apoie: t.nav.supportLong,
                lembranca: t.more.memoryNote,
              }}
            />
          </OutsidePanel>
          <OutsidePanel mostrarNasCriancas>
            <A11yWidget />
          </OutsidePanel>
          <Shortcuts />
          <OfflineSupport />
        </I18nProvider>
      </body>
    </html>
  );
}