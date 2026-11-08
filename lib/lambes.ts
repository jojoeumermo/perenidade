// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { FORMATOS, type Formato, type Lambe, type LambeDoDia, dataEspecial, diaDe, lambeDoDia, mesEDia, notaDoCartaz } from "./lambe-do-dia";

interface Entrada {
  id: string;
  /** O dia do ano em que ele sai, "MM-DD" (29 de fevereiro incluído: são 366). */
  dia: string;
  /** A vinheta de xilogravura do mesmo tema ("motivo/ceu/chao", veja lib/xilogravuras.ts). */
  xilo: string;
  /** O jeito do cartaz (veja FORMATOS em lib/lambe-do-dia.ts); sem ele, o grito vermelho. */
  formato?: Formato;
  pt: Lambe;
  [lang: string]: Lambe | string | undefined;
}

let lidos: Entrada[] | null = null;
function todos(): Entrada[] {
  if (!lidos) {
    const arquivo = path.join(process.cwd(), "content", "lambes.json");
    const lista = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Entrada[];
    const dias = new Set<string>();
    for (const item of lista) {
      const { linhas, texto, carimbo } = item.pt ?? {};
      if (!item.id || !Array.isArray(linhas) || linhas.length !== 3 || !texto) throw new Error(`content/lambes.json: "${item.id}" precisa de três linhas e do texto em português`);
      if (!Array.isArray(carimbo) || carimbo.length !== 2) throw new Error(`content/lambes.json: "${item.id}" precisa das duas linhas do carimbo`);
      if (!/^\d{2}-\d{2}$/.test(item.dia) || dias.has(item.dia)) throw new Error(`content/lambes.json: "${item.id}" tem o dia "${item.dia}" inválido ou repetido`);
      if (typeof item.xilo !== "string" || item.xilo.split("/").length !== 3) throw new Error(`content/lambes.json: "${item.id}" precisa da xilogravura`);
      if (item.formato !== undefined && !(FORMATOS as readonly string[]).includes(item.formato)) throw new Error(`content/lambes.json: "${item.id}" tem o formato "${item.formato}", que não existe`);
      dias.add(item.dia);
    }
    if (dias.size !== 366) throw new Error(`content/lambes.json: são ${dias.size} dias, precisam ser os 366 do ano`);
    lidos = lista.sort((a, b) => a.dia.localeCompare(b.dia));
  }
  return lidos;
}

interface Propria extends Entrada {
  /** O nome da data (para quem lê o arquivo e os testes). */
  nome: string;
}

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

let proprias: Propria[] | null = null;
/** Os cartazes próprios das datas especiais (content/lambes-datas.json): um por data, nos seis idiomas. */
export function cartazesProprios(): Propria[] {
  if (!proprias) {
    const arquivo = path.join(process.cwd(), "content", "lambes-datas.json");
    const lista = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Propria[];
    const dias = new Set<string>();
    for (const item of lista) {
      if (!item.id || !item.nome) throw new Error(`content/lambes-datas.json: "${item.id}" precisa do id e do nome da data`);
      if (!/^\d{2}-\d{2}$/.test(item.dia) || dias.has(item.dia)) throw new Error(`content/lambes-datas.json: "${item.id}" tem o dia "${item.dia}" inválido ou repetido`);
      if (typeof item.xilo !== "string" || item.xilo.split("/").length !== 3) throw new Error(`content/lambes-datas.json: "${item.id}" precisa da xilogravura`);
      if (item.formato !== undefined && !(FORMATOS as readonly string[]).includes(item.formato)) throw new Error(`content/lambes-datas.json: "${item.id}" tem o formato "${item.formato}", que não existe`);
      for (const lang of IDIOMAS) {
        const l = item[lang];
        if (typeof l !== "object" || !l || !Array.isArray(l.linhas) || l.linhas.length !== 3 || !l.texto || !Array.isArray(l.carimbo) || l.carimbo.length !== 2) {
          throw new Error(`content/lambes-datas.json: "${item.id}" precisa das três linhas, do texto e do carimbo em ${lang}`);
        }
      }
      dias.add(item.dia);
    }
    proprias = lista;
  }
  return proprias;
}

function noIdioma(item: Entrada, lang: Locale): Lambe {
  const traduzido = item[lang];
  const lambe = typeof traduzido === "object" && traduzido ? traduzido : item.pt;
  return { ...lambe, carimbo: lambe.carimbo ?? item.pt.carimbo };
}

