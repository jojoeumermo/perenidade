// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A decisão e os números da comunidade (onda 10, frente 10E; supabase/migracoes/20261116-alumia-o10-decisao.sql): a votação interna
// com quórum e prazo (secreta ou aberta, escolhida na abertura) e os números da semana para a moderação. Tipos, as chamadas ao banco
// (com o dublê da prévia, NEXT_PUBLIC_ALUMIA_PREVIA=sim) e o voto secreto pelo MESMO esquema da consulta à base:
//   - a cédula sai CIFRADA deste aparelho (lib/rede/voto/cedula.ts, a Web Crypto do navegador; nada feito à mão) com a chave pública
//     da votação, que o servidor do site deriva do segredo dele (app/api/alumia/decisao/chave);
//   - só quando o servidor responde que não tem o segredo do voto ("sem_servico") ela vai pela urna do banco, sem cifra. Freio, falta
//     de rede ou cifra que falhou viram erro na tela: o voto nunca cai em silêncio para o caminho sem cifra;
//   - fechada a votação, a tela pede ao servidor para abrir todas as cédulas de uma vez (app/api/alumia/decisao/abrir).
// Sem os atalhos "@/" de propósito (roda no Node nos testes).
import { BackendError, getClient, hasBackend, localBackend, rpc } from "../../backend";
import { cifrarCedula } from "../voto/cedula";

export type ModoDaDecisao = "secreta" | "aberta";
export type SituacaoDaDecisao = "aberta" | "fechada" | "cancelada";
export type Impedimento = "ja_votou" | "fechada" | "nao_membro" | "chegou_depois" | "entre_na_alumia";

export interface OpcaoDaDecisao {
  id: string;
  texto: string;
  /** Só no fechamento, com o resultado valendo, e só a partir de 3 (abaixo, nulo e "poucos"). */
  votos: number | null;
  poucos: boolean;
  vencedora: boolean;
  /** Só no modo aberto e só no fechamento: os nomes de quem escolheu esta opção. */
  quem: string[] | null;
}

export interface Decisao {
  id: string;
  pergunta: string;
  explicacao: string;
  modo: ModoDaDecisao;
  quorum: number;
  prazo: string;
  criada_em: string;
  situacao: SituacaoDaDecisao;
  votei: boolean;
  possoVotar: boolean;
  /** Por que não pode votar (só com a votação aberta). */
  impedimento: Impedimento | null;
  /** Fechada com cédula cifrada ainda fechada: a tela pede a apuração ao servidor. */
  apurar: boolean;
  /** Quantas pessoas votaram: só no fechamento e só a partir de 3. */
  votantes: number | null;
  quorumAtingido: boolean | null;
  /** O resultado saiu (fechada, apurada, 3 votos ou mais e quórum). */
  resultado: boolean;
  /** Com o resultado: os números aparecem. Falso na secreta quando alguma opção teve 1 ou 2 votos (o pequeno sairia por subtração). */
  numeros?: boolean;
  empate: boolean;
  opcoes: OpcaoDaDecisao[];
}

export interface DecisoesDaComunidade {
  comunidade: string;
  modero: boolean;
  membro: boolean;
  decisoes: Decisao[];
}

export interface PedidoDeDecisao {
  pergunta: string;
  explicacao: string;
  opcoes: string[];
  modo: ModoDaDecisao;
  quorum: number;
  /** ISO. */
  prazo: string;
}

export interface SemanaDaComunidade {
  /** A segunda-feira da semana (AAAA-MM-DD). */
  semana: string;
  posts: number | null;
  respostas: number | null;
  membros_novos: number | null;
  denuncias: number | null;
  decididas: number | null;
  /** Mediana, em horas, do tempo até a primeira decisão registrada (com 3 decisões ou mais). */
  resposta_horas: number | null;
}

export interface NumerosDaComunidade {
  comunidade: string;
  /** Da mais nova para a mais velha (8 semanas). */
  semanas: SemanaDaComunidade[];
  denuncias_abertas: number | null;
  votacoes_abertas: number;
}

/** Os limites que o banco confere (a tela usa os mesmos). */
export const LIMITES_DA_DECISAO = {
  perguntaMin: 5,
  perguntaMax: 200,
  explicacaoMax: 1000,
  opcoesMin: 2,
  opcoesMax: 8,
  opcaoMax: 120,
  quorumMin: 3,
  quorumMax: 100000,
  prazoMinHoras: 1,
  prazoMaxDias: 60,
  abertasMax: 5,
} as const;

