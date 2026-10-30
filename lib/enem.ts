// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O curso ENEM: os formatos de content/enem/ e a conferência de cada um. A matriz (matriz.yml), a edição corrente
// (edicao.yml), a camada do instituto sobre as provas oficiais (questoes-oficiais/<ano>.yml), a contagem do que mais
// cai (incidencia.yml) e os dados da redação (redacao/). Nada aqui lê arquivo: quem lê é lib/enem-conteudo.ts (no
// site) e os roteiros de scripts/ (testar:enem, cobertura:enem, fila:enem). Os formatos estão explicados em docs/ENEM.md.
// Sem os atalhos "@/" de propósito: `npm run testar:enem` roda este arquivo direto no Node.

import { type AreaDoEnem, COMPETENCIAS_DO_ENEM, FAIXAS_DO_ENEM, competenciaDaHabilidade } from "./mapa-curricular";

export const AREAS_DO_ENEM: AreaDoEnem[] = ["linguagens", "humanas", "natureza", "matematica"];
/** O prefixo dos ids de objeto e tópico de cada área (lin-texto, mat-numeros-porcentagem…). */
export const PREFIXO_DA_AREA: Record<AreaDoEnem, string> = { linguagens: "lin", matematica: "mat", natureza: "nat", humanas: "hum" };
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Dado = Record<string, unknown>;
const objeto = (v: unknown): v is Dado => typeof v === "object" && v !== null && !Array.isArray(v);

function falhar(arquivo: string, mensagem: string): never {
  throw new Error(`Conteúdo do ENEM inválido em ${arquivo}: ${mensagem}`);
}
function texto(d: Dado, chave: string, onde: string, arquivo: string, max = 400): string {
  const v = d[chave];
  if (typeof v !== "string" || !v.trim()) falhar(arquivo, `${onde}: "${chave}" é obrigatório`);
  if (v.length > max) falhar(arquivo, `${onde}: "${chave}" passa de ${max} caracteres`);
  return v.trim();
}
function opcional(d: Dado, chave: string, onde: string, arquivo: string, max = 400): string | undefined {
  if (d[chave] === undefined || d[chave] === null) return undefined;
  return texto(d, chave, onde, arquivo, max);
}
function data(d: Dado, chave: string, onde: string, arquivo: string): string {
  const v = d[chave] instanceof Date ? (d[chave] as Date).toISOString().slice(0, 10) : String(d[chave] ?? "");
  if (!DATA.test(v)) falhar(arquivo, `${onde}: "${chave}" deve ser uma data AAAA-MM-DD`);
  return v;
}
function https(d: Dado, chave: string, onde: string, arquivo: string): string {
  const v = texto(d, chave, onde, arquivo, 500);
  if (!/^https:\/\/[^\s]+$/.test(v)) falhar(arquivo, `${onde}: "${chave}" deve ser um endereço https://`);
  return v;
}
function lista(d: Dado, chave: string, onde: string, arquivo: string): unknown[] {
  const v = d[chave];
  if (!Array.isArray(v)) falhar(arquivo, `${onde}: "${chave}" deve ser uma lista`);
  return v;
}

export type Situacao = "confirmado" | "a-confirmar";
function situacao(d: Dado, onde: string, arquivo: string): Situacao {
  const v = d.situacao ?? "a-confirmar";
  if (v !== "confirmado" && v !== "a-confirmar") falhar(arquivo, `${onde}: "situacao" deve ser confirmado ou a-confirmar`);
  return v;
}

// ───────────────────────────── Matriz (matriz.yml) ─────────────────────────────

export interface HabilidadeDaMatriz {
  numero: number;
  resumo: string;
}
export interface CompetenciaDaMatriz {
  numero: number;
  resumo: string;
  habilidades: HabilidadeDaMatriz[];
}
export interface TopicoDaMatriz {
  id: string;
  nome: string;
  componente?: string;
}
export interface ObjetoDaMatriz {
  id: string;
  area: AreaDoEnem;
  nome: string;
  resumo: string;
  componente?: string;
  /** false quando o objeto não está no anexo oficial (criado pela equipe; ex.: língua estrangeira). */
  anexo: boolean;
  habilidades: number[];
  situacao: Situacao;
  topicos: TopicoDaMatriz[];
}
export interface AreaDaMatriz {
  nome: string;
  sigla: string;
  dia: 1 | 2;
  componentes: string[];
  competencias: CompetenciaDaMatriz[];
  objetos: ObjetoDaMatriz[];
}
export interface Matriz {
  fonte: { titulo: string; url: string; conferido: string };
  eixos: { sigla: string; resumo: string }[];
  areas: Record<AreaDoEnem, AreaDaMatriz>;
  redacao: { fonte: { titulo: string; url: string; conferido: string }; competencias: { numero: number; resumo: string }[] };
}

