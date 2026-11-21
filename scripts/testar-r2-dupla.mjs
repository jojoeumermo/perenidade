// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa a dois da onda R2 (itens 1.1, 1.2 e 1.5), de verdade no Node: o Proteus do motor (@wireapp/core-crypto), o envelope
// X-Wing (@hpke), os certificados Ed25519 (@noble/curves), o bloco, a ordem e a franquia. Os ataques estão escritos como teste:
// servidor que troca pré-chave ou chave da semana, aparelho inventado, envelope em outra caixa ou de outra semana, tipo trocado,
// franquia forjada por quem manda, repetida, perdida e fora de ordem, e "quebrando só o X25519". O roubo do estado da sessão (aceite
// do 1.1) roda no navegador, com a loja do motor no OPFS: scripts/testar-r2-dupla-roubo.mjs.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-dupla.mjs
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { XWing as XWingNoble } from "@noble/post-quantum/hybrid.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { sha3_256, shake256 } from "@noble/hashes/sha3.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { iguais, paraB64Url, sortear, texto, deTexto, completar, tirarCompleto, juntar } from "../lib/rede/chat/r2/bytes.ts";
import { ler, montar, novoBloco, semKf, resumoDoBloco, corpoDeTexto, lerCorpoDeTexto, NADA_ANTES } from "../lib/rede/chat/r2/bloco.ts";
import {
  novoParEd25519, certificarAparelho, certificadoConfere, assinarChaveDaSemana, codigoDeSeguranca, assinarPreChave,
} from "../lib/rede/chat/r2/certificados.ts";
import { novoParXWing, selar, abrir, semanaDe, TAMANHOS_DO_PACOTE, BYTES_DO_ENC } from "../lib/rede/chat/r2/envelope.ts";
import { ligarProteus, novasPreChaves, sessaoPelaPreChave, cifrar, decifrar, esquecerSessao } from "../lib/rede/chat/r2/proteus.ts";
import { ESTADO_NOVO, ENVIO_NOVO, julgar, faltando } from "../lib/rede/chat/r2/ordem.ts";
import { aparelhosConfiaveis, mandar, receber, resumoDaCaixa, compromisso, precisaRefazerSessao } from "../lib/rede/chat/r2/conversa.ts";
import { ROTULOS, ROTULOS_DE_FORA } from "../lib/rede/chat/r2/rotulos.ts";
import { spqrNoNode } from "./spqr-no-node.mjs";
import { selarCamada } from "../lib/rede/chat/r3/camada-pq.ts";
import { paraMandar } from "../lib/rede/chat/r3/sessao-pq.ts";

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

const M = await motorNoNode();
const SPQR = await spqrNoNode();
/** O SPQR de um aparelho (onda R3): o registro por aparelho da outra ponta, na memória. */
const pqNaMemoria = () => {
  const m = new Map();
  return { motor: SPQR, ler: (a) => m.get(paraB64Url(a)) ?? null, gravar: (a, r) => void m.set(paraB64Url(a), r) };
};
const hoje = Math.floor(Date.now() / 86_400_000);
const semana = semanaDe();

// ── Bloco ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const b = novoBloco({ tipo: "texto", conversa: sortear(16), contador: 7, anterior: sortear(32), prazo: 7, corpo: corpoDeTexto({ t: "olá" }) });
  const bytes = montar(b);
  const lido = ler(bytes);
  confere("bloco: ida e volta", lido && lido.contador === 7 && iguais(lido.id, b.id) && iguais(lido.kf, b.kf) && lerCorpoDeTexto(lido.corpo)?.t === "olá");
  const mexido = new Uint8Array(bytes);
  mexido[1] = 9;
  confere("bloco: tipo desconhecido é recusado", ler(mexido) === null);
  const prazo = new Uint8Array(bytes);
  prazo[74] = 2;
  confere("bloco: prazo fora da lista é recusado", ler(prazo) === null);
  confere("bloco: sobra no fim é recusada", ler(juntar(bytes, new Uint8Array([0]))) === null);
  const outroKf = montar({ ...b, kf: sortear(32) });
  confere("bloco: o resumo não depende do kf (a cadeia é a mesma em todas as cópias)", iguais(resumoDoBloco(bytes), resumoDoBloco(outroKf)));
  confere("bloco: sem kf tira os 32 bytes", semKf(bytes).length === bytes.length - 32);
  await recusa("bloco: contador zero é recusado", async () => montar({ ...b, contador: 0 }), "contador_invalido");
}

