// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Rumos, o jogo de decisões dos laboratórios: o formato dos baralhos (content/jogos/rumos-*.json), o validador que o
// build e `npm run testar:jogos` rodam, o motor da partida e o progresso guardado só neste aparelho. Sem os atalhos
// "@/" de propósito: o teste roda este arquivo direto no Node.
//
// A mecânica: uma carta por vez, duas saídas (esquerda e direita). Cada saída mexe com quatro medidores, que precisam
// ficar em equilíbrio: chegar a 0 ou a 100 em qualquer um encerra a partida, com um desfecho próprio. As escolhas
// ligam e desligam marcas (flags), que abrem ou fecham cartas e decidem o desfecho de quem chega ao fim. Uma carta
// pode puxar a próxima (encadeamento), e algumas só aparecem a partir da segunda partida no mesmo baralho.

export type Lado = "esquerda" | "direita";
export type Area = "historia" | "geografia" | "filosofia" | "sociologia";
export const AREAS: Area[] = ["historia", "geografia", "filosofia", "sociologia"];

export interface Fonte {
  titulo: string;
  autor: string;
  ano?: string;
  url?: string;
}
export interface Medidor {
  id: string;
  nome: string;
  /** O que o medidor mede, numa frase (lida pelo leitor de tela e mostrada na abertura). */
  descricao: string;
}
export interface Condicao {
  /** Todas estas marcas precisam estar ligadas. */
  flags?: string[];
  /** Nenhuma destas pode estar ligada. */
  semFlags?: string[];
  medidores?: Record<string, { min?: number; max?: number }>;
  /** Mínimo de partidas já terminadas neste baralho (a história vai se abrindo a cada partida). */
  partidas?: number;
}
export interface Escolha {
  texto: string;
  efeito: Record<string, number>;
  /** O que a escolha ensina: aparece logo depois de escolher. */
  retorno: string;
  liga?: string[];
  desliga?: string[];
  /** Carta que vem logo em seguida, se a condição dela permitir. */
  proxima?: string;
}
export interface Nota {
  texto: string;
  fonte: Fonte;
}
export interface Aula {
  titulo: string;
  href: string;
}
export interface Carta {
  id: string;
  titulo: string;
  personagem: string;
  fase?: string;
  area?: Area;
  texto: string;
  condicao?: Condicao;
  /** Só aparece puxada por outra carta. */
  soEncadeada?: boolean;
  peso?: number;
  esquerda: Escolha;
  direita: Escolha;
  /** Na história real: o fato conferido por trás da carta, com a fonte. */
  historia: Nota;
  /** Para estudar: a aula do site que sustenta a carta. */
  aula: Aula;
}
export interface Final {
  id: string;
  /** "queda": um medidor chegou a 0 ou a 100. "chegada": a partida chegou ao fim. */
  tipo: "queda" | "chegada";
  medidor?: string;
  limite?: "zero" | "cem";
  condicao?: Condicao;
  titulo: string;
  texto: string;
  historia?: Nota;
  aula?: Aula;
}
export interface Personagem {
  id: string;
  nome: string;
  papel: string;
}
export interface Fase {
  id: string;
  nome: string;
  /** Quantas cartas desta fase entram em cada partida. */
  cartas: number;
}
export interface Baralho {
  formato: "rumos/1";
  id: string;
  titulo: string;
  resumo: string;
  /** Quem a pessoa é no jogo, em uma ou duas frases. */
  papel: string;
  sobre: string;
  /** "fases": as cartas seguem a ordem das fases. "sorteio": cartas soltas, sorteadas (revisão). */
  modo: "fases" | "sorteio";
  medidores: Medidor[];
  inicio: Record<string, number>;
  personagens: Personagem[];
  fases?: Fase[];
  /** No modo sorteio: quantas cartas tem a partida. */
  duracao?: number;
  cartas: Carta[];
  finais: Final[];
}

// ───────────── Validador ─────────────

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AULA = /^\/trilhas\/[a-z0-9-]+\/[a-z0-9-]+$/;
const texto = (v: unknown, min = 1, max = 2000) => typeof v === "string" && v.trim().length >= min && v.length <= max && v.trim() === v;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Confere um baralho inteiro. Devolve a lista de problemas (vazia quando está tudo certo). `aulaExiste` confere, quando
 * dado, se o endereço de cada aula aponta para um arquivo de content/trilhas.
 */
