// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem mandou cada mensagem da sala de jogo (T33). O canal (Realtime ou BroadcastChannel) entrega o que chega, e o campo
// "de" é o próprio remetente que escreve: sem conferência, qualquer pessoa na sala se passava pelo anfitrião (expulsar,
// começar partida com texto qualquer) ou por outro jogador. Agora cada aba sorteia um par de chaves ECDSA P-256 ao entrar
// (só na memória, some ao fechar; não identifica a pessoa nem o aparelho), anuncia a chave pública na presença do canal e
// assina cada mensagem. Quem recebe confere com a chave que viu primeiro para aquele id (a primeira vale: outra aba que
// anuncie o mesmo id com outra chave é ignorada) e recusa o que não confere, o que vem velho ou repetido.
// Sem "@/": roda no teste em Node (scripts/testar-jogos-em-grupo.mjs), que tem a mesma Web Crypto.

export interface ChavesDaAba {
  privada: CryptoKey;
  /** A chave pública, crua (65 bytes), em base64url: 87 caracteres. */
  publica: string;
}

export const FORMATO_DA_CHAVE = /^[A-Za-z0-9_-]{87}$/;
const FORMATO_DA_ASSINATURA = /^[A-Za-z0-9_-]{86}$/;

const paraTexto = (bytes: ArrayBuffer | Uint8Array): string => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const paraBytes = (texto: string): Uint8Array<ArrayBuffer> => {
  const s = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  const b = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};
const ALGORITMO = { name: "ECDSA", namedCurve: "P-256" } as const;
const ASSINAR = { name: "ECDSA", hash: "SHA-256" } as const;

/** O par de chaves desta aba. A privada não sai da memória (não exportável). Sem Web Crypto (página sem https), null. */
export async function novasChaves(): Promise<ChavesDaAba | null> {
  try {
    const par = await crypto.subtle.generateKey(ALGORITMO, false, ["sign", "verify"]);
    return { privada: par.privateKey, publica: paraTexto(await crypto.subtle.exportKey("raw", par.publicKey)) };
  } catch {
    return null;
  }
}

/** O texto exato que se assina: a sala, o tipo, quem diz mandar, o número da mensagem e o conteúdo. */
export function textoAssinado(codigo: string, tipo: string, de: string, n: number, carga: unknown): string {
  return `lucia-jogo-v1|${codigo}|${tipo}|${de}|${n}|${JSON.stringify(carga)}`;
}

export async function assinar(chaves: ChavesDaAba, texto: string): Promise<string> {
  return paraTexto(await crypto.subtle.sign(ASSINAR, chaves.privada, new TextEncoder().encode(texto)));
}

const importadas = new Map<string, Promise<CryptoKey | null>>();
function importar(publica: string): Promise<CryptoKey | null> {
  if (!importadas.has(publica)) {
    if (importadas.size > 200) importadas.clear();
    importadas.set(publica, crypto.subtle.importKey("raw", paraBytes(publica), ALGORITMO, false, ["verify"]).catch(() => null));
  }
  return importadas.get(publica)!;
}

/** A assinatura confere com esta chave pública? Qualquer coisa fora do formato: não. */
export async function confere(publica: string | undefined, texto: string, assinatura: unknown): Promise<boolean> {
  if (!publica || !FORMATO_DA_CHAVE.test(publica) || typeof assinatura !== "string" || !FORMATO_DA_ASSINATURA.test(assinatura)) return false;
  const chave = await importar(publica);
  if (!chave) return false;
  try {
    return await crypto.subtle.verify(ASSINAR, chave, paraBytes(assinatura), new TextEncoder().encode(texto));
  } catch {
    return false;
  }
}

/**
 * A chave de cada id, fixada na primeira vez que aparece na presença, e o último número de mensagem aceito de cada id (o
 * que vier com número igual ou menor é repetição: recusado).
 */
export function criarConferencia() {
  const fixadas = new Map<string, string>();
  const ultimo = new Map<string, number>();
  return {
    /** Anota as chaves da presença. Quem já tinha chave fica com a primeira. */
    anotar(lista: { id: string; chave?: string }[]) {
      for (const p of lista) if (p.chave && FORMATO_DA_CHAVE.test(p.chave) && !fixadas.has(p.id)) fixadas.set(p.id, p.chave);
    },
    chaveDe: (id: string) => fixadas.get(id),
    /** Confere assinatura e ordem; só então marca o número como usado. */
    async aceitar(codigo: string, tipo: string, de: string, n: unknown, carga: unknown, assinatura: unknown): Promise<boolean> {
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n <= (ultimo.get(`${tipo}:${de}`) ?? 0)) return false;
      if (!(await confere(fixadas.get(de), textoAssinado(codigo, tipo, de, n, carga), assinatura))) return false;
      if (n <= (ultimo.get(`${tipo}:${de}`) ?? 0)) return false;
      ultimo.set(`${tipo}:${de}`, n);
      return true;
    },
  };
}
