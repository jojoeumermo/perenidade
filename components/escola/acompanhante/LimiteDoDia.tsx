// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { hasBackend, rpc } from "@/lib/backend";
import { LIMITE_PADRAO, limiteDoEstado } from "@/lib/escola/provedores-publicos";

/**
 * O limite diário do "Como funciona" (R1-64): o que o banco disser (assistente_estado, se um dia devolver
 * "por_pessoa"); senão, o padrão de supabase/install.sql, com a ressalva de que a coordenação pode mudar.
 */
export function LimiteDoDia({ banco, padrao }: { banco: string; padrao: string }) {
  const [doBanco, setDoBanco] = useState<number | null>(null);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<unknown>("assistente_estado")
      .then((estado) => vivo && setDoBanco(limiteDoEstado(estado)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return <p className="mt-2">{doBanco !== null ? fill(banco, { n: doBanco }) : fill(padrao, { n: LIMITE_PADRAO.porPessoa, total: LIMITE_PADRAO.porDia })}</p>;
}
