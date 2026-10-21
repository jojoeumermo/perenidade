// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownEditor } from "./Editor";
import { Markdown } from "./Markdown";
import { editorPt } from "./rotulosDoEditor";
import { useI18n } from "./I18n";

// A Sala livre: o professor monta, no próprio navegador, uma aula com tudo o que o site oferece (texto, jogos, testes,
// laboratórios, obras do acervo, editores do Estúdio, simulações do PhET, ferramentas) e projeta na sala de aula. Nada
// vai para o servidor: as salas ficam neste navegador; para levar a outro computador ou mandar a um colega, baixe o
// arquivo da sala e abra lá.

interface Sala {
  id: string;
  titulo: string;
  para: string;
  objetivo: string;
  corpo: string;
  criada: string;
  atualizada: string;
}

const CHAVE = "lucia:salas-livres";
const ler = (): Sala[] => {
  try {
    const lista = JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]") as Sala[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};
const gravar = (salas: Sala[]) => {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(salas));
    return true;
  } catch {
    return false;
  }
};
const cerca = "```";

/** Modelos de partida, no ritmo de uma boa aula: acolher, problematizar, praticar e fechar. */
const MODELOS: { nome: string; icone: string; sobre: string; titulo: string; corpo: string }[] = [
  {
    nome: "Aula com laboratório",
    icone: "🧪",
    sobre: "Uma pergunta para começar, o laboratório do site para praticar e um teste rápido no fim.",
    titulo: "Eletricidade na prática",
    corpo: `## Para começar\n\nPergunte à turma: por que, numa casa, uma lâmpada queimada não apaga as outras?\n\n## Na prática\n\n${cerca}recurso\nlaboratorio: eletrica\n${cerca}\n\n## Para fechar\n\n${cerca}teste\n? Numa casa, as lâmpadas são ligadas em…\n+ paralelo\n- série >> Em série, uma lâmpada queimada apagaria todas.\n> Cada lâmpada tem o próprio caminho até o quadro.\n${cerca}\n`,
  },
  {
    nome: "Roda de leitura",
    icone: "📚",
    sobre: "Uma obra do acervo, perguntas para conversar e uma linha do tempo para situar o texto.",
    titulo: "Roda de leitura",
    corpo: `## A obra\n\n${cerca}recurso\nobra: 1984\n${cerca}\n\n## Para conversar\n\n1. O que mais chamou a sua atenção?\n2. Isso acontece hoje? Onde?\n3. O que você mudaria no final?\n\n## Quando foi escrito\n\n${cerca}linhadotempo\n1949 | Publicação do livro\n${cerca}\n`,
  },
  {
    nome: "Simulação de ciências",
    icone: "🔬",
    sobre: "Uma simulação do PhET para explorar em grupo, com perguntas guiadas.",
    titulo: "Explorando circuitos",
    corpo: `## O que você acha que vai acontecer?\n\nAntes de abrir a simulação, cada grupo escreve um palpite.\n\n${cerca}recurso\nphet: circuit-construction-kit-dc\n${cerca}\n\n## O que aconteceu de verdade?\n\nCompare com o palpite: o que mudou na sua ideia?\n`,
  },
  {
    nome: "Oficina de criação",
    icone: "🎨",
    sobre: "Um editor do Estúdio de prática (foto, vídeo ou 3D) para a turma criar.",
    titulo: "Oficina de cartaz",
    corpo: `## A proposta\n\nCriar um cartaz sobre um direito que falta no bairro.\n\n${cerca}recurso\nestudio: photocraft\n${cerca}\n\n## Para mostrar\n\nCada grupo apresenta o cartaz e conta por que escolheu aquele tema.\n`,
  },
  { nome: "Em branco", icone: "📄", sobre: "Comece do zero.", titulo: "Nova sala", corpo: "## Para começar\n\n" },
];

