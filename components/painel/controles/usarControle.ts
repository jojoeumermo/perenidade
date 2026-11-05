// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { PAINEL_MUDOU, textoDoErro } from "../comum";
import { notificar } from "../ui";

/**
 * Chama uma função do banco e avisa o resultado por toast (sucesso ou erro em português). Depois de um sucesso,
 * recarrega a lista da tela e manda o menu do painel refazer as contagens. Devolve o resultado, ou null se falhou.
 */
export function useControle(depois?: () => void) {
  const [ocupado, setOcupado] = useState(false);
  async function executar<T = unknown>(funcao: string, argumentos: Record<string, unknown>, sucesso: string): Promise<T | null> {
    setOcupado(true);
    try {
      const r = await rpc<T>(funcao, argumentos);
      notificar.ok(sucesso);
      depois?.();
      window.dispatchEvent(new Event(PAINEL_MUDOU));
      return r;
    } catch (erro) {
      notificar.erro(textoDoErro(erro));
      return null;
    } finally {
      setOcupado(false);
    }
  }
  return { executar, ocupado };
}
