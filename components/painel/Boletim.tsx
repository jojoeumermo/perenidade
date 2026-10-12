// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { site } from "@/lib/site";
import { Aviso, botao, data, elo, useAcao, useLista } from "./comum";

/** Quem pediu o boletim do jornal. A lista serve para colar no campo "cópia oculta" do e-mail do jornal. */
export function Boletim() {
  const lista = useLista<{ email: string; criado_em: string }[]>("boletim_listar");
  const acao = useAcao(lista.recarregar);
  const [copiado, setCopiado] = useState(false);
  const enderecos = lista.dados?.map((item) => item.email) ?? [];

  return (
    <section>
      <p className="max-w-3xl text-ink-soft">
        {enderecos.length} endereço(s). Envie o boletim pelo e-mail do jornal ({site.newsletter}), sempre com a lista em <strong>cópia oculta</strong> (Cco), para ninguém ver o endereço de ninguém. Quem pedir para sair deve ser retirado no mesmo dia.
      </p>
      <button type="button" className={`${botao} mt-3`} disabled={enderecos.length === 0} onClick={() => { void navigator.clipboard.writeText(enderecos.join(", ")).then(() => setCopiado(true)); }}>
        {copiado ? "Lista copiada" : "Copiar a lista para a cópia oculta"}
      </button>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.email} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
            <span>
              {item.email} <span className="text-ink-soft">· desde {data(item.criado_em)}</span>
            </span>
            <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("boletim_remover", { p_email: item.email }, "Endereço retirado.")}>
              Retirar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
