// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Simuladores dentro das aulas (Etapa 5, B17). Quem escreve a aula abre um bloco ```simulador, e a primeira linha diz qual:
//
//   ```simulador
//   circuito
//   # Quanto puxa o chuveiro? (título opcional)
//   tensao 220
//   disjuntor 32
//   modo paralelo
//   ```
//
//   ```simulador
//   execucao-python
//   # Acompanhe o laço (título opcional)
//   soma = 0
//   for n in range(1, 4):
//       soma = soma + n
//   print(soma)
//   ```
//
// Tipos: `circuito` (lei de Ohm, série e paralelo, disjuntor; novo), `lampadas` (o laboratório de circuitos de
// lâmpadas de /laboratorios/eletrica), `instalacao` (o treino de fiação do mesmo laboratório), `execucao-python` e
// `execucao-js` (o visualizador de execução passo a passo, em lib/execucao-passo-a-passo.ts).
// Este arquivo só lê o bloco e faz a conta do circuito (sem React), para `npm run testar:simuladores-aulas` rodar no Node.
// Sem os atalhos "@/" de propósito.

export const TIPOS_DE_SIMULADOR = ["circuito", "lampadas", "instalacao", "execucao-python", "execucao-js"] as const;
export type TipoDeSimulador = (typeof TIPOS_DE_SIMULADOR)[number];

const ALIAS: Record<string, TipoDeSimulador> = { python: "execucao-python", js: "execucao-js", javascript: "execucao-js", execucao: "execucao-python" };

/** Valores comuns de disjuntor residencial, em ampères (os que as aulas de instalação usam). */
export const DISJUNTORES = [6, 10, 16, 20, 25, 32, 40] as const;
/** Resistência de um fio de ligação (didática): é o que sobra para limitar a corrente num curto-circuito. */
export const OHM_DO_FIO_NO_CURTO = 0.05;

export interface Simulador {
  tipo: TipoDeSimulador;
  titulo: string;
  /** Só nos de execução: o programa do exemplo. */
  codigo: string;
  /** Só no circuito: tensão da fonte (V), disjuntor (A) e como as cargas se ligam. */
  tensao: number;
  disjuntor: number;
  modo: "serie" | "paralelo";
}

export type LeituraDoSimulador = { ok: true; simulador: Simulador } | { ok: false; erro: string };

const numero = (t: string) => Number(t.trim().replace(",", "."));

/** Lê o miolo de um bloco ```simulador. Nunca lança: bloco mal escrito devolve o motivo. */
export function lerSimulador(spec: string): LeituraDoSimulador {
  const linhas = spec.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < linhas.length && !linhas[i].trim()) i++;
  const primeira = (linhas[i++] ?? "").trim().toLowerCase();
  const tipo = (TIPOS_DE_SIMULADOR as readonly string[]).includes(primeira) ? (primeira as TipoDeSimulador) : ALIAS[primeira];
  if (!tipo) return { ok: false, erro: `Tipo de simulador desconhecido: “${primeira || "(vazio)"}”. Use um destes: ${TIPOS_DE_SIMULADOR.join(", ")}.` };
  const s: Simulador = { tipo, titulo: "", codigo: "", tensao: 127, disjuntor: 16, modo: "paralelo" };
  while (i < linhas.length && !linhas[i].trim()) i++;
  if (/^#\s+/.test(linhas[i] ?? "")) s.titulo = linhas[i++].replace(/^#\s+/, "").trim();
  if (tipo.startsWith("execucao")) {
    s.codigo = linhas.slice(i).join("\n").replace(/\s+$/, "");
    if (!s.codigo.trim()) return { ok: false, erro: "O simulador de execução precisa de um programa depois da primeira linha." };
    return { ok: true, simulador: s };
  }
  for (const bruta of linhas.slice(i)) {
    const l = bruta.trim();
    if (!l) continue;
    const m = /^(tensao|tensão|disjuntor|modo)\s+(.+)$/i.exec(l);
    if (!m) return { ok: false, erro: `Linha não entendida no simulador: “${l.slice(0, 40)}”.` };
    const chave = m[1].toLowerCase();
    if (chave === "modo") {
      const v = m[2].trim().toLowerCase();
      if (v !== "serie" && v !== "série" && v !== "paralelo") return { ok: false, erro: "O modo é serie ou paralelo." };
      s.modo = v === "paralelo" ? "paralelo" : "serie";
    } else {
      const n = numero(m[2]);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) return { ok: false, erro: `Valor inválido em “${l}”.` };
      if (chave === "disjuntor") s.disjuntor = n;
      else s.tensao = n;
    }
  }
  return { ok: true, simulador: s };
}

