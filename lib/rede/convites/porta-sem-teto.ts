// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A porta de "entrar" e de "aviso" (reenviar a confirmação, pedir a senha nova), da onda 9: o que as rotas app/api/alumia/porta/
// {entrar,aviso} dividem. A prova de trabalho do aparelho (lib/rede/convites/prova-servidor.ts), a rede barrada pelo painel e o
// freio da rede nesta hora (public.alumia_porta_passar, supabase/migracoes/20261115-alumia-o9-resto8.sql). Sem teto da casa: num
// ataque, quem já tem conta continua entrando. Com o banco ainda sem a função, o freio fica na memória do processo.
// E a chamada ao serviço de contas com a chave de serviço, que nunca sai do servidor. Só no servidor.
import { chaveDoFreio, conferirDesafio } from "./prova-servidor";
import { criarFreio, impressaoDoPedido, rpcDeServico, semAFuncao, servico, SUPA } from "./servidor";

const freioNaMemoria = { entrar: criarFreio(20, 60 * 60_000), aviso: criarFreio(6, 60 * 60_000) };
const gastosNaMemoria = new Map<string, number>();

/** O desafio que já valeu, na memória (só quando o banco não pode guardar). */
function gastarNaMemoria(selo: string, vence: number): boolean {
  const agora = Date.now();
  if (gastosNaMemoria.size > 20_000) for (const [k, v] of gastosNaMemoria) if (v < agora) gastosNaMemoria.delete(k);
  if (gastosNaMemoria.has(selo)) return false;
  gastosNaMemoria.set(selo, vence);
  return true;
}

export type PortaSemTeto = { ok: true } | { ok: false; motivo: string; status: number };

/** Confere a prova e o freio de "entrar" ou "aviso". */
export async function passarSemTeto(pedido: Request, momento: "entrar" | "aviso", desafio: unknown, resposta: unknown): Promise<PortaSemTeto> {
  const prova = conferirDesafio(desafio, resposta, momento);
  if (!prova.ok) return { ok: false, motivo: prova.motivo, status: 400 };
  const impressao = impressaoDoPedido(pedido);
  const r = await rpcDeServico<{ ok: boolean; motivo?: string }>("alumia_porta_passar", {
    p_momento: momento, p_chave: chaveDoFreio(impressao, momento), p_selo: prova.selo, p_vence: new Date(prova.vence).toISOString(), p_impressao: impressao,
  });
  if (r.ok) return r.dado.ok ? { ok: true } : { ok: false, motivo: r.dado.motivo ?? "muitos_pedidos", status: 429 };
  if (!semAFuncao(r)) return { ok: false, motivo: "sem_servico", status: 503 };
  if (!gastarNaMemoria(prova.selo, prova.vence)) return { ok: false, motivo: "desafio_usado", status: 429 };
  if (impressao && !freioNaMemoria[momento](impressao)) return { ok: false, motivo: "muitos_pedidos", status: 429 };
  return { ok: true };
}

export interface RespostaDasContas {
  status: number;
  dado: Record<string, unknown> | null;
}

/**
 * Chama o serviço de contas (Supabase Auth) com a chave de serviço. `caminho` começa com "/". Lança só se não houver conexão.
 * A chave de serviço também dispensa o desafio de terceiros no serviço de contas, enquanto ele ainda estiver ligado lá.
 */
export async function servicoDeContas(caminho: string, corpo: unknown, metodo = "POST", agente?: string | null): Promise<RespostaDasContas> {
  const chave = servico();
  // P5 (A4): a sessão aberta pelo servidor (entrar com senha) guardava o "user agent" do próprio servidor, e a tela de aparelhos e o
  // aviso diziam "Navegador desconhecido em sistema desconhecido". Quem chama passa o do navegador da pessoa, que o serviço de
  // contas grava na sessão. O endereço de rede NÃO vai junto (a sessão fica com o do servidor, que o gatilho já apaga).
  const comoNavegador: Record<string, string> = agente ? { "User-Agent": agente.replace(/[^ -~]/g, "").slice(0, 500) } : {};
  const r = await fetch(`${SUPA}/auth/v1${caminho}`, {
    method: metodo,
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json", ...comoNavegador },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return { status: r.status, dado: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

/**
 * As origens do próprio Instituto para onde o link de um e-mail (confirmação, senha nova) pode voltar: o site, os subdomínios
 * alumia., escola. e conversas. dele, os endereços próprios configurados (Alumia, Escola, chat) e o .onion do chat. Fora de
 * produção, também http (localhost). A lista vem só das variáveis do servidor, nunca do pedido.
 */
export function origensDeVolta(env: Record<string, string | undefined> = process.env): Set<string> {
  const producao = env.NODE_ENV === "production";
  const origens = new Set<string>();
  const juntar = (texto: string | undefined) => {
    if (!texto?.trim()) return;
    try {
      const u = new URL(texto.trim());
      if (u.protocol === "https:" || (!producao && u.protocol === "http:")) origens.add(u.origin);
    } catch {
      // endereço mal escrito na variável: fica de fora
    }
  };
  const site = env.NEXT_PUBLIC_SITE_URL?.trim() || (producao ? "https://institutolucia.org" : "http://localhost:3000");
  juntar(site);
  try {
    const u = new URL(site);
    for (const sub of ["alumia", "escola", "conversas"]) juntar(`${u.protocol}//${sub}.${u.host}`);
  } catch {
    // sem o site, só valem os endereços próprios abaixo
  }
  juntar(env.NEXT_PUBLIC_ALUMIA_URL);
  juntar(env.NEXT_PUBLIC_ESCOLA_URL);
  juntar(env.NEXT_PUBLIC_CHAT_URL);
  const onion = (env.NEXT_PUBLIC_CHAT_ONION ?? "").trim();
  if (/^[a-z2-7]{56}\.onion$/.test(onion)) origens.add(`http://${onion}`);
  return origens;
}

/**
 * O endereço de volta do e-mail: só na mesma origem de quem pediu E numa origem do próprio Instituto. O cabeçalho Origin, fora do
 * navegador, quem chama escolhe: sozinho ele deixava um robô pedir a senha nova de outra pessoa com a volta para um site dele (o
 * link do e-mail, com o código, iria para lá se o serviço de contas aceitasse o endereço). A lista fechada não depende disso.
 */
export function voltaDaMesmaOrigem(pedido: Request, volta: unknown, origens: Set<string> = origensDeVolta()): string | null {
  const origem = pedido.headers.get("origin");
  if (!origem || typeof volta !== "string" || volta.length > 300) return null;
  try {
    const url = new URL(volta);
    if (url.username || url.password) return null;
    return url.origin === origem && origens.has(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

export const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
