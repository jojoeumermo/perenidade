// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A apuração das consultas à base (PLANO-ALUMIA §4.2 "Votação ranqueada e quórum", §5 F4). Puro: roda no Node nos testes e no
// aparelho no perfil de exemplo. A apuração DE VERDADE é a função SQL da etapa de back-end, que segue estas mesmas regras; este
// arquivo é a referência e o teste dela. Entram só cédulas (listas de opções), nunca quem votou: o voto é secreto (LGPD art. 11).

/** Uma cédula: a lista de ids das opções na ordem de preferência (na consulta simples, uma opção só). */
export type Cedula = readonly string[];

export interface Rodada {
  /** Votos de cada opção ainda viva nesta rodada. */
  votos: Record<string, number>;
  /** Cédulas que não têm mais nenhuma opção viva (esgotadas). */
  esgotadas: number;
  /** A opção eliminada ao fim da rodada (nula na última). */
  eliminada: string | null;
}

export interface Resultado {
  /** A opção vencedora (nula sem votos ou em empate que não se desfaz). */
  vencedora: string | null;
  rodadas: Rodada[];
  /** Quantas cédulas válidas entraram. */
  cedulas: number;
}

/** Só valem cédulas com opções conhecidas e sem repetição; o resto é descartado (o banco recusa antes, isto é a segunda conferência). */
export function cedulaValida(c: Cedula, opcoes: readonly string[]): boolean {
  if (c.length === 0 || c.length > opcoes.length) return false;
  const vistas = new Set<string>();
  for (const id of c) {
    if (!opcoes.includes(id) || vistas.has(id)) return false;
    vistas.add(id);
  }
  return true;
}

/** Consulta simples: conta a primeira opção de cada cédula. Vence quem tem mais; empate no topo = sem vencedora. */
export function apurarSimples(cedulas: readonly Cedula[], opcoes: readonly string[]): Resultado {
  const validas = cedulas.filter((c) => cedulaValida(c, opcoes));
  const votos: Record<string, number> = Object.fromEntries(opcoes.map((o) => [o, 0]));
  for (const c of validas) votos[c[0]] += 1;
  const max = Math.max(0, ...Object.values(votos));
  const topo = opcoes.filter((o) => votos[o] === max);
  return { vencedora: max > 0 && topo.length === 1 ? topo[0] : null, rodadas: [{ votos, esgotadas: 0, eliminada: null }], cedulas: validas.length };
}

/**
 * Consulta ranqueada: segundo turno instantâneo (IRV). Em cada rodada, cada cédula conta para a sua opção viva mais bem colocada;
 * se alguma tem mais da metade dos votos das cédulas ainda vivas, vence; senão sai a menos votada. Empate na eliminação: sai a
 * que teve menos votos na rodada anterior (olhando para trás até a primeira); se o empate persistir, sai a que vem por último na
 * ordem das opções (regra fixa e escrita antes, para ninguém escolher depois).
 */
export function apurarRanqueada(cedulas: readonly Cedula[], opcoes: readonly string[]): Resultado {
  const validas = cedulas.filter((c) => cedulaValida(c, opcoes));
  const vivas = new Set(opcoes);
  const rodadas: Rodada[] = [];
  while (vivas.size > 0) {
    const votos: Record<string, number> = Object.fromEntries([...vivas].map((o) => [o, 0]));
    let esgotadas = 0;
    for (const c of validas) {
      const escolha = c.find((id) => vivas.has(id));
      if (escolha) votos[escolha] += 1;
      else esgotadas += 1;
    }
    const total = validas.length - esgotadas;
    const ordem = opcoes.filter((o) => vivas.has(o));
    if (total === 0) {
      rodadas.push({ votos, esgotadas, eliminada: null });
      return { vencedora: null, rodadas, cedulas: validas.length };
    }
    const lider = ordem.find((o) => votos[o] * 2 > total);
    if (lider || vivas.size === 1) {
      rodadas.push({ votos, esgotadas, eliminada: null });
      return { vencedora: lider ?? ordem[0], rodadas, cedulas: validas.length };
    }
    const min = Math.min(...ordem.map((o) => votos[o]));
    let empatadas = ordem.filter((o) => votos[o] === min);
    for (let r = rodadas.length - 1; r >= 0 && empatadas.length > 1; r--) {
      const antes = rodadas[r].votos;
      const menor = Math.min(...empatadas.map((o) => antes[o] ?? 0));
      empatadas = empatadas.filter((o) => (antes[o] ?? 0) === menor);
    }
    const eliminada = empatadas[empatadas.length - 1];
    rodadas.push({ votos, esgotadas, eliminada });
    vivas.delete(eliminada);
    // Todas as que sobraram empatadas em tudo: sem vencedora (a última rodada fica registrada).
    if (vivas.size === 0) return { vencedora: null, rodadas, cedulas: validas.length };
  }
  return { vencedora: null, rodadas, cedulas: validas.length };
}

/** A proporção de cada opção na última rodada (0–1), para as barras do resultado. Sem votos, tudo zero. */
export function proporcoesFinais(r: Resultado, opcoes: readonly string[]): Record<string, number> {
  const ultima = r.rodadas[r.rodadas.length - 1];
  const votos = ultima?.votos ?? {};
  const total = Object.values(votos).reduce((s, n) => s + n, 0);
  return Object.fromEntries(opcoes.map((o) => [o, total > 0 ? (votos[o] ?? 0) / total : 0]));
}

/** O quórum (mínimo de pessoas) foi atingido? Sem quórum definido, sempre. */
export function quorumAtingido(cedulas: number, quorum: number | null | undefined): boolean {
  return !quorum || cedulas >= quorum;
}
