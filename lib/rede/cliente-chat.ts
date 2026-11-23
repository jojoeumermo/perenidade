// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat a dois da Alumia para a tela, na onda R2. O servidor NÃO tem mais lista de conversas, pedidos, preferências nem bloqueios
// do chat (supabase/migracoes/20261124-r2-dupla.sql): tudo isso mora nos aparelhos da pessoa (lib/rede/chat/r2/servico.ts), e o
// servidor só entrega pacotes em caixas anônimas. Este arquivo mantém a forma que a tela já usava (situação, conversas, abrir,
// responder, prazo, apagar, bloquear) e responde com o que o aparelho sabe. Documento: docs/rede/CHAT-PRIVADO.md.
//
// Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), o dublê de lib/rede/chat-exemplos.ts responde no lugar, com dados inventados.
// Sem "@/" de propósito.
import { chamar, type Chamar } from "./cliente";
import { criarDubleDoChat } from "./chat-exemplos";
import type { ChatDoAparelho, Prazo as PrazoR2 } from "./chat/r2/servico";

/** A prévia com dados de exemplo está ligada? (A referência é literal para o Next gravar o valor no código do navegador.) */
export const PREVIA_DO_CHAT = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export type QuemPode = "pedidos" | "seguidos" | "ninguem";
export type Prazo = PrazoR2;

export interface SituacaoDoChat {
  eu: string;
  /** O codinome (@) de quem está na conta: o diretório das chaves é por codinome. */
  codinome?: string | null;
  /** A identidade da conta no diretório (null: o chat ainda não foi ativado em aparelho nenhum). */
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
  /** O texto curto que veio com o pedido (só no pedido recebido). */
  texto_do_pedido?: string;
}

/** Só a prévia usa (o dublê guarda o texto como "corpo"). */
export interface MensagemCifrada {
  id: string;
  autor: string;
  versao: number;
  corpo: string;
  criado_em: string;
  expira_em: string;
}

export type CategoriaDeDenuncia = "menores" | "ameaca" | "exposicao" | "violencia" | "autolesao" | "odio" | "assedio" | "golpe" | "spam" | "outro";

/**
 * A denúncia com prova (message franking) é da frente da denúncia (lib/rede/caixas/franquia-cliente.ts): quem junta liga aqui a
 * função que manda os trechos escolhidos, com a prova, para a moderação.
 */
export type Denunciar = (conversa: string, categoria: CategoriaDeDenuncia, trechos: string, bloquear: boolean) => Promise<{ protocolo: string; prioridade: number; bloqueado: boolean }>;
let denunciarComProva: Denunciar | null = null;
export const ligarDenuncia = (f: Denunciar) => void (denunciarComProva = f);

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

async function meuChat(): Promise<{ usuario: string; codinome: string | null; chat: ChatDoAparelho | null }> {
  const { quemSouEu, chatDaConta } = await import("./chat/r2/navegador");
  const eu = await quemSouEu();
  return { ...eu, chat: await chatDaConta(eu.usuario) };
}
async function exigirChat(): Promise<ChatDoAparelho> {
  const { chat } = await meuChat();
  if (!chat) throw erro("dm_sem_chave");
  return chat;
}
const naFila = async <T,>(fazer: () => Promise<T>) => (await import("./chat/r2/navegador")).naFila(fazer);

type ConversaR2 = ReturnType<ChatDoAparelho["conversas"]>[number];
function paraATela(c: ConversaR2): ConversaDoChat {
  const aberta = c.situacao === "aberta";
  return {
    id: c.id,
    // O servidor não guarda quem é quem: a tela mostra o @ que este aparelho conhece (sem buscar o perfil, que diria ao servidor
    // de quem é a conversa aberta).
    com: { id: c.com, codinome: c.codinome, handle: c.codinome, avatar: null },
    situacao: aberta ? "aberta" : "pedido",
    pedi: c.situacao === "enviado",
    versao: 2,
    prazo_dias: c.prazo,
    ultima_em: new Date(c.ultimaEm).toISOString(),
    bloqueio: c.bloqueada,
    pode_escrever: aberta && !c.bloqueada,
    nao_lidas: c.naoLidas,
    ...(c.situacao === "recebido" && c.texto ? { texto_do_pedido: c.texto } : {}),
  };
}

