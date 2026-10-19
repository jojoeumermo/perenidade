// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load } from "js-yaml";
import { type ExercicioNovo, validarExercicios } from "./exercicios";

// Os exercícios com explicação do erro moram em content/exercicios/<trilha>/<aula>.yml, um arquivo por aula, fora do
// arquivo da aula: assim nada muda nas aulas nem no validador delas, e o recurso inteiro sai do ar desligando a flag.
// Lidos só no servidor, na montagem. Um arquivo inválido para a montagem com o nome do arquivo e do item.

const PASTA = path.join(process.cwd(), "content", "exercicios");

export interface ExerciciosDeUmaAula {
  trilha: string;
  aula: string;
  exercicios: ExercicioNovo[];
}

function lerArquivo(trilha: string, aula: string): ExercicioNovo[] {
  const arquivo = path.join(PASTA, trilha, `${aula}.yml`);
  if (!fs.existsSync(arquivo)) return [];
  const nome = `content/exercicios/${trilha}/${aula}.yml`;
  // CORE_SCHEMA: só texto, números, verdadeiro/falso e listas. Datas continuam texto ("2026-10-19").
  return validarExercicios(load(fs.readFileSync(arquivo, "utf8"), { schema: CORE_SCHEMA }), nome);
}

function lerTodos(): ExerciciosDeUmaAula[] {
  if (!fs.existsSync(PASTA)) return [];
  const saida: ExerciciosDeUmaAula[] = [];
  for (const trilha of fs.readdirSync(PASTA, { withFileTypes: true })) {
    if (!trilha.isDirectory()) continue;
    for (const nome of fs.readdirSync(path.join(PASTA, trilha.name))) {
      if (!nome.endsWith(".yml")) continue;
      const aula = nome.slice(0, -4);
      saida.push({ trilha: trilha.name, aula, exercicios: lerArquivo(trilha.name, aula) });
    }
  }
  const ids = new Map<string, string>();
  for (const grupo of saida)
    for (const ex of grupo.exercicios) {
      const onde = `${grupo.trilha}/${grupo.aula}`;
      const antes = ids.get(ex.id);
      if (antes) throw new Error(`Exercício inválido: o id "${ex.id}" aparece em ${antes} e em ${onde}`);
      ids.set(ex.id, onde);
    }
  return saida;
}

// Na montagem o conteúdo não muda: lê uma vez por processo. No desenvolvimento lê de novo a cada página.
let guardado: ExerciciosDeUmaAula[] | null = null;
export function todosOsExercicios(): ExerciciosDeUmaAula[] {
  if (process.env.NODE_ENV !== "production") return lerTodos();
  guardado ??= lerTodos();
  return guardado;
}

export function exerciciosDaAula(trilha: string, aula: string): ExercicioNovo[] {
  return todosOsExercicios().find((g) => g.trilha === trilha && g.aula === aula)?.exercicios ?? [];
}

export function exerciciosDaTrilha(trilha: string): ExerciciosDeUmaAula[] {
  return todosOsExercicios().filter((g) => g.trilha === trilha);
}
