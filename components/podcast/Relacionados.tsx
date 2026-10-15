// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { type Episodio, minutos } from "@/lib/podcast";
import { L, useI18n } from "../I18n";
import { Capa } from "./Capa";
import { Ouvir } from "./Ouvir";

/**
 * Episódios ligados a uma disciplina (e, quando houver, ao curso aberto): aparecem como material complementar.
 * Sem episódio ligado, não ocupa espaço nenhum.
 */
export function PodcastsRelacionados({ disciplina, trilha }: { disciplina?: string; trilha?: string }) {
  const { t } = useI18n();
  const [lista, setLista] = useState<Episodio[]>([]);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    rpc<Episodio[]>("podcast_por_disciplina", { p_disciplina: disciplina ?? null, p_trilha: trilha ?? null })
      .then((valor) => {
        if (!cancelado) setLista(Array.isArray(valor) ? valor : []);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [disciplina, trilha]);

  if (lista.length === 0) return null;
  const s = t.radio;
  return (
    <section aria-labelledby="podcasts-relacionados" className="no-print mt-12">
      <h2 id="podcasts-relacionados" className="jornal-secao">
        <span className="jornal-editoria">{s.related}</span>
      </h2>
      <p className="mt-2 font-sans text-sm text-ink-soft">{s.relatedLead}</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {lista.slice(0, 4).map((e) => (
          <li key={e.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-2 border-ink p-2">
            <Capa caminho={e.capa_mini || e.capa} titulo={e.titulo} />
            <span className="min-w-0" lang="pt-BR">
              <L href={`/podcasts/${e.slug}`} className="line-clamp-2 font-serif text-lg font-semibold leading-snug hover:text-oxblood">{e.titulo}</L>
              <span className="block font-sans text-xs text-ink-soft">{minutos(e.duracao)}</span>
            </span>
            <Ouvir episodio={e} fila={lista} programa={t.nav.podcasts} rotulo={s.play} pausar={s.pause} />
          </li>
        ))}
      </ul>
    </section>
  );
}
