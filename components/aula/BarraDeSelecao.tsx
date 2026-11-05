// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { L, useI18n } from "../I18n";
import { useTelaDaVez } from "../app/telas";

// O cartão (canvas e compartilhar) só baixa quando a pessoa pede.
const CartaoDoTrecho = dynamic(() => import("./CartaoDoTrecho").then((m) => m.CartaoDoTrecho), { ssr: false });

export interface TermoDaAula {
  term: string;
  summary: string;
  slug?: string;
}

interface Sentido {
  classe: string;
  definicoes: { texto: string; exemplo?: string }[];
}

type Consulta =
  | { palavra: string; estado: "buscando" }
  | { palavra: string; estado: "pronto"; glossario: TermoDaAula | null; sentidos: Sentido[]; fonte?: string; link?: string; licenca?: string; falhou: boolean };

const normal = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' -]/gu, "")
    .trim();

const palavras = (texto: string) => texto.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));

/** O termo do glossário que é esta palavra (ou o singular dela). */
function acharNoGlossario(palavra: string, lista: TermoDaAula[]): TermoDaAula | null {
  const alvo = normal(palavra);
  const formas = new Set([alvo, alvo.replace(/s$/, ""), alvo.replace(/es$/, ""), alvo.replace(/oes$/, "ao"), alvo.replace(/ais$/, "al")]);
  return lista.find((t) => formas.has(normal(t.term))) ?? null;
}

