// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dados de EXEMPLO do núcleo para a prévia de desenvolvimento (lib/escola/nucleo.ts, só com NODE_ENV "development" e
// ?previa=militante). São os da prancha aprovada Cel-Núcleo (07/11): codinomes e núcleo INVENTADOS, nada aqui é pessoa
// ou núcleo de verdade. Só é carregado por import() dinâmico dentro do bloco de desenvolvimento; as ações mudam esta
// memória (para ver "Eu levo" funcionar) e somem ao recarregar.

import type { FuncaoDoNucleo, MilitanteDoPainel, NucleoCompleto, ResumoDoPainel, BancaListada, Acompanhado, Resposta } from "@/lib/escola/nucleo";
import type { PerguntaDaSemana, RecadoDaFormacao } from "@/lib/escola/contratos";

const NUCLEO = { id: "00000000-0000-4000-8000-000000000001", nome: "Núcleo Zona Leste" };
const EU = { codinome: "Faísca", handle: "faisca" };

function proximaSegunda(dias = 0): string {
  const d = new Date();
  const faltam = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + faltam + dias);
  d.setUTCHours(22, 0, 0, 0);
  return d.toISOString();
}
const semanasAtras = (n: number) => new Date(Date.now() - n * 7 * 86400000).toISOString();

const nucleo: NucleoCompleto = {
  nucleo: NUCLEO,
  medeia: true,
  proximo: {
    id: "exemplo-encontro",
    quando: proximaSegunda(),
    pauta: [{ texto: "Mística de abertura (5 min)" }, { texto: "Balanço da panfletagem no terminal" }, { texto: "Roda do caderno 03: a conversa difícil de cada um" }, { texto: "Encaminhamentos e quem faz o quê" }],
    tarefas: [
      { id: "t1", item: "Facilitar a roda", quem: EU, minha: true, feito: false, repete: false },
      { id: "t2", item: "Ata da reunião", quem: { codinome: "Jurema", handle: "jurema" }, minha: false, feito: false, repete: false },
      { id: "t3", item: "Levar o lanche", quem: null, minha: false, feito: false, repete: false },
    ],
  },
  anterior: { id: "exemplo-anterior", quando: semanasAtras(1), presenca: 12, balanco: "EXEMPLO. Ver: a panfletagem no terminal rendeu conversa. Julgar: faltou material para quem pedia mais. Agir: imprimir mais e voltar na quinta." },
  presenca: [
    { quando: semanasAtras(4), presenca: 9 },
    { quando: semanasAtras(3), presenca: 11 },
    { quando: semanasAtras(2), presenca: 8 },
    { quando: semanasAtras(1), presenca: 12 },
  ],
};

let pergunta: PerguntaDaSemana | null = { semana: "2026-11-09", texto: "Quando foi a última vez que você mudou de ideia, e quem te convenceu?" };
let recados: RecadoDaFormacao[] = [{ id: "r1", texto: "EXEMPLO: círculo de estudo aberto no sábado, 10h.", ate: "2099-12-31", nucleo: null }];
let bancas: BancaListada[] = [
  { id: "b1", usuario: "00000000-0000-4000-8000-0000000000a1", militante: EU, degrau: 2, quando: proximaSegunda(14), situacao: "marcada", balanco: "", minha: true, decido: false },
  { id: "b2", usuario: "00000000-0000-4000-8000-0000000000c1", militante: { codinome: "Caju", handle: "caju" }, degrau: 1, quando: proximaSegunda(7), situacao: "marcada", balanco: "", minha: false, decido: true },
];
const acompanho: Acompanhado[] = [{ codinome: "Caju", handle: "caju", usuario: "00000000-0000-4000-8000-0000000000c1", degrau: 1, banca_marcada: true }];
let militantes: MilitanteDoPainel[] = [
  { usuario: "00000000-0000-4000-8000-0000000000a1", codinome: "Faísca", degrau: 2, frente: "bairros", nucleo: NUCLEO, acompanha: { codinome: "Jurema", handle: "jurema" }, acompanha_id: "00000000-0000-4000-8000-0000000000a2", desde: "2026-09-01" },
  { usuario: "00000000-0000-4000-8000-0000000000a2", codinome: "Jurema", degrau: 3, frente: "cultura", nucleo: NUCLEO, acompanha: null, acompanha_id: null, desde: "2025-03-10" },
  { usuario: "00000000-0000-4000-8000-0000000000c1", codinome: "Caju", degrau: 1, frente: null, nucleo: null, acompanha: null, acompanha_id: null, desde: "2026-10-20" },
  { usuario: "00000000-0000-4000-8000-0000000000a3", codinome: null, degrau: 1, frente: null, nucleo: null, acompanha: null, acompanha_id: null, desde: "2026-11-02" },
];