/** O chat de verdade (R2), no aparelho. */
const chatR2 = {
  async situacao(): Promise<SituacaoDoChat> {
    const { usuario, codinome, chat } = await meuChat();
    if (!chat) {
      // Sem o chat neste aparelho: a conta já tem aparelho no diretório (ativou em outro aparelho) ou ainda não?
      const { chatPublicado } = await import("./chat/r2/navegador");
      const publicada = codinome ? await chatPublicado(codinome).catch(() => false) : false;
      return { eu: usuario, codinome, chave: publicada ? { identidade: "outra", publica: "", certificado: "r2", versao: 1 } : null, quem_pode: "pedidos", prazo_dias: 7, pedidos: 0, novas: 0 };
    }
    const lista = chat.conversas();
    return {
      eu: usuario,
      codinome,
      chave: { identidade: chat.estado.identidade ? "r2" : "", publica: chat.estado.aparelho.publico.aparelho, certificado: "r2", versao: 1 },
      quem_pode: chat.estado.lista.prefs.quemPode,
      prazo_dias: chat.estado.lista.prefs.prazo,
      pedidos: lista.filter((c) => c.situacao === "recebido").length,
      novas: lista.reduce((n, c) => n + c.naoLidas, 0),
    };
  },
  prefs: (quemPode: QuemPode, prazo: Prazo) =>
    naFila(async () => {
      await (await exigirChat()).mudarPrefs(quemPode, prazo);
      return { quem_pode: quemPode, prazo_dias: prazo };
    }),
  abrir: (handle: string) =>
    naFila(async () => {
      const chat = await exigirChat();
      const codinome = handle.trim().replace(/^@+/, "").toLowerCase();
      const ja = chat.conversas().find((c) => c.codinome === codinome);
      if (ja) return paraATela(ja);
      const id = await chat.pedirConversa(codinome);
      const nova = chat.conversas().find((c) => c.id === id);
      if (!nova) throw erro("dm_fechada");
      return paraATela(nova);
    }),
  /** A carona de um ato: o servidor dá só o codinome de quem publicou; o pedido sai do aparelho como qualquer outro. */
  async abrirCarona(carona: string): Promise<ConversaDoChat | { erro: "dm_fechada" }> {
    const r = await chamar<{ codinome?: string; erro?: "dm_fechada" }>("rede_carona_contato", { p_carona: carona });
    if (!r?.codinome) return { erro: "dm_fechada" };
    return chatR2.abrir(r.codinome);
  },
  responder: (conversa: string, aceitar: boolean) =>
    naFila(async (): Promise<ConversaDoChat | { recusado: true }> => {
      const chat = await exigirChat();
      if (!aceitar) {
        await chat.recusar(conversa);
        return { recusado: true };
      }
      await chat.aceitar(conversa);
      const c = chat.conversas().find((x) => x.id === conversa);
      if (!c) throw erro("nao_encontrado");
      return paraATela(c);
    }),
  conversas: () =>
    naFila(async () => {
      const chat = await exigirChat();
      return chat.conversas().map(paraATela);
    }),
  prazo: (conversa: string, dias: Prazo) =>
    naFila(async () => {
      await (await exigirChat()).mudarPrazo(conversa, dias);
      return { prazo_dias: dias };
    }),
  apagar: (conversa: string) =>
    naFila(async () => {
      await (await exigirChat()).apagarConversa(conversa);
      return { ok: true as const };
    }),
  denunciar: (conversa: string, categoria: CategoriaDeDenuncia, trechos: string, bloquear: boolean) => {
    if (!denunciarComProva) return Promise.reject(erro("sem_servico"));
    return denunciarComProva(conversa, categoria, trechos, bloquear);
  },
  /** "Apagar tudo do chat": as conversas somem da lista (em todos os meus aparelhos) e as caixas deste aparelho são apagadas. */
  apagarTudo: () =>
    naFila(async () => {
      const chat = await exigirChat();
      const ids = chat.conversas().map((c) => c.id);
      for (const id of ids) await chat.apagarConversa(id);
      return { conversas: ids.length };
    }),
  /** Bloqueio do CHAT (o servidor não fica sabendo): as caixas desta conversa trocam de passe. Não é o bloqueio da rede. */
  bloquear: (usuario: string, sim: boolean) =>
    naFila(async () => {
      const chat = await exigirChat();
      if (sim) await chat.bloquear(usuario);
      else await chat.desbloquear(usuario);
      return { bloqueado: sim };
    }),
  // Só a prévia usa estas três (o chat de verdade apaga, manda e lê pelo chaveiro, no aparelho).
  apagarMensagem: async (...[]: [id: string]) => ({ ok: true as const }),
  enviar: async (...[]: [conversa: string, versao: number, corpo: string]) => ({ id: "", criado_em: "", expira_em: "" }),
  mensagens: async (...[]: [conversa: string, antes?: string | null, limite?: number]): Promise<MensagemCifrada[]> => [],
};

/** O cliente da prévia: o dublê, com a mesma forma. */
export function criarClienteDoChat(c: Chamar): typeof chatR2 {
  return {
    situacao: () => c<SituacaoDoChat>("rede_dm_situacao"),
    prefs: (quemPode, prazo) => c("rede_dm_prefs", { p_quem_pode: quemPode, p_prazo_dias: prazo }),
    abrir: (handle) => c<ConversaDoChat>("rede_dm_abrir", { p_handle: handle }),
    abrirCarona: (carona) => c("rede_dm_abrir_carona", { p_carona: carona }),
    responder: (conversa, aceitar) => c("rede_dm_responder", { p_conversa: conversa, p_aceitar: aceitar }),
    conversas: () => c<ConversaDoChat[]>("rede_dm_conversas"),
    prazo: (conversa, dias) => c("rede_dm_prazo", { p_conversa: conversa, p_dias: dias }),
    apagar: (conversa) => c("rede_dm_apagar", { p_conversa: conversa }),
    denunciar: (conversa, categoria, trechos, bloquear) => c("rede_dm_denunciar", { p_conversa: conversa, p_categoria: categoria, p_trechos: trechos, p_bloquear: bloquear }),
    apagarTudo: () => c("rede_dm_apagar_tudo"),
    bloquear: (usuario, sim) => c("rede_bloquear", { p_usuario: usuario, p_sim: sim }),
    apagarMensagem: (id) => c("rede_dm_apagar_mensagem", { p_id: id }),
    enviar: (conversa, versao, corpo) => c("rede_dm_enviar", { p_conversa: conversa, p_versao: versao, p_corpo: corpo }),
    mensagens: (conversa, antes = null, limite = 50) => c<MensagemCifrada[]>("rede_dm_mensagens", { p_conversa: conversa, p_antes: antes, p_limite: limite }),
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

export const chat = PREVIA_DO_CHAT ? criarClienteDoChat(chamarDubleDoChat()) : chatR2;