export function validarBaralho(dados: unknown, opcoes: { aulaExiste?: (href: string) => boolean } = {}): string[] {
  const erros: string[] = [];
  const b = obj(dados);
  const onde = typeof b.id === "string" ? b.id : "(sem id)";
  const erro = (msg: string) => erros.push(`${onde}: ${msg}`);

  if (b.formato !== "rumos/1") erro('formato precisa ser "rumos/1"');
  if (typeof b.id !== "string" || !SLUG.test(b.id)) erro("id precisa ser um slug (letras minúsculas, números e hífens)");
  for (const campo of ["titulo", "resumo", "papel", "sobre"]) if (!texto(b[campo], 3)) erro(`"${campo}" vazio ou com espaço sobrando`);
  if (b.modo !== "fases" && b.modo !== "sorteio") erro('modo precisa ser "fases" ou "sorteio"');
  if (/reigns/i.test(JSON.stringify(dados))) erro("o baralho não cita outro jogo: a mecânica é inspirada, o texto é todo original");

  // Medidores
  const medidores = lista(b.medidores).map(obj);
  const ids = new Set<string>();
  if (medidores.length !== 4) erro("são exatamente 4 medidores");
  for (const m of medidores) {
    if (typeof m.id !== "string" || !SLUG.test(m.id)) erro(`medidor com id inválido: ${String(m.id)}`);
    else if (ids.has(m.id)) erro(`medidor repetido: ${m.id}`);
    else ids.add(m.id);
    if (!texto(m.nome, 2, 24)) erro(`medidor ${String(m.id)}: nome de 2 a 24 letras`);
    if (!texto(m.descricao, 10, 200)) erro(`medidor ${String(m.id)}: descrição de 10 a 200 letras`);
  }
  const inicio = obj(b.inicio);
  for (const id of ids) {
    const v = inicio[id];
    if (!Number.isInteger(v) || (v as number) < 10 || (v as number) > 90) erro(`inicio.${id} precisa ser um inteiro de 10 a 90`);
  }
  for (const id of Object.keys(inicio)) if (!ids.has(id)) erro(`inicio.${id} não é medidor`);

  // Personagens e fases
  const personagens = new Set<string>();
  for (const p of lista(b.personagens).map(obj)) {
    if (typeof p.id !== "string" || !SLUG.test(p.id) || personagens.has(p.id)) erro(`personagem com id inválido ou repetido: ${String(p.id)}`);
    else personagens.add(p.id);
    if (!texto(p.nome, 2, 40) || !texto(p.papel, 3, 120)) erro(`personagem ${String(p.id)}: nome e papel`);
  }
  if (personagens.size === 0) erro("ao menos um personagem");
  const fases = new Map<string, number>();
  if (b.modo === "fases") {
    for (const f of lista(b.fases).map(obj)) {
      if (typeof f.id !== "string" || !SLUG.test(f.id) || fases.has(f.id)) erro(`fase com id inválido ou repetido: ${String(f.id)}`);
      else fases.set(f.id, Number(f.cartas));
      if (!texto(f.nome, 3, 80)) erro(`fase ${String(f.id)}: nome`);
      if (!Number.isInteger(f.cartas) || (f.cartas as number) < 1) erro(`fase ${String(f.id)}: "cartas" precisa ser um inteiro maior que zero`);
    }
    if (fases.size === 0) erro("o modo fases precisa de ao menos uma fase");
  } else if (!Number.isInteger(b.duracao) || (b.duracao as number) < 4) erro('o modo sorteio precisa de "duracao" (inteiro, 4 ou mais)');

  // Cartas
  const cartas = lista(b.cartas).map(obj);
  if (cartas.length < 12) erro("ao menos 12 cartas");
  const idsDeCartas = new Set<string>();
  for (const c of cartas) {
    if (typeof c.id !== "string" || !SLUG.test(c.id)) erro(`carta com id inválido: ${String(c.id)}`);
    else if (idsDeCartas.has(c.id)) erro(`carta repetida: ${c.id}`);
    else idsDeCartas.add(c.id);
  }
  const flagsLigadas = new Set<string>();
  const flagsLidas = new Set<string>();
  const puxadas = new Set<string>();
  const conferirCondicao = (cond: unknown, ondeC: string) => {
    if (cond === undefined) return;
    const k = obj(cond);
    for (const chave of Object.keys(k)) if (!["flags", "semFlags", "medidores", "partidas"].includes(chave)) erro(`${ondeC}: condição com campo desconhecido "${chave}"`);
    for (const f of [...lista(k.flags), ...lista(k.semFlags)]) {
      if (typeof f !== "string" || !SLUG.test(f)) erro(`${ondeC}: marca inválida ${String(f)}`);
      else flagsLidas.add(f);
    }
    for (const [m, faixa] of Object.entries(obj(k.medidores))) {
      if (!ids.has(m)) erro(`${ondeC}: condição em medidor que não existe (${m})`);
      const { min, max } = obj(faixa);
      if ((min !== undefined && !Number.isInteger(min)) || (max !== undefined && !Number.isInteger(max))) erro(`${ondeC}: faixa do medidor ${m} com número inválido`);
    }
    if (k.partidas !== undefined && (!Number.isInteger(k.partidas) || (k.partidas as number) < 0)) erro(`${ondeC}: "partidas" precisa ser inteiro`);
  };
  const conferirNota = (n: unknown, ondeN: string) => {
    const nota = obj(n);
    if (!texto(nota.texto, 30, 600)) erro(`${ondeN}: "historia.texto" de 30 a 600 letras`);
    const fonte = obj(nota.fonte);
    if (!texto(fonte.titulo, 3) || !texto(fonte.autor, 2)) erro(`${ondeN}: a fonte precisa de título e autor`);
    if (fonte.url !== undefined && (typeof fonte.url !== "string" || !/^https:\/\/[^\s]+$/.test(fonte.url))) erro(`${ondeN}: o link da fonte precisa ser https`);
    if (fonte.ano !== undefined && !texto(fonte.ano, 4, 40)) erro(`${ondeN}: ano da fonte`);
  };
  const conferirAula = (a: unknown, ondeA: string) => {
    const aula = obj(a);
    if (!texto(aula.titulo, 3, 120)) erro(`${ondeA}: aula sem título`);
    if (typeof aula.href !== "string" || !AULA.test(aula.href)) erro(`${ondeA}: aula precisa ser /trilhas/<trilha>/<aula>`);
    else if (opcoes.aulaExiste && !opcoes.aulaExiste(aula.href)) erro(`${ondeA}: a aula ${aula.href} não existe`);
  };
  const porFase = new Map<string, number>();
  const porArea = new Map<string, number>();
  for (const c of cartas) {
    const ondeC = `carta ${String(c.id)}`;
    if (!texto(c.titulo, 3, 60)) erro(`${ondeC}: título de 3 a 60 letras`);
    if (typeof c.personagem !== "string" || !personagens.has(c.personagem)) erro(`${ondeC}: personagem desconhecido (${String(c.personagem)})`);
    if (!texto(c.texto, 20, 420)) erro(`${ondeC}: texto de 20 a 420 letras`);
    if (c.peso !== undefined && (typeof c.peso !== "number" || c.peso <= 0 || c.peso > 10)) erro(`${ondeC}: peso de 0 a 10`);
    if (b.modo === "fases") {
      if (typeof c.fase !== "string" || !fases.has(c.fase)) erro(`${ondeC}: fase desconhecida (${String(c.fase)})`);
      else if (!c.soEncadeada && !c.condicao) porFase.set(c.fase, (porFase.get(c.fase) ?? 0) + 1);
    } else {
      if (typeof c.area !== "string" || !AREAS.includes(c.area as Area)) erro(`${ondeC}: no modo sorteio toda carta tem área (${AREAS.join(", ")})`);
      else porArea.set(c.area, (porArea.get(c.area) ?? 0) + 1);
      if (c.condicao || c.soEncadeada) erro(`${ondeC}: no modo sorteio as cartas são soltas (sem condição nem encadeamento)`);
    }
    if (c.area !== undefined && !AREAS.includes(c.area as Area)) erro(`${ondeC}: área desconhecida`);
    conferirCondicao(c.condicao, ondeC);
    const lados = (["esquerda", "direita"] as const).map((lado) => [lado, obj(c[lado])] as const);
    for (const [lado, e] of lados) {
      const ondeE = `${ondeC}, ${lado}`;
      if (!texto(e.texto, 2, 70)) erro(`${ondeE}: texto da escolha de 2 a 70 letras`);
      if (!texto(e.retorno, 20, 400)) erro(`${ondeE}: retorno de 20 a 400 letras`);
      const efeito = obj(e.efeito);
      if (Object.keys(efeito).length === 0) erro(`${ondeE}: a escolha precisa mexer com ao menos um medidor`);
      for (const [m, v] of Object.entries(efeito)) {
        if (!ids.has(m)) erro(`${ondeE}: efeito em medidor que não existe (${m})`);
        if (!Number.isInteger(v) || v === 0 || Math.abs(v as number) > 30) erro(`${ondeE}: efeito ${m} precisa ser inteiro de -30 a 30, sem zero`);
      }
      for (const f of [...lista(e.liga), ...lista(e.desliga)]) if (typeof f !== "string" || !SLUG.test(f)) erro(`${ondeE}: marca inválida ${String(f)}`);
      for (const f of lista(e.liga)) if (typeof f === "string") flagsLigadas.add(f);
      if (e.proxima !== undefined) {
        if (typeof e.proxima !== "string" || !idsDeCartas.has(e.proxima)) erro(`${ondeE}: "proxima" aponta para carta que não existe (${String(e.proxima)})`);
        else if (e.proxima === c.id) erro(`${ondeE}: a carta não pode puxar a si mesma`);
        else puxadas.add(e.proxima);
      }
      if (b.modo === "sorteio" && (e.liga || e.desliga || e.proxima)) erro(`${ondeE}: no modo sorteio as escolhas não ligam marcas nem puxam cartas`);
    }
    if (lados[0][1].texto === lados[1][1].texto) erro(`${ondeC}: as duas escolhas têm o mesmo texto`);
    conferirNota(c.historia, ondeC);
    conferirAula(c.aula, ondeC);
  }
  for (const c of cartas) if (c.soEncadeada && typeof c.id === "string" && !puxadas.has(c.id)) erro(`carta ${c.id}: só aparece encadeada, mas nenhuma escolha puxa ela`);
  for (const [fase, n] of fases) if ((porFase.get(fase) ?? 0) < n) erro(`fase ${fase}: pede ${n} cartas por partida, mas só tem ${porFase.get(fase) ?? 0} sem condição`);
  if (b.modo === "sorteio") for (const area of AREAS) if ((porArea.get(area) ?? 0) < 4) erro(`área ${area}: ao menos 4 cartas no sorteio`);

  // Finais
  const finais = lista(b.finais).map(obj);
  const idsDeFinais = new Set<string>();
  const quedas = new Set<string>();
  let chegadaLivre = false;
  for (const f of finais) {
    const ondeF = `final ${String(f.id)}`;
    if (typeof f.id !== "string" || !SLUG.test(f.id) || idsDeFinais.has(f.id)) erro(`${ondeF}: id inválido ou repetido`);
    else idsDeFinais.add(f.id);
    if (!texto(f.titulo, 3, 80) || !texto(f.texto, 20, 600)) erro(`${ondeF}: título e texto`);
    if (f.historia !== undefined) conferirNota(f.historia, ondeF);
    if (f.aula !== undefined) conferirAula(f.aula, ondeF);
    if (f.tipo === "queda") {
      if (typeof f.medidor !== "string" || !ids.has(f.medidor) || (f.limite !== "zero" && f.limite !== "cem")) erro(`${ondeF}: queda precisa de medidor e limite ("zero" ou "cem")`);
      else if (quedas.has(`${f.medidor}:${f.limite}`)) erro(`${ondeF}: queda repetida para ${f.medidor} em ${f.limite}`);
      else quedas.add(`${f.medidor}:${f.limite}`);
      if (f.condicao) erro(`${ondeF}: queda não tem condição`);
    } else if (f.tipo === "chegada") {
      conferirCondicao(f.condicao, ondeF);
      if (!f.condicao) chegadaLivre = true;
    } else erro(`${ondeF}: tipo precisa ser "queda" ou "chegada"`);
  }
  for (const id of ids) for (const limite of ["zero", "cem"]) if (!quedas.has(`${id}:${limite}`)) erro(`falta o desfecho de ${id} chegando a ${limite === "zero" ? "0" : "100"}`);
  if (!chegadaLivre) erro("falta um desfecho de chegada sem condição (o que vale quando nenhum outro vale)");
  const ultimaChegada = [...finais].reverse().find((f) => f.tipo === "chegada");
  if (ultimaChegada && ultimaChegada.condicao) erro("o último desfecho de chegada precisa ser o sem condição");

  for (const f of flagsLidas) if (!flagsLigadas.has(f)) erro(`a marca "${f}" é lida, mas nenhuma escolha liga`);
  for (const f of flagsLigadas) if (!flagsLidas.has(f)) erro(`a marca "${f}" é ligada, mas nenhuma carta nem desfecho lê`);
  return erros;
}

