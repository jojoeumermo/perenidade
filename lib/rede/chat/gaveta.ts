// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o chat privado da Alumia guarda NESTE aparelho: um banco IndexedDB próprio ("lucia-alumia-chat"), com três gavetas:
//   contas      a chave do aparelho e a identidade de cada conta (as duas não exportáveis)
//   conhecidas  a identidade e a chave do aparelho que este aparelho conhece de cada pessoa, e se foi verificada
//   ordem       o que já chegou de cada autor em cada versão (lib/rede/chat/ordem.ts): contadores e identificadores, nunca texto
// Mensagem aberta, rascunho e chave de conversa NUNCA são gravados: vivem só na memória da aba.
//
// Sem IndexedDB (alguns modos privados), tudo vive só na memória, enquanto a aba está aberta.
//
// `apagarTudoDoChat` é o que o "Sair rápido" da Alumia chama (components/rede/chat/encaixe.tsx): apaga o banco inteiro e a
// memória, em bem menos de 0,8 s, e nunca lança. Três cuidados para o apagar valer de verdade:
//   1. As OUTRAS abas são avisadas (BroadcastChannel) e cada uma apaga a própria memória (chaves, telas) e liga a trava.
//   2. O banco só é CRIADO na ativação do chat. Qualquer outra leitura ou gravação que encontre o banco sumido desfaz a
//      criação; e, se esta página já tinha visto o banco, entende que ele foi apagado por fora (outra aba, a saída rápida do
//      site em lib/modo-seguro.ts) e se limpa também. Um pedido que estava no caminho não recria o banco.
//   3. Depois de apagar, a página não grava mais nada, até a pessoa ativar o chat de novo.
// Este arquivo não importa nada, de propósito: entra leve na casca da Alumia e roda no Node nos testes
// (scripts/testar-rede-chat.mjs, com um IndexedDB de mentira).

export const BANCO_DO_CHAT = "lucia-alumia-chat";
export const CONTAS = "contas";
export const CONHECIDAS = "conhecidas";
export const ORDEM = "ordem";
export type Gaveta = typeof CONTAS | typeof CONHECIDAS | typeof ORDEM;

/** O campo que identifica cada registro, por gaveta. */
const CAMPO: Record<Gaveta, string> = { [CONTAS]: "usuario", [CONHECIDAS]: "chave", [ORDEM]: "chave" };
const GAVETAS = Object.keys(CAMPO) as Gaveta[];
const VERSAO_DO_BANCO = 2;
/** O canal por onde uma aba avisa as outras que o chat foi apagado. Não leva dado nenhum, só o aviso. */
const CANAL_DO_APAGAR = "lucia-alumia-chat-apagar";
const AVISO_DE_APAGAR = "apagar";

const memoria: Record<Gaveta, Map<string, unknown>> = { [CONTAS]: new Map(), [CONHECIDAS]: new Map(), [ORDEM]: new Map() };
const abertos = new Set<IDBDatabase>();
const limpezas = new Set<() => void>();
/** Depois do "apagar tudo", nada mais é gravado por esta página (um pedido que estava no caminho não recria o banco). */
let apagado = false;
/** Esta página já viu o banco existir. Se depois ele some, foi apagado por fora. */
let existia = false;
let canal: BroadcastChannel | null | undefined;

/** Apaga o que ESTA página tem do chat: memória, o que as telas e o chaveiro registraram, conexões abertas; e liga a trava. */
function limparAqui(): void {
  apagado = true;
  existia = false;
  for (const mapa of Object.values(memoria)) mapa.clear();
  for (const limpar of [...limpezas]) {
    try {
      limpar();
    } catch {
      // uma limpeza que falha não segura as outras
    }
  }
  // Conexão aberta seguraria o apagamento do banco: fecha todas.
  for (const banco of [...abertos]) {
    try {
      banco.close();
    } catch {
      // já fechada
    }
  }
  abertos.clear();
}

