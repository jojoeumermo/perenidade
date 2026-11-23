// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "app-loja" (docs/APP-LOJA.md): a configuração do Capacitor (a casca do chat no pacote, onda R3), a pasta
// android/ sem chave, que o site não importa o Capacitor, o documento da loja e o roteiro de teste em aparelho.
// Sem rede, sem navegador. Uso: npm run testar:app-loja
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const existe = (c) => fs.existsSync(new URL(`../${c}`, import.meta.url));
let n = 0;
const ok = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};

const cfg = ler("capacitor.config.ts");
const doc = ler("docs/APP-LOJA.md");
const roteiro = ler("docs/TESTE-EM-APARELHO-REAL.md");
const pkg = JSON.parse(ler("package.json"));
const ignorar = ler(".gitignore");

ok("capacitor.config.ts leva a casca do chat no pacote (onda R3), sem página remota", () => {
  const codigo = cfg.replace(/\/\/.*$/gm, "");
  assert.match(cfg, /appId:\s*"org\.institutolucia\.app"/);
  assert.match(cfg, /webDir:\s*"casca\/saida"/);
  assert.doesNotMatch(codigo, /\burl:\s/);
  assert.doesNotMatch(codigo, /allowNavigation:/);
  assert.match(cfg, /includePlugins:\s*\[\]/);
});
ok("depuração só por pedido explícito e sem conteúdo misto", () => {
  assert.match(cfg, /webContentsDebuggingEnabled:\s*process\.env\.ALUMIA_APP_DEPURAR === "1"/);
  assert.match(cfg, /allowMixedContent:\s*false/);
});
ok("sem import do Capacitor no arquivo de configuração e sem leitura de disco", () => {
  assert.doesNotMatch(cfg, /from\s+["']@capacitor/);
  assert.doesNotMatch(cfg, /node:fs|readFileSync|require\(/);
});
ok("a pasta android/ está no repositório, sem chave, e o que o cap sync gera fica de fora", () => {
  assert.equal(existe("android/app/src/main/AndroidManifest.xml"), true);
  assert.match(ignorar, /^\/android\/local\.properties$/m);
  assert.doesNotMatch(ignorar, /^\/android\/$/m);
  assert.match(ignorar, /^\*\.jks$/m);
  assert.match(ignorar, /^\*\.keystore$/m);
  assert.match(ler("android/.gitignore"), /app\/src\/main\/assets\/public/);
});
ok("o Capacitor entra com versão exata e o site não o importa (nada novo no rastreio do deploy)", () => {
  // Onda R3, item 1.2: o Capacitor é da casca do chat no app. Versão exata, sem "^"; nenhum arquivo do site (app/, components/,
  // lib/) o importa, então ele não entra no rastreio das funções do deploy.
  const todas = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [nome, versao] of Object.entries(todas).filter(([k]) => k.startsWith("@capacitor"))) {
    assert.match(versao, /^\d+\.\d+\.\d+$/, `${nome} sem versão exata`);
  }
  const importa = [];
  const varrer = (pasta) => {
    for (const e of fs.readdirSync(new URL(`../${pasta}`, import.meta.url), { withFileTypes: true })) {
      const caminho = `${pasta}/${e.name}`;
      if (e.isDirectory()) varrer(caminho);
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && /from\s+["']@capacitor\//.test(ler(caminho))) importa.push(caminho);
    }
  };
  for (const pasta of ["app", "components", "lib"]) varrer(pasta);
  assert.deepEqual(importa, []);
});
ok("a página mínima de antes (app-loja/www) saiu: o app abre a casca do chat", () => {
  assert.equal(existe("app-loja/www/index.html"), false);
});
ok("APP-LOJA.md: passo a passo, assinatura, ficha, privacidade e a alternativa TWA", () => {
  for (const trecho of ["node casca/android.mjs", "WebView 137", "Android Studio", "Play App Signing", "Bubblewrap", "assetlinks.json", "Segurança dos dados", "/pt/privacidade", "Classificação etária", "Build reproduzível", "assembleRelease", "FLAG_SECURE", "allowBackup"]) {
    assert.ok(doc.includes(trecho), `falta "${trecho}" em docs/APP-LOJA.md`);
  }
});
ok("APP-LOJA.md cita o ECA Digital com artigos e a vigência conferida", () => {
  assert.match(doc, /Lei nº 15\.211\/2025/);
  assert.match(doc, /art\. 41-A/);
  assert.match(doc, /17 de março de 2026/);
  for (const art of ["art. 7º", "art. 12", "arts. 22 e 26", "art. 16"]) assert.ok(doc.includes(art), `falta ${art}`);
  assert.match(doc, /planalto\.gov\.br/);
});
ok("a decisão de publicar fica com o Jonathan e a taxa é dita", () => {
  assert.match(doc, /decisão do Jonathan/);
  assert.match(doc, /taxa única/);
});
ok("nunca \"universidade\" nem \"diploma\" na ficha da loja (fora das proibições)", () => {
  const ficha = doc.slice(doc.indexOf("## Ficha da loja"), doc.indexOf("## Política de privacidade"));
  const limpa = ficha.replace(/\s+/g, " ").replace(/nada de "universidade" nem "diploma"/g, "");
  assert.doesNotMatch(limpa, /universidade|diploma/i);
});
ok("recursos desligados em produção não entram na ficha", () => {
  assert.match(doc, /"escola", "vale o escrito" e "rede v2" estão\s+desligadas/);
});
ok("o roteiro de aparelho traz S24 emulado e celular de entrada, com os comandos", () => {
  for (const trecho of ["Galaxy S24", "384", "2,8125", "360", "640", "npm run testar:app-aparelho", "npm run testar:entrada"]) {
    assert.ok(roteiro.includes(trecho), `falta "${trecho}" em docs/TESTE-EM-APARELHO-REAL.md`);
  }
});
ok("os scripts estão no package.json e o e2e existe", () => {
  assert.ok(pkg.scripts["testar:app-loja"]);
  assert.ok(pkg.scripts["testar:app-aparelho"]);
  assert.ok(existe("e2e/app-aparelho.spec.ts"));
});

console.log(`\n${n} conferências passaram.`);
