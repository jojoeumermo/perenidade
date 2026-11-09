// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosDaDescoberta } from "@/lib/rede/textos-descoberta";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import type { PaginaOrdenada } from "@/lib/rede/tipos-descoberta";
import { CartaoDePost } from "../CartaoDePost";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

/**
 * Uma lista de posts com ordenação escrita: o seletor de ordem, o "por que esta ordem?" com a fórmula inteira, a lista de 20 em
 * 20 e o fim honesto (no máximo 100 posts por ordem: sem rolagem sem fim). Serve à página de hashtag, às linhas temáticas e à busca.
 * `carregar` pede uma página da ordem escolhida; `chave` identifica o que está sendo listado (trocar a chave recarrega).
 */
export function ListaOrdenada({
  lang,
  s,
  d,
  logado,
  chave,
  ordens,
  ordemInicial,
  carregar,
  vazio,
  aoResponder,
  aoPagina,
}: {
  lang: string;
  s: TextosDaRede;
  d: TextosDaDescoberta;
  logado: boolean;
  chave: string;
  ordens: readonly string[];
  ordemInicial: string;
  carregar: (ordem: string, cursor: string | null) => Promise<PaginaOrdenada>;
  vazio: string;
  aoResponder?: (post: Post) => void;
  /** Avisa a tela de cada primeira página recebida (a página da tag usa para mostrar a linha temática). */
  aoPagina?: (pagina: PaginaOrdenada) => void;
}) {
  const [ordem, setOrdem] = useState(ordemInicial);
  const [itens, setItens] = useState<Post[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [teto, setTeto] = useState(false);
  const [estado, setEstado] = useState<{ pedido: string; fase: "ok" | "erro"; mensagem: string } | null>(null);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [versao, setVersao] = useState(0);
  const pedido = `${chave}|${ordem}|${versao}`;

  useEffect(() => {
    let vivo = true;
    carregar(ordem, null)
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setProximo(r.proximo);
        setTeto(r.fim_por_teto);
        setEstado({ pedido, fase: "ok", mensagem: "" });
        aoPagina?.(r);
      })
      .catch((e) => vivo && setEstado({ pedido, fase: "erro", mensagem: textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
    // `carregar` e `aoPagina` mudam a cada render; `pedido` (chave, ordem, versão) é o que identifica o pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, s]);

  async function mais() {
    if (!proximo || maisCarregando) return;
    setMaisCarregando(true);
    try {
      const r = await carregar(ordem, proximo);
      setItens((atual) => {
        const vistos = new Set(atual.map((p) => p.id));
        return [...atual, ...r.itens.filter((p) => !vistos.has(p.id))];
      });
      setProximo(r.proximo);
      setTeto(r.fim_por_teto);
    } catch (e) {
      setEstado({ pedido, fase: "erro", mensagem: textoDoErro(s, e) });
    } finally {
      setMaisCarregando(false);
    }
  }

  const o = d.ordens as unknown as Record<string, { nome: string; formula: string }>;
  const pronto = estado?.pedido === pedido;
  return (
    <div className="al3-tela">
      <div className="border-b border-rule px-[18px] py-3 font-sans">
        <div role="radiogroup" aria-label={d.ordens.rotulo} className="flex flex-wrap gap-2">
          {ordens.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={ordem === x}
              onClick={() => setOrdem(x)}
              className={`min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 text-sm font-bold ${ordem === x ? "bg-[#1f1a14] text-[#f4ecd8]" : "hover:bg-parchment-deep"}`}
            >
              {o[x]?.nome ?? x}
            </button>
          ))}
        </div>
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-bold underline">{d.ordens.porQue}</summary>
          <p className="mt-1">{o[ordem]?.formula}</p>
          <p className="mt-2 text-ink-soft">{d.ordens.semAlgoritmo}</p>
          <p className="mt-2 text-ink-soft">{d.ordens.teto}</p>
        </details>
      </div>

      {!pronto ? (
        <EsqueletoDaLinha rotulo={d.estados.carregando} quantos={3} />
      ) : estado.fase === "erro" ? (
        <div className="px-[18px] py-6 font-sans" role="alert">
          <p className="text-oxblood">{estado.mensagem || d.estados.erro}</p>
          <button type="button" onClick={() => setVersao((v) => v + 1)} className="mt-3 min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-bold hover:bg-parchment-deep">
            {d.estados.tentar}
          </button>
        </div>
      ) : (
        <>
          {itens.length === 0 ? (
            <p className="px-[18px] py-8 font-sans text-ink-soft">{vazio}</p>
          ) : (
            <ol aria-label={o[ordem]?.nome}>
              {itens.map((p) => (
                <li key={p.id}>
                  <CartaoDePost post={p} lang={lang} s={s} logado={logado} aoResponder={aoResponder} />
                </li>
              ))}
            </ol>
          )}
          {proximo ? (
            <div className="px-[18px] py-4 text-center">
              <button type="button" onClick={() => void mais()} disabled={maisCarregando} className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-sans font-bold hover:bg-parchment-deep disabled:opacity-60">
                {maisCarregando ? d.estados.carregando : d.estados.maisPosts}
              </button>
            </div>
          ) : (
            itens.length > 0 && <p className="px-[18px] py-6 text-center font-sans text-sm text-ink-soft">{teto ? d.estados.fimPorTeto : d.estados.fim}</p>
          )}
        </>
      )}
    </div>
  );
}
