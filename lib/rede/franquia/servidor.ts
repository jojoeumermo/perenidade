// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A denúncia com prova, o lado do servidor do site (só servidor: lê ALUMIA_FRANQUIA_SEGREDO, que nunca vai ao banco nem ao
// navegador). A marca de cada depósito é feita pela rota das caixas; aqui ela é REFEITA, com os mesmos bytes (lib/rede/franquia/
// protocolo.ts explica), para conferir cada trecho de uma denúncia. Quem copia o banco não tem chave nenhuma, e a chave de um dia não
// diz nada da de outro.
//
// Sem "@/" de propósito: os testes rodam este arquivo direto no Node.
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { declaracaoConfere } from "../chat/r2/certificados";
import {
  bytesDe, conferirCompromisso, deB64, DIAS_DA_PROVA, iguais, juntar, LIMITE_DO_TRECHO, ROTULOS_DA_FRANQUIA, trechoNoConteudo,
  type OrigemDaProva, type TrechoComProva,
} from "./protocolo";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O segredo da franquia (32 letras ou mais), ou nulo: sem ele, nenhuma denúncia sai "com prova". */
export function segredoDaFranquia(valor = process.env.ALUMIA_FRANQUIA_SEGREDO): string | null {
  const s = (valor ?? "").trim();
  return s.length >= 32 ? s : null;
}

/** O dia em UTC (AAAA-MM-DD): o mesmo "dia" que as caixas guardam com o pacote. */
export const diaUtc = (agora = new Date()) => agora.toISOString().slice(0, 10);

/** O dia é uma data de verdade (não "2026-02-31")? */
export function diaValido(dia: unknown): dia is string {
  if (typeof dia !== "string" || !DIA.test(dia)) return false;
  const d = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
}

/** Quantos dias de `dia` até `hoje` (negativo: no futuro). */
function diasAte(dia: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / 86_400_000);
}

/** A chave da marca de um dia (a mesma da rota das caixas). */
export function chaveDoDia(segredo: string, dia: string): Uint8Array {
  if (!diaValido(dia)) throw new Error("franquia: dia inválido");
  return hkdf(sha256, bytesDe(segredo), undefined, bytesDe(`${ROTULOS_DA_FRANQUIA.marcaChave}|${dia}`), 32);
}

/**
 * A marca de um depósito: t = HMAC(K_dia, "alumia/r2/marca/v2" ‖ c ‖ id_h ‖ pd_h ‖ dia), com pd_h o resumo do passe de depósito
 * APRESENTADO (a mesma conta da rota das caixas). Passe errado ganha marca, mas presa a outro pd_h: não serve de prova para a
 * declaração de quem escreve.
 */
export function marcaDoServidor(segredo: string, c: Uint8Array, idH: Uint8Array, pdH: Uint8Array, dia: string): Uint8Array {
  if (c.length !== 32 || idH.length !== 32 || pdH.length !== 32) throw new Error("franquia: campos de 32 bytes");
  return hmac(sha256, chaveDoDia(segredo, dia), juntar(bytesDe(ROTULOS_DA_FRANQUIA.marca), c, idH, pdH, bytesDe(dia)));
}

/** A conta a quem a denúncia atribui o texto: o id e as identidades dela no registro público das chaves (Ed25519, 32 bytes cada). */
export interface AutoriaNoRegistro {
  conta: string;
  identidades: Uint8Array[];
}

/** O que a conferência de um trecho decide. */
export type ResultadoDoTrecho =
  | { ok: true; texto: string; dia: string; origem: OrigemDaProva }
  | { ok: false; motivo: "formato" | "prazo" | "compromisso" | "marca" | "trecho" | "autoria" };