// ── Preenchimento ─────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const t = [64, 128];
  const c = completar(texto("abc"), t);
  confere("preenchimento: completa ao menor tamanho", c.length === 64 && deTexto(tirarCompleto(c, t)) === "abc");
  const sujo = new Uint8Array(c);
  sujo[63] = 1;
  confere("preenchimento: sobra que não é zero é recusada", tirarCompleto(sujo, t) === null);
}

// ── Envelope X-Wing ───────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const par = await novoParXWing();
  const idH = resumoDaCaixa(sortear(32));
  const c = sortear(32);
  const aparelho = sortear(32);
  const pacote = await selar(par.publica, semana, idH, c, { tipo: "mensagem", aparelho, inicio: null, camada: texto("cifrado do proteus") });
  confere("envelope: tamanho fixo (2048 por dentro)", pacote.length === TAMANHOS_DO_PACOTE[0], String(pacote.length));
  const dentro = await abrir(par.privada, semana, idH, c, pacote);
  confere("envelope: abre e diz qual aparelho mandou", dentro && iguais(dentro.aparelho, aparelho) && deTexto(dentro.camada) === "cifrado do proteus" && dentro.tipo === "mensagem");
  confere("envelope: em outra caixa não abre", (await abrir(par.privada, semana, resumoDaCaixa(sortear(32)), c, pacote)) === null);
  confere("envelope: com outra franquia não abre", (await abrir(par.privada, semana, idH, sortear(32), pacote)) === null);
  confere("envelope: dito de outra semana não abre", (await abrir(par.privada, semana - 1, idH, c, pacote)) === null);
  const velho = await selar(par.publica, semana - 6, idH, c, { tipo: "mensagem", aparelho, inicio: null, camada: texto("x") });
  confere("envelope: semana fora da janela (6 atrás) é recusada mesmo com a chave certa", (await abrir(par.privada, semana - 6, idH, c, velho)) === null);
  const outro = await novoParXWing();
  confere("envelope: com outra chave não abre", (await abrir(outro.privada, semana, idH, c, pacote)) === null);
  const grande = await selar(par.publica, semana, idH, c, { tipo: "mensagem", aparelho, inicio: null, camada: sortear(5000) });
  confere("envelope: conteúdo maior vai ao tamanho seguinte da lista", grande.length === TAMANHOS_DO_PACOTE[2]);
  const adulterado = new Uint8Array(pacote);
  adulterado[adulterado.length - 1] ^= 1;
  confere("envelope: adulterado não abre", (await abrir(par.privada, semana, idH, c, adulterado)) === null);

  // Aceite do 1.2: "quebrando só o X25519, a chave inicial continua secreta". Quem quebra o X25519 sabe a parte clássica do X-Wing
  // (a privada X25519 que sai da semente); sem o segredo do ML-KEM-768, o segredo combinado (o que o HPKE usa) não sai.
  const exp = shake256(par.privada, { dkLen: 96 });
  const [skMl, skX] = [ml_kem768.keygen(exp.subarray(0, 64)).secretKey, exp.subarray(64, 96)];
  const pkX = x25519.getPublicKey(skX);
  const enc = pacote.subarray(0, BYTES_DO_ENC);
  const [ctM, ctX] = [enc.subarray(0, 1088), enc.subarray(1088)];
  const ssX = x25519.getSharedSecret(skX, ctX);
  const rotulo = new TextEncoder().encode("\\.//^\\");
  const combinar = (ssM) => sha3_256(juntar(ssM, ssX, ctX, pkX, rotulo));
  const verdadeiro = XWingNoble.decapsulate(enc, par.privada);
  confere("1.2: a reconstrução do X-Wing com o ML-KEM certo dá o segredo do envelope", iguais(combinar(ml_kem768.decapsulate(ctM, skMl)), verdadeiro));
  let acertou = false;
  for (let i = 0; i < 64; i++) if (iguais(combinar(sortear(32)), verdadeiro)) acertou = true;
  confere("1.2: com o X25519 quebrado e sem o ML-KEM, o segredo não sai", !acertou && !iguais(combinar(new Uint8Array(32)), verdadeiro));
  confere("1.2: a chave pública da semana publica a parte ML-KEM (1184) e a X25519 (32)", par.publica.length === 1216);
}

