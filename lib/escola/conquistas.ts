// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas da tela Meu percurso (Escola de Formação, F5; docs/plano-2026-11/PLANO-ESCOLA.md, seções 4.5 e 6) e os selos
// 'escola:*' do perfil da Alumia. Tudo puro: recebe o que o aparelho guardou (aulas concluídas, tarefas no mundo,
// registros da caderneta) e o que o banco devolveu (escola_eu, escola_conquistas_minhas) e devolve o que mostrar.
// Sem React, sem rede e sem os atalhos "@/" de propósito: o teste (scripts/testar-escola-conquistas.mjs) importa direto no Node.
//
// Privacidade: ser militante revela opinião política (LGPD, art. 5º, II). O percurso fica no aparelho; o servidor só
// guarda o que a pessoa ESCOLHE mostrar na Alumia, e o perfil mostra das aulas só a contagem (nunca a lista).

import type { ConquistaDaEscola, Degrau, PublicoDasConquistas } from "./contratos";

// ───────────────────────────── Selos da Escola no perfil da Alumia ─────────────────────────────

/** Um selo da Escola como o banco manda em rede_perfil_de.selos (já filtrado por quem pede). */
export type SeloDaEscola =
  | { tipo: "carteirinha" }
  | { tipo: "degrau"; n: Degrau }
  | { tipo: "caderno"; n: number }
  | { tipo: "aulas"; n: number };

const SELO = /^escola:(carteirinha|degrau-([1-3])|caderno-(0[1-9]|1[01])|aulas-([1-9][0-9]{0,3}))$/;

/** 'escola:carteirinha', 'escola:degrau-2', 'escola:caderno-03', 'escola:aulas-17' → o selo; qualquer outro texto → null. */
export function lerSeloDaEscola(selo: string): SeloDaEscola | null {
  const m = SELO.exec(selo);
  if (!m) return null;
  if (m[1] === "carteirinha") return { tipo: "carteirinha" };
  if (m[2]) return { tipo: "degrau", n: Number(m[2]) as Degrau };
  if (m[3]) return { tipo: "caderno", n: Number(m[3]) };
  return { tipo: "aulas", n: Number(m[4]) };
}

export const eSeloDaEscola = (selo: string) => lerSeloDaEscola(selo) !== null;

/** Os selos da Escola de uma lista de selos do perfil, na ordem em que o banco mandou (carteirinha, degrau, cadernos, aulas). */
export const selosDaEscola = (selos: readonly string[]): SeloDaEscola[] => selos.map(lerSeloDaEscola).filter((s): s is SeloDaEscola => s !== null);

// ───────────────────────────── O que declarar ao banco ─────────────────────────────

/** O alvo do caderno no banco: 'caderno-01' a 'caderno-11'. */
export const alvoDoCaderno = (numero: number) => `caderno-${String(numero).padStart(2, "0")}`;

/** Mesmo formato do banco (escola_conquista_declarar): o lessonId de /trilhas, "trilha/aula". */
export const ALVO_DE_AULA = /^[a-z0-9-]{2,80}\/[a-z0-9-]{1,120}$/;

/** Limite do banco: até 400 conquistas declaradas por pessoa. */
export const MAX_DECLARADAS = 400;

export interface CadernoParaPercurso {
  numero: number;
  degrau: Degrau;
  /** O pedaço do endereço (/escola/formacao/[slug]); é também a chave da tarefa no mundo do caderno no aparelho. */
  slug?: string;
  aulas: { id: string }[];
}

export interface Declaracao {
  tipo: "aula" | "caderno";
  alvo: string;
}

/**
 * O que o aparelho tem e o banco ainda não: as aulas dos cadernos concluídas aqui e os cadernos inteiros (todas as aulas
 * escritas feitas). Só acrescenta: o que outro aparelho declarou não é retirado daqui (desligar a exibição apaga tudo).
 * Respeita o limite de 400.
 */
export function aDeclarar(cadernos: readonly CadernoParaPercurso[], feitas: ReadonlySet<string>, noBanco: readonly Pick<ConquistaDaEscola, "tipo" | "alvo" | "verificada">[]): Declaracao[] {
  const ja = new Set(noBanco.map((c) => `${c.tipo}:${c.alvo}`));
  let livres = MAX_DECLARADAS - noBanco.filter((c) => !c.verificada).length;
  const saida: Declaracao[] = [];
  const por = (d: Declaracao) => {
    if (livres <= 0 || ja.has(`${d.tipo}:${d.alvo}`)) return;
    ja.add(`${d.tipo}:${d.alvo}`);
    saida.push(d);
    livres--;
  };
  // Os cadernos primeiro (são poucos e valem um selo cada); depois as aulas, que só viram contagem.
  for (const c of cadernos) if (c.aulas.length > 0 && c.aulas.every((a) => feitas.has(a.id))) por({ tipo: "caderno", alvo: alvoDoCaderno(c.numero) });
  for (const c of cadernos) for (const a of c.aulas) if (feitas.has(a.id) && ALVO_DE_AULA.test(a.id) && a.id.length <= 160) por({ tipo: "aula", alvo: a.id });
  return saida;
}

