// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { hasBackend, rpc } from "./backend";

export interface Cadastro {
  /** A resposta do serviço já chegou. */
  pronto: boolean;
  /** O serviço já conhece o cadastro aberto e a candidatura pública (banco atualizado). */
  novo: boolean;
  /** Qualquer pessoa pode criar conta agora. */
  aberto: boolean;
}

let pedido: Promise<Cadastro> | null = null;

/**
 * O site pergunta ao serviço se o cadastro está aberto antes de oferecer "Criar conta" e a candidatura a voluntário.
 * Banco que ainda não recebeu a atualização não devolve o campo "cadastro": nesse caso as duas portas ficam fechadas,
 * em vez de aparecerem e falharem. Uma pergunta por visita, compartilhada por todos os componentes.
 */
export function useCadastro(): Cadastro {
  const [estado, setEstado] = useState<Cadastro>({ pronto: false, novo: false, aberto: false });
  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    pedido ??= rpc<{ cadastro?: boolean; pausa?: boolean }>("site")
      .then((valor) => ({ pronto: true, novo: typeof valor.cadastro === "boolean", aberto: valor.cadastro === true && valor.pausa !== true }))
      .catch(() => {
        pedido = null;
        return { pronto: true, novo: false, aberto: false };
      });
    void pedido.then((valor) => {
      if (!cancelado) setEstado(valor);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return estado;
}
