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
  /** Quantas vezes a pessoa já errou esta questão (o erro que se repete sobe na fila de refazer). */
  vezes?: number;
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

export function registrarErro(q: Omit<Erro, "id" | "quando" | "seguidos" | "vezes"> & { id?: string }) {
  const id = q.id ?? idDaQuestao(q.pergunta, q.opcoes);
  const antes = lerErros().find((e) => e.id === id);
  const lista = lerErros().filter((e) => e.id !== id);
  lista.unshift({ ...q, id, quando: Date.now(), seguidos: 0, vezes: (antes?.vezes ?? 1) + (antes ? 1 : 0) });
  gravar(CHAVE_ERROS, lista.slice(0, MAX_ERROS));
}

/** Ao refazer: acerto conta (dois seguidos tiram da lista); erro zera a conta. Devolve se a questão saiu. */
export function refazerErro(id: string, acertou: boolean, escolhida: number): boolean {
  const lista = lerErros();
  const e = lista.find((x) => x.id === id);
  if (!e) return false;
  if (acertou) e.seguidos += 1;
  else Object.assign(e, { seguidos: 0, escolhida, quando: Date.now(), vezes: (e.vezes ?? 1) + 1 });
  const saiu = e.seguidos >= 2;
  gravar(CHAVE_ERROS, saiu ? lista.filter((x) => x.id !== id) : lista);
  return saiu;
}

/**
 * A fila para refazer os erros: primeiro os que mais se repetem; entre os empatados, a ordem sorteada.
 * Com `desde`, só os erros feitos (ou repetidos) a partir dessa hora: é o "revisar os erros da semana".
 */
export function filaDeErros(erros: Erro[], desde?: number, sorteio: () => number = Math.random): string[] {
  return erros
    .filter((e) => desde === undefined || e.quando >= desde)
    .map((e) => ({ e, s: sorteio() }))
    .sort((a, b) => (b.e.vezes ?? 1) - (a.e.vezes ?? 1) || a.s - b.s)
    .map(({ e }) => e.id);
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

/**
 * A revisão que mistura matérias (Etapa 4, E4-13, R1-32; docs/escola/avaliacao.md): um rodízio determinístico por
 * trilha. Agrupa os itens pela trilha (`grupoDe`; o padrão é o campo `trilha` e, sem ele, a `origem` do cartão, que é a
 * aula ou a fonte de onde ele veio) e pega um de cada grupo por vez, mantendo dentro de cada grupo a ordem de vencimento
 * (`proxima`, quando existe; empate fica na ordem recebida). Os grupos entram na ordem do primeiro item de cada um.
 * `depoisDe`: o grupo do último item mostrado; o rodízio começa no grupo seguinte (a tela que recalcula a fila a cada
 * resposta não volta à mesma matéria). Não tira nem acrescenta item: o conjunto é o mesmo que entrou.
 */
export function intercalar<T>(itens: readonly T[], grupoDe: (item: T) => string = grupoPadrao, depoisDe?: string): T[] {
  const vence = (x: T) => {
    const p = (x as { proxima?: unknown }).proxima;
    return typeof p === "string" ? p : "";
  };
  const ordenados = itens.map((item, i) => ({ item, i })).sort((a, b) => vence(a.item).localeCompare(vence(b.item)) || a.i - b.i);
  const grupos = new Map<string, T[]>();
  for (const { item } of ordenados) {
    const g = grupoDe(item);
    grupos.set(g, [...(grupos.get(g) ?? []), item]);
  }
  const filas = [...grupos.entries()];
  const ultimo = depoisDe === undefined ? -1 : filas.findIndex(([g]) => g === depoisDe);
  if (ultimo >= 0) filas.push(...filas.splice(0, ultimo + 1));
  const saida: T[] = [];
  for (let rodada = 0; saida.length < ordenados.length; rodada++) for (const [, fila] of filas) if (rodada < fila.length) saida.push(fila[rodada]);
  return saida;
}
function grupoPadrao(item: unknown): string {
  const x = item as { trilha?: unknown; origem?: unknown };
  return typeof x.trilha === "string" ? x.trilha : typeof x.origem === "string" ? x.origem : "";
}

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
  // O progresso entre partidas do jogo Rumos (lib/rumos.ts): quantas partidas e que desfechos já se viu em cada baralho.
  "lucia:jogos",
  // A voz escolhida no "Ouvir a aula" e a velocidade (lib/vozes/catalogo.ts). Os arquivos da voz baixada não entram na
  // cópia (são grandes e vêm do site); o "apagar" de Meus dados apaga os dois.
  "lucia:voz",
  // Vídeos curtos (components/videos/Tocador.tsx): onde a pessoa parou em cada vídeo e a velocidade escolhida.
  "lucia:video-curto",
  // Etapa 4 (lib/escola/, docs/ESCOLA.md): onde a pessoa parou dentro da aula e duas preferências de leitura da aula
  // (em partes, com uma mão). As chaves da Escola em si entram pelo prefixo "lucia:escola:" logo abaixo.
  "lucia:posicao-da-aula",
  "lucia:aula-em-partes",
  "lucia:uma-mao",
  // Etapa 3 (catálogo honesto): as trilhas em que a pessoa pediu "me avise quando sair" e quantas aulas havia (lib/avise.ts).
  "lucia:avise",
]);
/** Chaves que guardam um objeto por item (aula ou exercício): na restauração, cada item fica com a versão mais nova. */
const REGISTROS = ["lucia:testes", "lucia:exercicios", "lucia:concluidas-em", "lucia:nivelamento", "lucia:ajudou"];
// "lucia:escola:" é o estudo da Escola Lúcia Maria (matrícula, cursos, caderneta...). O irmão "lucia:escola-privado:"
// fica de fora de propósito: conversas e documentos de trabalho não viajam num arquivo de cópia (veja SO_APAGAR).
// "lucia:agir:<trilha>/<aula>" é o "Agir" da aula e o "como foi?" da aula seguinte (lib/agir.ts): só no aparelho.
// "lucia:bloco:" são as respostas escritas nos blocos da aula (components/aula/Blocos.tsx: Na sua realidade, O outro
// lado, Realidade): antes ficavam fora da cópia e do "apagar"; a página de privacidade promete que tudo sai.
// "lucia:ferramenta:" são os campos das ferramentas da vida real (components/tools/novas/VidaReal.tsx).
const PREFIXOS_DA_COPIA = ["lucia:lab:", "lucia:ouvido:", "lucia:escola:", "lucia:agir:", "lucia:bloco:", "lucia:ferramenta:"];
export const entraNaCopia = (chave: string) => CHAVES_DA_COPIA.has(chave) || PREFIXOS_DA_COPIA.some((p) => chave.startsWith(p) && !/[\s]/.test(chave) && chave.length < 200);

