// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Do projeto final à formatura na Escola Lúcia Maria (E4-14; docs/escola/formatura.md). Projeto em 6 etapas, critério de
// formatura, registro de formatura, texto do Mural, memória de formatura e texto da Gaveta. Tudo no aparelho; o único
// envio é a contagem anônima "escola_formatura", feita por quem chama (parâmetro `contar`), assim este arquivo não
// toca em servidor. Sem React e sem "@/" de propósito: o teste roda direto no Node.

import { apagarChaveDaEscola, gravarChaveDaEscola, lerChaveDaEscola } from "./caderneta";
import { aulasDoCurso, type Curso, horasDoCurso, horasFeitas, trilhaDe } from "./cursos";
import {
  acrescentarNaCaderneta,
  CHAVES_DA_ESCOLA,
  diaEmBrasilia,
  type Inscricao,
  marcarFormatura,
  PREFIXO_PRIVADO,
  type RegistroDaCaderneta,
} from "./estudante";
import regrasPadrao from "../../content/escola/formatura.json";

// ───────────── Regras (content/escola/formatura.json) ─────────────

export interface RegrasDaFormatura {
  confirmado: boolean;
  etapasObrigatorias: readonly string[];
  aulasExigidas: string;
  muralPorCurso: Readonly<Record<string, string>>;
}
export const REGRAS_DA_FORMATURA: RegrasDaFormatura = regrasPadrao as RegrasDaFormatura;

