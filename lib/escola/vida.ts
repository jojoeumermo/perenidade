// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A vida real na Escola Lúcia Maria (E4-11, docs/escola/vida.md): a tarefa no mundo de cada curso, as missões de
// laboratório, o estudo de caso do bairro, as gravações de voz de quem estuda e a conferência das duas listas curadas
// (vozes publicadas e "trabalhadores que ensinam"). Tudo fica SÓ no aparelho: o servidor não recebe nada daqui.
// Puro e sem "@/" nem fs, de propósito: `npm run testar:escola-vida` roda este arquivo direto no Node. O conteúdo
// (content/escola/vida/*.json) NÃO é importado aqui: as páginas o importam e passam; quem confere (o teste) lê o disco.
// As datas de luta ficam em lib/escola/lutas.ts, para a página do curso não carregar o calendário só por causa da tarefa.

import { acrescentarNaCaderneta, CHAVES_DA_ESCOLA, diaEmBrasilia, MAX_DETALHE, MAX_TITULO, PREFIXO_PRIVADO, type RegistroDaCaderneta } from "./estudante";

export const CHAVE_DAS_TAREFAS = CHAVES_DA_ESCOLA.tarefas;
export const CHAVE_DAS_MISSOES = CHAVES_DA_ESCOLA.missoes;
/** Privadas: ficam fora da cópia de segurança e o "apagar meus dados" apaga. */
export const CHAVE_DAS_VOZES = `${PREFIXO_PRIVADO}vozes`;
export const CHAVE_DO_CASO = `${PREFIXO_PRIVADO}caso-do-bairro`;

/** A mesma base do ExpliqueComSuasPalavras (lib/escola/avaliacao.ts), para o "apagar meus dados" cobrir o áudio. */
export const BASE_DOS_AUDIOS_DA_VIDA = "lucia-explicacoes";
export const LOJA_DOS_AUDIOS = "audios";
export const PREFIXO_DO_AUDIO = "voz:";

export const FORMATO = /^[a-z0-9-]{1,80}$/;
export const MAX_NOTA = 500;
export const MAX_CURSOS_COM_TAREFA = 40;
export const MAX_MISSOES_MARCADAS = 200;
export const MAX_VOZES = 10;
export const MAX_SEGUNDOS_DA_VOZ = 120;
export const MAX_TITULO_DA_VOZ = 60;
export const MAX_PERGUNTA_DA_VOZ = 200;
export const PASSOS_DO_CASO = 5;
export const MAX_PASSO_DO_CASO = 600;
export const CASO_LIVRE = "livre";

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

// ───────────── Armazenamento (sempre com try/catch) ─────────────

