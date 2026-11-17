// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As chamadas do banco de questões (frente 11A) ao banco (supabase/migracoes/20261117-alumia-o11-texto.sql). Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória da aba (./exemplos): nada sai do aparelho.
import { chamar } from "@/lib/rede/cliente";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { duble } from "./exemplos";
import type { QuestaoParaEnviar } from "./regras";
import type { Materias, MotivoDaDenuncia, PaginaDeQuestoes, Questao, QuestaoCompleta, QuestaoDenunciada, Resposta } from "./tipos";

const c = <T>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => (previaDaAlumiaLigada() ? duble<T>(funcao, argumentos) : chamar<T>(funcao, argumentos));

export const questoes = {
  materias: () => c<Materias>("rede_questoes_materias"),
  temas: (materia: string) => c<{ materia: string; temas: { tema: string; questoes: number }[] }>("rede_questoes_temas", { p_materia: materia }),
  lista: (materia: string, tema: string | null, cursor: string | null = null) =>
    c<PaginaDeQuestoes>("rede_questoes", { p_materia: materia, p_tema: tema, p_cursor: cursor, p_limite: 20 }),
  uma: (id: string) => c<Questao>("rede_questao", { p_id: id }),
  responder: (id: string, escolha: number) => c<Resposta>("rede_questao_responder", { p_id: id, p_escolha: escolha }),
  minhas: () => c<{ itens: QuestaoCompleta[] }>("rede_questoes_minhas"),
  salvar: (id: string | null, q: QuestaoParaEnviar) =>
    c<{ id: string; criada: boolean }>("rede_questao_salvar", {
      p_id: id,
      p_materia: q.materia,
      p_tema: q.tema,
      p_enunciado: q.enunciado,
      p_alternativas: q.alternativas,
      p_certa: q.certa,
      p_explicacao: q.explicacao,
    }),
  apagar: (id: string) => c<{ apagada: boolean }>("rede_questao_apagar", { p_id: id }),
  denunciar: (id: string, motivo: MotivoDaDenuncia) => c<{ denunciada: boolean }>("rede_questao_denunciar", { p_id: id, p_motivo: motivo }),
  denunciadas: () => c<{ itens: QuestaoDenunciada[] }>("rede_questoes_denunciadas"),
  mediar: (id: string, retirar: boolean) => c<{ id: string; retirada: boolean }>("rede_questao_mediar", { p_id: id, p_retirar: retirar }),
};
