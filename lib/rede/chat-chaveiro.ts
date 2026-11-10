// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro do chat privado da Alumia, neste aparelho: a chave do aparelho e a identidade (as duas NÃO exportáveis, guardadas
// no IndexedDB do navegador, num banco próprio, separado do chaveiro da equipe), as identidades que este aparelho já conhece de
// cada pessoa ("confiar na primeira vez, avisar quando mudar") e, só na memória enquanto a página está aberta, as chaves das
// conversas. A cifra mora em lib/rede/chat-privado.ts; as chamadas, em lib/rede/cliente-chat.ts. Documento: docs/rede/CHAT-PRIVADO.md.
import { abrirEmbrulho, abrirMensagem, type Autoria, certificarChave, cifrarMensagem, compararIdentidade, type Eu, type Identidade, novaChaveDoAparelho, novaIdentidadeDoChat, type ParDoAparelho, precisaDeVersaoNova, prepararNovaVersao } from "./chat-privado";
import { chat, PREVIA_DO_CHAT, type ChavesDaConversa, type MensagemCifrada, type SituacaoDoChat } from "./cliente-chat";

/**
 * Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), o aparelho já vem "ativado" e as mensagens do dublê (lib/rede/chat-exemplos.ts) vão
 * e voltam em texto: nada sai da aba, então não há o que cifrar, e as telas do chat ficam testáveis sem banco. Fora da prévia,
 * nada disto existe no caminho.
 */
const EU_DA_PREVIA = (usuario: string, versao = 1): Eu =>
  ({ usuario, versao, aparelho: { publica: "previa-aparelho-eu" }, identidade: { publica: "previa-identidade-eu" } }) as unknown as Eu;

interface Guardado {
  usuario: string;
  aparelho: ParDoAparelho;
  identidade: Identidade;
}

interface Conhecida {
  /** "<eu>:<outra pessoa>". */
  chave: string;
  identidade: string;
  verificado: boolean;
}

const BANCO = "lucia-alumia-chat";
const CONTAS = "contas";
const CONHECIDAS = "conhecidas";

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains(CONTAS)) banco.createObjectStore(CONTAS, { keyPath: "usuario" });
      if (!banco.objectStoreNames.contains(CONHECIDAS)) banco.createObjectStore(CONHECIDAS, { keyPath: "chave" });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function naGaveta<T>(gaveta: string, modo: IDBTransactionMode, agir: (g: IDBObjectStore) => IDBRequest): Promise<T> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pedido = agir(banco.transaction(gaveta, modo).objectStore(gaveta));
      pedido.onsuccess = () => resolve(pedido.result as T);
      pedido.onerror = () => reject(pedido.error);
    });
  } finally {
    banco.close();
  }
}

/** Sem IndexedDB (alguns modos privados), vive só enquanto a aba está aberta. */
const contasNaMemoria = new Map<string, Guardado>();
const conhecidasNaMemoria = new Map<string, Conhecida>();

async function lerConta(usuario: string): Promise<Guardado | null> {
  try {
    return (await naGaveta<Guardado | undefined>(CONTAS, "readonly", (g) => g.get(usuario))) ?? contasNaMemoria.get(usuario) ?? null;
  } catch {
    return contasNaMemoria.get(usuario) ?? null;
  }
}

async function guardarConta(dados: Guardado) {
  contasNaMemoria.set(dados.usuario, dados);
  try {
    await naGaveta(CONTAS, "readwrite", (g) => g.put(dados));
  } catch {
    // fica só na memória
  }
}

async function lerConhecida(eu: string, outro: string): Promise<Conhecida | null> {
  const chave = `${eu}:${outro}`;
  try {
    return (await naGaveta<Conhecida | undefined>(CONHECIDAS, "readonly", (g) => g.get(chave))) ?? conhecidasNaMemoria.get(chave) ?? null;
  } catch {
    return conhecidasNaMemoria.get(chave) ?? null;
  }
}

async function guardarConhecida(dados: Conhecida) {
  conhecidasNaMemoria.set(dados.chave, dados);
  try {
    await naGaveta(CONHECIDAS, "readwrite", (g) => g.put(dados));
  } catch {
    // fica só na memória
  }
}

