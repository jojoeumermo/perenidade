// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Cifra de ponta a ponta das conversas da equipe, sem frase combinada.
//
// Cada aparelho tem um par de chaves ECDH (curva P-256). A parte privada é criada no navegador como não exportável:
// nem o próprio site consegue lê-la, só usá-la. Cada conversa tem uma chave AES-GCM de 256 bits, trocada sempre que
// alguém sai (e de tempos em tempos); quem cria uma versão da chave a embrulha para cada aparelho de quem participa
// (ECDH entre os dois aparelhos, HKDF-SHA-256, AES-GCM). O banco guarda só a parte pública dos aparelhos, os embrulhos
// e o texto cifrado.
//
// Confiança. Cada conta tem uma chave de identidade (ECDSA P-256), criada no primeiro aparelho. Todo aparelho da conta
// leva um certificado: a assinatura, pela identidade, da chave pública ECDH dele. Os colegas só embrulham chaves para
// aparelhos cujo certificado confere com a identidade que eles conhecem da pessoa (guardada no próprio aparelho na
// primeira vez que a viram, e comparável pessoalmente pelo código de segurança). O servidor pode cadastrar um aparelho
// falso, mas não consegue assiná-lo: ninguém entrega chaves a ele. A identidade é repassada aos aparelhos aprovados
// (embrulhada, como as chaves de conversa), para qualquer um deles aprovar o próximo e assinar mensagens.
//
// Formatos (base64url, sem preenchimento):
//   mensagem     "c2.<versão>.<vetor de 12 bytes>.<texto cifrado>"
//   embrulho     "w1.<vetor de 12 bytes>.<32 bytes cifrados>"            (chave de conversa ou a identidade)
//   chave pública "B" + 86 caracteres (ponto da curva P-256, 65 bytes)   (ECDH e ECDSA usam o mesmo formato)
//   assinatura   86 caracteres (r e s, 64 bytes)
//   texto assinado, dentro do cifrado: "s1.<assinatura>.<texto>"
// Cada texto cifrado vai amarrado ao lugar de onde veio (conversa, versão e autor, ou canal do mural): o banco não
// consegue trocar uma mensagem de conversa ou de autor sem que ela pare de abrir.
//
// Este arquivo não depende do navegador além do WebCrypto, para poder ser testado no Node (scripts/testar-sigilo.mjs).

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SAL = encoder.encode("instituto-lucia:conversas:v2");

export const paraBase64 = (bytes: Uint8Array) => {
  let texto = "";
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const deBase64 = (texto: string) => {
  const cru = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(cru.length));
  for (let i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
};

const B64 = "[A-Za-z0-9_-]";
export const FORMATO_PUBLICA = new RegExp(`^B${B64}{86}$`);
export const FORMATO_ASSINATURA = new RegExp(`^${B64}{86}$`);
const FORMATO_EMBRULHO = new RegExp(`^w1\\.(${B64}{16})\\.(${B64}{64})$`);
const FORMATO_MENSAGEM = new RegExp(`^c2\\.([1-9][0-9]{0,6})\\.(${B64}{16})\\.(${B64}{23,})$`);
const FORMATO_ASSINADO = new RegExp(`^s1\\.(${B64}{86})\\.([\\s\\S]*)$`);

/** Bytes num ArrayBuffer comum: o que o WebCrypto aceita. */
type Bytes = Uint8Array<ArrayBuffer>;
const vetor = () => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));

export interface ParDoAparelho {
  privada: CryptoKey;
  /** Parte pública, em base64url (65 bytes, ponto sem compressão). */
  publica: string;
}

/** Par de chaves de um aparelho novo. A parte privada não sai do navegador. */
export async function novoAparelho(): Promise<ParDoAparelho> {
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const publica = paraBase64(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey)));
  return { privada: par.privateKey, publica };
}

