// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Turmas por curso da Escola Revolucionária Lúcia Maria (Etapa 4, pacote E4-15; docs/escola/turma.md). Puro: sem fs, sem React e sem
// os atalhos "@/" de propósito (`npm run testar:escola-turma` roda este arquivo direto no Node).
//
// - turmaDoCurso: o módulo do mês (rodízio determinístico, como a Turma do mês) em 4 semanas, 2 aulas por semana, com o
//   encontro semanal às quartas, 19h30 de Brasília, e o seminário no último encontro.
// - icsDosEncontros: os encontros do mês como arquivo de agenda.
// - monitoria e orientadores: a validação das listas curadas pela coordenação (content/escola/*.json).
// - círculo de cultura digital: o que fica no aparelho de quem facilita (lucia:escola:circulos) e a sequência do modo turma.
// - banca popular: o registro da caderneta. Cartaz da turma: as frases.

import { type Curso, MIN_AULAS } from "./cursos";
import {
  CHAVES_DA_ESCOLA,
  type RegistroDaCaderneta,
  semestreDaData,
} from "./estudante";
import { site } from "../site";
import { MAX_AULAS, normalizarSequencia, type Sequencia } from "../turma";

// ───────────── Turma do mês do curso ─────────────

/** Aulas do módulo que entram num mês (2 por semana, 4 semanas). Módulo maior continua no mês seguinte. */
export const AULAS_POR_MES = 8;
export const AULAS_POR_SEMANA = 2;
export const SEMANAS = 4;
/** O encontro semanal: quarta-feira, 19h30 de Brasília (UTC−3, sem horário de verão desde 2019). */
export const DIA_DO_ENCONTRO = 3;
export const HORA_DO_ENCONTRO = "19:30";
export const FUSO_DE_BRASILIA = "-03:00";

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface SemanaDaTurma {
  /** AAAA-MM-DD: o dia em que a semana da turma começa (1, 8, 15 e 22). */
  inicio: string;
  /** AAAA-MM-DD: a quarta-feira do encontro. */
  encontro: string;
  /** "trilha/aula" */
  aulas: string[];
}

