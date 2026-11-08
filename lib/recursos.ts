// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Recursos novos que entram desligados. Cada um aparece quando o nome está na variável de montagem
// NEXT_PUBLIC_RECURSOS, separada por vírgulas (ou "todos"), ou quando está em PADRAO (já testado e já ligado em
// produção: o ambiente novo, como a prévia, o espelho ou a cópia local, nasce igual à produção).
//
//   NEXT_PUBLIC_RECURSOS=meu-estudo,exercicios          (no .env.local para testar; na Vercel para publicar)
//   NEXT_PUBLIC_RECURSOS=escola,-vlibras                ("-nome" desliga um recurso padrão)
//   NEXT_PUBLIC_RECURSOS=nenhum                         (desliga todos os padrões)
//
// "todos" liga tudo, MENOS o que está em SO_PELO_NOME: a Escola Lúcia Maria e o Vale o Escrito só ligam com o nome escrito
// na lista, porque a produção usa "todos": a Escola não pode abrir antes de a coordenação mandar o texto (docs/ESCOLA.md)
// e o Vale o Escrito não abre antes de a curadoria revisar as entradas e a assessoria jurídica conferir
// (docs/vale-o-escrito/ESPEC.md); a Rede Lúcia v2 só liga pelo nome porque a migração SQL dela (supabase/migracoes/2026-11-rede-*.sql)
// ainda precisa rodar no Supabase de produção antes (docs/rede/V2.md). Desligado, a Rede e o Fórum de hoje ficam exatamente como estão.
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
  ajudou: "Isso ajudou? no fim da aula; a resposta fica no aparelho e, com a Escola ligada, soma +1 anônimo para a equipe",
  "guia-contribuir": "Guia de contribuição: funções, passo a passo, modelo de aula e checklist de revisão",
  "pratica-sem-placar": "Esconde os pontos e a sequência de dias da prática das aulas de idioma",
  "enem-video": "Vídeos curtos do curso ENEM: tocador com narração pré-gravada, legendas e transcrição, nas aulas que têm vídeo",
  "enem-curso": "Curso ENEM: a página /enem, diagnóstico, plano, prática por habilidade, provas oficiais por ano e dia, oficina de redação e reta final",
  escola: "Escola Revolucionária Lúcia Maria: entrada, cursos, matrícula, campus e calendário (só para quem tem conta)",
  "vale-o-escrito": "Vale o Escrito: observatório de crimes de interesse público já em fonte pública (teia, mapa, dossiês, envio de fonte e correção)",
  "rede-v2": "Alumia (Rede v2): Rede e Fórum numa só (posts curtos, discussões, dúvidas, enquetes), comunidades com página própria, perfil com @nome, endereços de post, perfil e comunidade",
  turmas: "Turmas: as turmas por curso da Escola (/escola/turmas) e a Turma do mês (/turmas). Em pausa até haver gente para acompanhar",
  "assistente-publico": "Assistente de IA aberto, sem conta (/api/assistente), usado pelo reforço e pelas ferramentas de estudo: IAs gratuitas em rodízio e limite por pessoa sem guardar o IP. O botão \"?\" das páginas não usa IA: são perguntas frequentes prontas",
} as const;

export type Recurso = keyof typeof RECURSOS;

/**
 * Ligados por padrão, sem precisar da variável. Só entra aqui o recurso que cumpre as DUAS condições: (1)
 * docs/RECURSOS.md e docs/RELATORIO-ESTUDO-NO-APARELHO.md o dão como testado; (2) a produção já o liga hoje (conferido
 * em 03/11/2026 no código publicado de https://institutolucia.org: NEXT_PUBLIC_RECURSOS="todos"). Assim a produção não
 * muda nada, e a prévia, o espelho e a cópia local nascem completos. "enem-curso" e "enem-video" ficam de fora porque
 * o relatório do estudo no aparelho não os cobre; "escola" fica de fora de propósito (quem liga é a coordenação).
 */
export const PADRAO: readonly Recurso[] = [
  "meu-estudo",
  "exercicios",
  "revisoes",
  "turma",
  "professores",
  "mapa-curricular",
  "nivelamento",
  "metas",
  "vlibras",
  "ajudou",
  "guia-contribuir",
  "pratica-sem-placar",
  // T03 (06/11/2026): a coordenação pediu o assistente ligado em todo o site. Desliga com "-assistente-publico" ou pelo painel.
  "assistente-publico",
];

/** Recursos que "todos" não liga: só ligam com o nome na lista. */
export const SO_PELO_NOME: readonly Recurso[] = ["escola", "vale-o-escrito", "rede-v2"];

/**
 * Recursos EM PAUSA: prontos e testados, mas desligados por decisão da coordenação (T08, 06/11/2026: "deixa desativado pelo
 * painel interno (podendo ligar de novo) as turmas por enquanto. Não temos gente o suficiente"). Como os de SO_PELO_NOME,
 * "todos" não os liga; ao contrário deles, ligar pelo painel vale na hora, sem segunda pessoa (no banco, so_pelo_nome = false),
 * porque não há texto, revisão jurídica nem migração esperando: é só a equipe voltar a ter gente para acompanhar.
 */
export const EM_PAUSA: readonly Recurso[] = ["turmas"];

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

/** O que a coordenação decidiu pelo painel (tabela de recursos no banco): ver lib/recursos-vivos.ts. */
export interface Vivos {
  ligados: ReadonlySet<string>;
  desligados: ReadonlySet<string>;
}
let vivos: Vivos = { ligados: new Set(), desligados: new Set() };

/** Guarda a decisão lida do banco (cache curto, feito por lib/recursos-vivos.ts). Sem ela, vale só a variável de montagem. */
export function definirVivos(novos: Vivos): void {
  vivos = novos;
}

/**
 * O recurso está ligado nesta montagem do site? "-nome" na lista sempre desliga; o nome na lista liga; "todos" liga o
 * que não está em SO_PELO_NOME nem em EM_PAUSA; e os de PADRAO ficam ligados, a não ser que a lista diga "nenhum".
 * Sem "lista" (o uso normal), entra também a decisão do painel: desligado no banco desliga sempre; ligado no banco liga,
 * inclusive os de SO_PELO_NOME (o banco só grava esses depois da confirmação de uma segunda pessoa).
 */
export function ligado(recurso: Recurso, lista?: Set<string>): boolean {
  const base = lista ?? ligados;
  if (base.has(`-${recurso}`)) return false;
  if (!lista && vivos.desligados.has(recurso)) return false;
  if (base.has(recurso)) return true;
  if (base.has("todos") && !SO_PELO_NOME.includes(recurso) && !EM_PAUSA.includes(recurso)) return true;
  if (PADRAO.includes(recurso) && !base.has("nenhum")) return true;
  return !lista && vivos.ligados.has(recurso);
}
