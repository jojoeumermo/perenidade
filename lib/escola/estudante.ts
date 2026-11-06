// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O estudante da Escola Revolucionária Lúcia Maria, guardado só neste aparelho: a matrícula (sem nome, sem e-mail, sem documento), os
// cursos em que entrou e a caderneta do que fez. Nada disso vai para servidor. Sem React e sem os atalhos "@/" de
// propósito: `npm run testar:escola` roda este arquivo direto no Node.
//
// Prefixos: tudo em "lucia:escola:" entra na cópia de segurança (lib/estudo.ts); "lucia:escola-privado:" fica fora da
// cópia, mas o "apagar meus dados" apaga. Pacote que precisar de chave nova usa um dos dois prefixos sem editar este
// arquivo (docs/ESCOLA.md).

export const PREFIXO = "lucia:escola:";
export const PREFIXO_PRIVADO = "lucia:escola-privado:";

/** As chaves reservadas da Escola (entram na cópia de segurança). */
export const CHAVES_DA_ESCOLA = {
  matricula: "lucia:escola:matricula",
  cursos: "lucia:escola:cursos",
  plano: "lucia:escola:plano",
  passaporte: "lucia:escola:passaporte",
  avaliacoes: "lucia:escola:avaliacoes",
  provas: "lucia:escola:provas",
  explicacoes: "lucia:escola:explicacoes",
  tarefas: "lucia:escola:tarefas",
  projeto: "lucia:escola:projeto",
  caderneta: "lucia:escola:caderneta",
  assembleia: "lucia:escola:assembleia",
  contou: "lucia:escola:contou",
  abertura: "lucia:escola:abertura-vista",
  avisosLidos: "lucia:escola:avisos-lidos",
  missoes: "lucia:escola:missoes",
  ouvidoria: "lucia:escola:ouvidoria-protocolos",
  leituras: "lucia:escola:leituras",
  circulos: "lucia:escola:circulos",
  meuDocumento: "lucia:escola:meu-documento",
} as const;

/** As chaves privadas: fora da cópia de segurança, mas apagadas pelo "apagar meus dados". */
export const CHAVES_PRIVADAS = {
  conversas: "lucia:escola-privado:conversas",
  trabalho: "lucia:escola-privado:trabalho",
} as const;

// ───────────── Tipos ─────────────

export const OBJETIVOS = ["terminar-a-escola", "trabalho-e-renda", "entender-o-mundo", "enem", "ajudar-em-casa", "outro"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];
/** Horas por semana que a pessoa diz ter. */
export const TEMPOS = ["ate-1h", "1-3h", "3-6h", "mais-6h"] as const;
export type Tempo = (typeof TEMPOS)[number];
export const ACESSOS = ["pacote-acaba", "wifi-em-casa", "computador-ou-nucleo"] as const;
export type Acesso = (typeof ACESSOS)[number];

export interface Matricula {
  versao: 1;
  /** "LM-XXXX-XXXX", gerado no aparelho; nunca sai dele. */
  numero: string;
  /** AAAA-MM-DD */
  criadaEm: string;
  /** Como a pessoa quer ser chamada, se quiser (até 40 caracteres). */
  apelido?: string;
  objetivo: Objetivo;
  tempo: Tempo;
  acesso: Acesso;
  /** Trilhas sugeridas pelo nivelamento. */
  nivelamento: string[];
}

export interface Inscricao {
  curso: string;
  /** AAAA-MM-DD */
  entrouEm: string;
  /** "AAAA.1" ou "AAAA.2" */
  semestre: string;
  /** Trilhas dispensadas (a pessoa já sabe). */
  dispensas: string[];
  formadoEm?: string;
  trancadoEm?: string;
}

export const TIPOS_DE_REGISTRO = ["saberes", "banca", "tarefa", "caso", "turma", "outro"] as const;
export type TipoDeRegistro = (typeof TIPOS_DE_REGISTRO)[number];