/** Apaga deste aparelho tudo o que o chat guardou da conta (depois de "apagar tudo do chat"). */
export async function esquecerNesteAparelho(usuario: string) {
  contasNaMemoria.delete(usuario);
  for (const chave of [...conhecidasNaMemoria.keys()]) if (chave.startsWith(`${usuario}:`)) conhecidasNaMemoria.delete(chave);
  try {
    await naGaveta(CONTAS, "readwrite", (g) => g.delete(usuario));
    await naGaveta(CONHECIDAS, "readwrite", (g) => g.delete(IDBKeyRange.bound(`${usuario}:`, `${usuario}:￿`)));
  } catch {
    // nada guardado
  }
}

export type EstadoDoAparelho = { estado: "pronto"; eu: Eu } | { estado: "sem_chave" } | { estado: "outro_aparelho" };

/** Este aparelho é o do chat desta conta? */
export async function estadoDoAparelho(situacao: SituacaoDoChat): Promise<EstadoDoAparelho> {
  if (PREVIA_DO_CHAT) return { estado: "pronto", eu: EU_DA_PREVIA(situacao.eu, situacao.chave?.versao) };
  const guardado = await lerConta(situacao.eu);
  if (!situacao.chave) return { estado: "sem_chave" };
  if (!guardado || guardado.aparelho.publica !== situacao.chave.publica || guardado.identidade.publica !== situacao.chave.identidade) return { estado: "outro_aparelho" };
  return { estado: "pronto", eu: { usuario: situacao.eu, aparelho: guardado.aparelho, identidade: guardado.identidade, versao: situacao.chave.versao } };
}

/** Ativa o chat neste aparelho (cria a chave e a identidade, publica só a parte pública). Num aparelho novo, o antigo deixa de abrir. */
export async function ativarNesteAparelho(usuario: string): Promise<Eu> {
  if (PREVIA_DO_CHAT) return EU_DA_PREVIA(usuario);
  const aparelho = await novaChaveDoAparelho();
  const identidade = await novaIdentidadeDoChat();
  const certificado = await certificarChave(identidade, usuario, aparelho.publica);
  const r = await chat.publicarChave(identidade.publica, aparelho.publica, certificado);
  await guardarConta({ usuario, aparelho, identidade });
  return { usuario, aparelho, identidade, versao: r.versao };
}

/** Uma conversa aberta neste aparelho: as chaves de cada versão (só na memória) e o que se sabe da outra pessoa. */
export interface Sessao {
  conversa: string;
  eu: Eu;
  outro: string;
  versao: number;
  chaves: Map<number, CryptoKey>;
  /** As identidades em que este aparelho confia (eu e a outra pessoa). */
  confiadas: Record<string, string>;
  /** A identidade da outra pessoa mudou desde a última vez: nada é entregue a ela até confirmar. */
  mudou: string | null;
  /** A outra pessoa ainda não ativou o chat em aparelho nenhum. */
  semChaveDoOutro: boolean;
  verificado: boolean;
}

async function carregarChaves(sessao: Sessao, dados: ChavesDaConversa) {
  for (const e of dados.embrulhos) {
    if (sessao.chaves.has(e.versao) || e.chave_versao !== sessao.eu.versao) continue;
    const k = await abrirEmbrulho(sessao.conversa, sessao.eu, e, sessao.confiadas);
    if (k) sessao.chaves.set(e.versao, k);
  }
  sessao.versao = dados.versao;
}

