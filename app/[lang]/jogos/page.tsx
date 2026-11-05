// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { JogosDeFormacao, type DadosDaGreve, type Fato, type Frase } from "@/components/labs/JogosDeFormacao";
import { CriancasSons } from "@/components/jogos/CriancasSons";
import { JogosProprios, type CartaoProprio } from "@/components/jogos/Proprios";
import { JOGOS_PROPRIOS } from "@/components/jogos/proprios/registro";
import { JOGOS_PROPRIOS_2 } from "@/components/jogos/proprios2/registro";
import { Treino } from "@/components/jogos/Treino";
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";
import { Untranslated } from "@/components/Untranslated";
import frases from "@/content/frases.json";
import greve from "@/content/jogos/greve.json";
import rumosFilosofia from "@/content/jogos/rumos-filosofia-e-sociologia.json";
import rumosHistoria from "@/content/jogos/rumos-historia-do-brasil.json";
import rumosPolitica from "@/content/jogos/rumos-politica-e-cidadania.json";
import rumosEnem from "@/content/jogos/rumos-revisao-enem.json";
import rumosReformaAgraria from "@/content/jogos/rumos-reforma-agraria-e-mutirao.json";
import rumosCursinhoPopular from "@/content/jogos/rumos-cursinho-popular.json";
import rumosRadioComunitaria from "@/content/jogos/rumos-radio-comunitaria.json";
import rumosSindicatoDeBairro from "@/content/jogos/rumos-sindicato-de-bairro.json";
import rumosSoftwareLivre from "@/content/jogos/rumos-desenvolvedor-de-software-livre.json";
import rumosCostureira from "@/content/jogos/rumos-costureira-e-cooperativa.json";
import rumosEletricista from "@/content/jogos/rumos-eletricista-autonomo.json";
import rumosColetivoArtes from "@/content/jogos/rumos-coletivo-de-artes-e-hip-hop.json";
import nesteDia from "@/content/neste-dia.json";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { textosDosJogos } from "@/i18n/jogos";
import { BARALHOS_DE_RUMOS } from "@/lib/laboratorios";
import { verbetesParaJogos } from "@/lib/jogos/verbetes";
import { lerChecagensParaJogo } from "@/lib/jogos-proprios/checagens";
import { validarBaralho, type Baralho } from "@/lib/rumos";
import { paginaMeta } from "@/lib/seo";

const TRILHAS = path.join(process.cwd(), "content", "trilhas");

/** Os cartões dos 16 jogos próprios: lidos dos dois registros (só dados; o jogo em si só é baixado quando a pessoa o abre). */
function cartoesDosProprios(): CartaoProprio[] {
  return [
    ...JOGOS_PROPRIOS.map((g): CartaoProprio => ({ grupo: "a", id: g.slug, titulo: g.titulo, resumo: g.resumo, publico: g.publico, minutos: g.minutos, tema: g.tema })),
    ...JOGOS_PROPRIOS_2.map((g): CartaoProprio => ({ grupo: "b", id: g.id, titulo: g.titulo, resumo: g.resumo, publico: g.publico, minutos: g.minutos, tema: g.tema })),
  ];
}

/**
 * Os baralhos do Rumos, conferidos aqui: baralho inválido derruba o build com a lista dos problemas. A conferência das
 * aulas só roda onde a pasta content/trilhas existe (no build); `npm run testar:jogos` faz a mesma conferência no CI.
 */
function baralhosConferidos(): Baralho[] {
  const porId: Record<string, unknown> = {
    "historia-do-brasil": rumosHistoria,
    "filosofia-e-sociologia": rumosFilosofia,
    "politica-e-cidadania": rumosPolitica,
    "revisao-enem": rumosEnem,
    "reforma-agraria-e-mutirao": rumosReformaAgraria,
    "cursinho-popular": rumosCursinhoPopular,
    "radio-comunitaria": rumosRadioComunitaria,
    "sindicato-de-bairro": rumosSindicatoDeBairro,
    "desenvolvedor-de-software-livre": rumosSoftwareLivre,
    "costureira-e-cooperativa": rumosCostureira,
    "eletricista-autonomo": rumosEletricista,
    "coletivo-de-artes-e-hip-hop": rumosColetivoArtes,
  };
  const aulaExiste = fs.existsSync(TRILHAS) ? (href: string) => fs.existsSync(path.join(TRILHAS, `${href.replace(/^\/trilhas\//, "")}.md`)) : undefined;
  const erros = BARALHOS_DE_RUMOS.flatMap((id) => (porId[id] ? validarBaralho(porId[id], { aulaExiste }) : [`${id}: baralho registrado em lib/laboratorios.ts sem arquivo`]));
  if (erros.length) throw new Error(`Baralhos do Rumos com problema:\n${erros.join("\n")}`);
  return BARALHOS_DE_RUMOS.map((id) => porId[id] as Baralho);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/jogos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const j = textosDosJogos(lang);
  return paginaMeta(lang, "/jogos", j.meta.titulo, j.meta.descricao);
}

/**
 * Jogos: o treino de palavras (cruzadas, caça-palavras, sudoku, forca, memória, quebra-cabeça, jogo da velha com
 * perguntas e ditado, gerados com o glossário), a música para crianças (sons sintetizados no aparelho) e os jogos de
 * formação que antes moravam em Laboratórios (Rumos, Greve!, linha do tempo e Quem disse?). Sem pontos, sem placar.
 */
export default async function Page({ params }: PageProps<"/[lang]/jogos">) {
  const { lang, t } = await loadLang(params);
  const j = textosDosJogos(lang);
  return (
    <>
      <Capa rotulo={j.pagina.rotulo} titulo={j.meta.titulo} largura="larga">
        {j.pagina.lead}
      </Capa>
      <Corpo largura="media">
        <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
        <nav aria-label={j.meta.titulo} className="mb-10 flex flex-wrap gap-2 font-sans text-sm font-bold">
          {([["treino", j.pagina.irTreino], ["proprios", j.pagina.irProprios], ["criancas", j.pagina.irCriancas], ["formacao", j.pagina.irFormacao]] as const).map(([id, nome]) => (
            <a key={id} href={`#${id}`} className="border-2 border-ink px-3 py-1.5 hover:bg-ink hover:text-parchment">{nome}</a>
          ))}
        </nav>
        <Secao id="treino" titulo={j.treino.titulo} descricao={<>{j.treino.lead} {lang !== defaultLocale && <span>{j.pagina.aviso}</span>}</>}>
          <Treino verbetes={verbetesParaJogos()} s={j} lang={lang} />
        </Secao>
        <Secao id="proprios" titulo={j.proprios.titulo} className="mt-16" descricao={<>{j.proprios.lead} {lang !== defaultLocale && <span>{j.proprios.aviso}</span>}</>}>
          <JogosProprios cartoes={cartoesDosProprios()} checagens={lerChecagensParaJogo()} s={j} lang={lang} />
        </Secao>
        <Secao id="criancas" titulo={j.criancas.titulo} tarja="vermelha" className="mt-16">
          <CriancasSons s={j} />
        </Secao>
        <Secao id="formacao" titulo={t.labs.jogos.title} className="mt-16" descricao={t.labs.jogos.lead}>
          <JogosDeFormacao baralhos={baralhosConferidos()} greve={greve as DadosDaGreve} fatos={(nesteDia as { fatos: Fato[] }).fatos} frases={frases as Frase[]} s={t.labs.jogos} />
        </Secao>
      </Corpo>
    </>
  );
}
