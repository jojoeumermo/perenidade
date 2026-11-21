// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (f): a loja do motor de cifra do chat a dois (@wireapp/core-crypto) recebe o nome "alumia-r2-<conta>"
// em Database.open. O motor grava no OPFS, mas o WebAssembly dele também abre o IndexedDB com esse nome (a migração da loja antiga).
// Antes, o "Sair rápido" e o pânico só apagavam as bases "lucia-*": uma base "alumia-r2-<conta>" ficava no aparelho apreendido.
// Aqui: a saída do site (pânico e três Esc) e o "Sair rápido" da Alumia levam as bases do motor; o que é de voz e de outros fica.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-saida.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// 0. O motor usa mesmo o IndexedDB por baixo (o pressuposto do conserto, conferido no pacote instalado).
{
  const js = ler("node_modules/@wireapp/core-crypto/dist/corecrypto.js");
  ok("o WebAssembly do motor importa a abertura e o apagar do IndexedDB", /instanceof IDBFactory/.test(js) && /\.deleteDatabase\(/.test(js));
}

// 1. A saída do site (o pânico e os três Esc passam por lib/modo-seguro.ts: basesParaApagar).
{
  const ms = await import("../lib/modo-seguro.ts");
  const nomes = ["alumia-r2-1f0c", "grupos-1f0c", "equipe-aparelho9", "lucia-alumia-r2", "lucia-voz-pt", "de-outro-site", "alumia-r2"];
  const sai = ms.basesParaApagar(nomes);
  ok("pânico: a base do motor da conversa a dois (alumia-r2-<conta>) sai", sai.includes("alumia-r2-1f0c"), sai.join());
  ok("pânico: as bases do motor dos grupos e da equipe saem (correlatos)", sai.includes("grupos-1f0c") && sai.includes("equipe-aparelho9"), sai.join());
  ok("pânico: a base da loja da R2 continua saindo", sai.includes("lucia-alumia-r2"));
  ok("pânico: modelos de voz e bases de outros nomes ficam", !sai.includes("lucia-voz-pt") && !sai.includes("de-outro-site") && !sai.includes("alumia-r2"), sai.join());
  ok("os prefixos da saída são os nomes que o código dá às lojas do motor",
    ler("lib/rede/chat/r2/loja.ts").includes("`alumia-r2-${conta}`") && ler("lib/rede/grupos/apagar.ts").includes('PREFIXO_DA_LOJA = "grupos-"') && /abrirLojaDoMotor\(`equipe-\$\{/.test(ler("lib/chaveiro.ts")));
}

// 2. O "Sair rápido" da Alumia (lib/rede/chat/gaveta.ts: apagarTudoDoChat) apaga as bases "alumia-r2-*" que o navegador listar.
{
  const g = await import("../lib/rede/chat/gaveta.ts");
  ok("Sair rápido: a gaveta tem a limpeza das bases do motor", typeof g.apagarBasesDoMotorR2 === "function");
  if (typeof g.apagarBasesDoMotorR2 === "function") {
    const apagadas = [];
    const idb = { databases: async () => [{ name: "alumia-r2-conta-a" }, { name: "alumia-r2-conta-b" }, { name: "lucia-alumia-r2" }, { name: "de-outro" }, {}], deleteDatabase: (n) => apagadas.push(n) };
    const pedidas = await g.apagarBasesDoMotorR2(idb);
    ok("Sair rápido: as duas contas do aparelho saem, nada mais", JSON.stringify(apagadas.sort()) === JSON.stringify(["alumia-r2-conta-a", "alumia-r2-conta-b"]), apagadas.join());
    ok("Sair rápido: devolve o que pediu", pedidas.length === 2);
    const semLista = await g.apagarBasesDoMotorR2({ deleteDatabase: () => { throw new Error("x"); } });
    ok("Sair rápido: navegador sem lista não lança", Array.isArray(semLista) && semLista.length === 0);
    const quebrado = await g.apagarBasesDoMotorR2({ databases: async () => { throw new Error("bloqueado"); }, deleteDatabase: () => undefined });
    ok("Sair rápido: lista bloqueada não lança", Array.isArray(quebrado));
  }
  const fonte = ler("lib/rede/chat/gaveta.ts");
  const corpo = fonte.split("export async function apagarTudoDoChat")[1]?.split("\n}\n")[0] ?? "";
  ok("Sair rápido: apagarTudoDoChat chama a limpeza das bases do motor", /apagarBasesDoMotorR2\(indexedDB\)/.test(corpo));
  ok("Sair rápido: o prefixo da gaveta é o da loja", g.PREFIXO_DO_MOTOR_R2 === "alumia-r2-" && (await import("../lib/rede/chat/r2/loja.ts")).nomeDaLojaDoMotor("x") === "alumia-r2-x");
  ok("apagar uma conta: a base IndexedDB do motor dela sai junto", /indexedDB\.deleteDatabase\(nomeDaLojaDoMotor\(conta\)\)/.test(ler("lib/rede/chat/r2/loja.ts")));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
