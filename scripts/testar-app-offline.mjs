// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o funcionamento sem internet do aplicativo (docs/APP-OFFLINE.md, pacote "app-offline"): a lógica do
// service worker (public/sw.js) rodando num ambiente de mentira (caches e fetch simulados), a fila do que precisa de rede,
// o aviso de versão nova, o manifesto e as cercas (rastreio do deploy, privacidade). Sem rede, sem navegador.
// Uso: npm run testar:app-offline
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CHAVE_DA_FILA, IDIOMAS_DOS_AVISOS, LIMITES_DA_FILA, acompanharAtualizacao, descartarFila, enderecoDaFilaValido, enfileirar, enviarOuEnfileirar, esvaziarFila, lerFila, podeBuscarVersao, podeGuardarCasca, situacaoDoStatus, textosDeRede } from "../components/offline/offline.ts";
import { montarManifesto } from "../lib/manifesto.ts";
import pt from "../i18n/pt.json" with { type: "json" };

let n = 0;
const ok = async (nome, f) => {
  try {
    await f();
  } catch (erro) {
    console.error("FALHOU:", nome);
    throw erro;
  }
  n++;
};
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// ───── Ambiente de mentira para o service worker ─────
function criarAmbiente({ ativo = false, online = true, rede = {} } = {}) {
  const lojas = new Map(); // nome -> Map(url -> Response)
  const abrir = (nome) => {
    if (!lojas.has(nome)) lojas.set(nome, new Map());
    const mapa = lojas.get(nome);
    return {
      async match(chave, opcoes) {
        const url = typeof chave === "string" ? chave : chave.url;
        const alvo = opcoes?.ignoreSearch ? url.split("?")[0] : url;
        for (const [k, v] of mapa) if ((opcoes?.ignoreSearch ? k.split("?")[0] : k) === alvo) return v.clone();
        return undefined;
      },
      async put(chave, resposta) {
        const url = typeof chave === "string" ? chave : chave.url;
        mapa.delete(url);
        mapa.set(url, resposta);
      },
      async delete(chave) {
        return mapa.delete(typeof chave === "string" ? chave : chave.url);
      },
      async keys() {
        return [...mapa.keys()].map((url) => ({ url }));
      },
    };
  };
  const caches = {
    open: async (nome) => abrir(nome),
    keys: async () => [...lojas.keys()],
    delete: async (nome) => lojas.delete(nome),
  };
  const ouvintes = {};
  const chamadas = { skipWaiting: 0, claim: 0, buscas: [] };
  const self = {
    location: { origin: "https://lucia.test" },
    registration: { active: ativo ? {} : null, showNotification() {} },
    clients: { claim: async () => void chamadas.claim++, matchAll: async () => [], openWindow: async () => undefined },
    skipWaiting: () => void chamadas.skipWaiting++,
    addEventListener: (tipo, f) => (ouvintes[tipo] = f),
  };
  const estado = { online, redeCaiu: false };
  const contexto = {
    self,
    caches,
    navigator: { get onLine() { return estado.online; } },
    Response,
    Request,
    URL,
    AbortController,
    TextEncoder,
    setTimeout,
    clearTimeout,
    Promise,
    module: { exports: {} },
    fetch: async (pedido) => {
      const url = typeof pedido === "string" ? new URL(pedido, self.location.origin).href : pedido.url;
      chamadas.buscas.push(url);
      if (!estado.online || estado.redeCaiu) throw new TypeError("sem rede");
      const f = rede[new URL(url).pathname];
      const corpo = f ? f() : { status: 200, texto: `corpo de ${url}` };
      const r = new Response(corpo.texto, { status: corpo.status ?? 200, headers: corpo.cabecalhos ?? {} });
      Object.defineProperty(r, "type", { value: "basic" });
      return r;
    },
  };
  vm.createContext(contexto);
  vm.runInContext(ler("public/sw.js"), contexto, { filename: "sw.js" });
  const sw = contexto.module.exports;
  const esperas = [];
  /** Dispara um evento do service worker e espera os waitUntil/respondWith. */
  const disparar = async (tipo, extra = {}) => {
    let resposta;
    const evento = { ...extra, waitUntil: (p) => void esperas.push(p), respondWith: (p) => void (resposta = p) };
    ouvintes[tipo](evento);
    await Promise.all(esperas.splice(0));
    return resposta === undefined ? undefined : await resposta;
  };
  const navegar = (caminho) => disparar("fetch", { request: { method: "GET", url: `https://lucia.test${caminho}`, mode: "navigate", headers: new Headers() } });
  const pedir = (caminho, modo = "no-cors") => disparar("fetch", { request: { method: "GET", url: `https://lucia.test${caminho}`, mode: modo, headers: new Headers() } });
  return { sw, lojas, abrir, caches, estado, chamadas, disparar, navegar, pedir, ouvintes };
}
const nomes = (amb) => [...amb.lojas.keys()].sort();
const urls = (amb, nome) => [...(amb.lojas.get(nome)?.keys() ?? [])];