/** Quanto falta até o prazo, em dias e horas inteiros (nulo se já passou). */
export function faltaAte(prazo: string, agora: number = Date.now()): { dias: number; horas: number; minutos: number } | null {
  const ms = new Date(prazo).getTime() - agora;
  if (!(ms > 0)) return null;
  const min = Math.ceil(ms / 60_000);
  return { dias: Math.floor(min / 1440), horas: Math.floor((min % 1440) / 60), minutos: min % 60 };
}

/** A maior contagem visível do resultado (para a largura das barras); nulo quando nenhum número pode aparecer. */
export function maiorVisivel(opcoes: Pick<OpcaoDaDecisao, "votos">[]): number | null {
  const n = opcoes.map((o) => o.votos).filter((v): v is number => typeof v === "number");
  return n.length ? Math.max(...n) : null;
}

/** O que a tela manda ao banco: textos aparados, opções vazias de fora. */
export function limparPedido(p: PedidoDeDecisao): PedidoDeDecisao {
  return { ...p, pergunta: p.pergunta.trim(), explicacao: p.explicacao.trim(), opcoes: p.opcoes.map((o) => o.trim()).filter(Boolean) };
}

/** O pedido vale? Devolve o primeiro campo errado (o mesmo nome do erro do banco) ou nulo. */
export function conferirPedido(p: PedidoDeDecisao, agora: number = Date.now()): "pergunta" | "explicacao" | "opcoes" | "quorum" | "prazo" | null {
  const L = LIMITES_DA_DECISAO;
  const q = limparPedido(p);
  if (q.pergunta.length < L.perguntaMin || q.pergunta.length > L.perguntaMax) return "pergunta";
  if (q.explicacao.length > L.explicacaoMax) return "explicacao";
  if (q.opcoes.length < L.opcoesMin || q.opcoes.length > L.opcoesMax || q.opcoes.some((o) => o.length > L.opcaoMax)) return "opcoes";
  if (new Set(q.opcoes.map((o) => o.toLocaleLowerCase())).size !== q.opcoes.length) return "opcoes";
  if (!Number.isInteger(q.quorum) || q.quorum < L.quorumMin || q.quorum > L.quorumMax) return "quorum";
  const t = new Date(q.prazo).getTime();
  if (!(t >= agora + L.prazoMinHoras * 3_600_000) || t > agora + L.prazoMaxDias * 86_400_000) return "prazo";
  return null;
}

// ── O servidor do site (a chave e a apuração do voto secreto) ──────────────────────────────────────────────────────────────