/** Abre a conversa: confere a identidade da outra pessoa, desembrulha as chaves e, se precisar, faz uma versão nova. */
export async function abrirSessao(eu: Eu, conversa: string, outro: string, anterior?: Sessao | null): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    return { conversa, eu, outro, versao: 1, chaves: anterior?.chaves ?? new Map(), confiadas: { [eu.usuario]: eu.identidade.publica, [outro]: `previa-identidade-${outro}` }, mudou: null, semChaveDoOutro: false, verificado: anterior?.verificado ?? false };
  }
  const dados = await chat.chaves(conversa);
  const doOutro = dados.participantes.find((p) => p.usuario === outro) ?? null;
  const conhecida = await lerConhecida(eu.usuario, outro);
  const sessao: Sessao = {
    conversa,
    eu,
    outro,
    versao: dados.versao,
    chaves: anterior?.chaves ?? new Map(),
    confiadas: { [eu.usuario]: eu.identidade.publica },
    mudou: null,
    semChaveDoOutro: !doOutro,
    verificado: !!conhecida?.verificado,
  };
  if (doOutro) {
    const comparacao = compararIdentidade(conhecida?.identidade, doOutro.identidade);
    if (comparacao === "nova") await guardarConhecida({ chave: `${eu.usuario}:${outro}`, identidade: doOutro.identidade, verificado: false });
    if (comparacao === "mudou") sessao.mudou = doOutro.identidade;
    // Para abrir o que já veio, vale a identidade conhecida; a nova só depois de a pessoa confirmar.
    sessao.confiadas[outro] = conhecida?.identidade ?? doOutro.identidade;
  }
  await carregarChaves(sessao, dados);
  if (doOutro && !sessao.mudou && precisaDeVersaoNova(dados.versao, dados.atual_ok, dados.versao_em)) {
    try {
      const nova = await prepararNovaVersao(conversa, dados.versao + 1, eu, dados.participantes, sessao.confiadas);
      await chat.novaVersao(conversa, dados.versao + 1, nova.embrulhos);
      sessao.chaves.set(dados.versao + 1, nova.chave);
      sessao.versao = dados.versao + 1;
    } catch {
      // Outra pessoa fez a versão ao mesmo tempo (ou algo não confere): lê de novo o que está lá.
      await carregarChaves(sessao, await chat.chaves(conversa));
    }
  }
  return sessao;
}

/** A pessoa confirmou a identidade nova da outra (trocou de aparelho). `verificado`: comparou o código de segurança pessoalmente. */
export async function confiarNaIdentidade(sessao: Sessao, identidade: string, verificado = false) {
  if (PREVIA_DO_CHAT) return;
  await guardarConhecida({ chave: `${sessao.eu.usuario}:${sessao.outro}`, identidade, verificado });
}

export interface MensagemAberta {
  id: string;
  autor: string;
  criado_em: string;
  expira_em: string;
  /** null: este aparelho não tem a chave (escrita antes de trocar de aparelho, por exemplo). */
  texto: string | null;
  autoria: Autoria | null;
}

export async function abrirMensagens(sessao: Sessao, lista: MensagemCifrada[]): Promise<MensagemAberta[]> {
  if (PREVIA_DO_CHAT) return lista.map((m) => ({ id: m.id, autor: m.autor, criado_em: m.criado_em, expira_em: m.expira_em, texto: m.corpo, autoria: "ok" as Autoria }));
  return Promise.all(
    lista.map(async (m) => {
      const chave = sessao.chaves.get(m.versao);
      const aberta = chave ? await abrirMensagem(chave, m.corpo, sessao.conversa, m.autor, sessao.confiadas[m.autor] ?? null) : null;
      return { id: m.id, autor: m.autor, criado_em: m.criado_em, expira_em: m.expira_em, texto: aberta?.texto ?? null, autoria: aberta?.autoria ?? null };
    }),
  );
}

/** Cifra no aparelho e envia. Se a chave virou de versão no caminho, abre de novo e tenta uma vez mais. */
export async function enviarTexto(sessao: Sessao, texto: string): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    await chat.enviar(sessao.conversa, 1, texto);
    return sessao;
  }
  let atual = sessao;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const chave = atual.chaves.get(atual.versao);
    if (!chave || atual.mudou) throw Object.assign(new Error("dm_sem_chave"), { code: "dm_sem_chave" });
    try {
      await chat.enviar(atual.conversa, atual.versao, await cifrarMensagem(chave, atual.versao, atual.eu, atual.conversa, texto));
      return atual;
    } catch (erro) {
      const codigo = typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : "";
      if (codigo !== "versao_desatualizada" || tentativa > 0) throw erro;
      atual = await abrirSessao(atual.eu, atual.conversa, atual.outro, atual);
    }
  }
  return atual;
}
