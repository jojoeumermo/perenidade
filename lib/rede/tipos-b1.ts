// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos e as contas puras da B1 da comunidade (supabase/migracoes/20261110-alumia-b1-comunidade.sql). Nada aqui traz lista de
// pessoas: quem propôs uma nota, quem avaliou, quem editou a wiki (fora da moderação), quem guardou numa pasta do núcleo e quem
// perguntou (se não quis aparecer) nunca saem do banco. Sem "@/" de propósito (roda no Node nos testes).
import type { Post } from "./tipos";

// ── Notas de contexto ──
export interface NotaMostrada {
  id: string;
  texto: string;
  fonte: string;
  criado_em: string;
}
export interface NotaParaAvaliar extends NotaMostrada {
  mostrada: boolean;
  minha: boolean | null;
}
export type SituacaoDaNota = "proposta" | "mostrada" | "oculta";
export interface NotasDoPost {
  mostradas: NotaMostrada[];
  para_avaliar: NotaParaAvaliar[];
  minha: { id: string; texto: string; fonte: string; situacao: SituacaoDaNota } | null;
  pode_propor: boolean;
  pode_avaliar: boolean;
  modera: boolean;
  ocultas: { id: string; texto: string; fonte: string; situacao: SituacaoDaNota }[] | null;
}

// ── Wiki ──
export interface ResumoDaPaginaWiki {
  pagina: string;
  titulo: string;
  versao: number;
  editado_em: string;
  travada: boolean;
}
export interface PaginaWiki extends ResumoDaPaginaWiki {
  corpo: string;
}
export interface WikiDaComunidade {
  comunidade: { slug: string; nome: string; cor: string };
  paginas: ResumoDaPaginaWiki[];
  pagina: PaginaWiki | null;
  pode_editar: boolean;
  pode_criar: boolean;
  modera: boolean;
}
export interface VersaoDaWiki {
  versao: number;
  criado_em: string;
  resumo: string;
  tamanho: number;
  /** O codinome de quem editou: só para a moderação (LGPD art. 11); nulo para o resto. */
  editou: string | null;
}

/** Um bloco do texto da wiki: título ("# "), item de lista ("- " ou "1. ") ou parágrafo. Pura: o texto nunca vira HTML cru. */
export type BlocoDaWiki = { tipo: "titulo"; texto: string } | { tipo: "lista"; itens: string[]; numerada: boolean } | { tipo: "paragrafo"; texto: string };

