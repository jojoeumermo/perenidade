// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { getClient, hasBackend, localBackend } from "./backend";

/**
 * Tempo real. O serviço de contas tem um canal de mensagens instantâneas (Realtime, por WebSocket) que não passa pelo
 * banco. Cada painel aberto entra no canal "painel" e, toda vez que alguém faz uma ação que deu certo, avisa os outros
 * ("mudou: chat_enviar"). Quem recebe refaz as listas que está vendo. O aviso não leva texto nenhum, só o nome da ação:
 * o conteúdo continua vindo pelas funções do banco, que conferem quem pode ver o quê.
 * Sem o canal (ambiente de teste local, serviço fora do ar), tudo continua funcionando pelo relógio de sempre.
 */
export const PAINEL_REMOTO = "painel-remoto";

export interface Sinal {
  tipo: string;
  alvo?: string;
  de?: string;
}

let canal: Promise<RealtimeChannel | null> | null = null;
/** Marca deste painel, para ignorar os próprios sinais. */
const marca = Math.random().toString(36).slice(2, 10);

export const temTempoReal = hasBackend && !localBackend;

/**
 * O canal "painel" é aberto (qualquer um com a chave pública do site entra nele), então quem repetisse avisos sem parar
 * faria todos os painéis abertos reler as listas sem parar. Aqui cada tipo de aviso passa no máximo uma vez a cada dois
 * segundos (o último do intervalo sai no fim dele, para nada se perder) e, no total, até 60 por minuto.
 */
const INTERVALO = 2000;
const POR_MINUTO = 60;
const ultimoPorTipo = new Map<string, number>();
const adiados = new Map<string, Sinal>();
let minuto = { inicio: 0, total: 0 };

function entregar(sinal: Sinal) {
  const agora = Date.now();
  if (agora - minuto.inicio > 60_000) minuto = { inicio: agora, total: 0 };
  if (++minuto.total > POR_MINUTO) return;
  ultimoPorTipo.set(sinal.tipo, agora);
  window.dispatchEvent(new CustomEvent<Sinal>(PAINEL_REMOTO, { detail: sinal }));
}

function repassar(sinal: Sinal) {
  const espera = INTERVALO - (Date.now() - (ultimoPorTipo.get(sinal.tipo) ?? 0));
  if (espera <= 0) {
    entregar(sinal);
    return;
  }
  const jaAdiado = adiados.has(sinal.tipo);
  adiados.set(sinal.tipo, sinal);
  if (jaAdiado) return;
  window.setTimeout(() => {
    const ultimo = adiados.get(sinal.tipo);
    adiados.delete(sinal.tipo);
    if (ultimo) entregar(ultimo);
  }, espera);
  if (ultimoPorTipo.size > 300) ultimoPorTipo.clear();
}

function abrir(): Promise<RealtimeChannel | null> {
  canal ??= (async () => {
    if (!temTempoReal || typeof window === "undefined") return null;
    try {
      const supabase = await getClient();
      const aberto = supabase.channel("painel", { config: { broadcast: { self: false } } });
      aberto.on("broadcast", { event: "mudou" }, ({ payload }) => {
        const sinal = payload as Sinal;
        if (!sinal || typeof sinal.tipo !== "string" || sinal.de === marca || !/^[a-z0-9_]{1,60}$/.test(sinal.tipo)) return;
        repassar({ tipo: sinal.tipo, alvo: typeof sinal.alvo === "string" ? sinal.alvo.slice(0, 80) : undefined });
      });
      aberto.subscribe();
      return aberto;
    } catch {
      return null;
    }
  })();
  return canal;
}

/** Avisa os outros painéis de que algo mudou: o nome da ação e, se houver, o alvo. Nunca o conteúdo. */
export function transmitir(tipo: string, alvo?: string) {
  void abrir().then((aberto) => aberto?.send({ type: "broadcast", event: "mudou", payload: { tipo, alvo, de: marca } satisfies Sinal }).catch(() => undefined));
}

