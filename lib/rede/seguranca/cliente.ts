// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas da conta segura da Alumia (supabase/migracoes/20261114-alumia-o8-conta.sql): situação, aparelhos conectados,
// desconectar, pânico, mostrar o perfil, fora da busca e os códigos de recuperação (public.conta_*, os mesmos de Minha conta).
// Desconectar os outros aparelhos, o pânico e o código de recuperação passam pelo servidor do site (app/api/alumia/conta), que
// encerra as sessões no serviço de contas depois do banco; sem a rota ou sem o serviço configurado, a chamada vai direto ao banco.
// Na prévia sem banco (NEXT_PUBLIC_ALUMIA_PREVIA=sim), um dublê com dados de exemplo que vive só na memória da página.
"use client";

import { getClient, hasBackend, rpc } from "@/lib/backend";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import type { CodigoDoNavegador, CodigoDoSistema } from "./navegador";

export interface SituacaoDaConta {
  segundo_fator: boolean;
  confirmado: boolean;
  codigos_restantes: number;
  codigos_gerados_em: string | null;
  fora_da_busca: boolean;
  escondido_pelo_panico: boolean;
  panico_em: string | null;
  sessoes: boolean;
}

export interface AparelhoConectado {
  id: string;
  /** Dia em que a sessão começou (AAAA-MM-DD). */
  desde: string;
  /** Dia da última atividade (AAAA-MM-DD). Só o dia: a hora não sai do banco. */
  ultima: string;
  este: boolean;
  confirmado: boolean;
  navegador: CodigoDoNavegador;
  sistema: CodigoDoSistema;
}

export const previa = (): boolean => previaLigada();

type AcaoPeloServidor = { acao: "outros" } | { acao: "todos"; esconder: boolean } | { acao: "codigo"; codigo: string };

/**
 * Pede ao servidor do site. Devolve a resposta, ou nulo quando a rota não existe ou o servidor não tem o serviço configurado
 * (quem chama vai direto ao banco). Erro do banco vira Error com o código curto dele, como o rpc faz.
 */
async function peloServidor<T>(corpo: AcaoPeloServidor): Promise<T | null> {
  if (!hasBackend) return null;
  const token = (await (await getClient()).auth.getSession()).data.session?.access_token;
  if (!token) return null;
  let r: Response;
  try {
    r = await fetch("/api/alumia/conta", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  const dado = (await r.json().catch(() => null)) as ({ ok?: boolean; motivo?: string } & T) | null;
  if (r.status === 404 || (r.status === 503 && dado?.motivo === "sem_servico")) return null;
  if (!dado) throw new Error("falha");
  if (dado.ok === false && dado.motivo !== "codigo_invalido") throw new Error(dado.motivo || "falha");
  return dado;
}

// ───── O dublê da prévia ─────
const hoje = (menos = 0) => new Date(Date.now() - menos * 86_400_000).toISOString().slice(0, 10);
const dubla = {
  situacao: {
    segundo_fator: true, confirmado: true, codigos_restantes: 7, codigos_gerados_em: `${hoje(41)}T12:00:00Z`, fora_da_busca: false,
    escondido_pelo_panico: false, panico_em: null, sessoes: true,
  } as SituacaoDaConta,
  aparelhos: [
    { id: "a1", desde: hoje(12), ultima: hoje(0), este: true, confirmado: true, navegador: "firefox", sistema: "linux" },
    { id: "a2", desde: hoje(30), ultima: hoje(2), este: false, confirmado: true, navegador: "chrome", sistema: "android" },
    { id: "a3", desde: hoje(58), ultima: hoje(19), este: false, confirmado: false, navegador: "safari", sistema: "ios" },
  ] as AparelhoConectado[],
};
const espera = <T,>(valor: T) => new Promise<T>((pronto) => setTimeout(() => pronto(valor), 220));
function codigosDeExemplo(): string[] {
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return Array.from({ length: 10 }, () => {
    const h = hex();
    return `${h.slice(0, 5)}-${h.slice(5, 10)}`;
  });
}

export const contaSegura = {
  situacao: (): Promise<SituacaoDaConta> => (previa() ? espera({ ...dubla.situacao }) : rpc<SituacaoDaConta>("alumia_conta_situacao")),

  aparelhos: async (): Promise<{ disponivel: boolean; aparelhos: AparelhoConectado[] }> =>
    previa() ? espera({ disponivel: true, aparelhos: dubla.aparelhos.map((a) => ({ ...a })) }) : rpc("alumia_conta_aparelhos"),

  /** Um aparelho (id) ou, sem id, todos menos este. */
  desconectar: async (id?: string): Promise<{ desconectados: number }> => {
    if (previa()) {
      const antes = dubla.aparelhos.length;
      dubla.aparelhos = dubla.aparelhos.filter((a) => a.este || (id ? a.id !== id : false));
      return espera({ desconectados: antes - dubla.aparelhos.length });
    }
    if (!id) {
      const r = await peloServidor<{ desconectados: number }>({ acao: "outros" });
      if (r) return r;
    }
    return rpc("alumia_conta_desconectar", { p_sessao: id ?? null });
  },

  panico: async (esconder: boolean): Promise<void> => {
    if (previa()) return;
    if (await peloServidor({ acao: "todos", esconder }).catch(() => null)) return;
    await rpc("alumia_conta_panico", { p_esconder: esconder });
  },

  mostrarPerfil: async (): Promise<void> => {
    if (previa()) {
      dubla.situacao = { ...dubla.situacao, escondido_pelo_panico: false, panico_em: null };
      await espera(null);
      return;
    }
    await rpc("alumia_conta_mostrar_perfil");
  },

  foraDaBusca: async (fora: boolean): Promise<void> => {
    if (previa()) {
      dubla.situacao = { ...dubla.situacao, fora_da_busca: fora };
      await espera(null);
      return;
    }
    await rpc("alumia_conta_fora_da_busca", { p_fora: fora });
  },

  gerarCodigos: async (): Promise<string[]> => {
    if (previa()) {
      dubla.situacao = { ...dubla.situacao, codigos_restantes: 10, codigos_gerados_em: new Date().toISOString() };
      return espera(codigosDeExemplo());
    }
    return (await rpc<{ codigos: string[] }>("conta_codigos_gerar")).codigos;
  },

  /** Usa um código de recuperação (sessão só com a senha). ok: false é código errado ou já usado. */
  usarCodigo: async (codigo: string): Promise<{ ok: boolean }> => {
    if (previa()) return espera({ ok: codigo.replace(/[^0-9a-f]/gi, "").length === 10 });
    const r = await peloServidor<{ ok: boolean }>({ acao: "codigo", codigo });
    if (r) return { ok: r.ok === true };
    return rpc("conta_codigo_usar", { p_codigo: codigo });
  },
};
