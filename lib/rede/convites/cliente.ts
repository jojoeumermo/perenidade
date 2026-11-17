// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da porta de entrada da Alumia (app/api/alumia/porta/*): pede o desafio, resolve no aparelho (Web Crypto,
// lib/rede/convites/prova-aparelho.ts) e manda a resposta junto da conta nova, antes do pedido de entrada, junto do e-mail e da
// senha para entrar, e antes de pedir um e-mail (a confirmação de novo, o link de senha nova). A entrada do site (components/
// SignIn.tsx) usa o mesmo caminho. Com o desafio da Cloudflare ligado (components/Captcha.tsx), a resposta dele vai junto
// (`turnstile`) e o servidor a confere. E o convite que a pessoa abriu neste aparelho, guardado aqui por até 7 dias, até o pedido
// sair (depois some).
import { captchaKey, getClient, hasBackend, hasSession } from "@/lib/backend";
import type { MomentoDaPorta } from "./prova";
import { resolverDesafio } from "./prova-aparelho";

/** Por que a porta não abriu (o que a tela explica). */
export type MotivoDaPorta =
  | "muitos_pedidos" | "porta_cheia" | "rede_barrada" | "desafio_vencido" | "email_nao_confirmado" | "cadastro_fechado" | "senha_fraca"
  | "sem_servico" | "captcha" | "falha";

const MOTIVOS: readonly MotivoDaPorta[] = ["muitos_pedidos", "porta_cheia", "rede_barrada", "desafio_vencido", "email_nao_confirmado", "cadastro_fechado", "senha_fraca", "sem_servico", "captcha", "falha"];

/** Com o desafio da Cloudflare ligado, sem a resposta dele nada sai (o servidor recusaria). */
const faltaODesafio = (turnstile: string | undefined): boolean => Boolean(captchaKey) && !turnstile;
const motivoDe = (m: unknown): MotivoDaPorta => ((MOTIVOS as readonly unknown[]).includes(m) ? (m as MotivoDaPorta) : "falha");

/** Avanço da prova, para a tela: quantas tentativas já foram e quantas se espera em média. */
export type AoAvancar = (feitas: number, esperadas: number) => void;

interface Desafio {
  desafio: string;
  dificuldade: number;
}

