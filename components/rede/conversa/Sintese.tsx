// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { conversa } from "@/lib/rede/cliente-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaConversa } from "@/lib/rede/textos-conversa";
import type { SinteseDaConversa, VersaoDaSintese } from "@/lib/rede/tipos-conversa";
import { quandoFoi } from "../CartaoDePost";
import { textoDoErro } from "../erros";
import { TextoComMencoes } from "./TextoComMencoes";

const LIMITE = 1500;

/**
 * A síntese fixada no alto da conversa: o que ela concluiu e o que ficou em aberto, escrito por quem abriu a conversa ou pela
 * moderação. Cada versão fica no histórico (quem lê pode abrir). Confirmação e erro aparecem aqui dentro, nunca alert/confirm
 * do navegador. Sem síntese e sem permissão, não mostra nada.
 */
export function Sintese({
  raiz,
  sintese,
  pode,
  lang,
  s,
  t,
  aoMudar,
}: {
  raiz: string;
  sintese: SinteseDaConversa | null;
  pode: boolean;
  lang: string;
  s: TextosDaRede;
  t: TextosDaConversa;
  aoMudar: (nova: SinteseDaConversa | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [retirando, setRetirando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [historico, setHistorico] = useState<VersaoDaSintese[] | null>(null);
  const [historicoErro, setHistoricoErro] = useState("");

  if (!sintese && !pode) return null;
  const q = t.sintese;

  async function salvar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      const nova = await conversa.sintese(raiz, texto);
      aoMudar(nova);
      setHistorico(null);
      setEditando(false);
      setAviso(nova ? q.salva : q.retirada);
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  async function retirar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await conversa.sintese(raiz, "");
      aoMudar(null);
      setHistorico(null);
      setRetirando(false);
      setAviso(q.retirada);
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  async function abrirHistorico() {
    if (historico) return;
    setHistoricoErro("");
    try {
      setHistorico(await conversa.historicoDaSintese(raiz));
    } catch (e) {
      setHistoricoErro(textoDoErro(s, e));
    }
  }

  const botao = "min-h-11 cursor-pointer rounded-full px-4 font-sans text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <section aria-label={q.titulo} className="border-b border-rule bg-folha px-[18px] py-4 font-sans">
      {sintese && !editando && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-serif text-lg font-extrabold">{q.titulo}</h2>
            <span className="rounded bg-parchment-deep px-1.5 text-xs">{q.fixada}</span>
          </div>
          <p className="mt-2 whitespace-pre-line break-words">
            <TextoComMencoes texto={sintese.texto} lang={lang} />
          </p>
          <p className="mt-1 text-sm text-ink-soft">{preencher(q.por, { autor: sintese.autor, quando: quandoFoi(sintese.criado_em, lang) })}</p>
          {sintese.versoes > 1 && (
            <details className="mt-2" onToggle={(e) => e.currentTarget.open && void abrirHistorico()}>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold underline">{preencher(q.historico, { n: sintese.versoes })}</summary>
              {historicoErro && <p role="alert" className="text-sm text-oxblood">{historicoErro}</p>}
              <ol className="mt-1 space-y-2">
                {(historico ?? []).map((v) => (
                  <li key={v.id} className="rounded-lg border border-rule px-3 py-2 text-sm">
                    <p className="text-xs text-ink-soft">
                      {preencher(q.escritaPor, { autor: v.autor, quando: quandoFoi(v.criado_em, lang) })} · {v.atual ? q.versaoAtual : q.versaoAntiga}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line break-words">{v.texto}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}

      {pode && !editando && !retirando && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${botao} border border-ink hover:bg-parchment-deep`}
            onClick={() => {
              setTexto(sintese?.texto ?? "");
              setEditando(true);
              setAviso("");
            }}
          >
            {sintese ? q.novaVersao : q.escrever}
          </button>
          {sintese && (
            <button type="button" className={`${botao} text-oxblood underline`} onClick={() => setRetirando(true)}>
              {q.retirar}
            </button>
          )}
        </div>
      )}

      {retirando && (
        <div role="alertdialog" aria-label={q.retirar} className="mt-2 rounded-lg border border-oxblood px-3 py-3">
          <p>{q.confirmarRetirar}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={ocupado} className={`${botao} bg-[#c21f16] text-white hover:bg-[#1f1a14]`} onClick={() => void retirar()}>
              {q.confirmar}
            </button>
            <button type="button" className={`${botao} border border-ink`} onClick={() => setRetirando(false)}>
              {q.cancelar}
            </button>
          </div>
        </div>
      )}

      {editando && (
        <form
          className="mt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <h2 className="font-serif text-lg font-extrabold">{q.titulo}</h2>
          <label className="mt-1 block text-sm">
            <span className="sr-only">{q.titulo}</span>
            <textarea
              autoFocus
              rows={5}
              maxLength={LIMITE}
              value={texto}
              placeholder={q.placeholder}
              onChange={(e) => setTexto(e.target.value)}
              className="min-h-32 w-full resize-y rounded-lg border border-rule bg-parchment px-3 py-2 text-base"
            />
            <span className="mt-1 block text-right text-xs text-ink-soft">{preencher(q.contador, { n: texto.length, max: LIMITE })}</span>
          </label>
          <p className="text-sm text-ink-soft">{q.dica}</p>
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={ocupado || texto.trim().length === 0} className={`${botao} bg-[#c21f16] text-white hover:bg-[#1f1a14]`}>
              {q.salvar}
            </button>
            <button type="button" className={`${botao} border border-ink`} onClick={() => setEditando(false)}>
              {q.cancelar}
            </button>
          </div>
        </form>
      )}

      {aviso && (
        <p role="status" className="mt-2 text-sm">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-sm text-oxblood">
          {erro}
        </p>
      )}
    </section>
  );
}
