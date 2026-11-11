// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A fileira ÚNICA de destaques do perfil (B1): as bolinhas dos destaques de stories (F5, pelo encaixe abasDoPerfil) e os
// destaques de post e de ato que a pessoa escolheu no perfil livre (A5, dentro da aparência) ficam juntos, numa linha só, para não
// haver dois "destaques" diferentes no mesmo perfil. O perfil (pessoa ou organização) entrega aqui os de post/ato e desenha os
// encaixes; a fileira dos stories lê este contexto e põe os de post/ato depois dos dela. Neutro: nenhuma frente é dona.
import { createContext, useContext } from "react";

/** Um destaque de post ou de ato (do perfil livre) na fileira: abre o post (ou o ato). */
export interface DestaqueDePostNaFileira {
  chave: string;
  tipo: "post" | "ato";
  titulo: string;
  href: string;
  /** A cor do anel (hex da paleta do perfil). */
  cor: string;
}

export const DestaquesDePostsNoPerfil = createContext<readonly DestaqueDePostNaFileira[]>([]);

export function useDestaquesDePostsNoPerfil(): readonly DestaqueDePostNaFileira[] {
  return useContext(DestaquesDePostsNoPerfil);
}