/** Lê a parte pública de outro aparelho. O WebCrypto confere se o ponto está mesmo na curva. */
export async function lerPublica(publica: string): Promise<CryptoKey> {
  if (!FORMATO_PUBLICA.test(publica)) throw new Error("publica_invalida");
  return crypto.subtle.importKey("raw", deBase64(publica), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** A chave que só estes dois aparelhos calculam, para embrulhar uma versão específica de uma conversa específica. */
async function chaveEntre(minha: CryptoKey, outra: CryptoKey, contexto: string): Promise<CryptoKey> {
  const segredo = await crypto.subtle.deriveBits({ name: "ECDH", public: outra }, minha, 256);
  const base = await crypto.subtle.importKey("raw", segredo, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: SAL, info: encoder.encode(contexto) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** O que amarra um embrulho: conversa, versão e aparelho de destino. */
export const contextoDoEmbrulho = (conversa: string, versao: number, para: string) => `embrulho:${conversa}:${versao}:${para}`;
/** O que amarra a identidade repassada a um aparelho aprovado. */
export const contextoDaIdentidade = (usuario: string, para: string) => `identidade:${usuario}:${para}`;

/** Chave nova de conversa (fica só na memória; é exportável para poder ser embrulhada para os colegas). */
export function novaChave(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

/** Embrulha 32 bytes para outro aparelho: só ele (com a parte pública de quem embrulhou e o mesmo contexto) desembrulha. */
export async function embrulharBytes(crua: Bytes, minhaPrivada: CryptoKey, publicaDoOutro: string, contexto: string): Promise<string> {
  if (crua.length !== 32) throw new Error("tamanho_invalido");
  const entre = await chaveEntre(minhaPrivada, await lerPublica(publicaDoOutro), contexto);
  const iv = vetor();
  const fechada = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(contexto) }, entre, crua));
  return `w1.${paraBase64(iv)}.${paraBase64(fechada)}`;
}

/** Devolve os 32 bytes, ou null se o embrulho não foi feito para este aparelho (ou foi adulterado). */
export async function desembrulharBytes(embrulho: string, minhaPrivada: CryptoKey, publicaDeQuemEmbrulhou: string, contexto: string): Promise<Bytes | null> {
  const partes = FORMATO_EMBRULHO.exec(embrulho);
  if (!partes) return null;
  try {
    const entre = await chaveEntre(minhaPrivada, await lerPublica(publicaDeQuemEmbrulhou), contexto);
    const crua = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(partes[1]), additionalData: encoder.encode(contexto) }, entre, deBase64(partes[2])));
    return crua.length === 32 ? crua : null;
  } catch {
    return null;
  }
}

export async function embrulhar(chave: CryptoKey, minhaPrivada: CryptoKey, publicaDoOutro: string, contexto: string): Promise<string> {
  const crua = new Uint8Array(await crypto.subtle.exportKey("raw", chave));
  try {
    return await embrulharBytes(crua, minhaPrivada, publicaDoOutro, contexto);
  } finally {
    crua.fill(0);
  }
}

/** Devolve a chave da conversa, ou null se o embrulho não foi feito para este aparelho (ou foi adulterado). */
export async function desembrulhar(embrulho: string, minhaPrivada: CryptoKey, publicaDeQuemEmbrulhou: string, contexto: string): Promise<CryptoKey | null> {
  const crua = await desembrulharBytes(embrulho, minhaPrivada, publicaDeQuemEmbrulhou, contexto);
  if (!crua) return null;
  try {
    return await crypto.subtle.importKey("raw", crua, "AES-GCM", true, ["encrypt", "decrypt"]);
  } finally {
    crua.fill(0);
  }
}

/** Versão da chave com que uma mensagem foi cifrada; null para o que não está no formato atual. */
export function versaoDe(corpo: string): number | null {
  const partes = FORMATO_MENSAGEM.exec(corpo);
  return partes ? Number(partes[1]) : null;
}

const amarra = (contexto: string, versao: number) => encoder.encode(`${contexto}:v${versao}`);

export async function cifrar(chave: CryptoKey, versao: number, texto: string, contexto: string): Promise<string> {
  const iv = vetor();
  const fechado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: amarra(contexto, versao) }, chave, encoder.encode(texto));
  return `c2.${versao}.${paraBase64(iv)}.${paraBase64(new Uint8Array(fechado))}`;
}

/** Devolve o texto aberto, ou null se a chave não é a certa ou se a mensagem foi adulterada ou mudada de lugar. */
export async function decifrar(chave: CryptoKey, corpo: string, contexto: string): Promise<string | null> {
  const partes = FORMATO_MENSAGEM.exec(corpo);
  if (!partes) return null;
  try {
    return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(partes[2]), additionalData: amarra(contexto, Number(partes[1])) }, chave, deBase64(partes[3])));
  } catch {
    return null;
  }
}

/** Onde cada texto cifrado mora. */
export const contextoDaConversa = (conversa: string, autor: string) => `conversa:${conversa}:${autor}`;
export const contextoDoMural = (canal: string, autor: string) => `mural:${canal}:${autor}`;