/** O curso como as telas da formatura o recebem do servidor (só o que precisa). */
export interface CursoParaFormatura {
  slug: string;
  titulo: string;
  /** "trilha/aula", na ordem do curso. */
  aulas: string[];
  /** Minutos estimados de cada aula, na mesma ordem. */
  minutos: number[];
  projetoFinal: string;
  sensivel: boolean;
  /** Nome do patrono PROPOSTO (do Memorial), se houver. */
  patrono: string | null;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const ehTexto = (v: unknown): v is string => typeof v === "string";
const limpar = (t: string, max: number) => t.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** O curso das telas no formato do critério e das horas (um módulo só, com todas as aulas). */
export function cursoParaConta(c: CursoParaFormatura): { slug: string; modulos: { titulo: string; aulas: string[] }[]; minutosDaAula: (aula: string) => number } {
  const porAula = new Map(c.aulas.map((a, i) => [a, c.minutos[i] ?? 0]));
  return { slug: c.slug, modulos: [{ titulo: "", aulas: c.aulas }], minutosDaAula: (a) => porAula.get(a) ?? 0 };
}

// ───────────── Projeto final (lucia:escola:projeto) ─────────────

export const ETAPAS_DO_PROJETO = ["tema", "plano", "rascunho", "revisao", "apresentacao", "entrega"] as const;
export type EtapaDoProjeto = (typeof ETAPAS_DO_PROJETO)[number];
export const MAX_TEMA = 120;
export const MAX_NOTAS = 2000;
export const MAX_CURSOS_DO_PROJETO = 40;

export interface ProjetoDoCurso {
  tema?: string;
  etapas: Partial<Record<EtapaDoProjeto, string>>;
  notas?: string;
  /** Dia em que a pessoa disse "já enviei" para a Gaveta Aberta. */
  gaveta?: string;
}
export interface Projetos {
  versao: 1;
  cursos: Record<string, ProjetoDoCurso>;
}

const projetosVazios = (): Projetos => ({ versao: 1, cursos: {} });

/** Confere a forma; o que vier errado vira vazio e curso fora do formato de slug é descartado. Nunca lança. */
export function validarProjetos(dado: unknown): Projetos {
  const saida = projetosVazios();
  try {
    if (!dado || typeof dado !== "object") return saida;
    const bruto = (dado as Record<string, unknown>).cursos;
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return saida;
    for (const [slug, v] of Object.entries(bruto as Record<string, unknown>)) {
      if (Object.keys(saida.cursos).length >= MAX_CURSOS_DO_PROJETO) break;
      if (!SLUG.test(slug) || !v || typeof v !== "object") continue;
      const p = v as Record<string, unknown>;
      const etapas: ProjetoDoCurso["etapas"] = {};
      if (p.etapas && typeof p.etapas === "object") {
        for (const e of ETAPAS_DO_PROJETO) {
          const dia = (p.etapas as Record<string, unknown>)[e];
          if (ehTexto(dia) && DIA.test(dia)) etapas[e] = dia;
        }
      }
      const tema = ehTexto(p.tema) ? limpar(p.tema, MAX_TEMA) : "";
      const notas = ehTexto(p.notas) ? p.notas.trim().slice(0, MAX_NOTAS) : "";
      saida.cursos[slug] = {
        ...(tema ? { tema } : {}),
        etapas,
        ...(notas ? { notas } : {}),
        ...(ehTexto(p.gaveta) && DIA.test(p.gaveta) ? { gaveta: p.gaveta } : {}),
      };
    }
  } catch {
    return projetosVazios();
  }
  return saida;
}

export const lerProjetos = (): Projetos => validarProjetos(lerChaveDaEscola(CHAVES_DA_ESCOLA.projeto));

function mudarProjeto(curso: string, muda: (p: ProjetoDoCurso) => void): boolean {
  if (!SLUG.test(curso)) return false;
  const todos = lerProjetos();
  if (!todos.cursos[curso] && Object.keys(todos.cursos).length >= MAX_CURSOS_DO_PROJETO) return false;
  const p = todos.cursos[curso] ?? { etapas: {} };
  muda(p);
  todos.cursos[curso] = p;
  return gravarChaveDaEscola(CHAVES_DA_ESCOLA.projeto, todos);
}

/** Marca a etapa com o dia (AAAA-MM-DD) ou limpa com null. */
export function gravarEtapa(curso: string, etapa: string, dia: string | null): boolean {
  if (!(ETAPAS_DO_PROJETO as readonly string[]).includes(etapa)) return false;
  if (dia !== null && !DIA.test(dia)) return false;
  return mudarProjeto(curso, (p) => {
    if (dia === null) delete p.etapas[etapa as EtapaDoProjeto];
    else p.etapas[etapa as EtapaDoProjeto] = dia;
  });
}

/** Guarda o tema (até 120) e as notas (até 2000) do projeto. */
export function gravarTemaENotas(curso: string, tema: string, notas: string): boolean {
  return mudarProjeto(curso, (p) => {
    const t = limpar(tema, MAX_TEMA);
    const n = notas.trim().slice(0, MAX_NOTAS);
    if (t) p.tema = t;
    else delete p.tema;
    if (n) p.notas = n;
    else delete p.notas;
  });
}

/** Marca (dia) ou limpa (null) o "já enviei para a Gaveta Aberta". */
export function gravarGaveta(curso: string, dia: string | null): boolean {
  if (dia !== null && !DIA.test(dia)) return false;
  return mudarProjeto(curso, (p) => {
    if (dia === null) delete p.gaveta;
    else p.gaveta = dia;
  });
}

// ───────────── Banca e apresentação ─────────────

/** O registro "banca" mais recente da caderneta para este curso (o que a BancaPopular do E4-15 grava), ou null. */
export function bancaDoCurso(caderneta: readonly RegistroDaCaderneta[], curso: string): RegistroDaCaderneta | null {
  const bancas = caderneta.filter((r) => r.tipo === "banca" && r.curso === curso);
  if (bancas.length === 0) return null;
  return bancas.reduce((a, b) => (b.data >= a.data ? b : a));
}

/** A apresentação vale se houve banca registrada no curso ou se a pessoa marcou a etapa à mão (seminário da turma). */
export function apresentacaoFeita(
  projeto: Projetos,
  caderneta: readonly RegistroDaCaderneta[],
  curso: string,
): { feita: boolean; dia: string | null; pelaBanca: boolean } {
  const banca = bancaDoCurso(caderneta, curso);
  if (banca) return { feita: true, dia: banca.data, pelaBanca: true };
  const dia = projeto.cursos[curso]?.etapas.apresentacao ?? null;
  return { feita: dia !== null, dia, pelaBanca: false };
}

// ───────────── Critério de formatura ─────────────

export interface EntradaDoCriterio {
  curso: Pick<Curso, "modulos"> & { slug: string };
  inscricao: Inscricao | null | undefined;
  concluidas: Iterable<string>;
  projeto: Projetos;
  caderneta: readonly RegistroDaCaderneta[];
  minutosDaAula: (aula: string) => number;
  regras?: RegrasDaFormatura;
}

export interface CriterioDeFormatura {
  aulasFeitas: number;
  aulasTotais: number;
  /** Horas ESTIMADAS (selo "estimativa"). */
  horasFeitas: number;
  horasTotais: number;
  aulasOk: boolean;
  etapasFaltando: string[];
  projetoOk: boolean;
  jaFormada: boolean;
  pode: boolean;
  /** Códigos que a tela traduz: faltam3aulas, semAulas, faltaPlano, trancada, semInscricao, jaFormada. */
  motivos: string[];
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Feito ou falta, sem nota: todas as aulas (ou trilha dispensada) mais as etapas obrigatórias do projeto. */
export function criterioDeFormatura(e: EntradaDoCriterio): CriterioDeFormatura {
  const regras = e.regras ?? REGRAS_DA_FORMATURA;
  const feitas = new Set(e.concluidas);
  const dispensas = e.inscricao?.dispensas ?? [];
  const aulas = aulasDoCurso(e.curso);
  const aulasFeitas = aulas.filter((a) => feitas.has(a) || dispensas.includes(trilhaDe(a))).length;
  const aulasTotais = aulas.length;
  const aulasOk = aulasTotais > 0 && aulasFeitas >= aulasTotais;
  const marcadas = e.projeto.cursos[e.curso.slug]?.etapas ?? {};
  const etapasFaltando = regras.etapasObrigatorias.filter((etapa) =>
    etapa === "apresentacao" ? !apresentacaoFeita(e.projeto, e.caderneta, e.curso.slug).feita : !(marcadas as Record<string, string | undefined>)[etapa],
  );
  const projetoOk = etapasFaltando.length === 0;
  const jaFormada = Boolean(e.inscricao?.formadoEm);
  const trancada = Boolean(e.inscricao?.trancadoEm);
  const pode = Boolean(e.inscricao) && aulasOk && projetoOk && !jaFormada && !trancada;
  const motivos: string[] = [];
  if (!e.inscricao) motivos.push("semInscricao");
  if (jaFormada) motivos.push("jaFormada");
  if (trancada) motivos.push("trancada");
  if (aulasTotais === 0) motivos.push("semAulas");
  else if (!aulasOk) motivos.push(`faltam${aulasTotais - aulasFeitas}aulas`);
  for (const etapa of etapasFaltando) motivos.push(`falta${maiuscula(etapa)}`);
  const horasFeitasDoCurso = horasFeitas(e.curso, feitas, dispensas, e.minutosDaAula);
  return {
    aulasFeitas,
    aulasTotais,
    horasFeitas: horasFeitasDoCurso,
    horasTotais: horasDoCurso(e.curso, e.minutosDaAula),
    aulasOk,
    etapasFaltando,
    projetoOk,
    jaFormada,
    pode,
    motivos,
  };
}

// ───────────── Formar ─────────────

const formatarHoras = (h: number) => String(Math.round(h * 2) / 2).replace(".", ",");

/** O registro de formatura da caderneta. O id é estável (formatura-<curso>), então não duplica. */
export function registroDaFormatura(curso: string, tituloDoCurso: string, dia: string, horas: number): RegistroDaCaderneta {
  return {
    id: `formatura-${curso}`,
    tipo: "outro",
    curso,
    data: dia,
    titulo: `Formatura: ${tituloDoCurso}`.slice(0, 160),
    detalhe: `Concluí o curso na Escola Lúcia Maria: todas as aulas e o projeto final apresentado. Horas estimadas: ${formatarHoras(horas)} h.`,
  };
}

export type ContarEscola = (tipo: "escola_formatura", alvo: string, periodo: "semestre") => void;

export interface ResultadoDaFormatura {
  ok: boolean;
  criterio: CriterioDeFormatura;
  dia?: string;
}

/**
 * Marca a formatura (só se o critério pedir), grava o registro na caderneta e faz a contagem anônima. `contar` vem de
 * quem chama (components/escola/formatura/Cerimonia.tsx passa contarEscola); sem ele, nada sai do aparelho. Não há
 * "desfazer": a tela pede confirmação antes.
 */
export function formar(entrada: EntradaDoCriterio & { tituloDoCurso: string; agora?: Date; contar?: ContarEscola }): ResultadoDaFormatura {
  const criterio = criterioDeFormatura(entrada);
  if (!criterio.pode) return { ok: false, criterio };
  const dia = diaEmBrasilia(entrada.agora ?? new Date());
  if (!marcarFormatura(entrada.curso.slug, dia)) return { ok: false, criterio };
  acrescentarNaCaderneta(registroDaFormatura(entrada.curso.slug, entrada.tituloDoCurso, dia, criterio.horasFeitas));
  try {
    entrada.contar?.("escola_formatura", entrada.curso.slug, "semestre");
  } catch {
    // a contagem é só um +1 anônimo: se falhar, a formatura continua valendo
  }
  return { ok: true, criterio, dia };
}

// ───────────── Mural dos Trabalhadores ─────────────

export const MURAL_TITULO = { min: 4, max: 160 } as const;
export const MURAL_DESCRICAO = { min: 20, max: 1200 } as const;
export const MAX_OFICIO = 100;
export const MAX_DESCRICAO_DA_PESSOA = 600;

/** Só curso profissional do mapa pode virar anúncio. Eletricista e qualquer curso fora do mapa, não. */
export const cursoPodeAnunciar = (slug: string, regras: RegrasDaFormatura = REGRAS_DA_FORMATURA) =>
  Object.prototype.hasOwnProperty.call(regras.muralPorCurso, slug);

export const categoriaDoMural = (slug: string, regras: RegrasDaFormatura = REGRAS_DA_FORMATURA): string | null =>
  cursoPodeAnunciar(slug, regras) ? regras.muralPorCurso[slug] : null;

const TEM_CONTATO = /(https?:\/\/|www\.|\S+@\S+|\+?\d[\d\s().-]{7,}\d|\.com\b|\.br\b)/i;
/** O texto parece ter link, e-mail ou telefone? */
export const temContato = (texto: string) => TEM_CONTATO.test(texto);

export interface AnuncioDoMural {
  ok: boolean;
  /** "oficioCurto", "contato", "curso" quando ok é false. */
  motivo?: string;
  categoria?: string;
  titulo?: string;
  descricao?: string;
}

/** Monta o texto que a pessoa copia para o formulário do Mural. Nunca leva contato, cidade nem telefone. */
export function anuncioDoMural(e: { curso: string; tituloDoCurso: string; oficio: string; descricaoDaPessoa: string }): AnuncioDoMural {
  const categoria = categoriaDoMural(e.curso);
  if (!categoria) return { ok: false, motivo: "curso" };
  const oficio = limpar(e.oficio, MAX_OFICIO);
  const dela = e.descricaoDaPessoa.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, MAX_DESCRICAO_DA_PESSOA);
  if (oficio.length < MURAL_TITULO.min) return { ok: false, motivo: "oficioCurto" };
  if (temContato(oficio) || temContato(dela)) return { ok: false, motivo: "contato" };
  const frase = `Estudei ${e.tituloDoCurso} na Escola Lúcia Maria, escola popular do Instituto Lúcia. É um registro de estudo, não uma certificação oficial.`;
  const descricao = [`Ofício: ${oficio}.`, dela, frase].filter(Boolean).join("\n\n").slice(0, MURAL_DESCRICAO.max);
  const titulo = oficio.slice(0, MURAL_TITULO.max);
  if (descricao.length < MURAL_DESCRICAO.min) return { ok: false, motivo: "oficioCurto" };
  return { ok: true, categoria, titulo, descricao };
}

// Rascunho do anúncio: chave privada (fora da cópia, sai no "apagar meus dados"). NUNCA guarda contato, cidade nem telefone.
export const CHAVE_DO_RASCUNHO_DO_MURAL = `${PREFIXO_PRIVADO}mural-rascunho`;
export interface RascunhoDoMural {
  curso: string;
  oficio: string;
  descricao: string;
}

export function validarRascunhoDoMural(dado: unknown): RascunhoDoMural | null {
  if (!dado || typeof dado !== "object") return null;
  const d = dado as Record<string, unknown>;
  if (!ehTexto(d.curso) || !SLUG.test(d.curso)) return null;
  return {
    curso: d.curso,
    // O que tem cara de contato (telefone, e-mail, link) não vai para o rascunho guardado: a promessa é "nunca guarda contato".
    oficio: ehTexto(d.oficio) && !temContato(d.oficio) ? limpar(d.oficio, MAX_OFICIO) : "",
    descricao: ehTexto(d.descricao) && !temContato(d.descricao) ? d.descricao.slice(0, MAX_DESCRICAO_DA_PESSOA) : "",
  };
}
export const lerRascunhoDoMural = () => validarRascunhoDoMural(lerChaveDaEscola(CHAVE_DO_RASCUNHO_DO_MURAL));
export function gravarRascunhoDoMural(r: RascunhoDoMural): boolean {
  const v = validarRascunhoDoMural(r);
  return v ? gravarChaveDaEscola(CHAVE_DO_RASCUNHO_DO_MURAL, v) : false;
}
export const apagarRascunhoDoMural = () => apagarChaveDaEscola(CHAVE_DO_RASCUNHO_DO_MURAL);

// ───────────── Memória de formatura (content/escola/memoria-de-formatura.json) ─────────────

export const MAX_ITENS_DA_MEMORIA = 300;
export const MAX_APELIDO_DA_MEMORIA = 40;
export const MAX_FRASE_DA_MEMORIA = 140;

export interface ItemDaMemoria {
  curso: string;
  semestre: string;
  apelido: string;
  frase?: string;
  autorizacao: true;
  maiorDeIdade: true;
}

const EMAIL = /\S+@\S+\.\S+/;
const URL_NO_TEXTO = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|br|io)\b)/i;
const TELEFONE = /\+?\d[\d\s().-]{6,}\d/;

