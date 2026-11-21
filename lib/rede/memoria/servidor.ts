// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor do podcast da comunidade (Prompt 4, item 119), só para as rotas app/api/rede/podcast: ler o feed COMO
// VISITANTE (a chave pública: a porta da entrada vale e, com a trava ligada, a função devolve nulo); achar e buscar o áudio do
// episódio com a chave de serviço, para entregar pela nossa rota (o aplicativo de podcast nunca fala com o depósito). Nenhum
// endereço de quem pede é lido nem guardado, e nada conta quem ouve. Sem "@/" de propósito.
import type { PodcastQueSai } from "./regras";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Chama uma função do banco com a chave pública (como visitante) ou, só no servidor, com a de serviço. */
async function chamarBanco<T>(chave: string, funcao: string, argumentos: Record<string, unknown>): Promise<T | null> {
  if (!SUPA || !chave) return null;
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return ((await r.json().catch(() => null)) as T | null) ?? null;
  } catch {
    return null;
  }
}

/** O feed do podcast como o banco deixa sair (nulo = não existe, não sai, a trava está ligada ou o banco não respondeu). */
export const lerPodcast = (slug: string) => chamarBanco<PodcastQueSai>(CHAVE, "rede_p4_podcast_rss", { p_slug: slug });

/** Onde está o áudio do episódio que sai (nulo fora da regra do RSS). Só com a chave de serviço: o caminho leva o id da conta. */
export const lerAudioDoEpisodio = (slug: string, episodio: string) =>
  chamarBanco<{ bucket: string; caminho: string; tipo: string }>(servico(), "rede_p4_podcast_audio", { p_slug: slug, p_episodio: episodio });

/** O caminho do áudio do post que o banco devolve: <pessoa>/<id>.<ext>, só letras seguras. */
export const caminhoDoAudioOk = (c: string): boolean => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|ogg|mp3|m4a|mp4|aac|wav)$/.test(c);

/** Busca o arquivo no depósito dos posts com a chave de serviço. Nulo quando não há chave, o caminho é estranho ou o depósito falha. */
export async function buscarAudio(bucket: string, caminho: string): Promise<Response | null> {
  const chave = servico();
  if (!SUPA || !chave || bucket !== "rede-midia" || !caminhoDoAudioOk(caminho)) return null;
  try {
    const r = await fetch(`${SUPA}/storage/v1/object/${bucket}/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return r.ok && r.body ? r : null;
  } catch {
    return null;
  }
}
