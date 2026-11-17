// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da turma de estudo (frente 11C): as funções alumia_turma_* de
// supabase/migracoes/20261117-alumia-o11-turma.sql. Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na
// memória da aba faz a tela andar, com os mesmos números da regra (nada abaixo de 3).
import { BackendError, rpc } from "@/lib/backend";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { LIMITES_DA_TURMA, limparCodigo, MINIMO, segundaDe, somarDias, type Turma } from "./regras";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───── O dublê da prévia: a Faísca está em duas turmas (cuida de uma) ─────
interface TurmaDoDuble extends Omit<Turma, "pessoas" | "total" | "semana"> {
  gente: number;
  outrasMarcas: number;
  fechadas: (number | null)[];
}
const semanaAgora = () => segundaDe(Date.now());
let turmasDaPrevia: TurmaDoDuble[] = [
  { id: "t-redacao", nome: "Redação de sábado", meta: "1 redação por semana", codigo: "rd7k2m9qxa", cuida: false, marquei: true, gente: 7, outrasMarcas: 3, fechadas: [4, null, 3, 3, 4, null, 3, 4], semanas: [] },
  { id: "t-exatas", nome: "Exatas da quebrada", meta: "3 listas de exercícios por semana", codigo: "ex4p8w2nbc", cuida: true, marquei: false, gente: 2, outrasMarcas: 1, fechadas: [null, null, null], semanas: [] },
];
const numero = (n: number) => (n >= MINIMO ? n : null);
/** O total como o banco publica: só com ao menos 3 que marcaram e ao menos 3 que não (interno.alumia_o11t_total). */
const totalVisto = (n: number, gente: number) => (n >= MINIMO && gente - n >= MINIMO ? n : null);
function vista(t: TurmaDoDuble): Turma {
  const semana = semanaAgora();
  return {
    id: t.id,
    nome: t.nome,
    meta: t.meta,
    codigo: t.codigo,
    cuida: t.cuida,
    marquei: t.marquei,
    semana,
    pessoas: numero(t.gente),
    total: totalVisto(t.outrasMarcas + (t.marquei ? 1 : 0), t.gente),
    semanas: t.fechadas.map((total, i) => ({ semana: somarDias(semana, -7 * (t.fechadas.length - i)), total: total === null ? null : totalVisto(total, t.gente) })),
  };
}
function achar(id: string): TurmaDoDuble {
  const t = turmasDaPrevia.find((x) => x.id === id);
  if (!t) throw new BackendError("nao_encontrado");
  return t;
}
function trocar(id: string, mudar: (t: TurmaDoDuble) => TurmaDoDuble): Turma {
  const novo = mudar(achar(id));
  turmasDaPrevia = turmasDaPrevia.map((x) => (x.id === id ? novo : x));
  return vista(novo);
}
const codigoNovo = () => Array.from({ length: 10 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join("");

export const turmas = {
  minhas: async (): Promise<Turma[]> => {
    if (previaLigada()) return turmasDaPrevia.map(vista);
    return (await rpc<{ itens: Turma[] }>("alumia_turma_minhas")).itens;
  },

  criar: async (nome: string, meta: string): Promise<Turma> => {
    if (previaLigada()) {
      await espera(250);
      if (nome.trim().length < LIMITES_DA_TURMA.nomeMin) throw new BackendError("invalido:nome");
      if (meta.trim().length < LIMITES_DA_TURMA.metaMin) throw new BackendError("invalido:meta");
      if (turmasDaPrevia.length >= LIMITES_DA_TURMA.turmasPorPessoa) throw new BackendError("limite_de_turmas");
      const t: TurmaDoDuble = { id: `t-${Date.now()}`, nome: nome.trim(), meta: meta.trim(), codigo: codigoNovo(), cuida: true, marquei: false, gente: 1, outrasMarcas: 0, fechadas: [], semanas: [] };
      turmasDaPrevia = [...turmasDaPrevia, t];
      return vista(t);
    }
    return rpc<Turma>("alumia_turma_criar", { p_nome: nome, p_meta: meta });
  },

  entrar: async (codigo: string): Promise<Turma> => {
    if (previaLigada()) {
      await espera(300);
      const c = limparCodigo(codigo);
      const ja = turmasDaPrevia.find((t) => t.codigo === c);
      if (ja) return vista(ja);
      if (!c) throw new BackendError("nao_encontrado");
      const t: TurmaDoDuble = { id: `t-${c}`, nome: "Humanas no bairro", meta: "1 resumo de texto por semana", codigo: c, cuida: false, marquei: false, gente: 5, outrasMarcas: 2, fechadas: [4, 3, null, 5], semanas: [] };
      turmasDaPrevia = [...turmasDaPrevia, t];
      return vista(t);
    }
    return rpc<Turma>("alumia_turma_entrar", { p_codigo: codigo });
  },

  marcar: async (id: string, sim: boolean): Promise<Turma> => {
    if (previaLigada()) {
      await espera(200);
      return trocar(id, (t) => ({ ...t, marquei: sim }));
    }
    return rpc<Turma>("alumia_turma_marcar", { p_turma: id, p_sim: sim });
  },

  editar: async (id: string, nome: string, meta: string): Promise<Turma> => {
    if (previaLigada()) {
      await espera(200);
      return trocar(id, (t) => ({ ...t, nome: nome.trim(), meta: meta.trim() }));
    }
    return rpc<Turma>("alumia_turma_editar", { p_turma: id, p_nome: nome, p_meta: meta });
  },

  novoCodigo: async (id: string): Promise<Turma> => {
    if (previaLigada()) {
      await espera(200);
      return trocar(id, (t) => ({ ...t, codigo: codigoNovo() }));
    }
    return rpc<Turma>("alumia_turma_novo_codigo", { p_turma: id });
  },

  sair: async (id: string): Promise<void> => {
    if (previaLigada()) {
      await espera(200);
      turmasDaPrevia = turmasDaPrevia.filter((t) => t.id !== id);
      return;
    }
    await rpc("alumia_turma_sair", { p_turma: id });
  },
};
