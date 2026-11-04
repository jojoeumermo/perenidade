// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "consertos" ao banco (supabase/migracoes/2026-11-rede-consertos.sql). Usa o `chamar` da fundação.
import { chamar, type Chamar } from "./cliente";
import type { AbaComContador, ConviteCriado, ConviteDaLista, EntradaPorConvite, ModoDaLinha, PaginaDaLinhaAntiga } from "./tipos-consertos";

export function criarClienteConsertos(c: Chamar) {
  return {
    /** A linha da Rede de hoje, por cursor (20 por vez). */
    linha: <P>(modo: ModoDaLinha, opcoes: { comunidade?: string | null; usuario?: string | null; cursor?: string | null; limite?: number } = {}) =>
      c<PaginaDaLinhaAntiga<P>>("rede_fix_linha", { p_modo: modo, p_comunidade: opcoes.comunidade ?? null, p_usuario: opcoes.usuario ?? null, p_cursor: opcoes.cursor ?? null, p_limite: opcoes.limite ?? 20 }),
    /** "N novos" de uma linha. */
    novos: (modo: ModoDaLinha, desde: string, opcoes: { comunidade?: string | null; usuario?: string | null } = {}) =>
      c<number>("rede_fix_novos", { p_modo: modo, p_comunidade: opcoes.comunidade ?? null, p_usuario: opcoes.usuario ?? null, p_desde: desde }),
    /** "N novos" por aba, de uma vez: `desde` tem a última abertura de cada aba. */
    novosPorAba: (desde: Partial<Record<AbaComContador, string>>) => c<Partial<Record<AbaComContador, number>>>("rede_fix_novos_abas", { p_desde: desde }),
    /** Declara 18 anos ou mais (true) ou menos (false). */
    confirmarIdade: (maior: boolean) => c<{ ok: boolean; maior: boolean; menor?: boolean }>("rede_confirmar_idade", { p_maior: maior }),
    conviteCriar: (alvo: string, opcoes: { escopo?: "membro" | "mediacao"; dias?: number; usos?: number } = {}) =>
      c<ConviteCriado>("rede_fix_convite_criar", { p_alvo: alvo, p_escopo: opcoes.escopo ?? "membro", p_dias: opcoes.dias ?? 7, p_usos: opcoes.usos ?? 1 }),
    conviteUsar: (codigo: string) => c<EntradaPorConvite>("rede_fix_convite_usar", { p_codigo: codigo }),
    conviteRevogar: (id: string) => c<{ ok: boolean }>("rede_fix_convite_revogar", { p_id: id }),
    convites: (alvo: string) => c<ConviteDaLista[]>("rede_fix_convites_listar", { p_alvo: alvo }),
  };
}

export const consertos = criarClienteConsertos(chamar);
