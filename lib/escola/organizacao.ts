// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Núcleos e organização estudantil da Escola Revolucionária Lúcia Maria (E4-12, docs/escola/organizacao.md): a pauta da assembleia
// (voto anônimo, somado), o resultado sem ranking de pessoas, a Roda do semestre, a ouvidoria (regras de envio, recusas e
// os protocolos do aparelho) e o educador ou educadora do mês. Só regras e o que fica no aparelho: o que vai ao banco
// passa pelas funções de lib/escola/banco.ts, que a tela entrega aqui por parâmetro. Sem os atalhos "@/" de propósito:
// `npm run testar:escola-organizacao` roda este arquivo direto no Node.

import { CHAVES_DA_ESCOLA } from "./estudante";
import { ANO_LETIVO, type AnoLetivo, semestreDe } from "./tempo";
import { pareceNomeCompleto } from "./turma-do-curso";

export const VOTOS_POR_PESSOA = 3;
/** Abaixo disto a tela não mostra números: soma pequena demais para parecer pesquisa. */
export const MIN_PARA_MOSTRAR_RESULTADO = 10;
export const MAX_CANDIDATAS = 12;
export const MAX_PROTOCOLOS = 50;
export const MAX_RODAS = 4;
export const MAX_RESPOSTA_DA_RODA = 600;
export const PERGUNTAS_DA_RODA = ["p1", "p2", "p3", "p4", "p5"] as const;
export type PerguntaDaRoda = (typeof PERGUNTAS_DA_RODA)[number];

export const TEXTO_MIN = 10;
export const TEXTO_MAX = 3000;
export const CONTATO_MAX = 200;
export const CAMINHO = /^\/[a-z0-9/._-]{0,199}$/;
export const ASSUNTOS = ["aula", "curso", "educador", "escola", "outro"] as const;
export type AssuntoDaOuvidoria = (typeof ASSUNTOS)[number];
export const PROTOCOLO = /^[0-9a-f]{8}$/;

export const CHAVE_DA_ASSEMBLEIA = CHAVES_DA_ESCOLA.assembleia;
export const CHAVE_DOS_PROTOCOLOS = CHAVES_DA_ESCOLA.ouvidoria;
/** Chave do prefixo da Escola (entra na cópia, sai no "apagar meus dados"). */
export const CHAVE_DA_RODA = "lucia:escola:roda-do-semestre";

const SEMESTRE = /^\d{4}\.[12]$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const SLUG_DA_TRILHA = /^[a-z0-9_-]{1,150}$/;
const SLUG_DO_CURSO = /^[a-z0-9][a-z0-9-]{0,79}$/;

const eObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// ── Armazenamento do aparelho ───────────────────────────────────────────────────────────────────────────────────────

export type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** O armazenamento do aparelho, ou null quando não há ou está bloqueado. */
export function armazenamentoPadrao(): Armazenamento | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function avisar() {
  try {
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // sem janela: nada a avisar
  }
}

function lerTexto(chave: string, arm: Armazenamento | null): string | null {
  try {
    return arm ? arm.getItem(chave) : null;
  } catch {
    return null;
  }
}

function gravarTexto(chave: string, texto: string | null, arm: Armazenamento | null): boolean {
  try {
    if (!arm) return false;
    if (texto === null) arm.removeItem(chave);
    else arm.setItem(chave, texto);
    avisar();
    return true;
  } catch {
    return false;
  }
}