// ───────────── Motor ─────────────

export interface Jogada {
  carta: string;
  lado: Lado;
  antes: Record<string, number>;
  depois: Record<string, number>;
}
export interface Partida {
  baralho: string;
  semente: number;
  area: Area | null;
  medidores: Record<string, number>;
  flags: string[];
  jogadas: Jogada[];
  /** A carta na mesa (null quando acabou). */
  atual: string | null;
  /** O desfecho, quando a partida acabou. */
  fim: string | null;
}
export interface Progresso {
  partidas: number;
  finais: string[];
}

/** Gerador de números com semente (mulberry32): a mesma semente dá a mesma partida, o que deixa o motor testável. */
export function gerador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const limitar = (n: number) => Math.max(0, Math.min(100, n));

export function condicaoValida(cond: Condicao | undefined, p: Pick<Partida, "flags" | "medidores">, progresso?: Progresso): boolean {
  if (!cond) return true;
  if (cond.flags?.some((f) => !p.flags.includes(f))) return false;
  if (cond.semFlags?.some((f) => p.flags.includes(f))) return false;
  for (const [m, { min, max }] of Object.entries(cond.medidores ?? {})) {
    const v = p.medidores[m] ?? 0;
    if ((min !== undefined && v < min) || (max !== undefined && v > max)) return false;
  }
  if (cond.partidas && (progresso?.partidas ?? 0) < cond.partidas) return false;
  return true;
}

