// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { JogoProprio } from "@/components/jogos/proprios/Catalogo";
import { JogoProprio2 } from "@/components/jogos/proprios2/Catalogo";
import type { DadosDaGreve, Fato, Frase } from "@/components/labs/JogosDeFormacao";
import type { TextosDosJogos } from "@/i18n/jogos";
import type { Dict } from "@/i18n/types";
import type { Verbete } from "@/lib/jogos/base";
import type { IdDoJogoEmGrupo } from "@/lib/jogos/grupo/motor";
import type { ChecagemParaJogo } from "@/lib/jogos-proprios/regras";
import type { Baralho } from "@/lib/rumos";
import { Botao, type PropsDoJogo } from "./comum";
import type { DisciplinaDoJogo } from "./grupo/preparar";
import { Palco } from "./Imersao";

// Cada jogo só é baixado quando a pessoa aperta "Jogar" (e só roda no navegador: o sorteio nasce depois do clique).
const carregando = () => <p className="p-4 font-mono text-sm">…</p>;
const TREINO = {
  cruzadas: dynamic(() => import("./Cruzadas").then((m) => m.Cruzadas), { ssr: false, loading: carregando }),
  caca: dynamic(() => import("./CacaPalavras").then((m) => m.CacaPalavras), { ssr: false, loading: carregando }),
  sudoku: dynamic(() => import("./SudokuJogo").then((m) => m.SudokuJogo), { ssr: false, loading: carregando }),
  forca: dynamic(() => import("./Forca").then((m) => m.Forca), { ssr: false, loading: carregando }),
  memoria: dynamic(() => import("./Memoria").then((m) => m.Memoria), { ssr: false, loading: carregando }),
  quebra: dynamic(() => import("./QuebraPalavras").then((m) => m.QuebraPalavras), { ssr: false, loading: carregando }),
  velha: dynamic(() => import("./JogoDaVelha").then((m) => m.JogoDaVelha), { ssr: false, loading: carregando }),
  ditado: dynamic(() => import("./Ditado").then((m) => m.Ditado), { ssr: false, loading: carregando }),
} satisfies Record<string, React.ComponentType<PropsDoJogo>>;
const Sons = dynamic(() => import("./SonsInfantis").then((m) => m.SonsInfantis), { ssr: false, loading: carregando });
// Os jogos em grupo (T23): a sala, o tempo real e as regras só descem quando alguém abre um deles.
const EmGrupo = dynamic(() => import("./grupo/JogosEmGrupo").then((m) => m.JogosEmGrupo), { ssr: false, loading: carregando });
const Formacao = dynamic(() => import("@/components/labs/JogosDeFormacao").then((m) => m.JogosDeFormacao), { ssr: false, loading: carregando });

export type IdDoTreino = keyof typeof TREINO;
export const IDS_DO_TREINO = Object.keys(TREINO) as IdDoTreino[];
export type Categoria = "treino" | "grupo" | "proprios" | "criancas" | "formacao";
const CATEGORIAS: Categoria[] = ["treino", "grupo", "proprios", "criancas", "formacao"];

/** Um cartão do catálogo (só dados: o servidor monta a lista, aqui só se desenha e se abre o jogo). */
export interface CartaoDeJogo {
  /** Único na página: "treino:cruzadas", "proprios:linha-de-montagem", "criancas", "formacao". */
  chave: string;
  categoria: Categoria;
  titulo: string;
  texto: string;
  /** O tempo de uma partida, quando o jogo o tem (os jogos do Instituto); sem ele, o cartão diz "no seu tempo". */
  minutos?: number;
  /** 1 jogador; 2 quando dá para jogar contra outra pessoa no mesmo aparelho (o jogo da velha); "grupo": de 2 a 12, cada um no seu aparelho. */
  jogadores: 1 | 2 | "grupo";
  publico?: string;
  tema?: string;
  /** Treino: o id do jogo. Jogos do Instituto: o slug (grupo "a") ou o id (grupo "b"). */
  id?: string;
  grupo?: "a" | "b";
  /** Os jogos que só existem em português ganham lang="pt" nas outras línguas. */
  soEmPortugues?: boolean;
  /** Os nomes dos jogos que vêm juntos (os jogos de formação). */
  inclui?: string[];
}