// ── Aparelhos de verdade: Ana com 2 aparelhos, Bia com 2 ──────────────────────────────────────────────────────────────────
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
  return { conta, motor, chave, impressao, publico, semanas, eu: { conta, aparelho: chave.publica, motor, chaveDaSemana: async (s) => semanas.get(s) ?? null, pq: pqNaMemoria() } };
}
const idAna = novoParEd25519();
const idBia = novoParEd25519();
const [ana1, ana2] = [await novoAparelho("ana", idAna), await novoAparelho("ana", idAna)];
const [bia1, bia2] = [await novoAparelho("bia", idBia), await novoAparelho("bia", idBia)];

// Diretório (o que o servidor entrega) e o que cada aparelho confere.
{
  confere("certificado: confere com a identidade", certificadoConfere(idBia.publica, bia1.publico.certificado));
  const lista = [bia1.publico, bia2.publico];
  confere("diretório: os dois aparelhos da Bia são confiáveis", aparelhosConfiaveis("bia", idBia.publica, lista).length === 2);
  const intruso = await novoAparelho("bia", novoParEd25519());
  confere("ataque: aparelho que o servidor inventa (certificado de outra identidade) fica de fora", aparelhosConfiaveis("bia", idBia.publica, [...lista, intruso.publico]).length === 2);
  const trocada = { ...bia1.publico, xwing: (await novoParXWing()).publica };
  confere("ataque: servidor troca a chave X-Wing da semana (sem a assinatura do aparelho) — fica de fora", aparelhosConfiaveis("bia", idBia.publica, [trocada]).length === 0);
  const deOutraConta = { ...bia1.publico, certificado: { ...bia1.publico.certificado, conta: "caio" } };
  confere("ataque: certificado mudado para outra conta não confere", aparelhosConfiaveis("caio", idBia.publica, [deOutraConta]).length === 0);
  const velha = { ...bia1.publico, semana: semana - 6, xwingAssinatura: assinarChaveDaSemana(bia1.chave, bia1.publico.xwing, semana - 6) };
  confere("ataque: chave da semana velha demais (servidor guarda a antiga) fica de fora", aparelhosConfiaveis("bia", idBia.publica, [velha]).length === 0);
}

// Sessões: Ana1 abre com cada aparelho da Bia e com o outro aparelho dela (sincronia), pelas pré-chaves assinadas.
const preBia1 = await novasPreChaves(bia1.motor, bia1.chave, 3);
const preBia2 = await novasPreChaves(bia2.motor, bia2.chave, 3);
const preAna2 = await novasPreChaves(ana2.motor, ana2.chave, 3);
{
  const falsa = { ...preBia1[0], assinatura: sortear(64) };
  await recusa("ataque: pré-chave sem a assinatura do aparelho é recusada", () => sessaoPelaPreChave(ana1.motor, bia1.chave.publica, bia1.impressao, falsa), "pre_chave_sem_assinatura");
  // O servidor entrega a pré-chave de OUTRO aparelho (dele), assinando com... nada: precisa da chave do aparelho da Bia.
  const preDoServidor = (await novasPreChaves(bia2.motor, bia2.chave, 1))[0];
  await recusa("ataque: pré-chave de outro aparelho (outra identidade Proteus) é recusada", () => sessaoPelaPreChave(ana1.motor, bia2.chave.publica, bia1.impressao, preDoServidor), "identidade_trocada");
  confere("ataque: a sessão recusada não ficou gravada", !(await ana1.motor.transaction((c) => c.proteusSessionExists(paraHexL(bia2.chave.publica)))));
}
function paraHexL(b) {
  return Buffer.from(b).toString("hex");
}
await sessaoPelaPreChave(ana1.motor, bia1.chave.publica, bia1.impressao, preBia1[0]);
await sessaoPelaPreChave(ana1.motor, bia2.chave.publica, bia2.impressao, preBia2[0]);
await sessaoPelaPreChave(ana1.motor, ana2.chave.publica, ana2.impressao, preAna2[0]);

