// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito: as regras que protegem as pessoas, em funções puras. A mesma conferência roda (1) no teste, (2) no
// robô antes de gravar uma sugestão, (3) na tela da curadoria antes de aprovar e (4) no banco (interno.vale_doc_ok, em
// supabase/migracoes/2026-11-vale-o-escrito.sql, que repete o essencial). Se mudar aqui, mude lá.
//
// Sem "@/" e sem acesso a disco, de propósito: roda direto no Node (npm run testar:vale-o-escrito).
//
// Base legal (conferida no planalto.gov.br em 04/11/2026; detalhes e ressalvas em docs/vale-o-escrito/ESPEC.md, seção 5):
//  - CF, art. 5º, LVII: presunção de inocência até o trânsito em julgado. Por isso a situação é obrigatória e escrita.
//  - ECA (Lei 8.069/1990), art. 17 (respeito à integridade moral da criança e do adolescente), art. 143 (veda divulgar
//    ato judicial, policial ou administrativo que identifique criança ou adolescente) e art. 247 (pena de quem divulga
//    nome, ato ou documento, ou exibe imagem, sem autorização). Daí: nunca criança ou adolescente como nó ou foto.
//  - LGPD (Lei 13.709/2018), art. 14: dado de criança e de adolescente só em seu melhor interesse; art. 4º, II, "a":
//    o tratamento para fim jornalístico fica fora da lei, mas isso não nos dispensa dos limites abaixo (o Instituto
//    NÃO é veículo de imprensa registrado: a assessoria jurídica decide se o inciso vale, ver ESPEC).
//  - LGPD, art. 7º, II, VI e IX; art. 11 (dado sensível): usamos o mínimo, só o que já é público no caso e consta de fonte.
//  - Código Penal, arts. 138 (calúnia), 139 (difamação) e 140 (injúria): a frase "segundo [fonte]" e o "supostamente"
//    existem para não afirmar como fato o que é só alegação. Não substituem a fonte: afirmar crime falso continua crime.
//  - Lei 13.188/2015, arts. 2º a 7º (direito de resposta ou retificação, gratuito e proporcional ao agravo, contra
//    matéria de veículo de comunicação social): o Instituto oferece o mesmo caminho em toda ficha, por boa-fé.
//  - Lei 12.527/2011 (LAI), art. 31: informação pessoal só com respeito à intimidade, vida privada, honra e imagem;
//    usamos só dado já divulgado pelo próprio poder público.
//  - Marco Civil (Lei 12.965/2014), art. 19: o que for decidido em ordem judicial específica é cumprido; art. 15: a
//    guarda de registros de acesso a aplicações é só do provedor profissional; nós NÃO guardamos IP.

import {
  CONFIANCAS,
  PAPEIS_DE_PESSOA,
  SITUACOES,
  SITUACOES_DE_CONDENACAO,
  SITUACOES_DE_ENCERRAMENTO,
  TIPOS_DE_CORRECAO,
  TIPOS_DE_FONTE,
  TIPOS_DE_LIGACAO,
  TIPOS_DE_NO,
  TIPOS_DE_VALOR,
  TIPOS_PRIMARIOS,
  type Correcao,
  type EnvioDoPublico,
  type Entrada,
  type Fonte,
  type Ligacao,
  type Lugar,
  type PessoaPublica,
  type ValorDocumentado,
} from "./tipos";
import { IDS_DO_CATALOGO, SLUGS_DOS_DOSSIES } from "./catalogo";

/** Resultado de uma conferência: lista de erros no formato "campo: motivo". Vazia quando serve. */
export interface Conferencia {
  ok: boolean;
  erros: string[];
}

const resultado = (erros: string[]): Conferencia => ({ ok: erros.length === 0, erros });

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Código IBGE da UF = os 2 primeiros dígitos do código do município. */
export const CODIGO_IBGE_DA_UF: Record<(typeof UFS)[number], string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

/**
 * Papéis que NUNCA podem ser nó de pessoa. A comparação é feita sem acento e em minúsculas, também dentro de textos
 * livres (papelNoCaso, cargo, etiquetas): quem é vítima, criança, adolescente ou testemunha não entra na teia.
 * ECA arts. 17, 143 e 247; LGPD art. 14.
 */
