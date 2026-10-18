// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os provedores que o assistente de reforço sabe chamar, na ordem que a coordenação escolhe no painel, com reserva
// automática: se um falhar (cota do dia, fora do ar, chave recusada), a pergunta vai ao próximo. O Claude (Anthropic) é
// pago por pergunta; Groq, Cerebras, Gemini e OpenRouter têm plano gratuito com limites e falam o formato aberto de chat
// (o mesmo da OpenAI). As chaves moram só nos segredos da função; nada aqui as guarda, registra ou devolve.
// Sem rede e sem Deno de propósito: quem chama passa o fetch, e scripts/testar-assistente.mjs prova tudo sem chave.
import { type Entrada, LIMITES, type Lido, lerResposta, MODELO_PADRAO, SISTEMA, textoDaMensagem } from "./assistente.ts";

export interface Provedor {
  id: string;
  nome: string;
  /** Endereço do chat no formato aberto; o Claude usa o SDK próprio e não tem. */
  url?: string;
  /** O segredo da função com a chave, e o (opcional) com o modelo. */
  segredo: string;
  segredoModelo: string;
  modeloPadrao: string;
  /** Entende foto (a "foto do exercício")? Quem não entende é pulado nas perguntas com imagem. */
  visao: boolean;
  plano: string;
}

