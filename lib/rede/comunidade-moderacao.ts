// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A moderação da comunidade (onda 9, frente 9B; supabase/migracoes/20261115-alumia-o9-moderacao.sql): o filtro automático que a
// moderação calibra, a fila de recém-chegados, o alerta de brigada, quanto falta no modo lento, as perguntas para entrar e a
// soneca com prazo. Tipos, as chamadas ao banco (com o dublê da prévia, NEXT_PUBLIC_ALUMIA_PREVIA=sim) e as contas puras que a
// tela usa (as mesmas do banco, conferidas no teste). Sem "@/" de propósito (roda no Node nos testes).
import { chamar, type Chamar } from "./cliente";

/** As regras do filtro automático de uma comunidade, como quem escreve ali as lê (a lista de palavras nunca vem: só se existe). */
export interface AutomodDaComunidade {
  comunidade: string;
  tipo: "aberta" | "restrita" | "fechada";
  links_max: number | null;
  dominios: string[];
  conta_nova_dias: number | null;
  novatos_posts: number | null;
  palavras: boolean;
  explicacao: string;
  /** Modo lento da comunidade, em segundos (0 = desligado). */
  lento: number;
  modero: boolean;
  para_mim: { novata: boolean; lento_falta: number };
  /** Só para quem modera: a partir de quantas contas de fora, em quantos minutos, nasce o alerta de brigada. */
  brigada: { contas: number; minutos: number } | null;
}

/** O que a moderação calibra (campo ausente fica como está; nulo desliga). */
export interface AjustesDoAutomod {
  links_max?: number | null;
  dominios?: string[];
  conta_nova_dias?: number | null;
  novatos_posts?: number | null;
  brigada_contas?: number;
  brigada_minutos?: number;
  explicacao?: string;
}

export interface AlertaDeBrigada {
  id: string;
  comunidade: string;
  post: string;
  /** Quantas contas de fora responderam (sempre 3 ou mais). Nunca quais. */
  contas: number;
  minutos: number;
  criado_em: string;
  atualizado_em: string;
  titulo: string | null;
  trecho: string | null;
  lento: number;
  travado: boolean;
}

export interface PedidoComRespostas {
  usuario: string;
  codinome: string;
  quando: string;
  respostas: string[];
}

export interface PedidosComRespostas {
  perguntas: string[];
  itens: PedidoComRespostas[];
}

export interface LentoFalta {
  segundos: number;
  falta: number;
}

/** Os motivos que o filtro grava no post retido (rede_posts.motivo) e a tela traduz. */
export const MOTIVOS_DO_FILTRO = ["automod_links", "automod_dominio", "automod_conta_nova", "recem_chegada", "lista_da_mediacao", "precaucao"] as const;
export type MotivoDoFiltro = (typeof MOTIVOS_DO_FILTRO)[number];

/** As opções do modo lento, em segundos (0 desliga). O banco aceita de 5 s a 24 h; a tela oferece minutos e horas. */
export const OPCOES_DO_LENTO = [0, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600, 86400] as const;

/** A soneca (silenciar com prazo): 1 dia, 1 semana, 1 mês ou até desfazer (nulo). O banco aceita de 1 a 365 dias. */
export const PRAZOS_DA_SONECA = [1, 7, 30, null] as const;
export type PrazoDaSoneca = (typeof PRAZOS_DA_SONECA)[number];

/** Os limites que o banco confere (a tela usa os mesmos). */
export const LIMITES = {
  linksMax: 20,
  dominios: 50,
  contaNovaDias: 90,
  novatosPosts: 10,
  brigadaContasMin: 3,
  brigadaContasMax: 500,
  brigadaMinutosMin: 5,
  brigadaMinutosMax: 1440,
  explicacao: 600,
  perguntas: 3,
  perguntaMin: 5,
  perguntaMax: 200,
  resposta: 500,
} as const;

// ── Contas puras (as mesmas do banco) ────────────────────────────────────────────────────────────────────────────────────

/** Quantos links um texto tem (interno.alumia_o9_links). */
export function contarLinks(texto: string): number {
  return (texto.match(/(https?:\/\/|www\.)/gi) ?? []).length;
}

