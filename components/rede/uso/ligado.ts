// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O interruptor "alumia-falar-moderacao" lido pela tela (R1), separado das telas do canal: quem só precisa saber se o canal
// está ligado não baixa o canal inteiro. O banco confere de novo em cada chamada.
import { useEffect, useState } from "react";
import { clienteModmail } from "./cliente-modmail";

/** O interruptor, lido uma vez por tela: nulo enquanto não chegou; falso em qualquer erro (desligado é o padrão seguro). */
export function useModmailLigado(previa: boolean, ativo = true): boolean | null {
  const [ligado, setLigado] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    clienteModmail(previa)
      .ligado()
      .then(
        (x) => vivo && setLigado(x === true),
        () => vivo && setLigado(false),
      );
    return () => {
      vivo = false;
    };
  }, [previa, ativo]);
  return ligado;
}

