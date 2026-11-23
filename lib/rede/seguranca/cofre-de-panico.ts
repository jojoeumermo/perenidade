// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cofre da senha de pânico (onda 11, frente 11G): o que fica SÓ NESTE APARELHO para a senha de pânico funcionar na entrada.
// Guarda, cifrados, o e-mail e a senha da conta isca (uma conta separada de verdade, criada pela porta de entrada) e, ao lado, um
// verificador da senha de pânico. Nada disto vai ao servidor; o banco não sabe que a isca e a conta real são da mesma pessoa.
//
// A criptografia é de biblioteca, nada feito à mão (onda R2, item 1.6; lib/rede/cofre/argon.ts):
//   Argon2id da libsodium (64 MiB, 3 passadas, 1 linha, sal aleatório de 16 bytes) sobre a senha de pânico → um segredo de 256 bits;
//   HKDF-SHA-256 do navegador desse segredo → (a) a chave AES-GCM de 256 bits que cifra o conteúdo, (b) o verificador de 256 bits.
// O cofre do formato de antes (v1: PBKDF2-SHA-256 com 600 mil voltas) é REGRAVADO como v2 sem mexer nos bytes (os campos são os
// mesmos: sal, iv, verificador e cifra), e quem abre tenta SEMPRE as duas derivações (Argon2id e o PBKDF2 de antes), com ou sem
// cofre real: assim o armazenamento não diz se o cofre é de antes (ou seja, de verdade) e a entrada gasta o mesmo tempo em todo
// aparelho. O cofre de antes que abrir com a senha de pânico é fechado de novo com o Argon2id na mesma hora. A tentativa pelo
// PBKDF2 sai numa versão futura, quando nenhum cofre de antes sobrar (pendência registrada).
// O verificador deixa a entrada saber, sem decifrar, se a senha digitada é a de pânico; a cifra AES-GCM (com o rótulo da versão
// como dado associado) recusa qualquer troca no conteúdo guardado.
//
// O cofre fica no localStorage com uma chave que NÃO começa com "lucia": a saída rápida do site (lib/modo-seguro.ts) e o botão de
// pânico apagam tudo o que começa com "lucia", e a senha de pânico tem de continuar valendo depois deles.
//
// Todo aparelho que entra na Alumia tem um cofre: quem não ativou a senha de pânico recebe um COFRE DE FACHADA, da mesma forma e
// do mesmo tamanho, com bytes aleatórios que nenhuma senha abre (garantirCofre). Assim, ter a chave "alumia-cofre" não diz nada.
// Nada fica em claro que diga de que conta é o cofre: nem o id da isca, nem resumo dele. Desativar a senha de pânico troca o cofre
// por um de fachada novo.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-alumia-o11-panico.mjs, scripts/testar-r2-senhas.mjs).
import { ARGON2ID } from "../cifra/sodio";
import { derivar } from "../cofre/argon";

/** A chave do cofre no localStorage deste aparelho. */
export const CHAVE_DO_COFRE = "alumia-cofre";

/** As voltas do PBKDF2 do formato de antes (v1). Só para abrir o cofre de antes, que é fechado de novo com o Argon2id. */
export const VOLTAS_DO_COFRE = 600_000;

const ROTULO = "alumia-cofre/v1";
/** Os valores do Argon2id de todo cofre (KiB e passadas), os de lib/rede/cifra/sodio.ts. */
const M = ARGON2ID.memoria / 1024;
const T = ARGON2ID.passadas;
const codificar = new TextEncoder();
const decodificar = new TextDecoder();

/** O que vai cifrado no cofre. */
export interface ConteudoDoCofre {
  /** O e-mail da conta isca (a pessoa informou; o e-mail continua obrigatório). */
  email: string;
  /** A senha da conta isca: gerada no aparelho, longa e aleatória. A pessoa nunca precisa saber. */
  senha: string;
  /** O codinome escolhido para a isca. */
  codinome: string;
  /** Quando o cofre foi fechado (ISO). */
  criada: string;
}

/** O cofre como fica guardado: tudo em base64, nada legível sem a senha de pânico. */
export interface Cofre {
  /** 2: Argon2id (ou um cofre de antes regravado sem mexer nos bytes: quem abre tenta os dois). */
  v: 2;
  /** Os valores do Argon2id (KiB, passadas, linhas): os mesmos em todo cofre, de verdade ou de fachada. */
  m: number;
  t: number;
  p: 1;
  sal: string;
  iv: string;
  verificador: string;
  cifra: string;
}

/** O cofre do formato de antes (PBKDF2), como ainda pode estar guardado num aparelho. */
interface CofreV1 {
  v: 1;
  voltas: number;
  sal: string;
  iv: string;
  verificador: string;
  cifra: string;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("sem_cripto");
  return s;
}

const paraBase64 = (bytes: Uint8Array): string => {
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b);
  return btoa(texto);
};
const deBase64 = (texto: string): Uint8Array<ArrayBuffer> => {
  const bruto = atob(texto);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
};
const aleatorios = (n: number): Uint8Array<ArrayBuffer> => globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));

