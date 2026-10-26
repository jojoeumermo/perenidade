// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { NOME_VITRINE } from "@/lib/mural-saude";
import { getItem, KEYS, parse, setItem, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

interface Saved {
  faixa?: string;
  pausa?: boolean;
  motivo?: string;
  em?: number;
}

/** De quanto em quanto tempo o navegador pergunta de novo se a coordenação mudou alguma coisa. */
const FRESH = 10 * 60 * 1000;

/**
 * A faixa escura do alto. O texto padrão vem com a página; se a coordenação trocou a faixa ou pausou os
 * envios, isso chega depois, do serviço, e fica guardado no navegador para a visita seguinte.
 * Cinco toques seguidos aqui acionam a saída rápida (veja Shortcuts).
 */
export function Strip({ fallback }: { fallback: string }) {
  const { t } = useI18n();
  const saved = parse<Saved>(useStored(KEYS.site), {});
  // No Mural de Saúde, a faixa só diz o que o mural é: nada de chamada do instituto nem de gratuidade.
  const noMural = /\/saude(\/|$)/.test(usePathname() ?? "");

  useEffect(() => {
    if (!hasBackend) return;
    if (Date.now() - (parse<Saved>(getItem(KEYS.site), {}).em ?? 0) < FRESH) return;
    let cancelled = false;
    rpc<Saved>("site")
      .then((valor) => {
        if (!cancelled) setItem(KEYS.site, JSON.stringify({ faixa: valor.faixa, pausa: valor.pausa, motivo: valor.motivo, em: Date.now() }));
      })
      .catch(() => {
        // Sem resposta, fica o texto que veio com a página.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* A faixa preta fica sempre no alto (os cinco toques nela são a saída rápida no celular). No Mural de Saúde, ela só
          diz o que o mural é: nada de chamada do instituto nem de gratuidade. */}
      <div data-saida className={`faixa-de-avisos bg-[#1f1a14] px-4 py-2 text-center font-mono text-[0.72rem] uppercase tracking-[0.08em] text-[#e9dcbc] max-md:truncate max-md:px-3 max-md:py-1.5 max-md:text-[0.62rem]`}>{noMural ? `${NOME_VITRINE} · contatos de profissionais com registro ativo` : saved.faixa || fallback}</div>
      {saved.pausa && (
        <p role="status" className="bg-[#c21f16] px-4 py-1.5 text-center font-sans text-xs font-semibold text-white">
          {t.errors.envios_pausados}
          {saved.motivo && ` ${saved.motivo}`}
        </p>
      )}
    </>
  );
}
