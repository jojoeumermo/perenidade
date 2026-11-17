// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// O lado do navegador da proteção contra ataque (supabase/migracoes/20261115-alumia-o9-protecao.sql). Na prévia
// (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na memória da aba faz a tela andar.
// O que o cartão precisa (rede_o9_cartoes) vai por lote: os cartões que aparecem juntos pedem juntos, numa chamada só.
import { BackendError, rpc } from "../backend";
import { previaLigada } from "./publicar/alumia2";
import {
  CARTAO_VAZIO,
  ateQuando,
  type HorasDaBlindagem,
  type MarcacaoPendente,
  type ProtecaoDoCartao,
  type QuemPode,
  type Restrita,
  type SituacaoDaProtecao,
} from "./tipos-protecao";

const previa = () => previaLigada();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───── O dublê da prévia ─────
let exemplo: SituacaoDaProtecao = { blindagem_ate: null, mencao_quem: "seguindo", marcar_quem: "ninguem", marcar_aprovar: true, restritos: 1, marcacoes_pendentes: 1 };
let restritasDeExemplo: Restrita[] = [{ handle: "voz_do_ataque", codinome: "Voz do Ataque", desde: new Date(Date.now() - 3 * 86_400_000).toISOString() }];
let pendentesDeExemplo: MarcacaoPendente[] = [
  { post: "exemplo-marcacao", codinome: "Lia Quilombo", handle: "liaquilombo", trecho: "A mesa da plenária de sábado, com a pauta da tarifa no quadro.", criado_em: new Date(Date.now() - 40 * 60_000).toISOString() },
];
const cartoesDeExemplo: Record<string, Partial<ProtecaoDoCartao>> = {
  // Um cartão da prévia mostra a resposta recolhida como a dona da conversa vê.
  "exemplo-ocupacao": { aguardando: true, dona: true, restringi: true },
};

// ───── O lote dos cartões ─────
let pedidos = new Map<string, ((c: ProtecaoDoCartao) => void)[]>();
let agendado = false;
const guardados = new Map<string, ProtecaoDoCartao>();

async function rodarLote() {
  agendado = false;
  const lote = pedidos;
  pedidos = new Map();
  const ids = [...lote.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const parte = ids.slice(i, i + 50);
    let r: Record<string, ProtecaoDoCartao> = {};
    try {
      if (previa()) r = Object.fromEntries(parte.map((id) => [id, { ...CARTAO_VAZIO, ...(cartoesDeExemplo[id] ?? {}) }]));
      else if (parte.every((id) => /^[0-9a-f-]{36}$/i.test(id))) r = (await rpc<Record<string, ProtecaoDoCartao>>("rede_o9_cartoes", { p_ids: parte })) ?? {};
    } catch {
      r = {};
    }
    for (const id of parte) {
      const c = { ...CARTAO_VAZIO, ...(r[id] ?? {}) };
      guardados.set(id, c);
      for (const f of lote.get(id) ?? []) f(c);
    }
  }
}

/** O que a proteção sabe de um post, para o cartão. Sem banco, sem resposta ou com erro: tudo desligado. */
export function protecaoDoCartao(id: string, renovar = false): Promise<ProtecaoDoCartao> {
  if (!renovar && guardados.has(id)) return Promise.resolve(guardados.get(id) as ProtecaoDoCartao);
  return new Promise((resolver) => {
    pedidos.set(id, [...(pedidos.get(id) ?? []), resolver]);
    if (!agendado) {
      agendado = true;
      setTimeout(() => void rodarLote(), 30);
    }
  });
}

/** Esquece o que estava guardado de um post (depois de liberar, desvincular, restringir…). */
export function esquecerCartao(id?: string) {
  if (id) guardados.delete(id);
  else guardados.clear();
}

export const protecao = {
  situacao: async (): Promise<SituacaoDaProtecao> => {
    if (previa()) return { ...exemplo, restritos: restritasDeExemplo.length, marcacoes_pendentes: pendentesDeExemplo.length };
    return rpc<SituacaoDaProtecao>("rede_o9_protecao");
  },

  /** Liga a blindagem por 24 ou 168 horas; 0 desliga. */
  blindagem: async (horas: HorasDaBlindagem | 0): Promise<string | null> => {
    if (previa()) {
      await espera(250);
      exemplo = { ...exemplo, blindagem_ate: horas === 0 ? null : ateQuando(horas).toISOString() };
      return exemplo.blindagem_ate;
    }
    return (await rpc<{ blindagem_ate: string | null }>("rede_o9_blindagem", { p_horas: horas })).blindagem_ate;
  },

  preferir: async (p: { mencao_quem?: QuemPode; marcar_quem?: QuemPode; marcar_aprovar?: boolean }): Promise<void> => {
    if (previa()) {
      await espera(150);
      exemplo = { ...exemplo, ...p };
      return;
    }
    await rpc("rede_o9_preferir", { p });
  },

  restritas: async (): Promise<Restrita[]> => {
    if (previa()) return [...restritasDeExemplo];
    return (await rpc<Restrita[]>("rede_o9_restritos")) ?? [];
  },

  restringir: async (handle: string, sim = true): Promise<boolean> => {
    const h = handle.trim().replace(/^@+/, "").toLowerCase();
    esquecerCartao();
    if (previa()) {
      await espera(200);
      if (!/^[a-z0-9_]{3,20}$/.test(h)) throw new BackendError("nao_encontrado");
      if (h === "faisca") throw new BackendError("invalido:propria");
      restritasDeExemplo = sim
        ? [{ handle: h, codinome: h, desde: new Date().toISOString() }, ...restritasDeExemplo.filter((r) => r.handle !== h)]
        : restritasDeExemplo.filter((r) => r.handle !== h);
      return sim;
    }
    return (await rpc<{ restrita: boolean }>("rede_o9_restringir", { p_handle: h, p_sim: sim })).restrita;
  },

  liberar: async (resposta: string, sim = true): Promise<boolean> => {
    esquecerCartao(resposta);
    if (previa()) {
      await espera(200);
      cartoesDeExemplo[resposta] = { ...(cartoesDeExemplo[resposta] ?? {}), aguardando: !sim, liberada: sim, dona: true };
      return sim;
    }
    return (await rpc<{ liberada: boolean }>("rede_o9_liberar", { p_resposta: resposta, p_sim: sim })).liberada;
  },

  soltarCitacao: async (post: string): Promise<void> => {
    esquecerCartao(post);
    if (previa()) {
      await espera(200);
      cartoesDeExemplo[post] = { ...(cartoesDeExemplo[post] ?? {}), solta: true, citacao_minha: false };
      return;
    }
    await rpc("rede_o9_citacao_soltar", { p_post: post });
  },

  pendentes: async (): Promise<MarcacaoPendente[]> => {
    if (previa()) return [...pendentesDeExemplo];
    return (await rpc<MarcacaoPendente[]>("rede_o9_marcacoes_pendentes")) ?? [];
  },

  decidir: async (post: string, aceitar: boolean): Promise<void> => {
    esquecerCartao(post);
    if (previa()) {
      await espera(200);
      pendentesDeExemplo = pendentesDeExemplo.filter((m) => m.post !== post);
      return;
    }
    await rpc("rede_o9_marcacao_decidir", { p_post: post, p_aceitar: aceitar });
  },

  tirarMarcacao: async (post: string, handle: string): Promise<void> => {
    esquecerCartao(post);
    if (previa()) return;
    await rpc("rede_o9_desmarcar", { p_post: post, p_handle: handle });
  },
};