// ───── Service worker: versão e atualização com aviso ─────
await ok("a VERSAO do sw e os nomes de components/Offline.tsx são os mesmos", async () => {
  const amb = criarAmbiente();
  const off = ler("components/Offline.tsx");
  assert.ok(off.includes(`NOME_DAS_PAGINAS = "${amb.sw.PAGINAS}"`), "NOME_DAS_PAGINAS diferente de lucia-paginas-<VERSAO> do sw.js");
  assert.ok(off.includes(`NOME_DOS_CURSOS = "${amb.sw.CURSOS}"`), "NOME_DOS_CURSOS diferente do CURSOS do sw.js");
  assert.equal(amb.sw.CURSOS, "lucia-cursos", "o cache dos cursos não pode ter versão");
  assert.match(amb.sw.PAGINAS, /^lucia-paginas-v\d+$/);
});
await ok("primeira instalação assume na hora (skipWaiting)", async () => {
  const amb = criarAmbiente({ ativo: false });
  await amb.disparar("install");
  assert.equal(amb.chamadas.skipWaiting, 1);
});
await ok("atualização NÃO assume sozinha: espera o toque", async () => {
  const amb = criarAmbiente({ ativo: true });
  await amb.disparar("install");
  assert.equal(amb.chamadas.skipWaiting, 0);
});
await ok("mensagem 'pular' faz a versão nova assumir; mensagem estranha não faz nada", async () => {
  const amb = criarAmbiente({ ativo: true });
  await amb.disparar("message", { data: { tipo: "outra" } });
  await amb.disparar("message", { data: null });
  await amb.disparar("message", { data: "pular" });
  assert.equal(amb.chamadas.skipWaiting, 0);
  await amb.disparar("message", { data: { tipo: "pular" } });
  assert.equal(amb.chamadas.skipWaiting, 1);
});
await ok("mensagem 'versao' responde com a VERSAO", async () => {
  const amb = criarAmbiente();
  let recebido;
  await amb.disparar("message", { data: { tipo: "versao" }, source: { postMessage: (m) => (recebido = m) } });
  assert.deepEqual(JSON.parse(JSON.stringify(recebido)), { tipo: "versao", versao: amb.sw.VERSAO });
});
await ok("ativar apaga as cópias da época da Vercel (v1 a v5) sem migrar nada delas, e mantém os cursos", async () => {
  const amb = criarAmbiente({ ativo: true });
  (await amb.caches.open("lucia-paginas-v5")).put("https://lucia.test/pt/painel", new Response("pagina da vercel"));
  (await amb.caches.open("lucia-fixos-v5")).put("https://lucia.test/_next/static/immutable/x.js", new Response("js"));
  (await amb.caches.open("lucia-casca-v5")).put("https://lucia.test/pt", new Response("casca da vercel"));
  (await amb.caches.open("lucia-cursos")).put("https://lucia.test/pt/trilhas/c/d", new Response("curso guardado"));
  await amb.disparar("activate");
  const lista = nomes(amb);
  assert.ok(!lista.some((n) => n.endsWith("-v5")), "as caches v5 somem");
  assert.ok(!urls(amb, amb.sw.PAGINAS).includes("https://lucia.test/pt/painel"), "a página da Vercel não passa para a v6");
  assert.ok(!urls(amb, amb.sw.CASCA).includes("https://lucia.test/pt"), "a casca da Vercel não passa para a v6");
  assert.ok(lista.includes("lucia-cursos"), "os cursos guardados continuam");
});
await ok("ativar apaga caches de versão antiga, MANTÉM os cursos e migra as últimas aulas para o cache novo", async () => {
  const amb = criarAmbiente({ ativo: true });
  // "-v7-teste" faz o papel de uma versão anterior qualquer da mesma hospedagem (migra); as v1 a v5 são da época da
  // Vercel e não migram (teste logo abaixo).
  (await amb.caches.open("lucia-paginas-v7-teste")).put("https://lucia.test/pt/trilhas/a/b", new Response("aula antiga"));
  (await amb.caches.open("lucia-fixos-v7-teste")).put("https://lucia.test/_next/static/x.js", new Response("js"));
  (await amb.caches.open("lucia-leves-v7-teste")).put("https://lucia.test/labs/x", new Response("lab"));
  (await amb.caches.open("lucia-cursos")).put("https://lucia.test/pt/trilhas/c/d", new Response("curso guardado"));
  (await amb.caches.open("lucia-casca-v7-teste")).put("https://lucia.test/pt/jogos", new Response("casca antiga"));
  (await amb.caches.open("de-outro-site")).put("https://lucia.test/x", new Response("x"));
  await amb.disparar("activate");
  const lista = nomes(amb);
  assert.ok(!lista.includes("lucia-paginas-v7-teste") && !lista.includes("lucia-fixos-v7-teste") && !lista.includes("lucia-leves-v7-teste"));
  assert.ok(lista.includes("lucia-cursos"), "os cursos guardados têm de sobreviver à atualização");
  assert.ok(lista.includes("de-outro-site"), "não mexe em cache que não é do Lúcia");
  assert.ok(urls(amb, amb.sw.PAGINAS).includes("https://lucia.test/pt/trilhas/a/b"), "a última aula aberta tem de continuar");
  assert.ok(urls(amb, amb.sw.FIXOS).includes("https://lucia.test/_next/static/x.js"));
  assert.ok(urls(amb, amb.sw.CASCA).includes("https://lucia.test/pt/jogos"), "a casca guardada também sobrevive à atualização");
  assert.ok(urls(amb, amb.sw.LEVES).includes("https://lucia.test/labs/x"), "os jogos leves também");
  assert.equal(amb.chamadas.claim, 1);
});

