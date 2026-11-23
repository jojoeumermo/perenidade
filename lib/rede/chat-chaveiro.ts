// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro do chat a dois da Alumia, neste aparelho, na onda R2. Documento: docs/rede/CHAT-PRIVADO.md.
//
// A cifra é o Double Ratchet (Proteus, do @wireapp/core-crypto) por APARELHO, dentro de um envelope pós-quântico (HPKE com X-Wing),
// depositado em caixas anônimas: lib/rede/chat/r2/. Este arquivo mantém a forma que a tela já usava (Eu, Sessao, MensagemAberta,
// abrir sessão, mandar, ler, confiar, apagar) e traduz para o chat novo (lib/rede/chat/r2/servico.ts). Saíram: a biblioteca do
// Matrix na conversa a dois, a caixa selada por conta, a senha de entrega e o aperto de mão (o pedido de conversa e o anúncio das
// caixas fazem esse papel, sem o servidor saber quem fala com quem).
import { identidadeNaTela } from "./chat-privado";
import { apagarTudoDoChat as apagarTudoNoAparelho, aoApagarTudoDoChat } from "./chat/gaveta";
import { apagarDoHistorico, mensagensDoHistorico, type MensagemGuardada } from "./chat/historico";
import type { ChatDoAparelho } from "./chat/r2/servico";
import type { ProvaDeFranquia } from "./franquia/protocolo";
import { type CorpoDePosicao, lerCorpoDePosicao } from "./perto/posicao";
import { abrirAnexo, contextoDaConversa, type CorpoDeAnexo, corpoGuardado, type DiasDoAnexo, montarCorpoDeAnexo, prepararAnexo } from "./chat/anexo-cifrado";
import { chat, PREVIA_DO_CHAT, type Prazo, type SituacaoDoChat } from "./cliente-chat";

export { destravarHistorico, fecharHistorico, historicoTravado, lerOrganizacao, mudarOrganizacao, ORGANIZACAO_VAZIA, type OrganizacaoDaConversa, resumoDasConversas, travarHistorico } from "./chat/historico";

/** Eu, neste aparelho. `identidade.publica`: "<conta>:<identidade da conta>" (é ela que entra no código de segurança). */
export interface Eu {
  usuario: string;
  versao: number;
  identidade: { publica: string };
  /** A chave deste aparelho (base64url). */
  aparelho: { publica: string };
  chat: ChatDoAparelho | null;
}

const EU_DA_PREVIA = (usuario: string): Eu => ({ usuario, versao: 1, aparelho: { publica: "previa-aparelho-eu" }, identidade: { publica: "previa-identidade-eu" }, chat: null });
const erroDoChat = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const navegador = () => import("./chat/r2/navegador");

function euDe(c: ChatDoAparelho): Eu {
  return { usuario: c.estado.conta, versao: 2, identidade: { publica: identidadeNaTela(c.estado.conta, identidadeDaConta(c)) }, aparelho: { publica: c.estado.aparelho.publico.aparelho }, chat: c };
}
/** A identidade pública da conta, como o diretório e o código de segurança a mostram (base64url). */
function identidadeDaConta(c: ChatDoAparelho): string {
  return c.identidadePublica();
}

/** Apaga deste aparelho tudo o que o chat guardou da conta ("apagar tudo do chat" nos Ajustes). */
export async function esquecerNesteAparelho(usuario: string) {
  const { esquecerAqui } = await navegador();
  await esquecerAqui(usuario);
}

/** PÂNICO: apaga deste aparelho TUDO do chat, de todas as contas (lojas, motor, histórico, memória). Nunca lança. */
export async function apagarTudoDoChat(): Promise<void> {
  await apagarTudoNoAparelho();
}
aoApagarTudoDoChat(() => void navegador().then((n) => n.esquecerNaMemoria(), () => undefined));

