// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da segurança pessoal (Prompt 4, itens 10 a 12): o aparelho de lib/rede/seguranca-pessoal/aparelho.ts ligado
// ao banco (lib/rede/cliente.ts), à identidade da conta (a do chat novo, como o voto usa: lib/rede/voto/identidade.ts), à guarda da
// chave neste aparelho (IndexedDB) e ao carimbo de tempo pelo servidor do site (app/api/alumia/carimbo). Nada sai daqui aberto.
import { BackendError, getClient } from "../../../lib/backend";
import { chamar } from "../../../lib/rede/cliente";
import { criarSeguranca, ErroDaSeguranca, type ItemDaCaixa, type Situacao } from "../../../lib/rede/seguranca-pessoal/aparelho";
import { resumoHex } from "../../../lib/rede/seguranca-pessoal/selo";
import { guardarChaveDeSeguranca, lerChaveDeSeguranca } from "../../../lib/rede/seguranca-pessoal/guarda";
import { fonteDaIdentidadeDoVoto } from "../../../lib/rede/voto/identidade";

async function token(): Promise<string | null> {
  try {
    const supabase = await getClient();
    return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** O carimbo pelo servidor do site. Sem serviço, fora do ar ou recusado: nulo (o registro sai sem carimbo, e a tela diz). */
async function carimbar(resumo: string): Promise<{ carimbo: string; hora: string; servico: string } | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch("/api/alumia/carimbo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ resumo }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const d = (await r.json().catch(() => null)) as { ok?: boolean; carimbo?: string; hora?: string; servico?: string } | null;
    return d?.ok && d.carimbo && d.hora && d.servico ? { carimbo: d.carimbo, hora: d.hora, servico: d.servico } : null;
  } catch {
    return null;
  }
}

const aparelho = criarSeguranca({
  chamar,
  // A identidade ligada pelo chat; se o chat ainda não abriu nesta aba, abre agora (sem ela não há chave nem conferência).
  fonte: async () => {
    if (!fonteDaIdentidadeDoVoto()) await import("../../../lib/rede/chat/r2/navegador").then((n) => n.abrirIdentidadeDoVoto()).catch(() => undefined);
    return fonteDaIdentidadeDoVoto();
  },
  guarda: { ler: lerChaveDeSeguranca, guardar: guardarChaveDeSeguranca },
  carimbar,
});

/** O erro do aparelho vira o erro de sempre (BackendError com o código), que a tela traduz. */
function comErro<A extends unknown[], T>(f: (...a: A) => Promise<T>): (...a: A) => Promise<T> {
  return async (...a: A) => {
    try {
      return await f(...a);
    } catch (e) {
      if (e instanceof ErroDaSeguranca) throw new BackendError(e.codigo);
      throw e;
    }
  };
}

/** Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória faz a tela andar sem banco (nada vai a lugar nenhum; nada é cifrado). */
export const PREVIA_DA_SEGURANCA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

function dubleDaPrevia(): typeof aparelho {
  const dia = new Date().toISOString().slice(0, 10);
  const sit: Situacao = {
    chave: null, identidade: true,
    assessora_de: [{ handle: "coletivo_exemplo", nome: "Coletivo Exemplo" }],
    gestora_de: [{ handle: "coletivo_exemplo", nome: "Coletivo Exemplo", pronta: false }],
    plantoes: [{ handle: "coletivo_exemplo", nome: "Coletivo Exemplo" }],
    sumico: null,
  };
  const caixa: ItemDaCaixa[] = [{ id: "00000000-0000-4000-8000-000000000001", org: "coletivo_exemplo", finalidade: "plantao", dia, apagar_em: dia, tamanho: 2076 }];
  const espera = <T,>(v: T) => new Promise<T>((ok) => setTimeout(() => ok(v), 120));
  const nada = () => espera(undefined as never);
  return {
    situacao: () => espera({ ...sit }),
    minhaChave: () => espera({ identidade: true, aqui: !!sit.chave, confere: !!sit.chave }),
    criarMinhaChave: async () => { sit.chave = "previa"; },
    tirarMinhaChave: async () => { sit.chave = null; return undefined as never; },
    pedirPlantao: () => espera({ id: crypto.randomUUID(), assessoras: 1 }),
    registrar: async (_o, arquivo) => ({ id: crypto.randomUUID(), assessoras: 1, resumo: await resumoHex(arquivo), carimbado: false }),
    caixa: () => espera(caixa.slice()),
    abrirDaCaixa: () => espera({ finalidade: "plantao" as const, pedido: { v: 1 as const, onde: "Praça de exemplo", ocorrido: "detencao" as const, contato: { tipo: "alumia" as const, valor: "@exemplo" } } }),
    apagarDaCaixa: async (id) => { caixa.splice(caixa.findIndex((i) => i.id === id), 1); return undefined as never; },
    assessora: nada,
    sairDaAssessoria: nada,
    ligarSumico: async (o) => { sit.sumico = { dias: o.dias, apagar: o.apagar, destino: o.destino?.replace(/^@/, "") || null, prazo: dia }; return undefined as never; },
    desligarSumico: async () => { sit.sumico = null; return undefined as never; },
    recebidos: () => espera([]),
    apagarRecebido: nada,
  };
}

export const seguranca = PREVIA_DA_SEGURANCA ? dubleDaPrevia() : Object.fromEntries(
  Object.entries(aparelho).map(([k, f]) => [k, comErro(f as (...a: unknown[]) => Promise<unknown>)]),
) as typeof aparelho;
