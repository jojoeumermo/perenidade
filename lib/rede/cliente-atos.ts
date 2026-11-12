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
import { limparCorrente, limparFarol } from "./atos/corrente";
import { criarDuble } from "./atos/exemplos";
import { limparCaronas, limparPeticao, limparTarefas } from "./atos/quadros";
import {
  corValida,
  type Ato,
  type CaronaDoAto,
  type Corrente,
  type DadosDoAto,
  type EdicaoDoAto,
  type EstadoDoFarol,
  type FarolDoAto,
  type FiltroDosAtos,
  type OrgQuePosso,
  type PaginaDeAtos,
  type PedidoDeCarona,
  type PedidoDeCorrente,
  type PedidoDeMudanca,
  type PedidoDePeticao,
  type PeticaoDoAto,
  type QuadroDeTarefas,
  type RespostaDoVou,
} from "./tipos-atos";

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
    meta: typeof a.meta === "number" && Number.isInteger(a.meta) && a.meta >= 3 && a.meta <= 30000 ? a.meta : null,
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
    /** O farol do ato (só para quem confirmou ou coordena; os outros recebem nulo). */
    farol: async (id: string): Promise<FarolDoAto | null> => limparFarol(await c<FarolDoAto | null>("rede_ato_farol", { p_id: id })),
    /** Pedir (ou, sendo a segunda pessoa, confirmar) um estado do farol. Só quem coordena. */
    farolPedir: async (id: string, estado: EstadoDoFarol, texto = ""): Promise<FarolDoAto | null> =>
      limparFarol(await c<FarolDoAto>("rede_ato_farol_pedir", { p_id: id, p_estado: estado, p_texto: texto })),
    /** As correntes abertas da cidade ESCRITA (nunca a posição). */
    correntes: async (cidade: string): Promise<Corrente[]> => ((await c<Corrente[]>("rede_correntes", { p_cidade: cidade.trim() })) ?? []).map(limparCorrente),
    /** "Vou" (ou desfazer) numa corrente. */
    correnteVou: async (id: string, sim: boolean): Promise<Corrente> => limparCorrente(await c<Corrente>("rede_corrente_vou", { p_id: id, p_sim: sim })),
    /** As organizações com selo que esta pessoa gerencia (só sobre si). */
    correntePosso: async (): Promise<OrgQuePosso[]> => (await c<OrgQuePosso[]>("rede_corrente_posso")) ?? [],
    /** Abrir uma corrente como uma organização com selo. */
    correnteAbrir: async (p: PedidoDeCorrente): Promise<Corrente> => limparCorrente(await c<Corrente>("rede_corrente_abrir", { p })),

    // ── B1: meta e link, tarefas, caronas e petição (supabase/migracoes/20261110-alumia-b1-atos.sql) ──
    /** Só quem organizou: muda a meta e/ou o link de apoio (só as chaves passadas). */
    editar: async (id: string, e: EdicaoDoAto) => limparAto(await c<Ato>("rede_ato_editar", { p_id: id, p: e })),
    /** O quadro de tarefas (quem leva o quê). Codinomes só para quem organiza. */
    tarefas: async (ato: string): Promise<QuadroDeTarefas> => limparTarefas(await c<QuadroDeTarefas>("rede_ato_tarefas", { p_ato: ato })),
    tarefaCriar: async (ato: string, item: string, quantos: number): Promise<QuadroDeTarefas> =>
      limparTarefas(await c<QuadroDeTarefas>("rede_ato_tarefa_criar", { p_ato: ato, p_item: item, p_quantos: quantos })),
    tarefaApagar: async (tarefa: string): Promise<QuadroDeTarefas> => limparTarefas(await c<QuadroDeTarefas>("rede_ato_tarefa_apagar", { p_tarefa: tarefa })),
    /** "Eu levo" ou desfazer. */
    tarefaAssumir: async (tarefa: string, sim: boolean): Promise<QuadroDeTarefas> =>
      limparTarefas(await c<QuadroDeTarefas>("rede_ato_tarefa_assumir", { p_tarefa: tarefa, p_sim: sim })),
    /** As caronas do ato (só membro). Nunca quem ofereceu. */
    caronas: async (ato: string): Promise<CaronaDoAto[]> => limparCaronas(await c<CaronaDoAto[]>("rede_ato_caronas", { p_ato: ato })),
    caronaCriar: async (ato: string, p: PedidoDeCarona): Promise<CaronaDoAto[]> => limparCaronas(await c<CaronaDoAto[]>("rede_ato_carona_criar", { p_ato: ato, p })),
    caronaVagas: async (id: string, vagas: number | null): Promise<CaronaDoAto[]> => limparCaronas(await c<CaronaDoAto[]>("rede_ato_carona_vagas", { p_id: id, p_vagas: vagas })),
    caronaApagar: async (id: string): Promise<CaronaDoAto[]> => limparCaronas(await c<CaronaDoAto[]>("rede_ato_carona_apagar", { p_id: id })),
    /** A petição do ato (nula se não há). Total só a partir de 3; nunca quem assinou. */
    peticao: async (ato: string): Promise<PeticaoDoAto | null> => limparPeticao(await c<PeticaoDoAto | null>("rede_peticao", { p_ato: ato })),
    peticaoCriar: async (ato: string, p: PedidoDePeticao): Promise<PeticaoDoAto | null> => limparPeticao(await c<PeticaoDoAto>("rede_peticao_criar", { p_ato: ato, p })),
    peticaoAssinar: async (id: string, sim: boolean): Promise<PeticaoDoAto | null> => limparPeticao(await c<PeticaoDoAto>("rede_peticao_assinar", { p_peticao: id, p_sim: sim })),
    peticaoEncerrar: async (id: string): Promise<PeticaoDoAto | null> => limparPeticao(await c<PeticaoDoAto>("rede_peticao_encerrar", { p_peticao: id })),
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
    // Meta e link de apoio são opcionais: só vão quando a pessoa preencheu (o banco recusa o que não serve).
    ...(typeof d.meta === "number" ? { meta: d.meta } : {}),
    ...(d.link_apoio ? { link_apoio: d.link_apoio } : {}),
    publico: comum.publico,
    comunidade: comum.comunidade ?? null,
  };
}
