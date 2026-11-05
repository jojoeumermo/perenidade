// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a casca do aplicativo (docs/APP.md, pacote "app-casca"): abas, gesto de voltar, "voltar" do histórico, aula do
// dia, uma tela por vez, textos nos 6 idiomas e as cercas (rastreio do deploy, privacidade, CSS e layout).
// Sem rede, sem navegador. Uso: npm run testar:app-casca
import assert from "node:assert/strict";
import fs from "node:fs";
import { ABAS, CONSULTA_CASCA, RAIZ_DA_ABA, abaDoEndereco, ehRaizDaAba, ehTelaCheiaPorEndereco, ehTelaComCascaPropria, paginaDeCima, trechosDoEndereco } from "../components/app/modo.ts";
import { GESTO, naBorda, progressoDoGesto, temGestoDoSistema, valeComoVoltar } from "../components/app/gesto.ts";
import { andouNoSite, registrarPagina, voltarOuSubir } from "../components/app/navegacao.ts";
import { escolherAulaDoDia, numeroDoDia } from "../components/app/aula-do-dia.ts";
import { textosDoApp } from "../components/app/textos.ts";
import { pedirTela } from "../components/app/telas.ts";

let n = 0;
const ok = (nome, f) => {
  try {
    f();
  } catch (erro) {
    console.error("FALHOU:", nome);
    throw erro;
  }
  n++;
};
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// ───── Abas ─────
ok("são cinco abas, na ordem do plano, cada uma com raiz própria", () => {
  assert.deepEqual([...ABAS], ["inicio", "estudar", "jogos", "comunidade", "eu"]);
  assert.equal(new Set(Object.values(RAIZ_DA_ABA)).size, 5);
});
ok("trechosDoEndereco tira o idioma, a busca e o âncora", () => {
  assert.deepEqual(trechosDoEndereco("/pt"), []);
  assert.deepEqual(trechosDoEndereco("/en/trilhas/x?y=1#z"), ["trilhas", "x"]);
  assert.deepEqual(trechosDoEndereco(null), []);
});
ok("cada endereço cai na aba certa", () => {
  const casos = {
    "/pt": "inicio",
    "/pt/trilhas/marxismo/mais-valia": "estudar",
    "/pt/estantes/historia": "estudar",
    "/pt/acervo": "estudar",
    "/pt/jogos": "jogos",
    "/pt/laboratorios/quimica": "jogos",
    "/pt/comunidade": "comunidade",
    "/pt/meu-estudo/praticar": "eu",
    "/pt/caderno": "eu",
    "/zh/entrar": "eu",
    "/pt/pagina-que-nao-existe": null,
  };
  for (const [caminho, aba] of Object.entries(casos)) assert.equal(abaDoEndereco(caminho), aba, caminho);
});
ok("nenhum trecho aparece em duas abas (a ordem não decide nada)", () => {
  const fonte = ler("components/app/modo.ts");
  const bloco = fonte.slice(fonte.indexOf("TRECHOS_DA_ABA"), fonte.indexOf("/** Tira o idioma"));
  const trechos = [...bloco.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(trechos).size, trechos.length);
});
ok("raiz da aba: sem voltar; tela de dentro: com voltar", () => {
  assert.equal(ehRaizDaAba("/pt"), true);
  assert.equal(ehRaizDaAba("/pt/trilhas"), true);
  assert.equal(ehRaizDaAba("/pt/trilhas/marxismo"), false);
  assert.equal(ehRaizDaAba("/pt/jogos"), true);
  assert.equal(ehRaizDaAba("/pt/pagina-que-nao-existe"), false);
});
ok("a página de cima: aula sobe para a trilha, estante para as disciplinas, aba para o início", () => {
  assert.equal(paginaDeCima(["trilhas", "a", "b"]), "/trilhas/a");
  assert.equal(paginaDeCima(["estantes", "historia"]), "/trilhas");
  assert.equal(paginaDeCima(["trilhas"]), "/");
});
ok("painel e Rede v2 (só quando ligada) têm a casca própria; o resto não", () => {
  assert.equal(ehTelaComCascaPropria("/pt/painel/equipe", false), true);
  assert.equal(ehTelaComCascaPropria("/pt/comunidade", true), true);
  assert.equal(ehTelaComCascaPropria("/pt/comunidade", false), false);
  assert.equal(ehTelaComCascaPropria("/pt/trilhas", true), false);
});
ok("laboratório aberto é tela cheia; a lista de laboratórios não", () => {
  assert.equal(ehTelaCheiaPorEndereco("/pt/laboratorios/quimica"), true);
  assert.equal(ehTelaCheiaPorEndereco("/pt/laboratorios"), false);
  assert.equal(ehTelaCheiaPorEndereco("/pt/trilhas/a/b"), false);
});

