// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { ObraCitada } from "@/lib/podcast";
import { botao, botaoClaro, campo, elo, rotulo } from "../comum";

interface ObraDoAcervo {
  id: string;
  titulo: string;
  autor: string;
  ano: string;
  licenca: string;
  fonte: string;
  area: string;
}

let obras: Promise<ObraDoAcervo[]> | null = null;
const carregarObras = () => (obras ??= fetch("/pt/obras.json").then((r) => (r.ok ? (r.json() as Promise<ObraDoAcervo[]>) : [])).catch(() => []));

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Citar o acervo: procura uma obra pelo título ou autor e devolve a referência pronta (título, autor, licença, fonte).
 * O roteiro recebe a citação e o episódio guarda a obra, que aparece nas notas com link para o acervo.
 */
export function CitarObra({ aoCitar, fechar }: { aoCitar: (obra: ObraCitada, texto: string) => void; fechar: () => void }) {
  const [lista, setLista] = useState<ObraDoAcervo[] | null>(null);
  const [busca, setBusca] = useState("");
  useEffect(() => {
    let cancelado = false;
    void carregarObras().then((valor) => {
      if (!cancelado) setLista(valor);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const achadas = (lista ?? []).filter((o) => termos.every((t) => semAcento(`${o.titulo} ${o.autor} ${o.area}`).includes(t))).slice(0, 25);
  return (
    <div className="border-2 border-ink bg-parchment p-4">
      <p className="flex items-center justify-between">
        <span className={rotulo}>Citar obra do acervo</span>
        <button type="button" className={elo} onClick={fechar}>Fechar</button>
      </p>
      <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Título, autor ou disciplina" className={campo} />
      {lista === null && <p className="mt-2 text-ink-soft">Carregando o acervo…</p>}
      <ul className="mt-2 max-h-72 divide-y divide-rule overflow-y-auto">
        {achadas.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className="w-full cursor-pointer py-2 text-left hover:bg-parchment-deep"
              onClick={() =>
                aoCitar(
                  { id: o.id, titulo: o.titulo, autor: o.autor, licenca: o.licenca, fonte: o.fonte },
                  `> **Obra citada:** *${o.titulo}*, de ${o.autor}${o.ano ? ` (${o.ano})` : ""}. ${o.licenca}; fonte: ${o.fonte}. No acervo: institutolucia.org/pt/acervo/${o.id}`,
                )
              }
            >
              <strong>{o.titulo}</strong> <span className="text-ink-soft">· {o.autor}{o.ano && ` · ${o.ano}`}</span>
              <span className="block text-xs text-ink-soft">{o.area} · {o.licenca} · {o.fonte}</span>
            </button>
          </li>
        ))}
      </ul>
      {lista && termos.length > 0 && achadas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma obra do acervo com esses termos. Se for um livro de fora, cite nas fontes.</p>}
    </div>
  );
}

interface Entrada {
  kind: string;
  title: string;
  href: string;
  context: string;
  text: string;
}

let indice: Promise<Entrada[]> | null = null;
const carregarIndice = () => (indice ??= fetch("/pt/indice.json").then((r) => (r.ok ? (r.json() as Promise<Entrada[]>) : [])).catch(() => []));

const PALAVRAS_VAZIAS = new Set("a o as os de da do das dos e em um uma uns umas que se para por com no na nos nas ao aos é foi ser era como mais mas ou sua seu suas seus isso essa esse este esta".split(" "));
const TIPOS: Record<string, string> = { checagem: "Checagem do instituto", debate: "Cartão de debate", verbete: "Glossário", obra: "Obra do acervo", aula: "Aula", materia: "Matéria do jornal" };

/**
 * Checagem antes de gravar: procura a afirmação nas checagens, cartões de debate, glossário, obras e aulas do site,
 * e abre as buscas das agências de checagem. O que não tiver base sai do roteiro ou vai ao ar como dúvida.
 */
export function ChecarAfirmacao({ inicial, fechar }: { inicial: string; fechar: () => void }) {
  const [texto, setTexto] = useState(inicial);
  const [lista, setLista] = useState<Entrada[] | null>(null);
  useEffect(() => {
    let cancelado = false;
    void carregarIndice().then((valor) => {
      if (!cancelado) setLista(valor);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  const palavras = semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p));
  const achados = (lista ?? [])
    .filter((e) => e.kind in TIPOS)
    .map((e) => {
      const alvo = semAcento(`${e.title} ${e.context} ${e.text.slice(0, 4000)}`);
      const pontos = palavras.reduce((s, p) => s + (alvo.includes(p) ? (semAcento(e.title).includes(p) ? 3 : 1) : 0), 0) + (e.kind === "checagem" ? 1 : 0);
      return { e, pontos };
    })
    .filter((x) => palavras.length > 0 && x.pontos >= Math.max(2, Math.ceil(palavras.length * 0.6)))
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 8);
  const q = encodeURIComponent(texto.trim().slice(0, 200));
  return (
    <div className="border-2 border-ink bg-parchment p-4">
      <p className="flex items-center justify-between">
        <span className={rotulo}>Checar afirmação</span>
        <button type="button" className={elo} onClick={fechar}>Fechar</button>
      </p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Cole a frase do roteiro que precisa de base" className={campo} />
      {lista === null && <p className="mt-2 text-ink-soft">Carregando as checagens e o acervo…</p>}
      {achados.length > 0 && (
        <ul className="mt-3 space-y-2">
          {achados.map(({ e }) => (
            <li key={e.href} className="border-l-2 border-gold pl-3">
              <span className="font-mono text-[0.65rem] uppercase text-gold">{TIPOS[e.kind]}</span>
              <a href={`/pt${e.href}`} target="_blank" rel="noopener noreferrer" className="block font-semibold underline hover:text-oxblood">{e.title}</a>
              {e.context && <span className="text-xs text-ink-soft">{e.context}</span>}
            </li>
          ))}
        </ul>
      )}
      {lista && palavras.length > 0 && achados.length === 0 && <p className="mt-2 text-ink-soft">Nada no site sobre isso. Confira nas fontes primárias e nas agências abaixo.</p>}
      <p className="mt-3 flex flex-wrap gap-3 text-sm">
        <a href="/pt/guia" target="_blank" rel="noopener noreferrer" className={elo}>Guia de fontes do instituto ↗</a>
        {texto.trim() && (
          <>
            <a href={`https://toolbox.google.com/factcheck/explorer/search/${q};hl=pt`} target="_blank" rel="noopener noreferrer" className={elo}>Checagens no mundo (Google Fact Check) ↗</a>
            <a href={`https://duckduckgo.com/?q=${encodeURIComponent(`${texto.trim().slice(0, 150)} site:aosfatos.org OR site:lupa.uol.com.br OR site:projetocomprova.com.br`)}`} target="_blank" rel="noopener noreferrer" className={elo}>Agências brasileiras ↗</a>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Teleprompter: o roteiro rola sozinho na tela inteira, em letra grande. Espaço pausa, setas mudam a velocidade,
 * Esc fecha. O modo espelho serve para quem usa vidro de teleprompter na frente da câmera.
 */
export function Teleprompter({ texto, fechar }: { texto: string; fechar: () => void }) {
  const [rodando, setRodando] = useState(false);
  const [velocidade, setVelocidade] = useState(40);
  const [tamanho, setTamanho] = useState(48);
  const [espelho, setEspelho] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const estado = useRef({ rodando, velocidade });
  useEffect(() => {
    estado.current = { rodando, velocidade };
  }, [rodando, velocidade]);

  useEffect(() => {
    let quadro = 0;
    let antes = performance.now();
    let resto = 0;
    const passo = (agora: number) => {
      const dt = (agora - antes) / 1000;
      antes = agora;
      if (estado.current.rodando && caixa.current) {
        resto += estado.current.velocidade * dt;
        const inteiro = Math.floor(resto);
        resto -= inteiro;
        caixa.current.scrollTop += inteiro;
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      else if (e.key === " ") {
        e.preventDefault();
        setRodando((r) => !r);
      } else if (e.key === "ArrowUp") setVelocidade((v) => Math.min(200, v + 10));
      else if (e.key === "ArrowDown") setVelocidade((v) => Math.max(10, v - 10));
    };
    window.addEventListener("keydown", tecla);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("keydown", tecla);
    };
  }, [fechar]);

  const limpo = texto.replace(/^#{1,6}\s+/gm, "").replace(/\*\*|__|\*|_/g, "").replace(/^>\s?/gm, "");
  return (
    <div role="dialog" aria-label="Teleprompter" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex flex-wrap items-center gap-4 border-b border-white/20 px-4 py-2 font-sans text-sm">
        <button type="button" onClick={() => setRodando(!rodando)} className="cursor-pointer bg-[#c21f16] px-4 py-1.5 font-semibold">{rodando ? "Pausar (espaço)" : "Rolar (espaço)"}</button>
        <label className="flex items-center gap-2">
          Velocidade <input type="range" min={10} max={200} value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          Letra <input type="range" min={28} max={96} value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={espelho} onChange={(e) => setEspelho(e.target.checked)} /> Espelhar
        </label>
        <button type="button" onClick={() => caixa.current?.scrollTo({ top: 0 })} className="cursor-pointer underline">Voltar ao começo</button>
        <button type="button" onClick={fechar} className="ml-auto cursor-pointer underline">Fechar (Esc)</button>
      </div>
      <div ref={caixa} className="relative flex-1 overflow-y-auto px-[8vw]" style={{ transform: espelho ? "scaleX(-1)" : undefined }}>
        <div aria-hidden className="pointer-events-none sticky top-[30%] z-10 h-0 border-t-2 border-[#c21f16]/70" />
        <div className="whitespace-pre-wrap py-[30vh] font-sans font-semibold leading-snug" style={{ fontSize: `${tamanho}px` }} data-original={limpo ? "" : undefined}>
          {limpo || "O roteiro está vazio."}
        </div>
      </div>
    </div>
  );
}

/** A barra de cima do editor de roteiro. */
export function FerramentasDoRoteiro({ gabarito, citar, checar, prompter }: { gabarito: () => void; citar: () => void; checar: () => void; prompter: () => void }) {
  return (
    <p className="flex flex-wrap gap-2">
      <button type="button" className={botaoClaro} onClick={gabarito}>Usar gabarito</button>
      <button type="button" className={botaoClaro} onClick={citar}>Citar obra do acervo</button>
      <button type="button" className={botaoClaro} onClick={checar}>Checar afirmação</button>
      <button type="button" className={botao} onClick={prompter}>Teleprompter</button>
    </p>
  );
}
