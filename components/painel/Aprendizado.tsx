// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Selo } from "@/components/Selo";
import { botao, campo } from "./comum";

interface Aula {
  slug: string;
  titulo: string;
  pronta: boolean;
}
interface Disciplina {
  area: string;
  nome: string;
  trilhas: { slug: string; titulo: string; etapa: string; aulas: Aula[] }[];
}

/** O roteiro de uma aula curta de dez minutos, para ensaiar antes de dar a oficina. */
const ROTEIRO: [number, string, string][] = [
  [1, "Puxe o assunto", "Uma pergunta ou uma situação do dia a dia que a turma reconhece."],
  [3, "A ideia central", "Uma ideia só, explicada com um exemplo concreto. Sem jargão, ou com o jargão explicado."],
  [3, "A turma tenta", "Um exercício, uma pergunta ou um caso para resolver juntos."],
  [2, "O erro comum", "O tropeço mais frequente nesse assunto e como sair dele."],
  [1, "Feche em uma frase", "O que a pessoa leva para casa. Diga onde estudar mais no site."],
];

const FERRAMENTAS: { selo: string; nome: string; sobre: string; href: string }[] = [
  { selo: "caderno", nome: "Caderno de estudos", sobre: "Fontes, resumo, cartões e questionário para preparar a oficina.", href: "?aba=caderno" },
  { selo: "microfone", nome: "Aulas ao vivo", sobre: "Marcar a oficina na agenda e abrir a sala com vídeo.", href: "?aba=aovivo" },
  { selo: "lupa", nome: "Fontes abertas", sobre: "Obras, verbetes e datas em acervos livres, com a fonte à vista.", href: "?aba=fontes" },
  { selo: "folha", nome: "Escritório", sobre: "Documentos, planilhas e slides para a apostila da oficina.", href: "?aba=escritorio" },
  { selo: "frasco", nome: "Laboratórios", sobre: "Simuladores de física, química, eletricidade, redes e mais para mostrar na hora.", href: "/laboratorios" },
  { selo: "ferramentas", nome: "Ferramentas de prática", sobre: "Calculadoras, jogos de palavras, conjugador e outros exercícios.", href: "/ferramentas" },
  { selo: "tela", nome: "Sala livre", sobre: "Quadro, projeção e ferramentas para a aula presencial.", href: "/sala-livre" },
  { selo: "letras", nome: "Glossário", sobre: "Os termos de cada disciplina explicados em poucas linhas.", href: "/glossario" },
];

type Aba = "topicos" | "simulador" | "ferramentas";

/**
 * A estante do aprendizado interno: os tópicos de cada disciplina (as aulas que já existem e as que faltam, boas
 * para uma oficina), um simulador de aula curta para ensaiar com cronômetro e roteiro, e as ferramentas do site que
 * ajudam a preparar e a dar a oficina. "Propor" abre a caixa de publicação já com o título.
 */
