// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da B1 da comunidade ao banco (supabase/migracoes/20261110-alumia-b1-comunidade.sql): wiki, conversas que sigo,
// temas seguidos, busca com operadores e salva, pastas, "Pergunte a…", posts que se repetem e lembretes. As notas de contexto
// ficam em cliente-conversa.ts (são da conversa). Usa `chamar` da fundação. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { Post } from "./tipos";
import type {
  BuscaSalva,
  CaixaDePerguntas,
  ConversaSeguida,
  Lembrete,
  PastasDaPessoa,
  Repeticao,
  SerieAgendada,
  VersaoDaWiki,
  WikiDaComunidade,
} from "./tipos-b1";
import type { OrdemDaBusca, ResultadoDaBusca } from "./tipos-descoberta";

type Pagina<T> = { itens: T[]; proximo: string | null };

export function criarClienteDaB1(c: Chamar) {
  return {
    // Wiki: quem vê a comunidade lê; quem é dela edita; o histórico só mostra quem editou para a moderação.
    wiki: (slug: string, pagina: string | null = null) => c<WikiDaComunidade>("rede_alumia_wiki", { p_slug: slug, p_pagina: pagina }),
    wikiSalvar: (slug: string, pagina: string | null, titulo: string, corpo: string, resumo: string, base: number | null) =>
      c<{ pagina: string; versao: number }>("rede_alumia_wiki_salvar", { p_slug: slug, p_pagina: pagina, p_titulo: titulo, p_corpo: corpo, p_resumo: resumo, p_base: base }),
    wikiHistorico: (slug: string, pagina: string) => c<{ modera: boolean; versoes: VersaoDaWiki[] }>("rede_alumia_wiki_historico", { p_slug: slug, p_pagina: pagina, p_versao: null }),
    wikiVersao: (slug: string, pagina: string, versao: number) =>
      c<{ versao: number; titulo: string; corpo: string; resumo: string; criado_em: string; editou: string | null }>("rede_alumia_wiki_historico", { p_slug: slug, p_pagina: pagina, p_versao: versao }),
    wikiRestaurar: (slug: string, pagina: string, versao: number) => c<{ pagina: string; versao: number }>("rede_alumia_wiki_restaurar", { p_slug: slug, p_pagina: pagina, p_versao: versao }),
    wikiTravar: (slug: string, pagina: string, sim: boolean, apagar = false) =>
      c<{ travada?: boolean; apagada?: boolean }>("rede_alumia_wiki_travar", { p_slug: slug, p_pagina: pagina, p_sim: sim, p_apagar: apagar }),

    // Conversas que sigo (LGPD art. 18: ver e apagar sem abrir cada uma).
    seguidas: (cursor: string | null = null) => c<Pagina<ConversaSeguida> & { total: number; teto: number }>("rede_alumia_conversas_seguidas", { p_cursor: cursor, p_limite: 30 }),
    deixarConversas: (raizes: string[] | null) => c<{ removidas: number }>("rede_alumia_deixar_conversas", { p_raizes: raizes }),

    // A aba dos #temas: um tema (sempre do mais novo) ou todos os seguidos (tag nula).
    linhaDosTemas: (tag: string | null, cursor: string | null = null) => c<Pagina<Post> & { tags: string[] }>("rede_alumia_linha_tags", { p_tag: tag, p_cursor: cursor, p_limite: 20 }),

    // Busca com operadores (sem operador, a busca de sempre) e busca salva.
    buscar: (q: string, ordem: OrdemDaBusca, cursor: string | null = null) =>
      c<ResultadoDaBusca & { operadores?: Record<string, string> }>("rede_alumia_buscar", { p_q: q, p_ordem: ordem, p_cursor: cursor, p_limite: 20 }),
    buscasSalvas: () => c<{ itens: BuscaSalva[] }>("rede_alumia_buscas_salvas", {}),
    salvarBusca: (nome: string, q: string) => c<BuscaSalva>("rede_alumia_busca_salvar", { p_nome: nome, p_q: q }),
    apagarBusca: (id: string) => c<{ apagada: boolean }>("rede_alumia_busca_apagar", { p_id: id }),

    // Pastas dos salvos: privadas e do núcleo (sem quem guardou).
    pastas: (post: string | null = null) => c<PastasDaPessoa>("rede_alumia_pastas", { p_post: post }),
    criarPasta: (nome: string, nucleo: string | null = null) => c<{ id: string; nome: string }>("rede_alumia_pasta_criar", { p_nome: nome, p_nucleo: nucleo }),
    mudarPasta: (id: string, nome: string | null) => c<{ id?: string; nome?: string; apagada?: boolean }>("rede_alumia_pasta_mudar", { p_id: id, p_nome: nome }),
    porNaPasta: (pasta: string, post: string, sim: boolean) => c<{ na_pasta: boolean }>("rede_alumia_pasta_por", { p_pasta: pasta, p_post: post, p_sim: sim }),
    postsDaPasta: (pasta: string, cursor: string | null = null) =>
      c<Pagina<Post> & { pasta: { id: string; nome: string; nucleo: boolean } }>("rede_alumia_pasta_posts", { p_pasta: pasta, p_cursor: cursor, p_limite: 20 }),

    // "Pergunte a…": de uma pessoa (@) ou de uma comunidade (slug).
    caixa: (alvo: { handle?: string; slug?: string }) => c<CaixaDePerguntas>("rede_alumia_caixa", { p_handle: alvo.handle ?? null, p_slug: alvo.slug ?? null }),
    ajustarCaixa: (slug: string | null, aberta: boolean, anonimas: boolean, chamada: string) =>
      c<{ aberta: boolean; anonimas: boolean; chamada: string }>("rede_alumia_caixa_ajustar", { p_slug: slug, p_aberta: aberta, p_anonimas: anonimas, p_chamada: chamada }),
    perguntar: (alvo: { handle?: string; slug?: string }, texto: string, anonima: boolean, mostrarNome: boolean) =>
      c<{ id: string }>("rede_alumia_perguntar", { p_handle: alvo.handle ?? null, p_slug: alvo.slug ?? null, p_texto: texto, p_anonima: anonima, p_mostrar_nome: mostrarNome }),
    tratarPergunta: (id: string, resposta: string | null, retirar = false) =>
      c<{ situacao?: string; retirada?: boolean }>("rede_alumia_pergunta_tratar", { p_id: id, p_resposta: resposta, p_retirar: retirar }),

    // Posts que se repetem ("assembleia toda terça").
    agendarSerie: (pedido: Record<string, unknown>, quando: string, repetir: Repeticao, ate: string | null) =>
      c<{ id: string; serie: string; quando: string; repetir: Repeticao; ate: string }>("rede_alumia_agendar_serie", { p: pedido, p_quando: quando, p_repetir: repetir, p_ate: ate }),
    series: () => c<{ itens: SerieAgendada[] }>("rede_alumia_series", {}),
    pararSerie: (serie: string) => c<{ parada: boolean }>("rede_alumia_serie_parar", { p_serie: serie }),

    // Lembrar mais tarde (aviso privado do tipo 'lembrete').
    lembrar: (post: string, quando: string | null) => c<{ quando: string | null }>("rede_alumia_lembrar", { p_post: post, p_quando: quando }),
    lembretes: (post: string | null = null) => c<{ itens: Lembrete[] }>("rede_alumia_lembretes", { p_post: post }),
  };
}

export const b1 = criarClienteDaB1(chamar);
