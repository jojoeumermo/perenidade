// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos do pacote "perfil" da Rede Lúcia v2: o que as funções rede_perfil_* devolvem (supabase/migracoes/2026-11-rede-perfil.sql).
// Sem os atalhos "@/" de propósito (roda no Node nos testes). Sem contagem pública de seguidores, de seguidos ou de apoios.
import type { Perfil } from "./tipos";

/** Uma imagem de perfil (rosto ou capa): do catálogo do projeto, enviada pela pessoa, ou nenhuma (iniciais, sem capa). */
export type ImagemDePerfil =
  | { tipo: null }
  | { tipo: "galeria"; id: string }
  /** `pendente`: só a própria pessoa vê enquanto a mediação não aceitar. */
  | { tipo: "envio"; dados: string; pendente: boolean };

/** O que a pessoa mostra em "estudando agora": a última aula aberta no aparelho dela, só se ela ligou. */
export interface Estudando {
  trilha?: string;
  /** Caminho da aula sem o prefixo de idioma, sempre sob /trilhas/. */
  aula?: string;
  titulo?: string;
}

/**
 * Um selo da Escola de Formação no perfil (supabase/migracoes/20261108-escola-conquistas.sql): 'escola:carteirinha',
 * 'escola:degrau-N', 'escola:caderno-NN' e a contagem 'escola:aulas-N' (nunca a lista de aulas). Vêm em `selos` JÁ
 * FILTRADOS no servidor pelo público que a pessoa escolheu na Escola (padrão: ninguém). Leitura: lib/escola/conquistas.ts.
 */
export type SeloDaEscolaNoPerfil = "escola:carteirinha" | `escola:degrau-${1 | 2 | 3}` | `escola:caderno-${string}` | `escola:aulas-${number}`;

/** O perfil de alguém, como a v2 mostra (amplia `Perfil` da fundação; `selos` são 'equipe', 'educador', 'moderacao', 'trilha:<slug>' e os 'escola:*'). */
export interface PerfilDaRede extends Perfil {
  avatar: ImagemDePerfil;
  capa: ImagemDePerfil;
  estudando: Estudando | null;
  /** Só no próprio perfil: quantos pedidos para seguir esperam resposta. */
  pedidos: number | null;
}

/** O que a pessoa edita no próprio perfil (só ela vê). */
export interface PerfilMeu {
  id: string;
  codinome: string | null;
  handle: string | null;
  bio: string;
  modo: "aberto" | "trancado" | "invisivel";
  avatar: ImagemDePerfil;
  capa: ImagemDePerfil;
  /** Nulo = desligado. Com `ligado`, a aula pode ainda não existir. */
  estudando: (Estudando & { ligado: true }) | null;
  selos_trilhas: string[];
  selos_mostrar: boolean;
  selos: string[];
  /** Quando dá para trocar o @handle de novo (nulo = já dá). */
  handle_troca_em: string | null;
  pedidos: number;
  fixado: string | null;
}

/** O que `rede_perfil_editar` aceita: só o que vier vale. */
export interface PedidoDeEdicao {
  bio?: string;
  modo?: "aberto" | "trancado" | "invisivel";
  /** 'a01'..'a24', 'envio' ou nulo (iniciais). */
  avatar?: string | null;
  /** 'c01'..'c08', 'envio' ou nulo (sem capa). */
  capa?: string | null;
  estudando?: (Estudando & { ligado?: boolean }) | null;
  selos_trilhas?: string[];
  selos_mostrar?: boolean;
}

export interface PedidoDeSeguir {
  id: string;
  codinome: string;
  handle: string | null;
  quando: string;
}

export interface ImagemNaFila {
  usuario: string;
  codinome: string | null;
  tipo: "avatar" | "capa";
  dados: string;
}
