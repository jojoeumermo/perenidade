// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O erro que o servidor devolve (um código: "ato_cancelado", "muitos_pedidos", "invalido:inicio"…) vira a frase certa na tela, em
// vez do genérico "não deu". As frases ficam em i18n/rede/atos/*.json → "erros". Puro; sem "@/".

export const CODIGOS_DE_ERRO = [
  "ato_cancelado",
  "ato_passou",
  "muitos_pedidos",
  "consentimento",
  "entre_primeiro",
  "nao_encontrado",
  "so_quem_organizou",
  "so_coordenacao",
  "so_org_verificada",
  "corrente_fechada",
  "dado_pessoal",
  "tarefa_completa",
  "peticao_encerrada",
  "peticao_existe",
  "palavra",
  "titulo",
  "onde",
  "link_apoio",
  "meta",
  "limite_do_quadro",
  "data",
  "texto",
  "sem_rede",
  "generico",
] as const;

export type CodigoDeErro = (typeof CODIGOS_DE_ERRO)[number];

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "");

/** Qual frase mostrar para um erro do servidor (ou da rede). Desconhecido vira "generico". */
export function codigoDoErro(e: unknown): CodigoDeErro {
  const m = mensagem(e).toLowerCase();
  if (!m) return "generico";
  for (const c of ["ato_cancelado", "ato_passou", "muitos_pedidos", "consentimento", "entre_primeiro", "nao_encontrado", "so_quem_organizou", "so_coordenacao", "so_org_verificada", "corrente_fechada", "dado_pessoal", "tarefa_completa", "peticao_encerrada", "peticao_existe"] as const) {
    if (m.includes(c)) return c;
  }
  // Os campos do chamar: cada um com a sua frase (a palavra do mosaico, o nome, o ponto, o link e a meta).
  if (/invalido:palavra/.test(m)) return "palavra";
  if (/invalido:titulo/.test(m)) return "titulo";
  if (/invalido:(onde|ponto)/.test(m)) return "onde";
  if (/invalido:link_apoio/.test(m)) return "link_apoio";
  if (/invalido:(meta|quantos|vagas)/.test(m)) return "meta";
  if (/invalido:(tarefas|caronas)/.test(m)) return "limite_do_quadro";
  if (/invalido:(inicio|quando|data|prazo|sai_em)|data_invalida/.test(m)) return "data";
  if (/invalido:(texto|motivo|cidade|estado|item|saida|alvo|descricao|triagem)/.test(m)) return "texto";
  if (/permission denied|jwt|not authenticated|sem_sessao/.test(m)) return "entre_primeiro";
  if (/pgrst116|not.found/.test(m)) return "nao_encontrado";
  if (/failed to fetch|networkerror|network|load failed|sem_servico|timeout|abort/.test(m)) return "sem_rede";
  if (/too many|429/.test(m)) return "muitos_pedidos";
  return "generico";
}

/** A frase do erro no idioma da tela. */
export function fraseDoErro(erros: Record<CodigoDeErro, string>, e: unknown): string {
  return erros[codigoDoErro(e)] ?? erros.generico;
}
