// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A posição compartilhada (Prompt 4, itens 2, 7 e 8): o que vai DENTRO da mensagem cifrada do chat. Nunca vai ao servidor em claro:
// cada atualização é um tipo novo de conteúdo dentro do cifrado (o controle "posicao" da conversa a dois, lib/rede/chat/r2/servico.ts,
// e o conteúdo "posicao" da mensagem de aplicação do MLS, lib/rede/membros/grupo.ts). O protocolo não muda: a mesma cifra, o mesmo
// envelope de tamanho fixo, o mesmo ritmo do texto.
//
// Regras (decisão da coordenação de 18/11/2026):
//   - só por tempo limitado: 15 min, 1 h, 8 h ou "até eu parar" (que vale 15 min de cada vez e se renova enquanto a Alumia estiver
//     aberta e compartilhando);
//   - SEM histórico de trajeto: quem recebe guarda só a ÚLTIMA posição de cada pessoa, e apaga quando vence ou quando ela para;
//   - precisão por escolha: exata (5 casas, ~1 m) ou só o bairro (2 casas, ~1 km), arredondada AQUI, antes de cifrar;
//   - o prazo vai como DURAÇÃO (segundos que faltam), não como hora: o relógio de cada aparelho pode estar errado.
// O pedido de ajuda (SOS, item 7) é o mesmo conteúdo com a marca `sos` (a posição é opcional: sem permissão de local, vai sem).
// Sem "@/": roda no Node nos testes.

export type Precisao = "exata" | "bairro";
/** Os prazos que a tela oferece (minutos); "parar" = até eu parar. */
export type Prazo = 15 | 60 | 480 | "parar";
export const PRAZOS: readonly Prazo[] = [15, 60, 480, "parar"];
/** O "até eu parar" vale isto de cada vez (e é renovado pelo aparelho de quem compartilha enquanto compartilha). */
export const RENOVACAO_MS = 15 * 60_000;
/** O maior prazo de uma atualização: 8 h (o maior prazo escolhível). */
export const MAIOR_DURACAO_S = 8 * 3600;
/** O pedido de ajuda fica visível por 24 h em quem recebe (como o "Estou bem"). */
export const VIDA_DO_SOS_MS = 24 * 3600_000;

/** O que vai dentro do cifrado. */
export interface CorpoDePosicao {
  v: 1;
  /** Latitude e longitude já arredondadas (ausentes só no pedido de ajuda sem permissão de local, e no "parei"). */
  la?: number;
  lo?: number;
  /** "e" exata, "b" bairro. */
  pr?: "e" | "b";
  /** Quantos segundos esta posição vale a partir de quando chegou (1 a 8 h). */
  dura?: number;
  /** Pedido de ajuda (item 7). */
  sos?: 1;
  /** O pedido de ajuda saiu sozinho porque a "volta para casa" venceu sem confirmação (item 8). */
  volta?: 1;
  /** "Parei de compartilhar": quem recebe apaga a posição na hora. */
  fim?: 1;
  /** Pedido de localização (item 2: "ninguém é localizado em silêncio"): chega como pedido, que a pessoa aceita ou recusa. Sem posição. */
  pede?: 1;
}

const CHAVES = new Set(["v", "la", "lo", "pr", "dura", "sos", "volta", "fim", "pede"]);
/** O pedido de localização vale isto em quem recebe (depois some sozinho, sem resposta). */
export const VIDA_DO_PEDIDO_MS = 15 * 60_000;
/** "Mandar onde estou uma vez" (ponto de encontro): a posição vale 1 h e não se renova. */
export const VIDA_DE_UMA_VEZ_MS = 60 * 60_000;
const casas = (n: number, k: number) => Math.round(n * 10 ** k) / 10 ** k;
const decimaisDe = (n: number) => {
  const s = String(n);
  if (/e/i.test(s)) return 99;
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
};

/** Arredonda NO APARELHO, antes de cifrar: exata com 5 casas (~1 m), bairro com 2 (~1 km). Fora da Terra: null. */
export function arredondar(la: number, lo: number, precisao: Precisao): { la: number; lo: number } | null {
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  const k = precisao === "bairro" ? 2 : 5;
  // "+ 0" tira o -0 (que o JSON escreveria "0" e a conferência leria diferente).
  return { la: casas(la, k) + 0, lo: casas(lo, k) + 0 };
}

/** Monta o corpo de uma atualização de posição (já arredondada aqui). */
export function corpoDePosicao(c: { la: number; lo: number; precisao: Precisao; duracaoMs: number; sos?: boolean; volta?: boolean }): CorpoDePosicao {
  const p = arredondar(c.la, c.lo, c.precisao);
  if (!p) throw new Error("posicao_invalida");
  const dura = Math.ceil(c.duracaoMs / 1000);
  if (!Number.isInteger(dura) || dura < 1 || dura > MAIOR_DURACAO_S) throw new Error("prazo_invalido");
  return { v: 1, la: p.la, lo: p.lo, pr: c.precisao === "bairro" ? "b" : "e", dura, ...(c.sos ? { sos: 1 as const } : {}), ...(c.volta ? { volta: 1 as const } : {}) };
}