// ───── Service worker: páginas, casca e aulas ─────
await ok("com rede: devolve a página e a guarda; sem rede: devolve a cópia guardada (últimas aulas abertas)", async () => {
  const amb = criarAmbiente();
  const r1 = await amb.navegar("/pt/trilhas/historia/aula-1");
  assert.equal(await r1.text(), "corpo de https://lucia.test/pt/trilhas/historia/aula-1");
  assert.ok(urls(amb, amb.sw.PAGINAS).includes("https://lucia.test/pt/trilhas/historia/aula-1"));
  amb.estado.online = false;
  const r2 = await amb.navegar("/pt/trilhas/historia/aula-1?x=1");
  assert.equal(r2.status, 200);
  assert.match(await r2.text(), /aula-1/);
});
await ok("sem rede e sem cópia: página 'sem conexão' no idioma do endereço, com status 503 e botão de tentar de novo", async () => {
  const amb = criarAmbiente({ online: false });
  for (const [caminho, lang] of [["/pt/jogos", "pt-BR"], ["/en/jogos", "en"], ["/es/x", "es"], ["/fr/x", "fr"], ["/ru/x", "ru"], ["/zh/x", "zh"]]) {
    const r = await amb.navegar(caminho);
    assert.equal(r.status, 503);
    const html = await r.text();
    assert.ok(html.includes(`<html lang="${lang}">`), caminho);
    assert.ok(html.includes("location.reload()"), "botão de tentar de novo");
    assert.equal(r.headers.get("x-lucia-offline"), "1");
  }
  assert.equal(amb.chamadas.buscas.length, 0, "sem internet o sw nem tenta a rede (resposta imediata)");
});
await ok("os 6 idiomas da página 'sem conexão' têm todos os campos", async () => {
  const amb = criarAmbiente();
  assert.deepEqual([...Object.keys(amb.sw.TEXTOS_SEM_REDE)].sort(), ["en", "es", "fr", "pt", "ru", "zh"]);
  for (const campos of Object.values(amb.sw.TEXTOS_SEM_REDE)) {
    assert.equal(campos.length, 6);
    for (const c of campos) assert.ok(c.trim().length > 0);
  }
});
await ok("rede que falha (aparelho diz que está online) com cópia guardada: usa a cópia; sem cópia, a página 'sem conexão'", async () => {
  const amb = criarAmbiente();
  await amb.navegar("/pt/alumia");
  amb.estado.redeCaiu = true;
  assert.equal((await amb.navegar("/pt/alumia")).status, 200);
  assert.equal((await amb.navegar("/pt/mural")).status, 503);
});
await ok("erro 5xx do servidor com cópia guardada: usa a cópia", async () => {
  const amb = criarAmbiente({ rede: { "/pt/quebrada": () => ({ status: 500, texto: "erro" }) } });
  (await amb.caches.open(amb.sw.PAGINAS)).put("https://lucia.test/pt/quebrada", new Response("cópia boa"));
  assert.equal(await (await amb.navegar("/pt/quebrada")).text(), "cópia boa");
});
await ok("410 (matéria que saiu do ar): apaga a cópia guardada e não volta sem internet", async () => {
  const amb = criarAmbiente({ rede: { "/pt/jornal/expirada": () => ({ status: 410, texto: "saiu do ar" }) } });
  (await amb.caches.open(amb.sw.PAGINAS)).put("https://lucia.test/pt/jornal/expirada", new Response("cópia velha"));
  assert.equal((await amb.navegar("/pt/jornal/expirada")).status, 410);
  assert.ok(!urls(amb, amb.sw.PAGINAS).includes("https://lucia.test/pt/jornal/expirada"), "a cópia guardada ficou");
  amb.estado.redeCaiu = true;
  assert.equal((await amb.navegar("/pt/jornal/expirada")).status, 503);
});
await ok("a página que mora na casca ou nos cursos é atualizada no mesmo lugar (não vai para o cache aparado)", async () => {
  const amb = criarAmbiente();
  (await amb.caches.open(amb.sw.CURSOS)).put("https://lucia.test/pt/trilhas/c/d", new Response("curso velho"));
  await amb.navegar("/pt/trilhas/c/d");
  assert.match(await (await (await amb.caches.open(amb.sw.CURSOS)).match("https://lucia.test/pt/trilhas/c/d")).text(), /corpo de/);
  assert.ok(!urls(amb, amb.sw.PAGINAS).includes("https://lucia.test/pt/trilhas/c/d"));
});
await ok("curso guardado não é apagado quando as páginas passam do limite (300)", async () => {
  const amb = criarAmbiente();
  (await amb.caches.open(amb.sw.CURSOS)).put("https://lucia.test/pt/trilhas/c/d", new Response("curso"));
  for (let i = 0; i < 305; i++) await amb.navegar(`/pt/trilhas/t/aula-${i}`);
  await new Promise((r) => setTimeout(r, 50));
  const guardadas = urls(amb, amb.sw.PAGINAS);
  assert.ok(guardadas.length <= 300, `passou do limite: ${guardadas.length}`);
  assert.ok(!guardadas.includes("https://lucia.test/pt/trilhas/t/aula-0"), "a mais antiga sai");
  assert.ok(guardadas.includes("https://lucia.test/pt/trilhas/t/aula-304"));
  assert.ok(urls(amb, amb.sw.CURSOS).includes("https://lucia.test/pt/trilhas/c/d"));
});
await ok("urlsDaCasca: as 5 telas das abas, só nos 6 idiomas", async () => {
  const { sw } = criarAmbiente();
  assert.deepEqual([...sw.urlsDaCasca("pt")], ["/pt", "/pt/trilhas", "/pt/jogos", "/pt/alumia", "/pt/meu-estudo"]);
  assert.deepEqual(sw.urlsDaCasca("zh")[1], "/zh/trilhas");
  assert.deepEqual([...sw.urlsDaCasca("xx")], []);
  assert.deepEqual([...sw.urlsDaCasca("../x")], []);
});
await ok("as telas das abas do sw são as RAIZ_DA_ABA do aplicativo (components/app/modo.ts)", async () => {
  const modo = ler("components/app/modo.ts");
  const m = /RAIZ_DA_ABA[^{]*\{([^}]*)\}/.exec(modo);
  const raizes = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).map((r) => (r === "/" ? "" : r));
  assert.deepEqual(raizes, ["", "/trilhas", "/jogos", "/alumia", "/meu-estudo"]);
  assert.deepEqual([...criarAmbiente().sw.urlsDaCasca("pt")], raizes.map((r) => `/pt${r}`));
});
await ok("caminhoPermitido: só o próprio site, num idioma, fora do privado", async () => {
  const { sw } = criarAmbiente();
  assert.equal(sw.caminhoPermitido("/pt/trilhas/historia/aula-1"), "/pt/trilhas/historia/aula-1");
  assert.equal(sw.caminhoPermitido("/en/jogos?x=1"), "/en/jogos");
  for (const ruim of ["https://evil.test/pt/x", "//evil.test/pt/x", "/\\evil.test", "/pt/painel", "/pt/painel/x", "/en/entrar", "/pt/meus-dados", "/pt/certificado/1", "/api/x", "/_vercel/x", "/x/y", "", null, 7, "/pt/" + "a".repeat(400)]) {
    assert.equal(sw.caminhoPermitido(ruim), null, String(ruim));
  }
});
await ok("planoDaCasca: 5 telas + até 12 extras sem repetir; idioma ruim não guarda nada", async () => {
  const { sw } = criarAmbiente();
  const extras = Array.from({ length: 30 }, (_, i) => `/pt/trilhas/t/a${i}`);
  const plano = sw.planoDaCasca({ lang: "pt", extras: ["/pt/trilhas", ...extras, "https://evil.test/pt/x", "/pt/painel"] });
  assert.equal(plano.length, 5 + 11, "5 raízes + 12 extras, um repetido");
  assert.ok(!plano.some((p) => p.includes("evil") || p.includes("painel")));
  assert.deepEqual([...sw.planoDaCasca({ lang: "xx", extras })], []);
  assert.deepEqual([...sw.planoDaCasca(null)], []);
  assert.equal(sw.planoDaCasca({ lang: "en" }).length, 5);
});
await ok("mensagem 'casca' guarda as 5 telas no cache da casca (e só o que falta); depois funcionam sem rede", async () => {
  const amb = criarAmbiente();
  await amb.disparar("message", { data: { tipo: "casca", lang: "pt", extras: ["/pt/trilhas/comece-aqui/aula-1"] } });
  const guardadas = urls(amb, amb.sw.CASCA);
  assert.equal(guardadas.length, 6);
  for (const t of ["/pt", "/pt/trilhas", "/pt/jogos", "/pt/alumia", "/pt/meu-estudo", "/pt/trilhas/comece-aqui/aula-1"]) assert.ok(guardadas.includes(`https://lucia.test${t}`), t);
  const antes = amb.chamadas.buscas.length;
  await amb.disparar("message", { data: { tipo: "casca", lang: "pt", extras: [] } });
  assert.equal(amb.chamadas.buscas.length, antes, "não baixa de novo o que já tem");
  amb.estado.online = false;
  for (const t of ["/pt", "/pt/jogos", "/pt/meu-estudo", "/pt/trilhas/comece-aqui/aula-1"]) assert.equal((await amb.navegar(t)).status, 200, t);
});
await ok("'casca' sem internet não tenta baixar nada e nunca lança", async () => {
  const amb = criarAmbiente({ online: false });
  await amb.disparar("message", { data: { tipo: "casca", lang: "en" } });
  assert.equal(amb.chamadas.buscas.length, 0);
  assert.equal(urls(amb, amb.sw.CASCA).length, 0);
});
await ok("'casca' com uma tela fora do ar para na primeira falha, sem quebrar", async () => {
  const amb = criarAmbiente({ rede: { "/pt/jogos": () => ({ status: 500, texto: "erro" }) } });
  await amb.disparar("message", { data: { tipo: "casca", lang: "pt" } });
  const guardadas = urls(amb, amb.sw.CASCA);
  assert.ok(!guardadas.includes("https://lucia.test/pt/jogos"), "resposta de erro não é guardada");
  assert.ok(guardadas.includes("https://lucia.test/pt/alumia"));
});

