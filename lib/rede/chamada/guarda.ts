// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os toques que chegaram (Prompt 4, itens 139 e 140): o chat do aparelho (lib/rede/chat/r2/navegador.ts, `aoChamada`) entrega aqui o
// que chegou de dentro do cifrado, e a tela (components/rede/chamada/NaCasca.tsx) mostra quem está ligando. Só na memória desta aba:
// nada vai ao disco nem ao servidor, e o "Sair rápido" apaga. Não existe registro de chamadas (nem feitas, nem perdidas).
// Sem "@/" de propósito (roda no Node nos testes).
import { type CorpoDoToque, type FimDaChamada, toqueVale } from "./toque";

export interface ToqueRecebido {
  /** A conversa (o id do chat) e a conta de quem ligou (sempre a outra pessoa da conversa: o chat confere antes). */
  conversa: string;
  autor: string;
  /** O codinome da conversa, como o chat deste aparelho já guarda (nada vem do servidor). */
  nome: string;
  corpo: CorpoDoToque;
  chegou: number;
}

/** Quanto tempo o id de uma chamada que acabou fica lembrado (para um toque atrasado da mesma chamada não voltar a tocar). */
export const LEMBRA_FIM_MS = 10 * 60_000;

export class GuardaDosToques {
  private toques = new Map<string, ToqueRecebido>();
  private acabadas = new Map<string, number>();
  private ouvintes = new Set<() => void>();
  private aoFim = new Set<(id: string, fim: FimDaChamada) => void>();

  /**
   * Chegou um toque ou um fim. Um toque velho, de chamada que já acabou, ou de outra chamada com uma tocando na conversa, cai. Um fim
   * para de tocar e avisa quem ouve os fins (a chamada aberta, se for a mesma). Devolve se passou a tocar.
   */
  receber(conversa: string, autor: string, nome: string, corpo: CorpoDoToque, agora = Date.now()): boolean {
    this.limpar(agora);
    if (corpo.fim) {
      this.acabadas.set(corpo.id, agora);
      const ja = this.toques.get(conversa);
      if (ja && ja.corpo.id === corpo.id) {
        this.toques.delete(conversa);
        this.avisar();
      }
      for (const f of this.aoFim) {
        try {
          f(corpo.id, corpo.fim);
        } catch {
          // um ouvinte quebrado não derruba os outros
        }
      }
      return false;
    }
    if (!toqueVale(corpo, agora) || this.acabadas.has(corpo.id)) return false;
    const ja = this.toques.get(conversa);
    if (ja && ja.corpo.id !== corpo.id) return false;
    this.toques.set(conversa, { conversa, autor, nome: nome.slice(0, 80), corpo, chegou: agora });
    this.avisar();
    return true;
  }

  /** O que está tocando agora (o mais novo primeiro). */
  tocando(agora = Date.now()): ToqueRecebido[] {
    this.limpar(agora);
    return [...this.toques.values()].sort((a, b) => b.chegou - a.chegou);
  }

  /** Atendeu ou recusou aqui: para de tocar e não volta. */
  encerrar(id: string, agora = Date.now()): void {
    this.acabadas.set(id, agora);
    for (const [k, t] of this.toques) if (t.corpo.id === id) this.toques.delete(k);
    this.avisar();
  }

  /** "Sair rápido" (sem conversa) ou a conversa apagada: tudo dela some. */
  esquecer(conversa?: string): void {
    if (conversa) this.toques.delete(conversa);
    else {
      this.toques.clear();
      this.acabadas.clear();
    }
    this.avisar();
  }

  /** Avisa a cada mudança do que está tocando. Devolve a função que para de ouvir. */
  ouvir(fazer: () => void): () => void {
    this.ouvintes.add(fazer);
    return () => void this.ouvintes.delete(fazer);
  }

  /** Avisa a cada fim que chegou (de qualquer chamada). Devolve a função que para de ouvir. */
  ouvirFins(fazer: (id: string, fim: FimDaChamada) => void): () => void {
    this.aoFim.add(fazer);
    return () => void this.aoFim.delete(fazer);
  }

  private limpar(agora: number) {
    let mudou = false;
    for (const [k, t] of this.toques)
      if (!toqueVale(t.corpo, agora)) {
        this.toques.delete(k);
        mudou = true;
      }
    for (const [id, quando] of this.acabadas) if (agora - quando > LEMBRA_FIM_MS) this.acabadas.delete(id);
    if (mudou) this.avisar();
  }

  private avisar() {
    for (const o of this.ouvintes) {
      try {
        o();
      } catch {
        // um ouvinte quebrado não derruba os outros
      }
    }
  }
}

/** A guarda desta aba. */
export const guardaDosToques = new GuardaDosToques();

/** O chat entrega aqui (lib/rede/chat/r2/navegador.ts). */
export function toqueChegou(conversa: string, autor: string, nome: string, corpo: CorpoDoToque, quando: number): void {
  guardaDosToques.receber(conversa, autor, nome, corpo, quando);
}
