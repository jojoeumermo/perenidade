// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, Pencil, Star } from "lucide-react";
import { useState } from "react";
import { usePainel } from "./estado";
import { espacoDe, ESPACOS } from "./estrutura";
import { Botao, Contador } from "./ui";

// Os atalhos do painel: as seções que a pessoa fixou (no alto do menu e na Mesa) e as que usou por último. Moram no
// estado da casca (estado.ts), que guarda só neste aparelho e leu uma vez as chaves antigas (lucia:painel-atalhos).
// A API é a de antes: quem chama useAtalhos() (a Mesa, o menu) não muda.

export function useAtalhos() {
  const fixadas = usePainel((s) => s.favoritos);
  const recentes = usePainel((s) => s.recentes);
  const fixar = usePainel((s) => s.fixar);
  const lembrar = usePainel((s) => s.lembrar);
  return { fixadas, recentes, fixar, lembrar };
}

interface SecaoCurta {
  id: string;
  nome: string;
  sobre: string;
  grupo: string;
  conta?: number;
}

/** Na Mesa: os atalhos fixados (com o número de pendências), as seções usadas por último e o jeito de escolher. */
export function Atalhos({ secoes, ir, icone }: { secoes: SecaoCurta[]; ir: (id: string) => void; icone: (id: string) => React.ReactNode }) {
  const { fixadas, recentes, fixar } = useAtalhos();
  const [editando, setEditando] = useState(false);
  const porId = new Map(secoes.map((s) => [s.id, s]));
  const fixas = fixadas.map((id) => porId.get(id)).filter((x): x is SecaoCurta => !!x);
  const ultimas = recentes.filter((id) => !fixadas.includes(id)).map((id) => porId.get(id)).filter((x): x is SecaoCurta => !!x);
  const espacos = ESPACOS.map((e) => ({ ...e, secoes: secoes.filter((s) => s.id !== "mesa" && espacoDe(s.id, s.grupo) === e.id) })).filter((e) => e.secoes.length > 0);
  return (
    <section aria-labelledby="atalhos-titulo" style={{ display: "grid", gap: "0.9rem" }}>
      <div className="pn-cabecalho" data-nivel={2}>
        <h2 id="atalhos-titulo" className="pn-cabecalho-titulo">
          Seus atalhos
        </h2>
        <Botao pequeno variante="discreto" simbolo={editando ? Check : Pencil} onClick={() => setEditando(!editando)} aria-expanded={editando}>
          {editando ? "Pronto" : "Escolher atalhos"}
        </Botao>
      </div>
      {fixas.length === 0 && !editando && (
        <p className="pn-ajuda" style={{ fontSize: "0.875rem" }}>
          Fixe as seções que você mais usa: elas aparecem aqui e no alto do menu.{" "}
          <button type="button" className="pn-elo" onClick={() => setEditando(true)}>
            Escolher agora
          </button>
        </p>
      )}
      {fixas.length > 0 && (
        <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
          {fixas.map((s) => (
            <button key={s.id} type="button" onClick={() => ir(s.id)} className="pn-cartao pn-cartao-interativo" style={{ display: "grid", gap: "0.5rem", justifyItems: "start", textAlign: "left", position: "relative", padding: "0.85rem 0.95rem" }}>
              <span className="pn-cabecalho-icone">{icone(s.id)}</span>
              <span style={{ fontWeight: 600, lineHeight: 1.25 }}>{s.nome}</span>
              <span style={{ position: "absolute", top: "0.7rem", right: "0.7rem" }}>
                <Contador n={s.conta} />
              </span>
            </button>
          ))}
        </div>
      )}
      {ultimas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
          <span className="pn-rotulo-mono" style={{ marginRight: "0.3rem" }}>
            Usadas por último
          </span>
          {ultimas.map((s) => (
            <Botao key={s.id} pequeno onClick={() => ir(s.id)}>
              {icone(s.id)}
              {s.nome}
            </Botao>
          ))}
        </div>
      )}
      {editando && (
        <div className="pn-cartao" style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }}>
          {espacos.map((e) => (
            <fieldset key={e.id} style={{ display: "grid", gap: "0.25rem", border: 0, margin: 0, padding: 0 }}>
              <legend className="pn-rotulo-mono" style={{ marginBottom: "0.3rem" }}>
                {e.nome}
              </legend>
              {e.secoes.map((s) => (
                <label key={s.id} className="pn-marca" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={fixadas.includes(s.id)} onChange={() => fixar(s.id)} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    {s.nome}
                    {fixadas.includes(s.id) && <Star aria-hidden width={12} height={12} style={{ color: "var(--pn-ouro)", fill: "currentColor" }} />}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
