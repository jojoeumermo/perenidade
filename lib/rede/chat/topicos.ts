// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Tópicos dentro do grupo cifrado (Prompt 4, item 20, atrás de "alumia-p4-conversa"): o grupo (núcleo, grupo do chat) separa a
// conversa em tópicos ("Ato de sábado", "Finanças", "Formação"), com as MESMAS pessoas do grupo. É um TIPO NOVO DE CONTEÚDO DENTRO DO
// CIFRADO: cada linha vai como texto do grupo MLS (lib/rede/membros/grupo.ts, mandarTexto), na caixa anônima da época, em pacote de
// tamanho fixo. O servidor não vê nem que há tópicos, nem os nomes, nem em qual tópico cada mensagem caiu.
//   - abrir, renomear e arquivar tópico: só a mediação do grupo (a lista de papéis assinada que o grupo já tem); de outra pessoa, não
//     conta;
//   - escrever num tópico: qualquer membro apresentado; mensagem para tópico que não existe ou arquivado não conta; texto comum (sem
//     o prefixo) fica no "Geral".
// O que fica de fora (pendência, item 20): tópico com MENOS gente que o grupo (um canal só da coordenação, por exemplo). Isso seria um
// grupo MLS filho, com entrada, saída e troca de época próprias, amarrado ao pai pela mediação: cabe na interface do Grupo, sem mudar
// o protocolo, mas é bem maior que o item e precisa da tela do chat de grupo, que a Alumia ainda não tem.
// Formato (texto do grupo): "alumia/p4/topicos/v1 " seguido de um JSON pequeno. Nada de cifra aqui: a cifra é a do grupo.
// Sem "@/": roda no Node nos testes (scripts/testar-p4-conversa.mjs).
import type { Grupo } from "../membros/grupo";
import type { GrupoDaEnquete } from "../voto/enquete-do-grupo";

export const ROTULOS = { topicos: "alumia/p4/topicos/v1" } as const;
const PREFIXO = `${ROTULOS.topicos} `;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** O nome do tópico até 60 letras; a mensagem, o mesmo teto do texto do chat (2000); até 30 tópicos abertos por grupo. */
export const LIMITES = { nome: 60, texto: 2000, abertos: 30 } as const;

/** O que os tópicos precisam do grupo: o texto cifrado e a lista de papéis (quem é da mediação). */
export interface GrupoDosTopicos extends GrupoDaEnquete {
  readonly papeis: { readonly mediacao: readonly string[] };
}

/** O Grupo do MLS serve aos tópicos como está (conferido pelo typecheck: sem mudar nada no grupo). */
export const GRUPO_SERVE: Grupo extends GrupoDosTopicos ? true : never = true;

type Linha =
  | { t: "topico"; id: string; n: string }
  | { t: "renomear"; id: string; n: string }
  | { t: "arquivar"; id: string }
  | { t: "msg"; id: string; c: string };

export interface MensagemDoTopico {
  autor: string;
  texto: string;
}
export interface Topico {
  id: string;
  nome: string;
  arquivado: boolean;
  mensagens: MensagemDoTopico[];
}
export interface TopicosDoGrupo {
  topicos: Topico[];
  /** O que não é de tópico nenhum (o texto comum do grupo, sem prefixo de nenhum tipo novo). */
  geral: MensagemDoTopico[];
}

const nomeValido = (n: unknown): n is string => typeof n === "string" && !!n.trim() && [...n].length <= LIMITES.nome;

function ler(s: string): Linha | null {
  if (!s.startsWith(PREFIXO) || s.length > 12_000) return null;
  try {
    const j = JSON.parse(s.slice(PREFIXO.length)) as Record<string, unknown>;
    if (typeof j.id !== "string" || !UUID.test(j.id)) return null;
    if (j.t === "topico" || j.t === "renomear") return nomeValido(j.n) ? { t: j.t, id: j.id, n: j.n.trim() } : null;
    if (j.t === "arquivar") return { t: "arquivar", id: j.id };
    if (j.t === "msg") return typeof j.c === "string" && j.c.trim() && [...j.c].length <= LIMITES.texto ? { t: "msg", id: j.id, c: j.c } : null;
  } catch {
    return null;
  }
  return null;
}

