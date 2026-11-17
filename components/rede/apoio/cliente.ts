// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do apoio (onda 13, frente 13A; supabase/migracoes/20261119-alumia-o13-apoio.sql): a vaquinha (meta, arrecadado,
// prestação de contas, como apoiar e a denúncia de vaquinha falsa) e a petição com meta e o documento de entrega. Tudo o que
// volta passa pela limpeza de regras.ts (sem selo, nada de Pix nem link; total da petição só de 3 para cima).
//
// Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) o caixa e a petição vêm dos dublês que já existem (B1 da organização e quadros do
// ato), e o que é desta frente (meta, arrecadado, contas, meta da petição) fica num dublê na memória daqui.
import { atos } from "../../../lib/rede/cliente-atos";
import { chamar } from "../../../lib/rede/cliente";
import { clienteOrgB1 } from "../../../lib/rede/cliente-org-b1";
import type { CaixasDaOrg } from "../../../lib/rede/org/b1";
import { previaLigada } from "../../../lib/rede/org/exemplos";
import type { PedidoDePeticao, PeticaoDoAto } from "../../../lib/rede/tipos-atos";
import { limparCaixas, limparPeticaoComMeta, type CaixasComVaquinha, type ContaDaVaquinha, type EntregaDaPeticao, type PeticaoComMeta } from "./regras";

export interface AjusteDaVaquinha { pix?: string; link?: string; meta?: string | null; arrecadado?: string | null }
export interface PedidoDeConta { dia: string; texto: string; link?: string }

export interface ClienteDoApoio {
  /** Os caixas da organização, com a vaquinha. */
  caixa(handle: string): Promise<CaixasComVaquinha | null>;
  /** O que as outras chamadas do caixa (B1) devolvem, com a vaquinha junto. */
  junto(handle: string, r: CaixasDaOrg): Promise<CaixasComVaquinha | null>;
  ajustar(handle: string, caixa: string, p: AjusteDaVaquinha): Promise<CaixasComVaquinha | null>;
  conta(handle: string, caixa: string, p: PedidoDeConta): Promise<CaixasComVaquinha | null>;
  retirarConta(handle: string, conta: string): Promise<CaixasComVaquinha | null>;
  denunciar(caixa: string, texto: string): Promise<{ protocolo: string; ja: boolean }>;

  peticao(ato: string): Promise<PeticaoComMeta | null>;
  peticaoCriar(ato: string, p: PedidoDePeticao & { meta: number | null }): Promise<PeticaoComMeta | null>;
  peticaoAssinar(id: string, sim: boolean): Promise<PeticaoComMeta | null>;
  peticaoEncerrar(id: string): Promise<PeticaoComMeta | null>;
  peticaoMeta(id: string, meta: number | null): Promise<PeticaoComMeta | null>;
  peticaoEntrega(id: string): Promise<EntregaDaPeticao>;
}

function clienteDeVerdade(): ClienteDoApoio {
  const c = chamar;
  const pet = async (f: string, a: Record<string, unknown>) => limparPeticaoComMeta(await c<PeticaoComMeta | null>(f, a));
  const caixa = async (handle: string) => limparCaixas(await c<CaixasComVaquinha | null>("rede_org_caixa", { p_handle: handle }));
  return {
    caixa,
    junto: async (_handle, r) => limparCaixas(r),
    ajustar: async (_h, caixa, p) => limparCaixas(await c<CaixasComVaquinha>("rede_org_vaquinha_ajustar", { p_caixa: caixa, p })),
    conta: async (_h, caixa, p) => limparCaixas(await c<CaixasComVaquinha>("rede_org_vaquinha_conta", { p_caixa: caixa, p })),
    retirarConta: async (_h, conta) => limparCaixas(await c<CaixasComVaquinha>("rede_org_vaquinha_conta_retirar", { p_conta: conta })),
    denunciar: (caixa, texto) => c<{ protocolo: string; ja: boolean }>("rede_org_vaquinha_denunciar", { p_caixa: caixa, p_texto: texto }),
    peticao: (ato) => pet("rede_peticao", { p_ato: ato }),
    peticaoCriar: (ato, p) => pet("rede_peticao_criar", { p_ato: ato, p }),
    peticaoAssinar: (id, sim) => pet("rede_peticao_assinar", { p_peticao: id, p_sim: sim }),
    peticaoEncerrar: (id) => pet("rede_peticao_encerrar", { p_peticao: id }),
    peticaoMeta: (id, meta) => pet("rede_peticao_meta", { p_peticao: id, p_meta: meta }),
    peticaoEntrega: (id) => c<EntregaDaPeticao>("rede_peticao_entrega", { p_peticao: id }),
  };
}

