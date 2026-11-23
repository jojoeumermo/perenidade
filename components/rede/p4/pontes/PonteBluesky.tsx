// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 85 (atrás de "alumia-p4-pontes"): a ponte com o Bluesky, nas ferramentas da moderação de uma comunidade ABERTA. A
// escolha fica guardada, mas a ponte não liga: o Bridgy Fed está no bloqueio fixo por decisão do Instituto
// (20261110-fediverso-bloqueio-padrao.sql), e a tela diz isso sem rodeio. Nada sai para o Bluesky daqui.
import { useEffect, useId, useState } from "react";
import { pontes, type PonteBluesky as Estado } from "@/lib/rede/p4/pontes/cliente";
import { textoDoErro } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

export function PonteBluesky({ slug, lang }: { slug: string; lang: string }) {
  const t = useTextosDasPontes(lang);
  const id = useId();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    pontes
      .bluesky(slug)
      .then((r) => vivo && setEstado(r))
      .catch(() => vivo && setEstado(null));
    return () => {
      vivo = false;
    };
  }, [slug]);
  if (!t || !estado || !estado.ligado) return null;
  async function mudar(sim: boolean) {
    if (ocupado || !t) return;
    setOcupado(true);
    setErro("");
    try {
      setEstado(await pontes.blueskyEscolher(slug, sim));
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section aria-labelledby={`${id}-t`} data-p4-bluesky>
      <h3 id={`${id}-t`} className="font-bold">{t.bluesky.titulo}</h3>
      <p className="text-sm text-ink-soft">{t.bluesky.texto}</p>
      {estado.aberta ? (
        <div className="flex min-h-11 items-start gap-3 py-2">
          <input id={id} type="checkbox" checked={estado.escolheu} disabled={ocupado} onChange={(e) => void mudar(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#c21f16]" />
          <label htmlFor={id} className="cursor-pointer">{t.bluesky.escolher}</label>
        </div>
      ) : (
        <p className="text-sm">{t.bluesky.fechada}</p>
      )}
      {estado.barrada && <p role="note" className="text-sm font-semibold">{t.bluesky.barrada}</p>}
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </section>
  );
}