/**
 * "sem_chave": a conta ainda não ativou o chat novo em aparelho nenhum (ativar cria as chaves da conta). "outro_aparelho": já ativou
 * em outro aparelho; aqui, o caminho é ligar este aparelho pelo QR (ou restaurar a cópia de segurança). Começar do zero aqui cria
 * uma identidade NOVA (os contatos são avisados de que ela mudou).
 */
export type EstadoDoAparelho = { estado: "pronto"; eu: Eu } | { estado: "sem_chave" } | { estado: "outro_aparelho"; tinhaChaveAqui: boolean };

export async function estadoDoAparelho(situacao: SituacaoDoChat): Promise<EstadoDoAparelho> {
  if (PREVIA_DO_CHAT) return { estado: "pronto", eu: EU_DA_PREVIA(situacao.eu) };
  const { chatDaConta, naFila } = await navegador();
  const c = await chatDaConta(situacao.eu);
  if (c) {
    await naFila(() => c.trocarChaveDaSemana()).catch(() => undefined);
    return { estado: "pronto", eu: euDe(c) };
  }
  return situacao.chave ? { estado: "outro_aparelho", tinhaChaveAqui: false } : { estado: "sem_chave" };
}

/** Ativa o chat neste aparelho com chaves NOVAS da conta (o primeiro aparelho, ou "começar do zero"). */
export async function ativarNesteAparelho(usuario: string): Promise<Eu> {
  if (PREVIA_DO_CHAT) return EU_DA_PREVIA(usuario);
  const { ativarAqui, quemSouEu, naFila } = await navegador();
  const { codinome } = await quemSouEu();
  if (!codinome) throw erroDoChat("sem_codinome");
  return euDe(await naFila(() => ativarAqui(usuario, codinome)));
}

/** Uma conversa aberta neste aparelho e o que se sabe da outra pessoa. */
export interface Sessao {
  conversa: string;
  eu: Eu;
  outro: string;
  versao: number;
  /** As identidades ("<conta>:<identidade>") que este aparelho confia: a minha e a da outra pessoa. */
  confiadas: Record<string, string>;
  chavesConfiadas: Record<string, string>;
  /** A identidade NOVA que o diretório mostra da outra pessoa (nada sai até aceitar). */
  mudou: string | null;
  mudouChave: string | null;
  exigeComparar: boolean;
  chaveEstranha: boolean;
  /** A outra pessoa não tem aparelho confiável com o chat novo. */
  semChaveDoOutro: boolean;
  /** O pedido ainda não foi aceito, ou nenhum aparelho da outra pessoa confirmou a caixa: o que eu escrever não sai na hora. */
  aguardandoOutro: boolean;
  /**
   * A conversa está aberta, mas nenhum aparelho da outra pessoa confirmou a caixa ainda: dá para escrever, e a mensagem fica na fila
   * deste aparelho até a confirmação (sai sozinha). Falso com o pedido ainda sem resposta (aí não dá para escrever).
   */
  naFila: boolean;
  /** O registro público de transparência não confirma a identidade da outra pessoa (ou a corrente não fecha). */
  foraDoRegistro: "nao_confere" | "meu" | "quebrado" | null;
  carimbo: string | null;
  verificado: boolean;
}

