// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { KEYS, notifyStored, useStored } from "./storage";

// Contas, fila de contribuições, comunidade e rádio dependem de um serviço externo opcional.
// Sem as duas variáveis abaixo o site funciona normalmente e essas partes ficam escondidas.
// Os dois valores são públicos por natureza: toda permissão é conferida do lado de lá.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const hasBackend = Boolean(url && key);
/** Verdadeiro só no ambiente de teste local, onde existe a entrada simplificada. */
export const localBackend = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
export const storageUrl = (path: string) => `${url}/storage/v1/object/public/${path}`;
/** Chave pública do desafio contra robôs na entrada. Sem ela, o desafio não aparece. */
export const captchaKey = localBackend ? "" : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "");

export class BackendError extends Error {
  /** Código curto devolvido pelo serviço: "entre_primeiro", "sem_permissao", "invalido:titulo"… */
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

let client: Promise<SupabaseClient> | null = null;

/** O cliente completo (contas e sessão) só é baixado quando alguém realmente precisa dele. */
export function getClient(): Promise<SupabaseClient> {
  if (!hasBackend) return Promise.reject(new BackendError("sem_servico"));
  client ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const supabase = createClient(url, key, { auth: { storageKey: KEYS.session, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    // Entrar e sair mudam o cabeçalho ("Entrar" vira "Painel") sem recarregar a página.
    supabase.auth.onAuthStateChange(() => setTimeout(notifyStored, 0));
    return supabase;
  });
  return client;
}

export function hasSession(): boolean {
  try {
    return localStorage.getItem(KEYS.session) !== null;
  } catch {
    return false;
  }
}

const codeOf = (message: unknown, code?: unknown) => {
  // A tela chama uma função que o serviço ainda não tem (atualização pendente do lado do serviço).
  if (code === "PGRST202" || code === "42883") return "banco_desatualizado";
  const text = String(message ?? "");
  return /^[a-z_]+(:[a-z_]+)?$/.test(text) ? text : "falha";
};

/** Chama uma função do serviço. Visitante sem conta usa um pedido simples, sem baixar o cliente completo. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!hasBackend) throw new BackendError("sem_servico");
  if (hasSession()) {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new BackendError(codeOf(error.message, error.code));
    return data as T;
  }
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch {
    throw new BackendError("sem_conexao");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const falha = body as { message?: string; code?: string } | null;
    throw new BackendError(codeOf(falha?.message, falha?.code));
  }
  return body as T;
}

export interface Role {
  id: string;
  papel: "coordenacao" | "vice" | "supervisao" | "curadoria" | "mediacao" | "educacao" | "educacao_secundaria" | "revisao" | "traducao" | "jornalismo" | "mentoria" | "design" | "marketing" | "desenvolvimento" | "representante";
  disciplina: string | null;
}

export interface Me {
  id: string;
  nome: string;
  bio: string;
  suspenso: boolean;
  /** Todos os papéis da pessoa: ela pode ter quantos quiser, e as permissões são a soma deles. */
  papeis: Role[];
  /** O nível na hierarquia de cargos (0 sem papel, 1 papéis de trabalho, 2 supervisão, 3 vice, 4 coordenação). */
  nivel: number;
  /** A sessão foi confirmada com o código do aplicativo autenticador. */
  segundo_fator: boolean;
  /** O papel da pessoa exige essa confirmação antes de abrir o painel. */
  exige_segundo_fator: boolean;
  /** Recados não lidos. */
  avisos: number;
  /** Nas conversas: mostrar aos outros quando estive online por último (quem esconde também não vê o dos outros). */
  chat_visto: boolean;
  /** Nas conversas: confirmar aos outros que li (quem desliga também não vê a confirmação dos outros). */
  chat_leitura: boolean;
}

/** Funções que valem por outra: a educação secundária tem os poderes da educação; o marketing, os do design. */
const equivale: Partial<Record<Role["papel"], Role["papel"]>> = { educacao_secundaria: "educacao", marketing: "design" };
/** A vice-coordenação pode tudo o que a coordenação pode, menos mexer na própria coordenação (isso é conferido por leads). */
export const can = (me: Me | null, ...roles: Role["papel"][]) =>
  Boolean(me?.papeis.some((role) => roles.includes(role.papel) || (role.papel === "vice" && roles.includes("coordenacao")) || (equivale[role.papel] !== undefined && roles.includes(equivale[role.papel] as Role["papel"]))));
/** Só a coordenação comunitária. */
export const leads = (me: Me | null) => Boolean(me?.papeis.some((role) => role.papel === "coordenacao"));

/** O nível de cada papel na hierarquia de cargos, igual ao do banco (interno.nivel). */
export const nivelDoPapel = (papel: Role["papel"]) => (papel === "coordenacao" ? 4 : papel === "vice" ? 3 : papel === "supervisao" ? 2 : 1);
/** O nível de uma lista de papéis: o maior deles; 0 sem papel. */
export const nivelDe = (papeis: { papel: Role["papel"] }[]) => papeis.reduce((maior, role) => Math.max(maior, nivelDoPapel(role.papel)), 0);
/** Quem gere cargos: coordenação, vice-coordenação e supervisão. O banco confere de novo em cada pedido. */
export const manages = (me: Me | null) => can(me, "coordenacao", "supervisao");
/** Os papéis ordenados do maior nível para o menor, para mostrar o principal primeiro. */
export const porNivel = <T extends { papel: Role["papel"] }>(papeis: T[]) => [...papeis].sort((a, b) => nivelDoPapel(b.papel) - nivelDoPapel(a.papel));

type MeState = { status: "loading" } | { status: "out" } | { status: "in"; me: Me };

/** Quem está logado. Não baixa nada para quem nunca entrou. */
export function useMe(): MeState & { reload: () => void } {
  const stored = useStored(KEYS.session);
  const [state, setState] = useState<MeState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const finish = (next: MeState) => {
      if (!cancelled) setState(next);
    };
    if (!hasBackend || !hasSession()) {
      // Pode ser a volta do link de entrada, com a sessão ainda no endereço: deixa o cliente conferir.
      if (hasBackend && /access_token=|code=/.test(window.location.hash + window.location.search)) {
        getClient()
          .then((supabase) => supabase.auth.getSession())
          .then(({ data }) => (data.session ? rpc<Me | null>("eu") : null))
          .then((me) => finish(me ? { status: "in", me } : { status: "out" }))
          .catch(() => finish({ status: "out" }));
      } else {
        finish({ status: "out" });
      }
      return () => {
        cancelled = true;
      };
    }
    rpc<Me | null>("eu")
      .then((me) => finish(me ? { status: "in", me } : { status: "out" }))
      .catch(() => finish({ status: "out" }));
    return () => {
      cancelled = true;
    };
  }, [stored, tick]);

  return { ...state, reload: () => setTick((value) => value + 1) };
}

