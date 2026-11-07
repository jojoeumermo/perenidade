// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O freio do assistente aberto a todo o site (app/api/assistente/route.ts): limite por pessoa e limite do site inteiro,
// sem guardar quem é a pessoa.
//
// Privacidade (LGPD, art. 6º, III, necessidade, e art. 12, dado anonimizado): o endereço de rede (IP) é lido só para
// calcular, na hora, um resumo (HMAC-SHA-256) com um sal aleatório que nasce na memória do servidor a cada dia e morre
// com ele. O IP nunca é gravado, registrado nem enviado a ninguém; o resumo fica só na memória, junto com a contagem, e
// tudo some na virada do dia (horário de Brasília) ou quando o servidor reinicia. Sem o sal (que nunca sai da memória),
// não dá para voltar do resumo ao IP, e o resumo de hoje não se liga ao de amanhã.
//
// Sem os atalhos "@/" de propósito: scripts/testar-assistente.mjs roda este arquivo direto no Node.
import { createHmac, randomBytes } from "node:crypto";

export interface Limites {
  /** Perguntas por pessoa numa janela móvel de uma hora. */
  porHora: number;
  /** Perguntas por pessoa no dia (horário de Brasília). */
  porDia: number;
  /** Perguntas do site inteiro no dia, para não estourar as cotas gratuitas dos provedores. */
  globalDia: number;
}

export const LIMITES_PADRAO: Limites = { porHora: 40, porDia: 150, globalDia: 1200 };

const HORA = 3_600_000;
/** O Brasil não tem horário de verão desde 2019: o dia de Brasília é o UTC menos 3 horas. */
export const diaDeBrasilia = (agora: number): string => new Date(agora - 3 * HORA).toISOString().slice(0, 10);

/** Um número inteiro positivo da configuração, ou o padrão. */
export function numeroDaConfig(valor: string | undefined, padrao: number, maximo = 1_000_000): number {
  const n = Number((valor ?? "").trim());
  return Number.isInteger(n) && n > 0 && n <= maximo ? n : padrao;
}

export function limitesDaConfig(env: Record<string, string | undefined>): Limites {
  return {
    porHora: numeroDaConfig(env.ASSISTENTE_POR_HORA, LIMITES_PADRAO.porHora),
    porDia: numeroDaConfig(env.ASSISTENTE_POR_DIA, LIMITES_PADRAO.porDia),
    globalDia: numeroDaConfig(env.ASSISTENTE_LIMITE_GLOBAL, LIMITES_PADRAO.globalDia),
  };
}

/**
 * O IP de quem pede, só para virar resumo. Atrás do Cloudflare (o firewall da VPS só deixa o Cloudflare chegar, e o Caddy
 * só confia nos endereços dele: infra/contabo/Caddyfile), vale o CF-Connecting-IP; sem ele, o primeiro do X-Forwarded-For
 * e depois o X-Real-IP. IPv6 conta pelo prefixo /64: cada casa costuma ganhar um /64 inteiro, e contar endereço por
 * endereço deixaria qualquer um trocar de "pessoa" a cada pergunta.
 */