export function validarMatriz(bruto: unknown, arquivo = "content/enem/matriz.yml"): Matriz {
  if (!objeto(bruto)) falhar(arquivo, "o arquivo precisa de fonte, eixos, areas e redacao");
  const f = bruto.fonte;
  if (!objeto(f)) falhar(arquivo, '"fonte" é obrigatória');
  const fonte = { titulo: texto(f, "titulo", "fonte", arquivo), url: https(f, "url", "fonte", arquivo), conferido: data(f, "conferido", "fonte", arquivo) };
  const eixos = lista(bruto, "eixos", "eixos", arquivo).map((e, i) => {
    if (!objeto(e)) falhar(arquivo, `eixos[${i}]: precisa de sigla e resumo`);
    return { sigla: texto(e, "sigla", `eixos[${i}]`, arquivo, 4), resumo: texto(e, "resumo", `eixos[${i}]`, arquivo) };
  });
  if (eixos.length !== 5) falhar(arquivo, "a Matriz tem 5 eixos cognitivos");
  const areasBrutas = bruto.areas;
  if (!objeto(areasBrutas)) falhar(arquivo, '"areas" é obrigatória');
  const ids = new Set<string>();
  const areas = {} as Record<AreaDoEnem, AreaDaMatriz>;
  for (const area of AREAS_DO_ENEM) {
    const a = areasBrutas[area];
    const onde = `areas.${area}`;
    if (!objeto(a)) falhar(arquivo, `${onde}: a área está faltando`);
    const dia = a.dia;
    if (dia !== 1 && dia !== 2) falhar(arquivo, `${onde}: "dia" deve ser 1 ou 2`);
    const competencias = lista(a, "competencias", onde, arquivo).map((c, i): CompetenciaDaMatriz => {
      const lugar = `${onde}.competencias[${i}]`;
      if (!objeto(c)) falhar(arquivo, `${lugar}: precisa de numero, resumo e habilidades`);
      if (c.numero !== i + 1) falhar(arquivo, `${lugar}: as competências vão em ordem, a partir de 1`);
      const [de, ate] = FAIXAS_DO_ENEM[area][i] ?? [0, -1];
      const habilidades = lista(c, "habilidades", lugar, arquivo).map((h, j) => {
        if (!objeto(h)) falhar(arquivo, `${lugar}.habilidades[${j}]: precisa de numero e resumo`);
        if (h.numero !== de + j) falhar(arquivo, `${lugar}.habilidades[${j}]: esperava H${de + j} (a competência ${i + 1} vai de H${de} a H${ate})`);
        return { numero: h.numero as number, resumo: texto(h, "resumo", `${lugar}.H${h.numero}`, arquivo, 300) };
      });
      if (habilidades.length !== ate - de + 1) falhar(arquivo, `${lugar}: a competência ${i + 1} tem as habilidades H${de} a H${ate}`);
      return { numero: i + 1, resumo: texto(c, "resumo", lugar, arquivo, 300), habilidades };
    });
    if (competencias.length !== COMPETENCIAS_DO_ENEM[area]) falhar(arquivo, `${onde}: a área tem ${COMPETENCIAS_DO_ENEM[area]} competências`);
    const cobertas = new Set<number>();
    const objetos = lista(a, "objetos", onde, arquivo).map((o, i): ObjetoDaMatriz => {
      const lugar = `${onde}.objetos[${i}]`;
      if (!objeto(o)) falhar(arquivo, `${lugar}: precisa de id, nome, resumo, habilidades e topicos`);
      const id = texto(o, "id", lugar, arquivo, 60);
      if (!ID.test(id) || !id.startsWith(`${PREFIXO_DA_AREA[area]}-`)) falhar(arquivo, `${lugar}: o id "${id}" deve começar com "${PREFIXO_DA_AREA[area]}-" e ter só letras minúsculas, números e hífens`);
      if (ids.has(id)) falhar(arquivo, `${lugar}: o id "${id}" aparece duas vezes`);
      ids.add(id);
      const habilidades = lista(o, "habilidades", lugar, arquivo).map((h) => {
        if (!Number.isInteger(h) || (h as number) < 1 || (h as number) > 30) falhar(arquivo, `${lugar}: habilidade ${h} não existe (H1 a H30)`);
        cobertas.add(h as number);
        return h as number;
      });
      if (!habilidades.length) falhar(arquivo, `${lugar}: liste ao menos uma habilidade`);
      const topicos = lista(o, "topicos", lugar, arquivo).map((t, j): TopicoDaMatriz => {
        const sub = `${lugar}.topicos[${j}]`;
        if (!objeto(t)) falhar(arquivo, `${sub}: precisa de id e nome`);
        const tid = texto(t, "id", sub, arquivo, 80);
        if (!ID.test(tid) || !tid.startsWith(`${id}-`)) falhar(arquivo, `${sub}: o id do tópico "${tid}" deve começar com o id do objeto ("${id}-")`);
        if (ids.has(tid)) falhar(arquivo, `${sub}: o id "${tid}" aparece duas vezes`);
        ids.add(tid);
        return { id: tid, nome: texto(t, "nome", sub, arquivo, 120), componente: opcional(t, "componente", sub, arquivo, 40) };
      });
      if (!topicos.length) falhar(arquivo, `${lugar}: liste ao menos um tópico`);
      if (o.anexo !== undefined && typeof o.anexo !== "boolean") falhar(arquivo, `${lugar}: "anexo" é true ou false`);
      return { id, area, nome: texto(o, "nome", lugar, arquivo, 160), resumo: texto(o, "resumo", lugar, arquivo, 300), componente: opcional(o, "componente", lugar, arquivo, 40), anexo: o.anexo !== false, habilidades, situacao: situacao(o, lugar, arquivo), topicos };
    });
    for (let h = 1; h <= 30; h++) if (!cobertas.has(h)) falhar(arquivo, `${onde}: a habilidade H${h} não está ligada a nenhum objeto`);
    areas[area] = {
      nome: texto(a, "nome", onde, arquivo, 80),
      sigla: texto(a, "sigla", onde, arquivo, 4),
      dia,
      componentes: lista(a, "componentes", onde, arquivo).map(String),
      competencias,
      objetos,
    };
  }
  const r = bruto.redacao;
  if (!objeto(r) || !objeto(r.fonte)) falhar(arquivo, '"redacao" precisa de fonte e competencias');
  const competencias = lista(r, "competencias", "redacao", arquivo).map((c, i) => {
    if (!objeto(c) || c.numero !== i + 1) falhar(arquivo, `redacao.competencias[${i}]: as competências vão de 1 a 5, em ordem`);
    return { numero: i + 1, resumo: texto(c, "resumo", `redacao.C${i + 1}`, arquivo, 300) };
  });
  if (competencias.length !== 5) falhar(arquivo, "a redação tem 5 competências");
  const rf = r.fonte;
  return { fonte, eixos, areas, redacao: { fonte: { titulo: texto(rf, "titulo", "redacao.fonte", arquivo), url: https(rf, "url", "redacao.fonte", arquivo), conferido: data(rf, "conferido", "redacao.fonte", arquivo) }, competencias } };
}

