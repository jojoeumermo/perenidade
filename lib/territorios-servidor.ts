// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o parceiro do instituto mudou na página do território dele (public.territorio_pagina, 20261126-p5-equipe.sql), lido no
// servidor para a página sair já com o texto novo. Sem o serviço configurado (ou fora do ar), fica o texto do site.
import type { Territorio } from "./territorios";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export interface PaginaEditada {
  linha?: string;
  sobre?: string;
  quem?: string;
  instagram?: string;
  temas?: string[];
}

export async function paginaEditada(slug: string): Promise<PaginaEditada | null> {
  if (!url || !key || !/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  try {
    const resposta = await fetch(`${url}/rest/v1/rpc/territorio_pagina`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_territorio: slug }),
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!resposta.ok) return null;
    const lido = (await resposta.json()) as PaginaEditada | null;
    return lido && typeof lido === "object" ? lido : null;
  } catch {
    return null;
  }
}

/** O território com o que o parceiro escreveu por cima; campo vazio fica com o texto do site. */
export function comEdicao(territorio: Territorio, edicao: PaginaEditada | null): Territorio {
  if (!edicao) return territorio;
  const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);
  const temas = Array.isArray(edicao.temas) ? edicao.temas.filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [];
  const instagram = texto(edicao.instagram);
  return {
    ...territorio,
    linha: texto(edicao.linha) ?? territorio.linha,
    sobre: texto(edicao.sobre) ?? territorio.sobre,
    quem: texto(edicao.quem) ?? territorio.quem,
    instagram: instagram && /^[A-Za-z0-9._]{1,30}$/.test(instagram) ? instagram : territorio.instagram,
    temas: temas.length > 0 ? temas : territorio.temas,
  };
}
