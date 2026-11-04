// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da Rede Lúcia v2 ao banco: uma função por rpc, com os nomes e os parâmetros do contrato (docs/rede/V2.md).
// Cada pacote acrescenta as suas funções em lib/rede/cliente-<pacote>.ts, usando `chamar` daqui. Sem "@/" de propósito.
import { rpc } from "../backend";
import type { Aba, Comunidade, EnderecoAntigo, PaginaDaLinha, Perfil, PedidoDePost, Post, PostComConversa, Situacao } from "./tipos";

/** A forma de chamar uma função do banco. Os testes e os pacotes podem trocar por outra (uma simulada, por exemplo). */
export type Chamar = <T>(funcao: string, argumentos?: Record<string, unknown>) => Promise<T>;

export const chamar: Chamar = (funcao, argumentos = {}) => rpc(funcao, argumentos);

/** O cliente da v2 sobre uma forma de chamar. `rede` (abaixo) é o de verdade. */
export function criarCliente(c: Chamar) {
  return {
    /** Onde a pessoa está: logada, membro, 18+, codinome. Vale também para visitante. */
    situacao: () => c<Situacao>("rede_situacao"),
    /** Declara 18 anos ou mais e consente com as normas em vigor (LGPD art. 11, I). */
    aderir: (maior: boolean, versao: number) => c<Situacao>("rede_aderir", { p_maior: maior, p_versao: versao }),
    /** Uma página da linha. `cursor` é o `proximo` da página anterior. */
    linha: (aba: Aba, cursor: string | null = null, limite = 20) => c<PaginaDaLinha>("rede_linha", { p_aba: aba, p_cursor: cursor, p_limite: limite }),
    /** O contador "N novos": quantos posts chegaram à aba depois de `desde` (ISO). */
    novos: (aba: Aba, desde: string) => c<number>("rede_novos", { p_aba: aba, p_desde: desde }),
    /** Um post com o corpo inteiro, o que ele responde e a conversa abaixo. */
    post: (id: string) => c<PostComConversa>("rede_post", { p_id: id }),
    /** Publicar (post, discussão, dúvida, resposta). Devolve o post; `avaliar` pede a avaliação externa. */
    publicar: (pedido: PedidoDePost) => c<Post>("rede_publicar", { p: pedido }),
    /** Apoiar ('apoio') ou marcar como útil ('util'), ou desfazer. O total de apoios nunca volta (só o autor o vê, na linha). */
    reagir: (post: string, tipo: "apoio" | "util", sim: boolean) => c<{ apoiei: boolean; util_eu: boolean; util: number }>("rede_reagir", { p_post: post, p_tipo: tipo, p_sim: sim }),
    /** Guardar para ler depois (privado). */
    salvar: (post: string, sim: boolean) => c<{ salvei: boolean }>("rede_salvar", { p_post: post, p_sim: sim }),
    comunidade: (slug: string) => c<Comunidade>("rede_comunidade", { p_slug: slug }),
    perfil: (handle: string) => c<Perfil>("rede_perfil_de", { p_handle: handle }),
    /** Para onde vai um endereço antigo (?t=, ?sala=); nulo quando não há par. */
    antigo: (tipo: "topico" | "sala", antigo: string) => c<EnderecoAntigo | null>("rede_antigo", { p_tipo: tipo, p_antigo: antigo }),
  };
}

export const rede = criarCliente(chamar);
