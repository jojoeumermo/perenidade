// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (decisão do dono sobre a consulta à base): a enquete NÃO secreta dentro do grupo cifrado do núcleo
// (lib/rede/voto/enquete-do-grupo.ts) sobre o grupo MLS de verdade dos núcleos (lib/rede/membros/grupo.ts, @wireapp/core-crypto), com
// a caixa anônima de memória (o "servidor", como em testar-r2-membros). Prova:
//   - os membros abrem, votam e contam; o servidor guarda só pacotes de tamanho fixo (nem a pergunta, nem as opções, nem o voto);
//   - não é secreta entre os membros (cada voto tem o autor) e a tela da consulta diz isso, em 6 idiomas;
//   - um voto por membro (o último vale); só quem abriu fecha; voto depois do fechamento, de opção fora da lista, de enquete que não
//     existe, de texto torto: não conta; quem saiu do grupo não vota;
//   - números só com 3 votos ou mais e nenhuma opção com 1 ou 2.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-enquete.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { SUITE_MLS } from "../lib/rede/cifra/motor.ts";
import { Grupo, TransporteDoMotor } from "../lib/rede/membros/grupo.ts";
import { ENVELOPES_DE_GRUPO } from "../lib/rede/membros/embrulho.ts";
import { ENVELOPE_DO_PEDIDO, selarPedido } from "../lib/rede/membros/entrada.ts";
import { juntar, paraB64, texto } from "../lib/rede/membros/bytes.ts";
import { enqueteNoGrupo, ROTULOS } from "../lib/rede/voto/enquete-do-grupo.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const hex = (b) => Buffer.from(b).toString("hex");

// ── A caixa anônima de memória (o "servidor"): só resumos e pacotes ──
const H = (rotulo, b) => hex(sha256(juntar(texto(rotulo), b)));
const TAMANHOS = new Set([...ENVELOPES_DE_GRUPO, ENVELOPE_DO_PEDIDO]);
const servidor = { caixas: new Map(), guardado: [] };
const transporte = {
  async criar(c) {
    const k = H("alumia/r2/caixa", c.id);
    const pd = H("alumia/r2/passe-deposito", c.pd), pl = H("alumia/r2/passe-leitura", c.pl);
    const atual = servidor.caixas.get(k);
    if (atual) {
      if (atual.pd !== pd || atual.pl !== pl) throw new Error("caixa_outra");
      return;
    }
    servidor.caixas.set(k, { pd, pl, unicoFeito: false, proxima: 1, pacotes: [] });
  },
  async depositar(c, envelope, _franquia, unico) {
    const cx = servidor.caixas.get(H("alumia/r2/caixa", c.id));
    if (!TAMANHOS.has(envelope.length)) return { ok: false, erro: "tamanho" };
    if (!cx || cx.pd !== H("alumia/r2/passe-deposito", c.pd)) return { ok: true };
    if (unico) {
      if (cx.unicoFeito) return { ok: false, erro: "ocupada" };
      cx.unicoFeito = true;
    }
    cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: null, marca: null, dia: "2026-11-25" });
    servidor.guardado.push(Buffer.from(envelope));
    return { ok: true };
  },
  async buscar(c, cursor) {
    const cx = servidor.caixas.get(H("alumia/r2/caixa", c.id));
    if (!cx || cx.pl !== H("alumia/r2/passe-leitura", c.pl)) return [];
    return cx.pacotes.filter((p) => p.ordem > cursor).slice(0, 50);
  },
};

const M = await motorNoNode();
async function aparelho(nome) {
  const transporteDoMotor = new TransporteDoMotor(M);
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const cliente = new M.ClientId(new M.Uuid(crypto.randomUUID()), new M.DeviceId(1n), "alumia.invalid");
  const ref = await cc.transaction(async (c) => {
    await c.mlsInit(cliente, transporteDoMotor);
    return c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(SUITE_MLS), cliente));
  });
  const { secretKey, publicKey } = ed25519.keygen();
  return { nome, M, cc, ref, cliente, transporteDoMotor, identidade: { publica: publicKey, assinar: async (d) => ed25519.sign(d, secretKey) }, transporte };
}
const ap = {};
for (const n of ["ana", "bia", "caio", "dani", "eva"]) ap[n] = await aparelho(n);
const id = (n) => paraB64(ap[n].identidade.publica);

// O núcleo: a ana cria; bia, caio, dani e eva entram pela caixa de entrada.
const NUCLEO = "0b7c1e52-5d0c-4a63-9a43-5f2a6c1d9e11";
const g = { ana: await Grupo.criar(ap.ana, "grupo", true) };
const pub = g.ana.publicacaoDaEntrada(NUCLEO);
for (const n of ["bia", "caio", "dani", "eva"]) {
  const { pedido, resposta } = await Grupo.montarPedido(ap[n], "");
  await transporte.depositar({ id: Buffer.from(pub.caixa, "base64url"), pd: Buffer.from(pub.pd, "base64url") }, await selarPedido(Buffer.from(pub.xwing, "base64url"), pedido));
  const p = (await g.ana.pedidosDeEntrada()).find((x) => hex(x.identidade) === hex(ap[n].identidade.publica));
  await g.ana.aceitar(p);
  g[n] = await Grupo.entrarPelaResposta(ap[n], resposta, pedido.kr, "grupo");
}
const todos = Object.keys(g);
const sincronizar = async () => {
  for (const n of todos) await g[n].receber();
};
await sincronizar();
const q = Object.fromEntries(todos.map((n) => [n, enqueteNoGrupo(g[n], id(n))]));
const enquetesDe = (n) => q[n].enquetes();
ok("o núcleo tem cinco membros na mesma época", todos.every((n) => g[n] && g[n].epoca === g.ana.epoca));

