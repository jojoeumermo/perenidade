// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência da mídia do story logo depois de publicar (P5, A16), no servidor do site (app/api/rede/stories/conferir): a mesma
// limpeza da faxina (supabase/functions/faxina-stories/faxina.mjs: EXIF, GPS, XMP, IPTC e o texto do PNG saem; vídeo com caixa
// de lugar sai do ar), sem esperar a rodada de 15 minutos. Enquanto não é conferido, ninguém além da autora abre o arquivo
// (public.rede_story_pode, 20261126-p5-stories.sql). O caminho vem do banco, pedido COMO a autora (public.rede_story_conferir_pedir:
// só o story dela, só enquanto não foi conferido); o arquivo é lido, limpo e marcado com a chave de serviço, que só o servidor tem.
// Nada daqui registra caminho, conteúdo nem pessoa. Só roda no servidor. Sem "@/".
import { conferirUm } from "../../../supabase/functions/faxina-stories/faxina.mjs";
import { chamarComoPessoa } from "../publicar/servidor";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEPOSITO = "rede-stories";
const caminhoOk = (c: string) => /^[0-9a-f-]{36}\/[0-9a-f-]{32,36}\.(webp|png|jpg|mp4|webm)$/.test(c);
const noEndereco = (c: string) => c.split("/").map(encodeURIComponent).join("/");

export type ResultadoDaConferencia = "conferido" | "ruim" | "nada" | "sem_servico" | "falhou" | { erro: string; status: number };

/** Há como conferir agora (endereço do banco e chave de serviço no servidor)? */
export const conferirLigado = (): boolean => Boolean(url && servico());

export interface FormasDeFalar {
  /** O caminho da mídia e (P5) o da versão menor da foto, se houver. */
  pedir: (token: string, id: string) => Promise<{ ok: true; caminho: string | null; menor?: string | null } | { ok: false; erro: string; status: number }>;
  baixar: (caminho: string) => Promise<Uint8Array>;
  subir: (caminho: string, bytes: Uint8Array, tipo: string) => Promise<void>;
  marcar: (id: string, resultado: "conferido" | "ruim") => Promise<void>;
}

/** O passo a passo, com as formas de falar trocáveis (o teste usa dublês). A versão menor é conferida igual; uma ruim tira o story. */
export async function conferirStory(token: string, id: string, f: FormasDeFalar): Promise<ResultadoDaConferencia> {
  const pedido = await f.pedir(token, id);
  if (!pedido.ok) return { erro: pedido.erro, status: pedido.status };
  if (!pedido.caminho) return "nada";
  const caminhos = pedido.menor ? [pedido.caminho, pedido.menor] : [pedido.caminho];
  if (!caminhos.every(caminhoOk)) return "falhou";
  try {
    let resultado: "conferido" | "ruim" = "conferido";
    for (const c of caminhos) {
      const r = (await conferirUm(c, { baixar: f.baixar, subir: f.subir })) as { resultado: "conferido" | "ruim" };
      if (r.resultado === "ruim") resultado = "ruim";
    }
    await f.marcar(id, resultado);
    return resultado;
  } catch {
    // Falhou a ida ao depósito: a faxina de 15 em 15 minutos tenta de novo (até lá, só a autora abre o arquivo).
    return "falhou";
  }
}

const cabecalhos = () => ({ apikey: servico(), Authorization: `Bearer ${servico()}` });

/** As formas de verdade: o banco como a pessoa para o pedido, e a chave de serviço para o depósito e a marca. */
export const formasDeVerdade: FormasDeFalar = {
  pedir: async (token, id) => {
    const r = await chamarComoPessoa<{ caminho: string | null; menor?: string | null }>(token, "rede_story_conferir_pedir", { p_id: id });
    return r.ok ? { ok: true, caminho: r.dado?.caminho ?? null, menor: r.dado?.menor ?? null } : { ok: false, erro: r.codigo, status: r.status };
  },
  baixar: async (caminho) => {
    const r = await fetch(`${url}/storage/v1/object/${DEPOSITO}/${noEndereco(caminho)}`, { headers: cabecalhos(), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error("baixar");
    return new Uint8Array(await r.arrayBuffer());
  },
  subir: async (caminho, bytes, tipo) => {
    const r = await fetch(`${url}/storage/v1/object/${DEPOSITO}/${noEndereco(caminho)}`, {
      method: "PUT",
      headers: { ...cabecalhos(), "Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=3600" },
      body: bytes as unknown as BodyInit,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error("subir");
  },
  marcar: async (id, resultado) => {
    const r = await fetch(`${url}/rest/v1/rpc/rede_story_faxina_feito`, {
      method: "POST",
      headers: { ...cabecalhos(), "Content-Type": "application/json" },
      body: JSON.stringify({ p_apagados: [], p_conferidos: resultado === "conferido" ? [id] : [], p_ruins: resultado === "ruim" ? [id] : [] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error("marcar");
  },
};
