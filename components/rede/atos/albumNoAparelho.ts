// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do aparelho do álbum do ato (frente 10F): mandar a foto (já borrada e refeita no canvas) para a rota do servidor, pedir o
// endereço assinado de uma foto (vale uma hora; quem decide é a regra do depósito) e apagar a própria foto. Na prévia
// (NEXT_PUBLIC_ALUMIA_PREVIA=sim), nada sai do aparelho: a foto mandada fica num endereço local (blob:) desta aba e as de exemplo
// são mosaicos desenhados aqui.
import { BackendError, getClient, signedStorageUrl } from "@/lib/backend";
import { fotoDeExemplo } from "@/lib/rede/atos/exemplos-eventos";
import { atos as cliente, PREVIA_DOS_ATOS } from "@/lib/rede/cliente-atos";
import type { FotoDoAlbum } from "@/lib/rede/tipos-atos";

/** As fotos mandadas na prévia (id → endereço local), só nesta aba. */
const LOCAIS = new Map<string, string>();

async function token(): Promise<string> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

/** Manda a foto para a conferência (ou direto, para quem modera). `conferida` é a declaração de que todo rosto foi borrado. */
export async function enviarFotoDoAlbum(ato: string, foto: Blob, legenda: string, conferida: boolean): Promise<FotoDoAlbum> {
  if (!conferida) throw new BackendError("rostos_nao_conferidos");
  if (PREVIA_DOS_ATOS) {
    const f = await cliente.albumPreviaEnviar(ato, legenda);
    LOCAIS.set(f.id, URL.createObjectURL(foto));
    return f;
  }
  const busca = new URLSearchParams({ ato, legenda: legenda.slice(0, 140), conferida: "sim" });
  const r = await fetch(`/api/rede/album?${busca.toString()}`, { method: "POST", headers: { Authorization: `Bearer ${await token()}` }, body: foto }).catch(() => {
    throw new BackendError("sem_conexao");
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
    throw new BackendError(r.status === 413 ? "invalido:fotos_grande" : r.status === 415 ? "invalido:arquivo" : (corpo?.erro ?? "falha"));
  }
  return (await r.json()) as FotoDoAlbum;
}

/** O endereço para mostrar a foto (assinado por uma hora; na prévia, local ou o mosaico de exemplo). */
export async function enderecoDaFoto(id: string): Promise<string> {
  if (PREVIA_DOS_ATOS) return LOCAIS.get(id) ?? fotoDeExemplo(id);
  const { bucket, caminho } = await cliente.albumCaminho(id);
  return signedStorageUrl(bucket, caminho, 3600);
}

/** A própria pessoa apaga a foto: tira o arquivo do depósito (se der) e depois o registro. */
export async function apagarFotoDoAlbum(id: string) {
  if (!PREVIA_DOS_ATOS) {
    try {
      const { bucket, caminho } = await cliente.albumCaminho(id);
      const supabase = await getClient();
      await supabase.storage.from(bucket).remove([caminho]);
    } catch {
      // Sem o arquivo apagado, o registro sai do mesmo jeito: ninguém mais lê o arquivo, e a faxina leva.
    }
  } else {
    const local = LOCAIS.get(id);
    if (local) URL.revokeObjectURL(local);
    LOCAIS.delete(id);
  }
  return cliente.albumApagar(id);
}
