// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Monta o laboratório de segurança (estudio.institutolucia.org/kali/): uma área de trabalho no estilo do Kali Linux,
// com um Linux DE VERDADE rodando no navegador pelo emulador v86 (isolado, sem rede) e ferramentas de treino de saída
// fictícia. Junta três coisas, sem baixar nada de fonte duvidosa:
//   1. O código do laboratório (estudio/kali/*), versionado neste repositório.
//   2. As bibliotecas v86 (emulador) e xterm (terminal), que são dependências npm — inspecionadas e com licença.
//   3. Três binários oficiais do projeto v86, baixados por commit fixo e CONFERIDOS por SHA-256 (como scripts/editores.mjs
//      faz com os editores): o BIOS (SeaBIOS), o BIOS de vídeo e uma imagem pequena de Linux (Buildroot) que arranca
//      num shell. Nada é modificado; se um hash não bater, o script para.
//
// Uso: node scripts/kali.mjs     (depois, publique com scripts/publicar-estudio.mjs)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pastasMontadas, regrasDeCabecalho } from "./editores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTE = path.join(raiz, "estudio", "kali");
const DESTINO = path.join(raiz, "estudio", "site", "kali");
const SITE = path.join(raiz, "estudio", "site");
const MODULOS = path.join(raiz, "node_modules");

// Binários oficiais, fixados por commit e conferidos por SHA-256. v86 (BSD-2) e a imagem Buildroot (Linux, GPL) são
// servidos SEM modificação, num endereço isolado. Trocar de versão é mudar o commit e o hash aqui, testar e publicar.
const V86_COMMIT = "cc37f35c43bf14865d74ad76879ecf9410f69eb1";
const IMAGENS_COMMIT = "db92d8fd4a53dbd73b8e0588bb4bd8fe37a1975a";
const BINARIOS = [
  { nome: "seabios.bin", url: `https://raw.githubusercontent.com/copy/v86/${V86_COMMIT}/bios/seabios.bin`, sha256: "73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98" },
  { nome: "vgabios.bin", url: `https://raw.githubusercontent.com/copy/v86/${V86_COMMIT}/bios/vgabios.bin`, sha256: "a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880" },
  { nome: "linux.iso", url: `https://raw.githubusercontent.com/copy/images/${IMAGENS_COMMIT}/linux.iso`, sha256: "b311d065b9acc17e5bf1dd4d12f06e70efaf2f0d8b2c7be3bbbb25076f494885" },
];
// As bibliotecas que vêm das dependências npm (inspecionadas, com licença).
const DAS_DEPENDENCIAS = [
  ["v86/build/v86.wasm", "v86.wasm"],
  ["v86/build/libv86.mjs", "libv86.mjs"],
  ["@xterm/xterm/lib/xterm.mjs", "xterm.mjs"],
  ["@xterm/xterm/css/xterm.css", "xterm.css"],
  ["@xterm/addon-fit/lib/addon-fit.mjs", "addon-fit.mjs"],
];
// O código do laboratório, versionado aqui.
const DO_REPOSITORIO = ["index.html", "estilo.css", "area.js", "ferramentas.js", "terminal.js", "rede.js", "dragao.svg", "_headers"];

async function baixar(url) {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "InstitutoLucia-kali/1.0" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

fs.rmSync(DESTINO, { recursive: true, force: true });
fs.mkdirSync(DESTINO, { recursive: true });

for (const nome of DO_REPOSITORIO) fs.copyFileSync(path.join(FONTE, nome), path.join(DESTINO, nome));
for (const [de, para] of DAS_DEPENDENCIAS) {
  const origem = path.join(MODULOS, de);
  if (!fs.existsSync(origem)) throw new Error(`Falta a dependência ${de}. Rode: npm install`);
  fs.copyFileSync(origem, path.join(DESTINO, para));
}
console.log(`Código do laboratório e bibliotecas (v86, xterm) em estudio/site/kali/.`);

for (const b of BINARIOS) {
  console.log(`${b.nome}: baixando e conferindo o SHA-256…`);
  const dados = await baixar(b.url);
  const obtido = createHash("sha256").update(dados).digest("hex");
  if (obtido !== b.sha256) throw new Error(`SHA-256 não confere para ${b.nome}: esperado ${b.sha256}, obtido ${obtido}. O build parou.`);
  fs.writeFileSync(path.join(DESTINO, b.nome), dados);
  console.log(`  ${b.nome}: ${(dados.length / 1048576).toFixed(1)} MB, hash confere (${obtido.slice(0, 16)}…).`);
}

// _headers de todo o estúdio, agora incluindo o /kali (regra fixa em scripts/editores.mjs: v86 precisa de 'unsafe-eval').
fs.writeFileSync(path.join(SITE, "_headers"), regrasDeCabecalho(pastasMontadas()));
console.log("Regras de cabeçalho reescritas (editores + kali).");
console.log("Pronto. Publique a pasta estudio/site com: node scripts/publicar-estudio.mjs");
