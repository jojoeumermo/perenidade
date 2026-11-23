// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 1.1: o ratchet pós-quântico DURANTE a conversa (o SPQR do Signal, por camadas sobre o Proteus, dentro do envelope
// X-Wing). De verdade no Node: o build de referência do SPQR (nativo/spqr-wasm/spqr-1.7.0.wasm), o Proteus do core-crypto, o envelope
// X-Wing e a conversa (lib/rede/chat/r2/conversa.ts). Os ataques estão escritos como teste:
//   - quem quebra SÓ o X25519 (os segredos clássicos inteiros: o Proteus dos dois lados, o X25519 do X-Wing), mesmo no meio da
//     conversa, não abre a camada pós-quântica de nenhuma mensagem, nem a primeira nem as do meio, nem as seguintes;
//   - com o X25519 quebrado, forjar um "recomeço" do SPQR no meio da conversa (auth_key dele) é recusado;
//   - cura: quem roubou o estado INTEIRO do aparelho (Proteus, SPQR, X-Wing da semana) perde a conversa em até 12 idas e voltas;
//   - repetida, fora de ordem, perdida, adulterada (cada campo), auth_key trocada, versão 0x02 (sem a camada) e módulo trocado.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-pq.mjs
import fs from "node:fs";
import { motorNoNode } from "./cifra-no-node.mjs";
import { spqrNoNode, ARQUIVO_DO_SPQR } from "./spqr-no-node.mjs";
import { instanciarSpqr, MENSAGENS_POR_PACOTE, RESUMO_DO_SPQR } from "../lib/rede/chat/r3/spqr.ts";
import { abrirCamada, lerCamada, MARCA_DA_CAMADA, ROTULOS, selarCamada } from "../lib/rede/chat/r3/camada-pq.ts";
import { candidatos, menor, paraMandar } from "../lib/rede/chat/r3/sessao-pq.ts";
import { iguais, juntar, paraB64Url, sortear, texto, u32, completar } from "../lib/rede/chat/r2/bytes.ts";
import { corpoDeTexto, lerCorpoDeTexto, semKf } from "../lib/rede/chat/r2/bloco.ts";
import { novoParEd25519, certificarAparelho, assinarChaveDaSemana } from "../lib/rede/chat/r2/certificados.ts";
import { abrir, novoParXWing, semanaDe, TAMANHOS_DO_ENVELOPE, TAMANHOS_DO_PACOTE, VERSAO_VELHA } from "../lib/rede/chat/r2/envelope.ts";
import { ligarProteus, novasPreChaves, sessaoPelaPreChave, cifrar, esquecerSessao } from "../lib/rede/chat/r2/proteus.ts";
import { ESTADO_NOVO, ENVIO_NOVO } from "../lib/rede/chat/r2/ordem.ts";
import { mandar, receber, resumoDaCaixa } from "../lib/rede/chat/r2/conversa.ts";
import { ROTULOS as ROTULOS_R2 } from "../lib/rede/chat/r2/rotulos.ts";

let certos = 0;
const falhas = [];
function confere(nome, ok, detalhe = "") {
  if (ok) certos++;
  else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
}
async function recusa(nome, promessa, codigo) {
  try {
    await promessa();
    falhas.push(`${nome}: deveria recusar e passou`);
  } catch (erro) {
    if (!codigo || String(erro?.message ?? erro).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro?.message ?? erro}"`);
  }
}

const S = await spqrNoNode();
const M = await motorNoNode();

// ── O módulo ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const bytes = new Uint8Array(fs.readFileSync(ARQUIVO_DO_SPQR));
  confere("módulo: o arquivo do repositório é o build de referência (sha256 do código)", /^[0-9a-f]{64}$/.test(RESUMO_DO_SPQR));
  const trocado = Uint8Array.from(bytes);
  trocado[trocado.length - 10] ^= 1;
  await recusa("módulo: um byte trocado no WebAssembly não carrega", () => instanciarSpqr(trocado), "spqr_resumo");
  await recusa("módulo: outro build (o de teste, ou um feito noutra máquina) não carrega pelo caminho do site", () => instanciarSpqr(bytes, "0".repeat(64)), "spqr_resumo");
  confere("módulo: 8 mensagens do SPQR por pacote", MENSAGENS_POR_PACOTE === 8);
  await recusa("módulo: auth_key que não tem 32 bytes é recusada", async () => S.inicial("A2B", new Uint8Array(16)), "spqr_chave");
}