export function ipDoPedido(cabecalhos: { get(nome: string): string | null }): string {
  const bruto = cabecalhos.get("cf-connecting-ip")?.trim() || cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip")?.trim() || "";
  const ip = bruto.replace(/^\[|\](:\d+)?$/g, "").toLowerCase();
  if (!ip) return "sem-ip";
  if (ip.includes(":") && !/^::ffff:\d/.test(ip)) {
    const [antes, depois = ""] = ip.split("::");
    const esquerda = antes ? antes.split(":") : [];
    const direita = ip.includes("::") ? (depois ? depois.split(":") : []) : [];
    const cheio = ip.includes("::") ? [...esquerda, ...Array(Math.max(0, 8 - esquerda.length - direita.length)).fill("0"), ...direita] : ip.split(":");
    return `${cheio.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
  }
  return ip.replace(/^::ffff:/, "");
}

export type Resultado =
  | { ok: true; restantesHora: number; restantesDia: number }
  | { ok: false; motivo: "hora" | "dia" | "global"; tentarEm: number };

/**
 * Cria o limitador, todo na memória. `agora` e `sortear` são trocáveis para o teste. O sal do dia nasce no primeiro pedido
 * do dia; na virada, contagens, resumos e sal velhos são jogados fora juntos.
 */
export function criarLimitador(limites: Limites, opcoes: { agora?: () => number; sortear?: () => Buffer } = {}) {
  const agora = opcoes.agora ?? Date.now;
  const sortear = opcoes.sortear ?? (() => randomBytes(32));
  let dia = "";
  let sal: Buffer = Buffer.alloc(0);
  let global = 0;
  /** resumo → momentos das perguntas da última hora */
  const naHora = new Map<string, number[]>();
  /** resumo → perguntas no dia */
  const noDia = new Map<string, number>();

  function virarODia(t: number) {
    const hoje = diaDeBrasilia(t);
    if (hoje === dia) return;
    dia = hoje;
    sal = sortear();
    global = 0;
    naHora.clear();
    noDia.clear();
  }

  /** O resumo do IP com o sal de hoje. É só isto que fica na memória. */
  function resumo(ip: string): string {
    virarODia(agora());
    return createHmac("sha256", sal).update(ip).digest("base64url").slice(0, 22);
  }

  function recentes(chave: string, t: number): number[] {
    const lista = (naHora.get(chave) ?? []).filter((m) => m > t - HORA);
    if (lista.length) naHora.set(chave, lista);
    else naHora.delete(chave);
    return lista;
  }

  function limpar(t: number) {
    if (naHora.size < 5000) return;
    for (const chave of [...naHora.keys()]) recentes(chave, t);
  }

  /** Tenta gastar uma pergunta de quem tem este IP. */
  function consumir(ip: string): Resultado & { chave: string } {
    const t = agora();
    const chave = resumo(ip);
    const amanha = Date.parse(`${dia}T03:00:00Z`) + 24 * HORA;
    const lista = recentes(chave, t);
    if (lista.length >= limites.porHora) return { ok: false, motivo: "hora", tentarEm: Math.max(1, Math.ceil((lista[0] + HORA - t) / 1000)), chave };
    const doDia = noDia.get(chave) ?? 0;
    if (doDia >= limites.porDia) return { ok: false, motivo: "dia", tentarEm: Math.max(1, Math.ceil((amanha - t) / 1000)), chave };
    if (global >= limites.globalDia) return { ok: false, motivo: "global", tentarEm: Math.max(1, Math.ceil((amanha - t) / 1000)), chave };
    global++;
    noDia.set(chave, doDia + 1);
    naHora.set(chave, [...lista, t]);
    limpar(t);
    return { ok: true, restantesHora: limites.porHora - lista.length - 1, restantesDia: limites.porDia - doDia - 1, chave };
  }

  /** Devolve a pergunta quando nenhum provedor respondeu: falha do serviço não conta contra a pessoa. */
  function devolver(chave: string) {
    if (!noDia.has(chave)) return;
    global = Math.max(0, global - 1);
    noDia.set(chave, Math.max(0, (noDia.get(chave) ?? 1) - 1));
    const lista = naHora.get(chave) ?? [];
    lista.pop();
    if (lista.length) naHora.set(chave, lista);
    else naHora.delete(chave);
  }

  /** Só números, para o teste e para o estado público (nunca os resumos). */
  function estado() {
    virarODia(agora());
    return { dia, global, pessoas: noDia.size };
  }

  return { consumir, devolver, estado, resumo };
}

/**
 * O rodízio dos provedores gratuitos: cada pergunta começa por um diferente (para a cota se espalhar), e quem acabou de
 * dizer "chega" (limite, chave recusada, fora do ar) descansa um tempo antes de voltar à roda.
 */
export function criarRodizio(opcoes: { agora?: () => number } = {}) {
  const agora = opcoes.agora ?? Date.now;
  let vez = 0;
  const descanso = new Map<string, number>();
  const DESCANSO: Record<string, number> = { limite: 120_000, chave_recusada: 30 * 60_000, indisponivel: 60_000, tempo_esgotado: 30_000, sem_conexao: 30_000, pedido_recusado: 10 * 60_000 };

  function ordem(ids: string[]): string[] {
    const t = agora();
    const prontos = ids.filter((id) => (descanso.get(id) ?? 0) <= t);
    // Todos descansando: tenta todos assim mesmo (melhor uma tentativa do que nenhuma).
    const roda = prontos.length ? prontos : ids;
    if (!roda.length) return [];
    const inicio = vez++ % roda.length;
    return [...roda.slice(inicio), ...roda.slice(0, inicio)];
  }

  function falhou(id: string, falha: string) {
    const ms = DESCANSO[falha];
    if (ms) descanso.set(id, agora() + ms);
  }

  return { ordem, falhou };
}
