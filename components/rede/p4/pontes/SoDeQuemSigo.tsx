// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 131 (atrás de "alumia-p4-pontes"): nas preferências de notificação no aparelho, "menções e respostas só de quem eu
// sigo". As outras continuam na lista de avisos; só não viram notificação (o banco decide em rede_aviso_push_pendentes). A escolha
// é só da própria pessoa.
import { useEffect, useId, useState } from "react";
import { pontes } from "@/lib/rede/p4/pontes/cliente";
import { textoDoErro } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

export function SoDeQuemSigo({ lang }: { lang: string }) {
  const t = useTextosDasPontes(lang);
  const id = useId();
  const [ligada, setLigada] = useState<boolean | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    pontes
      .soSeguidos()
      .then((r) => vivo && setLigada(r.so_seguidos))
      .catch(() => vivo && setLigada(false));
    return () => {
      vivo = false;
    };
  }, []);
  if (!t || ligada === null) return null;
  async function mudar(sim: boolean) {
    if (ocupado || !t) return;
    setOcupado(true);
    setErro("");
    try {
      setLigada((await pontes.soSeguidos(sim)).so_seguidos);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="flex min-h-11 items-start gap-3 py-2" data-p4-so-seguidos>
      <input id={id} type="checkbox" checked={ligada} disabled={ocupado} onChange={(e) => void mudar(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#c21f16]" aria-describedby={`${id}-nota`} />
      <label htmlFor={id} className="cursor-pointer">
        <span className="font-semibold">{t.avisos.soSeguidos}</span>
        <span id={`${id}-nota`} className="block text-sm text-ink-soft">{t.avisos.soSeguidosAjuda}</span>
        {erro && <span role="alert" className="block text-sm text-oxblood">{erro}</span>}
      </label>
    </div>
  );
}
