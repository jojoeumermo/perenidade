// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os exercícios com explicação do erro: o formato, a conferência de cada arquivo e a correção de uma resposta.
// Ficam em content/exercicios/<trilha>/<aula>.yml, fora do arquivo da aula, e só aparecem com o recurso "exercicios"
// ligado (lib/recursos.ts). O formato está explicado em docs/EXERCICIOS.md.
// Sem os atalhos "@/" de propósito: `npm run testar:exercicios` roda este arquivo direto no Node.

import { calculate } from "./expressao";
import { equals, type Fraction, frac, fromDecimal } from "./fracao";

export type Dificuldade = 1 | 2 | 3;

/** Nenhum exercício nasce revisado: "revisada" só entra quando uma pessoa confere e escreve quem (a função) e quando. */
export type Revisao = { status: "em-revisao" } | { status: "revisada"; por: string; em: string };

interface Base {
  /** Único em todo o site e estável: é por ele que o aparelho guarda o que a pessoa respondeu. */
  id: string;
  tema: string;
  dificuldade: Dificuldade;
  enunciado: string;
  /** Por que a resposta certa é a certa. */
  explicacao: string;
  /** "Questão original do Instituto Lúcia" ou a fonte da questão adaptada (ex.: "Adaptada do ENEM 2019, questão 140"). */
  fonte: string;
  /** Conta que confere a resposta (só números e + − × ÷ ^ e parênteses), refeita por `npm run testar:exercicios`. */
  conferir?: string;
  /** Entra no teste curto de nivelamento da disciplina. */
  nivelamento: boolean;
  revisao: Revisao;
  /** Quem escreveu. */
  autoria: string;
}

export interface Alternativa {
  texto: string;
  certa: boolean;
  /** Nas erradas: o engano mais comum que leva a ela e como corrigir. */
  erro?: string;
  /** Valor numérico da alternativa, quando o texto não é só o número (ex.: "2 horas e 15 minutos" → 135). */
  valor?: string;
}

export interface ExercicioDeEscolha extends Base {
  tipo: "escolha";
  alternativas: Alternativa[];
}

export interface ExercicioDeNumero extends Base {
  tipo: "numero";
  /** A resposta; frações equivalentes e o mesmo valor em decimal também valem ("3/4", "6/8", "0,75"). */
  resposta: string;
  /** O que aparece depois do campo ("reais", "%", "cm"). */
  unidade?: string;
  /** Respostas erradas que aparecem muito, cada uma com a explicação do engano. */
  errosComuns: { resposta: string; explicacao: string }[];
  /** Para qualquer outra resposta errada: uma pista, sem entregar a resposta. */
  dica: string;
}

export type ExercicioNovo = ExercicioDeEscolha | ExercicioDeNumero;

type Dado = Record<string, unknown>;

function falhar(arquivo: string, mensagem: string): never {
  throw new Error(`Exercício inválido em ${arquivo}: ${mensagem}`);
}

function texto(dado: Dado, chave: string, onde: string, arquivo: string, max = 2000): string {
  const valor = dado[chave];
  if (typeof valor !== "string" || !valor.trim()) falhar(arquivo, `${onde}: o campo "${chave}" é obrigatório`);
  if (valor.length > max) falhar(arquivo, `${onde}: "${chave}" passa de ${max} caracteres`);
  return valor.trim();
}

function opcional(dado: Dado, chave: string, onde: string, arquivo: string): string | undefined {
  const valor = dado[chave];
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== "string" && typeof valor !== "number") falhar(arquivo, `${onde}: "${chave}" deve ser um texto`);
  return String(valor).trim() || undefined;
}

function revisaoDe(bruto: unknown, onde: string, arquivo: string): Revisao {
  if (bruto === undefined || bruto === null) return { status: "em-revisao" };
  if (typeof bruto !== "object" || Array.isArray(bruto)) falhar(arquivo, `${onde}: "revisao" deve ter "status"`);
  const r = bruto as Dado;
  if (r.status === "em-revisao") return { status: "em-revisao" };
  if (r.status !== "revisada") falhar(arquivo, `${onde}: "revisao.status" deve ser em-revisao ou revisada`);
  const por = texto(r, "por", `${onde}.revisao`, arquivo, 120);
  const em = r.em instanceof Date ? r.em.toISOString().slice(0, 10) : String(r.em ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(em)) falhar(arquivo, `${onde}: "revisao.em" deve ser uma data AAAA-MM-DD`);
  return { status: "revisada", por, em };
}