/**
 * Confere um trecho de denúncia, nesta ordem: formato, prazo (até 90 dias, nunca no futuro), autoria (a declaração de quem escreveu
 * é de uma identidade da conta denunciada no registro público, para esta caixa e este pd_h), marca (passou por esta caixa neste dia,
 * com o passe declarado: a marca é do servidor), compromisso (o conteúdo é o da mensagem) e trecho (está dentro do conteúdo). As
 * comparações de MAC são em tempo constante. Nenhum erro de biblioteca vira "confere". Sem `autoria` (conta sem identidade no
 * registro) ou sem declaração na prova (grupos e posts), não confere.
 */
/**
 * A conferência da marca de fora (onda R3, o chat separado): quem tem o segredo da franquia é o servidor do chat, e a rota da denúncia
 * pergunta a ele antes (lib/rede/caixas/franquia-servidor.ts, conferirMarcasNoChat). Recebe os campos já lidos; devolve se confere.
 */
export type MarcaConfere = (c: Uint8Array, idH: Uint8Array, pdH: Uint8Array, dia: string, marca: Uint8Array) => boolean;

export function conferirTrecho(segredo: string, t: TrechoComProva, autoria: AutoriaNoRegistro | null, hoje = diaUtc(), marcaConfere?: MarcaConfere): ResultadoDoTrecho {
  try {
    const p = t?.prova;
    if (!p || p.v !== 1 || typeof t.texto !== "string" || !["conversa", "grupo", "post"].includes(p.origem) || !diaValido(p.dia)) {
      return { ok: false, motivo: "formato" };
    }
    const kf = deB64(p.kf, 32);
    const idH = deB64(p.caixa, 32);
    const c = deB64(p.c, 32);
    const marca = deB64(p.marca, 32);
    const conteudo = deB64(p.conteudo);
    if (!kf || !idH || !c || !marca || !conteudo) return { ok: false, motivo: "formato" };
    const idade = diasAte(p.dia, hoje);
    if (idade < 0 || idade > DIAS_DA_PROVA) return { ok: false, motivo: "prazo" };
    const pdH = deB64(p.pd_h, 32);
    const declaracao = deB64(p.declaracao, 64);
    if (!autoria || !pdH || !declaracao || p.conta !== autoria.conta
      || !autoria.identidades.some((id) => declaracaoConfere(id, idH, pdH, autoria.conta, declaracao))) {
      return { ok: false, motivo: "autoria" };
    }
    // Sem quem confira de fora e sem segredo (o modo separado mal configurado), nada confere: a marca de uma chave vazia qualquer um faz.
    if (!marcaConfere && segredoDaFranquia(segredo) === null) return { ok: false, motivo: "marca" };
    const confere = marcaConfere ? marcaConfere(c, idH, pdH, p.dia, marca) === true : iguais(marcaDoServidor(segredo, c, idH, pdH, p.dia), marca);
    if (!confere) return { ok: false, motivo: "marca" };
    if (!conferirCompromisso(kf, idH, conteudo, c)) return { ok: false, motivo: "compromisso" };
    if ([...t.texto].length > LIMITE_DO_TRECHO || !trechoNoConteudo(conteudo, t.texto)) return { ok: false, motivo: "trecho" };
    return { ok: true, texto: t.texto.trim(), dia: p.dia, origem: p.origem };
  } catch {
    return { ok: false, motivo: "formato" };
  }
}

/** Uma denúncia com prova: os trechos e a prova de cada um. */
export interface Denuncia {
  trechos: TrechoComProva[];
}

/**
 * A conferência inteira: "com_prova" quando TODOS os trechos conferem, "sem_prova" se algum não confere, se não há trecho ou se o
 * servidor está sem o segredo.
 */
export function conferirDenuncia(d: Denuncia, autoria: AutoriaNoRegistro | null, segredo = segredoDaFranquia(), hoje = diaUtc()): "com_prova" | "sem_prova" {
  if (!segredo || !Array.isArray(d?.trechos) || d.trechos.length === 0) return "sem_prova";
  return d.trechos.every((t) => conferirTrecho(segredo, t, autoria, hoje).ok) ? "com_prova" : "sem_prova";
}
