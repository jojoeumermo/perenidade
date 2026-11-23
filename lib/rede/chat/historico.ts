// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O histórico do chat privado, NESTE aparelho. Com o remetente selado (lib/rede/chat/selado.ts), a mensagem sai do banco assim
// que é entregue: o que a pessoa já leu (e o que ela escreveu) fica só aqui. Documento: docs/rede/CHAT-PRIVADO.md ("Histórico no
// aparelho e trava").
//
// Cada mensagem fica CIFRADA (AES-256-GCM, WebCrypto) num IndexedDB próprio ("lucia-alumia-historico"). A chave do histórico:
//   - sem trava: uma chave NÃO exportável deste aparelho (só este navegador a usa; ninguém a lê em bytes);
//   - com trava: a mesma chave, embrulhada (AES-KW) por uma chave tirada da senha da trava (Argon2id, 64 MiB e 3 passadas, sal
//     sorteado: lib/rede/cofre/argon.ts). Sem a senha, o histórico não abre nem neste aparelho. A senha não fica guardada em lugar
//     nenhum. A trava do formato de antes (PBKDF2-SHA-256, 600 mil rodadas) abre com a mesma senha e é refeita na hora com o
//     Argon2id, sem perder nada.
// Fora do cifrado ficam só: a conta, a conversa, o momento (para ordenar) e o prazo (para apagar o que venceu sem abrir).
// O "Sair rápido" apaga este banco inteiro (lib/rede/chat/gaveta.ts).

import { type CabecalhoA2id, cabecalhoValido, derivar } from "../cofre/argon";
import type { ProvaDeFranquia } from "../franquia/protocolo";

export const BANCO_DO_HISTORICO = "lucia-alumia-historico";
const MENSAGENS = "mensagens";
const CHAVES = "chaves";
const CONVERSAS = "conversas";

/** O que fica dentro do cifrado de cada mensagem. */
export interface ConteudoGuardado {
  texto: string;
  /** Identificador sorteado por quem escreveu, contador e "até onde eu já tinha recebido" (lib/rede/chat/c3.ts). */
  idInterno: string;
  contador: number;
  visto: { versao: number; contador: number };
  /** A versão da chave de quem escreveu (a conta dos contadores). */
  versao: number;
  /** "Ver uma vez": some depois de aberta na tela. */
  umaVez: boolean;
  /** A prova da franquia (chat da R2; lib/rede/franquia/protocolo.ts), guardada cifrada com o resto, para a denúncia com prova. */
  prova?: ProvaDeFranquia | null;
  /** Quem escreveu mudou o texto depois (o controle "editar", que vem dentro do cifrado). */
  editada?: boolean;
  /** Escrita aqui e ainda na fila deste aparelho (a outra pessoa não confirmou a conversa): sai sozinha depois. */
  pendente?: boolean;
  /** Anexo cifrado (Prompt 4, itens 137 e 138): o corpo em base64url, com a chave e o endereço; cifrado aqui como o resto. */
  anexo?: string;
  /** Encaminhada (Prompt 4, item 14): quantas vezes o texto já tinha sido encaminhado (a contagem de dentro do cifrado). */
  encaminhada?: number;
  /** Agendada (Prompt 4, item 18): minha, para sair neste momento (ms); ainda só neste aparelho. */
  agendada?: number;
  /** Pedido de ajuda (Prompt 4, item 7): o corpo da posição em JSON; cifrado aqui como o resto, some em 24 h. */
  posicao?: string;
}

export interface MensagemGuardada extends ConteudoGuardado {
  id: string;
  conta: string;
  conversa: string;
  autor: string;
  /** Quando quem escreveu diz ter escrito (ISO). */
  quando: string;
  /** Até quando fica (ISO). */
  expira: string;
}

interface Registro {
  id: string;
  conta: string;
  conversa: string;
  autor: string;
  quando: string;
  expira: string;
  iv: Uint8Array;
  cifrado: ArrayBuffer;
}