/** Os domínios dos links de um texto, em minúsculas e sem "www." (interno.alumia_o9_dominios). */
export function dominiosDoTexto(texto: string): string[] {
  const achados = new Set<string>();
  for (const m of texto.matchAll(/(?:https?:\/\/|(?=www\.))([a-z0-9.-]+\.[a-z]{2,})/gi)) achados.add(m[1].toLowerCase().replace(/^www\./, ""));
  return [...achados];
}

/** O domínio como a moderação escreveu vira o que o banco guarda; lixo vira nulo. */
export function limparDominio(bruto: string): string | null {
  const d = bruto.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "");
  if (!d) return null;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) && d.length <= 80 ? d : null;
}

/**
 * O que o filtro faria com este texto, para a tela avisar ANTES de postar (o banco decide de novo, e só ele sabe da lista de
 * palavras). A ordem é a do gatilho: links, domínio, recém-chegada.
 */
export function previsaoDoFiltro(regras: Pick<AutomodDaComunidade, "links_max" | "dominios" | "modero" | "para_mim" | "novatos_posts">, texto: string): MotivoDoFiltro | null {
  if (regras.modero) return null;
  if (regras.links_max !== null && contarLinks(texto) > regras.links_max) return "automod_links";
  if (regras.dominios.length > 0) {
    const hosts = dominiosDoTexto(texto);
    if (hosts.some((h) => regras.dominios.some((d) => h === d || h.endsWith(`.${d}`)))) return "automod_dominio";
  }
  if (regras.para_mim.novata) return regras.novatos_posts === null ? "automod_conta_nova" : "recem_chegada";
  return null;
}

/** Segundos em minutos ou horas, arredondados para cima (para "1 post a cada 10 min" e "falta 3 min"). */
export function emMinutos(segundos: number): { n: number; unidade: "s" | "min" | "h" } {
  if (segundos <= 0) return { n: 0, unidade: "min" };
  if (segundos < 60) return { n: Math.ceil(segundos), unidade: "s" };
  if (segundos < 3600 || segundos % 3600 !== 0) {
    const min = Math.ceil(segundos / 60);
    return min >= 120 && min % 60 === 0 ? { n: min / 60, unidade: "h" } : { n: min, unidade: "min" };
  }
  return { n: segundos / 3600, unidade: "h" };
}

/** Os textos de unidade que emMinutos pede (do pacote de textos). */
export interface TextosDeTempo {
  s: string;
  min: string;
  h: string;
}

/** "10 min", "2 h", "30 s" com as palavras do pacote ({n} em cada uma). */
export function tempoEscrito(t: TextosDeTempo, segundos: number): string {
  const { n, unidade } = emMinutos(segundos);
  return t[unidade].replace("{n}", String(n));
}

// ── Chamadas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function criarClienteDaModeracaoDaComunidade(c: Chamar) {
  return {
    automod: (slug: string) => c<AutomodDaComunidade>("alumia_mod_automod", { p_slug: slug }),
    salvarAutomod: (slug: string, ajustes: AjustesDoAutomod) => c<AutomodDaComunidade>("alumia_mod_automod_salvar", { p_slug: slug, p: ajustes }),
    lentoFalta: (tipo: "comunidade" | "conversa", alvo: string) => c<LentoFalta>("alumia_mod_lento_falta", { p_tipo: tipo, p_alvo: alvo }),
    brigadas: () => c<AlertaDeBrigada[]>("alumia_mod_brigadas", {}),
    encerrarBrigada: (id: string) => c<{ ok: boolean }>("alumia_mod_brigada_encerrar", { p_id: id }),
    perguntas: (slug: string) => c<{ perguntas: string[] }>("alumia_com_perguntas", { p_slug: slug }),
    salvarPerguntas: (slug: string, perguntas: string[]) => c<{ perguntas: string[] }>("alumia_com_perguntas_salvar", { p_slug: slug, p_perguntas: perguntas }),
    pedir: (slug: string, respostas: string[]) => c<{ situacao: "membro" | "pendente" | "banido" | null }>("alumia_com_pedir", { p_slug: slug, p_respostas: respostas }),
    pedidos: (slug: string) => c<PedidosComRespostas>("alumia_com_pedidos", { p_slug: slug }),
  };
}