export function blocosDaWiki(corpo: string): BlocoDaWiki[] {
  const blocos: BlocoDaWiki[] = [];
  let paragrafo: string[] = [];
  const fechar = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", texto: paragrafo.join(" ") });
    paragrafo = [];
  };
  for (const bruta of corpo.replace(/\r\n/g, "\n").split("\n")) {
    const linha = bruta.trim();
    const item = /^(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(linha);
    if (!linha) fechar();
    else if (/^#{1,3}\s+/.test(linha)) {
      fechar();
      blocos.push({ tipo: "titulo", texto: linha.replace(/^#{1,3}\s+/, "") });
    } else if (item) {
      fechar();
      const numerada = Boolean(item[1]);
      const ultimo = blocos[blocos.length - 1];
      if (ultimo?.tipo === "lista" && ultimo.numerada === numerada) ultimo.itens.push(item[2]);
      else blocos.push({ tipo: "lista", itens: [item[2]], numerada });
    } else paragrafo.push(linha);
  }
  fechar();
  return blocos;
}

// ── Conversas que sigo ──
export interface ConversaSeguida {
  raiz: string;
  seguida_em: string;
  disponivel: boolean;
  titulo: string | null;
  comunidade: string | null;
}

// ── Busca com operadores ──
export const OPERADORES_DA_BUSCA = ["tag", "c", "de", "tipo", "desde"] as const;
export type OperadorDaBusca = (typeof OPERADORES_DA_BUSCA)[number];

/** Separa os operadores do texto livre, igual a interno.rede_alumia_busca_ler (o último repetido vale). Pura. */
export function lerBusca(q: string): { texto: string; operadores: Partial<Record<OperadorDaBusca, string>> } {
  const operadores: Partial<Record<OperadorDaBusca, string>> = {};
  const texto = q
    .slice(0, 200)
    .replace(/(^|\s)(tag|c|de|tipo|desde):(\S+)/gi, (_t, antes: string, op: string, valor: string) => {
      operadores[op.toLowerCase() as OperadorDaBusca] = valor;
      return antes;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { texto, operadores };
}

/** Monta a busca de volta (texto livre + operadores, na ordem fixa), sem operador vazio. Pura. */
export function montarBusca(texto: string, operadores: Partial<Record<OperadorDaBusca, string>>): string {
  const partes = [texto.trim()];
  for (const op of OPERADORES_DA_BUSCA) {
    const v = operadores[op]?.trim().replace(/\s+/g, "");
    if (v) partes.push(`${op}:${v}`);
  }
  return partes.filter(Boolean).join(" ");
}

export interface BuscaSalva {
  id: string;
  nome: string;
  q: string;
}

// ── Pastas ──
export interface PastaDeSalvos {
  id: string;
  nome: string;
  nucleo: { id: string; nome: string } | null;
  posts: number;
  tem: boolean | null;
}
export interface PastasDaPessoa {
  itens: PastaDeSalvos[];
  nucleos: { id: string; nome: string }[];
}

// ── "Pergunte a…" ──
export interface PerguntaRespondida {
  id: string;
  texto: string;
  resposta: string;
  respondida_em: string;
  quem: string | null;
  minha: boolean;
}
export interface PerguntaNaFila {
  id: string;
  texto: string;
  criado_em: string;
  anonima: boolean;
  quem: string | null;
}
export interface CaixaDePerguntas {
  existe: boolean;
  aberta: boolean;
  anonimas: boolean;
  chamada: string;
  cuida: boolean;
  pode_perguntar: boolean;
  pode_anonima: boolean;
  respondidas: PerguntaRespondida[];
  minhas: { id: string; texto: string; situacao: string; criado_em: string }[];
  fila: PerguntaNaFila[] | null;
}

// ── Posts que se repetem e lembretes ──
export type Repeticao = "semanal" | "quinzenal" | "mensal";
export interface SerieAgendada {
  serie: string;
  id: string;
  quando: string;
  repetir: Repeticao;
  ate: string;
  vez: number;
  texto: string;
}
export interface Lembrete {
  post: string;
  quando: string;
}

/** As horas prontas do "lembrar mais tarde", a partir de agora (horário do aparelho). Pura. */
export function horasDoLembrete(agora: Date): { chave: "umaHora" | "hojeNoite" | "amanha" | "semana"; quando: Date }[] {
  const umaHora = new Date(agora.getTime() + 3600e3);
  const noite = new Date(agora);
  noite.setHours(20, 0, 0, 0);
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(9, 0, 0, 0);
  const semana = new Date(agora.getTime() + 7 * 86400e3);
  const lista: { chave: "umaHora" | "hojeNoite" | "amanha" | "semana"; quando: Date }[] = [{ chave: "umaHora", quando: umaHora }];
  // "Hoje às 20h" só antes das 19h (menos de 1 hora de folga vira "amanhã").
  if (noite.getTime() - agora.getTime() >= 3600e3) lista.push({ chave: "hojeNoite", quando: noite });
  lista.push({ chave: "amanha", quando: amanha }, { chave: "semana", quando: semana });
  return lista;
}

// ── Citação com âncora ──
/** Separa as linhas de citação ("> trecho") do resto do texto. Pura. */
export function separarCitacao(texto: string): { citacao: string | null; resto: string } {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const citadas: string[] = [];
  let i = 0;
  while (i < linhas.length && /^>\s?/.test(linhas[i])) citadas.push(linhas[i++].replace(/^>\s?/, ""));
  if (!citadas.length) return { citacao: null, resto: texto };
  while (i < linhas.length && !linhas[i].trim()) i++;
  return { citacao: citadas.join(" ").trim() || null, resto: linhas.slice(i).join("\n") };
}

/** O trecho, sem as reticências do corte e normalizado, para achar no original. Pura. */
export function trechoParaAchar(trecho: string): string {
  return trecho.replace(/…$/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** O trecho ainda está no post original? (ignora espaços e maiúsculas). Pura. */
export function trechoNoOriginal(trecho: string, original: Pick<Post, "texto"> & { titulo?: string | null; corpo?: string | null }): boolean {
  const alvo = trechoParaAchar(trecho);
  if (!alvo) return false;
  const todo = [original.titulo ?? "", original.texto, original.corpo ?? ""].join(" ").replace(/\s+/g, " ").toLowerCase();
  return todo.includes(alvo);
}

// ── "Leu antes de compartilhar?" (só no aparelho) ──
const CHAVE_LIDOS = "alumia:lidos";
const MAX_LIDOS = 400;

/** Marca que este post (ou link) foi aberto NESTE aparelho. Nada vai ao servidor; guarda só os 400 últimos ids. */
export function marcarLido(id: string): void {
  try {
    const lista = (JSON.parse(localStorage.getItem(CHAVE_LIDOS) ?? "[]") as unknown[]).filter((x): x is string => typeof x === "string" && x !== id);
    lista.push(id);
    localStorage.setItem(CHAVE_LIDOS, JSON.stringify(lista.slice(-MAX_LIDOS)));
  } catch {
    // Sem armazenamento (janela privada, bloqueado): a pergunta simplesmente não aparece.
  }
}

/** Este post (ou link) já foi aberto neste aparelho? Sem armazenamento: responde "sim" (para não perguntar à toa). */
export function jaLido(id: string): boolean {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_LIDOS) ?? "[]") as unknown[];
    return Array.isArray(lista) && lista.includes(id);
  } catch {
    return true;
  }
}