function jsonDe(texto: string | null): unknown {
  try {
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

// ── Ouvidoria: regras e recusas ─────────────────────────────────────────────────────────────────────────────────────

export interface DadosDaMensagem {
  sobre: string;
  caminho?: string;
  texto: string;
  contato?: string;
}

export type ProblemaDaMensagem = "assunto" | "texto-curto" | "texto-longo" | "caminho" | "contato-longo";

/** Espelha as regras do banco para avisar antes de enviar. Quem decide é o banco. Devolve null quando está certa. */
export function validarMensagem(dados: DadosDaMensagem): ProblemaDaMensagem | null {
  if (!(ASSUNTOS as readonly string[]).includes(dados.sobre)) return "assunto";
  const texto = dados.texto.trim();
  if (texto.length < TEXTO_MIN) return "texto-curto";
  if (texto.length > TEXTO_MAX) return "texto-longo";
  if (dados.caminho && !CAMINHO.test(dados.caminho)) return "caminho";
  if ((dados.contato ?? "").trim().length > CONTATO_MAX) return "contato-longo";
  return null;
}

/** O assunto de um endereço (?sobre=), só se for um dos cinco. */
export const assuntoValido = (valor: string | null | undefined): AssuntoDaOuvidoria | null =>
  (ASSUNTOS as readonly string[]).includes(valor ?? "") ? (valor as AssuntoDaOuvidoria) : null;

/** O caminho de um endereço (?caminho=), só se casar com o formato do banco. */
export const caminhoValido = (valor: string | null | undefined): string => (valor && CAMINHO.test(valor) ? valor : "");

/** Os códigos de recusa do banco (docs/escola/banco.md) que a ouvidoria explica, e a chave do texto de cada um. */
export const CHAVES_DE_RECUSA = {
  entre_primeiro: "entrePrimeiro",
  conta_suspensa: "contaSuspensa",
  "invalido:sobre": "invalidoSobre",
  "invalido:caminho": "invalidoCaminho",
  "invalido:texto": "invalidoTexto",
  "invalido:contato": "invalidoContato",
  area_interditada: "areaInterditada",
  envios_pausados: "enviosPausados",
  acesso_bloqueado: "acessoBloqueado",
  muitos_pedidos: "muitosPedidos",
} as const;

/** A chave do texto de uma recusa; código desconhecido cai em "generica" ("tente de novo mais tarde"). */
export const chaveDaRecusa = (codigo: string): string => (CHAVES_DE_RECUSA as Record<string, string>)[codigo] ?? "generica";

/** O texto de uma recusa, nos textos do idioma da pessoa. */
export const mensagemDeRecusa = (codigo: string, recusas: Record<string, string>): string => recusas[chaveDaRecusa(codigo)] ?? recusas.generica ?? "";

// ── Ouvidoria: protocolos guardados no aparelho ─────────────────────────────────────────────────────────────────────

export interface ProtocoloGuardado {
  protocolo: string;
  sobre: AssuntoDaOuvidoria;
  /** AAAA-MM-DD */
  em: string;
}

function protocoloValido(bruto: unknown): ProtocoloGuardado | null {
  if (!eObjeto(bruto)) return null;
  const protocolo = typeof bruto.protocolo === "string" ? bruto.protocolo.toLowerCase() : "";
  const sobre = assuntoValido(typeof bruto.sobre === "string" ? bruto.sobre : null);
  const em = typeof bruto.em === "string" && DIA.test(bruto.em) ? bruto.em : "";
  return PROTOCOLO.test(protocolo) && sobre && em ? { protocolo, sobre, em } : null;
}

/** A lista guardada (texto do armazenamento). Lixo vira lista vazia; fica no máximo MAX_PROTOCOLOS, sem repetir. */
export function lerProtocolos(texto: string | null): ProtocoloGuardado[] {
  const dado = jsonDe(texto);
  if (!Array.isArray(dado)) return [];
  const lista: ProtocoloGuardado[] = [];
  for (const bruto of dado) {
    const p = protocoloValido(bruto);
    if (p && !lista.some((q) => q.protocolo === p.protocolo)) lista.push(p);
  }
  return lista.slice(-MAX_PROTOCOLOS);
}

/** Acrescenta um protocolo (o mais antigo sai quando passa de MAX_PROTOCOLOS; repetido não duplica). */
export function acrescentarProtocolo(lista: readonly ProtocoloGuardado[], novo: ProtocoloGuardado): ProtocoloGuardado[] {
  const p = protocoloValido(novo);
  if (!p) return [...lista];
  return [...lista.filter((q) => q.protocolo !== p.protocolo), p].slice(-MAX_PROTOCOLOS);
}

export const esquecerProtocolo = (lista: readonly ProtocoloGuardado[], protocolo: string): ProtocoloGuardado[] =>
  lista.filter((q) => q.protocolo !== protocolo.toLowerCase());

export const lerProtocolosGuardados = (arm: Armazenamento | null = armazenamentoPadrao()) => lerProtocolos(lerTexto(CHAVE_DOS_PROTOCOLOS, arm));

/** Grava a lista (vazia apaga a chave). Devolve false se o aparelho não guarda. */
export const guardarProtocolos = (lista: readonly ProtocoloGuardado[], arm: Armazenamento | null = armazenamentoPadrao()) =>
  gravarTexto(CHAVE_DOS_PROTOCOLOS, lista.length ? JSON.stringify(lista.slice(-MAX_PROTOCOLOS)) : null, arm);

// ── Assembleia: pauta ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Pauta {
  semestre: string;
  confirmado: boolean;
  candidatas: string[];
  abreEm?: string;
  fechaEm?: string;
}

export type SituacaoDaAssembleia = "aberta" | "fechada" | "sem-pauta" | "outro-semestre";

/** O primeiro e o último dia de um semestre "AAAA.S", pelas datas do ano letivo. */
export function limitesDoSemestre(id: string, ano: AnoLetivo = ANO_LETIVO): { inicio: string; fim: string } | null {
  if (!SEMESTRE.test(id)) return null;
  const c = ano.semestres[id.slice(5) as "1" | "2"];
  return { inicio: `${id.slice(0, 4)}-${c.inicio}`, fim: `${id.slice(0, 4)}-${c.fim}` };
}

/** Confere a pauta (content/escola/assembleia.json). Devolve a pauta e os erros; com erro a pauta é null. */
export function validarPauta(dado: unknown, ano: AnoLetivo = ANO_LETIVO): { pauta: Pauta | null; erros: string[] } {
  const erros: string[] = [];
  if (!eObjeto(dado)) return { pauta: null, erros: ["a pauta precisa ser um objeto"] };
  const semestre = typeof dado.semestre === "string" ? dado.semestre : "";
  const limites = limitesDoSemestre(semestre, ano);
  if (!limites) erros.push(`semestre inválido (use AAAA.S): ${String(dado.semestre)}`);
  if (typeof dado.confirmado !== "boolean") erros.push('falta "confirmado" (true ou false)');
  const candidatas = dado.candidatas;
  if (!Array.isArray(candidatas)) erros.push('"candidatas" precisa ser uma lista');
  else {
    if (candidatas.length > MAX_CANDIDATAS) erros.push(`no máximo ${MAX_CANDIDATAS} candidatas`);
    candidatas.forEach((t, i) => {
      if (typeof t !== "string" || !SLUG_DA_TRILHA.test(t)) erros.push(`candidata ${i + 1}: formato inválido`);
      else if (candidatas.indexOf(t) !== i) erros.push(`candidata repetida: ${t}`);
    });
  }
  for (const campo of ["abreEm", "fechaEm"] as const) {
    const v = dado[campo];
    if (v === undefined) continue;
    if (typeof v !== "string" || !DIA.test(v)) erros.push(`${campo}: use AAAA-MM-DD`);
    else if (limites && (v < limites.inicio || v > limites.fim)) erros.push(`${campo}: fora do semestre ${semestre}`);
  }
  if (typeof dado.abreEm === "string" && typeof dado.fechaEm === "string" && dado.abreEm > dado.fechaEm) erros.push("abreEm depois de fechaEm");
  if (erros.length) return { pauta: null, erros };
  const pauta: Pauta = { semestre, confirmado: dado.confirmado === true, candidatas: [...(candidatas as string[])] };
  if (typeof dado.abreEm === "string") pauta.abreEm = dado.abreEm;
  if (typeof dado.fechaEm === "string") pauta.fechaEm = dado.fechaEm;
  return { pauta, erros };
}

/**
 * A situação da votação num dia (AAAA-MM-DD em Brasília). Aberta só com candidatas, no semestre de hoje e dentro da
 * janela (a da pauta ou, sem ela, o semestre inteiro). Pauta inválida (null) vale como "sem-pauta".
 */
export function assembleiaAberta(pauta: Pauta | null, dia: string, ano: AnoLetivo = ANO_LETIVO): SituacaoDaAssembleia {
  if (!pauta || pauta.candidatas.length === 0) return "sem-pauta";
  if (semestreDe(dia, ano).id !== pauta.semestre) return "outro-semestre";
  const limites = limitesDoSemestre(pauta.semestre, ano);
  if (!limites) return "sem-pauta";
  const abre = pauta.abreEm ?? limites.inicio;
  const fecha = pauta.fechaEm ?? limites.fim;
  return dia >= abre && dia <= fecha ? "aberta" : "fechada";
}

// ── Assembleia: votos no aparelho ───────────────────────────────────────────────────────────────────────────────────

/** Quais trilhas a pessoa marcou neste semestre (texto do armazenamento). Lista de outro semestre é ignorada. */
export function lerVotos(texto: string | null, semestre: string): string[] {
  const dado = jsonDe(texto);
  if (!eObjeto(dado) || dado.versao !== 1 || dado.semestre !== semestre || !Array.isArray(dado.trilhas)) return [];
  return [...new Set(dado.trilhas.filter((t): t is string => typeof t === "string" && SLUG_DA_TRILHA.test(t)))].slice(0, VOTOS_POR_PESSOA);
}

export const votosDoSemestre = (semestre: string, arm: Armazenamento | null = armazenamentoPadrao()) => lerVotos(lerTexto(CHAVE_DA_ASSEMBLEIA, arm), semestre);
export const jaVotou = (semestre: string, trilha: string, arm: Armazenamento | null = armazenamentoPadrao()) => votosDoSemestre(semestre, arm).includes(trilha);

export type ResultadoDoVoto =
  | { ok: true; votos: string[] }
  | { ok: false; motivo: "outro-semestre" | "fora-da-pauta" | "repetido" | "limite" | "armazenamento"; votos: string[] };

/**
 * Marca o voto nesta trilha. Recusa a 4ª trilha, trilha fora da pauta e semestre diferente do da pauta. Grava a marca no
 * aparelho ANTES e só então manda a contagem (`contar` é contarEscola, que segura a repetição por aparelho e semestre).
 * Sem armazenamento, não conta. Não há como desfazer: o banco só soma e não sabe quem votou.
 */
export function votar(
  pauta: Pauta,
  semestre: string,
  trilha: string,
  contar: (tipo: "assembleia_voto", alvo: string, periodo: "semestre") => void,
  arm: Armazenamento | null = armazenamentoPadrao(),
): ResultadoDoVoto {
  const votos = votosDoSemestre(pauta.semestre, arm);
  if (semestre !== pauta.semestre) return { ok: false, motivo: "outro-semestre", votos };
  if (!pauta.candidatas.includes(trilha)) return { ok: false, motivo: "fora-da-pauta", votos };
  if (votos.includes(trilha)) return { ok: false, motivo: "repetido", votos };
  if (votos.length >= VOTOS_POR_PESSOA) return { ok: false, motivo: "limite", votos };
  const novos = [...votos, trilha];
  if (!gravarTexto(CHAVE_DA_ASSEMBLEIA, JSON.stringify({ versao: 1, semestre: pauta.semestre, trilhas: novos }), arm)) return { ok: false, motivo: "armazenamento", votos };
  try {
    contar("assembleia_voto", `${pauta.semestre}/${trilha}`, "semestre");
  } catch {
    // contar a menos é melhor do que quebrar a tela
  }
  return { ok: true, votos: novos };
}

// ── Assembleia: resultado ───────────────────────────────────────────────────────────────────────────────────────────

export interface LinhaDoResultado {
  trilha: string;
  total: number;
  /** De 0 a 100, em relação ao maior valor (só para a barra). */
  percentual: number;
}

export interface ResultadoDaPauta {
  /** false quando a soma é menor que MIN_PARA_MOSTRAR_RESULTADO: a tela não mostra números. */
  mostrar: boolean;
  soma: number;
  linhas: LinhaDoResultado[];
}

/** Uma linha por candidata, NA ORDEM DA PAUTA (nunca por total). Alvo que não está na pauta é ignorado. */
export function resultadoDaPauta(contagens: readonly { alvo: string; total: number }[], pauta: Pauta): ResultadoDaPauta {
  const totais = new Map<string, number>();
  for (const c of contagens) {
    const [semestre, ...resto] = c.alvo.split("/");
    const trilha = resto.join("/");
    if (semestre !== pauta.semestre || !pauta.candidatas.includes(trilha)) continue;
    totais.set(trilha, (totais.get(trilha) ?? 0) + Math.max(0, Number(c.total) || 0));
  }
  const maior = Math.max(0, ...totais.values());
  const linhas = pauta.candidatas.map((trilha) => {
    const total = totais.get(trilha) ?? 0;
    return { trilha, total, percentual: maior > 0 ? Math.round((total / maior) * 100) : 0 };
  });
  const soma = linhas.reduce((s, l) => s + l.total, 0);
  return { mostrar: soma >= MIN_PARA_MOSTRAR_RESULTADO, soma, linhas };
}

// ── Roda do semestre ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Roda {
  semestre: string;
  respostas: Record<PerguntaDaRoda, string>;
  /** AAAA-MM-DD da última mudança. */
  em: string;
}

