// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 1.2 no computador (desktop/src-tauri). Sem compilar nada (o Rust tem os próprios testes em `cargo test`):
//   1. a lista de comandos do Tauri é FECHADA: build.rs (manifesto), generate_handler!, as funções #[tauri::command] e a
//      capability têm exatamente os mesmos oito comandos;
//   2. nenhuma página remota tem acesso ao nativo: capability sem `remote`, só a janela "principal", nenhum comando de plugin
//      liberado, nenhuma janela na configuração (a janela é criada no código com o filtro de navegação), sem devUrl, sem
//      withGlobalTauri, sem o protocolo de arquivos, CSP fechada;
//   3. sem o atualizador do Tauri (que exigiria uma chave guardada): a atualização passa pela conferência no Rekor;
//   4. dependências com versão exata;
//   5. a casca do computador (lib/rede/casca/computador.ts) com um `invoke` falso: cada função chama o comando certo, e o fetch
//      nativo não sai do endereço do Instituto nem leva cabeçalho que não deve.
// Uso: npm run testar:r3-desktop
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cascaDoComputador, caminhoDoPedido } from "../lib/rede/casca/computador.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(RAIZ, c), "utf8");
const TAURI = "desktop/src-tauri";
const conf = JSON.parse(ler(`${TAURI}/tauri.conf.json`));
const pastaCap = path.join(RAIZ, TAURI, "capabilities");
const capacidades = fs.readdirSync(pastaCap).map((f) => ({ f, c: JSON.parse(fs.readFileSync(path.join(pastaCap, f), "utf8")) }));
const lib = ler(`${TAURI}/src/lib.rs`);
const build = ler(`${TAURI}/build.rs`);
const cargo = ler(`${TAURI}/Cargo.toml`);

