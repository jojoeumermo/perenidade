// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { alumiaComEndereco } from "@/lib/rede/alumia";
import { site } from "@/lib/site";

/**
 * O endereço do site do instituto visto de dentro da Alumia: absoluto quando ela mora no endereço próprio. No navegador, se a
 * página está num host "alumia.*" sem a variável ligada (o domínio entrou antes da variável, ou alumia.localhost no teste),
 * tira o "alumia." do host: "/pt" ali seria a própria Alumia.
 */
export function enderecoDoSite(lang: string): string {
  if (alumiaComEndereco) return `${site.url}/${lang}`;
  if (typeof window !== "undefined" && window.location.hostname.startsWith("alumia.")) {
    return `${window.location.protocol}//${window.location.host.slice("alumia.".length)}/${lang}`;
  }
  return `/${lang}`;
}

/** O botão "Voltar ao site" da faixa da Alumia. Sai pronto do servidor e só acerta o endereço no navegador, se precisar. */
export function VoltarAoSite({ lang, longo, curto }: { lang: string; longo: string; curto: string }) {
  const [href, setHref] = useState(alumiaComEndereco ? `${site.url}/${lang}` : `/${lang}`);
  useEffect(() => {
    // Só no navegador se sabe o host; a página continua podendo sair pronta do cache.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(enderecoDoSite(lang));
  }, [lang]);
  return (
    <a href={href} className="inline-flex min-h-11 items-center gap-2 font-bold underline-offset-4 hover:underline">
      <span aria-hidden>←</span>
      <span className="sm:hidden">{curto}</span>
      <span className="hidden sm:inline">{longo}</span>
    </a>
  );
}