export const rodaVazia = (semestre: string, em = ""): Roda => ({ semestre, em, respostas: { p1: "", p2: "", p3: "", p4: "", p5: "" } });

function rodaValida(bruto: unknown): Roda | null {
  if (!eObjeto(bruto) || typeof bruto.semestre !== "string" || !SEMESTRE.test(bruto.semestre) || !eObjeto(bruto.respostas)) return null;
  const roda = rodaVazia(bruto.semestre, typeof bruto.em === "string" && DIA.test(bruto.em) ? bruto.em : "");
  for (const p of PERGUNTAS_DA_RODA) {
    const r = bruto.respostas[p];
    roda.respostas[p] = typeof r === "string" ? r.slice(0, MAX_RESPOSTA_DA_RODA) : "";
  }
  return roda;
}

/** As rodas guardadas (texto do armazenamento): no máximo MAX_RODAS, uma por semestre, a mais nova por último. */
export function lerRodas(texto: string | null): Roda[] {
  const dado = jsonDe(texto);
  const brutas = eObjeto(dado) && dado.versao === 1 && Array.isArray(dado.rodas) ? dado.rodas : [];
  const porSemestre = new Map<string, Roda>();
  for (const b of brutas) {
    const r = rodaValida(b);
    if (r) porSemestre.set(r.semestre, r);
  }
  return [...porSemestre.values()].sort((a, b) => a.semestre.localeCompare(b.semestre)).slice(-MAX_RODAS);
}

