// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O vídeo que está sendo posto no post (um por vez, só nesta aba): a ferramenta do compositor e o cartão do vídeo leem o mesmo
// estado; a verificação de antes de publicar segura o "Publicar" enquanto ele prepara ou sobe; depois de publicar, ele é ligado
// ao post. Nada daqui fica guardado no aparelho: fechar a aba esquece tudo (e a reserva no banco vence sozinha em 24 horas).
import { useSyncExternalStore } from "react";
import type { InfoDoVideoEscolhido } from "@/lib/rede/midia/regravar";

export type FaseDoVideo = "vazio" | "escolhido" | "preparando" | "enviando" | "pronto";

export interface VideoPendente {
  fase: FaseDoVideo;
  /** Endereço local (blob:) do arquivo escolhido; depois de preparado, o do arquivo regravado. */
  url: string;
  info: InfoDoVideoEscolhido | null;
  inicio: number;
  som: boolean;
  alt: string;
  progresso: number;
  /** O id da reserva no banco (depois de enviado). */
  id: string | null;
  /** A duração do arquivo regravado (ms). */
  duracao: number;
  erro: string;
}

const VAZIO: VideoPendente = { fase: "vazio", url: "", info: null, inicio: 0, som: true, alt: "", progresso: 0, id: null, duracao: 0, erro: "" };

let atual: VideoPendente = VAZIO;
let cancelar: AbortController | null = null;
const ouvintes = new Set<() => void>();

export function videoPendente(): VideoPendente {
  return atual;
}

export function mudarVideo(m: Partial<VideoPendente>): void {
  atual = { ...atual, ...m };
  ouvintes.forEach((f) => f());
}

/** Esquece o vídeo (e para o preparo, se estava preparando). */
export function esquecerVideoPendente(): void {
  cancelar?.abort();
  cancelar = null;
  if (atual.url.startsWith("blob:")) URL.revokeObjectURL(atual.url);
  atual = VAZIO;
  ouvintes.forEach((f) => f());
}

/** Um sinal novo para o preparo (o anterior, se havia, é cancelado). */
export function novoSinal(): AbortSignal {
  cancelar?.abort();
  cancelar = new AbortController();
  return cancelar.signal;
}

export function useVideoPendente(): VideoPendente {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => void ouvintes.delete(f);
    },
    () => atual,
    () => VAZIO,
  );
}
