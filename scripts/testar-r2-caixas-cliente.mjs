// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as caixas anônimas da R2 de ponta a ponta: o aparelho (lib/rede/caixas/*, lib/rede/passes/cliente.ts) → as rotas do site
// (app/api/alumia/{caixa,pedido,diretorio,passes,franquia}/*, chamadas direto, sem servidor) → um PostgREST de mentira na memória →
// o banco local (PGlite) com o install.sql e a migração 20261124-r2-caixas.sql. Os ataques estão escritos como teste:
//   - as rotas anônimas recusam cookie de sessão e Authorization de conta; o aparelho chama sem credenciais;
//   - passe anônimo: o lote de 30 com a sessão, uma vez por dia; o passe gasto duas vezes é recusado; passe adulterado, de outro
//     segredo ou de dia velho não vale; chave que não está no registro de transparência é recusada pelo aparelho;
//   - prova de trabalho fraca, de outro segredo, vencida ou repetida é recusada;
//   - depósito com passe errado e depósito depois do bloqueio respondem igual ao certo, e nada chega;
//   - a franquia: denúncia com prova entra na fila; trecho, conteúdo, marca, dia ou identidade trocados não entram;
//   - a vigia busca uma caixa por pedido e confirma; a cobertura deposita pacotes falsos do tamanho certo e respeita o teto de banda;
//   - os freios do bloqueio e dos pedidos no aparelho; os tamanhos do aparelho iguais aos do banco; os rótulos sem repetição;
//   - com o banco inteiro, nada liga passe, caixa ou pedido a conta.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-caixas-cliente.mjs   (npm run testar:r2-caixas-cliente, na junção)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor, (k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v))?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.code ?? erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.code ?? erro.message}"`);
  }
}

// O PostgREST de mentira sobe ANTES de importar os módulos do site (eles leem o endereço do banco ao carregar).
const SERVICO = "chave-de-servico-de-teste"; // gitleaks:allow (valor de teste)
const ANON = "chave-publica-de-teste"; // gitleaks:allow (valor de teste)
const servidorFalso = http.createServer(async (req, res) => {
  let corpo = "";
  for await (const pedaco of req) corpo += pedaco;
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/auth/v1/user") {
    if (bearer?.startsWith("conta.")) return res.end(JSON.stringify({ id: bearer.slice(6), email_confirmed_at: "2026-01-01" }));
    res.statusCode = 401;
    return res.end("{}");
  }
  const m = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(req.url ?? "");
  if (!m) {
    res.statusCode = 404;
    return res.end("{}");
  }
  try {
    const r = await rpcComo(bearer, m[1], corpo ? JSON.parse(corpo) : {});
    res.end(JSON.stringify(r));
  } catch (erro) {
    if (process.env.DEPURA) console.log("DEPURA", m[1], erro.message);
    res.statusCode = /permission denied/.test(erro.message) ? 401 : 400;
    res.end(JSON.stringify({ message: erro.message }));
  }
});
await new Promise((r) => servidorFalso.listen(0, "127.0.0.1", r));
const SUPA = `http://127.0.0.1:${servidorFalso.address().port}`;
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPA,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICO,
  ALUMIA_PASSES_SEGREDO: "segredo-dos-passes-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
  ALUMIA_FRANQUIA_SEGREDO: "segredo-da-franquia-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
});

// ═══════════════════ 0. O que não precisa de banco ═══════════════════
const MIGRACAO = ler("supabase/migracoes/20261124-r2-caixas.sql");
const base = await import("../lib/rede/caixas/base.ts");
const tamanhos = await import("../lib/rede/caixas/tamanhos.ts");
const prova = await import("../lib/rede/caixas/prova.ts");
const provaServ = await import("../lib/rede/caixas/prova-servidor.ts");
const franquia = await import("../lib/rede/caixas/franquia.ts");
const franquiaServ = await import("../lib/rede/caixas/franquia-servidor.ts");
const freios = await import("../lib/rede/caixas/freios.ts");
const rota = await import("../lib/rede/caixas/rota.ts");
const rotulos = await import("../lib/rede/cifra/rotulos.ts");

