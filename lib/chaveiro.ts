// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro deste aparelho: o par de chaves dele (guardado no próprio navegador, em IndexedDB, sem poder ser exportado) e as
// chaves das conversas, abertas só na memória enquanto a página está aberta. Também repassa chaves para aparelhos de colegas
// que ainda não as receberam. A cifra em si mora em lib/sigilo.ts.
import { BackendError, rpc } from "./backend";
import { contextoDoEmbrulho, cifrar, decifrar, desembrulhar, embrulhar, novaChave, novoAparelho, versaoDe } from "./sigilo";

interface Guardado {
  usuario: string;
  id: string;
  privada: CryptoKey;
  publica: string;
}

interface Chaves {
  atual: number | null;
  minima: number;
  minhas: { versao: number; embrulho: string; de_publica: string }[];
  aparelhos: { id: string; publica: string }[];
}

const BANCO = "lucia-sigilo";
const GAVETA = "aparelhos";

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(GAVETA, { keyPath: "usuario" });
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function naGaveta<T>(modo: IDBTransactionMode, agir: (gaveta: IDBObjectStore) => IDBRequest): Promise<T> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pedido = agir(banco.transaction(GAVETA, modo).objectStore(GAVETA));
      pedido.onsuccess = () => resolve(pedido.result as T);
      pedido.onerror = () => reject(pedido.error);
    });
  } finally {
    banco.close();
  }
}

/** Sem IndexedDB (alguns modos privados), a chave do aparelho vive só enquanto a aba está aberta. */
const naMemoria = new Map<string, Guardado>();

async function lerGuardado(usuario: string): Promise<Guardado | null> {
  try {
    return (await naGaveta<Guardado | undefined>("readonly", (gaveta) => gaveta.get(usuario))) ?? null;
  } catch {
    return naMemoria.get(usuario) ?? null;
  }
}

async function guardar(dados: Guardado) {
  naMemoria.set(dados.usuario, dados);
  try {
    await naGaveta("readwrite", (gaveta) => gaveta.put(dados));
  } catch {
    // fica só na memória
  }
}

async function esquecer(usuario: string) {
  naMemoria.delete(usuario);
  try {
    await naGaveta("readwrite", (gaveta) => gaveta.delete(usuario));
  } catch {
    // nada guardado
  }
}

/** Um nome curto para a pessoa reconhecer o aparelho na lista ("Chrome no Android"). Nada que identifique a máquina. */
function rotulo(): string {
  const agente = navigator.userAgent;
  const navegador = /Edg\//.test(agente) ? "Edge" : /OPR\//.test(agente) ? "Opera" : /Firefox\//.test(agente) ? "Firefox" : /Chrome\//.test(agente) ? "Chrome" : /Safari\//.test(agente) ? "Safari" : "Navegador";
  const sistema = /Android/.test(agente) ? "Android" : /iPhone|iPad/.test(agente) ? "iPhone" : /Windows/.test(agente) ? "Windows" : /Mac OS/.test(agente) ? "Mac" : /Linux/.test(agente) ? "Linux" : "";
  return sistema ? `${navegador} no ${sistema}` : navegador;
}

/** Duas abas abertas ao mesmo tempo não criam dois aparelhos. */
function comTrava<T>(fazer: () => Promise<T>): Promise<T> {
  const travas = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return travas ? (travas.request("lucia-sigilo", fazer) as Promise<T>) : fazer();
}

const codigo = (erro: unknown) => (erro && typeof erro === "object" && "code" in erro ? String((erro as { code: unknown }).code) : "");

export class Chaveiro {
  readonly aparelho: string;
  private readonly privada: CryptoKey;
  /** conversa → versão → chave aberta. */
  private readonly versoes = new Map<string, Map<number, CryptoKey>>();
  private readonly estado = new Map<string, { atual: number | null; minima: number; aparelhos: Chaves["aparelhos"]; em: number }>();
  private readonly carregando = new Map<string, Promise<void>>();

  private constructor(guardado: Guardado) {
    this.aparelho = guardado.id;
    this.privada = guardado.privada;
  }

