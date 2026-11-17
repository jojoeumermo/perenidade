// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A marca "veio por convite" na fila da triagem (painel da Alumia › Cadastros). O banco devolve só os números das fichas em análise
// que vieram por convite (public.alumia_triagem_convites): nunca de quem. A marca some quando a triagem decide (o banco apaga).
// Para quem junta: na fila, `const porConvite = useFichasPorConvite()` uma vez e `<MarcaDoConvite ficha={p.id} fichas={porConvite} />`
// em cada pedido.
import "./convites.css";
import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { useTextosDosConvites } from "./textos";

/** As fichas em análise que vieram por convite. Sem permissão, banco antigo ou erro: nenhuma (a fila segue igual). */
export function useFichasPorConvite(recarga: unknown = null): ReadonlySet<string> {
  const [fichas, setFichas] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<string[]>("alumia_triagem_convites")
      .then((ids) => vivo && setFichas(new Set(Array.isArray(ids) ? ids : [])))
      .catch(() => vivo && setFichas(new Set()));
    return () => {
      vivo = false;
    };
  }, [recarga]);
  return fichas;
}

export function MarcaDoConvite({ ficha, fichas, lang = "pt" }: { ficha: string; fichas: ReadonlySet<string>; lang?: string }) {
  const t = useTextosDosConvites(lang);
  if (!t || !fichas.has(ficha)) return null;
  return (
    <span className="alc-marca" title={t.triagem.explica}>
      {t.triagem.marca}
    </span>
  );
}