const cartaPorId = (b: Baralho, id: string | null) => (id ? b.cartas.find((c) => c.id === id) : undefined);

/** A fase em que a partida está: a primeira que ainda não deu todas as cartas dela. */
export function faseAtual(b: Baralho, p: Pick<Partida, "jogadas">): Fase | null {
  if (b.modo !== "fases" || !b.fases) return null;
  for (const f of b.fases) {
    const dadas = p.jogadas.filter((j) => cartaPorId(b, j.carta)?.fase === f.id && !cartaPorId(b, j.carta)?.soEncadeada).length;
    if (dadas < f.cartas) return f;
  }
  return null;
}

/** Sorteia a próxima carta entre as que podem aparecer agora (peso maior, mais chance). Null: acabou. */
export function sortearCarta(b: Baralho, p: Omit<Partida, "atual" | "fim">, progresso?: Progresso): string | null {
  const usadas = new Set(p.jogadas.map((j) => j.carta));
  const sorte = gerador(p.semente + p.jogadas.length * 7919);
  let candidatas: Carta[];
  if (b.modo === "sorteio") {
    if (p.jogadas.length >= (b.duracao ?? 0)) return null;
    candidatas = b.cartas.filter((c) => !usadas.has(c.id) && (!p.area || c.area === p.area));
  } else {
    const fase = faseAtual(b, p);
    if (!fase) return null;
    candidatas = b.cartas.filter((c) => c.fase === fase.id && !c.soEncadeada && !usadas.has(c.id) && condicaoValida(c.condicao, p, progresso));
    // Fase sem carta possível (todas fechadas por condição): pula para a próxima.
    if (candidatas.length === 0) {
      const resto = b.fases!.slice(b.fases!.indexOf(fase) + 1);
      candidatas = b.cartas.filter((c) => resto.some((f) => f.id === c.fase) && !c.soEncadeada && !usadas.has(c.id) && condicaoValida(c.condicao, p, progresso));
      const primeira = resto.find((f) => candidatas.some((c) => c.fase === f.id));
      candidatas = candidatas.filter((c) => c.fase === primeira?.id);
    }
  }
  if (candidatas.length === 0) return null;
  const total = candidatas.reduce((s, c) => s + (c.peso ?? 1), 0);
  let r = sorte() * total;
  for (const c of candidatas) {
    r -= c.peso ?? 1;
    if (r < 0) return c.id;
  }
  return candidatas[candidatas.length - 1].id;
}

