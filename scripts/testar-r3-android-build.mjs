// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 1.2 (Android): BUILD REPRODUZÍVEL. Tira o mesmo commit em DUAS pastas diferentes (git archive), monta a casca do
// chat e o pacote de lançamento SEM assinatura em cada uma e compara byte a byte:
//   - o resumo da árvore da casca (casca/arvore.sha256);
//   - o app-release-unsigned.apk inteiro (sha256).
// Se algo diferir, lista as entradas do APK que mudaram (para achar a causa). Também confere que o APK de lançamento não leva o
// pacote de teste da casca (o marcador "__alumiaTeste"), nem mapa de código, nem a assinatura.
//
// Uso (na raiz): node scripts/testar-r3-android-build.mjs [--commit HEAD] [--pasta <onde montar>]
// Precisa: JDK 21, Android SDK (ANDROID_HOME) e o node_modules do projeto (cada cópia usa o mesmo, por junção/link).
// ALUMIA_GRADLE_ARGS: argumentos a mais para o Gradle nesta máquina (por exemplo um --init-script de espelho do Maven Central).
// Demora: duas montagens do Next e duas do Gradle (uns 10 a 20 minutos).
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const raiz = path.resolve(import.meta.dirname, "..");
const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : padrao;
};
const commit = arg("--commit", "HEAD");
const base = path.resolve(arg("--pasta", fs.mkdtempSync(path.join(os.tmpdir(), "alumia-build-"))));
const extras = (process.env.ALUMIA_GRADLE_ARGS ?? "").split(" ").filter(Boolean);

function rodar(cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env }, shell: process.platform === "win32" && cmd.endsWith(".bat") });
  if (r.status !== 0) {
    console.error(`falhou: ${cmd} ${args.join(" ")} (em ${cwd})`);
    process.exit(1);
  }
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

/** As entradas de um zip (nome → crc32 e tamanho), lidas do diretório central. Para dizer O QUE mudou entre dois APKs. */
function entradas(zip) {
  const b = fs.readFileSync(zip);
  let fim = b.length - 22;
  while (fim >= 0 && b.readUInt32LE(fim) !== 0x06054b50) fim--;
  const total = b.readUInt16LE(fim + 10);
  let p = b.readUInt32LE(fim + 16);
  const m = new Map();
  for (let i = 0; i < total; i++) {
    const crc = b.readUInt32LE(p + 16);
    const tam = b.readUInt32LE(p + 24);
    const n = b.readUInt16LE(p + 28);
    const x = b.readUInt16LE(p + 30);
    const c = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const metodo = b.readUInt16LE(p + 10);
    const comp = b.readUInt32LE(p + 20);
    const nome = b.toString("utf8", p + 46, p + 46 + n);
    m.set(nome, { crc, tam, local, metodo, comp });
    p += 46 + n + x + c;
  }
  return { b, m };
}
function conteudo(z, nome) {
  const e = z.m.get(nome);
  const n = z.b.readUInt16LE(e.local + 26);
  const x = z.b.readUInt16LE(e.local + 28);
  const dados = z.b.subarray(e.local + 30 + n + x, e.local + 30 + n + x + e.comp);
  return e.metodo === 8 ? zlib.inflateRawSync(dados) : dados;
}