/** Põe a roda na lista (troca a do mesmo semestre) e devolve a lista nova. Roda toda em branco sai da lista. */
export function gravarRoda(lista: readonly Roda[], roda: Roda): Roda[] {
  const r = rodaValida(roda);
  if (!r) return [...lista];
  const resto = lista.filter((x) => x.semestre !== r.semestre);
  const vazia = PERGUNTAS_DA_RODA.every((p) => !r.respostas[p].trim());
  return (vazia ? resto : [...resto, r]).sort((a, b) => a.semestre.localeCompare(b.semestre)).slice(-MAX_RODAS);
}

export const apagarRoda = (lista: readonly Roda[], semestre: string): Roda[] => lista.filter((x) => x.semestre !== semestre);

export const lerRodasGuardadas = (arm: Armazenamento | null = armazenamentoPadrao()) => lerRodas(lerTexto(CHAVE_DA_RODA, arm));

export const guardarRodas = (lista: readonly Roda[], arm: Armazenamento | null = armazenamentoPadrao()) =>
  gravarTexto(CHAVE_DA_RODA, lista.length ? JSON.stringify({ versao: 1, rodas: lista.slice(-MAX_RODAS) }) : null, arm);

/** A roda de um semestre, ou uma em branco. */
export const rodaDoSemestre = (lista: readonly Roda[], semestre: string): Roda => lista.find((r) => r.semestre === semestre) ?? rodaVazia(semestre);