function desfechoDeChegada(b: Baralho, p: Pick<Partida, "flags" | "medidores">, progresso?: Progresso): string {
  const chegadas = b.finais.filter((f) => f.tipo === "chegada");
  return (chegadas.find((f) => condicaoValida(f.condicao, p, progresso)) ?? chegadas[chegadas.length - 1]).id;
}

export function novaPartida(b: Baralho, opcoes: { semente: number; area?: Area | null; progresso?: Progresso }): Partida {
  const base = { baralho: b.id, semente: opcoes.semente >>> 0, area: opcoes.area ?? null, medidores: { ...b.inicio }, flags: [] as string[], jogadas: [] as Jogada[] };
  const atual = sortearCarta(b, base, opcoes.progresso);
  return { ...base, atual, fim: atual ? null : desfechoDeChegada(b, base, opcoes.progresso) };
}

/** Aplica uma escolha e devolve a partida seguinte (a partida antiga não muda). */
export function escolher(b: Baralho, p: Partida, lado: Lado, progresso?: Progresso): Partida {
  const carta = cartaPorId(b, p.atual);
  if (!carta || p.fim) return p;
  const e = carta[lado];
  const depois = { ...p.medidores };
  for (const [m, v] of Object.entries(e.efeito)) depois[m] = limitar((depois[m] ?? 0) + v);
  const flags = [...new Set([...p.flags.filter((f) => !e.desliga?.includes(f)), ...(e.liga ?? [])])];
  const jogadas = [...p.jogadas, { carta: carta.id, lado, antes: p.medidores, depois }];
  const seguinte = { ...p, medidores: depois, flags, jogadas };
  for (const m of b.medidores) {
    const v = depois[m.id];
    if (v <= 0 || v >= 100) {
      const queda = b.finais.find((f) => f.tipo === "queda" && f.medidor === m.id && f.limite === (v <= 0 ? "zero" : "cem"));
      return { ...seguinte, atual: null, fim: queda?.id ?? desfechoDeChegada(b, seguinte, progresso) };
    }
  }
  const puxada = cartaPorId(b, e.proxima ?? null);
  const usadas = new Set(jogadas.map((j) => j.carta));
  const atual = puxada && !usadas.has(puxada.id) && condicaoValida(puxada.condicao, seguinte, progresso) ? puxada.id : sortearCarta(b, seguinte, progresso);
  return { ...seguinte, atual, fim: atual ? null : desfechoDeChegada(b, seguinte, progresso) };
}