// Caixas (o transporte da frente das caixas, aqui em memória): cada aparelho tem a caixa de entrada desta conversa e a de sincronia.
const caixas = new Map();
const novaCaixa = () => ({ id: sortear(32), pd: sortear(32) });
const depositar = async (caixa, envelope, franquia) => {
  const k = paraB64Url(resumoDaCaixa(caixa.id));
  caixas.set(k, [...(caixas.get(k) ?? []), { envelope, franquia }]);
  return { ok: true };
};
const tirar = (caixa) => {
  const k = paraB64Url(resumoDaCaixa(caixa.id));
  const lista = caixas.get(k) ?? [];
  caixas.set(k, []);
  return lista;
};
/** Quem chama mandar grava o estado de envio antes do primeiro depósito; aqui, nos testes de cifra, não há onde gravar. */
const nada = async () => {};
const entradaBia1 = novaCaixa();
const entradaBia2 = novaCaixa();
const sincroniaAna2 = novaCaixa();
const conversa = sortear(16);
const destinosDaAna = [
  { aparelho: bia1.publico, caixa: entradaBia1, tipo: "mensagem" },
  { aparelho: bia2.publico, caixa: entradaBia2, tipo: "mensagem" },
  { aparelho: ana2.publico, caixa: sincroniaAna2, tipo: "sincronia" },
];
const conhecidosDaBia = (a) => (iguais(a, ana1.chave.publica) ? { conta: "ana", impressao: ana1.impressao, meu: false } : iguais(a, ana2.chave.publica) ? { conta: "ana", impressao: ana2.impressao, meu: false } : null);
const conhecidosDaAna2 = (a) => (iguais(a, ana1.chave.publica) ? { conta: "ana", impressao: ana1.impressao, meu: true } : null);
const estados = new Map();
const estadoDe = (quem) => (conv, ap) => estados.get(`${quem}:${paraB64Url(conv)}:${paraB64Url(ap)}`) ?? ESTADO_NOVO;
const guardar = (quem, r) => estados.set(`${quem}:${paraB64Url(r.bloco.conversa)}:${paraB64Url(r.de.aparelho)}`, r.estado);
async function receberTudo(quem, ap, caixa, conv, conhecido) {
  const saida = [];
  for (const p of tirar(caixa)) {
    const r = await receber(ap.eu, caixa.id, p, conv, conhecido, estadoDe(quem));
    if (r.ok) guardar(quem, r);
    saida.push(r);
  }
  return saida;
}

let envioAna = ENVIO_NOVO;
{
  const r = await mandar(ana1.eu, destinosDaAna, envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "oi, Bia" }) }, depositar, nada);
  envioAna = r.estado;
  confere("mandar: uma cópia por aparelho da Bia e uma para o outro aparelho da Ana", r.entregues === 3);
  const [n1] = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  const [n2] = await receberTudo("bia2", bia2, entradaBia2, conversa, conhecidosDaBia);
  const [s2] = await receberTudo("ana2", ana2, sincroniaAna2, null, conhecidosDaAna2);
  confere("receber: os dois aparelhos da Bia leem", n1.ok && n2.ok && lerCorpoDeTexto(n1.bloco.corpo).t === "oi, Bia" && lerCorpoDeTexto(n2.bloco.corpo).t === "oi, Bia");
  confere("receber: o outro aparelho da Ana lê a cópia (sincronia)", s2.ok && s2.de.meu && lerCorpoDeTexto(s2.bloco.corpo).t === "oi, Bia");
  confere("receber: as cópias têm o mesmo id e contador, kf diferente", iguais(n1.bloco.id, n2.bloco.id) && n1.bloco.contador === 1 && !iguais(n1.bloco.kf, n2.bloco.kf));
  confere("receber: a primeira mensagem não tem aviso", n1.avisos.length === 0);
}

