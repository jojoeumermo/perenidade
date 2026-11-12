// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do chat privado da Alumia ao banco (supabase/migracoes/20261106-t19-rede-chat-privado.sql e
// 20261110-chat-blocos.sql). Tudo o que passa aqui já vai cifrado (lib/rede/chat-privado.ts): o banco só vê chaves públicas,
// embrulhos e "c3.…" em blocos de tamanho fixo (e o "c2.…" antigo, só para leitura). Documento: docs/rede/CHAT-PRIVADO.md.
// Sem "@/" de propósito.
import type { ChaveDeParticipante, EmbrulhoRecebido } from "./chat-privado";
import { chamar, type Chamar } from "./cliente";
import { criarDubleDoChat } from "./chat-exemplos";

/** A prévia com dados de exemplo está ligada? (A referência é literal para o Next gravar o valor no código do navegador.) */
export const PREVIA_DO_CHAT = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export type QuemPode = "pedidos" | "seguidos" | "ninguem";
export type Prazo = 1 | 7 | 30;

export interface SituacaoDoChat {
  eu: string;
  chave: { identidade: string; publica: string; certificado: string; versao: number } | null;
  quem_pode: QuemPode;
  prazo_dias: Prazo;
  pedidos: number;
  novas: number;
}

export interface PessoaDoChat {
  id: string;
  codinome: string;
  handle: string | null;
  avatar: { tipo: "galeria" | "envio" | null; id?: string; dados?: string } | null;
}

export interface ConversaDoChat {
  id: string;
  com: PessoaDoChat;
  situacao: "pedido" | "aberta";
  pedi: boolean;
  versao: number;
  prazo_dias: Prazo;
  ultima_em: string;
  bloqueio: boolean;
  pode_escrever: boolean;
  nao_lidas: number;
}

export interface ChavesDaConversa {
  versao: number;
  versao_em: string | null;
  atual_ok: boolean;
  participantes: ChaveDeParticipante[];
  embrulhos: EmbrulhoRecebido[];
}

export interface MensagemCifrada {
  id: string;
  autor: string;
  versao: number;
  corpo: string;
  criado_em: string;
  expira_em: string;
}

export type CategoriaDeDenuncia = "menores" | "ameaca" | "exposicao" | "violencia" | "autolesao" | "odio" | "assedio" | "golpe" | "spam" | "outro";

export function criarClienteDoChat(c: Chamar) {
  return {
    situacao: () => c<SituacaoDoChat>("rede_dm_situacao"),
    prefs: (quemPode: QuemPode, prazo: Prazo) => c<{ quem_pode: QuemPode; prazo_dias: Prazo }>("rede_dm_prefs", { p_quem_pode: quemPode, p_prazo_dias: prazo }),
    publicarChave: (identidade: string, publica: string, certificado: string) => c<{ versao: number }>("rede_dm_chave_publicar", { p_identidade: identidade, p_publica: publica, p_certificado: certificado }),
    abrir: (handle: string) => c<ConversaDoChat>("rede_dm_abrir", { p_handle: handle }),
    /** A conversa com quem publicou a carona de um ato (a pessoa é achada no servidor; supabase/migracoes/20261111-chat-caronas.sql). */
    abrirCarona: (carona: string) => c<ConversaDoChat | { erro: "dm_fechada" }>("rede_dm_abrir_carona", { p_carona: carona }),
    responder: (conversa: string, aceitar: boolean) => c<ConversaDoChat | { recusado: true }>("rede_dm_responder", { p_conversa: conversa, p_aceitar: aceitar }),
    conversas: () => c<ConversaDoChat[]>("rede_dm_conversas"),
    chaves: (conversa: string) => c<ChavesDaConversa>("rede_dm_chaves_da_conversa", { p_conversa: conversa }),
    novaVersao: (conversa: string, versao: number, embrulhos: { para: string; chave_versao: number; embrulho: string }[]) =>
      c<{ versao: number }>("rede_dm_nova_versao", { p_conversa: conversa, p_versao: versao, p_embrulhos: embrulhos }),
    enviar: (conversa: string, versao: number, corpo: string) => c<{ id: string; criado_em: string; expira_em: string }>("rede_dm_enviar", { p_conversa: conversa, p_versao: versao, p_corpo: corpo }),
    mensagens: (conversa: string, antes: string | null = null, limite = 50) => c<MensagemCifrada[]>("rede_dm_mensagens", { p_conversa: conversa, p_antes: antes, p_limite: limite }),
    apagarMensagem: (id: string) => c<{ ok: true }>("rede_dm_apagar_mensagem", { p_id: id }),
    apagar: (conversa: string) => c<{ ok: true }>("rede_dm_apagar", { p_conversa: conversa }),
    prazo: (conversa: string, dias: Prazo) => c<{ prazo_dias: Prazo }>("rede_dm_prazo", { p_conversa: conversa, p_dias: dias }),
    denunciar: (conversa: string, categoria: CategoriaDeDenuncia, trechos: string, bloquear: boolean) =>
      c<{ protocolo: string; prioridade: number; bloqueado: boolean }>("rede_dm_denunciar", { p_conversa: conversa, p_categoria: categoria, p_trechos: trechos, p_bloquear: bloquear }),
    apagarTudo: () => c<{ conversas: number }>("rede_dm_apagar_tudo"),
    /** O bloqueio da Alumia (o mesmo de sempre): corta o chat junto. */
    bloquear: (usuario: string, sim: boolean) => c<unknown>("rede_bloquear", { p_usuario: usuario, p_sim: sim }),
  };
}

/** O dublê como uma forma de chamar (prévia e testes): um respiro como a rede de verdade e cópias, nunca o estado do dublê. */
export function chamarDubleDoChat(duble = criarDubleDoChat()): Chamar {
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}) => {
    const f = (duble as unknown as Record<string, (a: Record<string, unknown>) => unknown>)[funcao];
    if (!f) throw new Error(`funcao_desconhecida:${funcao}`);
    await new Promise((r) => setTimeout(r, 120));
    return structuredClone(f(argumentos)) as T;
  };
}

export const chat = criarClienteDoChat(PREVIA_DO_CHAT ? chamarDubleDoChat() : chamar);
