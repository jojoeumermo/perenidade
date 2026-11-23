// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O aceite do item 2.2 da onda R3 (mensagens sem internet; documento público: docs/rede/SEM-INTERNET.md), com aparelhos simulados
// (lib/rede/malha/simulado.ts) e as cifras de verdade da conversa a dois (o Proteus do @wireapp/core-crypto, o envelope X-Wing).
// Os ataques estão escritos como teste:
//   - Ana → R1 → R2 → Bia sem internet, cada par só se encontra em sequência: a mensagem chega e abre com as MESMAS sessões;
//   - R1 e R2 não abrem nada e não distinguem o pacote da Ana de um pacote de cobertura (nem ligam dois pacotes ao mesmo destino);
//   - pacote vencido, repetido (os mesmos bytes ou o mesmo corpo com outro cabeçalho), malformado (fast-check, 10⁴ casos), de
//     tamanho errado e de outro ato: recusados sem derrubar nada; o aparelho continua entregando depois;
//   - o aparelho malicioso por perto: não identifica o grupo (o ato) pelo farol, não repete pacotes, não volta o farol a um estado
//     velho, não forja o farol com uma assinatura só nem com chave de fora da lista;
//   - o "Estou bem" pela malha, e o desligar que apaga tudo.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-malha.mjs
import fc from "fast-check";
import { motorNoNode } from "./cifra-no-node.mjs";
import { spqrNoNode } from "./spqr-no-node.mjs";
import { iguais, paraB64Url, sortear, juntar, u32 } from "../lib/rede/chat/r2/bytes.ts";
import { corpoDeTexto, lerCorpoDeTexto } from "../lib/rede/chat/r2/bloco.ts";
import { novoParEd25519, certificarAparelho, assinarChaveDaSemana } from "../lib/rede/chat/r2/certificados.ts";
import { novoParXWing, semanaDe } from "../lib/rede/chat/r2/envelope.ts";
import { ligarProteus, novasPreChaves, sessaoPelaPreChave } from "../lib/rede/chat/r2/proteus.ts";
import { ESTADO_NOVO, ENVIO_NOVO } from "../lib/rede/chat/r2/ordem.ts";
import { mandar, receber } from "../lib/rede/chat/r2/conversa.ts";
import { ROTULOS as ROTULOS_R2 } from "../lib/rede/chat/r2/rotulos.ts";
import {
  TAMANHO_DO_PACOTE, TAMANHO_DO_ENVELOPE, CABECALHO, VALIDADE_PADRAO, ROTULOS, ler, eParaMim, montarMensagem, montarFarol, montarCobertura, chaveDeDestino,
  chaveDaEtiquetaDoAto, horaDe, resumoDoPacote, depositoDe,
} from "../lib/rede/malha/pacote.ts";
import { NoDaMalha, GUARDA_MAXIMA, POR_ENCONTRO, RECEBE_POR_ENCONTRO, VISTOS_MAXIMO } from "../lib/rede/malha/no.ts";
import { RedeSimulada } from "../lib/rede/malha/simulado.ts";
import { entregador } from "../lib/rede/malha/entrega.ts";
import { assinarFarol, codificarFarol, chaveDoFarol, bytesDoUuid } from "../lib/rede/malha/farol.ts";
import { controleEstouBem, lerEstouBem, depositarNaMalha, comMalha } from "../lib/rede/malha/estou-bem.ts";

