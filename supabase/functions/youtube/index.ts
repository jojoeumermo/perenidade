// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O canal do instituto no YouTube, falado só daqui (Edge Function). A autorização do canal fica nos segredos do serviço:
// ninguém da equipe recebe senha nem acesso ao canal. O painel chama esta função com a sessão de quem pediu, e o banco
// confere se a pessoa pode (youtube_pode_enviar, youtube_transmissao_pode).
//
// Pedidos (POST, JSON):
//   { "acao": "situacao" }               → { ligado }: se os segredos do canal estão postos.
//   { "acao": "enviar", "id": "<uuid>" } → manda uma aula em vídeo aprovada ao canal (não listada, por padrão), com a
//                                          descrição, o crédito, as fontes, o link da aula no site e as legendas.
//   { "acao": "liberar", "id": "<uuid>" } → confere de novo uma aula que o Google deixou privada ("travado": vídeos
//                                          enviados pela API de um projeto sem auditoria do Google ficam privados) e,
//                                          se o projeto já passou na auditoria, deixa o vídeo como não listado.
//   { "acao": "transmissao", "aula": "<uuid>" } → cria (uma vez) a transmissão da aula ao vivo no canal e devolve o
//                                          endereço do servidor e a chave, só para quem conduz a aula. A transmissão
//                                          começa sozinha quando o programa de transmissão (OBS, Larix, StreamYard)
//                                          começa a mandar imagem, e termina sozinha quando ele para.
//   { "acao": "encerrar", "aula": "<uuid>" } → encerra a transmissão no canal, se ela não terminou sozinha.
//
// Segredos: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e YOUTUBE_REFRESH_TOKEN (a autorização do canal, gerada uma vez pela
// conta do instituto: veja docs/YOUTUBE.md); YOUTUBE_PRIVACIDADE ("unlisted", o padrão, "public" ou "private");
// SITE_URL (o endereço do site, para o link na descrição). SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY o
// serviço já põe sozinho.

declare const Deno: { env: { get(nome: string): string | undefined }; serve(tratar: (pedido: Request) => Response | Promise<Response>): void };

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const anonima = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cliente = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
const segredo = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";
const renovacao = Deno.env.get("YOUTUBE_REFRESH_TOKEN") ?? "";
const privacidade = ["unlisted", "public", "private"].includes(Deno.env.get("YOUTUBE_PRIVACIDADE") ?? "") ? Deno.env.get("YOUTUBE_PRIVACIDADE")! : "unlisted";
const site = (Deno.env.get("SITE_URL") ?? "https://institutolucia.org").replace(/\/$/, "");
const ligado = Boolean(cliente && segredo && renovacao);

const cabecalhos = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, "Content-Type": "application/json" } });

class Falha extends Error {}

