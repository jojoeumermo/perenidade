// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IDEPagina } from "@/components/labs/IDEPagina";
import { PhetLista } from "@/components/labs/Phet";
import { PageHeading } from "@/components/PageHeading";
import { Keyboard, Metronome, NoteReading, Tuner } from "@/components/tools/Music";
import { Pronounce } from "@/components/tools/Pronounce";
import { Graphs } from "@/components/tools/Graficos";
import { Dictionary, Sentences } from "@/components/tools/Idiomas";
import { Calculator, CompoundInterest, NumberBases, PeriodicTable } from "@/components/tools/Science";
import { Balanceador, Conversor, MassaMolarTool, Punnett, SistemaSolar } from "@/components/tools/Ciencias";
import { Estatistica, TabelaVerdade } from "@/components/tools/Dados";
import { Cronometro, Redacao, Silabario } from "@/components/tools/Estudo";
import { Resolvedor } from "@/components/tools/Resolvedor";
import { Ceu } from "@/components/tools/novas/Ceu";
import { DicionarioChines, EscritaChinesa } from "@/components/tools/novas/Chines";
import { CorretorOrtografico } from "@/components/tools/novas/Ortografia";
import { Algoritmos, Criptografia, Grafos } from "@/components/tools/novas/Computacao";
import { CalculadorasDeEletronica } from "@/components/tools/novas/Eletronica";
import { PalavrasGeradoras, Referencias } from "@/components/tools/novas/Escrita";
import { Sudoku } from "@/components/tools/novas/Jogos";
import { Alfabetos, TonsDoMandarim } from "@/components/tools/novas/Linguas";
import { ContasDoDia, Solidos } from "@/components/tools/novas/Matematica";
import { DireitosDoTrabalhador } from "@/components/tools/novas/Trabalho";
import { FisicaSimulada, Reacoes } from "@/components/tools/Simulacoes";
import { Cores, Escala, FrequenciaCardiaca, Fusos, MaisValia, Rcp } from "@/components/tools/Varias";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { Moldura } from "@/components/tools/Vitrine";
import { Selo } from "@/components/Selo";
import { ICONES, textosDe } from "@/components/tools/vitrine-dados";
import { areaLabs, areaTools, LABS, tools, universalTools, type AreaSlug, type LabId, type ToolId } from "@/lib/areas";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(tools.map((tool) => ({ tool })));
}

const isTool = (value: string): value is ToolId => (tools as readonly string[]).includes(value);
/** As ferramentas da rodada nova: a interface e os exercícios estão em português por enquanto. */
const NOVAS_EM_PT = new Set<string>(["algoritmos", "criptografia", "grafos", "sudoku", "referencias-abnt", "palavras-geradoras", "solidos", "contas-do-dia-a-dia", "tons-do-mandarim", "alfabetos", "ceu", "calculadoras-de-eletronica", "direitos-trabalhistas", "dicionario-chines", "escrita-chinesa", "corretor-ortografico"]);

export async function generateMetadata({ params }: PageProps<"/[lang]/ferramentas/[tool]">): Promise<Metadata> {
  const { t } = await loadLang(params);
  const { tool } = await params;
  const names = t.toolNames as Record<string, string[]>;
  return isTool(tool) ? { title: names[tool][0], description: names[tool][1] } : {};
}

