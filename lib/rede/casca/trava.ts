// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A trava do app (onda R3, item 2.3: celular apreendido). Quem usa o chat no app escolhe uma senha do app; a casca cobre a tela e
// pede essa senha ao abrir, ao voltar do fundo e depois do tempo parado. Três coisas moram aqui, todas testadas no Node com o cofre
// falso (scripts/testar-r3-android-casca.mjs):
//
//   1. a senha do app: Argon2id da libsodium (lib/rede/cofre/argon.ts: 64 MiB, 3 passadas) → HKDF-SHA-256 do WebCrypto com o rótulo
//      `alumia/r3/casca/trava/v1` → um verificador de 32 bytes. O cabeçalho e o verificador ficam no localStorage EMBRULHADOS pela chave
//      do cofre do aparelho (Keystore/StrongBox no Android): copiar o armazenamento do app para outro aparelho não dá nem o
//      verificador para tentar senhas fora dele;
//   2. a senha de pânico (a da onda 11, lib/rede/seguranca/cofre-de-panico.ts): digitada na trava, abre a conta isca. A conferência
//      faz SEMPRE as duas derivações (a da trava e a do cofre de pânico), com ou sem cofre real e com ou sem trava: o tempo não diz
//      qual senha foi;
//   3. apagar tudo depois de X senhas erradas (desligado por padrão; entre 3 e 50 quando ligado, com aviso na tela). A tentativa é
//      CONTADA COMO ERRADA no cofre nativo ANTES da conferência (que leva perto de um segundo): desligar o aparelho ou matar o app no
//      meio não dá tentativa grátis. A senha certa (ou a de pânico) zera a contagem depois.
//
// Sem "@/" de propósito (roda no Node). Nada de primitiva feita à mão: Argon2id e HKDF de biblioteca, comparação em tempo constante.
import { derivar, cabecalhoValido, type CabecalhoA2id } from "../cofre/argon";
import { abrirCofre, lerCofre, cofreDeFachada, type ArmazemDoCofre, type ConteudoDoCofre } from "../seguranca/cofre-de-panico";
import type { Casca } from "./plataforma";

/** Os rótulos desta frente (a junção confere que não se repetem com os das outras). */
export const ROTULOS = { trava: "alumia/r3/casca/trava/v1" } as const;

/** Onde a trava fica no localStorage do app (não começa com "lucia": a saída rápida do site não a apaga sem querer). */
export const CHAVE_DA_TRAVA = "alumia-trava";
/** A finalidade do embrulho no cofre do aparelho (o embrulho da trava não abre como outra coisa). */
const FINALIDADE = "trava/v1";

/** O limite de senhas erradas: 0 = desligado (o padrão); ligado, entre 3 e 50. */
export const LIMITE = { desligado: 0, minimo: 3, maximo: 50 } as const;
export const limiteValido = (n: unknown): n is number => n === 0 || (Number.isInteger(n) && (n as number) >= LIMITE.minimo && (n as number) <= LIMITE.maximo);

/** O que a trava pede do cofre nativo (o plugin AlumiaCofre; um falso nos testes). */
export interface ContadorDeSenhas {
  /** Soma UMA tentativa errada e grava (antes de conferir). Devolve a contagem e o limite. */
  contarSenhaErrada(): Promise<{ erros: number; limite: number }>;
  zerarSenhas(): Promise<void>;
  apagarTudo(): Promise<void>;
}

const codificar = new TextEncoder();
const local = (): ArmazemDoCofre | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
const b64 = (b: Uint8Array): string => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const deB64 = (t: string): Uint8Array => {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};
/** Comparação de tamanho fixo sem atalho (o tempo não diz onde difere). */
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

async function verificadorDe(chave: Uint8Array): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", chave as Uint8Array<ArrayBuffer>, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: codificar.encode(ROTULOS.trava) }, base, 256);
  chave.fill(0);
  return new Uint8Array(bits);
}

interface Guardado {
  cabecalho: CabecalhoA2id;
  verificador: string;
}

/** Senha do app: pelo menos 6 caracteres (o teclado do celular; a contagem e o apagar cuidam de quem tenta muitas). */
export const senhaDoAppValida = (senha: unknown): senha is string => typeof senha === "string" && senha.normalize("NFC").length >= 6 && senha.length <= 256;

/** Define (ou troca) a senha do app. Grava embrulhada pelo cofre do aparelho. */
export async function definirSenhaDoApp(senha: string, c: Casca, armazem: ArmazemDoCofre | null = local()): Promise<void> {
  if (!senhaDoAppValida(senha)) throw Object.assign(new Error("senha_curta"), { code: "senha_curta" });
  if (!armazem) throw Object.assign(new Error("sem_armazenamento"), { code: "sem_armazenamento" });
  const { chave, cabecalho } = await derivar(senha);
  const guardado: Guardado = { cabecalho, verificador: b64(await verificadorDe(chave)) };
  const embrulhado = await c.embrulhar(FINALIDADE, codificar.encode(JSON.stringify(guardado)));
  armazem.setItem(CHAVE_DA_TRAVA, b64(embrulhado));
}

