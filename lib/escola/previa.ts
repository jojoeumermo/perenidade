// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dados de EXEMPLO da prévia de desenvolvimento da Escola (lib/escola/acesso.ts, só com NODE_ENV "development" e
// ?previa=militante). São os da prancha aprovada em 07/11 (codinomes inventados, núcleo inventado): nada aqui é pessoa
// ou núcleo de verdade. Este arquivo só é carregado por import() dinâmico dentro do bloco de desenvolvimento.

import type { EscolaEuDentro, FuncaoDaEscola, FuncoesDaEscola } from "./contratos";

export const EU_DE_EXEMPLO: EscolaEuDentro = {
  militante: true,
  conta: true,
  codinome: "Faísca",
  handle: "faisca",
  degrau: 2,
  frente: "bairros",
  nucleo: { id: "00000000-0000-4000-8000-000000000001", nome: "Núcleo Zona Leste" },
  acompanha: { codinome: "Jurema", handle: "jurema" },
  desde: "2026-09-01",
  publico: "ninguem",
  coordena: false,
};

/** A próxima segunda-feira, 19h de Brasília (22h UTC). */
function proximaSegunda(): string {
  const d = new Date();
  const faltam = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + faltam);
  d.setUTCHours(22, 0, 0, 0);
  return d.toISOString();
}

const EXEMPLOS: { [N in FuncaoDaEscola]?: FuncoesDaEscola[N]["volta"] } = {
  escola_eu: EU_DE_EXEMPLO,
  escola_nucleo: {
    nucleo: EU_DE_EXEMPLO.nucleo,
    proximo: { id: "e1", quando: proximaSegunda(), pauta: [{ texto: "Balanço da panfletagem" }, { texto: "O caderno 03" }], tarefas: [] },
    presenca: [],
    medeia: false,
  },
  escola_pergunta_da_semana: { semana: "2026-11-09", texto: "Quando foi a última vez que você mudou de ideia, e quem te convenceu?" },
  escola_recados: [
    { id: "r1", texto: "Círculo de estudo aberto no sábado, 10h: caderno 08, Análise de conjuntura.", ate: "2099-12-31", nucleo: null },
    { id: "r2", texto: "A assembleia do semestre vota a pauta até domingo.", ate: "2099-12-31", nucleo: null },
  ],
  // escola_aulas_hoje fica de fora de propósito: a prévia também mostra o vazio honesto de uma função que não existe.
};

export function exemploDe(nome: FuncaoDaEscola): unknown {
  return EXEMPLOS[nome];
}
