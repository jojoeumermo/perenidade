// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata, Viewport } from "next";
import { Anton, Caveat, EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
// O celular (navegador e aplicativo) com cara de aplicativo: só vale até 767,98 px e fora do leitor de tinta.
import "../celular.css";
import { A11yWidget } from "@/components/A11yWidget";
import { DadosEstruturados } from "@/components/DadosEstruturados";
import { BottomNav } from "@/components/BottomNav";
import { BarraDoCelular } from "@/components/celular/BarraDoCelular";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { I18nProvider } from "@/components/I18n";
import { MaisGaveta } from "@/components/MaisGaveta";
import { RegistroDoPassaporte } from "@/components/escola/campus/RegistroDoPassaporte";
import { OfflineSupport } from "@/components/Offline";
import { OpeningNotice } from "@/components/OpeningNotice";
import { OutsidePanel } from "@/components/OutsidePanel";
import { RadioPlayer } from "@/components/RadioPlayer";
import { RegistroDeVisita } from "@/components/RegistroDeVisita";
import { SaidaRapida } from "@/components/SaidaRapida";
import { TextosDaBuscaProvider } from "@/components/busca/TextosDaBusca";
import { Shortcuts } from "@/components/Shortcuts";
import { VoltarAoTopo } from "@/components/VoltarAoTopo";
import { PrefsScript } from "@/components/ThemeToggle";
import abertura from "@/content/abertura.json";
import comecar from "@/content/comecar.json";
import { loadLang } from "@/i18n";
import { pickBase } from "@/i18n/core";
import { htmlLang, locales } from "@/i18n/config";
import { organizacao, siteWeb } from "@/lib/dados-estruturados";
import { campusDoSite, textosDoCampus } from "@/lib/escola/campus-servidor";
import { textosDaBusca } from "@/lib/escola/textos-da-busca";
import { ligado } from "@/lib/recursos";
import { secoesDoSite } from "@/lib/secoes-do-site";
import { site } from "@/lib/site";

// O chinês usa as fontes do próprio sistema; o russo, o recorte cirílico das mesmas famílias.
// Nenhuma fonte é pré-carregada (preload: false): o <link rel="preload"> sai no HTML e o navegador baixa o arquivo antes
// de saber se a pessoa está no modo leve, que troca as três pelas do aparelho (app/globals.css, :root[data-light]).
// Eram 4 arquivos (cerca de 113 KB) baixados à toa por quem pediu economia de dados. Sem a pré-carga, cada recorte
// (latin, latin-ext, cirílico) só vem quando um texto na tela usa a família, e a fonte reserva ajustada do next/font
// segura o tamanho do texto enquanto isso. `subsets` continua dizendo quais recortes entram no CSS.
const serif = EB_Garamond({ variable: "--font-serif-display", subsets: ["latin"], preload: false });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"], preload: false });
const mono = IBM_Plex_Mono({ variable: "--font-archive", subsets: ["latin"], weight: ["400", "500"], preload: false });
// A letra escrita à mão do estúdio de design (bilhetes, legendas de foto revelada): só carrega quando alguém usa.
// A letra de madeira condensada do lambe-lambe da inicial (OFL-1.1). Sem pré-carga: só baixa na página que a usa.
const cartaz = Anton({ variable: "--font-cartaz", subsets: ["latin"], weight: "400", preload: false });
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
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
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

// A primeira aula do "Comece aqui" (content/comecar.json): o passo 2 dos três passos dos estados vazios (E4-05).
const primeiraAula = comecar.flatMap((bloco) => bloco.aulas)[0] ?? null;

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang, t } = await loadLang(params);
  return (
    <html
      lang={htmlLang[lang]}
      className={`${serif.variable} ${ui.variable} ${mono.variable} ${cartaz.variable} ${mao.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <PrefsScript />
      </head>
      <body className="paper min-h-full flex flex-col">
        <DadosEstruturados dados={[organizacao(), siteWeb(lang, t.meta.description)]} />
        {/* O núcleo sem as seções extras (i18n/core.ts): a rota que precisa de t.areas no navegador acrescenta a sua. */}
        <I18nProvider lang={lang} t={pickBase(t)}>
          {/* Etapa 4 (E4-05): os textos da busca viva, do histórico, dos três passos e do modo seguro, só neste idioma. */}
          <TextosDaBuscaProvider textos={textosDaBusca(lang)} primeiraAula={primeiraAula}>
          {/* O painel da equipe é uma tela à parte: lá dentro o site público não aparece. */}
          <OutsidePanel>
            <Header lang={lang} t={t} />
            <BarraDoCelular />
          </OutsidePanel>
          <main id="conteudo" className="flex-1">
            {children}
          </main>
          <OutsidePanel>
            <Footer lang={lang} t={t} />
            <RadioPlayer />
            <BottomNav />
            <VoltarAoTopo label={t.lists.top} />
            <OpeningNotice initial={abertura.ativo ? abertura : null} close={t.a11y.close} />
            <MaisGaveta
              secoes={secoesDoSite(lang, t)}
              // E4-09: com a Escola ligada, o "Mais" vira o mapa do campus. Sem ela, nada muda.
              campus={ligado("escola") ? { predios: campusDoSite(lang, t), s: textosDoCampus(lang).mapa } : undefined}
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
          {/* O histórico local (só grava quando a pessoa ligou) e a saída rápida do modo seguro (sempre disponível). */}
          <RegistroDeVisita />
          {/* E4-09: o passaporte do campus (primeira visita a cada prédio, só no aparelho), só com a Escola ligada. */}
          {ligado("escola") && <RegistroDoPassaporte />}
          <SaidaRapida />
          </TextosDaBuscaProvider>
        </I18nProvider>
      </body>
    </html>
  );
}