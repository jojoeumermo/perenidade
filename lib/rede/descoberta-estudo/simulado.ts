// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 69 (Prompt 4): o simulado ao vivo da turma, a parte do aparelho. As respostas da pessoa ficam AQUI também
// ("lucia:p4-de:simulados", por 40 dias), porque o banco as apaga no fim do simulado (só a faixa da turma fica, e só com 3 pessoas ou
// mais). Assim a pessoa confere a dela com o gabarito, que só sai depois do fim. Sem "@/" de propósito (roda nos testes).
import { gravarNoAparelho, lerDoAparelho, type Guarda } from "./aparelho";

const QUARENTA_DIAS = 40 * 864e5;

type Guardadas = Record<string, { em: number; respostas: number[] }>;

function todas(g?: Guarda | null, agora = Date.now()): Guardadas {
  const v = lerDoAparelho<Guardadas>("simulados", g) ?? {};
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x && Array.isArray(x.respostas) && agora - x.em < QUARENTA_DIAS));
}

export function minhasRespostas(id: string, g?: Guarda | null): number[] | null {
  return todas(g)[id]?.respostas ?? null;
}

export function guardarRespostas(id: string, respostas: number[], g?: Guarda | null, agora = Date.now()): void {
  gravarNoAparelho("simulados", { ...todas(g, agora), [id]: { em: agora, respostas: respostas.map((x) => (Number.isInteger(x) && x >= -1 && x <= 4 ? x : -1)) } }, g);
}

/** Quantas a pessoa acertou (só ela vê; nada disso vai ao banco). */
export function acertos(questoes: readonly { certa?: number }[], respostas: readonly number[] | null): number | null {
  if (!respostas || questoes.some((q) => typeof q.certa !== "number")) return null;
  return questoes.reduce((n, q, i) => n + (respostas[i] === q.certa ? 1 : 0), 0);
}
