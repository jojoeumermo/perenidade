// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat a dois da onda R2 NESTE aparelho (itens 1.1, 1.2, 1.5, 2.1, 2.2, 2.4 e 2.5). Documento:
// docs/rede/CHAT-PRIVADO.md. Junta as peças (sem cifra própria):
//   pedido (pedido.ts) → sessões Proteus por aparelho (proteus.ts) → bloco (bloco.ts) dentro do envelope X-Wing (envelope.ts) →
//   depósito nas caixas anônimas (o transporte, da frente das caixas, entra como `Transporte`).
//
// O que o SERVIDOR vê: caixas sem conta (id_h, pd_h, pl_h), pacotes de tamanho fixo, o dia; o diretório público (chaves de cada
// conta, por codinome); um arquivo cifrado da conta (a lista sincronizada) que ele não lê. O que ele NÃO vê: quem conversa com quem,
// quem pediu conversa a quem, quem bloqueou quem, quantas conversas a pessoa tem, o texto, o remetente de cada pacote.
//
// Quem escreve é dono do passe de depósito (contrato com a denúncia com prova, lib/rede/caixas/franquia.ts): cada pessoa sorteia o
// SEU passe de escrita da conversa e entrega à outra só o resumo (pd_h), com que a outra cria as caixas de entrada dela; e assina a
// declaração "este passe é meu" para cada caixa em que escreve. Assim quem lê uma caixa não consegue depositar nela fingindo ser a
// outra pessoa (só troca o passe, e a troca aparece na marca do servidor).
//
// Vários aparelhos: cada aparelho tem chaves próprias e uma caixa de entrada por conversa; cada mensagem vai cifrada para CADA
// aparelho confiável da outra pessoa que já anunciou a caixa dele, e para cada outro aparelho meu (pela caixa de sincronia dele).
// A lista de conversas, os contatos, as recusas, os bloqueios e as preferências moram só nos aparelhos, sincronizados por um arquivo
// cifrado com a chave de sincronia da conta (lib/rede/aparelhos/arquivo.ts).
//
// Bloquear (2.4): troca o passe de depósito das MINHAS caixas daquela conversa, sem avisar; o depósito de quem foi bloqueado
// continua respondendo "ok" e cai fora. Os freios (20 bloqueios por hora, desbloquear só depois de 3 h) valem no aparelho.
// Pedidos (2.5): conferidos no aparelho de quem recebe ("quem pode me chamar", "recusa não se repete por 30 dias", bloqueio); o que
// não passa some em silêncio.
//
// Funções sem navegador: o armazenamento, o motor, o transporte e o histórico entram por `Dependencias` (os testes do Node rodam
// tudo com o motor de verdade e um servidor de caixas em memória: scripts/testar-r2-dupla-servico.mjs).
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ENVIO_NOVO, ESTADO_NOVO, faltando, type Aviso, type EstadoDeEnvio, type EstadoDoRemetente } from "./ordem";
import { corpoDeTexto, lerCorpoDeTexto, type Prazo, type TipoDoBloco } from "./bloco";
import { copia, deB64Url, deTexto, iguais, paraB64Url, sortear, texto, type Bytes } from "./bytes";
import {
  assinarChaveDaSemana, assinarChaveDePedidos, semanaDoCertificado, assinarDeclaracao, assinarTextoDoVoto, certificarAparelho, chaveDePedidosConfere, codigoDeSeguranca, declaracaoConfere,
  novoParEd25519, type ParEd25519, parDaSemente,
} from "./certificados";
import { type AparelhoPublico, aparelhosConfiaveis, type Destino, type Eu, mandar, receber, resumoDaCaixa, resumoDoPasse } from "./conversa";
import { novoParXWing, semanaDe, SEMANAS_ACEITAS } from "./envelope";
import { abrirPedido, fecharPedido, MAIOR_TEXTO_DO_PEDIDO } from "./pedido";
import { esquecerSessao, ligarProteus, type Motor, novasPreChaves, preChaveDeUltimoRecurso, sessaoPelaPreChave, temSessao } from "./proteus";
import { ROTULOS } from "./rotulos";
import { lerCorpoDeAnexo } from "../anexo-cifrado";
import { contagemAoEncaminhar, destinosPermitidos } from "../encaminhar";
import { horaValida } from "../agendar";
import { type CorpoDePosicao, lerCorpoDePosicao, VIDA_DO_SOS_MS } from "../../perto/posicao";
import { type CorpoDoToque, lerCorpoDoToque } from "../../chamada/toque";
import { provaDoPacote, type ProvaDeFranquia } from "../../franquia/protocolo";
import type { MotorSpqr } from "../r3/spqr";

type B64 = string;
export type QuemPode = "pedidos" | "seguidos" | "ninguem";
export type { Prazo };
export const PRAZOS: readonly Prazo[] = [1, 7, 30];
const DIA = 86_400_000;
/** "Recusa não se repete por 30 dias". */
export const DIAS_DA_RECUSA = 30;
/** Os freios do bloqueio (os de antes, agora no aparelho). */
export const BLOQUEIOS_POR_HORA = 20;
export const HORAS_PARA_DESBLOQUEAR = 3;
/** O diretório de uma pessoa é lido de novo depois disto (aparelho novo, chave da semana nova). */
const VIDA_DO_DIRETORIO = DIA;
/** Pré-chaves por vez, e o id da de último recurso. */
const PRE_CHAVES_POR_VEZ = 50;
const ID_DO_ULTIMO_RECURSO = 65535;

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

// ── O transporte (a frente das caixas: lib/rede/caixas/cliente.ts e diretorio.ts; a junção liga) ────────────────────────────
export interface PacoteBuscado {
  ordem: number;
  envelope: Uint8Array;
  franquia: Uint8Array | null;
  marca: Uint8Array | null;
  dia: string;
}
export interface AparelhoDoDiretorio {
  aparelho: Uint8Array;
  /** A assinatura do certificado do aparelho pela identidade da conta. */
  certificado: Uint8Array;
  /** A impressão da identidade Proteus do aparelho (texto em UTF-8). */
  proteusImpressao: Uint8Array;
  xwingSemana: Uint8Array;
  xwingAssinatura: Uint8Array;
  semana: number;
  /** "AAAA-MM-DD" (o dia em que o aparelho foi ligado). */
  criadoDia?: string;
}
export interface DiretorioLido {
  usuario: string;
  identidade: Uint8Array;
  pedidosXwing: Uint8Array;
  pedidosAssinatura: Uint8Array;
  pedidosCaixa: Uint8Array;
  pedidosPd: Uint8Array;
  aparelhos: AparelhoDoDiretorio[];
}
export interface PreChaveDoDiretorio {
  aparelho: Uint8Array;
  id?: number;
  pre: Uint8Array;
  assinatura: Uint8Array | null;
}
export interface Transporte {
  /** Cria a caixa (o servidor guarda só os resumos; o passe de depósito pode ser de outra pessoa, que entregou só o pd_h). */
  criarCaixa(c: { id: Bytes; pdH: Bytes; pl: Bytes }): Promise<void>;
  depositar(c: { id: Bytes; pd: Bytes }, envelope: Bytes, franquia: Bytes | null): Promise<{ ok: boolean }>;
  buscar(c: { id: Bytes; pl: Bytes }, cursor: number): Promise<PacoteBuscado[]>;
  confirmar(c: { id: Bytes; pl: Bytes }, ate: number): Promise<void>;
  /** Troca o passe de depósito. `bloqueio`: o anterior deixa de valer na hora (senão vale mais 7 dias). */
  trocar(c: { id: Bytes; pl: Bytes }, pdH: Bytes, bloqueio: boolean): Promise<void>;
  apagar(c: { id: Bytes; pl: Bytes }): Promise<void>;
  lerDiretorio(codinome: string): Promise<DiretorioLido | null>;
  reivindicar(usuario: string): Promise<PreChaveDoDiretorio[]>;
  depositarPedido(codinome: string, envelope: Bytes): Promise<void>;
  /**
   * Com a sessão da conta (o que é público mesmo): a identidade, a chave e a caixa de pedidos. O banco cria a caixa de pedidos aqui
   * (public.rede_diretorio_conta), com o resumo do passe de leitura `pedidosPl` (o passe cru não sai do aparelho).
   */
  publicarConta(c: { identidade: Bytes; pedidosXwing: Bytes; pedidosAssinatura: Bytes; pedidosCaixa: Bytes; pedidosPd: Bytes; pedidosPl: Bytes }): Promise<void>;
  publicarAparelho(a: AparelhoDoDiretorio): Promise<void>;
  publicarPreChaves(aparelho: Bytes, lista: { id: number; pkb: Bytes; assinatura: Bytes; ultima: boolean }[]): Promise<void>;
  tirarAparelho(aparelho: Bytes): Promise<void>;
  lerCofre(tipo: "lista" | "copia"): Promise<{ versao: number; blob: Uint8Array } | null>;
  /** "versao_ocupada": outro aparelho gravou antes (ler, juntar e tentar de novo). */
  gravarCofre(tipo: "lista" | "copia", versao: number, blob: Uint8Array): Promise<{ versao: number } | "versao_ocupada">;
}

/** As mensagens abertas ficam no histórico do aparelho (lib/rede/chat/historico.ts no navegador; em memória nos testes). */
export interface MensagemDoChat {
  /** O id de dentro do cifrado (base64url; o mesmo em todas as cópias). */
  id: B64;
  conversa: B64;
  autor: string;
  aparelho: B64;
  quando: number;
  expira: number;
  texto: string;
  resposta: B64 | null;
  contador: number;
  /** Os avisos da ordem (lib/rede/chat/r2/ordem.ts) e "faltando" (chegou depois de um buraco). */
  avisos: (Aviso | "faltando")[];
  /** "Ver uma vez": a tela mostra e apaga. */
  umaVez: boolean;
  /** Quem escreveu mudou o texto depois (controle "editar", dentro do cifrado). */
  editada?: boolean;
  /** Encaminhada (Prompt 4, item 14): quantas vezes o texto já foi encaminhado até chegar aqui (a contagem de dentro do cifrado). */
  encaminhada?: number;
  /** Agendada (Prompt 4, item 18): minha, ainda neste aparelho, para sair neste momento (ms). Nada foi ao servidor. */
  agendada?: number;
  /**
   * Anexo cifrado (Prompt 4, itens 137 e 138): o corpo do bloco "anexo" em base64url (lib/rede/chat/anexo-cifrado.ts, com a chave,
   * o endereço no depósito e os resumos). Vazio o `texto`. Fica no histórico do aparelho, cifrado com o resto.
   */
  anexo?: B64;
  /**
   * Pedido de ajuda (Prompt 4, item 7): o corpo da posição (lib/rede/perto/posicao.ts, JSON) que chegou com a marca "sos". Vazio o
   * `texto`. Só o pedido de ajuda fica no histórico (cifrado, por 24 h): a posição comum fica só na memória da aba, sem trajeto.
   */
  posicao?: string;
  /**
   * Escrita aqui e ainda NÃO enviada: nenhum aparelho da outra pessoa confirmou a caixa desta conversa (o aceite do pedido ainda não
   * chegou a ela). Sai sozinha quando a confirmação chegar.
   */
  pendente?: boolean;
  /**
   * A prova da franquia desta cópia (lib/rede/franquia/protocolo.ts, provaDoPacote): o resumo da caixa, o dia, o compromisso e a marca
   * do servidor como o pacote chegou, a kf e o conteúdo de dentro do cifrado. É com ela que a denúncia com prova confere no servidor.
   * Nula se o pacote veio sem a marca (servidor sem o segredo da franquia).
   */
  prova?: ProvaDeFranquia | null;
}
export interface Historico {
  guardar(m: MensagemDoChat): Promise<void>;
  /** Apaga uma mensagem pelo id de dentro do cifrado, só se o autor for o dito (ninguém apaga a mensagem de outra pessoa). */
  apagar(conversa: B64, id: B64, autor: string): Promise<void>;
  apagarConversa(conversa: B64): Promise<void>;
  /** Troca o texto de uma mensagem pelo id de dentro do cifrado, só se o autor for o dito (ninguém edita a mensagem de outra pessoa). */
  editar?(conversa: B64, id: B64, autor: string, texto: string): Promise<void>;
}

/** Arquivo cifrado da lista (entra pronto: lib/rede/aparelhos/sincronia.ts). */
export interface Cofre {
  cifrar(chave: Bytes, lista: Lista): Promise<Bytes>;
  abrir(chave: Bytes, arquivo: Uint8Array): Promise<Lista | null>;
}