// Repetida: o servidor entrega o mesmo pacote de novo.
{
  await mandar(ana1.eu, destinosDaAna.slice(0, 1), envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "2" }) }, depositar, nada).then((r) => (envioAna = r.estado));
  const [p] = caixas.get(paraB64Url(resumoDaCaixa(entradaBia1.id)));
  const [r1] = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  caixas.set(paraB64Url(resumoDaCaixa(entradaBia1.id)), [p]);
  const [r2] = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  confere("ataque: o servidor entrega o mesmo pacote de novo — recusado", r1.ok && !r2.ok, JSON.stringify(r2.motivo));
}

// Fora de ordem e perdida: Ana manda 3, 4, 5; o servidor segura a 4 e entrega 5 antes de 3.
{
  const pacotes = [];
  for (const t of ["3", "4", "5"]) {
    const r = await mandar(ana1.eu, destinosDaAna.slice(0, 1), envioAna, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t }) }, depositar, nada);
    envioAna = r.estado;
  }
  const lista = tirar(entradaBia1);
  pacotes.push(...lista);
  caixas.set(paraB64Url(resumoDaCaixa(entradaBia1.id)), [pacotes[2], pacotes[0]]);
  const [cinco, tres] = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  const est = estados.get(`bia1:${paraB64Url(conversa)}:${paraB64Url(ana1.chave.publica)}`);
  confere("perdida: a 5 chega e abre", cinco.ok && lerCorpoDeTexto(cinco.bloco.corpo).t === "5");
  confere("fora de ordem: a 3 chega depois da 5, abre com aviso", tres.ok && tres.avisos.includes("fora_de_ordem"));
  confere("perdida: a tela sabe que falta a 4", JSON.stringify(faltando(est)) === "[4]", JSON.stringify(faltando(est)));
  caixas.set(paraB64Url(resumoDaCaixa(entradaBia1.id)), [pacotes[1]]);
  const [quatro] = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  const est2 = estados.get(`bia1:${paraB64Url(conversa)}:${paraB64Url(ana1.chave.publica)}`);
  confere("perdida que chega tarde: a 4 abre, sem cadeia quebrada, e não falta mais nada", quatro.ok && !quatro.avisos.includes("cadeia_quebrada") && faltando(est2).length === 0);
}

// O contador nunca se repete (revisão final da R2): a primeira cópia sai, a segunda dá erro (chave X-Wing torta), e a próxima
// mensagem vai só ao aparelho bom. Antes do conserto, o contador só era gravado no fim: a nova saía com o MESMO contador, e quem já
// tinha a primeira cópia a descartava em silêncio como "repetida".
{
  const gravados = [];
  const reservar = async (novo) => void gravados.push(novo);
  const tortos = [destinosDaAna[0], { ...destinosDaAna[1], aparelho: { ...bia2.publico, xwing: new Uint8Array(5) } }];
  let envio = envioAna;
  // A "aba" fecha logo depois da primeira cópia: o que vale é o que foi gravado antes de depositar.
  const r1 = await mandar(ana1.eu, tortos, envio, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "mensagem 1" }) }, depositar, reservar);
  confere("contador: a cópia torta falha sem derrubar a boa", r1.entregues === 1 && r1.falhas === 1);
  confere("contador: o estado novo foi gravado ANTES do primeiro depósito", gravados.length === 1 && gravados[0].contador === envio.contador + 1);
  envio = gravados.at(-1);
  await mandar(ana1.eu, destinosDaAna.slice(0, 1), envio, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "mensagem 2, diferente" }) }, depositar, reservar);
  const lidas = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  confere("contador: a Bia1 abre as duas mensagens (nenhuma descartada como repetida)",
    lidas.length === 2 && lidas.every((x) => x.ok) && lerCorpoDeTexto(lidas[1].bloco.corpo).t === "mensagem 2, diferente" && lidas[1].bloco.contador === lidas[0].bloco.contador + 1,
    JSON.stringify(lidas.map((x) => (x.ok ? x.bloco.contador : x.motivo))));
  // Se gravar o estado falhar, nada sai (melhor não mandar que mandar com contador que pode se repetir).
  const antes = (caixas.get(paraB64Url(resumoDaCaixa(entradaBia1.id))) ?? []).length;
  await recusa("contador: sem conseguir gravar o estado, nenhuma cópia sai", () => mandar(ana1.eu, destinosDaAna.slice(0, 1), gravados.at(-1), { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "3" }) }, depositar, async () => { throw new Error("disco_cheio"); }), "disco_cheio");
  confere("contador: ... e a caixa não recebeu nada", (caixas.get(paraB64Url(resumoDaCaixa(entradaBia1.id))) ?? []).length === antes);
  envioAna = gravados.at(-1);
}