/** A mesma senha escrita de jeitos diferentes (acento composto ou não) vira a mesma sequência de bytes. */
const bytesDaSenha = (senha: string) => codificar.encode(senha.normalize("NFC"));

/** HKDF → chave do conteúdo e verificador, a partir do segredo de 256 bits (Argon2id, ou o PBKDF2 do cofre de antes). */
async function doSegredo(segredo: Uint8Array<ArrayBuffer>): Promise<{ chave: CryptoKey; verificador: Uint8Array }> {
  const s = subtle();
  const mestre = await s.importKey("raw", segredo, "HKDF", false, ["deriveBits", "deriveKey"]);
  segredo.fill(0);
  const vazio = new Uint8Array(new ArrayBuffer(0));
  const chave = await s.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: vazio, info: codificar.encode(`${ROTULO}/chave`) },
    mestre,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const verificador = new Uint8Array(await s.deriveBits({ name: "HKDF", hash: "SHA-256", salt: vazio, info: codificar.encode(`${ROTULO}/verificador`) }, mestre, 256));
  return { chave, verificador };
}

/** Argon2id (lib/rede/cofre/argon.ts) → segredo. */
async function pelaArgon(senha: string, sal: Uint8Array<ArrayBuffer>): Promise<{ chave: CryptoKey; verificador: Uint8Array }> {
  const { chave } = await derivar(senha, { v: 1, alg: "argon2id13", m: M, t: T, p: 1, sal: paraBase64(sal) });
  const segredo = new Uint8Array(new ArrayBuffer(32));
  segredo.set(chave);
  chave.fill(0);
  return doSegredo(segredo);
}

/** O PBKDF2 do cofre de antes → segredo. Só para abrir o que já estava guardado. */
async function peloPbkdf2(senha: string, sal: Uint8Array<ArrayBuffer>): Promise<{ chave: CryptoKey; verificador: Uint8Array }> {
  const s = subtle();
  const base = await s.importKey("raw", bytesDaSenha(senha), "PBKDF2", false, ["deriveBits"]);
  return doSegredo(new Uint8Array(await s.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: VOLTAS_DO_COFRE }, base, 256)));
}

/** Compara sem parar no primeiro byte diferente. */
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

/** Fecha o conteúdo num cofre novo, com o Argon2id (sal e iv novos a cada vez). */
export async function fecharCofre(senhaDePanico: string, conteudo: ConteudoDoCofre): Promise<Cofre> {
  const sal = aleatorios(16);
  const iv = aleatorios(12);
  const { chave, verificador } = await pelaArgon(senhaDePanico, sal);
  const cifra = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: codificar.encode(ROTULO) }, chave, codificar.encode(JSON.stringify(conteudo)));
  return { v: 2, m: M, t: T, p: 1, sal: paraBase64(sal), iv: paraBase64(iv), verificador: paraBase64(verificador), cifra: paraBase64(new Uint8Array(cifra)) };
}

/** Abre a cifra com a chave cujo verificador bateu. */
async function decifrar(chave: CryptoKey, cofre: Cofre): Promise<ConteudoDoCofre | null> {
  const claro = await subtle().decrypt({ name: "AES-GCM", iv: deBase64(cofre.iv), additionalData: codificar.encode(ROTULO) }, chave, deBase64(cofre.cifra));
  const c = JSON.parse(decodificar.decode(claro)) as Partial<ConteudoDoCofre> | null;
  if (!c || typeof c.email !== "string" || typeof c.senha !== "string" || typeof c.codinome !== "string" || typeof c.criada !== "string") return null;
  return { email: c.email, senha: c.senha, codinome: c.codinome, criada: c.criada };
}

/**
 * Abre o cofre com a senha digitada. Senha que não é a de pânico (nenhum verificador bate), cofre mexido (a cifra recusa) ou
 * conteúdo torto: nulo. Nunca lança. Faz SEMPRE as duas derivações (Argon2id e o PBKDF2 do cofre de antes), na mesma ordem, com
 * ou sem cofre real: o tempo não diz se o cofre é de antes, de agora ou de fachada. Se abrir pelo PBKDF2 (o cofre de antes), fecha
 * de novo com o Argon2id e grava no armazenamento (`armazem`), sem perder nada.
 */
export async function abrirCofre(senha: string, cofre: Cofre, armazem: ArmazemDoCofre | null = local()): Promise<ConteudoDoCofre | null> {
  try {
    if (!cofreValido(cofre)) return null;
    const sal = deBase64(cofre.sal);
    const guardado = deBase64(cofre.verificador);
    const novo = await pelaArgon(senha, sal);
    const antigo = await peloPbkdf2(senha, sal);
    const peloNovo = iguais(novo.verificador, guardado);
    const peloAntigo = iguais(antigo.verificador, guardado);
    if (!peloNovo && !peloAntigo) return null;
    const conteudo = await decifrar(peloNovo ? novo.chave : antigo.chave, cofre);
    if (conteudo && !peloNovo && armazem) {
      try {
        guardarCofre(await fecharCofre(senha, conteudo), armazem);
      } catch {
        // sem armazenamento: continua o de antes, que a próxima entrada converte
      }
    }
    return conteudo;
  } catch {
    return null;
  }
}

