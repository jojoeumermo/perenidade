// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do compositor da onda 12 (12A): fio montado de uma vez, carrossel e colagem com legenda e o fuso no agendar.
// Sem estado e sem navegador, para os testes (scripts/testar-alumia-o12-compositor.mjs) rodarem no Node. Sem "@/" de propósito.
// O banco confere tudo de novo (supabase/migracoes/20261118-alumia-o12-compositor.sql).

// ───── Limites ─────

/** Um fio sai de uma vez com até 10 blocos (o primeiro abre a conversa; os outros continuam). */
export const LIMITE_DE_BLOCOS = 10;
/** Cada bloco é um post: até 500 letras. */
export const LIMITE_DO_BLOCO = 500;
/** Até 10 imagens por post (eram 4). */
export const LIMITE_DE_IMAGENS = 10;
/** A legenda de cada imagem (aparece para todo mundo, embaixo dela). */
export const LIMITE_DA_LEGENDA = 280;

// ───── Fio ─────

/** Os blocos que vão: sem espaço sobrando nas pontas e sem os vazios do fim (um vazio no meio impede publicar). */
export function blocosDoFio(blocos: readonly string[]): string[] {
  const limpos = blocos.map((b) => b.trim());
  while (limpos.length && !limpos[limpos.length - 1]) limpos.pop();
  return limpos;
}

/** O fio está pronto? De 2 a 10 blocos, nenhum vazio, nenhum passando de 500 letras. */
export function fioPronto(blocos: readonly string[]): boolean {
  const b = blocosDoFio(blocos);
  return b.length >= 2 && b.length <= LIMITE_DE_BLOCOS && b.every((x) => x.length >= 1 && x.length <= LIMITE_DO_BLOCO);
}

/**
 * Corta um texto comprido em blocos de até `max` letras para o fio: primeiro nos parágrafos, depois no fim das frases, depois nos
 * espaços; uma palavra maior que o bloco é partida. Nunca passa de `limite` blocos (o que sobra fica no último, que a pessoa vê
 * passando do tamanho e corta). Puro: a tela mostra o resultado e a pessoa mexe antes de publicar.
 */
export function dividirEmBlocos(texto: string, max = LIMITE_DO_BLOCO, limite = LIMITE_DE_BLOCOS): string[] {
  const limpo = texto.replace(/\r\n/g, "\n").trim();
  if (!limpo) return [];
  if (limpo.length <= max) return [limpo];
  const pedacos: string[] = [];
  for (const paragrafo of limpo.split(/\n{2,}/)) {
    if (paragrafo.length <= max) {
      pedacos.push(paragrafo);
      continue;
    }
    for (const frase of paragrafo.match(/[^.!?…]+[.!?…]+["'”»)]*\s*|[^.!?…]+$/g) ?? [paragrafo]) {
      if (frase.length <= max) {
        pedacos.push(frase);
        continue;
      }
      let resto = frase;
      while (resto.length > max) {
        const corte = resto.lastIndexOf(" ", max);
        const ponto = corte > max / 2 ? corte : max;
        pedacos.push(resto.slice(0, ponto));
        resto = resto.slice(ponto).trimStart();
      }
      if (resto) pedacos.push(resto);
    }
  }
  // Junta os pedaços em blocos cheios, sem passar do máximo.
  const blocos: string[] = [];
  let atual = "";
  for (const p of pedacos.map((x) => x.trim()).filter(Boolean)) {
    const junto = atual ? `${atual} ${p}` : p;
    if (junto.length <= max) atual = junto;
    else {
      if (atual) blocos.push(atual);
      atual = p;
    }
  }
  if (atual) blocos.push(atual);
  if (blocos.length <= limite) return blocos;
  return [...blocos.slice(0, limite - 1), blocos.slice(limite - 1).join(" ")];
}

// ───── Carrossel e colagem ─────

export const ARRANJOS = ["grade", "carrossel", "colagem"] as const;
export type Arranjo = (typeof ARRANJOS)[number];

export function eArranjo(x: unknown): x is Arranjo {
  return typeof x === "string" && (ARRANJOS as readonly string[]).includes(x);
}

/** O arranjo que vale: com menos de 2 imagens é sempre a grade de sempre (o banco faz igual). */
export function arranjoQueVale(escolhido: Arranjo | null | undefined, imagens: number): Arranjo {
  return imagens >= 2 && escolhido ? escolhido : "grade";
}

/** Um ladrilho da colagem numa grade de 6 colunas: quantas colunas e quantas linhas ele ocupa. */
export interface Ladrilho {
  colunas: 2 | 3 | 4 | 6;
  linhas: 1 | 2;
}

/**
 * Os ladrilhos da colagem, em grupos que fecham as 6 colunas: três (um grande de 4×2 e dois de 2×1 ao lado), dois (3×1 cada) ou um
 * (6×2). Sempre o mesmo desenho para o mesmo número de imagens (quem lê vê o que quem escreveu viu).
 */
export function ladrilhosDaColagem(n: number): Ladrilho[] {
  const saida: Ladrilho[] = [];
  let resta = Math.max(0, Math.min(LIMITE_DE_IMAGENS, Math.floor(n)));
  while (resta > 0) {
    if (resta === 1) {
      saida.push({ colunas: 6, linhas: 2 });
      resta -= 1;
    } else if (resta === 2 || resta === 4) {
      saida.push({ colunas: 3, linhas: 1 }, { colunas: 3, linhas: 1 });
      resta -= 2;
    } else {
      saida.push({ colunas: 4, linhas: 2 }, { colunas: 2, linhas: 1 }, { colunas: 2, linhas: 1 });
      resta -= 3;
    }
  }
  return saida;
}

/** A próxima imagem do carrossel (as setas e o teclado): dá a volta nas pontas? Não: para na primeira e na última. */
export function passoDoCarrossel(atual: number, total: number, passo: -1 | 1): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, atual + passo));
}

