// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do navegador do assistente aberto a todo o site (app/api/assistente/route.ts). Fala só com o próprio site: a
// pergunta vai ao servidor do instituto, e de lá a uma IA gratuita. O navegador nunca fala com a empresa da IA, então ela
// não vê o IP, o navegador nem a página de quem pergunta. Nada é guardado no aparelho por este arquivo.
import { useEffect, useState } from "react";
import type { AssistantRequest, AssistantResult } from "@/lib/backend";
import { ligado } from "@/lib/recursos";

export interface EstadoPublico {
  ligado: boolean;
  /** Aceita foto? (Só quando há um provedor que enxerga, hoje o Gemini.) */
  visao: boolean;
  porHora: number;
  porDia: number;
}

const DESLIGADO: EstadoPublico = { ligado: false, visao: false, porHora: 0, porDia: 0 };

/** Lido uma vez por minuto no máximo, por mais componentes que perguntem. */
let guardado: { em: number; estado: Promise<EstadoPublico> } | null = null;

export function estadoDoPublico(): Promise<EstadoPublico> {
  if (!ligado("assistente-publico") || typeof fetch === "undefined") return Promise.resolve(DESLIGADO);
  if (!guardado || Date.now() - guardado.em > 60_000) {
    guardado = {
      em: Date.now(),
      estado: fetch("/api/assistente", { signal: AbortSignal.timeout(10_000) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Partial<EstadoPublico> | null) => ({
          ligado: d?.ligado === true,
          visao: d?.visao === true,
          porHora: typeof d?.porHora === "number" ? d.porHora : 0,
          porDia: typeof d?.porDia === "number" ? d.porDia : 0,
        }))
        .catch(() => {
          guardado = null;
          return DESLIGADO;
        }),
    };
  }
  return guardado.estado;
}

/** O estado do assistente aberto, para o componente decidir se mostra o botão (null enquanto não chega). */
export function useAssistentePublico(ativo = true): EstadoPublico | null {
  const [estado, setEstado] = useState<EstadoPublico | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    void estadoDoPublico().then((e) => vivo && setEstado(e));
    return () => {
      vivo = false;
    };
  }, [ativo]);
  return estado;
}

export type ResultadoPublico = AssistantResult & { restantesHora?: number | null; tentarEm?: number };

/**
 * Pergunta ao assistente aberto. Só vai o pedido que o formulário montou (a pergunta e o que ela precisa); nada de
 * conta, sessão, cookie da conta ou identificador do aparelho.
 */
export async function perguntarAoPublico(pedido: AssistantRequest): Promise<ResultadoPublico> {
  try {
    const resposta = await fetch("/api/assistente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
      credentials: "omit",
      signal: AbortSignal.timeout(150_000),
    });
    const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;
    if (corpo?.recusa === true) return { ok: false, recusa: true, erro: "" };
    if (!resposta.ok || typeof corpo?.texto !== "string") {
      const erro = typeof corpo?.erro === "string" && /^[a-z_]+$/.test(corpo.erro) ? corpo.erro : "assistente_falhou";
      return { ok: false, recusa: false, erro, tentarEm: typeof corpo?.tentarEm === "number" ? corpo.tentarEm : undefined };
    }
    return {
      ok: true,
      texto: corpo.texto,
      cortada: corpo.cortada === true,
      transcricao: typeof corpo.transcricao === "string" ? corpo.transcricao : "",
      conta: typeof corpo.conta === "string" ? corpo.conta : "",
      restantes: typeof corpo.restantes === "number" ? corpo.restantes : null,
      restantesHora: typeof corpo.restantesHora === "number" ? corpo.restantesHora : null,
    };
  } catch {
    return { ok: false, recusa: false, erro: "assistente_falhou" };
  }
}
