// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Quem leva o quê" no grupo cifrado (Prompt 4, item 19, atrás de "alumia-p4-conversa"): uma lista de coisas para levar (ao ato, à
// reunião, ao mutirão) em que cada pessoa marca "eu levo". Como a enquete do grupo da R3 (lib/rede/voto/enquete-do-grupo.ts), é um
// TIPO NOVO DE CONTEÚDO DENTRO DO CIFRADO: cada linha vai como texto do grupo MLS (lib/rede/membros/grupo.ts, mandarTexto), na caixa
// anônima da época, em pacote de tamanho fixo. Nada do MLS, do embrulho ou das caixas muda.
//   - o servidor não vê nada: nem a lista, nem as coisas, nem quem leva o quê;
//   - entre os membros NÃO é segredo quem leva o quê (é para isso que serve: quem marca escolhe aparecer, pela identidade do grupo,
//     que a tela mostra pelo codinome); a tela diz isso antes de marcar;
//   - cada pessoa marca e desmarca as suas (a última marca de cada uma vale); só quem abriu fecha; marca depois do fechamento, de
//     lista que não existe, de coisa fora da lista ou de texto torto, não conta; quem não se apresentou ao grupo (sem autor) não conta.
// Formato (texto do grupo): "alumia/p4/quem-leva/v1 " seguido de um JSON pequeno. Nada de cifra aqui: a cifra é a do grupo.
// Sem "@/": roda no Node nos testes (scripts/testar-p4-conversa.mjs).
import type { GrupoDaEnquete } from "../voto/enquete-do-grupo";

export const ROTULOS = { quemLeva: "alumia/p4/quem-leva/v1" } as const;
const PREFIXO = `${ROTULOS.quemLeva} `;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Até 20 coisas de até 80 letras; o título até 140. */
export const LIMITES = { coisas: 20, coisa: 80, titulo: 140 } as const;

type Linha =
  | { t: "lista"; id: string; p: string; c: string[] }
  | { t: "levo"; id: string; c: number; s: boolean }
  | { t: "fechar"; id: string };

export interface ResultadoDaLista {
  id: string;
  titulo: string;
  coisas: string[];
  /** Quem abriu (a identidade no grupo, b64url). */
  autor: string;
  fechada: boolean;
  /** Para cada coisa, quem marcou "eu levo" (identidades no grupo, em ordem fixa). Não é segredo entre os membros. */
  quem: string[][];
}

function ler(corpo: Uint8Array): Linha | null {
  let s: string;
  try {
    s = new TextDecoder("utf-8", { fatal: true }).decode(corpo);
  } catch {
    return null;
  }
  if (!s.startsWith(PREFIXO) || s.length > 4096) return null;
  try {
    const j = JSON.parse(s.slice(PREFIXO.length)) as Record<string, unknown>;
    if (typeof j.id !== "string" || !UUID.test(j.id)) return null;
    if (j.t === "lista") {
      const c = j.c;
      if (typeof j.p !== "string" || !j.p.trim() || j.p.length > LIMITES.titulo) return null;
      if (!Array.isArray(c) || c.length < 1 || c.length > LIMITES.coisas || !c.every((x) => typeof x === "string" && x.trim() && x.length <= LIMITES.coisa)) return null;
      return { t: "lista", id: j.id, p: j.p, c: c as string[] };
    }
    if (j.t === "levo") return Number.isInteger(j.c) && (j.c as number) >= 0 && typeof j.s === "boolean" ? { t: "levo", id: j.id, c: j.c as number, s: j.s } : null;
    if (j.t === "fechar") return { t: "fechar", id: j.id };
  } catch {
    return null;
  }
  return null;
}

/**
 * "Quem leva o quê" num grupo, do ponto de vista deste aparelho. Como na enquete do grupo: o MLS não devolve a quem escreveu as
 * próprias mensagens, então as linhas que este aparelho mandou ficam guardadas aqui (na memória) e entram na conta na posição em que
 * saíram. `eu`: a identidade deste aparelho no grupo (b64url).
 */
export function quemLevaNoGrupo(g: GrupoDaEnquete, eu: string) {
  const proprias: { antes: number; corpo: Uint8Array }[] = [];
  async function mandar(l: Linha): Promise<void> {
    await g.receber();
    const t = PREFIXO + JSON.stringify(l);
    await g.mandarTexto(t);
    proprias.push({ antes: g.mensagens.length, corpo: new TextEncoder().encode(t) });
  }
  function todas(): GrupoDaEnquete["mensagens"] {
    const saida: { tipo: string; autor: string | null; corpo: Uint8Array }[] = [];
    let k = 0;
    g.mensagens.forEach((m, i) => {
      while (k < proprias.length && proprias[k].antes <= i) saida.push({ tipo: "texto", autor: eu, corpo: proprias[k++].corpo });
      saida.push(m);
    });
    while (k < proprias.length) saida.push({ tipo: "texto", autor: eu, corpo: proprias[k++].corpo });
    return saida;
  }
  return {
    /** Abre uma lista no grupo. Devolve o id. */
    async abrir(titulo: string, coisas: string[]): Promise<string> {
      const p = titulo.trim();
      const c = coisas.map((x) => x.trim()).filter(Boolean);
      if (!p || p.length > LIMITES.titulo || c.length < 1 || c.length > LIMITES.coisas || c.some((x) => x.length > LIMITES.coisa)) throw new Error("lista_invalida");
      const id = crypto.randomUUID();
      await mandar({ t: "lista", id, p, c });
      return id;
    },
    /** Marca (ou desmarca) "eu levo" numa coisa (pelo número, a partir de 0). Vai pela identidade do grupo: os membros veem. */
    async levar(id: string, coisa: number, sim = true): Promise<void> {
      if (!UUID.test(id) || !Number.isInteger(coisa) || coisa < 0) throw new Error("marca_invalida");
      await mandar({ t: "levo", id, c: coisa, s: sim });
    },
    /** Fecha a lista (só vale se quem fecha é quem abriu). */
    async fechar(id: string): Promise<void> {
      await mandar({ t: "fechar", id });
    },
    /** As listas, contadas com as mensagens recebidas e as deste aparelho. */
    listas: () => listasDoGrupo(todas()),
  };
}
export type QuemLevaNoGrupo = ReturnType<typeof quemLevaNoGrupo>;

/** As listas do grupo, a partir das mensagens que este aparelho leu, na ordem em que chegaram. */
export function listasDoGrupo(mensagens: GrupoDaEnquete["mensagens"]): ResultadoDaLista[] {
  const abertas = new Map<string, { r: ResultadoDaLista; marcas: Set<string>[] }>();
  for (const m of mensagens) {
    if (m.tipo !== "texto" || !m.autor) continue;
    const l = ler(m.corpo);
    if (!l) continue;
    const e = abertas.get(l.id);
    if (l.t === "lista") {
      if (!e) abertas.set(l.id, { r: { id: l.id, titulo: l.p, coisas: l.c, autor: m.autor, fechada: false, quem: [] }, marcas: l.c.map(() => new Set<string>()) });
    } else if (!e || e.r.fechada) {
      continue;
    } else if (l.t === "fechar") {
      if (m.autor === e.r.autor) e.r.fechada = true;
    } else if (l.c < e.marcas.length) {
      if (l.s) e.marcas[l.c].add(m.autor);
      else e.marcas[l.c].delete(m.autor);
    }
  }
  return [...abertas.values()].map(({ r, marcas }) => ({ ...r, quem: marcas.map((x) => [...x].sort()) }));
}