/** Passa a ouvir o aviso de "apagar" das outras abas (uma vez só por página; sem BroadcastChannel, nada acontece). */
function escutar(): void {
  if (canal !== undefined) return;
  canal = null;
  try {
    if (typeof BroadcastChannel === "undefined") return;
    canal = new BroadcastChannel(CANAL_DO_APAGAR);
    canal.onmessage = (evento) => {
      if (evento.data === AVISO_DE_APAGAR) limparAqui();
    };
    // No Node (testes), o canal aberto não segura o processo.
    (canal as unknown as { unref?: () => void }).unref?.();
  } catch {
    canal = null;
  }
}

/**
 * Abre o banco. `criar`: só a ativação do chat cria o banco. Sem isso, se o banco não existe, a criação é desfeita e a
 * abertura falha com "sem_banco"; e se esta página já tinha visto o banco, ele foi apagado por fora: a página se limpa.
 */
function abrirBanco(criar: boolean): Promise<IDBDatabase> {
  escutar();
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO_DO_CHAT, VERSAO_DO_BANCO);
    let desfeito = false;
    const semBanco = () => {
      if (existia) limparAqui();
      reject(new Error("sem_banco"));
    };
    pedido.onupgradeneeded = (evento) => {
      if (evento.oldVersion === 0 && !criar) {
        desfeito = true;
        try {
          pedido.transaction?.abort();
        } catch {
          // o navegador não deixou desfazer: o banco vazio é apagado logo abaixo, quando abrir
        }
        return;
      }
      const banco = pedido.result;
      for (const gaveta of GAVETAS) if (!banco.objectStoreNames.contains(gaveta)) banco.createObjectStore(gaveta, { keyPath: CAMPO[gaveta] });
    };
    pedido.onsuccess = () => {
      const banco = pedido.result;
      if (desfeito || apagado) {
        // Não era para existir (ou o "apagar tudo" passou enquanto abria): fecha e, se foi criado agora, apaga.
        try {
          banco.close();
          if (desfeito || criar) indexedDB.deleteDatabase(BANCO_DO_CHAT);
        } catch {
          // nada a fazer
        }
        if (desfeito) semBanco();
        else reject(new Error("apagado"));
        return;
      }
      existia = true;
      // Outra aba (ou a saída rápida do site) pediu para apagar o banco: solta a conexão e limpa esta página também.
      banco.onversionchange = (evento) => {
        abertos.delete(banco);
        try {
          banco.close();
        } catch {
          // já fechada
        }
        if (evento.newVersion === null) limparAqui();
      };
      abertos.add(banco);
      resolve(banco);
    };
    pedido.onerror = (evento) => {
      if (!desfeito) return reject(pedido.error);
      evento.preventDefault?.();
      semBanco();
    };
  });
}

async function comOBanco<T>(criar: boolean, agir: (banco: IDBDatabase) => Promise<T>): Promise<T> {
  if (apagado) throw new Error("apagado");
  const banco = await abrirBanco(criar);
  try {
    return await agir(banco);
  } finally {
    abertos.delete(banco);
    try {
      banco.close();
    } catch {
      // já fechada
    }
  }
}

function naGaveta<T>(gaveta: Gaveta, modo: IDBTransactionMode, agir: (g: IDBObjectStore) => IDBRequest, criar = false): Promise<T> {
  return comOBanco(criar, (banco) =>
    new Promise<T>((resolve, reject) => {
      const pedido = agir(banco.transaction(gaveta, modo).objectStore(gaveta));
      pedido.onsuccess = () => resolve(pedido.result as T);
      pedido.onerror = () => reject(pedido.error);
    }),
  );
}

const faixa = (prefixo: string) => IDBKeyRange.bound(prefixo, `${prefixo}\uffff`);

/** Lê um registro (do banco; se não houver banco, da memória). Nunca cria o banco. */
export async function lerDaGaveta<T>(gaveta: Gaveta, chave: string): Promise<T | null> {
  const daMemoria = () => (memoria[gaveta].get(chave) as T | undefined) ?? null;
  try {
    return (await naGaveta<T | undefined>(gaveta, "readonly", (g) => g.get(chave))) ?? daMemoria();
  } catch {
    return daMemoria();
  }
}

