// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem pode entrar em qual sala de vídeo pelo LiveKit (Prompt 4, item 141; a rota é app/api/sala/entrada/route.ts). As regras são AS
// DE HOJE, conferidas pelas mesmas funções do banco que já decidem quem vê a sala no Jitsi, chamadas com a sessão de quem pede:
//   - reunião da equipe e chamada de canal: public.reunioes_listar e public.chat_chamadas devolvem o nome da sala SÓ para quem pode
//     entrar (interno.reuniao_entra) e só de reunião agendada ou ao vivo. A sala pedida tem de estar nessa lista: o nome que o
//     navegador manda nunca vale sozinho. "conduzo" e "video" vêm do banco, não do navegador;
//   - turma do mês e turma do curso: public.turma_mes e public.turma_curso devolvem a sala só para quem está na turma;
//   - estudo em grupo (abre sem conta, a sala nasce no navegador e não existe no banco): o formato do nome, o limite de pedidos por
//     endereço que não grava o endereço (lib/assistente/limite.ts, resumo com sal do dia, só na memória) e o desafio contra robôs
//     (Turnstile). Sem a chave do Turnstile no servidor, o estudo em grupo não abre (503).
// Nenhuma mudança no banco. Nada é gravado aqui (nem endereço, nem quem entrou: a presença continua a de hoje, pelo painel).
// Sem "@/" de propósito (roda no Node nos testes).
import { type PapelNaSala, SALA, SALA_DO_ESTUDO } from "./livekit";

export type Origem = "reuniao" | "estudo" | "turma-mes" | "turma-curso";

export interface PedidoDeEntrada {
  origem: Origem;
  sala: string;
  mes?: string;
  curso?: string;
  desafio?: string;
}

const MES = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const CURSO = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Lê o pedido do navegador. Só os campos conhecidos passam; qualquer dúvida, null. */
export function lerPedido(corpo: unknown): PedidoDeEntrada | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  const origem = c.origem;
  const sala = typeof c.sala === "string" ? c.sala : "";
  if (!SALA.test(sala)) return null;
  if (origem === "reuniao") return { origem, sala };
  if (origem === "estudo") return SALA_DO_ESTUDO.test(sala) ? { origem, sala, desafio: typeof c.desafio === "string" ? c.desafio.slice(0, 2048) : "" } : null;
  if (origem === "turma-mes") return typeof c.mes === "string" && MES.test(c.mes) ? { origem, sala, mes: c.mes } : null;
  if (origem === "turma-curso") return typeof c.mes === "string" && MES.test(c.mes) && typeof c.curso === "string" && CURSO.test(c.curso) ? { origem, sala, mes: c.mes, curso: c.curso } : null;
  return null;
}

export interface DepsDaEntrada {
  /** Chama uma função do banco COM a sessão de quem pediu. Erro: null. */
  rpcComo(sessao: string, funcao: string, args: Record<string, unknown>): Promise<unknown>;
  /** A conferência do desafio contra robôs (lib/rede/convites/turnstile.ts). */
  conferirDesafio(valor: unknown): Promise<"ok" | "sem_chave" | "recusado">;
  /** Gasta uma vez do limite de quem pede (sem guardar o endereço). */
  limitar(): { ok: true } | { ok: false; tentarEm: number };
}

export type Decisao = { ok: true; papel: PapelNaSala; video: boolean | null } | { ok: false; erro: string; status: number };

interface ReuniaoLida {
  sala?: unknown;
  conduzo?: unknown;
  conversa?: unknown;
  video?: unknown;
  status?: unknown;
}

const lista = (v: unknown): ReuniaoLida[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as ReuniaoLida[]) : []);

export async function decidirEntrada(pedido: PedidoDeEntrada, sessao: string | null, deps: DepsDaEntrada): Promise<Decisao> {
  if (pedido.origem === "estudo") {
    const vez = deps.limitar();
    if (!vez.ok) return { ok: false, erro: "limite", status: 429 };
    // Só "ok" abre. Sem a chave do desafio no servidor ("sem_chave"), o estudo em grupo fica fechado: aberto sem conta e sem
    // desafio, qualquer robô pegaria token do LiveKit até o teto do dia (auditoria do P4, B3).
    const desafio = await deps.conferirDesafio(pedido.desafio);
    if (desafio === "sem_chave") return { ok: false, erro: "sem_servico", status: 503 };
    if (desafio !== "ok") return { ok: false, erro: "desafio", status: 403 };
    return { ok: true, papel: "estudo", video: null };
  }
  if (!sessao) return { ok: false, erro: "sem_sessao", status: 401 };
  if (pedido.origem === "reuniao") {
    // A chamada de canal primeiro (a lista é curta: só as ao vivo das conversas da pessoa); depois as reuniões da equipe.
    const canais = lista(await deps.rpcComo(sessao, "chat_chamadas", {}));
    const doCanal = canais.find((r) => r.sala === pedido.sala && typeof r.conversa === "string");
    if (doCanal) return { ok: true, papel: "canal", video: doCanal.video === true };
    const reunioes = lista(await deps.rpcComo(sessao, "reunioes_listar", {}));
    const r = reunioes.find((x) => x.sala === pedido.sala && (x.status === "agendada" || x.status === "ao_vivo"));
    if (r) return { ok: true, papel: r.conduzo === true ? "conduz" : "assiste", video: null };
    return { ok: false, erro: "nao_encontrado", status: 404 };
  }
  const turma = (pedido.origem === "turma-mes"
    ? await deps.rpcComo(sessao, "turma_mes", { p_mes: pedido.mes })
    : await deps.rpcComo(sessao, "turma_curso", { p_mes: pedido.mes, p_curso: pedido.curso })) as { eu?: unknown; sala?: unknown } | null;
  if (turma?.eu === true && turma.sala === pedido.sala) return { ok: true, papel: "estudo", video: null };
  return { ok: false, erro: "nao_encontrado", status: 404 };
}
