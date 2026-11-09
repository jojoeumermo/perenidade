// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Chegar" e "Chamar" (prancha celular-modo-atos). Puro; sem "@/" de propósito.
//
// Chegar: um link para um aplicativo de mapas DE FORA, com o ponto público do ato (texto escrito por quem chamou). A Alumia não
// pede a posição do aparelho, não guarda que a pessoa abriu o mapa e não manda quem ela é: o link sai sem "Referer"
// (rel="noreferrer") e o pedido ao mapa leva só o endereço do ato. Nada de GPS (PLANO-ALUMIA §6.7).

/** O endereço que vai ao mapa: ponto e cidade, sem quebras, até 200 caracteres. */
export function enderecoDoMapa(onde: string, cidade: string): string {
  const texto = [onde, cidade]
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
  return texto.slice(0, 200);
}

/**
 * O link do OpenStreetMap (livre, sem conta e sem anúncio) para o endereço. Só https e só a busca: nenhum identificador da
 * pessoa ou do ato vai junto.
 */
export function linkDoMapa(onde: string, cidade: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(enderecoDoMapa(onde, cidade))}`;
}

/**
 * O link "geo:" (RFC 5870) que abre o aplicativo de mapas do próprio celular (Android e outros), com a busca pelo endereço. O
 * aplicativo do aparelho decide o resto; a Alumia não fica sabendo.
 */
export function linkGeo(onde: string, cidade: string): string {
  return `geo:0,0?q=${encodeURIComponent(enderecoDoMapa(onde, cidade))}`;
}

/** Só aceita link de apoio https (vaquinha, fundo de greve). Qualquer outra coisa vira nulo (nada de javascript:, data:, http:). */
export function linkDeApoioSeguro(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** O texto que vai junto ao compartilhar ("Chamar"): o nome do ato, quando e onde. Sem nome de quem vai, nem de quem chamou. */
export function textoParaChamar(titulo: string, quando: string, onde: string): string {
  return [titulo, quando, onde].map((x) => x.trim()).filter(Boolean).join(" · ");
}