export interface Dependencias {
  motor: Motor;
  /** O SPQR (onda R3, item 1.1: lib/rede/chat/r3/spqr.ts), para a camada pós-quântica de cada mensagem. */
  spqr: MotorSpqr;
  transporte: Transporte;
  historico: Historico;
  cofre: Cofre;
  /** Grava o estado deste aparelho na loja cifrada (no navegador: lib/rede/chat/r2/loja.ts). */
  persistir(e: EstadoDoAparelho): Promise<void>;
  /** Eu sigo esta conta? (para "quem pode me chamar: só quem eu sigo"; a API normal da rede, com sessão). */
  sigo(conta: string, codinome: string): Promise<boolean>;
  /** A identidade desta conta é a última do registro público de transparência? */
  conferirRegistro(conta: string, identidade: Uint8Array): Promise<"confere" | "nao_confere" | "quebrado">;
  agora?: () => number;
  /**
   * Prompt 4, item 2: uma posição compartilhada chegou (já conferida, de dentro do cifrado). Quem guarda (lib/rede/perto/guarda.ts)
   * fica só com a última de cada pessoa, na memória. Sem isto, a posição é descartada.
   */
  aoPosicao?: (p: { conversa: B64; autor: string; corpo: CorpoDePosicao; quando: number }) => void;
  /**
   * Prompt 4, itens 139 e 140: o toque de uma chamada (ou o fim dela) chegou da OUTRA pessoa desta conversa, de dentro do cifrado.
   * Quem guarda (lib/rede/chamada/guarda.ts) fica com ele só na memória. Sem isto, o toque é descartado.
   */
  aoChamada?: (c: { conversa: B64; autor: string; nome: string; corpo: CorpoDoToque; quando: number }) => void;
}

// ── O estado (JSON, base64url) ──────────────────────────────────────────────────────────────────────────────────────────────
export interface AparelhoJson {
  aparelho: B64;
  conta: string;
  proteus: string;
  criadoDia: number;
  certificado: B64;
  xwing: B64;
  semana: number;
  xwingAssinatura: B64;
}
export interface Contato {
  conta: string;
  codinome: string;
  identidade: B64;
  verificado: boolean;
  /** A identidade nova que o diretório mostrou (nada sai até a pessoa aceitar ou comparar o código). */
  mudou: B64 | null;
  registro: "confere" | "nao_confere" | "quebrado";
  aparelhos: AparelhoJson[];
  lidoEm: number;
  m: number;
}
export interface ConversaDaLista {
  id: B64;
  com: string;
  codinome: string;
  /** "enviado": pedi e espero; "recebido": me pediram; "aberta". */
  situacao: "enviado" | "recebido" | "aberta";
  /** O MEU passe de escrita nesta conversa (de todos os meus aparelhos). */
  pdEscrita: B64;
  /** O resumo do passe da outra pessoa: as minhas caixas de entrada são criadas com ele. */
  pdHDeles: B64 | null;
  /** As caixas de entrada dos aparelhos da outra pessoa (só o id: o passe é o meu). */
  destinos: Record<B64, { id: B64 }>;
  /** No pedido recebido: a caixa de resposta de quem pediu (id e passe provisório) e o texto. */
  resposta: { id: B64; pd: B64; aparelho: B64 } | null;
  texto: string;
  prazo: Prazo;
  criadaEm: number;
  ultimaEm: number;
  apagada: boolean;
  /**
   * Algum aparelho meu já recebeu o anúncio de caixa de um aparelho da outra pessoa (a caixa dela aceita o meu passe de escrita).
   * Quem aceitou o pedido só escreve depois disto: antes, a caixa de resposta de quem pediu ainda aceita só o passe provisório, e o
   * depósito com o meu passe cairia fora em silêncio. Vai para os meus outros aparelhos pela lista.
   */
  confirmada?: boolean;
  m: number;
}
export interface Lista {
  v: 1;
  conversas: Record<B64, ConversaDaLista>;
  contatos: Record<string, Contato>;
  recusas: Record<string, { ate: number; m: number }>;
  bloqueios: Record<string, { desde: number; ativo: boolean; m: number }>;
  freio: number[];
  prefs: { quemPode: QuemPode; prazo: Prazo; m: number };
  /** As caixas de sincronia dos meus aparelhos (só o id; o passe vem da chave de sincronia). */
  aparelhos: Record<B64, { sincronia: B64; tirado: boolean; m: number }>;
  /**
   * A geração da lista (dentro do cifrado): sobe a cada gravação no servidor. O aparelho guarda a maior que já viu e recusa
   * arquivo de geração menor: o servidor não consegue entregar uma lista velha, inteira e válida, para desfazer bloqueios e recusas.
   */
  g?: number;
}
export const LISTA_VAZIA = (): Lista => ({ v: 1, conversas: {}, contatos: {}, recusas: {}, bloqueios: {}, freio: [], prefs: { quemPode: "pedidos", prazo: 7, m: 0 }, aparelhos: {} });

interface CaixaMinha {
  id: B64;
  pl: B64;
}
interface DaConversaAqui {
  caixa: CaixaMinha;
  cursor: number;
  envio: EstadoDeEnvio;
  ordem: Record<B64, EstadoDoRemetente>;
  /** O pd_h com que a minha caixa está agora (o da outra pessoa, ou um sorteado no bloqueio). */
  pdHAgora: B64;
  bloqueada: boolean;
  /** Aparelhos da outra pessoa aos quais já anunciei a minha caixa (com a declaração). */
  anunciada: Record<B64, boolean>;
  /** As declarações que recebi para a minha caixa (para a denúncia com prova). */
  declaracoes: Record<B64, B64>;
  naoLidas: number;
  /** As mensagens escritas antes de a outra pessoa confirmar a caixa (saem quando ela confirmar). Só neste aparelho. */
  pendentes?: Pendente[];
  /** Prompt 4, item 18: as mensagens agendadas (saem na hora, se este aparelho estiver ligado com a Alumia aberta). Só aqui. */
  agendadas?: Agendada[];
}
/** Uma mensagem agendada (item 18): fica só neste aparelho, na loja cifrada; o servidor não sabe que existe. */
export interface Agendada {
  /** O id provisório (o do histórico até sair). */
  id: B64;
  texto: string;
  /** Quando sair (ms). */
  quando: number;
}
interface Pendente {
  /** O id provisório (o do histórico até sair). */
  id: B64;
  texto: string;
  quando: number;
  resposta?: B64;
  umaVez?: boolean;
  minutos?: number;
  /** Encaminhada (Prompt 4, item 14): a contagem que vai dentro do cifrado. */
  encaminhada?: number;
}
export interface EstadoDoAparelho {
  v: 1;
  conta: string;
  codinome: string;
  /** As chaves da conta (vão a outro aparelho só pelo QR de ligar ou pela cópia). */
  identidade: B64;
  pedidos: B64;
  sincronia: B64;
  /**
   * `sincroniaCriada`: a caixa de sincronia deste aparelho já foi criada no servidor (pela rotina SEM sessão, longe da publicação da
   * conta no diretório; ausente nos aparelhos de antes da revisão final, que a criavam ao nascer).
   */
  aparelho: { chave: B64; impressao: string; semanas: Record<string, B64>; publico: AparelhoJson; sincronia: CaixaMinha; preChaves: number; sincroniaCriada?: boolean };
  porConversa: Record<B64, DaConversaAqui>;
  cursores: { sincronia: number; pedidos: number };
  lista: Lista;
  listaVersao: number;
  /** A maior geração da lista que este aparelho já viu (ou gravou): arquivo do servidor com geração menor é recusado. */
  listaGeracao?: number;
  /** A lista mudou aqui desde a última gravação no servidor (a rotina com sessão grava de todo jeito; isto é só para a tela). */
  listaSuja?: boolean;
  /**
   * Onda R3 (item 1.1): o estado do SPQR com cada aparelho da outra ponta (e meus outros), pela chave do aparelho. `a`: a auth_key
   * sorteada aqui, enquanto aquele aparelho não respondeu. Fica só neste aparelho (não vai à cópia nem à lista) e sai no "Sair rápido".
   */
  spqr?: Record<B64, { e: B64; a?: B64 }>;
  /** Prompt 4, item 15: o contador e a ordem das notas para mim (como os de uma conversa, só que sem caixa: vão pela sincronia). */
  notas?: { envio: EstadoDeEnvio; ordem: Record<B64, EstadoDoRemetente> };
}

// ── Conversões ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const dataDoDia = (dia: number) => new Date(dia * DIA).toISOString().slice(0, 10);
const diaDaData = (d: string | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Math.round(Date.parse(`${d}T00:00:00Z`) / DIA) : NaN);

export function aparelhoDeJson(a: AparelhoJson): AparelhoPublico {
  const aparelho = deB64Url(a.aparelho);
  return { aparelho, certificado: { conta: a.conta, aparelho, proteus: a.proteus, criadoDia: a.criadoDia, assinatura: deB64Url(a.certificado) }, xwing: deB64Url(a.xwing), semana: a.semana, xwingAssinatura: deB64Url(a.xwingAssinatura) };
}
function jsonDoDiretorio(conta: string, a: AparelhoDoDiretorio): AparelhoJson {
  return {
    aparelho: paraB64Url(a.aparelho), conta, proteus: deTexto(a.proteusImpressao), criadoDia: diaDaData(a.criadoDia), certificado: paraB64Url(a.certificado),
    xwing: paraB64Url(a.xwingSemana), semana: a.semana, xwingAssinatura: paraB64Url(a.xwingAssinatura),
  };
}
function paraODiretorio(a: AparelhoJson): AparelhoDoDiretorio {
  return { aparelho: deB64Url(a.aparelho), certificado: deB64Url(a.certificado), proteusImpressao: texto(a.proteus), xwingSemana: deB64Url(a.xwing), xwingAssinatura: deB64Url(a.xwingAssinatura), semana: a.semana, criadoDia: dataDoDia(a.criadoDia) };
}
function jsonDoPublico(p: AparelhoPublico): AparelhoJson {
  return { aparelho: paraB64Url(p.aparelho), conta: p.certificado.conta, proteus: p.certificado.proteus, criadoDia: p.certificado.criadoDia, certificado: paraB64Url(p.certificado.assinatura), xwing: paraB64Url(p.xwing), semana: p.semana, xwingAssinatura: paraB64Url(p.xwingAssinatura) };
}

/**
 * Notas para mim (Prompt 4, item 15): uma conversa só comigo mesma. O id dela sai da chave de sincronia da conta (todos os meus
 * aparelhos chegam ao mesmo, e o servidor não o conhece); as notas vão, como qualquer mensagem, só às caixas de sincronia dos meus
 * outros aparelhos, cifradas para cada um, e ficam no histórico cifrado de cada aparelho. Não vencem com o prazo das conversas.
 */
export const DIAS_DAS_NOTAS = 3650;
const ROTULO_DAS_NOTAS = "alumia/p4/notas-para-mim/v1";
export const idDasNotas = (sincronia: Uint8Array): B64 => paraB64Url(copia(hkdf(sha256, sincronia, new Uint8Array(0), texto(ROTULO_DAS_NOTAS), 16)));

/** O que sai da chave de sincronia da conta (HKDF-SHA-256 da @noble/hashes): a caixa de pedidos e o passe das caixas de sincronia. */
export function derivadosDaConta(sincronia: Uint8Array) {
  const tirar = (rotulo: string) => copia(hkdf(sha256, sincronia, new Uint8Array(0), texto(rotulo), 32));
  return { pedidos: { id: tirar(ROTULOS.pedidosCaixa), pl: tirar(ROTULOS.pedidosLeitura), pd: tirar(ROTULOS.pedidosDeposito) }, pdSincronia: tirar(ROTULOS.sincroniaDeposito) };
}

// ── Juntar duas listas (aparelhos diferentes da mesma pessoa): por item, vence a mudança mais nova (`m`) ─────────────────────
function juntarRegistros<T extends { m: number }>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const saida: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) if (!saida[k] || v.m > saida[k].m) saida[k] = v;
  return saida;
}
export function juntarListas(a: Lista, b: Lista): Lista {
  const conversas = juntarRegistros(a.conversas, b.conversas);
  // As caixas da outra pessoa só se acumulam (cada aparelho meu pode ter recebido o anúncio de um aparelho diferente).
  for (const [k, v] of Object.entries(conversas)) {
    const outro = (a.conversas[k] === v ? b : a).conversas[k];
    if (outro) conversas[k] = { ...v, destinos: { ...outro.destinos, ...v.destinos } };
  }
  return {
    v: 1,
    g: Math.max(a.g ?? 0, b.g ?? 0),
    conversas,
    contatos: juntarRegistros(a.contatos, b.contatos),
    recusas: juntarRegistros(a.recusas, b.recusas),
    bloqueios: juntarRegistros(a.bloqueios, b.bloqueios),
    freio: [...new Set([...a.freio, ...b.freio])].sort((x, y) => x - y).slice(-BLOQUEIOS_POR_HORA * 2),
    prefs: b.prefs.m > a.prefs.m ? b.prefs : a.prefs,
    aparelhos: juntarRegistros(a.aparelhos, b.aparelhos),
  };
}

