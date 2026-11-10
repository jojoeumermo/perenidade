// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote publicar ao banco (rede_pub_* e o rede_publicar ampliado), sobre a mesma forma de chamar da fundação.
// Sem "@/" de propósito (roda no Node nos testes).
import { chamar, type Chamar } from "./cliente";
import type { Post } from "./tipos";
import type { Agendado, CorrecaoDoPost, DetalhesDoPost, EdicaoAnterior, EnqueteDoPost, MeuAto, OpcoesDeAgendar, PedidoPublicar } from "./tipos-publicar";
import type { RascunhoDoServidor } from "./publicar/alumia2";
import type { RascunhoCifrado } from "./publicar/b1";

export function criarClientePublicar(c: Chamar) {
  return {
    /** Publicar com os campos do pacote (enquete, imagens, áudio, prévia, fio, quem responde). */
    publicar: (pedido: PedidoPublicar) => c<Post>("rede_publicar", { p: pedido }),
    /** O que os posts têm a mais, por lote (até 50 ids). Id que a pessoa não pode ver não aparece. */
    detalhes: (ids: string[]) => c<Record<string, DetalhesDoPost>>("rede_pub_detalhes", { p_ids: ids }),
    /** Voto secreto: devolve a enquete como a pessoa passa a ver (com os totais). Voto não se troca. */
    votar: (post: string, opcoes: string[]) => c<EnqueteDoPost>("rede_pub_enquete_votar", { p_post: post, p_opcoes: opcoes }),
    /** Editar o próprio post: 15 minutos sem marca; depois, "editado" e o texto anterior guardado. */
    editar: (post: string, campos: { texto?: string; titulo?: string; corpo?: string }) => c<Post>("rede_pub_editar", { p_post: post, p: campos }),
    historico: (post: string) => c<EdicaoAnterior[]>("rede_pub_historico", { p_post: post }),
    /** Marcar para depois (5 minutos a 30 dias). O pedido é ensaiado agora: erro de dado pessoal etc. aparece já. */
    agendar: (pedido: PedidoPublicar, quando: string) => c<{ id: string; quando: string }>("rede_pub_agendar", { p: pedido, p_quando: quando }),
    /** Publica o que venceu desta pessoa e devolve a fila dela. */
    agendados: () => c<Agendado[]>("rede_pub_agendados"),
    cancelarAgendado: (id: string) => c<{ cancelado: boolean }>("rede_pub_agendar_cancelar", { p_id: id }),
    /** Onde está o arquivo no depósito (para pedir o endereço assinado). */
    caminhoDaMidia: (id: string) => c<{ bucket: string; caminho: string; tipo: string }>("rede_pub_midia_caminho", { p_id: id }),

    // ───── Alumia nova (Onda 5, F1): supabase/migracoes/20261109-alumia-f1.sql. Num banco sem a migração, a chamada falha com
    // "banco_desatualizado" (ou função inexistente) e a tela diz isso, sem fingir que deu certo. ─────
    /** Repostar (ou desfazer): o post aparece na linha de quem segue a pessoa. Só o próprio estado volta, nunca quem repostou. */
    repostar: (post: string, sim: boolean) => c<{ repostei: boolean }>("rede_pub_repostar", { p_post: post, p_sim: sim }),
    /** Guarda (ou atualiza) um rascunho na conta. Só texto e escolhas; até 20 por pessoa, apagados em 30 dias. */
    salvarRascunho: (r: RascunhoDoServidor | (RascunhoCifrado & { id: string | null })) => c<{ id: string; atualizado_em: string }>("rede_pub_rascunho_salvar", { p: r }),
    /** Os rascunhos da própria pessoa (nunca os de outra), do mais novo ao mais antigo. Da B1 em diante, só cifrados. */
    rascunhos: () => c<(Partial<RascunhoDoServidor> & Partial<RascunhoCifrado> & { id: string; atualizado_em: string })[]>("rede_pub_rascunhos"),
    apagarRascunho: (id: string) => c<{ apagado: boolean }>("rede_pub_rascunho_apagar", { p_id: id }),
    /** Dos posts pedidos (até 50), quais a PRÓPRIA pessoa repostou. Nunca diz nada de outra pessoa. */
    repostados: (ids: string[]) => c<string[]>("rede_pub_repostados", { p_ids: ids.slice(0, 50) }),
    /**
     * Os posts que quem a pessoa segue repostou, com o repost mais recente em (desde, ate], do mais novo ao mais antigo, para a
     * aba Seguindo. Cada um com `repostado_em`, sem dizer quem repostou nem quantos.
     */
    repostes: (ate: string | null, desde: string | null, limite = 20) =>
      c<(Post & { repostado_em: string })[]>("rede_pub_repostes", { p_ate: ate, p_desde: desde, p_limite: limite }),
    /** Desfaz um post que acabou de sair (até 30 s, só o autor, nunca o que a triagem segurou). */
    desfazer: (post: string) => c<{ desfeito: boolean }>("rede_pub_desfazer", { p_post: post }),
    /** Os números dos emblemas do menu, todos da própria pessoa: avisos não lidos, conversas com novidade, atos confirmados. */
    // ───── B1 da casca (20261110-alumia-b1-casca.sql) ─────
    /** Publicar com quem pode citar e a enquete avançada (resultado só no fim, ordem embaralhada). */
    publicarMais: (pedido: PedidoPublicar) => c<Post>("rede_pub_publicar_mais", { p: pedido }),
    /** Corrigir depois de publicar: aviso, texto alternativo, tirar imagem, quem pode citar. */
    corrigir: (post: string, campos: CorrecaoDoPost) => c<{ post: Post; tirados: string[] }>("rede_pub_corrigir", { p_post: post, p: campos }),
    /** Agendar com repetição semanal ou para quando um ato meu terminar. */
    agendarMais: (pedido: PedidoPublicar, quando: string | null, opcoes: OpcoesDeAgendar) =>
      c<{ id: string; quando: string }>("rede_pub_agendar_mais", { p: pedido, p_quando: quando, p_opcoes: opcoes }),
    /** Os atos que eu chamei e ainda não acabaram. */
    meusAtos: () => c<MeuAto[]>("rede_pub_meus_atos"),
    /** Apaga todos os meus rascunhos da conta (ao desligar "guardar na conta"). */
    apagarTodosRascunhos: () => c<{ apagados: number }>("rede_pub_rascunhos_apagar_todos"),
    emblemas: () => c<{ avisos: number; conversas: number; atos: number }>("rede_alumia_emblemas"),
  };
}

export const redePub = criarClientePublicar(chamar);
