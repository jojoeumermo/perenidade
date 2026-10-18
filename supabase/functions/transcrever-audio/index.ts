// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Transcrição automática de um áudio ou vídeo curto mandado pelo painel (as aulas em vídeo, antes do envio). Roda no
// serviço de contas (Edge Function), nunca no navegador: a chave do serviço de Whisper fica só aqui.
//
// O painel manda o arquivo (multipart, campo "arquivo", até 25 MB) com a sessão de quem pediu. A função confere a sessão
// no banco (precisa ser alguém com conta e função) e manda o arquivo ao serviço de Whisper. Devolve o texto em parágrafos
// e as legendas com tempo; quem guarda é o painel, depois de a pessoa revisar.
//
// Segredos (os mesmos de transcrever-podcast): TRANSCRICAO_CHAVE (ou GROQ_API_KEY), TRANSCRICAO_URL, TRANSCRICAO_MODELO.

declare const Deno: { env: { get(nome: string): string | undefined }; serve(tratar: (pedido: Request) => Response | Promise<Response>): void };

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const anonima = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const chave = Deno.env.get("TRANSCRICAO_CHAVE") ?? Deno.env.get("GROQ_API_KEY") ?? "";
const servico = Deno.env.get("TRANSCRICAO_URL") ?? "https://api.groq.com/openai/v1/audio/transcriptions";
const modelo = Deno.env.get("TRANSCRICAO_MODELO") ?? "whisper-large-v3-turbo";
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

  // Só quem tem conta e função no painel: o banco confere a sessão.
  const sessao = pedido.headers.get("Authorization") ?? "";
  const quem = await fetch(`${base}/rest/v1/rpc/eu`, { method: "POST", headers: { apikey: anonima, Authorization: sessao, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!quem?.ok) return responder({ erro: "sem_permissao" }, 403);
  const eu = (await quem.json()) as { papeis?: unknown[] };
  if (!Array.isArray(eu.papeis) || eu.papeis.length === 0) return responder({ erro: "sem_permissao" }, 403);

  let arquivo: File | null = null;
  try {
    const dados = await pedido.formData();
    const campo = dados.get("arquivo");
    if (campo instanceof File) arquivo = campo;
  } catch {
    return responder({ erro: "pedido" }, 400);
  }
  if (!arquivo || arquivo.size === 0) return responder({ erro: "pedido" }, 400);
  if (arquivo.size > LIMITE) return responder({ erro: "grande" });

  const formulario = new FormData();
  formulario.append("file", arquivo, arquivo.name || "aula.webm");
  formulario.append("model", modelo);
  formulario.append("language", "pt");
  formulario.append("response_format", "verbose_json");
  formulario.append("timestamp_granularities[]", "segment");
  formulario.append("temperature", "0");

  const resposta = await fetch(servico, { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: formulario, signal: AbortSignal.timeout(140000) }).catch(() => null);
  if (!resposta?.ok) {
    console.error(`transcrever-audio: o serviço respondeu ${resposta?.status ?? "nada"}`);
    return responder({ erro: resposta?.status === 429 ? "cota" : "servico" });
  }
  const resultado = (await resposta.json()) as { text?: string; segments?: Trecho[] };
  const trechos = (resultado.segments ?? []).filter((t) => t.text?.trim());
  if (!resultado.text && trechos.length === 0) return responder({ erro: "vazio" });

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