/** Lê todos os registros cuja chave começa com `prefixo`. Nunca cria o banco. */
export async function lerPrefixoDaGaveta<T>(gaveta: Gaveta, prefixo: string): Promise<T[]> {
  let doBanco: T[] = [];
  try {
    doBanco = await naGaveta<T[]>(gaveta, "readonly", (g) => g.getAll(faixa(prefixo)));
  } catch {
    // sem banco: só a memória
  }
  // A memória é lida DEPOIS do banco: se o banco tinha sido apagado por fora, ela já foi limpa.
  const juntos = new Map<string, T>();
  for (const [chave, valor] of memoria[gaveta]) if (chave.startsWith(prefixo)) juntos.set(chave, valor as T);
  const campo = CAMPO[gaveta];
  for (const valor of doBanco) juntos.set(String((valor as Record<string, unknown>)[campo]), valor);
  return [...juntos.values()];
}

/**
 * Guarda um registro (na memória e, havendo, no banco). `criar`: só a ATIVAÇÃO do chat passa isto. É ela que cria o banco e
 * que solta a trava do "apagar tudo" (a pessoa escolheu ter o chat neste aparelho de novo).
 */
export async function guardarNaGaveta(gaveta: Gaveta, dados: object, opcoes: { criar?: boolean } = {}): Promise<void> {
  if (opcoes.criar) apagado = false;
  if (apagado) return;
  const chave = String((dados as Record<string, unknown>)[CAMPO[gaveta]]);
  try {
    await naGaveta(gaveta, "readwrite", (g) => g.put(dados), opcoes.criar === true);
  } catch {
    // fica só na memória
  }
  if (!apagado) memoria[gaveta].set(chave, dados);
}

/**
 * Lê e grava um registro NUMA transação só: `mudar` recebe o que está guardado (ou null) e devolve o que fica (ou null para
 * não mexer). Duas abas ao mesmo tempo nunca leem o mesmo valor antes de gravar: é assim que o contador de quem escreve não se
 * repete. Devolve o que ficou guardado; null se nada foi gravado (inclusive depois do "apagar tudo"). Nunca cria o banco.
 */
export async function mudarNaGaveta<T extends object>(gaveta: Gaveta, chave: string, mudar: (atual: T | null) => T | null): Promise<T | null> {
  if (apagado) return null;
  let noBanco = false;
  try {
    return await comOBanco(false, (banco) =>
      new Promise<T | null>((resolve, reject) => {
        const g = banco.transaction(gaveta, "readwrite").objectStore(gaveta);
        const leitura = g.get(chave);
        leitura.onerror = () => reject(leitura.error);
        leitura.onsuccess = () => {
          const atual = (leitura.result as T | undefined) ?? (memoria[gaveta].get(chave) as T | undefined) ?? null;
          noBanco = true;
          let novo: T | null;
          try {
            novo = mudar(atual);
          } catch (erro) {
            return reject(erro);
          }
          if (novo === null) return resolve(null);
          const escrita = g.put(novo);
          escrita.onerror = () => reject(escrita.error);
          escrita.onsuccess = () => {
            if (!apagado) memoria[gaveta].set(chave, novo);
            resolve(novo);
          };
        };
      }),
    );
  } catch (erro) {
    // Sem banco: só a memória desta página. (Se a mudança já tinha sido decidida com o banco aberto, o erro sobe.)
    if (noBanco) throw erro;
    if (apagado) return null;
    const novo = mudar((memoria[gaveta].get(chave) as T | undefined) ?? null);
    if (novo !== null) memoria[gaveta].set(chave, novo);
    return novo;
  }
}

/** Apaga um registro. */
export async function apagarDaGaveta(gaveta: Gaveta, chave: string): Promise<void> {
  memoria[gaveta].delete(chave);
  try {
    await naGaveta(gaveta, "readwrite", (g) => g.delete(chave));
  } catch {
    // nada guardado
  }
}

/** Apaga todos os registros cuja chave começa com `prefixo`. */
export async function apagarPrefixoDaGaveta(gaveta: Gaveta, prefixo: string): Promise<void> {
  for (const chave of [...memoria[gaveta].keys()]) if (chave.startsWith(prefixo)) memoria[gaveta].delete(chave);
  try {
    await naGaveta(gaveta, "readwrite", (g) => g.delete(faixa(prefixo)));
  } catch {
    // nada guardado
  }
}

