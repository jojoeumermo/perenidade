// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "conversa" da Rede v2 ao banco: uma função por rpc (supabase/migracoes/2026-11-rede-conversa.sql).
// Usa `chamar` da fundação; os testes podem trocar por uma forma simulada. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { Post } from "./tipos";
import type { NotasDoPost } from "./tipos-b1";
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

    // Onda A/B (20261110-alumia-comunidade.sql): seguir a conversa e o #tema. Ninguém vê quem segue; o aviso chega agrupado.
    /** Segue (ou deixa de seguir) a conversa inteira (pela raiz). */
    seguir: (raiz: string, sim: boolean) => c<{ seguindo: boolean }>("rede_alumia_seguir_conversa", { p_post: raiz, p_sim: sim }),
    /** Se a pessoa segue esta conversa e/ou este #tema (nulo quando não foi perguntado). */
    seguindo: (raiz: string | null, tag: string | null = null) =>
      c<{ conversa: boolean | null; tag: boolean | null }>("rede_alumia_seguindo", { p_post: raiz, p_tag: tag }),
    /** Segue (ou deixa de seguir) um #tema. */
    seguirTag: (tag: string, sim: boolean) => c<{ seguindo: boolean }>("rede_alumia_seguir_tag", { p_tag: tag, p_sim: sim }),
    /** Os #temas que a própria pessoa segue (só ela vê a lista dela). */
    tagsSeguidas: () => c<{ tags: string[] }>("rede_alumia_tags_seguidas", {}),

    // B1 (20261110-alumia-b1-comunidade.sql): notas de contexto. Quem propôs e quem avaliou nunca voltam; o total de votos também não.
    /** As notas do post: as que aparecem, as que a pessoa pode avaliar, a dela e o que ela pode fazer. */
    notas: (post: string) => c<NotasDoPost>("rede_alumia_notas", { p_post: post }),
    /** Propõe (ou reescreve) a nota da pessoa: nível 2, com fonte, sem dado pessoal. Reescrever zera os votos. */
    proporNota: (post: string, texto: string, fonte: string) => c<{ id: string; situacao: string }>("rede_alumia_nota_propor", { p_post: post, p_texto: texto, p_fonte: fonte }),
    /** "Ajuda" (true), "não ajuda" (false) ou tira a avaliação (null). Volta só a avaliação dela e se a nota aparece. */
    avaliarNota: (nota: string, ajuda: boolean | null) => c<{ minha: boolean | null; mostrada: boolean }>("rede_alumia_nota_avaliar", { p_nota: nota, p_ajuda: ajuda }),
    retirarNota: (nota: string) => c<{ retirada: boolean }>("rede_alumia_nota_retirar", { p_nota: nota }),
    /** A moderação oculta (sim) ou devolve (não) uma nota. */
    ocultarNota: (nota: string, sim: boolean) => c<{ situacao: string }>("rede_alumia_nota_ocultar", { p_nota: nota, p_sim: sim }),
  };
}

export const conversa = criarClienteDaConversa(chamar);
