// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { cadernoAtual, situacoes } from "@/components/escola/hoje/quadro";
import type { Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { DEGRAUS, type Degrau } from "@/lib/escola/contratos";
import { useCompleted } from "@/lib/progress";
import { CartaoDoCaderno, type CadernoNoCartao, type EstadoDoCaderno } from "./CartaoDoCaderno";
import { useDiscreto } from "./discreto";

export interface CadernoDosDegraus extends CadernoNoCartao {
  degrau: Degrau;
}

/** A cor de cada degrau (prancha Formação): ouro, vermelho do núcleo e laranja. */
export const COR_DO_DEGRAU: Record<Degrau, string> = { 1: "#F2C94C", 2: "#E8604C", 3: "#EA7A24" };

/**
 * Os três degraus com os seus cadernos (pranchas Formação e Cel-Formação). No computador, os três lado a lado; no
 * celular, uma aba por degrau, aberta no degrau do caderno de agora. O estado de cada caderno vem do que a pessoa fez
 * NESTE aparelho (o mesmo progresso de /trilhas): feito, você está aqui, próximo ou em preparação (sem aula escrita).
 */
export function Degraus({ lang, cadernos, t }: { lang: Locale; cadernos: CadernoDosDegraus[]; t: TextosDaFormacao["formacao"] }) {
  const feitas = useCompleted();
  const discreto = useDiscreto();
  const s = situacoes(
    cadernos.map((c) => ({ numero: c.numero, aulas: c.prontas.map((id) => ({ id })) })),
    feitas,
  );
  const atual = cadernoAtual(s);
  const [aba, setAba] = useState<Degrau | null>(null);
  const aberta: Degrau = aba ?? (atual >= 0 ? cadernos[atual].degrau : 1);
  const estadoDe = (i: number): EstadoDoCaderno => (s[i] === "preparacao" ? "preparo" : s[i] === "feito" ? "feito" : i === atual ? "agora" : "proximo");

  return (
    <>
      <div role="tablist" aria-label={t.abas} className="eff-abas">
        {DEGRAUS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            id={`eff-aba-${d}`}
            aria-controls={`eff-degrau-${d}`}
            aria-selected={aberta === d}
            onClick={() => setAba(d)}
            className="eff-aba"
            style={{ background: COR_DO_DEGRAU[d] }}
          >
            {t.degraus[d - 1].curto}
          </button>
        ))}
      </div>
      <div className="eff-degraus">
        {DEGRAUS.map((d) => {
          const g = t.degraus[d - 1];
          return (
            <section key={d} id={`eff-degrau-${d}`} aria-labelledby={`eff-degrau-titulo-${d}`} className="eff-degrau" data-aberta={aberta === d ? "" : undefined} style={{ background: COR_DO_DEGRAU[d] }}>
              <span className="ef-t eff-degrau-rotulo">{g.rotulo}</span>
              <h2 id={`eff-degrau-titulo-${d}`} className="ef-t eff-degrau-nome">
                {g.nome}
              </h2>
              <p className="eff-degrau-desc">{g.desc}</p>
              <ol className="eff-escada">
                {cadernos.map((c, i) =>
                  c.degrau === d ? (
                    <li key={c.numero}>
                      <CartaoDoCaderno lang={lang} c={c} estado={estadoDe(i)} feitas={c.prontas.filter((id) => feitas.has(id)).length} t={t} discreto={discreto} />
                    </li>
                  ) : null,
                )}
              </ol>
            </section>
          );
        })}
      </div>
    </>
  );
}
