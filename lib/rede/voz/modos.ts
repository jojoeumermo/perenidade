// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os modos da sala de voz cifrada (Prompt 4, itens 23, 24 e 25), por cima da sala que já existe (lib/rede/voz/sala.ts). Tudo vai como
// recados "sala" DENTRO do mesmo canal cifrado da sala (AES-GCM com a chave do MLS do grupo): o servidor não vê quem fala, quem
// levantou a mão, quem espera nem o ritmo. Nada fica no banco.
//
//   palco (23)    quem fala, quem ouve e a fila de mãos. Quem abriu o modo (a anfitriã) dá e tira a vez; quem só ouve fica com o
//                 microfone desligado NO PRÓPRIO aparelho e pode levantar a mão.
//   ritmo (24)    pomodoro compartilhado: foco e pausa contados pelo relógio de cada aparelho a partir do começo que a anfitriã
//                 mandou. Presença só como CONTAGEM, e só a partir de 3 (abaixo disso, "menos de 3").
//   espera (25)   sala de espera: com ela ligada, quem chega não liga para ninguém até a anfitriã aprovar. A SENHA da sala não passa
//                 por aqui: ela muda o nome da sala (lib/rede/voz/navegador.ts, nomeComSenha), e quem não sabe a senha cai em outra
//                 sala, vazia.
//
// Limite honesto (o mesmo da sala de hoje, item 139 pendente): o recado diz de quem é, mas não é assinado por quem manda. Alguém DO
// GRUPO (que tem a chave da sala) poderia se passar pela anfitriã. Quem é de fora do grupo não abre nem forja nada.
// Sem "@/": roda no Node nos testes.

export interface Ritmo {
  /** Começo (relógio da anfitriã, ms) e os minutos de foco e de pausa. */
  inicio: number;
  foco: number;
  pausa: number;
}

export interface EstadoDaSala {
  /** Quem abriu os modos (null: ninguém abriu; a sala é a de sempre). */
  anfitria: string | null;
  palco: boolean;
  /** No palco: quem pode falar (a anfitriã sempre pode). */
  falam: string[];
  /** No palco: a fila de mãos, na ordem em que levantaram. */
  maos: string[];
  espera: boolean;
  /** Na espera: quem a anfitriã já deixou entrar (quem estava na sala quando a espera ligou entra junto). */
  admitidos: string[];
  /** Na espera: quem bateu e ainda espera (só a anfitriã age; os outros só sabem que há alguém, sem nome). */
  batendo: string[];
  ritmo: Ritmo | null;
  /** Sobe a cada mudança da anfitriã (o recado mais velho não desfaz o mais novo). */
  versao: number;
}

export type RecadoDeModo = { k: "estado"; e: EstadoDaSala } | { k: "mao"; sim: boolean };

/** O máximo de pessoas da sala (o mesmo de sala.ts) limita toda lista. */
const MAXIMO = 8;
const MAX_BATENDO = 16;
export const MINIMO_PARA_CONTAR = 3;

export const estadoInicial = (): EstadoDaSala => ({ anfitria: null, palco: false, falam: [], maos: [], espera: false, admitidos: [], batendo: [], ritmo: null, versao: 0 });

const nomeOk = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 80;
const lista = (x: unknown, max: number): string[] | null => (Array.isArray(x) && x.length <= max && x.every(nomeOk) && new Set(x).size === x.length ? [...x] : null);
const minutosOk = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** Lê um estado que chegou (de dentro do cifrado). null em qualquer coisa fora do formato. */
export function lerEstado(x: unknown): EstadoDaSala | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const falam = lista(o.falam, MAXIMO);
  const maos = lista(o.maos, MAXIMO);
  const admitidos = lista(o.admitidos, MAXIMO * 4);
  const batendo = lista(o.batendo, MAX_BATENDO);
  if (!nomeOk(o.anfitria) || typeof o.palco !== "boolean" || typeof o.espera !== "boolean" || !falam || !maos || !admitidos || !batendo) return null;
  if (typeof o.versao !== "number" || !Number.isSafeInteger(o.versao) || o.versao < 1) return null;
  let ritmo: Ritmo | null = null;
  if (o.ritmo !== null) {
    const r = o.ritmo as Record<string, unknown> | undefined;
    if (!r || typeof r.inicio !== "number" || !Number.isFinite(r.inicio) || !minutosOk(r.foco, 5, 90) || !minutosOk(r.pausa, 1, 30)) return null;
    ritmo = { inicio: r.inicio, foco: r.foco, pausa: r.pausa };
  }
  return { anfitria: o.anfitria, palco: o.palco, falam, maos, espera: o.espera, admitidos, batendo, ritmo, versao: o.versao };
}

/** Lê um recado de modo. */
export function lerRecadoDeModo(x: unknown): RecadoDeModo | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.k === "mao" && typeof o.sim === "boolean") return { k: "mao", sim: o.sim };
  if (o.k === "estado") {
    const e = lerEstado(o.e);
    return e ? { k: "estado", e } : null;
  }
  return null;
}

/**
 * Aceito o estado que `de` mandou? Só a anfitriã manda estado. Sem anfitriã aqui (ou com a anfitriã fora da sala), quem se diz
 * anfitriã assume. Duas ao mesmo tempo: fica a de menor identificador (todo aparelho chega à mesma). Versão mais velha: ignora.
 */