/** Os tipos novos do grupo que NÃO são conversa do "Geral" (a enquete, o quem leva, os próprios tópicos). */
const OUTROS_TIPOS = ["alumia/r3/enquete-do-grupo/v1 ", "alumia/p4/quem-leva/v1 "];

/** Os tópicos e o "Geral", a partir das mensagens que este aparelho leu, na ordem em que chegaram. */
export function topicosDoGrupo(mensagens: GrupoDaEnquete["mensagens"], mediacao: readonly string[]): TopicosDoGrupo {
  const topicos = new Map<string, Topico>();
  const geral: MensagemDoTopico[] = [];
  for (const m of mensagens) {
    if (m.tipo !== "texto" || !m.autor) continue;
    let s: string;
    try {
      s = new TextDecoder("utf-8", { fatal: true }).decode(m.corpo);
    } catch {
      continue;
    }
    if (!s.startsWith(PREFIXO)) {
      if (!OUTROS_TIPOS.some((p) => s.startsWith(p))) geral.push({ autor: m.autor, texto: s });
      continue;
    }
    const l = ler(s);
    if (!l) continue;
    const t = topicos.get(l.id);
    if (l.t === "topico") {
      const abertos = [...topicos.values()].filter((x) => !x.arquivado).length;
      if (!t && mediacao.includes(m.autor) && abertos < LIMITES.abertos) topicos.set(l.id, { id: l.id, nome: l.n, arquivado: false, mensagens: [] });
    } else if (!t || t.arquivado) {
      continue;
    } else if (l.t === "msg") {
      t.mensagens.push({ autor: m.autor, texto: l.c });
    } else if (mediacao.includes(m.autor)) {
      if (l.t === "renomear") t.nome = l.n;
      else t.arquivado = true;
    }
  }
  return { topicos: [...topicos.values()], geral };
}

/**
 * Os tópicos num grupo, do ponto de vista deste aparelho (como a enquete do grupo: as linhas próprias ficam guardadas aqui, porque o
 * MLS não devolve a quem escreveu as próprias mensagens). `eu`: a identidade deste aparelho no grupo (b64url).
 */
export function topicosNoGrupo(g: GrupoDosTopicos, eu: string) {
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
  const daMediacao = () => {
    if (!g.papeis.mediacao.includes(eu)) throw new Error("so_mediacao");
  };
  return {
    /** Abre um tópico (só a mediação). Devolve o id. */
    async abrir(nome: string): Promise<string> {
      daMediacao();
      if (!nomeValido(nome)) throw new Error("topico_invalido");
      const id = crypto.randomUUID();
      await mandar({ t: "topico", id, n: nome.trim() });
      return id;
    },
    async renomear(id: string, nome: string): Promise<void> {
      daMediacao();
      if (!UUID.test(id) || !nomeValido(nome)) throw new Error("topico_invalido");
      await mandar({ t: "renomear", id, n: nome.trim() });
    },
    async arquivar(id: string): Promise<void> {
      daMediacao();
      if (!UUID.test(id)) throw new Error("topico_invalido");
      await mandar({ t: "arquivar", id });
    },
    /** Escreve no tópico. */
    async escrever(id: string, texto: string): Promise<void> {
      if (!UUID.test(id) || !texto.trim() || [...texto].length > LIMITES.texto) throw new Error("texto_grande");
      await mandar({ t: "msg", id, c: texto });
    },
    /** Os tópicos e o "Geral", com as mensagens recebidas e as deste aparelho. */
    ler: () => topicosDoGrupo(todas(), g.papeis.mediacao),
  };
}