let n = 0;
const ok = async (nome, fn) => {
  await fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const OITO = ["cofre_embrulhar", "cofre_desembrulhar", "atualizacao_conferir", "atualizacao_instalar", "rede_abrir", "rede_pedir", "app_apagar_tudo", "notificar"];
const ordenado = (xs) => [...xs].sort();

// ── 1. lista fechada ──
await ok("build.rs declara exatamente os oito comandos (o manifesto que fecha a lista)", () => {
  const m = /commands\(&\[([\s\S]*?)\]\)/.exec(build);
  assert.ok(m, "AppManifest::commands");
  assert.deepEqual(ordenado([...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1])), ordenado(OITO));
});
await ok("generate_handler! registra os mesmos oito, e só há oito #[tauri::command]", () => {
  const h = /generate_handler!\[([\s\S]*?)\]/.exec(lib);
  assert.deepEqual(ordenado(h[1].split(",").map((s) => s.trim()).filter(Boolean)), ordenado(OITO));
  const funcoes = [...lib.matchAll(/#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-z_]+)/g)].map((x) => x[1]);
  assert.deepEqual(ordenado(funcoes), ordenado(OITO));
  // Nenhum outro arquivo do app declara comando.
  for (const f of fs.readdirSync(path.join(RAIZ, TAURI, "src"))) {
    if (f !== "lib.rs") assert.ok(!ler(`${TAURI}/src/${f}`).includes("#[tauri::command"), `${f} declara comando`);
  }
});
await ok("a capability libera exatamente os oito (allow-<comando>) e nada mais", () => {
  assert.equal(capacidades.length, 1, "uma capability só");
  const { c } = capacidades[0];
  const esperado = OITO.map((x) => `allow-${x.replaceAll("_", "-")}`);
  assert.deepEqual(ordenado(c.permissions), ordenado(esperado));
});

// ── 2. nada remoto com acesso ao nativo ──
await ok("capability: só a janela principal, local, sem `remote`, sem permissão de plugin (core:, opener:, notification:…)", () => {
  const { c } = capacidades[0];
  assert.equal(c.identifier, "principal");
  assert.deepEqual(c.windows, ["principal"]);
  assert.equal(c.local, true);
  assert.equal(c.remote, undefined);
  assert.equal(c.webviews, undefined);
  for (const p of c.permissions) assert.ok(typeof p === "string" && !p.includes(":"), `permissão de plugin: ${JSON.stringify(p)}`);
  assert.deepEqual(conf.app.security.capabilities, ["principal"]);
});
await ok("configuração: nenhuma janela declarada, sem devUrl, sem withGlobalTauri, sem protocolo de arquivos, casca empacotada", () => {
  assert.deepEqual(conf.app.windows, []);
  assert.equal(conf.build.devUrl, undefined);
  assert.equal(conf.build.beforeDevCommand, undefined);
  assert.equal(conf.build.beforeBuildCommand, undefined);
  assert.equal(conf.build.frontendDist, "../../casca/saida");
  assert.equal(conf.app.withGlobalTauri, false);
  assert.equal(conf.app.security.assetProtocol.enable, false);
  assert.equal(conf.app.security.dangerousDisableAssetCspModification, false);
  assert.equal(conf.app.security.pattern, undefined);
});
await ok("a janela é criada com o filtro de navegação e sem janelas novas", () => {
  assert.match(lib, /\.on_navigation\(navegacao_permitida\)/);
  assert.match(lib, /\.on_new_window\(\|_, _\| NewWindowResponse::Deny\)/);
  assert.match(lib, /WebviewUrl::App\("index\.html"\.into\(\)\)/);
  assert.ok(!/WebviewUrl::External/.test(lib), "nenhuma página de fora");
  assert.match(lib, /\.devtools\(cfg!\(debug_assertions\)\)/);
});
await ok("CSP: só o próprio app; nada de eval de JavaScript nem script de fora; conexão só com o serviço de contas", () => {
  const csp = conf.app.security.csp;
  assert.equal(csp["default-src"], "'self'");
  assert.equal(csp["script-src"], "'self' 'wasm-unsafe-eval'");
  assert.equal(csp["object-src"], "'none'");
  assert.equal(csp["frame-src"], "'none'");
  assert.equal(csp["base-uri"], "'none'");
  for (const fonte of csp["connect-src"].split(/\s+/)) {
    assert.ok(["'self'", "ipc:", "http://ipc.localhost", "https://*.supabase.co", "wss://*.supabase.co"].includes(fonte), fonte);
  }
});
await ok("sem o atualizador do Tauri (chave minisign) e sem artefatos dele: a atualização passa pelo Rekor", () => {
  assert.ok(!/tauri-plugin-updater/.test(cargo));
  assert.equal(conf.plugins?.updater, undefined);
  assert.equal(conf.bundle.createUpdaterArtifacts, false);
  assert.match(lib, /atualizacao::baixar_conferido/);
});
await ok("dependências do app com versão exata (=x.y.z)", () => {
  const deps = cargo.split("[dependencies]")[1].split("[dev-dependencies]")[0];
  for (const linha of deps.split("\n").filter((l) => /^[a-z]/.test(l))) {
    if (linha.startsWith("alumia-nucleo")) continue;
    assert.match(linha, /"=\d+\.\d+\.\d+"/, linha);
  }
  assert.match(ler(`${TAURI}/rust-toolchain.toml`), /channel = "1\.99\.0"/);
  assert.ok(fs.existsSync(path.join(RAIZ, "Cargo.lock")), "Cargo.lock no git (na raiz do Cargo)");
});
await ok("build reproduzível: raiz do Cargo com só o app (o caminho da pasta não entra no executável) e o perfil fixo", () => {
  const raiz = ler("Cargo.toml");
  assert.match(raiz, /^\[workspace\]\r?\nmembers = \["desktop\/src-tauri"\]\r?\nexclude = \["nativo"\]/m);
  for (const linha of ['panic = "abort"', "lto = true", "codegen-units = 1", 'strip = "symbols"', "incremental = false"]) assert.ok(raiz.includes(linha), linha);
  assert.ok(!cargo.includes("[profile."), "perfil só na raiz (o Cargo ignora o do membro)");
  assert.ok(!fs.existsSync(path.join(RAIZ, TAURI, "Cargo.lock")), "um Cargo.lock só para o app");
  assert.match(ler(`${TAURI}/.cargo/config.toml`), /target-dir = "target"/);
  // O nativo/nucleo é dependência de caminho DENTRO da raiz.
  assert.match(cargo, /alumia-nucleo = \{ path = "\.\.\/\.\.\/nativo\/nucleo" \}/);
});

// ── 5. a casca do computador ──
const chamadas = [];
const respostas = {
  cofre_embrulhar: () => btoa("EMB"),
  cofre_desembrulhar: (a) => (a.embrulhado === btoa("EMB") ? btoa("ok") : null),
  rede_pedir: () => ({ status: 200, corpo: btoa('{"ok":true}'), tipo: "application/json" }),
  atualizacao_conferir: (a) => (a.versao === "1.0.0" ? "no_log" : "talvez"),
};
const c = cascaDoComputador(async (cmd, args = {}) => {
  chamadas.push([cmd, args]);
  return respostas[cmd] ? respostas[cmd](args) : null;
});
await ok("cofre: embrulhar e desembrulhar vão aos comandos do cofre, em base64", async () => {
  assert.deepEqual(await c.embrulhar("chat:loja", new TextEncoder().encode("x")), new TextEncoder().encode("EMB"));
  assert.deepEqual(chamadas.at(-1), ["cofre_embrulhar", { finalidade: "chat:loja", dados: btoa("x") }]);
  assert.deepEqual(await c.desembrulhar("chat:loja", new TextEncoder().encode("EMB")), new TextEncoder().encode("ok"));
  assert.equal(await c.desembrulhar("chat:loja", new TextEncoder().encode("outro")), null);
});
await ok("fetch nativo: só o endereço do Instituto; só content-type e authorization; corpo em base64", async () => {
  const r = await c.fetchNativo("https://institutolucia.org/api/alumia/caixa/lote", {
    method: "post",
    headers: { "Content-Type": "application/json", Origin: "https://mal.example", Cookie: "a=b", Authorization: "PrivateToken token=x" },
    body: '{"a":1}',
  });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  const [cmd, args] = chamadas.at(-1);
  assert.equal(cmd, "rede_pedir");
  assert.equal(args.metodo, "POST");
  assert.equal(args.caminho, "/api/alumia/caixa/lote");
  assert.deepEqual(ordenado(args.cabecalhos.map((h) => h[0])), ["authorization", "content-type"]);
  assert.equal(atob(args.corpo), '{"a":1}');
  await c.fetchNativo("/api/alumia/passes/chave");
  assert.deepEqual(chamadas.at(-1)[1], { metodo: "GET", caminho: "/api/alumia/passes/chave", cabecalhos: [], corpo: null });
  const antes = chamadas.length;
  for (const fora of ["https://mal.example/api/alumia/caixa", "http://institutolucia.org/api/alumia/caixa", "https://x@institutolucia.org/api", "//mal.example/x", "https://institutolucia.org.mal.example/"]) {
    await assert.rejects(c.fetchNativo(fora), TypeError, fora);
  }
  assert.equal(chamadas.length, antes, "nada saiu para fora");
  assert.equal(caminhoDoPedido("/api/alumia/caixa?x=1"), "/api/alumia/caixa?x=1");
});
await ok("atualização: só 'no_log' e 'sem_rede' passam; qualquer outra resposta vira 'fora_do_log'", async () => {
  assert.equal(await c.conferirAtualizacao("1.0.0"), "no_log");
  assert.equal(await c.conferirAtualizacao("9.9.9"), "fora_do_log");
});
await ok("notificar, apagar tudo e abrir a rede vão aos comandos certos (a notificação não leva texto)", async () => {
  await c.notificar();
  assert.deepEqual(chamadas.at(-1), ["notificar", {}]);
  await c.apagarTudo();
  assert.equal(chamadas.at(-1)[0], "app_apagar_tudo");
  await c.abrirRede("/pt/alumia");
  assert.deepEqual(chamadas.at(-1), ["rede_abrir", { caminho: "/pt/alumia" }]);
  assert.ok(chamadas.every(([cmd]) => OITO.includes(cmd)), "só os oito");
});
await ok("fora do app (sem __TAURI_INTERNALS__), a casca falha em vez de fingir", async () => {
  await assert.rejects(cascaDoComputador().embrulhar("x", new Uint8Array(1)), /fora_do_app/);
});

console.log(`\n${n} testes, todos passaram.`);
