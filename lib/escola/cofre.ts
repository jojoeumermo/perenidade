// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cofre da Escola neste aparelho (docs/auditoria/ESCOLA-2026-11-09.md, risco 6). O que a Escola guarda só no aparelho
// (as chaves "lucia:escola-privado:*": conversas do assistente, o trabalho, o diário, as fichas, os ensaios) fica cifrado
// com AES-GCM. A chave sai de uma frase que só a pessoa sabe (PBKDF2-SHA-256, 600 mil voltas) e NUNCA é guardada: mora só
// na memória da aba, não pode ser exportada, e some ao recarregar, ao fechar a aba ou depois de 15 minutos parada.
// Um aparelho apreendido com o cofre fechado mostra só o bloco cifrado; quem não sabe a frase precisa adivinhá-la, uma
// tentativa cara de cada vez (por isso a frase pede 8 caracteres ou mais: um PIN curto se adivinha num computador potente).
//
// As funções que leem e gravam esses dados (lib/escola/acompanhante.ts, agentes.ts, diario.ts) pedem o armazenamento
// a armazemPrivado(): sem cofre criado, é o localStorage de antes; com o cofre aberto, um armazenamento na memória que
// grava cifrado no fundo; com o cofre fechado, nada (as telas mostram vazio e não gravam).
// Sem os atalhos "@/" de propósito (roda no Node nos testes).

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const PREFIXO_COFRE = "lucia:escola-cofre:";
const META = `${PREFIXO_COFRE}meta`;
const DADOS = `${PREFIXO_COFRE}dados`;
const PRIVADO = "lucia:escola-privado:";
const VOLTAS = 600_000;
const PARADO_MS = 15 * 60_000;
export const FRASE_MINIMA = 8;

interface Meta {
  v: 1;
  sal: string;
  voltas: number;
}

let chave: CryptoKey | null = null;
let memoria: Map<string, string> | null = null;
let gravando: Promise<void> = Promise.resolve();
let parado: ReturnType<typeof setTimeout> | null = null;

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function local(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function avisar() {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:escola-cofre"));
  } catch {
    // fora do navegador
  }
}

function lerMeta(): Meta | null {
  try {
    const m = JSON.parse(local()?.getItem(META) ?? "null") as Meta | null;
    return m && m.v === 1 && typeof m.sal === "string" && Number.isInteger(m.voltas) ? m : null;
  } catch {
    return null;
  }
}

export type EstadoDoCofre = "sem-cofre" | "fechado" | "aberto";

export function estadoDoCofre(): EstadoDoCofre {
  if (!lerMeta()) return "sem-cofre";
  return chave && memoria ? "aberto" : "fechado";
}

async function derivar(frase: string, sal: Uint8Array, voltas: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(frase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: voltas }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function cifrar(k: CryptoKey, mapa: Map<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const corpo = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(JSON.stringify(Object.fromEntries(mapa))));
  return `${b64(iv)}.${b64(corpo)}`;
}

async function decifrar(k: CryptoKey, bloco: string): Promise<Map<string, string>> {
  const [iv, corpo] = bloco.split(".");
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) as BufferSource }, k, deB64(corpo) as BufferSource);
  const obj = JSON.parse(new TextDecoder().decode(claro)) as Record<string, unknown>;
  return new Map(Object.entries(obj).filter((e): e is [string, string] => typeof e[1] === "string" && e[0].startsWith(PRIVADO)));
}

/** Grava o mapa cifrado, um pedido depois do outro (o último vence). */
function persistir() {
  const k = chave;
  const m = memoria;
  if (!k || !m) return;
  const copia = new Map(m);
  gravando = gravando.then(async () => {
    try {
      local()?.setItem(DADOS, await cifrar(k, copia));
    } catch {
      // armazenamento cheio ou bloqueado: fica na memória até a próxima gravação
    }
  });
}

function marcarUso() {
  if (parado) clearTimeout(parado);
  parado = setTimeout(fecharCofre, PARADO_MS);
}

/** O armazenamento das chaves privadas da Escola: o localStorage (sem cofre), a memória do cofre aberto ou nada. */
export function armazemPrivado(): Armazenamento | null {
  const estado = estadoDoCofre();
  if (estado === "sem-cofre") return local();
  if (estado === "fechado") return null;
  return {
    getItem(c) {
      marcarUso();
      return memoria?.get(c) ?? null;
    },
    setItem(c, v) {
      if (!c.startsWith(PRIVADO) || !memoria) return;
      marcarUso();
      memoria.set(c, String(v));
      persistir();
    },
    removeItem(c) {
      if (!memoria) return;
      marcarUso();
      memoria.delete(c);
      persistir();
    },
  };
}

/**
 * Cria o cofre com a frase: leva para dentro dele o que já estava guardado em claro e apaga a cópia em claro.
 * Devolve false se a frase for curta ou se o navegador não tiver a cifra.
 */
export async function criarCofre(frase: string): Promise<boolean> {
  const armazem = local();
  if (!armazem || !globalThis.crypto?.subtle || frase.length < FRASE_MINIMA) return false;
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const k = await derivar(frase, sal, VOLTAS);
  const mapa = new Map<string, string>();
  for (let i = 0; i < armazem.length; i++) {
    const c = armazem.key(i);
    if (c?.startsWith(PRIVADO)) mapa.set(c, armazem.getItem(c) ?? "");
  }
  armazem.setItem(DADOS, await cifrar(k, mapa));
  armazem.setItem(META, JSON.stringify({ v: 1, sal: b64(sal), voltas: VOLTAS } satisfies Meta));
  for (const c of mapa.keys()) armazem.removeItem(c);
  chave = k;
  memoria = mapa;
  marcarUso();
  avisar();
  return true;
}

/** Abre o cofre. Devolve false com a frase errada (a cifra autenticada recusa). */
export async function abrirCofre(frase: string): Promise<boolean> {
  const meta = lerMeta();
  const bloco = local()?.getItem(DADOS);
  if (!meta || !globalThis.crypto?.subtle) return false;
  try {
    const k = await derivar(frase, deB64(meta.sal), meta.voltas);
    memoria = bloco ? await decifrar(k, bloco) : new Map();
    chave = k;
    marcarUso();
    avisar();
    return true;
  } catch {
    return false;
  }
}

/** Fecha o cofre: a chave e o que estava aberto saem da memória da aba. */
export function fecharCofre() {
  if (parado) clearTimeout(parado);
  parado = null;
  chave = null;
  memoria?.clear();
  memoria = null;
  avisar();
}

/** Apaga o cofre inteiro (frase esquecida, ou a saída): o que estava nele não volta. */
export function apagarCofre() {
  fecharCofre();
  const armazem = local();
  try {
    armazem?.removeItem(DADOS);
    armazem?.removeItem(META);
  } catch {
    // bloqueado
  }
  avisar();
}
