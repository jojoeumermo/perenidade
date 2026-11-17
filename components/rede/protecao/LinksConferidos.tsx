// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A linha curta do compositor quando o texto tem link (onda 11, 11F): "Os links são conferidos pelo Google Safe Browsing", com o
// link para a política (o que vai, o que não vai). Só aparece quando a conferência está ligada de verdade no servidor: sem a
// chave, a tela não promete o que não acontece.
import { useEffect, useState } from "react";
import { conferenciaLigada } from "@/lib/rede/links-conferidos/cliente";
import { carregarTextosDosLinks, type TextosDosLinks } from "@/lib/rede/links-conferidos/textos";
import { linksDoTexto } from "./link-suspeito";

export function LinksConferidos({ lang, texto }: { lang: string; texto: string }) {
  const temLink = linksDoTexto(texto).length > 0;
  const [ligada, setLigada] = useState(false);
  const [t, setT] = useState<TextosDosLinks | null>(null);

  useEffect(() => {
    if (!temLink) return;
    let vivo = true;
    void Promise.all([conferenciaLigada(), carregarTextosDosLinks(lang)]).then(([sim, textos]) => {
      if (!vivo) return;
      setLigada(sim);
      setT(textos);
    });
    return () => {
      vivo = false;
    };
  }, [temLink, lang]);

  if (!temLink || !ligada || !t) return null;
  return (
    <p className="-mt-2 flex items-center gap-1.5 text-[0.82rem] text-[var(--al-texto-3)]" data-links-conferidos="">
      <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--al-dourado)]">
        <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
        <path d="m8.8 12.2 2.2 2.2 4.2-4.6" />
      </svg>
      <span>
        {t.aviso}{" "}
        <a href={`/${lang}/alumia/privacidade#fora`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          {t.comoFunciona}
        </a>
      </span>
    </p>
  );
}
