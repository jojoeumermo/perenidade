// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Recursos novos que entram desligados. Cada um só aparece quando o nome está na variável de montagem
// NEXT_PUBLIC_RECURSOS, separada por vírgulas (ou "todos"). Sem a variável, o site fica exatamente como era.
//
//   NEXT_PUBLIC_RECURSOS=meu-estudo,exercicios          (no .env.local para testar; na Vercel para publicar)
//
// O valor é lido na montagem do site: mudou a variável, monte e publique de novo. Sem os atalhos "@/" de propósito:
// `npm run testar:meu-estudo` roda este arquivo direto no Node.

export const RECURSOS = {
  "meu-estudo": "Painel Meu estudo: aulas feitas, testes, desempenho por tema, o que revisar, cópia e apagar",
  exercicios: "Exercícios com explicação de cada erro, dificuldade, tema e status de revisão (disciplina piloto)",
  revisoes: "Etiqueta de revisão em cada aula (em revisão / revisada por função em data), histórico e créditos",
  turma: "Modo turma: sequência de aulas num link, sem cadastro, e comprovante de conclusão feito no aparelho",
  professores: "Páginas para professores: guia de uso em sala e planos de aula",
  "mapa-curricular": "Habilidades da BNCC e da matriz do Enem ligadas a cada aula",
  nivelamento: "Teste curto de nivelamento por disciplina, que só sugere por onde começar",
  metas: "Meta semanal opcional e lembrete por arquivo de agenda (.ics)",
  vlibras: "Botão para ativar o VLibras (serviço externo do governo), que só carrega depois do clique",
  ajudou: "\"Isso ajudou?\" no fim da aula, guardado só no aparelho",
  "guia-contribuir": "Guia de contribuição: funções, passo a passo, modelo de aula e checklist de revisão",
  "pratica-sem-placar": "Esconde os pontos e a sequência de dias da prática das aulas de idioma",
} as const;

export type Recurso = keyof typeof RECURSOS;

/** Lê a lista da variável. Separado para os testes poderem conferir a leitura sem mexer no ambiente. */
export function lerRecursos(valor: string | undefined): Set<string> {
  return new Set(
    (valor ?? "")
      .split(",")
      .map((nome) => nome.trim().toLowerCase())
      .filter(Boolean),
  );
}

// A referência precisa ser literal (process.env.NEXT_PUBLIC_RECURSOS) para o Next gravar o valor no código do navegador.
const ligados = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);

/** O recurso está ligado nesta montagem do site? */
export function ligado(recurso: Recurso, lista: Set<string> = ligados): boolean {
  return lista.has(recurso) || lista.has("todos");
}