export function EstanteDoAprendizado({ propor }: { propor: (titulo: string) => void }) {
  const [aba, setAba] = useState<Aba>("topicos");
  const [dados, setDados] = useState<Disciplina[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch("/api/aprendizado")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { disciplinas?: Disciplina[] }) => vivo && setDados(Array.isArray(d.disciplinas) ? d.disciplinas : []))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);
  const abas: [Aba, string][] = [
    ["topicos", "Tópicos por disciplina"],
    ["simulador", "Simulador de aula"],
    ["ferramentas", "Ferramentas"],
  ];
  return (
    <section className="border border-rule bg-parchment-deep">
      <div role="tablist" aria-label="Estante do aprendizado" className="flex flex-wrap gap-1 border-b border-rule px-2 pt-2">
        {abas.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`cursor-pointer border-2 border-b-0 px-3 py-1.5 text-sm font-semibold ${aba === id ? "border-ink bg-parchment" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {nome}
          </button>
        ))}
      </div>
      <div className="p-4">
        {aba === "ferramentas" ? (
          <Ferramentas />
        ) : erro ? (
          <p className="text-ink-soft">Não deu para carregar as disciplinas agora. Tente de novo em instantes.</p>
        ) : !dados ? (
          <p className="text-ink-soft">Carregando as disciplinas…</p>
        ) : aba === "topicos" ? (
          <Topicos disciplinas={dados} propor={propor} />
        ) : (
          <Simulador disciplinas={dados} propor={propor} />
        )}
      </div>
    </section>
  );
}

function Topicos({ disciplinas, propor }: { disciplinas: Disciplina[]; propor: (titulo: string) => void }) {
  const [area, setArea] = useState(disciplinas[0]?.area ?? "");
  const [soFaltam, setSoFaltam] = useState(false);
  const atual = disciplinas.find((d) => d.area === area);
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Disciplina
          <select value={area} onChange={(e) => setArea(e.target.value)} className={`${campo} mt-1 block`}>
            {disciplinas.map((d) => (
              <option key={d.area} value={d.area}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={soFaltam} onChange={(e) => setSoFaltam(e.target.checked)} /> Só as aulas que ainda faltam escrever
        </label>
      </div>
      <p className="mt-2 text-sm text-ink-soft">Escolha um tópico para dar uma oficina ou para estudar junto. As aulas que faltam são um bom começo: a oficina pode virar a aula do site.</p>
      {atual?.trilhas.map((trilha) => {
        const aulas = soFaltam ? trilha.aulas.filter((a) => !a.pronta) : trilha.aulas;
        if (aulas.length === 0) return null;
        return (
          <details key={trilha.slug} className="mt-3 border border-rule bg-parchment" open={atual.trilhas.length === 1}>
            <summary className="cursor-pointer px-3 py-2 font-semibold">
              {trilha.titulo} <span className="font-mono text-xs font-normal text-ink-soft">· {trilha.etapa} · {aulas.length}</span>
            </summary>
            <ul className="divide-y divide-rule border-t border-rule">
              {aulas.map((aula) => (
                <li key={aula.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">{aula.titulo}</span>
                  {aula.pronta ? (
                    <a href={`/${lingua()}/trilhas/${trilha.slug}/${aula.slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
                      Abrir a aula
                    </a>
                  ) : (
                    <span className="font-mono text-[0.7rem] uppercase tracking-wider text-oxblood">a escrever</span>
                  )}
                  <button type="button" className="cursor-pointer font-semibold underline hover:text-oxblood" onClick={() => propor(`Oficina: ${aula.titulo} (${atual.nome})`)}>
                    Propor oficina
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

/** O idioma da página aberta (o primeiro pedaço do endereço). */
const lingua = () => (typeof window === "undefined" ? "pt" : window.location.pathname.split("/")[1] || "pt");

const botaoDoRelogio = "cursor-pointer border-2 border-parchment px-4 py-1.5 font-semibold hover:bg-parchment hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const relogio = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Simulador({ disciplinas, propor }: { disciplinas: Disciplina[]; propor: (titulo: string) => void }) {
  const [area, setArea] = useState("");
  const [tema, setTema] = useState<{ titulo: string; href: string; disciplina: string } | null>(null);
  const [restante, setRestante] = useState(600);
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState<number[]>([]);
  const prontas = useMemo(
    () =>
      disciplinas
        .filter((d) => !area || d.area === area)
        .flatMap((d) => d.trilhas.flatMap((t) => t.aulas.filter((a) => a.pronta).map((a) => ({ titulo: a.titulo, href: `/${lingua()}/trilhas/${t.slug}/${a.slug}`, disciplina: d.nome })))),
    [disciplinas, area],
  );
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => setRestante((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [rodando]);
  const acabou = restante === 0;
  // A etapa em que o tempo está: os minutos do roteiro somados.
  const decorrido = 600 - restante;
  const etapa = ROTEIRO.findIndex((_, i) => ROTEIRO.slice(0, i + 1).reduce((s, [min]) => s + min * 60, 0) > decorrido);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Disciplina
            <select value={area} onChange={(e) => setArea(e.target.value)} className={`${campo} mt-1 block`}>
              <option value="">Qualquer uma</option>
              {disciplinas.map((d) => (
                <option key={d.area} value={d.area}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={botao}
            disabled={prontas.length === 0}
            onClick={() => {
              setTema(prontas[Math.floor(Math.random() * prontas.length)] ?? null);
              setRestante(600);
              setRodando(false);
              setFeitos([]);
            }}
          >
            Sortear um tema
          </button>
        </div>
        {tema ? (
          <div className="mt-4 border-2 border-ink bg-parchment p-4 shadow-[4px_4px_0_var(--sombra)]">
            <p className="rotulo">{tema.disciplina}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{tema.titulo}</p>
            <p className="mt-1 text-sm">
              <a href={tema.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
                Ler a aula do site antes
              </a>
            </p>
          </div>
        ) : (
          <p className="mt-4 text-ink-soft">Sorteie um tema e ensaie uma aula de dez minutos, como se fosse para uma turma. Dá para ensaiar sozinho, gravar no celular ou chamar um colega para assistir.</p>
        )}
        <ol className="mt-4 space-y-2">
          {ROTEIRO.map(([min, nome, sobre], i) => (
            <li key={nome} className={`flex gap-3 border-l-4 px-3 py-2 ${rodando && i === etapa ? "border-oxblood bg-parchment" : "border-rule"}`}>
              <input type="checkbox" aria-label={`Feito: ${nome}`} checked={feitos.includes(i)} onChange={(e) => setFeitos((f) => (e.target.checked ? [...f, i] : f.filter((x) => x !== i)))} className="mt-1" />
              <div>
                <p className="font-semibold">
                  {nome} <span className="font-mono text-xs font-normal text-ink-soft">· {min} min</span>
                </p>
                <p className="text-sm text-ink-soft">{sobre}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="self-start border-2 border-ink bg-ink p-4 text-parchment shadow-[4px_4px_0_var(--prelo)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em]">Cronômetro</p>
        <p className={`mt-1 font-mono text-5xl font-bold ${acabou ? "text-[#f0cf8e]" : ""}`} aria-live="polite">
          {relogio(restante)}
        </p>
        {acabou && <p className="mt-1 text-sm">Tempo! Feche em uma frase.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={botaoDoRelogio} disabled={acabou} onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pausar" : decorrido > 0 ? "Continuar" : "Começar"}
          </button>
          <button type="button" className={botaoDoRelogio} onClick={() => { setRestante(600); setRodando(false); }}>
            Zerar
          </button>
        </div>
        <p className="mt-3 text-sm">{feitos.length} de {ROTEIRO.length} etapas</p>
        {tema && (
          <button type="button" className="mt-3 cursor-pointer text-left text-sm font-semibold underline" onClick={() => propor(`Ensaio de aula: ${tema.titulo} (${tema.disciplina})`)}>
            Pedir que um colega assista e comente
          </button>
        )}
      </div>
    </div>
  );
}

function Ferramentas() {
  const lang = usePathname().split("/")[1] || "pt";
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {FERRAMENTAS.map((f) => (
        <li key={f.nome}>
          <a href={`/${lang}${f.href.startsWith("?") ? `/painel${f.href}` : f.href}`} target={f.href.startsWith("?") ? undefined : "_blank"} rel="noopener noreferrer" className="flex h-full gap-3 border border-rule bg-parchment p-3 hover:border-ink">
            <Selo nome={f.selo} className="h-9 w-9 shrink-0" />
            <span>
              <span className="block font-semibold">{f.nome}</span>
              <span className="block text-sm text-ink-soft">{f.sobre}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
