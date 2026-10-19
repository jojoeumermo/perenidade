// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que a pessoa guarda para estudar, neste navegador e só nele: o caderno de erros, o baralho de revisão espaçada e a
// cópia de segurança de tudo isso. Nada vai para servidor. Sem os atalhos "@/" de propósito: `npm run testar:estudo`
// roda este arquivo direto no Node.

// ───────────── Caderno de erros ─────────────

export interface Erro {
  /** Identidade da questão (a mesma questão errada duas vezes é um erro só). */
  id: string;
  pergunta: string;
  opcoes: string[];
  resposta: number;
  /** A opção que a pessoa marcou da última vez que errou. */
  escolhida: number;
  explicacao?: string;
  /** Onde estudar de novo (endereço no site, sem o idioma). */
  href?: string;
  /** Onde errou: "aula", "banco", "simulado", "caderno". */
  origem: string;
  quando: number;
  /** Acertos seguidos ao refazer: com dois, a questão sai da lista. */
  seguidos: number;
}

const CHAVE_ERROS = "lucia:erros";
const CHAVE_REVISAO = "lucia:revisao";
const MAX_ERROS = 500;
const MAX_CARTOES = 2000;

function ler<T>(chave: string): T[] {
  try {
    const dado: unknown = JSON.parse(globalThis.localStorage?.getItem(chave) ?? "[]");
    return Array.isArray(dado) ? (dado as T[]) : [];
  } catch {
    return [];
  }
}
function gravar(chave: string, lista: unknown[]) {
  try {
    globalThis.localStorage?.setItem(chave, JSON.stringify(lista));
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
  } catch {
    // armazenamento cheio ou bloqueado: o estudo segue, só não fica guardado
  }
}

