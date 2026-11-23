// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (decisão do dono sobre a consulta à base): a enquete NÃO SECRETA dentro do grupo cifrado do núcleo.
// A filiação aos núcleos saiu do servidor (onda R2): o servidor não sabe quem é de núcleo e não tem como receber o voto da consulta à
// base sem passar a saber. Enquanto não houver credencial anônima auditada, o núcleo decide por enquete dentro do PRÓPRIO grupo MLS
// (lib/rede/membros/grupo.ts): a pergunta e cada voto vão como mensagens do grupo, cifradas pelo MLS na caixa anônima da época.
//   - o servidor não vê nada: nem a pergunta, nem quem votou, nem o voto (vê pacotes de tamanho fixo numa caixa sem dono);
//   - NÃO é secreta entre os membros: cada voto vai assinado pela folha de quem votou (o MLS diz aos membros quem escreveu), e a tela
//     diz isso antes de votar. Quem é do grupo vê como cada um votou;
//   - um voto por membro (o último antes do fechamento vale); só quem abriu fecha; voto depois do fechamento, de enquete que não
//     existe ou com opção fora da lista, não conta; quem não se apresentou ao grupo (sem autor) não conta;
//   - os números só aparecem com 3 votos ou mais e nenhuma opção com 1 ou 2 (como na votação da comunidade): nenhum número abaixo de 3.
// Formato (texto do grupo): "alumia/r3/enquete-do-grupo/v1 " seguido de um JSON pequeno. Nada de cifra aqui: a cifra é a do grupo.
// Sem "@/": roda no Node nos testes (scripts/testar-r3-resto-enquete.mjs).

export const ROTULOS = { enquete: "alumia/r3/enquete-do-grupo/v1" } as const;
const PREFIXO = `${ROTULOS.enquete} `;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Até 8 opções de até 120 letras; a pergunta até 200. */
export const LIMITES = { opcoes: 8, opcao: 120, pergunta: 200 } as const;

/** O que a enquete precisa do grupo (lib/rede/membros/grupo.ts, a classe Grupo). */
export interface GrupoDaEnquete {
  mandarTexto(corpo: string): Promise<void>;
  receber(): Promise<void>;
  readonly mensagens: readonly { tipo: string; autor: string | null; corpo: Uint8Array }[];
}

type Linha =
  | { t: "enquete"; id: string; p: string; o: string[] }
  | { t: "voto"; id: string; o: number }
  | { t: "fechar"; id: string };

export interface ResultadoDaEnquete {
  id: string;
  pergunta: string;
  opcoes: string[];
  /** Quem abriu (a identidade no grupo, b64url). */
  autor: string;
  fechada: boolean;
  /** Os votos, um por membro (NÃO é secreta entre os membros: a tela pode mostrar). */
  votos: { autor: string; opcao: number }[];
  /** Quantos votos cada opção teve, ou null com menos de 3 votos ou com alguma opção com 1 ou 2 (nenhum número abaixo de 3). */
  contagem: number[] | null;
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
    if (j.t === "enquete") {
      const o = j.o;
      if (typeof j.p !== "string" || !j.p.trim() || j.p.length > LIMITES.pergunta) return null;
      if (!Array.isArray(o) || o.length < 2 || o.length > LIMITES.opcoes || !o.every((x) => typeof x === "string" && x.trim() && x.length <= LIMITES.opcao)) return null;
      return { t: "enquete", id: j.id, p: j.p, o: o as string[] };
    }
    if (j.t === "voto") return Number.isInteger(j.o) ? { t: "voto", id: j.id, o: j.o as number } : null;
    if (j.t === "fechar") return { t: "fechar", id: j.id };
  } catch {
    return null;
  }
  return null;
}

/**
 * A enquete num grupo, do ponto de vista deste aparelho. O MLS não devolve a quem escreveu as próprias mensagens: as linhas que este
 * aparelho mandou ficam guardadas aqui (na memória, como os textos próprios na tela do grupo) e entram na conta na posição em que
 * saíram. `eu`: a identidade deste aparelho no grupo (b64url, a mesma que os outros veem como autor).
 */
export function enqueteNoGrupo(g: GrupoDaEnquete, eu: string) {
  const proprias: { antes: number; corpo: Uint8Array }[] = [];
  async function mandar(l: Linha): Promise<void> {
    // Lê o que chegou antes de mandar: a linha própria entra na conta depois de tudo o que este aparelho já viu (sem isso, um voto
    // mandado sem ler o fechamento contaria aqui e não nos outros). Limite: dois aparelhos ao mesmo tempo ainda podem divergir no
    // instante do fechamento; o que vale para os outros é a ordem da caixa.
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
    /** Abre uma enquete no grupo. Devolve o id. */
    async abrir(pergunta: string, opcoes: string[]): Promise<string> {
      const p = pergunta.trim();
      const o = opcoes.map((x) => x.trim()).filter(Boolean);
      if (!p || p.length > LIMITES.pergunta || o.length < 2 || o.length > LIMITES.opcoes || o.some((x) => x.length > LIMITES.opcao)) throw new Error("enquete_invalida");
      const id = crypto.randomUUID();
      await mandar({ t: "enquete", id, p, o });
      return id;
    },
    /** Vota (a opção pelo número, a partir de 0). O voto vai assinado pela folha: os membros veem. */
    async votar(id: string, opcao: number): Promise<void> {
      if (!UUID.test(id) || !Number.isInteger(opcao) || opcao < 0) throw new Error("voto_invalido");
      await mandar({ t: "voto", id, o: opcao });
    },
    /** Fecha a enquete (só vale se quem fecha é quem abriu). */
    async fechar(id: string): Promise<void> {
      await mandar({ t: "fechar", id });
    },
    /** As enquetes, contadas com as mensagens recebidas e as deste aparelho. */
    enquetes: () => enquetesDoGrupo(todas()),
  };
}
export type EnqueteNoGrupo = ReturnType<typeof enqueteNoGrupo>;

/** As enquetes do grupo, contadas a partir das mensagens que este aparelho leu, na ordem em que chegaram. */
export function enquetesDoGrupo(mensagens: GrupoDaEnquete["mensagens"]): ResultadoDaEnquete[] {
  const abertas = new Map<string, { r: ResultadoDaEnquete; votos: Map<string, number> }>();
  for (const m of mensagens) {
    if (m.tipo !== "texto" || !m.autor) continue;
    const l = ler(m.corpo);
    if (!l) continue;
    const e = abertas.get(l.id);
    if (l.t === "enquete") {
      if (!e) abertas.set(l.id, { r: { id: l.id, pergunta: l.p, opcoes: l.o, autor: m.autor, fechada: false, votos: [], contagem: null }, votos: new Map() });
    } else if (!e || e.r.fechada) {
      continue;
    } else if (l.t === "fechar") {
      if (m.autor === e.r.autor) e.r.fechada = true;
    } else if (l.o < e.r.opcoes.length) {
      e.votos.set(m.autor, l.o);
    }
  }
  return [...abertas.values()].map(({ r, votos }) => {
    const lista = [...votos.entries()].map(([autor, opcao]) => ({ autor, opcao })).sort((a, b) => (a.autor < b.autor ? -1 : a.autor > b.autor ? 1 : 0));
    const porOpcao = r.opcoes.map((_, i) => lista.filter((v) => v.opcao === i).length);
    // Como na votação da comunidade: com menos de 3 votos, ou com alguma opção com 1 ou 2, os números não aparecem.
    const contagem = lista.length >= 3 && porOpcao.every((n) => n === 0 || n >= 3) ? porOpcao : null;
    return { ...r, votos: lista, contagem };
  });
}
