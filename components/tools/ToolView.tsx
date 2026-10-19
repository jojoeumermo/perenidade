// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { Dict } from "@/i18n/types";
import type { ToolId } from "@/lib/areas";

type Tools = Dict["tools"];

// Cada ferramenta é baixada só quando alguém a abre na caixa de ferramentas da aula.
// O next/dynamic só aceita as opções escritas ali mesmo em cada chamada, não numa variável.
const espera = () => <p className="mt-6 font-sans text-sm text-ink-soft">…</p>;
const Resolvedor = dynamic(() => import("./Resolvedor").then((m) => m.Resolvedor), { ssr: false, loading: espera });
const Calculator = dynamic(() => import("./Science").then((m) => m.Calculator), { ssr: false, loading: espera });
const CompoundInterest = dynamic(() => import("./Science").then((m) => m.CompoundInterest), { ssr: false, loading: espera });
const NumberBases = dynamic(() => import("./Science").then((m) => m.NumberBases), { ssr: false, loading: espera });
const PeriodicTable = dynamic(() => import("./Science").then((m) => m.PeriodicTable), { ssr: false, loading: espera });
const Graphs = dynamic(() => import("./Graficos").then((m) => m.Graphs), { ssr: false, loading: espera });
const Conversor = dynamic(() => import("./Ciencias").then((m) => m.Conversor), { ssr: false, loading: espera });
const MassaMolarTool = dynamic(() => import("./Ciencias").then((m) => m.MassaMolarTool), { ssr: false, loading: espera });
const Balanceador = dynamic(() => import("./Ciencias").then((m) => m.Balanceador), { ssr: false, loading: espera });
const Punnett = dynamic(() => import("./Ciencias").then((m) => m.Punnett), { ssr: false, loading: espera });
const SistemaSolar = dynamic(() => import("./Ciencias").then((m) => m.SistemaSolar), { ssr: false, loading: espera });
const Estatistica = dynamic(() => import("./Dados").then((m) => m.Estatistica), { ssr: false, loading: espera });
const TabelaVerdade = dynamic(() => import("./Dados").then((m) => m.TabelaVerdade), { ssr: false, loading: espera });
const Cronometro = dynamic(() => import("./Estudo").then((m) => m.Cronometro), { ssr: false, loading: espera });
const Redacao = dynamic(() => import("./Estudo").then((m) => m.Redacao), { ssr: false, loading: espera });
const Silabario = dynamic(() => import("./Estudo").then((m) => m.Silabario), { ssr: false, loading: espera });
const Rcp = dynamic(() => import("./Varias").then((m) => m.Rcp), { ssr: false, loading: espera });
const FrequenciaCardiaca = dynamic(() => import("./Varias").then((m) => m.FrequenciaCardiaca), { ssr: false, loading: espera });
const Escala = dynamic(() => import("./Varias").then((m) => m.Escala), { ssr: false, loading: espera });
const Fusos = dynamic(() => import("./Varias").then((m) => m.Fusos), { ssr: false, loading: espera });
const Cores = dynamic(() => import("./Varias").then((m) => m.Cores), { ssr: false, loading: espera });
const MaisValia = dynamic(() => import("./Varias").then((m) => m.MaisValia), { ssr: false, loading: espera });
const AtelieHtml = dynamic(() => import("./Varias").then((m) => m.AtelieHtml), { ssr: false, loading: espera });
const CodeRunner = dynamic(() => import("./CodeRunner").then((m) => m.CodeRunner), { ssr: false, loading: espera });
const Tuner = dynamic(() => import("./Music").then((m) => m.Tuner), { ssr: false, loading: espera });
const Metronome = dynamic(() => import("./Music").then((m) => m.Metronome), { ssr: false, loading: espera });
const Keyboard = dynamic(() => import("./Music").then((m) => m.Keyboard), { ssr: false, loading: espera });
const NoteReading = dynamic(() => import("./Music").then((m) => m.NoteReading), { ssr: false, loading: espera });
const Pronounce = dynamic(() => import("./Pronounce").then((m) => m.Pronounce), { ssr: false, loading: espera });
const Dictionary = dynamic(() => import("./Idiomas").then((m) => m.Dictionary), { ssr: false, loading: espera });
const Sentences = dynamic(() => import("./Idiomas").then((m) => m.Sentences), { ssr: false, loading: espera });
const FisicaSimulada = dynamic(() => import("./Simulacoes").then((m) => m.FisicaSimulada), { ssr: false, loading: espera });
const Reacoes = dynamic(() => import("./Simulacoes").then((m) => m.Reacoes), { ssr: false, loading: espera });