/**
 * Quem guarda coisa do chat só na memória (chaves de conversa, rascunho, mensagens abertas) deixa aqui como apagar. A limpeza
 * roda no "apagar tudo" desta aba, no de OUTRA aba e quando o banco é apagado por fora. Devolve como desfazer o registro.
 */
export function aoApagarTudoDoChat(limpar: () => void): () => void {
  escutar();
  limpezas.add(limpar);
  return () => {
    limpezas.delete(limpar);
  };
}

/** O chat foi apagado deste aparelho e esta página ainda não o ativou de novo? */
export const chatApagadoAqui = () => apagado;

/**
 * As lojas da biblioteca do Matrix (lib/rede/chat/olm.ts): uma por conta, com este começo de nome. A biblioteca cria dois bancos
 * IndexedDB para cada uma ("<nome>::matrix-sdk-crypto" e "<nome>::matrix-sdk-crypto-meta").
 */
export const PREFIXO_DA_LOJA_OLM = "lucia-alumia-olm-";
/** As lojas abertas nesta página (para apagar mesmo onde o navegador não lista os bancos). */
const lojasAbertas = new Set<string>();
export const anotarLojaAberta = (nome: string) => void lojasAbertas.add(nome);

/** Pede ao navegador para apagar as lojas da biblioteca: as abertas aqui e todas as que ele listar com o começo do nome. */
export function apagarLojasDaBiblioteca(conhecidas: Iterable<string> = []): void {
  if (typeof indexedDB === "undefined") return;
  const apagar = (nome: string) => {
    try {
      indexedDB.deleteDatabase(nome);
    } catch {
      // segue com as outras
    }
  };
  for (const nome of conhecidas) for (const sufixo of ["::matrix-sdk-crypto", "::matrix-sdk-crypto-meta"]) apagar(nome + sufixo);
  try {
    void indexedDB.databases?.().then(
      (lista) => {
        for (const b of lista) if (b.name?.startsWith(PREFIXO_DA_LOJA_OLM)) apagar(b.name);
      },
      () => undefined,
    );
  } catch {
    // navegador sem a lista: ficam só as conhecidas
  }
}

/**
 * PÂNICO: apaga deste aparelho tudo o que o chat guardou, de todas as contas: a memória (chaves, rascunho, mensagens abertas,
 * o que os componentes registraram), nesta aba e nas outras, e o banco IndexedDB inteiro. Termina em no máximo `limiteMs` (bem
 * abaixo dos 0,8 s do "Sair rápido") e NUNCA lança. Depois disso, a chave do chat não existe mais aqui: é preciso ativar o
 * chat de novo, e o que foi escrito antes não abre mais neste aparelho.
 */
export async function apagarTudoDoChat(limiteMs = 400): Promise<void> {
  try {
    limparAqui();
    // As outras abas: cada uma apaga a própria memória e solta o banco (senão o apagamento ficaria esperando por elas).
    try {
      escutar();
      canal?.postMessage(AVISO_DE_APAGAR);
    } catch {
      // sem canal: a outra aba se limpa quando notar que o banco sumiu
    }
    if (typeof indexedDB === "undefined") return;
    apagarLojasDaBiblioteca(lojasAbertas);
    // O histórico das conversas neste aparelho (lib/rede/chat/historico.ts).
    try {
      indexedDB.deleteDatabase("lucia-alumia-historico");
    } catch {
      // segue
    }
    await new Promise<void>((pronto) => {
      const relogio = setTimeout(pronto, limiteMs);
      const fim = () => {
        clearTimeout(relogio);
        pronto();
      };
      try {
        const pedido = indexedDB.deleteDatabase(BANCO_DO_CHAT);
        pedido.onsuccess = fim;
        pedido.onerror = fim;
        // "blocked": outra aba ainda está com o banco aberto. O pedido continua valendo e o banco some quando ela soltar.
        pedido.onblocked = () => undefined;
      } catch {
        fim();
      }
    });
  } catch {
    // nunca lança: a pessoa precisa sair JÁ
  }
}

/** Só para os testes: volta a aceitar gravações depois de um "apagar tudo" (no site, isso só acontece ao ativar o chat de novo). */
export function reabrirDepoisDeApagar(): void {
  apagado = false;
}