/** O pedido de ajuda sem posição (a pessoa não deu permissão de local, ou o aparelho não achou a posição a tempo). */
export function sosSemPosicao(volta = false): CorpoDePosicao {
  return { v: 1, sos: 1, ...(volta ? { volta: 1 as const } : {}) };
}

/** "Parei de compartilhar". */
export const PAREI: CorpoDePosicao = { v: 1, fim: 1 };

/** "Pode me mostrar onde você está?" (sem posição nenhuma). */
export const PEDIDO: CorpoDePosicao = { v: 1, pede: 1 };

/** Os bytes que vão dentro do cifrado (JSON curto, sem espaço). */
export function montarCorpoDePosicao(c: CorpoDePosicao): Uint8Array {
  const lido = lerCorpoDePosicao(JSON.stringify(c));
  if (!lido) throw new Error("posicao_invalida");
  return new TextEncoder().encode(JSON.stringify(lido));
}

/**
 * Lê (e confere) um corpo de posição: string JSON ou os bytes. null em qualquer coisa fora do formato: chave a mais, número fora da
 * Terra, mais casas que a precisão diz (alguém mandando "bairro" com a posição exata), prazo acima de 8 h, "parei" com posição.
 */
export function lerCorpoDePosicao(entrada: string | Uint8Array): CorpoDePosicao | null {
  let c: unknown;
  try {
    c = JSON.parse(typeof entrada === "string" ? entrada : new TextDecoder("utf-8", { fatal: true }).decode(entrada));
  } catch {
    return null;
  }
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const o = c as Record<string, unknown>;
  if (o.v !== 1 || Object.keys(o).some((k) => !CHAVES.has(k))) return null;
  for (const k of ["sos", "volta", "fim", "pede"] as const) if (o[k] !== undefined && o[k] !== 1) return null;
  if (o.pede === 1) return Object.keys(o).length === 2 ? { v: 1, pede: 1 } : null;
  if (o.fim === 1) return Object.keys(o).length === 2 ? { v: 1, fim: 1 } : null;
  const temPosicao = o.la !== undefined || o.lo !== undefined || o.pr !== undefined || o.dura !== undefined;
  if (o.volta === 1 && o.sos !== 1) return null;
  if (!temPosicao) return o.sos === 1 ? { v: 1, sos: 1, ...(o.volta === 1 ? { volta: 1 as const } : {}) } : null;
  const { la, lo, pr, dura } = o;
  if (typeof la !== "number" || typeof lo !== "number" || (pr !== "e" && pr !== "b") || typeof dura !== "number") return null;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  const k = pr === "b" ? 2 : 5;
  if (decimaisDe(la) > k || decimaisDe(lo) > k) return null;
  if (!Number.isInteger(dura) || dura < 1 || dura > MAIOR_DURACAO_S) return null;
  return { v: 1, la, lo, pr, dura, ...(o.sos === 1 ? { sos: 1 as const } : {}), ...(o.volta === 1 ? { volta: 1 as const } : {}) };
}

/** A duração de uma atualização para o prazo escolhido, dado quando o compartilhamento começou. null: já venceu. */
export function duracaoDaVez(prazo: Prazo, comecou: number, agora: number): number | null {
  if (prazo === "parar") return RENOVACAO_MS;
  const fim = comecou + prazo * 60_000;
  return fim > agora ? Math.min(fim - agora, MAIOR_DURACAO_S * 1000) : null;
}

// ── A guarda de quem recebe: só a ÚLTIMA posição de cada pessoa, nunca o trajeto ────────────────────────────────────────────

/** Uma posição recebida, como a tela mostra. */
export interface PosicaoRecebida {
  /** De onde veio: a conversa a dois ("c:<id>") ou o grupo ("g:<id>"). */
  origem: string;
  /** A conta de quem mandou (o que o chat provou). */
  autor: string;
  la: number | null;
  lo: number | null;
  precisao: Precisao | null;
  /** Quando chegou NESTE aparelho (relógio daqui) e até quando vale. */
  chegou: number;
  vale: number;
  sos: boolean;
  volta: boolean;
}

/**
 * A guarda das posições recebidas, na memória da aba (nunca no disco: ao fechar, some). Uma entrada por pessoa e origem: a nova
 * TROCA a anterior (nenhuma lista de pontos, nenhum trajeto). O "parei" apaga. O que venceu sai em `vigentes`.
 */
