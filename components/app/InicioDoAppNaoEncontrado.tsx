// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import { locales } from "@/i18n/config";

/**
 * O botão "Início do app" da tela de não encontrado (app/global-not-found.tsx). Essa tela não conhece o idioma do endereço
 * (é só em português), mas o botão preserva o idioma de quem veio de /en/app/..., /es/app/... etc.: lê o primeiro trecho do
 * caminho e, se for um idioma do site, leva para o início do app nesse idioma; senão, para o português.
 * Só aparece com <html data-app> (classe app:inline-flex): fora do app a tela é a de sempre.
 */
export function InicioDoAppNaoEncontrado({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const primeiro = window.location.pathname.split("/")[1];
    if (ref.current && (locales as readonly string[]).includes(primeiro)) ref.current.setAttribute("href", `/${primeiro}/app`);
  }, []);
  return (
    <a ref={ref} href="/pt/app" className={className} data-nao-encontrado-app="">
      {children}
    </a>
  );
}
