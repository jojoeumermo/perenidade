// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ContextoDoEncaixe } from "../encaixes";
import { ItemDoAto } from "./ItemDoAto";
import { useListaDeAtos, useTextosDosAtos } from "./usar";
import "./atos.css";

/** A aba "Atos" da comunidade (prancha celular-comunidade: Posts/Atos/Aulas/Sobre): os atos chamados nela, por data. */
export function AbaDosAtos({ lang, slug }: ContextoDoEncaixe & { slug: string }) {
  const t = useTextosDosAtos(lang);
  const { estado } = useListaDeAtos("seguindo", { comunidade: slug });
  if (!t) return null;
  if (estado.fase === "carregando") return <p className="al-atos-ajuda">{t.tela.carregando}</p>;
  if (estado.fase === "erro") return <p className="al-atos-ajuda" role="alert">{t.tela.erro}</p>;
  if (estado.dados.length === 0) return <p className="al-atos-ajuda">{t.aba.vazio}</p>;
  return (
    <div className="al-atos-perto" style={{ padding: "0 16px" }}>
      {estado.dados.map((a) => (
        <ItemDoAto key={a.id} ato={a} t={t} lang={lang} />
      ))}
    </div>
  );
}
