// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { FORMATOS, type Formato, type Lambe, type LambeDoDia, dataEspecial, diaDe, mesEDia, notaDoCartaz } from "./lambe-do-dia";

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


/**
 * Os lambe-lambes dos próximos dias, a partir do dia da montagem da página. As datas de festa e de luta (formato
 * "festa") caem no próprio dia; nos outros dias o cartaz sai embaralhado do resto do estoque, sem repetir até o estoque
 * acabar, para não andar em ordem. A página inicial é estática: o navegador escolhe entre estes o do dia de hoje, e
 * assim todo mundo vê o mesmo cartaz no mesmo dia (passado o fim da lista, fica o último).
 */
export function lambesDaSemana(lang: Locale, dias = 40): LambeDoDia[] {
  const lista = todos();
  const numerados = lista.map((item, i) => ({ item, numero: i + 1 }));
  const datas = new Map(numerados.filter((n) => n.item.formato === "festa").map((n) => [n.item.dia, n]));
  const soltos = numerados.filter((n) => n.item.formato !== "festa");
  // Passo primo com o tamanho do estoque: percorre todos antes de repetir, fora de ordem.
  const passo = soltos.length % 137 === 0 ? 139 : 137;
  const hoje = diaDe(new Date());
  return Array.from({ length: dias }, (_, i) => {
    const dia = hoje + i;
    const achado = datas.get(mesEDia(dia)) ?? soltos[(((dia * passo + 71) % soltos.length) + soltos.length) % soltos.length] ?? numerados[0];
    const traduzido = achado.item[lang];
    const lambe = typeof traduzido === "object" && traduzido ? traduzido : achado.item.pt;
    return { dia, numero: achado.numero, lambe: { ...lambe, carimbo: lambe.carimbo ?? achado.item.pt.carimbo }, xilo: achado.item.xilo, formato: achado.item.formato ?? "grito" };
  });
}

function noIdioma(item: Entrada, lang: Locale): Lambe {
  const traduzido = item[lang];
  const lambe = typeof traduzido === "object" && traduzido ? traduzido : item.pt;
  return { ...lambe, carimbo: lambe.carimbo ?? item.pt.carimbo };
}

/** O cartaz mais ligado a um dia especial (veja DATAS_ESPECIAIS em lib/lambe-do-dia.ts), ou null num dia comum. */
export function cartazDaData(dia: number): { item: Entrada; numero: number } | null {
  const lista = todos();
  const md = mesEDia(dia);
  const data = dataEspecial(dia);
  const doDia = lista.findIndex((item) => item.dia === md);
  // Dia especial: está no mapa de datas, ou o próprio estoque marcou o cartaz daquele dia como festa.
  if (!data && lista[doDia]?.formato !== "festa") return null;
  let melhor = -1;
  let nota = 0;
  lista.forEach((item, i) => {
    const n = notaDoCartaz({ dia: item.dia, id: item.id, lambe: item.pt }, md, data);
    if (n > nota) [melhor, nota] = [i, n];
  });
  return melhor < 0 ? null : { item: lista[melhor], numero: melhor + 1 };
}

/**
 * O lambe-lambe do dia (T16, 06/11/2026), em duas partes, para a página estática:
 * - `datas`: os dias especiais entre os próximos `dias`, cada um com o cartaz mais ligado à data (o mesmo para todos);
 * - `sorteio`: cartazes de dias comuns, dos quais o navegador sorteia um por dia e por aparelho (Math.random, guardado
 *   só no localStorage do aparelho, sem mandar nada a ninguém). Os cartazes das datas especiais não entram no sorteio,
 *   para continuarem ligados ao seu dia. O servidor embaralha o estoque e manda uma amostra de `amostra` cartazes, para
 *   a página não carregar os 366 (peso, docs/ACESSIBILIDADE-E-PESO.md).
 */
export function lambesDoCartaz(lang: Locale, dias = 40, amostra = 36): { datas: LambeDoDia[]; sorteio: LambeDoDia[] } {
  const lista = todos();
  const hoje = diaDe(new Date());
  const datas: LambeDoDia[] = [];
  const reservados = new Set<number>();
  for (let i = 0; i < dias; i++) {
    const achado = cartazDaData(hoje + i);
    if (!achado) continue;
    reservados.add(achado.numero);
    datas.push({ dia: hoje + i, numero: achado.numero, lambe: noIdioma(achado.item, lang), xilo: achado.item.xilo, formato: achado.item.formato ?? "grito" });
  }
  // Todos os cartazes das datas especiais do ano ficam fora do sorteio, não só os destes dias.
  for (let d = 0; d < 366; d++) {
    const achado = cartazDaData(hoje + d);
    if (achado) reservados.add(achado.numero);
  }
  const soltos = lista.map((item, i) => ({ item, numero: i + 1 })).filter((n) => !reservados.has(n.numero));
  // Embaralha (Fisher-Yates) e fica com uma amostra: muda a cada montagem da página.
  for (let i = soltos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [soltos[i], soltos[j]] = [soltos[j], soltos[i]];
  }
  const sorteio = soltos.slice(0, amostra).map(({ item, numero }) => ({ dia: hoje, numero, lambe: noIdioma(item, lang), xilo: item.xilo, formato: item.formato ?? "grito" }));
  return { datas, sorteio };
}
