// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, botao, campo, elo, useAcao, useLista } from "./comum";

interface Sugestao {
  id: string;
  trecho: string;
  troca: string;
  comentario: string;
  status: "aberta" | "aceita" | "recusada";
  autor: string;
  criado_em: string;
  /** O trecho ainda está no texto (dá para aplicar a troca). */
  cabe: boolean;
}

const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";

/**
 * Sugestões da revisão presas a um trecho do texto. Quem revisa seleciona o trecho na leitura (ou cola), escreve a troca
 * e um comentário; quem escreveu vê o antes e o depois e aceita com um clique (a troca entra no texto) ou recusa.
 */
export function SugestoesDaRevisao({ id, podeSugerir, podeResponder, depois }: { id: string; podeSugerir: boolean; podeResponder: boolean; depois: () => void }) {
  const lista = useLista<Sugestao[]>("sugestoes_listar", { p_id: id }, { quieta: true });
  const acao = useAcao(() => {
    lista.recarregar();
    depois();
  });
  const [nova, setNova] = useState({ trecho: "", troca: "", comentario: "" });
  const sugestoes = lista.dados ?? [];
  if (!podeSugerir && sugestoes.length === 0) return null;

  function pegarSelecao() {
    const texto = window.getSelection()?.toString().trim() ?? "";
    if (texto) setNova((n) => ({ ...n, trecho: texto.slice(0, 2000), troca: n.troca || texto.slice(0, 2000) }));
  }

  return (
    <section className="border-2 border-ink p-5">
      <p className={rotulo}>Sugestões da revisão</p>
      {sugestoes.length > 0 && (
        <ul className="mt-3 space-y-3">
          {sugestoes.map((s) => (
            <li key={s.id} className="border border-rule bg-parchment p-3">
              <p className="text-xs text-ink-soft">
                {s.autor} · {s.status === "aberta" ? "esperando resposta" : s.status === "aceita" ? "aceita ✓" : "recusada"}
              </p>
              <p className="mt-1">
                <del className="bg-oxblood/10 decoration-oxblood">{s.trecho}</del>
              </p>
              {s.troca !== s.trecho && (
                <p className="mt-1">
                  <ins className="bg-ok/10 no-underline">{s.troca || "(apagar o trecho)"}</ins>
                </p>
              )}
              {s.comentario && <p className="mt-1 text-sm text-ink-soft">{s.comentario}</p>}
              {s.status === "aberta" && podeResponder && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {s.cabe ? (
                    <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("sugestao_responder", { p_sugestao: s.id, p_aceitar: true }, "Sugestão aplicada ao texto.")}>
                      Aceitar
                    </button>
                  ) : (
                    <span className="text-xs text-oxblood">O trecho já mudou no texto: ajuste à mão, se quiser, e recuse.</span>
                  )}
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("sugestao_responder", { p_sugestao: s.id, p_aceitar: false }, "Sugestão recusada.")}>
                    Recusar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeSugerir && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-ink-soft">Selecione um trecho no texto acima e toque em “Usar o trecho selecionado”, ou cole o trecho exato. A pessoa que escreveu aceita com um clique.</p>
          <button type="button" className={elo} onMouseDown={(e) => e.preventDefault()} onClick={pegarSelecao}>Usar o trecho selecionado</button>
          <label className="block">
            Trecho atual
            <textarea value={nova.trecho} onChange={(e) => setNova({ ...nova, trecho: e.target.value })} rows={2} maxLength={2000} className={campo} />
          </label>
          <label className="block">
            Trocar por (vazio apaga o trecho)
            <textarea value={nova.troca} onChange={(e) => setNova({ ...nova, troca: e.target.value })} rows={2} maxLength={2000} className={campo} />
          </label>
          <label className="block">
            Comentário (opcional)
            <input value={nova.comentario} onChange={(e) => setNova({ ...nova, comentario: e.target.value })} maxLength={1000} className={campo} />
          </label>
          <button
            type="button"
            className={botao}
            disabled={acao.ocupado || !nova.trecho.trim()}
            onClick={async () => {
              const ok = await acao.agir("sugestao_criar", { p_id: id, p_trecho: nova.trecho, p_troca: nova.troca, p_comentario: nova.comentario }, "Sugestão enviada. A pessoa que escreveu foi avisada.");
              if (ok) setNova({ trecho: "", troca: "", comentario: "" });
            }}
          >
            Sugerir a mudança
          </button>
        </div>
      )}
      <Aviso texto={acao.aviso} />
    </section>
  );
}
