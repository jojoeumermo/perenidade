// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote de moderação ao banco: uma função por rpc (supabase/migracoes/2026-11-rede-moderacao.sql).
// Usa `chamar` da fundação. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type {
  AcaoDeModeracao, AlvoDeDenuncia, CategoriaDeDenuncia, Decisao, DenunciaAberta, EscopoDeModeracao, ItemDaFila, ItemDeLista, MeuNivel, MinhaDenuncia,
  PostRetido, RecursoDaFila, RegraDeNivel, ResultadoDeDenuncia, RotuloDeChecagem, Silenciado, SituacaoDaDenuncia, TipoDeSilencio,
} from "./tipos-moderacao";

export function criarClienteModeracao(c: Chamar) {
  return {
    /** As regras dos níveis, públicas. */
    niveis: () => c<RegraDeNivel[]>("rede_mod_niveis"),
    meuNivel: () => c<MeuNivel>("rede_mod_meu_nivel"),
    escopo: () => c<EscopoDeModeracao>("rede_mod_escopo"),
    /** Só a coordenação designa líder (nível 4). */
    lider: (handle: string, sim: boolean) => c<{ lider: boolean }>("rede_mod_lider", { p_handle: handle, p_sim: sim }),

    /** Denunciar um post (id), um perfil (@handle) ou uma comunidade (slug). Quem denuncia nunca é revelado. */
    denunciar: (tipo: AlvoDeDenuncia, alvo: string, categoria: CategoriaDeDenuncia, texto = "") =>
      c<ResultadoDeDenuncia>("rede_mod_denunciar", { p_alvo_tipo: tipo, p_alvo: alvo, p_categoria: categoria, p_texto: texto }),
    minhasDenuncias: () => c<MinhaDenuncia[]>("rede_mod_minhas_denuncias"),

    fila: (situacao: "abertas" | "fechadas" = "abertas") => c<ItemDaFila[]>("rede_mod_fila", { p_situacao: situacao }),
    abrir: (denuncia: string) => c<DenunciaAberta>("rede_mod_abrir", { p_denuncia: denuncia }),
    retidos: () => c<PostRetido[]>("rede_mod_retidos"),
    /** Agir: sempre com a regra citada e o motivo. `contexto` é a comunidade, para banir e desbanir. */
    agir: (denuncia: string | null, tipo: "post" | "perfil", alvo: string, acao: AcaoDeModeracao, regra: string, motivo: string, contexto: string | null = null) =>
      c<{ acao: string }>("rede_mod_agir", { p_denuncia: denuncia, p_alvo_tipo: tipo, p_alvo: alvo, p_acao: acao, p_regra: regra, p_motivo: motivo, p_contexto: contexto }),
    situacaoDaDenuncia: (denuncia: string, situacao: Exclude<SituacaoDaDenuncia, "aberta">, nota = "") =>
      c<{ situacao: string }>("rede_mod_denuncia_situacao", { p_denuncia: denuncia, p_situacao: situacao, p_nota: nota }),

    minhasDecisoes: () => c<Decisao[]>("rede_mod_minhas_decisoes"),
    recorrer: (acao: string, texto: string) => c<{ ok: boolean }>("rede_mod_recorrer", { p_acao: acao, p_texto: texto }),
    recursos: () => c<RecursoDaFila[]>("rede_mod_recursos"),
    rever: (recurso: string, decisao: "mantido" | "revertido", motivo: string) => c<{ situacao: string }>("rede_mod_rever", { p_recurso: recurso, p_decisao: decisao, p_motivo: motivo }),

    silenciar: (tipo: TipoDeSilencio, alvo: string, dias: number | null = null) => c<{ id: string }>("rede_mod_silenciar", { p_tipo: tipo, p_alvo: alvo, p_dias: dias }),
    silenciarRemover: (id: string) => c<{ ok: boolean }>("rede_mod_silenciar_remover", { p_id: id }),
    silenciados: () => c<Silenciado[]>("rede_mod_silenciados"),

    modoLento: (tipo: "comunidade" | "conversa", alvo: string, segundos: number, motivo = "") => c<{ segundos: number }>("rede_mod_modo_lento", { p_tipo: tipo, p_alvo: alvo, p_segundos: segundos, p_motivo: motivo }),
    lentoDe: (tipo: "comunidade" | "conversa", alvo: string) => c<number>("rede_mod_lento_de", { p_tipo: tipo, p_alvo: alvo }),

    lista: (escopoTipo: "comunidade" | "nucleo", escopo: string) => c<ItemDeLista[]>("rede_mod_lista", { p_escopo_tipo: escopoTipo, p_escopo: escopo }),
    listaAdicionar: (escopoTipo: "comunidade" | "nucleo", escopo: string, tipo: "palavra" | "pessoa", valor: string, motivo = "") =>
      c<{ id: string }>("rede_mod_lista_adicionar", { p_escopo_tipo: escopoTipo, p_escopo: escopo, p_tipo: tipo, p_valor: valor, p_motivo: motivo }),
    listaRemover: (id: string) => c<{ ok: boolean }>("rede_mod_lista_remover", { p_id: id }),

    rotular: (post: string, checagem: string, veredito: string, titulo = "") => c<{ ok: boolean }>("rede_mod_rotular", { p_post: post, p_checagem: checagem, p_veredito: veredito, p_titulo: titulo }),
    desrotular: (post: string, motivo = "") => c<{ ok: boolean }>("rede_mod_desrotular", { p_post: post, p_motivo: motivo }),
    /** Os rótulos de uma leva de posts: {id: {rotulo}}. Só vêm os que têm rótulo e que a pessoa pode ver. */
    detalhes: (ids: string[]) => c<Record<string, { rotulo: RotuloDeChecagem }>>("rede_mod_detalhes", { p_ids: ids }),
  };
}

export const redeMod = criarClienteModeracao(chamar);
