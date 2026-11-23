// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor do voto (supabase/migracoes/20261115-alumia-o9-resto8.sql, 20261124-r2-voto.sql, docs/rede/VOTO-SECRETO.md).
// Só no servidor: usa o HMAC-SHA-256 do node:crypto (nada feito à mão).
//
// O segredo do servidor, ALUMIA_VOTO_SEGREDO (32 letras ou mais), nunca vai ao banco nem ao navegador, e serve SÓ às marcas:
//   - as marcas de "já votou" (votação secreta da equipe, enquete de post, enquete de story, o "pouco útil" das respostas, o
//     "mandei" da pressão em parlamentar):
//     HMAC-SHA-256 sobre o tipo, o alvo e a pessoa. O banco guarda a marca, nunca a pessoa;
//   - a marca do termômetro da equipe: HMAC-SHA-256 sobre a semana e a pessoa, em 32 letras (o tamanho que a tabela já tinha).
// Cada uso tem a sua chave, derivada do segredo com um rótulo próprio: uma não serve no lugar da outra.
// O segredo NÃO abre cédula nenhuma (R2, item 1.7): a chave de cada votação secreta é criada no aparelho de quem a abre e a semente
// dela fica dividida entre as guardiãs da coordenação (lib/rede/voto/limiar.ts). O servidor não tem semente, privada nem parte.
// TROCAR O SEGREDO com uma votação da equipe aberta deixa votar de novo onde a marca mudou. Não troque: se vazar, encerre antes.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.
import { createHmac } from "node:crypto";

const TAMANHO_MINIMO = 32;

/** O segredo do voto, ou nulo (sem ele, nada de marca pelo servidor: a rota responde "sem_servico"). */
export function segredoDoVoto(segredo: string | undefined = process.env.ALUMIA_VOTO_SEGREDO): string | null {
  return segredo && segredo.length >= TAMANHO_MINIMO ? segredo : null;
}

const chaveDoUso = (segredo: string, uso: string) => createHmac("sha256", segredo).update(`alumia:voto:${uso}`).digest();

/** Embaralha (Fisher-Yates com o sorteio forte que quem chama passa): a ordem não diz a ordem de chegada (lib/rede/voto/critica.ts). */
export function embaralhar<T>(lista: T[], sortear: (n: number) => number): T[] {
  const saida = lista.slice();
  for (let i = saida.length - 1; i > 0; i--) {
    const j = sortear(i + 1);
    [saida[i], saida[j]] = [saida[j], saida[i]];
  }
  return saida;
}

/**
 * "teste": o teste com resposta certa do story (P5), com marca própria (outra chave que a da enquete do mesmo story).
 * "pouco_util": o "pouco útil" numa resposta (Prompt 4, item 132; supabase/migracoes/20261127-p4-pontes.sql). O banco não tem o
 * segredo: quem tem só o banco não liga a marca à conta.
 * "pressao": o "mandei" da pressão em parlamentar (Prompt 4, item 89; supabase/migracoes/20261127-p4-coletiva.sql), pelo mesmo
 * motivo.
 */
export type TipoDaMarca = "equipe" | "enquete" | "story" | "teste" | "pouco_util" | "pressao";

/** A marca de "já votou" desta pessoa neste alvo (64 letras hexadecimais). O banco guarda a marca, nunca a pessoa. */
export function marcaDoVoto(segredo: string, tipo: TipoDaMarca, alvo: string, pessoa: string): string {
  return createHmac("sha256", chaveDoUso(segredo, `marca:${tipo}`)).update(`${alvo}:${pessoa}`).digest("hex");
}

/** A marca do termômetro da equipe nesta semana (32 letras hexadecimais: o tamanho da coluna). */
export function marcaDoBemEstar(segredo: string, semana: string, pessoa: string): string {
  return createHmac("sha256", chaveDoUso(segredo, "bem_estar")).update(`${semana}:${pessoa}`).digest("hex").slice(0, 32);
}

/** A segunda-feira desta semana em São Paulo (AAAA-MM-DD): a mesma de interno.semana_atual(). */
export function semanaDeSaoPaulo(agora: Date = new Date()): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const dia = new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)));
  const semana = (dia.getUTCDay() + 6) % 7;
  dia.setUTCDate(dia.getUTCDate() - semana);
  return dia.toISOString().slice(0, 10);
}