interface ChaveGuardada {
  conta: string;
  /** Sem trava: a chave (não exportável). */
  chave?: CryptoKey;
  /** Com trava: a chave embrulhada e o cabeçalho do Argon2id (com o sal). */
  embrulhada?: ArrayBuffer;
  a2id?: CabecalhoA2id;
  /** A trava do formato de antes: só o sal do PBKDF2 (sem `a2id`). */
  sal?: Uint8Array;
}

let banco: Promise<IDBDatabase> | null = null;
function abrir(): Promise<IDBDatabase> {
  banco ??= new Promise<IDBDatabase>((resolve, reject) => {
    const pedido = indexedDB.open(BANCO_DO_HISTORICO, 2);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(MENSAGENS)) db.createObjectStore(MENSAGENS, { keyPath: "id" }).createIndex("conversa", ["conta", "conversa", "quando"]);
      if (!db.objectStoreNames.contains(CHAVES)) db.createObjectStore(CHAVES, { keyPath: "conta" });
      if (!db.objectStoreNames.contains(CONVERSAS)) db.createObjectStore(CONVERSAS, { keyPath: "chave" });
    };
    pedido.onsuccess = () => {
      // Outra aba (ou o "Sair rápido") quer apagar o banco: solta já.
      pedido.result.onversionchange = () => {
        pedido.result.close();
        banco = null;
      };
      resolve(pedido.result);
    };
    pedido.onerror = () => reject(pedido.error);
  }).catch((e) => {
    banco = null;
    throw e;
  });
  return banco;
}