const ok = <T,>(dados: T): Resposta<T> => ({ ok: true, dados });
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** O que a função devolveria no banco, com os exemplos. Ações mudam a memória desta prévia. */
export function exemploDoNucleo(nome: FuncaoDoNucleo, args: Record<string, unknown>): Resposta<unknown> {
  switch (nome) {
    case "escola_nucleo":
      return ok(copia(nucleo));
    case "escola_tarefa_pegar": {
      const t = nucleo.proximo?.tarefas.find((x) => x.id === args.p_id);
      if (!t) return { ok: false, motivo: "nao_encontrado" };
      if (args.p_pegar) {
        if (t.quem && !t.minha) return { ok: false, motivo: "ja_tem_quem" };
        Object.assign(t, { quem: EU, minha: true });
      } else Object.assign(t, { quem: null, minha: false, feito: false });
      return ok({ ok: true });
    }
    case "escola_levar_ao_nucleo": {
      const p = nucleo.proximo;
      if (!p) return { ok: false, motivo: "sem_encontro" };
      if (p.pauta.length >= 12) return { ok: false, motivo: "pauta_cheia" };
      p.pauta.push({ texto: String(args.p_texto ?? "").trim(), levado: true });
      return ok({ ok: true });
    }
    case "escola_encontro_salvar": {
      const p = args.p as { quando: string; pauta: { texto: string }[]; tarefas?: { item: string }[]; presenca?: number | null; balanco?: string; id?: string };
      if (p.id && p.id === nucleo.anterior?.id) {
        Object.assign(nucleo.anterior, { presenca: p.presenca ?? null, balanco: p.balanco ?? "" });
        return ok({ ok: true, id: p.id });
      }
      const velhas = nucleo.proximo?.tarefas ?? [];
      nucleo.proximo = {
        id: "exemplo-encontro",
        quando: p.quando,
        pauta: p.pauta,
        tarefas: (p.tarefas ?? velhas).map((t, i) => velhas.find((v) => v.item.toLowerCase() === t.item.toLowerCase()) ?? { id: `n${i}`, item: t.item, quem: null, minha: false, feito: false, repete: false }),
      };
      return ok({ ok: true, id: "exemplo-encontro" });
    }
    case "escola_pergunta_da_semana":
      return ok(pergunta);
    case "escola_pergunta_definir": {
      const p = args.p as { semana: string; texto: string };
      pergunta = p.texto.trim() ? { semana: p.semana, texto: p.texto.trim() } : null;
      return ok({ ok: true });
    }
    case "escola_recados":
      return ok(copia(recados));
    case "escola_recado_salvar": {
      const p = args.p as { id?: string; texto: string; ate: string; nucleo?: string | null; apagar?: boolean };
      if (p.apagar) recados = recados.filter((r) => r.id !== p.id);
      else recados = [...recados, { id: `r${recados.length + 2}`, texto: p.texto, ate: p.ate, nucleo: p.nucleo ?? null }];
      return ok({ ok: true });
    }
    case "escola_bancas_listar":
      return ok(copia(bancas));
    case "escola_acompanho":
      return ok(copia(acompanho));
    case "escola_banca_marcar":
      return ok({ ok: true, id: "b-nova" });
    case "escola_banca_decidir": {
      bancas = bancas.map((b) => (b.id === args.p_id ? { ...b, situacao: args.p_situacao as BancaListada["situacao"], balanco: String(args.p_balanco), decido: false } : b));
      return ok({ ok: true });
    }
    case "escola_acompanhar":
    case "escola_militante_ajustar": {
      const p = (args.p ?? {}) as { usuario?: string; degrau?: 1 | 2 | 3 };
      if (p.usuario && p.degrau) militantes = militantes.map((m) => (m.usuario === p.usuario ? { ...m, degrau: p.degrau as 1 | 2 | 3 } : m));
      return ok({ ok: true });
    }
    case "escola_militantes_listar":
      return ok(copia(militantes));
    case "escola_painel_resumo": {
      const resumo: ResumoDoPainel = {
        nucleos: [{ id: NUCLEO.id, nome: NUCLEO.nome, cidade: "São Paulo", militantes: 2 }],
        recados: copia(recados),
        perguntas: pergunta ? [pergunta] : [],
        semana: "2026-11-09",
      };
      return ok(resumo);
    }
  }
  return { ok: false, motivo: "ausente" };
}
