// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, TextSelect, X } from "lucide-react";
import { useState } from "react";
import { useAcao, useLista } from "./comum";
import { Area, Botao, Campo, Cartao, Faixa, Selo } from "./ui";

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
    <Cartao titulo="Sugestões da revisão" nivelDoTitulo={3} variante="plano">
      {sugestoes.length > 0 && (
        <ul className="mt-3 grid gap-3">
          {sugestoes.map((s) => (
            <li key={s.id} className="rounded-md border border-rule bg-parchment p-3">
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                {s.autor}
                <Selo tom={s.status === "aberta" ? "aviso" : s.status === "aceita" ? "ok" : "neutro"}>
                  {s.status === "aceita" && <Check aria-hidden width={12} height={12} />}
                  {s.status === "aberta" ? "esperando resposta" : s.status === "aceita" ? "aceita" : "recusada"}
                </Selo>
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {s.cabe ? (
                    <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => acao.agir("sugestao_responder", { p_sugestao: s.id, p_aceitar: true }, "Sugestão aplicada ao texto.")}>
                      Aceitar
                    </Botao>
                  ) : (
                    <span className="pn-erro text-xs">O trecho já mudou no texto: ajuste à mão, se quiser, e recuse.</span>
                  )}
                  <Botao pequeno variante="discreto" simbolo={X} disabled={acao.ocupado} onClick={() => acao.agir("sugestao_responder", { p_sugestao: s.id, p_aceitar: false }, "Sugestão recusada.")}>
                    Recusar
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeSugerir && (
        <div className="mt-4 grid gap-3">
          <p className="pn-ajuda">Selecione um trecho no texto acima e toque em “Usar o trecho selecionado”, ou cole o trecho exato. A pessoa que escreveu aceita com um clique.</p>
          <div>
            <Botao pequeno variante="discreto" simbolo={TextSelect} onMouseDown={(e) => e.preventDefault()} onClick={pegarSelecao}>
              Usar o trecho selecionado
            </Botao>
          </div>
          <Area rotulo="Trecho atual" value={nova.trecho} onChange={(e) => setNova({ ...nova, trecho: e.target.value })} rows={2} maxLength={2000} />
          <Area rotulo="Trocar por (vazio apaga o trecho)" value={nova.troca} onChange={(e) => setNova({ ...nova, troca: e.target.value })} rows={2} maxLength={2000} />
          <Campo rotulo="Comentário (opcional)" value={nova.comentario} onChange={(e) => setNova({ ...nova, comentario: e.target.value })} maxLength={1000} />
          <div>
            <Botao
              disabled={acao.ocupado || !nova.trecho.trim()}
              carregando={acao.ocupado}
              onClick={async () => {
                const ok = await acao.agir("sugestao_criar", { p_id: id, p_trecho: nova.trecho, p_troca: nova.troca, p_comentario: nova.comentario }, "Sugestão enviada. A pessoa que escreveu foi avisada.");
                if (ok) setNova({ trecho: "", troca: "", comentario: "" });
              }}
            >
              Sugerir a mudança
            </Botao>
          </div>
        </div>
      )}
      {acao.aviso && (
        <div className="mt-3">
          <Faixa tom="info">{acao.aviso}</Faixa>
        </div>
      )}
    </Cartao>
  );
}
