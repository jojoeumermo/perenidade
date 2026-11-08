// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { EncontroNoNucleo } from "@/lib/escola/nucleo";
import { QuemFazOQue } from "./QuemFazOQue";

/**
 * A aba Tarefas: os encaminhamentos do encontro separados em "com você" (com o "Soltar"), "sem ninguém ainda" (com o
 * "Eu levo") e "com outras pessoas". O texto lembra o rodízio (PLANO-ESCOLA.md, seção 3, item 5: escolha de desenho do Instituto).
 */
export function Tarefas({ encontro, t, ocupado, pegar }: { encontro: EncontroNoNucleo | null; t: TextosDaTelaDoNucleo; ocupado: boolean; pegar: (id: string, pegar: boolean) => void }) {
  const lista = encontro?.tarefas ?? [];
  const grupos = [
    { titulo: t.tarefas.minhas, itens: lista.filter((x) => x.minha), vazio: t.tarefas.nenhumaMinha },
    { titulo: t.tarefas.abertas, itens: lista.filter((x) => !x.quem), vazio: null },
    { titulo: t.tarefas.outras, itens: lista.filter((x) => x.quem && !x.minha), vazio: null },
  ];
  return (
    <section aria-labelledby="en-tarefas-t" className="en-bloco">
      <h2 id="en-tarefas-t" className="ef-t en-h2">
        {t.tarefas.titulo}
      </h2>
      <p className="en-nota">{t.tarefas.texto}</p>
      {!encontro ? (
        <p className="en-vazio">{t.tela.semEncontro}</p>
      ) : lista.length === 0 ? (
        <p className="en-vazio">{t.pauta.semTarefas}</p>
      ) : (
        grupos.map((g) =>
          g.itens.length === 0 && !g.vazio ? null : (
            <div key={g.titulo} className="en-grupo-tarefas">
              <h3 className="ef-t en-h3">{g.titulo}</h3>
              {g.itens.length === 0 ? <p className="en-vazio">{g.vazio}</p> : <QuemFazOQue tarefas={g.itens} t={t.pauta} ocupado={ocupado} pegar={pegar} soltavel />}
            </div>
          ),
        )
      )}
    </section>
  );
}