// ───── Gesto de voltar ─────
const t = (x, y, ms) => ({ x, y, t: ms });
ok("gesto: da borda para a direita, rápido e reto, vale", () => {
  assert.equal(valeComoVoltar(t(10, 400, 0), t(150, 420, 250)), true);
});
ok("gesto: começar longe da borda não vale (rolagem horizontal de carrossel)", () => {
  assert.equal(naBorda(GESTO.borda + 1), false);
  assert.equal(valeComoVoltar(t(120, 400, 0), t(300, 400, 200)), false);
});
ok("gesto: curto, torto, lento ou para a esquerda não vale", () => {
  assert.equal(valeComoVoltar(t(10, 400, 0), t(40, 400, 100)), false);
  assert.equal(valeComoVoltar(t(10, 400, 0), t(120, 600, 200)), false);
  assert.equal(valeComoVoltar(t(10, 400, 0), t(150, 400, GESTO.tempoMax + 1)), false);
  assert.equal(valeComoVoltar(t(10, 400, 0), t(-50, 400, 100)), false);
});
ok("gesto: o indicador vai de 0 a 1 e some quando vira rolagem", () => {
  assert.equal(progressoDoGesto(t(10, 400, 0), t(10, 400, 5)), 0);
  assert.ok(progressoDoGesto(t(10, 400, 0), t(46, 405, 50)) > 0.4);
  assert.equal(progressoDoGesto(t(10, 400, 0), t(200, 400, 80)), 1);
  assert.equal(progressoDoGesto(t(10, 400, 0), t(40, 700, 80)), 0);
});
ok("gesto: no iPhone/iPad quem faz é o sistema", () => {
  assert.equal(temGestoDoSistema("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5), true);
  assert.equal(temGestoDoSistema("Mozilla/5.0 (Macintosh)", 5, "MacIntel"), true);
  assert.equal(temGestoDoSistema("Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36", 5, "Linux armv8l"), false);
});

// ───── "Voltar" ─────
ok("voltar: chegou por link de fora sobe para a página de cima; depois de andar, volta de verdade", () => {
  const chamadas = [];
  const roteador = { back: () => chamadas.push("back"), push: (h) => chamadas.push(`push ${h}`) };
  assert.equal(andouNoSite(), false);
  registrarPagina(); // a página que abriu: não conta como andar
  assert.equal(andouNoSite(), false);
  assert.equal(voltarOuSubir(roteador, "/pt/trilhas/a/b", "pt", { length: 3 }), "subiu");
  assert.equal(voltarOuSubir(roteador, "/pt/trilhas", "pt", { length: 3 }), "subiu");
  assert.equal(voltarOuSubir(roteador, "/pt", "pt", { length: 3 }), "raiz");
  registrarPagina(); // andou
  assert.equal(andouNoSite(), true);
  assert.equal(voltarOuSubir(roteador, "/pt/trilhas/a/b", "pt", { length: 3 }), "voltou");
  assert.equal(voltarOuSubir(roteador, "/pt/trilhas/a/b", "pt", { length: 1 }), "subiu");
  assert.deepEqual(chamadas, ["push /pt/trilhas/a", "push /pt", "back", "push /pt/trilhas/a"]);
});

// ───── Aula do dia ─────
const aula = (i) => ({ href: `/trilhas/t${i}/a${i}`, titulo: `Aula ${i}`, trilha: `T${i}`, minutos: 5 });
const aulas = [0, 1, 2, 3, 4].map(aula);
ok("aula do dia: sem aulas, nada; com aulas, a mesma no mesmo dia e outra no dia seguinte", () => {
  assert.equal(escolherAulaDoDia([], new Date(2026, 10, 5)), null);
  const hoje = escolherAulaDoDia(aulas, new Date(2026, 10, 5, 8));
  assert.equal(escolherAulaDoDia(aulas, new Date(2026, 10, 5, 23)).href, hoje.href);
  assert.notEqual(escolherAulaDoDia(aulas, new Date(2026, 10, 6, 8)).href, hoje.href);
  assert.equal(numeroDoDia(new Date(2026, 10, 6)) - numeroDoDia(new Date(2026, 10, 5)), 1);
});
ok("aula do dia: pula a que já foi feita; se todas foram, mantém a do dia", () => {
  const hoje = escolherAulaDoDia(aulas, new Date(2026, 10, 5));
  const feita = new Set([hoje.href.replace("/trilhas/", "")]);
  assert.notEqual(escolherAulaDoDia(aulas, new Date(2026, 10, 5), feita).href, hoje.href);
  const todas = new Set(aulas.map((a) => a.href.replace("/trilhas/", "")));
  assert.equal(escolherAulaDoDia(aulas, new Date(2026, 10, 5), todas).href, hoje.href);
});

// ───── Uma tela por vez ─────
ok("telas: abrir a segunda fecha a primeira, e a que pediu por último não se fecha", () => {
  const alvo = new EventTarget();
  globalThis.window = alvo;
  globalThis.CustomEvent = globalThis.CustomEvent ?? class extends Event { constructor(tipo, o) { super(tipo); this.detail = o?.detail; } };
  const fechadas = [];
  let devolverLab = () => {};
  devolverLab = pedirTela("laboratorio", () => {
    fechadas.push("laboratorio");
    devolverLab(); // a tela fechada devolve a vaga
  });
  const devolverAula = pedirTela("aula", () => fechadas.push("aula"));
  assert.deepEqual(fechadas, ["laboratorio"]);
  const devolverAulaDeNovo = pedirTela("aula", () => fechadas.push("aula-remontada")); // a mesma tela remontada não fecha a si mesma
  assert.deepEqual(fechadas, ["laboratorio"]);
  pedirTela("laboratorio", () => fechadas.push("lab-2")); // um laboratório aberto depois fecha a aula
  assert.equal(fechadas.filter((f) => f === "aula").length, 1);
  devolverAula();
  devolverAulaDeNovo();
  delete globalThis.window;
});

// ───── Textos nos 6 idiomas ─────
ok("textos: os 6 idiomas têm as 5 abas preenchidas e diferentes entre si; idioma desconhecido cai no português", () => {
  for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const s = textosDoApp(lang);
    assert.equal(Object.keys(s.abas).length, 5, lang);
    assert.equal(new Set(Object.values(s.abas)).size, 5, lang);
    for (const v of [s.menu, s.voltar, s.aulaDoDia, s.abrirAula, s.minutos(5)]) assert.ok(v && v.length > 0, lang);
  }
  assert.equal(textosDoApp("xx").abas.inicio, "Início");
  assert.notEqual(textosDoApp("en").abas.estudar, textosDoApp("pt").abas.estudar);
});

// ───── Cercas ─────
const arquivos = fs.readdirSync(new URL("../components/app/", import.meta.url)).map((f) => `components/app/${f}`);
ok("rastreio do deploy: nada em components/app lê disco nem usa caminho dinâmico", () => {
  for (const f of arquivos) {
    const fonte = ler(f);
    assert.doesNotMatch(fonte, /from ["'](node:)?(fs|path)["']|readFileSync|readdirSync|import\(`|require\(/, f);
  }
});
ok("privacidade: nada em components/app manda dado para fora", () => {
  for (const f of arquivos) assert.doesNotMatch(ler(f), /\bfetch\(|sendBeacon|XMLHttpRequest|WebSocket|gtag|analytics/i, f);
});
ok("sem 'universidade' nem 'diploma' na interface da casca", () => {
  for (const f of [...arquivos, "app/app-casca.css"]) assert.doesNotMatch(ler(f), /universidade|diploma/i, f);
});
ok("o CSS usa a mesma consulta do código (modo.ts) e as transições respeitam menos movimento", () => {
  const css = ler("app/app-casca.css");
  assert.ok(css.includes(`@media ${CONSULTA_CASCA} {`));
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /view-transition-name: app-abas/);
  assert.match(css, /\[data-parado\]/);
});
ok("o layout liga a casca dentro do OutsidePanel (fora do painel) e importa o CSS", () => {
  const layout = ler("app/[lang]/layout.tsx");
  assert.match(layout, /import "\.\.\/app-casca\.css"/);
  const painel = layout.indexOf("<OutsidePanel>\n            <Footer");
  const casca = layout.indexOf("<CascaDoApp />");
  assert.ok(painel > 0 && casca > painel, "CascaDoApp precisa vir depois da abertura do OutsidePanel do rodapé");
  assert.ok(casca < layout.indexOf("</OutsidePanel>", painel), "CascaDoApp precisa estar dentro dele");
});
ok("a Rede v2 já esconde a barra do site e a casca usa a mesma classe: sai junto", () => {
  assert.match(ler("components/rede/Casca.tsx"), /\.abas-do-celular \{ display: none !important/);
  assert.match(ler("components/app/CascaDoApp.tsx"), /abas-do-celular/);
});
ok("package.json registra o teste", () => {
  assert.match(ler("package.json"), /"testar:app-casca": "[^"]*testar-app-casca\.mjs"/);
});

console.log(`testar-app-casca: ${n} conferências passaram`);