export const PAPEIS_PROIBIDOS = [
  "vitima", "vitimas", "crianca", "criancas", "adolescente", "adolescentes", "menor de idade", "menores de idade",
  "menor infrator", "infante", "testemunha", "testemunhas", "informante", "denunciante anonimo", "delator", "colaborador anonimo",
  "sobrevivente", "familiar da vitima", "parente da vitima",
] as const;

/** Tira acento, põe em minúsculas e junta espaços, para comparar texto. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** O texto menciona um papel proibido (vítima, criança, adolescente, testemunha...)? Devolve o termo achado. */
export function mencionaPapelProibido(texto: string): string | null {
  const t = ` ${normalizar(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ")} `;
  for (const termo of PAPEIS_PROIBIDOS) if (t.includes(` ${termo} `)) return termo;
  return null;
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const ISO_PARCIAL = /^\d{4}(-\d{2})?(-\d{2})?$/;

/** AAAA-MM-DD que existe de verdade no calendário. */
export function diaValido(valor: unknown): boolean {
  if (typeof valor !== "string" || !ISO_DIA.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return a >= 1900 && a <= 2100 && data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

/** AAAA, AAAA-MM ou AAAA-MM-DD (a data do fato, quando a fonte não dá o dia). */
export function dataParcialValida(valor: unknown): boolean {
  if (typeof valor !== "string" || !ISO_PARCIAL.test(valor)) return false;
  const partes = valor.split("-");
  if (partes.length === 3) return diaValido(valor);
  const a = Number(partes[0]);
  const m = partes[1] ? Number(partes[1]) : 1;
  return a >= 1900 && a <= 2100 && m >= 1 && m <= 12;
}

const textoComTamanho = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const SLUG = /^[a-z0-9][a-z0-9-]{1,79}$/;
const ID_LOCAL = /^[a-z0-9][a-z0-9._-]{0,79}$/;

export function urlHttp(valor: unknown): boolean {
  if (typeof valor !== "string" || valor.length > 2000) return false;
  try {
    const u = new URL(valor);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** CPF (com ou sem pontuação) dentro de um texto: dado pessoal que nunca entra. */
export function contemCpf(texto: string): boolean {
  return /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(texto);
}

// ───────────────────────────── Lugar ─────────────────────────────

export function validarLugar(l: Lugar | undefined): Conferencia {
  const e: string[] = [];
  if (!l || typeof l !== "object") return resultado(["lugar: falta"]);
  if (!/^[A-Z]{2}$/.test(l.pais ?? "")) e.push("lugar.pais: use o código de 2 letras (BR)");
  if (l.pais === "BR") {
    if (l.regiao !== undefined && !(UFS as readonly string[]).includes(l.regiao)) e.push("lugar.regiao: UF inválida");
    if (l.municipioIbge !== undefined) {
      if (!/^\d{7}$/.test(l.municipioIbge)) e.push("lugar.municipioIbge: são 7 dígitos");
      else if (!l.regiao) e.push("lugar.regiao: município sem UF");
      else if (CODIGO_IBGE_DA_UF[l.regiao as keyof typeof CODIGO_IBGE_DA_UF] !== l.municipioIbge.slice(0, 2)) e.push("lugar.municipioIbge: não pertence à UF");
    }
  } else if (l.municipioIbge !== undefined) e.push("lugar.municipioIbge: o código IBGE só vale no Brasil");
  return resultado(e);
}

// ───────────────────────────── Fonte ─────────────────────────────

/**
 * Fonte válida: veículo, tipo, link, trecho (20 a 400 caracteres), data da fonte e data de acesso. Em entrada JÁ
 * PUBLICADA (publicada = true) exige também a cópia no Internet Archive (ou a marca arquivoFalhou).
 */
export function validarFonte(f: Fonte, opcoes: { publicada?: boolean } = {}): Conferencia {
  const e: string[] = [];
  if (!f || typeof f !== "object") return resultado(["fonte: falta"]);
  if (!ID_LOCAL.test(f.id ?? "")) e.push("fonte.id: inválido");
  if (!textoComTamanho(f.veiculo, 2, 120)) e.push("fonte.veiculo: de 2 a 120 caracteres");
  if (!(TIPOS_DE_FONTE as readonly string[]).includes(f.tipo)) e.push("fonte.tipo: inválido");
  if (!textoComTamanho(f.titulo, 3, 300)) e.push("fonte.titulo: de 3 a 300 caracteres");
  if (!urlHttp(f.url)) e.push("fonte.url: link http(s) inválido");
  if (!textoComTamanho(f.trecho, 20, 400)) e.push("fonte.trecho: obrigatório, de 20 a 400 caracteres (só o trecho, nunca a página)");
  if (!diaValido(f.data)) e.push("fonte.data: AAAA-MM-DD obrigatório");
  if (!diaValido(f.acessadoEm)) e.push("fonte.acessadoEm: AAAA-MM-DD obrigatório");
  if (f.catalogoId !== undefined && !IDS_DO_CATALOGO.includes(f.catalogoId)) e.push("fonte.catalogoId: fora do catálogo");
  if (f.arquivoUrl !== undefined && !/^https:\/\/web\.archive\.org\/web\/\d{4,14}\/https?:\/\//.test(f.arquivoUrl))
    e.push("fonte.arquivoUrl: tem de ser do Internet Archive (https://web.archive.org/web/AAAAMMDDHHMMSS/...)");
  if (opcoes.publicada && !f.arquivoUrl && f.arquivoFalhou !== true) e.push("fonte.arquivoUrl: falta o arquivo do Internet Archive (feito na aprovação)");
  if (typeof f.trecho === "string" && contemCpf(f.trecho)) e.push("fonte.trecho: tem CPF");
  return resultado(e);
}

/** A fonte é primária (processo, investigação oficial ou dado oficial)? */
export const fontePrimaria = (f: Fonte): boolean => TIPOS_PRIMARIOS.includes(f.tipo);

// ───────────────────────────── Pessoa ─────────────────────────────

/**
 * Pessoa como nó da teia: só com a marca "pública no caso", ao menos uma fonte, papel da lista permitida e sem
 * menção a vítima, criança, adolescente ou testemunha em nenhum campo de texto. Sem foto sem crédito e licença.
 */
export function validarPessoa(p: PessoaPublica): Conferencia {
  const e: string[] = [];
  if (!p || typeof p !== "object") return resultado(["pessoa: falta"]);
  if (!ID_LOCAL.test(p.id ?? "")) e.push("pessoa.id: inválido");
  if (!textoComTamanho(p.nome, 3, 160)) e.push("pessoa.nome: de 3 a 160 caracteres");
  if ((p as { publicaNoCaso?: unknown }).publicaNoCaso !== true) e.push("pessoa.publicaNoCaso: só entra quem já é público no caso (marca obrigatória)");
  if (!Array.isArray(p.fonteIds) || p.fonteIds.length === 0) e.push("pessoa.fonteIds: o nome precisa de fonte");
  if (!(PAPEIS_DE_PESSOA as readonly string[]).includes(p.papel)) e.push("pessoa.papel: fora da lista (vítima, criança, adolescente e testemunha não são nós)");
  for (const [campo, valor] of [["papel", p.papel], ["cargo", p.cargo], ["nome", p.nome]] as const) {
    const achado = typeof valor === "string" ? mencionaPapelProibido(valor) : null;
    if (achado) e.push(`pessoa.${campo}: menciona "${achado}" (nunca vítima, criança, adolescente ou testemunha)`);
  }
  if (typeof p.nome === "string" && contemCpf(p.nome)) e.push("pessoa.nome: tem CPF");
  if (p.foto) {
    if (!urlHttp(p.foto.url) || !textoComTamanho(p.foto.credito, 3, 200) || !textoComTamanho(p.foto.licenca, 2, 120) || !urlHttp(p.foto.origem))
      e.push("pessoa.foto: só com licença livre, crédito e página de origem");
  }
  return resultado(e);
}

// ───────────────────────────── "segundo [fonte]" ─────────────────────────────

/**
 * O texto tem a frase "segundo [veículo]" de pelo menos uma das fontes? Aceita o artigo ("segundo a Repórter Brasil",
 * "segundo o TCU"). Sem acento e sem diferença de caixa.
 */
export function temSegundoFonte(texto: string, fontes: readonly Fonte[]): boolean {
  const t = normalizar(texto);
  return fontes.some((f) => {
    if (typeof f.veiculo !== "string" || f.veiculo.trim() === "") return false;
    const v = normalizar(f.veiculo);
    return ["", "a ", "o ", "as ", "os "].some((artigo) => t.includes(`segundo ${artigo}${v}`));
  });
}

// ───────────────────────────── Entrada ─────────────────────────────

export interface OpcoesDaEntrada {
  /** A entrada já está publicada (exige arquivo do Internet Archive em toda fonte). */
  publicada?: boolean;
  /** Os ids de pessoas e organizações conhecidos no arquivo do dossiê, para conferir as referências. */
  pessoas?: readonly PessoaPublica[];
  organizacoesIds?: readonly string[];
}

/**
 * Entrada válida. Sem fonte, sem trecho, sem data ou sem situação jurídica: inválida. Resumo precisa de "segundo
 * [veículo]". Confiança "primaria" exige fonte primária; condenação exige fonte primária; absolvição e arquivamento
 * exigem a data da atualização.
 */
export function validarEntrada(en: Entrada, opcoes: OpcoesDaEntrada = {}): Conferencia {
  const e: string[] = [];
  if (!en || typeof en !== "object") return resultado(["entrada: falta"]);
  if (!SLUG.test(en.id ?? "")) e.push("id: inválido");
  if (!(SLUGS_DOS_DOSSIES as readonly string[]).includes(en.dossie)) e.push("dossie: fora dos dossiês cadastrados");
  if (!textoComTamanho(en.titulo, 5, 200)) e.push("titulo: de 5 a 200 caracteres");
  if (!textoComTamanho(en.resumo, 20, 1200)) e.push("resumo: de 20 a 1200 caracteres");
  if (!dataParcialValida(en.dataDoFato)) e.push("dataDoFato: AAAA, AAAA-MM ou AAAA-MM-DD");
  if (!diaValido(en.publicadoEm)) e.push("publicadoEm: AAAA-MM-DD");
  if (!diaValido(en.atualizadoEm)) e.push("atualizadoEm: AAAA-MM-DD");
  else if (diaValido(en.publicadoEm) && en.atualizadoEm < en.publicadoEm) e.push("atualizadoEm: anterior à publicação");
  if (!(SITUACOES as readonly string[]).includes(en.situacao)) e.push("situacao: obrigatória (suspeito, investigado, denunciado, réu, condenado em 1ª instância, condenado com trânsito em julgado, absolvido ou arquivado)");
  if (!(CONFIANCAS as readonly string[]).includes(en.confianca)) e.push("confianca: primaria ou reportado");
  e.push(...validarLugar(en.lugar).erros);

  const fontes = Array.isArray(en.fontes) ? en.fontes : [];
  if (fontes.length === 0) e.push("fontes: pelo menos uma (sem fonte não há entrada)");
  const ids = new Set<string>();
  fontes.forEach((f, i) => {
    for (const msg of validarFonte(f, { publicada: opcoes.publicada }).erros) e.push(`fontes[${i}].${msg}`);
    if (ids.has(f?.id)) e.push(`fontes[${i}].id: repetido`);
    ids.add(f?.id);
  });

  if (typeof en.resumo === "string" && fontes.length > 0 && !temSegundoFonte(en.resumo, fontes))
    e.push('resumo: precisa da frase "segundo [veículo]" de uma das fontes');
  for (const [campo, valor] of [["titulo", en.titulo], ["resumo", en.resumo]] as const) {
    if (typeof valor === "string" && contemCpf(valor)) e.push(`${campo}: tem CPF`);
  }

  if (en.confianca === "primaria" && !fontes.some(fontePrimaria)) e.push("confianca: 'primaria' exige uma fonte primária (processo, investigação oficial ou dado oficial)");
  if ((SITUACOES_DE_CONDENACAO as readonly string[]).includes(en.situacao) && !fontes.some((f) => f.tipo === "processo"))
    e.push("situacao: condenação exige a decisão (fonte do tipo 'processo')");
  if (en.situacao === "condenado_transitado" && en.confianca !== "primaria") e.push("situacao: condenação com trânsito em julgado exige confiança 'primaria'");
  // Absolvição e arquivamento: a data da atualização (conferida acima) é a que aparece na ficha. A curadoria a muda
  // sempre que a situação muda (ESPEC, seção 5.4), e a ficha mostra "Atualizado em".
  if ((SITUACOES_DE_ENCERRAMENTO as readonly string[]).includes(en.situacao) && !diaValido(en.atualizadoEm)) e.push("atualizadoEm: obrigatória em absolvição e arquivamento");

  const pessoas = Array.isArray(en.pessoas) ? en.pessoas : [];
  pessoas.forEach((p, i) => {
    if (!(SITUACOES as readonly string[]).includes(p?.situacao)) e.push(`pessoas[${i}].situacao: obrigatória`);
    if (typeof p?.papelNoCaso === "string") {
      const achado = mencionaPapelProibido(p.papelNoCaso);
      if (achado) e.push(`pessoas[${i}].papelNoCaso: menciona "${achado}"`);
      if (!/\b(segundo|supostamente)\b/i.test(normalizar(p.papelNoCaso))) e.push(`pessoas[${i}].papelNoCaso: precisa de "segundo [fonte]" ou "supostamente"`);
    }
    if (opcoes.pessoas) {
      const achada = opcoes.pessoas.find((x) => x.id === p?.pessoaId);
      if (!achada) e.push(`pessoas[${i}].pessoaId: não existe no arquivo do dossiê`);
      else for (const msg of validarPessoa(achada).erros) e.push(`pessoas[${i}] (${achada.id}).${msg}`);
    }
  });
  if (opcoes.organizacoesIds && Array.isArray(en.organizacoes))
    en.organizacoes.forEach((o, i) => {
      if (!opcoes.organizacoesIds!.includes(o)) e.push(`organizacoes[${i}]: não existe no arquivo do dossiê`);
    });
  if (Array.isArray(en.etiquetas)) {
    en.etiquetas.forEach((t, i) => {
      if (!textoComTamanho(t, 2, 60)) e.push(`etiquetas[${i}]: de 2 a 60 caracteres`);
      else if (mencionaPapelProibido(t)) e.push(`etiquetas[${i}]: menciona vítima, criança, adolescente ou testemunha`);
    });
  } else e.push("etiquetas: lista");
  e.push(...validarValores(en));
  return resultado(e);
}

// ───────────────────────────── Valores em dinheiro ─────────────────────────────

/**
 * Lê um valor escrito em reais ("R$ 6 milhões", "R$ 6,3 bilhões", "R$ 3.009.000,00", "R$ 359 mil") e devolve o número
 * em reais, ou null. Serve para conferir que o número guardado é o mesmo que a fonte escreve (nada calculado pela equipe).
 */
export function valorDoEscrito(escrito: string): number | null {
  const m = /R\$\s*([\d.]+(?:,\d+)?)\s*(mil\b|milh(?:ão|ao|ões|oes)|bilh(?:ão|ao|ões|oes))?/i.exec(escrito ?? "");
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const sufixo = (m[2] ?? "").toLowerCase();
  const mult = !sufixo ? 1 : sufixo === "mil" ? 1e3 : sufixo.startsWith("milh") ? 1e6 : 1e9;
  return Math.round(n * mult * 100) / 100;
}

/**
 * Os valores de uma entrada: tipo conhecido, número igual ao escrito, o escrito presente no resumo da entrada ou no
 * trecho da fonte citada, uma linha com "segundo [fonte]" ou "supostamente", e a ponta (quem paga ou responde) só entre
 * pessoas e organizações já citadas no caso. Sem vítima: a ponta nunca é pessoa fora do caso.
 */
export function validarValores(en: Pick<Entrada, "resumo" | "fontes" | "pessoas" | "organizacoes"> & { valores?: ValorDocumentado[] }): string[] {
  const e: string[] = [];
  if (en.valores === undefined) return e;
  if (!Array.isArray(en.valores)) return ["valores: lista"];
  const ids = new Set<string>();
  en.valores.forEach((v, i) => {
    const p = `valores[${i}]`;
    if (!v || typeof v !== "object") return void e.push(`${p}: falta`);
    if (!/^v\d+$/.test(v.id ?? "")) e.push(`${p}.id: "v1", "v2"...`);
    else if (ids.has(v.id)) e.push(`${p}.id: repetido`);
    ids.add(v.id);
    if (!(TIPOS_DE_VALOR as readonly string[]).includes(v.tipo)) e.push(`${p}.tipo: desconhecido`);
    if (typeof v.valor !== "number" || !(v.valor > 0)) e.push(`${p}.valor: número positivo, em reais`);
    const lido = valorDoEscrito(v.escrito);
    if (lido === null) e.push(`${p}.escrito: "R$ ..." como a fonte escreve`);
    else if (typeof v.valor === "number" && Math.abs(lido - v.valor) > 0.5) e.push(`${p}.valor: não bate com "${v.escrito}"`);
    if (!dataParcialValida(v.data)) e.push(`${p}.data: AAAA, AAAA-MM ou AAAA-MM-DD`);
    if (!textoComTamanho(v.resumo, 10, 240)) e.push(`${p}.resumo: de 10 a 240 caracteres`);
    else {
      if (!/\b(segundo|supostamente)\b/.test(normalizar(v.resumo))) e.push(`${p}.resumo: precisa de "segundo [fonte]" ou "supostamente"`);
      if (mencionaPapelProibido(v.resumo)) e.push(`${p}.resumo: menciona vítima, criança, adolescente ou testemunha`);
      if (contemCpf(v.resumo)) e.push(`${p}.resumo: tem CPF`);
    }
    const fonte = (en.fontes ?? []).find((f) => f.id === v.fonteId);
    if (!fonte) e.push(`${p}.fonteId: não é fonte da entrada`);
    else if (typeof v.escrito === "string" && v.escrito.trim()) {
      const alvo = normalizar(v.escrito);
      if (!normalizar(en.resumo ?? "").includes(alvo) && !normalizar(fonte.trecho ?? "").includes(alvo))
        e.push(`${p}.escrito: "${v.escrito}" não está no resumo nem no trecho da fonte`);
    }
    if (v.ponta !== undefined) {
      const ok =
        (v.ponta?.tipo === "pessoa" && (en.pessoas ?? []).some((x) => x.pessoaId === v.ponta!.id)) ||
        (v.ponta?.tipo === "organizacao" && (en.organizacoes ?? []).includes(v.ponta.id));
      if (!ok) e.push(`${p}.ponta: só pessoa ou organização já citada no caso`);
    }
  });
  return e;
}

// ───────────────────────────── Ligação ─────────────────────────────

/** Ligação válida: dois nós de tipos conhecidos, tipo conhecido e pelo menos uma fonte. */
export function validarLigacao(l: Ligacao, fonteIdsConhecidos?: readonly string[]): Conferencia {
  const e: string[] = [];
  if (!l || typeof l !== "object") return resultado(["ligacao: falta"]);
  if (!ID_LOCAL.test(l.id ?? "")) e.push("ligacao.id: inválido");
  for (const [campo, no] of [["de", l.de], ["para", l.para]] as const) {
    if (!no || !(TIPOS_DE_NO as readonly string[]).includes(no.tipo) || !ID_LOCAL.test(no.id ?? "")) e.push(`ligacao.${campo}: nó inválido`);
  }
  if (l.de && l.para && l.de.tipo === l.para.tipo && l.de.id === l.para.id) e.push("ligacao: um nó não se liga a si mesmo");
  if (!(TIPOS_DE_LIGACAO as readonly string[]).includes(l.tipo)) e.push("ligacao.tipo: inválido");
  if (!Array.isArray(l.fonteIds) || l.fonteIds.length === 0) e.push("ligacao.fonteIds: sem fonte não há ligação");
  else if (fonteIdsConhecidos) for (const id of l.fonteIds) if (!fonteIdsConhecidos.includes(id)) e.push(`ligacao.fonteIds: "${id}" não existe`);
  if (!ID_LOCAL.test(l.entradaId ?? "")) e.push("ligacao.entradaId: inválido");
  if (typeof l.rotulo === "string") {
    if (l.rotulo.length > 160) e.push("ligacao.rotulo: até 160 caracteres");
    if (mencionaPapelProibido(l.rotulo)) e.push("ligacao.rotulo: menciona vítima, criança, adolescente ou testemunha");
  }
  return resultado(e);
}

// ───────────────────────────── Correção e envio do público ─────────────────────────────

const CONTATO = /^(?:[^\s@]+@[^\s@]+\.[^\s@]{2,}|\+?[\d\s().-]{8,20})$/;

/** Pedido de correção. Direito de resposta exige contato; o campo-isca "site" tem de vir vazio. */
export function validarCorrecao(c: Correcao): Conferencia {
  const e: string[] = [];
  if (!c || typeof c !== "object") return resultado(["correcao: falta"]);
  if ((c.site ?? "") !== "") e.push("site: isca preenchida");
  if (!SLUG.test(c.entradaId ?? "")) e.push("entradaId: inválido");
  if (!(TIPOS_DE_CORRECAO as readonly string[]).includes(c.tipo)) e.push("tipo: inválido");
  if (!textoComTamanho(c.texto, 20, 4000)) e.push("texto: de 20 a 4000 caracteres");
  if (c.comprovanteUrl !== undefined && c.comprovanteUrl !== "" && !urlHttp(c.comprovanteUrl)) e.push("comprovanteUrl: link inválido");
  if (c.nome !== undefined && !textoComTamanho(c.nome, 0, 160)) e.push("nome: até 160 caracteres");
  if (c.contato !== undefined && c.contato !== "" && !CONTATO.test(c.contato.trim())) e.push("contato: e-mail ou telefone inválido");
  if (c.tipo === "direito_de_resposta" && !(c.contato ?? "").trim()) e.push("contato: o direito de resposta precisa de um contato para a resposta chegar");
  // Lei 13.188/2015, art. 3º, caput e §2º: o pedido é do ofendido ou de quem a lei autoriza (representante legal, cônjuge,
  // descendente, ascendente, irmão). A lei não lista os dados de identificação; pedimos o nome e a qualidade de quem pede.
  if (c.tipo === "direito_de_resposta" && !textoComTamanho(c.nome, 3, 160)) e.push("nome: o direito de resposta precisa do nome de quem responde (Lei 13.188/2015, art. 3º)");
  if (typeof c.texto === "string" && contemCpf(c.texto)) e.push("texto: não envie CPF");
  return resultado(e);
}

/** Envio de fonte pelo público: link válido, descrição, aviso lido, sem isca e sem dado pessoal. */
export function validarEnvio(v: EnvioDoPublico): Conferencia {
  const e: string[] = [];
  if (!v || typeof v !== "object") return resultado(["envio: falta"]);
  if ((v.site ?? "") !== "") e.push("site: isca preenchida");
  if (!urlHttp(v.url)) e.push("url: link http(s) inválido");
  if (!textoComTamanho(v.descricao, 10, 2000)) e.push("descricao: de 10 a 2000 caracteres");
  else {
    if (contemCpf(v.descricao)) e.push("descricao: não envie CPF");
    const links = (v.descricao.match(/https?:\/\//gi) ?? []).length;
    if (links > 3) e.push("descricao: links demais (suspeita de spam)");
  }
  if (v.trecho !== undefined && v.trecho !== "" && !textoComTamanho(v.trecho, 1, 400)) e.push("trecho: até 400 caracteres");
  if (v.dossie !== undefined && v.dossie !== "" && !(SLUGS_DOS_DOSSIES as readonly string[]).includes(v.dossie)) e.push("dossie: desconhecido");
  if (v.contato !== undefined && v.contato !== "" && !CONTATO.test(v.contato.trim())) e.push("contato: e-mail ou telefone inválido");
  if (v.leuOAviso !== true) e.push("leuOAviso: marque que leu o aviso");
  return resultado(e);
}
