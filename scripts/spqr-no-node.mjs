// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Carrega o SPQR (lib/rede/chat/r3/spqr.ts) dentro do Node, para os testes: os bytes do build de referência que está no repositório
// (nativo/spqr-wasm/spqr-1.7.0.wasm), conferidos pelo mesmo sha256 que o site confere. Só para teste: o site baixa de /cifra/.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { carregarSpqr } from "../lib/rede/chat/r3/spqr.ts";

export const ARQUIVO_DO_SPQR = fileURLToPath(new URL("../nativo/spqr-wasm/spqr-1.7.0.wasm", import.meta.url));

export function spqrNoNode() {
  return carregarSpqr(new Uint8Array(fs.readFileSync(ARQUIVO_DO_SPQR)));
}
