// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os exemplos da frente 13C para a prévia sem banco (NEXT_PUBLIC_ALUMIA_PREVIA=sim): o cartão e o RSS dos posts de exemplo das
// pranchas (lib/rede/publicar/exemplos-alumia2.ts). Nunca em produção: as rotas só chamam isto com a prévia ligada e sem banco.
// Sem "@/" de propósito.
import { COMUNIDADES_DE_EXEMPLO, postsDeExemplo } from "../publicar/exemplos-alumia2";
import type { Post } from "../tipos";
import type { CanalQueSai, ItemQueSai } from "./regras";

const EXEMPLO = /^(exemplo|previa)-[a-z0-9-]{1,60}$/;

function itemDoPost(p: Post): ItemQueSai {
  const c = p.comunidade ? COMUNIDADES_DE_EXEMPLO[p.comunidade] : null;
  return {
    id: p.id,
    tipo: p.tipo,
    titulo: p.titulo,
    texto: p.texto,
    longo: p.longo,
    aviso: p.aviso,
    criado_em: p.criado_em,
    editado_em: p.editado_em,
    comunidade: p.comunidade ? { slug: p.comunidade, nome: c?.nome ?? p.comunidade } : null,
    autor: { codinome: p.autor.codinome, handle: p.autor.handle && !p.autor.handle.includes("@") ? p.autor.handle : null },
  };
}

/** O post de exemplo pelo id (só os ids de exemplo). */
export function exemploDeItem(id: string): ItemQueSai | null {
  if (!EXEMPLO.test(id)) return null;
  const p = postsDeExemplo().find((x) => x.id === id);
  return p ? itemDoPost(p) : null;
}

/** O canal de exemplo de uma comunidade das pranchas (o de perfil, só o da organização com selo das pranchas). */
export function exemploDeCanal(tipo: "perfil" | "comunidade", nome: string): CanalQueSai | null {
  const posts = postsDeExemplo();
  if (tipo === "comunidade") {
    const c = COMUNIDADES_DE_EXEMPLO[nome];
    if (!c) return null;
    return { tipo, nome, titulo: c.nome, descricao: "", itens: posts.filter((p) => p.comunidade === nome).map(itemDoPost) };
  }
  const daOrg = posts.filter((p) => p.org?.handle === nome);
  if (daOrg.length === 0) return null;
  return { tipo, nome, titulo: daOrg[0].autor.codinome, descricao: "", itens: daOrg.map(itemDoPost) };
}
