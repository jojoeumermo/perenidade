// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A faxina dos arquivos das contas apagadas da Alumia ("Meus dados", apagar a conta). Quando o prazo de arrependimento vence, o
// banco apaga a conta e põe os caminhos das mídias dela na fila (interno.alumia_arquivos_a_apagar); só a API do depósito apaga o
// arquivo de verdade, e é isso que esta rota faz, com a chave de serviço: lê a fila, apaga do depósito e devolve ao banco o que
// saiu. O agendador do banco chama de hora em hora (interno.alumia_md_rodada, pelo pg_net).
//
// A fila leva também as fotos do álbum dos atos que saíram do registro (apagadas, recusadas, de conta apagada; onda 11).
// Na mesma rodada saem os arquivos órfãos da onda 10: as fotos do álbum dos atos que ficaram sem registro (recusadas, apagadas,
// reserva vencida) e os arquivos do núcleo apagados ou que nunca ficaram prontos (public.rede_ato_album_orfas e
// public.rede_acervo_orfaos, só a chave de serviço). A faxina diária do álbum (interno.rede_ato_album_faxina) também chama esta rota
// quando há órfãos.
//
// Com ALUMIA_FAXINA_SEGREDO no servidor, só quem manda o mesmo valor em "x-lucia-segredo" dispara (o banco guarda o valor em
// interno.configuracoes, chave 'meus_dados', campo 'segredo'). Sem ele, quem chamar à toa só adianta uma rodada: a rota apaga
// apenas o que já está na fila. A resposta é só contagem; nenhum caminho vai para log.
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

interface NaFila {
  id: number;
  deposito: string;
  caminho: string;
}

export async function POST(pedido: Request) {
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPA || !servico) return new Response(null, { status: 404, headers: semCache });
  const segredo = process.env.ALUMIA_FAXINA_SEGREDO ?? "";
  if (segredo && !igual(pedido.headers.get("x-lucia-segredo") ?? "", segredo)) return new Response(null, { status: 404, headers: semCache });

  const cabecalhos = { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" };
  const rpc = async <T,>(funcao: string, argumentos: Record<string, unknown>): Promise<T | null> => {
    try {
      const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, { method: "POST", headers: cabecalhos, body: JSON.stringify(argumentos), cache: "no-store", signal: AbortSignal.timeout(15_000) });
      return r.ok ? ((await r.json()) as T) : null;
    } catch {
      return null;
    }
  };

  let apagados = 0;
  let falhas = 0;
  for (let rodada = 0; rodada < 5; rodada++) {
    const fila = await rpc<NaFila[]>("rede_meusdados_arquivos_lista", { p_limite: 200 });
    if (!fila || fila.length === 0) break;
    const feitos: number[] = [];
    const ruins: number[] = [];
    // O álbum dos atos entra na fila quando a foto sai do registro (20261117-alumia-onda11-fim.sql); o vídeo do post, quando sai
    // do post ou a reserva vence (20261118-alumia-o12-midia.sql); o anexo cifrado do chat, quando vence, é aberto uma vez ou quem
    // mandou apaga (20261127-p4-anexo-cifrado.sql).
    for (const deposito of ["rede-midia", "rede-stories", "rede-album", "rede-video", "alumia-anexos"]) {
      const deste = fila.filter((a) => a.deposito === deposito);
      if (deste.length === 0) continue;
      try {
        // Apagar em lote: o depósito responde com o que apagou; o que já não existia também está resolvido.
        const r = await fetch(`${SUPA}/storage/v1/object/${deposito}`, {
          method: "DELETE",
          headers: cabecalhos,
          body: JSON.stringify({ prefixes: deste.map((a) => a.caminho) }),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        (r.ok ? feitos : ruins).push(...deste.map((a) => a.id));
      } catch {
        ruins.push(...deste.map((a) => a.id));
      }
    }
    const volta = await rpc<{ apagados: number; falhas: number }>("rede_meusdados_arquivos_feito", { p_feitos: feitos, p_falhas: ruins });
    if (!volta) break;
    apagados += volta.apagados;
    falhas += volta.falhas;
    if (feitos.length === 0) break;
  }
  // Os órfãos do álbum dos atos e do acervo do núcleo: a lista vem do banco, o depósito apaga em lote.
  let orfaos = 0;
  for (const [deposito, funcao] of [["rede-album", "rede_ato_album_orfas"], ["rede-acervo", "rede_acervo_orfaos"]] as const) {
    for (let rodada = 0; rodada < 5; rodada++) {
      const lista = await rpc<unknown[]>(funcao, { p_limite: 200 });
      // Função que devolve "setof text": cada item vem como o texto, ou como { nome_da_função: texto }.
      const caminhos = (lista ?? []).map((c) => (typeof c === "string" ? c : c && typeof c === "object" ? Object.values(c)[0] : null)).filter((c): c is string => typeof c === "string" && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(c));
      if (caminhos.length === 0) break;
      try {
        const r = await fetch(`${SUPA}/storage/v1/object/${deposito}`, {
          method: "DELETE",
          headers: cabecalhos,
          body: JSON.stringify({ prefixes: caminhos }),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) break;
        orfaos += caminhos.length;
      } catch {
        break;
      }
    }
  }
  return Response.json({ apagados, falhas, orfaos }, { headers: semCache });
}