/** O texto da roda para copiar, imprimir ou levar à ouvidoria: título, e cada pergunta com a resposta. */
export function textoDaRoda(roda: Roda, perguntas: Record<PerguntaDaRoda, string>, titulo: string): string {
  const partes = [titulo];
  for (const p of PERGUNTAS_DA_RODA) {
    const r = roda.respostas[p].trim();
    if (r) partes.push(`${perguntas[p]}\n${r}`);
  }
  return partes.join("\n\n").slice(0, TEXTO_MAX);
}

/** A resposta parece ter nome de pessoa (a tela avisa; a Roda não leva nome). */
export const respostaComNome = (resposta: string): boolean => pareceNomeCompleto(resposta);

// ── Educador ou educadora do mês ────────────────────────────────────────────────────────────────────────────────────

export interface EducadorDoMes {
  mes: string;
  apelido: string;
  curso?: string;
  motivo: string;
  autorizacao: true;
}

const CAMPOS_DO_EDUCADOR = new Set(["mes", "apelido", "curso", "motivo", "autorizacao"]);
export const MAX_APELIDO = 40;
export const MAX_MOTIVO = 280;

/**
 * Confere a lista de content/escola/educador-do-mes.json. Devolve os erros (vazio quando está certa). Um erro invalida
 * a lista inteira (a página não mostra nada). `cursos` é o conjunto dos cursos que existem; null pula esse teste (a
 * página não lê disco; quem confere é o teste do pacote).
 */
