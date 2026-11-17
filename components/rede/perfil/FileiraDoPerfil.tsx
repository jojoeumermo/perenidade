// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as frentes penduram no perfil (encaixe abasDoPerfil, components/rede/encaixes.tsx): a fileira de destaques dos stories (F5),
// que recebe por contexto os destaques de post e de ato do perfil livre e desenha tudo numa linha só (B1), as coleções (onda 10) e as
// conquistas (onda 11). Serve ao perfil de pessoa (livre/PaginaDoPerfil.tsx) e ao de organização (org/PerfilDaOrg.tsx), acima das
// abas, como no Instagram.
//
// Onda 12 (12D): no perfil de pessoa, as SEÇÕES que ela escolheu (lib/rede/secoes-perfil.ts) entram na mesma fileira, na ordem
// dela, junto com as peças encaixadas que são seções (destaques, coleções, conquistas). Quem nunca escolheu fica como sempre foi.
import type { SecoesVistas } from "@/lib/rede/cliente-secoes-perfil";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { ordemDaFileira } from "@/lib/rede/secoes-perfil";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import { DestaquesDePostsNoPerfil, type DestaqueDePostNaFileira } from "../destaques-do-perfil";
import { ENCAIXES } from "../encaixes";
import { SecaoPropria } from "./secoes/Secoes";
import { useTextosDasSecoes } from "./secoes/textos";

/** A fileira única está ligada? (sem ela, o perfil livre mostra os destaques de post na aba "Destaques", como antes) */
export function fileiraDeDestaquesLigada(): boolean {
  return rotaNovaLigada("stories") && ENCAIXES.abasDoPerfil.some((a) => a.chave === "destaques");
}

/** As seções do perfil de pessoa (onda 12): o que o banco mandou, os selos (para as trilhas) e se o perfil é da própria pessoa. */
export interface SecoesDaFileira {
  vistas: SecoesVistas;
  selos: readonly string[];
  meu: boolean;
}

/**
 * Desenha o que as frentes penduram no perfil e, no perfil de pessoa, as seções escolhidas. Os destaques dos stories só com a fileira
 * única ligada; o resto (as coleções do acervo, as conquistas) aparece também sem a rota dos stories.
 */
export function FileiraDoPerfil({
  handle,
  lang,
  s,
  situacao,
  posts = [],
  secoes,
}: {
  handle: string;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  posts?: readonly DestaqueDePostNaFileira[];
  /** Só no perfil de pessoa. Ausente: a fileira de sempre (perfil de organização, ou as seções ainda chegando). */
  secoes?: SecoesDaFileira;
}) {
  const t = useTextosDasSecoes(lang);
  const pecas = ENCAIXES.abasDoPerfil.filter((a) => a.chave !== "destaques" || fileiraDeDestaquesLigada());
  const ordem = ordemDaFileira(secoes ? secoes.vistas.secoes : null, pecas.map((a) => a.chave));
  return (
    <DestaquesDePostsNoPerfil.Provider value={posts}>
      <div className="pfs-fileira">
        {ordem.map((item) => {
          if (item.tipo === "encaixe") {
            const a = pecas.find((x) => x.chave === item.chave);
            return a ? <a.Componente key={`e-${a.chave}`} lang={lang} s={s} situacao={situacao} handle={handle} /> : null;
          }
          if (!secoes || !t) return null;
          return <SecaoPropria key={`s-${item.chave}`} chave={item.chave} vistas={secoes.vistas} selos={secoes.selos} meu={secoes.meu} t={t} lang={lang} />;
        })}
      </div>
    </DestaquesDePostsNoPerfil.Provider>
  );
}