/**
 * Pede ao serviço a segunda avaliação de uma mensagem da Comunidade que ficou esperando por ela. Daqui só sai o pedido:
 * o texto é lido do banco e a decisão é tomada do lado de lá. Sem resposta, devolve "" e a mensagem segue na fila de revisão.
 */
export async function evaluatePost(kind: "topico" | "resposta", id: string): Promise<string> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return "";
    const response = await fetch(`${url}/functions/v1/avaliar-comunidade`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: kind, id }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return "";
    const body = (await response.json()) as { veredito?: unknown } | null;
    return typeof body?.veredito === "string" ? body.veredito : "";
  } catch {
    return "";
  }
}

/**
 * Pede ao serviço um teste de funcionamento da segunda avaliação (só a coordenação). null quer dizer que a função
 * não respondeu: não está publicada, ou o serviço está fora do ar.
 */
export async function verifyModeration(): Promise<{ chave: boolean; ok: boolean; falha: string } | null> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const response = await fetch(`${url}/functions/v1/avaliar-comunidade`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ verificar: true }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { chave?: unknown; ok?: unknown; falha?: unknown } | null;
    if (typeof body?.ok !== "boolean") return null;
    return { chave: body.chave === true, ok: body.ok, falha: typeof body.falha === "string" ? body.falha : "" };
  } catch {
    return null;
  }
}

/** Pede ao serviço que passe de novo pelas mensagens que ficaram esperando a segunda avaliação. Devolve se o pedido foi aceito. */
export async function recoverPending(): Promise<boolean> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    const response = await fetch(`${url}/functions/v1/avaliar-comunidade`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recuperar: true }),
      signal: AbortSignal.timeout(60_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function signOut() {
  try {
    const supabase = await getClient();
    await supabase.auth.signOut();
  } finally {
    try {
      localStorage.removeItem(KEYS.session);
    } catch {
      // sem armazenamento, não há sessão para apagar
    }
    notifyStored();
  }
}