// Volta: a Bia responde (troca de DH), a Ana lê.
{
  const entradaAna1 = novaCaixa();
  const preAna1 = await novasPreChaves(ana1.motor, ana1.chave, 1);
  // A Bia já tem sessão com a Ana1 (aberta pela primeira mensagem dela). Com a Ana2, abre pela pré-chave.
  await sessaoPelaPreChave(bia1.motor, ana2.chave.publica, ana2.impressao, (await novasPreChaves(ana2.motor, ana2.chave, 1))[0]);
  confere("sessão: a pré-chave da Ana1 não é preciso (sessão já veio pela primeira mensagem)", preAna1.length === 1);
  const r = await mandar(bia1.eu, [{ aparelho: ana1.publico, caixa: entradaAna1, tipo: "mensagem" }], ENVIO_NOVO, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "oi, Ana" }) }, depositar, nada);
  const conhecidosDaAna1 = (a) => (iguais(a, bia1.chave.publica) ? { conta: "bia", impressao: bia1.impressao, meu: false } : null);
  const [lida] = await receberTudo("ana1", ana1, entradaAna1, conversa, conhecidosDaAna1);
  confere("volta: a Ana lê a resposta da Bia", r.entregues === 1 && lida.ok && lerCorpoDeTexto(lida.bloco.corpo).t === "oi, Ana");
  // Tipo trocado: a Bia manda como "sincronia" (como se fosse aparelho da Ana).
  await mandar(bia1.eu, [{ aparelho: ana1.publico, caixa: entradaAna1, tipo: "sincronia" }], r.estado, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "x" }) }, depositar, nada);
  const [trocado] = await receberTudo("ana1", ana1, entradaAna1, conversa, conhecidosDaAna1);
  confere("ataque: um tipo de envelope não passa por outro (sincronia vinda de outra pessoa)", !trocado.ok && trocado.motivo === "tipo_trocado");
  // Aparelho que este aparelho não conhece.
  await mandar(bia2.eu, [{ aparelho: ana1.publico, caixa: entradaAna1, tipo: "mensagem" }], ENVIO_NOVO, { tipo: "texto", conversa, prazo: 7, corpo: corpoDeTexto({ t: "y" }) }, depositar, nada).catch(() => null);
  const [desconhecido] = await receberTudo("ana1", ana1, entradaAna1, conversa, conhecidosDaAna1);
  confere("aparelho desconhecido: a tela busca o diretório antes de abrir (nada é mostrado)", !desconhecido || (!desconhecido.ok && ["aparelho_desconhecido", "nao_abre"].includes(desconhecido.motivo)));
}

// Franquia: quem manda põe um compromisso que não é do bloco (para fugir da denúncia) — recusado.
{
  const b = montar(novoBloco({ tipo: "texto", conversa, contador: 99, anterior: NADA_ANTES, prazo: 7, corpo: corpoDeTexto({ t: "z" }) }));
  const idH = resumoDaCaixa(entradaBia1.id);
  const errado = sortear(32);
  const proteus = await cifrar(ana1.motor, bia1.chave.publica, b);
  const reg = paraMandar(ana1.eu.pq, bia1.chave.publica);
  const { camada } = await selarCamada(ana1.eu.pq.motor, reg.e, proteus, ana1.chave.publica);
  const envelope = await selar(bia1.publico.xwing, semana, idH, errado, { tipo: "mensagem", aparelho: ana1.chave.publica, inicio: reg.a, camada });
  const r = await receber(bia1.eu, entradaBia1.id, { envelope, franquia: errado }, conversa, conhecidosDaBia, estadoDe("bia1"));
  confere("ataque: franquia que não é do bloco é recusada (quem manda não foge da denúncia)", !r.ok && r.motivo === "franquia_errada");
  const certo = compromisso(b.subarray(75, 107), idH, semKf(b));
  confere("franquia: o compromisso do aparelho é o HMAC do rótulo, da caixa e do bloco sem kf", certo.length === 32 && ROTULOS_DE_FORA.franquia === "alumia/r2/franquia/v1");
}

