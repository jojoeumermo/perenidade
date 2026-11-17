// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor do voto (supabase/migracoes/20261115-alumia-o9-resto8.sql, docs/rede/VOTO-SECRETO.md). Só no servidor: usa o
// node:crypto (ECDH P-256, HKDF-SHA-256, AES-256-GCM e HMAC-SHA-256 da biblioteca do Node; nada feito à mão).
//
// Tudo sai de UM segredo do servidor, ALUMIA_VOTO_SEGREDO (32 letras ou mais), que nunca vai ao banco nem ao navegador:
//   - a chave privada de cada consulta: HMAC-SHA-256(chave derivada, "consulta:<id>") como escalar da curva P-256 (no caso
//     raríssimo de o número não servir, o servidor tenta o seguinte, com um contador). A chave pública sai dela;
//   - as marcas de "já votou" (votação da equipe, enquete de post, enquete de story): HMAC-SHA-256 sobre o tipo, o alvo e a pessoa;
//   - a marca do termômetro da equipe: HMAC-SHA-256 sobre a semana e a pessoa, em 32 letras (o tamanho que a tabela já tinha).
// Cada uso tem a sua chave, derivada do segredo com um rótulo próprio: uma não serve no lugar da outra.
// TROCAR O SEGREDO com uma consulta aberta perde as cédulas cifradas dela (não abrem mais) e deixa votar de novo onde a marca
// mudou. Não troque: se vazar, feche as consultas abertas antes.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.
import { createDecipheriv, createECDH, createHmac, hkdfSync, type ECDH } from "node:crypto";
import { infoDaCedula, partesDaCedula, paraBase64url } from "./cedula";

const TAMANHO_MINIMO = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** O segredo do voto, ou nulo (sem ele, nada de voto pelo servidor: a rota responde "sem_servico"). */
export function segredoDoVoto(segredo: string | undefined = process.env.ALUMIA_VOTO_SEGREDO): string | null {
  return segredo && segredo.length >= TAMANHO_MINIMO ? segredo : null;
}

const chaveDoUso = (segredo: string, uso: string) => createHmac("sha256", segredo).update(`alumia:voto:${uso}`).digest();

/** O par de chaves ECDH da consulta, derivado do segredo. */
function parDaConsulta(segredo: string, consulta: string): ECDH {
  if (!UUID.test(consulta)) throw new Error("invalido");
  const base = chaveDoUso(segredo, "consulta");
  for (let contador = 0; contador < 16; contador++) {
    const d = createHmac("sha256", base).update(`consulta:${consulta}:${contador}`).digest();
    const par = createECDH("prime256v1");
    try {
      par.setPrivateKey(d);
      return par;
    } catch {
      // número fora da curva (probabilidade perto de 2^-32): tenta o próximo
    }
  }
  throw new Error("sem_chave");
}

/** A chave pública da consulta (65 bytes, base64url), para o aparelho cifrar a cédula. */
export function chavePublicaDaConsulta(segredo: string, consulta: string): string {
  return paraBase64url(new Uint8Array(parDaConsulta(segredo, consulta).getPublicKey()));
}

/** Abre uma cédula cifrada (lib/rede/voto/cedula.ts). Devolve o ranking (lista de ids) ou nulo se não abrir. */
export function abrirCedula(segredo: string, consulta: string, cedula: unknown): string[] | null {
  const p = partesDaCedula(cedula);
  if (!p) return null;
  try {
    const combinado = parDaConsulta(segredo, consulta).computeSecret(Buffer.from(p.chave));
    const chave = Buffer.from(hkdfSync("sha256", combinado, Buffer.from(p.chave), Buffer.from(infoDaCedula(consulta), "utf8"), 32));
    const cifra = Buffer.from(p.cifra);
    const decifrar = createDecipheriv("aes-256-gcm", chave, Buffer.from(p.nonce));
    decifrar.setAAD(Buffer.from(consulta, "utf8"));
    decifrar.setAuthTag(cifra.subarray(cifra.length - 16));
    const claro = Buffer.concat([decifrar.update(cifra.subarray(0, cifra.length - 16)), decifrar.final()]).toString("utf8");
    const ranking = JSON.parse(claro) as unknown;
    if (!Array.isArray(ranking) || ranking.length < 1 || ranking.length > 8 || !ranking.every((r) => typeof r === "string" && UUID.test(r))) return null;
    return ranking as string[];
  } catch {
    return null;
  }
}

/** Embaralha (Fisher-Yates com o sorteio forte do Node): a ordem das cédulas abertas não diz a ordem em que estavam. */
export function embaralhar<T>(lista: T[], sortear: (n: number) => number): T[] {
  const saida = lista.slice();
  for (let i = saida.length - 1; i > 0; i--) {
    const j = sortear(i + 1);
    [saida[i], saida[j]] = [saida[j], saida[i]];
  }
  return saida;
}

export type TipoDaMarca = "equipe" | "enquete" | "story";

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