// ── A camada, só ela ──────────────────────────────────────────────────────────────────────────────────────────────────────
const parSpqr = () => {
  const ak = sortear(32);
  return { a: S.inicial("A2B", ak), b: S.inicial("B2A", ak), ak };
};
{
  let { a, b } = parSpqr();
  const apA = sortear(32);
  const apB = sortear(32);
  let todas = true;
  let maior = 0;
  for (let i = 0; i < 50; i++) {
    const x = await selarCamada(S, a, texto(`ida ${i}`), apA);
    a = x.estado;
    const y = await abrirCamada(S, b, x.camada, apA);
    if (!y || new TextDecoder().decode(y.proteus) !== `ida ${i}`) todas = false;
    else b = y.estado;
    const z = await selarCamada(S, b, texto(`volta ${i}`), apB);
    b = z.estado;
    const w = await abrirCamada(S, a, z.camada, apB);
    if (!w) todas = false;
    else a = w.estado;
    maior = Math.max(maior, x.camada.length - 8 - 40, z.camada.length - 9 - 40);
  }
  confere("camada: 50 idas e voltas abrem dos dois lados", todas);
  confere("camada: o que a camada acrescenta cabe com folga no bloco de 2048 (≤ 400 bytes)", maior <= 400, String(maior));

  // Adulteração de cada campo: marca, número de mensagens, comprimento e conteúdo de cada mensagem do SPQR, nonce, cifrado, aparelho.
  const x = await selarCamada(S, a, texto("conteúdo"), apA);
  a = x.estado;
  const lida = lerCamada(x.camada);
  confere("camada: o formato lido tem 8 mensagens, nonce de 24 e cifrado com marca de 16", lida && lida.msgs.length === 8 && lida.nonce.length === 24 && lida.cifrado.length === texto("conteúdo").length + 16);
  const posicoes = { marca: 0, n: 1 };
  let i = 2;
  for (let j = 0; j < 8; j++) {
    posicoes[`comprimento ${j + 1}`] = i + 1;
    posicoes[`mensagem ${j + 1}`] = i + 2;
    i += 2 + lida.msgs[j].length;
  }
  posicoes.nonce = i + 3;
  posicoes.cifrado = x.camada.length - 20;
  posicoes["marca do AEAD"] = x.camada.length - 1;
  let todasRecusadas = true;
  const quais = [];
  for (const [nome, p] of Object.entries(posicoes)) {
    const mexida = Uint8Array.from(x.camada);
    mexida[p] ^= 1;
    if ((await abrirCamada(S, b, mexida, apA)) !== null) {
      todasRecusadas = false;
      quais.push(nome);
    }
  }
  confere("ataque: um bit trocado em qualquer campo da camada é recusado (marca, n, cada mensagem do SPQR, nonce, cifrado)", todasRecusadas, quais.join(", "));
  confere("ataque: a camada dita de outro aparelho não abre (o aparelho entra no aad)", (await abrirCamada(S, b, x.camada, apB)) === null);
  confere("ataque: camada cortada é recusada", (await abrirCamada(S, b, x.camada.subarray(0, x.camada.length - 1), apA)) === null);
  const certa = await abrirCamada(S, b, x.camada, apA);
  confere("camada: depois de tudo isso, a verdadeira abre (nada foi gasto pelas recusadas)", certa !== null);
  b = certa.estado;
  confere("ataque: a mesma camada de novo (repetida) é recusada: o SPQR não dá a mesma chave duas vezes", (await abrirCamada(S, b, x.camada, apA)) === null);

  // Fora de ordem e perdida.
  const c = [];
  for (let k = 0; k < 5; k++) {
    const s = await selarCamada(S, a, texto(`m${k}`), apA);
    a = s.estado;
    c.push(s.camada);
  }
  let est = b;
  const ordem = [2, 0, 1, 4];
  let foraDeOrdemOk = true;
  for (const k of ordem) {
    const r = await abrirCamada(S, est, c[k], apA);
    if (!r || new TextDecoder().decode(r.proteus) !== `m${k}`) foraDeOrdemOk = false;
    else est = r.estado;
  }
  confere("fora de ordem: 3, 1, 2 e 5 abrem nessa ordem (a 4 se perdeu)", foraDeOrdemOk);
  const quarta = await abrirCamada(S, est, c[3], apA);
  confere("perdida que chega tarde: a 4 ainda abre", quarta !== null);
  confere("repetida depois de fora de ordem: a 3 de novo é recusada", (await abrirCamada(S, quarta?.estado ?? est, c[2], apA)) === null);

  // Formato velho / outro: marca ou número de mensagens diferentes.
  const outraMarca = Uint8Array.from(c[0]);
  outraMarca[0] = 0x50;
  confere("ataque: camada com outra marca (formato que não é este) é recusada", lerCamada(outraMarca) === null && MARCA_DA_CAMADA === 0x51);
  const menos = Uint8Array.from(c[0]);
  menos[1] = 4;
  confere("ataque: camada com menos mensagens do SPQR (\"cura mais lenta\") é recusada", lerCamada(menos) === null);
  confere("rótulos: os da camada são novos e próprios", ROTULOS.camada === "alumia/r3/pq/camada/v1" && ROTULOS.aad === "alumia/r3/pq/aad/v1");
}

