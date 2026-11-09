// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas dos atos ao banco (Onda 5, frente F2; contrato em lib/rede/tipos-atos.ts; funções em
// supabase/migracoes/20261109-alumia-f2.sql). Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, as telas usam o dublê com os dados das pranchas
// (lib/rede/atos/exemplos.ts) e nada vai ao servidor. Sem "@/" de propósito.
//
// Publicar um ato é rede_ato_publicar (publicar(), abaixo): ele chama o rede_publicar de sempre por dentro (todas as conferências
// dele valem) e grava o chamado na mesma transação. O compositor da F1, com o tipo "Ato" escolhido, chama atos.publicar(extras)
// no lugar do rede_publicar.
import { proporcaoValida } from "./mosaico";
import { chamar, type Chamar } from "./cliente";
import { linkDeApoioSeguro } from "./atos/chegar";
import { criarDuble } from "./atos/exemplos";
import { corValida, type Ato, type DadosDoAto, type FiltroDosAtos, type PaginaDeAtos, type PedidoDeMudanca, type RespostaDoVou } from "./tipos-atos";

/** A prévia com dados de exemplo está ligada? (A referência é literal para o Next gravar o valor no código do navegador.) */
export const PREVIA_DOS_ATOS = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

/**
 * Desconfia do que vem do servidor: a proporção só em passos de 10 % (um número de pessoas vira nulo), o total só para quem
 * organizou, o link de apoio só https. Uma função do banco com defeito não consegue mostrar um número de pessoas na tela.
 */
export function limparAto(a: Ato): Ato {
  return {
    ...a,
    acesos: proporcaoValida(a.acesos),
    total: a.meu && typeof a.total === "number" ? a.total : null,
    link_apoio: linkDeApoioSeguro(a.link_apoio),
    respostas: Number.isFinite(a.respostas) && a.respostas > 0 ? Math.floor(a.respostas) : 0,
    comunidade: a.comunidade ? { slug: a.comunidade.slug, nome: a.comunidade.nome, cor: corValida(a.comunidade.cor) ?? null } : null,
  };
}

/** O cliente dos atos sobre uma forma de chamar (os testes passam o dublê). */
export function criarClienteDosAtos(c: Chamar) {
  return {
    /** Uma página de atos: "perto" (pela cidade ESCRITA pela pessoa; nunca a posição do aparelho) ou "seguindo"; ou os de uma comunidade. */
    atos: async (filtro: FiltroDosAtos, opcoes: { cidade?: string | null; comunidade?: string | null; cursor?: string | null } = {}) => {
      const p = await c<PaginaDeAtos>("rede_atos", {
        p_filtro: filtro,
        p_cidade: opcoes.cidade?.trim() || null,
        p_comunidade: opcoes.comunidade ?? null,
        p_cursor: opcoes.cursor ?? null,
        p_limite: 20,
      });
      return { itens: (p?.itens ?? []).map(limparAto), proximo: p?.proximo ?? null };
    },
    /** Um ato (a página do ato). */
    ato: async (id: string) => limparAto(await c<Ato>("rede_ato", { p_id: id })),
    /** O próximo ato da pessoa (o que ela confirmou primeiro; senão, o próximo de quem ela segue). Nulo se não houver. */
    proximo: async () => {
      const a = await c<Ato | null>("rede_ato_proximo");
      return a ? limparAto(a) : null;
    },
    /** "Você vai": confirma ou desfaz. Devolve a nova proporção (o mosaico acende na hora) e, só para quem organizou, o total. */
    vou: async (id: string, sim: boolean): Promise<RespostaDoVou> => {
      const r = await c<RespostaDoVou>("rede_ato_vou", { p_id: id, p_sim: sim });
      return { vou_eu: !!r.vou_eu, acesos: proporcaoValida(r.acesos), total: typeof r.total === "number" ? r.total : null };
    },
    /** Chama um ato (o tipo "Ato" do compositor). Devolve o ato como a tela mostra. */
    publicar: async (d: DadosDoAto, comum: { publico?: string; comunidade?: string | null } = {}) =>
      limparAto(await c<Ato>("rede_ato_publicar", { p: pedidoDoAto(d, comum) })),
    /** Adiar, cancelar ou confirmar de novo (só quem organizou). O aviso "ato_mudou" vai só a quem confirmou. */
    mudar: async (id: string, m: PedidoDeMudanca) =>
      limparAto(await c<Ato>("rede_ato_mudar", { p_id: id, p_situacao: m.situacao, p_inicio: m.inicio ?? null, p_motivo: m.motivo ?? "" })),
  };
}

/** O dublê como uma forma de chamar (prévia e testes). */
export function chamarDuble(duble = criarDuble()): Chamar {
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}) => {
    const f = (duble as unknown as Record<string, (a: Record<string, unknown>) => unknown>)[funcao];
    if (!f) throw new Error(`funcao_desconhecida:${funcao}`);
    // um respiro, como a rede de verdade (a tela mostra o "carregando")
    await new Promise((r) => setTimeout(r, 120));
    return structuredClone(f(argumentos)) as T;
  };
}

export const atos = criarClienteDosAtos(PREVIA_DOS_ATOS ? chamarDuble() : chamar);

/** O pedido do rede_ato_publicar para um ato. O texto do post é o chamado; o nome, a palavra, a data, o ponto e a cidade vão junto. */
export function pedidoDoAto(d: DadosDoAto, comum: { publico?: string; comunidade?: string | null } = {}) {
  return {
    tipo: d.tipo,
    titulo: d.titulo,
    palavra: d.palavra,
    inicio: d.quando,
    onde: d.onde,
    cidade: d.cidade,
    descricao: d.descricao,
    publico: comum.publico,
    comunidade: comum.comunidade ?? null,
  };
}
