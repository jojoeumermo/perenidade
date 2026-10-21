// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Chinês no aparelho: pinyin com números para pinyin com acentos, a leitura das linhas do CC-CEDICT (CC BY-SA 4.0,
// MDBG) e a busca no dicionário. Testado em scripts/testar-chines.mjs.

const MARCAS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"], e: ["ē", "é", "ě", "è", "e"], i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"], u: ["ū", "ú", "ǔ", "ù", "u"], ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

/** Uma sílaba: "hao3" → "hǎo", "lv4"/"lu:4" → "lǜ", "ma5" → "ma". A marca vai no a ou no e; no "ou", no o; senão, na última vogal. */
export function silabaComAcento(s: string) {
  const m = /^([a-zü:v]+)([1-5])$/i.exec(s.trim());
  if (!m) return s.replace(/u:|v/gi, "ü");
  const maiuscula = m[1][0] !== m[1][0].toLowerCase();
  const corpo = m[1].toLowerCase().replace(/u:|v/g, "ü");
  const tom = Number(m[2]) - 1;
  let alvo = -1;
  if (corpo.includes("a")) alvo = corpo.indexOf("a");
  else if (corpo.includes("e")) alvo = corpo.indexOf("e");
  else if (corpo.includes("ou")) alvo = corpo.indexOf("o");
  else for (let i = corpo.length - 1; i >= 0; i--) if (MARCAS[corpo[i]]) { alvo = i; break; }
  if (alvo < 0) return corpo;
  const saida = corpo.slice(0, alvo) + MARCAS[corpo[alvo]][tom] + corpo.slice(alvo + 1);
  return maiuscula ? saida[0].toUpperCase() + saida.slice(1) : saida;
}
/** "ni3 hao3" → "nǐ hǎo" (o que não é sílaba fica como está). */
export const pinyinComAcento = (texto: string) => texto.split(/(\s+)/).map((p) => (/\s/.test(p) ? p : silabaComAcento(p))).join("");
/** "nǐ hǎo" → "ni hao" (para buscar sem os tons). */
export const semTom = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ü/g, "u").replace(/u:|v/g, "u").replace(/[1-5]/g, "").toLowerCase();

/** Uma entrada do dicionário: simplificado, tradicional (vazio se igual), pinyin com números e as traduções em inglês. */
export type Entrada = [string, string, string, string];
/** Lê uma linha do CC-CEDICT: "你好 你好 [ni3 hao3] /hello/hi/". */
export function lerLinha(linha: string): Entrada | null {
  const m = /^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/\s*$/.exec(linha);
  if (!m) return null;
  const [, trad, simp, pinyin, glosas] = m;
  return [simp, trad === simp ? "" : trad, pinyin, glosas.split("/").filter(Boolean).join(" / ")];
}

const han = /\p{Script=Han}/u;
/** Busca por caracteres, pinyin (com ou sem tons, com ou sem números) ou palavra em inglês. Os mais curtos e exatos primeiro. */
export function buscar(dic: Entrada[], consulta: string, limite = 40, comuns?: Map<string, number>): Entrada[] {
  const q = consulta.trim();
  if (!q) return [];
  // Com a lista de caracteres comuns (na ordem de uso), as palavras do dia a dia vêm antes das raras; sobrenomes e
  // variantes vão para o fim.
  const peso = (e: Entrada) => (comuns ? [...e[0]].reduce((s, c) => s + (comuns.get(c) ?? 5000), 0) / [...e[0]].length : 0) + (/^(surname|variant of|old variant|used in)/i.test(e[3]) ? 10000 : 0);
  const ordem = (a: Entrada, b: Entrada) => peso(a) - peso(b) || a[0].length - b[0].length;
  if (han.test(q)) {
    const exatos = dic.filter((e) => e[0] === q || e[1] === q);
    const comecam = dic.filter((e) => (e[0].startsWith(q) || e[1].startsWith(q)) && !exatos.includes(e)).sort((a, b) => a[0].length - b[0].length);
    const contem = dic.filter((e) => e[0].includes(q) && !e[0].startsWith(q)).sort((a, b) => a[0].length - b[0].length);
    return [...exatos.sort(ordem), ...comecam.sort(ordem), ...contem.sort(ordem)].slice(0, limite);
  }
  const alvo = semTom(q.replace(/\s+/g, ""));
  const comTons = /[1-5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(q);
  const numerado = q.toLowerCase().replace(/\s+/g, "");
  const pin = dic.filter((e) => {
    const sem = semTom(e[2].replace(/\s+/g, ""));
    if (sem !== alvo) return false;
    if (!comTons) return true;
    return e[2].toLowerCase().replace(/\s+/g, "") === numerado || pinyinComAcento(e[2]).replace(/\s+/g, "").toLowerCase() === numerado;
  });
  if (pin.length) return pin.sort(ordem).slice(0, limite);
  const palavra = new RegExp(`(^|[^a-z])${q.toLowerCase().replace(/[^a-z ]/g, "")}([^a-z]|$)`);
  // A tradução que é exatamente a palavra vem primeiro ("water" → 水), depois as que começam a entrada.
  const termo = q.toLowerCase().trim();
  const primeira = (e: Entrada) => {
    const glosas = e[3].toLowerCase().split(" / ").map((g) => g.replace(/\([^)]*\)/g, "").replace(/^(to|a|an|the) /, "").trim());
    return glosas.includes(termo) ? (glosas[0] === termo ? 0 : 1) : palavra.test(glosas[0]) ? 2 : 3;
  };
  return dic.filter((e) => palavra.test(e[3].toLowerCase())).sort((a, b) => primeira(a) - primeira(b) || peso(a) - peso(b) || a[0].length - b[0].length).slice(0, limite);
}