// ═══════════════════ A enquete ═══════════════════
const PERGUNTA = "Levamos a pauta da tarifa zero à assembleia?";
const OPCOES = ["Sim, já", "Sim, depois do ato", "Não agora"];
const E = await q.ana.abrir(PERGUNTA, OPCOES);
await sincronizar();
let r = enquetesDe("bia").find((x) => x.id === E);
ok("quem abriu vê a própria enquete (o MLS não devolve as próprias mensagens: o aparelho guarda)", enquetesDe("ana").some((x) => x.id === E && x.autor === id("ana")));
ok("a bia vê a enquete que a ana abriu, com quem abriu", r && r.pergunta === PERGUNTA && r.opcoes.join("|") === OPCOES.join("|") && r.autor === id("ana") && !r.fechada);
await q.bia.votar(E, 0);
await q.caio.votar(E, 0);
await sincronizar();
r = enquetesDe("ana").find((x) => x.id === E);
ok("com 2 votos, nenhum número (só os votos, que não são secretos entre os membros)", r.contagem === null && r.votos.length === 2 && r.votos.some((v) => v.autor === id("bia") && v.opcao === 0));
await q.dani.votar(E, 2);
await q.dani.votar(E, 0); // muda de ideia: o último vale
await q.eva.votar(E, 7); // opção que não existe: não conta
await sincronizar();
r = enquetesDe("ana").find((x) => x.id === E);
ok("um voto por membro, o último vale; opção fora da lista não conta", r.votos.length === 3 && r.votos.find((v) => v.autor === id("dani"))?.opcao === 0 && !r.votos.some((v) => v.autor === id("eva")));
ok("com 3 votos na mesma opção, os números aparecem", JSON.stringify(r.contagem) === "[3,0,0]", JSON.stringify(r.contagem));
await q.eva.votar(E, 1);
await sincronizar();
r = enquetesDe("ana").find((x) => x.id === E);
ok("com uma opção com 1 voto, os números somem de novo (nenhum número abaixo de 3)", r.contagem === null && r.votos.length === 4);
await q.bia.fechar(E); // não foi ela quem abriu
await sincronizar();
ok("só quem abriu fecha", !enquetesDe("caio").find((x) => x.id === E).fechada);
await q.ana.fechar(E);
await q.eva.votar(E, 0); // depois do fechamento
await sincronizar();
r = enquetesDe("caio").find((x) => x.id === E);
ok("fechada pela ana; voto depois do fechamento não conta", r.fechada && r.votos.find((v) => v.autor === id("eva"))?.opcao === 1);
ok("todos os membros contam igual (as mesmas mensagens, na mesma ordem)", todos.every((n) => JSON.stringify(enquetesDe(n)) === JSON.stringify(enquetesDe("ana"))), todos.map((n) => n + ":" + JSON.stringify(enquetesDe(n).map((x) => [x.fechada, x.votos.map((v) => v.opcao + "/" + v.autor.slice(0, 4))]))).join(" "));

// Textos tortos e enquete que não existe.
await g.bia.mandarTexto(`${ROTULOS.enquete} {"t":"voto","id":"${crypto.randomUUID()}","o":0}`);
await g.bia.mandarTexto(`${ROTULOS.enquete} isto não é json`);
await g.bia.mandarTexto(`${ROTULOS.enquete} {"t":"enquete","id":"${crypto.randomUUID()}","p":"x","o":["só uma"]}`);
await sincronizar();
ok("voto em enquete que não existe, texto torto e enquete com uma opção só: ignorados", enquetesDe("ana").length === 1);
let recusou = 0;
for (const f of [() => q.ana.abrir("", ["a", "b"]), () => q.ana.abrir("ok?", ["só"]), () => q.ana.votar("nao-e-id", 0), () => q.ana.votar(E, -1)]) {
  try {
    await f();
  } catch {
    recusou++;
  }
}
ok("o aparelho recusa abrir enquete vazia ou de uma opção, e voto torto", recusou === 4);

// O servidor.
const tudo = Buffer.concat(servidor.guardado);
ok("o servidor guardou só pacotes de tamanho fixo", servidor.guardado.every((b) => TAMANHOS.has(b.length)));
ok("nem a pergunta, nem as opções, nem o rótulo da enquete aparecem no que o servidor guardou", ![PERGUNTA, ...OPCOES, ROTULOS.enquete].some((t) => tudo.includes(Buffer.from(t))));

// Quem sai do grupo não vota mais.
await g.ana.remover([paraB64(ap.eva.cliente.copyBytes())]);
await sincronizar();
let fora = false;
try {
  await q.eva.votar(E, 0);
} catch (e) {
  fora = /fora_do_grupo/.test(String(e?.message));
}
ok("quem saiu do grupo não deposita mais (nem voto)", fora);

// A tela da consulta à base diz a verdade (em 6 idiomas).
const blocos = fs.readFileSync(path.join(raiz, "components/rede/org/Blocos.tsx"), "utf8");
ok("o cartão da consulta mostra o texto honesto quando a pessoa não vota", /tc\.semVotoAgora/.test(blocos));
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const j = JSON.parse(fs.readFileSync(path.join(raiz, `i18n/rede/org/${l}.json`), "utf8"));
  ok(`o texto honesto em ${l}`, typeof j.consulta?.semVotoAgora === "string" && j.consulta.semVotoAgora.length > 80);
}
ok("em português: diz que não é secreta entre os membros e que o servidor não sabe quem é de núcleo", /não é secreta entre os membros/.test(JSON.parse(fs.readFileSync(path.join(raiz, "i18n/rede/org/pt.json"), "utf8")).consulta.semVotoAgora));

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
