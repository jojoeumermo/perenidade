// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Publicação no Instagram pela API oficial (Instagram Graph API, da Meta), só no servidor. Precisa de uma conta
// profissional do Instagram ligada a uma página do Facebook e de duas chaves na Vercel: INSTAGRAM_USER_ID (o número
// da conta) e INSTAGRAM_TOKEN (o token de acesso de longa duração). Sem elas, o estúdio avisa e ninguém publica.
// O passo a passo está em docs/ESTUDIO-INSTAGRAM.md. Só as rotas do servidor importam este arquivo (a chave nunca vai
// para o navegador).

const GRAPH = "https://graph.facebook.com/v21.0";
const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const instagramConfigurado = () => Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_TOKEN);
/** A agenda só funciona com a chave da tarefa automática (CRON_SECRET), a mesma guardada no banco. */
export const agendaConfigurada = () => Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 24);

/** As imagens só podem vir do depósito público de publicações do próprio banco do instituto. */
export const urlDePublicacao = (url: string) => {
  const pasta = `${supabase}/storage/v1/object/public/estudio-publicacoes/`;
  // Sem "..", "//" nem nada fora de letras, números, "-", "_" e "/": o endereço não sai do depósito de publicações.
  return Boolean(supabase) && url.startsWith(pasta) && /^[\w-]+(\/[\w-]+)*\.jpg$/.test(url.slice(pasta.length));
};

/** Chama uma função do banco como a pessoa (com o token da sessão dela) ou, sem token, como visitante. */
export async function rpcNoBanco<T>(funcao: string, argumentos: Record<string, unknown>, tokenDaPessoa?: string): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  if (!supabase || !anon) return { ok: false, erro: "banco_nao_configurado" };
  try {
    const resposta = await fetch(`${supabase}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${tokenDaPessoa ?? anon}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const corpo = (await resposta.json().catch(() => null)) as T & { message?: string };
    if (!resposta.ok) return { ok: false, erro: String(corpo?.message ?? resposta.status) };
    return { ok: true, dados: corpo };
  } catch {
    return { ok: false, erro: "banco_fora_do_ar" };
  }
}

async function graph<T>(caminho: string, parametros: Record<string, string>, metodo: "GET" | "POST" = "POST"): Promise<T> {
  const corpo = new URLSearchParams({ ...parametros, access_token: process.env.INSTAGRAM_TOKEN ?? "" });
  const url = metodo === "GET" ? `${GRAPH}/${caminho}?${corpo}` : `${GRAPH}/${caminho}`;
  const resposta = await fetch(url, { method: metodo, body: metodo === "POST" ? corpo : undefined, cache: "no-store", signal: AbortSignal.timeout(30000) });
  const dados = (await resposta.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!resposta.ok || dados.error) throw new Error(dados.error?.message?.slice(0, 300) || `instagram_${resposta.status}`);
  return dados;
}

/** Espera o conteiner de mídia ficar pronto no Instagram (imagens costumam ficar em segundos). */
async function esperarPronto(id: string) {
  for (let i = 0; i < 15; i++) {
    const r = await graph<{ status_code?: string }>(id, { fields: "status_code" }, "GET");
    if (r.status_code === "FINISHED" || !r.status_code) return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") throw new Error(`instagram_${r.status_code.toLowerCase()}`);
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error("instagram_demorou");
}

/** Publica uma imagem ou um carrossel (até 10) com a legenda. Devolve o número do post. */
export async function publicarNoInstagram(urls: string[], legenda: string): Promise<string> {
  const conta = process.env.INSTAGRAM_USER_ID;
  if (!conta || !process.env.INSTAGRAM_TOKEN) throw new Error("instagram_nao_configurado");
  let conteiner: string;
  if (urls.length === 1) {
    conteiner = (await graph<{ id: string }>(`${conta}/media`, { image_url: urls[0], caption: legenda })).id;
  } else {
    const filhos: string[] = [];
    for (const url of urls) filhos.push((await graph<{ id: string }>(`${conta}/media`, { image_url: url, is_carousel_item: "true" })).id);
    for (const filho of filhos) await esperarPronto(filho);
    conteiner = (await graph<{ id: string }>(`${conta}/media`, { media_type: "CAROUSEL", children: filhos.join(","), caption: legenda })).id;
  }
  await esperarPronto(conteiner);
  return (await graph<{ id: string }>(`${conta}/media_publish`, { creation_id: conteiner })).id;
}