/** Chama "aoReceber" a cada sinal vindo de outro painel (só os tipos pedidos, ou todos). Abre o canal na primeira vez. */
export function useSinal(aoReceber: (sinal: Sinal) => void, tipos?: string[]) {
  const ultimo = useRef(aoReceber);
  useEffect(() => {
    ultimo.current = aoReceber;
  });
  const chave = tipos?.join(",") ?? "";
  useEffect(() => {
    void abrir();
    const ouvir = (evento: Event) => {
      const sinal = (evento as CustomEvent<Sinal>).detail;
      if (!sinal) return;
      if (chave && !chave.split(",").some((tipo) => sinal.tipo === tipo || sinal.tipo.startsWith(tipo))) return;
      ultimo.current(sinal);
    };
    window.addEventListener(PAINEL_REMOTO, ouvir);
    return () => window.removeEventListener(PAINEL_REMOTO, ouvir);
  }, [chave]);
}

export interface Presente {
  /** Identificador deste navegador na sala (sorteado; não identifica a conta). */
  chave: string;
  nome: string;
  papel: "educador" | "aluno";
  /** Está com a mão levantada. */
  mao?: boolean;
  /** Quem conduz: a chave pública desta aba (registrada no banco) e a assinatura da própria presença. */
  publica?: string;
  prova?: string;
}

/**
 * A sala de uma aula ao vivo: quem está nela (presença) e os sinais entre navegadores (as mensagens que o WebRTC
 * precisa trocar para ligar o vídeo de um ao outro). Nada disso passa pelo banco nem fica guardado.
 */
export class Sala {
  private canal: RealtimeChannel | null = null;
  private eu: Presente;

  constructor(
    private readonly id: string,
    eu: Presente,
    private readonly aoSinal: (de: string, dados: Record<string, unknown>, assinatura: string) => void,
    private readonly aoPresenca: (presentes: Presente[]) => void,
  ) {
    this.eu = eu;
  }

  /** Entra na sala. Devolve false quando não há canal (teste local): o bate-papo continua, o vídeo não. */
  async entrar(): Promise<boolean> {
    if (!temTempoReal) return false;
    try {
      const supabase = await getClient();
      const canal = supabase.channel(`aula:${this.id}`, { config: { broadcast: { self: false }, presence: { key: this.eu.chave } } });
      canal.on("broadcast", { event: "sinal" }, ({ payload }) => {
        const p = payload as { para?: string; de?: string; dados?: Record<string, unknown>; assinatura?: unknown };
        if (!p || typeof p.de !== "string" || !p.dados || typeof p.dados !== "object" || (p.para !== "*" && p.para !== this.eu.chave)) return;
        this.aoSinal(p.de, p.dados, typeof p.assinatura === "string" ? p.assinatura.slice(0, 200) : "");
      });
      canal.on("presence", { event: "sync" }, () => {
        const estado = canal.presenceState<Presente>();
        const texto = (valor: unknown) => (typeof valor === "string" ? valor.slice(0, 200) : undefined);
        this.aoPresenca(Object.values(estado).flatMap((lista) => lista.map((item) => ({ chave: String(item.chave ?? ""), nome: String(item.nome ?? "").slice(0, 60), papel: item.papel === "educador" ? "educador" : "aluno", mao: Boolean(item.mao), publica: texto(item.publica), prova: texto(item.prova) }))));
      });
      await new Promise<void>((resolver, recusar) => {
        canal.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void canal.track(this.eu).then(() => resolver());
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") recusar(new Error(status));
        });
      });
      this.canal = canal;
      return true;
    } catch {
      this.canal = null;
      return false;
    }
  }

  /** Manda um sinal para um navegador ("para" é a chave dele) ou para todos ("*"), com a assinatura de quem conduz. */
  enviar(para: string, dados: Record<string, unknown>, assinatura?: string) {
    void this.canal?.send({ type: "broadcast", event: "sinal", payload: { para, de: this.eu.chave, dados, ...(assinatura ? { assinatura } : {}) } }).catch(() => undefined);
  }

  /** Atualiza o que os outros veem de mim (a mão levantada, por exemplo). */
  async atualizar(mudanca: Partial<Presente>) {
    this.eu = { ...this.eu, ...mudanca };
    await this.canal?.track(this.eu).catch(() => undefined);
  }

  sair() {
    void this.canal?.unsubscribe();
    this.canal = null;
  }
}
