// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O plano da semana sem culpa da Escola Revolucionária Lúcia Maria (E4-08, R1-52). Feito NO APARELHO, por regras simples e não por
// inteligência artificial (o "agente do plano" do R1 virou esta regra local): pega as próximas aulas pendentes dos
// cursos em que a pessoa entrou, na ordem de cada curso, pulando as trilhas dispensadas, e distribui dentro do tempo
// que ela disse ter, pelos dias que escolheu. O que não foi feito passa para o próximo dia de estudo, sem a palavra
// "atrasado". Duas semanas sem nada feito: o plano oferece recomeçar com calma, com metade do tempo.
// Puro e sem os atalhos "@/" (`npm run testar:escola-matricula` roda este arquivo direto no Node); a leitura e a
// gravação em 'lucia:escola:plano' usam o localStorage quando existe. Explicação em docs/escola/matricula.md.

import { aulasDoCurso, type Curso, trilhaDe } from "./cursos";
import { CHAVES_DA_ESCOLA, type Inscricao, type Tempo, TEMPOS } from "./estudante";

/** Minutos por semana para cada resposta de "Quanto tempo por semana você tem?". */
export const ORCAMENTO: Record<Tempo, number> = { "ate-1h": 60, "1-3h": 150, "3-6h": 270, "mais-6h": 420 };
/** Segunda, quarta e sexta (0 = domingo … 6 = sábado). A pessoa troca. */
export const DIAS_PADRAO: readonly number[] = [1, 3, 5];
/** Dias sem nada feito para o plano oferecer "Recomeçar com calma". */
export const DIAS_PARA_CALMA = 14;
export const CHAVE_DO_PLANO = CHAVES_DA_ESCOLA.plano;

export interface DiaDoPlano {
  /** AAAA-MM-DD */
  data: string;
  /** "trilha/aula", na ordem. */
  aulas: string[];
  minutos: number;
}

export interface Plano {
  versao: 1;
  /** Semana ISO "AAAA-Www". */
  semana: string;
  dias: DiaDoPlano[];
  /** Quando o plano desta semana foi montado (AAAA-MM-DD). */
  feitoEm: string;
  /** Os dias escolhidos (0 = domingo … 6 = sábado), de segunda a domingo. */
  diasDaSemana: number[];
  /** O tempo da semana em minutos (já pela metade no plano com calma). */
  minutosDaSemana: number;
  /** A meta de aulas por semana do "Meu estudo", quando havia (0: sem meta). */
  meta: number;
  calma: boolean;
  /** Os minutos estimados de cada aula do plano, para reajustar sem a lista de aulas. */
  minutosDe: Record<string, number>;
  /** As aulas do plano que já apareceram como feitas. */
  feitas: string[];
  /** O dia do primeiro plano (atravessa as semanas). */
  comecouEm: string;
  /** O último dia em que uma aula foi feita, até onde o plano viu. */
  ultimoFeito?: string;
  /** O que não coube nos dias que sobram desta semana: volta no plano da semana que vem. */
  paraDepois: string[];
  /** Duas semanas sem nada feito: a tela oferece "Recomeçar com calma". */
  oferecerCalma: boolean;
}

// ───────────── Datas (texto AAAA-MM-DD, contas em UTC) ─────────────

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const SEMANA = /^\d{4}-W\d{2}$/;
const ms = (dia: string) => Date.parse(`${dia}T00:00:00Z`);
export const somarDias = (dia: string, n: number) => new Date(ms(dia) + n * 86_400_000).toISOString().slice(0, 10);
export const diasEntre = (de: string, ate: string) => Math.round((ms(ate) - ms(de)) / 86_400_000);
/** 0 = domingo … 6 = sábado. */
export const diaDaSemana = (dia: string) => new Date(ms(dia)).getUTCDay();
/** A segunda-feira da semana do dia. */
export const segundaDe = (dia: string) => somarDias(dia, -((diaDaSemana(dia) + 6) % 7));

/** A semana ISO 8601 de um dia: "AAAA-Www" (a semana é do ano em que cai a quinta-feira dela). */
export function semanaISO(dia: string): string {
  const quinta = somarDias(segundaDe(dia), 3);
  const ano = Number(quinta.slice(0, 4));
  const semana = Math.floor(diasEntre(`${ano}-01-01`, quinta) / 7) + 1;
  return `${ano}-W${String(semana).padStart(2, "0")}`;
}

