// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
//
// O lado do navegador da frente 12C (supabase/migracoes/20261118-alumia-o12-coautoria.sql). O que o cartão precisa
// (rede_coautoria_cartoes) vai por lote: os cartões que aparecem juntos pedem juntos, numa chamada só. Na prévia
// (NEXT_PUBLIC_ALUMIA_PREVIA=sim) nada vai a banco nenhum: um dublê na memória da aba faz a tela andar.
// A marcação em foto usa as funções da onda 9 (rede_o9_marcar / rede_o9_desmarcar); aqui só se chama.
import { rpc } from "@/lib/backend";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { COAUTORIA_VAZIA, type CoautoriaDoCartao, type ConviteDeCoautoria, type FonteDoPost } from "@/lib/rede/tipos-conversa";

const previa = () => previaLigada();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───── O dublê da prévia ─────
// Os posts de exemplo (lib/rede/publicar/exemplos-alumia2.ts): um já assinado junto e com fonte, um "da própria pessoa" (para ver o
// que a autora vê: convites, pedidos de fonte e o marcar) e um com convite esperando a resposta de quem lê.
const doDuble: Record<string, Partial<CoautoriaDoCartao>> = {
  "exemplo-mandata": {
    coautores: [{ handle: "rosavermelha", codinome: "Rosa Vermelha" }, { handle: "liaquilombo", codinome: "Lia Quilombo" }],
    fonte: { link: "https://example.org/camara-votacao-tarifa", vale: null },
  },
  "exemplo-lia": {
    convites: [{ handle: "saradograjau", codinome: "Sara do Grajaú" }],
    pode_convidar: true,
    pedidos_fonte: { ha: true, total: 4 },
    // Nenhum post de exemplo tem foto própria (o da Lia só tem a imagem do link): "Marcar na foto" não aparece, como no banco.
    marcar_pode: false,
    marcacoes_esperando: [],
  },
  "exemplo-cohab": { meu_convite: "convite", pode_pedir_fonte: true },
  "exemplo-rosa": { pode_pedir_fonte: true },
};
let convitesDoDuble: ConviteDeCoautoria[] = [
  {
    post: "exemplo-cohab", codinome: "Núcleo Cohab 2", handle: "nucleocohab2", convidada_em: new Date(Date.now() - 50 * 60_000).toISOString(),
    trecho: "Círculo de estudo de sábado: vamos ler o capítulo sobre trabalho e cultura e depois tem roda de rima.",
  },
];
// Como no banco: "Fonte?" só onde o exemplo diz (nunca nos posts da própria pessoa, nem nos que vêm do Fediverso).
function cartaoDoDuble(id: string): CoautoriaDoCartao {
  const c = { ...COAUTORIA_VAZIA, pode_pedir_fonte: false, ...(doDuble[id] ?? {}) };
  return c.fonte ? { ...c, pode_pedir_fonte: false } : c;
}
function mudarDuble(id: string, parte: Partial<CoautoriaDoCartao>) {
  doDuble[id] = { ...(doDuble[id] ?? {}), ...parte };
}

// ───── O lote dos cartões ─────
let pedidos = new Map<string, ((c: CoautoriaDoCartao) => void)[]>();
let agendado = false;
const guardados = new Map<string, CoautoriaDoCartao>();

async function rodarLote() {
  agendado = false;
  const lote = pedidos;
  pedidos = new Map();
  const ids = [...lote.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const parte = ids.slice(i, i + 50);
    let r: Record<string, Partial<CoautoriaDoCartao>> = {};
    try {
      if (previa()) r = Object.fromEntries(parte.map((id) => [id, cartaoDoDuble(id)]));
      else {
        const doBanco = parte.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
        if (doBanco.length > 0) r = (await rpc<Record<string, Partial<CoautoriaDoCartao>>>("rede_coautoria_cartoes", { p_ids: doBanco })) ?? {};
      }
    } catch {
      r = {};
    }
    for (const id of parte) {
      const c = { ...COAUTORIA_VAZIA, ...(r[id] ?? {}) };
      guardados.set(id, c);
      for (const f of lote.get(id) ?? []) f(c);
    }
  }
}

/** O que a frente sabe de um post, para o cartão. Sem banco, sem resposta ou com erro: tudo vazio (o cartão não muda). */
export function coautoriaDoCartao(id: string, renovar = false): Promise<CoautoriaDoCartao> {
  if (!renovar && guardados.has(id)) return Promise.resolve(guardados.get(id) as CoautoriaDoCartao);
  return new Promise((resolver) => {
    pedidos.set(id, [...(pedidos.get(id) ?? []), resolver]);
    if (!agendado) {
      agendado = true;
      setTimeout(() => void rodarLote(), 30);
    }
  });
}

/** Esquece o que estava guardado de um post (depois de convidar, pedir a fonte, marcar…). */
export function esquecer(id?: string) {
  if (id) guardados.delete(id);
  else guardados.clear();
}