/** O apelido tem cara de nome completo (3 ou mais palavras com inicial maiúscula), e-mail, telefone ou @? */
export function apelidoTemCaraDeDado(apelido: string): boolean {
  const palavras = apelido.trim().split(/\s+/).filter(Boolean);
  const maiusculas = palavras.filter((p) => /^\p{Lu}/u.test(p)).length;
  return maiusculas >= 3 || apelido.includes("@") || EMAIL.test(apelido) || TELEFONE.test(apelido);
}

export interface ValidacaoDaMemoria {
  ok: boolean;
  erros: string[];
}

/** A lista só vale inteira: um item com problema derruba a página. Cursos sensíveis (opinião política) ficam de fora. */
export function validarMemoria(lista: unknown, cursos: readonly { slug: string; sensivel?: boolean }[]): ValidacaoDaMemoria {
  const erros: string[] = [];
  if (!Array.isArray(lista)) return { ok: false, erros: ["a lista não é uma lista"] };
  if (lista.length > MAX_ITENS_DA_MEMORIA) erros.push(`mais de ${MAX_ITENS_DA_MEMORIA} itens`);
  const vistos = new Set<string>();
  lista.forEach((bruto, n) => {
    const onde = `item ${n + 1}`;
    if (!bruto || typeof bruto !== "object") return void erros.push(`${onde}: forma errada`);
    const i = bruto as Record<string, unknown>;
    if (i.autorizacao !== true) erros.push(`${onde}: falta autorizacao`);
    if (i.maiorDeIdade !== true) erros.push(`${onde}: falta maiorDeIdade`);
    const curso = cursos.find((c) => c.slug === i.curso);
    if (!curso) erros.push(`${onde}: curso não existe`);
    else if (curso.sensivel) erros.push(`${onde}: curso sensível (opinião política) não entra na memória`);
    if (!ehTexto(i.semestre) || !/^\d{4}\.[12]$/.test(i.semestre)) erros.push(`${onde}: semestre fora do formato AAAA.S`);
    if (!ehTexto(i.apelido) || !i.apelido.trim() || i.apelido.length > MAX_APELIDO_DA_MEMORIA || / {2}/.test(i.apelido)) {
      erros.push(`${onde}: apelido vazio, longo ou com espaço duplo`);
    } else if (apelidoTemCaraDeDado(i.apelido)) {
      erros.push(`${onde}: apelido com cara de nome completo, e-mail, telefone ou @`);
    }
    if (i.frase !== undefined) {
      if (!ehTexto(i.frase) || i.frase.length > MAX_FRASE_DA_MEMORIA) erros.push(`${onde}: frase longa demais`);
      else if (URL_NO_TEXTO.test(i.frase) || EMAIL.test(i.frase) || TELEFONE.test(i.frase) || i.frase.includes("@")) {
        erros.push(`${onde}: frase com link, e-mail ou telefone`);
      }
    }
    if (ehTexto(i.apelido) && ehTexto(i.semestre)) {
      const chave = `${i.curso}|${i.semestre}|${i.apelido.trim().toLowerCase()}`;
      if (vistos.has(chave)) erros.push(`${onde}: apelido repetido no mesmo curso e semestre`);
      vistos.add(chave);
    }
  });
  return { ok: erros.length === 0, erros };
}

