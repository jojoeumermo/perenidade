// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote publicar ao banco (rede_pub_* e o rede_publicar ampliado), sobre a mesma forma de chamar da fundação.
// Sem "@/" de propósito (roda no Node nos testes).
import { chamar, type Chamar } from "./cliente";
import type { Post } from "./tipos";
import type { Agendado, DetalhesDoPost, EdicaoAnterior, EnqueteDoPost, PedidoPublicar } from "./tipos-publicar";
import type { RascunhoDoServidor } from "./publicar/alumia2";

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

    // ───── Alumia nova (Onda 5, F1). As funções do banco chegam com a etapa de back-end (supabase/migracoes/20261109-alumia-f1.sql);
    // até lá a chamada falha com "banco_desatualizado" e a tela diz isso, sem fingir que deu certo. ─────
    /** Repostar (ou desfazer): o post aparece na linha de quem segue a pessoa. Só o próprio estado volta, nunca quem repostou. */
    repostar: (post: string, sim: boolean) => c<{ repostei: boolean }>("rede_pub_repostar", { p_post: post, p_sim: sim }),
    /** Guarda (ou atualiza) um rascunho na conta. Só texto e escolhas; até 20 por pessoa, apagados em 30 dias. */
    salvarRascunho: (r: RascunhoDoServidor) => c<{ id: string; atualizado_em: string }>("rede_pub_rascunho_salvar", { p: r }),
    /** Os rascunhos da própria pessoa (nunca os de outra), do mais novo ao mais antigo. */
    rascunhos: () => c<RascunhoDoServidor[]>("rede_pub_rascunhos"),
    apagarRascunho: (id: string) => c<{ apagado: boolean }>("rede_pub_rascunho_apagar", { p_id: id }),
  };
}

export const redePub = criarClientePublicar(chamar);
