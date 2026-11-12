// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Comparar o código de segurança do chat privado da Alumia: pelo QR (uma pessoa mostra, a outra lê com a câmera) ou, quando a
// identidade de alguém que estava VERIFICADA muda, pelos números que a pessoa precisa ouvir da outra e digitar. Um clique não
// basta nesse caso: a tela só segue se o que foi lido ou digitado bate com o código calculado neste aparelho.
// O código é o mesmo das conversas da equipe (lib/sigilo.ts): sessenta números, doze grupos de cinco. Ele é feito de duas
// metades de trinta números, uma de cada identidade, em ordem fixa.
//
// POR QUE A METADE INTEIRA DA OUTRA PESSOA: a minha metade não muda quando o servidor troca a identidade da outra pessoa. Se a
// tela pedisse um grupo qualquer dos doze, em metade das vezes pediria um grupo MEU, que confere com qualquer identidade falsa.
// E um grupo só (cinco algarismos) é pouco: quem fabrica identidades acerta um grupo em cerca de cem mil tentativas. Por isso
// a tela pede os SEIS grupos da metade da outra pessoa (trinta algarismos), ou o QR, que leva os sessenta.
//
// POR QUE "OS SEUS GRUPOS" E NÃO "OS GRUPOS X A Y DA SUA TELA": se o servidor puser a MESMA identidade falsa F no lugar das duas
// pessoas, a tela de cada uma mostra a metade de F, e na mesma posição se F for escolhida para isso. Quem dita "os grupos 1 a 6
// da minha tela" diria a metade de F, e conferiria. Por isso quem dita lê os seis grupos que vêm da PRÓPRIA identidade (a tela
// os marca como "seus", calculados da chave deste aparelho, que o servidor não troca), e quem confere compara com a metade
// calculada da identidade que recebeu (conferirMetadeDe), em qualquer posição.
//
// Funções puras, sem navegador: rodam no Node nos testes (scripts/testar-rede-chat.mjs).
import { lerQrDaSeguranca } from "../../sigilo";

export const GRUPOS_DO_CODIGO = 12;
export const GRUPOS_DA_METADE = 6;
const FORMATO_DO_CODIGO = /^[0-9]{60}$/;
const FORMATO_DA_METADE = /^[0-9]{30}$/;

/** O grupo `indice` (de 0 a 11) do código de sessenta números. */
export function grupoDoCodigo(codigo: string, indice: number): string {
  if (!FORMATO_DO_CODIGO.test(codigo) || !Number.isInteger(indice) || indice < 0 || indice >= GRUPOS_DO_CODIGO) throw new Error("codigo_invalido");
  return codigo.slice(indice * 5, indice * 5 + 5);
}

/** A metade da OUTRA pessoa dentro do código: em que grupo começa (0 ou 6) e os trinta números. */
export interface MetadeDaOutra {
  inicio: 0 | 6;
  numeros: string;
}

/**
 * Qual metade do código é a da outra pessoa. `minhaMetade` vem de `metadeDoCodigo(minha identidade)` (lib/sigilo.ts). Devolve
 * null se o código não contém a minha metade (não é um código meu) ou se as duas metades são iguais (não dá para separar).
 */
export function metadeDaOutraPessoa(codigo: string, minhaMetade: string): MetadeDaOutra | null {
  if (!FORMATO_DO_CODIGO.test(codigo) || !FORMATO_DA_METADE.test(minhaMetade)) return null;
  const primeira = codigo.slice(0, 30);
  const segunda = codigo.slice(30);
  if (primeira === segunda) return null;
  if (primeira === minhaMetade) return { inicio: 6, numeros: segunda };
  if (segunda === minhaMetade) return { inicio: 0, numeros: primeira };
  return null;
}

/** Os doze grupos, com os seis da outra pessoa escondidos (é preciso ouvi-los dela). */
export function codigoComMetadeEscondida(codigo: string, inicio: 0 | 6): string[] {
  return Array.from({ length: GRUPOS_DO_CODIGO }, (_, i) => (i >= inicio && i < inicio + GRUPOS_DA_METADE ? "•••••" : grupoDoCodigo(codigo, i)));
}

/**
 * O que a pessoa digitou são mesmo os seis grupos da metade da outra pessoa? Aceita espaços entre os grupos; só números, e os
 * trinta. Nunca confere contra a minha própria metade.
 */
export function conferirMetade(codigo: string, minhaMetade: string, digitado: string): boolean {
  const daOutra = metadeDaOutraPessoa(codigo, minhaMetade);
  const limpo = digitado.replace(/\s/g, "");
  if (!daOutra || !FORMATO_DA_METADE.test(limpo)) return false;
  let diferenca = 0;
  for (let i = 0; i < 30; i++) diferenca |= daOutra.numeros.charCodeAt(i) ^ limpo.charCodeAt(i);
  return diferenca === 0;
}

/**
 * O que a outra pessoa ditou (os seis grupos que a tela DELA marca como "seus") é a metade da identidade que este aparelho recebeu
 * para ela? `esperada` vem de `metadeDoCodigo(identidade recebida)`. Aceita espaços; só números, os trinta; comparação sem atalho.
 */
export function conferirMetadeDe(esperada: string, digitado: string): boolean {
  const limpo = digitado.replace(/\s/g, "");
  if (!FORMATO_DA_METADE.test(esperada) || !FORMATO_DA_METADE.test(limpo)) return false;
  let diferenca = 0;
  for (let i = 0; i < 30; i++) diferenca |= esperada.charCodeAt(i) ^ limpo.charCodeAt(i);
  return diferenca === 0;
}

/** O QR lido com a câmera: "confere" (é o mesmo código), "nao_confere" (é um código, mas outro) ou "outro" (não é código de segurança). */
export function conferirQr(lido: string, codigo: string): "confere" | "nao_confere" | "outro" {
  const doQr = lerQrDaSeguranca(lido);
  if (!doQr) return "outro";
  return doQr === codigo ? "confere" : "nao_confere";
}
