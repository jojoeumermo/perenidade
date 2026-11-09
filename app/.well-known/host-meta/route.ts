// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// host-meta (RFC 6415): o endereço do WebFinger, para os programas do Fediverso que ainda perguntam por aqui antes. No modo total
// (fediverso-total), cada host aponta o PRÓPRIO WebFinger: institutolucia.org aponta o dele, e o host da Alumia, o dela. Um host
// que não é nenhum dos dois (cópia local, prévia) cai no endereço da Alumia, como sempre.
import { modoTotal } from "@/lib/rede/fediverso/enderecos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { fed } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "nodeinfo", 30);
  if (barrado) return barrado;
  let base = fed.base;
  if (modoTotal()) {
    const host = (pedido.headers.get("host") ?? "").toLowerCase().trim();
    if (host && (host === fed.dominio.toLowerCase() || host === fed.dominioCurto)) base = `https://${host}`;
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">\n  <Link rel="lrdd" template="${base}/.well-known/webfinger?resource={uri}"/>\n</XRD>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xrd+xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*", Vary: "Host" } });
}
