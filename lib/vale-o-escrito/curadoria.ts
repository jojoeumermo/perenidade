// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito, pacote "curadoria": a lógica pura da função do painel (components/painel/ValeOEscrito.tsx), do
// pedido de arquivo no Internet Archive (app/api/vale-o-escrito/arquivar/route.ts) e do exportador
// (scripts/vale-o-escrito/exportar.mjs). Sem "@/", sem leitura de disco, sem rede: roda no Node nos testes.
//
// Regras que este arquivo garante antes de qualquer coisa ir ao banco (ESPEC, seções 1 e 5):
//  - entrada sem fonte, trecho, data, situação jurídica ou "segundo [fonte]" não passa (regras.ts);
//  - pessoa só entra com a marca "pública no caso" e fonte; nunca vítima, criança, adolescente ou testemunha
//    (ECA, arts. 17, 143 e 247; LGPD, art. 14);
//  - mudança de situação (absolvição, arquivamento) exige fonte nova e fica no histórico VISÍVEL da ficha, sem nome de
//    ninguém da curadoria (a curadoria é anônima ao público; quem decidiu fica só em interno.vale_historico);
//  - o que vai para o público passa por uma lista de campos permitidos (docPublico): nada interno vaza.
//
// Direito de resposta (Lei 13.188/2015, conferida em planalto.gov.br em 04/11/2026): art. 2º, resposta gratuita e
// proporcional ao agravo; art. 3º, prazo decadencial de 60 dias para pedir; art. 5º, 7 dias do recebimento do pedido
// para divulgar, passado o qual cabe ação; art. 7º, o juiz decide em 24 horas da citação. A lei vale para veículo de
// comunicação social; o Instituto cumpre por boa-fé (ESPEC, seção 5.1), com a meta de 7 dias.

import { SLUGS_DOS_DOSSIES } from "./catalogo";
import { type Conferencia, validarEntrada, validarFonte, validarLigacao } from "./regras";
import type { ArquivoDeEntradas, Entrada, Fonte, Ligacao, Organizacao, PessoaPublica, RespostaPublicada, Situacao } from "./tipos";

// ───────────────────────────── Lei 13.188/2015 ─────────────────────────────

export const LEI_13188 = {
  /** Art. 3º: prazo decadencial, em dias, para o ofendido pedir a resposta, contado da divulgação. */
  decadenciaDias: 60,
  /** Art. 5º: dias, do recebimento do pedido, para divulgar a resposta; passado o prazo, cabe ação judicial. */
  respostaDias: 7,
  /** Art. 7º: o juiz decide nas 24 horas seguintes à citação. */
  decisaoDoJuizHoras: 24,
  citacao: "Lei 13.188/2015, arts. 2º, 3º, 5º e 7º",
} as const;

export type EstadoDoPrazo = "no_prazo" | "vence_hoje" | "vencido";

/** Quantos dias faltam para a meta de resposta (negativo = atrasado) e em que pé está. Datas AAAA-MM-DD. */
export function prazoDaCorrecao(responderAte: string, hoje: string): { dias: number; estado: EstadoDoPrazo } {
  const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const dias = Math.round((ms(responderAte.slice(0, 10)) - ms(hoje.slice(0, 10))) / 86_400_000);
  return { dias, estado: dias < 0 ? "vencido" : dias === 0 ? "vence_hoje" : "no_prazo" };
}

// ───────────────────────────── Documento da entrada ─────────────────────────────

/**
 * O que a curadoria edita e o banco guarda em interno.vale_entradas.doc: a Entrada mais o que o exportador separa nos
 * arquivos do dossiê (pessoas públicas, organizações e ligações da teia). Nada interno entra aqui: a coluna é lida por
 * qualquer pessoa (RLS de leitura anônima).
 */
export interface DocumentoDeEntrada extends Entrada {
  pessoasPublicas?: PessoaPublica[];
  organizacoesPublicas?: Organizacao[];
  ligacoes?: Ligacao[];
}

const CAMPOS_DA_ENTRADA = [
  "id", "dossie", "titulo", "resumo", "dataDoFato", "lugar", "situacao", "confianca", "fontes", "pessoas", "organizacoes",
  "etiquetas", "publicadoEm", "atualizadoEm", "historico", "respostas",
] as const;