/** Chama uma função do banco: com a sessão de quem pediu (para conferir permissão) ou com a chave do serviço. */
async function banco<T>(funcao: string, args: Record<string, unknown>, sessao?: string): Promise<T> {
  const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: sessao ? anonima : servico, Authorization: sessao ?? `Bearer ${servico}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Falha(`banco:${funcao}:${r.status}`);
  return (await r.json()) as T;
}

/** A licença de acesso de uma hora ao canal, trocada pela autorização guardada. */
async function acesso(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cliente, client_secret: segredo, refresh_token: renovacao, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(10000),
  });
  const dados = (await r.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!r.ok || !dados.access_token) throw new Falha(`autorizacao:${dados.error ?? r.status}`);
  return dados.access_token;
}

/** Chamada à API do YouTube; devolve o JSON ou explica o erro em poucas palavras. */
async function youtube<T>(token: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${caminho}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20000),
  });
  const dados = (await r.json().catch(() => ({}))) as T & { error?: { errors?: { reason?: string }[]; message?: string } };
  if (!r.ok) throw new Falha(`youtube:${dados.error?.errors?.[0]?.reason ?? r.status}`);
  return dados;
}

// O YouTube não aceita "<" nem ">" no título e na descrição; o título tem até 100 caracteres e a descrição até 5 mil bytes.
const limpo = (texto: string) => texto.replace(/[<>]/g, "").trim();
const cortar = (texto: string, bytes: number) => {
  let t = texto;
  while (new TextEncoder().encode(t).length > bytes) t = t.slice(0, -20);
  return t;
};

interface Videoaula {
  id: string;
  titulo: string;
  descricao: string;
  nome_autor: string;
  disciplina: string;
  caminho: string;
  tipo: string;
  tamanho: number;
  legenda: string;
  fontes: { titulo: string; autor?: string; url?: string }[];
  youtube: string | null;
}

async function enviar(id: string, sessao: string) {
  if (!(await banco<boolean>("youtube_pode_enviar", { p_id: id }, sessao))) return responder({ erro: "sem_permissao" }, 403);
  const aula = await banco<Videoaula | null>("youtube_videoaula_dados", { p_id: id });
  if (!aula) return responder({ erro: "nao_encontrado" }, 404);
  if (aula.youtube) return responder({ youtube: aula.youtube });
  const vez = await banco<{ ok: boolean }>("youtube_videoaula_marcar", { p_id: id, p_situacao: "enviando" });
  if (!vez.ok) return responder({ erro: "ocupado" });

  try {
    // O arquivo sai do depósito fechado direto para o YouTube (até 50 MB).
    const arquivo = await fetch(`${base}/storage/v1/object/videoaulas/${aula.caminho}`, { headers: { apikey: servico, Authorization: `Bearer ${servico}` }, signal: AbortSignal.timeout(60000) });
    if (!arquivo.ok) throw new Falha(`arquivo:${arquivo.status}`);
    const bytes = new Uint8Array(await arquivo.arrayBuffer());

    const fontes = (aula.fontes ?? []).map((f) => `- ${f.autor ? `${f.autor}. ` : ""}${f.titulo}${f.url ? ` ${f.url}` : ""}`).join("\n");
    const descricao = cortar(
      limpo(
        [
          aula.descricao,
          `Aula do Instituto Lúcia, com ${aula.nome_autor || "a equipe de educação"}.`,
          `Transcrição, legendas e mais aulas: ${site}/pt/videoaulas?v=${aula.id}`,
          fontes ? `Fontes:\n${fontes}` : "",
          "Educação popular, gratuita e livre. Texto e imagem sob CC BY-SA 4.0, com crédito ao Instituto Lúcia.",
          "@institutoluciaorg",
        ]
          .filter(Boolean)
          .join("\n\n"),
      ),
      4900,
    );

    const token = await acesso();
    const inicio = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.length),
        "X-Upload-Content-Type": aula.tipo,
      },
      body: JSON.stringify({
        snippet: { title: limpo(aula.titulo).slice(0, 100), description: descricao, categoryId: "27", defaultLanguage: "pt-BR", defaultAudioLanguage: "pt-BR", tags: ["Instituto Lúcia", "educação popular", aula.disciplina] },
        status: { privacyStatus: privacidade, selfDeclaredMadeForKids: false, embeddable: true },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const endereco = inicio.headers.get("Location");
    if (!inicio.ok || !endereco) throw new Falha(`youtube:inicio:${inicio.status}`);
    const envio = await fetch(endereco, { method: "PUT", headers: { "Content-Type": aula.tipo }, body: bytes, signal: AbortSignal.timeout(120000) });
    const video = (await envio.json().catch(() => ({}))) as { id?: string; status?: { privacyStatus?: string } };
    if (!envio.ok || !video.id) throw new Falha(`youtube:envio:${envio.status}`);

    // As legendas revisadas vão junto (se falharem, o vídeo fica no ar do mesmo jeito).
    if (aula.legenda.trim()) {
      const fronteira = `lucia${crypto.randomUUID()}`;
      const corpo = [
        `--${fronteira}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify({ snippet: { videoId: video.id, language: "pt-BR", name: "Português", isDraft: false } }),
        `--${fronteira}`,
        "Content-Type: text/vtt; charset=UTF-8",
        "",
        aula.legenda,
        `--${fronteira}--`,
        "",
      ].join("\r\n");
      await fetch("https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${fronteira}` },
        body: corpo,
        signal: AbortSignal.timeout(20000),
      }).catch(() => null);
    }

    // Pedimos "não listado"; se voltou "privado", o Google travou o vídeo até a auditoria do projeto.
    const travado = (video.status?.privacyStatus ?? privacidade) !== privacidade;
    await banco("youtube_videoaula_marcar", { p_id: id, p_situacao: travado ? "travado" : "no_ar", p_youtube: video.id });
    return responder({ youtube: video.id, travado });
  } catch (erro) {
    const motivo = erro instanceof Falha ? erro.message : "servico";
    console.error(`youtube: envio da aula ${id} falhou (${motivo})`);
    await banco("youtube_videoaula_marcar", { p_id: id, p_situacao: "erro", p_erro: motivo }).catch(() => null);
    return responder({ erro: motivo.startsWith("youtube:quotaExceeded") ? "cota" : "servico", motivo });
  }
}

/** Tenta deixar o vídeo com a privacidade pedida e confere como ficou. */
async function liberar(id: string, sessao: string) {
  if (!(await banco<boolean>("youtube_pode_enviar", { p_id: id }, sessao))) return responder({ erro: "sem_permissao" }, 403);
  const aula = await banco<Videoaula | null>("youtube_videoaula_dados", { p_id: id });
  if (!aula?.youtube) return responder({ erro: "nao_encontrado" }, 404);
  const token = await acesso();
  const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: aula.youtube, status: { privacyStatus: privacidade, selfDeclaredMadeForKids: false, embeddable: true } }),
    signal: AbortSignal.timeout(20000),
  });
  const video = (await r.json().catch(() => ({}))) as { status?: { privacyStatus?: string } };
  const travado = !r.ok || video.status?.privacyStatus !== privacidade;
  await banco("youtube_videoaula_marcar", { p_id: id, p_situacao: travado ? "travado" : "no_ar", p_youtube: aula.youtube });
  return responder({ youtube: aula.youtube, travado });
}

