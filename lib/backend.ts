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
  papel: "coordenacao" | "vice" | "supervisao" | "curadoria" | "mediacao" | "educacao" | "revisao" | "traducao" | "jornalismo" | "mentoria" | "design" | "marketing" | "desenvolvimento";
  disciplina: string | null;
}

export interface Me {
  id: string;
  nome: string;
  bio: string;
  suspenso: boolean;
  papeis: Role[];
  /** A sessão foi confirmada com o código do aplicativo autenticador. */
  segundo_fator: boolean;
  /** O papel da pessoa exige essa confirmação antes de abrir o painel. */
  exige_segundo_fator: boolean;
  /** Recados não lidos. */
  avisos: number;
  /** A coordenação redefiniu a senha: a pessoa escolhe uma nova antes de o painel abrir. */
  trocar_senha?: boolean;
}

/** A vice-coordenação pode tudo o que a coordenação pode, menos mexer na própria coordenação (isso é conferido por leads). */
export const can = (me: Me | null, ...roles: Role["papel"][]) =>
  Boolean(me?.papeis.some((role) => roles.includes(role.papel) || (role.papel === "vice" && roles.includes("coordenacao"))));
/** Só a coordenação comunitária. */
export const leads = (me: Me | null) => Boolean(me?.papeis.some((role) => role.papel === "coordenacao"));

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

/**
 * O assistente de reforço está ligado? Fica falso sem serviço, desligado, ou com a aula de reforço interditada.
 * `active` evita a consulta quando ela não serve para nada (por exemplo, para quem nem entrou na conta).
 */
export function useAssistantOn(active = true): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!hasBackend || !active) return;
    let cancelled = false;
    rpc<{ ligado?: boolean } | null>("assistente_estado")
      .then((state) => {
        if (!cancelled) setOn(state?.ligado === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);
  return on;
}

export interface AssistantRequest {
  modo: "pergunta" | "foto";
  pergunta: string;
  disciplina: string;
  idioma: string;
  /** Aulas do próprio site que podem ajudar: o assistente só recomenda estas. */
  aulas: { titulo: string; caminho: string }[];
  imagem?: { tipo: string; dados: string };
}

export type AssistantResult =
  | { ok: true; texto: string; cortada: boolean; transcricao: string; conta: string; restantes: number | null }
  | { ok: false; recusa: boolean; erro: string };

/**
 * Pergunta ao assistente de reforço (a função "assistente"). A pergunta, e a foto se houver, vão para um serviço de
 * inteligência artificial de outra empresa; o site não guarda nada disso. O banco só conta quantas perguntas a pessoa fez.
 */
export async function askAssistant(request: AssistantRequest): Promise<AssistantResult> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { ok: false, recusa: false, erro: "entre_primeiro" };
    const response = await fetch(`${url}/functions/v1/assistente`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      // Uma explicação passo a passo pode levar mais de um minuto.
      signal: AbortSignal.timeout(150_000),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (body?.recusa === true) return { ok: false, recusa: true, erro: "" };
    if (!response.ok || typeof body?.texto !== "string") {
      const erro = typeof body?.erro === "string" && /^[a-z_]+(:[a-z_]+)?$/.test(body.erro) ? body.erro : "assistente_falhou";
      return { ok: false, recusa: false, erro };
    }
    return {
      ok: true,
      texto: body.texto,
      cortada: body.cortada === true,
      transcricao: typeof body.transcricao === "string" ? body.transcricao : "",
      conta: typeof body.conta === "string" ? body.conta : "",
      restantes: typeof body.restantes === "number" ? body.restantes : null,
    };
  } catch {
    return { ok: false, recusa: false, erro: "assistente_falhou" };
  }
}

/** Teste de funcionamento do assistente (coordenação e vice). null quer dizer que a função não respondeu. */
export async function verifyAssistant(): Promise<{ chave: boolean; ok: boolean; falha: string; modelo: string } | null> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const response = await fetch(`${url}/functions/v1/assistente`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ verificar: true }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { chave?: unknown; ok?: unknown; falha?: unknown; modelo?: unknown } | null;
    if (typeof body?.ok !== "boolean") return null;
    return { chave: body.chave === true, ok: body.ok, falha: typeof body.falha === "string" ? body.falha : "", modelo: typeof body.modelo === "string" ? body.modelo : "" };
  } catch {
    return null;
  }
}

export async function signOut() {
  try {
    const supabase = await getClient();
    await supabase.auth.signOut();
  } finally {
    try {
      localStorage.removeItem(KEYS.session);
      localStorage.removeItem(KEYS.name);
    } catch {
      // sem armazenamento, não há sessão para apagar
    }
    notifyStored();
  }
}