/** Só os campos da Entrada: tira tudo o que não é dela (e, com isso, qualquer campo interno que tenha entrado por engano). */
export function docPublico(doc: DocumentoDeEntrada): Entrada {
  const saida: Record<string, unknown> = {};
  for (const campo of CAMPOS_DA_ENTRADA) if (doc[campo] !== undefined) saida[campo] = doc[campo];
  return saida as unknown as Entrada;
}

export const hojeISO = (agora: Date = new Date()): string => {
  // Dia de Brasília, como o banco (America/Sao_Paulo).
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return p;
};

/** "Altamira: conflito na Fazenda X" vira "altamira-conflito-na-fazenda-x" (só a-z, 0-9 e hífen, até 80). */
export function slugDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** Id legível da entrada: ano + título ("2026-altamira-conflito-fazenda-x"). */
export const idDaEntrada = (ano: string, titulo: string): string => slugDe(`${ano}-${titulo}`);

/** Entrada em branco, para a entrada manual da equipe. */
export function docEmBranco(hoje: string, dossie: string = SLUGS_DOS_DOSSIES[0]): DocumentoDeEntrada {
  return {
    id: "",
    dossie,
    titulo: "",
    resumo: "",
    dataDoFato: hoje.slice(0, 7),
    lugar: { pais: "BR" },
    situacao: "investigado",
    confianca: "reportado",
    fontes: [],
    pessoas: [],
    organizacoes: [],
    etiquetas: [],
    publicadoEm: hoje,
    atualizadoEm: hoje,
    pessoasPublicas: [],
    organizacoesPublicas: [],
    ligacoes: [],
  };
}

export const fonteEmBranco = (id: string, hoje: string): Fonte => ({ id, veiculo: "", tipo: "reportagem", titulo: "", url: "", trecho: "", data: hoje, acessadoEm: hoje });

/** Tira os campos opcionais que ficaram vazios no formulário (texto vazio não é "sem valor" para as regras). */
export function limparDoc(doc: DocumentoDeEntrada): DocumentoDeEntrada {
  const vazio = (v: unknown) => typeof v === "string" && v.trim() === "";
  const sem = <T extends object>(o: T): T => {
    const copia = { ...o } as Record<string, unknown>;
    for (const k of Object.keys(copia)) if (vazio(copia[k]) || copia[k] === undefined) delete copia[k];
    else if (typeof copia[k] === "string") copia[k] = (copia[k] as string).trim();
    return copia as unknown as T;
  };
  // Lista de campos permitidos: o rascunho do robô ou do público é JSON livre, e o que for gravado em vale_entradas.doc é lido por
  // qualquer pessoa. Campo desconhecido (nota, revisor, contato, texto da IA...) não passa.
  const permitidos = new Set<string>([...CAMPOS_DA_ENTRADA, "pessoasPublicas", "organizacoesPublicas", "ligacoes"]);
  const so = Object.fromEntries(Object.entries(doc).filter(([k]) => permitidos.has(k))) as unknown as DocumentoDeEntrada;
  return {
    ...so,
    id: doc.id.trim(),
    titulo: doc.titulo.trim(),
    resumo: doc.resumo.trim(),
    lugar: sem(doc.lugar),
    fontes: doc.fontes.map((f) => sem(f)),
    pessoas: doc.pessoas.map((p) => sem(p)),
    organizacoes: doc.organizacoes,
    etiquetas: doc.etiquetas.map((t) => t.trim()).filter(Boolean),
    pessoasPublicas: (doc.pessoasPublicas ?? []).map((p) => sem(p)),
    organizacoesPublicas: (doc.organizacoesPublicas ?? []).map((o) => sem(o)),
    ligacoes: (doc.ligacoes ?? []).map((l) => sem(l)),
  };
}