// ───── Service worker: jogos e ferramentas leves, fixos e o que fica de fora ─────
await ok("classificação: fixos, leves e privados", async () => {
  const { sw } = criarAmbiente();
  for (const c of ["/_next/static/chunks/a.js", "/imagens/x.png", "/arquivos/x.pdf", "/marca-192.png"]) assert.ok(sw.fixo(c), c);
  for (const c of ["/labs/loopy/index.html", "/blockly/x.js", "/jscpp/x.js", "/fontes/x.woff2", "/capas/a.webp", "/_next/image"]) assert.ok(sw.leve(c), c);
  for (const c of ["/pyodide/x.wasm", "/php/x.wasm", "/ruby/x.wasm", "/lua/x", "/typescript/x.js", "/videos-curtos/x.mp4", "/vozes-amostras/x.mp3"]) assert.ok(!sw.leve(c), `${c} é pesado e fica de fora`);
  for (const c of ["/pt/painel", "/en/entrar", "/pt/meus-dados", "/pt/certificado/x", "/api/x", "/_vercel/x"]) assert.ok(sw.privado(c), c);
});
await ok("jogo leve: 1ª vez baixa e guarda; depois responde da cópia (e funciona sem rede)", async () => {
  const amb = criarAmbiente();
  const r1 = await amb.pedir("/labs/loopy/js/app.js");
  assert.match(await r1.text(), /corpo de/);
  assert.ok(urls(amb, amb.sw.LEVES).includes("https://lucia.test/labs/loopy/js/app.js"));
  amb.estado.online = false;
  const r2 = await amb.pedir("/labs/loopy/js/app.js");
  assert.equal(r2.status, 200);
});
await ok("arquivo leve acima de 4 MB não é guardado; pesados nem passam pelo sw", async () => {
  const amb = criarAmbiente({ rede: { "/labs/grande.bin": () => ({ texto: "x", cabecalhos: { "content-length": String(5 * 1024 * 1024) } }) } });
  await amb.pedir("/labs/grande.bin");
  assert.ok(!urls(amb, amb.sw.LEVES).includes("https://lucia.test/labs/grande.bin"));
  assert.equal(await amb.pedir("/pyodide/pyodide.wasm"), undefined, "o sw não intercepta o pesado");
});
await ok("o sw não toca no painel, na entrada, na API, em POST nem em Range", async () => {
  const amb = criarAmbiente();
  assert.equal(await amb.navegar("/pt/painel"), undefined);
  assert.equal(await amb.navegar("/en/entrar"), undefined);
  assert.equal(await amb.pedir("/api/x"), undefined);
  assert.equal(await amb.disparar("fetch", { request: { method: "POST", url: "https://lucia.test/pt/x", mode: "navigate", headers: new Headers() } }), undefined);
  assert.equal(await amb.disparar("fetch", { request: { method: "GET", url: "https://lucia.test/videos/x.mp4", mode: "no-cors", headers: new Headers({ range: "bytes=0-1" }) } }), undefined);
  assert.equal(await amb.disparar("fetch", { request: { method: "GET", url: "https://outro.test/x.js", mode: "no-cors", headers: new Headers() } }), undefined);
  assert.deepEqual(amb.chamadas.buscas, []);
  assert.deepEqual(nomes(amb), [], "nada de privado foi guardado");
});

