// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { gravarTrabalho, LIMITES, lerTrabalho } from "@/lib/escola/acompanhante";
import { Conversa, type Textos } from "./Conversa";

/**
 * "Explique com exemplo do meu trabalho" (R1-51): o mesmo trecho reescrito com um exemplo do trabalho da pessoa, sem
 * mudar fatos. O trabalho fica lembrado só no aparelho (lucia:escola-privado:trabalho; nunca no modo seguro). Sem
 * trecho vindo da aula (na entrada do acompanhante), a pessoa cola o trecho.
 */
export function OutroJeito({ s, trecho: trechoDaAula, aula }: { s: Textos; trecho?: string; aula?: string }) {
  const id = useId();
  const [trabalho, setTrabalho] = useState("");
  const [colado, setColado] = useState("");
  useEffect(() => {
    // O trabalho guardado só existe no navegador: chega depois da hidratação.
    const id = window.setTimeout(() => setTrabalho(lerTrabalho()), 0);
    return () => window.clearTimeout(id);
  }, []);
  const trecho = (trechoDaAula ?? colado).trim();
  const falta = !trabalho.trim() || !trecho;

  return (
    <section className="mt-2" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="font-serif text-xl font-semibold">
        {s.outroJeito.titulo}
      </h3>
      {trechoDaAula === undefined && (
        <>
          <label htmlFor={`${id}-trecho`} className="mt-3 block font-semibold">
            {s.duvida.trecho}
          </label>
          <p id={`${id}-trecho-dica`} className="text-sm text-ink-soft">
            {s.duvida.trechoDica}
          </p>
          <textarea id={`${id}-trecho`} aria-describedby={`${id}-trecho-dica`} value={colado} maxLength={LIMITES.trecho} rows={4} onChange={(e) => setColado(e.target.value.slice(0, LIMITES.trecho))} className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base" />
        </>
      )}
      <label htmlFor={`${id}-trabalho`} className="mt-3 block font-semibold">
        {s.outroJeito.trabalho}
      </label>
      <p id={`${id}-trabalho-dica`} className="text-sm text-ink-soft">
        {s.outroJeito.trabalhoDica}
      </p>
      <input
        id={`${id}-trabalho`}
        aria-describedby={`${id}-trabalho-dica`}
        value={trabalho}
        maxLength={LIMITES.trabalho}
        autoComplete="organization-title"
        onChange={(e) => setTrabalho(e.target.value.slice(0, LIMITES.trabalho))}
        onBlur={() => gravarTrabalho(trabalho)}
        className="acompanhante-campo mt-2 w-full max-w-md border-2 border-ink bg-parchment px-3 py-2"
      />
      {falta && <p className="mt-2 text-sm text-ink-soft">{s.outroJeito.precisa}</p>}
      <Conversa
        s={s}
        modo="outro-jeito"
        contexto={{ trecho, trabalho: trabalho.trim(), ...(aula ? { aula } : {}) }}
        itens={["trecho", "trabalho", "pergunta", ...(aula ? (["aula"] as const) : [])]}
        campo={{ rotulo: s.naoEntendi.perguntaOpcional, max: 600, min: 3, linhas: 2 }}
        botao={s.outroJeito.botao}
        semTextoBasta
        bloqueado={falta}
        semServidor="busca"
        aoMudar={() => gravarTrabalho(trabalho)}
      />
    </section>
  );
}
