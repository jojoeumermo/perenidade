// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote avisos ao banco (supabase/migracoes/2026-11-rede-avisos.sql): uma função por rpc. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { CanalDeAviso, PaginaDeAvisos, PreferenciasDeAviso, ResumoDeAviso, TipoDeAviso } from "./tipos-avisos";

export function criarClienteDeAvisos(c: Chamar) {
  return {
    /** Os avisos agrupados; `cursor` é o `proximo` da página anterior. */
    listar: (cursor: string | null = null, limite = 20) => c<PaginaDeAvisos>("rede_aviso_listar", { p_cursor: cursor, p_limite: limite }),
    /** Quantos grupos ainda não foram lidos (o número do menu). */
    contar: () => c<number>("rede_aviso_contar"),
    /** Marca o grupo do aviso como lido; sem id, marca todos. */
    ler: (id: string | null = null) => c<{ ok: boolean; nao_lidos: number }>("rede_aviso_ler", { p_id: id }),
    prefs: () => c<PreferenciasDeAviso>("rede_aviso_prefs_ver"),
    /** Liga ou desliga um tipo num canal ('site', 'push'; e-mail só para o tipo 'resumo'). */
    salvarPref: (tipo: TipoDeAviso | "resumo", canal: CanalDeAviso, ligado: boolean) => c<PreferenciasDeAviso>("rede_aviso_prefs_salvar", { p_tipo: tipo, p_canal: canal, p_ligado: ligado }),
    /** O que o resumo semanal levaria agora (nada é enviado). */
    resumoVer: () => c<ResumoDeAviso>("rede_aviso_resumo_ver"),
    pushAssinar: (endpoint: string, p256dh: string, auth: string, lang: string) => c<PreferenciasDeAviso>("rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_lang: lang }),
    pushCancelar: (endpoint: string | null = null) => c<{ removidos: number; push_aparelhos: number }>("rede_aviso_push_cancelar", { p_endpoint: endpoint }),
  };
}

export const avisos = criarClienteDeAvisos(chamar);
