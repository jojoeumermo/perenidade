// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Selo } from "@/components/Selo";
import { ExternalLink, Pause, Play, RotateCcw, Shuffle, Timer, Users } from "lucide-react";
import { Abas, Botao, Cartao, Esqueleto, Faixa, Marca, Selecao, Selo as SeloDoPainel } from "./ui";

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
  const abas: { id: Aba; nome: string }[] = [
    { id: "topicos", nome: "Tópicos por disciplina" },
    { id: "simulador", nome: "Simulador de aula" },
    { id: "ferramentas", nome: "Ferramentas" },
  ];
  return (
    <Cartao>
      <Abas
        rotulo="Estante do aprendizado"
        opcoes={abas}
        valor={aba}
        aoMudar={setAba}
        painel={(id) =>
          id === "ferramentas" ? (
            <Ferramentas />
          ) : erro ? (
            <Faixa tom="erro">Não deu para carregar as disciplinas agora. Tente de novo em instantes.</Faixa>
          ) : !dados ? (
            <Esqueleto linhas={4} rotulo="Carregando as disciplinas…" />
          ) : id === "topicos" ? (
            <Topicos disciplinas={dados} propor={propor} />
          ) : (
            <Simulador disciplinas={dados} propor={propor} />
          )
        }
      />
    </Cartao>
  );
}

function Topicos({ disciplinas, propor }: { disciplinas: Disciplina[]; propor: (titulo: string) => void }) {
  const [area, setArea] = useState(disciplinas[0]?.area ?? "");
  const [soFaltam, setSoFaltam] = useState(false);
  const atual = disciplinas.find((d) => d.area === area);
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60">
          <Selecao rotulo="Disciplina" value={area} onChange={(e) => setArea(e.target.value)}>
            {disciplinas.map((d) => (
              <option key={d.area} value={d.area}>
                {d.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div className="pb-2">
          <Marca rotulo="Só as aulas que ainda faltam escrever" checked={soFaltam} onChange={(e) => setSoFaltam(e.target.checked)} />
        </div>
      </div>
      <p className="pn-ajuda mt-2">Escolha um tópico para dar uma oficina ou para estudar junto. As aulas que faltam são um bom começo: a oficina pode virar a aula do site.</p>
      {atual?.trilhas.map((trilha) => {
        const aulas = soFaltam ? trilha.aulas.filter((a) => !a.pronta) : trilha.aulas;
        if (aulas.length === 0) return null;
        return (
          <details key={trilha.slug} className="mt-3 overflow-hidden rounded-[var(--pn-raio-cartao)] border border-rule bg-folha" open={atual.trilhas.length === 1}>
            <summary className="cursor-pointer px-3 py-2 font-semibold">
              {trilha.titulo} <span className="pn-rotulo-mono font-normal">· {trilha.etapa} · {aulas.length}</span>
            </summary>
            <ul className="pn-lista pn-lista-plana border-t border-rule">
              {aulas.map((aula) => (
                <li key={aula.slug} className="pn-item flex-wrap text-sm">
                  <span className="min-w-0 flex-1">{aula.titulo}</span>
                  {aula.pronta ? (
                    <a href={`/${lingua()}/trilhas/${trilha.slug}/${aula.slug}`} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">
                      Abrir a aula
                      <ExternalLink aria-hidden width={12} height={12} />
                    </a>
                  ) : (
                    <SeloDoPainel tom="bordo">a escrever</SeloDoPainel>
                  )}
                  <Botao variante="discreto" pequeno onClick={() => propor(`Oficina: ${aula.titulo} (${atual.nome})`)}>
                    Propor oficina
                  </Botao>
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
          <div className="w-60">
            <Selecao rotulo="Disciplina" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Qualquer uma</option>
              {disciplinas.map((d) => (
                <option key={d.area} value={d.area}>
                  {d.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao
            variante="principal"
            simbolo={Shuffle}
            disabled={prontas.length === 0}
            onClick={() => {
              setTema(prontas[Math.floor(Math.random() * prontas.length)] ?? null);
              setRestante(600);
              setRodando(false);
              setFeitos([]);
            }}
          >
            Sortear um tema
          </Botao>
        </div>
        {tema ? (
          <div className="pn-cartao pn-cartao-destaque mt-4">
            <p className="pn-rotulo-mono">{tema.disciplina}</p>
            <p className="pn-cartao-titulo mt-1">{tema.titulo}</p>
            <p className="mt-1 text-sm">
              <a href={tema.href} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1">
                Ler a aula do site antes
                <ExternalLink aria-hidden width={12} height={12} />
              </a>
            </p>
          </div>
        ) : (
          <p className="pn-ajuda mt-4">Sorteie um tema e ensaie uma aula de dez minutos, como se fosse para uma turma. Dá para ensaiar sozinho, gravar no celular ou chamar um colega para assistir.</p>
        )}
        <ol className="mt-4 space-y-2">
          {ROTEIRO.map(([min, nome, sobre], i) => (
            <li key={nome} className={`flex gap-3 rounded-r-[var(--pn-raio)] border-l-4 px-3 py-2 ${rodando && i === etapa ? "border-[var(--pn-destaque-vivo)] bg-[var(--pn-superficie-2)]" : "border-rule"}`} aria-current={rodando && i === etapa ? "step" : undefined}>
              <input type="checkbox" aria-label={`Feito: ${nome}`} checked={feitos.includes(i)} onChange={(e) => setFeitos((f) => (e.target.checked ? [...f, i] : f.filter((x) => x !== i)))} className="mt-1 accent-[var(--pn-destaque)]" />
              <div>
                <p className="font-semibold">
                  {nome} <span className="pn-rotulo-mono font-normal">· {min} min</span>
                </p>
                <p className="pn-ajuda">{sobre}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="pn-cartao self-start">
        <p className="pn-rotulo-mono flex items-center gap-1.5">
          <Timer aria-hidden width={13} height={13} />
          Cronômetro
        </p>
        {/* role="timer" não anuncia cada segundo (o leitor de tela lê quando a pessoa chega nele); o fim é anunciado abaixo. */}
        <p className={`mt-1 font-mono text-5xl font-bold tabular-nums ${acabou ? "text-oxblood" : ""}`} role="timer">
          {relogio(restante)}
        </p>
        <p role="status" className="mt-1 text-sm">{acabou ? "Tempo! Feche em uma frase." : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao simbolo={rodando ? Pause : Play} disabled={acabou} onClick={() => setRodando((r) => !r)}>
            {rodando ? "Pausar" : decorrido > 0 ? "Continuar" : "Começar"}
          </Botao>
          <Botao simbolo={RotateCcw} onClick={() => { setRestante(600); setRodando(false); }}>
            Zerar
          </Botao>
        </div>
        <p className="pn-ajuda mt-3 tabular-nums">{feitos.length} de {ROTEIRO.length} etapas</p>
        {tema && (
          <p className="mt-3">
            <Botao variante="discreto" pequeno simbolo={Users} onClick={() => propor(`Ensaio de aula: ${tema.titulo} (${tema.disciplina})`)}>
              Pedir que um colega assista e comente
            </Botao>
          </p>
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
          <a href={`/${lang}${f.href.startsWith("?") ? `/painel${f.href}` : f.href}`} target={f.href.startsWith("?") ? undefined : "_blank"} rel="noopener noreferrer" className="pn-cartao pn-cartao-interativo flex h-full gap-3 !p-3 no-underline">
            <Selo nome={f.selo} className="h-9 w-9 shrink-0" />
            <span>
              <span className="block font-semibold">{f.nome}</span>
              <span className="pn-ajuda block">{f.sobre}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
