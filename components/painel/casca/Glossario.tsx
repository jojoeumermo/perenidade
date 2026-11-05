// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { GLOSSARIO } from "../guias";
import { Busca, Dialogo } from "../ui";

const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** O glossário do painel: as palavras das seções, em linguagem simples, com busca. */
export function Glossario({ aberto, aoMudar }: { aberto: boolean; aoMudar: (aberto: boolean) => void }) {
  const [busca, setBusca] = useState("");
  const termo = simples(busca.trim());
  const vistos = termo ? GLOSSARIO.filter(([palavra, sentido]) => simples(`${palavra} ${sentido}`).includes(termo)) : GLOSSARIO;
  return (
    <Dialogo
      aberto={aberto}
      aoMudar={(a) => {
        if (!a) setBusca("");
        aoMudar(a);
      }}
      titulo="Glossário do painel"
      largo
    >
      <div style={{ marginTop: "0.9rem" }}>
        <Busca rotulo="Procurar no glossário" valor={busca} aoMudar={setBusca} placeholder="Procurar uma palavra" autoFocus />
      </div>
      <dl className="pn-definicoes">
        {vistos.map(([palavra, sentido]) => (
          <div key={palavra}>
            <dt>{palavra}</dt>
            <dd>{sentido}</dd>
          </div>
        ))}
        {vistos.length === 0 && <p className="pn-ajuda" style={{ padding: "0.75rem 0" }}>Nenhuma palavra com isso. Pergunte no Mural da equipe.</p>}
      </dl>
    </Dialogo>
  );
}
