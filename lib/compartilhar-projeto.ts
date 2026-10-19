// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Compartilhar um projeto da IDE por link, sem servidor: os arquivos vão comprimidos no próprio endereço, depois do #
// (a parte que o navegador nunca envia ao site). Quem abre o link recebe uma cópia; nada fica guardado em lugar nenhum.
import type { ArquivoDoProjeto } from "./zip";

export interface ProjetoCompartilhado {
  perfil: string;
  arquivos: ArquivoDoProjeto[];
  entrada?: string;
}

const CHAVE = "projeto=";
/** Acima disso, alguns navegadores e aplicativos de mensagem cortam o link. */
const LIMITE = 60_000;

function paraBase64Url(bytes: Uint8Array) {
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto: string) {
  const b = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function passar(bytes: Uint8Array, transformacao: CompressionStream | DecompressionStream) {
  const fluxo = new Blob([bytes as BlobPart]).stream().pipeThrough(transformacao);
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** O endereço atual com o projeto no fim, ou null se não couber num link. */
export async function linkDoProjeto(endereco: string, projeto: ProjetoCompartilhado): Promise<string | null> {
  const json = new TextEncoder().encode(JSON.stringify(projeto));
  const comprimido = await passar(json, new CompressionStream("deflate-raw"));
  const codigo = paraBase64Url(comprimido);
  if (codigo.length > LIMITE) return null;
  const url = new URL(endereco);
  url.hash = CHAVE + codigo;
  return url.toString();
}

/** O projeto que veio no link (#projeto=...), conferido: só arquivos de texto com nome simples, até 30. */
export async function lerDoLink(hash: string): Promise<ProjetoCompartilhado | null> {
  const i = hash.indexOf(CHAVE);
  if (i < 0) return null;
  try {
    const bytes = await passar(deBase64Url(hash.slice(i + CHAVE.length)), new DecompressionStream("deflate-raw"));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as ProjetoCompartilhado;
    if (typeof p?.perfil !== "string" || !Array.isArray(p.arquivos)) return null;
    const arquivos = p.arquivos
      .filter((a) => typeof a?.nome === "string" && typeof a?.conteudo === "string" && /^[\w.-]{1,60}$/.test(a.nome))
      .slice(0, 30)
      .map((a) => ({ nome: a.nome, conteudo: a.conteudo.slice(0, 500_000) }));
    return { perfil: p.perfil, arquivos, entrada: typeof p.entrada === "string" ? p.entrada.slice(0, 20_000) : undefined };
  } catch {
    return null;
  }
}
