// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os endereços antigos do Fórum e da Rede de hoje (?t=<tópico>, ?sala=<disciplina>, ?post=<post>) e para onde vão com a v2 ligada
// (ESPEC, seção 6, item 6). A lógica pura fica aqui (roda no Node nos testes); quem consulta o banco e responde 301 é o proxy.ts.
// Sem os atalhos "@/" de propósito.
import { enderecos, idOk, slugOk, type EnderecoAntigo } from "./tipos";

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];

export interface PedidoAntigo {
  lang: string;
  /** "topico" e "sala" precisam do mapa do banco (rede_antigo); "post" não (o id da Rede de hoje continua o mesmo). */
  tipo: "topico" | "sala" | "post";
  antigo: string;
}

/** O pedido antigo contido no endereço da linha (/<idioma>/comunidade?t=…), ou nulo se o endereço não é de um. */
export function pedidoAntigo(pathname: string, search: string): PedidoAntigo | null {
  const m = /^\/([a-z]{2})\/comunidade\/?$/.exec(pathname);
  if (!m || !IDIOMAS.includes(m[1])) return null;
  const q = new URLSearchParams(search);
  const t = q.get("t");
  const sala = q.get("sala");
  const post = q.get("post");
  if (t && idOk(t)) return { lang: m[1], tipo: "topico", antigo: t };
  if (post && idOk(post)) return { lang: m[1], tipo: "post", antigo: post };
  if (sala && (slugOk(sala) || /^fechado-[a-z0-9-]{2,50}$/.test(sala))) return { lang: m[1], tipo: "sala", antigo: sala };
  return null;
}

/** O endereço novo (sem domínio) para uma resposta do banco, ou nulo quando não há par e o endereço antigo deve seguir como está. */
export function destinoNovo(lang: string, r: EnderecoAntigo | null): string | null {
  if (!r) return null;
  if (r.tipo === "post" && idOk(r.novo)) return enderecos.post(lang, r.novo);
  if (r.tipo === "comunidade" && (slugOk(r.novo) || /^fechado-[a-z0-9-]{2,50}$/.test(r.novo))) return enderecos.comunidade(lang, r.novo);
  return null;
}

/** O destino de um pedido que não precisa do banco (?post=: o id da Rede de hoje é o mesmo na v2). */
export function destinoDireto(p: PedidoAntigo): string | null {
  return p.tipo === "post" ? enderecos.post(p.lang, p.antigo) : null;
}