export async function abrirSessao(eu: Eu, conversa: string, outro: string, anterior?: Sessao | null): Promise<Sessao> {
  if (PREVIA_DO_CHAT || !eu.chat) {
    return {
      conversa, eu, outro, versao: 1, confiadas: { [eu.usuario]: eu.identidade.publica, [outro]: `previa-identidade-${outro}` },
      chavesConfiadas: {}, mudou: null, mudouChave: null, exigeComparar: false, chaveEstranha: false, semChaveDoOutro: false, aguardandoOutro: false, naFila: false, foraDoRegistro: null, carimbo: null, verificado: anterior?.verificado ?? false,
    };
  }
  const c = eu.chat;
  const { naFila } = await navegador();
  return naFila(async () => {
    const conv = c.estado.lista.conversas[conversa];
    if (!conv || conv.apagada) throw erroDoChat("nao_encontrado");
    const contato = (await c.contatoPorCodinome(conv.codinome).catch(() => null)) ?? c.estado.lista.contatos[outro] ?? null;
    c.marcarLida(conversa);
    const sessao: Sessao = {
      conversa,
      eu,
      outro,
      versao: 2,
      confiadas: { [eu.usuario]: eu.identidade.publica, ...(contato ? { [outro]: identidadeNaTela(outro, contato.identidade) } : {}) },
      chavesConfiadas: {},
      mudou: contato?.mudou ? identidadeNaTela(outro, contato.mudou) : null,
      mudouChave: null,
      exigeComparar: !!contato?.mudou && !!contato.verificado,
      chaveEstranha: false,
      semChaveDoOutro: !contato || contato.aparelhos.length === 0,
      aguardandoOutro: !c.podeEscreverAgora(conversa),
      naFila: conv.situacao === "aberta" && !c.podeEscreverAgora(conversa),
      foraDoRegistro: contato && contato.registro !== "confere" ? contato.registro : null,
      carimbo: null,
      verificado: !!contato?.verificado && !contato.mudou,
    };
    return sessao;
  });
}

export async function confiarNaIdentidade(sessao: Sessao, identidade: string, verificado = false) {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) return;
  const esperada = sessao.mudou ?? sessao.confiadas[sessao.outro];
  if (!esperada || identidade !== esperada) throw erroDoChat("dm_identidade_mudou");
  if (sessao.exigeComparar && !verificado) throw erroDoChat("dm_exige_comparar");
  const c = sessao.eu.chat;
  const { naFila } = await navegador();
  await naFila(() => c.confiar(sessao.outro, verificado));
}

export interface MensagemAberta {
  /** O id NESTE aparelho (o servidor não tem mais a mensagem). */
  id: string;
  autor: string;
  versao: number;
  criado_em: string;
  expira_em: string;
  texto: string | null;
  contador: number | null;
  visto: null;
  repetida: boolean;
  /** A cadeia de mensagens deste aparelho da outra pessoa não fecha (não deveria acontecer: aviso forte). */
  duvidosa: boolean;
  /** "Ver uma vez": a tela mostra e apaga. */
  umaVez: boolean;
  /** Chegou fora da ordem em que foi escrita. */
  foraDeOrdem?: boolean;
  /** Chegou depois de um buraco (faltou mensagem antes dela). */
  depoisDeFalta?: boolean;
  /** A prova da franquia (denúncia com prova; lib/rede/franquia/protocolo.ts). Nula se a mensagem não tem. */
  prova?: ProvaDeFranquia | null;
  /** Quem escreveu mudou o texto depois. */
  editada?: boolean;
  /** Minha, ainda na fila deste aparelho (a outra pessoa não confirmou a conversa). */
  pendente?: boolean;
  /** Anexo cifrado (Prompt 4, itens 137 e 138: áudio ou vídeo curto): o corpo com a chave e o endereço. O `texto` vem vazio. */
  anexo?: CorpoDeAnexo | null;
  /** Encaminhada (Prompt 4, item 14): quantas vezes o texto já foi encaminhado (a contagem de dentro do cifrado). */
  encaminhada?: number;
  /** Agendada (Prompt 4, item 18): minha, ainda só neste aparelho, para sair nesta hora (ISO). */
  agendada?: string;
  /** Pedido de ajuda (Prompt 4, item 7): o corpo da posição (lib/rede/perto/posicao.ts). O `texto` vem vazio. */
  posicao?: CorpoDePosicao | null;
}

