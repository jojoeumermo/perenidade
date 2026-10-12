// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { hasBackend, rpc } from "@/lib/backend";
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
      <div data-saida className="bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">{saved.faixa || fallback}</div>
      {saved.pausa && (
        <p role="status" className="bg-oxblood px-4 py-1.5 text-center font-sans text-xs text-parchment">
          {t.errors.envios_pausados}
          {saved.motivo && ` ${saved.motivo}`}
        </p>
      )}
    </>
  );
}