/** Mostra uma ferramenta pelo nome, com os textos que a página da aula mandou (só os das ferramentas daquela disciplina). */
const PhetLista = dynamic(() => import("../labs/Phet").then((m) => m.PhetLista), { ssr: false, loading: espera });

export function ToolView({ id, s, lang, area }: { id: ToolId; s: Partial<Tools>; lang: string; area?: string }) {
  const t = s as Tools;
  switch (id) {
    case "resolvedor":
      return <Resolvedor s={t.solver} lang={lang} />;
    case "calculadora":
      return <Calculator s={t.calc} lang={lang} />;
    case "graficos":
      return <Graphs s={t.graphs} lang={lang} />;
    case "estatistica":
      return <Estatistica s={t.stats} lang={lang} />;
    case "conversor-de-unidades":
      return <Conversor s={t.units} lang={lang} />;
    case "tabela-verdade":
      return <TabelaVerdade s={t.truth} />;
    case "tabela-periodica":
      return <PeriodicTable s={t.table} lang={lang} />;
    case "massa-molar":
      return <MassaMolarTool s={t.molar} lang={lang} />;
    case "balanceamento":
      return <Balanceador s={t.balance} />;
    case "punnett":
      return <Punnett s={t.punnett} />;
    case "sistema-solar":
      return <SistemaSolar s={t.solar} lang={lang} />;
    case "fisica-simulada":
      return <FisicaSimulada s={t.physics} lang={lang} />;
    case "reacoes":
      return <Reacoes s={t.reaction} />;
    case "python":
    case "php":
      return (
        <Suspense>
          <CodeRunner language={id} s={t.code} />
        </Suspense>
      );
    case "html":
      return <AtelieHtml s={t.html} />;
    case "bases-numericas":
      return <NumberBases s={t.bases} />;
    case "cronometro":
      return <Cronometro s={t.timer} />;
    case "redacao":
      return <Redacao s={t.essay} lang={lang} />;
    case "silabario":
      return <Silabario s={t.syllables} />;
    case "dicionario":
      return <Dictionary s={t.dictionary} initial={lang === "en" ? "en" : "pt"} />;
    case "pronuncia":
      return <Pronounce s={t.speak} initial={lang === "en" ? "es" : "en"} />;
    case "frases":
      return <Sentences s={t.sentences} initial={lang === "en" ? "fra" : "eng"} />;
    case "afinador":
      return <Tuner s={t.music} />;
    case "metronomo":
      return <Metronome s={t.music} />;
    case "teclado":
      return <Keyboard s={t.music} />;
    case "leitura-de-notas":
      return <NoteReading s={t.music} />;
    case "cores":
      return <Cores s={t.colors} />;
    case "escala-cartografica":
      return <Escala s={t.mapScale} lang={lang} />;
    case "fusos-horarios":
      return <Fusos s={t.timezones} lang={lang} />;
    case "juros-compostos":
      return <CompoundInterest s={t.interest} lang={lang} />;
    case "mais-valia":
      return <MaisValia s={t.surplus} lang={lang} />;
    case "rcp":
      return <Rcp s={t.cpr} />;
    case "frequencia-cardiaca":
      return <FrequenciaCardiaca s={t.heart} />;
    case "ide":
      return <AtalhoDaIde lang={lang} />;
    case "simulacoes":
      return <PhetLista area={area} compacto />;
  }
}

/** Na caixa da aula não cabe a IDE inteira: o atalho leva à página dela, no perfil da disciplina. */
function AtalhoDaIde({ lang }: { lang: string }) {
  const textos: Record<string, [string, string]> = { pt: ["Abrir a IDE", "Editor com arquivos, execução e saída. Abre em página própria, para ter espaço."], en: ["Open the IDE", "Editor with files, run and output. Opens on its own page, to have room."], es: ["Abrir la IDE", "Editor con archivos, ejecución y salida. Abre en página propia."], ru: ["Открыть IDE", "Редактор с файлами, запуском и выводом. Открывается на отдельной странице."], fr: ["Ouvrir l'IDE", "Éditeur avec fichiers, exécution et sortie. S'ouvre sur une page à part, pour avoir de la place."], zh: ["打开 IDE", "带文件、运行和输出的编辑器，在独立页面打开。"] };
  const [rotulo, texto] = textos[lang] ?? textos.pt;
  return (
    <div className="mt-6 font-sans text-sm">
      <p className="text-ink-soft">{texto}</p>
      <a href={`/${lang}/laboratorios/ide`} className="mt-3 inline-block bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood">{rotulo} →</a>
    </div>
  );
}
