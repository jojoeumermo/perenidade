// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "conversa" da Rede v2 ao banco: uma função por rpc (supabase/migracoes/2026-11-rede-conversa.sql).
// Usa `chamar` da fundação; os testes podem trocar por uma forma simulada. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { Post } from "./tipos";
import type { ReacaoDoPost } from "./tipos-conversa";
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

    // Onda 5 (PLANO-ALUMIA F3): supabase/migracoes/20261109-alumia-f3.sql. Só as telas novas (rede-v2 + alumia-2) chamam.
    /** A conversa da tela nova: a mesma árvore + a marca "ajudou", quem pode marcar, os pronomes de quem abriu e as reações do post. */
    alumia: (id: string, ordem: "antigas" | "novas" = "antigas") => c<Arvore>("rede_alumia_conversa", { p_id: id, p_ordem: ordem }),
    /** "ajudou a autora": SÓ quem abriu a conversa marca (ou desmarca). Uma por conversa. */
    ajudou: (resposta: string, sim: boolean) => c<{ ajudou: string | null }>("rede_alumia_ajudou", { p_resposta: resposta, p_sim: sim }),
    /** Reage (ou tira) com um emoji da lista fechada; volta só o total de cada emoji (nulo abaixo de 3), nunca quem. */
    reagirEmoji: (post: string, emoji: string, sim: boolean) => c<{ reacoes: ReacaoDoPost[] }>("rede_alumia_reagir", { p_post: post, p_emoji: emoji, p_sim: sim }),
    /** As reações de até 50 posts de uma vez (post que a pessoa não pode ver não volta). */
    reacoes: (posts: string[]) => c<{ itens: { post: string; reacoes: ReacaoDoPost[] }[] }>("rede_alumia_reacoes", { p_posts: posts }),
  };
}

export const conversa = criarClienteDaConversa(chamar);
