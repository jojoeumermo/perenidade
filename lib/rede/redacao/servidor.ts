// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor da roda de redação (supabase/migracoes/20261117-alumia-o11-redacao.sql): o LACRE de cada correção. Só no
// servidor: HMAC-SHA-256 do node:crypto (nada feito à mão), com uma chave derivada do segredo do voto (ALUMIA_VOTO_SEGREDO, o mesmo
// de lib/rede/voto/servidor.ts) pelo rótulo "alumia:redacao:lacre", que não serve para nenhum outro uso.
//
// lacre = HMAC(chave do lacre, "<id da correção>:<id da pessoa>"). O banco guarda o lacre junto da correção e nunca a pessoa: sem
// o segredo, o lacre não diz quem corrigiu. Só quando a mediação julga uma correção abusiva, o servidor confere o lacre contra as
// pessoas que corrigiram naquela roda, afasta a que bate e o banco apaga o lacre. Ninguém (nem a mediação) recebe o nome.
// Trocar o segredo faz os lacres antigos não baterem mais (a denúncia ainda tira a correção; ninguém é afastado).
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { segredoDoVoto } from "../voto/servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** O segredo do lacre (o do voto), ou nulo: sem ele, a correção entra sem lacre. */
export function segredoDoLacre(segredo: string | undefined = process.env.ALUMIA_VOTO_SEGREDO): string | null {
  return segredoDoVoto(segredo);
}

const chaveDoLacre = (segredo: string) => createHmac("sha256", segredo).update("alumia:redacao:lacre").digest();

/** O lacre de uma correção (64 letras hexadecimais). */
export function lacreDaCorrecao(segredo: string, correcao: string, pessoa: string): string {
  if (!UUID.test(correcao) || !UUID.test(pessoa)) throw new Error("invalido");
  return createHmac("sha256", chaveDoLacre(segredo)).update(`${correcao}:${pessoa}`).digest("hex");
}

/** Um id novo para a correção (sorteado aqui, para o lacre poder ser calculado antes de gravar). */
export const idDaCorrecao = (): string => randomUUID();

/** Entre as pessoas que corrigiram na roda, a dona do lacre (ou nulo). Compara em tempo constante. */
export function donaDoLacre(segredo: string, correcao: string, lacre: unknown, candidatas: unknown): string | null {
  if (typeof lacre !== "string" || !/^[0-9a-f]{64}$/.test(lacre) || !Array.isArray(candidatas)) return null;
  const alvo = Buffer.from(lacre, "hex");
  let dona: string | null = null;
  for (const c of candidatas) {
    if (typeof c !== "string" || !UUID.test(c)) continue;
    // Confere todas, sem parar na primeira: o tempo não diz em que posição estava.
    if (timingSafeEqual(Buffer.from(lacreDaCorrecao(segredo, correcao, c), "hex"), alvo)) dona = c;
  }
  return dona;
}