/**
 * Os selos que o perfil mostraria a quem pode ver, montados aqui com as conquistas da própria pessoa (a mesma regra do
 * banco em interno.escola_conquistas_visiveis): carteirinha, o maior degrau verificado, os cadernos e a contagem de aulas.
 */
export function selosPrevistos(conquistas: readonly Pick<ConquistaDaEscola, "tipo" | "alvo" | "verificada">[]): SeloDaEscola[] {
  const selos: SeloDaEscola[] = [];
  if (conquistas.some((c) => c.tipo === "carteirinha" && c.alvo === "carteirinha" && c.verificada)) selos.push({ tipo: "carteirinha" });
  const degraus = conquistas.filter((c) => c.tipo === "degrau" && c.verificada && /^degrau-[1-3]$/.test(c.alvo)).map((c) => Number(c.alvo.slice(7)));
  if (degraus.length) selos.push({ tipo: "degrau", n: Math.max(...degraus) as Degrau });
  for (const c of conquistas.filter((x) => x.tipo === "caderno" && /^caderno-(0[1-9]|1[01])$/.test(x.alvo)).sort((a, b) => a.alvo.localeCompare(b.alvo))) {
    selos.push({ tipo: "caderno", n: Number(c.alvo.slice(8)) });
  }
  const aulas = conquistas.filter((c) => c.tipo === "aula").length;
  if (aulas > 0) selos.push({ tipo: "aulas", n: aulas });
  return selos;
}

// ───────────────────────────── Caderneta e "para fechar o degrau" ─────────────────────────────

export interface Caderneta {
  /** Aulas dos 11 cadernos concluídas neste aparelho (o mesmo lessonId de /trilhas). */
  aulas: number;
  /** Tarefas no mundo marcadas neste aparelho. */
  tarefas: number;
  /** Rodas de núcleo registradas na caderneta deste aparelho (registros de turma/círculo). */
  rodas: number;
}

export function contarCaderneta(
  cadernos: readonly CadernoParaPercurso[],
  feitas: ReadonlySet<string>,
  tarefas: Readonly<Record<string, unknown>>,
  registros: readonly { tipo: string }[],
): Caderneta {
  const ids = new Set(cadernos.flatMap((c) => c.aulas.map((a) => a.id)));
  let aulas = 0;
  for (const id of ids) if (feitas.has(id)) aulas++;
  return { aulas, tarefas: Object.keys(tarefas).length, rodas: registros.filter((r) => r.tipo === "turma").length };
}

export interface FaltaNoDegrau {
  degrau: Degrau;
  /** Cadernos do degrau ainda sem todas as aulas feitas (os "em preparação" contam: o degrau também os pede). */
  cadernos: number;
  /** Cadernos do degrau sem a tarefa no mundo marcada (chave = o slug do caderno). */
  tarefas: number;
  /** Os cadernos que faltam, para a lista. */
  quais: number[];
}

/** O que falta para fechar o degrau de agora. A banca (balanço com o núcleo) sempre falta: só ela sobe o degrau, no servidor. */
export function faltaNoDegrau(degrau: Degrau, cadernos: readonly CadernoParaPercurso[], feitas: ReadonlySet<string>, tarefas: Readonly<Record<string, unknown>>): FaltaNoDegrau {
  const doDegrau = cadernos.filter((c) => c.degrau === degrau);
  const abertos = doDegrau.filter((c) => c.aulas.length === 0 || !c.aulas.every((a) => feitas.has(a.id)));
  const semTarefa = doDegrau.filter((c) => !c.slug || !(c.slug in tarefas));
  return { degrau, cadernos: abertos.length, tarefas: semTarefa.length, quais: abertos.map((c) => c.numero) };
}

/** As barras da carteirinha: degraus antes do atual concluídos, o atual em curso, os de depois por vir. */
export const barrasDosDegraus = (degrau: Degrau): ("feito" | "agora" | "depois")[] => ([1, 2, 3] as const).map((d) => (d < degrau ? "feito" : d === degrau ? "agora" : "depois"));

// ───────────────────────────── Público ─────────────────────────────

/** Ligar (sair de 'ninguem') pede a tela de consentimento; trocar entre públicos já ligados, não; desligar, nunca. */
export const pedeConsentimento = (de: PublicoDasConquistas, para: PublicoDasConquistas) => de === "ninguem" && para !== "ninguem";

/** "AAAA-MM-DD" → o mês e o ano no idioma ("março de 2026"). Data inválida → null. */
export function mesEAno(dia: string | null, lang: string): string | null {
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const [a, m] = dia.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
  } catch {
    return null;
  }
}

/** O nome do arquivo de "Baixar": neutro (não diz "militante" nem "Escola", pensando no aparelho dividido). */
export const nomeDoArquivo = (agora: Date) => `meu-estudo-${agora.toISOString().slice(0, 10)}.json`;