const b64Valido = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 4096 && /^[A-Za-z0-9+/]+=*$/.test(v);

/** A forma de um cofre guardado (o que vier diferente disto é tratado como "sem cofre"). */
export function cofreValido(x: unknown): x is Cofre {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  // Os valores do Argon2id são os de hoje: ninguém força uma derivação fraca (nem uma que trave o aparelho) mexendo no armazenamento.
  return c.v === 2 && c.m === M && c.t === T && c.p === 1 && b64Valido(c.sal) && b64Valido(c.iv) && b64Valido(c.verificador) && b64Valido(c.cifra);
}

/** O cofre do formato de antes, com as voltas de verdade (os de teste, com menos voltas, não são convertidos). */
function cofreV1(x: unknown): x is CofreV1 {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return c.v === 1 && c.voltas === VOLTAS_DO_COFRE && b64Valido(c.sal) && b64Valido(c.iv) && b64Valido(c.verificador) && b64Valido(c.cifra);
}

/** Só os campos do cofre (a marca em claro das versões antigas fica para trás). O de antes vira v2 sem mexer nos bytes. */
const soOCofre = (c: Cofre | CofreV1): Cofre => ({ v: 2, m: M, t: T, p: 1, sal: c.sal, iv: c.iv, verificador: c.verificador, cifra: c.cifra });

/**
 * Um cofre de fachada: a mesma forma de um cofre de verdade (os mesmos valores, sal, iv e verificador do mesmo tamanho, e uma cifra
 * do tamanho de uma isca comum), com bytes aleatórios. Nenhuma senha abre (o verificador não bate, e a cifra não é de nada).
 */
export function cofreDeFachada(): Cofre {
  // Uma isca de verdade cifra uns 120 a 180 bytes (e-mail, senha de 32 letras, codinome e data) mais os 16 do AES-GCM.
  const [sorteio] = aleatorios(1);
  const tamanho = 136 + (sorteio % 64);
  return { v: 2, m: M, t: T, p: 1, sal: paraBase64(aleatorios(16)), iv: paraBase64(aleatorios(12)), verificador: paraBase64(aleatorios(32)), cifra: paraBase64(aleatorios(tamanho)) };
}

/** O mínimo de um armazenamento (localStorage, ou um falso nos testes). */
export type ArmazemDoCofre = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const local = (): ArmazemDoCofre | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** O cofre deste aparelho, ou nulo. Nunca lança. */
export function lerCofre(armazem: ArmazemDoCofre | null = local()): Cofre | null {
  try {
    const bruto = armazem?.getItem(CHAVE_DO_COFRE);
    if (!bruto) return null;
    const c = JSON.parse(bruto) as unknown;
    return cofreValido(c) || cofreV1(c) ? soOCofre(c) : null;
  } catch {
    return null;
  }
}

/** Guarda o cofre neste aparelho. Lança se o armazenamento recusar (a tela diz que não deu). */
export function guardarCofre(cofre: Cofre, armazem: ArmazemDoCofre | null = local()): void {
  if (!armazem) throw new Error("sem_armazenamento");
  armazem.setItem(CHAVE_DO_COFRE, JSON.stringify(soOCofre(cofre)));
}

/**
 * Todo aparelho que entra na Alumia tem um cofre: sem nenhum (ou com um torto), grava um de fachada; com a marca em claro das
 * versões antigas, ou no formato de antes (v1), grava de novo sem ela e como v2 (os mesmos bytes: de verdade ou de fachada, todo
 * cofre fica igual por fora). Devolve o cofre que ficou. Nunca lança.
 */
export function garantirCofre(armazem: ArmazemDoCofre | null = local()): Cofre | null {
  try {
    if (!armazem) return null;
    const bruto = armazem.getItem(CHAVE_DO_COFRE);
    const atual = lerCofre(armazem);
    if (atual && bruto === JSON.stringify(atual)) return atual;
    const cofre = atual ?? cofreDeFachada();
    armazem.setItem(CHAVE_DO_COFRE, JSON.stringify(cofre));
    return cofre;
  } catch {
    return null;
  }
}

/** Desativa a senha de pânico: o cofre dá lugar a um de fachada novo (a chave continua lá, como em todo aparelho). Nunca lança. */
export function apagarCofre(armazem: ArmazemDoCofre | null = local()): void {
  try {
    armazem?.setItem(CHAVE_DO_COFRE, JSON.stringify(cofreDeFachada()));
  } catch {
    // sem armazenamento
  }
}

/**
 * A senha da conta isca: 24 bytes aleatórios em base64url (32 letras), com minúscula, maiúscula e número (a regra de senha do site,
 * lib/forca-senha.ts, que a porta confere no servidor).
 */
export function gerarSenhaDaIsca(): string {
  for (;;) {
    const senha = paraBase64(aleatorios(24)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha) && /\d/.test(senha)) return senha;
  }
}