function duble(): ClienteDoApoio {
  const hoje = () => new Date().toISOString().slice(0, 10);
  const dia = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  // O primeiro caixa da prévia já chega com uma vaquinha andando, para a tela mostrar tudo.
  const vaquinhas = new Map<string, { meta: number | null; arrecadado: number | null; arrecadadoDia: string | null; contas: ContaDaVaquinha[] }>([
    ["cx-1", {
      meta: 500_000, arrecadado: 312_040, arrecadadoDia: dia(-1),
      contas: [
        { id: "ct-2", dia: dia(-3), texto: "Pagamos o ônibus das 42 pessoas do núcleo Leste até a assembleia da categoria em Santo André.", link: null, possoRetirar: false },
        { id: "ct-1", dia: dia(-12), texto: "Compramos 40 cestas básicas para as famílias em greve há mais de duas semanas. As notas estão no site do coletivo.", link: "https://exemplo.org/notas", possoRetirar: false },
      ],
    }],
  ]);
  const metas = new Map<string, number | null>();
  const como = new Map<string, { pix?: string; link?: string | null }>();
  const juntar = (r: CaixasDaOrg | null): CaixasComVaquinha | null =>
    limparCaixas(r ? {
      ...r, selo: true,
      caixas: r.caixas.map((c) => ({ ...c, ...(como.get(c.id) ?? {}), ...(vaquinhas.get(c.id) ?? { meta: null, arrecadado: null, arrecadadoDia: null, contas: [] }) })),
    } as CaixasComVaquinha : null);
  const caixa = async (handle: string) => juntar(await clienteOrgB1().caixa(handle));
  const ultimas = new Map<string, PeticaoDoAto>();
  const comMeta = (p: PeticaoDoAto | null): PeticaoComMeta | null => {
    if (!p) return null;
    ultimas.set(p.id, p);
    const meta = metas.get(p.id) ?? null;
    return limparPeticaoComMeta({ ...p, meta, chegou: meta !== null && p.total !== null && p.total >= meta });
  };
  const espera = () => new Promise((r) => setTimeout(r, 120));
  const valor = (s: string | null | undefined) => (s ? Number(s) : null);
  return {
    caixa,
    junto: async (_h, r) => juntar(r),
    ajustar: async (handle, id, p) => {
      await espera();
      const v = vaquinhas.get(id) ?? { meta: null, arrecadado: null, arrecadadoDia: null, contas: [] };
      if ("meta" in p) v.meta = valor(p.meta);
      if ("arrecadado" in p) { v.arrecadado = valor(p.arrecadado); v.arrecadadoDia = v.arrecadado === null ? null : hoje(); }
      if ("pix" in p || "link" in p) como.set(id, { ...(como.get(id) ?? {}), ...("pix" in p ? { pix: p.pix } : {}), ...("link" in p ? { link: p.link || null } : {}) });
      vaquinhas.set(id, v);
      return caixa(handle);
    },
    conta: async (handle, id, p) => {
      await espera();
      const v = vaquinhas.get(id) ?? { meta: null, arrecadado: null, arrecadadoDia: null, contas: [] };
      v.contas.unshift({ id: `ct-${Date.now()}`, dia: p.dia, texto: p.texto, link: p.link || null, possoRetirar: true });
      vaquinhas.set(id, v);
      return caixa(handle);
    },
    retirarConta: async (handle, conta) => {
      await espera();
      for (const v of vaquinhas.values()) v.contas = v.contas.filter((k) => k.id !== conta);
      return caixa(handle);
    },
    denunciar: async () => {
      await espera();
      return { protocolo: "A1B2C3D4E5", ja: false };
    },
    peticao: async (ato) => comMeta(await atos.peticao(ato)),
    peticaoCriar: async (ato, p) => {
      const { meta, ...resto } = p;
      const r = await atos.peticaoCriar(ato, resto);
      if (r) metas.set(r.id, meta);
      return comMeta(r);
    },
    peticaoAssinar: async (id, sim) => comMeta(await atos.peticaoAssinar(id, sim)),
    peticaoEncerrar: async (id) => comMeta(await atos.peticaoEncerrar(id)),
    peticaoMeta: async (id, meta) => {
      await espera();
      metas.set(id, meta);
      return comMeta(ultimas.get(id) ?? null);
    },
    peticaoEntrega: async (id) => {
      await espera();
      const p = ultimas.get(id);
      if (!p) throw new Error("nao_encontrado");
      if (p.total === null) throw new Error("poucas_assinaturas");
      const agora = new Date().toISOString();
      return { alvo: p.alvo, texto: p.texto, total: p.total, meta: metas.get(id) ?? null, abertaEm: dia(-6), prazo: p.prazo, encerrada: !p.aberta, ato: null, geradoEm: agora };
    },
  };
}

let unico: ClienteDoApoio | null = null;
/** O cliente de verdade; na prévia, o dublê (criado uma vez por página). */
export function clienteDoApoio(): ClienteDoApoio {
  unico ??= previaLigada() ? duble() : clienteDeVerdade();
  return unico;
}
