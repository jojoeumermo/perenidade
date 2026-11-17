// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a conferência dos links da Alumia no Google Safe Browsing (onda 11, 11F): lib/rede/links-conferidos/safe-browsing.ts e
// o miolo da rota /api/rede/links (lib/rede/links-conferidos/rota.ts), com um DUBLÊ do Google (nada sai para a rede). Prova:
//   - a regra pública de arrumar o link (os exemplos da referência do Safe Browsing) e as expressões que viram resumo;
//   - ao Google vão só prefixos de 4 bytes e a chave: nem o link, nem o nome do lugar, nem o caminho;
//   - quem decide é o resumo COMPLETO, comparado aqui: um prefixo igual com resumo diferente não bloqueia;
//   - CANARY e FRAME_ONLY não bloqueiam; a resposta fica na memória pelo tempo que o Google diz; sem chave, nada sai;
//     falha do Google não bloqueia (conferido: false);
//   - a rota: sem sessão 401, quem não pode publicar 403, corpo torto 400, mais de 10 links 400, teto por minuto 429, e
//     nunca devolve nada além dos próprios links;
//   - os textos (aviso, bloqueio, política e "o que guardamos") nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-links.mjs
import { createHash } from "node:crypto";
import fs from "node:fs";
import { domainToASCII } from "node:url";
import * as S from "../lib/rede/links-conferidos/safe-browsing.ts";
import * as R from "../lib/rede/links-conferidos/rota.ts";
import { fraseDoBloqueio } from "../lib/rede/links-conferidos/textos.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═══════════════════ A regra de arrumar o link (exemplos da referência) ═══════════════════
const CASOS = [
  ["http://host/%25%32%35", "http://host/%25"],
  ["http://host/%25%32%35%25%32%35", "http://host/%25%25"],
  ["http://host/%2525252525252525", "http://host/%25"],
  ["http://host/asdf%25%32%35asd", "http://host/asdf%25asd"],
  ["http://host/%%%25%32%35asd%%", "http://host/%25%25%25asd%25%25"],
  ["http://www.google.com/", "http://www.google.com/"],
  ["http://%31%36%38%2e%31%38%38%2e%39%39%2e%32%36/%2E%73%65%63%75%72%65/%77%77%77%2E%65%62%61%79%2E%63%6F%6D/", "http://168.188.99.26/.secure/www.ebay.com/"],
  ["http://195.127.0.11/uploads/%20%20%20%20/.verify/.eBaysecure=updateuserdataxplimnbqmn-xplmvalidateinfoswqpcmlx=hgplmcx/", "http://195.127.0.11/uploads/%20%20%20%20/.verify/.eBaysecure=updateuserdataxplimnbqmn-xplmvalidateinfoswqpcmlx=hgplmcx/"],
  ["http://host%23.com/%257Ea%2521b%2540c%2523d%2524e%25f%255E00%252611%252A22%252833%252944_55%252B", "http://host%23.com/~a!b@c%23d$e%25f^00&11*22(33)44_55+"],
  ["http://3279880203/blah", "http://195.127.0.11/blah"],
  ["http://www.google.com/blah/..", "http://www.google.com/"],
  ["www.google.com/", "http://www.google.com/"],
  ["www.google.com", "http://www.google.com/"],
  ["http://www.evil.com/blah#frag", "http://www.evil.com/blah"],
  ["http://www.GOOgle.com/", "http://www.google.com/"],
  ["http://www.google.com.../", "http://www.google.com/"],
  ["http://www.google.com/foo\tbar\rbaz\n2", "http://www.google.com/foobarbaz2"],
  ["http://www.google.com/q?", "http://www.google.com/q?"],
  ["http://www.google.com/q?r?", "http://www.google.com/q?r?"],
  ["http://www.google.com/q?r?s", "http://www.google.com/q?r?s"],
  ["http://evil.com/foo#bar#baz", "http://evil.com/foo"],
  ["http://evil.com/foo;", "http://evil.com/foo;"],
  ["http://evil.com/foo?bar;", "http://evil.com/foo?bar;"],
  ["http://\x01\x80.com/", "http://%01%80.com/"],
  ["http://notrailingslash.com", "http://notrailingslash.com/"],
  ["http://www.gotaport.com:1234/", "http://www.gotaport.com/"],
  ["  http://www.google.com/  ", "http://www.google.com/"],
  ["http:// leadingspace.com/", "http://%20leadingspace.com/"],
  ["http://%20leadingspace.com/", "http://%20leadingspace.com/"],
  ["%20leadingspace.com/", "http://%20leadingspace.com/"],
  ["https://www.securesite.com/", "https://www.securesite.com/"],
  ["http://host.com/ab%23cd", "http://host.com/ab%23cd"],
  ["http://host.com//twoslashes?more//slashes", "http://host.com/twoslashes?more//slashes"],
];
for (const [entrada, saida] of CASOS) {
  await espera(`arrumar ${JSON.stringify(entrada).slice(0, 60)}`, async () => S.canonizar(entrada), (r) => r === saida);
}
await espera("link que não é da web não entra", async () => [S.canonizar("javascript:alert(1)"), S.canonizar("ftp://x.org/a"), S.canonizar("mailto:a@b.c")], (r) => r.every((x) => x === null));
await espera("nome de outro alfabeto vira punycode", async () => [S.canonizar("http://ünïcode.example/"), S.canonizar("http://%C3%BCn%C3%AFcode.example/")],
  ([a, b]) => a === `http://${domainToASCII("ünïcode.example")}/` && a.startsWith("http://xn--") && a === b);

