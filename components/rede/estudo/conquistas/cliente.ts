// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As chamadas da ponte com a Escola (frente 11E) ao banco (supabase/migracoes/20261117-alumia-o11-escola.sql). Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória da aba (./exemplos): nada sai do aparelho.
import { chamar } from "@/lib/rede/cliente";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { duble } from "./exemplos";
import type { ConquistasDoPerfil, Inscricao, MinhaInscricao, MinhasConquistas, TopicoDaAula } from "./regras";

const c = <T>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => (previaDaAlumiaLigada() ? duble<T>(funcao, argumentos) : chamar<T>(funcao, argumentos));

export interface CamposDaInscricao {
  como: "perfil" | "codinome";
  codinome?: string;
  curso?: string;
  instituicao?: string;
  recado?: string;
}

export const conquistas = {
  // Medalhas e faixa.
  minhas: () => c<MinhasConquistas>("alumia_conquistas_minhas"),
  mostrar: (medalha: string, alvo: string, mostrar: boolean) => c<{ mostrar: boolean }>("alumia_conquista_mostrar", { p_medalha: medalha, p_alvo: alvo, p_mostrar: mostrar }),
  trilha: (trilha: string, ligar: boolean) => c<{ trilha: string; ligada: boolean }>("alumia_conquista_trilha", { p_trilha: trilha, p_ligar: ligar }),
  apagar: (medalha: string, alvo: string) => c<{ apagada: boolean }>("alumia_conquista_apagar", { p_medalha: medalha, p_alvo: alvo }),
  faixa: (mostrar: boolean) => c<{ mostrar: boolean }>("alumia_reputacao_mostrar", { p_mostrar: mostrar }),
  doPerfil: (handle: string) => c<ConquistasDoPerfil>("alumia_conquistas_de", { p_handle: handle }),

  // O tópico da aula.
  topico: (comunidade: string, aula: string) => c<TopicoDaAula>("alumia_aula_topico", { p_comunidade: comunidade, p_aula: aula }),

  // O mural de aprovados.
  mural: (cursor: string | null = null, limite = 30) => c<{ itens: Inscricao[]; proximo: string | null }>("alumia_mural", { p_cursor: cursor, p_limite: limite }),
  minhaInscricao: () => c<MinhaInscricao | null>("alumia_mural_meu"),
  entrar: (campos: CamposDaInscricao) => c<Inscricao>("alumia_mural_entrar", { p: campos }),
  sair: () => c<{ saiu: boolean }>("alumia_mural_sair"),
  tirar: (id: string, motivo: string) => c<{ tirada: boolean }>("alumia_mural_tirar", { p_id: id, p_motivo: motivo }),
};