// ───────────── A conta do circuito ─────────────

export interface Carga {
  /** Resistência em ohms. */
  ohm: number;
  /** A chave dela está ligada? */
  ligada: boolean;
}

export interface ResultadoDoCircuito {
  /** Resistência vista pela fonte (Ω); 0 quando está tudo aberto não faz sentido, por isso `aberto`. */
  ohmTotal: number;
  /** Corrente que a fonte TENTARIA entregar (A), antes de o disjuntor atuar. */
  correnteTotal: number;
  /** O circuito está aberto (nada liga ou, em série, alguma chave aberta): corrente zero. */
  aberto: boolean;
  /** Valores em cada carga SE o disjuntor não atuasse. */
  cada: { i: number; v: number; p: number }[];
  /** O disjuntor desarma (a corrente passou do valor dele). */
  desarmou: boolean;
  /** A potência total (W) que as cargas consumiriam. */
  potencia: number;
}

/**
 * Lei de Ohm (V = R · I) em um circuito de até 3 cargas, em série ou em paralelo, com disjuntor. Em série qualquer chave
 * aberta abre o circuito; em paralelo cada carga é um caminho. `curto` liga os dois polos da fonte por um fio.
 * Modelo didático: o disjuntor aqui desarma quando a corrente passa do valor dele. O real (térmico) aguenta uma pequena
 * sobrecarga por algum tempo antes de desarmar, e o magnético age na hora em correntes muitas vezes maiores.
 */
export function resolverCircuito(modo: "serie" | "paralelo", volts: number, cargas: Carga[], disjuntor: number, curto = false): ResultadoDoCircuito {
  const vazio = (aberto: boolean, ohmTotal = Infinity): ResultadoDoCircuito => ({ ohmTotal, correnteTotal: 0, aberto, cada: cargas.map(() => ({ i: 0, v: 0, p: 0 })), desarmou: false, potencia: 0 });
  if (!(volts > 0)) return vazio(true);
  if (curto) {
    const i = volts / OHM_DO_FIO_NO_CURTO;
    return { ohmTotal: OHM_DO_FIO_NO_CURTO, correnteTotal: i, aberto: false, cada: cargas.map(() => ({ i: 0, v: 0, p: 0 })), desarmou: i > disjuntor, potencia: volts * i };
  }
  let ohmTotal: number;
  let cada: { i: number; v: number; p: number }[];
  if (modo === "serie") {
    if (cargas.some((c) => !c.ligada)) return vazio(true);
    ohmTotal = cargas.reduce((s, c) => s + c.ohm, 0);
    const i = volts / ohmTotal;
    cada = cargas.map((c) => ({ i, v: i * c.ohm, p: i * i * c.ohm }));
  } else {
    const ativas = cargas.filter((c) => c.ligada);
    if (!ativas.length) return vazio(true);
    cada = cargas.map((c) => (c.ligada ? { i: volts / c.ohm, v: volts, p: (volts * volts) / c.ohm } : { i: 0, v: 0, p: 0 }));
    ohmTotal = 1 / ativas.reduce((s, c) => s + 1 / c.ohm, 0);
  }
  const correnteTotal = volts / ohmTotal;
  return { ohmTotal, correnteTotal, aberto: false, cada, desarmou: correnteTotal > disjuntor, potencia: volts * correnteTotal };
}

/** Número com vírgula e casas fixas, no jeito brasileiro. */
export function formatar(n: number, casas = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(casas).replace(".", ",");
}