export interface GrupoDaMemoria {
  semestre: string;
  itens: { curso: string; apelido: string; frase?: string }[];
}

/** Agrupa por semestre (do mais novo para o mais velho) sem os semestres que ainda não chegaram. Valide antes. */
export function memoriaDeFormatura(lista: readonly ItemDaMemoria[], hoje: string): GrupoDaMemoria[] {
  const [ano, mes] = hoje.split("-").map(Number);
  const atual = `${ano}.${mes >= 8 ? 2 : 1}`;
  const grupos = new Map<string, GrupoDaMemoria>();
  for (const i of lista) {
    if (i.semestre > atual) continue;
    const g = grupos.get(i.semestre) ?? { semestre: i.semestre, itens: [] };
    g.itens.push({ curso: i.curso, apelido: i.apelido, ...(i.frase ? { frase: i.frase } : {}) });
    grupos.set(i.semestre, g);
  }
  return [...grupos.values()].sort((a, b) => (a.semestre < b.semestre ? 1 : -1));
}

/** O texto que a pessoa copia e manda por /contribuir ("Uma ideia"). Nada é enviado sozinho. */
export function textoDoPedidoDeMemoria(e: { curso: string; semestre: string; apelido: string; frase?: string }): string {
  const frase = e.frase?.trim() ? ` Frase: "${limpar(e.frase, MAX_FRASE_DA_MEMORIA)}".` : "";
  return `Quero aparecer na memória de formatura da Escola Lúcia Maria: curso ${e.curso}, semestre ${e.semestre}, apelido ${limpar(e.apelido, MAX_APELIDO_DA_MEMORIA)}.${frase} Tenho 18 anos ou mais e autorizo o uso do apelido; posso pedir a retirada a qualquer momento.`;
}

// ───────────── Gaveta Aberta ─────────────

export const LICENCA_SUGERIDA = "CC BY-SA 4.0";

/** O bloco para copiar ao publicar o projeto final na Gaveta (o formulário da Gaveta não é preenchido sozinho). */
export function textoDaGaveta(e: { curso: string; tituloDoCurso: string; licenca?: string }): {
  tipo: "projeto";
  titulo: string;
  licenca: string;
  lembrete: string;
  bloco: string;
} {
  const titulo = `Projeto final: ${e.tituloDoCurso}`.slice(0, 160);
  const licenca = e.licenca || LICENCA_SUGERIDA;
  const lembrete = "Sem rosto, sem nome completo e sem documento de ninguém. Só publique o que é seu ou o que tem permissão de publicar.";
  return { tipo: "projeto", titulo, licenca, lembrete, bloco: `Tipo: Projeto\nTítulo: ${titulo}\nLicença: ${licenca}\n${lembrete}` };
}
