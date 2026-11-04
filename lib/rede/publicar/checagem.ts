// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A checagem de um texto ANTES de publicar (pacote publicar). Roda no navegador, para avisar já, e é espelhada no banco
// (supabase/migracoes/2026-11-rede-publicar.sql: interno.rede3_pub_dado_pessoal, rede_publicar), que é quem decide de verdade:
// o navegador pode ser alterado, o banco não. Três grupos:
//   - dado pessoal (CPF, telefone, e-mail): bloqueia (LGPD art. 6º, III: minimização);
//   - endereço com número (rua, avenida… vírgula, número): bloqueia, é o caminho do assédio;
//   - ódio (regra simples de xingamento explícito): não bloqueia aqui; o texto vai para a leitura da mediação e para a avaliação
//     externa antes de aparecer (Código Penal arts. 138 a 140; a decisão é de gente).
// Sem "@/": roda no Node dos testes.

export type TipoDeAchado = "cpf" | "telefone" | "email" | "endereco" | "odio";
export interface Achado {
  tipo: TipoDeAchado;
  /** O trecho que casou (para a tela mostrar onde). */
  trecho: string;
}
export interface ResultadoDaChecagem {
  /** O que a Rede não aceita de jeito nenhum. */
  bloqueia: Achado[];
  /** O que não impede de enviar, mas vai passar por leitura antes de aparecer. */
  avisa: Achado[];
}

const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;
const TELEFONE = /\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}/i;
const ENDERECO = /(?<![\p{L}\d])(rua|avenida|av|travessa|alameda|rodovia|estrada|praça|praca|largo|beco|viela)(?![\p{L}\d])[^\n,.]{2,60}(,\s*|\s+n[ºo°]\.?\s*)\d{1,5}(?!\d)/iu;
// A mesma lista de xingamentos de ódio explícitos que o banco usa, comparada sem acento e sem maiúscula.
const ODIO = /(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)/;

/** Sem acento e em minúsculas (para a regra de ódio), como interno.normal no banco. */
export const semAcento = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function checarTexto(texto: string): ResultadoDaChecagem {
  const bloqueia: Achado[] = [];
  const avisa: Achado[] = [];
  const casar = (re: RegExp, tipo: TipoDeAchado, para: Achado[]) => {
    const m = texto.match(re);
    if (m) para.push({ tipo, trecho: m[0].trim().slice(0, 60) });
  };
  casar(CPF, "cpf", bloqueia);
  casar(TELEFONE, "telefone", bloqueia);
  casar(EMAIL, "email", bloqueia);
  casar(ENDERECO, "endereco", bloqueia);
  const m = semAcento(texto).match(ODIO);
  if (m) avisa.push({ tipo: "odio", trecho: m[2] });
  return { bloqueia, avisa };
}