/** Conferência completa do documento (entrada, pessoas, organizações e ligações), com as regras de regras.ts. */
export function conferirDoc(doc: DocumentoDeEntrada, opcoes: { publicada?: boolean } = {}): Conferencia {
  const erros: string[] = [];
  const pessoas = doc.pessoasPublicas ?? [];
  const orgs = doc.organizacoesPublicas ?? [];
  erros.push(...validarEntrada(docPublico(doc), { publicada: opcoes.publicada, pessoas, organizacoesIds: orgs.map((o) => o.id) }).erros);
  const idsDeFonte = (doc.fontes ?? []).map((f) => f.id);
  pessoas.forEach((p, i) => {
    if (p.publicaNoCaso !== true) erros.push(`pessoasPublicas[${i}]: falta a marca "pública no caso"`);
    for (const f of p.fonteIds ?? []) if (!idsDeFonte.includes(f)) erros.push(`pessoasPublicas[${i}].fonteIds: fonte ${f} não está na entrada`);
  });
  (doc.ligacoes ?? []).forEach((l, i) => {
    for (const msg of validarLigacao(l, idsDeFonte).erros) erros.push(`ligacoes[${i}].${msg}`);
    if (l.entradaId !== doc.id) erros.push(`ligacoes[${i}].entradaId: tem de ser a desta entrada`);
    for (const no of [l.de, l.para]) {
      if (no?.tipo === "pessoa" && !pessoas.some((p) => p.id === no.id)) erros.push(`ligacoes[${i}]: pessoa ${no.id} não está nas pessoas públicas`);
      if (no?.tipo === "organizacao" && !orgs.some((o) => o.id === no.id)) erros.push(`ligacoes[${i}]: organização ${no.id} não está na entrada`);
      if (no?.tipo === "entrada" && no.id !== doc.id) erros.push(`ligacoes[${i}]: nó de entrada tem de ser esta entrada`);
    }
  });
  return { ok: erros.length === 0, erros };
}

// ───────────────────────────── Atualizar situação (absolvição, arquivamento) ─────────────────────────────

/**
 * Muda a situação jurídica de uma entrada JÁ publicada. Exige uma fonte nova (a decisão, a nota do tribunal, a
 * reportagem), acrescenta uma linha ao histórico visível e muda "atualizadoEm". Devolve o documento novo ou os erros.
 * O histórico nunca guarda quem da curadoria decidiu.
 */
export function atualizarSituacao(
  doc: DocumentoDeEntrada,
  nova: Situacao,
  fonte: Fonte,
  nota: string,
  hoje: string,
): { ok: true; doc: DocumentoDeEntrada } | { ok: false; erros: string[] } {
  if (nova === doc.situacao) return { ok: false, erros: ["situacao: é a mesma de agora"] };
  const erros = validarFonte(fonte, { publicada: true }).erros.map((m) => `fonte.${m}`);
  if ((doc.fontes ?? []).some((f) => f.id === fonte.id)) erros.push("fonte.id: já existe na entrada");
  if (!/\b(segundo|supostamente)\b/i.test(nota.normalize("NFD").replace(/\p{M}/gu, ""))) erros.push('nota: precisa de "segundo [fonte]"');
  if (erros.length) return { ok: false, erros };
  const novo: DocumentoDeEntrada = {
    ...doc,
    situacao: nova,
    atualizadoEm: hoje,
    fontes: [...doc.fontes, fonte],
    historico: [...(doc.historico ?? []), { em: hoje, de: doc.situacao, para: nova, fonteId: fonte.id, nota: nota.trim() }],
  };
  const c = conferirDoc(novo, { publicada: true });
  return c.ok ? { ok: true, doc: novo } : { ok: false, erros: c.erros };
}

/** Acrescenta uma resposta ou retificação aceita, para aparecer ao lado da ficha. */
export function acrescentarResposta(doc: DocumentoDeEntrada, tipo: RespostaPublicada["tipo"], texto: string, hoje: string): DocumentoDeEntrada {
  return { ...doc, atualizadoEm: hoje, respostas: [...(doc.respostas ?? []), { em: hoje, tipo, texto: texto.trim() }] };
}

// ───────────────────────────── Mesclar duplicata ─────────────────────────────

/**
 * Junta duas entradas do mesmo fato: o texto, a situação e a confiança ficam os de `base`; `outro` entra só com as
 * fontes que a base ainda não tem (mesmo link = mesma fonte), as pessoas, organizações, etiquetas e ligações. Os ids de
 * fonte do que entra são renumerados ("f3"...) e as ligações e pessoas seguem a troca.
 */