/** Todos os objetos da matriz, das quatro áreas. */
export const todosOsObjetos = (m: Matriz): ObjetoDaMatriz[] => AREAS_DO_ENEM.flatMap((a) => m.areas[a].objetos);

/** Acha um objeto ou tópico pelo id. Para um tópico, devolve também o objeto a que ele pertence. */
export function acharNaMatriz(m: Matriz, id: string): { objeto: ObjetoDaMatriz; topico?: TopicoDaMatriz } | null {
  for (const o of todosOsObjetos(m)) {
    if (o.id === id) return { objeto: o };
    if (id.startsWith(`${o.id}-`)) {
      const topico = o.topicos.find((t) => t.id === id);
      if (topico) return { objeto: o, topico };
    }
  }
  return null;
}

/** O resumo de uma habilidade ("matematica", 3 → "Resolver problemas com conhecimentos numéricos."). */
export function habilidadeDaMatriz(m: Matriz, area: AreaDoEnem, numero: number): HabilidadeDaMatriz | undefined {
  return m.areas[area].competencias.flatMap((c) => c.habilidades).find((h) => h.numero === numero);
}

// ───────────────────────────── Edição corrente (edicao.yml) ─────────────────────────────

export type TipoDeFato = "data" | "hora" | "minutos" | "numero" | "dinheiro" | "texto" | "lista";
const TIPOS: TipoDeFato[] = ["data", "hora", "minutos", "numero", "dinheiro", "texto", "lista"];

export interface FonteOficial {
  titulo: string;
  orgao: string;
  url: string;
  publicado?: string;
}
export interface Fato {
  id: string;
  afirmacao: string;
  tipo: TipoDeFato;
  /** Ausente quando não se confirmou: o site mostra "confirmar no edital". */
  valor?: string | number | string[];
  situacao: "confirmado" | "confirmar-no-edital";
  fonte: string;
  item?: string;
  trecho: string;
  nota?: string;
  conferido: string;
}
export interface Edicao {
  edicao: number;
  conferido: string;
  fontes: Record<string, FonteOficial>;
  fatos: Record<string, Fato>;
}

/** Os fatos que as páginas do curso usam e que, por isso, não podem faltar no arquivo. */
export const FATOS_OBRIGATORIOS = [
  "aplicacao-dia-1",
  "aplicacao-dia-2",
  "portoes-abertura",
  "portoes-fechamento",
  "prova-inicio",
  "prova-fim-dia-1",
  "prova-fim-dia-2",
  "duracao-dia-1",
  "duracao-dia-2",
  "questoes-por-area",
  "provas-dia-1",
  "provas-dia-2",
  "documentos-aceitos",
  "documentos-recusados",
  "caneta",
  "envelope-porta-objetos",
  "saida-minima",
  "levar-caderno",
  "redacao-linhas",
  "redacao-minimo",
  "redacao-zero",
  "intervencao-elementos",
  "gabarito-prazo",
  "resultado-data",
] as const;

/** Só o que é dado oficial: Inep, MEC, Diário Oficial, Planalto e o domínio gov.br. */
export const DOMINIO_OFICIAL = /^https:\/\/([a-z0-9-]+\.)*(gov\.br|in\.gov\.br|inep\.gov\.br|mec\.gov\.br|planalto\.gov\.br)\//;