// ── Aparelhos de verdade (Proteus + X-Wing + SPQR) ────────────────────────────────────────────────────────────────────────
const hoje = Math.floor(Date.now() / 86_400_000);
const semana = semanaDe();
async function novoAparelho(conta) {
  const identidade = novoParEd25519();
  const motor = M.CoreCrypto.new(M.Database.inMemory());
  const impressao = await ligarProteus(motor);
  const chave = novoParEd25519();
  const xw = await novoParXWing();
  const semanas = new Map([[semana, xw.privada]]);
  const registros = new Map();
  const pq = { motor: S, ler: (ap) => registros.get(paraB64Url(ap)) ?? null, gravar: (ap, r) => void registros.set(paraB64Url(ap), r) };
  const publico = {
    aparelho: chave.publica, certificado: certificarAparelho(identidade, conta, chave.publica, impressao, hoje), xwing: xw.publica, semana,
    xwingAssinatura: assinarChaveDaSemana(chave, xw.publica, semana),
  };
  return { conta, motor, chave, impressao, publico, semanas, registros, xw, eu: { conta, aparelho: chave.publica, motor, chaveDaSemana: async (s) => semanas.get(s) ?? null, pq } };
}

/** Uma conversa entre dois aparelhos, com as caixas em memória e o que o servidor (e o atacante) vê. */
async function novaConversa() {
  const ana = await novoAparelho("ana");
  const bia = await novoAparelho("bia");
  const [pre] = await novasPreChaves(bia.motor, bia.chave, 1);
  await sessaoPelaPreChave(ana.motor, bia.chave.publica, bia.impressao, pre);
  const conversa = sortear(16);
  const caixas = { ana: { id: sortear(32), pd: sortear(32) }, bia: { id: sortear(32), pd: sortear(32) } };
  const fila = { ana: [], bia: [] };
  const visto = [];
  const depositar = (quem) => async (_caixa, envelope, franquia) => {
    fila[quem].push({ envelope, franquia });
    visto.push({ para: quem, envelope, franquia });
    return { ok: true };
  };
  const envio = { ana: ENVIO_NOVO, bia: ENVIO_NOVO };
  const ordem = { ana: ESTADO_NOVO, bia: ESTADO_NOVO };
  const outro = (quem) => (quem === "ana" ? bia : ana);
  const ap = (quem) => (quem === "ana" ? ana : bia);
  const conhecido = (quem) => (a) => (iguais(a, outro(quem).chave.publica) ? { conta: outro(quem).conta, impressao: outro(quem).impressao, meu: false } : null);
  async function manda(de, t) {
    const para = de === "ana" ? "bia" : "ana";
    const r = await mandar(ap(de).eu, [{ aparelho: outro(de).publico, caixa: caixas[para], tipo: "mensagem" }], envio[de], { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t }) }, depositar(para), async () => {});
    envio[de] = r.estado;
    return r;
  }
  async function recebe(quem, pacote) {
    const r = await receber(ap(quem).eu, caixas[quem].id, pacote, conversa, conhecido(quem), () => ordem[quem]);
    if (r.ok) ordem[quem] = r.estado;
    return r;
  }
  async function recebeTudo(quem) {
    const saida = [];
    for (const p of fila[quem].splice(0)) saida.push(await recebe(quem, p));
    return saida;
  }
  /** O que está DENTRO do envelope de um pacote para `quem` (o atacante dos testes de cura tem a chave X-Wing da semana roubada). */
  const dentroDe = async (quem, p) => abrir(ap(quem).semanas.get(semana), semana, resumoDaCaixa(caixas[quem].id), p.franquia, p.envelope);
  return { ana, bia, conversa, caixas, fila, visto, manda, recebe, recebeTudo, dentroDe };
}