export const PREVIA_DA_MODERACAO = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

const MIN = 60_000;
const antes = (minutos: number) => new Date(Date.now() - minutos * MIN).toISOString();

/** O dublê da prévia: as mesmas formas que o banco devolve, com exemplos. Nada vai ao banco. */
function chamarDuble(): Chamar {
  let automod: AutomodDaComunidade = {
    comunidade: "moradia", tipo: "restrita", links_max: 1, dominios: ["encurta.exemplo"], conta_nova_dias: 7, novatos_posts: 2, palavras: true,
    explicacao: "Post com mais de um link, link de encurtador ou os dois primeiros posts de conta com menos de 7 dias esperam a leitura da moderação. Nada é apagado: a moderação lê e libera.",
    lento: 600, modero: true, para_mim: { novata: false, lento_falta: 0 }, brigada: { contas: 10, minutos: 30 },
  };
  let brigadas: AlertaDeBrigada[] = [
    { id: "b1", comunidade: "moradia", post: "p-brigada", contas: 23, minutos: 30, criado_em: antes(18), atualizado_em: antes(2),
      titulo: null, trecho: "Ocupação na Rua do Carmo resiste há 40 dias. Precisamos de lona, água e advogada popular amanhã às 7h.", lento: 0, travado: false },
  ];
  let perguntas = ["Em que bairro você mora ou atua?", "Por que quer entrar nesta comunidade?"];
  let pedidos: PedidoComRespostas[] = [
    { usuario: "u1", codinome: "Faísca do Norte", quando: antes(240), respostas: ["Vila Esperança, zona norte.", "Faço parte da comissão de moradores e quero aprender com outras ocupações."] },
    { usuario: "u2", codinome: "Rua de Baixo", quando: antes(55), respostas: ["Centro.", "Fui despejada em março e quero ajudar quem está passando pelo mesmo."] },
  ];
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => {
    await new Promise((r) => setTimeout(r, 200));
    switch (funcao) {
      case "alumia_mod_automod":
        return { ...automod, comunidade: String(argumentos.p_slug ?? automod.comunidade) } as T;
      case "alumia_mod_automod_salvar": {
        const p = (argumentos.p ?? {}) as AjustesDoAutomod;
        automod = {
          ...automod,
          ...("links_max" in p ? { links_max: p.links_max ?? null } : {}),
          ...(p.dominios ? { dominios: p.dominios } : {}),
          ...("conta_nova_dias" in p ? { conta_nova_dias: p.conta_nova_dias ?? null } : {}),
          ...("novatos_posts" in p ? { novatos_posts: p.novatos_posts ?? null } : {}),
          ...(p.explicacao !== undefined ? { explicacao: p.explicacao } : {}),
          brigada: { contas: p.brigada_contas ?? automod.brigada?.contas ?? 10, minutos: p.brigada_minutos ?? automod.brigada?.minutos ?? 30 },
        };
        return automod as T;
      }
      case "alumia_mod_lento_falta":
        return { segundos: 600, falta: 0 } as T;
      case "alumia_mod_brigadas":
        return brigadas as T;
      case "alumia_mod_brigada_encerrar":
        brigadas = brigadas.filter((b) => b.id !== argumentos.p_id);
        return { ok: true } as T;
      case "alumia_com_perguntas":
        return { perguntas } as T;
      case "alumia_com_perguntas_salvar":
        perguntas = ((argumentos.p_perguntas as string[]) ?? []).filter((q) => q.trim());
        return { perguntas } as T;
      case "alumia_com_pedir":
        return { situacao: "pendente" } as T;
      case "alumia_com_pedidos":
        return { perguntas, itens: pedidos } as T;
      case "rede_com_decidir_pedido":
        pedidos = pedidos.filter((p) => p.usuario !== argumentos.p_usuario);
        return { ok: true } as T;
      default:
        return { ok: true } as T;
    }
  };
}

/** O que a tela chama: o banco de verdade, ou o dublê na prévia. */
export const chamarDaModeracao: Chamar = PREVIA_DA_MODERACAO ? chamarDuble() : chamar;
export const moderacaoDaComunidade = criarClienteDaModeracaoDaComunidade(chamarDaModeracao);