function aberta(m: MensagemGuardada): MensagemAberta {
  const bits = m.visto?.versao ?? 0;
  return {
    id: m.id, autor: m.autor, versao: m.versao, criado_em: m.quando, expira_em: m.expira, texto: m.texto, contador: m.contador, visto: null, repetida: false,
    duvidosa: (bits & 2) !== 0, umaVez: m.umaVez, foraDeOrdem: (bits & 1) !== 0, depoisDeFalta: (bits & 4) !== 0, prova: m.prova ?? null,
    editada: !!m.editada, pendente: !!m.pendente, ...(m.anexo ? { anexo: corpoGuardado(m.anexo) } : {}),
    ...(m.encaminhada ? { encaminhada: m.encaminhada } : {}),
    ...(m.agendada ? { agendada: new Date(m.agendada).toISOString() } : {}),
    ...(m.posicao ? { posicao: lerCorpoDePosicao(m.posicao) } : {}),
  };
}

/**
 * Busca as caixas deste aparelho (pedidos, sincronia, conversas) e guarda o que chegou. Devolve quantas mensagens novas. Onda R3
 * (3.3): com a agenda das caixas ligada (lib/rede/chat/r2/navegador.ts), cada caixa já é buscada no seu horário; a tela não puxa
 * nada (abrir uma conversa ou a lista não vira pedido ao servidor, que ligaria as caixas pelo horário) e só lê o histórico.
 */
export async function receberMensagens(eu: Eu): Promise<number> {
  if (PREVIA_DO_CHAT || !eu.chat) return 0;
  const c = eu.chat;
  const { naFila, agendaLigada } = await navegador();
  if (agendaLigada(c)) return 0;
  return naFila(async () => {
    await c.receberPedidos().catch(() => 0);
    return c.receber();
  });
}

/** As mensagens da conversa, do histórico deste aparelho (depois de buscar as caixas). `antes`: para carregar as mais antigas. */
export async function mensagensDaConversa(sessao: Sessao, antes: string | null = null): Promise<MensagemAberta[]> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) {
    const lista = await chat.mensagens(sessao.conversa, antes);
    return lista.map((m) => ({ id: m.id, autor: m.autor, versao: m.versao, criado_em: m.criado_em, expira_em: m.expira_em, texto: m.corpo, contador: null, visto: null, repetida: false, duvidosa: false, umaVez: false }));
  }
  if (!antes) await receberMensagens(sessao.eu);
  sessao.eu.chat.marcarLida(sessao.conversa);
  // Nesta conversa só aparece o que veio de mim ou da outra pessoa dela (o autor é o que a sessão Proteus e o certificado provaram).
  const guardadas = (await mensagensDoHistorico(sessao.eu.usuario, sessao.conversa, antes)).filter((m) => m.autor === sessao.eu.usuario || m.autor === sessao.outro);
  return guardadas.map(aberta);
}

/** As mensagens que chegaram depois de faltar alguma (o aviso discreto de buraco). */
export function depoisDeBuraco(mensagens: readonly MensagemAberta[]): Set<string> {
  return new Set(mensagens.filter((m) => m.depoisDeFalta).map((m) => m.id));
}

export interface OrdemDaTela<T> {
  ordenadas: T[];
  foraDeOrdem: Set<string>;
  semConfirmar: Set<string>;
}

/** A ordem da tela: dentro de cada aparelho vale o contador de dentro do cifrado; a hora de chegada intercala. */
export function ordemDaConversa(mensagens: readonly MensagemAberta[], ...[]: [eu: string]): OrdemDaTela<MensagemAberta> {
  const ordenadas = [...mensagens].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || (a.autor === b.autor ? (a.contador ?? 0) - (b.contador ?? 0) : a.id.localeCompare(b.id)));
  return { ordenadas, foraDeOrdem: new Set(mensagens.filter((m) => m.foraDeOrdem).map((m) => m.id)), semConfirmar: new Set() };
}

/** Opções de uma mensagem: prazo em dias (1, 7 ou 30), ou temporária em minutos (1 a 1440), e "ver uma vez". */
export interface OpcoesDaMensagem {
  prazoDias?: Prazo;
  minutos?: number | null;
  umaVez?: boolean;
}

