// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "conversa" da Rede v2 ao banco: uma função por rpc (supabase/migracoes/2026-11-rede-conversa.sql).
// Usa `chamar` da fundação; os testes podem trocar por uma forma simulada. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { Post } from "./tipos";
import type { Arvore, OrdemDasRespostas, PedidoDeCitacao, SinteseDaConversa, SugestaoDeMencao, VersaoDaSintese } from "./tipos-conversa";

export function criarClienteDaConversa(c: Chamar) {
  return {
    /** A página de um post com a conversa em árvore, já na ordem pedida (mais úteis, mais antigas, mais novas). */
    arvore: (id: string, ordem: OrdemDasRespostas = "uteis") => c<Arvore>("rede_conv_arvore", { p_id: id, p_ordem: ordem }),
    /** Marca (ou desmarca) a resposta que resolveu a dúvida. Só quem fez a dúvida ou a moderação. */
    aceitar: (resposta: string, sim: boolean) => c<{ aceita: string | null }>("rede_conv_aceitar", { p_resposta: resposta, p_sim: sim }),
    /** Escreve a síntese fixada (texto vazio retira a atual). Só quem abriu a conversa ou a moderação. */
    sintese: (raiz: string, texto: string) => c<SinteseDaConversa | null>("rede_conv_sintese", { p_raiz: raiz, p_texto: texto }),
    /** As versões da síntese, da mais nova para a mais antiga. */
    historicoDaSintese: (raiz: string) => c<VersaoDaSintese[]>("rede_conv_sintese_historico", { p_raiz: raiz }),
    /** Quem sugerir quando a pessoa digita @ (com o post, só quem poderia vê-lo). */
    sugerir: (prefixo: string, post: string | null = null) => c<SugestaoDeMencao[]>("rede_conv_sugerir", { p_prefixo: prefixo, p_post: post }),
    /** Publica uma citação de outro post (todas as conferências de publicar valem). */
    citar: (pedido: PedidoDeCitacao) => c<Post>("rede_conv_citar", { p: pedido }),
    /**
     * Onda 5 (F3): reage (ou desfaz) com um emoji da lista fechada (REACOES, lib/rede/tipos-conversa.ts). Volta só os totais por
     * emoji (nulo abaixo de 3) e as minhas; NUNCA quem reagiu. A função do banco vem na migração da F3 (back-end).
     */
    reagirEmoji: (post: string, emoji: string, sim: boolean) =>
      c<{ reacoes: { emoji: string; total: number | null; minha: boolean }[] }>("rede_reagir_emoji", { p_post: post, p_emoji: emoji, p_sim: sim }),
  };
}

export const conversa = criarClienteDaConversa(chamar);
