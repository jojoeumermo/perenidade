// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Guardar a imagem ou o áudio do post no depósito "rede-midia" (só roda no servidor, na rota app/api/rede/midia). Desde a
// auditoria do Prompt 5, o depósito não tem regra de envio para quem tem conta: só este servidor grava, com a chave de serviço, e
// só o arquivo que a rota acabou de limpar (e as versões menores que ela mesma fez dele), no caminho que o banco reservou como a
// própria pessoa (rede_pub_midia_reservar, chamado com o token dela: membro, idade, limite de envios e cota). Assim ninguém põe
// no depósito uma foto com EXIF/GPS, nem troca a foto de um post já publicado, nem serve uma "versão menor" que é outra imagem.
// O mesmo jeito do vídeo (lib/rede/midia/servidor.ts) e do álbum do ato.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** O caminho que o banco reserva ("<pessoa>/<id>.<ext>") ou a versão menor de uma imagem dele (".v640", ".v1080"). */
export const caminhoDaMidiaOk = (c: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|webm|ogg|m4a)$/.test(c) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)\.v(640|1080)$/.test(c);

/** Há como gravar (endereço do banco e chave de serviço no servidor)? */
export const midiaLigadaNoServidor = (): boolean => Boolean(url && servico());

/** Guarda os bytes no caminho. Falso se o caminho não é o que o banco reserva, se o depósito recusou (já existe) ou caiu. */
export async function guardarComServico(caminho: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  const chave = servico();
  if (!url || !chave || !caminhoDaMidiaOk(caminho)) return false;
  try {
    const r = await fetch(`${url}/storage/v1/object/rede-midia/${caminho.split("/").map(encodeURIComponent).join("/")}`, {
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