// ───── A fila do que precisa de rede ─────
const novoArmazem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), _m: m };
};
const entrada = (extra = {}) => ({ url: "/api/alumia/recado", metodo: "POST", corpo: JSON.stringify({ texto: "oi" }), ...extra });
await ok("enderecoDaFilaValido: só /api/ do próprio site", async () => {
  assert.ok(enderecoDaFilaValido("/api/rede/postar"));
  assert.ok(enderecoDaFilaValido("/api/x?a=1&b=2"));
  for (const ruim of ["https://evil.test/api/x", "//evil.test/api/x", "/pt/x", "/api/../painel", "/api//x", "api/x", "", null, undefined, 3, "/api/x y", "/api/" + "a".repeat(400)]) assert.equal(enderecoDaFilaValido(ruim), false, String(ruim));
});
await ok("enfileirar: guarda, e recusa endereço de fora, método estranho, corpo grande e fila cheia", async () => {
  const a = novoArmazem();
  const agora = 1_000_000;
  assert.equal(enfileirar(a, entrada(), agora).ok, true);
  assert.equal(lerFila(a, agora).length, 1);
  assert.deepEqual(enfileirar(a, entrada({ url: "https://evil.test/api/x" }), agora), { ok: false, motivo: "endereco" });
  assert.deepEqual(enfileirar(a, entrada({ metodo: "GET" }), agora), { ok: false, motivo: "metodo" });
  assert.deepEqual(enfileirar(a, entrada({ corpo: "x".repeat(LIMITES_DA_FILA.corpo + 1) }), agora), { ok: false, motivo: "tamanho" });
  for (let i = 1; i < LIMITES_DA_FILA.itens; i++) assert.equal(enfileirar(a, entrada(), agora).ok, true);
  assert.deepEqual(enfileirar(a, entrada(), agora), { ok: false, motivo: "cheia" });
  assert.equal(lerFila(a, agora).length, LIMITES_DA_FILA.itens);
});
await ok("lerFila: ignora lixo, itens velhos (7 dias) e itens adulterados; nunca lança", async () => {
  const a = novoArmazem();
  const agora = 10 * 86_400_000;
  a.setItem(CHAVE_DA_FILA, "{nao e json");
  assert.deepEqual(lerFila(a, agora), []);
  a.setItem(CHAVE_DA_FILA, JSON.stringify({ x: 1 }));
  assert.deepEqual(lerFila(a, agora), []);
  const bom = { id: "a", url: "/api/x", metodo: "POST", corpo: "{}", criado: agora - 1000, tentativas: 0 };
  const velho = { ...bom, id: "b", criado: agora - 8 * 86_400_000 };
  const forasteiro = { ...bom, id: "c", url: "https://evil.test/api/x" };
  const semId = { ...bom, id: 5 };
  a.setItem(CHAVE_DA_FILA, JSON.stringify([bom, velho, forasteiro, semId, null, "x"]));
  assert.deepEqual(lerFila(a, agora).map((i) => i.id), ["a"]);
  const quebrado = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); }, removeItem() {} };
  assert.deepEqual(lerFila(quebrado, agora), []);
  assert.equal(enfileirar(quebrado, entrada(), agora).ok, true, "armazenamento bloqueado não derruba quem envia");
});
await ok("situacaoDoStatus", async () => {
  assert.equal(situacaoDoStatus(null), "rede");
  assert.equal(situacaoDoStatus(200), "ok");
  assert.equal(situacaoDoStatus(201), "ok");
  assert.equal(situacaoDoStatus(400), "recusado");
  assert.equal(situacaoDoStatus(403), "recusado");
  assert.equal(situacaoDoStatus(429), "erro");
  assert.equal(situacaoDoStatus(503), "erro");
});
await ok("esvaziarFila: manda na ordem, para na primeira falta de rede e guarda o resto", async () => {
  const a = novoArmazem();
  const agora = 5_000;
  for (const t of ["um", "dois", "tres", "quatro"]) enfileirar(a, entrada({ corpo: t }), agora);
  const mandados = [];
  const r = await esvaziarFila(a, async (item) => {
    mandados.push(item.corpo);
    return item.corpo === "tres" ? "rede" : "ok";
  }, agora);
  assert.deepEqual(mandados, ["um", "dois", "tres"], "o quarto nem é tentado");
  assert.deepEqual(r, { enviados: 2, restantes: 2 });
  assert.deepEqual(lerFila(a, agora).map((i) => i.corpo), ["tres", "quatro"]);
  const r2 = await esvaziarFila(a, async () => "ok", agora);
  assert.deepEqual(r2, { enviados: 2, restantes: 0 });
  assert.equal(a._m.has(CHAVE_DA_FILA), false, "fila vazia apaga a chave");
});
await ok("esvaziarFila: 'recusado' sai (repetir não adianta); 'erro' fica e some depois de 5 tentativas; envio que lança conta como falta de rede", async () => {
  const a = novoArmazem();
  const agora = 7_000;
  enfileirar(a, entrada({ corpo: "recusado" }), agora);
  enfileirar(a, entrada({ corpo: "erro" }), agora);
  const resposta = async (item) => (item.corpo === "recusado" ? "recusado" : "erro");
  let r = await esvaziarFila(a, resposta, agora);
  assert.deepEqual(r, { enviados: 0, restantes: 1 });
  for (let i = 0; i < LIMITES_DA_FILA.tentativas - 1; i++) r = await esvaziarFila(a, resposta, agora);
  assert.equal(r.restantes, 0, "depois de 5 tentativas o item some");
  enfileirar(a, entrada(), agora);
  r = await esvaziarFila(a, async () => { throw new Error("caiu"); }, agora);
  assert.deepEqual(r, { enviados: 0, restantes: 1 });
});
await ok("enviarOuEnfileirar: envia agora; sem rede vai para a fila; recusa do servidor não entra na fila", async () => {
  const a = novoArmazem();
  const agora = 9_000;
  assert.equal(await enviarOuEnfileirar(a, entrada(), async () => "ok", agora), "enviado");
  assert.equal(lerFila(a, agora).length, 0);
  assert.equal(await enviarOuEnfileirar(a, entrada(), async () => "rede", agora), "na-fila");
  assert.equal(await enviarOuEnfileirar(a, entrada(), async () => { throw new Error("x"); }, agora), "na-fila");
  assert.equal(lerFila(a, agora).length, 2);
  assert.equal(await enviarOuEnfileirar(a, entrada(), async () => "recusado", agora), "recusado");
  assert.equal(lerFila(a, agora).length, 2);
  assert.equal(await enviarOuEnfileirar(a, entrada({ url: "https://evil.test/api/x" }), async () => "rede", agora), "falhou");
});
await ok("descartarFila esvazia", async () => {
  const a = novoArmazem();
  enfileirar(a, entrada(), 1);
  descartarFila(a);
  assert.deepEqual(lerFila(a, 2), []);
});