{
  const lista = /p_tamanho in \(([\d,\s]+)\)/.exec(MIGRACAO)?.[1].split(",").map((x) => Number(x.trim())).sort((a, b) => a - b);
  ok("os tamanhos do aparelho são os mesmos do banco (interno.caixa_tamanho_ok)", JSON.stringify(lista) === JSON.stringify([...tamanhos.TAMANHOS_ACEITOS]), `${lista} x ${tamanhos.TAMANHOS_ACEITOS}`);
  ok("o tamanho do pedido é o mesmo do banco (interno.caixa_tamanho_pedido)", new RegExp(`caixa_tamanho_pedido\\(\\)[^$]*\\$\\$\\s*select ${tamanhos.TAMANHO_PEDIDO}\\s`).test(MIGRACAO));
  ok("o pedido tem o tamanho de uma mensagem curta (não se distingue pelo tamanho)", tamanhos.TAMANHOS_DUPLA.includes(tamanhos.TAMANHO_PEDIDO));
}
{
  const r = (h) => new Request("http://alumia.test/x", { method: "POST", headers: h });
  ok("rota: cookie de sessão do Supabase é recusado", rota.trazSessao(r({ cookie: "a=1; sb-xyz-auth-token=abc" })));
  ok("rota: Authorization de conta (Bearer) é recusado", rota.trazSessao(r({ authorization: "Bearer abc.def.ghi" })));
  ok("rota: o passe anônimo (PrivateToken) passa", !rota.trazSessao(r({ authorization: 'PrivateToken token="abc"' })));
  ok("rota: sem nada, passa", !rota.trazSessao(r({})));
  ok("rota: cookie que só lembra sb- no meio do nome não é sessão", !rota.trazSessao(r({ cookie: "xsb-a=1" })));
}
{
  // O juntador de lotes: 64 itens saem na hora; menos que isso, depois da espera; dia novo solta o lote velho; lote perdido = "rede".
  const gravados = [];
  const j = rota.criarJuntador(async (itens, dia) => (gravados.push({ n: itens.length, dia }), itens.map(() => ({ ok: true }))), 50, 64, () => "2026-11-24");
  const promessas = Array.from({ length: 64 }, () => j.juntar({ acao: "depositar" }).resultado);
  await Promise.all(promessas);
  ok("lote: 64 itens saem juntos, num comando só", gravados.length === 1 && gravados[0].n === 64);
  const um = j.juntar({ acao: "depositar" });
  ok("lote: um item espera o lote", j.esperando === 1);
  await um.resultado;
  ok("lote: depois da espera, sai", gravados.length === 2 && gravados[1].n === 1);
  let dia = "2026-11-24";
  const k = rota.criarJuntador(async (itens, d) => (gravados.push({ n: itens.length, dia: d }), itens.map(() => ({ ok: true }))), 10_000, 64, () => dia);
  const a = k.juntar({ acao: "depositar" });
  dia = "2026-11-25";
  const b = k.juntar({ acao: "depositar" });
  await a.resultado;
  ok("lote: o dia mudou, o lote velho sai com o dia velho", gravados.at(-1).dia === "2026-11-24" && b.dia === "2026-11-25");
  const perdido = rota.criarJuntador(async () => null, 10, 64);
  ok("lote: o banco não gravou, todos ouvem 'rede'", (await perdido.juntar({ acao: "depositar" }).resultado).erro === "rede");
}
{
  // A prova de trabalho.
  const segredo = "s".repeat(40);
  const { desafio, bits } = provaServ.emitirDesafioDoPedido(segredo);
  ok("prova: o desafio tem 52 bytes e pede 20 bits", desafio.length === prova.TAMANHO_DO_DESAFIO && bits === 20);
  const nonce = await prova.resolverProva(desafio);
  ok("prova: a resposta confere", provaServ.conferirDesafioDoPedido(segredo, desafio, nonce) instanceof Uint8Array);
  ok("prova: de outro segredo, recusada", provaServ.conferirDesafioDoPedido("t".repeat(40), desafio, nonce) === null);
  ok("prova: vencida (11 minutos), recusada", provaServ.conferirDesafioDoPedido(segredo, desafio, nonce, Date.now() + 11 * 60_000) === null);
  ok("prova: do futuro, recusada", provaServ.conferirDesafioDoPedido(segredo, desafio, nonce, Date.now() - 2 * 60_000) === null);
  const fraco = new Uint8Array(8);
  let achou = null;
  for (let n = 0; n < 5000 && !achou; n++) {
    new DataView(fraco.buffer).setUint32(4, n);
    if (prova.zerosNoComeco(base.resumo("", base.juntar(desafio, fraco)), 0) && !prova.provaConfere(desafio, fraco)) achou = fraco;
  }
  ok("prova: resposta sem os bits zero, recusada", achou && provaServ.conferirDesafioDoPedido(segredo, desafio, achou) === null);
  const mexido = desafio.slice();
  mexido[3] ^= 1;
  ok("prova: desafio mexido (minuto trocado), recusado", provaServ.conferirDesafioDoPedido(segredo, mexido, nonce) === null);
}
{
  // A franquia, sem servidor.
  const segredo = "f".repeat(40);
  const kf = base.sortear(32), idH = base.sortear(32), conteudo = base.bytesDe("oi, isto é uma ameaça de verdade");
  const c = franquia.compromisso(kf, idH, conteudo);
  const dia = base.diaUtc();
  // A marca prende o resumo do passe de depósito apresentado (a conferência inteira, com a declaração de quem escreve, está em
  // scripts/testar-r2-franquia.mjs).
  const pdH = base.resumo(base.ROTULOS.passeDeposito, base.sortear(32));
  const t = franquiaServ.marcaDoServidor(segredo, c, idH, pdH, dia);
  ok("franquia: a marca é refeita igual", base.iguais(t, franquiaServ.marcaDoServidor(segredo, c, idH, pdH, dia)));
  ok("franquia: outro passe apresentado, outra marca", !base.iguais(t, franquiaServ.marcaDoServidor(segredo, c, idH, base.sortear(32), dia)));
  ok("franquia: outro segredo, outra marca", !base.iguais(t, franquiaServ.marcaDoServidor("g".repeat(40), c, idH, pdH, dia)));
  ok("franquia: outra caixa, outra marca", !base.iguais(t, franquiaServ.marcaDoServidor(segredo, c, base.sortear(32), pdH, dia)));
  ok("franquia: outro dia, outra marca", !base.iguais(t, franquiaServ.marcaDoServidor(segredo, c, idH, pdH, base.diaUtc(Date.now() - 86_400_000))));
  ok("franquia: o lado do servidor das caixas não tem conferência própria (só a da denúncia, com a declaração)", franquiaServ.conferirDenuncia === undefined);
}
{
  const H = 3_600_000;
  const agora = Date.now();
  ok("freio: 19 bloqueios na hora deixam o 20º", freios.podeBloquear(Array.from({ length: 19 }, (_, i) => agora - i * 1000), agora).pode);
  ok("freio: 20 bloqueios na hora barram o 21º", !freios.podeBloquear(Array.from({ length: 20 }, (_, i) => agora - i * 1000), agora).pode);
  ok("freio: os de mais de uma hora não contam", freios.podeBloquear(Array.from({ length: 30 }, () => agora - H - 1), agora).pode);
  ok("freio: desbloquear antes de 3 h, não", !freios.podeDesbloquear(agora - 3 * H + 1000, agora));
  ok("freio: desbloquear depois de 3 h, sim", freios.podeDesbloquear(agora - 3 * H, agora));
  ok("freio: bloqueio com relógio no futuro conta como agora", !freios.podeDesbloquear(agora + 10 * H, agora));
  const recusas = freios.anotarRecusa([], "idA", agora);
  ok("pedido: recusado não passa por 30 dias", !freios.pedidoPassa({ regra: "pedidos", identidade: "idA", eleSegue: false, recusas, agora: agora + 29 * 24 * H }));
  ok("pedido: depois de 30 dias, passa", freios.pedidoPassa({ regra: "pedidos", identidade: "idA", eleSegue: false, recusas, agora: agora + 30 * 24 * H + 1 }));
  ok("pedido: 'só quem eu sigo' barra quem não sigo", !freios.pedidoPassa({ regra: "seguidos", identidade: "idB", eleSegue: false, recusas: [], agora }));
  ok("pedido: 'ninguém' barra todo mundo", !freios.pedidoPassa({ regra: "ninguem", identidade: "idB", eleSegue: true, recusas: [], agora }));
}
{
  ok("rótulos: nenhum se repete", rotulos.rotulosRepetidos().length === 0, JSON.stringify(rotulos.rotulosRepetidos()));
  // A junção: as listas de TODAS as frentes da R2 entram na conferência (antes, só a das caixas).
  ok("rótulos: as listas das frentes da R2 estão todas juntas", ["caixas", "dupla", "cofres", "grupos", "membros", "voto"].every((f) => Object.keys(rotulos.LISTAS[f] ?? {}).length > 0), Object.keys(rotulos.LISTAS).join(","));
  ok("rótulos: as cópias de rótulos de outra frente são iguais ao original", rotulos.copiasDiferentes().length === 0, rotulos.copiasDiferentes().join(","));
  ok("rótulos: um repetido de propósito é achado", rotulos.rotulosRepetidos({ a: { x: "alumia/r2/caixa" }, b: { y: "alumia/r2/caixa" } }).length === 1);
  ok("rótulos: todos começam por alumia/r2/", Object.values(base.ROTULOS).every((r) => r.startsWith("alumia/r2/")));
  ok("rótulos: nenhum é começo de outro (fora o separador /)", rotulos.rotulosPrefixos().length === 0, JSON.stringify(rotulos.rotulosPrefixos()));
}
{
  // O código: sem Math.random, sem log, as rotas anônimas recusam sessão primeiro, o aparelho chama sem credenciais.
  const arquivos = (d) => fs.readdirSync(path.join(raiz, d), { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(d, f));
  const codigo = [...arquivos("lib/rede/caixas"), ...arquivos("lib/rede/passes"), ...["caixa", "pedido", "diretorio", "passes", "franquia"].flatMap((d) => arquivos(`app/api/alumia/${d}`))];
  const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("código: nada de Math.random", codigo.every((f) => !/Math\.random/.test(semComentario(ler(f)))), codigo.filter((f) => /Math\.random/.test(semComentario(ler(f)))).join(", "));
  ok("código: nada de console.* (nem corpo, nem endereço em log)", codigo.every((f) => !/console\./.test(ler(f))));
  ok("código: nada de endereço de rede no código", codigo.every((f) => !/x-forwarded-for|cf-connecting-ip|x-real-ip/i.test(ler(f))));
  const anonimas = codigo.filter((f) => /app[\\/]api[\\/]alumia[\\/](caixa|pedido|diretorio)[\\/]/.test(f) || /passes[\\/]chave/.test(f));
  ok(`rotas anônimas (${anonimas.length}): a primeira coisa é recusar sessão`, anonimas.length === 10 && anonimas.every((f) => /export async function (POST|GET)\(pedido: Request\) \{\s*if \(trazSessao\(pedido\)\) return recusaDeSessao\(\);/.test(ler(f))));
  const transporte = semComentario(ler("lib/rede/caixas/transporte.ts"));
  ok("aparelho: toda chamada sai sem credenciais e sem referência", (transporte.match(/(?:t|via)\.fetch\(/g) ?? []).length === 3 && (transporte.match(/credentials: "omit"/g) ?? []).length === 3 && (transporte.match(/referrerPolicy: "no-referrer"/g) ?? []).length === 3);
  ok("aparelho: só emitir passes e denunciar levam a sessão", ["lib/rede/caixas/cliente.ts", "lib/rede/caixas/pedidos.ts"].every((f) => !/postComSessao|tokenDaConta/.test(ler(f))));
}

// ═══════════════════ 1. O banco, o PostgREST de mentira e as rotas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
await banco.exclusivo(() => banco.pg.exec(MIGRACAO));
// Na ordem das migrações, a da denúncia com prova vem depois das caixas e troca a função da denúncia pela dela.
await banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261124-r2-franquia.sql")));
// R3: os passes passam a RSA cego (a chave da semana guardada selada no banco e anotada no registro como 'passes-rsa').
await banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261125-r3-servidor-chat.sql")));
const agoraS = () => Math.floor(Date.now() / 1000);
const sessoes = new Map();
/** Chama uma função como o PostgREST: o papel vem da chave (serviço, conta, visitante). */
const rpcComo = (bearer, funcao, argumentos) =>
  banco.exclusivo(async () => {
    let claims;
    if (bearer === SERVICO) claims = { role: "service_role" };
    else if (bearer?.startsWith("conta.")) claims = { role: "authenticated", sub: bearer.slice(6), aal: "aal2", session_id: sessoes.get(bearer.slice(6)), iat: agoraS() - 30, exp: agoraS() + 3600 };
    else claims = { role: "anon" };
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify(claims)]);
    await banco.pg.exec(`set role ${claims.role}`);
    try {
      const nomes = Object.keys(argumentos);
      // Como o PostgREST: bytea chega como "\x" + hexadecimal; jsonb, como objeto ou lista.
      const valores = nomes.map((n) => {
        const v = argumentos[n];
        if (typeof v === "string" && /^\\x[0-9a-f]*$/i.test(v)) return Buffer.from(v.slice(2), "hex");
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });
      return (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
// Um armazenamento local na memória (o do aparelho).
const guardado = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) },
});

// As rotas, chamadas direto (o fetch do aparelho vira a chamada da rota).
const ROTAS = {
  "/api/alumia/caixa/lote": await import("../app/api/alumia/caixa/lote/route.ts"),
  "/api/alumia/caixa/buscar": await import("../app/api/alumia/caixa/buscar/route.ts"),
  "/api/alumia/caixa/confirmar": await import("../app/api/alumia/caixa/confirmar/route.ts"),
  "/api/alumia/caixa/trocar": await import("../app/api/alumia/caixa/trocar/route.ts"),
  "/api/alumia/caixa/apagar": await import("../app/api/alumia/caixa/apagar/route.ts"),
  "/api/alumia/pedido": await import("../app/api/alumia/pedido/route.ts"),
  "/api/alumia/pedido/desafio": await import("../app/api/alumia/pedido/desafio/route.ts"),
  "/api/alumia/diretorio/ler": await import("../app/api/alumia/diretorio/ler/route.ts"),
  "/api/alumia/diretorio/reivindicar": await import("../app/api/alumia/diretorio/reivindicar/route.ts"),
  "/api/alumia/passes/chave": await import("../app/api/alumia/passes/chave/route.ts"),
  "/api/alumia/passes/emitir": await import("../app/api/alumia/passes/emitir/route.ts"),
  "/api/alumia/franquia/denunciar": await import("../app/api/alumia/franquia/denunciar/route.ts"),
};
const pedidosVistos = [];
let mexerNaResposta = null;
const fetchDoAparelho = async (url, init = {}) => {
  const caminho = String(url);
  const modulo = ROTAS[caminho];
  if (!modulo) throw new Error(`rota desconhecida ${caminho}`);
  pedidosVistos.push({ caminho, credenciais: init.credentials, autorizacao: new Headers(init.headers).get("authorization") ?? "" });
  const pedido = new Request(`http://alumia.test${caminho}`, init);
  const resposta = await modulo[init.method === "GET" ? "GET" : "POST"](pedido);
  return mexerNaResposta ? mexerNaResposta(caminho, resposta) : resposta;
};
const chamarRota = (caminho, corpo, cabecalhos = {}) =>
  ROTAS[caminho].POST(new Request(`http://alumia.test${caminho}`, { method: "POST", headers: { "content-type": "application/json", ...cabecalhos }, body: JSON.stringify(corpo) }));

const { configurarTransporte, transporte: transporteDoAparelho } = await import("../lib/rede/caixas/transporte.ts");
const transporteAtual = () => transporteDoAparelho().rpcComSessao;
let contaAtual = null;
configurarTransporte({
  fetch: fetchDoAparelho,
  base: "",
  tokenDaConta: async () => (contaAtual ? `conta.${contaAtual}` : null),
  rpcComSessao: async (funcao, argumentos) => {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, { method: "POST", headers: { Authorization: `Bearer ${contaAtual ? `conta.${contaAtual}` : ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(argumentos) });
    const corpo = await r.json();
    if (!r.ok) throw Object.assign(new Error(corpo.message), { code: corpo.message });
    return corpo;
  },
});
const cliente = await import("../lib/rede/caixas/cliente.ts");
const passes = await import("../lib/rede/passes/cliente.ts");
const diretorio = await import("../lib/rede/caixas/diretorio.ts");
const pedidos = await import("../lib/rede/caixas/pedidos.ts");
const agenda = await import("../lib/rede/caixas/agenda.ts");
const servPasses = await import("../lib/rede/passes/servidor.ts");

// As pessoas (aprovadas, com codinome).
const P = {};
for (const nome of ["ana", "bia", "caio"]) {
  P[nome] = await criarUsuario(`${nome}@r2c.local`, `Pessoa ${nome}`);
  sessoes.set(P[nome], crypto.randomUUID());
  await rpcComo(`conta.${P[nome]}`, "eu", {}).catch(() => undefined);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r2c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
// O Caio tem codinome, mas não aderiu à rede nem foi aprovado.
await dono("update interno.perfis set rede_codinome = 'Codinome caio', rede_codinome_ok = true, rede_handle = 'r2c_caio' where id = $1", [P.caio]);
await dono("select interno.alumia_entrada_ligar(true)");
await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada'), ($2, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P.ana, P.bia]);
// O Caio NÃO está aprovado.

// ═══════════════════ 2. Os passes ═══════════════════
contaAtual = P.caio;
await recusa("passes: conta não aprovada não pega o lote", () => passes.garantirPasses(), "entre_primeiro");
passes.apagarPasses();

// O servidor tenta dar ao aparelho uma chave que não é a do registro: o aparelho recusa antes de pedir.
pedidosVistos.length = 0;
contaAtual = P.ana;
const { publicVerif } = await import("@cloudflare/privacypass-ts");
const outraPublica = await publicVerif.getPublicKeyBytes((await publicVerif.Issuer.generateKey(publicVerif.BlindRSAMode.PSS, { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) })).publicKey);
mexerNaResposta = async (caminho, resposta) => {
  if (caminho !== "/api/alumia/passes/chave") return resposta;
  const corpo = await resposta.json();
  return Response.json({ ...corpo, publica: base.paraB64u(outraPublica) });
};
await recusa("passes: chave fora do registro de transparência é recusada pelo aparelho", () => passes.garantirPasses(), "chave_fora_do_registro");
mexerNaResposta = null;
ok("passes: e nada foi pedido com a sessão", !pedidosVistos.some((p) => p.caminho === "/api/alumia/passes/emitir"));

const antesDoLote = Date.now();
await espera("passes: a conta aprovada pega o lote de 30 (com a chave do registro)", () => passes.garantirPasses(), () => passes.passesGuardados() === 30);
const tempoDoLote = Date.now() - antesDoLote;
const emissao = pedidosVistos.find((p) => p.caminho === "/api/alumia/passes/emitir");
ok("passes: só a emissão leva a sessão", emissao && /^Bearer conta\./.test(emissao.autorizacao) && pedidosVistos.filter((p) => /^Bearer/.test(p.autorizacao)).length === 1);
ok("passes: toda chamada do aparelho sai sem credenciais", pedidosVistos.every((p) => p.credenciais === "omit"));
const linhaKt = (await dono("select tipo, identidade from interno.rede_kt where tipo = 'passes-rsa'")).rows;
const semanaDeHoje = (await import("../lib/rede/passes/comum.ts")).semanaDe();
ok("passes: a chave da semana está no registro público, uma linha", linhaKt.length === 1 && linhaKt[0].identidade.startsWith(`p3:${semanaDeHoje}::`));
const marcas = (await dono("select marca, dia::text from interno.passes_emitidos")).rows;
ok("passes: o banco guarda só uma marca do dia (sem a conta)", marcas.length === 1 && !Buffer.from(marcas[0].marca).toString("hex").includes(P.ana.replace(/-/g, "")));
// O mesmo aparelho, sem os passes, de novo no mesmo dia: o servidor recusa (uma vez por conta por dia).
const guardadosDaAna = guardado.get("alumia-passes-r2");
passes.apagarPasses();
await recusa("passes: a mesma conta, de novo no mesmo dia, ouve 'ja_pegou'", () => passes.garantirPasses(), "ja_pegou");
guardado.set("alumia-passes-r2", guardadosDaAna);
passes._esquecerMemoria();
ok("passes: os 30 voltaram do armazenamento do aparelho", passes.passesGuardados() === 30);

// Passe gasto, adulterado, de outro segredo.
const umPasse = await passes.gastarPasse();
ok("passes: gastar tira um do aparelho", passes.passesGuardados() === 29);
const conferido = await servPasses.conferirPasse(umPasse);
ok("passes: o servidor confere o passe sem saber de quem é", conferido.ok === true && conferido.resumo.length === 32);
const mexido = umPasse.replace(/token="(.)/, (_, c) => `token="${c === "A" ? "B" : "A"}`);
ok("passes: passe adulterado não vale", (await servPasses.conferirPasse(mexido)).ok === false);
ok("passes: passe da semana vale na seguinte", (await servPasses.conferirPasse(umPasse, { agora: Date.now() + 7 * 86_400_000 })).ok === true);
ok("passes: passe de duas semanas atrás não vale", (await servPasses.conferirPasse(umPasse, { agora: Date.now() + 14 * 86_400_000 })).ok === false);
ok("passes: passe geral não vale como passe de urna", (await servPasses.conferirPasse(umPasse, { contexto: base.sortear(32) })).ok === false);
ok("passes: sem passe, 'sem_passe'", (await servPasses.conferirPasse(null)).motivo === "sem_passe");

// ═══════════════════ 3. As caixas pelo aparelho ═══════════════════
contaAtual = null; // daqui em diante, o aparelho nem tem sessão: as caixas não precisam
const caixaDaAna = cliente.novaCaixa(false);
ok("caixa: id e passes com 256 bits", caixaDaAna.id.length === 32 && caixaDaAna.pd.length === 32 && caixaDaAna.pl.length === 32);
// Criar com o passe já gasto acima (umPasse): recusado.
const comPasseVelho = await (await chamarRota("/api/alumia/caixa/lote", { itens: [{ acao: "criar", id: base.paraB64u(caixaDaAna.id), pd_h: base.paraB64u(cliente.resumoDoPasseDeDeposito(caixaDaAna.pd)), pl_h: base.paraB64u(cliente.resumoDoPasseDeLeitura(caixaDaAna.pl)), multi: false }] }, { authorization: umPasse })).json();
ok("caixa: o primeiro uso do passe cria", comPasseVelho.resultados?.[0]?.ok === true);
const outraCaixa = cliente.novaCaixa(false);
const repetido = await (await chamarRota("/api/alumia/caixa/lote", { itens: [{ acao: "criar", id: base.paraB64u(outraCaixa.id), pd_h: base.paraB64u(cliente.resumoDoPasseDeDeposito(outraCaixa.pd)), pl_h: base.paraB64u(cliente.resumoDoPasseDeLeitura(outraCaixa.pl)), multi: false }] }, { authorization: umPasse })).json();
ok("caixa: o mesmo passe de novo é recusado", repetido.resultados?.[0]?.erro === "passe_usado");
const semPasse = await chamarRota("/api/alumia/caixa/lote", { itens: [{ acao: "criar", id: base.paraB64u(outraCaixa.id), pd_h: base.paraB64u(outraCaixa.pd), pl_h: base.paraB64u(outraCaixa.pl), multi: false }] });
ok("caixa: criar sem passe é recusado", semPasse.status === 401);
const comCookie = await chamarRota("/api/alumia/caixa/buscar", { id: base.paraB64u(caixaDaAna.id), pl: base.paraB64u(caixaDaAna.pl), cursor: 0 }, { cookie: "sb-abc-auth-token=xyz" });
ok("caixa: pedido com cookie de sessão é recusado ('sem_sessao_aqui')", comCookie.status === 400 && (await comCookie.json()).erro === "sem_sessao_aqui");
const comBearer = await chamarRota("/api/alumia/caixa/lote", { itens: [] }, { authorization: `Bearer conta.${P.ana}` });
ok("caixa: pedido com a sessão da conta é recusado", comBearer.status === 400 && (await comBearer.json()).erro === "sem_sessao_aqui");

await espera("caixa: criar pelo aparelho (gasta um passe)", () => cliente.criar(outraCaixa), () => passes.passesGuardados() === 28);
const caixaDaBia = cliente.novaCaixa(false);
await cliente.criar(caixaDaBia);
// A Bia deposita na caixa da Ana (só conhece id e pd), com franquia.
const deBiaParaAna = cliente.caixaDeTerceiros(caixaDaAna.id, caixaDaAna.pd);
const kf = franquia.novaChaveDeFranquia();
const conteudo = base.bytesDe("vou te achar na saída do ato, sua traidora");
const c = franquia.compromisso(kf, cliente.idDaCaixaNoBanco(caixaDaAna.id), conteudo);
const envelope = base.sortear(tamanhos.TAMANHOS_DUPLA[0]);
const dep = await cliente.depositar(deBiaParaAna, envelope, c);
ok("caixa: depositar devolve a marca do servidor e o dia", dep.ok === true && dep.marca?.length === 32 && dep.dia === base.diaUtc());
const fora = await cliente.depositar(deBiaParaAna, base.sortear(1000));
ok("caixa: tamanho fora da lista é recusado no aparelho", fora.ok === false && fora.erro === "tamanho");
const passeErrado = await cliente.depositar({ id: caixaDaAna.id, pd: base.sortear(32) }, base.sortear(tamanhos.TAMANHOS_DUPLA[0]));
ok("caixa: passe de depósito errado responde ok como o certo", passeErrado.ok === true);
const naoExiste = await cliente.depositar({ id: base.sortear(32), pd: base.sortear(32) }, base.sortear(tamanhos.TAMANHOS_DUPLA[0]));
ok("caixa: caixa que não existe responde ok como a que existe", naoExiste.ok === true);
const chegou = await cliente.buscar(caixaDaAna, 0);
ok("caixa: a Ana busca e só o depósito certo está lá", chegou.length === 1 && base.iguais(chegou[0].envelope, envelope) && base.iguais(chegou[0].franquia, c) && base.iguais(chegou[0].marca, dep.marca));
ok("caixa: o pacote guarda só o dia", chegou[0].dia === base.diaUtc());
const alheia = await cliente.buscar({ ...caixaDaAna, pl: base.sortear(32) }, 0);
ok("caixa: com o passe de leitura errado, a lista vem vazia (igual à caixa vazia)", alheia.length === 0);

// ═══════════════════ 4. A denúncia com prova ═══════════════════
// A Bia publica a conta no diretório (a identidade que a Ana atribui à autoria; vai ao registro público das chaves pelo gatilho).
const certificados = await import("../lib/rede/chat/r2/certificados.ts");
const parDaBia = certificados.novoParEd25519();
const identidadeDaBia = parDaBia.publica;
const contaPublica = (identidade) => ({ identidade, pedidosXwing: base.sortear(1216), pedidosAssinatura: base.sortear(64), pedidosCaixa: base.sortear(32), pedidosPd: base.sortear(32), votoXwing: null, votoAssinatura: null });
contaAtual = P.bia;
const contaDaBia = contaPublica(identidadeDaBia);
const plPedidosBia = base.sortear(32);
await espera("diretório: a Bia publica a conta (com sessão)", () => diretorio.publicarConta(contaDaBia, plPedidosBia));
contaAtual = P.ana;
const contaDaAna = contaPublica(base.sortear(32));
const plPedidosAna = base.sortear(32);
await diretorio.publicarConta(contaDaAna, plPedidosAna);
// A denúncia com prova vai pela rota da frente da denúncia (app/api/alumia/franquia/denunciar, lib/rede/franquia/protocolo.ts), com a
// sessão de quem denuncia: a prova da mensagem sai do pacote como a caixa entregou (franquia e marca de fora, dia) e da kf e do
// conteúdo de dentro do cifrado. (O denunciarComProva de lib/rede/caixas/franquia.ts, da versão curta, saiu na junção.)
const fq = await import("../lib/rede/franquia/protocolo.ts");
// A declaração da Bia: "o passe de depósito desta caixa da Ana é meu" (a conversa a dois manda isto ao anunciar a caixa).
const pdHDaBia = base.resumo(base.ROTULOS.passeDeposito, caixaDaAna.pd);
const declaracaoDaBia = certificados.assinarDeclaracao(parDaBia, base.resumo(base.ROTULOS.caixa, caixaDaAna.id), pdHDaBia, P.bia);
const provaDaMensagem = fq.provaDoPacote({ origem: "conversa", caixa: caixaDaAna.id, pacote: chegou[0], kf, conteudo, autoria: { pdH: pdHDaBia, declaracao: declaracaoDaBia, conta: P.bia } });
ok("denúncia: o aparelho monta a prova do pacote que chegou (o compromisso confere)", fq.provaInteira(provaDaMensagem));
const denunciar = async (corpo, conta = P.ana) =>
  (await chamarRota("/api/alumia/franquia/denunciar", corpo, conta ? { authorization: `Bearer conta.${conta}` } : {})).json();
const trecho = { texto: "vou te achar na saída do ato", prova: provaDaMensagem };
const denuncia = await denunciar({ categoria: "ameaca", autor: "r2c_bia", trechos: [trecho] });
ok("denúncia: com prova, entra na fila", denuncia.ok === true, JSON.stringify(denuncia));
const fila = (await dono("select alvo, quem, prova::text as prova from interno.rede_denuncias where alvo = $1", [P.bia])).rows;
ok("denúncia: na fila, o trecho escolhido, a autoria e o dia", fila.length === 1 && fila[0].quem === P.ana && /vou te achar na saída do ato/.test(fila[0].prova) && fila[0].prova.includes(base.diaUtc()));
ok("denúncia: o resto da mensagem não foi (só o trecho escolhido)", !/traidora/.test(fila[0].prova));
ok("denúncia: a fila não guarda caixa, marca, chave nem conteúdo inteiro", ![provaDaMensagem.caixa, provaDaMensagem.marca, provaDaMensagem.kf, provaDaMensagem.conteudo].some((x) => fila[0].prova.includes(x)));
ok("denúncia: trecho que não está na mensagem, recusado", (await denunciar({ categoria: "ameaca", autor: "r2c_bia", trechos: [{ ...trecho, texto: "frase inventada" }] })).motivo === "prova_nao_confere");
ok("denúncia: conteúdo forjado, recusado", (await denunciar({ categoria: "ameaca", autor: "r2c_bia", trechos: [{ ...trecho, prova: { ...provaDaMensagem, conteudo: fq.b64(base.bytesDe("vou te achar na saída do ato, e outra coisa")) } }] })).motivo === "prova_nao_confere");
ok("denúncia: sem sessão, não entra", (await denunciar({ categoria: "ameaca", autor: "r2c_bia", trechos: [trecho] }, null)).motivo === "entre_primeiro");

// Confirmar apaga do servidor.
await cliente.confirmar(caixaDaAna, chegou[0].ordem);
ok("caixa: confirmado, o pacote sai do banco", (await dono("select count(*)::int as n from interno.pacotes where caixa_h = $1", [Buffer.from(cliente.idDaCaixaNoBanco(caixaDaAna.id))])).rows[0].n === 0);

// O bloqueio: a Ana troca o passe de depósito; o da Bia continua "ok" e nada chega.
const pdNovo = base.sortear(32);
await espera("bloqueio: trocar o passe de depósito", () => cliente.trocar(caixaDaAna, { pd: pdNovo }, true));
const depoisDoBloqueio = await cliente.depositar(deBiaParaAna, base.sortear(tamanhos.TAMANHOS_DUPLA[0]));
ok("bloqueio: o depósito de quem foi bloqueada responde ok", depoisDoBloqueio.ok === true);
ok("bloqueio: e nada chega", (await cliente.buscar(caixaDaAna, 0)).length === 0);
await cliente.depositar({ id: caixaDaAna.id, pd: pdNovo }, base.sortear(tamanhos.TAMANHOS_DUPLA[1]));
ok("bloqueio: com o passe novo, chega", (await cliente.buscar(caixaDaAna, 0)).length === 1);
await recusa("trocar: com o passe de leitura errado, recusa", () => cliente.trocar({ ...caixaDaAna, pl: base.sortear(32) }, { pd: base.sortear(32) }, false), "nao_encontrada");

// ═══════════════════ 5. O diretório e o pedido de conversa ═══════════════════
const lido = await diretorio.lerDiretorio("Codinome ana");
ok("diretório: lido sem sessão, por codinome", lido && base.iguais(lido.identidade, contaDaAna.identidade) && base.iguais(lido.pedidosCaixa, contaDaAna.pedidosCaixa));
ok("diretório: codinome que não existe, nulo", (await diretorio.lerDiretorio("Ninguem aqui")) === null);
ok("diretório: conta não aprovada (Caio) não aparece", (await diretorio.lerDiretorio("Codinome caio")) === null);
contaAtual = P.ana;
const aparelho = base.sortear(32);
await espera("diretório: a Ana publica um aparelho e duas pré-chaves (com sessão)", async () => {
  await diretorio.publicarAparelho({ aparelho, certificado: base.sortear(64), proteusImpressao: base.sortear(32), xwingSemana: base.sortear(1216), xwingAssinatura: base.sortear(64), semana: 2900 });
  await diretorio.publicarPreChaves(aparelho, [{ id: 1, pkb: base.sortear(83), assinatura: base.sortear(64) }, { id: 65535, pkb: base.sortear(83), assinatura: base.sortear(64), ultima: true }]);
});
contaAtual = null;
const pre1 = await diretorio.reivindicar("Codinome ana", "proteus");
ok("diretório: reivindicar (com passe) entrega uma pré-chave do aparelho", pre1.length === 1 && pre1[0].id === 1 && base.iguais(pre1[0].aparelho, aparelho));
const pre2 = await diretorio.reivindicar("Codinome ana", "proteus");
ok("diretório: acabadas as comuns, entrega a última (que fica)", pre2.length === 1 && pre2[0].id === 65535);
ok("diretório: a pré-chave entregue saiu do banco", (await dono("select count(*)::int as n from interno.diretorio_pre_chaves where id = 1")).rows[0].n === 0);

const caixaDePedidosDaAna = { id: contaDaAna.pedidosCaixa, pd: contaDaAna.pedidosPd, pl: plPedidosAna, multi: false };
const envPedido = base.sortear(tamanhos.TAMANHO_PEDIDO);
const t0 = Date.now();
await espera("pedido: com prova de trabalho e passe, chega na caixa de pedidos", () => pedidos.depositarPedido("Codinome ana", envPedido));
const tempoDaProva = Date.now() - t0;
const pedidosDaAna = await cliente.buscar(caixaDePedidosDaAna, 0);
ok("pedido: a Ana lê o pedido (cifrado, sem remetente)", pedidosDaAna.length === 1 && base.iguais(pedidosDaAna[0].envelope, envPedido) && pedidosDaAna[0].franquia === null);
await recusa("pedido: tamanho errado, recusado no aparelho", () => pedidos.depositarPedido("Codinome ana", base.sortear(100)), "tamanho");
await recusa("pedido: para quem não recebe pedidos", () => pedidos.depositarPedido("Codinome caio", envPedido), "sem_pedidos");
// O mesmo desafio resolvido, de novo, com outro passe: recusado (o desafio já foi gasto).
{
  const d = await (await ROTAS["/api/alumia/pedido/desafio"].GET(new Request("http://alumia.test/api/alumia/pedido/desafio"))).json();
  const desafio = base.deB64u(d.desafio);
  const nonce = await prova.resolverProva(desafio, d.bits);
  const corpo = { codinome: "Codinome ana", desafio: d.desafio, nonce: base.paraB64u(nonce), envelope: base.paraB64u(envPedido) };
  const primeira = await (await chamarRota("/api/alumia/pedido", corpo, { authorization: await passes.gastarPasse() })).json();
  const segunda = await chamarRota("/api/alumia/pedido", corpo, { authorization: await passes.gastarPasse() });
  ok("pedido: a primeira vez passa", primeira.ok === true);
  ok("pedido: o mesmo desafio de novo é recusado", segunda.status === 409 && (await segunda.json()).erro === "passe_usado");
  const semProva = await chamarRota("/api/alumia/pedido", { ...corpo, nonce: base.paraB64u(new Uint8Array(8)) }, { authorization: await passes.gastarPasse() });
  ok("pedido: sem a prova, recusado", semProva.status === 400 && (await semProva.json()).erro === "prova");
  const d2 = await (await ROTAS["/api/alumia/pedido/desafio"].GET(new Request("http://alumia.test/x"))).json();
  const n2 = await prova.resolverProva(base.deB64u(d2.desafio), d2.bits);
  const semPasse = await chamarRota("/api/alumia/pedido", { ...corpo, desafio: d2.desafio, nonce: base.paraB64u(n2) });
  ok("pedido: sem passe, recusado", semPasse.status === 401);
}

// ═══════════════════ 6. A vigia e a cobertura ═══════════════════
{
  const agendados = [];
  agenda.configurarRelogio({ agendar: (fn, ms) => (agendados.push({ fn, ms }), () => {}), agora: () => Date.now(), aVista: () => true });
  ok("vigia: a próxima busca é sempre no mesmo ponto do intervalo", agenda.proximaBusca(125_000, 60_000, 7_000) === 2_000 && agenda.proximaBusca(127_000, 60_000, 7_000) === 60_000);
  const vigiada = cliente.novaCaixa(false);
  await cliente.criar(vigiada);
  await cliente.depositar(vigiada, base.sortear(tamanhos.TAMANHOS_DUPLA[0]));
  await cliente.depositar(vigiada, base.sortear(tamanhos.TAMANHOS_DUPLA[0]));
  const recebidos = [];
  pedidosVistos.length = 0;
  const parar = agenda.vigiar(vigiada, async (p) => (recebidos.push(...p), p.at(-1).ordem));
  ok("vigia: a busca espera o intervalo (nada na hora)", agendados.length === 1 && agendados[0].ms > 0 && agendados[0].ms <= agenda.INTERVALO_A_VISTA_MS);
  agendados.shift().fn();
  await new Promise((r) => setTimeout(r, 2600));
  ok("vigia: buscou, entregou os dois e confirmou", recebidos.length === 2);
  ok("vigia: uma caixa por pedido", pedidosVistos.filter((p) => p.caminho === "/api/alumia/caixa/buscar").length === 1);
  ok("vigia: o confirmado saiu do servidor", (await cliente.buscar(vigiada, 0)).length === 0);
  ok("vigia: agendou a próxima", agendados.length === 1);
  parar();

  const passesAntes = passes.passesGuardados();
  agendados.length = 0;
  agenda.cobertura(true);
  await new Promise((r) => setTimeout(r, 5000));
  const estado = JSON.parse(guardado.get("alumia-cobertura-r2") ?? "null");
  ok("cobertura: duas caixas criadas como quaisquer outras (dois passes)", estado?.caixas?.length === 2 && passes.passesGuardados() === passesAntes - 2);
  const deposito = agendados.find((a) => a.ms >= 1000 && a.ms <= agenda.MEDIA_DA_COBERTURA_MS * 8 && !String(a.fn).includes("rodada"));
  ok("cobertura: o próximo pacote falso tem hora sorteada", agendados.length >= 3);
  const antesDoFalso = (await dono("select count(*)::int as n from interno.pacotes")).rows[0].n;
  for (const a of agendados.splice(0)) a.fn();
  await new Promise((r) => setTimeout(r, 5000));
  const tamanhosNoBanco = (await dono("select octet_length(envelope) as t from interno.pacotes")).rows.map((x) => x.t);
  ok("cobertura: o pacote falso tem o tamanho de uma mensagem curta", deposito !== undefined && tamanhosNoBanco.every((t) => tamanhos.TAMANHOS_ACEITOS.includes(t)) && tamanhosNoBanco.includes(agenda.TAMANHO_DA_COBERTURA));
  ok("cobertura: depositou", (await dono("select count(*)::int as n from interno.pacotes")).rows[0].n >= antesDoFalso);
  const e = { caixas: [], dia: base.diaUtc(), bytes: agenda.TETO_DA_COBERTURA_BYTES - 1000 };
  ok("cobertura: o teto de banda do dia segura", !agenda.cabeNaBanda(e, agenda.TAMANHO_DA_COBERTURA, Date.now()) && agenda.cabeNaBanda(e, 500, Date.now()));
  ok("cobertura: no dia seguinte, a banda volta", agenda.cabeNaBanda(e, agenda.TAMANHO_DA_COBERTURA, Date.now() + 86_400_000));
  const caixasAntes = (await dono("select count(*)::int as n from interno.caixas")).rows[0].n;
  agenda.cobertura(false);
  await new Promise((r) => setTimeout(r, 5000));
  ok("cobertura: desligada, as caixas dela saem do servidor e do aparelho", (await dono("select count(*)::int as n from interno.caixas")).rows[0].n === caixasAntes - 2 && !guardado.has("alumia-cobertura-r2") && !agenda.coberturaLigada());
  const amostras = Array.from({ length: 2000 }, () => agenda.uniforme());
  ok("sorteio: uniforme em [0,1) e espalhado", amostras.every((x) => x >= 0 && x < 1) && Math.abs(amostras.reduce((a, b) => a + b) / 2000 - 0.5) < 0.05);
}

// ═══════════════════ 7. Quem tem o banco inteiro ═══════════════════
{
  // Os ids das contas não aparecem em nenhuma tabela das caixas, dos passes nem dos pacotes; o id cru da caixa não está no banco.
  const tabelas = ["caixas", "pacotes", "caixa_contagem", "passes_gastos", "passes_emitidos"];
  let achou = [];
  for (const t of tabelas) {
    const linhas = (await dono(`select * from interno.${t}`)).rows;
    const texto = JSON.stringify(linhas, (k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v));
    for (const [nome, id] of Object.entries(P)) if (texto.includes(id) || texto.includes(id.replace(/-/g, ""))) achou.push(`${t}:${nome}`);
    if (texto.includes(Buffer.from(caixaDaAna.id).toString("hex"))) achou.push(`${t}:id cru`);
    if (texto.includes(Buffer.from(caixaDaAna.pl).toString("hex")) || texto.includes(Buffer.from(caixaDaAna.pd).toString("hex"))) achou.push(`${t}:passe cru`);
  }
  ok("banco inteiro: nenhuma conta, nenhum id cru e nenhum passe cru nas caixas, pacotes e passes", achou.length === 0, achou.join(", "));
  const colunas = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)`, [tabelas])).rows;
  ok("banco inteiro: nenhuma coluna de conta ou de hora nessas tabelas", colunas.every((c) => !/uuid|timestamp|time/.test(c.data_type) && !/usuario|conta|quem|autor/.test(c.column_name)), JSON.stringify(colunas.filter((c) => /uuid|timestamp|time/.test(c.data_type) || /usuario|conta|quem|autor/.test(c.column_name))));
  // O passe gasto: o resumo dele não é ligável ao lote emitido (a marca do dia é HMAC da conta com um segredo que o banco não tem).
  const gastos = (await dono("select resumo from interno.passes_gastos")).rows.length;
  ok(`banco inteiro: ${gastos} passes gastos, só resumos de 32 bytes sem dono`, gastos >= 8);
}

// ═══════════════════ A chave dos passes contra um servidor ao vivo que marca uma conta (revisão final da R2, refeita na R3) ═══════════════════
{
  const kt = await import("../lib/rede/chat/transparencia.ts");
  const comum = await import("../lib/rede/passes/comum.ts");
  const dia = base.diaUtc();
  const semana = comum.semanaDe();
  const vazio = new Uint8Array(0);
  const chaveMarcada = base.sortear(294);
  const idDe = (c) => comum.identidadeNoRegistro(semana, vazio, c);
  // O ataque da revisão: uma linha 41 inventada e a 42 com uma chave só desta conta, com o resumo refeito a partir da 41 inventada.
  const anteriorInventado = { seq: 41, tipo: "passes-rsa", quem: "x", identidade: "y", versao: 1, dia, resumo: `${"Q".repeat(43)}=` };
  const linha = { seq: 42, tipo: "passes-rsa", quem: "passes", identidade: idDe(chaveMarcada), versao: 1, dia };
  const forjada = { ...linha, resumo: passes.resumoDaLinha(anteriorInventado.resumo, linha) };
  const rpcDeVerdade = transporteAtual();
  configurarTransporte({ rpcComSessao: async (f) => (f === "rede_kt_ponta" ? { seq: 42, resumo: forjada.resumo } : [anteriorInventado, forjada]) });
  ok("ATAQUE chave só desta conta com linha inventada: o aparelho que já conferiu a corrente recusa", (await passes.chaveEstaNoRegistro(semana, vazio, chaveMarcada, 42)) === false);
  passes._esquecerMemoria();
  ok("ATAQUE ... e mesmo sem vista guardada: a linha 41 inventada não fecha a corrente desde o começo", (await passes.chaveEstaNoRegistro(semana, vazio, chaveMarcada, 42)) === false);
  configurarTransporte({ rpcComSessao: rpcDeVerdade });
  // Duas chaves de passes para a mesma semana numa corrente íntegra: nenhuma vale.
  let resumo = kt.INICIO.resumo;
  const linhas = [];
  for (const [seq, chave] of [[1, base.sortear(294)], [2, base.sortear(294)]]) {
    const l = { seq, tipo: "passes-rsa", quem: "passes", identidade: idDe(chave), versao: 1, dia };
    resumo = await kt.resumoDaLinhaComTipo(resumo, l);
    linhas.push({ ...l, resumo });
  }
  const nome = comum.nomeNaVista(semana, vazio);
  const vista = await kt.atualizarVista(kt.INICIO, { ponta: async () => ({ seq: 2, resumo }), trecho: async () => linhas });
  ok("ATAQUE duas chaves de passes na mesma semana (uma para cada pessoa): a semana inteira é recusada",
    !kt.chaveRsaDePassesNaVista(vista, nome, linhas[0].identidade, 1) && !kt.chaveRsaDePassesNaVista(vista, nome, linhas[1].identidade, 2));
  const uma = await kt.atualizarVista(kt.INICIO, { ponta: async () => ({ seq: 1, resumo: linhas[0].resumo }), trecho: async () => linhas.slice(0, 1) });
  ok("uma chave só na semana, na corrente conferida: vale", kt.chaveRsaDePassesNaVista(uma, nome, linhas[0].identidade, 1) && !kt.chaveRsaDePassesNaVista(uma, nome, linhas[1].identidade, 1));
  ok("a linha indicada pelo servidor tem de ser a da chave", !kt.chaveRsaDePassesNaVista(uma, nome, linhas[0].identidade, 7));
  // O LIMITE dito: um aparelho sem vista nenhuma, diante de um servidor que lhe mostra um registro inteiro bifurcado desde o começo,
  // aceita (sem fofoca entre aparelhos não há como notar aqui; o carimbo da vista ao lado do código de segurança é o caminho).
  ok("LIMITE registro bifurcado desde o começo, num aparelho sem vista: aceito (dito no comentário e no relatório)", kt.chaveRsaDePassesNaVista(uma, nome, linhas[0].identidade, 1));
  // Com o transporte de verdade, a chave da semana do servidor continua passando (a vista guardada só avança).
  passes._esquecerMemoria();
  const daSemana = await (await fetchDoAparelho("/api/alumia/passes/chave", { method: "GET" })).json();
  ok("a chave da semana de verdade continua no registro, pela corrente inteira", await passes.chaveEstaNoRegistro(daSemana.semana, vazio, base.deB64u(daSemana.publica), Number(daSemana.seq)), JSON.stringify(daSemana).slice(0, 120));
}

console.log(`(lote de 30 passes: ${tempoDoLote} ms; prova de trabalho do pedido: ${tempoDaProva} ms)`);
servidorFalso.close();
await banco.pg.close?.();
console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
