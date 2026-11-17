// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O link de fora de um post, do lado de quem lê (onda 11, 11F): conferido no Google Safe Browsing pelo servidor do site
// (lib/rede/links-conferidos/leitor.ts). Limpo, ou sem a conferência ligada: o link de sempre. Marcado como perigoso: o texto sai
// sem clique, com a frase de por quê, para quem publicou pulando a tela também não espalhar o link.
import { useEffect, useState, type ReactNode } from "react";
import { conferirParaLer } from "@/lib/rede/links-conferidos/leitor";
import { carregarTextosDosLinks, lugarDoLink, type TextosDosLinks } from "@/lib/rede/links-conferidos/textos";

export function LinkDoLeitor({ href, lang, className, children }: { href: string; lang: string; className?: string; children: ReactNode }) {
  const [barrado, setBarrado] = useState<{ t: TextosDosLinks; tipo: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    void conferirParaLer(href).then(async (tipos) => {
      if (!vivo || !tipos?.length) return;
      const t = await carregarTextosDosLinks(lang);
      if (vivo) setBarrado({ t, tipo: tipos[0] });
    });
    return () => {
      vivo = false;
    };
  }, [href, lang]);

  if (barrado) {
    const tipos = barrado.t.tipos as Record<string, string>;
    const frase = barrado.t.leitor.replace("{host}", lugarDoLink(href)).replace("{tipo}", tipos[barrado.tipo] ?? tipos.outro);
    return (
      <span className="link-barrado" data-link-barrado="">
        <span className="line-through decoration-[var(--al-vermelho,currentColor)]">{children}</span>{" "}
        <span className="text-xs font-semibold text-[var(--al-texto-2,currentColor)]">({frase})</span>
      </span>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer nofollow ugc">
      {children}
    </a>
  );
}
