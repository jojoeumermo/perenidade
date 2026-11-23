// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (17): o infra/contabo/preparar.sh tira do arquivo público os limites do fail2ban (vêm do ambiente,
// conferidos) e os comentários de operação. Roda o trecho do fail2ban de verdade no bash (com o arquivo de saída trocado por um
// temporário): sem ambiente, valores comuns; com ambiente válido, os do ambiente; com valor torto (ou tentando enfiar outra linha
// na configuração, como um "ignoreip"), cai no valor comum.
// Uso: node scripts/testar-r3-resto-preparar.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preparar = fs.readFileSync(path.join(raiz, "infra/contabo/preparar.sh"), "utf8").replace(/\r\n/g, "\n");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// 1. O arquivo: nenhum limite escrito; os comentários de operação saíram.
const conf = preparar.match(/cat > \/etc\/fail2ban\/jail\.d\/lucia\.conf <<EOF\n([\s\S]*?)\nEOF/)?.[1] ?? "";
ok("os limites do fail2ban não estão escritos no arquivo", /^bantime = \$\w+$/m.test(conf) && /^findtime = \$\w+$/m.test(conf) && /^maxretry = \$\w+$/m.test(conf) && /^bantime\.maxtime = \$\w+$/m.test(conf), conf);
ok("o comentário não diz quantos erros barram nem por quanto tempo", !/\d+ erros em \d+ minutos|até uma semana/.test(preparar));
ok("o comentário não fala da rota da hospedagem nem do registro DNS", !/rota IPv6 da Contabo|registro A\)/.test(preparar));
ok("o cabeçalho diz que os valores vêm do ambiente", /F2B_TENTATIVAS, F2B_JANELA, F2B_BLOQUEIO, F2B_BLOQUEIO_MAXIMO/.test(preparar));

// 2. O trecho rodando no bash.
const inicio = preparar.indexOf("duracao() {");
const fim = preparar.indexOf("\nEOF\n", inicio);
const trecho = inicio > 0 && fim > inicio ? preparar.slice(inicio, fim + 5) : "";
ok("o trecho do fail2ban foi achado", Boolean(trecho));
const bash = spawnSync("bash", ["--version"], { encoding: "utf8" });
if (trecho && bash.status === 0) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "f2b-"));
  const saida = path.join(pasta, "lucia.conf").split(path.sep).join("/");
  const roteiro = path.join(pasta, "trecho.sh");
  fs.writeFileSync(roteiro, `set -euo pipefail\n${trecho.replace("/etc/fail2ban/jail.d/lucia.conf", saida)}`);
  const rodar = (amb) => {
    const r = spawnSync("bash", [roteiro], { encoding: "utf8", env: { PATH: process.env.PATH, ...amb } });
    if (r.status !== 0) return `ERRO ${r.stderr}`;
    return fs.readFileSync(saida, "utf8");
  };
  const valor = (t, k) => t.match(new RegExp(`^${k.replace(".", "[.]")} = (.*)$`, "m"))?.[1];
  const padrao = rodar({});
  ok("sem ambiente: 5 tentativas, 10m, 1h, até 1w", valor(padrao, "maxretry") === "5" && valor(padrao, "findtime") === "10m" && valor(padrao, "bantime") === "1h" && valor(padrao, "bantime.maxtime") === "1w", padrao);
  const doAmbiente = rodar({ F2B_TENTATIVAS: "3", F2B_JANELA: "30m", F2B_BLOQUEIO: "6h", F2B_BLOQUEIO_MAXIMO: "4w" });
  ok("com ambiente: os valores do ambiente", valor(doAmbiente, "maxretry") === "3" && valor(doAmbiente, "findtime") === "30m" && valor(doAmbiente, "bantime") === "6h" && valor(doAmbiente, "bantime.maxtime") === "4w", doAmbiente);
  const torto = rodar({ F2B_TENTATIVAS: "0", F2B_JANELA: "1h\nignoreip = 0.0.0.0/0", F2B_BLOQUEIO: "-1", F2B_BLOQUEIO_MAXIMO: "$(id)" });
  ok("valor torto ou com outra linha: cai no comum, nada entra na configuração", valor(torto, "maxretry") === "5" && valor(torto, "findtime") === "10m" && valor(torto, "bantime") === "1h" && valor(torto, "bantime.maxtime") === "1w" && !/ignoreip|uid=/.test(torto), torto);
  fs.rmSync(pasta, { recursive: true, force: true });
} else if (!trecho) {
  // já contado acima
} else falhas.push("bash não encontrado para rodar o trecho");

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
