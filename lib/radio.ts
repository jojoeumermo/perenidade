// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useSyncExternalStore } from "react";
import { hasBackend, hasSession, rpc } from "./backend";
import { getItem, KEYS, parse, setItem } from "./storage";

export interface Track {
  id: string;
  titulo: string;
  artista: string;
  url: string;
  /** Transmissão ao vivo: não tem começo nem fim, então não guarda onde a pessoa parou. */
  live?: boolean;
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
}

// O estado da rádio mora fora dos componentes para o som não parar quando a pessoa muda de página.
let player: Player = { radio: null, queue: [], index: 0, playing: false };
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
  play(queue: Track[], index: number) {
    emit({ queue, index, playing: true });
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
    if (hasSession()) void rpc("progresso_salvar", { p_faixa: id, p_segundos: Math.floor(seconds) }).catch(() => {});
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
