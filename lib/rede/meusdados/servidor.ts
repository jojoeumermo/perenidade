// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do servidor da cópia de "Meus dados" (app/api/rede/exportar): pede ao banco a cópia COMO a pessoa (o banco confere o
// segundo fator recente e o limite de uma por dia), baixa as mídias da pasta dela com o token dela (a regra do depósito vale) e
// monta o .zip na memória: meus-dados.json, index.html e a pasta midias. Nada é gravado em disco nem fica guardado depois da
// resposta. O que não couber no teto vai como endereço temporário (1 hora). Nenhuma chave de serviço aqui. Só roda no servidor.
// Sem "@/" de propósito.
import { chamarComoPessoa } from "../publicar/servidor";
import { montarIndice, type ArquivoListado } from "./indice";
import { carregarTextosDeMeusDados } from "./textos";
import { zipar, type ArquivoDoZip } from "./zip";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** O teto de bytes de mídia dentro do .zip e de arquivos baixados; o resto vira endereço temporário. */
export const TETO_DE_BYTES = 80 * 1024 * 1024;
export const TETO_DE_ARQUIVOS = 400;
/** Quanto vale o endereço temporário de um arquivo que não coube (em segundos). */
export const VIDA_DO_LINK = 3600;

// O depósito do vídeo do post entra pela parte da onda 12 (public.rede_meusdados_voz_e_video, 20261118-alumia-o12-midia.sql).
const DEPOSITOS = new Set(["rede-midia", "rede-stories", "rede-video"]);
const CAMINHO = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;
const JA_COMPRIMIDO = /\.(webp|png|jpe?g|mp4|webm|ogg|m4a|opus)$/i;

interface Midia {
  deposito: string;
  caminho: string;
}

const noEndereco = (caminho: string) => caminho.split("/").map(encodeURIComponent).join("/");

