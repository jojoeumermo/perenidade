// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { DadosDaGreve, Fato, Frase } from "@/components/labs/JogosDeFormacao";
import { PaginaDosJogos, type CartaoDeJogo } from "@/components/jogos/PaginaDosJogos";
import type { CartaoProprio } from "@/components/jogos/Proprios";
import { JOGOS_PROPRIOS } from "@/components/jogos/proprios/registro";
import { JOGOS_PROPRIOS_2 } from "@/components/jogos/proprios2/registro";
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
// Os jogos de treino, na ordem dos cartões (os mesmos de components/jogos/PaginaDosJogos.tsx; a lista mora aqui porque
// o que sai de um módulo "use client" chega ao servidor só como referência).
const TREINO = ["cruzadas", "caca", "sudoku", "forca", "memoria", "quebra", "velha", "ditado"] as const;

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
 * perguntas e ditado, gerados com o glossário), os jogos do Instituto, a música para crianças (sons sintetizados no
 * aparelho) e os jogos de formação que antes moravam em Laboratórios (Rumos, Greve!, linha do tempo e Quem disse?).
 * Desde 05/11/2026 com cara de página de jogos (components/jogos/PaginaDosJogos.tsx): o Rumos em destaque, as categorias
 * numa barra e um cartão por jogo, com arte, tempo, jogadores e o botão Jogar. Sem pontos, sem placar.
 */
export default async function Page({ params }: PageProps<"/[lang]/jogos">) {
  const { lang, t } = await loadLang(params);
  const j = textosDosJogos(lang);
  const f = t.labs.jogos;
  const fora = lang !== defaultLocale;
  const cartoes: CartaoDeJogo[] = [
    ...TREINO.map((id): CartaoDeJogo => ({ chave: `treino:${id}`, categoria: "treino", id, titulo: j.treino.jogos[id].nome, texto: j.treino.jogos[id].texto, jogadores: id === "velha" ? 2 : 1 })),
    ...cartoesDosProprios().map((c): CartaoDeJogo => ({ chave: `proprios:${c.id}`, categoria: "proprios", id: c.id, grupo: c.grupo, titulo: c.titulo, texto: c.resumo, minutos: c.minutos, jogadores: 1, publico: j.proprios.publico[c.publico], tema: c.tema, soEmPortugues: true })),
    { chave: "criancas", categoria: "criancas", titulo: j.criancas.titulo, texto: j.criancas.lead, jogadores: 1, inclui: Object.values(j.criancas.jogos).map((x) => x.nome) },
    { chave: "formacao", categoria: "formacao", titulo: f.title, texto: f.lead, jogadores: 1, inclui: [f.rumos.title, f.strike, f.timeline, f.quotes] },
  ];
  const formacao = cartoes.at(-1)!;
  return (
    <>
      <PaginaDosJogos
        cartoes={cartoes}
        destaque={{ cartao: formacao, nome: f.rumos.title, texto: f.card }}
        textos={{
          s: j,
          categorias: {
            treino: { nome: j.treino.titulo, lead: j.treino.lead },
            proprios: { nome: j.proprios.titulo, lead: j.proprios.lead },
            criancas: { nome: j.criancas.titulo, lead: j.criancas.lead },
            formacao: { nome: f.title, lead: f.lead },
          },
        }}
        avisos={fora ? { treino: j.pagina.aviso, proprios: j.proprios.aviso } : {}}
        verbetes={verbetesParaJogos()}
        checagens={lerChecagensParaJogo()}
        formacao={{ baralhos: baralhosConferidos(), greve: greve as DadosDaGreve, fatos: (nesteDia as { fatos: Fato[] }).fatos, frases: frases as Frase[], s: f }}
        lang={lang}
        titulo={
          <>
            <p className="rotulo text-[#e0837a]!">{j.pagina.rotulo}</p>
            <h1 className="mt-3 text-[3rem] font-medium leading-none tracking-[-0.01em] sm:text-[4.4rem]">{j.meta.titulo}</h1>
            <p className="mt-5 max-w-[34rem] text-[1.2rem] leading-[1.45] text-[#e9dcbc] max-md:text-lg">{j.pagina.lead}</p>
            <div className="mt-5 [&_*]:text-[#f4ecd8]">
              <Untranslated lang={lang} t={t} show={fora} />
            </div>
          </>
        }
      />
    </>
  );
}