export function aceitarEstado(atual: EstadoDaSala, de: string, novo: EstadoDaSala, presentes: ReadonlySet<string>): EstadoDaSala | null {
  if (novo.anfitria !== de) return null;
  if (atual.anfitria === null || !presentes.has(atual.anfitria)) return novo;
  if (atual.anfitria === de) return novo.versao > atual.versao ? novo : null;
  return de < atual.anfitria ? novo : null;
}

// ── O que a anfitriã faz (cada função devolve o estado novo, com a versão acima) ──────────────────────────────────────────────

const subir = (e: EstadoDaSala, eu: string, mudar: Partial<EstadoDaSala>): EstadoDaSala => ({ ...e, ...mudar, anfitria: eu, versao: e.versao + 1 });

/** Liga ou desliga o palco. Ligando, só a anfitriã fala até dar a vez. */
export const ligarPalco = (e: EstadoDaSala, eu: string, sim: boolean): EstadoDaSala => subir(e, eu, { palco: sim, falam: sim ? [eu] : [], maos: [] });

/** Dá a vez (tira da fila de mãos) ou tira a vez. */
export function darVez(e: EstadoDaSala, eu: string, quem: string, sim: boolean): EstadoDaSala {
  if (!e.palco || quem === eu) return e;
  const falam = sim ? [...new Set([...e.falam, quem])].slice(0, MAXIMO) : e.falam.filter((x) => x !== quem);
  return subir(e, eu, { falam, maos: e.maos.filter((x) => x !== quem) });
}

/** A mão de alguém (a anfitriã recebe e põe na fila; abaixar tira). Quem já fala não entra na fila. */
export function mao(e: EstadoDaSala, eu: string, de: string, sim: boolean): EstadoDaSala {
  if (!e.palco || e.anfitria !== eu) return e;
  if (sim && (e.falam.includes(de) || e.maos.includes(de) || e.maos.length >= MAXIMO)) return e;
  if (!sim && !e.maos.includes(de)) return e;
  return subir(e, eu, { maos: sim ? [...e.maos, de] : e.maos.filter((x) => x !== de) });
}

/** Liga a espera (quem já está na sala entra junto) ou desliga (todo mundo entra). */
export function ligarEspera(e: EstadoDaSala, eu: string, sim: boolean, presentes: Iterable<string>): EstadoDaSala {
  return subir(e, eu, { espera: sim, admitidos: sim ? [...new Set([eu, ...presentes])].slice(0, MAXIMO * 4) : [], batendo: [] });
}

/** Alguém bateu (mandou "olá" sem estar aprovada): só a anfitriã anota. */
export function bateu(e: EstadoDaSala, eu: string, quem: string): EstadoDaSala {
  if (!e.espera || e.anfitria !== eu || e.admitidos.includes(quem) || e.batendo.includes(quem) || e.batendo.length >= MAX_BATENDO) return e;
  return subir(e, eu, { batendo: [...e.batendo, quem] });
}

/** Aprova ou recusa quem bateu. */
export function decidir(e: EstadoDaSala, eu: string, quem: string, entra: boolean): EstadoDaSala {
  if (!e.espera) return e;
  return subir(e, eu, { batendo: e.batendo.filter((x) => x !== quem), admitidos: entra ? [...new Set([...e.admitidos, quem])].slice(0, MAXIMO * 4) : e.admitidos.filter((x) => x !== quem) });
}

/** Liga o ritmo (pomodoro) a partir de agora, ou desliga. */
export function ligarRitmo(e: EstadoDaSala, eu: string, ritmo: { foco: number; pausa: number } | null, agora: number): EstadoDaSala {
  if (ritmo && (!minutosOk(ritmo.foco, 5, 90) || !minutosOk(ritmo.pausa, 1, 30))) throw new Error("ritmo_invalido");
  return subir(e, eu, { ritmo: ritmo ? { inicio: agora, foco: ritmo.foco, pausa: ritmo.pausa } : null });
}

// ── O que cada aparelho decide sozinho ───────────────────────────────────────────────────────────────────────────────────────

/** Ligo para `quem`? Sem espera, sim. Com espera, só se nós duas estivermos aprovadas (a anfitriã está sempre). */
export function podeLigar(e: EstadoDaSala, eu: string, quem: string): boolean {
  if (!e.espera) return true;
  const dentro = (x: string) => x === e.anfitria || e.admitidos.includes(x);
  return dentro(eu) && dentro(quem);
}

/** Estou esperando aprovação? */
export const esperando = (e: EstadoDaSala, eu: string): boolean => e.espera && eu !== e.anfitria && !e.admitidos.includes(eu);

/** Posso falar? Fora do palco, sim. No palco, só quem tem a vez. */
export const possoFalar = (e: EstadoDaSala, eu: string): boolean => !e.palco || eu === e.anfitria || e.falam.includes(eu);

/** A fase do ritmo agora: foco ou pausa, e quanto falta. O ciclo conta a partir do começo, igual em todo aparelho. */
export function faseDoRitmo(r: Ritmo, agora: number): { fase: "foco" | "pausa"; faltaMs: number; ciclo: number } {
  const foco = r.foco * 60_000;
  const ciclo = foco + r.pausa * 60_000;
  const passou = Math.max(0, agora - r.inicio);
  const dentro = passou % ciclo;
  const n = Math.floor(passou / ciclo) + 1;
  return dentro < foco ? { fase: "foco", faltaMs: foco - dentro, ciclo: n } : { fase: "pausa", faltaMs: ciclo - dentro, ciclo: n };
}

/** A presença como contagem: o número só a partir de 3; abaixo disso, null ("menos de 3"). */
export const contagem = (n: number): number | null => (n >= MINIMO_PARA_CONTAR ? n : null);