// ───── Fuso no agendar ─────

/** Os fusos do Brasil, de leste a oeste (a pessoa escolhe; nunca é deduzido do endereço de rede). */
export const FUSOS_DO_BRASIL = [
  "America/Noronha",
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Belem",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
] as const;

/** O fuso existe para o navegador (e para o Postgres, que confere de novo em pg_timezone_names)? */
export function fusoValido(fuso: string | null | undefined): fuso is string {
  if (!fuso || fuso.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(fuso)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/** O fuso do relógio do aparelho (o que a pessoa configurou nele): só o ponto de partida da escolha, que ela troca. */
export function fusoDoAparelho(): string {
  try {
    const f = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return fusoValido(f) ? f : "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

/** Todos os fusos que o navegador conhece (para "outro fuso"); sem a lista, os do Brasil. */
export function todosOsFusos(): string[] {
  try {
    const lista = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (Array.isArray(lista) && lista.length) return lista;
  } catch {
    // navegador antigo: fica a lista do Brasil
  }
  return [...FUSOS_DO_BRASIL];
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

/** O relógio de parede de um instante num fuso, em milissegundos "como se fosse UTC". */
function paredeEm(fuso: string, ms: number): number {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? "0");
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"));
}

/**
 * O instante de "dia e hora" (como a pessoa escreveu, '2026-11-20T18:30') no fuso escolhido. Nulo se algo não fecha. Na hora que
 * não existe (o relógio pulou), fica a hora depois do pulo; o banco converte de novo com a regra dele e é o que vale.
 */
export function instanteNoFuso(local: string, fuso: string): Date | null {
  const m = LOCAL.exec(local);
  if (!m || !fusoValido(fuso)) return null;
  const [, a, me, d, h, mi] = m.map(Number);
  if (me < 1 || me > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const parede = Date.UTC(a, me - 1, d, h, mi);
  let palpite = parede - (paredeEm(fuso, parede) - parede);
  const ajuste = paredeEm(fuso, palpite) - parede;
  if (ajuste !== 0) palpite -= ajuste;
  return Number.isFinite(palpite) ? new Date(palpite) : null;
}

/** O dia e a hora de agora num fuso, no formato do campo ('2026-11-20T18:30'): para o mínimo e o máximo da escolha. */
export function paredeDeAgora(fuso: string, agora: number, somarMs = 0): string {
  const ms = paredeEm(fusoValido(fuso) ? fuso : "UTC", agora + somarMs);
  return new Date(ms).toISOString().slice(0, 16);
}

/** De 5 minutos a 30 dias a partir de agora (a regra do banco, rede_pub_agendar). */
export function agendaCabe(local: string, fuso: string, agora: number): boolean {
  const t = instanteNoFuso(local, fuso)?.getTime();
  return typeof t === "number" && t >= agora + 5 * 60_000 && t <= agora + 30 * 86_400_000;
}

/** "GMT-3", "GMT+5:30": a diferença do fuso naquele instante, como o idioma escreve. */
export function diferencaDoFuso(fuso: string, instante: number, lang: string): string {
  try {
    const p = new Intl.DateTimeFormat(lang, { timeZone: fuso, timeZoneName: "shortOffset" }).formatToParts(new Date(instante));
    return p.find((x) => x.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** O nome de um fuso para a lista: a cidade do nome (sem o continente, com espaço no lugar de "_"). */
export function cidadeDoFuso(fuso: string): string {
  const fim = fuso.split("/").pop() ?? fuso;
  return fim.replace(/_/g, " ");
}

/** Um instante escrito no fuso escolhido, com a diferença ("20/11/2026 18:30 (GMT-4)"). */
export function quandoNoFuso(iso: string, fuso: string | null | undefined, lang: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const f = fuso && fusoValido(fuso) ? fuso : undefined;
  let texto: string;
  try {
    texto = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short", ...(f ? { timeZone: f } : {}) }).format(t);
  } catch {
    texto = new Intl.DateTimeFormat("pt", { dateStyle: "short", timeStyle: "short", ...(f ? { timeZone: f } : {}) }).format(t);
  }
  const dif = f ? diferencaDoFuso(f, t.getTime(), lang) : "";
  return dif ? `${texto} (${dif})` : texto;
}