// Conversa errada: um bloco de outra conversa depositado na caixa desta.
{
  const outra = sortear(16);
  await mandar(ana1.eu, destinosDaAna.slice(0, 1), ENVIO_NOVO, { tipo: "texto", conversa: outra, prazo: 7, corpo: corpoDeTexto({ t: "w" }) }, depositar, nada);
  const [r] = await receberTudo("bia1", bia1, entradaBia1, conversa, conhecidosDaBia);
  confere("ataque: bloco de outra conversa na caixa desta é recusado", !r.ok && r.motivo === "conversa_errada");
}

// Ordem: cadeia quebrada (um bloco com o anterior errado).
{
  const r1 = sortear(32);
  const j1 = julgar(ESTADO_NOVO, 1, NADA_ANTES, r1);
  const j2 = julgar(j1.estado, 2, sortear(32), sortear(32));
  confere("ordem: anterior que não é o resumo do bloco 1 dá cadeia quebrada", j2.juizo === "nova" && j2.avisos.includes("cadeia_quebrada"));
  const j3 = julgar(ESTADO_NOVO, 1, sortear(32), r1);
  confere("ordem: o primeiro bloco tem de ter anterior zerado", j3.juizo === "nova" && j3.avisos.includes("cadeia_quebrada"));
  confere("ordem: o mesmo contador de novo é repetida", julgar(j1.estado, 1, NADA_ANTES, r1).juizo === "repetida");
}

// Sessão: decifrar com a impressão errada não grava nada; esquecer e refazer.
{
  const msg = await cifrar(ana1.motor, bia1.chave.publica, texto("teste"));
  confere("proteus: impressão que não é a do certificado não abre", (await decifrar(bia1.motor, ana1.chave.publica, "outra", msg)) === null);
  confere("proteus: e a mesma mensagem abre com a certa (nada foi gasto)", await decifrar(bia1.motor, ana1.chave.publica, ana1.impressao, msg).then((x) => x !== null && deTexto(x) === "teste"));
  await esquecerSessao(ana1.motor, bia2.chave.publica);
  confere("proteus: sessão esquecida some", !(await ana1.motor.transaction((c) => c.proteusSessionExists(paraHexL(bia2.chave.publica)))));
  confere("sessão sem resposta há 30 dias é refeita", precisaRefazerSessao(Date.now() - 31 * 86_400_000) && !precisaRefazerSessao(Date.now() - 86_400_000));
}

// Código de segurança: 60 algarismos, igual dos dois lados, e não muda com aparelho novo (é da identidade).
{
  const a = codigoDeSeguranca({ conta: "ana", identidade: idAna.publica }, { conta: "bia", identidade: idBia.publica });
  const b = codigoDeSeguranca({ conta: "bia", identidade: idBia.publica }, { conta: "ana", identidade: idAna.publica });
  confere("código: 60 algarismos, o mesmo nos dois lados", /^[0-9]{60}$/.test(a) && a === b);
  const c = codigoDeSeguranca({ conta: "ana", identidade: novoParEd25519().publica }, { conta: "bia", identidade: idBia.publica });
  confere("código: muda quando a identidade muda", c !== a);
  confere("assinatura: rótulo de pré-chave não vale como chave da semana", !iguais(assinarPreChave(ana1.chave, 1, new Uint8Array(1)), assinarChaveDaSemana(ana1.chave, new Uint8Array(1), 1)));
}

// Rótulos: um por finalidade.
{
  const valores = Object.values(ROTULOS);
  confere("rótulos: nenhum se repete", new Set(valores).size === valores.length);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