let indiceDoGlossario: Promise<TermoDaAula[]> | null = null;
/** Os verbetes do glossário do site, do índice leve da busca (o mesmo arquivo que a busca do alto já usa e guarda). */
function glossarioDoSite(lang: string): Promise<TermoDaAula[]> {
  indiceDoGlossario ??= fetch(`/${lang}/indice-leve.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((itens: { kind: string; title: string; href: string; text: string }[]) =>
      itens.filter((i) => i.kind === "verbete").map((i) => ({ term: i.title, summary: i.text, slug: i.href.split("#")[1] })),
    )
    .catch(() => {
      indiceDoGlossario = null;
      return [];
    });
  return indiceDoGlossario;
}

/** A seleção dentro do texto da aula, ou null. */
function selecaoNaAula(): { texto: string; caixa: DOMRect } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const texto = sel.toString().replace(/\s+/g, " ").trim();
  if (!texto || texto.length > 2000) return null;
  const range = sel.getRangeAt(0);
  const no = range.commonAncestorContainer;
  const el = no.nodeType === Node.ELEMENT_NODE ? (no as Element) : no.parentElement;
  if (!el?.closest("#texto-da-aula, #texto-facil") || el.closest("input, textarea, [contenteditable]")) return null;
  return { texto, caixa: range.getBoundingClientRect() };
}

/**
 * A barra de seleção da aula (Etapa 4, R1-20 e R1-25). Selecionar uma palavra abre "O que é?": primeiro o glossário
 * (os termos da aula e os verbetes do site), depois o dicionário aberto pelo servidor do Instituto (/api/dicionario),
 * numa folha de baixo, com fonte e licença. Selecionar 3 palavras ou mais abre "Compartilhar trecho", que monta um cartão
 * em imagem no próprio aparelho. No computador, a barra fica presa em cima da seleção; no celular, numa faixa acima da
 * barra de baixo, para não brigar com o menu do sistema. Nada do que se seleciona vai para o servidor, salvo a palavra
 * consultada no dicionário, quando a pessoa pede.
 */
export function BarraDeSelecao({ termos, titulo, endereco, s, cartao }: { termos: TermoDaAula[]; titulo: string; endereco: string; s: TextosDaAula["selecao"]; cartao: TextosDaAula["cartao"] }) {
  const { lang } = useI18n();
  const [sel, setSel] = useState<{ texto: string; topo: number; esquerda: number } | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [trecho, setTrecho] = useState<string | null>(null);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let espera: number | undefined;
    const ver = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        const achada = selecaoNaAula();
        if (!achada) return setSel(null);
        const topo = Math.max(8, achada.caixa.top - 56);
        const esquerda = Math.min(Math.max(8, achada.caixa.left + achada.caixa.width / 2 - 110), window.innerWidth - 240);
        setSel({ texto: achada.texto, topo, esquerda });
      }, 220);
    };
    document.addEventListener("selectionchange", ver);
    window.addEventListener("scroll", ver, { passive: true });
    return () => {
      window.clearTimeout(espera);
      document.removeEventListener("selectionchange", ver);
      window.removeEventListener("scroll", ver);
    };
  }, []);

  const procurar = useCallback(
    async (palavra: string) => {
      setConsulta({ palavra, estado: "buscando" });
      const glossario = acharNoGlossario(palavra, termos) ?? acharNoGlossario(palavra, await glossarioDoSite(lang));
      let sentidos: Sentido[] = [];
      let extra: { fonte?: string; link?: string; licenca?: string } = {};
      let falhou = false;
      try {
        const lingua = lang === "en" ? "en" : "pt";
        const r = await fetch(`/api/dicionario?palavra=${encodeURIComponent(palavra.toLowerCase())}&lingua=${lingua}`);
        const dado = (await r.json()) as { sentidos?: Sentido[]; fonte?: string; link?: string; licenca?: string; erro?: string };
        if (dado.erro) falhou = true;
        sentidos = (dado.sentidos ?? []).slice(0, 3);
        extra = { fonte: dado.fonte, link: dado.link, licenca: dado.licenca };
      } catch {
        falhou = true;
      }
      setConsulta({ palavra, estado: "pronto", glossario, sentidos, ...extra, falhou: falhou && !glossario });
    },
    [lang, termos],
  );

  useTelaDaVez("cartao-do-trecho", Boolean(trecho), () => setTrecho(null));
  useTelaDaVez("consulta-de-palavra", Boolean(consulta), () => setConsulta(null));
  useEffect(() => {
    if (!consulta) return;
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setConsulta(null);
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [consulta]);

  const conta = sel ? palavras(sel.texto).length : 0;
  const umaPalavra = sel && conta >= 1 && conta <= 2 && sel.texto.length <= 40 && /^[\p{L}' -]+$/u.test(sel.texto.replace(/[.,;:!?…"“”()]/g, ""));
  const trechoLongo = sel && conta >= 3;

  return (
    <>
      {sel && (umaPalavra || trechoLongo) && !consulta && !trecho && (
        <div className="barra-de-selecao no-print no-leitor" role="toolbar" aria-label={s.rotulo} style={{ "--sel-topo": `${sel.topo}px`, "--sel-esquerda": `${sel.esquerda}px` } as React.CSSProperties}>
          {umaPalavra && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void procurar(sel.texto.replace(/[.,;:!?…"“”()]/g, "").trim())}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
              </svg>
              {s.oQueE}
            </button>
          )}
          {trechoLongo && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setTrecho(sel.texto)}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8" />
              </svg>
              {s.compartilhar}
            </button>
          )}
        </div>
      )}

      {consulta && (
        <div className="folha-da-palavra-veu no-print no-leitor" onClick={() => setConsulta(null)}>
          <div role="dialog" aria-modal="true" aria-label={consulta.palavra} className="folha-da-palavra" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif text-2xl font-semibold">{consulta.palavra}</p>
              <button ref={fechar} type="button" onClick={() => setConsulta(null)} aria-label={s.fechar} className="folha-da-palavra-fechar">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            {consulta.estado === "buscando" ? (
              <p role="status" className="mt-3 text-ink-soft">
                {s.procurando}
              </p>
            ) : (
              <div role="status" className="mt-3 space-y-4">
                {consulta.glossario && (
                  <section className="border-l-4 border-[#c21f16] pl-3">
                    <p className="rotulo">{s.doGlossario}</p>
                    <p className="mt-1 font-serif text-lg">{consulta.glossario.summary.slice(0, 400)}</p>
                    {consulta.glossario.slug && (
                      <L href={`/glossario#${consulta.glossario.slug}`} className="mt-1 inline-block text-sm underline hover:text-oxblood">
                        {s.verGlossario} →
                      </L>
                    )}
                  </section>
                )}
                {consulta.sentidos.length > 0 && (
                  <section>
                    <ol className="list-decimal space-y-2 pl-5 font-serif">
                      {consulta.sentidos.map((sentido, i) => (
                        <li key={i}>
                          {sentido.classe && <span className="mr-1 font-sans text-xs uppercase tracking-wider text-ink-soft">{sentido.classe}</span>}
                          {sentido.definicoes[0]?.texto}
                        </li>
                      ))}
                    </ol>
                    <p className="mt-2 text-xs text-ink-soft">
                      {s.fonte}:{" "}
                      {consulta.link ? (
                        <a href={consulta.link} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                          {consulta.fonte}
                        </a>
                      ) : (
                        consulta.fonte
                      )}
                      {consulta.licenca && ` · ${s.licenca}: ${consulta.licenca}`}
                    </p>
                  </section>
                )}
                {!consulta.glossario && consulta.sentidos.length === 0 && <p>{consulta.falhou ? s.indisponivel : s.naoAchou}</p>}
                <p className="border-t border-rule pt-2 text-xs text-ink-soft">{s.aviso}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {trecho && <CartaoDoTrecho trecho={trecho} titulo={titulo} endereco={endereco} s={cartao} fechar={() => setTrecho(null)} />}
    </>
  );
}
