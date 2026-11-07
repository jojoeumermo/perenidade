// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote descoberta ao banco (supabase/migracoes/2026-11-rede-descoberta.sql). Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { Aba } from "./tipos";
import type {
  EstadoDaEntrada, Explorar, FiltrosDaLinha, LutaOpcao, Ordem, OrdemDaBusca, PacoteDePessoas, PaginaDaTag, PaginaOrdenada, ResultadoDaBusca,
} from "./tipos-descoberta";

export function criarClienteDescoberta(c: Chamar) {
  return {
    /** Em que passo da primeira entrada a pessoa está (vale também para visitante: "entrar"). */
    estado: () => c<EstadoDaEntrada>("rede_desc_entrada_estado"),
    /** As lutas que dá para escolher. As trilhas vêm do catálogo do site. */
    opcoes: () => c<{ lutas: LutaOpcao[] }>("rede_desc_entrada_opcoes"),
    /** Grava as 3 lutas e as trilhas (1 a 3); `aparece` liga "aparecer nos pacotes de pessoas" (desligado por padrão). */
    escolher: (lutas: string[], trilhas: string[], aparece = false) => c<EstadoDaEntrada>("rede_desc_entrada_escolher", { p_lutas: lutas, p_trilhas: trilhas, p_aparece: aparece }),
    /** O guia de segurança foi visto ou pulado (o único passo que se pode pular). */
    guia: (pulado: boolean) => c<EstadoDaEntrada>("rede_desc_entrada_guia", { p_pulado: pulado }),
    /** "Agora não": lutas, trilhas e guia ficam para depois (T18: só consentimento, 18+ e codinome são obrigatórios). */
    adiar: () => c<EstadoDaEntrada>("rede_desc_entrada_adiar"),
    aparecer: (sim: boolean) => c<EstadoDaEntrada>("rede_desc_aparecer", { p_sim: sim }),
    /** A linha com ordenação escrita e filtros (linha temática, tag, categoria, tipo, comunidade). */
    linha: (aba: Aba, ordem: Ordem = "novos", cursor: string | null = null, limite = 20, filtros: FiltrosDaLinha = {}) =>
      c<PaginaOrdenada>("rede_desc_linha", { p_aba: aba, p_ordem: ordem, p_cursor: cursor, p_limite: limite, p_filtros: filtros }),
    tag: (tag: string, ordem: Ordem = "novos", cursor: string | null = null, limite = 20) => c<PaginaDaTag>("rede_desc_tag", { p_tag: tag, p_ordem: ordem, p_cursor: cursor, p_limite: limite }),
    buscar: (q: string, ordem: OrdemDaBusca = "relevancia", cursor: string | null = null, limite = 20) => c<ResultadoDaBusca>("rede_desc_buscar", { p_q: q, p_ordem: ordem, p_cursor: cursor, p_limite: limite }),
    explorar: () => c<Explorar>("rede_desc_explorar"),
    pacote: (slug: string) => c<PacoteDePessoas>("rede_desc_pacote", { p_slug: slug }),
    seguirPacote: (slug: string) => c<{ seguidos: number }>("rede_desc_pacote_seguir", { p_slug: slug }),
  };
}

export const redeDescoberta = criarClienteDescoberta(chamar);