interface Aula {
  id: string;
  titulo: string;
  descricao: string;
  inicio: string;
  status: string;
  educador: string;
  youtube: string | null;
  rtmp: string | null;
  chave: string | null;
}

async function transmissao(id: string, sessao: string) {
  if (!(await banco<boolean>("youtube_transmissao_pode", { p_aula: id }, sessao))) return responder({ erro: "sem_permissao" }, 403);
  const aula = await banco<Aula | null>("youtube_transmissao_dados", { p_aula: id });
  if (!aula) return responder({ erro: "nao_encontrado" }, 404);
  if (aula.youtube && aula.rtmp && aula.chave) return responder({ youtube: aula.youtube, rtmp: aula.rtmp, chave: aula.chave });

  const token = await acesso();
  const inicio = new Date(Math.max(Date.parse(aula.inicio), Date.now() + 60000)).toISOString();
  const transmissao = await youtube<{ id: string }>(token, "liveBroadcasts?part=snippet,status,contentDetails", {
    snippet: {
      title: limpo(aula.titulo).slice(0, 100),
      description: cortar(limpo(`${aula.descricao}\n\nAula ao vivo do Instituto Lúcia, com ${aula.educador || "a equipe de educação"}.\nAgenda e bate-papo: ${site}/pt/ao-vivo\n\n@institutoluciaorg`), 4900),
      scheduledStartTime: inicio,
    },
    status: { privacyStatus: privacidade, selfDeclaredMadeForKids: false },
    contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true, recordFromStart: true, enableEmbed: true, latencyPreference: "low" },
  });
  const fluxo = await youtube<{ id: string; cdn: { ingestionInfo: { ingestionAddress: string; streamName: string } } }>(token, "liveStreams?part=snippet,cdn,contentDetails", {
    snippet: { title: `Aula ${aula.id.slice(0, 8)}` },
    cdn: { ingestionType: "rtmp", resolution: "variable", frameRate: "variable" },
    contentDetails: { isReusable: false },
  });
  await youtube(token, `liveBroadcasts/bind?id=${transmissao.id}&streamId=${fluxo.id}&part=id,contentDetails`);
  const { ingestionAddress: rtmp, streamName: chave } = fluxo.cdn.ingestionInfo;
  await banco("youtube_transmissao_gravar", { p_aula: id, p_broadcast: transmissao.id, p_stream: fluxo.id, p_rtmp: rtmp, p_chave: chave });
  return responder({ youtube: transmissao.id, rtmp, chave });
}

async function encerrar(id: string, sessao: string) {
  if (!(await banco<boolean>("youtube_transmissao_pode", { p_aula: id }, sessao))) return responder({ erro: "sem_permissao" }, 403);
  const aula = await banco<Aula | null>("youtube_transmissao_dados", { p_aula: id });
  if (!aula?.youtube) return responder({ ok: true });
  const token = await acesso();
  // Se a transmissão já terminou sozinha, o YouTube recusa a troca; para o site, tanto faz.
  await youtube(token, `liveBroadcasts/transition?broadcastStatus=complete&id=${aula.youtube}&part=status`).catch(() => null);
  return responder({ ok: true });
}

const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x);

Deno.serve(async (pedido) => {
  if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos });
  if (pedido.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (!base || !anonima || !servico) return responder({ erro: "servico" });
  const corpo = (await pedido.json().catch(() => ({}))) as { acao?: string; id?: unknown; aula?: unknown };
  if (corpo.acao === "situacao") return responder({ ligado });
  if (!ligado) return responder({ erro: "desligado" });
  const sessao = pedido.headers.get("Authorization") ?? "";
  if (!sessao.startsWith("Bearer ")) return responder({ erro: "sem_permissao" }, 403);
  try {
    if (corpo.acao === "enviar" && uuid(corpo.id)) return await enviar(corpo.id, sessao);
    if (corpo.acao === "liberar" && uuid(corpo.id)) return await liberar(corpo.id, sessao);
    if (corpo.acao === "transmissao" && uuid(corpo.aula)) return await transmissao(corpo.aula, sessao);
    if (corpo.acao === "encerrar" && uuid(corpo.aula)) return await encerrar(corpo.aula, sessao);
    return responder({ erro: "pedido" }, 400);
  } catch (erro) {
    const motivo = erro instanceof Falha ? erro.message : "servico";
    console.error(`youtube: ${corpo.acao} falhou (${motivo})`);
    return responder({ erro: motivo.includes("liveStreamingNotEnabled") ? "lives_desligadas" : motivo.includes("quotaExceeded") ? "cota" : "servico", motivo });
  }
});
