// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Guardar o vídeo no depósito "rede-video" (só roda no servidor, na rota app/api/rede/video). O depósito não tem regra de envio
// para quem tem conta: só este servidor grava, com a chave de serviço, e só o arquivo que a rota acabou de limpar, no caminho que
// o banco reservou como a própria pessoa (rede_video_reservar, chamado com o token dela). Assim ninguém põe no depósito um vídeo
// que não passou pela limpeza (o mesmo jeito do álbum do ato, lib/rede/atos/album-servidor.ts).
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** O caminho que o banco reserva: <pessoa>/<id>.<ext>. */
export const caminhoDoVideoOk = (c: string): boolean => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|webm)$/.test(c);

/** Há como gravar o vídeo (endereço do banco e chave de serviço no servidor). */
export const videoLigadoNoServidor = (): boolean => Boolean(url && servico());

/** Guarda os bytes no caminho reservado. Falso se o caminho não é o que o banco reserva, se o depósito recusou ou caiu. */
export async function guardarVideo(caminho: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  const chave = servico();
  if (!url || !chave || !caminhoDoVideoOk(caminho)) return false;
  try {
    const r = await fetch(`${url}/storage/v1/object/rede-video/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": mime, "Cache-Control": "max-age=31536000", "x-upsert": "false" },
      body: bytes as unknown as BodyInit,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
