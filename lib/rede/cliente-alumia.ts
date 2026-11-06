// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas das telas novas da Alumia ao banco (supabase/migracoes/2026-11-alumia.sql): Salvos e a federação com o Fediverso.
// Buscar e seguir alguém de fora passam pelas rotas do servidor (app/api/fediverso/{buscar,seguir}), com o token da própria
// pessoa: o navegador nunca fala com a outra instância. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { PaginaDaLinha } from "./tipos";

export interface SituacaoDaFederacao {
  logado: boolean;
  ligado: boolean;
  pode: boolean;
  motivo: string | null;
  handle?: string | null;
  desde?: string | null;
  seguidores?: number;
  seguindo?: number;
  versao: number;
}

export interface SeguidoDeFora {
  ator: string;
  aceito: boolean;
  handle: string | null;
  nome: string | null;
  url: string | null;
  desde: string;
}

export interface PostDeFora {
  id: string;
  url: string | null;
  texto: string;
  aviso: string;
  publicado: string | null;
  ator?: string;
  handle?: string | null;
  nome?: string | null;
}

export interface PerfilDeFora {
  local?: boolean;
  handle: string | null;
  ator?: string;
  nome?: string | null;
  resumo?: string | null;
  url?: string | null;
  posts?: PostDeFora[];
  seguindo?: "nao" | "pedido" | "sim";
  ligado?: boolean;
}

export interface InstanciaBloqueada {
  dominio: string;
  motivo: string;
  desde: string;
}

export function criarClienteDaAlumia(c: Chamar) {
  return {
    /** O que a pessoa salvou (só o que ela ainda pode ver). `cursor` é o `proximo` da página anterior. */
    salvos: (cursor: string | null = null, limite = 20) => c<PaginaDaLinha>("rede_alumia_salvos", { p_cursor: cursor, p_limite: limite }),
    /** A situação da federação da própria pessoa. */
    situacao: () => c<SituacaoDaFederacao>("rede_fed_situacao"),
    /** Liga (com a versão do consentimento lida na tela) ou desliga a federação. */
    ligar: (sim: boolean, versao: number | null = null) => c<SituacaoDaFederacao>("rede_fed_ligar", { p_sim: sim, p_versao: versao }),
    seguindo: () => c<SeguidoDeFora[]>("rede_fed_seguindo_lista"),
    /** Os posts recentes de quem a pessoa segue fora daqui; `antes` é a data do último já mostrado. */
    linha: (antes: string | null = null) => c<PostDeFora[]>("rede_fed_linha", { p_antes: antes }),
    /** Só a mediação: bloqueia (ou desbloqueia) uma instância e devolve a lista. */
    bloquear: (dominio: string, sim: boolean, motivo = "") => c<InstanciaBloqueada[]>("rede_fed_bloquear", { p_dominio: dominio, p_sim: sim, p_motivo: motivo }),
    /** Só a mediação: a lista das instâncias bloqueadas, sem mudar nada. */
    bloqueadas: () => c<InstanciaBloqueada[]>("rede_fed_bloquear", { p_dominio: "", p_sim: null, p_motivo: "" }),
  };
}

export const alumia = criarClienteDaAlumia(chamar);
