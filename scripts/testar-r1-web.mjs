// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os consertos da revisão da web antes do beta (servidor, rotas e conteúdo de quem usa): cada ataque escrito como teste.
//   1. A volta do e-mail (confirmação e senha nova) só para uma origem do próprio Instituto, mesmo com o Origin forjado.
//   2. A busca de fora (prévia de link, link do perfil, Fediverso) com prazo total e sem corpo cortado no meio.
//   3. O proxy das imagens do Commons não segue redirecionamento e para de ler no limite.
//   4. Os cabeçalhos: na Alumia e nas conversas, nenhum link manda o endereço de onde se veio (Referrer-Policy: no-referrer), e
//      o aparelho só empresta câmera e microfone ao próprio endereço (Permissions-Policy fechada).
//   5. O áudio do post: o servidor tira o metadado de um .m4a (o lugar da gravação) antes de guardar.
//   6. O arquivo de fonte do Vale o Escrito: quem não é da curadoria não gasta o freio da instância.
// Sem rede de fora e sem banco: os servidores de mentira rodam em 127.0.0.1, só durante o teste.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-r1-web.mjs
import fs from "node:fs";
import http from "node:http";
import { origensDeVolta, voltaDaMesmaOrigem } from "../lib/rede/convites/porta-sem-teto.ts";
import { buscarSeguro } from "../lib/rede/publicar/buscar-seguro.ts";
import { pedirAoFediverso } from "../lib/rede/fediverso/http.ts";

