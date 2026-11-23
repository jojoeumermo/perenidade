// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A denúncia com prova (message franking, onda R2, item 2.6), o lado do aparelho e o que o aparelho e o servidor dividem. Cada
// mensagem cifrada leva um compromisso; quem denuncia escolhe os trechos, e o servidor confere que aquele texto exato passou por
// aquela caixa, naquele dia, com o passe de depósito de quem escreveu, sem ter lido nada antes. Só HMAC-SHA-256 e SHA-256 da
// @noble/hashes e Ed25519 da @noble/curves (auditadas): nenhuma primitiva feita aqui. O desenho é o do Facebook (2016), adaptado
// às caixas anônimas.
//
// Os bytes são OS MESMOS da rota das caixas (a marca, no depósito) e da conversa a dois (o compromisso, ao mandar): junção simples
// de rótulo, resumos e conteúdo, sem separador (o rótulo e os resumos têm tamanho fixo). O teste scripts/testar-r2-franquia.mjs
// confere com o código das duas pontas.
//   kf    = 32 bytes sorteados POR CÓPIA da mensagem (vai DENTRO do cifrado)
//   id_h  = SHA-256("alumia/r2/caixa" ‖ id da caixa)
//   pd_h  = SHA-256("alumia/r2/passe-deposito" ‖ passe de depósito APRESENTADO no depósito)
//   c     = HMAC-SHA-256(kf, "alumia/r2/franquia/v1" ‖ id_h ‖ conteúdo sem kf)                       (vai FORA, no depósito)
//   K_dia = HKDF-SHA-256(segredo, sal vazio, info = "alumia/r2/marca/chave/v1|" ‖ dia, 32)              (só no servidor do site)
//   t     = HMAC-SHA-256(K_dia, "alumia/r2/marca/v2" ‖ c ‖ id_h ‖ pd_h ‖ dia)                         (o servidor grava com o pacote)
//
// A marca prende o resumo do passe que veio no depósito. Depósito com passe errado (ou em caixa que nem existe) continua recebendo
// uma marca, para o bloqueio não se denunciar, mas presa a OUTRO pd_h. A autoria vem da DECLARAÇÃO de quem escreve: a identidade
// da conta assina "o passe de depósito pd_h da caixa id_h é meu, conta X" (lib/rede/chat/r2/certificados.ts) e manda a quem lê,
// dentro da sessão cifrada, ao anunciar a caixa. Na denúncia, o servidor confere a assinatura contra as identidades da conta X no
// registro público das chaves e exige o MESMO pd_h dentro da marca. Quem só tem uma conta, sem caixa nenhuma, não forja nada.
//
// O QUE A PROVA DIZ, sem rodeio: "este texto exato estava numa mensagem depositada nesta caixa, neste dia, com o passe que a conta X
// declarou seu". Limites: (1) quem lê a caixa não tem o passe de quem escreve (cada pessoa sorteia o SEU passe de escrita e entrega
// à outra só o resumo), então não consegue depositar ali em nome da outra; (2) duas contas em conluio (quem escreve entrega o passe
// a quem lê) atribuem a si mesmas o que quiserem, nunca a uma terceira; (3) grupos e posts cifrados não têm declaração por conta (o
// passe da caixa da época é de todos os membros): a denúncia de grupo vai SEM prova de autoria (a rota recusa como "com prova").
//
// Sem "@/" de propósito: os testes rodam este arquivo direto no Node.
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

/** Os rótulos que esta peça usa. São os das caixas (lib/rede/caixas/base.ts): mesmos textos, mesmos bytes. */
export const ROTULOS_DA_FRANQUIA = {
  caixa: "alumia/r2/caixa",
  franquia: "alumia/r2/franquia/v1",
  passeDeposito: "alumia/r2/passe-deposito",
  marca: "alumia/r2/marca/v2",
  marcaChave: "alumia/r2/marca/chave/v1",
} as const;

/** O teto de um trecho denunciado (o mesmo do banco: rede_franquia_prova_ok). */
export const LIMITE_DO_TRECHO = 1000;
/** Quantos trechos uma denúncia leva, no máximo (o mesmo do banco). */
export const TRECHOS_POR_DENUNCIA = 10;
/** O maior conteúdo de uma mensagem (o maior tamanho fixo das caixas dos grupos). */
export const MAIOR_CONTEUDO = 131072;
/** Por quantos dias uma mensagem pode ser denunciada com prova (o servidor refaz a chave do dia até esse prazo). */
export const DIAS_DA_PROVA = 90;

const codificador = new TextEncoder();
export const bytesDe = (t: string): Uint8Array => codificador.encode(t);