/** Os dias escolhidos, válidos, sem repetir, de segunda a domingo. Lista vazia vira o padrão. */
export function ordenarDias(dias: readonly number[] | undefined): number[] {
  const validos = [...new Set((dias ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return (validos.length ? validos : [...DIAS_PADRAO]).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

// ───────────── Montar ─────────────

export interface EntradaDoPlano {
  tempo: Tempo;
  inscricoes: readonly Inscricao[];
  /** As aulas feitas ('lucia:concluidas'). */
  concluidas: Iterable<string>;
  cursos: readonly Pick<Curso, "slug" | "modulos">[];
  /** Minutos estimados de uma aula; 0 quando a aula não existe (e então ela fica fora do plano). */
  minutosDaAula: (aula: string) => number;
  /** AAAA-MM-DD */
  hoje: string;
  /** Dias da semana (0 = domingo … 6 = sábado). Padrão: segunda, quarta e sexta. */
  dias?: readonly number[];
  /** Aulas por semana da meta do "Meu estudo" (lib/meu-estudo.ts: lerMetas). Com meta, vale o número dela. */
  meta?: number;
  calma?: boolean;
  /** Do plano anterior, para a conta das duas semanas atravessar as semanas. */
  anterior?: Pick<Plano, "comecouEm" | "ultimoFeito"> | null;
}

/** As próximas aulas pendentes de cada curso em andamento, na ordem do curso, alternando entre os cursos. */
export function aulasPendentes(e: Pick<EntradaDoPlano, "inscricoes" | "concluidas" | "cursos" | "minutosDaAula">): string[] {
  const feitas = new Set(e.concluidas);
  const filas: string[][] = [];
  for (const inscricao of e.inscricoes) {
    if (inscricao.trancadoEm || inscricao.formadoEm) continue;
    const curso = e.cursos.find((c) => c.slug === inscricao.curso);
    if (!curso) continue;
    filas.push(aulasDoCurso(curso).filter((a) => !feitas.has(a) && !inscricao.dispensas.includes(trilhaDe(a)) && e.minutosDaAula(a) > 0));
  }
  const saida: string[] = [];
  const vistas = new Set<string>();
  for (let i = 0; filas.some((f) => i < f.length); i++)
    for (const fila of filas) {
      const aula = fila[i];
      if (aula && !vistas.has(aula)) {
        vistas.add(aula);
        saida.push(aula);
      }
    }
  return saida;
}

/**
 * Monta o plano da semana de `hoje`. Os dias escolhidos que já passaram ficam de fora (quem monta na quarta não
 * recebe aula na segunda); se nenhum sobra, o plano é o da semana seguinte. Cada dia recebe até a sua parte do tempo
 * (o tempo da semana dividido pelos dias escolhidos), na ordem, e a semana não passa do tempo total. Uma aula maior que
 * a parte do dia entra sozinha num dia vazio, se ainda couber na semana. Com meta de aulas, o número de aulas é o da
 * meta (dividido entre os dias), e o tempo não corta.
 */
export function montarPlano(e: EntradaDoPlano): Plano {
  const diasDaSemana = ordenarDias(e.dias);
  const calma = e.calma === true;
  const minutosDaSemana = Math.round(ORCAMENTO[e.tempo] * (calma ? 0.5 : 1));
  const meta = Number.isInteger(e.meta) && (e.meta ?? 0) > 0 ? (e.meta as number) : 0;
  const parteDoDia = minutosDaSemana / diasDaSemana.length;

  const datasDa = (segunda: string) => diasDaSemana.map((d) => somarDias(segunda, (d + 6) % 7));
  let datas = datasDa(segundaDe(e.hoje)).filter((d) => d >= e.hoje);
  if (datas.length === 0) datas = datasDa(somarDias(segundaDe(e.hoje), 7));
  const dias: DiaDoPlano[] = datas.map((data) => ({ data, aulas: [], minutos: 0 }));

  const fila = aulasPendentes(e);
  const minutosDe: Record<string, number> = {};
  const por = (aula: string) => (minutosDe[aula] ??= Math.max(1, Math.round(e.minutosDaAula(aula))));

  if (meta > 0) {
    // A meta é da semana inteira: quem monta no meio da semana recebe a parte dos dias que sobram.
    const daMeta = calma ? Math.max(1, Math.ceil(meta / 2)) : meta;
    const quantas = Math.min(fila.length, Math.ceil((daMeta * dias.length) / diasDaSemana.length));
    const base = Math.floor(quantas / dias.length);
    let resto = quantas % dias.length;
    let p = 0;
    for (const dia of dias) {
      const n = base + (resto > 0 ? 1 : 0);
      if (resto > 0) resto--;
      for (let k = 0; k < n; k++, p++) {
        dia.aulas.push(fila[p]);
        dia.minutos += por(fila[p]);
      }
    }
  } else {
    let total = 0;
    let p = 0;
    for (const dia of dias) {
      while (p < fila.length) {
        const m = por(fila[p]);
        const cabeNoDia = dia.minutos + m <= parteDoDia || dia.minutos === 0;
        const cabeNaSemana = total + m <= minutosDaSemana || total === 0;
        if (!cabeNoDia || !cabeNaSemana) break;
        dia.aulas.push(fila[p]);
        dia.minutos += m;
        total += m;
        p++;
      }
    }
  }
  for (const aula of Object.keys(minutosDe)) if (!dias.some((d) => d.aulas.includes(aula))) delete minutosDe[aula];

  return {
    versao: 1,
    semana: semanaISO(dias[0]?.data ?? e.hoje),
    dias,
    feitoEm: e.hoje,
    diasDaSemana,
    minutosDaSemana,
    meta,
    calma,
    minutosDe,
    feitas: [],
    comecouEm: e.anterior?.comecouEm && DIA.test(e.anterior.comecouEm) ? e.anterior.comecouEm : e.hoje,
    ...(e.anterior?.ultimoFeito && DIA.test(e.anterior.ultimoFeito) ? { ultimoFeito: e.anterior.ultimoFeito } : {}),
    paraDepois: [],
    oferecerCalma: false,
  };
}

// ───────────── Reajustar ─────────────

/**
 * Reajusta o plano no dia `hoje`: o que ficou sem fazer num dia que já passou vai para o próximo dia de estudo que
 * ainda vem (o primeiro em que cabe; se em nenhum cabe, o que tem menos minutos). Sem dia de estudo pela frente nesta
 * semana, vai para `paraDepois` e volta no plano da semana que vem (que é montado de novo pelo que falta). Nunca diz
 * "atrasado". Também marca o último dia com aula feita (`ultimaAtividade`, de 'lucia:concluidas-em', conta mesmo fora
 * do plano) e oferece recomeçar com calma depois de 14 dias sem nada feito. Fazer duas vezes dá o mesmo plano.
 */
export function reajustar(plano: Plano, concluidas: Iterable<string>, hoje: string, ultimaAtividade?: string | null): Plano {
  const feitas = new Set(concluidas);
  const doPlano = plano.dias.flatMap((d) => d.aulas);
  const feitasDoPlano = doPlano.filter((a) => feitas.has(a));
  const novas = feitasDoPlano.some((a) => !plano.feitas.includes(a));
  const candidatos = [plano.ultimoFeito, novas ? hoje : undefined, ultimaAtividade ?? undefined].filter((d): d is string => typeof d === "string" && DIA.test(d) && d <= hoje);
  const ultimoFeito = candidatos.sort().at(-1);

  const parteDoDia = plano.minutosDaSemana / Math.max(1, plano.diasDaSemana.length);
  const minutos = (a: string) => plano.minutosDe[a] ?? 0;
  const dias = plano.dias.map((d) => ({ ...d, aulas: [...d.aulas] }));
  const aMover: string[] = [];
  for (const dia of dias)
    if (dia.data < hoje) {
      const ficam = dia.aulas.filter((a) => feitas.has(a));
      aMover.push(...dia.aulas.filter((a) => !feitas.has(a)));
      dia.aulas = ficam;
    }
  const futuros = dias.filter((d) => d.data >= hoje);
  const paraDepois = [...plano.paraDepois.filter((a) => !feitas.has(a))];
  for (const aula of aMover) {
    if (futuros.length === 0) {
      if (!paraDepois.includes(aula)) paraDepois.push(aula);
      continue;
    }
    const destino = futuros.find((d) => d.minutos + minutos(aula) <= parteDoDia) ?? [...futuros].sort((a, b) => a.minutos - b.minutos || (a.data < b.data ? -1 : 1))[0];
    destino.aulas.push(aula);
  }
  for (const dia of dias) dia.minutos = dia.aulas.reduce((s, a) => s + minutos(a), 0);

  const referencia = ultimoFeito ?? plano.comecouEm;
  return {
    ...plano,
    dias,
    feitas: feitasDoPlano,
    ...(ultimoFeito ? { ultimoFeito } : {}),
    paraDepois,
    oferecerCalma: !plano.calma && diasEntre(referencia, hoje) >= DIAS_PARA_CALMA,
  };
}

/**
 * O plano para mostrar hoje: o guardado, reajustado; se é de outra semana (ou não existe), um novo, com os mesmos
 * dias e a mesma calma, e as datas de começo e de última aula feita do anterior.
 */
export function planoDeHoje(guardado: Plano | null, e: EntradaDoPlano, ultimaAtividade?: string | null): Plano {
  const semanaDeHoje = semanaISO(e.hoje);
  const valeAinda = guardado && guardado.semana >= semanaDeHoje && guardado.dias.some((d) => d.data >= e.hoje);
  const base = valeAinda
    ? guardado
    : montarPlano({ ...e, dias: e.dias ?? guardado?.diasDaSemana, calma: e.calma ?? guardado?.calma, anterior: guardado ?? e.anterior });
  return reajustar(base, e.concluidas, e.hoje, ultimaAtividade);
}

/** O dia do plano que é hoje, se for dia de estudo. */
export const diaDeHoje = (plano: Plano, hoje: string) => plano.dias.find((d) => d.data === hoje) ?? null;

// ───────────── Guardar ─────────────

const ehTexto = (v: unknown): v is string => typeof v === "string";

/** Confere a forma do plano guardado; o que vier errado vira null. Nunca lança. */
export function validarPlano(dado: unknown): Plano | null {
  if (!dado || typeof dado !== "object") return null;
  const p = dado as Record<string, unknown>;
  if (p.versao !== 1 || !ehTexto(p.semana) || !SEMANA.test(p.semana) || !ehTexto(p.feitoEm) || !DIA.test(p.feitoEm)) return null;
  if (!Array.isArray(p.dias) || p.dias.length > 7) return null;
  const dias: DiaDoPlano[] = [];
  for (const d of p.dias as unknown[]) {
    const dia = d as Record<string, unknown>;
    if (!dia || !ehTexto(dia.data) || !DIA.test(dia.data) || !Array.isArray(dia.aulas) || !dia.aulas.every(ehTexto) || typeof dia.minutos !== "number") return null;
    dias.push({ data: dia.data, aulas: dia.aulas as string[], minutos: dia.minutos });
  }
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter(ehTexto) : []);
  const minutosDe: Record<string, number> = {};
  if (p.minutosDe && typeof p.minutosDe === "object") for (const [k, v] of Object.entries(p.minutosDe as Record<string, unknown>)) if (typeof v === "number" && v >= 0) minutosDe[k] = v;
  const minutosDaSemana = typeof p.minutosDaSemana === "number" && p.minutosDaSemana > 0 ? p.minutosDaSemana : ORCAMENTO[TEMPOS[0]];
  return {
    versao: 1,
    semana: p.semana,
    dias,
    feitoEm: p.feitoEm,
    diasDaSemana: ordenarDias(Array.isArray(p.diasDaSemana) ? (p.diasDaSemana as number[]) : undefined),
    minutosDaSemana,
    meta: Number.isInteger(p.meta) && (p.meta as number) > 0 ? (p.meta as number) : 0,
    calma: p.calma === true,
    minutosDe,
    feitas: lista(p.feitas),
    comecouEm: ehTexto(p.comecouEm) && DIA.test(p.comecouEm) ? p.comecouEm : p.feitoEm,
    ...(ehTexto(p.ultimoFeito) && DIA.test(p.ultimoFeito) ? { ultimoFeito: p.ultimoFeito } : {}),
    paraDepois: lista(p.paraDepois),
    oferecerCalma: p.oferecerCalma === true,
  };
}

export function lerPlano(): Plano | null {
  try {
    const texto = globalThis.localStorage?.getItem(CHAVE_DO_PLANO);
    return texto ? validarPlano(JSON.parse(texto)) : null;
  } catch {
    return null;
  }
}

/** Guarda o plano (só se mudou, para não disparar o aviso de estudo à toa). Devolve false sem armazenamento. */
export function gravarPlano(plano: Plano): boolean {
  try {
    const a = globalThis.localStorage;
    if (!a) return false;
    const texto = JSON.stringify(plano);
    if (a.getItem(CHAVE_DO_PLANO) === texto) return true;
    a.setItem(CHAVE_DO_PLANO, texto);
    globalThis.dispatchEvent?.(new Event("lucia:estudo"));
    return true;
  } catch {
    return false;
  }
}

/** O último dia (AAAA-MM-DD, no relógio do aparelho) em que alguma aula foi marcada como feita ('lucia:concluidas-em'). */
export function ultimaAulaFeita(datas: Record<string, number> | null | undefined): string | null {
  const valores = Object.values(datas ?? {}).filter((t) => typeof t === "number" && Number.isFinite(t));
  if (valores.length === 0) return null;
  const d = new Date(Math.max(...valores));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