/** Identidade estável de uma questão a partir do texto (para questões sem código próprio). */
export function idDaQuestao(pergunta: string, opcoes: string[]): string {
  let h = 2166136261;
  for (const c of `${pergunta}\u0000${opcoes.join("\u0001")}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `q${h.toString(36)}`;
}

export const lerErros = () => ler<Erro>(CHAVE_ERROS);

export function registrarErro(q: Omit<Erro, "id" | "quando" | "seguidos"> & { id?: string }) {
  const id = q.id ?? idDaQuestao(q.pergunta, q.opcoes);
  const lista = lerErros().filter((e) => e.id !== id);
  lista.unshift({ ...q, id, quando: Date.now(), seguidos: 0 });
  gravar(CHAVE_ERROS, lista.slice(0, MAX_ERROS));
}

/** Ao refazer: acerto conta (dois seguidos tiram da lista); erro zera a conta. Devolve se a questão saiu. */
export function refazerErro(id: string, acertou: boolean, escolhida: number): boolean {
  const lista = lerErros();
  const e = lista.find((x) => x.id === id);
  if (!e) return false;
  if (acertou) e.seguidos += 1;
  else Object.assign(e, { seguidos: 0, escolhida, quando: Date.now() });
  const saiu = e.seguidos >= 2;
  gravar(CHAVE_ERROS, saiu ? lista.filter((x) => x.id !== id) : lista);
  return saiu;
}

export const apagarErro = (id: string) => gravar(CHAVE_ERROS, lerErros().filter((e) => e.id !== id));

// ───────────── Revisão espaçada ─────────────

export interface CartaoDeRevisao {
  id: string;
  frente: string;
  verso: string;
  /** De onde veio (título da fonte, "erro", "marca"…). */
  origem: string;
  /** Caixa de Leitner: 0 (novo ou errado) a 6. */
  caixa: number;
  /** Próxima revisão, AAAA-MM-DD. */
  proxima: string;
  criado: number;
}

/** Dias até a próxima revisão em cada caixa. */
export const INTERVALOS = [0, 1, 3, 7, 14, 30, 60] as const;
export type Nota = "errei" | "dificil" | "bom" | "facil";

export function hoje(agora = new Date()): string {
  const d = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}
export function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** A conta da repetição espaçada: errou volta para a caixa 0 (revisa de novo hoje); difícil fica; bom sobe uma; fácil sobe duas. */
export function agendar(c: Pick<CartaoDeRevisao, "caixa">, nota: Nota, dia = hoje()): { caixa: number; proxima: string } {
  const ultima = INTERVALOS.length - 1;
  const caixa = nota === "errei" ? 0 : nota === "dificil" ? Math.max(1, c.caixa) : nota === "bom" ? Math.min(ultima, c.caixa + 1) : Math.min(ultima, c.caixa + 2);
  return { caixa, proxima: somarDias(dia, INTERVALOS[caixa]) };
}

export const lerCartoes = () => ler<CartaoDeRevisao>(CHAVE_REVISAO);
export const paraHoje = (lista = lerCartoes(), dia = hoje()) => lista.filter((c) => c.proxima <= dia);

/** Guarda cartões novos no baralho (o mesmo par frente/verso não entra duas vezes). Devolve quantos entraram. */
export function guardarCartoes(novos: { frente: string; verso: string; origem: string }[]): number {
  const lista = lerCartoes();
  const vistos = new Set(lista.map((c) => `${c.frente}\u0000${c.verso}`));
  let entraram = 0;
  for (const n of novos) {
    const frente = n.frente.trim().slice(0, 500);
    const verso = n.verso.trim().slice(0, 2000);
    if (!frente || !verso || vistos.has(`${frente}\u0000${verso}`)) continue;
    vistos.add(`${frente}\u0000${verso}`);
    lista.push({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, frente, verso, origem: n.origem.slice(0, 120), caixa: 0, proxima: hoje(), criado: Date.now() });
    entraram++;
  }
  gravar(CHAVE_REVISAO, lista.slice(-MAX_CARTOES));
  return entraram;
}

export function responderCartao(id: string, nota: Nota): CartaoDeRevisao | null {
  const lista = lerCartoes();
  const c = lista.find((x) => x.id === id);
  if (!c) return null;
  Object.assign(c, agendar(c, nota));
  gravar(CHAVE_REVISAO, lista);
  return c;
}
export const apagarCartao = (id: string) => gravar(CHAVE_REVISAO, lerCartoes().filter((c) => c.id !== id));

// ───────────── Cópia de segurança ─────────────

/** O que entra na cópia: só estudo e preferências de leitura. Chaves de aparelho, de sala, de sessão e rascunhos de conversa nunca. */
const CHAVES_DA_COPIA = new Set([
  "lucia:caderno",
  "lucia:revisao",
  "lucia:erros",
  "lucia:minha-estante",
  "lucia:dicionario-pessoal",
  "lucia:fichamento",
  "lucia:concluidas",
  "lucia:pratica",
  "lucia:redacao",
  "lucia:planilha",
  "lucia:ultima-aula",
  "lucia:visto",
  "lucia:podcast-visto",
  "lucia:acervo-vista",
  "lucia:lab:redes",
  "lucia:lab:concluidos",
  // As do painel "Meu estudo" (lib/meu-estudo.ts): testes, exercícios, datas, meta, nivelamento, "Isso ajudou?" e turmas.
  "lucia:testes",
  "lucia:exercicios",
  "lucia:concluidas-em",
  "lucia:metas",
  "lucia:nivelamento",
  "lucia:ajudou",
  "lucia:turmas",
  // A escolha "lembrar o VLibras neste aparelho" (lib/vlibras.ts).
  "lucia:vlibras",
]);
/** Chaves que guardam um objeto por item (aula ou exercício): na restauração, cada item fica com a versão mais nova. */
const REGISTROS = ["lucia:testes", "lucia:exercicios", "lucia:concluidas-em", "lucia:nivelamento", "lucia:ajudou"];
const PREFIXOS_DA_COPIA = ["lucia:lab:", "lucia:ouvido:"];
export const entraNaCopia = (chave: string) => CHAVES_DA_COPIA.has(chave) || PREFIXOS_DA_COPIA.some((p) => chave.startsWith(p) && !/[\s]/.test(chave) && chave.length < 200);

/** As chaves de estudo que existem neste armazenamento (para Meus dados copiar ou apagar tudo de uma vez). */
export function chavesDeEstudo(armazenamento: Pick<Storage, "length" | "key">): string[] {
  const chaves: string[] = [];
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (chave && entraNaCopia(chave)) chaves.push(chave);
  }
  return chaves;
}

export interface Copia {
  formato: "lucia-copia";
  versao: 1;
  feita: string;
  dados: Record<string, string>;
}

export function montarCopia(armazenamento: Pick<Storage, "length" | "key" | "getItem">, agora = new Date()): Copia {
  const dados: Record<string, string> = {};
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (!chave || !entraNaCopia(chave)) continue;
    const valor = armazenamento.getItem(chave);
    if (valor !== null) dados[chave] = valor;
  }
  return { formato: "lucia-copia", versao: 1, feita: agora.toISOString(), dados };
}

/** Confere uma cópia lida de arquivo: só o formato certo, só chaves permitidas, só texto. Devolve null se não for cópia. */
export function lerCopia(texto: string): Copia | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!bruto || typeof bruto !== "object") return null;
  const c = bruto as Partial<Copia>;
  if (c.formato !== "lucia-copia" || c.versao !== 1 || !c.dados || typeof c.dados !== "object") return null;
  const dados: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(c.dados)) if (entraNaCopia(chave) && typeof valor === "string" && valor.length < 5_000_000) dados[chave] = valor;
  return { formato: "lucia-copia", versao: 1, feita: typeof c.feita === "string" ? c.feita : "", dados };
}

/** Junta listas por id: o que já está aqui fica, o que vem da cópia entra; no mesmo id, vence o mais recente. */
function juntarListas(atual: string | null, vindo: string): string {
  try {
    const a: unknown = JSON.parse(atual ?? "[]");
    const b: unknown = JSON.parse(vindo);
    if (!Array.isArray(a) || !Array.isArray(b)) return vindo;
    const porId = new Map<string, Record<string, unknown>>();
    const data = (x: Record<string, unknown>) => Number(x.atualizado ?? x.quando ?? x.criado ?? 0);
    for (const x of [...a, ...b]) {
      if (!x || typeof x !== "object" || typeof (x as { id?: unknown }).id !== "string") continue;
      const item = x as Record<string, unknown>;
      const ja = porId.get(item.id as string);
      if (!ja || data(item) >= data(ja)) porId.set(item.id as string, item);
    }
    return JSON.stringify([...porId.values()]);
  } catch {
    return vindo;
  }
}

/** Junta objetos por chave: o que só existe de um lado fica; no mesmo item, vence o mais recente ("quando" ou o número). */
function juntarRegistros(atual: string | null, vindo: string): string {
  try {
    const a: unknown = JSON.parse(atual ?? "{}");
    const b: unknown = JSON.parse(vindo);
    const ok = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);
    if (!ok(a) || !ok(b)) return vindo;
    const data = (x: unknown) => (typeof x === "number" ? x : ok(x) ? Number(x.quando ?? 0) : 0);
    const saida: Record<string, unknown> = { ...a };
    for (const [id, item] of Object.entries(b)) if (!(id in saida) || data(item) >= data(saida[id])) saida[id] = item;
    return JSON.stringify(saida);
  } catch {
    return vindo;
  }
}

/** Restaura a cópia: listas com id (cadernos, cartões, erros) e registros por item se juntam; o resto é trocado. Devolve quantas chaves mudaram. */
export function restaurarCopia(copia: Copia, armazenamento: Pick<Storage, "getItem" | "setItem">): number {
  let n = 0;
  for (const [chave, valor] of Object.entries(copia.dados)) {
    const final = ["lucia:caderno", "lucia:revisao", "lucia:erros"].includes(chave)
      ? juntarListas(armazenamento.getItem(chave), valor)
      : REGISTROS.includes(chave)
        ? juntarRegistros(armazenamento.getItem(chave), valor)
        : valor;
    try {
      armazenamento.setItem(chave, final);
      n++;
    } catch {
      // sem espaço: segue com as outras
    }
  }
  return n;
}