export function validarEdicao(bruto: unknown, arquivo = "content/enem/edicao.yml"): Edicao {
  if (!objeto(bruto)) falhar(arquivo, "o arquivo precisa de edicao, conferido, fontes e fatos");
  const edicao = bruto.edicao;
  if (!Number.isInteger(edicao) || (edicao as number) < 2009 || (edicao as number) > 2100) falhar(arquivo, '"edicao" é o ano da edição (ex.: 2026)');
  if (!objeto(bruto.fontes) || !objeto(bruto.fatos)) falhar(arquivo, '"fontes" e "fatos" são obrigatórios');
  const fontes: Record<string, FonteOficial> = {};
  for (const [id, f] of Object.entries(bruto.fontes)) {
    const onde = `fontes.${id}`;
    if (!ID.test(id) || !objeto(f)) falhar(arquivo, `${onde}: cada fonte tem id, titulo, orgao e url`);
    const url = https(f, "url", onde, arquivo);
    if (!DOMINIO_OFICIAL.test(url)) falhar(arquivo, `${onde}: "${url}" não é um endereço oficial (gov.br, in.gov.br, inep.gov.br, mec.gov.br)`);
    fontes[id] = { titulo: texto(f, "titulo", onde, arquivo, 300), orgao: texto(f, "orgao", onde, arquivo, 60), url, publicado: f.publicado === undefined ? undefined : data(f, "publicado", onde, arquivo) };
  }
  const fatos: Record<string, Fato> = {};
  for (const [id, b] of Object.entries(bruto.fatos)) {
    const onde = `fatos.${id}`;
    if (!ID.test(id) || !objeto(b)) falhar(arquivo, `${onde}: cada fato tem afirmacao, tipo, fonte, trecho e conferido`);
    const tipo = b.tipo as TipoDeFato;
    if (!TIPOS.includes(tipo)) falhar(arquivo, `${onde}: "tipo" deve ser ${TIPOS.join(", ")}`);
    const fonte = texto(b, "fonte", onde, arquivo, 60);
    if (!fontes[fonte]) falhar(arquivo, `${onde}: a fonte "${fonte}" não está em "fontes"`);
    const sit = b.situacao ?? "confirmado";
    if (sit !== "confirmado" && sit !== "confirmar-no-edital") falhar(arquivo, `${onde}: "situacao" deve ser confirmado ou confirmar-no-edital`);
    let valor: Fato["valor"];
    if (sit === "confirmar-no-edital") {
      if (b.valor !== undefined) falhar(arquivo, `${onde}: fato a confirmar não leva "valor"`);
      texto(b, "nota", onde, arquivo, 300);
    } else {
      const v = b.valor;
      const ok =
        (tipo === "data" && typeof v === "string" && DATA.test(v)) ||
        (tipo === "hora" && typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) ||
        ((tipo === "minutos" || tipo === "numero" || tipo === "dinheiro") && typeof v === "number" && Number.isFinite(v) && v >= 0) ||
        (tipo === "texto" && typeof v === "string" && v.trim() !== "") ||
        (tipo === "lista" && Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.trim()));
      if (!ok) falhar(arquivo, `${onde}: "valor" não combina com o tipo ${tipo}`);
      valor = v as Fato["valor"];
    }
    fatos[id] = {
      id,
      afirmacao: texto(b, "afirmacao", onde, arquivo, 200),
      tipo,
      valor,
      situacao: sit,
      fonte,
      item: b.item === undefined ? undefined : String(b.item),
      trecho: texto(b, "trecho", onde, arquivo, 600),
      nota: opcional(b, "nota", onde, arquivo, 300),
      conferido: data(b, "conferido", onde, arquivo),
    };
  }
  for (const id of FATOS_OBRIGATORIOS) if (!fatos[id]) falhar(arquivo, `o fato "${id}" é usado pelas páginas e não pode faltar`);
  for (const dia of ["aplicacao-dia-1", "aplicacao-dia-2"]) {
    const v = fatos[dia].valor;
    if (typeof v !== "string" || Number(v.slice(0, 4)) !== edicao) falhar(arquivo, `${dia}: a data deve ser do ano da edição (${edicao})`);
  }
  return { edicao: edicao as number, conferido: data(bruto, "conferido", "conferido", arquivo), fontes, fatos };
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const CONFIRMAR = "confirmar no edital";

/** O valor de um fato escrito em português, do jeito que aparece no texto ("8 de novembro de 2026", "13h30", "5h30"). */
export function formatarFato(f: Fato): string {
  if (f.valor === undefined) return CONFIRMAR;
  const v = f.valor;
  switch (f.tipo) {
    case "data": {
      const [a, m, d] = String(v).split("-").map(Number);
      return `${d} de ${MESES[m - 1]} de ${a}`;
    }
    case "hora": {
      const [h, m] = String(v).split(":");
      return `${Number(h)}h${m === "00" ? "" : m}`;
    }
    case "minutos": {
      const n = Number(v);
      if (n < 60) return `${n} minutos`;
      const h = Math.floor(n / 60);
      const m = n % 60;
      return m ? `${h}h${String(m).padStart(2, "0")}` : `${h} ${h === 1 ? "hora" : "horas"}`;
    }
    case "dinheiro":
      return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
    case "numero":
      return String(v);
    case "lista":
      return (v as string[]).join("; ");
    default:
      return String(v);
  }
}

/**
 * Troca {{enem:<id>}} pelo valor do fato, no texto de uma aula. Id que não existe para a montagem: assim nunca se
 * publica uma aula com um buraco no lugar da data.
 */
export function substituirFatos(corpo: string, edicao: Edicao, arquivo: string): string {
  return corpo.replace(/\{\{enem:([a-z0-9-]+)\}\}/g, (_, id: string) => {
    const f = edicao.fatos[id];
    if (!f) throw new Error(`Conteúdo inválido em ${arquivo}: {{enem:${id}}} não existe em content/enem/edicao.yml`);
    return formatarFato(f);
  });
}

/** Ids de fatos citados num texto. */
export const fatosCitados = (corpo: string): string[] => [...new Set([...corpo.matchAll(/\{\{enem:([a-z0-9-]+)\}\}/g)].map((m) => m[1]))];

/** Quantos dias faltam (pelo calendário, sem horas) entre "hoje" e uma data AAAA-MM-DD. Negativo se já passou. */
export function diasAte(dataAlvo: string, hoje: Date): number {
  const [a, m, d] = dataAlvo.split("-").map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const agora = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - agora) / 86_400_000);
}

// ───────────────────────────── Provas oficiais: a área pela numeração ─────────────────────────────