function montar(nome) {
  const pasta = path.join(base, nome);
  fs.mkdirSync(pasta, { recursive: true });
  console.log(`\n# montagem ${nome}: ${pasta}`);
  // O commit, sem nada de fora dele.
  const tar = spawnSync("git", ["-C", raiz, "archive", "--format=tar", commit], { maxBuffer: 1 << 30 });
  if (tar.status !== 0) throw new Error("git archive falhou");
  const arquivoTar = path.join(base, `${nome}.tar`);
  fs.writeFileSync(arquivoTar, tar.stdout);
  // Caminhos relativos: o tar do Git no Windows lê "C:" como máquina remota.
  rodar("tar", ["-xf", `${nome}.tar`, "-C", nome], base);
  fs.rmSync(arquivoTar);
  // O mesmo node_modules (as versões exatas do package-lock), ligado sem copiar.
  fs.symlinkSync(fs.realpathSync(path.join(raiz, "node_modules")), path.join(pasta, "node_modules"), "junction");
  fs.writeFileSync(path.join(pasta, "android/local.properties"), `sdk.dir=${(process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? fs.readFileSync(path.join(raiz, "android/local.properties"), "utf8").match(/sdk\.dir=(.*)/)?.[1] ?? "").replace(/\\/g, "\\\\")}\n`);
  // Sem as variáveis do pacote de teste: este é o de lançamento.
  const limpo = { NEXT_PUBLIC_CASCA_TESTE: "", ALUMIA_APP_DEPURAR: "" };
  rodar(process.execPath, ["casca/montar.mjs"], pasta, limpo);
  rodar(process.execPath, ["casca/android.mjs"], pasta, limpo);
  const gradlew = path.join(pasta, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew");
  rodar(gradlew, ["--no-daemon", "--no-build-cache", ...extras, ":app:assembleRelease"], path.join(pasta, "android"), limpo);
  const apk = path.join(pasta, "android/app/build/outputs/apk/release/app-release-unsigned.apk");
  return { pasta, apk, arvore: fs.readFileSync(path.join(pasta, "casca/arvore.sha256"), "utf8") };
}

const a = montar("a");
const b = montar("b-outra-pasta");
let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? (certos++, console.log(`ok - ${nome}`)) : (falhas.push(nome), console.log(`FALHOU - ${nome} ${detalhe}`)));

ok("a casca sai igual nas duas pastas (resumo da árvore)", a.arvore === b.arvore);
const [ha, hb] = [sha(a.apk), sha(b.apk)];
console.log(`  APK a: ${ha}\n  APK b: ${hb}`);
ok("o APK de lançamento sem assinatura sai IGUAL byte a byte nas duas pastas", ha === hb);
if (ha !== hb) {
  const za = entradas(a.apk);
  const zb = entradas(b.apk);
  for (const [n, e] of za.m) {
    const o = zb.m.get(n);
    if (!o) console.log(`  só no a: ${n}`);
    else if (o.crc !== e.crc || o.tam !== e.tam) console.log(`  difere: ${n}`);
  }
  for (const n of zb.m.keys()) if (!za.m.has(n)) console.log(`  só no b: ${n}`);
}
const z = entradas(a.apk);
const nomes = [...z.m.keys()];
ok("sem assinatura no APK de lançamento (assina-se à parte, fora do projeto)", !nomes.some((n) => /^META-INF\/.*\.(RSA|DSA|EC|SF)$/.test(n)));
ok("a casca vai dentro do APK", nomes.includes("assets/public/index.html") && nomes.some((n) => /^assets\/public\/cifra\/core-crypto-[\d.]+\.wasm$/.test(n)));
const js = nomes.filter((n) => n.startsWith("assets/public/") && n.endsWith(".js")).map((n) => conteudo(z, n).toString("utf8")).join("\n");
ok("ataque: o APK de lançamento não leva o pacote de teste da casca (__alumiaTeste)", js.length > 0 && !js.includes("__alumiaTeste"));
ok("nenhum mapa de código no APK", !nomes.some((n) => n.endsWith(".map")));
const cfg = JSON.parse(conteudo(z, "assets/capacitor.config.json").toString("utf8"));
ok("depuração do WebView desligada no de lançamento", cfg.android?.webContentsDebuggingEnabled === false, JSON.stringify(cfg.android));
ok("nenhuma página remota no de lançamento (sem server.url, sem allowNavigation)", !cfg.server?.url && !cfg.server?.allowNavigation);
ok("o caminho do Capacitor continua relativo depois do sync", fs.readFileSync(path.join(a.pasta, "android/capacitor.settings.gradle"), "utf8").includes("'../node_modules/@capacitor/android/capacitor'"));

console.log(`\ntestar-r3-android-build: ${certos} certos, ${falhas.length} falhas (pastas em ${base})`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
