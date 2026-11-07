// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O canal da sala de jogo. Com o serviço de contas configurado, é o tempo real dele (Supabase Realtime: mensagens
// "broadcast" e presença, por WebSocket, o mesmo das aulas ao vivo em lib/tempo-real.ts): nada passa pelo banco, nada fica
// guardado, e entra-se com a chave pública (sem conta). Sem o serviço (cópia local sem banco), a sala funciona entre abas
// do mesmo navegador (BroadcastChannel), o que basta para testar e para jogar num computador com várias janelas.
//
// O que circula: o id sorteado desta aba, o apelido e as ações do jogo. Nenhum dado da conta, nenhum endereço.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getClient, hasBackend } from "@/lib/backend";

export interface Presenca {
  id: string;
  apelido: string;
}

export type Mensagem = { tipo: "estado"; carga: unknown } | { tipo: "acao"; de: string; carga: unknown };

export interface CanalDaSala {
  entrar(): Promise<boolean>;
  enviar(m: Mensagem): void;
  atualizar(eu: Presenca): void;
  sair(): void;
  /** "tempo-real" (pela internet) ou "abas" (só neste navegador). */
  readonly modo: "tempo-real" | "abas";
}

const limpar = (lista: unknown[]): Presenca[] =>
  lista.flatMap((item) => {
    const p = item as Partial<Presenca>;
    return typeof p?.id === "string" && /^[a-z0-9]{6,24}$/.test(p.id) ? [{ id: p.id, apelido: String(p.apelido ?? "").slice(0, 20) }] : [];
  });

class CanalTempoReal implements CanalDaSala {
  readonly modo = "tempo-real" as const;
  private canal: RealtimeChannel | null = null;
  private saiu = false;
  constructor(
    private readonly codigo: string,
    private eu: Presenca,
    private readonly aoMensagem: (m: Mensagem) => void,
    private readonly aoPresenca: (p: Presenca[]) => void,
  ) {}

  async entrar(): Promise<boolean> {
    try {
      const supabase = await getClient();
      const topico = `jogo:${this.codigo}`;
      const antigo = supabase.getChannels().find((c) => c.topic === `realtime:${topico}`);
      if (antigo) await supabase.removeChannel(antigo);
      if (this.saiu) return false;
      const canal = supabase.channel(topico, { config: { broadcast: { self: false }, presence: { key: this.eu.id } } });
      canal.on("broadcast", { event: "m" }, ({ payload }) => {
        const m = payload as Mensagem;
        if (m && (m.tipo === "estado" || (m.tipo === "acao" && typeof m.de === "string"))) this.aoMensagem(m);
      });
      canal.on("presence", { event: "sync" }, () => this.aoPresenca(limpar(Object.values(canal.presenceState()).flat())));
      await new Promise<void>((resolver, recusar) => {
        canal.subscribe((status) => {
          if (status === "SUBSCRIBED") void canal.track(this.eu).then(() => resolver());
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") recusar(new Error(status));
        });
        window.setTimeout(() => recusar(new Error("demorou")), 15_000);
      });
      if (this.saiu) {
        void supabase.removeChannel(canal);
        return false;
      }
      this.canal = canal;
      return true;
    } catch {
      return false;
    }
  }

  enviar(m: Mensagem) {
    void this.canal?.send({ type: "broadcast", event: "m", payload: m }).catch(() => undefined);
  }

  atualizar(eu: Presenca) {
    this.eu = eu;
    void this.canal?.track(eu).catch(() => undefined);
  }

  sair() {
    this.saiu = true;
    const canal = this.canal;
    this.canal = null;
    if (canal) void getClient().then((s) => s.removeChannel(canal));
  }
}

/** Entre abas do mesmo navegador: a presença é um "estou aqui" a cada 2 s; quem some por 7 s saiu. */
class CanalDeAbas implements CanalDaSala {
  readonly modo = "abas" as const;
  private bc: BroadcastChannel | null = null;
  private vistos = new Map<string, { apelido: string; em: number }>();
  private relogio = 0;
  constructor(
    private readonly codigo: string,
    private eu: Presenca,
    private readonly aoMensagem: (m: Mensagem) => void,
    private readonly aoPresenca: (p: Presenca[]) => void,
  ) {}

  private avisar() {
    const agora = Date.now();
    for (const [id, v] of this.vistos) if (agora - v.em > 7000) this.vistos.delete(id);
    this.aoPresenca([this.eu, ...[...this.vistos].map(([id, v]) => ({ id, apelido: v.apelido }))]);
  }

  async entrar(): Promise<boolean> {
    if (typeof BroadcastChannel === "undefined") return false;
    this.bc = new BroadcastChannel(`lucia-jogo-${this.codigo}`);
    this.bc.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { oi?: Presenca; tchau?: string; m?: Mensagem };
      if (d?.oi) {
        const [p] = limpar([d.oi]);
        if (p) {
          const novo = !this.vistos.has(p.id);
          this.vistos.set(p.id, { apelido: p.apelido, em: Date.now() });
          if (novo) {
            this.bc?.postMessage({ oi: this.eu });
            this.avisar();
          }
        }
      } else if (typeof d?.tchau === "string") {
        this.vistos.delete(d.tchau);
        this.avisar();
      } else if (d?.m) this.aoMensagem(d.m);
    };
    this.bc.postMessage({ oi: this.eu });
    this.relogio = window.setInterval(() => {
      this.bc?.postMessage({ oi: this.eu });
      this.avisar();
    }, 2000);
    this.avisar();
    return true;
  }

  enviar(m: Mensagem) {
    this.bc?.postMessage({ m });
  }

  atualizar(eu: Presenca) {
    this.eu = eu;
    this.bc?.postMessage({ oi: eu });
  }

  sair() {
    window.clearInterval(this.relogio);
    this.bc?.postMessage({ tchau: this.eu.id });
    this.bc?.close();
    this.bc = null;
  }
}

export function abrirCanal(codigo: string, eu: Presenca, aoMensagem: (m: Mensagem) => void, aoPresenca: (p: Presenca[]) => void): CanalDaSala {
  return hasBackend ? new CanalTempoReal(codigo, eu, aoMensagem, aoPresenca) : new CanalDeAbas(codigo, eu, aoMensagem, aoPresenca);
}

/** Um id para esta aba (não identifica a pessoa nem o aparelho; some ao fechar a aba). */
export function idSorteado(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => (b % 36).toString(36)).join("") + "x";
}
