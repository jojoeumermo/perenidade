// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o painel único diz de cada recurso: o nome em palavras simples, se está valendo e o que a variável de montagem
// (NEXT_PUBLIC_RECURSOS) faz com ele. O painel grava a decisão no banco; a variável mora no servidor e só muda com publicação nova.
import { lerRecursos, ligado, RECURSOS, type Recurso } from "@/lib/recursos";
import { nomeDaFuncao, NOMES_DAS_FUNCOES, type NomeDaFuncao } from "../nomes-das-funcoes";

/** Os recursos do site que não são da Alumia, como a coordenação lê. */
const DO_SITE: Record<string, NomeDaFuncao> = {
  "meu-estudo": { nome: "Meu estudo", sobre: "O painel de cada estudante: aulas feitas, testes, desempenho por tema e o que revisar." },
  exercicios: { nome: "Exercícios", sobre: "Exercícios com a explicação de cada erro, por tema e dificuldade." },
  revisoes: { nome: "Etiqueta de revisão", sobre: "Mostra em cada aula se ela está em revisão ou já foi revisada, por quem e quando." },
  turma: { nome: "Modo turma", sobre: "Uma sequência de aulas num link só, sem cadastro, com comprovante feito no aparelho." },
  professores: { nome: "Páginas para professores", sobre: "O guia de uso em sala e os planos de aula." },
  "mapa-curricular": { nome: "Mapa curricular", sobre: "Liga cada aula às habilidades da BNCC e da matriz do Enem." },
  nivelamento: { nome: "Nivelamento", sobre: "Um teste curto por disciplina que só sugere por onde começar." },
  metas: { nome: "Meta da semana", sobre: "Meta semanal opcional, com lembrete por arquivo de agenda." },
  vlibras: { nome: "VLibras", sobre: "O botão do VLibras (serviço do governo), que só carrega depois do clique." },
  ajudou: { nome: "Isso ajudou?", sobre: "A pergunta no fim da aula; a resposta fica no aparelho." },
  "guia-contribuir": { nome: "Guia de contribuição", sobre: "Funções, passo a passo, modelo de aula e lista de revisão para quem quer contribuir." },
  "pratica-sem-placar": { nome: "Prática sem placar", sobre: "Esconde os pontos e a sequência de dias da prática de idiomas." },
  "enem-video": { nome: "Vídeos do ENEM", sobre: "Vídeos curtos com narração, legendas e transcrição nas aulas do curso ENEM." },
  "enem-curso": { nome: "Curso ENEM", sobre: "A página do ENEM: diagnóstico, plano, prática por habilidade, provas e redação." },
  escola: { nome: "Escola Lúcia Maria", sobre: "A escola de formação: cursos, matrícula, campus e calendário. Só liga depois de a coordenação mandar o texto." },
  "vale-o-escrito": { nome: "Vale o Escrito", sobre: "O observatório de crimes de interesse público. Só liga depois da curadoria e da assessoria jurídica." },
  turmas: { nome: "Turmas", sobre: "As turmas por curso da Escola e a Turma do mês. Em pausa até haver gente para acompanhar." },
  "assistente-publico": { nome: "Assistente aberto", sobre: "O assistente de estudo sem conta, com limite por pessoa e sem guardar o endereço de rede." },
};

export const nomeDoRecurso = (nome: string): NomeDaFuncao => NOMES_DAS_FUNCOES[nome] ?? DO_SITE[nome] ?? nomeDaFuncao(nome);

export const daAlumia = (nome: string) => nome.startsWith("alumia-") || nome === "rede-v2" || nome.startsWith("fediverso-");

/** Está valendo? A decisão do banco vence; sem decisão, vale o que esta montagem do site diz. */
export function valendo(nome: string, decisao: boolean | null | undefined): boolean {
  if (typeof decisao === "boolean" && !naVariavelDesliga(nome)) return decisao;
  if (naVariavelDesliga(nome)) return false;
  return nome in RECURSOS ? ligado(nome as Recurso) : false;
}

// A referência precisa ser literal para o Next gravar o valor da montagem no código do navegador.
const DA_VARIAVEL = lerRecursos(process.env.NEXT_PUBLIC_RECURSOS);

function naVariavelDesliga(nome: string) {
  return DA_VARIAVEL.has(`-${nome}`);
}

/** O que a variável de montagem faz com este recurso, em palavras simples (ou nulo quando ela não diz nada). */
export function notaDaVariavel(nome: string): { tom: "perigo" | undefined; texto: string } | null {
  if (naVariavelDesliga(nome)) {
    return { tom: "perigo", texto: "A configuração do servidor desliga este recurso de vez: nem o painel liga. Para mudar, é preciso mudar a configuração do servidor e publicar o site de novo." };
  }
  if (DA_VARIAVEL.has(nome)) return { tom: undefined, texto: "Ligado também na configuração do servidor (essa parte só muda com uma publicação nova). Desligar aqui vale do mesmo jeito." };
  return null;
}