async function token(): Promise<string> {
  const supabase = await getClient();
  const t = (await supabase.auth.getSession()).data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

async function postar(caminho: string, corpo: unknown): Promise<Record<string, unknown> | null> {
  let r: Response;
  try {
    r = await fetch(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(corpo),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    if (e instanceof BackendError) throw e;
    throw new BackendError("sem_conexao");
  }
  return (await r.json().catch(() => null)) as Record<string, unknown> | null;
}

// A chave pública de cada votação, guardada na memória desta aba (é pública; poupa pedidos ao servidor).
const chaves = new Map<string, string>();

/** A chave pública da votação, ou nulo SÓ quando o servidor diz que não tem o segredo do voto. Outra recusa vira erro. */
async function chaveDaDecisao(decisao: string): Promise<string | null> {
  const guardada = chaves.get(decisao);
  if (guardada) return guardada;
  const r = await postar("/api/alumia/decisao/chave", { decisao });
  if (r?.ok && typeof r.chave === "string") {
    chaves.set(decisao, r.chave);
    return r.chave;
  }
  if (r?.motivo === "sem_servico") return null;
  throw new BackendError(typeof r?.motivo === "string" ? r.motivo : "falha");
}

/** Pede ao servidor para abrir as cédulas cifradas de uma votação fechada. Verdadeiro se abriu (a tela recarrega). */
export async function apurarDecisao(decisao: string): Promise<boolean> {
  if (!hasBackend || localBackend || PREVIA_DA_DECISAO) return false;
  try {
    const r = await postar("/api/alumia/decisao/abrir", { decisao });
    return r?.ok === true;
  } catch {
    return false;
  }
}

// ── Chamadas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Chamar = <T>(funcao: string, argumentos?: Record<string, unknown>) => Promise<T>;

export function criarClienteDaDecisao(c: Chamar, cifrar: boolean) {
  return {
    lista: (slug: string) => c<DecisoesDaComunidade>("alumia_decisao_lista", { p_slug: slug }),
    criar: (slug: string, p: PedidoDeDecisao) => c<Decisao>("alumia_decisao_criar", { p_slug: slug, p: limparPedido(p) }),
    cancelar: (id: string) => c<Decisao>("alumia_decisao_cancelar", { p_id: id }),
    numeros: (slug: string) => c<NumerosDaComunidade>("alumia_decisao_numeros", { p_slug: slug }),
    /**
     * Vota. No modo aberto, direto ao banco (o nome vai junto, e a pessoa confirmou antes). No secreto, a cédula cifrada neste
     * aparelho; a urna do banco sem cifra só quando o servidor não tem o segredo do voto.
     */
    votar: async (d: Pick<Decisao, "id" | "modo">, opcao: string): Promise<{ votei: true }> => {
      if (d.modo === "aberta" || !cifrar) return c<{ votei: true }>("alumia_decisao_votar", { p_id: d.id, p_opcao: opcao });
      const chave = await chaveDaDecisao(d.id);
      if (chave === null) return c<{ votei: true }>("alumia_decisao_votar", { p_id: d.id, p_opcao: opcao });
      let cedula: string;
      try {
        cedula = await cifrarCedula(d.id, chave, [opcao]);
      } catch {
        throw new BackendError("falha");
      }
      return c<{ votei: true }>("alumia_decisao_votar_cifrada", { p_id: d.id, p_cedula: cedula });
    },
  };
}

export const PREVIA_DA_DECISAO = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

// ── O dublê da prévia: as mesmas formas que o banco devolve, com exemplos. Nada vai ao banco. ──

const HORA = 3_600_000;
const daqui = (horas: number) => new Date(Date.now() + horas * HORA).toISOString();
const op = (id: string, texto: string, extra: Partial<OpcaoDaDecisao> = {}): OpcaoDaDecisao => ({ id, texto, votos: null, poucos: false, vencedora: false, quem: null, ...extra });

function exemplos(slug: string): DecisoesDaComunidade {
  return {
    comunidade: slug,
    modero: true,
    membro: true,
    decisoes: [
      {
        id: "d-mutirao", pergunta: "Qual dia fazemos o mutirão de reforma na Ocupação Carmo?", modo: "secreta", quorum: 12, prazo: daqui(52), criada_em: daqui(-20),
        explicacao: "A comissão de obras topa qualquer um dos três. Quem não puder ir no dia escolhido ajuda na vaquinha do material.",
        situacao: "aberta", votei: false, possoVotar: true, impedimento: null, apurar: false, votantes: null, quorumAtingido: null, resultado: false, empate: false,
        opcoes: [op("o1", "Sábado, 22/11"), op("o2", "Domingo, 23/11"), op("o3", "Feriado de 20/11")],
      },
      {
        id: "d-porta-voz", pergunta: "Quem leva a pauta da moradia à plenária da frente?", modo: "aberta", quorum: 8, prazo: daqui(7), criada_em: daqui(-30),
        explicacao: "Votação aberta: o seu nome aparece junto do voto quando a votação fechar.",
        situacao: "aberta", votei: false, possoVotar: true, impedimento: null, apurar: false, votantes: null, quorumAtingido: null, resultado: false, empate: false,
        opcoes: [op("p1", "A comissão de moradores"), op("p2", "Rodízio entre os núcleos")],
      },
      {
        id: "d-nota", pergunta: "Assinamos a nota conjunta contra o despejo da Vila Esperança?", modo: "secreta", quorum: 10, prazo: daqui(-26), criada_em: daqui(-100),
        explicacao: "",
        situacao: "fechada", votei: true, possoVotar: false, impedimento: null, apurar: false, votantes: 31, quorumAtingido: true, resultado: true, empate: false,
        opcoes: [op("n1", "Sim, como coletivo", { votos: 24, vencedora: true }), op("n2", "Não", { votos: 5 }), op("n3", "Só com mudanças no texto", { poucos: true })],
      },
      {
        id: "d-sede", pergunta: "Mudamos a reunião mensal para a sede do sindicato?", modo: "secreta", quorum: 15, prazo: daqui(-200), criada_em: daqui(-300),
        explicacao: "",
        situacao: "fechada", votei: false, possoVotar: false, impedimento: null, apurar: false, votantes: 9, quorumAtingido: false, resultado: false, empate: false,
        opcoes: [op("s1", "Sim"), op("s2", "Não")],
      },
    ],
  };
}

function numerosDeExemplo(slug: string): NumerosDaComunidade {
  const hoje = new Date();
  const segunda = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - ((hoje.getUTCDay() + 6) % 7)));
  const linha = (i: number, posts: number | null, respostas: number | null, membros: number | null, den: number | null, dec: number | null, horas: number | null): SemanaDaComunidade => ({
    semana: new Date(segunda.getTime() - i * 7 * 86_400_000).toISOString().slice(0, 10),
    posts, respostas, membros_novos: membros, denuncias: den, decididas: dec, resposta_horas: horas,
  });
  return {
    comunidade: slug,
    semanas: [
      linha(0, 23, 87, 6, 4, 3, 5.5),
      linha(1, 31, 112, 9, 7, 7, 3.2),
      linha(2, 18, 64, 4, null, null, null),
      linha(3, 26, 95, 11, 5, 4, 8.0),
      linha(4, 14, 40, null, null, null, null),
      linha(5, 20, 71, 3, 3, 3, 12.5),
      linha(6, 9, 28, null, null, null, null),
      linha(7, 12, 33, 5, null, null, null),
    ],
    denuncias_abertas: null,
    votacoes_abertas: 2,
  };
}