// ── O controle que vai dentro dos blocos ────────────────────────────────────────────────────────────────────────────────────
/** Anúncio de caixa: "a minha caixa de entrada desta conversa é esta" + a declaração do passe com que vou escrever na SUA caixa. */
interface Anuncio {
  a: "caixa";
  caixa: B64;
  /** O resumo do MEU passe de escrita (no aceite, a pessoa que pediu troca para ele o passe provisório). */
  pdH: B64;
  declaracao: B64;
  aceite?: true;
}
interface Apagar {
  a: "apagar";
  id: B64;
}
/** Editar: o texto novo de uma mensagem minha (dentro do cifrado, como o "apagar"; quem recebe confere que o autor é quem pede). */
interface Editar {
  a: "editar";
  id: B64;
  t: string;
}
/** Prompt 4, itens 2, 7 e 8: uma posição compartilhada (o corpo de lib/rede/perto/posicao.ts, em JSON), dentro do cifrado. */
interface Posicao {
  a: "posicao";
  p: string;
}
/** Prompt 4, itens 139 e 140: o toque de uma chamada (o corpo de lib/rede/chamada/toque.ts, em JSON), dentro do cifrado. */
interface Chamada {
  a: "chamada";
  c: string;
}
type Controle = Anuncio | Apagar | Editar | Posicao | Chamada;
const controle = (c: Controle) => texto(JSON.stringify(c));
function lerControle(corpo: Uint8Array): Controle | null {
  try {
    const c = JSON.parse(deTexto(corpo));
    if (c?.a === "caixa" && typeof c.caixa === "string" && typeof c.pdH === "string" && typeof c.declaracao === "string") return c;
    if (c?.a === "apagar" && typeof c.id === "string") return c;
    if (c?.a === "editar" && typeof c.id === "string" && typeof c.t === "string" && c.t.trim() && [...c.t].length <= 2000) return c;
    if (c?.a === "posicao" && typeof c.p === "string" && c.p.length <= 512 && lerCorpoDePosicao(c.p)) return c;
    if (c?.a === "chamada" && typeof c.c === "string" && lerCorpoDoToque(c.c)) return c;
    return null;
  } catch {
    return null;
  }
}