/** Junta pedaços de bytes (o mesmo `juntar` das caixas e da conversa a dois). */
export function juntar(...partes: Uint8Array[]): Uint8Array {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

/** Comparação de bytes em tempo constante (para o mesmo tamanho): nunca para no primeiro byte diferente. */
export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** O resumo de uma caixa (id_h), como o banco das caixas guarda: SHA-256("alumia/r2/caixa" ‖ id). */
export const resumoDaCaixa = (id: Uint8Array): Uint8Array => sha256(juntar(bytesDe(ROTULOS_DA_FRANQUIA.caixa), id));
/** O resumo de um passe de depósito (pd_h), como o banco das caixas guarda: SHA-256("alumia/r2/passe-deposito" ‖ pd). */
export const resumoDoPasseDeDeposito = (pd: Uint8Array): Uint8Array => sha256(juntar(bytesDe(ROTULOS_DA_FRANQUIA.passeDeposito), pd));

/** A chave da franquia de UMA cópia da mensagem: 32 bytes do sorteio do aparelho (crypto.getRandomValues). */
export function novaChaveDeFranquia(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

/** O compromisso que vai no depósito, fora do cifrado: c = HMAC(kf, rótulo ‖ id_h ‖ conteúdo sem kf). */
export function compromisso(kf: Uint8Array, idH: Uint8Array, conteudo: Uint8Array): Uint8Array {
  if (kf.length !== 32) throw new Error("franquia: a chave tem 32 bytes");
  if (idH.length !== 32) throw new Error("franquia: o resumo da caixa tem 32 bytes");
  return hmac(sha256, kf, juntar(bytesDe(ROTULOS_DA_FRANQUIA.franquia), idH, conteudo));
}

/** O compromisso confere com a chave e o conteúdo que chegaram dentro do cifrado? (Quem recebe confere antes de guardar.) */
export function conferirCompromisso(kf: Uint8Array, idH: Uint8Array, conteudo: Uint8Array, c: Uint8Array): boolean {
  if (kf.length !== 32 || idH.length !== 32 || c.length !== 32) return false;
  return iguais(compromisso(kf, idH, conteudo), c);
}

/** Uma agulha está, byte a byte, dentro do palheiro? */
function contem(palheiro: Uint8Array, agulha: Uint8Array): boolean {
  if (agulha.length === 0 || agulha.length > palheiro.length) return false;
  fora: for (let i = 0; i + agulha.length <= palheiro.length; i++) {
    for (let j = 0; j < agulha.length; j++) if (palheiro[i + j] !== agulha[j]) continue fora;
    return true;
  }
  return false;
}

/**
 * O trecho está dentro do conteúdo da mensagem? Cortar pode, reescrever não. O texto vai no conteúdo em UTF-8, cru ou como cadeia
 * de JSON (a conversa a dois guarda {"t": "..."}: aspas, barras e quebras de linha vão escapadas). Confere as duas formas, e o texto
 * como foi digitado e na forma única (NFC) das letras com acento. Limite dito: um trecho pode bater em bytes de fora do texto (o
 * cabeçalho ou o id de resposta), o que não ajuda ninguém a inventar texto.
 */
export function trechoNoConteudo(conteudo: Uint8Array, trecho: string): boolean {
  if (typeof trecho !== "string" || trecho.trim().length === 0 || [...trecho].length > LIMITE_DO_TRECHO) return false;
  const formas = new Set([trecho, trecho.normalize("NFC")]);
  for (const f of formas) {
    if (contem(conteudo, bytesDe(f))) return true;
    if (contem(conteudo, bytesDe(JSON.stringify(f).slice(1, -1)))) return true;
  }
  return false;
}

// ── base64url (sem preenchimento): o formato dos bytes no JSON da rota ──
export function b64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** base64url (ou padrão) para bytes; nulo se não for, se não tiver `tamanho` ou se passar de `maximo`. */
export function deB64(s: unknown, tamanho?: number, maximo = MAIOR_CONTEUDO): Uint8Array | null {
  if (typeof s !== "string" || s.length === 0 || !/^[A-Za-z0-9_\-+/]*={0,2}$/.test(s) || s.length > Math.ceil((maximo * 4) / 3) + 4) return null;
  try {
    const padrao = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const bin = atob(padrao + "=".repeat((4 - (padrao.length % 4)) % 4));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    if (tamanho !== undefined && b.length !== tamanho) return null;
    if (b.length > maximo) return null;
    return b;
  } catch {
    return null;
  }
}

/** De onde veio a mensagem denunciada. */
export type OrigemDaProva = "conversa" | "grupo" | "post";

/**
 * O que o aparelho de quem recebe guarda de cada mensagem para poder denunciá-la depois (na loja cifrada do aparelho, junto da
 * mensagem; nunca no servidor). Tudo em base64url.
 */
export interface ProvaDeFranquia {
  v: 1;
  origem: OrigemDaProva;
  /** Resumo da caixa (id_h) em que a mensagem chegou. */
  caixa: string;
  /** O dia que o servidor devolveu com o pacote (AAAA-MM-DD, UTC). */
  dia: string;
  /** A chave da franquia (de dentro do cifrado). */
  kf: string;
  /** O compromisso (de fora do cifrado, como chegou no pacote). */
  c: string;
  /** A marca do servidor (como chegou no pacote). */
  marca: string;
  /** O conteúdo da mensagem sem a kf (os bytes exatos que entraram no compromisso). */
  conteudo: string;
  /** O resumo do passe de depósito que quem escreveu declarou seu (pd_h): é o que está dentro da marca. */
  pd_h?: string;
  /** A declaração de quem escreveu (Ed25519 da identidade da conta sobre id_h, pd_h e a conta). Sem ela, não há prova de autoria. */
  declaracao?: string;
  /** A conta (id) que assinou a declaração: a quem a denúncia atribui o texto. */
  conta?: string;
}

/**
 * Monta a prova de uma mensagem que acabou de abrir (contrato para a conversa a dois e os grupos): o id CRU da caixa (o aparelho
 * tem), o pacote como a caixa entregou (franquia e marca de fora, dia), e a kf e o conteúdo sem kf de dentro do cifrado. Nula se o
 * pacote veio sem franquia ou sem marca, ou se o compromisso não confere (aí a mensagem não vira prova; a tela diz "sem prova").
 */
export function provaDoPacote(a: {
  origem: OrigemDaProva;
  caixa: Uint8Array;
  pacote: { franquia: Uint8Array | null; marca: Uint8Array | null; dia: string };
  kf: Uint8Array;
  conteudo: Uint8Array;
  /** Quem escreveu: o resumo do passe que declarou seu, a declaração assinada e a conta (só a conversa a dois tem). */
  autoria?: { pdH: Uint8Array; declaracao: Uint8Array; conta: string } | null;
}): ProvaDeFranquia | null {
  const { franquia, marca, dia } = a.pacote;
  if (!franquia || !marca || franquia.length !== 32 || marca.length !== 32 || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const idH = resumoDaCaixa(a.caixa);
  if (!conferirCompromisso(a.kf, idH, a.conteudo, franquia)) return null;
  const autoria = a.autoria && a.autoria.pdH.length === 32 && a.autoria.declaracao.length === 64 && a.autoria.conta
    ? { pd_h: b64(a.autoria.pdH), declaracao: b64(a.autoria.declaracao), conta: a.autoria.conta }
    : {};
  return { v: 1, origem: a.origem, caixa: b64(idH), dia, kf: b64(a.kf), c: b64(franquia), marca: b64(marca), conteudo: b64(a.conteudo), ...autoria };
}

/**
 * A prova está inteira, com a declaração de quem escreveu, e o compromisso confere? (O aparelho confere antes de oferecer "com
 * prova" na tela: sem declaração, como nos grupos, a tela não oferece, porque o servidor recusaria.)
 */
export function provaInteira(p: ProvaDeFranquia | null | undefined): p is ProvaDeFranquia {
  if (!p || p.v !== 1 || !["conversa", "grupo", "post"].includes(p.origem) || !/^\d{4}-\d{2}-\d{2}$/.test(p.dia)) return false;
  const kf = deB64(p.kf, 32);
  const idH = deB64(p.caixa, 32);
  const c = deB64(p.c, 32);
  const conteudo = deB64(p.conteudo);
  if (!kf || !idH || !c || !conteudo || !deB64(p.marca, 32)) return false;
  if (!deB64(p.pd_h, 32) || !deB64(p.declaracao, 64) || typeof p.conta !== "string" || !p.conta) return false;
  return conferirCompromisso(kf, idH, conteudo, c);
}

/** Um trecho escolhido para a denúncia: o texto (o que sai do cifrado) e a prova da mensagem de onde ele veio. */
export interface TrechoComProva {
  texto: string;
  prova: ProvaDeFranquia;
}

/**
 * O que a tela manda à rota da denúncia com prova (app/api/alumia/franquia/denunciar). `autor`: o @ que o aparelho atribui a quem
 * escreveu (vazio só com `post`); `post`: o id do post cifrado, quando a denúncia é de um post que ainda está na linha (posts
 * restritos de antes da R2: o banco tira o autor do post).
 */
export interface PedidoDeDenunciaComProva {
  categoria: string;
  autor: string;
  post?: string | null;
  texto?: string;
  trechos: TrechoComProva[];
}
