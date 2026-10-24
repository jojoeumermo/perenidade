// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { type Lambe, diaDe, lambeDoDia } from "./lambe-do-dia";

interface Entrada {
  id: string;
  pt: Lambe;
  [lang: string]: Lambe | string;
}

let lidos: Entrada[] | null = null;
function todos(): Entrada[] {
  if (!lidos) {
    const arquivo = path.join(process.cwd(), "content", "lambes.json");
    const lista = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Entrada[];
    for (const item of lista) {
      const linhas = item.pt?.linhas;
      if (!item.id || !Array.isArray(linhas) || linhas.length !== 3 || !item.pt.texto) throw new Error(`content/lambes.json: "${item.id}" precisa de três linhas e do texto em português`);
    }
    lidos = lista;
  }
  return lidos;
}

/**
 * Os lambe-lambes dos próximos dias, a partir do dia da montagem da página. A página inicial é estática: o navegador
 * escolhe entre estes o do dia de hoje, e assim todo mundo vê o mesmo cartaz no mesmo dia, mesmo semanas depois do
 * último build (passado o fim da lista, fica o último).
 */
export function lambesDaSemana(lang: Locale, dias = 21): { dia: number; numero: number; lambe: Lambe }[] {
  const lista = todos();
  const hoje = diaDe(new Date());
  return Array.from({ length: dias }, (_, i) => {
    const dia = hoje + i;
    const indice = lambeDoDia(dia, lista.length);
    const item = lista[indice];
    const traduzido = item[lang];
    return { dia, numero: indice + 1, lambe: typeof traduzido === "object" && traduzido ? traduzido : item.pt };
  });
}
