// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Archivo, EB_Garamond } from "next/font/google";
import Link from "@/components/Link";
import { MolduraDaAlumia } from "@/components/rede/MolduraDaAlumia";
import { EmConstrucao } from "@/components/rede/EmConstrucao";
import { PortaoDaAlumia } from "@/components/rede/entrada/PortaoDaAlumia";
import { ManterAparencia } from "@/components/rede/aparencia/base";
import { ComAlumia2 } from "@/components/rede/conversa/Alumia2";
import { loadLang } from "@/i18n";
import { alumia2Ligada, rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { figurasDaEntrada } from "@/lib/rede/entrada/figuras";
import { textosDaEntrada } from "@/lib/rede/entrada/textos";
import { alumiaComEndereco } from "@/lib/rede/alumia";
import { metadadosDaMarcaDaAlumia } from "@/lib/rede/marca-da-alumia";
import { scriptDaAparencia } from "@/lib/rede/aparencia-da-rede";
import { carregarTextosDoAcabamento } from "@/lib/rede/textos-acabamento";
import { ligado } from "@/lib/recursos";
import { site } from "@/lib/site";
// Os tokens da Alumia nova (Onda 5): só valem dentro de [data-al="2"], que só aparece com "rede-v2" + "alumia-2" ligadas.
import "@/styles/alumia-tokens.css";

// As letras das pranchas, carregadas SÓ aqui (a Alumia), sem pré-carga: Archivo variável com o eixo de largura (62–125) para os
// títulos condensados, e EB Garamond itálica só para o "Instituto Lúcia" da marca. Com a flag desligada as classes não entram e
// nenhum arquivo de fonte é baixado.
const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--al-fonte-archivo", preload: false, display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin", "latin-ext"], style: ["italic"], weight: ["400"], variable: "--al-fonte-garamond", preload: false, display: "swap" });

/**
 * A marca da Alumia em todas as páginas dela, também no aviso "em construção": o cartão de compartilhamento próprio (no lugar do
 * /cartao-lucia.png do site), o lampião na aba e na tela inicial e o manifesto da rede (lib/rede/marca-da-alumia.ts). As páginas
 * que só dão o título herdam tudo isto.
 */
export async function generateMetadata({ params }: LayoutProps<"/[lang]/alumia">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return metadadosDaMarcaDaAlumia(lang);
}

/**
 * Todas as telas da Alumia, a rede social do instituto (a de hoje e a v2): a moldura tira a casca do site de cena e põe no alto o
 * botão "Voltar ao site". No endereço próprio (alumia.institutolucia.org) o proxy.ts reescreve para estas rotas. Sem leitura de
 * disco e sem cabeçalhos do pedido: a página continua podendo sair pronta do cache.
 *
 * Com "rede-v2" e "alumia-2" ligadas (lib/rede/rotas-novas.ts), tudo fica dentro de [data-al="2"], com as letras e os tokens da
 * Alumia nova (styles/alumia-tokens.css). Desligadas, o HTML é exatamente o de antes.
 */
export default async function LayoutDaAlumia({ children, params }: LayoutProps<"/[lang]/alumia">) {
  const { lang } = await loadLang(params);
  // Recurso "alumia-aberta" (só pelo nome): enquanto as ondas de construção não terminam, a Alumia inteira, em qualquer endereço,
  // mostra só o aviso. Nenhuma tela, nenhum dado e nenhuma chamada ao banco da rede saem daqui.
  if (!ligado("alumia-aberta")) return <EmConstrucao lang={lang} className={archivo.variable} site={alumiaComEndereco ? `${site.url}/${lang}` : `/${lang}`} />;
  // Recurso "alumia-entrada" (só pelo nome): sem conta aprovada e sem o segundo fator, a Alumia mostra só a entrada (o portão
  // decide no navegador, onde mora a sessão; o banco confere de novo). Desligado, nada muda.
  const conteudo = ligado("alumia-entrada") ? (
    <PortaoDaAlumia lang={lang} t={textosDaEntrada(lang)} figuras={figurasDaEntrada()} comDiretorio={rotaNovaLigada("organizacoes")} site={alumiaComEndereco ? `${site.url}/${lang}` : `/${lang}`}>
      {children}
    </PortaoDaAlumia>
  ) : (
    children
  );
  // Dentro do aplicativo do Instituto a Alumia não abre (decisão de 12/11/2026): o prefsScript marca o <html> com data-sem-alumia
  // (lib/rede/app-do-instituto.ts) e o CSS (app/globals.css) troca a tela pelo aviso. No navegador o aviso nunca aparece e a
  // caixa .al-dentro-do-navegador é display: contents (não muda o desenho). Tudo no CSS: a página continua saindo do cache.
  const ta = (await carregarTextosDoAcabamento(lang)).app;
  const moldura = (
    <>
      <div className="al-fora-do-app" role="region" aria-labelledby="al-fora-do-app-titulo">
        <h1 id="al-fora-do-app-titulo">{ta.titulo}</h1>
        <p>{ta.texto}</p>
        <Link href={`/${lang}`}>{ta.voltar}</Link>
      </div>
      <div className="al-dentro-do-navegador">
        <MolduraDaAlumia lang={lang} s={textosDaRede(lang)}>
          {conteudo}
        </MolduraDaAlumia>
      </div>
    </>
  );
  if (!alumia2Ligada()) return moldura;
  return (
    // O tema e o "ocultar números" (lib/rede/aparencia-da-rede.ts) entram como atributos NESTA caixa, postos pelo script abaixo antes
    // da primeira pintura (a escolha mora no aparelho; o servidor não sabe dela e a página continua saindo do cache). Por isso o
    // suppressHydrationWarning: os atributos a mais são de propósito.
    <div data-al="2" className={`${archivo.variable} ${garamond.variable}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: scriptDaAparencia }} />
      <ManterAparencia />
      {/* As letras também para os painéis do site que abrem por cima da Alumia (acessibilidade, perguntas): eles moram fora desta
          caixa, e ganham a pele da Alumia pela classe .al-pele (styles/alumia-tokens.css). O React leva este <style> para o <head>. */}
      <style href="al-letras" precedence="medium">{`:root:has([data-al="2"]){--al-fonte-archivo:${archivo.style.fontFamily};--al-fonte-garamond:${garamond.style.fontFamily}}`}</style>
      <ComAlumia2>{moldura}</ComAlumia2>
    </div>
  );
}