/** Cifra no aparelho (para cada aparelho confiável da outra pessoa e para os meus outros) e deposita. */
export async function enviarTexto(sessao: Sessao, texto: string, opcoes: OpcoesDaMensagem = {}): Promise<Sessao> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) {
    await chat.enviar(sessao.conversa, 1, texto);
    return sessao;
  }
  if (sessao.mudou) throw erroDoChat(sessao.exigeComparar ? "dm_exige_comparar" : "dm_identidade_mudou");
  if (sessao.foraDoRegistro) throw erroDoChat("dm_fora_do_registro");
  const c = sessao.eu.chat;
  const { naFila } = await navegador();
  await naFila(() => c.mandarTexto(sessao.conversa, texto, { prazo: opcoes.prazoDias, umaVez: !!opcoes.umaVez, minutos: opcoes.minutos ?? undefined }));
  return sessao;
}

// ── Envio agendado (Prompt 4, item 18) ──
/** Agenda um texto para sair na hora (de 1 minuto a 30 dias). Fica só neste aparelho; sai se ele estiver ligado com a Alumia aberta. */
export async function agendarTexto(sessao: Sessao, texto: string, quando: Date): Promise<void> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) return;
  if (sessao.mudou) throw erroDoChat(sessao.exigeComparar ? "dm_exige_comparar" : "dm_identidade_mudou");
  if (sessao.foraDoRegistro) throw erroDoChat("dm_fora_do_registro");
  const c = sessao.eu.chat;
  const { naFila } = await navegador();
  await naFila(() => c.agendar(sessao.conversa, texto, quando.getTime()));
}

/** Desiste de uma agendada (pelo id local do histórico). */
export async function cancelarAgendada(sessao: Sessao, id: string): Promise<void> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) return;
  const c = sessao.eu.chat;
  const m = (await mensagensDoHistorico(sessao.eu.usuario, sessao.conversa, null, 10_000)).find((x) => x.id === id);
  if (!m?.agendada) return;
  const { naFila } = await navegador();
  await naFila(() => c.cancelarAgendada(sessao.conversa, m.idInterno));
}

/** Manda as agendadas que já venceram (a tela do chat chama de tempos em tempos, só com a aba aberta). Devolve quantas saíram. */
export async function enviarAgendadas(eu: Eu): Promise<number> {
  if (PREVIA_DO_CHAT || !eu.chat) return 0;
  const c = eu.chat;
  const { naFila } = await navegador();
  return naFila(() => c.enviarAgendadas());
}

// ── Notas para mim (Prompt 4, item 15) ──
/** O id da conversa das notas para mim desta conta (o mesmo em todos os meus aparelhos; o servidor não o conhece). */
export const idDasMinhasNotas = (eu: Eu): string | null => eu.chat?.notas ?? null;
/** Na prévia (sem servidor nem chave), as notas ficam só na memória desta aba. */
const NOTAS_DA_PREVIA: MensagemAberta[] = [];

/** As notas para mim, do histórico deste aparelho (depois de buscar as caixas, que trazem as dos meus outros aparelhos). */
export async function minhasNotas(eu: Eu): Promise<MensagemAberta[]> {
  const id = idDasMinhasNotas(eu);
  if (PREVIA_DO_CHAT) return [...NOTAS_DA_PREVIA];
  if (!id) return [];
  await receberMensagens(eu);
  return (await mensagensDoHistorico(eu.usuario, id, null, 500)).filter((m) => m.autor === eu.usuario).map(aberta);
}

/** Guarda uma nota para mim: aqui e, cifrada, nos meus outros aparelhos. */
export async function escreverNota(eu: Eu, texto: string): Promise<void> {
  if (PREVIA_DO_CHAT) {
    const agora = new Date().toISOString();
    NOTAS_DA_PREVIA.push({ id: `previa-nota-${NOTAS_DA_PREVIA.length + 1}`, autor: eu.usuario, versao: 2, criado_em: agora, expira_em: agora, texto: texto.trim(), contador: null, visto: null, repetida: false, duvidosa: false, umaVez: false });
    return;
  }
  if (!eu.chat) return;
  const c = eu.chat;
  const { naFila } = await navegador();
  await naFila(() => c.mandarNota(texto));
}