/** Os medidores que uma escolha mexe, sem dizer para que lado (como na mesa: dá para ver o peso, não o rumo). */
export function mexeCom(e: Escolha): { medidor: string; forte: boolean }[] {
  return Object.entries(e.efeito).map(([medidor, v]) => ({ medidor, forte: Math.abs(v) >= 15 }));
}

/** As aulas de uma partida, na ordem em que apareceram, sem repetir. */
export function aulasDaPartida(b: Baralho, p: Pick<Partida, "jogadas" | "fim">): Aula[] {
  const vistas = new Map<string, Aula>();
  for (const j of p.jogadas) {
    const a = cartaPorId(b, j.carta)?.aula;
    if (a && !vistas.has(a.href)) vistas.set(a.href, a);
  }
  const final = b.finais.find((f) => f.id === p.fim)?.aula;
  if (final && !vistas.has(final.href)) vistas.set(final.href, final);
  return [...vistas.values()];
}

// ───────────── Progresso (só neste aparelho) ─────────────

/** A chave do progresso entre partidas: quantas partidas e que desfechos já se viu em cada baralho. Entra na cópia de segurança. */
export const CHAVE_JOGOS = "lucia:jogos";

export function lerProgresso(armazenamento: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Record<string, Progresso> {
  try {
    const bruto: unknown = JSON.parse(armazenamento?.getItem(CHAVE_JOGOS) ?? "{}");
    const saida: Record<string, Progresso> = {};
    for (const [id, v] of Object.entries(obj(bruto))) {
      const x = obj(v);
      saida[id] = { partidas: Number.isInteger(x.partidas) ? (x.partidas as number) : 0, finais: lista(x.finais).filter((f): f is string => typeof f === "string").slice(0, 100) };
    }
    return saida;
  } catch {
    return {};
  }
}

/** Soma uma partida terminada ao progresso do baralho. Devolve o progresso novo. */
export function registrarPartida(p: Pick<Partida, "baralho" | "fim">, armazenamento: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): Record<string, Progresso> {
  const todos = lerProgresso(armazenamento);
  if (!p.fim) return todos;
  const atual = todos[p.baralho] ?? { partidas: 0, finais: [] };
  todos[p.baralho] = { partidas: atual.partidas + 1, finais: atual.finais.includes(p.fim) ? atual.finais : [...atual.finais, p.fim] };
  try {
    armazenamento?.setItem(CHAVE_JOGOS, JSON.stringify(todos));
  } catch {
    // armazenamento cheio ou bloqueado: o jogo segue, só não lembra
  }
  return todos;
}