// ── O serviço ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export class ChatDoAparelho {
  private readonly d: Dependencias;
  estado: EstadoDoAparelho;
  constructor(d: Dependencias, estado: EstadoDoAparelho) {
    this.d = d;
    this.estado = estado;
  }

  private agora() {
    return this.d.agora?.() ?? Date.now();
  }
  private get identidade(): ParEd25519 {
    return parDaSemente(deB64Url(this.estado.identidade));
  }
  private get chaveDoAparelho(): ParEd25519 {
    return parDaSemente(deB64Url(this.estado.aparelho.chave));
  }
  private get derivados() {
    return derivadosDaConta(deB64Url(this.estado.sincronia));
  }
  private idDasNotasCache: B64 | null = null;
  /** O id da conversa das notas para mim (item 15): o mesmo em todos os meus aparelhos. */
  get notas(): B64 {
    this.idDasNotasCache ??= idDasNotas(deB64Url(this.estado.sincronia));
    return this.idDasNotasCache;
  }
  private estadoDasNotas() {
    this.estado.notas ??= { envio: ENVIO_NOVO, ordem: {} };
    return this.estado.notas;
  }

  /** Escreve uma nota para mim (item 15): fica aqui e vai, cifrada, só aos meus outros aparelhos. */
  async mandarNota(t: string): Promise<{ id: B64; entregues: number }> {
    const limpo = t.trim();
    if (!limpo || [...limpo].length > 2000) throw erro("texto_grande");
    const id = this.notas;
    const r = await this.enviarBloco(id, "texto", corpoDeTexto({ t: limpo }), [], true);
    const agora = this.agora();
    await this.d.historico.guardar({
      id: paraB64Url(r.id), conversa: id, autor: this.estado.conta, aparelho: this.estado.aparelho.publico.aparelho, quando: agora, expira: agora + DIAS_DAS_NOTAS * DIA,
      texto: limpo.normalize("NFC"), resposta: null, contador: r.estado.contador, avisos: [], umaVez: false, prova: null,
    });
    await this.gravar();
    return { id: paraB64Url(r.id), entregues: r.entregues };
  }

  /** Apaga uma nota daqui e dos meus outros aparelhos (o controle "apagar" de sempre, pela sincronia). */
  async apagarNota(mensagem: B64): Promise<void> {
    await this.d.historico.apagar(this.notas, mensagem, this.estado.conta);
    await this.enviarBloco(this.notas, "controle", controle({ a: "apagar", id: mensagem }), [], true).catch(() => undefined);
    await this.gravar();
  }
  private get eu(): Eu {
    return {
      conta: this.estado.conta,
      aparelho: deB64Url(this.estado.aparelho.publico.aparelho),
      motor: this.d.motor,
      chaveDaSemana: async (s) => {
        const p = this.estado.aparelho.semanas[s];
        return p ? deB64Url(p) : null;
      },
      pq: {
        motor: this.d.spqr,
        ler: (aparelho) => {
          const r = this.estado.spqr?.[paraB64Url(aparelho)];
          return r ? { e: deB64Url(r.e), a: r.a ? deB64Url(r.a) : null } : null;
        },
        gravar: (aparelho, r) => {
          this.estado.spqr ??= {};
          this.estado.spqr[paraB64Url(aparelho)] = { e: paraB64Url(r.e), ...(r.a ? { a: paraB64Url(r.a) } : {}) };
        },
      },
    };
  }
  private async gravar() {
    await this.d.persistir(this.estado);
  }

  // ── Nascer: o primeiro aparelho da conta, ou um aparelho novo com as chaves vindas do QR ou da cópia ──
  /**
   * Cria (ou reaproveita, se `chaves` vierem do QR de ligar ou da cópia) as chaves da conta e um aparelho NOVO: chave própria, Proteus
   * ligado no motor, chave X-Wing da semana, certificado assinado pela identidade, pré-chaves e a caixa de sincronia. Publica no
   * diretório. Nunca reaproveita sessão nem chave de aparelho: a cópia e o QR não ressuscitam chave velha.
   */
  static async nascer(d: Dependencias, conta: string, codinome: string, chaves?: { identidade: Bytes; pedidos: Bytes; sincronia: Bytes; lista?: Lista | null; geracao?: number }): Promise<ChatDoAparelho> {
    const agora = d.agora?.() ?? Date.now();
    const identidade = chaves ? parDaSemente(chaves.identidade) : novoParEd25519();
    let pedidos: { publica: Bytes; privada: Bytes };
    if (chaves) {
      const { XWing } = await import("@noble/post-quantum/hybrid.js");
      pedidos = { privada: copia(chaves.pedidos), publica: copia(XWing.getPublicKey(chaves.pedidos)) };
    } else {
      pedidos = await novoParXWing();
    }
    const sincronia = chaves ? copia(chaves.sincronia) : sortear(32);
    const der = derivadosDaConta(sincronia);
    const chave = novoParEd25519();
    const impressao = await ligarProteus(d.motor);
    const semana = semanaDe(agora);
    const xw = await novoParXWing();
    const publico: AparelhoPublico = {
      aparelho: chave.publica,
      certificado: certificarAparelho(identidade, conta, chave.publica, impressao, semanaDoCertificado(agora)),
      xwing: xw.publica,
      semana,
      xwingAssinatura: assinarChaveDaSemana(chave, xw.publica, semana),
    };
    const caixaDeSincronia = { id: sortear(32), pl: sortear(32) };
    // A lista que veio da cópia pode ser de uma versão anterior: o que faltar volta vazio. A caixa de sincronia deste aparelho só
    // entra na lista quando a rotina SEM sessão a criar (rotinaAnonima).
    const lista: Lista = chaves?.lista ? { ...LISTA_VAZIA(), ...chaves.lista } : LISTA_VAZIA();
    const estado: EstadoDoAparelho = {
      v: 1,
      conta,
      codinome,
      identidade: paraB64Url(identidade.privada),
      pedidos: paraB64Url(pedidos.privada),
      sincronia: paraB64Url(sincronia),
      aparelho: { chave: paraB64Url(chave.privada), impressao, semanas: { [semana]: paraB64Url(xw.privada) }, publico: jsonDoPublico(publico), sincronia: { id: paraB64Url(caixaDeSincronia.id), pl: paraB64Url(caixaDeSincronia.pl) }, preChaves: 0, sincroniaCriada: false },
      porConversa: {},
      cursores: { sincronia: 0, pedidos: 0 },
      lista,
      listaVersao: 0,
      // A geração que veio do aparelho velho (QR) ou da cópia: daí para baixo, o servidor não volta a lista.
      listaGeracao: Math.max(chaves?.geracao ?? 0, lista.g ?? 0),
      listaSuja: true,
    };
    const chat = new ChatDoAparelho(d, estado);
    const t = d.transporte;
    // A caixa de pedidos é criada pelo banco na publicação da conta (que recusa apontar para uma caixa que já existe e não é desta
    // conta): criá-la antes pela rota anônima faria a publicação falhar com "caixa_ocupada". A caixa de SINCRONIA não é criada aqui:
    // criada logo antes (ou logo depois) da publicação da conta, a ordem das transações no banco (xmin) a ligava à conta, e com ela o
    // passe anônimo gasto. Quem a cria é a rotina sem sessão, num horário sorteado (rotinaAnonima).
    await t.publicarConta({ identidade: identidade.publica, pedidosXwing: pedidos.publica, pedidosAssinatura: assinarChaveDePedidos(identidade, conta, pedidos.publica), pedidosCaixa: der.pedidos.id, pedidosPd: der.pedidos.pd, pedidosPl: der.pedidos.pl });
    await t.publicarAparelho(paraODiretorio(estado.aparelho.publico));
    await chat.publicarPreChaves();
    await chat.gravar();
    // A lista que já está no servidor (outro aparelho da conta): só LER, que não deixa rastro no banco. Gravar é da rotina.
    await chat.lerLista().catch(() => undefined);
    return chat;
  }

  private async publicarPreChaves() {
    const chave = this.chaveDoAparelho;
    const lista = await novasPreChaves(this.d.motor, chave, PRE_CHAVES_POR_VEZ);
    const ultima = await preChaveDeUltimoRecurso(this.d.motor, chave, ID_DO_ULTIMO_RECURSO);
    await this.d.transporte.publicarPreChaves(chave.publica, [...lista.map((p) => ({ ...p, ultima: false })), { ...ultima, ultima: true }]);
    this.estado.aparelho.preChaves = 0;
  }

  /** A troca semanal da chave X-Wing (publica a nova) e o fim das privadas de mais de 5 semanas. Chamar ao abrir o chat. */
  async trocarChaveDaSemana(): Promise<boolean> {
    const semana = semanaDe(this.agora());
    const a = this.estado.aparelho;
    for (const s of Object.keys(a.semanas)) if (Number(s) < semana - SEMANAS_ACEITAS) delete a.semanas[s];
    if (a.publico.semana === semana) {
      await this.gravar();
      return false;
    }
    const xw = await novoParXWing();
    a.semanas[semana] = paraB64Url(xw.privada);
    a.publico = { ...a.publico, xwing: paraB64Url(xw.publica), semana, xwingAssinatura: paraB64Url(assinarChaveDaSemana(this.chaveDoAparelho, xw.publica, semana)) };
    await this.d.transporte.publicarAparelho(paraODiretorio(a.publico));
    await this.gravar();
    return true;
  }

  // ── A lista sincronizada e o relógio próprio ──
  // Revisão final da R2 (metadados): a lista é gravada no servidor COM a sessão da conta. Gravada logo depois de cada evento (pedido,
  // aceite, anúncio de caixa), a ordem das transações no banco (um gatilho do dono, a replicação ou o WAL) ligava a chamada anônima de
  // um segundo antes à conta: quem pediu conversa a quem e quem criou cada caixa. Agora nenhum evento grava com sessão: ele só marca a
  // lista aqui (listaMudou), e a gravação sai pela rotina com sessão, num relógio próprio (lib/rede/chat/r2/navegador.ts: período fixo,
  // fase sorteada), que regrava a lista SEMPRE, mudada ou não (o arquivo é recifrado a cada vez: gravar não diz que algo mudou). O que é
  // anônimo e não é resposta a um evento (criar a caixa de sincronia) sai pela rotina sem sessão, num instante sorteado dentro do período.

  /** A lista mudou aqui: grava no aparelho e espera a rotina com sessão para ir ao servidor. */
  private async listaMudou(): Promise<void> {
    this.estado.listaSuja = true;
    await this.gravar();
  }

  /** Lê o arquivo da lista no servidor e junta com a deste aparelho, SEM gravar no servidor (ler não deixa rastro no banco). */
  async lerLista(): Promise<void> {
    const guardado = await this.d.transporte.lerCofre("lista");
    if (!guardado) return;
    const deLa = await this.d.cofre.abrir(deB64Url(this.estado.sincronia), guardado.blob);
    if (deLa) this.juntarDoServidor(deLa);
    await this.gravar();
  }

  /** Junta a lista que veio do servidor, se não for de geração menor que a já vista aqui (lista velha devolvida pelo servidor). */
  private juntarDoServidor(deLa: Lista): boolean {
    if ((deLa.g ?? 0) < (this.estado.listaGeracao ?? 0)) return false;
    this.estado.lista = juntarListas(this.estado.lista, deLa);
    this.estado.listaGeracao = Math.max(this.estado.listaGeracao ?? 0, deLa.g ?? 0);
    return true;
  }

  /** A geração da lista que este aparelho conhece (vai ao aparelho novo pelo QR de ligar). */
  geracaoDaLista(): number {
    return this.estado.listaGeracao ?? 0;
  }

  /**
   * A rotina COM sessão (o relógio próprio chama no período fixo; nunca um evento): repõe as pré-chaves gastas e regrava a lista
   * no servidor, mudada ou não.
   */
  async rotinaComSessao(): Promise<void> {
    if (this.estado.aparelho.preChaves >= PRE_CHAVES_POR_VEZ / 2) await this.publicarPreChaves();
    await this.sincronizarLista();
    this.estado.listaSuja = false;
    await this.gravar();
  }

  /** A rotina SEM sessão (num instante sorteado do período): cria a caixa de sincronia deste aparelho, se ainda não existe. */
  async rotinaAnonima(): Promise<void> {
    const a = this.estado.aparelho;
    if (a.sincroniaCriada !== false) return;
    await this.d.transporte.criarCaixa({ id: deB64Url(a.sincronia.id), pdH: resumoDoPasse(this.derivados.pdSincronia), pl: deB64Url(a.sincronia.pl) });
    a.sincroniaCriada = true;
    this.estado.lista.aparelhos[a.publico.aparelho] = this.mudar({ sincronia: a.sincronia.id, tirado: false, m: 0 });
    await this.listaMudou();
  }

  /** Lê o arquivo da lista no servidor, junta com a deste aparelho e grava de volta (com a versão: dois aparelhos não se apagam). Só a rotina com sessão chama. */
  async sincronizarLista(): Promise<void> {
    const chave = deB64Url(this.estado.sincronia);
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const guardado = await this.d.transporte.lerCofre("lista");
      if (guardado) {
        const deLa = await this.d.cofre.abrir(chave, guardado.blob);
        if (deLa) this.juntarDoServidor(deLa);
      }
      // A geração nova vai dentro do cifrado: a lista velha (de geração menor) que o servidor guardar não volta a nenhum aparelho meu.
      const geracao = (this.estado.listaGeracao ?? 0) + 1;
      this.estado.lista.g = geracao;
      const r = await this.d.transporte.gravarCofre("lista", guardado?.versao ?? 0, await this.d.cofre.cifrar(chave, this.estado.lista));
      if (r !== "versao_ocupada") {
        this.estado.listaVersao = r.versao;
        this.estado.listaGeracao = geracao;
        await this.gravar();
        return;
      }
    }
    throw erro("lista_ocupada");
  }

  private mudar<T extends { m: number }>(registro: T): T {
    registro.m = Math.max(this.agora(), registro.m + 1);
    return registro;
  }

  // ── Contatos e diretório ──
  /**
   * Lê o diretório de uma conta (sem sessão, rota anônima) e atualiza o contato: aparelhos confiáveis (certificados pela identidade
   * conhecida), registro de transparência e identidade mudada.
   */
  async contatoPorCodinome(codinome: string, forcar = false): Promise<Contato | null> {
    const existente = Object.values(this.estado.lista.contatos).find((c) => c.codinome === codinome);
    if (existente && !forcar && this.agora() - existente.lidoEm < VIDA_DO_DIRETORIO) return existente;
    const dir = await this.d.transporte.lerDiretorio(codinome);
    if (!dir) return null;
    if (dir.usuario === this.estado.conta) throw erro("dm_fechada");
    if (!chaveDePedidosConfere(dir.identidade, dir.usuario, dir.pedidosXwing, dir.pedidosAssinatura)) throw erro("dm_chave_estranha");
    const registro = await this.d.conferirRegistro(dir.usuario, dir.identidade);
    const antes = this.estado.lista.contatos[dir.usuario];
    const identidadeConhecida = antes ? deB64Url(antes.identidade) : dir.identidade;
    const mudou = antes && !iguais(identidadeConhecida, dir.identidade) ? paraB64Url(dir.identidade) : null;
    const aparelhos = dir.aparelhos.map((a) => jsonDoDiretorio(dir.usuario, a));
    const contato: Contato = this.mudar({
      conta: dir.usuario, codinome, identidade: paraB64Url(identidadeConhecida), verificado: antes?.verificado ?? false, mudou, registro, aparelhos, lidoEm: this.agora(), m: antes?.m ?? 0,
    });
    this.estado.lista.contatos[dir.usuario] = contato;
    return contato;
  }

  /** Os aparelhos confiáveis de um contato: só os certificados pela identidade que este aparelho conhece. */
  private confiaveis(c: Contato): AparelhoPublico[] {
    return aparelhosConfiaveis(c.conta, deB64Url(c.identidade), c.aparelhos.map(aparelhoDeJson), this.agora());
  }
  /** Os meus outros aparelhos (para a sincronia), conferidos pela minha identidade. */
  private async meusOutros(forcar = false): Promise<AparelhoPublico[]> {
    let eu = this.estado.lista.contatos[this.estado.conta];
    if (!eu || forcar || this.agora() - eu.lidoEm > VIDA_DO_DIRETORIO) {
      const dir = await this.d.transporte.lerDiretorio(this.estado.codinome);
      if (!dir || dir.usuario !== this.estado.conta) return [];
      eu = this.mudar({ conta: this.estado.conta, codinome: this.estado.codinome, identidade: paraB64Url(this.identidade.publica), verificado: true, mudou: null, registro: "confere" as const, aparelhos: dir.aparelhos.map((a) => jsonDoDiretorio(this.estado.conta, a)), lidoEm: this.agora(), m: eu?.m ?? 0 });
      this.estado.lista.contatos[this.estado.conta] = eu;
    }
    const meu = this.estado.aparelho.publico.aparelho;
    return aparelhosConfiaveis(this.estado.conta, this.identidade.publica, eu.aparelhos.map(aparelhoDeJson), this.agora()).filter(
      (a) => paraB64Url(a.aparelho) !== meu && this.estado.lista.aparelhos[paraB64Url(a.aparelho)] && !this.estado.lista.aparelhos[paraB64Url(a.aparelho)].tirado,
    );
  }

  /** Abre sessão Proteus com cada aparelho que ainda não tem (pré-chave do diretório, por pedido anônimo, assinada pelo aparelho). */
  private async garantirSessoes(conta: string, aparelhos: readonly AparelhoPublico[]) {
    const faltam: AparelhoPublico[] = [];
    for (const a of aparelhos) if (!(await temSessao(this.d.motor, a.aparelho))) faltam.push(a);
    if (!faltam.length) return;
    const pres = await this.d.transporte.reivindicar(conta);
    for (const a of faltam) {
      const p = pres.find((x) => iguais(x.aparelho, a.aparelho));
      if (!p || !p.assinatura || p.id === undefined) continue;
      try {
        await sessaoPelaPreChave(this.d.motor, a.aparelho, a.certificado.proteus, { id: p.id, pkb: copia(p.pre), assinatura: copia(p.assinatura) });
      } catch {
        // Pré-chave sem assinatura ou com outra identidade Proteus: o aparelho fica sem sessão (e sem mensagem).
      }
    }
  }

  private bloqueado(conta: string) {
    return !!this.estado.lista.bloqueios[conta]?.ativo;
  }

  // ── Pedir, aceitar, recusar ──
  /** Pede conversa a um codinome. Devolve o id da conversa (só neste e nos meus aparelhos). */
  async pedirConversa(codinome: string, textoDoPedido = ""): Promise<B64> {
    if ([...textoDoPedido].length > MAIOR_TEXTO_DO_PEDIDO) throw erro("texto_grande");
    const contato = await this.contatoPorCodinome(codinome, true);
    if (!contato) throw erro("dm_fechada");
    if (this.bloqueado(contato.conta)) throw erro("dm_fechada");
    const ja = Object.values(this.estado.lista.conversas).find((c) => c.com === contato.conta && !c.apagada);
    if (ja) return ja.id;
    if (contato.registro !== "confere") throw erro("dm_fora_do_registro");
    const dir = await this.d.transporte.lerDiretorio(codinome);
    if (!dir || dir.usuario !== contato.conta || !iguais(dir.identidade, deB64Url(contato.identidade))) throw erro("dm_identidade_mudou");
    const conversa = sortear(16);
    const pdEscrita = sortear(32);
    const caixa = { id: sortear(32), pl: sortear(32) };
    const provisorio = sortear(32);
    await this.d.transporte.criarCaixa({ id: caixa.id, pdH: resumoDoPasse(provisorio), pl: caixa.pl });
    const envelope = await fecharPedido(dir.pedidosXwing, this.identidade, {
      conversa, conta: this.estado.conta, codinome: this.estado.codinome, identidade: this.identidade.publica, aparelho: deB64Url(this.estado.aparelho.publico.aparelho),
      texto: textoDoPedido, resposta: { id: caixa.id, pd: provisorio }, pdH: resumoDoPasse(pdEscrita),
    });
    await this.d.transporte.depositarPedido(codinome, envelope);
    const id = paraB64Url(conversa);
    const agora = this.agora();
    this.estado.lista.conversas[id] = this.mudar({
      id, com: contato.conta, codinome, situacao: "enviado", pdEscrita: paraB64Url(pdEscrita), pdHDeles: null, destinos: {}, resposta: null, texto: textoDoPedido,
      prazo: this.estado.lista.prefs.prazo, criadaEm: agora, ultimaEm: agora, apagada: false, m: 0,
    });
    this.estado.porConversa[id] = { caixa: { id: paraB64Url(caixa.id), pl: paraB64Url(caixa.pl) }, cursor: 0, envio: ENVIO_NOVO, ordem: {}, pdHAgora: paraB64Url(resumoDoPasse(provisorio)), bloqueada: false, anunciada: {}, declaracoes: {}, naoLidas: 0 };
    await this.gravar();
    await this.listaMudou();
    return id;
  }

  /**
   * Lê a caixa de pedidos da conta. Cada pedido é conferido NO APARELHO: a assinatura da identidade, a identidade contra o diretório
   * e o registro de transparência, "quem pode me chamar", o bloqueio e a recusa de 30 dias. O que não passa some em silêncio. De
   * quem eu sigo, a conversa abre direto (a regra de antes).
   */
  async receberPedidos(): Promise<number> {
    const der = this.derivados;
    const caixa = { id: der.pedidos.id, pl: der.pedidos.pl };
    const pacotes = await this.d.transporte.buscar(caixa, this.estado.cursores.pedidos);
    let novos = 0;
    let ate = 0;
    for (const pac of pacotes) {
      ate = Math.max(ate, pac.ordem);
      const p = await abrirPedido(deB64Url(this.estado.pedidos), pac.envelope);
      if (!p || p.conta === this.estado.conta) continue;
      const id = paraB64Url(p.conversa);
      if (this.estado.lista.conversas[id]) continue;
      const prefs = this.estado.lista.prefs;
      const recusa = this.estado.lista.recusas[p.conta];
      if (this.bloqueado(p.conta) || (recusa && recusa.ate > this.agora()) || prefs.quemPode === "ninguem") continue;
      if (Object.values(this.estado.lista.conversas).some((c) => c.com === p.conta && !c.apagada)) continue;
      const sigo = await this.d.sigo(p.conta, p.codinome).catch(() => false);
      if (prefs.quemPode === "seguidos" && !sigo) continue;
      const contato = await this.contatoPorCodinome(p.codinome, true).catch(() => null);
      if (!contato || contato.conta !== p.conta || contato.mudou || !iguais(deB64Url(contato.identidade), p.identidade) || contato.registro !== "confere") continue;
      const agora = this.agora();
      this.estado.lista.conversas[id] = this.mudar({
        id, com: p.conta, codinome: p.codinome, situacao: "recebido", pdEscrita: paraB64Url(sortear(32)), pdHDeles: paraB64Url(p.pdH), destinos: {},
        resposta: { id: paraB64Url(p.resposta.id), pd: paraB64Url(p.resposta.pd), aparelho: paraB64Url(p.aparelho) }, texto: p.texto, prazo: prefs.prazo, criadaEm: agora, ultimaEm: agora, apagada: false, m: 0,
      });
      novos++;
      if (sigo) await this.aceitar(id);
    }
    if (ate > 0) {
      await this.d.transporte.confirmar(caixa, ate);
      this.estado.cursores.pedidos = ate;
    }
    await this.gravar();
    if (novos) await this.listaMudou();
    return novos;
  }

  /** Aceita um pedido: cria a minha caixa, abre as sessões e manda o aceite (com a caixa e a declaração) pela caixa de resposta. */
  async aceitar(id: B64): Promise<void> {
    const c = this.estado.lista.conversas[id];
    if (!c || c.situacao !== "recebido" || !c.resposta) throw erro("nao_encontrado");
    c.situacao = "aberta";
    this.mudar(c);
    await this.garantirMinhaCaixa(id);
    // A caixa de resposta é a caixa de entrada do aparelho que pediu, nesta conversa.
    c.destinos[c.resposta.aparelho] = { id: c.resposta.id };
    await this.anunciar(id, { provisorio: deB64Url(c.resposta.pd) });
    await this.gravar();
    await this.listaMudou();
  }

  /** Recusa um pedido: some daqui e a mesma pessoa não consegue pedir de novo por 30 dias. Ela não é avisada. */
  async recusar(id: B64): Promise<void> {
    const c = this.estado.lista.conversas[id];
    if (!c || c.situacao !== "recebido") throw erro("nao_encontrado");
    this.estado.lista.recusas[c.com] = this.mudar({ ate: this.agora() + DIAS_DA_RECUSA * DIA, m: 0 });
    c.apagada = true;
    c.resposta = null;
    this.mudar(c);
    await this.gravar();
    await this.listaMudou();
  }

  /** A minha caixa de entrada nesta conversa (criada uma vez por aparelho, com o pd_h da outra pessoa). */
  private async garantirMinhaCaixa(id: B64): Promise<DaConversaAqui> {
    const ja = this.estado.porConversa[id];
    if (ja) return ja;
    const c = this.estado.lista.conversas[id];
    if (!c?.pdHDeles) throw erro("dm_aguardando");
    const caixa = { id: sortear(32), pl: sortear(32) };
    const bloqueada = this.bloqueado(c.com);
    const pdH = bloqueada ? resumoDoPasse(sortear(32)) : deB64Url(c.pdHDeles);
    await this.d.transporte.criarCaixa({ id: caixa.id, pdH, pl: caixa.pl });
    const aqui: DaConversaAqui = { caixa: { id: paraB64Url(caixa.id), pl: paraB64Url(caixa.pl) }, cursor: 0, envio: ENVIO_NOVO, ordem: {}, pdHAgora: paraB64Url(pdH), bloqueada, anunciada: {}, declaracoes: {}, naoLidas: 0 };
    this.estado.porConversa[id] = aqui;
    return aqui;
  }

  /**
   * Anuncia a minha caixa desta conversa a cada aparelho da outra pessoa que tem caixa conhecida e ainda não recebeu o anúncio, com a
   * declaração do meu passe de escrita para a caixa DELE. `provisorio`: no aceite, o passe provisório da caixa de resposta.
   */
  private async anunciar(id: B64, opcoes: { provisorio?: Bytes } = {}) {
    const c = this.estado.lista.conversas[id];
    const aqui = this.estado.porConversa[id];
    if (!c || !aqui || c.situacao !== "aberta") return;
    const contato = this.estado.lista.contatos[c.com];
    if (!contato || contato.mudou || contato.registro !== "confere") return;
    const confiaveis = this.confiaveis(contato).filter((a) => c.destinos[paraB64Url(a.aparelho)] && !aqui.anunciada[paraB64Url(a.aparelho)]);
    if (!confiaveis.length) return;
    await this.garantirSessoes(c.com, confiaveis);
    const pdH = resumoDoPasse(deB64Url(c.pdEscrita));
    for (const a of confiaveis) {
      const k = paraB64Url(a.aparelho);
      const caixaDeles = deB64Url(c.destinos[k].id);
      const anuncio: Anuncio = {
        a: "caixa", caixa: aqui.caixa.id, pdH: paraB64Url(pdH),
        declaracao: paraB64Url(assinarDeclaracao(this.identidade, resumoDaCaixa(caixaDeles), pdH, this.estado.conta)),
        ...(opcoes.provisorio ? { aceite: true as const } : {}),
      };
      const pd = opcoes.provisorio ?? deB64Url(c.pdEscrita);
      const r = await this.enviarBloco(id, "caixas", controle(anuncio), [{ aparelho: a, caixa: { id: caixaDeles, pd }, tipo: "mensagem" }], false);
      if (r.entregues) aqui.anunciada[k] = true;
    }
  }

  // ── Mandar ──
  private async enviarBloco(id: B64, tipo: TipoDoBloco, corpo: Bytes, destinos: Destino[], comSincronia: boolean) {
    // As notas para mim (item 15) não têm conversa na lista nem caixa: só o contador delas, e vão só aos meus outros aparelhos.
    const nota = id === this.notas;
    const c = this.estado.lista.conversas[id];
    const aqui: { envio: EstadoDeEnvio } | undefined = nota ? this.estadoDasNotas() : this.estado.porConversa[id];
    if ((!c && !nota) || !aqui) throw erro("nao_encontrado");
    const prazo: Prazo = nota ? 30 : c.prazo;
    const todos = [...destinos];
    if (comSincronia) {
      const outros = await this.meusOutros();
      await this.garantirSessoes(this.estado.conta, outros);
      const pd = this.derivados.pdSincronia;
      for (const a of outros) {
        const caixa = this.estado.lista.aparelhos[paraB64Url(a.aparelho)]?.sincronia;
        if (caixa && (await temSessao(this.d.motor, a.aparelho))) todos.push({ aparelho: a, caixa: { id: deB64Url(caixa), pd }, tipo: "sincronia" });
      }
    }
    const comSessao: Destino[] = [];
    for (const dd of todos) if (await temSessao(this.d.motor, dd.aparelho.aparelho)) comSessao.push(dd);
    // O contador nunca volta nem se repete: o estado novo é gravado ANTES do primeiro depósito (se a aba fechar no meio, o próximo
    // envio já usa o seguinte; um buraco é avisado como "faltou mensagem", repetir faria a outra ponta descartar a nova).
    const r = await mandar(this.eu, comSessao, aqui.envio, { tipo, conversa: deB64Url(id), prazo, corpo }, (caixa, envelope, franquia) => this.d.transporte.depositar(caixa, envelope, franquia),
      async (novo) => {
        aqui.envio = novo;
        await this.gravar();
      });
    return r;
  }

  private async destinosDaConversa(id: B64): Promise<Destino[]> {
    const c = this.estado.lista.conversas[id];
    if (!c || c.apagada) throw erro("nao_encontrado");
    if (c.situacao !== "aberta") throw erro("dm_aguardando");
    if (this.bloqueado(c.com)) throw erro("dm_fechada");
    let contato = this.estado.lista.contatos[c.com];
    if (!contato || this.agora() - contato.lidoEm > VIDA_DO_DIRETORIO) contato = (await this.contatoPorCodinome(c.codinome, true)) ?? contato;
    if (!contato) throw erro("dm_sem_chave");
    if (contato.mudou) throw erro(contato.verificado ? "dm_exige_comparar" : "dm_identidade_mudou");
    if (contato.registro !== "confere") throw erro("dm_fora_do_registro");
    const aqui = this.estado.porConversa[id];
    const confiaveis = this.confiaveis(contato).filter((a) => c.destinos[paraB64Url(a.aparelho)] && this.confirmado(c, aqui, paraB64Url(a.aparelho)));
    if (!confiaveis.length) throw erro("dm_aguardando");
    await this.garantirSessoes(c.com, confiaveis);
    const pd = deB64Url(c.pdEscrita);
    return confiaveis.map((a) => ({ aparelho: a, caixa: { id: deB64Url(c.destinos[paraB64Url(a.aparelho)].id), pd }, tipo: "mensagem" as const }));
  }

  /**
   * A caixa deste aparelho da outra pessoa já aceita o meu passe de escrita? Sim se recebi o anúncio dele aqui (a declaração) ou se a
   * conversa já foi confirmada por algum aparelho meu (pela lista). Sem isso, quem aceitou o pedido escreveria na caixa de resposta de
   * quem pediu ANTES de ela trocar o passe provisório pelo meu, e o depósito cairia fora sem aviso.
   */
  private confirmado(c: ConversaDaLista, aqui: DaConversaAqui | undefined, aparelho: B64): boolean {
    return !!aqui?.declaracoes[aparelho] || !!c.confirmada;
  }

  /** Dá para escrever agora nesta conversa (algum aparelho da outra pessoa confirmou a caixa)? Sem isso, o texto fica na fila. */
  podeEscreverAgora(id: B64): boolean {
    const c = this.estado.lista.conversas[id];
    if (!c || c.apagada || c.situacao !== "aberta") return false;
    const aqui = this.estado.porConversa[id];
    return Object.keys(c.destinos).some((k) => this.confirmado(c, aqui, k));
  }

  /** Manda um texto a todos os aparelhos confiáveis da outra pessoa e aos meus outros. Guarda a minha cópia no histórico. */
  async mandarTexto(id: B64, t: string, opcoes: { prazo?: Prazo; resposta?: B64; umaVez?: boolean; minutos?: number; encaminhada?: number } = {}): Promise<{ id: B64; entregues: number; pendente?: true }> {
    const limpo = t.trim();
    if (!limpo || [...limpo].length > 2000) throw erro("texto_grande");
    await this.garantirMinhaCaixa(id);
    await this.anunciar(id);
    const c = this.estado.lista.conversas[id];
    if (opcoes.prazo && PRAZOS.includes(opcoes.prazo)) c.prazo = opcoes.prazo;
    const minutos = opcoes.minutos && Number.isInteger(opcoes.minutos) && opcoes.minutos >= 1 && opcoes.minutos <= 1440 ? opcoes.minutos : undefined;
    const encaminhada = opcoes.encaminhada && Number.isInteger(opcoes.encaminhada) && opcoes.encaminhada >= 1 && opcoes.encaminhada <= 255 ? opcoes.encaminhada : undefined;
    let destinos: Destino[];
    try {
      destinos = await this.destinosDaConversa(id);
    } catch (e) {
      // A conversa está aberta, mas nenhum aparelho da outra pessoa confirmou a caixa ainda: a mensagem espera aqui, na fila deste
      // aparelho, e sai sozinha quando a confirmação chegar (aoAnuncio). Nada vai ao servidor antes disso.
      if ((e as { code?: string })?.code !== "dm_aguardando" || c.situacao !== "aberta") throw e;
      return this.porNaFila(id, limpo, { resposta: opcoes.resposta, umaVez: opcoes.umaVez, minutos, encaminhada });
    }
    return this.enviarTextoAgora(id, limpo, { resposta: opcoes.resposta, umaVez: opcoes.umaVez, minutos, encaminhada }, destinos);
  }

  /**
   * Encaminha um texto (Prompt 4, item 14) para uma ou mais conversas: cada uma recebe o texto como mensagem nova minha, com a
   * contagem de encaminhamentos (a que o texto trazia mais um) DENTRO do cifrado. O freio: o que já foi encaminhado muitas vezes só
   * vai para uma conversa por vez, e nada vai para mais de DESTINOS_DE_UMA_VEZ de uma vez (lib/rede/chat/encaminhar.ts). "Ver uma
   * vez" não se encaminha (quem chama nem oferece).
   */
  async encaminhar(ids: readonly B64[], t: string, contagem: number | undefined): Promise<{ id: B64; entregues: number; pendente?: true }[]> {
    const unicos = [...new Set(ids)];
    if (!unicos.length) throw erro("nao_encontrado");
    if (unicos.length > destinosPermitidos(contagem)) throw erro("encaminhar_limite");
    const encaminhada = contagemAoEncaminhar(contagem);
    const saida: { id: B64; entregues: number; pendente?: true }[] = [];
    for (const id of unicos) saida.push(await this.mandarTexto(id, t, { encaminhada }));
    return saida;
  }

  /** Cifra e deposita um texto já conferido e guarda a minha cópia (fora "ver uma vez"). */
  private async enviarTextoAgora(id: B64, limpo: string, opcoes: { resposta?: B64; umaVez?: boolean; minutos?: number; encaminhada?: number }, destinos: Destino[]): Promise<{ id: B64; entregues: number }> {
    const c = this.estado.lista.conversas[id];
    const { minutos, encaminhada } = opcoes;
    const corpo = corpoDeTexto({ t: limpo, ...(opcoes.resposta ? { r: opcoes.resposta } : {}), ...(opcoes.umaVez ? { umaVez: true } : {}), ...(minutos ? { minutos } : {}), ...(encaminhada ? { enc: encaminhada } : {}) });
    const r = await this.enviarBloco(id, "texto", corpo, destinos, true);
    const agora = this.agora();
    // "Ver uma vez" não fica nem para quem mandou.
    if (!opcoes.umaVez)
      await this.d.historico.guardar({
        id: paraB64Url(r.id), conversa: id, autor: this.estado.conta, aparelho: this.estado.aparelho.publico.aparelho, quando: agora, expira: agora + (minutos ? minutos * 60_000 : c.prazo * DIA),
        texto: limpo.normalize("NFC"), resposta: opcoes.resposta ?? null, contador: r.estado.contador, avisos: [], umaVez: false,
        ...(encaminhada ? { encaminhada } : {}),
      });
    c.ultimaEm = agora;
    this.mudar(c);
    await this.gravar();
    return { id: paraB64Url(r.id), entregues: r.entregues };
  }

  /**
   * Manda um anexo cifrado (Prompt 4, itens 137 e 138). O arquivo já foi cifrado no aparelho e o cifrado já está no depósito
   * (lib/rede/chat/anexo-deposito.ts); aqui vai só o CORPO (lib/rede/chat/anexo-cifrado.ts: chave, endereço, resumos, tamanho e
   * duração), num bloco "anexo", pela mesma cifra, o mesmo envelope de tamanho fixo e o mesmo ritmo do texto. Nada do protocolo muda.
   * Sem fila: a conversa tem de estar confirmada pela outra pessoa ("dm_aguardando" senão). "Ver uma vez" não fica para quem mandou.
   */
  async mandarAnexo(id: B64, corpo: Bytes, opcoes: { prazo?: Prazo } = {}): Promise<{ id: B64; entregues: number }> {
    const lido = lerCorpoDeAnexo(corpo);
    if (!lido) throw erro("anexo_invalido");
    await this.garantirMinhaCaixa(id);
    await this.anunciar(id);
    const c = this.estado.lista.conversas[id];
    if (opcoes.prazo && PRAZOS.includes(opcoes.prazo)) c.prazo = opcoes.prazo;
    const destinos = await this.destinosDaConversa(id);
    const r = await this.enviarBloco(id, "anexo", corpo, destinos, true);
    const agora = this.agora();
    if (!lido.umaVez)
      await this.d.historico.guardar({
        id: paraB64Url(r.id), conversa: id, autor: this.estado.conta, aparelho: this.estado.aparelho.publico.aparelho, quando: agora, expira: agora + Math.min(c.prazo, lido.dias) * DIA,
        texto: "", anexo: paraB64Url(corpo), resposta: null, contador: r.estado.contador, avisos: [], umaVez: false,
      });
    c.ultimaEm = agora;
    this.mudar(c);
    await this.gravar();
    return { id: paraB64Url(r.id), entregues: r.entregues };
  }

  /** Guarda o texto na fila desta conversa (e no histórico, marcado como pendente, para a tela mostrar). */
  private async porNaFila(id: B64, limpo: string, opcoes: { resposta?: B64; umaVez?: boolean; minutos?: number; encaminhada?: number }): Promise<{ id: B64; entregues: number; pendente: true }> {
    const c = this.estado.lista.conversas[id];
    const aqui = this.estado.porConversa[id];
    const agora = this.agora();
    const p: Pendente = {
      id: paraB64Url(sortear(16)), texto: limpo.normalize("NFC"), quando: agora,
      ...(opcoes.resposta ? { resposta: opcoes.resposta } : {}), ...(opcoes.umaVez ? { umaVez: true } : {}), ...(opcoes.minutos ? { minutos: opcoes.minutos } : {}),
      ...(opcoes.encaminhada ? { encaminhada: opcoes.encaminhada } : {}),
    };
    aqui.pendentes = [...(aqui.pendentes ?? []), p];
    await this.d.historico.guardar({
      id: p.id, conversa: id, autor: this.estado.conta, aparelho: this.estado.aparelho.publico.aparelho, quando: agora, expira: agora + (p.minutos ? p.minutos * 60_000 : c.prazo * DIA),
      texto: p.texto, resposta: p.resposta ?? null, contador: 0, avisos: [], umaVez: !!p.umaVez, pendente: true,
      ...(p.encaminhada ? { encaminhada: p.encaminhada } : {}),
    });
    c.ultimaEm = agora;
    this.mudar(c);
    await this.gravar();
    return { id: p.id, entregues: 0, pendente: true };
  }

  /** Manda o que estava na fila desta conversa, se já dá (algum aparelho da outra pessoa confirmou). Devolve quantas saíram. */
  async enviarPendentes(id: B64): Promise<number> {
    const aqui = this.estado.porConversa[id];
    const c = this.estado.lista.conversas[id];
    if (!aqui?.pendentes?.length || !c || !this.podeEscreverAgora(id) || this.bloqueado(c.com)) return 0;
    const destinos = await this.destinosDaConversa(id).catch(() => null);
    if (!destinos) return 0;
    let saiu = 0;
    while (aqui.pendentes?.length) {
      const p = aqui.pendentes[0];
      // Sai da fila ANTES de cifrar (como o contador): se a aba fechar no meio, a mensagem não sai duas vezes.
      aqui.pendentes = aqui.pendentes.slice(1);
      await this.gravar();
      await this.d.historico.apagar(id, p.id, this.estado.conta);
      await this.enviarTextoAgora(id, p.texto, { resposta: p.resposta, umaVez: p.umaVez, minutos: p.minutos, encaminhada: p.encaminhada }, destinos);
      saiu++;
    }
    return saiu;
  }

  /**
   * Agenda um texto (Prompt 4, item 18): fica SÓ neste aparelho (na loja cifrada e no histórico, marcado "agendada") e sai na hora
   * pelo caminho de sempre, quando este aparelho estiver ligado com a Alumia aberta (enviarAgendadas). Nada vai ao servidor antes.
   */
  async agendar(id: B64, t: string, quando: number): Promise<{ id: B64 }> {
    const limpo = t.trim();
    if (!limpo || [...limpo].length > 2000) throw erro("texto_grande");
    const agora = this.agora();
    if (!horaValida(quando, agora)) throw erro("agendar_hora");
    const c = this.estado.lista.conversas[id];
    if (!c || c.apagada || c.situacao !== "aberta") throw erro("dm_aguardando");
    const aqui = await this.garantirMinhaCaixa(id);
    const a: Agendada = { id: paraB64Url(sortear(16)), texto: limpo.normalize("NFC"), quando: Math.floor(quando) };
    aqui.agendadas = [...(aqui.agendadas ?? []), a];
    await this.d.historico.guardar({
      id: a.id, conversa: id, autor: this.estado.conta, aparelho: this.estado.aparelho.publico.aparelho, quando: agora, expira: a.quando + c.prazo * DIA,
      texto: a.texto, resposta: null, contador: 0, avisos: [], umaVez: false, agendada: a.quando,
    });
    await this.gravar();
    return { id: a.id };
  }

  /** Desiste de uma agendada: sai daqui (nunca saiu daqui, então não há nada a apagar fora). */
  async cancelarAgendada(id: B64, agendada: B64): Promise<void> {
    const aqui = this.estado.porConversa[id];
    if (!aqui?.agendadas?.some((a) => a.id === agendada)) return;
    aqui.agendadas = aqui.agendadas.filter((a) => a.id !== agendada);
    await this.gravar();
    await this.d.historico.apagar(id, agendada, this.estado.conta);
  }

  /** As agendadas desta conversa (só neste aparelho). */
  agendadasDe(id: B64): readonly Agendada[] {
    return this.estado.porConversa[id]?.agendadas ?? [];
  }

  /**
   * Manda as agendadas que já venceram, em todas as conversas, na ordem da hora. Cada uma sai da lista ANTES de cifrar (se a aba
   * fechar no meio, não sai duas vezes) e vira uma mensagem comum (que espera na fila se a outra pessoa ainda não confirmou).
   * Conversa apagada ou bloqueada: a agendada é descartada. Devolve quantas saíram.
   */
  async enviarAgendadas(): Promise<number> {
    const agora = this.agora();
    const vencidas = Object.entries(this.estado.porConversa)
      .flatMap(([id, aqui]) => (aqui.agendadas ?? []).filter((a) => a.quando <= agora).map((a) => ({ id, a })))
      .sort((x, y) => x.a.quando - y.a.quando);
    let saiu = 0;
    for (const { id, a } of vencidas) {
      const aqui = this.estado.porConversa[id];
      aqui.agendadas = (aqui.agendadas ?? []).filter((x) => x.id !== a.id);
      await this.gravar();
      await this.d.historico.apagar(id, a.id, this.estado.conta);
      const c = this.estado.lista.conversas[id];
      if (!c || c.apagada || c.situacao !== "aberta" || this.bloqueado(c.com)) continue;
      try {
        await this.mandarTexto(id, a.texto);
      } catch (e) {
        // Não saiu (a rede caiu antes de depositar): volta para a lista e tenta na próxima volta, em vez de sumir calada.
        aqui.agendadas = [...(aqui.agendadas ?? []), a];
        await this.d.historico.guardar({
          id: a.id, conversa: id, autor: this.estado.conta, aparelho: this.estado.aparelho.publico.aparelho, quando: agora, expira: a.quando + c.prazo * DIA,
          texto: a.texto, resposta: null, contador: 0, avisos: [], umaVez: false, agendada: a.quando,
        });
        await this.gravar();
        throw e;
      }
      saiu++;
    }
    return saiu;
  }

  /** As mensagens que esperam na fila desta conversa (só neste aparelho). */
  pendentesDe(id: B64): readonly Pendente[] {
    return this.estado.porConversa[id]?.pendentes ?? [];
  }

  /**
   * Edita uma mensagem MINHA: troca o texto aqui e pede aos outros aparelhos (dela e meus) que troquem a cópia. Vai como controle
   * "editar" dentro do cifrado (o mesmo caminho do "apagar"); quem recebe só aceita se o autor da mensagem for quem pede. Mensagem
   * ainda na fila: só troca o texto da fila.
   */
  async editarMensagem(id: B64, mensagem: B64, novo: string): Promise<void> {
    const limpo = novo.trim().normalize("NFC");
    if (!limpo || [...limpo].length > 2000) throw erro("texto_grande");
    const aqui = this.estado.porConversa[id];
    const naFila = aqui?.pendentes?.find((p) => p.id === mensagem);
    if (naFila) {
      naFila.texto = limpo;
      await this.gravar();
      await this.d.historico.editar?.(id, mensagem, this.estado.conta, limpo);
      return;
    }
    await this.d.historico.editar?.(id, mensagem, this.estado.conta, limpo);
    const destinos = await this.destinosDaConversa(id).catch(() => []);
    await this.enviarBloco(id, "controle", controle({ a: "editar", id: mensagem, t: limpo }), destinos, true);
  }

  /** Apaga uma mensagem MINHA daqui e pede aos outros aparelhos (dela e meus) que apaguem a cópia. */
  async apagarMensagem(id: B64, mensagem: B64): Promise<void> {
    await this.d.historico.apagar(id, mensagem, this.estado.conta);
    // Ainda na fila: nunca saiu daqui, então só sai da fila.
    const aqui = this.estado.porConversa[id];
    if (aqui?.pendentes?.some((p) => p.id === mensagem)) {
      aqui.pendentes = aqui.pendentes.filter((p) => p.id !== mensagem);
      await this.gravar();
      return;
    }
    const destinos = await this.destinosDaConversa(id).catch(() => []);
    await this.enviarBloco(id, "controle", controle({ a: "apagar", id: mensagem }), destinos, true).catch(() => undefined);
  }

  /** Apaga a conversa deste e dos meus outros aparelhos (pela lista), e as minhas caixas dela no servidor. */
  async apagarConversa(id: B64): Promise<void> {
    const c = this.estado.lista.conversas[id];
    if (c) {
      c.apagada = true;
      c.destinos = {};
      c.resposta = null;
      this.mudar(c);
    }
    await this.largarCaixa(id);
    await this.d.historico.apagarConversa(id);
    await this.gravar();
    await this.listaMudou();
  }

  private async largarCaixa(id: B64) {
    const aqui = this.estado.porConversa[id];
    if (!aqui) return;
    await this.d.transporte.apagar({ id: deB64Url(aqui.caixa.id), pl: deB64Url(aqui.caixa.pl) }).catch(() => undefined);
    delete this.estado.porConversa[id];
  }

  // ── Receber ──
  /**
   * Busca a caixa de sincronia e a caixa de cada conversa deste aparelho (uma caixa por pedido: buscar várias num pedido só ligaria
   * as caixas), abre, confere e guarda no histórico. Também aplica o que a lista sincronizada mudou (bloqueio, conversa apagada,
   * caixa nova a anunciar). Devolve quantas mensagens novas.
   */
  async receber(): Promise<number> {
    let novas = 0;
    await this.aplicarLista();
    novas += await this.receberDaCaixa(null);
    for (const id of Object.keys(this.estado.porConversa)) novas += await this.receberDaCaixa(id);
    await this.enviarTodasPendentes();
    return novas;
  }

  /** Manda a fila de cada conversa que já pode (a confirmação pode ter chegado por outra caixa ou pela lista de outro aparelho meu). */
  private async enviarTodasPendentes() {
    for (const id of Object.keys(this.estado.porConversa)) await this.enviarPendentes(id).catch(() => 0);
  }

  /**
   * Onda R3 (3.3): as caixas que este aparelho vigia, cada uma no seu horário (lib/rede/caixas/agenda.ts, `agendarBusca`), em vez de
   * buscar todas de uma vez: "pedidos", "sincronia" e o id de cada conversa com caixa aqui.
   */
  caixasVigiadas(): string[] {
    return ["pedidos", "sincronia", ...Object.keys(this.estado.porConversa)];
  }

  /** Busca UMA caixa (a da vez na agenda). "sincronia" também aplica o que a lista sincronizada mudou. Devolve quantas mensagens novas. */
  async receberCaixa(qual: string): Promise<number> {
    if (qual === "pedidos") return this.receberPedidos();
    if (qual === "sincronia") {
      await this.aplicarLista();
      const n = await this.receberDaCaixa(null);
      // A lista de outro aparelho meu pode ter trazido a confirmação de uma conversa: a fila dela sai agora.
      await this.enviarTodasPendentes();
      return n;
    }
    if (!this.estado.porConversa[qual]) return 0;
    const n = await this.receberDaCaixa(qual);
    await this.enviarPendentes(qual).catch(() => 0);
    return n;
  }

  // ── Sem internet (onda R3, item 2.2; lib/rede/malha) ──
  /**
   * Os ids das caixas de entrada deste aparelho que a malha procura nos pacotes que passam (lib/rede/malha/entrega.ts): a de cada
   * conversa a dois e a de sincronia. Nunca a de pedidos (pedido de conversa só pelo servidor).
   */
  caixasDaMalha(): Bytes[] {
    const ids = Object.values(this.estado.porConversa)
      .map((a) => a?.caixa?.id)
      .filter((x): x is B64 => !!x);
    if (this.estado.aparelho.sincronia) ids.push(this.estado.aparelho.sincronia.id);
    return ids.map(deB64Url);
  }

  /**
   * Um depósito que chegou pela malha, para uma das caixas deste aparelho: o mesmo caminho do que chega pela caixa (receber, conferir,
   * histórico). Sem a marca do servidor (não passou por ele): a mensagem chega, mas não vira prova de denúncia. Devolve se abriu.
   */
  async receberDaMalha(caixaId: Bytes, d: { c: Bytes; envelope: Bytes }): Promise<boolean> {
    const alvo = paraB64Url(caixaId);
    const id = Object.keys(this.estado.porConversa).find((k) => this.estado.porConversa[k]?.caixa?.id === alvo) ?? null;
    if (!id && this.estado.aparelho.sincronia?.id !== alvo) return false;
    const n = await this.abrirPacote(id, caixaId, { envelope: d.envelope, franquia: d.c });
    await this.gravar();
    return n > 0;
  }

  /** O que a lista (vinda de outro aparelho meu) pede a este: bloquear/desbloquear as minhas caixas, largar as apagadas, anunciar. */
  private async aplicarLista() {
    for (const [id, c] of Object.entries(this.estado.lista.conversas)) {
      const aqui = this.estado.porConversa[id];
      if (c.apagada) {
        if (aqui) {
          await this.largarCaixa(id);
          await this.d.historico.apagarConversa(id);
        }
        continue;
      }
      if (c.situacao !== "aberta") continue;
      const minha = aqui ?? (c.pdHDeles ? await this.garantirMinhaCaixa(id).catch(() => null) : null);
      if (!minha) continue;
      const deveBloquear = this.bloqueado(c.com);
      if (deveBloquear !== minha.bloqueada && c.pdHDeles) {
        const pdH = deveBloquear ? resumoDoPasse(sortear(32)) : deB64Url(c.pdHDeles);
        await this.d.transporte.trocar({ id: deB64Url(minha.caixa.id), pl: deB64Url(minha.caixa.pl) }, pdH, true);
        minha.bloqueada = deveBloquear;
        minha.pdHAgora = paraB64Url(pdH);
      }
      if (!deveBloquear) await this.anunciar(id).catch(() => undefined);
    }
    await this.gravar();
  }

  private async receberDaCaixa(id: B64 | null): Promise<number> {
    const aqui = id ? this.estado.porConversa[id] : null;
    const minha = id ? aqui?.caixa : this.estado.aparelho.sincronia;
    if (!minha) return 0;
    const caixa = { id: deB64Url(minha.id), pl: deB64Url(minha.pl) };
    const cursor = id ? (aqui as DaConversaAqui).cursor : this.estado.cursores.sincronia;
    const pacotes = await this.d.transporte.buscar(caixa, cursor);
    let novas = 0;
    let ate = cursor;
    for (const p of pacotes.sort((a, b) => a.ordem - b.ordem)) {
      ate = Math.max(ate, p.ordem);
      if (!p.franquia) continue;
      novas += await this.abrirPacote(id, caixa.id, { envelope: p.envelope, franquia: p.franquia, marca: p.marca, dia: p.dia });
    }
    if (ate > cursor) {
      await this.d.transporte.confirmar(caixa, ate);
      if (id) (this.estado.porConversa[id] as DaConversaAqui).cursor = ate;
      else this.estado.cursores.sincronia = ate;
    }
    await this.gravar();
    return novas;
  }

  private async abrirPacote(id: B64 | null, caixaId: Bytes, pacote: { envelope: Uint8Array; franquia: Uint8Array; marca?: Uint8Array | null; dia?: string }): Promise<number> {
    const c = id ? this.estado.lista.conversas[id] : null;
    const conhecido = (forcado: Record<B64, { conta: string; impressao: string; meu: boolean }>) => (a: Bytes) => forcado[paraB64Url(a)] ?? null;
    const mapa = async (forcar: boolean) => {
      const m: Record<B64, { conta: string; impressao: string; meu: boolean }> = {};
      if (id && c) {
        const contato = forcar ? await this.contatoPorCodinome(c.codinome, true).catch(() => null) : this.estado.lista.contatos[c.com];
        if (contato && !contato.mudou && contato.registro === "confere") for (const a of this.confiaveis(contato)) m[paraB64Url(a.aparelho)] = { conta: c.com, impressao: a.certificado.proteus, meu: false };
      } else {
        for (const a of await this.meusOutros(forcar)) m[paraB64Url(a.aparelho)] = { conta: this.estado.conta, impressao: a.certificado.proteus, meu: true };
      }
      return m;
    };
    const estadoDe = (conversa: Bytes, aparelho: Bytes) => {
      const k = paraB64Url(conversa);
      return this.estado.porConversa[k]?.ordem[paraB64Url(aparelho)] ?? (k === this.notas ? this.estado.notas?.ordem[paraB64Url(aparelho)] : undefined) ?? ESTADO_NOVO;
    };
    const conversa = id ? deB64Url(id) : null;
    const antes = await this.sessoes();
    let r = await receber(this.eu, caixaId, pacote, conversa, conhecido(await mapa(false)), estadoDe, this.agora());
    // Aparelho que ainda não conheço (ligado depois que li o diretório): lê de novo e tenta uma vez.
    if (!r.ok && r.motivo === "aparelho_desconhecido") r = await receber(this.eu, caixaId, pacote, conversa, conhecido(await mapa(true)), estadoDe, this.agora());
    if (!r.ok) return 0;
    // Pré-chave gasta: a reposição (com sessão) fica para a rotina com sessão, nunca logo depois desta busca anônima.
    if ((await this.sessoes()) > antes) this.estado.aparelho.preChaves++;
    const convId = paraB64Url(r.bloco.conversa);
    // As notas para mim (item 15): só de um aparelho meu; texto entra no histórico, "apagar" tira. Nada mais passa por aqui.
    if (convId === this.notas) {
      if (!r.de.meu) return 0;
      this.estadoDasNotas().ordem[paraB64Url(r.de.aparelho)] = r.estado;
      if (r.bloco.tipo === "controle") {
        const ctl = lerControle(r.bloco.corpo);
        if (ctl?.a === "apagar") await this.d.historico.apagar(convId, ctl.id, r.de.conta);
        return 0;
      }
      const nota = r.bloco.tipo === "texto" ? lerCorpoDeTexto(r.bloco.corpo) : null;
      if (!nota) return 0;
      const quando = this.agora();
      await this.d.historico.guardar({
        id: paraB64Url(r.bloco.id), conversa: convId, autor: r.de.conta, aparelho: paraB64Url(r.de.aparelho), quando, expira: quando + DIAS_DAS_NOTAS * DIA,
        texto: nota.t, resposta: null, contador: r.bloco.contador, avisos: r.avisos, umaVez: false, prova: null,
      });
      return 0;
    }
    const daqui = this.estado.porConversa[convId];
    if (daqui) daqui.ordem[paraB64Url(r.de.aparelho)] = r.estado;
    let conv = this.estado.lista.conversas[convId];
    // Cópia de um aparelho meu sobre uma conversa que este ainda não conhece: a lista sincronizada chega primeiro.
    if (!conv && r.de.meu) {
      await this.lerLista().catch(() => undefined);
      conv = this.estado.lista.conversas[convId];
    }
    if (r.bloco.tipo === "caixas") {
      if (!r.de.meu) await this.aoAnuncio(convId, r.de.conta, r.de.aparelho, lerControle(r.bloco.corpo), caixaId);
      return 0;
    }
    if (r.bloco.tipo === "controle") {
      const ctl = lerControle(r.bloco.corpo);
      if (ctl?.a === "apagar") await this.d.historico.apagar(convId, ctl.id, r.de.conta);
      // Editar: só a mensagem do próprio autor (o histórico confere o autor, como no apagar), e só numa conversa que existe aqui.
      if (ctl?.a === "editar" && conv && !conv.apagada && (r.de.meu || conv.com === r.de.conta)) await this.d.historico.editar?.(convId, ctl.id, r.de.conta, ctl.t.trim().normalize("NFC"));
      // Prompt 4, itens 2, 7 e 8: a posição da OUTRA pessoa desta conversa (nunca a cópia de um aparelho meu). A comum vai só para a
      // guarda da memória (a última, sem trajeto); o pedido de ajuda também fica no histórico cifrado por 24 h e conta como nova.
      if (ctl?.a === "posicao" && conv && !conv.apagada && !r.de.meu && conv.com === r.de.conta && !this.bloqueado(conv.com)) {
        const corpo = lerCorpoDePosicao(ctl.p);
        if (!corpo) return 0;
        const quando = this.agora();
        this.d.aoPosicao?.({ conversa: convId, autor: r.de.conta, corpo, quando });
        if (corpo.sos) {
          await this.d.historico.guardar({
            id: paraB64Url(r.bloco.id), conversa: convId, autor: r.de.conta, aparelho: paraB64Url(r.de.aparelho), quando, expira: quando + VIDA_DO_SOS_MS,
            texto: "", posicao: JSON.stringify(corpo), resposta: null, contador: r.bloco.contador, avisos: r.avisos, umaVez: false, prova: null,
          });
          conv.ultimaEm = quando;
          if (daqui) daqui.naoLidas++;
          return 1;
        }
      }
      // Prompt 4, itens 139 e 140: o toque da chamada, só da OUTRA pessoa desta conversa (nunca de um aparelho meu, nunca de quem
      // bloqueei). Não entra no histórico: não existe registro de chamadas.
      if (ctl?.a === "chamada" && conv && !conv.apagada && !r.de.meu && conv.com === r.de.conta && !this.bloqueado(conv.com)) {
        const corpo = lerCorpoDoToque(ctl.c);
        if (corpo) this.d.aoChamada?.({ conversa: convId, autor: r.de.conta, nome: conv.codinome, corpo, quando: this.agora() });
      }
      return 0;
    }
    if ((r.bloco.tipo !== "texto" && r.bloco.tipo !== "anexo") || !conv || conv.apagada) return 0;
    if (!r.de.meu && conv.com !== r.de.conta) return 0;
    if (r.bloco.tipo === "anexo") {
      // Prompt 4, itens 137 e 138: o corpo do anexo (a chave e o endereço do arquivo cifrado no depósito). Fora do formato, cai.
      // Sem prova da franquia: a denúncia com prova é de texto (o trecho tem de estar no bloco); a de anexo fica para depois.
      const a = lerCorpoDeAnexo(r.bloco.corpo);
      if (!a) return 0;
      const quando = this.agora();
      await this.d.historico.guardar({
        id: paraB64Url(r.bloco.id), conversa: convId, autor: r.de.conta, aparelho: paraB64Url(r.de.aparelho), quando, expira: quando + Math.min(r.bloco.prazo, a.dias) * DIA,
        texto: "", anexo: paraB64Url(r.bloco.corpo), resposta: null, contador: r.bloco.contador,
        avisos: daqui && faltando(r.estado).length > 0 ? [...r.avisos, "faltando" as const] : r.avisos, umaVez: !!a.umaVez, prova: null,
      });
      conv.ultimaEm = quando;
      if (daqui && !r.de.meu) daqui.naoLidas++;
      return r.de.meu ? 0 : 1;
    }
    const corpo = lerCorpoDeTexto(r.bloco.corpo);
    if (!corpo) return 0;
    const agora = this.agora();
    const falta = daqui ? faltando(r.estado).length > 0 : false;
    await this.d.historico.guardar({
      id: paraB64Url(r.bloco.id), conversa: convId, autor: r.de.conta, aparelho: paraB64Url(r.de.aparelho), quando: agora, expira: agora + (corpo.minutos ? corpo.minutos * 60_000 : r.bloco.prazo * DIA),
      texto: corpo.t, resposta: corpo.r ?? null, contador: r.bloco.contador, avisos: falta ? [...r.avisos, "faltando" as const] : r.avisos, umaVez: !!corpo.umaVez,
      ...(corpo.enc ? { encaminhada: corpo.enc } : {}),
      // Só a mensagem de outra pessoa vira prova (a cópia do que eu mesma escrevi não se denuncia). A autoria é a declaração que o
      // aparelho de quem escreveu mandou ao anunciar a caixa: o passe dele (pd_h) é o que a marca do servidor prende.
      prova: r.de.meu ? null : provaDoPacote({
        origem: "conversa", caixa: caixaId, pacote: { franquia: pacote.franquia, marca: pacote.marca ?? null, dia: pacote.dia ?? "" }, kf: r.bloco.kf, conteudo: r.conteudo,
        autoria: autoriaDe(this.estado, convId, paraB64Url(r.de.aparelho), r.de.conta),
      }),
    });
    conv.ultimaEm = agora;
    if (daqui && !r.de.meu) daqui.naoLidas++;
    return r.de.meu ? 0 : 1;
  }

  private async sessoes(): Promise<number> {
    // O número de sessões não é exposto pela biblioteca de forma barata; conta-se pelos aparelhos conhecidos.
    let n = 0;
    for (const contato of Object.values(this.estado.lista.contatos)) for (const a of contato.aparelhos) if (await temSessao(this.d.motor, deB64Url(a.aparelho))) n++;
    return n;
  }

  /** O anúncio da caixa de um aparelho da outra pessoa (ou o aceite do meu pedido). */
  private async aoAnuncio(id: B64, de: string, aparelho: Bytes, ctl: Controle | null, caixaOndeChegou: Bytes) {
    const c = this.estado.lista.conversas[id];
    const aqui = this.estado.porConversa[id];
    if (!c || !aqui || c.apagada || c.com !== de || ctl?.a !== "caixa") return;
    const contato = this.estado.lista.contatos[de];
    const caixa = deB64Url(ctl.caixa);
    const pdH = deB64Url(ctl.pdH);
    if (!contato || caixa.length !== 32 || pdH.length !== 32) return;
    // A declaração tem de ser da identidade da outra pessoa, para a MINHA caixa (onde chegou) e o passe que ela diz.
    const declaracao = deB64Url(ctl.declaracao);
    if (!declaracaoConfere(deB64Url(contato.identidade), resumoDaCaixa(caixaOndeChegou), pdH, de, declaracao)) return;
    if (c.pdHDeles && c.pdHDeles !== ctl.pdH) return; // o passe dela não muda no meio da conversa
    c.destinos[paraB64Url(aparelho)] = { id: ctl.caixa };
    aqui.declaracoes[paraB64Url(aparelho)] = ctl.declaracao;
    c.confirmada = true;
    if (c.situacao === "enviado" && ctl.aceite) {
      // Aceite: a caixa de resposta passa a aceitar SÓ o passe de quem aceitou (o provisório morre na hora).
      c.situacao = "aberta";
      c.pdHDeles = ctl.pdH;
      await this.d.transporte.trocar({ id: deB64Url(aqui.caixa.id), pl: deB64Url(aqui.caixa.pl) }, pdH, true);
      aqui.pdHAgora = ctl.pdH;
    }
    this.mudar(c);
    await this.gravar();
    if (c.situacao === "aberta") await this.anunciar(id).catch(() => undefined);
    await this.listaMudou();
    // O que eu escrevi antes da confirmação sai agora.
    await this.enviarPendentes(id).catch(() => 0);
  }

  // ── Bloquear ──
  /** Bloqueia uma conta: as minhas caixas das conversas com ela trocam de passe, sem aviso; pedidos dela somem. 20 por hora. */
  async bloquear(conta: string): Promise<void> {
    const agora = this.agora();
    const lista = this.estado.lista;
    lista.freio = lista.freio.filter((t) => agora - t < 3_600_000);
    if (lista.freio.length >= BLOQUEIOS_POR_HORA) throw erro("muitos_bloqueios");
    // Cada bloqueio é um instante diferente (a junção das listas tira repetidos: dois no mesmo milissegundo contariam um só).
    lista.freio.push(Math.max(agora, (lista.freio.at(-1) ?? 0) + 1));
    lista.bloqueios[conta] = this.mudar({ desde: agora, ativo: true, m: lista.bloqueios[conta]?.m ?? 0 });
    await this.aplicarLista();
    await this.listaMudou();
  }

  /** Desbloqueia (só depois de 3 h): as minhas caixas voltam a aceitar o passe da outra pessoa. */
  async desbloquear(conta: string): Promise<void> {
    const b = this.estado.lista.bloqueios[conta];
    if (!b?.ativo) return;
    if (this.agora() - b.desde < HORAS_PARA_DESBLOQUEAR * 3_600_000) throw erro("cedo_para_desbloquear");
    b.ativo = false;
    this.mudar(b);
    await this.aplicarLista();
    await this.listaMudou();
  }

  /** O prazo das próximas mensagens desta conversa (vale para os meus aparelhos, pela lista). */
  async mudarPrazo(id: B64, prazo: Prazo): Promise<void> {
    const c = this.estado.lista.conversas[id];
    if (!c || c.apagada) throw erro("nao_encontrado");
    if (!PRAZOS.includes(prazo)) throw erro("invalido");
    c.prazo = prazo;
    this.mudar(c);
    await this.gravar();
    await this.listaMudou();
  }

  // ── Preferências, identidade, código ──
  async mudarPrefs(quemPode: QuemPode, prazo: Prazo): Promise<void> {
    if (!["pedidos", "seguidos", "ninguem"].includes(quemPode) || !PRAZOS.includes(prazo)) throw erro("invalido");
    this.estado.lista.prefs = this.mudar({ quemPode, prazo, m: this.estado.lista.prefs.m });
    await this.gravar();
    await this.listaMudou();
  }

  /**
   * Aceita a identidade nova de um contato. Se ela já tinha sido comparada (código de segurança), só com `comparado` = true (a
   * pessoa comparou o código novo). As sessões com os aparelhos velhos são esquecidas.
   */
  async confiar(conta: string, comparado: boolean): Promise<void> {
    const c = this.estado.lista.contatos[conta];
    if (!c) throw erro("nao_encontrado");
    if (c.mudou) {
      if (c.verificado && !comparado) throw erro("dm_exige_comparar");
      for (const a of c.aparelhos) await esquecerSessao(this.d.motor, deB64Url(a.aparelho));
      c.identidade = c.mudou;
      c.mudou = null;
      for (const conv of Object.values(this.estado.lista.conversas)) if (conv.com === conta) conv.destinos = {};
      for (const [id, aqui] of Object.entries(this.estado.porConversa)) if (this.estado.lista.conversas[id]?.com === conta) aqui.anunciada = {};
    }
    c.verificado = comparado || c.verificado;
    this.mudar(c);
    await this.gravar();
    await this.listaMudou();
  }

  /** O código de segurança com um contato (60 algarismos; o mesmo para as duas pessoas). */
  codigo(conta: string): string | null {
    const c = this.estado.lista.contatos[conta];
    if (!c) return null;
    return codigoDeSeguranca({ conta: this.estado.conta, identidade: this.identidade.publica }, { conta, identidade: deB64Url(c.mudou ?? c.identidade) });
  }

  /** As conversas para a tela (só daqui: o servidor não tem lista nenhuma). */
  conversas() {
    return Object.values(this.estado.lista.conversas)
      .filter((c) => !c.apagada)
      .map((c) => ({ ...c, contato: this.estado.lista.contatos[c.com] ?? null, naoLidas: this.estado.porConversa[c.id]?.naoLidas ?? 0, bloqueada: this.bloqueado(c.com) }))
      .sort((a, b) => b.ultimaEm - a.ultimaEm);
  }

  marcarLida(id: B64) {
    const aqui = this.estado.porConversa[id];
    if (aqui) aqui.naoLidas = 0;
  }

  /** A identidade pública da conta (base64url): a do código de segurança e do registro de transparência. */
  identidadePublica(): B64 {
    return paraB64Url(this.identidade.publica);
  }

  /** Assina um texto do voto em limiar com a identidade da conta (só textos com o rótulo do voto: certificados.ts). */
  assinarParaOVoto(t: Uint8Array): Uint8Array {
    return assinarTextoDoVoto(this.identidade, t);
  }

  /** A identidade da conta de outra pessoa é a do registro público das chaves (o mesmo caminho da conversa a dois)? */
  conferirNoRegistro(usuario: string, identidade: Uint8Array): Promise<"confere" | "nao_confere" | "quebrado"> {
    return this.d.conferirRegistro(usuario, identidade);
  }

  /** As chaves da conta para o QR de ligar e para a cópia (nunca as do aparelho). */
  chavesDaConta() {
    return { conta: this.estado.conta, identidade: this.estado.identidade, pedidos: this.estado.pedidos, sincronia: this.estado.sincronia };
  }

  /**
   * Manda uma posição (Prompt 4, itens 2, 7 e 8) à outra pessoa desta conversa: um controle "posicao" DENTRO do cifrado, pela mesma
   * cifra, o mesmo envelope de tamanho fixo e o mesmo ritmo do texto. Não vai aos meus outros aparelhos (não é conversa: é a posição
   * de agora) e não fica no meu histórico. O corpo já vem arredondado (lib/rede/perto/posicao.ts). Sem fila: a conversa tem de estar
   * confirmada pela outra pessoa ("dm_aguardando" senão).
   */
  async mandarPosicao(id: B64, corpo: CorpoDePosicao): Promise<{ entregues: number }> {
    const p = JSON.stringify(corpo);
    if (!lerCorpoDePosicao(p)) throw erro("posicao_invalida");
    await this.garantirMinhaCaixa(id);
    await this.anunciar(id);
    const destinos = await this.destinosDaConversa(id);
    const r = await this.enviarBloco(id, "controle", controle({ a: "posicao", p }), destinos, false);
    return { entregues: r.entregues };
  }

  /**
   * Manda o toque de uma chamada (Prompt 4, itens 139 e 140), ou o fim dela, à outra pessoa desta conversa: um controle "chamada"
   * DENTRO do cifrado, pelo mesmo caminho da posição (mesma cifra, mesmo envelope de tamanho fixo, mesmo ritmo do texto). Não vai aos
   * meus outros aparelhos e não fica em histórico nenhum. Conversa bloqueada ou ainda não confirmada pela outra pessoa: não sai.
   */
  async mandarChamada(id: B64, corpo: CorpoDoToque): Promise<{ entregues: number }> {
    const c = JSON.stringify(corpo);
    if (!lerCorpoDoToque(c)) throw erro("chamada_invalida");
    const conv = this.estado.lista.conversas[id];
    if (conv && this.bloqueado(conv.com)) throw erro("dm_fechada");
    await this.garantirMinhaCaixa(id);
    await this.anunciar(id);
    const destinos = await this.destinosDaConversa(id);
    const r = await this.enviarBloco(id, "controle", controle({ a: "chamada", c }), destinos, false);
    return { entregues: r.entregues };
  }

  /** Tira um aparelho meu (perdido): sai do diretório e da lista; os contatos param de mandar para ele. */
  async tirarAparelho(aparelho: B64): Promise<void> {
    await this.d.transporte.tirarAparelho(deB64Url(aparelho));
    const a = this.estado.lista.aparelhos[aparelho];
    if (a) {
      a.tirado = true;
      this.mudar(a);
    }
    await esquecerSessao(this.d.motor, deB64Url(aparelho));
    await this.gravar();
    await this.listaMudou();
  }
}

/** A autoria para a prova da franquia: o passe declarado pelo aparelho de quem escreveu, a declaração e a conta. */
function autoriaDe(e: EstadoDoAparelho, conversa: B64, aparelho: B64, conta: string): { pdH: Bytes; declaracao: Bytes; conta: string } | null {
  const d = declaracaoPara(e, conversa, aparelho);
  return d ? { pdH: d.pdH, declaracao: d.declaracao, conta } : null;
}

/** A declaração recebida para a caixa deste aparelho numa conversa (para a denúncia com prova): `aparelho` de quem escreveu. */
export function declaracaoPara(e: EstadoDoAparelho, conversa: B64, aparelho: B64): { idH: Bytes; pdH: Bytes; declaracao: Bytes } | null {
  const aqui = e.porConversa[conversa];
  const c = e.lista.conversas[conversa];
  const d = aqui?.declaracoes[aparelho];
  if (!aqui || !c?.pdHDeles || !d) return null;
  return { idH: resumoDaCaixa(deB64Url(aqui.caixa.id)), pdH: deB64Url(c.pdHDeles), declaracao: deB64Url(d) };
}
