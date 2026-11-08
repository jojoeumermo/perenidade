// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { useDaEscola } from "@/lib/escola/acesso";
import { hojeISO } from "./tempo";

/** Recados da formação (prancha Hoje), da F4 (escola_recados). Vencidos não aparecem; sem a função no banco, o vazio honesto. */
export function Recados({ t }: { t: TextosDaFormacaoBase["hoje"] }) {
  const lido = useDaEscola("escola_recados");
  const hoje = hojeISO();
  const recados = lido?.ok ? (lido.dados ?? []).filter((r) => r.ate >= hoje) : [];
  return (
    <section aria-labelledby="ef-recados" className="ef-cartao ef-recados ef-o-recados" aria-busy={lido === null}>
      <h2 id="ef-recados" className="ef-t">
        {t.recados.titulo}
      </h2>
      {lido === null ? (
        <p className="ef-vazio">{t.carregando}</p>
      ) : !lido.ok ? (
        <p className="ef-vazio">{lido.motivo === "ausente" ? t.recados.ausente : t.falha}</p>
      ) : recados.length === 0 ? (
        <p className="ef-vazio">{t.recados.vazio}</p>
      ) : (
        <ul>
          {recados.map((r) => (
            <li key={r.id}>{r.texto}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
