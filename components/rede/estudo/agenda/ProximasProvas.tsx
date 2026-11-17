// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import type { ContextoDoEncaixe } from "../../encaixes";
import { criarTextos, encher } from "../turma/comum";
import { agenda } from "./cliente";
import { diasEntre, type DataDaAgenda } from "./regras";
import { carregarTextosDaAgenda } from "./textos";
import "../turma/estudo.css";

const useTextos = criarTextos(carregarTextosDaAgenda);

/**
 * "Próximas provas" na coluna da direita do computador: as duas próximas datas que a pessoa pediu para ser avisada, com quantos
 * dias faltam. Sem data assinada (ou sem conta), não aparece nada: a coluna não ganha um cartão vazio.
 */
export function ProximasProvas({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextos(lang);
  const [proximas, setProximas] = useState<{ hoje: string; itens: DataDaAgenda[] } | null>(null);
  const membro = situacao.logado && situacao.membro;
  useEffect(() => {
    if (!membro) return;
    let vivo = true;
    agenda.datas().then(
      (r) => vivo && setProximas({ hoje: r.hoje, itens: r.itens.filter((d) => d.assinada && diasEntre(r.hoje, d.dia) >= 0).slice(0, 2) }),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [membro]);
  if (!t || !proximas || proximas.itens.length === 0) return null;
  return (
    <section className="es-cartao es-regra" aria-label={t.lateral.titulo}>
      <h2 className="es-rotulo al-cond">{t.lateral.titulo}</h2>
      <ul className="es-itens" role="list">
        {proximas.itens.map((d) => {
          const n = diasEntre(proximas.hoje, d.dia);
          return (
            <li key={d.id}>
              <span className="es-item-ladrilho" data-cor={n <= 7 ? "v" : "d"} aria-hidden />
              <span>
                <strong>{d.exame}</strong> · {d.etapa} · {n === 0 ? t.provas.hoje : n === 1 ? t.provas.amanha : encher(t.provas.faltam, { n })}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href={`/${lang}/alumia/agenda`} className="es-miudo">{t.lateral.ver}</Link>
    </section>
  );
}