export interface TurmaDoCursoNoMes {
  /** AAAA-MM */
  mes: string;
  curso: string;
  /** Índice (0, 1…) e título do módulo do mês. */
  modulo: { indice: number; titulo: string };
  semanas: SemanaDaTurma[];
  /** O módulo tem mais aulas do que cabem no mês: o resto continua no mês que vem. */
  continua: boolean;
  /** AAAA-MM-DD: o último encontro do mês, que é o seminário. */
  seminario: string;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** O mês seguinte de 'AAAA-MM'. */
export function mesSeguinte(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${doisDigitos(m + 1)}`;
}

/** O índice do módulo de um mês: (ano × 12 + mês) módulo o número de módulos (o mesmo passo da Turma do mês). */
export function indiceDoModulo(mes: string, nModulos: number): number {
  const achado = MES.exec(mes);
  if (!achado || nModulos < 1) return 0;
  return (Number(achado[1]) * 12 + Number(achado[2])) % nModulos;
}

/** A primeira quarta-feira a partir de um dia (inclusive). */
export function quartaAPartirDe(dia: Date): Date {
  const quarta = new Date(dia);
  quarta.setUTCDate(
    dia.getUTCDate() + ((DIA_DO_ENCONTRO - dia.getUTCDay() + 7) % 7),
  );
  return quarta;
}

/**
 * A turma de um curso num mês ('AAAA-MM'): o módulo do rodízio, as 4 semanas (dias 1, 8, 15 e 22), até 2 aulas por
 * semana e o encontro na primeira quarta-feira de cada semana (sempre dentro do mês: a semana 4 começa no dia 22 e a
 * quarta cai até o dia 28). Mês inválido ou curso sem módulo com aula: null.
 */
export function turmaDoCurso(
  curso: Pick<Curso, "slug" | "modulos">,
  mes: string,
): TurmaDoCursoNoMes | null {
  const achado = MES.exec(mes);
  const modulos = Array.isArray(curso?.modulos) ? curso.modulos : [];
  if (!achado || modulos.length === 0) return null;
  const ano = Number(achado[1]);
  const m = Number(achado[2]);
  const indice = indiceDoModulo(mes, modulos.length);
  const modulo = modulos[indice];
  if (!modulo || !Array.isArray(modulo.aulas) || modulo.aulas.length === 0)
    return null;
  const aulas = modulo.aulas.slice(0, AULAS_POR_MES);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const inicio = new Date(Date.UTC(ano, m - 1, 1 + i * 7));
    return {
      inicio: iso(inicio),
      encontro: iso(quartaAPartirDe(inicio)),
      aulas: aulas.slice(i * AULAS_POR_SEMANA, (i + 1) * AULAS_POR_SEMANA),
    };
  });
  return {
    mes,
    curso: curso.slug,
    modulo: { indice, titulo: modulo.titulo },
    semanas,
    continua: modulo.aulas.length > AULAS_POR_MES,
    seminario: semanas[SEMANAS - 1].encontro,
  };
}

/** O começo do encontro de um dia, com o fuso de Brasília ('AAAA-MM-DDT19:30:00-03:00'). */
export const inicioDoEncontro = (dia: string) =>
  `${dia}T${HORA_DO_ENCONTRO}:00${FUSO_DE_BRASILIA}`;

// ───────────── Agenda (.ics) ─────────────

const escaparIcs = (texto: string) =>
  texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
const dobrarIcs = (linha: string) =>
  (linha.match(/.{1,73}/g) ?? [linha]).join("\r\n ");
const utcIcs = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");

/**
 * Os 4 encontros do mês como arquivo de agenda. A hora vai em UTC (19h30 de Brasília = 22h30 UTC), sem duração
 * (o arquivo não promete quanto tempo dura). O link é o da página do curso, nunca o da sala (a sala é só de quem entrou).
 */
export function icsDosEncontros(
  turma: TurmaDoCursoNoMes,
  textos: { titulo: string; seminario: string; descricao: string },
  endereco: string,
  agora: Date = new Date(),
): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instituto Lucia//Turma do curso//PT",
    "CALSCALE:GREGORIAN",
  ];
  for (const semana of turma.semanas) {
    const inicio = new Date(inicioDoEncontro(semana.encontro));
    const titulo =
      semana.encontro === turma.seminario
        ? `${textos.titulo} · ${textos.seminario}`
        : textos.titulo;
    linhas.push(
      "BEGIN:VEVENT",
      `UID:turma-${turma.curso}-${semana.encontro}@institutolucia.org`,
      `DTSTAMP:${utcIcs(agora)}`,
      `DTSTART:${utcIcs(inicio)}`,
      dobrarIcs(`SUMMARY:${escaparIcs(titulo)}`),
      dobrarIcs(
        `DESCRIPTION:${escaparIcs(`${textos.descricao}\n${endereco}`)}`,
      ),
      dobrarIcs(`URL:${endereco}`),
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR", "");
  return linhas.join("\r\n");
}

// ───────────── Monitoria e orientadores (listas da coordenação) ─────────────

export interface Monitor {
  curso: string;
  /** AAAA-MM */
  mes: string;
  /** Como a pessoa quer ser chamada (nunca nome completo sem ela pedir). */
  apelido: string;
  /** Texto livre: "terças, 20h" */
  horario: string;
  /** A pessoa autorizou aparecer na lista. Sem isso, a lista não vale. */
  autorizacao: true;
}

export interface ContatoDoOrientador {
  tipo: "rede" | "email-do-instituto";
  /** Rede: o @ do perfil público na Rede Lúcia. E-mail: o endereço público do Instituto (lib/site.ts), nunca um pessoal. */
  valor: string;
}

export interface Orientador {
  apelido: string;
  cursos: string[];
  /** Vagas no semestre, de 0 a 5 (a coordenação baixa quando alguém começa). */
  vagasSemestre: number;
  contato: ContatoDoOrientador;
  autorizacao: true;
}

export const MAX_VAGAS = 5;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const texto = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIL = /^@?[a-z0-9_.-]{2,40}$/i;

/** Confere a lista da monitoria. `cursos`: os slugs que existem. Devolve os erros (vazio quando está certa). */
export function validarMonitoria(
  lista: unknown,
  cursos: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(lista)) return ["a monitoria precisa ser uma lista"];
  const erros: string[] = [];
  lista.forEach((m: Partial<Monitor> | null, i) => {
    const onde = `monitor ${i + 1}`;
    if (!m || typeof m !== "object")
      return void erros.push(`${onde}: não é um objeto`);
    if (m.autorizacao !== true)
      erros.push(
        `${onde}: sem "autorizacao": true (a pessoa precisa ter autorizado)`,
      );
    if (!texto(m.curso, 80) || !SLUG.test(m.curso) || !cursos.has(m.curso))
      erros.push(`${onde}: curso não existe: ${String(m.curso)}`);
    if (!texto(m.mes, 7) || !MES.test(m.mes))
      erros.push(`${onde}: mês inválido (use AAAA-MM): ${String(m.mes)}`);
    if (!texto(m.apelido, 40))
      erros.push(`${onde}: falta "apelido" (até 40 caracteres)`);
    if (!texto(m.horario, 80))
      erros.push(`${onde}: falta "horario" (até 80 caracteres)`);
  });
  return erros;
}

/** Confere a lista de orientadores. Devolve os erros (vazio quando está certa). */
export function validarOrientadores(
  lista: unknown,
  cursos: ReadonlySet<string>,
  emailsDoInstituto: readonly string[] = [site.newsletter],
): string[] {
  if (!Array.isArray(lista)) return ["os orientadores precisam ser uma lista"];
  const erros: string[] = [];
  lista.forEach((o: Partial<Orientador> | null, i) => {
    const onde = `orientador ${i + 1}`;
    if (!o || typeof o !== "object")
      return void erros.push(`${onde}: não é um objeto`);
    if (o.autorizacao !== true)
      erros.push(
        `${onde}: sem "autorizacao": true (a pessoa precisa ter autorizado)`,
      );
    if (!texto(o.apelido, 40))
      erros.push(`${onde}: falta "apelido" (até 40 caracteres)`);
    if (!Array.isArray(o.cursos) || o.cursos.length === 0)
      erros.push(`${onde}: "cursos" precisa de ao menos um curso`);
    else
      for (const c of o.cursos)
        if (typeof c !== "string" || !cursos.has(c))
          erros.push(`${onde}: curso não existe: ${String(c)}`);
    if (
      !Number.isInteger(o.vagasSemestre) ||
      (o.vagasSemestre as number) < 0 ||
      (o.vagasSemestre as number) > MAX_VAGAS
    )
      erros.push(`${onde}: "vagasSemestre" vai de 0 a ${MAX_VAGAS}`);
    const c = o.contato;
    if (!c || (c.tipo !== "rede" && c.tipo !== "email-do-instituto"))
      erros.push(`${onde}: contato.tipo é "rede" ou "email-do-instituto"`);
    else if (
      c.tipo === "rede" &&
      !(typeof c.valor === "string" && PERFIL.test(c.valor))
    )
      erros.push(`${onde}: contato.valor da rede é o @ do perfil público`);
    else if (
      c.tipo === "email-do-instituto" &&
      !(
        typeof c.valor === "string" &&
        EMAIL.test(c.valor) &&
        emailsDoInstituto.includes(c.valor)
      )
    )
      erros.push(
        `${onde}: contato.valor precisa ser o e-mail público do Instituto (${emailsDoInstituto.join(", ")})`,
      );
  });
  return erros;
}

/** Os monitores de um curso num mês (só os autorizados). */
export const monitoresDoMes = (
  lista: readonly Monitor[],
  curso: string,
  mes: string,
) =>
  lista.filter(
    (m) => m.autorizacao === true && m.curso === curso && m.mes === mes,
  );

/** Os orientadores de um curso com vaga (só os autorizados). */
export const orientadoresComVaga = (
  lista: readonly Orientador[],
  curso: string,
) =>
  lista.filter(
    (o) =>
      o.autorizacao === true && o.cursos.includes(curso) && o.vagasSemestre > 0,
  );

/** O @ do perfil na Rede Lúcia, sempre com o "@" na frente. */
export const arrobaNaRede = (valor: string) => `@${valor.replace(/^@/, "")}`;

// ───────────── Círculo de cultura digital (no aparelho de quem facilita) ─────────────

export const CHAVE_DOS_CIRCULOS = CHAVES_DA_ESCOLA.circulos;
/** Círculos guardados no aparelho (os mais velhos saem). */
export const MAX_CIRCULOS = 10;
export const MAX_PALAVRAS = 30;
export const MAX_PALAVRA = 60;
export const MAX_TEMA = 120;
export const MAX_PERGUNTAS = 10;
export const MAX_PERGUNTA = 240;

export interface Circulo {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  /** Palavras e problemas que a turma trouxe (sem nomes de pessoas). */
  palavras: string[];
  /** O tema gerador escolhido. */
  tema: string;
  /** As perguntas-guia da problematização. */
  perguntas: string[];
  /** "trilha/aula" escolhidas para a sequência do modo turma. */
  aulas: string[];
}

const limpar = (valor: string, max: number) =>
  valor
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const AULA = /^[a-z0-9-]{1,90}\/[a-z0-9-]{1,90}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Uma lista de textos limpa, sem repetir (ignorando maiúsculas) e no limite. */
export function listaLimpa(
  lista: unknown,
  maxItens: number,
  maxTexto: number,
): string[] {
  if (!Array.isArray(lista)) return [];
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const item of lista) {
    if (typeof item !== "string") continue;
    const limpo = limpar(item, maxTexto);
    const chave = limpo.toLocaleLowerCase("pt-BR");
    if (!limpo || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(limpo);
    if (saida.length >= maxItens) break;
  }
  return saida;
}

/** Confere e normaliza um círculo guardado. */
export function normalizarCirculo(bruto: unknown): Circulo | null {
  if (!bruto || typeof bruto !== "object") return null;
  const c = bruto as Partial<Circulo>;
  if (
    typeof c.id !== "string" ||
    !/^[a-z0-9-]{1,40}$/.test(c.id) ||
    typeof c.data !== "string" ||
    !DIA.test(c.data)
  )
    return null;
  return {
    id: c.id,
    data: c.data,
    palavras: listaLimpa(c.palavras, MAX_PALAVRAS, MAX_PALAVRA),
    tema: typeof c.tema === "string" ? limpar(c.tema, MAX_TEMA) : "",
    perguntas: listaLimpa(c.perguntas, MAX_PERGUNTAS, MAX_PERGUNTA),
    aulas: Array.isArray(c.aulas)
      ? [
          ...new Set(
            c.aulas.filter(
              (a): a is string => typeof a === "string" && AULA.test(a),
            ),
          ),
        ].slice(0, MAX_AULAS)
      : [],
  };
}

/** Lê a lista de círculos guardada (texto JSON do armazenamento). Lixo vira lista vazia. */
export function lerCirculos(texto: string | null): Circulo[] {
  try {
    const dado = JSON.parse(texto ?? "[]");
    return Array.isArray(dado)
      ? dado
          .map(normalizarCirculo)
          .filter((c): c is Circulo => c !== null)
          .slice(-MAX_CIRCULOS)
      : [];
  } catch {
    return [];
  }
}

/** Guarda (ou troca, pelo id) um círculo na lista; passa de 10, o mais velho sai. */
export function guardarCirculo(
  lista: readonly Circulo[],
  circulo: Circulo,
): Circulo[] {
  const normal = normalizarCirculo(circulo);
  if (!normal) return [...lista];
  return [...lista.filter((c) => c.id !== normal.id), normal].slice(
    -MAX_CIRCULOS,
  );
}

/** Tira um círculo da lista. */
export const apagarCirculo = (lista: readonly Circulo[], id: string) =>
  lista.filter((c) => c.id !== id);

/** Um círculo novo, vazio, com o dia de hoje (AAAA-MM-DD) e um id aleatório. */
export const novoCirculo = (dia: string): Circulo => ({
  id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  data: dia,
  palavras: [],
  tema: "",
  perguntas: [],
  aulas: [],
});

/** A sequência do modo turma (lib/turma.ts) com o tema e as aulas do círculo, dentro de MAX_AULAS. Sem aula: null. */
export function sequenciaDoCirculo(
  tema: string,
  aulas: readonly string[],
  recado?: string,
): Sequencia | null {
  return normalizarSequencia({
    v: 1,
    titulo: limpar(tema, MAX_TEMA),
    aulas: [...aulas].slice(0, MAX_AULAS),
    ...(recado ? { recado } : {}),
  });
}

// ───────────── Banca popular online ─────────────

export const COMPETENCIAS_DA_BANCA = [
  "clareza",
  "curso",
  "vida",
  "proximo",
] as const;
export type CompetenciaDaBanca = (typeof COMPETENCIAS_DA_BANCA)[number];
export type Devolutiva = Record<CompetenciaDaBanca, string>;
export const MAX_PESSOAS_DA_BANCA = 3;

/** O texto da devolutiva para a caderneta: um parágrafo por competência preenchida, com o nome dela na frente. */
export function textoDaDevolutiva(
  devolutiva: Partial<Devolutiva>,
  rotulos: Record<CompetenciaDaBanca, string>,
): string {
  return COMPETENCIAS_DA_BANCA.map(
    (c) => [c, limpar(devolutiva[c] ?? "", 480)] as const,
  )
    .filter(([, t]) => t)
    .map(([c, t]) => `${rotulos[c]}: ${t}`)
    .join("\n");
}

/**
 * O registro da banca para a caderneta (acrescentarNaCaderneta): tipo 'banca', título fixo, a devolutiva como detalhe e
 * as pessoas que a própria pessoa digitou (com a permissão de cada uma). Sem devolutiva ou sem curso: null.
 */
export function registroDaBanca(
  dados: {
    curso: string;
    data: string;
    devolutiva: Partial<Devolutiva>;
    pessoas: readonly string[];
  },
  rotulos: Record<CompetenciaDaBanca, string>,
  titulo: string,
): Omit<RegistroDaCaderneta, "id"> | null {
  const detalhe = textoDaDevolutiva(dados.devolutiva, rotulos);
  if (!detalhe || !SLUG.test(dados.curso) || !DIA.test(dados.data)) return null;
  const pessoas = listaLimpa(dados.pessoas, MAX_PESSOAS_DA_BANCA, 60);
  return {
    tipo: "banca",
    curso: dados.curso,
    data: dados.data,
    titulo,
    detalhe,
    ...(pessoas.length ? { pessoas } : {}),
  };
}

// ───────────── Cartaz da turma ─────────────

export const MAX_FRASES = 24;
export const MAX_FRASE = 140;

/** As frases do cartaz: limpas, sem repetir, até 24 de até 140 caracteres. */
export const frasesDoCartaz = (frases: unknown) =>
  listaLimpa(frases, MAX_FRASES, MAX_FRASE);

/** O semestre do cartaz ("2026.2") a partir do dia (AAAA-MM-DD). */
export const semestreDoCartaz = (dia: string) => semestreDaData(dia);

/**
 * Parece nome completo? Duas ou mais palavras seguidas com maiúscula (fora do começo da frase), como "Maria da Silva".
 * Só um aviso para quem facilita conferir; não bloqueia (nomes de lugares também têm maiúscula).
 */
export function pareceNomeCompleto(frase: string): boolean {
  const palavras = frase.trim().split(/\s+/).slice(1);
  let seguidas = 0;
  for (const p of palavras) {
    if (/^\p{Lu}\p{Ll}+/u.test(p)) {
      seguidas++;
      if (seguidas >= 2) return true;
    } else if (!/^(da|de|do|das|dos|e)$/.test(p)) seguidas = 0;
  }
  return false;
}

/** Curso que pode ter turma: precisa de módulos com aula (o mínimo de aulas do curso já é conferido em cursos.ts). */
export const temTurma = (curso: Pick<Curso, "modulos">) =>
  curso.modulos.reduce((n, m) => n + m.aulas.length, 0) >= MIN_AULAS;
