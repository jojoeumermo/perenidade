// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O formato "c3" das mensagens do chat privado da Alumia. Documento: docs/rede/CHAT-PRIVADO.md.
//
//   corpo     "c3.<versão>.<vetor de 12 bytes>.<cifrado>"        (base64url, sem "=")
//   cifrado   AES-GCM-256 com a chave da conversa, sobre um BLOCO de tamanho fixo (lib/rede/chat/padding.ts)
//   conteúdo  [16 bytes: identificador sorteado][4 bytes: contador][8 bytes: até onde eu já tinha recebido][texto em UTF-8]
//   amarra    "alumia-dm:c3:<conversa>:<autor>:v<versão>"        (dado autenticado do AES-GCM)
//
// O que mudou em relação ao "c2" (lib/sigilo.ts), que continua sendo LIDO:
//   - Tamanho fixo: o cifrado cai em sete tamanhos, e o banco recusa qualquer outro.
//   - Identificador e contador por autor e versão, DENTRO do cifrado: o aparelho nota mensagem repetida e buraco na ordem.
//   - "Até onde eu já tinha recebido": a versão e o contador da última mensagem da OUTRA pessoa que este aparelho tinha
//     quando escreveu (zero e zero se nenhuma). Com isso quem recebe nota resposta posta antes da pergunta e, do lado de
//     quem escreveu, mensagem que a outra pessoa ainda não tinha recebido (lib/rede/chat/ordem.ts).
//   - Sem assinatura do autor. Quem tem a chave da conversa são só as duas pessoas (ela é embrulhada só para chaves
//     certificadas); a mensagem que abre veio de uma das duas. Nenhuma das duas consegue provar a um terceiro quem escreveu.
//   - A amarra leva também o formato: um cifrado "c3" não abre como "c2", nem o contrário.
//
// Sem navegador além do WebCrypto: roda no Node nos testes (scripts/testar-rede-chat.mjs).
import { deBase64, paraBase64 } from "../../sigilo";
import { preencher, TAMANHOS_DO_CIFRADO, tirarPreenchimento } from "./padding";

const B64 = "[A-Za-z0-9_-]";
const FORMATO_C3 = new RegExp(`^c3\\.([1-9][0-9]{0,6})\\.(${B64}{16})\\.(${B64}+)$`);
const FORMATO_C2 = new RegExp(`^c2\\.([1-9][0-9]{0,6})\\.${B64}{16}\\.${B64}{23,}$`);

/** Os bytes do identificador e do contador, no começo do conteúdo. */
const BYTES_DO_ID = 16;
const BYTES_DO_CONTADOR = 4;
/** "Até onde eu já tinha recebido da outra pessoa": 4 bytes da versão e 4 do contador. */
const BYTES_DO_VISTO = 8;
const BYTES_DO_COMECO = BYTES_DO_ID + BYTES_DO_CONTADOR + BYTES_DO_VISTO;
/** O maior contador (4 bytes). Com 120 mensagens por hora e versão nova a cada 7 dias, ninguém chega perto. */
export const MAIOR_CONTADOR = 0xffff_ffff;

const encoder = new TextEncoder();

/** Em que formato está um corpo: "c3" (o atual), "c2" (o antigo, só lido) ou nenhum. */
export function formatoDe(corpo: string): "c2" | "c3" | null {
  if (FORMATO_C3.test(corpo)) return "c3";
  return FORMATO_C2.test(corpo) ? "c2" : null;
}

/** A versão da chave com que um corpo foi cifrado (c2 ou c3); null para o que não é mensagem. */
export function versaoDoCorpo(corpo: string): number | null {
  const partes = FORMATO_C3.exec(corpo) ?? FORMATO_C2.exec(corpo);
  return partes ? Number(partes[1]) : null;
}

/** O que amarra uma mensagem c3: a conversa, quem escreveu, a versão da chave e o formato. */
export const contextoC3 = (conversa: string, autor: string, versao: number) => `alumia-dm:c3:${conversa}:${autor}:v${versao}`;

