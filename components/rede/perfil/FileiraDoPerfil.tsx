// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as frentes penduram no perfil (encaixe abasDoPerfil, components/rede/encaixes.tsx): hoje, a fileira de destaques dos
// stories (F5), que recebe por contexto os destaques de post e de ato do perfil livre e desenha tudo numa linha só (B1). Serve ao
// perfil de pessoa (livre/PaginaDoPerfil.tsx) e ao de organização (org/PerfilDaOrg.tsx), acima das abas, como no Instagram.
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import { DestaquesDePostsNoPerfil, type DestaqueDePostNaFileira } from "../destaques-do-perfil";
import { ENCAIXES } from "../encaixes";

/** A fileira única está ligada? (sem ela, o perfil livre mostra os destaques de post na aba "Destaques", como antes) */
export function fileiraDeDestaquesLigada(): boolean {
  return rotaNovaLigada("stories") && ENCAIXES.abasDoPerfil.some((a) => a.chave === "destaques");
}

export function FileiraDoPerfil({ handle, lang, s, situacao, posts = [] }: { handle: string; lang: string; s: TextosDaRede; situacao: Situacao; posts?: readonly DestaqueDePostNaFileira[] }) {
  return (
    <DestaquesDePostsNoPerfil.Provider value={posts}>
      {ENCAIXES.abasDoPerfil.map((a) => (
        <a.Componente key={a.chave} lang={lang} s={s} situacao={situacao} handle={handle} />
      ))}
    </DestaquesDePostsNoPerfil.Provider>
  );
}