export function mesclarDuplicata(base: DocumentoDeEntrada, outro: DocumentoDeEntrada): DocumentoDeEntrada {
  const fontes = [...(base.fontes ?? [])];
  const troca = new Map<string, string>();
  let n = fontes.length;
  for (const f of outro.fontes ?? []) {
    const igual = fontes.find((x) => x.url === f.url);
    if (igual) {
      troca.set(f.id, igual.id);
      continue;
    }
    let id = f.id;
    while (fontes.some((x) => x.id === id)) id = `f${++n}`;
    troca.set(f.id, id);
    fontes.push({ ...f, id });
  }
  const mapa = (ids: string[]) => [...new Set((ids ?? []).map((i) => troca.get(i) ?? i))];
  const porId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))];
  const pessoasPublicas = porId(base.pessoasPublicas, (outro.pessoasPublicas ?? []).map((p) => ({ ...p, fonteIds: mapa(p.fonteIds) })));
  const ligacoes = porId(
    base.ligacoes,
    (outro.ligacoes ?? []).map((l) => ({
      ...l,
      entradaId: base.id,
      fonteIds: mapa(l.fonteIds),
      de: l.de.tipo === "entrada" ? { tipo: "entrada" as const, id: base.id } : l.de,
      para: l.para.tipo === "entrada" ? { tipo: "entrada" as const, id: base.id } : l.para,
    })),
  );
  return {
    ...base,
    fontes,
    pessoas: [...(base.pessoas ?? []), ...(outro.pessoas ?? []).filter((p) => !(base.pessoas ?? []).some((q) => q.pessoaId === p.pessoaId))],
    organizacoes: [...new Set([...(base.organizacoes ?? []), ...(outro.organizacoes ?? [])])],
    etiquetas: [...new Set([...(base.etiquetas ?? []), ...(outro.etiquetas ?? [])])],
    pessoasPublicas,
    organizacoesPublicas: porId(base.organizacoesPublicas, outro.organizacoesPublicas),
    ligacoes,
  };
}

// ───────────────────────────── Internet Archive (Save Page Now) ─────────────────────────────

const ARQUIVO = "https://web.archive.org";

/**
 * O endereço que a rota do servidor chama (https://web.archive.org/save/<url>), ou null quando o link não serve:
 * só http(s), sem usuário e senha, sem endereço local ou de rede interna (a rota não pode ser usada para sondar a rede
 * do servidor) e sem o próprio Internet Archive.
 */
export function enderecoParaArquivar(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || url.length > 2000) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith("web.archive.org") || h === "archive.org") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
  }
  if (h.startsWith("[") || h.includes(":")) return null; // IPv6 literal: não arquivamos
  return `${ARQUIVO}/save/${u.href}`;
}

/**
 * Acha o link da cópia na resposta do Save Page Now: o cabeçalho Content-Location ("/web/2026.../https://...") ou o
 * Location final. Só aceita endereço do próprio web.archive.org/web/ com carimbo de 14 dígitos.
 */