export const PROVEDORES: Provedor[] = [
  { id: "anthropic", nome: "Claude (Anthropic)", segredo: "ANTHROPIC_API_KEY", segredoModelo: "ASSISTENTE_MODELO", modeloPadrao: MODELO_PADRAO, visao: true, plano: "pago por pergunta" },
  { id: "groq", nome: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", segredo: "GROQ_API_KEY", segredoModelo: "GROQ_MODELO", modeloPadrao: "llama-3.3-70b-versatile", visao: false, plano: "plano gratuito com limite por minuto e por dia" },
  { id: "cerebras", nome: "Cerebras", url: "https://api.cerebras.ai/v1/chat/completions", segredo: "CEREBRAS_API_KEY", segredoModelo: "CEREBRAS_MODELO", modeloPadrao: "llama-3.3-70b", visao: false, plano: "plano gratuito com limite diário" },
  { id: "gemini", nome: "Gemini (Google)", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", segredo: "GEMINI_API_KEY", segredoModelo: "GEMINI_MODELO", modeloPadrao: "gemini-2.5-flash", visao: true, plano: "plano gratuito com limite por minuto e por dia" },
  { id: "openrouter", nome: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", segredo: "OPENROUTER_API_KEY", segredoModelo: "OPENROUTER_MODELO", modeloPadrao: "meta-llama/llama-3.3-70b-instruct:free", visao: false, plano: "modelos marcados com :free" },
];
export const IDS = PROVEDORES.map((p) => p.id);
const porId = (id: string) => PROVEDORES.find((p) => p.id === id);

/** O modelo do segredo, se tiver cara de nome de modelo; senão, o padrão do provedor. */
export function modeloDe(provedor: Provedor, valor: unknown): string {
  if (provedor.id === "anthropic") return typeof valor === "string" && /^claude-[a-z0-9.-]{2,60}$/.test(valor.trim()) ? valor.trim() : provedor.modeloPadrao;
  return typeof valor === "string" && /^[A-Za-z0-9._:/-]{2,100}$/.test(valor.trim()) ? valor.trim() : provedor.modeloPadrao;
}

const PEDIDO_JSON = `Responda somente com um objeto JSON com as chaves "transcricao", "conta" e "explicacao" (todas texto), sem nada antes ou depois.`;

/** O pedido no formato aberto de chat: o mesmo sistema e a mesma mensagem que o Claude recebe. */
export function pedidoAberto(entrada: Entrada, modelo: string, visao: boolean) {
  const texto = textoDaMensagem(entrada) + (entrada.modo === "foto" ? `\n\n${PEDIDO_JSON}` : "");
  const conteudo = entrada.imagem && visao ? [{ type: "text", text: texto }, { type: "image_url", image_url: { url: `data:${entrada.imagem.tipo};base64,${entrada.imagem.dados}` } }] : texto;
  return {
    model: modelo,
    messages: [{ role: "system", content: SISTEMA }, { role: "user", content: conteudo }],
    max_tokens: 4096,
    temperature: 0.3,
    ...(entrada.modo === "foto" ? { response_format: { type: "json_object" } } : {}),
  };
}

/** Lê a resposta no formato aberto com as mesmas regras da do Claude (corte, recusa, campos da foto). */
export function lerRespostaAberta(dado: unknown, modo: Entrada["modo"]): Lido {
  const escolha = (dado as { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] } | null)?.choices?.[0];
  if (!escolha) return { erro: "resposta_invalida" };
  const motivo = String(escolha.finish_reason ?? "");
  const texto = typeof escolha.message?.content === "string" ? escolha.message.content.replace(/^```(?:json)?\s*|\s*```$/g, "") : "";
  return lerResposta({ stop_reason: motivo === "length" ? "max_tokens" : motivo === "content_filter" ? "refusal" : "end_turn", content: texto ? [{ type: "text", text: texto, citations: null }] : [] } as never, modo);
}

/** Dá nome à falha pelo código HTTP (nunca pelo texto que o serviço devolve). */
export function falhaHttp(status: number): string {
  if (status === 401 || status === 403) return "chave_recusada";
  if (status === 429) return "limite";
  if (status === 400 || status === 404 || status === 422) return "pedido_recusado";
  if (status >= 500) return "indisponivel";
  return "desconhecida";
}

export class FalhaDoProvedor extends Error {
  falha: string;
  constructor(falha: string) {
    super(falha);
    this.falha = falha;
  }
}

type Buscar = (url: string, opcoes: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

async function chamarAberto(provedor: Provedor, chave: string, corpo: unknown, buscar: Buscar, prazo: number): Promise<unknown> {
  let resposta;
  try {
    resposta = await buscar(provedor.url!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        ...(provedor.id === "openrouter" ? { "HTTP-Referer": "https://institutolucia.org", "X-Title": "Instituto Lucia" } : {}),
      },
      body: JSON.stringify(corpo),
      signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(prazo) : undefined,
    });
  } catch (erro) {
    throw new FalhaDoProvedor((erro as { name?: string })?.name === "TimeoutError" || (erro as { name?: string })?.name === "AbortError" ? "tempo_esgotado" : "sem_conexao");
  }
  if (!resposta.ok) throw new FalhaDoProvedor(falhaHttp(resposta.status));
  return resposta.json().catch(() => null);
}

export interface Tentativa {
  id: string;
  falha: string;
}

/**
 * Pergunta aos provedores na ordem: o primeiro que responder de verdade fica com a pergunta. Sem chave, sem foto (quando a
 * pergunta tem foto) ou com falha, passa ao próximo. Recusa é resposta (não se tenta outro para contornar o filtro).
 * `claude` é quem chama o SDK do Claude (só em index.ts).
 */
export async function perguntar(o: {
  ordem: string[];
  chaves: Record<string, string | undefined>;
  modelos: Record<string, string>;
  entrada: Entrada;
  buscar: Buscar;
  claude: (entrada: Entrada, modelo: string) => Promise<Lido>;
  prazo?: number;
}): Promise<{ lido: Lido; provedor: string; tentativas: Tentativa[] }> {
  const tentativas: Tentativa[] = [];
  for (const id of o.ordem) {
    const p = porId(id);
    if (!p) continue;
    if (o.entrada.imagem && !p.visao) {
      tentativas.push({ id, falha: "sem_visao" });
      continue;
    }
    const chave = o.chaves[id];
    if (!chave) {
      tentativas.push({ id, falha: "sem_chave" });
      continue;
    }
    try {
      const lido = id === "anthropic" ? await o.claude(o.entrada, o.modelos[id] ?? p.modeloPadrao) : lerRespostaAberta(await chamarAberto(p, chave, pedidoAberto(o.entrada, o.modelos[id] ?? p.modeloPadrao, p.visao), o.buscar, o.prazo ?? 60_000), o.entrada.modo);
      if ("erro" in lido) {
        tentativas.push({ id, falha: lido.erro });
        continue;
      }
      return { lido, provedor: id, tentativas };
    } catch (erro) {
      tentativas.push({ id, falha: erro instanceof FalhaDoProvedor ? erro.falha : "desconhecida" });
    }
  }
  const ultima = [...tentativas].reverse().find((t) => t.falha !== "sem_chave" && t.falha !== "sem_visao");
  return { lido: { erro: ultima?.falha ?? (tentativas.length ? "sem_chave" : "sem_provedor") }, provedor: "", tentativas };
}

/** O teste do painel: para cada provedor, se a chave está cadastrada e se ele responde a uma pergunta curta e inofensiva. */
export async function verificar(o: {
  ids: string[];
  chaves: Record<string, string | undefined>;
  modelos: Record<string, string>;
  buscar: Buscar;
  claudeTeste: (modelo: string) => Promise<string>;
}): Promise<{ id: string; chave: boolean; ok: boolean; falha: string; modelo: string }[]> {
  const resultados = [];
  for (const id of o.ids) {
    const p = porId(id);
    if (!p) continue;
    const modelo = o.modelos[id] ?? p.modeloPadrao;
    const chave = o.chaves[id];
    if (!chave) {
      resultados.push({ id, chave: false, ok: false, falha: "sem_chave", modelo });
      continue;
    }
    let falha = "";
    try {
      if (id === "anthropic") falha = await o.claudeTeste(modelo);
      else {
        const lido = lerRespostaAberta(await chamarAberto(p, chave, { model: modelo, messages: [{ role: "system", content: "Responda apenas com a palavra: ok." }, { role: "user", content: "Teste de funcionamento do assistente do Instituto Lúcia." }], max_tokens: 20 }, o.buscar, 30_000), "pergunta");
        falha = "erro" in lido ? lido.erro : "recusa" in lido ? "recusa" : "";
      }
    } catch (erro) {
      falha = erro instanceof FalhaDoProvedor ? erro.falha : "desconhecida";
    }
    resultados.push({ id, chave: true, ok: !falha, falha, modelo });
  }
  return resultados;
}

export { LIMITES };