async function naGaveta<T>(loja: string, modo: IDBTransactionMode, agir: (g: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(loja, modo);
    const pedido = agir(tx.objectStore(loja));
    tx.oncomplete = () => resolve((pedido ? pedido.result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** As chaves abertas nesta aba (conta → chave). Somem no "Sair rápido" e ao travar. */
const abertas = new Map<string, CryptoKey>();
export function esquecerChavesDoHistorico() {
  abertas.clear();
  try {
    banco?.then((db) => db.close(), () => undefined);
  } catch {
    // já fechado
  }
  banco = null;
}

const encoder = new TextEncoder();
/** As rodadas do PBKDF2 da trava de antes: só para abrir e refazer com o Argon2id. */
const RODADAS_DE_ANTES = 600_000;

/** A chave que embrulha (AES-KW), tirada da senha com o Argon2id. Sem cabeçalho, um novo (sal sorteado). */
async function chaveDaSenha(senha: string, cabecalho?: CabecalhoA2id): Promise<{ chave: CryptoKey; a2id: CabecalhoA2id }> {
  const { chave: bytes, cabecalho: a2id } = await derivar(senha, cabecalho);
  try {
    const crua = new Uint8Array(new ArrayBuffer(32));
    crua.set(bytes);
    const chave = await crypto.subtle.importKey("raw", crua, { name: "AES-KW" }, false, ["wrapKey", "unwrapKey"]);
    crua.fill(0);
    return { chave, a2id };
  } finally {
    bytes.fill(0);
  }
}

/** A chave da trava de antes (PBKDF2, sem normalizar a senha: como era). */
async function chaveDaSenhaDeAntes(senha: string, sal: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal as Uint8Array<ArrayBuffer>, iterations: RODADAS_DE_ANTES }, base, { name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"]);
}

/** O histórico desta conta está travado com senha? */
export async function historicoTravado(conta: string): Promise<boolean> {
  const g = await naGaveta<ChaveGuardada | undefined>(CHAVES, "readonly", (s) => s.get(conta));
  return !!g?.embrulhada;
}

/** A chave do histórico desta conta, aberta. Cria na primeira vez (sem trava). Travado e sem abrir: "historico_travado". */
async function chaveDoHistorico(conta: string): Promise<CryptoKey> {
  const aberta = abertas.get(conta);
  if (aberta) return aberta;
  const g = await naGaveta<ChaveGuardada | undefined>(CHAVES, "readonly", (s) => s.get(conta));
  if (g?.embrulhada) throw Object.assign(new Error("historico_travado"), { code: "historico_travado" });
  if (g?.chave) {
    abertas.set(conta, g.chave);
    return g.chave;
  }
  const chave = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await naGaveta(CHAVES, "readwrite", (s) => s.put({ conta, chave } satisfies ChaveGuardada));
  abertas.set(conta, chave);
  return chave;
}

/**
 * Trava o histórico com uma senha. A chave passa a ficar só embrulhada pela senha (para isso ela é refeita como extraível só
 * no instante de embrulhar: o histórico é cifrado de novo com a chave nova).
 */
export async function travarHistorico(conta: string, senha: string): Promise<void> {
  if (senha.length < 8) throw Object.assign(new Error("senha_curta"), { code: "senha_curta" });
  const todas = await lerTudo(conta);
  const organizacoes = await resumoDasConversas(conta);
  const nova = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const { chave: kek, a2id } = await chaveDaSenha(senha);
  const embrulhada = await crypto.subtle.wrapKey("raw", nova, kek, "AES-KW");
  // A cópia que fica na memória não é extraível.
  const naMemoria = await crypto.subtle.unwrapKey("raw", embrulhada, kek, "AES-KW", "AES-GCM", false, ["encrypt", "decrypt"]);
  abertas.set(conta, naMemoria);
  for (const m of todas) await guardarComChave(m, naMemoria);
  for (const [conversa, o] of organizacoes) {
    const { naoLidas, ...org } = o;
    void naoLidas;
    if (org.pasta || org.nota || org.sonecaAte || org.lidaAte || org.lembretes.length) await mudarOrganizacao(conta, conversa, () => org);
  }
  await naGaveta(CHAVES, "readwrite", (s) => s.put({ conta, embrulhada, a2id } satisfies ChaveGuardada));
}

/** Abre o histórico travado nesta aba. Senha errada: "senha_errada". */
export async function destravarHistorico(conta: string, senha: string): Promise<void> {
  const g = await naGaveta<ChaveGuardada | undefined>(CHAVES, "readonly", (s) => s.get(conta));
  if (!g?.embrulhada) return;
  if (g.a2id && cabecalhoValido(g.a2id)) {
    try {
      const { chave: kek } = await chaveDaSenha(senha, g.a2id);
      abertas.set(conta, await crypto.subtle.unwrapKey("raw", g.embrulhada, kek, "AES-KW", "AES-GCM", false, ["encrypt", "decrypt"]));
    } catch (erro) {
      if ((erro as { code?: string })?.code === "sem_memoria") throw erro;
      throw Object.assign(new Error("senha_errada"), { code: "senha_errada" });
    }
    return;
  }
  if (!g.sal) return;
  // A trava de antes (PBKDF2): abre com a senha, e a chave é embrulhada de novo com o Argon2id (as mensagens não mudam).
  let extraivel: CryptoKey;
  try {
    extraivel = await crypto.subtle.unwrapKey("raw", g.embrulhada, await chaveDaSenhaDeAntes(senha, g.sal), "AES-KW", "AES-GCM", true, ["encrypt", "decrypt"]);
  } catch {
    throw Object.assign(new Error("senha_errada"), { code: "senha_errada" });
  }
  const { chave: kek, a2id } = await chaveDaSenha(senha);
  const embrulhada = await crypto.subtle.wrapKey("raw", extraivel, kek, "AES-KW");
  const naMemoria = await crypto.subtle.unwrapKey("raw", embrulhada, kek, "AES-KW", "AES-GCM", false, ["encrypt", "decrypt"]);
  await naGaveta(CHAVES, "readwrite", (s) => s.put({ conta, embrulhada, a2id } satisfies ChaveGuardada));
  abertas.set(conta, naMemoria);
}

/** Fecha o histórico nesta aba (a chave sai da memória). Só faz sentido com trava. */
export const fecharHistorico = (conta: string) => void abertas.delete(conta);

async function guardarComChave(m: MensagemGuardada, chave: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const dentro: ConteudoGuardado = { texto: m.texto, idInterno: m.idInterno, contador: m.contador, visto: m.visto, versao: m.versao, umaVez: m.umaVez, ...(m.prova ? { prova: m.prova } : {}) };
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(`alumia-historico:${m.conta}:${m.id}`) }, chave, encoder.encode(JSON.stringify(dentro)));
  const registro: Registro = { id: m.id, conta: m.conta, conversa: m.conversa, autor: m.autor, quando: m.quando, expira: m.expira, iv, cifrado };
  await naGaveta(MENSAGENS, "readwrite", (s) => s.put(registro));
}

/** Lança "historico_travado" se o histórico desta conta está travado e não foi aberto nesta aba (antes de mexer na caixa). */
export async function exigirHistoricoAberto(conta: string): Promise<void> {
  await chaveDoHistorico(conta);
}

/** Guarda (ou troca) uma mensagem no histórico. */
export async function guardarNoHistorico(m: MensagemGuardada): Promise<void> {
  await guardarComChave(m, await chaveDoHistorico(m.conta));
}

async function abrirRegistro(r: Registro, chave: CryptoKey): Promise<MensagemGuardada | null> {
  try {
    const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r.iv as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(`alumia-historico:${r.conta}:${r.id}`) }, chave, r.cifrado);
    const dentro = JSON.parse(new TextDecoder().decode(aberto)) as ConteudoGuardado;
    return { id: r.id, conta: r.conta, conversa: r.conversa, autor: r.autor, quando: r.quando, expira: r.expira, ...dentro };
  } catch {
    return null;
  }
}