/**
 * Chaves que NÃO entram na cópia de segurança (são pessoais demais ou só servem neste aparelho), mas que o "apagar meus
 * dados" precisa apagar, porque a página de privacidade promete que tudo sai: o histórico do que a pessoa abriu, onde o
 * rádio parou, o convite do modo pacote e as marcas de "já somei o +1 anônimo" do "Isso ajudou?".
 */
export const SO_APAGAR: readonly string[] = ["lucia:historico", "lucia:historico-ligado", "lucia:radio-retomar", "lucia:modo-pacote-convite"];
/** Prefixos que ficam fora da cópia e saem no "apagar": o privado da Escola e as marcas do "Isso ajudou?". */
export const PREFIXOS_SO_APAGAR: readonly string[] = ["lucia:escola-privado:", "lucia:ajudou-contou:"];
const soApagar = (chave: string) => SO_APAGAR.includes(chave) || PREFIXOS_SO_APAGAR.some((p) => chave.startsWith(p));

/** As chaves "só apagar" que existem neste armazenamento. */
export function chavesSoApagar(armazenamento: Pick<Storage, "length" | "key">): string[] {
  const chaves: string[] = [];
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (chave && soApagar(chave) && !entraNaCopia(chave)) chaves.push(chave);
  }
  return chaves;
}

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
    const data = (x: Record<string, unknown>) => {
      const n = Number(x.atualizado ?? x.quando ?? x.criado ?? 0);
      if (n) return n;
      const d = typeof x.data === "string" ? Date.parse(x.data) : 0; // registros da caderneta (E4-14) têm "data" AAAA-MM-DD
      return Number.isFinite(d) ? d : 0;
    };
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

/**
 * Junta o projeto final (E4-14): {versao, cursos: {[slug]: {tema?, etapas, notas?, gaveta?}}}. Junta por curso: curso que só
 * existe de um lado fica; nos dois lados, as etapas se juntam (no mesmo passo vence a data mais recente) e tema e notas vêm do
 * lado com a data mais recente, completados pelo outro quando faltam. Nada local se perde.
 */
function juntarProjeto(atual: string | null, vindo: string): string {
  try {
    const a: unknown = JSON.parse(atual ?? "{}");
    const b: unknown = JSON.parse(vindo);
    const ok = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);
    if (!ok(b) || !ok(b.cursos)) return vindo;
    if (!ok(a) || !ok(a.cursos)) return vindo;
    const dia = (s: unknown) => (typeof s === "string" && Number.isFinite(Date.parse(s)) ? Date.parse(s) : 0);
    const recente = (c: Record<string, unknown>) => Math.max(dia(c.gaveta), ...Object.values(ok(c.etapas) ? c.etapas : {}).map(dia));
    const cursos: Record<string, unknown> = { ...a.cursos };
    for (const [slug, novo] of Object.entries(b.cursos)) {
      const velho = cursos[slug];
      if (!ok(velho) || !ok(novo)) {
        if (!(slug in cursos)) cursos[slug] = novo;
        continue;
      }
      const [ganha, perde] = recente(novo) > recente(velho) ? [novo, velho] : [velho, novo];
      const etapas: Record<string, unknown> = { ...(ok(perde.etapas) ? perde.etapas : {}) };
      for (const [e, d] of Object.entries(ok(ganha.etapas) ? ganha.etapas : {})) if (!(e in etapas) || dia(d) >= dia(etapas[e])) etapas[e] = d;
      cursos[slug] = { ...perde, ...ganha, etapas, ...(ganha.gaveta || perde.gaveta ? { gaveta: dia(ganha.gaveta) >= dia(perde.gaveta) ? ganha.gaveta ?? perde.gaveta : perde.gaveta } : {}) };
    }
    const versao = Math.max(Number(a.versao) || 1, Number(b.versao) || 1);
    return JSON.stringify({ ...a, ...b, versao, cursos });
  } catch {
    return vindo;
  }
}

/** Restaura a cópia: listas com id (cadernos, cartões, erros, caderneta) e registros por item se juntam, o projeto final se junta por curso; o resto é trocado. Devolve quantas chaves mudaram. */
export function restaurarCopia(copia: Copia, armazenamento: Pick<Storage, "getItem" | "setItem">): number {
  let n = 0;
  for (const [chave, valor] of Object.entries(copia.dados)) {
    const final = ["lucia:caderno", "lucia:revisao", "lucia:erros", "lucia:escola:caderneta"].includes(chave)
      ? juntarListas(armazenamento.getItem(chave), valor)
      : chave === "lucia:escola:projeto"
        ? juntarProjeto(armazenamento.getItem(chave), valor)
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
