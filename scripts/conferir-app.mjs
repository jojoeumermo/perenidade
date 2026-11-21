// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere, no seu computador, se um arquivo dos apps da Alumia (instalador do computador, APK do Android, o .wasm do SPQR) está
// registrado no livro público do Sigstore (Rekor) e foi assinado pelo fluxo de lançamento deste repositório público, na tag da
// versão. Sem rede: a raiz de confiança é a de public/apps/raiz-sigstore.json. Roteiro completo: docs/BUILD-REPRODUZIVEL.md.
//
//   node scripts/conferir-app.mjs <arquivo> <arquivo.sigstore.json> --versao 1.0.0
//   node scripts/conferir-app.mjs <arquivo> <pacote> --identidade <uri do certificado> --emissor <emissor OIDC>
//
// Saída 0 e "no_log" quando tudo confere; saída 1 e "fora_do_log (motivo)" em qualquer outro caso.
import fs from "node:fs";
import { parseArgs } from "node:util";

await import("./carregar-ts.mjs");
const { conferirComDetalhe } = await import("../lib/rede/transparencia-apps/conferir.ts");
const { identidadeDaVersao } = await import("../lib/rede/transparencia-apps/identidade.ts");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { versao: { type: "string" }, identidade: { type: "string" }, emissor: { type: "string" }, raiz: { type: "string" } },
});
if (positionals.length !== 2 || (!values.versao && !(values.identidade && values.emissor))) {
  console.error("uso: node scripts/conferir-app.mjs <arquivo> <pacote.sigstore.json> (--versao X.Y.Z | --identidade URI --emissor URL)");
  process.exit(2);
}
const [caminhoDoArquivo, caminhoDoPacote] = positionals;
const identidade = values.versao ? identidadeDaVersao(values.versao) : { uri: values.identidade, emissor: values.emissor };
const raiz = JSON.parse(fs.readFileSync(values.raiz ?? new URL("../public/apps/raiz-sigstore.json", import.meta.url), "utf8"));
let pacote;
try {
  pacote = JSON.parse(fs.readFileSync(caminhoDoPacote, "utf8"));
} catch {
  pacote = null;
}
const r = conferirComDetalhe(new Uint8Array(fs.readFileSync(caminhoDoArquivo)), pacote, identidade, raiz);
console.log(r.resultado === "no_log" ? `no_log\n  identidade: ${identidade.uri}\n  emissor: ${identidade.emissor}` : `fora_do_log (${r.motivo})`);
process.exit(r.resultado === "no_log" ? 0 : 1);
