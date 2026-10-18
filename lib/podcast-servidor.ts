// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura do podcast no servidor, para as páginas e o feed. As páginas são refeitas sozinhas a cada poucos minutos;
// sem o serviço configurado (ou com ele fora do ar), tudo volta vazio e a página mostra "em breve".
import type { Catalogo, Episodio } from "./podcast";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function publico<T>(funcao: string, argumentos: Record<string, unknown>, segundos: number): Promise<T | null> {
  if (!url || !key) return null;
  try {
    const resposta = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      next: { revalidate: segundos },
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) return null;
    return (await resposta.json()) as T;
  } catch {
    return null;
  }
}

export const vazio: Catalogo = { config: null, series: [], episodios: [] };

export async function catalogo(): Promise<Catalogo> {
  const lido = await publico<Catalogo>("podcast_catalogo", {}, 300);
  if (!lido || typeof lido !== "object") return vazio;
  return { config: lido.config ?? null, series: Array.isArray(lido.series) ? lido.series : [], episodios: Array.isArray(lido.episodios) ? lido.episodios : [] };
}

export async function episodio(slug: string): Promise<Episodio | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug)) return null;
  return publico<Episodio>("podcast_episodio", { p_slug: slug }, 300);
}

export interface Feed {
  config: {
    nome: string;
    descricao: string;
    autor: string;
    email: string;
    categoria: string;
    subcategoria: string;
    explicito: boolean;
    capa: string;
    links: Record<string, string>;
  } | null;
  episodios: (Omit<Episodio, "convidados"> & { notas: string; tem_legendas: boolean; convidados: string[] })[];
}

export async function feed(): Promise<Feed> {
  const lido = await publico<Feed>("podcast_feed", {}, 900);
  if (!lido || typeof lido !== "object") return { config: null, episodios: [] };
  return { config: lido.config ?? null, episodios: Array.isArray(lido.episodios) ? lido.episodios : [] };
}