/** Um identificador novo (16 bytes sorteados, em base64url). */
export const novoIdDeMensagem = () => paraBase64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(BYTES_DO_ID))));

/** A última mensagem da outra pessoa que quem escreveu já tinha recebido: versão da chave e contador (0 e 0: nenhuma). */
export interface Visto {
  versao: number;
  contador: number;
}
export const NADA_VISTO: Visto = { versao: 0, contador: 0 };

/** Uma mensagem c3 aberta. */
export interface AbertaC3 {
  texto: string;
  /** O identificador sorteado por quem escreveu (base64url de 16 bytes). */
  id: string;
  /** O contador de quem escreveu, nesta versão da chave (começa em 1). */
  contador: number;
  /** Até onde quem escreveu já tinha recebido da outra pessoa. */
  visto: Visto;
}

/** Monta o conteúdo, preenche até o bloco e cifra. Lança "conteudo_grande" se não couber no maior bloco. */
export async function cifrarC3(chave: CryptoKey, versao: number, conversa: string, autor: string, texto: string, contador: number, visto: Visto = NADA_VISTO, id = novoIdDeMensagem()): Promise<string> {
  if (!Number.isInteger(versao) || versao < 1 || versao > 9_999_999) throw new Error("versao_invalida");
  if (!Number.isInteger(contador) || contador < 1 || contador > MAIOR_CONTADOR) throw new Error("contador_invalido");
  if (![visto.versao, visto.contador].every((n) => Number.isInteger(n) && n >= 0 && n <= MAIOR_CONTADOR)) throw new Error("visto_invalido");
  const doId = deBase64(id);
  if (doId.length !== BYTES_DO_ID) throw new Error("id_invalido");
  const doTexto = encoder.encode(texto);
  const conteudo = new Uint8Array(new ArrayBuffer(BYTES_DO_COMECO + doTexto.length));
  conteudo.set(doId, 0);
  const campos = new DataView(conteudo.buffer);
  campos.setUint32(BYTES_DO_ID, contador);
  campos.setUint32(BYTES_DO_ID + BYTES_DO_CONTADOR, visto.versao);
  campos.setUint32(BYTES_DO_ID + BYTES_DO_CONTADOR + 4, visto.contador);
  conteudo.set(doTexto, BYTES_DO_COMECO);
  const bloco = preencher(conteudo);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  try {
    const fechado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(contextoC3(conversa, autor, versao)) }, chave, bloco);
    return `c3.${versao}.${paraBase64(iv)}.${paraBase64(new Uint8Array(fechado))}`;
  } finally {
    bloco.fill(0);
    conteudo.fill(0);
  }
}

/**
 * Abre uma mensagem c3. null em qualquer dúvida: formato errado, tamanho fora dos blocos, chave errada, mensagem adulterada ou
 * mudada de conversa, de autor ou de versão, preenchimento que não confere, texto que não é UTF-8.
 */
export async function abrirC3(chave: CryptoKey, corpo: string, conversa: string, autor: string): Promise<AbertaC3 | null> {
  const partes = FORMATO_C3.exec(corpo);
  if (!partes || !TAMANHOS_DO_CIFRADO.includes(partes[3].length)) return null;
  try {
    const versao = Number(partes[1]);
    const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(partes[2]), additionalData: encoder.encode(contextoC3(conversa, autor, versao)) }, chave, deBase64(partes[3]));
    const conteudo = tirarPreenchimento(new Uint8Array(aberto));
    if (conteudo.length < BYTES_DO_COMECO) return null;
    const campos = new DataView(conteudo.buffer);
    const contador = campos.getUint32(BYTES_DO_ID);
    if (contador < 1) return null;
    const visto = { versao: campos.getUint32(BYTES_DO_ID + BYTES_DO_CONTADOR), contador: campos.getUint32(BYTES_DO_ID + BYTES_DO_CONTADOR + 4) };
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(conteudo.subarray(BYTES_DO_COMECO));
    return { texto, id: paraBase64(conteudo.subarray(0, BYTES_DO_ID)), contador, visto };
  } catch {
    return null;
  }
}