// ───────────────────────────── Identidade e assinaturas (ECDSA P-256) ─────────────────────────────

export interface Identidade {
  /** Exportável de propósito: é repassada, embrulhada, aos outros aparelhos aprovados da mesma conta. */
  privada: CryptoKey;
  /** Parte pública, no mesmo formato da chave do aparelho. É o que os colegas guardam e comparam. */
  publica: string;
}

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const ASSINAR = { name: "ECDSA", hash: "SHA-256" } as const;

/** A chave de identidade de uma conta, criada no primeiro aparelho. */
export async function novaIdentidade(): Promise<Identidade> {
  const par = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]);
  return { privada: par.privateKey, publica: paraBase64(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey))) };
}

/** A parte pública de uma identidade, pronta para conferir assinaturas. */
export async function lerIdentidade(publica: string): Promise<CryptoKey> {
  if (!FORMATO_PUBLICA.test(publica)) throw new Error("publica_invalida");
  return crypto.subtle.importKey("raw", deBase64(publica), ECDSA, false, ["verify"]);
}

/** Os 32 bytes secretos da identidade, para embrulhar e repassar a outro aparelho da conta. */
export async function exportarIdentidade(identidade: Identidade): Promise<Bytes> {
  const jwk = await crypto.subtle.exportKey("jwk", identidade.privada);
  if (!jwk.d) throw new Error("identidade_nao_exportavel");
  return deBase64(jwk.d);
}

/** Monta a identidade de novo a partir dos 32 bytes secretos e da parte pública. */
export async function importarIdentidade(secreta: Bytes, publica: string): Promise<Identidade> {
  if (!FORMATO_PUBLICA.test(publica) || secreta.length !== 32) throw new Error("identidade_invalida");
  const ponto = deBase64(publica);
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: paraBase64(ponto.slice(1, 33)), y: paraBase64(ponto.slice(33, 65)), d: paraBase64(secreta), ext: true, key_ops: ["sign"] };
  const privada = await crypto.subtle.importKey("jwk", jwk, ECDSA, true, ["sign"]);
  // A parte pública informada precisa ser mesmo a desta chave: assina e confere.
  const prova = await assinar(privada, "prova");
  if (!(await verificar(publica, prova, "prova"))) throw new Error("identidade_invalida");
  return { privada, publica };
}

export async function assinar(privada: CryptoKey, texto: string): Promise<string> {
  return paraBase64(new Uint8Array(await crypto.subtle.sign(ASSINAR, privada, encoder.encode(texto))));
}

export async function verificar(publica: string, assinatura: string, texto: string): Promise<boolean> {
  if (!FORMATO_ASSINATURA.test(assinatura)) return false;
  try {
    return await crypto.subtle.verify(ASSINAR, await lerIdentidade(publica), deBase64(assinatura), encoder.encode(texto));
  } catch {
    return false;
  }
}

/** O que o certificado de um aparelho afirma: "esta chave ECDH é de um aparelho desta pessoa". */
export const contextoDoAparelho = (usuario: string, publica: string) => `aparelho:${usuario}:${publica}`;

/** A identidade certifica um aparelho da própria conta. */
export const certificarAparelho = (identidade: Identidade, usuario: string, publica: string) => assinar(identidade.privada, contextoDoAparelho(usuario, publica));

/** O certificado deste aparelho foi mesmo feito pela identidade desta pessoa? É isto que os colegas conferem antes de entregar chaves. */
export const aparelhoCertificado = (identidadePublica: string, usuario: string, publica: string, certificado: string | null) =>
  certificado ? verificar(identidadePublica, certificado, contextoDoAparelho(usuario, publica)) : Promise.resolve(false);

// ── Assinatura do autor em cada mensagem ──

const amarraDaAssinatura = (contexto: string, versao: number, texto: string) => `mensagem:${contexto}:v${versao}:${texto}`;

/** Prende o texto à identidade de quem escreve (e ao lugar onde a mensagem mora), antes de cifrar. */
export async function assinarTexto(identidade: Identidade, texto: string, contexto: string, versao: number): Promise<string> {
  return `s1.${await assinar(identidade.privada, amarraDaAssinatura(contexto, versao, texto))}.${texto}`;
}

export type Autoria = "ok" | "invalida" | "sem_assinatura" | "sem_identidade";

