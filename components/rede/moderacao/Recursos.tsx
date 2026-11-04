// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { RecursoDaFila } from "@/lib/rede/tipos-moderacao";
import { dataCurta, estilo, mensagemDeErro } from "./base";

/** A fila de recursos: quem decide nunca é quem tomou a decisão contestada (o banco também barra). */
export function Recursos({ lang, s, sm }: { lang: string; s: TextosDaRede; sm: TextosDaModeracao }) {
  const [lista, setLista] = useState<RecursoDaFila[] | null>(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [rodada, setRodada] = useState(0);
  const acoes = sm.moderar.acoes as Record<string, string>;

  useEffect(() => {
    let vivo = true;
    redeMod.recursos().then((x) => vivo && setLista(x)).catch((e) => vivo && setErro(mensagemDeErro(s, sm, e)));
    return () => {
      vivo = false;
    };
  }, [rodada, s, sm]);

  const decidir = useCallback(
    async (id: string, decisao: "mantido" | "revertido") => {
      setErro("");
      try {
        await redeMod.rever(id, decisao, motivo.trim());
        setAviso(sm.recursos.feito);
        setAberto(null);
        setMotivo("");
        setRodada((n) => n + 1);
      } catch (e) {
        setErro(mensagemDeErro(s, sm, e));
      }
    },
    [motivo, s, sm],
  );

  if (!lista) return erro ? <p role="alert" className="px-[18px] py-4 text-oxblood">{erro}</p> : <p className="px-[18px] py-4" role="status">{sm.carregando}</p>;
  return (
    <div className="font-sans">
      <p className="px-[18px] py-3 text-sm text-ink-soft">{sm.recursos.ajuda}</p>
      {aviso && <p role="status" className="px-[18px] pb-2 text-sm font-bold">{aviso}</p>}
      {erro && <p role="alert" className="px-[18px] pb-2 text-sm text-oxblood">{erro}</p>}
      {lista.length === 0 ? (
        <p className="px-[18px] py-6 text-ink-soft">{sm.recursos.vazio}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {lista.map((r) => (
            <li key={r.id} className="px-[18px] py-3">
              <p className="text-sm font-bold">{preencher(sm.recursos.decisaoContestada, { acao: acoes[r.acao.acao] ?? r.acao.acao, regra: r.acao.regra })}</p>
              <p className="text-sm text-ink-soft">{r.acao.motivo} · {dataCurta(r.acao.criado_em, lang)}</p>
              <p className="mt-1 text-xs font-bold">{sm.recursos.texto}</p>
              <p className="whitespace-pre-line break-words">{r.texto}</p>
              {r.minha ? (
                <p className="mt-2 text-sm">{sm.recursos.minha}</p>
              ) : aberto === r.id ? (
                <div className="mt-2 space-y-2">
                  <label className="block text-sm">
                    {sm.recursos.motivo}
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={1000} className={`${estilo.campo} mt-1`} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={motivo.trim().length < 3} className={estilo.botaoForte} onClick={() => void decidir(r.id, "revertido")}>{sm.recursos.reverter}</button>
                    <button type="button" disabled={motivo.trim().length < 3} className={estilo.botao} onClick={() => void decidir(r.id, "mantido")}>{sm.recursos.manter}</button>
                    <button type="button" className={estilo.botao} onClick={() => setAberto(null)}>{sm.cancelar}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={`${estilo.botao} mt-2`} onClick={() => setAberto(r.id)}>{sm.fila.abrir}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