export function arquivoDaResposta(cabecalhos: { get(nome: string): string | null }, urlFinal?: string): string | null {
  const candidatos = [cabecalhos.get("content-location"), cabecalhos.get("location"), urlFinal].filter((x): x is string => Boolean(x));
  for (const c of candidatos) {
    const completo = c.startsWith("/") ? ARQUIVO + c : c;
    if (/^https:\/\/web\.archive\.org\/web\/\d{14}[a-z_]*\/https?:\/\//.test(completo)) return completo;
  }
  return null;
}

// ───────────────────────────── Exportação para o site (cache em arquivo) ─────────────────────────────

/** Uma linha de interno.vale_entradas, só o que a exportação usa. */
export interface LinhaDeEntrada {
  id: string;
  dossie: string;
  doc: DocumentoDeEntrada;
  retirado_em?: string | null;
}

/**
 * Monta os arquivos de content/vale-o-escrito/entradas/<slug>.json a partir das entradas aprovadas. Retiradas ficam de
 * fora. Pessoas e organizações só entram se alguma entrada publicada as usa; ligações só com as duas pontas e a fonte.
 * Ordem estável (por id), para o diff do repositório mostrar só o que mudou. Devolve também o que foi barrado e por quê.
 */
export function montarArquivos(linhas: LinhaDeEntrada[]): { arquivos: Record<string, ArquivoDeEntradas>; barradas: string[] } {
  const barradas: string[] = [];
  const arquivos: Record<string, ArquivoDeEntradas> = {};
  for (const slug of SLUGS_DOS_DOSSIES) arquivos[slug] = { dossie: slug, pessoas: [], organizacoes: [], ligacoes: [], entradas: [] };
  const ordenadas = [...linhas].filter((l) => !l.retirado_em).sort((a, b) => a.id.localeCompare(b.id));
  for (const linha of ordenadas) {
    const doc = linha.doc;
    const arquivo = arquivos[doc?.dossie];
    if (!arquivo) {
      barradas.push(`${linha.id}: dossiê "${doc?.dossie}" não existe`);
      continue;
    }
    if (doc.id !== linha.id || linha.dossie !== doc.dossie) {
      barradas.push(`${linha.id}: id ou dossiê da linha não bate com o documento`);
      continue;
    }
    const c = conferirDoc(doc, { publicada: true });
    if (!c.ok) {
      barradas.push(`${linha.id}: ${c.erros.join("; ")}`);
      continue;
    }
    arquivo.entradas.push(docPublico(doc));
    for (const p of doc.pessoasPublicas ?? []) if (!arquivo.pessoas.some((x) => x.id === p.id)) arquivo.pessoas.push(p);
    for (const o of doc.organizacoesPublicas ?? []) if (!arquivo.organizacoes.some((x) => x.id === o.id)) arquivo.organizacoes.push(o);
    for (const l of doc.ligacoes ?? []) if (!arquivo.ligacoes.some((x) => x.id === l.id)) arquivo.ligacoes.push(l);
  }
  return { arquivos, barradas };
}

// ───────────────────────────── Tipos do que o banco devolve à tela ─────────────────────────────

/** Linha de vale_fila_listar. */
export interface ItemDaFila {
  id: string;
  origem: "robo" | "equipe" | "publico";
  rascunho: Partial<DocumentoDeEntrada>;
  estado: string;
  nota: string | null;
  criado_em: string;
  decidido_em: string | null;
  sugestao_url?: string | null;
  sugestao_titulo?: string | null;
  resumo_ia?: string | null;
  provedor_ia?: string | null;
  envio_url?: string | null;
  envio_descricao?: string | null;
  envio_trecho?: string | null;
}

/** Linha de vale_correcoes_listar. */
export interface ItemDeCorrecao {
  id: string;
  entrada: string;
  tipo: "correcao" | "direito_de_resposta" | "remocao_de_dado";
  texto: string;
  comprovante_url: string | null;
  nome: string | null;
  contato: string | null;
  estado: "nova" | "em_analise" | "aceita" | "recusada";
  resposta_publica: string | null;
  nota: string | null;
  responder_ate: string;
  criado_em: string;
  decidido_em: string | null;
}

/**
 * O rascunho com que a tela abre um item da fila: o que o robô ou a equipe já preencheu e, para o que faltar, o que a
 * sugestão ou o envio trouxe (link, título, trecho). O resumo da IA entra só como ponto de partida: a curadoria reescreve
 * com "segundo [fonte]" antes de aprovar, e a conferência barra o que não tiver.
 */
export function rascunhoDoItem(item: ItemDaFila, hoje: string): DocumentoDeEntrada {
  const base = { ...docEmBranco(hoje), ...(item.rascunho ?? {}) } as DocumentoDeEntrada;
  if (!base.titulo && item.sugestao_titulo) base.titulo = item.sugestao_titulo;
  if (!base.resumo && item.resumo_ia) base.resumo = item.resumo_ia;
  if (!base.fontes?.length) {
    const url = item.sugestao_url ?? item.envio_url ?? "";
    if (url) base.fontes = [{ ...fonteEmBranco("f1", hoje), url, titulo: item.sugestao_titulo ?? "", trecho: item.envio_trecho ?? "" }];
  }
  base.pessoas ??= [];
  base.organizacoes ??= [];
  base.etiquetas ??= [];
  base.pessoasPublicas ??= [];
  base.organizacoesPublicas ??= [];
  base.ligacoes ??= [];
  return base;
}