/**
 * A área de uma questão pela posição no caderno. Até 2016, o 1º dia tinha Humanas (1–45) e Natureza (46–90) e o 2º,
 * Linguagens (91–135, com a língua estrangeira em 91–95) e Matemática (136–180). Desde 2017, o 1º dia tem Linguagens
 * (1–45, língua estrangeira em 1–5) e Humanas (46–90), e o 2º, Natureza (91–135) e Matemática (136–180).
 * Fonte da mudança de 2017: MEC, "Enem passa a ser realizado em dois domingos seguidos" (método em docs/ENEM.md).
 */
export function areaPelaNumeracao(ano: number, n: number): { area: AreaDoEnem; dia: 1 | 2; lingua: boolean } | null {
  if (!Number.isInteger(n) || n < 1 || n > 180) return null;
  const antes = ano <= 2016;
  const bloco = Math.ceil(n / 45);
  const ordem: AreaDoEnem[] = antes ? ["humanas", "natureza", "linguagens", "matematica"] : ["linguagens", "humanas", "natureza", "matematica"];
  const area = ordem[bloco - 1];
  const inicioLinguagens = antes ? 91 : 1;
  return { area, dia: bloco <= 2 ? 1 : 2, lingua: area === "linguagens" && n >= inicioLinguagens && n < inicioLinguagens + 5 };
}

/** A parte de uma questão importada que o curso usa (public/questoes/enem-<ano>.json, gravado pelo importador). */
export interface QuestaoImportada {
  id: string;
  n: number;
  area: string;
  lingua: string;
  contexto: string;
  imagens: string[];
  enunciado: string;
  alternativas: string[];
  resposta: number;
}

// ───────────────────────────── A camada do instituto (questoes-oficiais/<ano>.yml) ─────────────────────────────

export const LETRAS = ["A", "B", "C", "D", "E"] as const;
export type Letra = (typeof LETRAS)[number];

export interface Classificacao {
  /** O id do importador (enem-2023-136, enem-2023-1-espanhol). */
  id: string;
  ano: number;
  area: AreaDoEnem;
  competencia: number;
  habilidade: number;
  /** Objeto de conhecimento de matriz.yml. */
  objeto: string;
  /** Tópico do objeto (opcional, mais fino). */
  topico?: string;
  dificuldade: 1 | 2 | 3;
  situacao: Situacao;
  /** A letra certa, repetida aqui para o validador conferir com o gabarito importado. */
  gabarito: Letra;
  resolucao: string;
  /** O engano por trás de cada alternativa errada. */
  enganos: Partial<Record<Letra, string>>;
  /** Aulas do site ("trilha/aula") para estudar. */
  aulas: string[];
  /** A questão depende de imagem que fica na fonte (a resolução descreve o que é preciso dela). */
  imagem: boolean;
}

/**
 * Confere o arquivo de um ano. `importadas` são as questões daquele ano em public/questoes (para conferir id, área
 * auditada e gabarito); `existe(id)` diz se um id da matriz existe. A existência das aulas é conferida por testar:enem.
 */