// ── Aceite 1: quem quebra só o X25519, mesmo no meio da conversa, não lê as mensagens seguintes ──────────────────────────────
{
  const c = await novaConversa();
  let todasLidas = true;
  for (let i = 0; i < 20; i++) {
    await c.manda("ana", `ana ${i}`);
    const [r1] = await c.recebeTudo("bia");
    await c.manda("bia", `bia ${i}`);
    const [r2] = await c.recebeTudo("ana");
    if (!r1?.ok || !r2?.ok || lerCorpoDeTexto(r1.bloco.corpo).t !== `ana ${i}` || lerCorpoDeTexto(r2.bloco.corpo).t !== `bia ${i}`) todasLidas = false;
  }
  confere("conversa: 20 idas e voltas com a camada pós-quântica abrem dos dois lados", todasLidas);
  confere("conversa: todo pacote ficou do tamanho da mensagem curta (o banco aceita os mesmos tamanhos)", c.visto.every((v) => v.envelope.length === TAMANHOS_DO_PACOTE[0]));

  // O atacante "quebra só o X25519": tem os segredos clássicos inteiros. Para este teste, o envelope é aberto PARA ele (o que exigiria
  // também o ML-KEM do X-Wing) MENOS a auth_key do SPQR, que só o ML-KEM protege; e o Proteus de dentro ele leria. O que falta é a
  // chave da camada, que só sai do SPQR. Ele tenta: estados do SPQR com auth_key sorteada (64), zerada, a do próprio teste anterior,
  // e a chave da camada feita de zeros. Nenhuma camada abre: nem a primeira, nem as do meio (a quebra "no meio" não muda nada).
  const camadas = [];
  for (const v of c.visto) {
    const d = await c.dentroDe(v.para, v);
    camadas.push({ para: v.para, camada: d.camada, aparelho: d.aparelho });
  }
  const tentativas = [];
  for (let k = 0; k < 64; k++) tentativas.push(S.inicial(k % 2 ? "A2B" : "B2A", sortear(32)));
  tentativas.push(S.inicial("B2A", new Uint8Array(32)), S.inicial("A2B", new Uint8Array(32)));
  let abriu = 0;
  for (const x of camadas) for (const st of tentativas) if (await abrirCamada(S, st, x.camada, x.aparelho)) abriu++;
  confere("ACEITE 1.1: com só os segredos clássicos, nenhuma das 40 camadas abre (primeira, do meio e seguintes)", abriu === 0, `${abriu} abriram`);

  // Com o X25519 quebrado, o atacante FORJA o Proteus da Ana (aqui: usa o motor dela, o mesmo poder) e tenta "recomeçar" o SPQR da
  // Bia no meio da conversa com uma auth_key dele, para ler as respostas dela.
  const akDoAtacante = sortear(32);
  const stAtacante = S.inicial("A2B", akDoAtacante);
  const antes = c.bia.registros.get(paraB64Url(c.ana.chave.publica));
  const { montar, novoBloco } = await import("../lib/rede/chat/r2/bloco.ts");
  const bloco = montar(novoBloco({ tipo: "texto", conversa: c.conversa, contador: 999, anterior: new Uint8Array(32), prazo: 7, corpo: corpoDeTexto({ t: "forjada" }) }));
  const proteus = await cifrar(c.ana.motor, c.bia.chave.publica, bloco);
  const sel = await selarCamada(S, stAtacante, proteus, c.ana.chave.publica);
  const idH = resumoDaCaixa(c.caixas.bia.id);
  const { compromisso } = await import("../lib/rede/chat/r2/conversa.ts");
  const franquia = compromisso(bloco.subarray(75, 107), idH, semKf(bloco));
  const { selar } = await import("../lib/rede/chat/r2/envelope.ts");
  const envelope = await selar(c.bia.publico.xwing, semana, idH, franquia, { tipo: "mensagem", aparelho: c.ana.chave.publica, inicio: akDoAtacante, camada: sel.camada });
  const r = await c.recebe("bia", { envelope, franquia });
  confere("ataque (X25519 quebrado, no meio): \"recomeço\" do SPQR com a auth_key do atacante é recusado", !r.ok && r.motivo === "nao_abre", JSON.stringify(r.motivo));
  confere("ataque (X25519 quebrado, no meio): o estado SPQR da Bia não mudou", iguais(c.bia.registros.get(paraB64Url(c.ana.chave.publica)).e, antes.e));
  await c.manda("bia", "depois do ataque");
  const [depois] = c.fila.ana;
  const dDepois = await c.dentroDe("ana", depois);
  confere("ataque (X25519 quebrado, no meio): a resposta seguinte da Bia não abre com o estado do atacante",
    (await abrirCamada(S, S.inicial("B2A", akDoAtacante), dDepois.camada, dDepois.aparelho)) === null && (await abrirCamada(S, stAtacante, dDepois.camada, dDepois.aparelho)) === null);
  const [ok] = await c.recebeTudo("ana");
  confere("ataque (X25519 quebrado, no meio): ... e a Ana lê a resposta normalmente", ok?.ok && lerCorpoDeTexto(ok.bloco.corpo).t === "depois do ataque");
  confere("início: a auth_key só vai nos pacotes de quem começou, até a primeira resposta (depois, nenhum pacote leva)",
    (await c.dentroDe("bia", c.visto[0])).inicio !== null && (await c.dentroDe("bia", c.visto[2])).inicio === null && (await c.dentroDe("ana", c.visto[1])).inicio === null);
}