/** Há senha do app neste aparelho? (Sem senha, a casca pede para criar antes de mostrar o chat.) */
export function temSenhaDoApp(armazem: ArmazemDoCofre | null = local()): boolean {
  try {
    return Boolean(armazem?.getItem(CHAVE_DA_TRAVA));
  } catch {
    return false;
  }
}

async function lerGuardado(c: Casca, armazem: ArmazemDoCofre | null): Promise<Guardado | null> {
  try {
    const bruto = armazem?.getItem(CHAVE_DA_TRAVA);
    if (!bruto) return null;
    const aberto = await c.desembrulhar(FINALIDADE, deB64(bruto));
    if (!aberto) return null;
    const g = JSON.parse(new TextDecoder().decode(aberto)) as Partial<Guardado> | null;
    if (!g || !cabecalhoValido(g.cabecalho) || typeof g.verificador !== "string" || deB64(g.verificador).length !== 32) return null;
    return { cabecalho: g.cabecalho, verificador: g.verificador };
  } catch {
    return null;
  }
}

/** O cabeçalho que a conferência usa quando não há trava (só para gastar o mesmo tempo). */
const cabecalhoDeFachada = (): CabecalhoA2id => ({ v: 1, alg: "argon2id13", m: 64 * 1024, t: 3, p: 1, sal: b64(crypto.getRandomValues(new Uint8Array(16))) });

export type Conferencia = { tipo: "certa" } | { tipo: "panico"; isca: ConteudoDoCofre } | { tipo: "errada" };

/**
 * Confere a senha digitada na trava. Faz SEMPRE as duas derivações (trava e pânico), na mesma ordem. Sem trava guardada (ou com o
 * embrulho mexido, ou de outro aparelho), só a de pânico pode abrir. Nunca lança.
 */
export async function conferirSenha(senha: string, c: Casca, armazem: ArmazemDoCofre | null = local()): Promise<Conferencia> {
  try {
    const guardado = await lerGuardado(c, armazem);
    const { chave } = await derivar(senha, guardado?.cabecalho ?? cabecalhoDeFachada());
    const verificador = await verificadorDe(chave);
    const certa = guardado ? iguais(verificador, deB64(guardado.verificador)) : false;
    const isca = await abrirCofre(senha, lerCofre(armazem) ?? cofreDeFachada(), armazem);
    if (isca) return { tipo: "panico", isca };
    return certa ? { tipo: "certa" } : { tipo: "errada" };
  } catch {
    return { tipo: "errada" };
  }
}

export type Destravar = Conferencia | { tipo: "errada"; restam: number | null } | { tipo: "apagado" };

/**
 * Uma tentativa na trava: conta como errada ANTES (gravado no cofre nativo), confere, e então zera (certa ou pânico) ou, se a
 * contagem chegou ao limite ligado, apaga tudo. `restam` só aparece com o limite ligado.
 */
export async function destravar(senha: string, deps: { casca: Casca; contador: ContadorDeSenhas; armazem?: ArmazemDoCofre | null }): Promise<Destravar> {
  const { erros, limite } = await deps.contador.contarSenhaErrada();
  const r = await conferirSenha(senha, deps.casca, deps.armazem === undefined ? local() : deps.armazem);
  if (r.tipo !== "errada") {
    await deps.contador.zerarSenhas();
    return r;
  }
  if (limiteValido(limite) && limite > 0 && erros >= limite) {
    await deps.contador.apagarTudo();
    return { tipo: "apagado" };
  }
  return { tipo: "errada", restam: limiteValido(limite) && limite > 0 ? Math.max(0, limite - erros) : null };
}

/**
 * O relógio da trava automática: trava depois de `minutos` sem toque, e na hora em que o app vai para o fundo. Devolve as funções
 * para registrar um toque e para desligar. `agora` e `agendar` entram injetados nos testes.
 */
export function travaAutomatica(
  c: Casca,
  minutos: number,
  travar: () => void,
  relogio: { agora: () => number; agendar: (f: () => void, ms: number) => () => void } = {
    agora: () => Date.now(),
    agendar: (f, ms) => {
      const id = setInterval(f, ms);
      return () => clearInterval(id);
    },
  },
): { tocou: () => void; desligar: () => void } {
  const limiteMs = Math.max(1, Math.min(60, Math.floor(minutos))) * 60_000;
  let ultimo = relogio.agora();
  const tirarFundo = c.aoIrParaOFundo(travar);
  const tirarRelogio = relogio.agendar(() => {
    if (relogio.agora() - ultimo >= limiteMs) travar();
  }, 5_000);
  return {
    tocou: () => {
      ultimo = relogio.agora();
    },
    desligar: () => {
      tirarFundo();
      tirarRelogio();
    },
  };
}
