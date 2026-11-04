// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import type { EstadoDaEntrada } from "@/lib/rede/tipos-descoberta";
import { useTextosDescoberta } from "./textos";

// O passo a passo só chega ao navegador de quem ainda não terminou a primeira entrada.
const PrimeiraEntrada = dynamic(() => import("./PrimeiraEntrada").then((m) => m.PrimeiraEntrada), { ssr: false });

/**
 * A porta da primeira entrada: pergunta ao banco em que passo a pessoa está (uma chamada pequena) e só então carrega o passo a passo.
 * Quem já terminou não vê nada. Se o banco ainda não recebeu a migração do pacote, devolve `alternativa` (a entrada simples de
 * sempre), então nada quebra durante a subida. Só para quem tem conta.
 */
export function PortaDaEntrada({
  lang,
  s,
  situacao,
  aoSituacao,
  alternativa,
}: {
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  aoSituacao: (nova: Situacao) => void;
  alternativa: React.ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoDaEntrada | "falhou" | null>(null);
  const d = useTextosDescoberta(lang);
  // Recarrega quando a situação muda (acabou de entrar): se já passou do passo 'pronto', o componente some.
  const chave = `${situacao.membro}:${situacao.codinome_ok}`;

  useEffect(() => {
    let vivo = true;
    redeDescoberta
      .estado()
      .then((x) => vivo && setEstado(x))
      .catch(() => vivo && setEstado("falhou"));
    return () => {
      vivo = false;
    };
  }, [chave]);

  if (estado === "falhou") return <>{alternativa}</>;
  if (!estado || estado.passo === "pronto" || estado.passo === "entrar") return null;
  if (!d) return <p role="status" className="px-[18px] py-6 font-sans text-ink-soft">{s.estados.carregando}</p>;
  return (
    <PrimeiraEntrada
      lang={lang}
      s={s}
      d={d}
      estado={estado}
      situacao={situacao}
      aoConcluir={(nova) => {
        setEstado({ ...estado, passo: "pronto" });
        aoSituacao(nova);
      }}
    />
  );
}
