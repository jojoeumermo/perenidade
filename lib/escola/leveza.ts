// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leveza e alcance da aula (Etapa 4, pacote E4-17; docs/escola/leveza.md): quando convidar para o modo pacote de dados,
// a resposta ao convite, a soma do que a página gastou da rede, o tamanho do texto puro, o índice de vídeos em Libras com
// intérprete (começa vazio) e os endereços de "levar esta aula". Tudo puro e sem leitura de disco: nada de fs, só um JSON
// pequeno importado. Sem os atalhos "@/" de propósito: `npm run testar:leveza` roda este arquivo direto no Node.

import librasAulas from "../../content/escola/libras-aulas.json";

export const CHAVES_DA_LEVEZA = {
  CONVITE: "lucia:modo-pacote-convite",
  AULA_LEVE: "lucia:escola:aula-leve",
} as const;

/** Dias até o convite voltar, depois de um "Agora não". */
export const DIAS_DEPOIS = 14;

// ---------------------------------------------------------------------------------------------------------------------
// Convite do modo pacote

export const RESPOSTAS = ["aceito", "depois", "nunca"] as const;
export type Resposta = (typeof RESPOSTAS)[number];
export interface RespostaDoConvite {
  resposta: Resposta;
  /** AAAA-MM-DD */
  em: string;
}
export type MotivoDoConvite = "pacote-acaba" | "economia-do-aparelho" | "rede-lenta";
export type TipoDeRede = "slow-2g" | "2g" | "3g" | "4g" | undefined;

export interface EntradaDoConvite {
  pacoteLigado: boolean;
  /** Matricula.acesso, ou null sem matrícula. */
  acesso: string | null;
  saveData: boolean;
  tipoDeRede: TipoDeRede;
  resposta: RespostaDoConvite | null;
  /** AAAA-MM-DD */
  hoje: string;
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

function dia(data: string): number | null {
  const m = DATA.exec(data);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // Recusa 2026-02-31 e parecidos (Date empurraria para março).
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? ms : null;
}

export function diasEntre(de: string, ate: string): number | null {
  const a = dia(de);
  const b = dia(ate);
  return a === null || b === null ? null : Math.round((b - a) / 86_400_000);
}

/** Decide se o convite do modo pacote aparece, e por quê. Sem motivo nenhum, não convida. */
export function deveConvidar(entrada: EntradaDoConvite): { convidar: boolean; motivo: MotivoDoConvite | null } {
  const nao = { convidar: false, motivo: null } as const;
  if (entrada.pacoteLigado) return nao;
  const r = entrada.resposta;
  if (r && (r.resposta === "aceito" || r.resposta === "nunca")) return nao;
  if (r && r.resposta === "depois") {
    const passou = diasEntre(r.em, entrada.hoje);
    if (passou === null || passou < DIAS_DEPOIS) return nao;
  }
  const motivo: MotivoDoConvite | null =
    entrada.acesso === "pacote-acaba"
      ? "pacote-acaba"
      : entrada.saveData
        ? "economia-do-aparelho"
        : entrada.tipoDeRede === "slow-2g" || entrada.tipoDeRede === "2g" || entrada.tipoDeRede === "3g"
          ? "rede-lenta"
          : null;
  return motivo ? { convidar: true, motivo } : nao;
}

export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/** Lê a resposta guardada; forma errada, JSON quebrado, resposta fora da lista ou data inválida viram null. */
export function lerRespostaDoConvite(armazenamento: Armazenamento | null | undefined): RespostaDoConvite | null {
  try {
    const texto = armazenamento?.getItem(CHAVES_DA_LEVEZA.CONVITE);
    if (!texto) return null;
    const dado: unknown = JSON.parse(texto);
    if (!dado || typeof dado !== "object") return null;
    const { resposta, em } = dado as Record<string, unknown>;
    if (typeof resposta !== "string" || !(RESPOSTAS as readonly string[]).includes(resposta)) return null;
    if (typeof em !== "string" || dia(em) === null) return null;
    return { resposta: resposta as Resposta, em };
  } catch {
    return null;
  }
}

/** Grava a resposta. Devolve false se o armazenamento recusar (a escolha vale só nesta visita). */
export function gravarRespostaDoConvite(armazenamento: Armazenamento | null | undefined, resposta: Resposta, hoje: string): boolean {
  try {
    if (!armazenamento) return false;
    armazenamento.setItem(CHAVES_DA_LEVEZA.CONVITE, JSON.stringify({ resposta, em: hoje }));
  } catch {
    return false;
  }
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("lucia:estudo"));
  } catch {
    // sem janela: nada a avisar
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Medidor e tamanhos

export interface EntradaDeDesempenho {
  name: string;
  transferSize?: number;
  entryType?: string;
}

/**
 * Soma o que a rede entregou nesta página (transferSize), só do que veio da mesma origem. `incompleto` quando há entrada de
 * outra origem (o navegador não revela o tamanho, como no tradutor de Libras) ou entrada com 0 (já estava guardada).
 */
export function somarTransferencia(entradas: readonly EntradaDeDesempenho[], origem?: string): { bytes: number; incompleto: boolean } {
  const minha = origem ?? (typeof location !== "undefined" ? location.origin : "");
  let bytes = 0;
  let incompleto = false;
  for (const e of entradas) {
    let mesma = false;
    try {
      mesma = new URL(e.name, minha || undefined).origin === minha;
    } catch {
      mesma = false;
    }
    if (!mesma) {
      incompleto = true;
      continue;
    }
    const t = e.transferSize;
    if (typeof t !== "number" || Number.isNaN(t) || t < 0) continue;
    if (t === 0) incompleto = true;
    bytes += t;
  }
  return { bytes, incompleto: incompleto || entradas.length === 0 };
}

/** Troca {nome} pelo valor (igual a preencher de lib/escola/textos.ts, que o cliente não pode importar: puxaria os JSON da base). */
export function preencherTexto(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}

/** "320 KB" abaixo de 1 MiB, senão "1,5 MB" no idioma; no mínimo 1 KB (mesma regra de components/Offline.tsx). */
export function formatarTamanho(bytes: number, lang?: string): string {
  if (bytes >= 1024 * 1024) {
    const numero = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
    return `${numero} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** O rodapé fixo do /texto, em bytes (conferido por leitura da rota: uns 120 bytes). */
const RODAPE_DO_TEXTO = 120;

/** Estimativa, em bytes UTF-8, do /texto da aula. Usa o que a página já tem na memória; não lê disco. */
export function tamanhoDoTexto(titulo: string, resumo: string, corpo: string): number {
  const enc = new TextEncoder();
  return enc.encode(`${titulo}\n${resumo}\n`).length + enc.encode(corpo).length + RODAPE_DO_TEXTO;
}

/** Os endereços de "levar esta aula". Só concatena: o /texto e o EPUB já existem. */
export function caminhosDeLevar(lang: string, trilha: string, aula: string): { texto: string; epub: string } {
  return { texto: `/${lang}/trilhas/${trilha}/${aula}/texto`, epub: `/epub/${trilha}.epub` };
}

// ---------------------------------------------------------------------------------------------------------------------
// Libras com intérprete humano (índice que começa vazio; só com autorização por escrito, LGPD arts. 7º e 11)

export interface AulaEmLibras {
  /** "trilha/aula" */
  aula: string;
  url: string;
  fonte: string;
  /** Nome da pessoa ou "equipe". */
  interprete: string;
  /** Onde fica arquivada a autorização por escrito para uso da imagem e da voz. */
  autorizacao: string;
  licenca: string;
  em_revisao: boolean;
}
export interface ListaDeLibras {
  versao: 1;
  aulas: AulaEmLibras[];
}

const HOSTS_DE_VIDEO = ["www.youtube-nocookie.com", "youtube-nocookie.com", "player.vimeo.com"];
const PROIBIDAS = new RegExp(`${"univers"}idade|${"diplo"}ma`, "i");

function hostsLiberados(): string[] {
  const extra = (typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_VIDEO_HOSTS ?? "") : "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .flatMap((h) => {
      try {
        return [new URL(h.includes("://") ? h : `https://${h}`).hostname];
      } catch {
        return [];
      }
    });
  return [...HOSTS_DE_VIDEO, ...extra];
}