/** Apaga uma nota (pelo id local) daqui e dos meus outros aparelhos. */
export async function apagarNota(eu: Eu, id: string): Promise<void> {
  if (PREVIA_DO_CHAT) {
    NOTAS_DA_PREVIA.splice(0, NOTAS_DA_PREVIA.length, ...NOTAS_DA_PREVIA.filter((n) => n.id !== id));
    return;
  }
  const notas = idDasMinhasNotas(eu);
  if (!eu.chat || !notas) return;
  const c = eu.chat;
  const m = (await mensagensDoHistorico(eu.usuario, notas, null, 10_000)).find((x) => x.id === id);
  if (!m) return;
  const { naFila } = await navegador();
  await naFila(() => c.apagarNota(m.idInterno));
}

/**
 * Encaminha um texto (Prompt 4, item 14) para as conversas escolhidas, com a contagem de encaminhamentos dentro do cifrado e o freio
 * (lib/rede/chat/encaminhar.ts): o que já foi encaminhado muitas vezes só vai para uma conversa por vez. Cada conversa recebe uma
 * mensagem nova minha, cifrada como qualquer outra.
 */
export async function encaminharTexto(eu: Eu, conversas: readonly string[], texto: string, contagem: number | undefined): Promise<void> {
  if (PREVIA_DO_CHAT || !eu.chat) return;
  const c = eu.chat;
  const { naFila } = await navegador();
  await naFila(() => c.encaminhar(conversas, texto, contagem));
}

/**
 * Manda um áudio ou vídeo curto (Prompt 4, itens 137 e 138): confere e cifra NO APARELHO, sobe só o cifrado ao depósito (sem sessão,
 * com um passe anônimo) e manda a chave e o endereço dentro da mensagem cifrada. O arquivo aberto nunca sai daqui. Sem fila: a
 * conversa tem de estar confirmada pela outra pessoa. O prazo do arquivo no depósito é o da conversa (1, 7 ou 30 dias).
 */
export async function enviarAnexo(sessao: Sessao, arquivo: Uint8Array<ArrayBuffer>, mime: string, duracaoMs: number, opcoes: OpcoesDaMensagem = {}): Promise<Sessao> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) throw erroDoChat("anexo_desligado");
  if (sessao.mudou) throw erroDoChat(sessao.exigeComparar ? "dm_exige_comparar" : "dm_identidade_mudou");
  if (sessao.foraDoRegistro) throw erroDoChat("dm_fora_do_registro");
  if (sessao.aguardandoOutro) throw erroDoChat("dm_aguardando");
  const c = sessao.eu.chat;
  const dias: DiasDoAnexo = opcoes.prazoDias ?? c.estado.lista.conversas[sessao.conversa]?.prazo ?? 7;
  const { cifrado, corpo } = await prepararAnexo(arquivo, mime, duracaoMs, contextoDaConversa("r2", sessao.conversa), { dias, ...(opcoes.umaVez ? { umaVez: true } : {}) });
  const { depositarAnexo } = await import("./chat/anexo-deposito");
  const endereco = await depositarAnexo(cifrado, dias);
  const bytes = montarCorpoDeAnexo({ ...corpo, endereco });
  const { naFila } = await navegador();
  await naFila(() => c.mandarAnexo(sessao.conversa, bytes, { prazo: dias }));
  return sessao;
}

/**
 * Baixa e abre o anexo de uma mensagem, NESTE aparelho: confere o resumo do cifrado, decifra e confere o resumo do arquivo. Devolve
 * o arquivo como Blob (a tela faz o endereço blob: e o solta ao fechar), ou null se o arquivo não existe mais ou foi mexido.
 */
