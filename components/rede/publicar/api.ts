// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BackendError, getClient, signedStorageUrl } from "@/lib/backend";
import { redePub } from "@/lib/rede/cliente-publicar";
import type { PreviaDoPost } from "@/lib/rede/tipos-publicar";

/** O token da sessão (as rotas do servidor repassam ao banco: tudo é conferido como a própria pessoa). */
async function token(): Promise<string> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

const erroDaRota = async (r: Response): Promise<never> => {
  const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
  const e = corpo?.erro ?? "falha";
  // 413 e 415 viram códigos que os textos do pacote conhecem.
  throw new BackendError(r.status === 413 ? "invalido:midia" : r.status === 415 ? "invalido:midia" : e);
};

export interface MidiaSubida {
  caminho: string;
  tipo: string;
  largura: number | null;
  altura: number | null;
}

/** Sobe uma imagem (já reencodada) ou um áudio. O servidor tira o metadado de novo e guarda na pasta da pessoa. */
export async function enviarMidia(blob: Blob): Promise<MidiaSubida> {
  const r = await fetch("/api/rede/midia", { method: "POST", headers: { Authorization: `Bearer ${await token()}` }, body: blob }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  if (!r.ok) return erroDaRota(r);
  return (await r.json()) as MidiaSubida;
}

/** A prévia do link, montada pelo servidor (nulo se a página não deu para ler). */
export async function gerarPrevia(url: string): Promise<PreviaDoPost | null> {
  try {
    const r = await fetch(`/api/rede/previa?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!r.ok) return null;
    return (await r.json()) as PreviaDoPost;
  } catch {
    return null;
  }
}

/** O endereço assinado de uma imagem ou de um áudio do post (vale uma hora; só sai se a matriz deixa ver o post). */
export async function enderecoDaMidia(id: string): Promise<string> {
  const { bucket, caminho } = await redePub.caminhoDaMidia(id);
  return signedStorageUrl(bucket, caminho, 3600);
}
