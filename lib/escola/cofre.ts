// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cofre da Escola neste aparelho (auditoria da Escola de 9/11, risco 6; relatório guardado fora do repositório). O que a Escola guarda só no aparelho
// (as chaves "lucia:escola-privado:*": conversas do assistente, o trabalho, o diário, as fichas, os ensaios) fica cifrado
// com XChaCha20-Poly1305 da libsodium (nonce sorteado a cada gravação). A chave sai de uma frase que só a pessoa sabe (Argon2id,
// 64 MiB e 3 passadas: lib/rede/cofre/argon.ts) e NUNCA é guardada: mora só na memória da aba, é zerada ao fechar, e some ao
// recarregar, ao fechar a aba ou depois de 15 minutos parada. O cofre do formato de antes (PBKDF2-SHA-256, 600 mil voltas,
// AES-GCM) abre com a mesma frase e é refeito na hora com o Argon2id, sem perder nada.
// Um aparelho apreendido com o cofre fechado mostra só o bloco cifrado; quem não sabe a frase precisa adivinhá-la, uma
// tentativa cara de cada vez (por isso a frase pede 8 caracteres ou mais: um PIN curto se adivinha num computador potente).
//
// As funções que leem e gravam esses dados (lib/escola/acompanhante.ts, agentes.ts, diario.ts) pedem o armazenamento
// a armazemPrivado(): sem cofre criado, é o localStorage de antes; com o cofre aberto, um armazenamento na memória que
// grava cifrado no fundo; com o cofre fechado, nada (as telas mostram vazio e não gravam).
// Sem os atalhos "@/" de propósito (roda no Node nos testes).
import { abrir, cabecalhoValido, type CabecalhoA2id, deBase64, derivar, paraBase64, selar } from "../rede/cofre/argon";

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const PREFIXO_COFRE = "lucia:escola-cofre:";
const META = `${PREFIXO_COFRE}meta`;
const DADOS = `${PREFIXO_COFRE}dados`;
const PRIVADO = "lucia:escola-privado:";
const PARADO_MS = 15 * 60_000;
export const FRASE_MINIMA = 8;

/** O cofre de antes (PBKDF2). Só para abrir e refazer com o Argon2id. */
interface MetaV1 {
  v: 1;
  sal: string;
  voltas: number;
}
interface MetaV2 {
  v: 2;
  a2id: CabecalhoA2id;
}
type Meta = MetaV1 | MetaV2;

let chave: Uint8Array | null = null;
let memoria: Map<string, string> | null = null;
let gravando: Promise<void> = Promise.resolve();
let parado: ReturnType<typeof setTimeout> | null = null;

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
    if (m && m.v === 2 && cabecalhoValido(m.a2id)) return m;
    return m && m.v === 1 && typeof m.sal === "string" && Number.isInteger(m.voltas) && m.voltas >= 100_000 ? m : null;
  } catch {
    return null;
  }
}

function temMeta(): boolean {
  try {
    return local()?.getItem(META) != null;
  } catch {
    return false;
  }
}

export type EstadoDoCofre = "sem-cofre" | "fechado" | "aberto";

export function estadoDoCofre(): EstadoDoCofre {
  // Um cabeçalho guardado que não vale (mexido para uma derivação fraca, ou torto) NÃO vira "sem cofre": o cofre fica fechado e
  // nada é gravado em claro por cima dele.
  if (!lerMeta()) return temMeta() ? "fechado" : "sem-cofre";
  return chave && memoria ? "aberto" : "fechado";
}

/** O PBKDF2 e o AES-GCM do cofre de antes: só para abrir o que já estava guardado. */
async function abrirDeAntes(frase: string, meta: MetaV1, bloco: string | null): Promise<Map<string, string>> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(frase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  const k = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: deB64(meta.sal) as BufferSource, iterations: meta.voltas }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  if (!bloco) {
    // Sem dados, a frase não tem como ser conferida: nada abre (melhor que aceitar qualquer frase).
    throw new Error("sem_dados");
  }
  const [iv, corpo] = bloco.split(".");
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) as BufferSource }, k, deB64(corpo) as BufferSource);
  return paraMapa(new TextDecoder().decode(claro));
}

function paraMapa(texto: string): Map<string, string> {
  const obj = JSON.parse(texto) as Record<string, unknown>;
  return new Map(Object.entries(obj).filter((e): e is [string, string] => typeof e[1] === "string" && e[0].startsWith(PRIVADO)));
}

async function cifrar(k: Uint8Array, mapa: Map<string, string>): Promise<string> {
  return paraBase64(await selar(k, "escola", new TextEncoder().encode(JSON.stringify(Object.fromEntries(mapa)))));
}

async function decifrar(k: Uint8Array, bloco: string): Promise<Map<string, string>> {
  const claro = await abrir(k, "escola", deBase64(bloco));
  if (!claro) throw new Error("frase_errada");
  return paraMapa(new TextDecoder().decode(claro));
}

/** Grava o mapa cifrado, um pedido depois do outro (o último vence). */
function persistir() {
  const m = memoria;
  if (!chave || !m) return;
  // Uma cópia da chave para esta gravação: fechar o cofre no meio zera a de cima, não esta (zerada no fim).
  const k = chave.slice();
  const copia = new Map(m);
  gravando = gravando.then(async () => {
    try {
      local()?.setItem(DADOS, await cifrar(k, copia));
    } catch {
      // armazenamento cheio ou bloqueado: fica na memória até a próxima gravação
    } finally {
      k.fill(0);
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
  const { chave: k, cabecalho } = await derivar(frase);
  const mapa = new Map<string, string>();
  for (let i = 0; i < armazem.length; i++) {
    const c = armazem.key(i);
    if (c?.startsWith(PRIVADO)) mapa.set(c, armazem.getItem(c) ?? "");
  }
  armazem.setItem(DADOS, await cifrar(k, mapa));
  armazem.setItem(META, JSON.stringify({ v: 2, a2id: cabecalho } satisfies Meta));
  for (const c of mapa.keys()) armazem.removeItem(c);
  chave = k;
  memoria = mapa;
  marcarUso();
  avisar();
  return true;
}

/**
 * Abre o cofre. Devolve false com a frase errada (a cifra autenticada recusa). O cofre de antes (PBKDF2) abre com a mesma frase e
 * é refeito na hora com o Argon2id (sal novo), sem perder nada.
 */
export async function abrirCofre(frase: string): Promise<boolean> {
  const meta = lerMeta();
  const armazem = local();
  const bloco = armazem?.getItem(DADOS) ?? null;
  if (!meta || !globalThis.crypto?.subtle) return false;
  let k: Uint8Array | null = null;
  try {
    if (meta.v === 2) {
      k = (await derivar(frase, meta.a2id)).chave;
      memoria = bloco ? await decifrar(k, bloco) : new Map();
    } else {
      const mapa = await abrirDeAntes(frase, meta, bloco);
      const novo = await derivar(frase);
      k = novo.chave;
      armazem?.setItem(DADOS, await cifrar(k, mapa));
      armazem?.setItem(META, JSON.stringify({ v: 2, a2id: novo.cabecalho } satisfies Meta));
      memoria = mapa;
    }
    chave = k;
    marcarUso();
    avisar();
    return true;
  } catch {
    k?.fill(0);
    memoria = null;
    return false;
  }
}

/** Fecha o cofre: a chave (zerada) e o que estava aberto saem da memória da aba. */
export function fecharCofre() {
  if (parado) clearTimeout(parado);
  parado = null;
  chave?.fill(0);
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
