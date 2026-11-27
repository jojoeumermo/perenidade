// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3 (2.6): os segredos do servidor divididos e com versão (scripts/segredos/cerimonia.mjs, lib/rede/painel/impressao.ts,
// lib/rede/fediverso/cifra.ts, supabase/migracoes/20261125-r3-resto-r2.sql). Prova:
//   - a cerimônia: o segredo depende de TODAS as contribuições (trocar uma muda tudo; ordem importa); K de N refazem, qualquer K
//     serve, K−1 não refazem; as 24 palavras vão e voltam; parte com palavra errada é recusada; nada de segredo sem 2 contribuições;
//   - a rotação da impressão: o segredo de antes (sem versão) dá as mesmas impressões de sempre; a versão nova dá outras; o servidor
//     manda a anterior só se é a versão de antes;
//   - no banco: a impressão nova E a anterior valem por 30 dias (o banimento por rede segue valendo na troca e passa para a nova); a de
//     antes da anterior não vale; depois de 30 dias, a anterior também não;
//   - a federação: o que foi cifrado com o segredo de antes abre na troca e é cifrado de novo com o atual (ressellar).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-segredos.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { criarBanco } from "./banco-local.mjs";
import { conferenciaDe, contribuir, dividir, juntarContribuicoes, lerParte, paraOAmbiente, refazer } from "./segredos/cerimonia.mjs";
import { impressaoDaRede, impressoesDaRede, lerSegredo } from "../lib/rede/painel/impressao.ts";
import { cifrar, decifrar, decifrarNaTroca, ressellar, versaoDoCifrado } from "../lib/rede/fediverso/cifra.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261125-r3-resto-r2.sql"), "utf8");
let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function recusa(nome, f, codigo) {
  try {
    await f();
    falhas.push(`${nome}: deveria recusar com "${codigo}"`);
  } catch (e) {
    if (String(e.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${e.message}"`);
  }
}
const iguais = (a, b) => Buffer.from(a).equals(Buffer.from(b));

// ═══════════════════ 1. A cerimônia ═══════════════════
const c = [contribuir(), contribuir(), contribuir()];
ok("cada contribuição tem 64 letras hexadecimais, sorteadas", c.every((x) => /^[0-9a-f]{64}$/.test(x)) && new Set(c).size === 3);
const segredo = juntarContribuicoes(c, 2);
ok("o segredo tem 32 bytes", segredo.length === 32);
ok("o mesmo conjunto, na mesma ordem, dá o mesmo segredo", iguais(segredo, juntarContribuicoes([...c], 2)));
ok("trocar UMA contribuição muda o segredo (ninguém escolhe sozinho)", !iguais(segredo, juntarContribuicoes([c[0], c[1], contribuir()], 2)));
ok("a ordem importa", !iguais(segredo, juntarContribuicoes([c[1], c[0], c[2]], 2)));
ok("a versão entra na conta", !iguais(segredo, juntarContribuicoes(c, 3)));
await recusa("uma contribuição só não faz segredo", () => juntarContribuicoes([c[0]], 2), "poucas_contribuicoes");
await recusa("contribuição repetida é recusada", () => juntarContribuicoes([c[0], c[0]], 2), "contribuicao_repetida");
await recusa("contribuição torta é recusada", () => juntarContribuicoes([c[0], "abc"], 2), "contribuicao_invalida");
const ambiente = paraOAmbiente(segredo, 2);
ok("o valor do ambiente é v2:<base64url> e volta aos mesmos bytes", /^v2:[A-Za-z0-9_-]{43}$/.test(ambiente) && iguais(lerSegredo(ambiente).chave, segredo) && lerSegredo(ambiente).versao === 2);
const partes = await dividir(segredo, 3, 5);
ok("5 partes, numeradas, de 24 palavras", partes.length === 5 && partes.every((p) => p.palavras.split(" ").length === 24) && new Set(partes.map((p) => p.numero)).size === 5);
const texto = (p) => `${p.numero}: ${p.palavras}`;
ok("K=3 partes refazem o segredo", iguais(await refazer(partes.slice(0, 3).map(texto)), segredo));
let todasK = true;
for (const trio of [[0, 1, 2], [0, 2, 4], [1, 3, 4], [2, 3, 4], [0, 1, 4]]) todasK &&= iguais(await refazer(trio.map((i) => texto(partes[i]))), segredo);
ok("qualquer trio refaz", todasK);
ok("as 5 juntas também refazem", iguais(await refazer(partes.map(texto)), segredo));
let nenhumDois = true;
for (const par of [[0, 1], [1, 2], [3, 4], [0, 4]]) nenhumDois &&= !iguais(await refazer(par.map((i) => texto(partes[i]))), segredo);
ok("ATAQUE K−1 = 2 partes NÃO refazem o segredo", nenhumDois);
{
  // Auditoria interna da R3: sem conferência, K−1 partes (ou uma parte errada de palavras válidas) devolviam OUTRO segredo calado.
  const conf = conferenciaDe(segredo);
  ok("a conferência tem 16 letras e não é o segredo", /^[0-9a-f]{16}$/.test(conf) && !Buffer.from(segredo).toString("hex").includes(conf));
  ok("com a conferência, K partes refazem e conferem", iguais(await refazer(partes.slice(0, 3).map(texto), conf), segredo));
  await recusa("ATAQUE K−1 partes com a conferência: recusado (antes saía outro número sem aviso)", () => refazer(partes.slice(0, 2).map(texto), conf), "partes_nao_conferem");
  const outra = (await dividir(juntarContribuicoes([contribuir(), contribuir()], 2), 3, 5))[2];
  await recusa("ATAQUE uma parte maliciosa (de outro segredo, palavras válidas) com a conferência: recusado", () => refazer([texto(partes[0]), texto(partes[1]), `${partes[2].numero}: ${outra.palavras}`], conf), "partes_nao_conferem");
  await recusa("conferência torta é recusada", () => refazer(partes.slice(0, 3).map(texto), "xyz"), "conferencia_invalida");
  const cli = fs.readFileSync(path.join(raiz, "scripts/segredos/cerimonia.mjs"), "utf8");
  ok("a linha de comando exige a conferência para refazer e a imprime ao juntar", cli.includes("falta --conferencia") && cli.includes("Conferência (escreva em CADA parte"));
}
ok("a parte vai e volta pelas palavras (33 bytes, com o número no fim)", lerParte(texto(partes[0])).length === 33 && lerParte(texto(partes[0]))[32] === partes[0].numero);
{
  // Vetor FIXO com soma de conferência errada: 23 × "abandon" (índice 0) + "zoo". A soma BIP-39 dos 256 bits
  // zero é o 1º byte do SHA-256 deles — calculado aqui com o crypto do Node, independente do @scure/bip39 que
  // o lerParte usa. O teste anterior trocava uma palavra ao acaso por "abandon"/"ability" e a frase mutada
  // seguia válida em ~1/256 das vezes (falha observada no CI em 27/11/2026; medida 11 em 3.000 mutações).
  const soma = createHash("sha256").update(new Uint8Array(32)).digest()[0];
  ok("o vetor fixo tem a soma errada de propósito (a palavra certa seria outra)", wordlist[soma] !== "zoo");
  await recusa("parte com a soma de conferência errada é recusada (BIP-39)", () => lerParte(`${partes[0].numero}: ${"abandon ".repeat(23)}zoo`), "");
}
ok("a ferramenta não grava nada em disco", !/writeFile|appendFile|createWriteStream/.test(fs.readFileSync(path.join(raiz, "scripts/segredos/cerimonia.mjs"), "utf8")));

// ═══════════════════ 2. A rotação da impressão ═══════════════════
const ANTIGO = "segredo-da-impressao-de-antes-com-mais-de-32-letras"; // gitleaks:allow (valor de teste)
const V2 = paraOAmbiente(juntarContribuicoes([contribuir(), contribuir()], 2), 2);
const V3 = paraOAmbiente(juntarContribuicoes([contribuir(), contribuir()], 3), 3);
const IP = "203.0.113.7";
ok("o segredo de antes (sem versão) é a versão 1 e dá a mesma impressão de sempre (HMAC com o texto)", lerSegredo(ANTIGO).versao === 1
  && impressaoDaRede(IP, ANTIGO) === (await import("node:crypto")).createHmac("sha256", ANTIGO).update(`alumia:rede:${IP}`).digest("hex"));
ok("a versão nova dá outra impressão", impressaoDaRede(IP, V2) !== impressaoDaRede(IP, ANTIGO) && /^[0-9a-f]{64}$/.test(impressaoDaRede(IP, V2)));
ok("segredo com versão torta, curta ou zero: nada", [lerSegredo("v2:curto"), lerSegredo("v0:" + "A".repeat(43)), lerSegredo("v2:" + "A".repeat(42) + "=")].every((x) => x === null));
const na2 = impressoesDaRede(IP, V2, ANTIGO);
ok("na troca, o servidor manda a nova (v2) e a anterior (v1)", na2.versao === 2 && na2.impressao === impressaoDaRede(IP, V2) && na2.anterior === impressaoDaRede(IP, ANTIGO));
ok("o anterior só vai se é a versão de antes (v1 com a atual v3: não vai)", impressoesDaRede(IP, V3, ANTIGO).anterior === null && impressoesDaRede(IP, V3, V2).anterior === impressaoDaRede(IP, V2));

// ═══════════════════ 3. No banco ═══════════════════
// Montado até antes desta migração (se ela já estiver colada no install.sql, depois da junção): o estado de antes é o da R2.
const banco = await criarBanco({ antesDe: sql }).catch(() => criarBanco());
const { dono, criarUsuario, rpc } = banco;
await banco.exclusivo(() => banco.pg.exec(sql));
await banco.exclusivo(() => banco.pg.exec(sql));
certos++;
const servico = { papel: "service_role" };
const P = {};
for (const n of ["coord", "alvo", "outra"]) {
  P[n] = await criarUsuario(`${n}@r3s.local`, `Pessoa ${n}`);
  await rpc({ papel: "authenticated", sub: P[n] }, "eu");
}
const registrar = (u, impressao, versao, anterior = null) => rpc(servico, "alumia_impressao_registrar", { p_usuario: u, p_impressao: impressao, p_momento: "entrada", p_versao: versao, p_anterior: anterior });
const i1 = impressaoDaRede(IP, ANTIGO), i2 = impressaoDaRede(IP, V2), i3 = impressaoDaRede(IP, V3);
// A conta "alvo" entra pela rede, na versão 1, e a rede é banida (como o painel faz).
await registrar(P.alvo, i1, 1);
const ban = (await dono("insert into interno.alumia_impressao_banimentos (motivo, por, contas, ate) values ('teste da troca', $1, 1, now() + interval '10 days') returning id", [P.coord])).rows[0].id;
await dono("insert into interno.alumia_impressao_banidas (banimento, impressao) values ($1, $2)", [ban, i1]);
ok("o banimento guardou a versão da impressão (1)", (await dono("select versao from interno.alumia_impressao_banidas where banimento = $1", [ban])).rows[0].versao === 1);
ok("antes da troca: a mesma rede (v1) continua barrada", (await registrar(P.outra, i1, 1)).barrada === true);
const r2 = await registrar(P.outra, i2, 2, i1);
ok("na troca (v2 com a anterior v1): a rede segue barrada", r2.barrada === true, JSON.stringify(r2));
ok("e o banimento passou a ter a impressão nova (v2)", (await dono("select count(*)::int as n from interno.alumia_impressao_banidas where banimento = $1 and impressao = $2 and versao = 2", [ban, i2])).rows[0].n === 1);
ok("com a v2 sozinha (o anterior já fora do ambiente), a rede segue barrada", (await registrar(P.outra, i2, 2)).barrada === true);
ok("ATAQUE a de antes da anterior (v1 com a atual v3) não vale: passa", (await registrar(P.outra, i3, 3, i1)).barrada === false);
ok("mas a anterior (v2) da v3 vale, e leva o banimento junto", (await registrar(P.outra, i3, 3, i2)).barrada === true);
// 30 dias depois de o banco ver a v3: a anterior não vale mais.
await dono("delete from interno.alumia_impressao_banidas where versao = 3");
await dono("update interno.configuracoes set valor = jsonb_set(valor, '{3}', to_jsonb(now() - interval '31 days')) where chave = 'impressao_versoes'");
ok("passados 30 dias da versão nova, a anterior não vale mais", (await registrar(P.outra, i3, 3, i2)).barrada === false);
ok("a impressão guarda a versão", (await dono("select versao from interno.alumia_impressoes where usuario = $1 and impressao = $2", [P.outra, i3])).rows[0]?.versao === 3);
ok("só o serviço registra", await rpc({ papel: "authenticated", sub: P.alvo }, "alumia_impressao_registrar", { p_usuario: P.alvo, p_impressao: i1 }).then(() => false, (e) => /permission denied/.test(e.message)));
ok("a forma antiga (3 argumentos, sem versão) continua valendo (versão 1)", (await rpc(servico, "alumia_impressao_registrar", { p_usuario: P.alvo, p_impressao: i1, p_momento: "pedido" })).barrada === true);

// ═══════════════════ 4. A federação ═══════════════════
const FED1 = "segredo-da-federacao-de-antes-com-mais-de-32-letras"; // gitleaks:allow (valor de teste)
const FED2 = paraOAmbiente(juntarContribuicoes([contribuir(), contribuir()], 2), 2);
const velho = cifrar("-----BEGIN PRIVATE KEY----- de teste", FED1); // gitleaks:allow (valor de teste)
ok("o formato de antes continua (v1:) e abre com o segredo de antes", velho.startsWith("v1:") && versaoDoCifrado(velho) === 1 && decifrar(velho, FED1) === "-----BEGIN PRIVATE KEY----- de teste");
ok("com o segredo novo sozinho, o de antes não abre", decifrar(velho, FED2) === null);
ok("na troca, abre com o anterior", decifrarNaTroca(velho, FED2, FED1) === "-----BEGIN PRIVATE KEY----- de teste"); // gitleaks:allow (valor de teste)
const novo = ressellar(velho, FED2, FED1);
ok("ressellar cifra de novo com o atual (v1k2:) e abre só com ele", novo.startsWith("v1k2:") && versaoDoCifrado(novo) === 2 && decifrar(novo, FED2) === "-----BEGIN PRIVATE KEY----- de teste" && decifrar(novo, FED1) === null);
ok("ressellar o que já está no atual devolve igual; o que não abre, nulo", ressellar(novo, FED2, FED1) === novo && ressellar(velho, FED2, null) === null);
ok("o servidor da federação abre na troca com o anterior do ambiente", /decifrarNaTroca\(/.test(fs.readFileSync(path.join(raiz, "lib/rede/fediverso/servidor.ts"), "utf8")) && /ALUMIA_FEDIVERSO_SEGREDO_ANTERIOR/.test(fs.readFileSync(path.join(raiz, "lib/rede/fediverso/servidor.ts"), "utf8")));

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
