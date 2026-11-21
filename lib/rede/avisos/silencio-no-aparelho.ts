// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Não perturbe com horário, SÓ NO APARELHO (Prompt 4, item 17, atrás de "alumia-p4-conversa"). Antes, a janela de silêncio ficava no
// servidor (public.rede_aviso_silencio_salvar), que segurava o push. Agora ela fica num IndexedDB próprio deste aparelho
// ("lucia-alumia-silencio", no horário do aparelho), e quem a lê é o service worker (public/sw.js) ao receber o push: dentro da
// janela, o aviso chega SEM som nem vibração (o navegador exige que todo push vire uma notificação; ela continua sendo o aviso sem
// texto de sempre, só o número e o idioma). O servidor não sabe se, nem quando, a pessoa silencia. Cada aparelho tem a sua janela.
// A conta de "estou na janela?" é a mesma do service worker (lá, em JavaScript puro); o teste confere as duas com os mesmos casos.
// Sem "@/" de propósito (roda no Node nos testes, com o fake-indexeddb).

export const BANCO_DO_SILENCIO = "lucia-alumia-silencio";
const LOJA = "janela";
const CHAVE = "janela";
const DIA = 24 * 60;

/** A janela em minutos do dia NO HORÁRIO DO APARELHO (0 a 1439). Início maior que o fim atravessa a meia-noite. */
export interface JanelaNoAparelho {
  inicio: number;
  fim: number;
}

const minutoValido = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < DIA;
/** A janela guardada, conferida (qualquer coisa fora do formato vale como "sem janela"). */
export function janelaValida(j: unknown): JanelaNoAparelho | null {
  const x = j as Partial<JanelaNoAparelho> | null;
  return x && minutoValido(x.inicio) && minutoValido(x.fim) && x.inicio !== x.fim ? { inicio: x.inicio, fim: x.fim } : null;
}

/** O minuto `m` do dia (0 a 1439) está dentro da janela? (A mesma conta de public/sw.js, noSilencio.) */
export function noSilencio(j: JanelaNoAparelho | null, m: number): boolean {
  if (!j) return false;
  return j.inicio < j.fim ? m >= j.inicio && m < j.fim : m >= j.inicio || m < j.fim;
}

/** "22:00" → 1320; nulo fora do formato. */
export function minutosDe(hhmm: string): number | null {
  const r = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!r) return null;
  const h = Number(r[1]);
  const m = Number(r[2]);
  return h > 23 || m > 59 ? null : h * 60 + m;
}
/** 1320 → "22:00". */
export const hhmmDe = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function abrir(): Promise<IDBDatabase> {
  return new Promise((pronto, falhou) => {
    const p = indexedDB.open(BANCO_DO_SILENCIO, 1);
    p.onupgradeneeded = () => {
      if (!p.result.objectStoreNames.contains(LOJA)) p.result.createObjectStore(LOJA);
    };
    p.onsuccess = () => pronto(p.result);
    p.onerror = () => falhou(p.error);
  });
}

async function naLoja<T>(modo: IDBTransactionMode, agir: (l: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((pronto, falhou) => {
      const tx = db.transaction(LOJA, modo);
      const pedido = agir(tx.objectStore(LOJA));
      tx.oncomplete = () => pronto(pedido.result as T);
      tx.onerror = () => falhou(tx.error);
      tx.onabort = () => falhou(tx.error);
    });
  } finally {
    db.close();
  }
}

/** A janela deste aparelho (nula se não há, ou se o navegador não deixa guardar). */
export async function lerJanelaNoAparelho(): Promise<JanelaNoAparelho | null> {
  try {
    return janelaValida(await naLoja<unknown>("readonly", (l) => l.get(CHAVE)));
  } catch {
    return null;
  }
}

/** Guarda a janela neste aparelho (nula tira). Lança "invalido:horario" com início igual ao fim ou fora do dia. */
export async function guardarJanelaNoAparelho(j: JanelaNoAparelho | null): Promise<void> {
  if (j === null) {
    await naLoja("readwrite", (l) => l.delete(CHAVE));
    return;
  }
  const valida = janelaValida(j);
  if (!valida) throw Object.assign(new Error("invalido:horario"), { code: "invalido:horario" });
  await naLoja("readwrite", (l) => l.put(valida, CHAVE));
}