async function baixar(token: string, m: Midia, resto: number): Promise<Uint8Array | null> {
  try {
    const r = await fetch(`${url}/storage/v1/object/authenticated/${m.deposito}/${noEndereco(m.caminho)}`, {
      headers: { apikey: chave, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return null;
    const tamanho = Number(r.headers.get("content-length") ?? "0");
    if (tamanho > resto) {
      await r.body?.cancel().catch(() => undefined);
      return null;
    }
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length <= resto ? bytes : null;
  } catch {
    return null;
  }
}

async function assinar(token: string, m: Midia): Promise<string | undefined> {
  try {
    const r = await fetch(`${url}/storage/v1/object/sign/${m.deposito}/${noEndereco(m.caminho)}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: VIDA_DO_LINK }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = r.ok ? ((await r.json().catch(() => null)) as { signedURL?: string } | null) : null;
    return corpo?.signedURL ? `${url}/storage/v1${corpo.signedURL}` : undefined;
  } catch {
    return undefined;
  }
}

/** As linhas que vieram do aparelho: só o formato esperado, sem nada além de texto curto (é a pessoa mandando para si mesma). */
export function linhasDoAparelho(bruto: unknown): unknown[] {
  if (!Array.isArray(bruto)) return [];
  const saida: unknown[] = [];
  for (const l of bruto.slice(0, 40)) {
    if (!l || typeof l !== "object") continue;
    const x = l as Record<string, unknown>;
    const nome = typeof x.nome === "string" ? x.nome.slice(0, 60) : "";
    if (!nome) continue;
    const texto = x.filtro && typeof x.filtro === "object" ? JSON.stringify(x.filtro) : "{}";
    const filtro: unknown = texto.length <= 2000 ? JSON.parse(texto) : {};
    saida.push({ nome, base: typeof x.base === "string" ? x.base.slice(0, 20) : "", filtro, fixada: x.fixada === true });
  }
  return saida;
}

export type ResultadoDaCopia = { ok: true; zip: Uint8Array; nome: string; links: number } | { ok: false; codigo: string; status: number };

/**
 * Junta os vídeos e as transcrições da onda 12 à cópia (uma chamada a mais, como a própria pessoa). Sem a migração da onda 12
 * no banco, ou se a parte falhar, a cópia sai como antes.
 */
async function comVozEVideo(token: string, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  const extra = await chamarComoPessoa<{ videos_dos_posts?: unknown; transcricoes_dos_audios?: unknown; midias?: unknown }>(token, "rede_meusdados_voz_e_video");
  if (!extra.ok || !extra.dado) return dados;
  const lista = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    ...dados,
    videos_dos_posts: lista(extra.dado.videos_dos_posts),
    transcricoes_dos_audios: lista(extra.dado.transcricoes_dos_audios),
    midias: [...lista(dados.midias), ...lista(extra.dado.midias)],
  };
}

/**
 * Junta o resto do que a pessoa fez nas ondas 9 a 14 (perfil, termos, redações, funções, organizações, participação e
 * preferências: public.rede_meusdados_mais, 20261123-r1-borda.sql). Sem a migração no banco, ou se a parte falhar, a cópia sai
 * como antes. O que a cópia principal já trouxe não é trocado.
 */
async function comOResto(token: string, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  const mais = await chamarComoPessoa<Record<string, unknown>>(token, "rede_meusdados_mais");
  if (!mais.ok || !mais.dado) return dados;
  const novas = Object.entries(mais.dado).filter(([chave]) => !(chave in dados));
  return { ...dados, ...Object.fromEntries(novas) };
}

/** Monta a cópia inteira. */
export async function montarCopia(token: string, lang: string, linhas: unknown[]): Promise<ResultadoDaCopia> {
  const resposta = await chamarComoPessoa<Record<string, unknown>>(token, "rede_meusdados_exportar");
  if (!resposta.ok) return resposta;
  const dados = await comOResto(token, await comVozEVideo(token, resposta.dado));
  const midias = (Array.isArray(dados.midias) ? (dados.midias as Midia[]) : []).filter((m) => DEPOSITOS.has(m?.deposito) && CAMINHO.test(m?.caminho ?? ""));

  const arquivos: ArquivoDoZip[] = [];
  const listados: ArquivoListado[] = [];
  let resto = TETO_DE_BYTES;
  let links = 0;
  // Quatro de cada vez: rápido o bastante, sem abrir centenas de conexões com o depósito.
  for (let i = 0; i < midias.length; i += 4) {
    const lote = midias.slice(i, i + 4);
    const baixados = await Promise.all(lote.map((m, j) => (i + j < TETO_DE_ARQUIVOS && resto > 0 ? baixar(token, m, resto) : Promise.resolve(null))));
    for (const [j, m] of lote.entries()) {
      const bytes = baixados[j];
      const nome = `midias/${m.deposito}/${m.caminho.split("/").pop()}`;
      if (bytes && bytes.length <= resto) {
        resto -= bytes.length;
        arquivos.push({ nome, dados: bytes, guardado: JA_COMPRIMIDO.test(nome) });
        listados.push({ caminho: m.caminho, local: nome });
      } else {
        const link = await assinar(token, m);
        if (link) links++;
        listados.push({ caminho: m.caminho, link });
      }
    }
  }

  const t = await carregarTextosDeMeusDados(lang);
  const codificar = new TextEncoder();
  const json = { ...dados, ...(linhas.length ? { linhas_deste_aparelho: linhas } : {}), midias: listados };
  arquivos.unshift(
    { nome: "index.html", dados: codificar.encode(montarIndice(dados, t.arquivo, { lang, arquivos: listados, linhas })) },
    { nome: "meus-dados.json", dados: codificar.encode(JSON.stringify(json, null, 2)) },
  );
  const dia = new Date().toISOString().slice(0, 10);
  return { ok: true, zip: zipar(arquivos), nome: `alumia-meus-dados-${dia}.zip`, links };
}
