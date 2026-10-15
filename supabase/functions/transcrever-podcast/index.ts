// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Transcrição automática dos episódios do podcast. Roda no serviço de contas (Edge Function), nunca no navegador.
//
// O painel diz "transcreva o episódio tal", com a sessão de quem pediu. A função pergunta ao banco, com essa mesma sessão,
// onde está o áudio (o banco confere se a pessoa pode editar o episódio), baixa o arquivo do depósito público e manda para
// um serviço de Whisper (o modelo de código aberto que transcreve bem em português). Devolve o texto e as legendas com
// tempo; quem guarda no episódio é o painel, depois de a pessoa revisar.
//
// Segredos (Edge Functions → Secrets):
//   TRANSCRICAO_CHAVE   a chave do serviço (na Groq, que tem cota gratuita: console.groq.com → API Keys)
//   TRANSCRICAO_URL     opcional; o padrão é a Groq. Serve qualquer serviço no formato da OpenAI (/v1/audio/transcriptions).
//   TRANSCRICAO_MODELO  opcional; o padrão é whisper-large-v3-turbo (na OpenAI, use whisper-1).
// SUPABASE_URL e SUPABASE_ANON_KEY já vêm prontos. Nenhum segredo aparece em resposta nem em registro.

declare const Deno: { env: { get(nome: string): string | undefined }; serve(tratar: (pedido: Request) => Response | Promise<Response>): void };

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const anonima = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const chave = Deno.env.get("TRANSCRICAO_CHAVE") ?? Deno.env.get("GROQ_API_KEY") ?? "";
const servico = Deno.env.get("TRANSCRICAO_URL") ?? "https://api.groq.com/openai/v1/audio/transcriptions";
const modelo = Deno.env.get("TRANSCRICAO_MODELO") ?? "whisper-large-v3-turbo";
// O limite de envio dos serviços com cota gratuita (Groq: 25 MB no plano gratuito).
const LIMITE = 25 * 1024 * 1024;

const cabecalhos = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, "Content-Type": "application/json" } });

interface Trecho {
  start: number;
  end: number;
  text: string;
}

const tempo = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};

Deno.serve(async (pedido) => {
  if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos });
  if (pedido.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (!base || !anonima) return responder({ erro: "servico" });
  if (!chave) return responder({ erro: "desligada" });

  const sessao = pedido.headers.get("Authorization") ?? "";
  let episodio: unknown;
  try {
    ({ episodio } = (await pedido.json()) as { episodio?: unknown });
  } catch {
    return responder({ erro: "pedido" }, 400);
  }
  if (typeof episodio !== "string" || !/^[0-9a-f-]{36}$/.test(episodio)) return responder({ erro: "pedido" }, 400);

  // O banco confere, com a sessão de quem pediu, se a pessoa pode editar o episódio, e diz onde está o áudio.
  const consulta = await fetch(`${base}/rest/v1/rpc/podcast_para_transcrever`, {
    method: "POST",
    headers: { apikey: anonima, Authorization: sessao, "Content-Type": "application/json" },
    body: JSON.stringify({ p_id: episodio }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!consulta?.ok) return responder({ erro: "sem_permissao" }, 403);
  const audio = (await consulta.json()) as { audio?: string; bytes?: number; tipo?: string };
  if (!audio.audio) return responder({ erro: "sem_audio" });
  if ((audio.bytes ?? 0) > LIMITE) return responder({ erro: "grande" });

  const arquivo = await fetch(`${base}/storage/v1/object/public/podcast/${audio.audio.split("/").map(encodeURIComponent).join("/")}`, { signal: AbortSignal.timeout(60000) }).catch(() => null);
  if (!arquivo?.ok) return responder({ erro: "leitura" });
  const bytes = await arquivo.blob();
  if (bytes.size > LIMITE) return responder({ erro: "grande" });

  const formulario = new FormData();
  formulario.append("file", new File([bytes], audio.audio.split("/").pop() ?? "episodio.mp3", { type: audio.tipo || "audio/mpeg" }));
  formulario.append("model", modelo);
  formulario.append("language", "pt");
  formulario.append("response_format", "verbose_json");
  formulario.append("timestamp_granularities[]", "segment");
  formulario.append("temperature", "0");

  const resposta = await fetch(servico, { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: formulario, signal: AbortSignal.timeout(140000) }).catch(() => null);
  if (!resposta?.ok) {
    console.error(`transcrever-podcast: o serviço respondeu ${resposta?.status ?? "nada"}`);
    return responder({ erro: resposta?.status === 429 ? "cota" : "servico" });
  }
  const resultado = (await resposta.json()) as { text?: string; segments?: Trecho[] };
  const trechos = (resultado.segments ?? []).filter((t) => t.text?.trim());
  if (!resultado.text && trechos.length === 0) return responder({ erro: "vazio" });

  // Texto corrido: um parágrafo a cada pausa maior que dois segundos (ou a cada uns 40 segundos de fala).
  const paragrafos: string[] = [];
  let atual = "";
  let inicio = 0;
  trechos.forEach((t, i) => {
    if (!atual) inicio = t.start;
    atual += `${atual ? " " : ""}${t.text.trim()}`;
    const proximo = trechos[i + 1];
    if (!proximo || proximo.start - t.end > 2 || t.end - inicio > 40) {
      paragrafos.push(atual);
      atual = "";
    }
  });
  const vtt = trechos.length ? ["WEBVTT", "", ...trechos.map((t) => `${tempo(t.start)} --> ${tempo(t.end)}\n${t.text.trim()}\n`)].join("\n") : "";
  return responder({ texto: paragrafos.length ? paragrafos.join("\n\n") : (resultado.text ?? "").trim(), vtt });
});