// ═══════════════════ As expressões (exemplos da referência) ═══════════════════
await espera("expressões de a.b.c/1/2.html?param=1", async () => S.expressoes("http://a.b.c/1/2.html?param=1").sort(),
  (r) => igual(r, ["a.b.c/1/2.html?param=1", "a.b.c/1/2.html", "a.b.c/", "a.b.c/1/", "b.c/1/2.html?param=1", "b.c/1/2.html", "b.c/", "b.c/1/"].sort()));
await espera("expressões de a.b.c.d.e.f.g/1.html (só os 5 últimos pedaços)", async () => S.expressoes("http://a.b.c.d.e.f.g/1.html").sort(),
  (r) => igual(r, ["a.b.c.d.e.f.g/1.html", "a.b.c.d.e.f.g/", "c.d.e.f.g/1.html", "c.d.e.f.g/", "d.e.f.g/1.html", "d.e.f.g/", "e.f.g/1.html", "e.f.g/", "f.g/1.html", "f.g/"].sort()));
await espera("expressões de 1.2.3.4/1/ (endereço numérico não tira pedaço)", async () => S.expressoes("http://1.2.3.4/1/").sort(), (r) => igual(r, ["1.2.3.4/1/", "1.2.3.4/"].sort()));
await espera("no máximo 30 expressões", async () => S.expressoes(S.canonizar("http://a.b.c.d.e.f.g.h/1/2/3/4/5/6/7.html?x=1")).length, (n) => n <= 30 && n > 20);
await espera("o resumo é o SHA-256 da expressão", async () => S.resumo("abc").toString("hex"), (h) => h === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

// ═══════════════════ O dublê do Google ═══════════════════
const sha = (x) => createHash("sha256").update(Buffer.from(x, "latin1")).digest();
const PERIGOSOS = new Map([
  ["golpe.example/", [{ threatType: "SOCIAL_ENGINEERING" }]],
  ["virus.example/baixe/", [{ threatType: "MALWARE" }]],
  ["canario.example/", [{ threatType: "MALWARE", attributes: ["CANARY"] }]],
  ["quadro.example/", [{ threatType: "MALWARE", attributes: ["FRAME_ONLY"] }]],
]);
const pedidosAoGoogle = [];
let googleFalha = false;
const dubleDoGoogle = async (url) => {
  pedidosAoGoogle.push(url);
  if (googleFalha) return { ok: false, json: async () => ({}) };
  const u = new URL(url);
  const prefixos = u.searchParams.getAll("hashPrefixes");
  const fullHashes = [];
  for (const [expr, detalhes] of PERIGOSOS) {
    const h = sha(expr);
    if (prefixos.includes(h.subarray(0, 4).toString("base64"))) fullHashes.push({ fullHash: h.toString("base64"), fullHashDetails: detalhes });
  }
  // Ruído: para cada prefixo pedido, um resumo completo DIFERENTE com o mesmo começo (outra página perigosa qualquer).
  for (const p of prefixos) {
    const falso = Buffer.concat([Buffer.from(p, "base64"), Buffer.alloc(28, 7)]);
    fullHashes.push({ fullHash: falso.toString("base64"), fullHashDetails: [{ threatType: "MALWARE" }] });
  }
  return { ok: true, json: async () => ({ fullHashes, cacheDuration: "300s" }) };
};
const CHAVE = "chave-de-teste";
const conferir = (links, agora) => S.conferirLinks(links, CHAVE, dubleDoGoogle, agora);

await espera("sem chave, nada sai e nada bloqueia", async () => {
  const r = await S.conferirLinks(["https://golpe.example/entrar"], undefined, dubleDoGoogle);
  return [r, pedidosAoGoogle.length];
}, ([r, n]) => r.conferido === false && r.perigosos.length === 0 && n === 0);
let primeira;
await espera("link de golpe é achado (pelo nome do lugar, mesmo com caminho e consulta)", async () => (primeira = await conferir(["https://Golpe.example/entrar?conta=1#x", "https://www.institutolucia.org/alumia"])),
  (r) => r.conferido && igual(r.perigosos, [{ link: "https://Golpe.example/entrar?conta=1#x", tipos: ["SOCIAL_ENGINEERING"] }]));
await espera("ao Google vai só a chave e os prefixos de 4 bytes: nada do link", async () => {
  const u = new URL(pedidosAoGoogle.at(-1));
  const nomes = [...new Set([...u.searchParams.keys()])].sort();
  const prefixos = u.searchParams.getAll("hashPrefixes");
  const tudo = decodeURIComponent(pedidosAoGoogle.at(-1)).toLowerCase();
  return { nomes, tamanhos: [...new Set(prefixos.map((p) => Buffer.from(p, "base64").length))], vaza: ["golpe", "entrar", "conta", "institutolucia", "alumia"].filter((x) => tudo.includes(x)), host: u.host, quantos: prefixos.length };
}, (r) => igual(r.nomes, ["hashPrefixes", "key"]) && igual(r.tamanhos, [4]) && r.vaza.length === 0 && r.host === "safebrowsing.googleapis.com" && r.quantos <= 60);
await espera("o caminho perigoso dentro de um lugar comum é achado pelo começo do caminho", async () => (await conferir(["http://virus.example/baixe/agora.exe"])).perigosos.map((p) => p.tipos), (t) => igual(t, [["MALWARE"]]));
await espera("o mesmo lugar, fora do caminho perigoso, passa", async () => (await conferir(["http://virus.example/sobre"])).perigosos, (p) => p.length === 0);
await espera("prefixo igual com resumo diferente NÃO bloqueia (a comparação é do resumo completo)", async () => (await conferir(["https://www.institutolucia.org/"])).perigosos, (p) => p.length === 0);
await espera("CANARY e FRAME_ONLY não bloqueiam", async () => (await conferir(["https://canario.example/", "https://quadro.example/"])).perigosos, (p) => p.length === 0);
await espera("a resposta fica na memória: o mesmo link de novo não vai ao Google", async () => {
  const antes = pedidosAoGoogle.length;
  const r = await conferir(["https://golpe.example/entrar?conta=1"]);
  return [pedidosAoGoogle.length - antes, r.perigosos.length];
}, ([n, p]) => n === 0 && p === 1);
await espera("passado o tempo que o Google deu, pergunta de novo", async () => {
  const antes = pedidosAoGoogle.length;
  await conferir(["https://golpe.example/entrar?conta=1"], Date.now() + 301_000);
  return pedidosAoGoogle.length - antes;
}, (n) => n === 1);
await espera("Google fora do ar: não bloqueia (conferido: false)", async () => {
  S.memoriaDoGoogle.clear();
  googleFalha = true;
  const r = await conferir(["https://golpe.example/"]);
  googleFalha = false;
  return r;
}, (r) => r.conferido === false && r.perigosos.length === 0);
await espera("no máximo 10 links por post", async () => {
  S.memoriaDoGoogle.clear();
  const links = Array.from({ length: 15 }, (_, i) => `https://site${i}.example/`);
  await conferir(links);
  const u = new URL(pedidosAoGoogle.at(-1));
  return u.searchParams.getAll("hashPrefixes").length;
}, (n) => n <= 10 * 2);
void primeira;

// ═══════════════════ A rota ═══════════════════
const pedido = (corpo, extra = {}) => new Request("http://local/api/rede/links", { method: "POST", headers: { "content-type": "application/json", ...extra }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
const deps = (mais = {}) => ({ chave: CHAVE, token: "t".repeat(40), podePublicar: async () => true, buscar: dubleDoGoogle, ...mais });
const json = async (r) => [r.status, await r.json()];
await espera("GET diz se está ligada, sem dizer a chave", async () => [await json(R.estadoDaConferencia(CHAVE)), await json(R.estadoDaConferencia(undefined))],
  ([a, b]) => igual(a, [200, { ligado: true }]) && igual(b, [200, { ligado: false }]));
await espera("sem sessão: 401", async () => json(await R.conferirPedido(pedido({ links: [] }), deps({ token: null }))), ([s]) => s === 401);
await espera("quem não pode publicar: 403 (não é verificador aberto)", async () => json(await R.conferirPedido(pedido({ links: ["https://golpe.example/"] }), deps({ podePublicar: async () => false }))), ([s]) => s === 403);
await espera("corpo torto: 400", async () => json(await R.conferirPedido(pedido("{nada"), deps())), ([s]) => s === 400);
await espera("mais de 10 links: 400", async () => json(await R.conferirPedido(pedido({ links: Array.from({ length: 11 }, (_, i) => `https://a${i}.example/`) }), deps())), ([s]) => s === 400);
await espera("o texto do post não é aceito no lugar dos links", async () => json(await R.conferirPedido(pedido({ texto: "um post inteiro" }), deps())), ([s]) => s === 400);
R.zerarTeto();
await espera("o caminho bom: devolve só os links perigosos que vieram", async () => json(await R.conferirPedido(pedido({ links: ["https://golpe.example/x", "https://bom.example/"] }), deps())),
  ([s, c]) => s === 200 && c.conferido === true && igual(c.perigosos.map((p) => p.link), ["https://golpe.example/x"]) && igual(Object.keys(c).sort(), ["conferido", "perigosos"]));
await espera("sem a chave no servidor: 200 com conferido false", async () => json(await R.conferirPedido(pedido({ links: ["https://golpe.example/x"] }), deps({ chave: undefined, token: "u".repeat(40) }))),
  ([s, c]) => s === 200 && c.conferido === false);
{
  const jwt = (sub, n) => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub, n })).toString("base64url")}.assinatura${n}`;
  const sub = "8b6f0a5e-1111-4222-8333-944445555666";
  ok("o teto é da conta (o sub do token), não do token: renovar a sessão não zera", R.contaDoToken(jwt(sub, 1)) === sub && R.contaDoToken(jwt(sub, 2)) === sub && R.contaDoToken("t".repeat(40)) === null);
  R.zerarTeto();
  let ultimo = 0;
  for (let i = 0; i <= R.TETO_POR_MINUTO; i++) ultimo = (await R.conferirPedido(pedido({ links: ["https://bom.example/"] }), deps({ token: jwt(sub, i) }))).status;
  ok("com um token novo a cada pedido, a mesma conta bate no teto", ultimo === 429);
  R.zerarTeto();
}
const leitor = ler("lib/rede/links-conferidos/leitor.ts");
const linkDoLeitor = ler("components/rede/protecao/LinkDoLeitor.tsx");
ok("quem lê também confere: o link de fora do texto formatado e o da prévia passam pelo LinkDoLeitor",
  /<LinkDoLeitor /.test(ler("components/rede/texto/TextoFormatado.tsx")) && /<LinkDoLeitor /.test(ler("components/rede/publicar/Complementos.tsx")));
ok("o leitor junta os links num pedido só (até 10) e guarda a resposta só na memória da página",
  /conferirNoServidor\(parte/.test(leitor) && /i \+= 10/.test(leitor) && !/localStorage|sessionStorage|indexedDB/.test(leitor));
ok("o link perigoso sai sem clique, com a frase", /if \(barrado\)/.test(linkDoLeitor) && /t\.leitor/.test(linkDoLeitor) && !/<a [^>]*>[\s\S]*?\{frase\}/.test(linkDoLeitor));
await espera(`teto de ${R.TETO_POR_MINUTO} por minuto por pessoa: 429`, async () => {
  R.zerarTeto();
  let ultimo = 0;
  for (let i = 0; i <= R.TETO_POR_MINUTO; i++) ultimo = (await R.conferirPedido(pedido({ links: ["https://bom.example/"] }), deps({ token: "v".repeat(40) }))).status;
  return ultimo;
}, (s) => s === 429);
await espera("a rota não grava nem escreve registro (sem banco, sem console)", async () => {
  const fonte = ler("lib/rede/links-conferidos/rota.ts") + ler("lib/rede/links-conferidos/safe-browsing.ts") + ler("app/api/rede/links/route.ts");
  // A única chamada ao banco é a de leitura que confere se a pessoa pode publicar (rede_pub_pode_enviar).
  return [/console\.|writeFile|appendFile|insert into|\brpc\(|localStorage/i.test(fonte), (fonte.match(/chamarComoPessoa</g) ?? []).length];
}, ([grava, chamadas]) => grava === false && chamadas === 1);

// ═══════════════════ Os textos ═══════════════════
const LINGUAS = ["pt", "en", "es", "fr", "ru", "zh"];
const chaves = (v, pre = "", saida = new Map()) => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) chaves(x, pre ? `${pre}.${k}` : k, saida);
  } else saida.set(pre, typeof v === "string" && v.trim() ? (v.match(/\{\w+\}/g) ?? []).sort().join() : "vazio");
  return saida;
};
const pt = chaves(JSON.parse(ler("i18n/rede/links/pt.json")));
for (const l of LINGUAS.slice(1)) {
  await espera(`textos dos links: ${l} igual ao pt nas chaves e marcadores`, async () => {
    const o = chaves(JSON.parse(ler(`i18n/rede/links/${l}.json`)));
    return [...pt].filter(([k, v]) => o.get(k) !== v).concat([...o].filter(([k]) => !pt.has(k))).map(([k]) => k);
  }, (d) => d.length === 0);
}
for (const l of LINGUAS) {
  const t = JSON.parse(ler(`i18n/rede/links/${l}.json`));
  await espera(`bloqueio (${l}): diz o lugar e o tipo, e pede para tirar o link`, async () => [fraseDoBloqueio(t, [{ link: "https://golpe.example/a", tipos: ["SOCIAL_ENGINEERING"] }]), fraseDoBloqueio(t, [{ link: "https://a.example/", tipos: ["X"] }, { link: "https://b.example/", tipos: ["MALWARE"] }])],
    ([um, dois]) => um.includes("golpe.example") && um.includes(t.tipos.SOCIAL_ENGINEERING) && dois.includes("a.example, b.example") && !/\{/.test(um + dois));
  const lei = JSON.parse(ler(`i18n/rede/lei/${l}.json`));
  await espera(`política e "o que guardamos" (${l}) dizem que os links vão ao Google Safe Browsing e o que fica no aparelho`, async () => {
    const fora = lei.privacidade.secoes.find((s) => s.id === "fora").itens.join(" ");
    const guardamos = JSON.stringify(lei.guardamos);
    return [fora.includes("Google Safe Browsing"), guardamos.includes("Google Safe Browsing"), lei.guardamos.grupos[1].linhas.length, lei.guardamos.grupos[4].linhas[1].tempo];
  }, ([a, b, n, tempo]) => a && b && n === 8 && tempo === "—");
}
await espera("textos novos sem as palavras proibidas", async () => /diploma|universidade|algoritmo/i.test(LINGUAS.map((l) => ler(`i18n/rede/links/${l}.json`)).join("")), (x) => x === false);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHA ${f}`);
process.exit(falhas.length ? 1 : 0);