function lerBruto(chave: string): unknown {
  try {
    const t = globalThis.localStorage?.getItem(chave);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

function gravarBruto(chave: string, valor: unknown | null): boolean {
  try {
    const a = globalThis.localStorage;
    if (!a) return false;
    if (valor === null) a.removeItem(chave);
    else a.setItem(chave, JSON.stringify(valor));
    try {
      globalThis.dispatchEvent?.(new Event("lucia:estudo"));
    } catch {
      // fora do navegador não há quem ouvir
    }
    return true;
  } catch {
    return false;
  }
}

// ───────────── Marcas por id (tarefas e missões têm o mesmo desenho) ─────────────

export interface Marca {
  feita: true;
  /** AAAA-MM-DD (Brasília) */
  em: string;
  /** Até 500 caracteres, escrita pela própria pessoa. */
  nota?: string;
}

type Marcas = Record<string, Marca>;

/** Erros de um valor guardado (lista vazia quando está tudo certo). Serve ao teste e à leitura. */
export function errosDasMarcas(bruto: unknown, max: number): string[] {
  const erros: string[] = [];
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return ["não é um objeto"];
  const b = bruto as { versao?: unknown; itens?: unknown };
  if (b.versao !== 1) erros.push("versao deve ser 1");
  if (!b.itens || typeof b.itens !== "object" || Array.isArray(b.itens)) return [...erros, "itens não é um objeto"];
  const entradas = Object.entries(b.itens as Record<string, unknown>);
  if (entradas.length > max) erros.push(`mais de ${max} itens`);
  for (const [id, m] of entradas) {
    if (!FORMATO.test(id)) erros.push(`id fora do formato: ${id}`);
    const x = m as Partial<Marca> | null;
    if (!x || typeof x !== "object" || x.feita !== true || typeof x.em !== "string" || !DIA.test(x.em)) erros.push(`${id}: marca inválida`);
    else if (x.nota !== undefined && (typeof x.nota !== "string" || x.nota.length > MAX_NOTA)) erros.push(`${id}: nota longa demais`);
  }
  return erros;
}

function lerMarcas(chave: string, max: number): Marcas {
  const bruto = lerBruto(chave) as { versao?: unknown; itens?: unknown } | null;
  if (!bruto || typeof bruto !== "object" || bruto.versao !== 1 || !bruto.itens || typeof bruto.itens !== "object" || Array.isArray(bruto.itens)) return {};
  const entradas = Object.entries(bruto.itens as Record<string, unknown>);
  if (entradas.length > max) return {};
  const saida: Marcas = {};
  for (const [id, m] of entradas) {
    const x = m as Partial<Marca> | null;
    if (!FORMATO.test(id) || !x || x.feita !== true || typeof x.em !== "string" || !DIA.test(x.em)) continue;
    saida[id] = { feita: true, em: x.em, ...(typeof x.nota === "string" && x.nota ? { nota: x.nota.slice(0, MAX_NOTA) } : {}) };
  }
  return saida;
}

function gravarMarcas(chave: string, itens: Marcas): boolean {
  return gravarBruto(chave, Object.keys(itens).length ? { versao: 1, itens } : null);
}

function marcar(chave: string, max: number, id: string, nota: string | undefined, agora: Date): boolean {
  if (!FORMATO.test(id)) return false;
  const limpa = nota?.trim();
  if (limpa && limpa.length > MAX_NOTA) return false;
  const itens = lerMarcas(chave, max);
  if (!itens[id] && Object.keys(itens).length >= max) return false;
  itens[id] = { feita: true, em: itens[id]?.em ?? diaEmBrasilia(agora), ...(limpa ? { nota: limpa } : {}) };
  return gravarMarcas(chave, itens);
}

function desmarcar(chave: string, max: number, id: string): boolean {
  const itens = lerMarcas(chave, max);
  if (!(id in itens)) return true;
  delete itens[id];
  return gravarMarcas(chave, itens);
}

// ───────────── Tarefa no mundo ─────────────

export const lerTarefas = (): Marcas => lerMarcas(CHAVE_DAS_TAREFAS, MAX_CURSOS_COM_TAREFA);
/** Marca a tarefa de um curso como feita (de novo, só troca a nota; a data da primeira vez fica). */
export const marcarTarefa = (curso: string, opcoes: { nota?: string } = {}, agora: Date = new Date()) => marcar(CHAVE_DAS_TAREFAS, MAX_CURSOS_COM_TAREFA, curso, opcoes.nota, agora);
export const desmarcarTarefa = (curso: string) => desmarcar(CHAVE_DAS_TAREFAS, MAX_CURSOS_COM_TAREFA, curso);
/** Leitor estável para a formatura e o Mural dos Trabalhadores (E4-14): só o curso e o dia, nunca a nota. */
export const tarefasFeitas = (): { curso: string; em: string }[] =>
  Object.entries(lerTarefas())
    .map(([curso, m]) => ({ curso, em: m.em }))
    .sort((a, b) => a.em.localeCompare(b.em) || a.curso.localeCompare(b.curso));

/** O id do registro da tarefa na caderneta: um só por curso, então registrar de novo troca em vez de duplicar. */
export const idDoRegistroDaTarefa = (curso: string) => `tarefa-${curso}`;

/** Põe a tarefa feita na caderneta (tipo "tarefa"), uma vez por curso. Só depois de marcada como feita. */
export function registrarTarefaNaCaderneta(curso: string, tituloDoCurso: string, agora: Date = new Date()): RegistroDaCaderneta | null {
  const marca = lerTarefas()[curso];
  if (!marca) return null;
  return acrescentarNaCaderneta({
    id: idDoRegistroDaTarefa(curso),
    tipo: "tarefa",
    curso,
    data: diaEmBrasilia(agora),
    titulo: `Tarefa no mundo: ${tituloDoCurso}`.slice(0, MAX_TITULO),
    detalhe: (marca.nota ?? "").slice(0, MAX_DETALHE),
  });
}

// ───────────── Missões de laboratório ─────────────

export interface Missao {
  id: string;
  /** Curso a que a missão serve (slug em content/escola/cursos), se houver. */
  curso?: string;
  /** Página do laboratório: app/[lang]/laboratorios/<lab>. */
  lab: string;
  /** Só com lab "ide": o perfil (sql, js, python, web) e o exercício dentro dele. */
  perfil?: string;
  exercicio?: string;
  titulo: string;
  /** O problema de trabalho, em duas frases. */
  situacao: string;
  tarefa: string;
  cuidado: string;
  /** true até a coordenação revisar: o texto foi escrito pelo pacote. */
  revisao: boolean;
}

export interface ConferidoresDeMissao {
  cursoExiste: (slug: string) => boolean;
  labExiste: (lab: string) => boolean;
  exercicioExiste: (perfil: string, id: string) => boolean;
}

/** Confere a lista curada de missões. Devolve os erros (vazia quando está tudo certo). */
export function validarMissoes(lista: unknown, c: ConferidoresDeMissao): string[] {
  if (!Array.isArray(lista)) return ["a lista de missões não é uma lista"];
  const erros: string[] = [];
  const ids = new Set<string>();
  for (const [i, bruto] of lista.entries()) {
    const m = bruto as Partial<Missao> | null;
    const onde = `missão ${i + 1}`;
    if (!m || typeof m !== "object") {
      erros.push(`${onde} não é um objeto`);
      continue;
    }
    if (!texto(m.id) || !FORMATO.test(m.id)) erros.push(`${onde}: id inválido`);
    else if (ids.has(m.id)) erros.push(`${onde}: id repetido ${m.id}`);
    else ids.add(m.id);
    if (m.curso !== undefined && (!texto(m.curso) || !c.cursoExiste(m.curso))) erros.push(`${onde}: curso inexistente ${String(m.curso)}`);
    if (!texto(m.lab) || !c.labExiste(m.lab)) erros.push(`${onde}: laboratório sem página ${String(m.lab)}`);
    if (m.exercicio !== undefined) {
      if (m.lab !== "ide" || !texto(m.perfil)) erros.push(`${onde}: exercício só com lab "ide" e perfil`);
      else if (!texto(m.exercicio) || !c.exercicioExiste(m.perfil, m.exercicio)) erros.push(`${onde}: exercício ausente ${String(m.exercicio)}`);
    } else if (m.perfil !== undefined && (m.lab !== "ide" || !texto(m.perfil))) erros.push(`${onde}: perfil só com lab "ide"`);
    for (const campo of ["titulo", "situacao", "tarefa", "cuidado"] as const) if (!texto(m[campo])) erros.push(`${onde}: falta "${campo}"`);
    if (m.revisao !== true) erros.push(`${onde}: falta "revisao": true (texto escrito pelo pacote)`);
  }
  return erros;
}

/** O endereço (sem idioma) do laboratório da missão; o da IDE segue o formato que components/labs/IDEPagina.tsx lê. */
export function linkDaMissao(m: Pick<Missao, "lab" | "perfil" | "exercicio">): string {
  if (m.lab === "ide" && m.perfil) return `/laboratorios/ide?p=${encodeURIComponent(m.perfil)}${m.exercicio ? `&ex=${encodeURIComponent(m.exercicio)}` : ""}`;
  return `/laboratorios/${m.lab}`;
}

export const lerMissoes = (): Marcas => lerMarcas(CHAVE_DAS_MISSOES, MAX_MISSOES_MARCADAS);
export const marcarMissao = (id: string, opcoes: { nota?: string } = {}, agora: Date = new Date()) => marcar(CHAVE_DAS_MISSOES, MAX_MISSOES_MARCADAS, id, opcoes.nota, agora);
export const desmarcarMissao = (id: string) => desmarcar(CHAVE_DAS_MISSOES, MAX_MISSOES_MARCADAS, id);
/** Leitor estável para a formatura e o Mural dos Trabalhadores (E4-14). */
export const missoesFeitas = (): { missao: string; em: string }[] =>
  Object.entries(lerMissoes())
    .map(([missao, m]) => ({ missao, em: m.em }))
    .sort((a, b) => a.em.localeCompare(b.em) || a.missao.localeCompare(b.missao));

// ───────────── Gravações de voz de quem estuda (só os dados; o áudio fica no IndexedDB) ─────────────

export interface VozLocal {
  id: string;
  /** AAAA-MM-DD */
  criadaEm: string;
  segundos: number;
  titulo: string;
  pergunta: string;
}

const ID_DA_VOZ = /^[a-z0-9-]{1,40}$/;

function vozValida(d: unknown): VozLocal | null {
  const v = d as Partial<VozLocal> | null;
  if (!v || typeof v !== "object" || typeof v.id !== "string" || !ID_DA_VOZ.test(v.id)) return null;
  if (typeof v.criadaEm !== "string" || !DIA.test(v.criadaEm)) return null;
  if (typeof v.segundos !== "number" || !Number.isFinite(v.segundos) || v.segundos <= 0 || v.segundos > MAX_SEGUNDOS_DA_VOZ) return null;
  if (typeof v.titulo !== "string" || typeof v.pergunta !== "string") return null;
  return { id: v.id, criadaEm: v.criadaEm, segundos: Math.round(v.segundos), titulo: v.titulo.slice(0, MAX_TITULO_DA_VOZ), pergunta: v.pergunta.slice(0, MAX_PERGUNTA_DA_VOZ) };
}

export function lerVozesLocais(): VozLocal[] {
  const bruto = lerBruto(CHAVE_DAS_VOZES) as { versao?: unknown; itens?: unknown } | null;
  if (!bruto || bruto.versao !== 1 || !Array.isArray(bruto.itens)) return [];
  return bruto.itens.map(vozValida).filter((v): v is VozLocal => v !== null).slice(0, MAX_VOZES);
}

export const chaveDoAudio = (id: string) => `${PREFIXO_DO_AUDIO}${id}`;

/** Guarda os dados de uma gravação. Devolve null com 10 gravações já guardadas, segundos acima de 120 ou aparelho sem armazenamento. */
export function gravarVozLocal(dados: { id?: string; segundos: number; titulo?: string; pergunta?: string }, agora: Date = new Date()): VozLocal | null {
  const lista = lerVozesLocais();
  if (lista.length >= MAX_VOZES) return null;
  const id = dados.id ?? `v-${agora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nova = vozValida({ id, criadaEm: diaEmBrasilia(agora), segundos: dados.segundos, titulo: (dados.titulo ?? "").trim(), pergunta: (dados.pergunta ?? "").trim() });
  if (!nova || lista.some((v) => v.id === nova.id)) return null;
  return gravarBruto(CHAVE_DAS_VOZES, { versao: 1, itens: [...lista, nova] }) ? nova : null;
}

export function apagarVozLocal(id: string): boolean {
  const lista = lerVozesLocais();
  if (!lista.some((v) => v.id === id)) return true;
  const resto = lista.filter((v) => v.id !== id);
  return gravarBruto(CHAVE_DAS_VOZES, resto.length ? { versao: 1, itens: resto } : null);
}

// ───────────── Vozes publicadas e trabalhadores que ensinam (listas curadas) ─────────────

export interface VozPublica {
  id: string;
  apelido: string;
  oficio: string;
  /** Só /arquivos/vozes/*.webm|m4a|mp3|ogg */
  arquivo: string;
  segundos: number;
  /** Obrigatória: acessibilidade. Sem telefone, e-mail, CPF nem endereço de internet. */
  transcricao: string;
  /** Consentimento livre, informado e específico (LGPD art. 7, I e art. 8). Retirar é apagar o item. */
  autorizacao: boolean;
  data: string;
  revisao: boolean;
}

export const ARQUIVO_DE_VOZ = /^\/arquivos\/vozes\/[A-Za-z0-9._-]+\.(webm|m4a|mp3|ogg)$/;
const PADROES_DE_DADO_PESSOAL: [string, RegExp][] = [
  ["e-mail", /[^\s@]+@[^\s@]+\.[^\s@]+/],
  ["CPF", /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/],
  ["telefone", /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/],
  ["endereço de internet", /https?:|www\./i],
];

/** Os dados pessoais que não podem aparecer no texto de uma voz publicada. */
export const dadoPessoalEm = (t: string): string[] => PADROES_DE_DADO_PESSOAL.filter(([, p]) => p.test(t)).map(([nome]) => nome);

export function validarVozesPublicas(lista: unknown, c: { arquivoExiste: (caminho: string) => boolean }): string[] {
  if (!Array.isArray(lista)) return ["a lista de vozes não é uma lista"];
  const erros: string[] = [];
  const ids = new Set<string>();
  for (const [i, bruto] of lista.entries()) {
    const v = bruto as Partial<VozPublica> | null;
    const onde = `voz ${i + 1}`;
    if (!v || typeof v !== "object") {
      erros.push(`${onde} não é um objeto`);
      continue;
    }
    if (!texto(v.id) || !FORMATO.test(v.id)) erros.push(`${onde}: id inválido`);
    else if (ids.has(v.id)) erros.push(`${onde}: id repetido`);
    else ids.add(v.id);
    if (!texto(v.apelido) || v.apelido.length > 40) erros.push(`${onde}: apelido de 1 a 40 caracteres`);
    if (!texto(v.oficio) || v.oficio.length > 60) erros.push(`${onde}: ofício de 1 a 60 caracteres`);
    if (!texto(v.arquivo) || !ARQUIVO_DE_VOZ.test(v.arquivo) || v.arquivo.includes("..")) erros.push(`${onde}: arquivo deve ser /arquivos/vozes/*.webm|m4a|mp3|ogg`);
    else if (!c.arquivoExiste(v.arquivo)) erros.push(`${onde}: arquivo não existe em public: ${v.arquivo}`);
    if (typeof v.segundos !== "number" || !(v.segundos > 0) || v.segundos > MAX_SEGUNDOS_DA_VOZ) erros.push(`${onde}: segundos de 1 a ${MAX_SEGUNDOS_DA_VOZ}`);
    if (!texto(v.transcricao)) erros.push(`${onde}: falta a transcrição (acessibilidade)`);
    for (const campo of ["transcricao", "apelido", "oficio"] as const) {
      const achado = typeof v[campo] === "string" ? dadoPessoalEm(v[campo] as string) : [];
      if (achado.length) erros.push(`${onde}: ${campo} com ${achado.join(", ")}`);
    }
    if (v.autorizacao !== true) erros.push(`${onde}: sem autorização (autorizacao deve ser true)`);
    if (!texto(v.data) || !DIA.test(v.data)) erros.push(`${onde}: data AAAA-MM-DD`);
    if (typeof v.revisao !== "boolean") erros.push(`${onde}: falta "revisao"`);
  }
  return erros;
}

export interface TrabalhadorQueEnsina {
  /** Slug em content/memorial. Pessoa só do Memorial. */
  memorial: string;
  /** O nome como está no Memorial (o teste confere). */
  nome: string;
  tema: string;
  /** trilha/aula existente. */
  aula?: string;
  /** /memorial/<slug> ou /trilhas/<trilha>/<aula>: o link do próprio site. */
  fonte: string;
  texto: string;
  revisao: boolean;
}

export function validarTrabalhadoresQueEnsinam(lista: unknown, c: { memorialExiste: (slug: string) => boolean; aulaExiste: (aula: string) => boolean }): string[] {
  if (!Array.isArray(lista)) return ["a lista não é uma lista"];
  const erros: string[] = [];
  const vistos = new Set<string>();
  for (const [i, bruto] of lista.entries()) {
    const t = bruto as Partial<TrabalhadorQueEnsina> | null;
    const onde = `item ${i + 1}`;
    if (!t || typeof t !== "object") {
      erros.push(`${onde} não é um objeto`);
      continue;
    }
    if (!texto(t.memorial) || !FORMATO.test(t.memorial) || !c.memorialExiste(t.memorial)) erros.push(`${onde}: pessoa fora do Memorial ${String(t.memorial)}`);
    else if (vistos.has(t.memorial)) erros.push(`${onde}: pessoa repetida ${t.memorial}`);
    else vistos.add(t.memorial);
    if (!texto(t.nome)) erros.push(`${onde}: falta "nome"`);
    if (!texto(t.tema)) erros.push(`${onde}: falta "tema"`);
    if (t.aula !== undefined && (!texto(t.aula) || !c.aulaExiste(t.aula))) erros.push(`${onde}: aula inexistente ${String(t.aula)}`);
    if (!texto(t.fonte) || !(t.fonte === `/memorial/${t.memorial}` || (t.aula !== undefined && t.fonte === `/trilhas/${t.aula}`))) erros.push(`${onde}: fonte deve ser o link do Memorial ou da aula`);
    if (!texto(t.texto)) erros.push(`${onde}: falta "texto"`);
    if (t.revisao !== true) erros.push(`${onde}: falta "revisao": true`);
  }
  return erros;
}

// ───────────── Estudo de caso do bairro ─────────────

export type FichaDoCaso = string[];

/** Texto limpo de cada passo: exatamente 5, cada um até 600 caracteres. */
export const fichaValida = (passos: unknown): passos is FichaDoCaso =>
  Array.isArray(passos) && passos.length === PASSOS_DO_CASO && passos.every((p) => typeof p === "string" && p.length <= MAX_PASSO_DO_CASO);

function lerCasos(): Record<string, { passos: FichaDoCaso; atualizadoEm: string }> {
  const bruto = lerBruto(CHAVE_DO_CASO) as { versao?: unknown; itens?: unknown } | null;
  if (!bruto || bruto.versao !== 1 || !bruto.itens || typeof bruto.itens !== "object" || Array.isArray(bruto.itens)) return {};
  const saida: Record<string, { passos: FichaDoCaso; atualizadoEm: string }> = {};
  for (const [chave, v] of Object.entries(bruto.itens as Record<string, { passos?: unknown; atualizadoEm?: unknown }>)) {
    if (!FORMATO.test(chave) || !v || !fichaValida(v.passos) || typeof v.atualizadoEm !== "string" || !DIA.test(v.atualizadoEm)) continue;
    saida[chave] = { passos: v.passos, atualizadoEm: v.atualizadoEm };
  }
  return saida;
}

/** O rascunho de um curso (ou "livre"): 5 textos, ou null quando não há. */
export const lerCaso = (curso: string = CASO_LIVRE): FichaDoCaso | null => lerCasos()[curso]?.passos ?? null;

/** Guarda o rascunho (só neste aparelho). Tudo vazio apaga. Devolve false com passo longo demais ou aparelho sem armazenamento. */
export function gravarCaso(curso: string, passos: string[], agora: Date = new Date()): boolean {
  if (!FORMATO.test(curso) || !fichaValida(passos)) return false;
  const todos = lerCasos();
  if (passos.every((p) => !p.trim())) delete todos[curso];
  else todos[curso] = { passos: [...passos], atualizadoEm: diaEmBrasilia(agora) };
  return gravarBruto(CHAVE_DO_CASO, Object.keys(todos).length ? { versao: 1, itens: todos } : null);
}

export const apagarCaso = (curso: string) => gravarCaso(curso, Array(PASSOS_DO_CASO).fill(""));

/**
 * Põe o resumo do caso na caderneta (tipo "caso", sem "pessoas"). A tela avisa antes que a caderneta pode ser exportada e
 * vista por outras pessoas. Um registro por curso: registrar de novo troca o anterior.
 */
export function registrarCasoNaCaderneta(curso: string, titulo: string, passos: string[], rotulos: string[], agora: Date = new Date()): RegistroDaCaderneta | null {
  if (!FORMATO.test(curso) || !fichaValida(passos) || passos.every((p) => !p.trim())) return null;
  const detalhe = passos
    .map((p, i) => (p.trim() ? `${rotulos[i] ?? i + 1}: ${p.trim()}` : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_DETALHE);
  return acrescentarNaCaderneta({
    id: `caso-${curso}`,
    tipo: "caso",
    ...(curso !== CASO_LIVRE ? { curso } : {}),
    data: diaEmBrasilia(agora),
    titulo: titulo.slice(0, MAX_TITULO),
    detalhe,
  });
}
