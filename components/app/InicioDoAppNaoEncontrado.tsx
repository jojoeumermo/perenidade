// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { locales } from "@/i18n/config";

const semAssinatura = () => () => {};
/** O idioma do primeiro trecho do endereço atual, se for um idioma do site; senão, o português. */
const idiomaDoEndereco = () => {
  const primeiro = window.location.pathname.split("/")[1];
  return (locales as readonly string[]).includes(primeiro) ? primeiro : "pt";
};

/**
 * O botão "Início do app" da tela de não encontrado (app/global-not-found.tsx). Essa tela não conhece o idioma do endereço
 * (é só em português), mas o botão preserva o idioma de quem veio de /en/app/..., /es/app/... etc.: leva para o início do
 * app nesse idioma, ou para o português. Só aparece com <html data-app> (classe app:inline-flex): fora do app a tela é a de sempre.
 */
export function InicioDoAppNaoEncontrado({ className, children }: { className: string; children: React.ReactNode }) {
  const lang = useSyncExternalStore(semAssinatura, idiomaDoEndereco, () => "pt");
  return (
    <Link href={`/${lang}/app`} className={className} data-nao-encontrado-app="">
      {children}
    </Link>
  );
}
