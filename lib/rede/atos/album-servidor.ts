// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Guardar a foto do álbum do ato no depósito "rede-album" (só roda no servidor, na rota app/api/rede/album). O depósito não tem
// regra de envio para quem tem conta: só este servidor grava, com a chave de serviço, e só o arquivo que a rota acabou de limpar,
// no lugar que o banco reservou como a própria pessoa (rede_ato_album_reservar, chamado com o token dela). Assim ninguém põe no
// depósito bytes que não passaram pela limpeza.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const DEPOSITO_DO_ALBUM = "rede-album";

/** O caminho que o banco reserva: <ato>/<id>.<ext>, sem nada de quem mandou. */
export const caminhoDoAlbumOk = (c: string): boolean => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(c);

/** Há como gravar no álbum (endereço do banco e chave de serviço no servidor). */
export const albumLigado = (): boolean => Boolean(url && servico());

export async function guardarNoAlbum(caminho: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  const chave = servico();
  if (!url || !chave || !caminhoDoAlbumOk(caminho)) return false;
  try {
    const r = await fetch(`${url}/storage/v1/object/${DEPOSITO_DO_ALBUM}/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": mime, "Cache-Control": "max-age=31536000", "x-upsert": "false" },
      body: bytes as unknown as BodyInit,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
