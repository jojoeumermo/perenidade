// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As chamadas da frente 13C no navegador: a lista de quem eu sigo (public.rede_alc_seguindo), seguir alguém daqui
// (public.rede_perfil_seguir, a mesma do perfil, com o limite dela) e alguém de fora (as rotas do Fediverso da Faixa 2:
// /api/fediverso/buscar e /api/fediverso/seguir, sem mexer nelas), e a conferência de que o RSS ou o cartão de um post existem
// (as rotas desta frente respondem 404 quando não saem). Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), dados de exemplo, sem banco
// e sem rede nenhuma.
import { BackendError, getClient, rpc } from "@/lib/backend";
import { handleDaqui } from "./regras";

export const PREVIA_DO_ALCANCE = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface MinhaLista {
  locais: string[];
  fora: string[];
}

/** O que aconteceu com cada endereço trazido. */
export type SituacaoDaConta = "esperando" | "seguindo" | "pedido" | "naoAchado" | "bloqueada" | "fediverso" | "limite" | "erro";

const codigo = (e: unknown): string => (e instanceof BackendError ? e.code : typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "falha");
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A lista de quem eu sigo, para baixar. */
export async function minhaLista(): Promise<MinhaLista> {
  if (PREVIA_DO_ALCANCE) {
    await espera(200);
    return { locais: ["faisca", "rosa_vermelha", "coletivo_zl", "lia_estuda"], fora: ["ana@mastodon.example", "sindicato@social.example"] };
  }
  const r = await rpc<MinhaLista | null>("rede_alc_seguindo");
  return { locais: Array.isArray(r?.locais) ? r.locais : [], fora: Array.isArray(r?.fora) ? r.fora : [] };
}

async function token(): Promise<string> {
  const { data } = await (await getClient()).auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

async function rota<T>(caminho: string, init: RequestInit = {}): Promise<{ ok: true; dado: T } | { ok: false; erro: string; status: number }> {
  try {
    const r = await fetch(caminho, { ...init, cache: "no-store", headers: { ...init.headers, Authorization: `Bearer ${await token()}` } });
    const corpo = (await r.json().catch(() => null)) as (T & { erro?: string }) | null;
    if (!r.ok || !corpo) return { ok: false, erro: corpo?.erro ?? (r.status === 404 ? "nao_encontrado" : "falha"), status: r.status };
    return { ok: true, dado: corpo };
  } catch (e) {
    return { ok: false, erro: codigo(e), status: 0 };
  }
}

const situacaoDoErro = (erro: string): SituacaoDaConta =>
  erro === "nao_encontrado" || erro.startsWith("invalido") ? "naoAchado"
    : erro === "instancia_bloqueada" ? "bloqueada"
      : erro === "fediverso_desligado" || erro.startsWith("fediverso") ? "fediverso"
        : erro === "muitos_pedidos" ? "limite"
          : "erro";

/** Seguir alguém daqui pelo @. */
export async function seguirDaqui(handle: string): Promise<SituacaoDaConta> {
  if (PREVIA_DO_ALCANCE) {
    await espera(120);
    return handle.includes("x") ? "naoAchado" : "seguindo";
  }
  try {
    const r = await rpc<{ sigo: boolean; pendente: boolean }>("rede_perfil_seguir", { p_handle: handle, p_sim: true });
    return r?.pendente ? "pedido" : "seguindo";
  } catch (e) {
    return situacaoDoErro(codigo(e));
  }
}

/**
 * Seguir uma conta "nome@servidor": se for daqui (um dos domínios da Alumia), pelo @; senão, a busca da Faixa 2 acha o ator na
 * outra instância (o navegador nunca toca lá) e o pedido de seguir sai pela fila dela.
 */
export async function seguirConta(conta: string, dominiosDaqui: readonly string[]): Promise<SituacaoDaConta> {
  const local = handleDaqui(conta, dominiosDaqui);
  if (local) return seguirDaqui(local);
  if (PREVIA_DO_ALCANCE) {
    await espera(160);
    return conta.startsWith("bloq") ? "bloqueada" : "pedido";
  }
  const achado = await rota<{ local?: boolean; handle?: string; ator?: string; seguindo?: string; ligado?: boolean }>(`/api/fediverso/buscar?conta=${encodeURIComponent(conta)}`);
  if (!achado.ok) return situacaoDoErro(achado.erro);
  if (achado.dado.local && achado.dado.handle) return seguirDaqui(achado.dado.handle);
  if (!achado.dado.ator) return "naoAchado";
  if (achado.dado.seguindo === "sim") return "seguindo";
  if (achado.dado.seguindo === "pedido") return "pedido";
  if (achado.dado.ligado === false) return "fediverso";
  const seguiu = await rota<{ seguindo?: string }>("/api/fediverso/seguir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ator: achado.dado.ator, sim: true }),
  });
  if (!seguiu.ok) return situacaoDoErro(seguiu.erro);
  return seguiu.dado.seguindo === "sim" ? "seguindo" : "pedido";
}

/** A rota responde (o RSS ou o cartão saem)? Sem servidor (prévia), vale a regra da tela. */
export async function rotaResponde(endereco: string, naPrevia: boolean): Promise<boolean> {
  if (PREVIA_DO_ALCANCE) {
    await espera(150);
    return naPrevia;
  }
  try {
    const r = await fetch(endereco, { method: "HEAD", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
    return r.ok;
  } catch {
    return false;
  }
}
