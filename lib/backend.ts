// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { KEYS, useStored } from "./storage";

// Contas, fila de contribuições, comunidade e rádio dependem de um serviço externo opcional.
// Sem as duas variáveis abaixo o site funciona normalmente e essas partes ficam escondidas.
// Os dois valores são públicos por natureza: toda permissão é conferida do lado de lá.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const hasBackend = Boolean(url && key);
export const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
/** Verdadeiro só no ambiente de teste local, onde existe a entrada simplificada. */
export const localBackend = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
export const storageUrl = (path: string) => `${url}/storage/v1/object/public/${path}`;

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
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, key, { auth: { storageKey: KEYS.session, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
  );
  return client;
}

export function hasSession(): boolean {
  try {
    return localStorage.getItem(KEYS.session) !== null;
  } catch {
    return false;
  }
}

const codeOf = (message: unknown) => {
  const text = String(message ?? "");
  return /^[a-z_]+(:[a-z_]+)?$/.test(text) ? text : "falha";
};

/** Chama uma função do serviço. Visitante sem conta usa um pedido simples, sem baixar o cliente completo. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!hasBackend) throw new BackendError("sem_servico");
  if (hasSession()) {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new BackendError(codeOf(error.message));
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
  if (!response.ok) throw new BackendError(codeOf((body as { message?: string } | null)?.message));
  return body as T;
}

export interface Role {
  id: string;
  papel: "coordenacao" | "curadoria" | "educacao" | "revisao" | "traducao" | "jornalismo";
  disciplina: string | null;
}

export interface Me {
  id: string;
  nome: string;
  bio: string;
  suspenso: boolean;
  papeis: Role[];
}

export const can = (me: Me | null, ...roles: Role["papel"][]) => Boolean(me?.papeis.some((role) => roles.includes(role.papel)));

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
  }
}