export function validarClassificacoes(bruto: unknown, arquivo: string, importadas: Map<string, QuestaoImportada>, existe: (id: string) => ObjetoDaMatriz | null): Classificacao[] {
  if (!objeto(bruto)) falhar(arquivo, "o arquivo precisa de ano e questoes");
  const ano = bruto.ano;
  if (!Number.isInteger(ano)) falhar(arquivo, '"ano" é o ano da prova');
  // Um arquivo por ano (2023.yml) ou por ano e área (2023-matematica.yml), para equipes diferentes trabalharem ao mesmo tempo.
  const nome = /(\d{4})(?:-(linguagens|humanas|natureza|matematica))?\.yml$/.exec(arquivo);
  if (!nome || Number(nome[1]) !== ano) falhar(arquivo, `o arquivo deve se chamar ${ano}.yml ou ${ano}-<area>.yml`);
  const soDaArea = nome[2] as AreaDoEnem | undefined;
  const vistos = new Set<string>();
  return lista(bruto, "questoes", "questoes", arquivo).map((q, i): Classificacao => {
    if (!objeto(q)) falhar(arquivo, `questoes[${i}]: cada item é um bloco com campos`);
    const id = texto(q, "id", `questoes[${i}]`, arquivo, 60);
    const onde = id;
    if (vistos.has(id)) falhar(arquivo, `${onde}: aparece duas vezes`);
    vistos.add(id);
    const imp = importadas.get(id);
    if (!imp) falhar(arquivo, `${onde}: não existe em public/questoes/enem-${ano}.json`);
    const auditada = areaPelaNumeracao(ano as number, imp.n);
    const area = q.area as AreaDoEnem;
    if (!AREAS_DO_ENEM.includes(area)) falhar(arquivo, `${onde}: "area" deve ser linguagens, humanas, natureza ou matematica`);
    if (auditada && auditada.area !== area) falhar(arquivo, `${onde}: pela numeração (questão ${imp.n} de ${ano}), a área é ${auditada.area}, não ${area}`);
    if (soDaArea && area !== soDaArea) falhar(arquivo, `${onde}: este arquivo é só de ${soDaArea}`);
    const habilidade = Number(q.habilidade);
    if (!Number.isInteger(habilidade) || habilidade < 1 || habilidade > 30) falhar(arquivo, `${onde}: "habilidade" vai de 1 a 30`);
    const competencia = Number(q.competencia);
    if (competencia !== competenciaDaHabilidade(area, habilidade)) falhar(arquivo, `${onde}: H${habilidade} de ${area} é da competência ${competenciaDaHabilidade(area, habilidade)}, não ${q.competencia}`);
    const idObjeto = texto(q, "objeto", onde, arquivo, 80);
    const obj = existe(idObjeto);
    if (!obj || obj.id !== idObjeto) falhar(arquivo, `${onde}: o objeto "${idObjeto}" não está em content/enem/matriz.yml`);
    if (obj.area !== area) falhar(arquivo, `${onde}: o objeto "${idObjeto}" é de ${obj.area}, não de ${area}`);
    const topico = opcional(q, "topico", onde, arquivo, 80);
    if (topico && !obj.topicos.some((t) => t.id === topico)) falhar(arquivo, `${onde}: o tópico "${topico}" não pertence ao objeto ${idObjeto}`);
    const dificuldade = q.dificuldade;
    if (dificuldade !== 1 && dificuldade !== 2 && dificuldade !== 3) falhar(arquivo, `${onde}: "dificuldade" deve ser 1, 2 ou 3`);
    if (q.situacao !== "a-confirmar") falhar(arquivo, `${onde}: a classificação nasce "situacao: a-confirmar" (só a equipe confirma)`);
    const gabarito = String(q.gabarito ?? "") as Letra;
    if (!LETRAS.includes(gabarito)) falhar(arquivo, `${onde}: "gabarito" é a letra certa (A a E)`);
    if (LETRAS.indexOf(gabarito) !== imp.resposta) falhar(arquivo, `${onde}: o gabarito importado é ${LETRAS[imp.resposta]}, não ${gabarito}`);
    const resolucao = texto(q, "resolucao", onde, arquivo, 4000);
    if (resolucao.split(/\s+/).length < 25) falhar(arquivo, `${onde}: a resolução precisa explicar o caminho (ao menos umas 25 palavras)`);
    if (!objeto(q.enganos)) falhar(arquivo, `${onde}: "enganos" traz o engano de cada alternativa errada (A, B, C, D, E menos a certa)`);
    const enganos: Partial<Record<Letra, string>> = {};
    for (const letra of LETRAS.slice(0, imp.alternativas.length)) {
      if (letra === gabarito) {
        if (q.enganos[letra] !== undefined) falhar(arquivo, `${onde}: a alternativa certa (${letra}) não leva engano`);
        continue;
      }
      enganos[letra] = texto(q.enganos, letra, `${onde}.enganos`, arquivo, 600);
    }
    const aulas = (q.aulas === undefined ? [] : lista(q, "aulas", onde, arquivo)).map((a) => {
      if (typeof a !== "string" || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(a)) falhar(arquivo, `${onde}: cada aula é "trilha/aula"`);
      return a;
    });
    if (q.imagem !== undefined && typeof q.imagem !== "boolean") falhar(arquivo, `${onde}: "imagem" é true ou false`);
    return { id, ano: ano as number, area, competencia, habilidade, objeto: idObjeto, topico, dificuldade, situacao: "a-confirmar", gabarito, resolucao, enganos, aulas, imagem: q.imagem === true || imp.imagens.length > 0 };
  });
}

// ───────────────────────────── Incidência (incidencia.yml) ─────────────────────────────

export interface Incidencia {
  /** Gerado por scripts/incidencia-enem.mjs; nunca à mão. */
  gerado: string;
  metodo: string;
  base: { anos: number[]; classificadas: number; porArea: Record<AreaDoEnem, number> };
  /** Contagem por objeto e por habilidade, de cada área, da mais frequente para a menos. */
  objetos: Record<AreaDoEnem, { id: string; questoes: number; parte: number }[]>;
  habilidades: Record<AreaDoEnem, { habilidade: number; questoes: number; parte: number }[]>;
  /** Só as questões que têm tópico: a parte é sobre todas as classificadas da área. */
  topicos: Record<AreaDoEnem, { id: string; questoes: number; parte: number }[]>;
}

/** Conta, nas últimas `edicoes` edições classificadas, quantas questões caem em cada objeto e habilidade. */
export function calcularIncidencia(todas: Classificacao[], edicoes = 10): Omit<Incidencia, "gerado" | "metodo"> {
  const anos = [...new Set(todas.map((c) => c.ano))].sort((a, b) => b - a).slice(0, edicoes);
  const base = todas.filter((c) => anos.includes(c.ano));
  const porArea = Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, base.filter((c) => c.area === a).length])) as Record<AreaDoEnem, number>;
  const ordenar = <T extends { questoes: number }>(lista: T[], chave: (x: T) => string | number) => lista.sort((a, b) => b.questoes - a.questoes || String(chave(a)).localeCompare(String(chave(b)), "pt", { numeric: true }));
  const parte = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const objetos = {} as Incidencia["objetos"];
  const habilidades = {} as Incidencia["habilidades"];
  const topicos = {} as Incidencia["topicos"];
  for (const a of AREAS_DO_ENEM) {
    const daArea = base.filter((c) => c.area === a);
    const contaObj = new Map<string, number>();
    const contaHab = new Map<number, number>();
    for (const c of daArea) {
      contaObj.set(c.objeto, (contaObj.get(c.objeto) ?? 0) + 1);
      contaHab.set(c.habilidade, (contaHab.get(c.habilidade) ?? 0) + 1);
    }
    const contaTop = new Map<string, number>();
    for (const c of daArea) if (c.topico) contaTop.set(c.topico, (contaTop.get(c.topico) ?? 0) + 1);
    objetos[a] = ordenar([...contaObj].map(([id, n]) => ({ id, questoes: n, parte: parte(n, daArea.length) })), (x) => x.id);
    habilidades[a] = ordenar([...contaHab].map(([h, n]) => ({ habilidade: h, questoes: n, parte: parte(n, daArea.length) })), (x) => x.habilidade);
    topicos[a] = ordenar([...contaTop].map(([id, n]) => ({ id, questoes: n, parte: parte(n, daArea.length) })), (x) => x.id);
  }
  return { base: { anos: anos.sort((a, b) => a - b), classificadas: base.length, porArea }, objetos, habilidades, topicos };
}