export function validarEducadores(lista: unknown, cursos: ReadonlySet<string> | null = null): string[] {
  if (!Array.isArray(lista)) return ["a lista de educadores precisa ser uma lista"];
  const erros: string[] = [];
  const meses = new Set<string>();
  lista.forEach((e, i) => {
    const onde = `educador ${i + 1}`;
    if (!eObjeto(e)) return void erros.push(`${onde}: não é um objeto`);
    for (const campo of Object.keys(e)) if (!CAMPOS_DO_EDUCADOR.has(campo)) erros.push(`${onde}: campo não aceito: ${campo} (sem foto, sem ranking)`);
    if (e.autorizacao !== true) erros.push(`${onde}: sem "autorizacao": true (a pessoa precisa ter autorizado)`);
    if (typeof e.mes !== "string" || !MES.test(e.mes)) erros.push(`${onde}: mês inválido (use AAAA-MM)`);
    else if (meses.has(e.mes)) erros.push(`${onde}: mês repetido: ${e.mes}`);
    else meses.add(e.mes);
    const apelido = typeof e.apelido === "string" ? e.apelido.trim() : "";
    if (!apelido || apelido.length > MAX_APELIDO) erros.push(`${onde}: apelido de 1 a ${MAX_APELIDO} caracteres`);
    else if (/@|\d/.test(apelido)) erros.push(`${onde}: o apelido não pode ter número nem e-mail`);
    else if (apelido.split(/\s+/).length >= 3) erros.push(`${onde}: apelido parece nome completo (use só o apelido)`);
    const motivo = typeof e.motivo === "string" ? e.motivo.trim() : "";
    if (!motivo || motivo.length > MAX_MOTIVO) erros.push(`${onde}: motivo de 1 a ${MAX_MOTIVO} caracteres`);
    if (e.curso !== undefined) {
      if (typeof e.curso !== "string" || !SLUG_DO_CURSO.test(e.curso)) erros.push(`${onde}: curso com formato inválido`);
      else if (cursos && !cursos.has(e.curso)) erros.push(`${onde}: curso não existe: ${e.curso}`);
    }
  });
  return erros;
}

const mesAnterior = (mes: string, n: number) => {
  const total = Number(mes.slice(0, 4)) * 12 + (Number(mes.slice(5)) - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

/** O do mês corrente e os 11 anteriores (no máximo 12 meses, do mais novo ao mais antigo). Lista inválida: nada. */
export function educadorDoMes(lista: readonly EducadorDoMes[], mes: string, cursos: ReadonlySet<string> | null = null): { atual: EducadorDoMes | null; anteriores: EducadorDoMes[] } {
  if (!MES.test(mes) || validarEducadores(lista, cursos).length) return { atual: null, anteriores: [] };
  const atual = lista.find((e) => e.mes === mes) ?? null;
  const piso = mesAnterior(mes, 11);
  const anteriores = lista.filter((e) => e.mes < mes && e.mes >= piso).sort((a, b) => b.mes.localeCompare(a.mes));
  return { atual, anteriores };
}
