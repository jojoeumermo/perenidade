// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";

/**
 * Diz se o arquivo do vídeo do anúncio de cada coletivo já foi colocado em public/territorios/<slug>/anuncio.mp4
 * (docs/TERRITORIOS.md). As pastas são literais, uma por coletivo, para o empacotador não varrer o disco inteiro.
 * Só as páginas de território importam este módulo (nunca o layout raiz).
 */
export function temVideoLocal(slug: string): boolean {
  try {
    if (slug === "noizocupa") return fs.existsSync(path.join(process.cwd(), "public", "territorios", "noizocupa", "anuncio.mp4"));
    if (slug === "coletivo-kamikaze") return fs.existsSync(path.join(process.cwd(), "public", "territorios", "coletivo-kamikaze", "anuncio.mp4"));
  } catch {
    // Sem leitura de disco (ambiente restrito): cai no embed do Instagram, que só abre com o clique.
  }
  return false;
}

/** O endereço público do vídeo local de um coletivo. */
export function enderecoDoVideo(slug: string): string {
  return `/territorios/${slug}/anuncio.mp4`;
}

/** O código de um post do Instagram só pode ter letras, números, hífen e sublinhado (entra no endereço do embed). */
export function codigoDePostValido(codigo: string): boolean {
  return /^[A-Za-z0-9_-]{6,20}$/.test(codigo);
}
