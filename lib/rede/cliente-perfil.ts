// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do pacote "perfil" da Rede v2 ao banco: uma função por rpc (supabase/migracoes/2026-11-rede-perfil.sql). Usa `chamar`
// de lib/rede/cliente.ts, que os testes podem trocar por uma forma simulada. Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import type { ImagemNaFila, PedidoDeEdicao, PedidoDeSeguir, PerfilDaRede, PerfilMeu } from "./tipos-perfil";

export function criarClientePerfil(c: Chamar) {
  return {
    /** O perfil de alguém pelo @handle (invisível, bloqueado ou suspenso = nao_encontrado). */
    perfil: (handle: string) => c<PerfilDaRede>("rede_perfil_de", { p_handle: handle }),
    /** O meu perfil para editar; funciona antes de ter @handle. */
    meu: () => c<PerfilMeu>("rede_perfil_meu"),
    editar: (pedido: PedidoDeEdicao) => c<PerfilMeu>("rede_perfil_editar", { p: pedido }),
    definirHandle: (handle: string) => c<{ handle: string }>("rede_perfil_handle_definir", { p_handle: handle }),
    /** Fixa um post meu no perfil (nulo desafixa). */
    fixar: (post: string | null) => c<{ fixado: unknown }>("rede_perfil_fixar", { p_post: post }),
    /** Seguir (perfil trancado vira pedido) ou deixar de seguir. */
    seguir: (handle: string, sim: boolean) => c<{ sigo: boolean; pendente: boolean }>("rede_perfil_seguir", { p_handle: handle, p_sim: sim }),
    pedidos: () => c<PedidoDeSeguir[]>("rede_perfil_pedidos"),
    decidir: (quem: string, aceitar: boolean) => c<{ ok: boolean; pedidos: number }>("rede_perfil_decidir", { p_quem: quem, p_aceitar: aceitar }),
    enviarImagem: (tipo: "avatar" | "capa", dados: string) => c<PerfilMeu>("rede_perfil_imagem_enviar", { p_tipo: tipo, p_dados: dados }),
    removerImagem: (tipo: "avatar" | "capa") => c<PerfilMeu>("rede_perfil_imagem_remover", { p_tipo: tipo }),
    /** Só a mediação: imagens enviadas que esperam decisão. */
    fila: () => c<ImagemNaFila[]>("rede_perfil_imagens_fila"),
    decidirImagem: (usuario: string, tipo: "avatar" | "capa", aceitar: boolean) => c<{ ok: boolean }>("rede_perfil_imagem_decidir", { p_usuario: usuario, p_tipo: tipo, p_aceitar: aceitar }),
    /** Os rostos de várias pessoas de uma vez: { id: 'a07' | 'envio' }. */
    avatares: (ids: string[]) => c<Record<string, string>>("rede_perfil_avatares", { p_usuarios: ids }),
    /** A imagem enviada (aceita) de uma pessoa, em data URL; nulo se não houver ou não puder ver. */
    imagem: (usuario: string, tipo: "avatar" | "capa" = "avatar") => c<string | null>("rede_perfil_imagem", { p_usuario: usuario, p_tipo: tipo }),
  };
}

export const redePerfil = criarClientePerfil(chamar);