// ───── Aviso de versão nova ─────
await ok("acompanharAtualizacao: avisa quando a nova termina de instalar; o toque manda 'pular'", async () => {
  const mensagens = [];
  const novo = { state: "installing", ouvintes: [], addEventListener(_t, f) { this.ouvintes.push(f); }, postMessage: (m) => mensagens.push(m) };
  const registro = { waiting: null, installing: null, ouv: {}, addEventListener(t, f) { this.ouv[t] = f; } };
  let avisos = 0;
  const assumir = acompanharAtualizacao(registro, true, () => avisos++);
  assert.equal(avisos, 0);
  registro.installing = novo;
  registro.ouv.updatefound();
  novo.state = "installed";
  registro.waiting = novo;
  novo.ouvintes.forEach((f) => f());
  assert.equal(avisos, 1);
  assumir();
  assert.deepEqual(mensagens, [{ tipo: "pular" }]);
});
await ok("acompanharAtualizacao: versão que já esperava ao abrir avisa na hora; sem controle (1ª visita) não avisa", async () => {
  const espera = { postMessage() {} };
  let avisos = 0;
  acompanharAtualizacao({ waiting: espera, installing: null, addEventListener() {} }, true, () => avisos++);
  assert.equal(avisos, 1);
  acompanharAtualizacao({ waiting: espera, installing: null, addEventListener() {} }, false, () => avisos++);
  assert.equal(avisos, 1, "primeira visita: nada a avisar");
});
await ok("podeBuscarVersao (30 min) e podeGuardarCasca (economia de dados / 2G)", async () => {
  assert.equal(podeBuscarVersao(0, 29 * 60_000), false);
  assert.equal(podeBuscarVersao(0, 30 * 60_000), true);
  assert.equal(podeGuardarCasca(undefined), true);
  assert.equal(podeGuardarCasca({ effectiveType: "4g" }), true);
  assert.equal(podeGuardarCasca({ saveData: true }), false);
  assert.equal(podeGuardarCasca({ effectiveType: "2g" }), false);
  assert.equal(podeGuardarCasca({ effectiveType: "slow-2g" }), false);
});
await ok("textos dos avisos nos 6 idiomas, sem campo vazio", async () => {
  assert.deepEqual([...IDIOMAS_DOS_AVISOS].sort(), ["en", "es", "fr", "pt", "ru", "zh"]);
  for (const lang of IDIOMAS_DOS_AVISOS) {
    const s = textosDeRede(lang);
    for (const chave of ["semInternet", "descartar", "novaVersao", "atualizar", "depois"]) assert.ok(s[chave].trim().length > 0, `${lang}.${chave}`);
    assert.ok(s.fila(3).includes("3") && s.enviados(2).includes("2"), lang);
  }
  assert.equal(textosDeRede("xx").semInternet, textosDeRede("pt").semInternet);
  assert.match(textosDeRede("pt").atualizar, /atualizar/);
});

