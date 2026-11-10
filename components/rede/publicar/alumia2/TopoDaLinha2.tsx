// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Aba, Situacao } from "@/lib/rede/tipos";
import { TopoDoInicioEncaixado } from "../../atos/encaixe";
import { ENCAIXES } from "../../encaixes";
import { Avatar16 } from "../../ui/Avatar16";
import type { TipoAoEscrever } from "./CascaDaAlumia2";
import { useAlumia2 } from "./contexto";
import { Icone } from "./icones";
import { CartaoDoAtoDuble, FaixaProximoAtoDuble } from "./previa/Dubles";

/** O id do painel da linha (role=tabpanel, em Rede.tsx) e o de cada aba, para aria-controls / aria-labelledby. */
export const PAINEL_DA_LINHA = "al2-painel-linha";
export const idDaAba = (a: Aba) => `al2-aba-${a}`;

type DocumentoComTransicao = Document & { startViewTransition?: (mudar: () => void) => unknown };

/** Quer movimento? (prefers-reduced-motion, e o modo e-ink do site, que também pede tela parada.) */
export function comMovimento(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.hasAttribute("data-eink")) return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Troca o que está na tela com a View Transitions API do navegador (um cruzamento suave entre o antes e o depois), quando ele tem
 * e a pessoa não pediu menos movimento. Sem a API, só troca.
 */
export function trocarComTransicao(mudar: () => void) {
  const d = document as DocumentoComTransicao;
  if (!d.startViewTransition || !comMovimento()) {
    mudar();
    return;
  }
  d.startViewTransition(() => flushSync(mudar));
}

/**
 * O alto da linha na cara nova (pranchas computador-inicio, celular-inicio e celular-stories-na-linha): "INÍCIO" e "Ordem de
 * chegada, sem algoritmo" no computador; a faixa de stories (encaixe da F5, topoDaLinha); as abas Seguindo / Minhas comunidades /
 * Tudo (no celular, "Comunidades"), fixas no alto, com o traço vermelho que desliza até a aba escolhida; o compositor da linha (só
 * computador: imagem, enquete, Chamar ato e Publicar, cada um abre o Escrever já no tipo certo); e, na aba Seguindo, a faixa
 * PRÓXIMO ATO + o cartão do ato (TopoDoInicio da F2; na prévia sem a F2, os dublês das pranchas).
 */