  /** O chaveiro do aparelho para esta conta: reaproveita o par guardado ou cria e registra um novo. */
  static abrir(usuario: string): Promise<Chaveiro> {
    if (typeof crypto === "undefined" || !crypto.subtle) return Promise.reject(new BackendError("sem_cifra"));
    return comTrava(async () => {
      const guardado = await lerGuardado(usuario);
      if (guardado) {
        try {
          // Confirma que o aparelho continua registrado. Se foi removido de outro aparelho, volta como aparelho novo
          // (a pessoa é avisada) e recebe as chaves de novo pelos colegas.
          const { id } = await rpc<{ id: string }>("chat_aparelho_registrar", { p_publica: guardado.publica, p_rotulo: rotulo() });
          if (id !== guardado.id) await guardar({ ...guardado, id });
          return new Chaveiro({ ...guardado, id });
        } catch (erro) {
          if (codigo(erro) !== "invalido:publica") throw erro;
          await esquecer(usuario);
        }
      }
      const par = await novoAparelho();
      const { id } = await rpc<{ id: string }>("chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: rotulo() });
      const novo = { usuario, id, privada: par.privada, publica: par.publica };
      await guardar(novo);
      return new Chaveiro(novo);
    });
  }

  /** Busca no banco as chaves desta conversa feitas para este aparelho e abre as que ainda não estão na memória. */
  carregar(conversa: string): Promise<void> {
    const emCurso = this.carregando.get(conversa);
    if (emCurso) return emCurso;
    const trabalho = (async () => {
      const chaves = await rpc<Chaves>("chat_chaves", { p_conversa: conversa, p_aparelho: this.aparelho });
      const abertas = this.versoes.get(conversa) ?? new Map<number, CryptoKey>();
      for (const item of chaves.minhas) {
        if (abertas.has(item.versao)) continue;
        const chave = await desembrulhar(item.embrulho, this.privada, item.de_publica, contextoDoEmbrulho(conversa, item.versao, this.aparelho));
        if (chave) abertas.set(item.versao, chave);
        // Embrulho que não abre (feito errado ou adulterado): devolve, para alguém da conversa repassar de novo.
        else await rpc("chat_chaves_recusar", { p_aparelho: this.aparelho, p_conversa: conversa, p_versao: item.versao }).catch(() => undefined);
      }
      this.versoes.set(conversa, abertas);
      this.estado.set(conversa, { atual: chaves.atual, minima: chaves.minima, aparelhos: chaves.aparelhos, em: Date.now() });
    })().finally(() => this.carregando.delete(conversa));
    this.carregando.set(conversa, trabalho);
    return trabalho;
  }

  /** Abre um texto cifrado. Se a versão ainda não está na memória, busca no banco (no máximo uma vez a cada dez segundos). */
  async abrir(conversa: string, corpo: string, contexto: string): Promise<string | null> {
    const versao = versaoDe(corpo);
    if (versao === null) return null;
    let chave = this.versoes.get(conversa)?.get(versao);
    if (!chave && Date.now() - (this.estado.get(conversa)?.em ?? 0) > 10_000) {
      await this.carregar(conversa).catch(() => undefined);
      chave = this.versoes.get(conversa)?.get(versao);
    }
    return chave ? decifrar(chave, corpo, contexto) : null;
  }

  /** Cifra para enviar com a versão atual da chave; se este aparelho não a tem (ou se alguém saiu), cria a seguinte. */
  async cifrar(conversa: string, texto: string, contexto: string, recarregar = true): Promise<string> {
    if (recarregar || !this.estado.has(conversa)) await this.carregar(conversa);
    const estado = this.estado.get(conversa)!;
    const atual = estado.atual;
    const chave = atual !== null && atual >= estado.minima ? this.versoes.get(conversa)?.get(atual) : undefined;
    if (atual !== null && chave) return cifrar(chave, atual, texto, contexto);
    return this.criarVersao(conversa, Math.max((atual ?? 0) + 1, estado.minima), texto, contexto);
  }

  private async criarVersao(conversa: string, versao: number, texto: string, contexto: string): Promise<string> {
    const chave = await novaChave();
    const aparelhos = this.estado.get(conversa)?.aparelhos ?? [];
    const embrulhos = await Promise.all(
      aparelhos.map(async (aparelho) => ({ para: aparelho.id, embrulho: await embrulhar(chave, this.privada, aparelho.publica, contextoDoEmbrulho(conversa, versao, aparelho.id)) })),
    );
    try {
      await rpc("chat_chave_nova", { p_conversa: conversa, p_aparelho: this.aparelho, p_versao: versao, p_embrulhos: embrulhos });
    } catch (erro) {
      // Outra pessoa criou a mesma versão primeiro: usa a dela.
      if (codigo(erro) === "versao_ocupada") return this.cifrar(conversa, texto, contexto, true);
      throw erro;
    }
    const abertas = this.versoes.get(conversa) ?? new Map<number, CryptoKey>();
    abertas.set(versao, chave);
    this.versoes.set(conversa, abertas);
    const estado = this.estado.get(conversa);
    if (estado) estado.atual = versao;
    return cifrar(chave, versao, texto, contexto);
  }

  /** Repassa as chaves que este aparelho tem para aparelhos de colegas que ainda não as receberam. Devolve quantas repassou. */
  async repassar(): Promise<number> {
    const faltam = await rpc<{ conversa: string; versao: number; para: string; publica: string }[]>("chat_chaves_pendentes", { p_aparelho: this.aparelho });
    if (faltam.length === 0) return 0;
    for (const conversa of new Set(faltam.map((item) => item.conversa))) await this.carregar(conversa).catch(() => undefined);
    const embrulhos = [];
    for (const item of faltam) {
      const chave = this.versoes.get(item.conversa)?.get(item.versao);
      if (!chave) continue;
      embrulhos.push({ conversa: item.conversa, versao: item.versao, para: item.para, embrulho: await embrulhar(chave, this.privada, item.publica, contextoDoEmbrulho(item.conversa, item.versao, item.para)) });
    }
    if (embrulhos.length === 0) return 0;
    return (await rpc<{ dadas: number }>("chat_chaves_dar", { p_aparelho: this.aparelho, p_embrulhos: embrulhos })).dadas;
  }
}

const abertos = new Map<string, Promise<Chaveiro>>();

/** Um chaveiro por conta, compartilhado por todas as partes do painel. */
export function chaveiroDe(usuario: string): Promise<Chaveiro> {
  let chaveiro = abertos.get(usuario);
  if (!chaveiro) {
    chaveiro = Chaveiro.abrir(usuario);
    chaveiro.catch(() => abertos.delete(usuario));
    abertos.set(usuario, chaveiro);
  }
  return chaveiro;
}