export class GuardaDePosicoes {
  private readonly m = new Map<string, PosicaoRecebida>();
  /** Os pedidos de localização que chegaram (origem|autor → até quando vale); nenhuma posição aqui. */
  private readonly pedidosGuardados = new Map<string, { origem: string; autor: string; vale: number }>();
  private readonly ouvintes = new Set<() => void>();

  /** Recebe um corpo já lido. Devolve a posição guardada (ou null, se era "parei" ou inválido). */
  receber(origem: string, autor: string, corpo: CorpoDePosicao, agora: number): PosicaoRecebida | null {
    const k = `${origem}|${autor}`;
    if (corpo.pede) {
      this.pedidosGuardados.set(k, { origem, autor, vale: agora + VIDA_DO_PEDIDO_MS });
      this.avisar();
      return null;
    }
    if (corpo.fim) {
      // O pedido de ajuda não some com o "parei" do compartilhamento comum: só some ao vencer (24 h) ou quando a pessoa apaga.
      if (this.m.get(k)?.sos) return null;
      if (this.m.delete(k)) this.avisar();
      return null;
    }
    const sos = corpo.sos === 1;
    const vale = sos ? agora + VIDA_DO_SOS_MS : agora + (corpo.dura ?? 0) * 1000;
    if (vale <= agora) return null;
    // Um SOS guardado não é trocado por uma atualização comum (a pessoa vê o pedido até tirar).
    const antes = this.m.get(k);
    if (antes?.sos && !sos && antes.vale > agora) return null;
    const p: PosicaoRecebida = {
      origem, autor, chegou: agora, vale, sos, volta: corpo.volta === 1,
      la: corpo.la ?? null, lo: corpo.lo ?? null, precisao: corpo.pr === "e" ? "exata" : corpo.pr === "b" ? "bairro" : null,
    };
    this.m.set(k, p);
    this.avisar();
    return p;
  }

  /** As que valem agora (e apaga as vencidas). */
  vigentes(agora: number): PosicaoRecebida[] {
    let mudou = false;
    for (const [k, p] of this.m) if (p.vale <= agora) mudou = this.m.delete(k) || mudou;
    for (const [k, p] of this.pedidosGuardados) if (p.vale <= agora) mudou = this.pedidosGuardados.delete(k) || mudou;
    if (mudou) this.avisar();
    return [...this.m.values()].sort((a, b) => Number(b.sos) - Number(a.sos) || b.chegou - a.chegou);
  }

  /** As que valem agora, sem mexer na guarda (para ler durante o desenho da tela). */
  ver(agora: number): PosicaoRecebida[] {
    return [...this.m.values()].filter((p) => p.vale > agora).sort((a, b) => Number(b.sos) - Number(a.sos) || b.chegou - a.chegou);
  }

  /** Os pedidos de localização que valem agora (sem mexer na guarda). */
  pedidos(agora: number): { origem: string; autor: string; vale: number }[] {
    return [...this.pedidosGuardados.values()].filter((p) => p.vale > agora);
  }

  /** Tira um pedido de localização (a pessoa aceitou ou recusou). Recusar não manda nada: quem pediu só não recebe. */
  tirarPedido(origem: string, autor: string): void {
    if (this.pedidosGuardados.delete(`${origem}|${autor}`)) this.avisar();
  }

  /** Tira uma (a pessoa viu o pedido de ajuda e fechou). */
  tirar(origem: string, autor: string): void {
    if (this.m.delete(`${origem}|${autor}`)) this.avisar();
  }

  /** Apaga tudo (Sair rápido, sair da conta). */
  esquecer(): void {
    if (this.m.size || this.pedidosGuardados.size) {
      this.m.clear();
      this.pedidosGuardados.clear();
      this.avisar();
    }
  }

  /** Quantas guardadas (só para os testes e para o emblema; nunca vai a lugar nenhum). */
  get tamanho(): number {
    return this.m.size;
  }

  ouvir(fazer: () => void): () => void {
    this.ouvintes.add(fazer);
    return () => void this.ouvintes.delete(fazer);
  }

  private avisar() {
    for (const o of this.ouvintes) {
      try {
        o();
      } catch {
        // um ouvinte com erro não derruba os outros
      }
    }
  }
}

// ── Distância (para "a 2 km de você"), só no aparelho ───────────────────────────────────────────────────────────────────────

/** A distância em metros entre dois pontos (haversine), arredondada a 100 m. */
export function distancia(a: { la: number; lo: number }, b: { la: number; lo: number }): number {
  const r = 6_371_000;
  const rad = Math.PI / 180;
  const dLa = (b.la - a.la) * rad;
  const dLo = (b.lo - a.lo) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.la * rad) * Math.cos(b.la * rad) * Math.sin(dLo / 2) ** 2;
  return Math.round((2 * r * Math.asin(Math.min(1, Math.sqrt(h)))) / 100) * 100;
}