const novaId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Corta a aula em telas para projetar: cada "## Título" começa uma tela nova. */
function telas(sala: Sala) {
  const partes = sala.corpo.split(/^(?=## )/m).map((p) => p.trim()).filter(Boolean);
  return partes.length ? partes : [sala.corpo];
}

export function SalaLivre() {
  const { lang } = useI18n();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [projetando, setProjetando] = useState(false);
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setSalas(ler());
      setCarregado(true);
    });
  }, []);
  const salvar = useCallback((lista: Sala[]) => {
    setSalas(lista);
    if (!gravar(lista)) setAviso("Este navegador não deixou guardar (modo anônimo ou espaço cheio). Baixe o arquivo da sala para não perder.");
  }, []);
  const sala = salas.find((s) => s.id === aberta) ?? null;
  const mudar = (x: Partial<Sala>) => sala && salvar(salas.map((s) => (s.id === sala.id ? { ...s, ...x, atualizada: new Date().toISOString() } : s)));
  const criar = (m: (typeof MODELOS)[number]) => {
    const agora = new Date().toISOString();
    const nova: Sala = { id: novaId(), titulo: m.titulo, para: "", objetivo: "", corpo: m.corpo, criada: agora, atualizada: agora };
    salvar([nova, ...salas]);
    setAberta(nova.id);
  };
  const baixar = (s: Sala) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ tipo: "sala-livre-instituto-lucia", versao: 1, sala: s }, null, 2)], { type: "application/json" }));
    a.download = `${s.titulo.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() || "sala"}.sala.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const abrirArquivo = async (f?: File) => {
    if (!f || f.size > 2_000_000) return setAviso("Arquivo grande demais ou vazio.");
    try {
      const d = JSON.parse(await f.text()) as { tipo?: string; sala?: Partial<Sala> };
      if (d.tipo !== "sala-livre-instituto-lucia" || typeof d.sala?.corpo !== "string") throw new Error();
      const agora = new Date().toISOString();
      const nova: Sala = { id: novaId(), titulo: String(d.sala.titulo ?? "Sala recebida").slice(0, 120), para: String(d.sala.para ?? "").slice(0, 120), objetivo: String(d.sala.objetivo ?? "").slice(0, 600), corpo: d.sala.corpo.slice(0, 200_000), criada: agora, atualizada: agora };
      salvar([nova, ...salas]);
      setAberta(nova.id);
    } catch {
      setAviso("Este arquivo não é uma sala do Instituto Lúcia.");
    }
  };

  if (!carregado) return <p className="mt-8 font-sans text-ink-soft">…</p>;
  if (sala && projetando) return <Projetar sala={sala} lang={lang} fechar={() => setProjetando(false)} />;

  if (sala) {
    return (
      <div className="mt-6 font-sans">
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => setAberta(null)} className="cursor-pointer underline hover:text-oxblood">← Minhas salas</button>
          <span className="text-ink-soft">Guardada neste navegador · {new Date(sala.atualizada).toLocaleString("pt-BR")}</span>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Título da aula</span><input value={sala.titulo} onChange={(e) => mudar({ titulo: e.target.value.slice(0, 120) })} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-2xl font-semibold" /></label>
          <label className="block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Para quem (turma, série)</span><input value={sala.para} onChange={(e) => mudar({ para: e.target.value.slice(0, 120) })} placeholder="8º ano B" className="mt-1 w-full border-2 border-ink/40 bg-parchment px-3 py-2" /></label>
        </div>
        <label className="mt-3 block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Objetivo: o que a turma vai conseguir fazer no fim</span><input value={sala.objetivo} onChange={(e) => mudar({ objetivo: e.target.value.slice(0, 600) })} placeholder="Explicar por que as lâmpadas de uma casa são ligadas em paralelo" className="mt-1 w-full border-2 border-ink/40 bg-parchment px-3 py-2" /></label>
        <p className="mt-4 flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => setProjetando(true)} className="cursor-pointer bg-[#c21f16] px-5 py-2.5 font-bold text-white hover:bg-[#a51810]">▶ Projetar na sala</button>
          <button type="button" onClick={() => baixar(sala)} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood">Baixar o arquivo da sala</button>
          <button type="button" onClick={() => window.print()} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood">Imprimir</button>
          <button type="button" onClick={() => { if (window.confirm("Apagar esta sala deste navegador? Baixe o arquivo antes, se quiser guardar.")) { salvar(salas.filter((s) => s.id !== sala.id)); setAberta(null); } }} className="cursor-pointer px-3 py-2 text-oxblood underline">Apagar</button>
        </p>
        <p className="mt-3 border-l-4 border-gold bg-parchment-deep px-3 py-2 text-sm">Monte a aula em blocos: use <strong>＋ bloco</strong> e escolha <strong>🧪 Laboratório, obra ou simulação</strong> para pôr um laboratório do site, um livro do acervo, um editor do Estúdio (foto, vídeo, 3D, escritório) ou uma simulação do PhET; ou um jogo, um teste, um mapa, uma linha do tempo. Cada <strong>Título de seção</strong> vira uma tela na hora de projetar.</p>
        <div className="mt-4">
          <MarkdownEditor id="sala-livre" value={sala.corpo} onChange={(corpo) => mudar({ corpo: corpo.slice(0, 200_000) })} labels={editorPt} blocos rows={20} />
        </div>
        {aviso && <p role="alert" className="mt-3 text-oxblood">{aviso}</p>}
      </div>
    );
  }

  return (
    <div className="mt-8 font-sans">
      {aviso && <p role="alert" className="mb-4 text-oxblood">{aviso}</p>}
      <section>
        <h2 className="font-serif text-2xl font-semibold">Começar uma sala</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODELOS.map((m) => (
            <li key={m.nome}>
              <button type="button" onClick={() => criar(m)} className="flex h-full w-full cursor-pointer items-start gap-3 border-2 border-ink/25 bg-parchment-deep p-4 text-left hover:border-oxblood">
                <span aria-hidden className="text-3xl">{m.icone}</span>
                <span><span className="block font-bold">{m.nome}</span><span className="block text-sm text-ink-soft">{m.sobre}</span></span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => arquivo.current?.click()} className="flex h-full w-full cursor-pointer items-start gap-3 border-2 border-dashed border-ink/40 p-4 text-left hover:border-oxblood">
              <span aria-hidden className="text-3xl">📥</span>
              <span><span className="block font-bold">Abrir uma sala recebida</span><span className="block text-sm text-ink-soft">O arquivo .sala.json que um colega mandou.</span></span>
            </button>
            <input ref={arquivo} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void abrirArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          </li>
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Minhas salas <span className="font-mono text-sm font-normal text-ink-soft">{salas.length}</span></h2>
        {salas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma ainda. As salas ficam só neste navegador: ninguém mais vê.</p>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {salas.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 border-2 border-ink bg-parchment p-4">
              <button type="button" onClick={() => setAberta(s.id)} className="min-w-0 cursor-pointer text-left">
                <span className="block font-serif text-xl font-semibold hover:text-oxblood">{s.titulo}</span>
                <span className="block text-sm text-ink-soft">{s.para || "sem turma"} · {telas(s).length} tela(s) · {new Date(s.atualizada).toLocaleDateString("pt-BR")}</span>
              </button>
              <button type="button" onClick={() => { setAberta(s.id); setProjetando(true); }} className="shrink-0 cursor-pointer bg-ink px-3 py-1.5 text-sm font-bold text-parchment hover:bg-oxblood">▶ Projetar</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Projetar: uma tela por vez, grande, com setas do teclado, tela cheia e o número da tela. */
function Projetar({ sala, lang, fechar }: { sala: Sala; lang: string; fechar: () => void }) {
  const lista = useMemo(() => telas(sala), [sala]);
  const [i, setI] = useState(-1);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escrevendo = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (escrevendo) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(lista.length - 1, x + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(-1, x - 1));
      else if (e.key === "Escape" && !document.fullscreenElement) fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [lista.length, fechar]);
  return (
    <div ref={caixa} className="fixed inset-0 z-50 flex flex-col bg-parchment">
      <div className="flex items-center gap-3 border-b-4 border-ink bg-[#17130e] px-4 py-2 font-sans text-sm text-[#f4ecd8]">
        <strong className="truncate">{sala.titulo}</strong>
        <span className="ml-auto font-mono">{i + 2} / {lista.length + 1}</span>
        <button type="button" onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void caixa.current?.requestFullscreen?.().catch(() => undefined))} className="cursor-pointer border border-[#f4ecd8]/50 px-2 py-1">Tela cheia</button>
        <button type="button" onClick={fechar} className="cursor-pointer border border-[#f4ecd8]/50 px-2 py-1">Sair (Esc)</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 text-[1.35rem]">
        <div className="mx-auto max-w-4xl">
          {i < 0 ? (
            <div className="flex min-h-[60vh] flex-col justify-center">
              <p className="font-mono text-sm uppercase tracking-[0.3em] text-oxblood">{sala.para}</p>
              <h1 className="mt-2 font-serif text-6xl font-semibold leading-tight">{sala.titulo}</h1>
              {sala.objetivo && <p className="mt-6 max-w-3xl text-2xl text-ink-soft">Hoje vamos: {sala.objetivo}</p>}
            </div>
          ) : (
            <Markdown lang={lang}>{lista[i]}</Markdown>
          )}
        </div>
      </div>
      <div className="flex justify-between gap-3 border-t-2 border-ink px-4 py-3 font-sans">
        <button type="button" disabled={i < 0} onClick={() => setI((x) => Math.max(-1, x - 1))} className="cursor-pointer border-2 border-ink px-5 py-2 font-bold disabled:opacity-30">← Anterior</button>
        <button type="button" disabled={i >= lista.length - 1} onClick={() => setI((x) => Math.min(lista.length - 1, x + 1))} className="cursor-pointer bg-ink px-5 py-2 font-bold text-parchment disabled:opacity-30">Próxima →</button>
      </div>
    </div>
  );
}