let certos = 0;
const falhas = [];
function confere(nome, ok, detalhe = "") {
  if (ok) certos++;
  else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
}
async function naoLanca(nome, f) {
  try {
    await f();
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: lançou ${erro?.message ?? erro}`);
  }
}

const M = await motorNoNode();
// A camada pós-quântica da conversa a dois (onda R3, frente pq-trafego-mixnet): toda mensagem leva o SPQR por cima do Proteus, também
// pela malha (o pacote sem internet carrega o mesmo envelope).
const SPQR = await spqrNoNode();
const pqNaMemoria = () => {
  const m = new Map();
  return { motor: SPQR, ler: (a) => m.get(paraB64Url(a)) ?? null, gravar: (a, r) => void m.set(paraB64Url(a), r) };
};
const hoje = Math.floor(Date.now() / 86_400_000);
const semana = semanaDe();
const HORA = 3_600_000;

// ── Aparelhos de chat de verdade: Ana e Bia, sessão Proteus aberta com internet (antes do ato) ─────────────────────────────
async function novoAparelho(conta, identidade) {
  const motor = M.CoreCrypto.new(M.Database.inMemory());
  const impressao = await ligarProteus(motor);
  const chave = novoParEd25519();
  const xw = await novoParXWing();
  const semanas = new Map([[semana, xw.privada]]);
  const publico = {
    aparelho: chave.publica,
    certificado: certificarAparelho(identidade, conta, chave.publica, impressao, hoje),
    xwing: xw.publica,
    semana,
    xwingAssinatura: assinarChaveDaSemana(chave, xw.publica, semana),
  };
  return { conta, motor, chave, impressao, publico, eu: { conta, aparelho: chave.publica, motor, chaveDaSemana: async (s) => semanas.get(s) ?? null, pq: pqNaMemoria() } };
}
const ana = await novoAparelho("ana", novoParEd25519());
const bia = await novoAparelho("bia", novoParEd25519());
await sessaoPelaPreChave(ana.motor, bia.chave.publica, bia.impressao, (await novasPreChaves(bia.motor, bia.chave, 1))[0]);
const conversa = sortear(16);
const entradaBia = { id: sortear(32), pd: sortear(32) };
const destinosDaAna = [{ aparelho: bia.publico, caixa: entradaBia, tipo: "mensagem" }];
const conhecidosDaBia = (a) => (iguais(a, ana.chave.publica) ? { conta: "ana", impressao: ana.impressao, meu: false } : null);
let ordemNaBia = ESTADO_NOVO;
const nada = async () => {};

// ── 1. O pacote ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const cob = await montarCobertura();
  confere("pacote: tamanho fixo de 3254 bytes", cob.length === TAMANHO_DO_PACOTE && TAMANHO_DO_PACOTE === 3254, String(cob.length));
  confere("pacote: a validade padrão é 24 horas e a cobertura usa a mesma", ler(cob).validade === horaDe(Date.now()) + VALIDADE_PADRAO);
  confere("pacote: vencido (validade na hora anterior) é recusado", ler(cob, Date.now() + (VALIDADE_PADRAO + 1) * HORA) === null);
  confere("pacote: validade além de 24 h à frente é recusada", ler(cob, Date.now() - 2 * HORA) === null);
  confere("pacote: tamanho errado é recusado", ler(cob.subarray(1)) === null && ler(juntar(cob, new Uint8Array(1))) === null);
  const outra = Uint8Array.from(cob);
  outra[1] = 2;
  confere("pacote: versão desconhecida é recusada", ler(outra) === null);
  confere("pacote: o que não é bytes é recusado sem lançar", ler("x") === null && ler(null) === null && ler(new Array(3254).fill(0)) === null);
  let lancou = false;
  try {
    montarMensagem(sortear(32), sortear(32), sortear(4000), 24);
  } catch {
    lancou = true;
  }
  confere("pacote: envelope maior que o bloco de 2048 não cabe (vai só pela caixa)", lancou);
  confere("rótulos da malha: nenhum se repete nem repete um da R2", new Set([...Object.values(ROTULOS), ...Object.values(ROTULOS_R2)]).size === Object.values(ROTULOS).length + Object.values(ROTULOS_R2).length);
}

// ── 2. Aceite: Ana → R1 → R2 → Bia, sem internet ────────────────────────────────────────────────────────────────────────────
const rede = new RedeSimulada();
function noSimulado(entregar, opcoes = {}) {
  const t = rede.aparelho();
  const no = new NoDaMalha(t, entregar, { cobertura: () => montarCobertura(), ...opcoes });
  no.ligar();
  return { t, no };
}
const recebidosDaBia = [];
const caixasDeR = [sortear(32)];
const entregaDeR = (quem) => entregador({ caixas: () => caixasDeR, atos: () => [], mensagem: async () => { quem.abriu++; return true; }, farol: () => { quem.abriu++; } });
const r1q = { abriu: 0 };
const r2q = { abriu: 0 };
const entregaDaBia = entregador({
  caixas: () => [entradaBia.id],
  atos: () => [],
  mensagem: async (caixaId, d) => {
    const r = await receber(bia.eu, caixaId, { envelope: d.envelope, franquia: d.c }, conversa, conhecidosDaBia, () => ordemNaBia);
    if (r.ok) {
      ordemNaBia = r.estado;
      recebidosDaBia.push(r);
    } else recebidosDaBia.push(r);
    return r.ok;
  },
  farol: () => {},
});
const A = noSimulado(async () => false);
const R1 = noSimulado(entregaDeR(r1q));
const R2 = noSimulado(entregaDeR(r2q));
const B = noSimulado(entregaDaBia);

let envioAna = ENVIO_NOVO;
{
  const r = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "cheguei no ponto 2" }) }, depositarNaMalha(A.no), nada);
  envioAna = r.estado;
  confere("aceite: a mensagem da Ana virou um pacote guardado no aparelho dela", r.entregues === 1 && A.no.quantos === 1);
  const daAna = A.no.copiaDoGuardado()[0];
  const vistosR1 = [];
  await rede.encontrar(A.t, R1.t, (p) => vistosR1.push(p));
  confere("aceite: Ana encontra R1 (só R1 por perto): R1 guarda o pacote", R1.no.copiaDoGuardado().some((p) => iguais(p, daAna)));
  confere("aceite: Bia ainda não recebeu nada (não encontrou ninguém)", recebidosDaBia.length === 0);
  const vistosR2 = [];
  await rede.encontrar(R1.t, R2.t, (p) => vistosR2.push(p));
  confere("aceite: R1 encontra R2 (Ana já foi embora): R2 guarda o pacote", R2.no.copiaDoGuardado().some((p) => iguais(p, daAna)));
  await rede.encontrar(R2.t, B.t);
  const ok = recebidosDaBia.filter((x) => x.ok);
  confere("aceite: R2 encontra Bia: a mensagem chega e abre (3 saltos, sem internet)", ok.length === 1 && lerCorpoDeTexto(ok[0].bloco.corpo).t === "cheguei no ponto 2", JSON.stringify(recebidosDaBia.map((x) => x.motivo ?? "ok")));
  confere("aceite: abriu com a MESMA sessão Proteus (a do chat, sem nada novo) e a mesma ordem (contador 1)", ok[0]?.bloco.contador === 1 && ok[0]?.de.conta === "ana");
  confere("aceite: R1 e R2 não abriram nada", r1q.abriu === 0 && r2q.abriu === 0);
  confere("aceite: o pacote reconhecido pela Bia continua guardado para repassar (parar diria \"era para mim\")", B.no.copiaDoGuardado().some((p) => iguais(p, daAna)));

  // R1 não distingue o pacote da Ana de uma cobertura.
  const cobs = [];
  for (let i = 0; i < 12; i++) cobs.push(await montarCobertura());
  const reais = [daAna];
  for (let i = 0; i < 11; i++) {
    const r2 = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: `m${i}` }) }, async (c, e, f) => ({ ok: !!reais.push(montarMensagem(c.id, f, e, VALIDADE_PADRAO)) }), nada);
    envioAna = r2.estado;
  }
  const campos = (p) => ({ cab: p.subarray(0, 6), alto: p[CABECALHO + 32 + 1120 - 1] & 0x80 });
  confere("cobertura: o mesmo cabeçalho fixo (marca, versão, validade) da mensagem", reais.every((p) => iguais(campos(p).cab, campos(cobs[0]).cab)) && cobs.every((p) => iguais(campos(p).cab, campos(reais[0]).cab)));
  // Com a camada da malha, o corpo da mensagem vai cifrado: o bit alto da chave X25519 do `enc` não aparece mais em claro (antes ele
  // ficava zero e a cobertura tinha de imitá-lo); nas duas, o bit daquela posição é de sorteio.
  const bitsUm = (ps) => ps.reduce((n, p) => n + [...p.subarray(CABECALHO)].reduce((a, b) => a + b.toString(2).split("1").length - 1, 0), 0) / ps.reduce((n, p) => n + (p.length - CABECALHO) * 8, 0);
  confere("cobertura: a fração de bits 1 do corpo é de sorteio nas duas (mensagem cifrada e cobertura)", [reais, cobs].every((ps) => Math.abs(bitsUm(ps) - 0.5) < 0.01), `${bitsUm(reais).toFixed(4)} × ${bitsUm(cobs).toFixed(4)}`);
  {
    // 64 pacotes com o MESMO depósito (o bit alto do `enc` zero): com a camada da malha, aquele bit vira sorteio no pacote.
    const env = Uint8Array.from(reais.length ? depositoDe(ler(reais[1]), entradaBia.id).envelope : sortear(TAMANHO_DO_ENVELOPE));
    env[1119] &= 0x7f;
    const muitos = Array.from({ length: 64 }, () => montarMensagem(entradaBia.id, sortear(32), env, VALIDADE_PADRAO));
    confere("cobertura: o bit alto da chave X25519 do X-Wing não fica em claro (não é zero em todos os 64 pacotes)", muitos.some((p) => campos(p).alto !== 0));
  }
  // Um distinguidor simples: a média dos bytes do corpo (sem o enc) e a fração de bits 1. As duas têm de ficar na mesma faixa.
  const media = (ps) => ps.reduce((s, p) => s + p.subarray(CABECALHO).reduce((a, b) => a + b, 0) / (p.length - CABECALHO), 0) / ps.length;
  confere("cobertura: a média dos bytes do corpo não separa mensagem de cobertura", Math.abs(media(reais) - media(cobs)) < 2.5, `${media(reais).toFixed(2)} × ${media(cobs).toFixed(2)}`);
  // Não liga dois pacotes ao mesmo destino: os 12 da Ana para a mesma caixa não repetem nonce, etiqueta, c nem enc.
  const fatias = (p) => [p.subarray(6, 22), p.subarray(22, 38), p.subarray(38, 70), p.subarray(70, 70 + 1120)].map(paraB64Url);
  const todos = reais.flatMap(fatias);
  confere("não ligação: 12 pacotes para a MESMA caixa não repetem nonce, etiqueta, c nem enc", new Set(todos).size === todos.length);
  confere("não ligação: quem não tem o id da caixa não reconhece (etiqueta com outra chave)", reais.every((p) => eParaMim(ler(p), [chaveDeDestino(sortear(32))]) === -1));
  confere("não ligação: quem tem o id reconhece todos", reais.every((p) => eParaMim(ler(p), [chaveDeDestino(entradaBia.id)]) === 0));
  confere("o espião do encontro Ana–R1 viu só pacotes de 3254 bytes", vistosR1.length >= 2 && vistosR1.every((p) => p.length === TAMANHO_DO_PACOTE));
}

// ── 3. Repetição e vencidos ─────────────────────────────────────────────────────────────────────────────────────────────────
{
  const p = A.no.copiaDoGuardado()[0];
  const antes = B.no.descartados.repetido;
  const n = recebidosDaBia.length;
  await B.no.receber(p);
  confere("repetição: o mesmo pacote de novo não é guardado nem entregue", B.no.descartados.repetido === antes + 1 && recebidosDaBia.length === n);
  const outroCab = Uint8Array.from(p);
  outroCab.set(sortear(32), 6);
  await B.no.receber(outroCab);
  confere("repetição: o mesmo corpo com outro cabeçalho (nonce e etiqueta trocados) também é repetido", B.no.descartados.repetido === antes + 2 && recebidosDaBia.length === n);
  // Um aparelho que não viu (lista dos vistos vazia) recebe o pacote que a Bia já abriu, por outro caminho (ou pela caixa).
  const C = noSimulado(entregaDaBia);
  await C.no.receber(p);
  // (O Proteus já recusa a mensagem gasta: "nao_abre"; a ordem da conversa diria "repetida" se passasse. Os dois recusam.)
  const ult = recebidosDaBia.at(-1);
  confere("repetição: outro aparelho da Bia que recebe o mesmo pacote por outro caminho: a conversa recusa (não abre de novo)", recebidosDaBia.length === n + 1 && !ult.ok && ["nao_abre", "repetida"].includes(ult.motivo), JSON.stringify(ult?.motivo));
  // Vencido: um aparelho com o relógio 25 h à frente.
  const D = new NoDaMalha(rede.aparelho(), async () => true, { agora: () => Date.now() + 25 * HORA });
  await D.receber(p);
  confere("vencido: recusado e não guardado", D.quantos === 0 && D.descartados.malformado === 1);
  // O que já estava guardado some quando vence.
  let relogio = Date.now();
  const E = new NoDaMalha(rede.aparelho(), async () => false, { agora: () => relogio });
  E.guardar(p);
  relogio += 25 * HORA;
  confere("vencido: o pacote guardado some quando a validade passa", E.quantos === 0);
}

// ── 3b. O ataque que o ProVerif achou (provas/controles/sem-internet-etiqueta-sem-corpo.pv): emendar cabeçalho novo em corpo velho ─
{
  // Quem repassa guarda um pacote velho de Ana para Bia e, quando passa um novo para a mesma caixa, põe o cabeçalho do novo
  // (validade, nonce, etiqueta) no corpo do velho. Sem o resumo do corpo na etiqueta, Bia reconheceria e abriria a mensagem velha
  // com a validade nova: o pacote que expira não expiraria.
  const velhos = [];
  const novos = [];
  await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "velha" }) }, async (c, e, f) => ({ ok: !!velhos.push(montarMensagem(c.id, f, e, VALIDADE_PADRAO, Date.now() - 20 * HORA)) }), nada).then((r) => (envioAna = r.estado));
  await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "nova" }) }, async (c, e, f) => ({ ok: !!novos.push(montarMensagem(c.id, f, e, VALIDADE_PADRAO)) }), nada).then((r) => (envioAna = r.estado));
  const emendado = juntar(novos[0].subarray(0, CABECALHO), velhos[0].subarray(CABECALHO));
  confere("ataque: cabeçalho de um pacote novo emendado no corpo de um velho não é reconhecido (a etiqueta prende o corpo)", eParaMim(ler(emendado), [chaveDeDestino(entradaBia.id)]) === -1);
  confere("e os dois pacotes de verdade são reconhecidos", eParaMim(ler(novos[0]), [chaveDeDestino(entradaBia.id)]) === 0 && eParaMim(ler(velhos[0]), [chaveDeDestino(entradaBia.id)]) === 0);
  const kAto = sortear(32);
  const f1 = await montarFarol(kAto, codificarFarol(assinarFarol({ ato: sortear(16), estado: "atencao", texto: "", quando: 1 }, sortear(32))), VALIDADE_PADRAO);
  const f2 = await montarFarol(kAto, codificarFarol(assinarFarol({ ato: sortear(16), estado: "dispersar", texto: "", quando: 2 }, sortear(32))), VALIDADE_PADRAO);
  confere("ataque: no farol também (cabeçalho de um, corpo de outro, mesmo ato)", eParaMim(ler(juntar(f2.subarray(0, CABECALHO), f1.subarray(CABECALHO))), [chaveDaEtiquetaDoAto(kAto)]) === -1);
}

// ── 4. Malformado: fast-check, 10⁴ casos, nada cai e o aparelho continua entregando ─────────────────────────────────────────
{
  const entregues = { n: 0 };
  const F = new NoDaMalha(rede.aparelho(), entregador({ caixas: () => [entradaBia.id], atos: () => [], mensagem: async () => (entregues.n++, true), farol: () => {} }));
  const valido = await montarCobertura();
  const qualquer = fc.oneof(
    fc.uint8Array({ minLength: 0, maxLength: 4000 }),
    fc.uint8Array({ minLength: TAMANHO_DO_PACOTE, maxLength: TAMANHO_DO_PACOTE }),
    fc.tuple(fc.nat(TAMANHO_DO_PACOTE - 1), fc.integer({ min: 1, max: 255 })).map(([i, x]) => {
      const p = Uint8Array.from(valido);
      p[i] ^= x;
      return p;
    }),
    fc.tuple(fc.integer({ min: 0, max: 0xffffffff })).map(([v]) => {
      const p = Uint8Array.from(valido);
      p.set(u32(v), 2);
      return p;
    }),
    fc.anything(),
  );
  await naoLanca("malformado: 10⁴ casos (bytes soltos, tamanho certo, um byte trocado, validade qualquer, qualquer coisa)", () =>
    fc.assert(fc.asyncProperty(qualquer, async (p) => {
      await F.receber(p);
      return true;
    }), { numRuns: 10_000 }));
  confere("malformado: nada foi entregue como mensagem (nenhum pacote inventado abriu)", entregues.n === 0);
  confere("malformado: a guarda nunca passa de 500", F.quantos <= GUARDA_MAXIMA);
  // Depois de tudo isso, um pacote de verdade ainda chega.
  const r = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "ainda aqui" }) }, depositarNaMalha({ guardar: (p) => (F.receber(p), true) }), nada);
  envioAna = r.estado;
  await new Promise((ok) => setTimeout(ok, 50));
  confere("malformado: depois dos 10⁴, o aparelho continua entregando (o pacote de verdade é reconhecido)", entregues.n === 1);
}

// ── 5. Limites por encontro e da guarda ─────────────────────────────────────────────────────────────────────────────────────
{
  const G = new NoDaMalha(rede.aparelho(), async () => false);
  for (let i = 0; i < GUARDA_MAXIMA + 40; i++) G.guardar(await montarCobertura());
  confere("guarda: nunca passa de 500 (sai um sorteado entre os de mesma validade)", G.quantos === GUARDA_MAXIMA);
  const H = new NoDaMalha(rede.aparelho(), async () => false);
  let mandados = 0;
  let receptor = null;
  await H.encontro({ mandar: async () => void mandados++, aoReceber: (f) => ((receptor = f), () => {}), fechar: () => {} });
  confere("encontro: sem nada guardado, não manda nada", mandados === 0);
  mandados = 0;
  await G.encontro({ mandar: async () => void mandados++, aoReceber: () => () => {}, fechar: () => {} });
  confere("encontro: manda no máximo 64", mandados === POR_ENCONTRO);
  const enchente = [];
  for (let i = 0; i < RECEBE_POR_ENCONTRO + 30; i++) enchente.push(await montarCobertura());
  for (const p of enchente) await receptor(p);
  confere("encontro: aceita no máximo 128 de um vizinho num encontro", H.quantos === RECEBE_POR_ENCONTRO && H.descartados.demais === 30);
}

// ── 6. O Farol do ato e o aparelho malicioso por perto ──────────────────────────────────────────────────────────────────────
{
  const ato = bytesDoUuid("6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b");
  const outroAto = bytesDoUuid("00000000-0000-4000-8000-000000000001");
  const kAto = sortear(32);
  const s1 = sortear(32);
  const s2 = sortear(32);
  const s3 = sortear(32);
  const autorizadas = [chaveDoFarol(s1), chaveDoFarol(s2)];
  const agoraS = Math.floor(Date.now() / 1000);
  const conteudo = { ato, estado: "dispersar", texto: "", quando: agoraS };
  const duas = assinarFarol(assinarFarol(conteudo, s1), s2);
  const uma = assinarFarol(conteudo, s1);
  const vistos = [];
  const atoDaPessoa = { ato, kAto, chaves: autorizadas };
  const pessoa = entregador({ caixas: () => [], atos: () => [atoDaPessoa], mensagem: async () => false, farol: (a, f, n) => vistos.push({ f, n }) });
  const pFarol = await montarFarol(kAto, codificarFarol(duas), VALIDADE_PADRAO);
  confere("farol: o pacote tem o mesmo tamanho de todos", pFarol.length === TAMANHO_DO_PACOTE);
  confere("farol: com duas assinaturas da coordenação, vale", (await pessoa(pFarol)) && vistos.at(-1)?.n === 2 && vistos.at(-1)?.f.estado === "dispersar");
  confere("farol: o mesmo farol de novo (o aparelho por perto repete) não muda nada", !(await pessoa(await montarFarol(kAto, codificarFarol(duas), VALIDADE_PADRAO))) && vistos.length === 1);
  const velho = assinarFarol(assinarFarol({ ...conteudo, estado: "tranquilo", quando: agoraS - 600 }, s1), s2);
  confere("farol: um farol mais velho que o último (guardado e solto depois) não volta o estado", !(await pessoa(await montarFarol(kAto, codificarFarol(velho), VALIDADE_PADRAO))) && vistos.length === 1);
  const novo = assinarFarol(assinarFarol({ ...conteudo, estado: "ponto2", texto: "Praça da Sé, escadaria", quando: agoraS + 60 }, s1), s2);
  confere("farol: um mais novo, com as duas, vale", (await pessoa(await montarFarol(kAto, codificarFarol(novo), VALIDADE_PADRAO))) && vistos.at(-1)?.f.texto === "Praça da Sé, escadaria");
  await pessoa(await montarFarol(kAto, codificarFarol(assinarFarol({ ...conteudo, quando: agoraS + 120 }, s1)), VALIDADE_PADRAO));
  confere("farol: com uma assinatura só, chega como pedido (n = 1: só quem coordena faz algo)", vistos.at(-1)?.n === 1);
  const forjado = assinarFarol(assinarFarol({ ...conteudo, quando: agoraS + 180 }, s1), s3);
  await pessoa(await montarFarol(kAto, codificarFarol(forjado), VALIDADE_PADRAO));
  confere("ataque: a segunda assinatura de chave fora da lista do ato não conta", vistos.at(-1)?.n === 1 && vistos.at(-1)?.f.quando === agoraS + 180);
  const mesmaDuasVezes = { ...uma, quando: agoraS + 240, assinaturas: [] };
  const a1 = assinarFarol(mesmaDuasVezes, s1);
  const dobrado = { ...a1, assinaturas: [a1.assinaturas[0], a1.assinaturas[0]] };
  const n0 = vistos.length;
  await pessoa(await montarFarol(kAto, codificarFarol(dobrado), VALIDADE_PADRAO));
  confere("ataque: a mesma assinatura duas vezes conta como uma", vistos.length === n0 + 1 && vistos.at(-1).n === 1);
  const deOutro = assinarFarol(assinarFarol({ ...conteudo, ato: outroAto, quando: agoraS + 300 }, s1), s2);
  const n1 = vistos.length;
  confere("ataque: farol de outro ato, com a chave deste, é recusado", !(await pessoa(await montarFarol(kAto, codificarFarol(deOutro), VALIDADE_PADRAO))) && vistos.length === n1);
  confere("farol: quem não confirmou presença (sem k_ato) não reconhece", !(await entregador({ caixas: () => [], atos: () => [{ ...atoDaPessoa, kAto: sortear(32) }], mensagem: async () => false, farol: () => {} })(pFarol)));
  const adiante = assinarFarol(assinarFarol({ ...conteudo, quando: agoraS + 3600 }, s1), s2);
  confere("ataque: farol com hora muito à frente (para travar os seguintes) é recusado", !(await pessoa(await montarFarol(kAto, codificarFarol(adiante), VALIDADE_PADRAO))));
  // O aparelho malicioso por perto: guarda os faróis do mesmo ato e de outro, e não acha o que os liga.
  const doAto = [];
  for (let i = 0; i < 6; i++) doAto.push(await montarFarol(kAto, codificarFarol(duas), VALIDADE_PADRAO));
  const deOutroAto = [];
  for (let i = 0; i < 6; i++) deOutroAto.push(await montarFarol(sortear(32), codificarFarol(deOutro), VALIDADE_PADRAO));
  const fat = [...doAto, ...deOutroAto].flatMap((p) => [p.subarray(6, 22), p.subarray(22, 38), p.subarray(70, 70 + 1120)].map(paraB64Url));
  confere("grupo: seis faróis do MESMO ato não repetem nonce, etiqueta nem enc (não dá para juntar os de um ato)", new Set(fat).size === fat.length);
  const chaveEtq = chaveDaEtiquetaDoAto(kAto);
  confere("grupo: sem k_ato, a etiqueta do farol não bate com nada que se derive do id do ato (público)", doAto.every((p) => eParaMim(ler(p), [chaveDeDestino(juntar(ato, ato))]) === -1 && eParaMim(ler(p), [chaveEtq]) === 0));
  const cob = await montarCobertura();
  confere("grupo: o farol tem o mesmo cabeçalho fixo da cobertura e o corpo cifrado (o bit alto do X25519 não fica em claro)", iguais(pFarol.subarray(0, 6), cob.subarray(0, 6)) && (await Promise.all(Array.from({ length: 40 }, () => montarFarol(kAto, codificarFarol(duas), VALIDADE_PADRAO)))).some((p) => (p[CABECALHO + 32 + 1119] & 0x80) !== 0));
  const trocado = Uint8Array.from(pFarol);
  trocado[2] ^= 0; // a mesma validade
  trocado[trocado.length - 1] ^= 1;
  confere("ataque: farol adulterado (um bit do fim) não abre", !(await pessoa(trocado)));
  confere("farol: o resumo de repetição é do corpo (mudar o cabeçalho não engana)", iguais(resumoDoPacote(ler(pFarol)), resumoDoPacote({ ...ler(pFarol), cabecalho: sortear(CABECALHO) })));
}

// ── 7. "Estou bem" pela malha, com a mesma sessão ───────────────────────────────────────────────────────────────────────────
{
  const I = noSimulado(async () => false);
  const J = noSimulado(entregaDaBia);
  const n = recebidosDaBia.length;
  const r = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "controle", conversa, prazo: 1, corpo: controleEstouBem() }, depositarNaMalha(I.no), nada);
  envioAna = r.estado;
  await rede.encontrar(I.t, J.t);
  const chegou = recebidosDaBia.slice(n).find((x) => x.ok);
  confere("estou bem: chega pela malha e abre como controle \"estou_bem\"", chegou && chegou.bloco.tipo === "controle" && lerEstouBem(chegou.bloco.corpo)?.a === "estou_bem");
  confere("estou bem: corpo que não é o controle não é lido como \"estou bem\"", lerEstouBem(corpoDeTexto({ t: "x" })) === null && lerEstouBem(new TextEncoder().encode('{"a":"estou_bem","em":1,"x":2}')) === null);
  // O transporte com a malha: deposita na caixa E guarda na malha; sem internet, a malha basta.
  const guardados = [];
  const base = { depositar: async () => { throw new Error("sem_rede"); }, buscar: async () => "buscou" };
  const t = comMalha(base, { guardar: (p) => (guardados.push(p), true) }, () => true);
  const r2 = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "controle", conversa, prazo: 1, corpo: controleEstouBem() }, (c, e, f) => t.depositar(c, e, f), nada);
  envioAna = r2.estado;
  confere("com a malha: sem internet, o depósito vai para a malha e conta como entregue", r2.entregues === 1 && guardados.length === 1);
  confere("com a malha: o resto do transporte passa direto", (await t.buscar()) === "buscou");
  const desligada = comMalha(base, { guardar: (p) => (guardados.push(p), true) }, () => false);
  const r3 = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "controle", conversa, prazo: 1, corpo: controleEstouBem() }, (c, e, f) => desligada.depositar(c, e, f), nada);
  envioAna = r3.estado;
  confere("com a malha desligada: nada vai para a malha", r3.entregues === 0 && guardados.length === 1);
  // ATAQUE "servidor + vizinho" (auditoria interna da R3): com internet, comMalha deposita na caixa E guarda na malha. Quem repassa o
  // pacote (a polícia num ato) e também tem o banco comparava os bytes do pacote com o depósito e ligava a caixa a um lugar e uma hora.
  const noServidor = [];
  const comRede = comMalha({ depositar: async (c, e, f) => (noServidor.push({ c: f, envelope: e }), { ok: true }), buscar: async () => null }, { guardar: (p) => (guardados.push(p), true) }, () => true);
  const r4 = await mandar(ana.eu, destinosDaAna, envioAna, { tipo: "controle", conversa, prazo: 1, corpo: controleEstouBem() }, (c, e, f) => comRede.depositar(c, e, f), nada);
  envioAna = r4.estado;
  const pacoteDoVizinho = ler(guardados.at(-1));
  const contem = (grande, pedaco) => Buffer.from(grande).indexOf(Buffer.from(pedaco)) >= 0;
  confere("ataque servidor + vizinho: com internet, o mesmo depósito foi ao servidor e à malha", noServidor.length === 1 && !!pacoteDoVizinho);
  confere("ataque servidor + vizinho: o pacote que o vizinho vê NÃO contém o c nem o envelope que o servidor guardou", !!pacoteDoVizinho && !contem(guardados.at(-1), noServidor[0].c) && !contem(guardados.at(-1), noServidor[0].envelope.subarray(0, 64)) && !contem(guardados.at(-1), noServidor[0].envelope.subarray(2000, 2064)));
  confere("e a Bia (com o id da caixa) ainda tira dele o mesmo depósito", !!pacoteDoVizinho && iguais(depositoDe(pacoteDoVizinho, entradaBia.id).c, noServidor[0].c) && iguais(depositoDe(pacoteDoVizinho, entradaBia.id).envelope, noServidor[0].envelope));
}

// ── 7b. ATAQUE: a enxurrada na lista dos vistos (auditoria interna da R3) ─────────────────────────────────────────────────────
// Antes: com 50.000 vistos, cada pacote novo tirava o visto de validade mais curta (O(n) por inserção); quem inventava 50.005 pacotes
// de validade máxima apagava o resumo do pacote real, e o mesmo pacote real voltava a ser repassado e ENTREGUE. Agora a lista cheia
// recusa pacote novo de vizinho e nunca esquece um visto antes da validade.
{
  const agora = Date.now();
  const entregues = [];
  const no = new NoDaMalha({ aoEncontrar: () => () => {} }, async (p) => (entregues.push(p), false), { agora: () => agora });
  const real = montarMensagem(sortear(32), sortear(32), sortear(TAMANHO_DO_ENVELOPE), 1, agora);
  await no.receber(real);
  const lixo = () => {
    const b = sortear(TAMANHO_DO_PACOTE);
    b[0] = 0x4d;
    b[1] = 1;
    b.set(u32(horaDe(agora) + 24), 2);
    return b;
  };
  const t0 = Date.now();
  for (let i = 0; i < VISTOS_MAXIMO + 5; i++) await no.receber(lixo());
  const ms = Date.now() - t0;
  await no.receber(real);
  confere("ataque: depois de 50.005 pacotes inventados de vizinho, o mesmo pacote real NÃO é entregue de novo", entregues.filter((p) => iguais(p, real)).length === 1, `entregas: ${entregues.filter((p) => iguais(p, real)).length}`);
  confere("ataque: a lista cheia recusa o pacote novo de vizinho (conta como cheio)", no.descartados.cheio >= 5);
  confere("ataque: a enxurrada não custa O(n) por pacote (50.005 pacotes em menos de 60 s)", ms < 60_000, `${ms} ms`);
  confere("o pacote feito aqui (a mensagem da própria pessoa) entra mesmo com a lista cheia", no.guardar(montarMensagem(sortear(32), sortear(32), sortear(TAMANHO_DO_ENVELOPE), 24, agora)));
}

// ── 8. Desligar apaga tudo ──────────────────────────────────────────────────────────────────────────────────────────────────
{
  const K = noSimulado(async () => false);
  K.no.guardar(await montarCobertura());
  const guardado = K.no.copiaDoGuardado()[0];
  K.no.desligar();
  confere("desligar: o aparelho não fica com pacotes de ninguém", K.no.quantos === 0 && !K.no.ligado);
  confere("desligar: e esquece os vistos (ligar de novo começa do zero)", K.no.guardar(guardado));
  let encontros = 0;
  const L = rede.aparelho();
  const M2 = new NoDaMalha(L, async () => false);
  const outro = rede.aparelho();
  outro.aoEncontrar(() => void encontros++);
  await rede.encontrar(L, outro);
  confere("desligado (nunca ligado): o aparelho não participa do encontro", M2.quantos === 0 && encontros === 1);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