/** As cores de cada categoria (as do site: mata, prelo, ipê e anil). */
const COR: Record<Categoria, { fundo: string; tinta: string; detalhe: string }> = {
  treino: { fundo: "#2e6b4f", tinta: "#fff8ea", detalhe: "#f0b323" },
  grupo: { fundo: "#1f1a14", tinta: "#f4ecd8", detalhe: "#f0b323" },
  proprios: { fundo: "#c21f16", tinta: "#fff8ea", detalhe: "#1f1a14" },
  criancas: { fundo: "#f0b323", tinta: "#1f1a14", detalhe: "#c21f16" },
  formacao: { fundo: "#23408e", tinta: "#fff8ea", detalhe: "#f0b323" },
};

/** Os desenhos de cada jogo de treino (traço simples, em vetor; nada copiado). */
const DESENHO_DO_TREINO: Record<IdDoTreino, ReactNode> = {
  cruzadas: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z M9 9h6v6H9z" />,
  caca: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l6 6M8 10.5h5" />
    </>
  ),
  sudoku: <path d="M3 3h18v18H3z M9 3v18M15 3v18M3 9h18M3 15h18" />,
  forca: (
    <>
      <circle cx="12" cy="9" r="2.4" />
      <path d="M12 6.6c-1-3 2-3.6 2-1.2M14.4 9c3-1 3.6 2 1.2 2M12 11.4c1 3-2 3.6-2 1.2M9.6 9c-3 1-3.6-2-1.2-2M12 11.4V21M12 17c2-2 4-2 5-1" />
    </>
  ),
  memoria: <path d="M4 6h8v12H4z M12 6l7 2-3 11-4-1" />,
  quebra: <path d="M4 4h7v3a2 2 0 1 0 4 0V4h5v7h-3a2 2 0 1 0 0 4h3v5h-7v-3a2 2 0 1 0-4 0v3H4z" />,
  velha: <path d="M9 3v18M15 3v18M3 9h18M3 15h18 M4.5 4.5l3 3m0-3l-3 3 M18 18m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0" />,
  ditado: <path d="M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v6H4z M17 14h3v6h-3z" />,
};

