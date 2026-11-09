// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import type { ContextoDoEncaixe } from "../encaixes";
import { ItemDoAto } from "./ItemDoAto";
import { useListaDeAtos, useTextosDosAtos } from "./usar";
import { cidadeGuardada } from "@/lib/rede/atos/aparelho";
import "./atos.css";

/**
 * "Atos perto de você" (coluna da direita, prancha computador-inicio): até 3 atos da cidade que a pessoa ESCREVEU na tela dos
 * atos (fica só neste aparelho; nada de GPS, PLANO-ALUMIA §6.7), com carimbo Confirmado/Adiado/Cancelado. Sem cidade, convida a
 * escrever uma; "Ver todos" leva à tela dos atos.
 */
export function AtosPerto({ lang }: ContextoDoEncaixe) {
  const t = useTextosDosAtos(lang);
  const [cidade, setCidade] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    queueMicrotask(() => setCidade(cidadeGuardada()));
  }, []);
  const { estado } = useListaDeAtos("perto", { cidade: cidade ?? null, ligado: !!cidade });
  if (!t) return null;
  const itens = estado.fase === "pronto" ? estado.dados.slice(0, 3) : [];
  return (
    <section className="al-atos-perto" aria-labelledby="al-atos-perto-titulo">
      <div className="al-atos-perto-cabeca">
        <h2 id="al-atos-perto-titulo" className="al-cond al-atos-perto-titulo">
          {t.perto.titulo}
        </h2>
        <Link href={`/${lang}/alumia/atos`} className="al-atos-perto-todos">
          {t.perto.verTodos}
        </Link>
      </div>
      {cidade === null ? (
        <p className="al-atos-ajuda">{t.perto.semCidade}</p>
      ) : estado.fase === "pronto" && itens.length === 0 ? (
        <p className="al-atos-ajuda">{t.perto.vazio}</p>
      ) : (
        itens.map((a) => <ItemDoAto key={a.id} ato={a} t={t} lang={lang} />)
      )}
    </section>
  );
}
