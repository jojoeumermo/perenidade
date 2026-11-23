// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Só o servidor do site importa este arquivo. Item 50 (Prompt 4): o canal do #tema para o RSS e o Atom (abaixo). Item 49: a busca dos #temas do Fediverso nos servidores aprovados pela
// coordenação (public.rede_p4_de_servidores_fora, só com a chave de serviço). Busca pelo buscarSeguro (nada de endereço de dentro de
// casa, tempo e tamanho limitados), guarda 10 minutos na memória por #tema e nunca diz ao servidor de fora quem pediu: o pedido sai
// do servidor do site, sem cookie, sem conta e sem o endereço de quem lê. Sem "@/" de propósito (roda nos testes).
import { buscarSeguro } from "../publicar/buscar-seguro";
import { rpcDeServico } from "../convites/servidor";
import { enderecoDoTema, juntarNotas, lerNotasDoTema, MAXIMO_DE_SERVIDORES, type NotaDeFora } from "./fediverso-tema";
import type { CanalDoFeed } from "./feeds";

const DEZ_MINUTOS = 10 * 60_000;
const guardados = new Map<string, { quando: number; notas: NotaDeFora[] }>();

/** Para os testes: troca a busca de fora e a lista de servidores. */
export interface Dubles {
  servidores?: () => Promise<string[] | null>;
  buscar?: (url: string) => Promise<unknown>;
}
let dubles: Dubles = {};
export function usarDubles(d: Dubles): void {
  dubles = d;
  guardados.clear();
}

async function servidoresAprovados(): Promise<string[] | null> {
  if (dubles.servidores) return dubles.servidores();
  const r = await rpcDeServico<string[] | null>("rede_p4_de_servidores_fora", {});
  return r.ok ? (Array.isArray(r.dado) ? r.dado : null) : null;
}

async function buscarJson(url: string): Promise<unknown> {
  if (dubles.buscar) return dubles.buscar(url);
  const r = await buscarSeguro(url, { tempoMs: 5000, maxBytes: 1_000_000, maxRedirecionamentos: 0, tipos: ["application/json"], cabecalhos: { Accept: "application/json" } });
  if (!r || r.truncado) return null;
  try {
    return JSON.parse(new TextDecoder().decode(r.corpo));
  } catch {
    return null;
  }
}

/**
 * As notas públicas de um #tema nos servidores aprovados (até 5), juntas e sem repetir. Nulo quando o lote está desligado no banco
 * (a rota responde 404). Um servidor que não responde fica de fora sem derrubar os outros.
 */
export async function notasDoTema(tema: string): Promise<NotaDeFora[] | null> {
  const servidores = await servidoresAprovados();
  if (!servidores) return null;
  const lista = servidores.slice(0, MAXIMO_DE_SERVIDORES);
  const chave = `${tema}|${lista.join(",")}`;
  const g = guardados.get(chave);
  if (g && Date.now() - g.quando < DEZ_MINUTOS) return g.notas;
  const listas = await Promise.all(lista.map(async (d) => lerNotasDoTema(await buscarJson(enderecoDoTema(d, tema)).catch(() => null), d)));
  const notas = juntarNotas(listas);
  if (guardados.size > 500) guardados.clear();
  guardados.set(chave, { quando: Date.now(), notas });
  return notas;
}

// ── Item 50: o canal do #tema, lido como visitante ──────────────────────────────────────────────────────────────────────────

const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const canais = new Map<string, { quando: number; canal: CanalDoFeed | null }>();

/** Para os testes: troca a leitura do banco. */
let lerDoBanco: ((tema: string) => Promise<CanalDoFeed | null>) | null = null;
export function usarBancoDoTema(f: ((tema: string) => Promise<CanalDoFeed | null>) | null): void {
  lerDoBanco = f;
  canais.clear();
}

/**
 * O canal de um #tema (public.rede_p4_de_rss_tag), chamado como visitante (a chave pública: a porta da entrada vale, e com a trava
 * ligada o banco recusa). Guarda 1 minuto na memória. Nulo quando não sai, quando o lote está desligado ou sem banco.
 */
export async function lerCanalDoTema(tema: string): Promise<CanalDoFeed | null> {
  const g = canais.get(tema);
  if (g && Date.now() - g.quando < 60_000) return g.canal;
  let canal: CanalDoFeed | null = null;
  if (lerDoBanco) canal = await lerDoBanco(tema);
  else if (SUPA_URL && CHAVE_PUBLICA) {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/rpc/rede_p4_de_rss_tag`, {
        method: "POST",
        headers: { apikey: CHAVE_PUBLICA, Authorization: `Bearer ${CHAVE_PUBLICA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_tag: tema }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      canal = r.ok ? (((await r.json().catch(() => null)) as CanalDoFeed | null) ?? null) : null;
    } catch {
      canal = null;
    }
  }
  if (canais.size > 2000) canais.clear();
  canais.set(tema, { quando: Date.now(), canal });
  return canal;
}