// ── Aceite 2: cura. Quem rouba o aparelho inteiro na volta N deixa de ler em até N + 12 idas e voltas ────────────────────────
async function cura(roubarNa, voltas, quemTemSoAAuthKey = false) {
  const c = await novaConversa();
  let ladrao = null;
  let perdeuEm = null;
  let leuDepoisDePerder = false;
  for (let i = 0; i < voltas; i++) {
    await c.manda("ana", `ana ${i}`);
    const pacote = c.fila.bia[0];
    if (quemTemSoAAuthKey && i === 0) {
      // Sem roubo de aparelho: o atacante abriu o envelope (X-Wing inteiro quebrado) e tem a auth_key da primeira mensagem.
      const d = await c.dentroDe("bia", pacote);
      ladrao = S.inicial("B2A", d.inicio);
    }
    if (ladrao && (i > roubarNa || quemTemSoAAuthKey)) {
      const d = await c.dentroDe("bia", pacote);
      const r = await abrirCamada(S, ladrao, d.camada, d.aparelho);
      if (r) {
        ladrao = r.estado;
        if (perdeuEm !== null) leuDepoisDePerder = true;
      } else if (perdeuEm === null) perdeuEm = i;
    }
    await c.recebeTudo("bia");
    if (!quemTemSoAAuthKey && i === roubarNa) ladrao = Uint8Array.from(c.bia.registros.get(paraB64Url(c.ana.chave.publica)).e);
    await c.manda("bia", `bia ${i}`);
    await c.recebeTudo("ana");
  }
  return { perdeuEm, leuDepoisDePerder };
}
{
  const N = 10;
  const r = await cura(N, 40);
  confere("ACEITE 1.1 (cura): o ladrão com o estado inteiro da Bia na volta 10 perde a conversa em até 12 idas e voltas",
    r.perdeuEm !== null && r.perdeuEm - N <= 12, `perdeu na volta ${r.perdeuEm} (${r.perdeuEm === null ? "nunca" : r.perdeuEm - N} depois do roubo)`);
  confere("cura: depois de perder, não volta a ler", !r.leuDepoisDePerder);
  console.log(`  (cura: o ladrão da volta ${N} perdeu na volta ${r.perdeuEm}, ${r.perdeuEm - N} idas e voltas depois)`);
  const s = await cura(0, 30, true);
  confere("cura: quem só tem a auth_key (X-Wing inteiro quebrado, sem roubo) também perde a conversa em até 12 idas e voltas", s.perdeuEm !== null && s.perdeuEm <= 12, String(s.perdeuEm));
  confere("cura: ... e não volta a ler", !s.leuDepoisDePerder);
  console.log(`  (cura: quem só tem a auth_key da primeira mensagem perdeu na volta ${s.perdeuEm})`);
}

