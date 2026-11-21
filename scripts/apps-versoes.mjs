// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Monta public/apps/versoes.json a partir da pasta do lançamento (onda R3, item 2.4): cada arquivo "alumia-<versao>-…" com o seu
// "<arquivo>.sigstore.json" ao lado. Só entra na lista o que passa na MESMA conferência dos apps (lib/rede/transparencia-apps/
// conferir.ts) com a identidade do fluxo de lançamento na tag da versão; um arquivo que não confere derruba a montagem (saída 1).
// Usado pelo fluxo .github/workflows/apps-lancamento.yml.
//
//   node scripts/apps-versoes.mjs --pasta <pasta> --versao 1.0.0 --saida public/apps/versoes.json
//   (--identidade <uri> --emissor <url>: só nos testes, com o vetor de outro projeto)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

await import("./carregar-ts.mjs");
const { conferirComDetalhe } = await import("../lib/rede/transparencia-apps/conferir.ts");
const { identidadeDaVersao } = await import("../lib/rede/transparencia-apps/identidade.ts");
const { lerVersoes } = await import("../lib/rede/transparencia-apps/versoes.ts");

const { values } = parseArgs({ options: { pasta: { type: "string" }, versao: { type: "string" }, saida: { type: "string" }, identidade: { type: "string" }, emissor: { type: "string" } } });
if (!values.pasta || !values.versao || !values.saida) {
  console.error("uso: node scripts/apps-versoes.mjs --pasta <pasta> --versao X.Y.Z --saida <arquivo>");
  process.exit(2);
}
const identidade = values.identidade ? { uri: values.identidade, emissor: values.emissor ?? "" } : identidadeDaVersao(values.versao);
const raiz = JSON.parse(fs.readFileSync(new URL("../public/apps/raiz-sigstore.json", import.meta.url), "utf8"));

/** A plataforma pelo nome do arquivo (o fluxo de lançamento dá os nomes). */
function plataforma(nome) {
  if (/-android[-.]/.test(nome) || nome.endsWith(".apk")) return "android";
  if (/-windows-/.test(nome)) return "windows";
  if (/-macos-/.test(nome)) return "macos";
  if (/-linux-/.test(nome)) return "linux";
  return null;
}

const arquivos = [];
let falhou = false;
for (const nome of fs.readdirSync(values.pasta).sort()) {
  if (nome.endsWith(".sigstore.json") || !nome.startsWith(`alumia-${values.versao}-`)) continue;
  const caminho = path.join(values.pasta, nome);
  const bytes = new Uint8Array(fs.readFileSync(caminho));
  const pacoteNome = `${nome}.sigstore.json`;
  let pacote = null;
  try {
    pacote = JSON.parse(fs.readFileSync(path.join(values.pasta, pacoteNome), "utf8"));
  } catch {
    pacote = null;
  }
  const r = conferirComDetalhe(bytes, pacote, identidade, raiz);
  const p = plataforma(nome);
  if (r.resultado !== "no_log" || !p) {
    console.error(`fora_do_log: ${nome} (${r.motivo ?? "plataforma"})`);
    falhou = true;
    continue;
  }
  const entrada = pacote.verificationMaterial.tlogEntries[0];
  const folha = createHash("sha256").update(Buffer.concat([Buffer.from([0]), Buffer.from(entrada.canonicalizedBody, "base64")])).digest("hex");
  arquivos.push({
    nome,
    plataforma: p,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    tamanho: bytes.length,
    rekor: { indice: Number(entrada.logIndex), uuid: folha },
    pacote: pacoteNome,
  });
}
if (falhou || arquivos.length === 0) {
  console.error(falhou ? "Algum arquivo não confere: nada foi escrito." : "Nenhum arquivo da versão na pasta.");
  process.exit(1);
}
const versoes = { versao: values.versao, arquivos };
// O que a página vai ler tem de passar pela mesma leitura dela.
if (lerVersoes(versoes).arquivos.length !== arquivos.length) {
  console.error("A lista não passa na leitura da página.");
  process.exit(1);
}
fs.writeFileSync(values.saida, `${JSON.stringify(versoes, null, 2)}\n`);
console.log(`${arquivos.length} arquivo(s) conferido(s) e listado(s) em ${values.saida}`);