export const coautoria = {
  convidar: async (post: string, handle: string): Promise<{ estado: "convite" | "feita" }> => {
    esquecer(post);
    if (previa()) {
      await espera(200);
      const c = cartaoDoDuble(post);
      if ((c.convites ?? []).some((x) => x.handle === handle)) return { estado: "feita" };
      mudarDuble(post, { convites: [...(c.convites ?? []), { handle, codinome: `@${handle}` }], pode_convidar: c.coautores.length + (c.convites?.length ?? 0) + 1 < 3 });
      return { estado: "convite" };
    }
    return rpc("rede_coautoria_convidar", { p_post: post, p_handle: handle });
  },
  decidir: async (post: string, aceitar: boolean): Promise<void> => {
    esquecer(post);
    if (previa()) {
      await espera(200);
      convitesDoDuble = convitesDoDuble.filter((x) => x.post !== post);
      mudarDuble(post, { meu_convite: aceitar ? "aceita" : null, coautores: aceitar ? [...cartaoDoDuble(post).coautores, { handle: "voce", codinome: "Você" }] : cartaoDoDuble(post).coautores });
      return;
    }
    await rpc("rede_coautoria_decidir", { p_post: post, p_aceitar: aceitar });
  },
  sair: async (post: string): Promise<void> => {
    esquecer(post);
    if (previa()) {
      await espera(200);
      mudarDuble(post, { meu_convite: null, coautores: cartaoDoDuble(post).coautores.filter((x) => x.handle !== "voce") });
      return;
    }
    await rpc("rede_coautoria_sair", { p_post: post });
  },
  tirar: async (post: string, handle: string): Promise<void> => {
    esquecer(post);
    if (previa()) {
      await espera(150);
      const c = cartaoDoDuble(post);
      mudarDuble(post, { convites: (c.convites ?? []).filter((x) => x.handle !== handle), pode_convidar: true });
      return;
    }
    await rpc("rede_coautoria_tirar", { p_post: post, p_handle: handle });
  },
  convites: async (): Promise<ConviteDeCoautoria[]> => {
    if (previa()) return [...convitesDoDuble];
    return (await rpc<ConviteDeCoautoria[]>("rede_coautoria_convites")) ?? [];
  },

  pedirFonte: async (post: string, sim: boolean): Promise<void> => {
    esquecer(post);
    if (previa()) {
      await espera(150);
      mudarDuble(post, { pedi_fonte: sim });
      return;
    }
    await rpc("rede_fonte_pedir", { p_post: post, p_sim: sim });
  },
  darFonte: async (post: string, fonte: FonteDoPost): Promise<void> => {
    esquecer(post);
    if (previa()) {
      await espera(200);
      mudarDuble(post, { fonte, pedidos_fonte: { ha: false, total: null } });
      return;
    }
    await rpc("rede_fonte_dar", { p_post: post, p_link: fonte.link, p_vale: fonte.vale });
  },
  tirarFonte: async (post: string): Promise<void> => {
    esquecer(post);
    if (previa()) {
      mudarDuble(post, { fonte: null });
      return;
    }
    await rpc("rede_fonte_tirar", { p_post: post });
  },

  /** Marca uma pessoa na foto (a função da onda 9; a regra nova do ato e da comunidade de luta está no banco). */
  marcar: async (post: string, handle: string): Promise<{ estado: "pendente" | "aprovada" | "feita" }> => {
    esquecer(post);
    if (previa()) {
      await espera(200);
      const c = cartaoDoDuble(post);
      if ((c.marcacoes_esperando ?? []).some((x) => x.handle === handle)) return { estado: "feita" };
      mudarDuble(post, { marcacoes_esperando: [...(c.marcacoes_esperando ?? []), { handle, codinome: `@${handle}` }] });
      return { estado: "pendente" };
    }
    return rpc("rede_o9_marcar", { p_post: post, p_handle: handle });
  },
  desmarcar: async (post: string, handle: string): Promise<void> => {
    esquecer(post);
    if (previa()) {
      mudarDuble(post, { marcacoes_esperando: (cartaoDoDuble(post).marcacoes_esperando ?? []).filter((x) => x.handle !== handle) });
      return;
    }
    await rpc("rede_o9_desmarcar", { p_post: post, p_handle: handle });
  },

  /** As checagens do Vale o Escrito citadas pelas notas de um post ({nota: caso}). */
  valesDasNotas: async (post: string): Promise<Record<string, string>> => {
    if (previa()) return {};
    return (await rpc<Record<string, string>>("rede_notas_vale", { p_post: post })) ?? {};
  },
  /** Liga (ou troca) a checagem da própria nota; vazio desliga. */
  ligarVale: async (nota: string, vale: string | null): Promise<void> => {
    if (previa()) return;
    await rpc("rede_nota_vale_ligar", { p_nota: nota, p_vale: vale ?? "" });
  },
};

/**
 * O caso existe no Vale o Escrito publicado? Pergunta à própria página da ficha, no mesmo endereço do site (nada sai para fora):
 * 200 é sim; 404 é não. Sem resposta (fora do ar, sem rede), nulo: o banco ainda recusa caso retirado.
 */
export async function casoPublicado(lang: string, vale: string): Promise<boolean | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(vale)) return false;
  try {
    const r = await fetch(`/${encodeURIComponent(lang)}/vale-o-escrito/caso/${vale}`, { method: "HEAD", credentials: "omit", cache: "no-store", redirect: "follow" });
    if (r.ok) return true;
    return r.status === 404 ? false : null;
  } catch {
    return null;
  }
}
