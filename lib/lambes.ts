// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { FORMATOS, type Formato, type Lambe, type LambeDoDia, diaDe } from "./lambe-do-dia";

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

/** "MM-DD" de um dia (contado como em diaDe: dias desde 01/01/1970, no fuso de Brasília). */
const mesEDia = (dia: number) => new Date(dia * 86_400_000).toISOString().slice(5, 10);

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