// ───── Manifesto ─────
await ok("manifesto: standalone, orientação, atalhos do aplicativo e os antigos, ícones, escopo e id", async () => {
  for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const m = montarManifesto(lang, pt);
    assert.equal(m.display, "standalone");
    assert.deepEqual(m.display_override, ["standalone", "minimal-ui"]);
    assert.equal(m.orientation, "any");
    assert.equal(m.scope, "/");
    assert.equal(m.id, `/${lang}`);
    assert.equal(m.start_url, `/${lang}`);
    const urls = m.shortcuts.map((s) => s.url);
    assert.deepEqual(urls.slice(0, 4), [`/${lang}/trilhas`, `/${lang}/jogos`, `/${lang}/alumia`, `/${lang}/meu-estudo`], "os 4 primeiros são as abas");
    assert.ok(urls.includes(`/${lang}/acervo`) && urls.includes(`/${lang}/radio`), "os atalhos antigos continuam");
    for (const s of m.shortcuts) {
      assert.ok(s.name.trim().length > 0 && s.icons?.[0]?.src === "/marca-96.png" && s.icons[0].sizes === "96x96");
      assert.ok(fs.existsSync(new URL(`../public${s.icons[0].src}`, import.meta.url)), "o ícone do atalho existe");
    }
    assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  }
  assert.notEqual(montarManifesto("en", pt).shortcuts[1].name, montarManifesto("pt", pt).shortcuts[1].name, "o nome do atalho vem do idioma");
});
await ok("manifesto: screenshots só entram quando a lista (lib/capturas-app.json) tem capturas, e os arquivos existem", async () => {
  const lista = JSON.parse(ler("lib/capturas-app.json")).capturas;
  const m = montarManifesto("pt", pt);
  if (lista.length === 0) assert.equal("screenshots" in m, false, "sem capturas, sem o campo (o Chrome reclama de imagem que não existe)");
  else {
    assert.equal(m.screenshots.length, lista.length);
    for (const c of m.screenshots) {
      assert.ok(fs.existsSync(new URL(`../public${c.src}`, import.meta.url)), c.src);
      assert.ok(c.form_factor === "narrow" || c.form_factor === "wide");
      assert.ok(c.label);
    }
  }
  assert.ok(ler("scripts/gerar-capturas-app.mjs").includes("capturas-app.json"));
});