/** Separa o texto da assinatura e diz se a assinatura confere com a identidade conhecida do autor. */
export async function abrirTexto(aberto: string, identidadeDoAutor: string | null, contexto: string, versao: number): Promise<{ texto: string; autoria: Autoria }> {
  const partes = FORMATO_ASSINADO.exec(aberto);
  if (!partes) return { texto: aberto, autoria: "sem_assinatura" };
  const texto = partes[2];
  if (!identidadeDoAutor) return { texto, autoria: "sem_identidade" };
  return { texto, autoria: (await verificar(identidadeDoAutor, partes[1], amarraDaAssinatura(contexto, versao, texto))) ? "ok" : "invalida" };
}

// ───────────────────────────── Aprovação de aparelho novo ─────────────────────────────
//
// O aparelho novo mostra um código de oito números (e um QR). Quem aprova, num aparelho já aprovado, digita o código (ou
// lê o QR). A chave pública do aparelho novo chega ao aprovador cifrada com uma chave derivada do código: o servidor, que
// não sabe o código, não consegue trocar a chave por uma dele. Quem quisesse forçar o código precisaria testar até cem
// milhões de possibilidades, cada uma com uma derivação lenta, dentro do prazo de validade do pedido.

const DIGITOS_DO_CODIGO = 8;
const RODADAS_DO_CODIGO = 300_000;

export function novoCodigo(): string {
  const numeros = crypto.getRandomValues(new Uint32Array(DIGITOS_DO_CODIGO));
  return Array.from(numeros, (n) => String(n % 10)).join("");
}

export const FORMATO_CODIGO = new RegExp(`^[0-9]{${DIGITOS_DO_CODIGO}}$`);

async function chaveDoSegredo(segredo: string, sal: Bytes, rodadas: number, finalidade: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(`${finalidade}:${segredo}`), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: rodadas }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export interface Selado {
  sal: string;
  iv: string;
  cifrado: string;
}

async function selar(segredo: string, rodadas: number, finalidade: string, dados: Uint8Array<ArrayBuffer>, usuario: string): Promise<Selado> {
  const sal = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = vetor();
  const chave = await chaveDoSegredo(segredo, sal, rodadas, finalidade);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(`${finalidade}:${usuario}`) }, chave, dados));
  return { sal: paraBase64(sal), iv: paraBase64(iv), cifrado: paraBase64(cifrado) };
}

async function abrirSelado(segredo: string, rodadas: number, finalidade: string, selado: Selado, usuario: string): Promise<Bytes | null> {
  try {
    const chave = await chaveDoSegredo(segredo, deBase64(selado.sal), rodadas, finalidade);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(selado.iv), additionalData: encoder.encode(`${finalidade}:${usuario}`) }, chave, deBase64(selado.cifrado)));
  } catch {
    return null;
  }
}

/** O aparelho novo sela a própria chave pública com o código que mostra na tela. */
export const selarPedido = (codigo: string, usuario: string, publica: string) => selar(codigo, RODADAS_DO_CODIGO, "pedido", encoder.encode(publica), usuario);

/** Quem aprova abre o pedido com o código digitado: devolve a chave pública do aparelho novo, ou null se o código não serve. */
export async function abrirPedido(codigo: string, usuario: string, pedido: Selado): Promise<string | null> {
  if (!FORMATO_CODIGO.test(codigo)) return null;
  const bytes = await abrirSelado(codigo, RODADAS_DO_CODIGO, "pedido", pedido, usuario);
  if (!bytes) return null;
  const publica = decoder.decode(bytes);
  return FORMATO_PUBLICA.test(publica) ? publica : null;
}

/** O conteúdo do QR que o aparelho novo mostra: o código e a chave pública, para quem lê nem precisar digitar. */
export const qrDoPedido = (codigo: string, publica: string) => `lucia:aparelho:${codigo}:${publica}`;
export function lerQrDoPedido(texto: string): { codigo: string; publica: string } | null {
  const partes = /^lucia:aparelho:([0-9]{8}):(B[A-Za-z0-9_-]{86})$/.exec(texto.trim());
  return partes ? { codigo: partes[1], publica: partes[2] } : null;
}

// ───────────────────────────── Código de segurança (por par de pessoas) ─────────────────────────────
//
// Sessenta números derivados das duas identidades, iguais nas duas telas. As pessoas comparam pessoalmente (ou por
// um canal em que se reconheçam) e marcam "verificado". Se a identidade de uma delas mudar, o código muda.

const RODADAS_DA_IMPRESSAO = 5200;