// ───────────────────────────── Redação (redacao/) ─────────────────────────────

export interface TemaOficial {
  ano: number;
  aplicacao: string;
  tema: string;
  fonte: string;
}
export interface TextoMotivador {
  titulo: string;
  texto: string;
  /** "Texto original do Instituto Lúcia" ou a fonte livre (com licença). */
  fonte: string;
}
export interface Proposta {
  id: string;
  tema: string;
  eixo: string;
  /** O que o tema pede: recorte, palavras-chave e o perigo de fuga ou tangenciamento. */
  recorte: string;
  textos: TextoMotivador[];
  fonte: string;
  revisao: "em-revisao";
}
export interface ItemDeRepertorio {
  id: string;
  titulo: string;
  eixos: string[];
  tipo: string;
  resumo: string;
  como_usar: string;
  fonte: { titulo: string; autor: string; ano?: string; url?: string };
  coringa: boolean;
}

/** Os eixos temáticos do banco de propostas e de repertório (seção 6.3 da especificação do curso). */
export const EIXOS_DA_REDACAO = ["educacao", "saude", "meio-ambiente", "trabalho", "tecnologia", "cultura", "cidadania", "desigualdade", "violencia", "direitos-humanos", "minorias"] as const;
export const TIPOS_DE_REPERTORIO = ["lei", "dado", "obra", "pensador", "fato-historico", "conceito"] as const;

function revisaoEmRevisao(d: Dado, onde: string, arquivo: string): "em-revisao" {
  const r = d.revisao;
  if (!objeto(r) || r.status !== "em-revisao") falhar(arquivo, `${onde}: nasce com "revisao: { status: em-revisao }" (só a equipe revisa)`);
  return "em-revisao";
}

export function validarTemasOficiais(bruto: unknown, arquivo = "content/enem/redacao/temas-oficiais.yml"): TemaOficial[] {
  if (!Array.isArray(bruto)) falhar(arquivo, "o arquivo é uma lista de temas");
  return bruto.map((t, i) => {
    const onde = `temas[${i}]`;
    if (!objeto(t)) falhar(arquivo, `${onde}: precisa de ano, aplicacao, tema e fonte`);
    if (!Number.isInteger(t.ano) || (t.ano as number) < 1998) falhar(arquivo, `${onde}: "ano" inválido`);
    const fonte = https(t, "fonte", onde, arquivo);
    if (!DOMINIO_OFICIAL.test(fonte)) falhar(arquivo, `${onde}: a fonte do tema deve ser oficial (Inep ou MEC)`);
    return { ano: t.ano as number, aplicacao: texto(t, "aplicacao", onde, arquivo, 60), tema: texto(t, "tema", onde, arquivo, 300), fonte };
  });
}

export function validarPropostas(bruto: unknown, arquivo = "content/enem/redacao/propostas.yml"): Proposta[] {
  if (!Array.isArray(bruto)) falhar(arquivo, "o arquivo é uma lista de propostas");
  const ids = new Set<string>();
  return bruto.map((p, i) => {
    const onde = `propostas[${i}]`;
    if (!objeto(p)) falhar(arquivo, `${onde}: precisa de id, tema, eixo, recorte, textos e fonte`);
    const id = texto(p, "id", onde, arquivo, 60);
    if (!ID.test(id) || ids.has(id)) falhar(arquivo, `${onde}: id "${id}" inválido ou repetido`);
    ids.add(id);
    const eixo = texto(p, "eixo", id, arquivo, 40);
    if (!(EIXOS_DA_REDACAO as readonly string[]).includes(eixo)) falhar(arquivo, `${id}: "eixo" deve ser ${EIXOS_DA_REDACAO.join(", ")}`);
    const textos = lista(p, "textos", id, arquivo).map((t, j) => {
      if (!objeto(t)) falhar(arquivo, `${id}.textos[${j}]: precisa de titulo, texto e fonte`);
      return { titulo: texto(t, "titulo", `${id}.textos[${j}]`, arquivo, 120), texto: texto(t, "texto", `${id}.textos[${j}]`, arquivo, 1500), fonte: texto(t, "fonte", `${id}.textos[${j}]`, arquivo, 300) };
    });
    if (textos.length < 2 || textos.length > 4) falhar(arquivo, `${id}: de 2 a 4 textos motivadores`);
    return { id, tema: texto(p, "tema", id, arquivo, 200), eixo, recorte: texto(p, "recorte", id, arquivo, 1200), textos, fonte: texto(p, "fonte", id, arquivo, 300), revisao: revisaoEmRevisao(p, id, arquivo) };
  });
}

