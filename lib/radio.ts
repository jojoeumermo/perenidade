// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { hasBackend, hasSession, rpc } from "./backend";
import type { Capitulo } from "./podcast";
import { getItem, KEYS, parse, setItem } from "./storage";

export interface Track {
  id: string;
  titulo: string;
  artista: string;
  url: string;
  /** Transmissão ao vivo: não tem começo nem fim, então não guarda onde a pessoa parou. */
  live?: boolean;
  /** Episódio de podcast: o tocador ganha capa, barra com a forma da onda, velocidade e saltos de 15 e 30 segundos. */
  podcast?: { episodio: string; capa: string; href: string; duracao: number; picos: number[]; capitulos: Capitulo[] };
}

export interface Channel {
  id: string;
  nome: string;
  descricao: string;
  faixas: Track[];
}

export interface RadioState {
  no_ar: boolean;
  ao_vivo?: string;
  canais?: Channel[];
}

interface Player {
  /** null enquanto a programação não foi consultada. */
  radio: RadioState | null;
  queue: Track[];
  index: number;
  playing: boolean;
  /** Onde o som está (em segundos, de segundo em segundo) e quanto dura: a página do episódio acompanha a transcrição. */
  time: number;
  duration: number;
  rate: number;
  /** Pedido de salto: o tocador vai para "at" sempre que "n" muda. */
  seek: { at: number; n: number } | null;
}

const RATE = "lucia:velocidade";
const savedRate = () => {
  try {
    const value = Number(localStorage.getItem(RATE));
    return value >= 0.5 && value <= 3 ? value : 1;
  } catch {
    return 1;
  }
};

// O estado da rádio mora fora dos componentes para o som não parar quando a pessoa muda de página.
let player: Player = { radio: null, queue: [], index: 0, playing: false, time: 0, duration: 0, rate: 1, seek: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<Player>) => {
  player = { ...player, ...next };
  listeners.forEach((listener) => listener());
};

export function usePlayer(): Player {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => player,
    () => player,
  );
}

let loading: Promise<void> | null = null;

/** Consulta a programação uma vez por visita. Fora do ar, o público recebe só { no_ar: false }. */
export function loadRadio(force = false): Promise<void> {
  if (!hasBackend) {
    if (!player.radio) emit({ radio: { no_ar: false } });
    return Promise.resolve();
  }
  if (!loading || force) {
    loading = rpc<RadioState>("radio_estado")
      .then((radio) => emit({ radio }))
      .catch(() => emit({ radio: { no_ar: false } }));
  }
  return loading;
}

export const radio = {
  play(queue: Track[], index: number, at?: number) {
    emit({ queue, index, playing: true, time: 0, duration: 0, rate: savedRate(), seek: at === undefined ? null : { at, n: (player.seek?.n ?? 0) + 1 } });
  },
  /** Vai para um ponto da faixa (capítulo, trecho da transcrição, comentário com tempo). */
  seek(at: number) {
    emit({ seek: { at: Math.max(0, at), n: (player.seek?.n ?? 0) + 1 }, playing: true });
  },
  skip(delta: number) {
    radio.seek(Math.max(0, Math.min(player.duration || Infinity, player.time + delta)));
  },
  setRate(rate: number) {
    try {
      localStorage.setItem(RATE, String(rate));
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    emit({ rate });
  },
  /** O tocador avisa onde está; só muda o estado quando o segundo muda, para não redesenhar a página à toa. */
  tick(time: number, duration: number) {
    const next = Math.floor(time);
    const total = Number.isFinite(duration) ? Math.floor(duration) : 0;
    if (next !== player.time || total !== player.duration) emit({ time: next, duration: total });
  },
  toggle() {
    if (player.queue.length > 0) emit({ playing: !player.playing });
  },
  pause() {
    emit({ playing: false });
  },
  next() {
    if (player.index < player.queue.length - 1) emit({ index: player.index + 1, playing: true });
    else emit({ playing: false });
  },
  previous() {
    if (player.index > 0) emit({ index: player.index - 1, playing: true });
  },
  close() {
    emit({ queue: [], index: 0, playing: false });
  },
};

/** Onde a pessoa parou em cada faixa: fica no navegador e, para quem tem conta, também na conta. */
export const positions = {
  get(id: string): number {
    return parse<Record<string, number>>(getItem(KEYS.radio), {})[id] ?? 0;
  },
  save(id: string, seconds: number) {
    const all = parse<Record<string, number>>(getItem(KEYS.radio), {});
    all[id] = Math.floor(seconds);
    setItem(KEYS.radio, JSON.stringify(all));
    // Episódio de podcast fica só no navegador: a conta guarda o progresso das faixas da rádio.
    if (hasSession() && !id.startsWith("podcast:")) void rpc("progresso_salvar", { p_faixa: id, p_segundos: Math.floor(seconds) }).catch(() => {});
  },
  /** Traz da conta o que foi ouvido em outro aparelho. */
  async sync() {
    if (!hasBackend || !hasSession()) return;
    try {
      const remote = await rpc<Record<string, number>>("progresso_listar");
      setItem(KEYS.radio, JSON.stringify({ ...parse<Record<string, number>>(getItem(KEYS.radio), {}), ...remote }));
    } catch {
      // sem conexão: vale o que está no navegador
    }
  },
};
