// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o banco devolve no banco de questões (supabase/migracoes/20261117-alumia-o11-texto.sql). A questão da lista NUNCA traz a certa
// nem a explicação: elas só chegam em Resposta, depois que a pessoa escolhe.

export interface Questao {
  id: string;
  materia: string;
  tema: string;
  enunciado: string;
  alternativas: string[];
  /** É de quem está vendo (a questão não mostra quem escreveu para mais ninguém). */
  minha: boolean;
  criado_em: string;
  editada: boolean;
}

export interface Resposta {
  id: string;
  acertou: boolean;
  certa: number;
  explicacao: string;
}

/** A própria questão (em "Minhas questões") e a denunciada (para a mediação): com a certa e a explicação. */
export interface QuestaoCompleta extends Questao {
  certa: number;
  explicacao: string;
  retirada: boolean;
}

export interface QuestaoDenunciada extends QuestaoCompleta {
  denuncias: number;
  motivos: string[];
}

export interface Materias {
  materias: { materia: string; questoes: number }[];
  minhas: number;
  modera: boolean;
}

export interface PaginaDeQuestoes {
  itens: Questao[];
  proximo: string | null;
}

export type MotivoDaDenuncia = "errada" | "ofensiva" | "dado_pessoal" | "spam" | "outro";