let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);
};
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ═══════════════════ 1. A volta do e-mail ═══════════════════
{
  const pedido = (origem) => new Request("https://institutolucia.org/api/alumia/porta/aviso", { method: "POST", headers: origem ? { origin: origem } : {} });
  const producao = origensDeVolta({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://institutolucia.org" });
  ok("produção: o site está na lista", producao.has("https://institutolucia.org"));
  ok("produção: alumia., escola. e conversas. estão na lista", ["alumia", "escola", "conversas"].every((s) => producao.has(`https://${s}.institutolucia.org`)));
  ok("produção: http fica de fora", ![...producao].some((o) => o.startsWith("http:")));
  const v = (origem, volta, origens = producao) => voltaDaMesmaOrigem(pedido(origem), volta, origens);
  igual("a volta da própria Alumia vale", v("https://alumia.institutolucia.org", "https://alumia.institutolucia.org/pt"), "https://alumia.institutolucia.org/pt");
  // O ataque: um robô (fora do navegador) escolhe o Origin e pede a senha nova de outra pessoa com a volta para o site dele.
  igual("Origin forjado com a volta para fora: recusada", v("https://atacante.example", "https://atacante.example/pegar"), null);
  igual("subdomínio parecido: recusado", v("https://alumia.institutolucia.org.atacante.example", "https://alumia.institutolucia.org.atacante.example/"), null);
  igual("origem certa, volta de outra origem: recusada", v("https://institutolucia.org", "https://atacante.example/"), null);
  igual("usuário e senha no endereço: recusado", v("https://institutolucia.org", "https://x:y@institutolucia.org/pt"), null);
  igual("sem Origin: sem volta", v(null, "https://institutolucia.org/pt"), null);
  igual("javascript: não é volta", v("https://institutolucia.org", "javascript:alert(1)"), null);
  const comEnderecos = origensDeVolta({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://institutolucia.org", NEXT_PUBLIC_ALUMIA_URL: "https://alumia.exemplo.org", NEXT_PUBLIC_CHAT_ONION: `${"a".repeat(56)}.onion` });
  ok("o endereço próprio da Alumia entra na lista", comEnderecos.has("https://alumia.exemplo.org"));
  ok("o .onion do chat entra na lista", comEnderecos.has(`http://${"a".repeat(56)}.onion`));
  const local = origensDeVolta({ NODE_ENV: "development" });
  ok("em desenvolvimento, localhost e alumia.localhost valem", local.has("http://localhost:3000") && local.has("http://alumia.localhost:3000"));
}

// ═══════════════════ 2. A busca de fora com prazo total (o site que pinga um byte de cada vez) ═══════════════════
{
  const servidor = http.createServer((pedido, resposta) => {
    if (pedido.url === "/cortado") {
      // Promete 1000 bytes, manda 10 e derruba a conexão.
      resposta.writeHead(200, { "Content-Type": "image/png", "Content-Length": "1000" });
      resposta.write("0123456789");
      setTimeout(() => resposta.socket?.destroy(), 50);
      return;
    }
    if (pedido.url === "/inteiro") {
      resposta.writeHead(200, { "Content-Type": "text/html" });
      resposta.end("<html><head><title>ok</title></head></html>");
      return;
    }
    // Um byte a cada 100 ms, para sempre: o tempo de silêncio nunca vence.
    resposta.writeHead(200, { "Content-Type": "text/html" });
    const vez = setInterval(() => resposta.write("a"), 100);
    resposta.on("close", () => clearInterval(vez));
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  const porta = servidor.address().port;
  const limite = (promessa, ms) => Promise.race([promessa, new Promise((r) => setTimeout(() => r("travou"), ms))]);
  const aberto = { ipAceito: () => true, resolver: async () => ["127.0.0.1"], qualquerPorta: true };

  let inicio = Date.now();
  const pingado = await limite(buscarSeguro(`http://teste.exemplo:${porta}/pinga`, { ...aberto, tempoMs: 400 }), 5000);
  igual("prévia de link: o site que pinga um byte por vez é cortado pelo prazo total", pingado, null);
  ok("prévia de link: cortado em menos de 3 s", Date.now() - inicio < 3000);
  igual("prévia de link: corpo cortado no meio não vale", await limite(buscarSeguro(`http://teste.exemplo:${porta}/cortado`, { ...aberto, tempoMs: 1000 }), 5000), null);
  const inteiro = await limite(buscarSeguro(`http://teste.exemplo:${porta}/inteiro`, { ...aberto, tempoMs: 1000 }), 5000);
  ok("prévia de link: a página inteira continua chegando", inteiro && inteiro !== "travou" && new TextDecoder().decode(inteiro.corpo).includes("<title>ok</title>"));

  const fed = { teste: { ipAceito: () => true, resolver: async () => ["127.0.0.1"] } };
  inicio = Date.now();
  igual("Fediverso: a instância que pinga um byte por vez é cortada pelo prazo total", await limite(pedirAoFediverso(`http://teste.exemplo:${porta}/pinga`, { ...fed, tempoMs: 400 }), 5000), null);
  ok("Fediverso: cortada em menos de 3 s", Date.now() - inicio < 3000);
  igual("Fediverso: corpo cortado no meio não vale", await limite(pedirAoFediverso(`http://teste.exemplo:${porta}/cortado`, { ...fed, tempoMs: 1000, binario: true }), 5000), null);
  const fedInteiro = await limite(pedirAoFediverso(`http://teste.exemplo:${porta}/inteiro`, { ...fed, tempoMs: 1000 }), 5000);
  ok("Fediverso: a resposta inteira continua chegando", fedInteiro && fedInteiro !== "travou" && fedInteiro.status === 200 && fedInteiro.texto.includes("ok"));
  servidor.closeAllConnections?.();
  servidor.close();
}

// ═══════════════════ 3. O proxy das imagens do Commons (/api/imagem) ═══════════════════
{
  const fetchOriginal = globalThis.fetch;
  let imagem = null;
  const pedidos = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    pedidos.push({ u, redirect: init.redirect, cache: init.cache, next: init.next });
    if (u.startsWith("https://commons.wikimedia.org/")) {
      return new Response(JSON.stringify({ query: { pages: { 1: { imageinfo: [{ thumburl: "https://upload.wikimedia.org/x/foto.jpg" }] } } } }), { headers: { "Content-Type": "application/json" } });
    }
    return imagem();
  };
  const { GET } = await import("../app/api/imagem/route.ts");
  const pedir = () => GET(new Request("https://institutolucia.org/api/imagem?arquivo=foto.jpg&largura=400"));
  try {
    // Sem Content-Length e com 40 MB que chegam aos poucos: a leitura para logo depois do limite de 8 MB.
    let lidos = 0;
    imagem = () => new Response(new ReadableStream({
      pull(c) {
        if (lidos >= 40 * 1024 * 1024) return c.close();
        lidos += 1024 * 1024;
        c.enqueue(new Uint8Array(1024 * 1024));
      },
    }), { headers: { "Content-Type": "image/jpeg" } });
    igual("imagem maior que 8 MB, sem tamanho declarado: recusada", (await pedir()).status, 413);
    ok("a leitura parou perto do limite (não baixou os 40 MB)", lidos <= 12 * 1024 * 1024);
    imagem = () => new Response("", { status: 302, headers: { Location: "http://169.254.169.254/latest/meta-data/" } });
    igual("redirecionamento para fora do Commons: não segue", (await pedir()).status, 404);
    ok("a busca da imagem pede para não seguir redirecionamento", pedidos.some((p) => p.u.startsWith("https://upload.wikimedia.org/") && p.redirect === "manual"));
    // O cache de dados do Next (next.revalidate) lê o corpo inteiro numa cópia, passando por cima do limite: a imagem vai sem ele.
    ok("a busca da imagem vai sem o cache de dados do Next (cache: no-store, sem next.revalidate)", pedidos.filter((p) => p.u.startsWith("https://upload.wikimedia.org/")).every((p) => p.cache === "no-store" && p.next === undefined));
    imagem = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
    const certa = await pedir();
    igual("a imagem pequena continua chegando", [certa.status, (await certa.arrayBuffer()).byteLength], [200, 6]);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

// ═══════════════════ 4. Os cabeçalhos da Alumia e das conversas ═══════════════════
{
  const config = (await import("../next.config.ts")).default;
  const regras = await config.headers();
  const geral = regras.findIndex((r) => r.headers.some((h) => h.key === "Referrer-Policy" && h.value === "strict-origin-when-cross-origin") && r.source.startsWith("/((?!workers/"));
  const daAlumia = regras.map((r, i) => ({ r, i })).filter(({ r }) => r.headers.some((h) => h.key === "Content-Security-Policy") && (r.source.includes("/alumia/") || r.has?.some((x) => String(x.value).startsWith("alumia"))));
  igual("as duas regras da Alumia (caminho e endereço próprio) existem", daAlumia.length, 2);
  ok("as regras da Alumia mandam Referrer-Policy: no-referrer", daAlumia.every(({ r }) => r.headers.some((h) => h.key === "Referrer-Policy" && h.value === "no-referrer")));
  ok("e vêm depois da regra geral (a última vale)", geral >= 0 && daAlumia.every(({ i }) => i > geral));
  const proxy = fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  const blocoDoChat = proxy.slice(proxy.indexOf("const politica = politicaDoChat("), proxy.indexOf("return resposta;", proxy.indexOf("const politica = politicaDoChat(")));
  ok("o proxy manda Referrer-Policy: no-referrer nas conversas (e no .onion)", blocoDoChat.includes('resposta.headers.set("Referrer-Policy", "no-referrer")'));
  // A Permissions-Policy das telas da Alumia: só câmera e microfone do próprio endereço; nada de localização nem de quadro de fora.
  const permissoes = (r) => r.headers.find((h) => h.key === "Permissions-Policy")?.value ?? "";
  const fechada = (v) => /(^|, )geolocation=\(\)/.test(v) && /camera=\(self\)(,|$)/.test(v) && /microphone=\(self\)(,|$)/.test(v) && /display-capture=\(\)/.test(v) && !/https?:\/\//.test(v);
  ok("as telas da Alumia têm a Permissions-Policy fechada (sem servidor de fora)", daAlumia.every(({ r }) => fechada(permissoes(r))));
  const doChat = /const PERMISSOES_DO_CHAT =\s*"([^"]+)"/.exec(proxy)?.[1] ?? "";
  ok("as conversas também", fechada(doChat) && blocoDoChat.includes('resposta.headers.set("Permissions-Policy", PERMISSOES_DO_CHAT)'));
}

// ═══════════════════ 5. O áudio do post sem metadado (/api/rede/midia) ═══════════════════
{
  const caixa = (tipo, ...filhas) => {
    const corpo = filhas.reduce((a, f) => new Uint8Array([...a, ...f]), new Uint8Array());
    const b = new Uint8Array(8 + corpo.length);
    new DataView(b.buffer).setUint32(0, b.length);
    b.set([...tipo].map((c) => c.charCodeAt(0)), 4); // o tipo da caixa: 4 bytes (o © é um byte só, 0xA9)
    b.set(corpo, 8);
    return b;
  };
  const bytes = (n, v = 0) => new Uint8Array(n).fill(v);
  const texto = (t) => new TextEncoder().encode(t);
  // Um .m4a como o do gravador do celular, com o lugar da gravação (©xyz) dentro de "udta".
  const LUGAR = "+12.3456-045.6789/";
  const m4a = new Uint8Array([
    ...caixa("ftyp", texto("M4A "), bytes(4), texto("M4A isom")),
    ...caixa("moov",
      caixa("mvhd", new Uint8Array([0, 0, 0, 0]), bytes(8, 7), bytes(88)),
      caixa("trak", caixa("mdia", caixa("hdlr", bytes(8), texto("soun"), bytes(12)))),
      caixa("udta", caixa("©xyz", bytes(4), texto(LUGAR)))),
    ...caixa("mdat", bytes(64, 9)),
  ]);
  const temLugar = (b) => new TextDecoder("latin1").decode(b).includes(LUGAR);
  ok("o .m4a de teste leva o lugar da gravação", temLugar(m4a));

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contas.duble";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-de-teste";
  const fetchOriginal = globalThis.fetch;
  let guardado = null;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith("/rest/v1/rpc/rede_pub_midia_reservar")) return Response.json({ id: "x", caminho: "00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111.m4a" });
    if (u.includes("/storage/v1/object/rede-midia/")) {
      guardado = new Uint8Array(init.body);
      return Response.json({ Key: "ok" });
    }
    return new Response("{}", { status: 404 });
  };
  try {
    const { POST } = await import("../app/api/rede/midia/route.ts");
    const token = "a".repeat(40);
    const r = await POST(new Request("https://alumia.institutolucia.org/api/rede/midia", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: m4a }));
    igual("o áudio é aceito", r.status, 200);
    ok("o arquivo guardado não leva o lugar da gravação", guardado !== null && !temLugar(guardado));
    ok("o arquivo guardado tem o mesmo tamanho (nenhum deslocamento muda)", guardado !== null && guardado.length === m4a.length);
    // Um "áudio" com faixa de texto (legenda, metadado com tempo) é recusado.
    const comTexto = new Uint8Array([
      ...caixa("ftyp", texto("M4A "), bytes(4), texto("M4A isom")),
      ...caixa("moov", caixa("trak", caixa("mdia", caixa("hdlr", bytes(8), texto("text"), bytes(12))))),
      ...caixa("mdat", bytes(16)),
    ]);
    guardado = null;
    const r2 = await POST(new Request("https://alumia.institutolucia.org/api/rede/midia", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: comTexto }));
    igual("faixa que não é de som: recusada, nada guardado", [r2.status, guardado], [415, null]);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

// ═══════════════════ 6. O freio do arquivo de fontes (/api/vale-o-escrito/arquivar) ═══════════════════
{
  const fetchOriginal = globalThis.fetch;
  const TOKEN_DA_CURADORIA = "token-da-curadoria-0123456789";
  let arquivou = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith("/rest/v1/rpc/vale_arquivo_pedir")) {
      return String(init.headers?.Authorization) === `Bearer ${TOKEN_DA_CURADORIA}` ? Response.json(true) : Response.json({ message: "sem_permissao" }, { status: 403 });
    }
    if (u.startsWith("https://web.archive.org/")) {
      arquivou++;
      return new Response("", { status: 200, headers: { "Content-Location": "/web/20261117120000/https://exemplo.org/fonte" } });
    }
    return new Response("{}", { status: 404 });
  };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contas.duble";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
    const { POST } = await import("../app/api/vale-o-escrito/arquivar/route.ts");
    const pedir = (token) => POST(new Request("https://institutolucia.org/api/vale-o-escrito/arquivar", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://exemplo.org/fonte" }) }));
    const recusados = [];
    for (let i = 0; i < 35; i++) recusados.push((await pedir("token-de-quem-nao-e-da-curadoria")).status);
    ok("sem papel: 403 em todos (nenhum 429)", recusados.every((s) => s === 403));
    const r = await pedir(TOKEN_DA_CURADORIA);
    ok("a curadoria continua arquivando depois do ataque", r.status !== 429 && arquivou === 1);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ testar-r1-web: ${certos} conferências certas.`);
