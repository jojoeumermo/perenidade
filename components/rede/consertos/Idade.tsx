// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { BackendError } from "@/lib/backend";
import { consertos } from "@/lib/rede/cliente-consertos";
import { ForaDaRede } from "./ForaDaRede";
import { useConsertos } from "./contexto";

/**
 * A confirmação de idade da Rede: 18 anos ou mais (autodeclaração; o ECA Digital, art. 9º, §1º, pede revisão jurídica antes de
 * abrir para todos) ou menos de 18, que deixa a pessoa fora só da Rede com uma mensagem gentil.
 */
export function Idade({ titulo, texto, rotuloMaior, aoConfirmar, aoSerMenor }: { titulo: string; texto: string; rotuloMaior: string; aoConfirmar: () => void; aoSerMenor?: () => void }) {
  const x = useConsertos();
  const [menor, setMenor] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const botao = "cursor-pointer rounded-full px-4 py-2 font-sans text-sm font-bold disabled:opacity-50";
  if (menor) return <ForaDaRede />;
  return (
    <div className="mt-3 rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3 font-sans text-sm">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1">{texto}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado}
          className={`${botao} bg-ink text-parchment`}
          onClick={async () => {
            setOcupado(true);
            try {
              await consertos.confirmarIdade(true);
              aoConfirmar();
            } catch (falha) {
              // Só a recusa do banco (já declarou menos de 18) tira a pessoa da Rede; falha de rede não.
              if (falha instanceof BackendError && falha.code === "idade_minima") setMenor(true);
            } finally {
              setOcupado(false);
            }
          }}
        >
          {rotuloMaior}
        </button>
        <button
          type="button"
          disabled={ocupado}
          className={`${botao} border-[1.5px] border-ink`}
          onClick={async () => {
            setOcupado(true);
            try {
              await consertos.confirmarIdade(false);
              setMenor(true);
              aoSerMenor?.();
            } catch {
              /* sem rede: nada foi gravado, a pessoa pode tentar de novo */
            } finally {
              setOcupado(false);
            }
          }}
        >
          {x.idadeMenor}
        </button>
      </div>
    </div>
  );
}