function chamarDuble(): Chamar {
  const porSlug = new Map<string, DecisoesDaComunidade>();
  const lista = (slug: string) => {
    if (!porSlug.has(slug)) porSlug.set(slug, exemplos(slug));
    return porSlug.get(slug)!;
  };
  const acha = (id: string) => [...porSlug.values()].flatMap((l) => l.decisoes).find((d) => d.id === id);
  return async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    await new Promise((r) => setTimeout(r, 180));
    switch (funcao) {
      case "alumia_decisao_lista":
        return structuredClone(lista(String(a.p_slug))) as T;
      case "alumia_decisao_numeros":
        return numerosDeExemplo(String(a.p_slug)) as T;
      case "alumia_decisao_criar": {
        const p = a.p as PedidoDeDecisao;
        const d: Decisao = {
          id: `d-${Date.now()}`, pergunta: p.pergunta, explicacao: p.explicacao, modo: p.modo, quorum: p.quorum, prazo: p.prazo, criada_em: new Date().toISOString(),
          situacao: "aberta", votei: false, possoVotar: true, impedimento: null, apurar: false, votantes: null, quorumAtingido: null, resultado: false, empate: false,
          opcoes: p.opcoes.map((t, i) => op(`n${Date.now()}-${i}`, t)),
        };
        lista(String(a.p_slug)).decisoes.unshift(d);
        return structuredClone(d) as T;
      }
      case "alumia_decisao_cancelar": {
        const d = acha(String(a.p_id));
        if (!d) throw new BackendError("nao_encontrado");
        Object.assign(d, { situacao: "cancelada", possoVotar: false });
        return structuredClone(d) as T;
      }
      case "alumia_decisao_votar":
      case "alumia_decisao_votar_cifrada": {
        const d = acha(String(a.p_id));
        if (!d) throw new BackendError("nao_encontrado");
        if (d.votei) throw new BackendError("ja_votou");
        Object.assign(d, { votei: true, possoVotar: false, impedimento: "ja_votou" });
        return { votei: true } as T;
      }
      default:
        throw new BackendError("falha");
    }
  };
}

/** O cliente: na prévia, o dublê; na cópia local de testes (sem as rotas do servidor), tudo direto ao banco. */
export const decisao = criarClienteDaDecisao(PREVIA_DA_DECISAO ? chamarDuble() : (f, a) => rpc(f, a ?? {}), hasBackend && !localBackend && !PREVIA_DA_DECISAO);