async function lerTudo(conta: string): Promise<MensagemGuardada[]> {
  const chave = await chaveDoHistorico(conta);
  const registros = await naGaveta<Registro[]>(MENSAGENS, "readonly", (s) => s.getAll());
  const saida: MensagemGuardada[] = [];
  for (const r of registros) if (r.conta === conta) {
    const m = await abrirRegistro(r, chave);
    if (m) saida.push(m);
  }
  return saida;
}

/** As mensagens de uma conversa, mais antigas primeiro (até `limite`, antes de `antes`). Apaga as vencidas no caminho. */
export async function mensagensDoHistorico(conta: string, conversa: string, antes: string | null = null, limite = 100): Promise<MensagemGuardada[]> {
  const chave = await chaveDoHistorico(conta);
  const agora = new Date().toISOString();
  const faixa = IDBKeyRange.bound([conta, conversa, ""], [conta, conversa, antes ?? "￿"], false, !!antes);
  const registros = await naGaveta<Registro[]>(MENSAGENS, "readonly", (s) => s.index("conversa").getAll(faixa));
  const vencidas = registros.filter((r) => r.expira <= agora).map((r) => r.id);
  if (vencidas.length) await naGaveta(MENSAGENS, "readwrite", (s) => void vencidas.forEach((id) => s.delete(id)));
  const vivas = registros.filter((r) => r.expira > agora).slice(-limite);
  const saida: MensagemGuardada[] = [];
  for (const r of vivas) {
    const m = await abrirRegistro(r, chave);
    if (m) saida.push(m);
  }
  return saida;
}

/** Apaga mensagens do histórico (pelo id local). */
export async function apagarDoHistorico(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await naGaveta(MENSAGENS, "readwrite", (s) => void ids.forEach((id) => s.delete(id)));
}

/** Apaga do histórico tudo de uma conversa (ou de uma conta inteira). */
export async function apagarConversaDoHistorico(conta: string, conversa: string | null = null): Promise<void> {
  const registros = await naGaveta<Registro[]>(MENSAGENS, "readonly", (s) => s.getAll());
  await apagarDoHistorico(registros.filter((r) => r.conta === conta && (conversa === null || r.conversa === conversa)).map((r) => r.id));
  if (conversa === null) await naGaveta(CHAVES, "readwrite", (s) => s.delete(conta));
  const conversas = await naGaveta<{ chave: string; conta: string }[]>(CONVERSAS, "readonly", (s) => s.getAll());
  const daConta = conversas.filter((c) => c.conta === conta && (conversa === null || c.chave === `${conta}:${conversa}`)).map((c) => c.chave);
  if (daConta.length) await naGaveta(CONVERSAS, "readwrite", (s) => void daConta.forEach((k) => s.delete(k)));
}

// ── A organização de cada conversa, também só neste aparelho e cifrada: pasta, nota, soneca, lembretes e até onde li ──

