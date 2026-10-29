// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { type Lambe, type LambeDoDia, diaDe } from "./lambe-do-dia";

interface Entrada {
  id: string;
  /** O dia do ano em que ele sai, "MM-DD" (29 de fevereiro incluído: são 366). */
  dia: string;
  /** A vinheta de xilogravura do mesmo tema ("motivo/ceu/chao", veja lib/xilogravuras.ts). */
  xilo: string;
  pt: Lambe;
  [lang: string]: Lambe | string;
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
 * Os lambe-lambes dos próximos dias, a partir do dia da montagem da página. Cada dia do ano tem o seu (as datas de luta
 * caem no próprio dia), com o carimbo e a xilogravura do mesmo tema. A página inicial é estática: o navegador escolhe
 * entre estes o do dia de hoje, e assim todo mundo vê o mesmo cartaz no mesmo dia (passado o fim da lista, fica o último).
 */
export function lambesDaSemana(lang: Locale, dias = 40): LambeDoDia[] {
  const lista = todos();
  const porDia = new Map(lista.map((item, i) => [item.dia, { item, numero: i + 1 }]));
  const hoje = diaDe(new Date());
  return Array.from({ length: dias }, (_, i) => {
    const dia = hoje + i;
    const achado = porDia.get(mesEDia(dia)) ?? { item: lista[0], numero: 1 };
    const traduzido = achado.item[lang];
    const lambe = typeof traduzido === "object" && traduzido ? traduzido : achado.item.pt;
    return { dia, numero: achado.numero, lambe: { ...lambe, carimbo: lambe.carimbo ?? achado.item.pt.carimbo }, xilo: achado.item.xilo };
  });
}