/** Confere a lista de exercícios de um arquivo. Qualquer problema para a montagem, com o arquivo e o item no erro. */
export function validarExercicios(bruto: unknown, arquivo: string): ExercicioNovo[] {
  if (!Array.isArray(bruto)) falhar(arquivo, "o arquivo deve ser uma lista de exercícios");
  const ids = new Set<string>();
  return bruto.map((item: unknown, i) => {
    const onde = `item ${i + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) falhar(arquivo, `${onde}: cada exercício é um bloco com campos`);
    const d = item as Dado;
    const id = texto(d, "id", onde, arquivo, 80);
    if (!/^[a-z0-9-]+$/.test(id)) falhar(arquivo, `${onde}: "id" só pode ter letras minúsculas, números e hífens`);
    if (ids.has(id)) falhar(arquivo, `${onde}: o id "${id}" aparece duas vezes`);
    ids.add(id);
    const dificuldade = d.dificuldade;
    if (dificuldade !== 1 && dificuldade !== 2 && dificuldade !== 3) falhar(arquivo, `${onde}: "dificuldade" deve ser 1, 2 ou 3`);
    if (d.nivelamento !== undefined && typeof d.nivelamento !== "boolean") falhar(arquivo, `${onde}: "nivelamento" deve ser true ou false`);
    const base = {
      id,
      tema: texto(d, "tema", onde, arquivo, 80),
      dificuldade: dificuldade as Dificuldade,
      enunciado: texto(d, "enunciado", onde, arquivo),
      explicacao: texto(d, "explicacao", onde, arquivo),
      fonte: texto(d, "fonte", onde, arquivo, 300),
      conferir: opcional(d, "conferir", onde, arquivo),
      nivelamento: d.nivelamento === true,
      revisao: revisaoDe(d.revisao, onde, arquivo),
      autoria: opcional(d, "autoria", onde, arquivo) ?? "Instituto Lúcia",
    };
    const tipo = d.tipo ?? "escolha";
    if (tipo === "escolha") {
      const brutas = d.alternativas;
      if (!Array.isArray(brutas) || brutas.length < 2 || brutas.length > 6) falhar(arquivo, `${onde}: "alternativas" precisa de 2 a 6 itens`);
      const alternativas = brutas.map((a: unknown, j): Alternativa => {
        const lugar = `${onde}, alternativa ${j + 1}`;
        if (!a || typeof a !== "object" || Array.isArray(a)) falhar(arquivo, `${lugar}: cada alternativa tem "texto" e, se for a certa, "certa: true"`);
        const alt = a as Dado;
        const certa = alt.certa === true;
        const erro = opcional(alt, "erro", lugar, arquivo);
        if (!certa && !erro) falhar(arquivo, `${lugar}: alternativa errada precisa de "erro" (o engano que leva a ela e como corrigir)`);
        if (certa && erro) falhar(arquivo, `${lugar}: a alternativa certa não leva "erro"`);
        return { texto: texto(alt, "texto", lugar, arquivo, 400), certa, erro, valor: opcional(alt, "valor", lugar, arquivo) };
      });
      if (alternativas.filter((a) => a.certa).length !== 1) falhar(arquivo, `${onde}: exatamente uma alternativa leva "certa: true"`);
      if (new Set(alternativas.map((a) => a.texto)).size !== alternativas.length) falhar(arquivo, `${onde}: há duas alternativas iguais`);
      return { ...base, tipo: "escolha", alternativas };
    }
    if (tipo === "numero") {
      const resposta = opcional(d, "resposta", onde, arquivo);
      if (!resposta || !lerNumero(resposta)) falhar(arquivo, `${onde}: "resposta" deve ser um número (ex.: 12, 0,75 ou 3/4)`);
      const brutos = d.erros_comuns ?? [];
      if (!Array.isArray(brutos)) falhar(arquivo, `${onde}: "erros_comuns" deve ser uma lista`);
      const errosComuns = brutos.map((e: unknown, j) => {
        const lugar = `${onde}, erros_comuns ${j + 1}`;
        if (!e || typeof e !== "object") falhar(arquivo, `${lugar}: cada item tem "resposta" e "explicacao"`);
        const r = opcional(e as Dado, "resposta", lugar, arquivo);
        if (!r || !lerNumero(r)) falhar(arquivo, `${lugar}: "resposta" deve ser um número`);
        if (mesmoNumero(r, resposta)) falhar(arquivo, `${lugar}: o erro comum tem o mesmo valor da resposta certa`);
        return { resposta: r, explicacao: texto(e as Dado, "explicacao", lugar, arquivo) };
      });
      return { ...base, tipo: "numero", resposta, unidade: opcional(d, "unidade", onde, arquivo), errosComuns, dica: texto(d, "dica", onde, arquivo) };
    }
    falhar(arquivo, `${onde}: "tipo" deve ser escolha ou numero`);
  });
}

// ───────────── Números escritos por quem estuda ─────────────

/**
 * Lê "3/4", "0,75", "0.75", "-2", "1.080" (milhar), "1.080,50", "R$ 12,50", "75%" (vira 75). Devolve null quando não
 * entende, para a tela pedir de novo em vez de dar como errado.
 */
export function lerNumero(bruto: string): Fraction | null {
  let t = bruto.trim().replace(/\s+/g, "").replace(/^R\$/i, "").replace(/%$/, "").replace(/[−–]/g, "-");
  if (!t) return null;
  const fracao = /^(-?)(\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)$/.exec(t);
  try {
    if (fracao) {
      const cima = lerNumero(fracao[2]);
      const baixo = lerNumero(fracao[3]);
      if (!cima || !baixo || baixo.n === BigInt(0)) return null;
      const valor = frac(cima.n * baixo.d, cima.d * baixo.n);
      return fracao[1] ? frac(-valor.n, valor.d) : valor;
    }
    if (t.includes(",")) t = t.replace(/\.(?=\d{3}(\D|$))/g, "");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    return fromDecimal(t);
  } catch {
    return null;
  }
}

export function mesmoNumero(a: string, b: string): boolean {
  const x = lerNumero(a);
  const y = lerNumero(b);
  return Boolean(x && y && equals(x, y));
}

/** O primeiro número que aparece num texto ("R$ 84,00" → 84; "5/6 da pizza" → 5/6). */
export function numeroDoTexto(t: string): Fraction | null {
  const achado = /-?\d+(?:[.,]\d+)*(?:\s*\/\s*\d+(?:[.,]\d+)?)?/.exec(t.replace(/[−–]/g, "-"));
  return achado ? lerNumero(achado[0]) : null;
}

// ───────────── Correção ─────────────

export interface Correcao {
  /** null: não deu para entender a resposta (campo vazio, letra no lugar de número). */
  certo: boolean | null;
  /** A explicação do engano, quando a resposta é um erro conhecido. */
  engano?: string;
}

export function corrigirEscolha(ex: ExercicioDeEscolha, escolhida: number): Correcao {
  const alt = ex.alternativas[escolhida];
  if (!alt) return { certo: null };
  return alt.certa ? { certo: true } : { certo: false, engano: alt.erro };
}

export function corrigirNumero(ex: ExercicioDeNumero, dado: string): Correcao {
  const valor = lerNumero(dado);
  if (!valor) return { certo: null };
  const certa = lerNumero(ex.resposta);
  if (certa && equals(valor, certa)) return { certo: true };
  const conhecido = ex.errosComuns.find((e) => {
    const v = lerNumero(e.resposta);
    return v && equals(v, valor);
  });
  return { certo: false, engano: conhecido?.explicacao };
}

/** A alternativa certa (para mostrar depois de responder). */
export const certaDe = (ex: ExercicioDeEscolha) => ex.alternativas.findIndex((a) => a.certa);

// ───────────── Conferência das contas (roteiro de teste) ─────────────

/**
 * Refaz a conta de `conferir` e compara com a resposta certa. Devolve a lista de problemas (vazia se está tudo certo):
 * resposta diferente da conta, ou alguma alternativa errada com o mesmo valor da certa.
 */
export function conferirConta(ex: ExercicioNovo): string[] {
  if (!ex.conferir) return [];
  let esperado: number;
  try {
    esperado = calculate(ex.conferir.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-"));
  } catch (erro) {
    return [`${ex.id}: a conta de "conferir" não pôde ser lida (${(erro as Error).message})`];
  }
  const perto = (f: Fraction | null) => f !== null && Math.abs(Number(f.n) / Number(f.d) - esperado) < 1e-9;
  const problemas: string[] = [];
  if (ex.tipo === "numero") {
    if (!perto(lerNumero(ex.resposta))) problemas.push(`${ex.id}: a resposta ${ex.resposta} não bate com a conta ${ex.conferir} = ${esperado}`);
    for (const e of ex.errosComuns) if (perto(lerNumero(e.resposta))) problemas.push(`${ex.id}: o erro comum ${e.resposta} dá o mesmo valor da conta`);
    return problemas;
  }
  const valorDe = (a: Alternativa) => (a.valor !== undefined ? lerNumero(a.valor) : numeroDoTexto(a.texto));
  const certa = ex.alternativas.find((a) => a.certa);
  if (!certa || !perto(valorDe(certa))) problemas.push(`${ex.id}: a alternativa certa ("${certa?.texto}") não bate com a conta ${ex.conferir} = ${esperado}`);
  for (const a of ex.alternativas) if (!a.certa && perto(valorDe(a))) problemas.push(`${ex.id}: a alternativa errada "${a.texto}" tem o mesmo valor da certa`);
  return problemas;
}
