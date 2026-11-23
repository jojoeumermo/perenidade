// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// O canal de aviso da organização (Prompt 4, item 22): as funções de supabase/migracoes/20261127-p4-perto.sql. A escolha é só da
// própria pessoa; o número só a partir de 3 e só para quem gere a organização; ninguém recebe a lista de quem se inscreveu.
// Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na memória da aba faz a tela andar.
import { rpc } from "../../backend";
import { previaLigada } from "../publicar/alumia2";

export type ModoDoCanal = "nada" | "tudo" | "avisos";
export interface ContagemDoCanal {
  /** null: menos de 3. */
  inscritas: number | null;
  so_avisos: number | null;
  minimo: number;
}

const naPrevia = new Map<string, ModoDoCanal>();

export const canal = {
  async meu(handle: string): Promise<ModoDoCanal> {
    if (previaLigada()) return naPrevia.get(handle) ?? "nada";
    return (await rpc<{ modo: ModoDoCanal }>("rede_p4_canal_meu", { p_handle: handle })).modo;
  },
  async escolher(handle: string, modo: ModoDoCanal): Promise<ModoDoCanal> {
    if (previaLigada()) {
      naPrevia.set(handle, modo);
      return modo;
    }
    return (await rpc<{ modo: ModoDoCanal }>("rede_p4_canal_escolher", { p_handle: handle, p_modo: modo })).modo;
  },
  async contagem(handle: string): Promise<ContagemDoCanal> {
    if (previaLigada()) return { inscritas: 12, so_avisos: null, minimo: 3 };
    return rpc<ContagemDoCanal>("rede_p4_canal_contagem", { p_handle: handle });
  },
};