export async function abrirAnexoDaMensagem(sessao: Sessao, corpo: CorpoDeAnexo): Promise<Blob | null> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) return null;
  const { baixarAnexo } = await import("./chat/anexo-deposito");
  const cifrado = await baixarAnexo(corpo);
  if (!cifrado) return null;
  const aberto = await abrirAnexo(cifrado, corpo, contextoDaConversa("r2", sessao.conversa));
  return aberto ? new Blob([aberto], { type: corpo.mime }) : null;
}

/** "Ver uma vez" aberto, ou "apagar para todos" de um anexo meu: pede ao depósito que apague o cifrado (nunca lança). */
export async function tirarAnexoDoDeposito(corpo: CorpoDeAnexo): Promise<void> {
  const { tirarAnexo } = await import("./chat/anexo-deposito");
  await tirarAnexo(corpo.endereco);
}

/**
 * Apaga uma mensagem. "todos" (só a minha): daqui e pede aos outros aparelhos (dela e meus) que apaguem a cópia; ainda na fila, só sai
 * da fila. "aqui": só a cópia deste aparelho (a da outra pessoa e a dos meus outros aparelhos ficam).
 */
export async function apagarMensagem(sessao: Sessao, id: string, modo: "todos" | "aqui" = "todos"): Promise<void> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) {
    await chat.apagarMensagem(id);
    return;
  }
  const c = sessao.eu.chat;
  const m = (await mensagensDoHistorico(sessao.eu.usuario, sessao.conversa, null, 10_000)).find((x) => x.id === id);
  if (!m) return;
  const { naFila } = await navegador();
  // Na fila, "só para mim" e "para todos" dão no mesmo: ela nunca saiu daqui, e não pode sair depois.
  if (m.autor === sessao.eu.usuario && (modo === "todos" || m.pendente)) {
    await naFila(() => c.apagarMensagem(sessao.conversa, m.idInterno));
    // O anexo meu apagado para todos sai também do depósito (ninguém baixa mais).
    const corpo = m.anexo ? corpoGuardado(m.anexo) : null;
    if (corpo) await tirarAnexoDoDeposito(corpo);
  } else await apagarDoHistorico([id]);
}

/** Edita uma mensagem MINHA: troca aqui e pede aos outros aparelhos (dela e meus) que troquem a cópia (fica a marca "editada"). */
export async function editarMensagem(sessao: Sessao, id: string, texto: string): Promise<void> {
  if (PREVIA_DO_CHAT || !sessao.eu.chat) return;
  const c = sessao.eu.chat;
  const m = (await mensagensDoHistorico(sessao.eu.usuario, sessao.conversa, null, 10_000)).find((x) => x.id === id);
  if (!m || m.autor !== sessao.eu.usuario) throw erroDoChat("nao_encontrado");
  const { naFila } = await navegador();
  await naFila(() => c.editarMensagem(sessao.conversa, m.idInterno, texto));
}

/**
 * Avisa a tela quando a agenda das caixas acabou de buscar (o id da conversa, "sincronia" ou "pedidos"), para reler o histórico
 * deste aparelho na hora. Só dentro da aba: o horário das buscas não muda. Devolve a função que para de ouvir.
 */
export function aoChegarNoChat(fazer: (qual: string) => void): () => void {
  if (PREVIA_DO_CHAT) return () => undefined;
  let parar: (() => void) | null = null;
  let parado = false;
  void navegador().then((n) => {
    if (!parado) parar = n.aoChegarNoChat(fazer);
  }, () => undefined);
  return () => {
    parado = true;
    parar?.();
  };
}

/** Apaga a conversa deste e dos meus outros aparelhos (pela lista) e as minhas caixas dela. */
export async function apagarConversa(...[, eu, conversa]: [sessao: Sessao | null, eu: Eu, conversa: string]): Promise<void> {
  if (PREVIA_DO_CHAT || !eu.chat) {
    await chat.apagar(conversa);
    return;
  }
  await chat.apagar(conversa);
}