/** O cartaz do estoque (content/lambes.json) mais ligado a um dia especial (veja DATAS_ESPECIAIS), ou null num dia comum. */
const notas = new Map<string, { item: Entrada; numero: number } | null>();
function doEstoqueParaAData(dia: number): { item: Entrada; numero: number } | null {
  const lista = todos();
  const md = mesEDia(dia);
  const data = dataEspecial(dia);
  // A escolha só depende do dia do ano e da data especial (o Dia das Mães muda de dia a cada ano): guarda a conta.
  const chave = `${md}|${data?.nome ?? ""}`;
  if (notas.has(chave)) return notas.get(chave) ?? null;
  const doDia = lista.findIndex((item) => item.dia === md);
  // Dia especial: está no mapa de datas, ou o próprio estoque marcou o cartaz daquele dia como festa.
  if (!data && lista[doDia]?.formato !== "festa") {
    notas.set(chave, null);
    return null;
  }
  let melhor = -1;
  let nota = 0;
  lista.forEach((item, i) => {
    const n = notaDoCartaz({ dia: item.dia, id: item.id, lambe: item.pt }, md, data);
    if (n > nota) [melhor, nota] = [i, n];
  });
  const achado = melhor < 0 ? null : { item: lista[melhor], numero: melhor + 1 };
  notas.set(chave, achado);
  return achado;
}

/**
 * O cartaz de uma data especial, ou null num dia comum. Primeiro o próprio da data (content/lambes-datas.json, numerado
 * depois do estoque: 367, 368…); senão, o do estoque que mais combina com ela.
 */
export function cartazDaData(dia: number): { item: Entrada; numero: number } | null {
  const md = mesEDia(dia);
  const lista = cartazesProprios();
  const i = lista.findIndex((p) => p.dia === md);
  if (i >= 0) return { item: lista[i], numero: todos().length + i + 1 };
  return doEstoqueParaAData(dia);
}

let comuns: { item: Entrada; numero: number }[] | null = null;
/**
 * Os cartazes dos dias comuns: o estoque inteiro menos os que o estoque reserva para as datas especiais. A conta passa por
 * anos fixos (2024 a 2035: todos os dias em que o Dia das Mães e o dos Pais podem cair, e o 29 de fevereiro), para a
 * lista não mudar conforme o dia em que a página foi montada; assim a escolha de cada dia é sempre a mesma.
 */
function cartazesComuns(): { item: Entrada; numero: number }[] {
  if (!comuns) {
    const reservados = new Set<number>();
    const proprios = new Set(cartazesProprios().map((p) => p.dia));
    const inicio = Math.floor(Date.UTC(2024, 0, 1) / 86_400_000);
    const fim = Math.floor(Date.UTC(2036, 0, 1) / 86_400_000);
    for (let d = inicio; d < fim; d++) {
      if (proprios.has(mesEDia(d))) continue;
      const achado = doEstoqueParaAData(d);
      if (achado) reservados.add(achado.numero);
    }
    comuns = todos()
      .map((item, i) => ({ item, numero: i + 1 }))
      .filter((n) => !reservados.has(n.numero));
  }
  return comuns;
}

/**
 * O cartaz de um dia (dia contado como em diaDe, no fuso de São Paulo): o da data, nas datas especiais; nos outros dias,
 * um dos comuns, escolhido pela conta fixa lambeDoDia (passo que não divide o tamanho da lista: dias seguidos não trazem
 * vizinhos do arquivo e a lista inteira passa antes de algum se repetir). Igual para todo mundo, sem sorteio.
 */
export function cartazDoDia(dia: number): { item: Entrada; numero: number } {
  const especial = cartazDaData(dia);
  if (especial) return especial;
  const lista = cartazesComuns();
  return lista[lambeDoDia(dia, lista.length)];
}

/**
 * O lambe-lambe de hoje e dos próximos `dias` dias, para a página inicial. A página é montada no servidor e refeita de
 * hora em hora (revalidate), então pode chegar ao navegador montada num dia anterior: o navegador escolhe nesta lista o
 * cartaz do dia de hoje (components/inicio/LambeDoDia.tsx). Como a escolha é fixa por data, o servidor e o navegador
 * chegam sempre ao mesmo cartaz, e todo mundo vê o mesmo no mesmo dia.
 */
export function lambesDoCartaz(lang: Locale, dias = 40): LambeDoDia[] {
  const hoje = diaDe(new Date());
  return Array.from({ length: dias }, (_, i) => {
    const { item, numero } = cartazDoDia(hoje + i);
    return { dia: hoje + i, numero, lambe: noIdioma(item, lang), xilo: item.xilo, formato: item.formato ?? "grito" };
  });
}