async function metadeDoCodigo(identidade: string): Promise<string> {
  let bytes: Uint8Array<ArrayBuffer> = encoder.encode(`lucia:seguranca:1:${identidade}`);
  for (let i = 0; i < RODADAS_DA_IMPRESSAO; i++) bytes = new Uint8Array(await crypto.subtle.digest("SHA-512", bytes));
  let saida = "";
  for (let i = 0; i < 6; i++) {
    // Cinco bytes cabem num número inteiro exato (menos de 2^53): sem precisar de BigInt.
    let numero = 0;
    for (const byte of bytes.slice(i * 5, i * 5 + 5)) numero = numero * 256 + byte;
    saida += String(numero % 100000).padStart(5, "0");
  }
  return saida;
}

/** O código de segurança entre duas pessoas: as duas metades, em ordem fixa, para dar o mesmo nos dois lados. */
export async function codigoDeSeguranca(identidadeA: string, identidadeB: string): Promise<string> {
  const [a, b] = await Promise.all([metadeDoCodigo(identidadeA), metadeDoCodigo(identidadeB)]);
  return [a, b].sort().join("");
}

/** "12345 67890 …", doze grupos de cinco, para ler em voz alta. */
export const codigoEmGrupos = (codigo: string) => codigo.replace(/(.{5})/g, "$1 ").trim();
export const qrDaSeguranca = (codigo: string) => `lucia:seguranca:${codigo}`;
export function lerQrDaSeguranca(texto: string): string | null {
  const partes = /^lucia:seguranca:([0-9]{60})$/.exec(texto.trim());
  return partes ? partes[1] : null;
}

// ───────────────────────────── Cópia de recuperação ─────────────────────────────
//
// A identidade (e as chaves das conversas que este aparelho conhece) ficam guardadas no banco, cifradas com uma chave
// de recuperação sorteada aqui e mostrada uma única vez. Sem ela, quem perde todos os aparelhos perde a identidade (os
// colegas veem "a chave de segurança mudou") e o histórico. O banco guarda só o cifrado; a chave nunca sai do aparelho.

const RODADAS_DA_RECUPERACAO = 100_000;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0, O, 1 e I, para não confundir ao anotar

/** Trinta e dois caracteres sorteados (160 bits), em oito grupos de quatro. */
export function novaChaveDeRecuperacao(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
  const letras = Array.from(bytes, (byte) => ALFABETO[byte % 32]).join("");
  return letras.replace(/(.{4})/g, "$1-").slice(0, -1);
}

/** Aceita a chave anotada com ou sem traços, em maiúsculas ou minúsculas. */
const limparChave = (chave: string) => chave.toUpperCase().replace(/[^A-Z2-9]/g, "");
export const chaveDeRecuperacaoValida = (chave: string) => /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{32}$/.test(limparChave(chave));

export interface Copia {
  identidade: { secreta: string; publica: string };
  chaves: { conversa: string; versao: number; chave: string }[];
  quando: string;
}

export async function selarCopia(chaveDeRecuperacao: string, usuario: string, copia: Copia): Promise<Selado> {
  return selar(limparChave(chaveDeRecuperacao), RODADAS_DA_RECUPERACAO, "recuperacao", encoder.encode(JSON.stringify(copia)), usuario);
}

export async function abrirCopia(chaveDeRecuperacao: string, usuario: string, selado: Selado): Promise<Copia | null> {
  const bytes = await abrirSelado(limparChave(chaveDeRecuperacao), RODADAS_DA_RECUPERACAO, "recuperacao", selado, usuario);
  if (!bytes) return null;
  try {
    const copia = JSON.parse(decoder.decode(bytes)) as Copia;
    return copia && typeof copia === "object" && copia.identidade && FORMATO_PUBLICA.test(copia.identidade.publica) && Array.isArray(copia.chaves) ? copia : null;
  } catch {
    return null;
  }
}

/** Os 32 bytes de uma chave de conversa, para ir na cópia. */
export async function exportarChave(chave: CryptoKey): Promise<string> {
  return paraBase64(new Uint8Array(await crypto.subtle.exportKey("raw", chave)));
}
export async function importarChave(crua: string): Promise<CryptoKey | null> {
  try {
    const bytes = deBase64(crua);
    if (bytes.length !== 32) return null;
    return await crypto.subtle.importKey("raw", bytes, "AES-GCM", true, ["encrypt", "decrypt"]);
  } catch {
    return null;
  }
}