/** A arte do cartão: o bloco de cor da categoria, o desenho do jogo (ou a inicial, nos jogos do Instituto) e a estrela. */
function Arte({ cartao, grande }: { cartao: CartaoDeJogo; grande?: boolean }) {
  const cor = COR[cartao.categoria];
  const traco = cartao.categoria === "treino" && cartao.id && cartao.id in DESENHO_DO_TREINO ? DESENHO_DO_TREINO[cartao.id as IdDoTreino] : null;
  return (
    <div aria-hidden className={`arte-do-jogo relative flex items-center justify-center overflow-hidden ${grande ? "aspect-[16/9] border-[3px] sm:aspect-[4/3]" : "aspect-[16/9] border-b-2"} border-ink`} style={{ background: cor.fundo, color: cor.tinta }}>
      {/* Os raios do cartaz, bem de leve, atrás do desenho. */}
      <span className="absolute inset-0 opacity-[0.14] [background:repeating-conic-gradient(from_0deg_at_50%_120%,currentColor_0deg_4deg,transparent_4deg_10deg)]" />
      {traco ? (
        <svg viewBox="0 0 24 24" className={`relative ${grande ? "h-24 w-24 sm:h-36 sm:w-36" : "h-16 w-16"}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {traco}
        </svg>
      ) : cartao.categoria === "grupo" ? (
        // A roda de gente estudando junta (traço próprio).
        <svg viewBox="0 0 24 24" className={`relative ${grande ? "h-24 w-24 sm:h-36 sm:w-36" : "h-16 w-16"}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="6" r="2.2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="8" cy="18.5" r="1.8" />
          <circle cx="16" cy="18.5" r="1.8" />
          <circle cx="12" cy="13" r="2.6" fill={cor.detalhe} stroke="none" />
          <path d="M12 8.6v1.6M7 12h2.4M17 12h-2.4M9.4 17.2l1-1.6M14.6 17.2l-1-1.6" strokeDasharray="1.4 1.4" />
        </svg>
      ) : cartao.categoria === "criancas" ? (
        <svg viewBox="0 0 24 24" className={`relative ${grande ? "h-24 w-24 sm:h-36 sm:w-36" : "h-16 w-16"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l11-2v13" />
          <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
          <circle cx="17.5" cy="16" r="2.5" fill="currentColor" />
        </svg>
      ) : cartao.categoria === "formacao" ? (
        // As cartas do Rumos em leque.
        <svg viewBox="0 0 24 24" className={`relative ${grande ? "h-28 w-28 sm:h-40 sm:w-40" : "h-16 w-16"}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M5.5 7.2l6-1.6 3 11.6-6 1.6z" transform="rotate(-12 9 12)" />
          <path d="M9 5h7v13H9z" fill={cor.fundo} />
          <path d="M12.5 8.4l.8 1.7 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2z" fill={cor.detalhe} stroke="none" />
        </svg>
      ) : (
        <span className={`territorio-play relative font-black uppercase leading-none ${grande ? "text-[8rem]" : "text-[3.6rem]"}`} style={{ fontFamily: "var(--font-cartaz), Impact, sans-serif", fontWeight: 400 }}>
          {[...cartao.titulo.replace(/^[^\p{L}\p{N}]+/u, "")][0]}
        </span>
      )}
      <svg viewBox="0 0 24 24" className={`absolute ${grande ? "top-3 right-3 h-8 w-8" : "top-2 right-2 h-5 w-5"}`} style={{ color: cor.detalhe }}>
        <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z" fill="currentColor" />
      </svg>
    </div>
  );
}

/** As etiquetas do cartão: tempo, jogadores e público. */
function Etiquetas({ cartao, s, claro }: { cartao: CartaoDeJogo; s: TextosDosJogos; claro?: boolean }) {
  const etiqueta = `inline-flex items-center gap-1 border px-1.5 py-0.5 ${claro ? "border-[#e9dcbc]/60 text-[#f4ecd8]" : "border-ink/40 text-ink"}`;
  return (
    <ul className="flex flex-wrap gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.06em]">
      <li className={etiqueta}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
        {cartao.minutos ? s.proprios.minutos.replace("{n}", String(cartao.minutos)) : s.pagina.noSeuTempo}
      </li>
      <li className={etiqueta}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c.6-3.4 2.8-5.4 5.5-5.4s4.9 2 5.5 5.4" />
          {cartao.jogadores !== 1 && <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.8c1.7.6 2.8 2.4 3 5.2" />}
        </svg>
        {cartao.jogadores === "grupo" ? s.grupo.jogadores : cartao.jogadores === 2 ? s.pagina.umOuDois : s.pagina.umJogador}
      </li>
      {cartao.publico && <li className={etiqueta}>{cartao.publico}</li>}
    </ul>
  );
}

function BotaoJogar({ rotulo, titulo, aoJogar, grande }: { rotulo: string; titulo: string; aoJogar: () => void; grande?: boolean }) {
  return (
    <button type="button" onClick={aoJogar} aria-label={`${rotulo}: ${titulo}`} className={`botao botao-prelo w-full cursor-pointer justify-center gap-2 ${grande ? "min-h-14 px-8 text-lg sm:w-auto" : ""}`}>
      <svg aria-hidden viewBox="0 0 12 12" className={grande ? "h-4 w-4" : "h-3 w-3"} fill="currentColor">
        <path d="M2 1l9 5-9 5z" />
      </svg>
      {rotulo}
    </button>
  );
}

/**
 * A página /jogos com cara de página de jogos (pedido da coordenação, 05/11/2026): o jogo em destaque grande, as
 * categorias numa barra, os cartões com arte, tempo, jogadores e o botão Jogar. O jogo abre no palco, no alto da página,
 * com o "Voltar aos jogos"; só então ele é baixado. Nada de pontos acumulados nem de contagem de dias seguidos.
 */
export function PaginaDosJogos({
  cartoes,
  destaque,
  textos,
  verbetes,
  checagens,
  formacao,
  disciplinas,
  lang,
  titulo,
  avisos,
}: {
  cartoes: CartaoDeJogo[];
  /** O cartão que vai grande no alto (o Rumos, que abre os jogos de formação). */
  destaque: { cartao: CartaoDeJogo; nome: string; texto: string };
  textos: { s: TextosDosJogos; categorias: Record<Categoria, { nome: string; lead: string }> };
  verbetes: Verbete[];
  checagens: ChecagemParaJogo[];
  formacao: { baralhos: Baralho[]; greve: DadosDaGreve; fatos: Fato[]; frases: Frase[]; s: Dict["labs"]["jogos"] };
  /** As disciplinas com questões de escolha bastantes para a Corrida e o Quiz em equipe (lib/jogos/banco-em-grupo.ts). */
  disciplinas: DisciplinaDoJogo[];
  lang: string;
  titulo: ReactNode;
  /** Os avisos de idioma (glossário e jogos só em português), por categoria, fora do português. */
  avisos: Partial<Record<Categoria, string>>;
}) {
  const s = textos.s;
  const [filtro, setFiltro] = useState<Categoria | "todos">("todos");
  const [aberto, setAberto] = useState<CartaoDeJogo | null>(null);
  const palco = useRef<HTMLHeadingElement>(null); // o h1 do palco
  const abrir = (cartao: CartaoDeJogo | null) => {
    const antes = aberto;
    setAberto(cartao);
    window.setTimeout(() => {
      if (cartao) {
        palco.current?.focus();
        palco.current?.scrollIntoView({ block: "start" });
        return;
      }
      // De volta ao catálogo: na categoria do jogo que estava aberto, com o foco no título dela.
      const titulo = antes ? document.getElementById(`${antes.categoria}-titulo`) : null;
      titulo?.setAttribute("tabindex", "-1");
      titulo?.focus();
      titulo?.scrollIntoView({ block: "start" });
    }, 0);
  };
  // O convite de uma sala (/jogos#sala=ABC23) abre direto os jogos em grupo, com o código já preenchido.
  useEffect(() => {
    const pelaSala = () => {
      if (!/(?:^|[#&])sala=[A-Za-z0-9-]{4,8}/.test(window.location.hash)) return;
      const primeiro = cartoes.find((c) => c.categoria === "grupo");
      if (primeiro) setAberto((atual) => (atual?.categoria === "grupo" ? atual : primeiro));
    };
    const relogio = window.setTimeout(pelaSala, 0);
    window.addEventListener("hashchange", pelaSala);
    return () => {
      window.clearTimeout(relogio);
      window.removeEventListener("hashchange", pelaSala);
    };
  }, [cartoes]);
  const visiveis = CATEGORIAS.filter((c) => filtro === "todos" || filtro === c);
  const idioma = (c: CartaoDeJogo) => (c.soEmPortugues && lang !== "pt" ? "pt" : undefined);

  // O palco: o jogo aberto, com o caminho de volta.
  if (aberto) {
    const Treino = aberto.categoria === "treino" && aberto.id ? TREINO[aberto.id as IdDoTreino] : null;
    return (
      <section aria-labelledby="palco-titulo" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8" lang={idioma(aberto)}>
        <Palco s={s}>
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink pb-4">
          <Botao onClick={() => abrir(null)}>← {s.proprios.voltar}</Botao>
          {/* Com o jogo aberto, a vitrine (e o h1 "Jogos") sai da página: o nome do jogo vira o título principal. */}
          <h1 id="palco-titulo" ref={palco} tabIndex={-1} className="font-serif text-3xl font-semibold leading-tight focus:outline-none">
            {aberto.titulo}
          </h1>
        </div>
        {aberto.categoria !== "grupo" && <p className="mt-3 text-sm text-ink-soft">{s.comum.semPontos}</p>}
        <div className="mt-5">
          {Treino && <Treino verbetes={verbetes} s={s} lang={lang} />}
          {aberto.categoria === "proprios" && aberto.id && (aberto.grupo === "b" ? <JogoProprio2 id={aberto.id} /> : <JogoProprio slug={aberto.id} checagens={checagens} />)}
          {aberto.categoria === "criancas" && <Sons s={s} />}
          {aberto.categoria === "formacao" && <Formacao baralhos={formacao.baralhos} greve={formacao.greve} fatos={formacao.fatos} frases={formacao.frases} s={formacao.s} />}
          {aberto.categoria === "grupo" && (
            <EmGrupo
              key={aberto.chave}
              jogoInicial={aberto.id as IdDoJogoEmGrupo}
              banco={{ verbetes, frases: formacao.frases, fatos: formacao.fatos, checagens, disciplinas }}
              s={s}
              lang={lang}
            />
          )}
        </div>
        </Palco>
      </section>
    );
  }

  const d = destaque.cartao;
  return (
    <>
      {/* A vitrine: o título da página e o jogo em destaque, grande, com o botão Jogar. */}
      <header className="relative overflow-hidden border-b-[3px] border-ink bg-[#1f1a14] text-[#f4ecd8]">
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-conic-gradient(from_0deg_at_80%_130%,#f4ecd8_0deg_4deg,transparent_4deg_10deg)]" />
        <div className="relative mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-8 lg:py-14">
          <div className="min-w-0">{titulo}</div>
          <article aria-labelledby="destaque-titulo" className="grid gap-5 border-2 border-[#f4ecd8] bg-[#2a231b] p-4 shadow-[8px_8px_0_#c21f16] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] sm:p-5">
            <Arte cartao={d} grande />
            <div className="flex min-w-0 flex-col">
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#f0b323]">★ {s.pagina.destaque}</p>
              <h2 id="destaque-titulo" className="mt-2 font-serif text-[2.4rem] font-semibold leading-none">{destaque.nome}</h2>
              <p className="mt-3 text-[1.02rem] leading-relaxed text-[#e9dcbc]">{destaque.texto}</p>
              <div className="mt-4">
                <Etiquetas cartao={d} s={s} claro />
              </div>
              <div className="mt-5 pt-1 sm:mt-auto">
                <BotaoJogar rotulo={s.pagina.jogar} titulo={destaque.nome} aoJogar={() => abrir(d)} grande />
              </div>
            </div>
          </article>
        </div>
      </header>

      {/* As categorias: um filtro na mesma página (os links #treino, #proprios... continuam valendo). */}
      <nav aria-label={s.pagina.categorias} className="sticky top-0 z-10 border-b-2 border-ink bg-parchment/95 backdrop-blur-sm max-md:static">
        <div className="mx-auto flex max-w-[78rem] gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {(["todos", ...CATEGORIAS] as const).map((c) => {
            const n = c === "todos" ? cartoes.length : cartoes.filter((x) => x.categoria === c).length;
            const ativo = filtro === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(c)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 border-2 border-ink px-3 py-1.5 font-sans text-sm font-bold ${ativo ? "bg-ink text-parchment shadow-[3px_3px_0_var(--prelo)]" : "bg-folha hover:shadow-[3px_3px_0_var(--sombra)]"}`}
              >
                {c !== "todos" && <span aria-hidden className="h-3 w-3 border border-ink" style={{ background: COR[c].fundo }} />}
                {c === "todos" ? s.pagina.todos : textos.categorias[c].nome}
                <span className={`font-mono text-xs ${ativo ? "text-[#cdbb91]" : "text-ink-soft"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-[78rem] px-4 pb-16 sm:px-6 lg:px-8">
        {visiveis.map((c) => {
          const daqui = cartoes.filter((x) => x.categoria === c);
          if (daqui.length === 0) return null;
          return (
            <section key={c} id={c} aria-labelledby={`${c}-titulo`} className="scroll-mt-20 pt-10">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-2">
                {/* scroll-mt: na volta do palco o foco vem para cá, e o título não pode ficar sob a barra de categorias. */}
                <h2 id={`${c}-titulo`} className="flex scroll-mt-20 items-center gap-2.5 font-serif text-[2rem] font-semibold leading-tight">
                  <span aria-hidden className="h-4 w-4 border-2 border-ink" style={{ background: COR[c].fundo }} />
                  {textos.categorias[c].nome}
                </h2>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">{s.pagina.quantos.replace("{n}", String(daqui.length))}</p>
              </div>
              <p className="mt-2 max-w-3xl text-ink-soft">
                {textos.categorias[c].lead} {avisos[c] && <span>{avisos[c]}</span>}
              </p>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {daqui.map((cartao) => (
                  <li key={cartao.chave} lang={idioma(cartao)}>
                    <article className="cartao-de-jogo flex h-full flex-col border-2 border-ink bg-folha shadow-[4px_4px_0_var(--sombra)] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                      <Arte cartao={cartao} />
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="font-serif text-[1.3rem] font-semibold leading-tight">{cartao.titulo}</h3>
                        <p className="mt-1.5 text-[0.92rem] leading-snug text-ink-soft">{cartao.texto}</p>
                        {cartao.inclui && (
                          <p className="mt-2 text-[0.85rem] leading-snug">
                            <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-soft">{s.pagina.incluiTambem}: </span>
                            {cartao.inclui.join(" · ")}
                          </p>
                        )}
                        <div className="mt-3">
                          <Etiquetas cartao={cartao} s={s} />
                        </div>
                        <div className="mt-auto pt-4">
                          <BotaoJogar rotulo={s.pagina.jogar} titulo={cartao.titulo} aoJogar={() => abrir(cartao)} />
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