export function validarRepertorio(bruto: unknown, arquivo = "content/enem/redacao/repertorio.yml"): ItemDeRepertorio[] {
  if (!Array.isArray(bruto)) falhar(arquivo, "o arquivo é uma lista de itens de repertório");
  const ids = new Set<string>();
  return bruto.map((r, i) => {
    const onde = `repertorio[${i}]`;
    if (!objeto(r)) falhar(arquivo, `${onde}: precisa de id, titulo, eixos, tipo, resumo, como_usar e fonte`);
    const id = texto(r, "id", onde, arquivo, 60);
    if (!ID.test(id) || ids.has(id)) falhar(arquivo, `${onde}: id "${id}" inválido ou repetido`);
    ids.add(id);
    const eixos = lista(r, "eixos", id, arquivo).map(String);
    if (!eixos.length || !eixos.every((e) => (EIXOS_DA_REDACAO as readonly string[]).includes(e))) falhar(arquivo, `${id}: "eixos" usa os eixos ${EIXOS_DA_REDACAO.join(", ")}`);
    const tipo = texto(r, "tipo", id, arquivo, 30);
    if (!(TIPOS_DE_REPERTORIO as readonly string[]).includes(tipo)) falhar(arquivo, `${id}: "tipo" deve ser ${TIPOS_DE_REPERTORIO.join(", ")}`);
    const f = r.fonte;
    if (!objeto(f)) falhar(arquivo, `${id}: "fonte" tem titulo e autor (e ano e url, se houver)`);
    const url = f.url === undefined ? undefined : https(f, "url", `${id}.fonte`, arquivo);
    if (url && /\.pdf($|\?)/i.test(url)) falhar(arquivo, `${id}.fonte: nada de link direto para PDF; aponte a página da obra ou do órgão`);
    if (r.coringa !== undefined && typeof r.coringa !== "boolean") falhar(arquivo, `${id}: "coringa" é true ou false`);
    return {
      id,
      titulo: texto(r, "titulo", id, arquivo, 160),
      eixos,
      tipo,
      resumo: texto(r, "resumo", id, arquivo, 800),
      como_usar: texto(r, "como_usar", id, arquivo, 800),
      fonte: { titulo: texto(f, "titulo", `${id}.fonte`, arquivo, 300), autor: texto(f, "autor", `${id}.fonte`, arquivo, 200), ano: f.ano === undefined ? undefined : String(f.ano), url },
      coringa: r.coringa === true,
    };
  });
}

// ───────────────────────────── Simulados e diagnóstico (simulados/) ─────────────────────────────

export interface Minissimulado {
  id: string;
  area: AreaDoEnem;
  minutos: number;
  questoes: string[];
}
export interface Simulados {
  /** 15 questões oficiais classificadas por área, cada uma ligada a uma habilidade. */
  diagnostico: Record<AreaDoEnem, string[]>;
  minissimulados: Minissimulado[];
}

/**
 * Confere o diagnóstico e os minissimulados. `classificada(id)` devolve a área da questão oficial classificada (ou null
 * se o id não está em questoes-oficiais): todo id usado precisa estar classificado, na área certa.
 */
export function validarSimulados(diag: unknown, minis: unknown, classificada: (id: string) => AreaDoEnem | null): Simulados {
  const a1 = "content/enem/simulados/diagnostico.yml";
  if (!objeto(diag) || !objeto(diag.areas)) falhar(a1, '"areas" traz a lista de questões de cada área');
  const diagnostico = {} as Record<AreaDoEnem, string[]>;
  const todos = new Set<string>();
  for (const area of AREAS_DO_ENEM) {
    const ids = (diag.areas as Dado)[area];
    if (!Array.isArray(ids) || ids.length !== 15) falhar(a1, `${area}: o diagnóstico tem 15 questões por área`);
    for (const id of ids) {
      if (typeof id !== "string" || classificada(id) !== area) falhar(a1, `${area}: "${id}" não é questão oficial classificada de ${area}`);
      if (todos.has(id)) falhar(a1, `"${id}" aparece duas vezes`);
      todos.add(id);
    }
    diagnostico[area] = ids as string[];
  }
  const a2 = "content/enem/simulados/minissimulados.yml";
  if (!objeto(minis) || !Array.isArray(minis.minissimulados)) falhar(a2, '"minissimulados" é a lista');
  const vistos = new Set<string>();
  const minissimulados = (minis.minissimulados as unknown[]).map((m, i): Minissimulado => {
    if (!objeto(m)) falhar(a2, `item ${i + 1}: precisa de id, area, minutos e questoes`);
    const id = texto(m, "id", `item ${i + 1}`, a2, 60);
    if (!ID.test(id) || vistos.has(id)) falhar(a2, `"${id}": id inválido ou repetido`);
    vistos.add(id);
    const area = m.area as AreaDoEnem;
    if (!AREAS_DO_ENEM.includes(area)) falhar(a2, `${id}: área inválida`);
    if (!Number.isInteger(m.minutos) || (m.minutos as number) < 5 || (m.minutos as number) > 180) falhar(a2, `${id}: "minutos" de 5 a 180`);
    const qs = lista(m, "questoes", id, a2);
    if (qs.length < 5 || new Set(qs).size !== qs.length) falhar(a2, `${id}: ao menos 5 questões, sem repetir`);
    for (const q of qs) if (typeof q !== "string" || classificada(q) !== area) falhar(a2, `${id}: "${q}" não é questão oficial classificada de ${area}`);
    return { id, area, minutos: m.minutos as number, questoes: qs as string[] };
  });
  return { diagnostico, minissimulados };
}