// ── Repetida, fora de ordem, perdida, auth_key trocada, 0x02 ──────────────────────────────────────────────────────────────
{
  const c = await novaConversa();
  await c.manda("ana", "primeira");
  const [p1] = c.fila.bia;

  // auth_key trocada no primeiro pacote (o servidor não consegue, mas quem quebrou o X-Wing sim): a Bia ainda não tem estado.
  const d = await c.dentroDe("bia", p1);
  const { selar } = await import("../lib/rede/chat/r2/envelope.ts");
  const trocada = await selar(c.bia.publico.xwing, semana, resumoDaCaixa(c.caixas.bia.id), p1.franquia, { ...d, inicio: sortear(32) });
  const rt = await c.recebe("bia", { envelope: trocada, franquia: p1.franquia });
  confere("ataque: o primeiro pacote com a auth_key trocada não abre", !rt.ok && rt.motivo === "nao_abre");
  confere("ataque: ... e não deixou estado SPQR na Bia", c.bia.registros.size === 0);
  const semInicio = await selar(c.bia.publico.xwing, semana, resumoDaCaixa(c.caixas.bia.id), p1.franquia, { ...d, inicio: null });
  confere("ataque: o primeiro pacote sem a auth_key não abre (sem estado, não há com que abrir)", !(await c.recebe("bia", { envelope: semInicio, franquia: p1.franquia })).ok);
  const [r1] = await c.recebeTudo("bia");
  confere("o verdadeiro abre depois disso tudo", r1.ok && lerCorpoDeTexto(r1.bloco.corpo).t === "primeira");
  const rep = await c.recebe("bia", p1);
  confere("ataque: o mesmo pacote de novo (repetido) é recusado", !rep.ok);

  for (const t of ["2", "3", "4", "5"]) await c.manda("ana", t);
  const [q2, q3, q4, q5] = c.fila.bia.splice(0);
  const a5 = await c.recebe("bia", q5);
  const a2 = await c.recebe("bia", q2);
  const a3 = await c.recebe("bia", q3);
  confere("fora de ordem: 5, 2, 3 abrem (com o aviso da ordem)", a5.ok && a2.ok && a3.ok && a2.avisos.includes("fora_de_ordem"));
  confere("perdida: sem a 4, a conversa segue", lerCorpoDeTexto(a3.bloco.corpo).t === "3");
  const a4 = await c.recebe("bia", q4);
  confere("perdida que chega tarde: a 4 abre", a4.ok);
  confere("repetida fora de ordem: a 2 de novo é recusada", !(await c.recebe("bia", q2)).ok);

  // Versão 0x02 (a da R2, sem a camada): o envelope é feito com a mesma suíte, por fora do código (como faria quem quer "baixar" a versão).
  const [{ CipherSuite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
  const suite = new CipherSuite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  const proteus = await cifrar(c.ana.motor, c.bia.chave.publica, texto("sem camada"));
  const velho = completar(juntar(new Uint8Array([VERSAO_VELHA, 1]), c.ana.chave.publica, u32(proteus.length), proteus), TAMANHOS_DO_ENVELOPE);
  const idH = resumoDaCaixa(c.caixas.bia.id);
  const franquia = sortear(32);
  const pk = await suite.kem.deserializePublicKey(Uint8Array.from(c.bia.publico.xwing));
  const { ct, enc } = await suite.seal({ recipientPublicKey: pk, info: texto(ROTULOS_R2.envelope) }, velho, juntar(idH, franquia, u32(semana)));
  const env02 = juntar(new Uint8Array(enc), new Uint8Array(ct));
  confere("ataque (downgrade): um envelope com dentro 0x02 (só o Proteus) não abre", (await abrir(c.bia.semanas.get(semana), semana, idH, franquia, env02)) === null);
  const r02 = await c.recebe("bia", { envelope: env02, franquia });
  confere("ataque (downgrade): ... e a conversa o recusa", !r02.ok && r02.motivo === "nao_abre");
}

// ── Começo simultâneo, sessão Proteus refeita, tamanho grande ──────────────────────────────────────────────────────────────
{
  const c = await novaConversa();
  // A Bia também abre sessão Proteus com a Ana pela pré-chave e as duas mandam antes de receber.
  const [preAna] = await novasPreChaves(c.ana.motor, c.ana.chave, 1);
  await sessaoPelaPreChave(c.bia.motor, c.ana.chave.publica, c.ana.impressao, preAna);
  await c.manda("ana", "da ana");
  await c.manda("bia", "da bia");
  const rb = await c.recebeTudo("bia");
  const ra = await c.recebeTudo("ana");
  const anaMenor = menor(c.ana.chave.publica, c.bia.chave.publica);
  // Vale o começo do aparelho de MENOR chave: a mensagem dele abre; a do outro (começada com outra auth_key) se perde.
  const daMenor = anaMenor ? rb[0] : ra[0];
  confere("começo simultâneo: vale o começo do aparelho de menor chave (a mensagem dele abre)", daMenor?.ok === true);
  await c.manda("ana", "depois");
  await c.manda("bia", "depois");
  const [rb2] = await c.recebeTudo("bia");
  const [ra2] = await c.recebeTudo("ana");
  confere("começo simultâneo: depois do desempate, os dois lados se leem", rb2?.ok && ra2?.ok, JSON.stringify([rb2?.motivo, ra2?.motivo]));

  // Sessão Proteus refeita (30 dias sem resposta, ou esquecida): o estado do SPQR continua e a conversa segue.
  await esquecerSessao(c.ana.motor, c.bia.chave.publica);
  const [pre] = await novasPreChaves(c.bia.motor, c.bia.chave, 1);
  await sessaoPelaPreChave(c.ana.motor, c.bia.chave.publica, c.bia.impressao, pre);
  await c.manda("ana", "sessão nova");
  const [rn] = await c.recebeTudo("bia");
  confere("sessão Proteus refeita: o SPQR continua e a mensagem abre", rn?.ok && lerCorpoDeTexto(rn.bloco.corpo).t === "sessão nova", JSON.stringify(rn?.motivo));

  const longo = "ã".repeat(2000);
  await c.manda("ana", longo);
  const [rl] = await c.recebeTudo("bia");
  confere("tamanho: o texto mais longo (2000 caracteres) abre, num dos tamanhos que o banco aceita", rl?.ok && TAMANHOS_DO_PACOTE.includes(c.visto.at(-1).envelope.length));
  const reg = c.ana.registros.get(paraB64Url(c.bia.chave.publica));
  console.log(`  (estado do SPQR por aparelho: ${reg.e.length} bytes)`);
  confere("estado: o registro do SPQR por aparelho fica abaixo de 8 KB", reg.e.length < 8192, String(reg.e.length));
}

// ── Os candidatos: um estado confirmado nunca é trocado ───────────────────────────────────────────────────────────────────
{
  const regs = new Map();
  const pq = { motor: S, ler: (a) => regs.get(paraB64Url(a)) ?? null, gravar: (a, r) => regs.set(paraB64Url(a), r) };
  const eu = new Uint8Array(32).fill(0x80);
  const deMenor = new Uint8Array(32).fill(0x10);
  const deMaior = new Uint8Array(32).fill(0xf0);
  confere("sessão: sem estado e sem auth_key, nada com que abrir", candidatos(pq, deMenor, null, eu).length === 0);
  confere("sessão: sem estado, com auth_key, um B2A novo", candidatos(pq, deMenor, sortear(32), eu).length === 1);
  pq.gravar(deMenor, { e: S.inicial("B2A", sortear(32)), a: null });
  confere("sessão: estado CONFIRMADO + pacote com auth_key: só o estado de antes (sem recomeço)", candidatos(pq, deMenor, sortear(32), eu).length === 1);
  const meu = paraMandar(pq, deMaior);
  pq.gravar(deMaior, meu);
  confere("sessão: começo meu sem resposta + auth_key de chave MAIOR: fica o meu (sem troca)", candidatos(pq, deMaior, sortear(32), eu).length === 1);
  const outro = new Uint8Array(32).fill(0x01);
  pq.gravar(outro, paraMandar(pq, outro));
  confere("sessão: começo meu sem resposta + auth_key de chave MENOR: o dela entra como segunda tentativa", candidatos(pq, outro, sortear(32), eu).length === 2);
  confere("sessão: paraMandar reaproveita o que existe e só sorteia auth_key quando não há estado", paraMandar(pq, deMenor).a === null && paraMandar(pq, sortear(32)).a?.length === 32);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  FALHA ${f}`);
  process.exit(1);
}
