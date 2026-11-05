// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "app-loja" (docs/APP-LOJA.md): a configuração do Capacitor, que a pasta android/ não está no
// repositório, que o Capacitor não entrou nas dependências, o documento da loja e o roteiro de teste em aparelho.
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

ok("capacitor.config.ts aponta para o site em produção por server.url", () => {
  assert.match(cfg, /https:\/\/institutolucia\.org/);
  assert.match(cfg, /server:\s*\{[\s\S]*url:\s*endereco/);
  assert.match(cfg, /appId:\s*"org\.institutolucia\.app"/);
});
ok("só o domínio do Instituto abre dentro do aplicativo", () => {
  assert.match(cfg, /allowNavigation:\s*\["institutolucia\.org", "\*\.institutolucia\.org"\]/);
});
ok("texto puro e depuração só no teste local (http://)", () => {
  assert.match(cfg, /cleartext:\s*endereco\.startsWith\("http:\/\/"\)/);
  assert.match(cfg, /webContentsDebuggingEnabled:\s*endereco\.startsWith\("http:\/\/"\)/);
  assert.match(cfg, /allowMixedContent:\s*false/);
});
ok("o agente de usuário bate com o que o site e o teste do S24 esperam", () => {
  assert.match(cfg, /appendUserAgent:\s*"InstitutoLuciaApp\/2"/);
  assert.match(ler("e2e/s24.spec.ts"), /InstitutoLuciaApp\/2/);
  assert.match(ler("lib/prefs.ts"), /; wv\)/);
});
ok("sem import do Capacitor (pacote não instalado) e sem leitura de disco", () => {
  assert.doesNotMatch(cfg, /from\s+["']@capacitor/);
  assert.doesNotMatch(cfg, /node:fs|readFileSync|require\(/);
});
ok("a pasta android/ não está no repositório e fica fora do git", () => {
  assert.equal(existe("android"), false, "android/ não deve ser gerada no repositório");
  assert.match(ignorar, /^\/android\/$/m);
  assert.match(ignorar, /^\*\.jks$/m);
  assert.match(ignorar, /^\*\.keystore$/m);
});
ok("o Capacitor não entrou nas dependências (nada novo no rastreio do deploy)", () => {
  const todas = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.deepEqual(Object.keys(todas).filter((k) => k.startsWith("@capacitor")), []);
});
ok("a página mínima do aplicativo não tem script nem rede", () => {
  const h = ler("app-loja/www/index.html");
  assert.doesNotMatch(h, /<script|fetch\(|https?:\/\/(?!institutolucia\.org)/);
  assert.match(cfg, /webDir:\s*"app-loja\/www"/);
});
ok("APP-LOJA.md: passo a passo, assinatura, ficha, privacidade e a alternativa TWA", () => {
  for (const trecho of ["npx cap add android", "Android Studio", "Play App Signing", "Bubblewrap", "assetlinks.json", "Segurança dos dados", "/pt/privacidade", "Classificação etária"]) {
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