/** O que a pessoa organiza numa conversa. Nada disso sai do aparelho. */
export interface OrganizacaoDaConversa {
  /** Pasta (rótulo livre, até 30 caracteres); "" = sem pasta. */
  pasta: string;
  /** Nota só para mim sobre a conversa (até 2000 caracteres). */
  nota: string;
  /** Silenciada até (ISO); "" = não. */
  sonecaAte: string;
  /** Até quando já li (ISO): a primeira mensagem depois disso é a "primeira não lida". */
  lidaAte: string;
  /** Lembretes: "me lembre desta mensagem" (o trecho fica cifrado aqui). */
  lembretes: { id: string; quando: string; trecho: string }[];
}

export const ORGANIZACAO_VAZIA: OrganizacaoDaConversa = { pasta: "", nota: "", sonecaAte: "", lidaAte: "", lembretes: [] };

interface RegistroDaConversa {
  chave: string;
  conta: string;
  iv: Uint8Array;
  cifrado: ArrayBuffer;
}

/** A organização de uma conversa (vazia se nada foi guardado). */
export async function lerOrganizacao(conta: string, conversa: string): Promise<OrganizacaoDaConversa> {
  const chave = await chaveDoHistorico(conta);
  const r = await naGaveta<RegistroDaConversa | undefined>(CONVERSAS, "readonly", (g) => g.get(`${conta}:${conversa}`));
  if (!r) return { ...ORGANIZACAO_VAZIA };
  try {
    const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r.iv as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(`alumia-organizacao:${r.chave}`) }, chave, r.cifrado);
    return { ...ORGANIZACAO_VAZIA, ...(JSON.parse(new TextDecoder().decode(aberto)) as Partial<OrganizacaoDaConversa>) };
  } catch {
    return { ...ORGANIZACAO_VAZIA };
  }
}

/** Muda a organização de uma conversa (com limites de tamanho). */
export async function mudarOrganizacao(conta: string, conversa: string, mudar: (atual: OrganizacaoDaConversa) => OrganizacaoDaConversa): Promise<OrganizacaoDaConversa> {
  const chave = await chaveDoHistorico(conta);
  const nova = mudar(await lerOrganizacao(conta, conversa));
  const limpa: OrganizacaoDaConversa = {
    pasta: nova.pasta.trim().slice(0, 30),
    nota: nova.nota.slice(0, 2000),
    sonecaAte: nova.sonecaAte,
    lidaAte: nova.lidaAte,
    lembretes: nova.lembretes.slice(-50).map((l) => ({ id: l.id, quando: l.quando, trecho: l.trecho.slice(0, 140) })),
  };
  const id = `${conta}:${conversa}`;
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(`alumia-organizacao:${id}`) }, chave, encoder.encode(JSON.stringify(limpa)));
  await naGaveta(CONVERSAS, "readwrite", (g) => g.put({ chave: id, conta, iv, cifrado } satisfies RegistroDaConversa));
  return limpa;
}

/** A organização de todas as conversas da conta, e quantas mensagens da outra pessoa chegaram depois do "até onde li". */
export async function resumoDasConversas(conta: string): Promise<Map<string, OrganizacaoDaConversa & { naoLidas: number }>> {
  const chave = await chaveDoHistorico(conta);
  const saida = new Map<string, OrganizacaoDaConversa & { naoLidas: number }>();
  const registros = await naGaveta<RegistroDaConversa[]>(CONVERSAS, "readonly", (g) => g.getAll());
  for (const r of registros) {
    if (r.conta !== conta) continue;
    const conversa = r.chave.slice(conta.length + 1);
    saida.set(conversa, { ...(await lerOrganizacao(conta, conversa)), naoLidas: 0 });
  }
  void chave;
  const agora = new Date().toISOString();
  const mensagens = await naGaveta<Registro[]>(MENSAGENS, "readonly", (g) => g.getAll());
  for (const m of mensagens) {
    if (m.conta !== conta || m.autor === conta || m.expira <= agora) continue;
    const atual = saida.get(m.conversa) ?? { ...ORGANIZACAO_VAZIA, naoLidas: 0 };
    if (!atual.lidaAte || m.quando > atual.lidaAte) atual.naoLidas++;
    saida.set(m.conversa, atual);
  }
  return saida;
}
