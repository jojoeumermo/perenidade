// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As figuras a mais da parede que gira da entrada da Alumia (P5, A1): as pessoas do Memorial com foto de licença livre, com o
// crédito de cada uma (lib/rede/entrada/memorial-na-parede.ts). A parede só pede depois dos primeiros 10 segundos, e só quando pode
// se mexer (sem "menos movimento", sem modo parado, sem economia de dados). O mesmo para todo mundo: gerada no build.
//   GET → { figuras: FiguraDaEntrada[] }
import { figurasDoMemorial } from "@/lib/rede/entrada/memorial-na-parede";

export const dynamic = "force-static";

export function GET() {
  return Response.json({ figuras: figurasDoMemorial() }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
