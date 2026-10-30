// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura, no navegador, de uma prova oficial: as questões que o importador grava em public/questoes/enem-<ano>.json
// e a camada do instituto (/<idioma>/enem/oficiais/<ano>), juntas pelo id. Só arquivos do próprio site.

import { areaPelaNumeracao, type QuestaoImportada } from "@/lib/enem";
import type { QuestaoDaCamada } from "@/lib/enem-camada";

export interface QuestaoOficial extends QuestaoImportada {
  dia: 1 | 2;
  /** A área pela numeração do caderno (a da fonte tem erros). */
  areaAuditada: string;
  camada?: QuestaoDaCamada;
}

const guardadas = new Map<string, Promise<QuestaoOficial[]>>();

export function carregarProva(ano: number, lang: string): Promise<QuestaoOficial[]> {
  const chave = `${lang}-${ano}`;
  const pronta = guardadas.get(chave);
  if (pronta) return pronta;
  const promessa = Promise.all([
    fetch(`/questoes/enem-${ano}.json`).then((r) => (r.ok ? (r.json() as Promise<{ questoes: QuestaoImportada[] }>) : Promise.reject(new Error(String(r.status))))),
    fetch(`/${lang}/enem/oficiais/${ano}`).then((r) => (r.ok ? (r.json() as Promise<{ questoes: QuestaoDaCamada[] }>) : { questoes: [] })),
  ]).then(([prova, camada]) => {
    const porId = new Map(camada.questoes.map((c) => [c.id, c]));
    const vistos = new Set<string>();
    const saida: QuestaoOficial[] = [];
    // A fonte às vezes repete uma questão com o mesmo id: fica a primeira.
    for (const q of prova.questoes) {
      if (vistos.has(q.id)) continue;
      vistos.add(q.id);
      const lugar = areaPelaNumeracao(ano, q.n);
      if (!lugar) continue;
      saida.push({ ...q, dia: lugar.dia, areaAuditada: lugar.area, camada: porId.get(q.id) });
    }
    return saida.sort((a, b) => a.n - b.n || a.id.localeCompare(b.id));
  });
  promessa.catch(() => guardadas.delete(chave));
  guardadas.set(chave, promessa);
  return promessa;
}

/** As questões de um dia, com a língua estrangeira escolhida (as outras línguas saem). */
export function doDia(questoes: QuestaoOficial[], dia: 1 | 2, lingua: string): QuestaoOficial[] {
  return questoes.filter((q) => q.dia === dia && (!q.lingua || q.lingua === lingua));
}

export const LETRAS = "ABCDE";