export interface RegistroDaCaderneta {
  id: string;
  tipo: TipoDeRegistro;
  curso?: string;
  /** AAAA-MM-DD */
  data: string;
  /** Até 160 caracteres. */
  titulo: string;
  /** Até 2000 caracteres. */
  detalhe: string;
  pessoas?: string[];
}

export const MAX_APELIDO = 40;
export const MAX_TITULO = 160;
export const MAX_DETALHE = 2000;
export const MAX_CADERNETA = 500;

// ───────────── Armazenamento ─────────────

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem" | "length" | "key">;
const armazenamento = (): Armazenamento | undefined => {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

function avisar() {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // fora do navegador não há quem ouvir
  }
}

function lerJSON(chave: string): unknown {
  try {
    const texto = armazenamento()?.getItem(chave);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

function gravarJSON(chave: string, valor: unknown): boolean {
  try {
    const a = armazenamento();
    if (!a) return false;
    a.setItem(chave, JSON.stringify(valor));
    avisar();
    return true;
  } catch {
    // armazenamento cheio ou bloqueado: o estudo segue, só não fica guardado
    return false;
  }
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const SEMESTRE = /^\d{4}\.[12]$/;
const ehTexto = (v: unknown): v is string => typeof v === "string";
const listaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);

/** AAAA-MM-DD no fuso de Brasília (UTC-3, sem horário de verão desde 2019). */
export function diaEmBrasilia(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** O semestre de uma data: janeiro a julho é ".1", agosto a dezembro é ".2" (a inscrição só guarda a etiqueta). */
export function semestreDaData(dia: string): string {
  const [ano, mes] = dia.split("-").map(Number);
  return `${ano}.${mes >= 8 ? 2 : 1}`;
}

// ───────────── Número de matrícula ─────────────

/** Base32 de Crockford: sem I, L, O e U, para não confundir com 1, 0 e V ao copiar à mão. */
export const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const FORMATO_DO_NUMERO = /^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

function bytesAleatorios(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** "LM-XXXX-XXXX" a partir de 5 bytes aleatórios (40 bits, 8 letras de 5 bits). Sem argumento, sorteia no aparelho. */
export function numeroDeMatricula(bytes: Uint8Array = bytesAleatorios(5)): string {
  // 40 bits cabem inteiros num número do JavaScript (até 2^53), sem precisar de BigInt.
  let bits = 0;
  for (let i = 0; i < 5; i++) bits = bits * 256 + ((bytes[i] ?? 0) & 255);
  let letras = "";
  for (let i = 7; i >= 0; i--) letras += ALFABETO[Math.floor(bits / 2 ** (i * 5)) % 32];
  return `LM-${letras.slice(0, 4)}-${letras.slice(4)}`;
}

// ───────────── Matrícula ─────────────

export interface RespostasDaMatricula {
  apelido?: string;
  objetivo: Objetivo;
  tempo: Tempo;
  acesso: Acesso;
  nivelamento?: string[];
}

export function novaMatricula(respostas: RespostasDaMatricula, agora: Date = new Date(), bytes?: Uint8Array): Matricula {
  const apelido = respostas.apelido?.trim().slice(0, MAX_APELIDO);
  return {
    versao: 1,
    numero: numeroDeMatricula(bytes),
    criadaEm: diaEmBrasilia(agora),
    ...(apelido ? { apelido } : {}),
    objetivo: respostas.objetivo,
    tempo: respostas.tempo,
    acesso: respostas.acesso,
    nivelamento: [...new Set(respostas.nivelamento ?? [])],
  };
}

/** Confere a forma; o que vier errado (arquivo mexido, versão antiga) vira null. Nunca lança. */
export function validarMatricula(dado: unknown): Matricula | null {
  if (!dado || typeof dado !== "object") return null;
  const m = dado as Record<string, unknown>;
  if (m.versao !== 1) return null;
  if (!ehTexto(m.numero) || !FORMATO_DO_NUMERO.test(m.numero)) return null;
  if (!ehTexto(m.criadaEm) || !DIA.test(m.criadaEm)) return null;
  if (m.apelido !== undefined && (!ehTexto(m.apelido) || m.apelido.length > MAX_APELIDO)) return null;
  if (!OBJETIVOS.includes(m.objetivo as Objetivo)) return null;
  if (!TEMPOS.includes(m.tempo as Tempo)) return null;
  if (!ACESSOS.includes(m.acesso as Acesso)) return null;
  if (!listaDeTextos(m.nivelamento)) return null;
  return {
    versao: 1,
    numero: m.numero,
    criadaEm: m.criadaEm,
    ...(m.apelido ? { apelido: m.apelido } : {}),
    objetivo: m.objetivo as Objetivo,
    tempo: m.tempo as Tempo,
    acesso: m.acesso as Acesso,
    nivelamento: m.nivelamento,
  };
}

export const lerMatricula = (): Matricula | null => validarMatricula(lerJSON(CHAVES_DA_ESCOLA.matricula));

/** Grava só se a forma estiver certa. */
export function gravarMatricula(m: Matricula): boolean {
  const valida = validarMatricula(m);
  return valida ? gravarJSON(CHAVES_DA_ESCOLA.matricula, valida) : false;
}

// ───────────── Inscrições ─────────────

function validarInscricao(dado: unknown): Inscricao | null {
  if (!dado || typeof dado !== "object") return null;
  const i = dado as Record<string, unknown>;
  if (!ehTexto(i.curso) || !i.curso) return null;
  if (!ehTexto(i.entrouEm) || !DIA.test(i.entrouEm)) return null;
  if (!ehTexto(i.semestre) || !SEMESTRE.test(i.semestre)) return null;
  if (!listaDeTextos(i.dispensas)) return null;
  if (i.formadoEm !== undefined && (!ehTexto(i.formadoEm) || !DIA.test(i.formadoEm))) return null;
  if (i.trancadoEm !== undefined && (!ehTexto(i.trancadoEm) || !DIA.test(i.trancadoEm))) return null;
  return {
    curso: i.curso,
    entrouEm: i.entrouEm,
    semestre: i.semestre,
    dispensas: i.dispensas,
    ...(i.formadoEm ? { formadoEm: i.formadoEm as string } : {}),
    ...(i.trancadoEm ? { trancadoEm: i.trancadoEm as string } : {}),
  };
}

export function lerInscricoes(): Inscricao[] {
  const dado = lerJSON(CHAVES_DA_ESCOLA.cursos);
  if (!Array.isArray(dado)) return [];
  const vistos = new Set<string>();
  const lista: Inscricao[] = [];
  for (const item of dado) {
    const i = validarInscricao(item);
    if (i && !vistos.has(i.curso)) {
      vistos.add(i.curso);
      lista.push(i);
    }
  }
  return lista;
}

const gravarInscricoes = (lista: Inscricao[]) => gravarJSON(CHAVES_DA_ESCOLA.cursos, lista);

/** Entra num curso. Quem já estava e tinha trancado volta (a data de entrada fica a primeira). */
export function inscrever(curso: string, agora: Date = new Date()): Inscricao {
  const dia = diaEmBrasilia(agora);
  const lista = lerInscricoes();
  const existente = lista.find((i) => i.curso === curso);
  if (existente) {
    if (existente.trancadoEm) delete existente.trancadoEm;
    gravarInscricoes(lista);
    return existente;
  }
  const nova: Inscricao = { curso, entrouEm: dia, semestre: semestreDaData(dia), dispensas: [] };
  gravarInscricoes([...lista, nova]);
  return nova;
}

function mudar(curso: string, muda: (i: Inscricao) => void): Inscricao | null {
  const lista = lerInscricoes();
  const i = lista.find((x) => x.curso === curso);
  if (!i) return null;
  muda(i);
  gravarInscricoes(lista);
  return i;
}

/** Tranca o curso (sem culpa: dá para voltar com inscrever). */
export const trancar = (curso: string, agora: Date = new Date()) =>
  mudar(curso, (i) => {
    i.trancadoEm = diaEmBrasilia(agora);
  });

/** Marca a formatura no curso (data AAAA-MM-DD). */
export const marcarFormatura = (curso: string, data: string) =>
  DIA.test(data)
    ? mudar(curso, (i) => {
        i.formadoEm = data;
        delete i.trancadoEm;
      })
    : null;

/** Dispensa uma trilha do curso (a pessoa já sabe). */
export const marcarDispensa = (curso: string, trilha: string) =>
  mudar(curso, (i) => {
    if (trilha && !i.dispensas.includes(trilha)) i.dispensas.push(trilha);
  });

// ───────────── Caderneta ─────────────

function validarRegistro(dado: unknown): RegistroDaCaderneta | null {
  if (!dado || typeof dado !== "object") return null;
  const r = dado as Record<string, unknown>;
  if (!ehTexto(r.id) || !r.id) return null;
  if (!TIPOS_DE_REGISTRO.includes(r.tipo as TipoDeRegistro)) return null;
  if (!ehTexto(r.data) || !DIA.test(r.data)) return null;
  if (!ehTexto(r.titulo) || !ehTexto(r.detalhe)) return null;
  if (r.curso !== undefined && !ehTexto(r.curso)) return null;
  if (r.pessoas !== undefined && !listaDeTextos(r.pessoas)) return null;
  return {
    id: r.id,
    tipo: r.tipo as TipoDeRegistro,
    ...(r.curso ? { curso: r.curso as string } : {}),
    data: r.data,
    titulo: r.titulo.slice(0, MAX_TITULO),
    detalhe: r.detalhe.slice(0, MAX_DETALHE),
    ...(r.pessoas ? { pessoas: r.pessoas as string[] } : {}),
  };
}

export function lerCaderneta(): RegistroDaCaderneta[] {
  const dado = lerJSON(CHAVES_DA_ESCOLA.caderneta);
  if (!Array.isArray(dado)) return [];
  return dado.map(validarRegistro).filter((r): r is RegistroDaCaderneta => r !== null);
}

/** Acrescenta um registro (os mais velhos saem quando passa de 500). Devolve o registro guardado. */
export function acrescentarNaCaderneta(registro: Omit<RegistroDaCaderneta, "id"> & { id?: string }): RegistroDaCaderneta | null {
  const id = registro.id || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const valido = validarRegistro({ ...registro, id });
  if (!valido) return null;
  const lista = lerCaderneta().filter((r) => r.id !== valido.id);
  lista.push(valido);
  gravarJSON(CHAVES_DA_ESCOLA.caderneta, lista.slice(-MAX_CADERNETA));
  return valido;
}

// ───────────── Abertura ─────────────

/** A abertura da Escola já foi vista neste aparelho? (Sem armazenamento, conta como vista: não insiste.) */
export function aberturaVista(): boolean {
  try {
    const a = armazenamento();
    return !a || a.getItem(CHAVES_DA_ESCOLA.abertura) !== null;
  } catch {
    return true;
  }
}

/** Marca a abertura como vista (com o dia, AAAA-MM-DD). */
export const marcarAberturaVista = (agora: Date = new Date()) => gravarJSON(CHAVES_DA_ESCOLA.abertura, diaEmBrasilia(agora));

// ───────────── Apagar ─────────────

/** Remove toda chave dos dois prefixos da Escola (e nada além delas). Devolve quantas saíram. */
export function apagarEscola(): number {
  const a = armazenamento();
  if (!a) return 0;
  const chaves: string[] = [];
  try {
    for (let i = 0; i < a.length; i++) {
      const chave = a.key(i);
      if (chave && (chave.startsWith(PREFIXO) || chave.startsWith(PREFIXO_PRIVADO))) chaves.push(chave);
    }
    for (const chave of chaves) a.removeItem(chave);
  } catch {
    // armazenamento bloqueado: não havia o que apagar
  }
  avisar();
  return chaves.length;
}