/** Devolve a lista de problemas (vazia = válida). `aulasQueExistem`, se vier, confere a aula. */
export function validarLibras(lista: unknown, aulasQueExistem?: ReadonlySet<string> | readonly string[]): string[] {
  const erros: string[] = [];
  const l = lista as Partial<ListaDeLibras> | null;
  if (!l || typeof l !== "object" || l.versao !== 1 || !Array.isArray(l.aulas)) return ["formato: esperado {versao:1, aulas:[...]}"];
  const existem = aulasQueExistem ? new Set(aulasQueExistem) : null;
  const vistas = new Set<string>();
  const hosts = hostsLiberados();
  l.aulas.forEach((a, i) => {
    const onde = `aulas[${i}]`;
    if (!a || typeof a !== "object") return void erros.push(`${onde}: não é objeto`);
    for (const campo of ["aula", "url", "fonte", "interprete", "autorizacao", "licenca"] as const) {
      if (typeof a[campo] !== "string" || !a[campo].trim()) erros.push(`${onde}: falta ${campo}`);
    }
    if (a.em_revisao !== true) erros.push(`${onde}: em_revisao deve ser true`);
    if (typeof a.aula === "string") {
      if (existem && !existem.has(a.aula)) erros.push(`${onde}: a aula ${a.aula} não existe`);
      if (vistas.has(a.aula)) erros.push(`${onde}: aula repetida (${a.aula})`);
      vistas.add(a.aula);
    }
    if (typeof a.url === "string" && a.url.trim()) {
      try {
        const u = new URL(a.url);
        if (u.protocol !== "https:") erros.push(`${onde}: a url precisa ser https`);
        if (u.username || u.password) erros.push(`${onde}: a url não pode ter usuário e senha`);
        if (!hosts.includes(u.hostname)) erros.push(`${onde}: host fora da lista liberada (${u.hostname})`);
      } catch {
        erros.push(`${onde}: url inválida`);
      }
    }
    for (const valor of Object.values(a)) if (typeof valor === "string" && PROIBIDAS.test(valor)) erros.push(`${onde}: palavra proibida`);
  });
  return erros;
}

const INDICE: Map<string, AulaEmLibras> = new Map(((librasAulas as ListaDeLibras).aulas ?? []).map((a) => [a.aula, a]));

/** A entrada de Libras com intérprete desta aula ("trilha/aula"), ou null. */
export function librasDaAula(id: string): AulaEmLibras | null {
  return INDICE.get(id) ?? null;
}