async function postar(caminho: string, corpo: unknown, token?: string): Promise<{ status: number; dado: Record<string, unknown> | null }> {
  const r = await fetch(caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return { status: r.status, dado: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

/** Pede o desafio e resolve no aparelho. */
async function provar(momento: MomentoDaPorta, aoAvancar?: AoAvancar, sinal?: AbortSignal): Promise<{ desafio: string; resposta: string } | { motivo: MotivoDaPorta }> {
  let d: Desafio;
  try {
    const r = await postar("/api/alumia/porta/desafio", { momento });
    if (r.status === 404) return { motivo: "sem_servico" };
    if (!r.dado?.ok || typeof r.dado.desafio !== "string" || typeof r.dado.dificuldade !== "number") return { motivo: motivoDe(r.dado?.motivo) };
    d = { desafio: r.dado.desafio, dificuldade: r.dado.dificuldade };
  } catch {
    return { motivo: "sem_servico" };
  }
  aoAvancar?.(0, 2 ** d.dificuldade);
  const resposta = await resolverDesafio(d.desafio, d.dificuldade, { aoAvancar, sinal });
  return { desafio: d.desafio, resposta };
}

export type ResultadoDaConta = { ok: true; sessao: { access_token: string; refresh_token: string } | null } | { ok: false; motivo: MotivoDaPorta };

/**
 * Criar a conta passando pela porta: a prova no aparelho, e o servidor confere antes de a conta existir (e a cria pela API de
 * administração do serviço de contas). `convite`: o código do convite da coordenação do site, quando a pessoa veio por um.
 */
export async function criarContaPelaPorta(dados: { email: string; senha: string; codinome: string; volta: string; convite?: string; turnstile?: string }, aoAvancar?: AoAvancar): Promise<ResultadoDaConta> {
  if (faltaODesafio(dados.turnstile)) return { ok: false, motivo: "captcha" };
  const p = await provar("conta", aoAvancar);
  if ("motivo" in p) return { ok: false, motivo: p.motivo };
  try {
    const r = await postar("/api/alumia/porta/conta", { ...p, ...dados });
    if (!r.dado?.ok) return { ok: false, motivo: r.status === 404 ? "sem_servico" : motivoDe(r.dado?.motivo) };
    const s = r.dado.sessao as { access_token?: unknown; refresh_token?: unknown } | null;
    return { ok: true, sessao: s && typeof s.access_token === "string" && typeof s.refresh_token === "string" ? { access_token: s.access_token, refresh_token: s.refresh_token } : null };
  } catch {
    return { ok: false, motivo: "sem_servico" };
  }
}

/** Por que a entrada não aconteceu: o da porta, a senha errada, o e-mail ainda sem confirmar ou a conta fechada por erros demais. */
export type MotivoDaEntrada = MotivoDaPorta | "credenciais" | "nao_confirmado" | "bloqueado";

export type ResultadoDaEntrada =
  | { ok: true; sessao: { access_token: string; refresh_token: string } }
  | { ok: false; motivo: MotivoDaEntrada; minutos?: number };

/**
 * Entrar com e-mail e senha pela porta: a prova no aparelho e o servidor pede a sessão ao serviço de contas. Quem chama põe a
 * sessão no lugar (supabase.auth.setSession) e segue: o código do aplicativo autenticador continua sendo pedido no navegador.
 */
export async function entrarPelaPorta(dados: { email: string; senha: string; turnstile?: string }, aoAvancar?: AoAvancar): Promise<ResultadoDaEntrada> {
  if (faltaODesafio(dados.turnstile)) return { ok: false, motivo: "captcha" };
  const p = await provar("entrar", aoAvancar);
  if ("motivo" in p) return { ok: false, motivo: p.motivo };
  try {
    const r = await postar("/api/alumia/porta/entrar", { ...p, ...dados });
    const s = r.dado?.sessao as { access_token?: unknown; refresh_token?: unknown } | null | undefined;
    if (r.dado?.ok && s && typeof s.access_token === "string" && typeof s.refresh_token === "string") return { ok: true, sessao: { access_token: s.access_token, refresh_token: s.refresh_token } };
    const m = r.dado?.motivo;
    if (m === "credenciais" || m === "nao_confirmado") return { ok: false, motivo: m };
    if (m === "bloqueado") return { ok: false, motivo: m, minutos: typeof r.dado?.minutos === "number" ? r.dado.minutos : 15 };
    return { ok: false, motivo: r.status === 404 ? "sem_servico" : motivoDe(m) };
  } catch {
    return { ok: false, motivo: "sem_servico" };
  }
}

/**
 * Pedir um e-mail pela porta: "confirmacao" (o link de confirmação de novo) ou "senha" (o link de senha nova). A resposta é a mesma
 * haja conta ou não. `volta`: para onde o link do e-mail leva (na mesma origem).
 */
export async function avisoPelaPorta(dados: { tipo: "confirmacao" | "senha"; email: string; volta: string; turnstile?: string }, aoAvancar?: AoAvancar): Promise<{ ok: true } | { ok: false; motivo: MotivoDaPorta }> {
  if (faltaODesafio(dados.turnstile)) return { ok: false, motivo: "captcha" };
  const p = await provar("aviso", aoAvancar);
  if ("motivo" in p) return { ok: false, motivo: p.motivo };
  try {
    const r = await postar("/api/alumia/porta/aviso", { ...p, ...dados });
    if (r.dado?.ok) return { ok: true };
    return { ok: false, motivo: r.status === 404 ? "sem_servico" : motivoDe(r.dado?.motivo) };
  } catch {
    return { ok: false, motivo: "sem_servico" };
  }
}

export type ResultadoDoPedido = { ok: true; convite: "aceito" | "invalido" | "nenhum" } | { ok: false; motivo: MotivoDaPorta };

/**
 * Antes do pedido de entrada: a prova no aparelho e o passe do servidor (com o convite guardado neste aparelho, se houver).
 * "sem_servico" quer dizer que a rota ou a função do banco ainda não existe: o pedido segue, e o banco decide (ele só exige o passe
 * com a porta ligada, o que pressupõe tudo no ar).
 */
export async function abrirPortaDoPedido(aoAvancar?: AoAvancar): Promise<ResultadoDoPedido> {
  if (!hasBackend || !hasSession()) return { ok: false, motivo: "sem_servico" };
  let token: string | undefined;
  try {
    token = (await (await getClient()).auth.getSession()).data.session?.access_token;
  } catch {
    token = undefined;
  }
  if (!token) return { ok: false, motivo: "sem_servico" };
  const p = await provar("pedido", aoAvancar);
  if ("motivo" in p) return { ok: false, motivo: p.motivo };
  try {
    const r = await postar("/api/alumia/porta/pedido", { ...p, convite: lerConvite() }, token);
    if (r.status === 404 || r.dado?.motivo === "banco") return { ok: false, motivo: "sem_servico" };
    if (!r.dado?.ok) return { ok: false, motivo: motivoDe(r.dado?.motivo) };
    const convite = r.dado.convite === "aceito" || r.dado.convite === "invalido" ? r.dado.convite : "nenhum";
    // O convite foi gasto (ou não vale mais): sai deste aparelho.
    if (convite !== "nenhum") esquecerConvite();
    return { ok: true, convite };
  } catch {
    return { ok: false, motivo: "sem_servico" };
  }
}

/** Pergunta ao servidor se o código do convite vale (sem saber de quem é). Nulo se não deu para saber. */
export async function conferirConvite(codigo: string): Promise<{ valido: boolean; venceEm: string | null } | null> {
  try {
    const r = await postar("/api/alumia/porta/convite", { codigo });
    if (r.status !== 200 || !r.dado || typeof r.dado.valido !== "boolean") return null;
    return { valido: r.dado.valido, venceEm: typeof r.dado.vence_em === "string" ? r.dado.vence_em : null };
  } catch {
    return null;
  }
}

// ── O convite guardado neste aparelho ──
// Com o prefixo das chaves da Alumia (lib/rede/saida.ts): o "Sair rápido" apaga o convite junto.
const CHAVE = "lucia:rede:convite";
const SETE_DIAS = 7 * 86_400_000;

/** O código tem a forma de um convite? (32 letras de 0-9 e a-f) */
export const codigoDeConvite = (c: unknown): c is string => typeof c === "string" && /^[0-9a-f]{32}$/.test(c);

export function guardarConvite(codigo: string) {
  if (!codigoDeConvite(codigo)) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ codigo, ate: Date.now() + SETE_DIAS }));
  } catch {
    // sem armazenamento: o pedido sai sem o convite
  }
}

export function lerConvite(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { codigo?: unknown; ate?: unknown } | null;
    if (!v || typeof v.ate !== "number" || v.ate < Date.now() || !codigoDeConvite(v.codigo)) {
      localStorage.removeItem(CHAVE);
      return null;
    }
    return v.codigo;
  } catch {
    return null;
  }
}

export function esquecerConvite() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // nada guardado
  }
}