// ───── Cercas: rastreio do deploy e privacidade ─────
await ok("nada novo lê disco em tempo de execução nem chama serviço de fora", async () => {
  for (const arq of ["components/offline/offline.ts", "components/offline/AvisoDeRede.tsx", "lib/manifesto.ts", "public/sw.js"]) {
    const t = ler(arq);
    assert.ok(!/from\s+["']node:fs["']|require\(["']fs["']\)|readFileSync|readdirSync|process\.cwd\(\)/.test(t), `${arq} lê disco`);
    assert.ok(!/https?:\/\/(?!lucia\.invalido)[a-z0-9.-]+\.[a-z]{2,}\//i.test(t.replace(/\/\/ .*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")), `${arq} fala com um endereço de fora`);
  }
});
await ok("privacidade: sem rastreamento nem envio automático; a fila só guarda o que a pessoa pediu", async () => {
  const alvo = ler("components/offline/offline.ts") + ler("components/offline/AvisoDeRede.tsx") + ler("public/sw.js");
  assert.ok(!/analytics|gtag|sendBeacon|fingerprint|navigator\.userAgent|document\.cookie/i.test(alvo));
  assert.ok(ler("components/offline/AvisoDeRede.tsx").includes("descartarFila"), "a pessoa pode descartar a fila");
  assert.ok(ler("components/offline/offline.ts").includes("enderecoDaFilaValido"));
});
await ok("a interface não usa 'universidade' nem 'diploma'", async () => {
  for (const arq of ["components/offline/offline.ts", "components/offline/AvisoDeRede.tsx", "public/sw.js"]) assert.ok(!/universidade|diploma/i.test(ler(arq)), arq);
});
await ok("Offline.tsx monta o AvisoDeRede e guarda cursos no cache sem versão", async () => {
  const off = ler("components/Offline.tsx");
  assert.ok(off.includes("<AvisoDeRede />"));
  assert.ok(/caches\.open\(CURSOS\)/.test(off));
  assert.ok(ler("package.json").includes('"testar:app-offline"'));
});

console.log(`testar-app-offline: ${n} conferências passaram.`);