export default async function Ferramenta({ params }: PageProps<"/[lang]/ferramentas/[tool]">) {
  const { lang, t } = await loadLang(params);
  const { tool } = await params;
  if (!isTool(tool)) notFound();

  const s = t.tools;
  const [name, description] = (t.toolNames as Record<string, string[]>)[tool];
  const areas = (Object.keys(areaTools) as AreaSlug[]).filter((area) => areaTools[area]?.includes(tool));
  const body: Record<ToolId, React.ReactNode> = {
    // O editor lê o código vindo de uma aula pelo endereço, por isso espera o navegador para aparecer.
    python: <Suspense><IDEPagina perfilInicial="python" /></Suspense>,
    php: <Suspense><IDEPagina perfilInicial="php" /></Suspense>,
    ide: <Suspense><IDEPagina /></Suspense>,
    simulacoes: <PhetLista />,
    afinador: <Tuner s={s.music} />,
    metronomo: <Metronome s={s.music} />,
    teclado: <Keyboard s={s.music} />,
    "leitura-de-notas": <NoteReading s={s.music} />,
    "tabela-periodica": <PeriodicTable s={s.table} lang={lang} />,
    calculadora: <Calculator s={s.calc} lang={lang} />,
    "juros-compostos": <CompoundInterest s={s.interest} lang={lang} />,
    "bases-numericas": <NumberBases s={s.bases} />,
    pronuncia: <Pronounce s={s.speak} initial={lang === "en" ? "es" : "en"} />,
    dicionario: <Dictionary s={s.dictionary} initial={lang === "en" ? "en" : "pt"} />,
    frases: <Sentences s={s.sentences} initial={lang === "en" ? "fra" : "eng"} />,
    graficos: <Graphs s={s.graphs} lang={lang} />,
    resolvedor: <Resolvedor s={s.solver} lang={lang} />,
    estatistica: <Estatistica s={s.stats} lang={lang} />,
    "conversor-de-unidades": <Conversor s={s.units} lang={lang} />,
    "tabela-verdade": <TabelaVerdade s={s.truth} />,
    "massa-molar": <MassaMolarTool s={s.molar} lang={lang} />,
    balanceamento: <Balanceador s={s.balance} />,
    punnett: <Punnett s={s.punnett} />,
    "sistema-solar": <SistemaSolar s={s.solar} lang={lang} />,
    "fisica-simulada": <FisicaSimulada s={s.physics} lang={lang} />,
    reacoes: <Reacoes s={s.reaction} />,
    html: <Suspense><IDEPagina perfilInicial="web" /></Suspense>,
    cronometro: <Cronometro s={s.timer} />,
    redacao: <Redacao s={s.essay} lang={lang} />,
    silabario: <Silabario s={s.syllables} />,
    cores: <Cores s={s.colors} />,
    "escala-cartografica": <Escala s={s.mapScale} lang={lang} />,
    "fusos-horarios": <Fusos s={s.timezones} lang={lang} />,
    "mais-valia": <MaisValia s={s.surplus} lang={lang} />,
    rcp: <Rcp s={s.cpr} />,
    "frequencia-cardiaca": <FrequenciaCardiaca s={s.heart} />,
    "algoritmos": <div lang="pt-BR"><Algoritmos /></div>,
    "criptografia": <div lang="pt-BR"><Criptografia /></div>,
    "grafos": <div lang="pt-BR"><Grafos /></div>,
    "sudoku": <div lang="pt-BR"><Sudoku /></div>,
    "referencias-abnt": <div lang="pt-BR"><Referencias /></div>,
    "palavras-geradoras": <div lang="pt-BR"><PalavrasGeradoras /></div>,
    "solidos": <div lang="pt-BR"><Solidos /></div>,
    "contas-do-dia-a-dia": <div lang="pt-BR"><ContasDoDia /></div>,
    "tons-do-mandarim": <div lang="pt-BR"><TonsDoMandarim /></div>,
    "alfabetos": <div lang="pt-BR"><Alfabetos /></div>,
    "ceu": <div lang="pt-BR"><Ceu /></div>,
    "calculadoras-de-eletronica": <div lang="pt-BR"><CalculadorasDeEletronica /></div>,
    "direitos-trabalhistas": <div lang="pt-BR"><DireitosDoTrabalhador /></div>,
    "dicionario-chines": <div lang="pt-BR"><DicionarioChines /></div>,
    "escrita-chinesa": <div lang="pt-BR"><EscritaChinesa /></div>,
    "corretor-ortografico": <div lang="pt-BR"><CorretorOrtografico /></div>,
  };

  // O que mais serve a quem está aqui: ferramentas das mesmas matérias e os laboratórios dessas matérias.
  const names = t.toolNames as Record<string, string[]>;
  const parecidas = tools.filter((x) => x !== tool && areas.some((a) => areaTools[a]?.includes(x))).slice(0, 6);
  const labIds = [...new Set(areas.flatMap((a) => areaLabs[a] ?? []))] as LabId[];
  const nomesDosLabs = t.labs as unknown as Record<string, string>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href={localePath(lang, "/ferramentas")} className="font-sans text-sm text-ink-soft hover:text-oxblood">
        ← {s.title}
      </Link>
      <div className="mt-6">
        <PageHeading eyebrow={s.eyebrow} title={name}>
          {description}
        </PageHeading>
      </div>
      {lang !== "pt" && NOVAS_EM_PT.has(tool) && <p className="mt-4 border-l-4 border-gold bg-parchment-deep px-3 py-2 font-sans text-sm">{t.labs.ptOnly}</p>}
      <Moldura id={tool} s={textosDe(t)}>{body[tool]}</Moldura>
      {(parecidas.length > 0 || labIds.length > 0) && (
        <div className="mt-10 grid gap-6 border-t border-rule pt-6 font-sans sm:grid-cols-2">
          {parecidas.length > 0 && (
            <section>
              <h2 className="font-mono text-xs uppercase tracking-widest text-oxblood">{s.related}</h2>
              <ul className="mt-2 space-y-1.5">
                {parecidas.map((x) => <li key={x}><Link href={localePath(lang, `/ferramentas/${x}`)} className="flex items-center gap-2 hover:text-oxblood"><Selo nome={ICONES[x] ?? "ferramentas"} className="h-5 w-5" /><span className="font-semibold">{names[x][0]}</span></Link></li>)}
              </ul>
            </section>
          )}
          {labIds.length > 0 && (
            <section>
              <h2 className="font-mono text-xs uppercase tracking-widest text-oxblood">{s.relatedLabs}</h2>
              <ul className="mt-2 space-y-1.5">
                {labIds.map((x) => <li key={x}><Link href={localePath(lang, LABS[x])} className="flex items-center gap-2 font-semibold hover:text-oxblood"><Selo nome="frasco" className="h-5 w-5" />{nomesDosLabs[x] ?? x}</Link></li>)}
              </ul>
            </section>
          )}
        </div>
      )}
      {(universalTools as readonly string[]).includes(tool) && <p className="mt-10 border-t border-rule pt-5 font-sans text-sm text-ink-soft">{s.universal}</p>}
      {areas.length > 0 && (
        <p className="mt-10 border-t border-rule pt-5 font-sans text-sm text-ink-soft">
          {s.usedIn}{" "}
          {areas.map((area, i) => (
            <span key={area}>
              {i > 0 && " · "}
              <Link href={localePath(lang, `/estantes/${area}`)} className="underline decoration-gold underline-offset-4 hover:text-oxblood">
                {t.areas[area][0]}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