export function TopoDaLinha2({
  lang,
  s,
  situacao,
  abas,
  aba,
  aoAba,
  aoEscrever,
}: {
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  abas: Aba[];
  aba: Aba;
  aoAba: (a: Aba) => void;
  aoEscrever: (tipo?: TipoAoEscrever) => void;
}) {
  const al2 = useAlumia2();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const lista = useRef<HTMLDivElement>(null);
  const [traco, setTraco] = useState<{ x: number; w: number } | null>(null);

  // O traço vermelho: mede a aba escolhida e desliza até ela (CSS faz a mola; com menos movimento, só aparece no lugar).
  useLayoutEffect(() => {
    const medir = () => {
      const i = abas.indexOf(aba);
      const b = botoes.current[i];
      if (!b || !lista.current) return;
      const recuo = window.matchMedia("(min-width: 1024px)").matches ? 8 : 0;
      setTraco({ x: b.offsetLeft + recuo, w: b.offsetWidth - recuo * 2 });
    };
    medir();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (lista.current) obs?.observe(lista.current);
    return () => obs?.disconnect();
  }, [aba, abas, al2]);

  if (!al2) return null;
  const { t, previa } = al2;
  const pode = situacao.logado && situacao.membro;
  const temAto = previa || ENCAIXES.tiposDoCompositor.some((x) => x.tipo === "ato");
  const rotuloDaAba = (a: Aba, curto: boolean) =>
    a === "seguindo" ? t.linha.seguindo : a === "comunidades" ? (curto ? t.linha.comunidadesCurto : t.linha.comunidades) : a === "tudo" ? t.linha.tudo : t.linha.geral;
  const ctx = { lang, s, situacao };

  const escolher = (a: Aba) => {
    if (a === aba) return;
    trocarComTransicao(() => aoAba(a));
  };

  // Padrão de abas (WAI-ARIA APG, ativação automática): setas e Home/End trocam a aba e levam o foco; só a aba atual fica no Tab.
  function trocarPelaSeta(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = abas.length;
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (i + 1) % n;
    else if (e.key === "ArrowLeft") alvo = (i - 1 + n) % n;
    else if (e.key === "Home") alvo = 0;
    else if (e.key === "End") alvo = n - 1;
    if (alvo < 0) return;
    e.preventDefault();
    escolher(abas[alvo]);
    botoes.current[alvo]?.focus();
  }

  return (
    <>
      <div className="hidden items-baseline justify-between px-5 pt-6 lg:flex 2xl:px-7">
        <h2 className="al-cond text-[1.9rem] font-black uppercase leading-none">{t.linha.titulo}</h2>
        <p className="text-xs text-[var(--al-texto-2)]">{t.linha.ordem}</p>
      </div>

      {/* A faixa de stories (F5) no alto do Início, acima das abas (prancha celular-stories-na-linha). Cada peça confere a flag. */}
      {ENCAIXES.topoDaLinha.length > 0 && (
        <div className="al2-topo-stories">
          {ENCAIXES.topoDaLinha.map((NoAlto, k) => (
            <NoAlto key={k} {...ctx} />
          ))}
        </div>
      )}

      <div
        ref={lista}
        role="tablist"
        aria-label={t.linha.abas}
        className={`al2-abas sticky top-[0px] z-20 mt-1 flex border-b border-[var(--al-linha)] lg:mt-3 lg:gap-2 lg:px-3 2xl:px-5 ${traco ? "al2-abas-com-traco" : ""}`}
      >
        {abas.map((a, i) => (
          <button
            key={a}
            ref={(b) => {
              botoes.current[i] = b;
            }}
            type="button"
            role="tab"
            id={idDaAba(a)}
            aria-selected={aba === a}
            aria-controls={PAINEL_DA_LINHA}
            tabIndex={aba === a ? 0 : -1}
            onClick={() => escolher(a)}
            onKeyDown={(e) => trocarPelaSeta(e, i)}
            className="al2-aba flex-1 lg:flex-none"
          >
            <span className="lg:hidden">{rotuloDaAba(a, true)}</span>
            <span className="hidden lg:inline">{rotuloDaAba(a, false)}</span>
          </button>
        ))}
        {traco && <span aria-hidden className="al2-abas-traco" style={{ transform: `translateX(${traco.x}px)`, width: traco.w }} />}
      </div>
      <p className="px-4 pt-2 text-xs text-[var(--al-texto-3)] lg:hidden">{t.linha.ordem}</p>

      {pode && (
        <div className="hidden border-b border-[var(--al-linha)] px-5 pb-3 pt-4 lg:block 2xl:px-7">
          <div className="flex items-center gap-3">
            <Avatar16 handle={situacao.handle ?? situacao.codinome ?? "?"} tamanho={40} className="shrink-0" />
            <button type="button" onClick={() => aoEscrever()} className="al2-convite min-h-11 flex-1 cursor-text text-left text-[1.05rem] text-[var(--al-texto-3)]">
              {t.compositor.convite}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1 pl-[52px]">
            <button type="button" className="al2-acao" onClick={() => aoEscrever("imagem")} aria-label={t.compositor.imagem} title={t.compositor.imagem}>
              <Icone nome="imagem" className="h-[18px] w-[18px]" />
            </button>
            <button type="button" className="al2-acao" onClick={() => aoEscrever("enquete")} aria-label={t.compositor.enquete} title={t.compositor.enquete}>
              <Icone nome="enquete" className="h-[18px] w-[18px]" />
            </button>
            {temAto && (
              <button type="button" className="al2-acao !text-[var(--al-dourado)]" onClick={() => aoEscrever("ato")}>
                <Icone nome="atos" className="h-[18px] w-[18px]" />
                {t.compositor.chamarAto}
              </button>
            )}
            <button type="button" className="al-botao al-botao-primario al-botao-m al2-aperta ml-auto" onClick={() => aoEscrever()}>
              {t.compositor.publicar}
            </button>
          </div>
        </div>
      )}

      {/* Entre as abas e os posts: a faixa PRÓXIMO ATO e o cartão do ato (F2), só na aba Seguindo (prancha celular-inicio). */}
      {aba === "seguindo" && (
        <div className="al2-topo-ato">
          {TopoDoInicioEncaixado ? (
            <TopoDoInicioEncaixado {...ctx} />
          ) : previa ? (
            <>
              <FaixaProximoAtoDuble t={t} lang={lang} />
              <CartaoDoAtoDuble t={t} lang={lang} />
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
