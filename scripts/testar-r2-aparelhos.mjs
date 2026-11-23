// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vários aparelhos e cópia de segurança da onda R2 (item 1.5), de verdade no Node: chaves da conta e do aparelho, ligar por QR
// (HPKE X-Wing + segredo do QR), a cópia cifrada (24 palavras BIP39 ou Argon2id da libsodium + secretstream XChaCha20-Poly1305) e a
// troca semanal da chave X-Wing. Ataques como teste: QR de outra conta, canal forjado sem o segredo do QR, envelope para outro
// aparelho, QR vencido, cópia mexida, cortada ou com pedaço a mais, palavras erradas, frase errada, cópia que tenta levar sessão
// ou estado MLS, e a cópia que ressuscitaria chave velha.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-aparelhos.mjs
import { XWing } from "@noble/post-quantum/hybrid.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { iguais, paraB64Url, sortear } from "../lib/rede/chat/r2/bytes.ts";
import { novoParXWing, semanaDe } from "../lib/rede/chat/r2/envelope.ts";
import { certificadoConfere, chaveDePedidosConfere } from "../lib/rede/chat/r2/certificados.ts";
import { aparelhosConfiaveis } from "../lib/rede/chat/r2/conversa.ts";
import { novasChavesDaConta, chavesDaContaDe, chavesDaContaParaLevar, novoAparelho, trocarChaveDaSemana } from "../lib/rede/aparelhos/identidade.ts";
import { prepararQr, lerQr, selarParaONovo, abrirNoNovo, VALIDADE_DO_QR_MS } from "../lib/rede/aparelhos/ligar.ts";
import { novaChaveDaCopia, chaveDasPalavras, chaveDaFrase, cifrarCopia, abrirCopia, modoDaCopia as modoDoArquivo, FAIXAS_DA_COPIA, soOQueVai } from "../lib/rede/aparelhos/copia.ts";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
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
const motor = () => M.CoreCrypto.new(M.Database.inMemory());
const CONTA = "0b7c6a52-1f0e-4c1a-9d1e-5a7f3c2b9e10";
const OUTRA = "6f2d9c1e-8a3b-4d5e-9f10-2b3c4d5e6f70";

// ── Chaves da conta ────────────────────────────────────────────────────────────────────────────────────────────────────────
const conta = await novasChavesDaConta(CONTA);
{
  const voltou = chavesDaContaDe(chavesDaContaParaLevar(conta));
  confere("conta: as chaves voltam iguais do texto (identidade, pedidos, sincronia)", iguais(voltou.identidade.publica, conta.identidade.publica) && iguais(voltou.pedidos.publica, conta.pedidos.publica) && iguais(voltou.sincronia, conta.sincronia));
  const par = await novoParXWing();
  confere("X-Wing: a pública tirada da privada (@noble) é a mesma do @hpke", iguais(XWing.getPublicKey(par.privada), par.publica));
  confere("conta: a chave de pedidos vai assinada pela identidade", chaveDePedidosConfere(conta.identidade.publica, CONTA, conta.pedidos.publica, conta.pedidos.assinatura));
}

// ── Aparelhos ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const velho = await novoAparelho(conta, motor());
{
  confere("aparelho: certificado pela identidade da conta", certificadoConfere(conta.identidade.publica, velho.publico.certificado));
  confere("aparelho: confiável para quem conhece a identidade", aparelhosConfiaveis(CONTA, conta.identidade.publica, [velho.publico]).length === 1);
  const semanaQueVem = Date.now() + 8 * 86_400_000;
  const t1 = await trocarChaveDaSemana(velho, semanaQueVem);
  confere("semana: a chave X-Wing troca na semana seguinte e continua assinada", t1.trocou && t1.publico.semana === semanaDe(semanaQueVem) && aparelhosConfiaveis(CONTA, conta.identidade.publica, [t1.publico], semanaQueVem).length === 1);
  const depois = Date.now() + 7 * 7 * 86_400_000;
  const t2 = await trocarChaveDaSemana(velho, depois);
  confere("semana: privadas de mais de 5 semanas são apagadas", t2.apagadas.length >= 1 && t2.apagadas.every((s) => s < semanaDe(depois) - 5) && ![...velho.semanas.keys()].some((s) => s < semanaDe(depois) - 5), JSON.stringify(t2.apagadas));
}

// ── Ligar por QR ──────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const { qr, espera } = await prepararQr(CONTA);
  confere("QR: tem o prefixo e cabe num QR (menos de 2000 caracteres)", qr.startsWith("alumia:ligar:v1:") && qr.length < 2000, String(qr.length));
  confere("QR: de outra conta é recusado", lerQr(qr, OUTRA) === "outra_conta");
  confere("QR: texto qualquer é recusado", lerQr("alumia:ligar:v1:x:y", CONTA) === "invalido" && lerQr("https://exemplo.invalid", CONTA) === "invalido");
  const lido = lerQr(qr, CONTA);
  const pacote = { ...chavesDaContaParaLevar(conta), lista: { conversas: [{ caixa: "abc" }] } };
  const envelope = await selarParaONovo(lido, pacote);
  confere("ligar: o envelope tem tamanho fixo (64 KB por dentro)", envelope.length === 1120 + 64 * 1024 + 16);
  const aberto = await abrirNoNovo(espera, envelope);
  confere("ligar: o aparelho novo recebe as chaves da conta e a lista", aberto && aberto.identidade === pacote.identidade && aberto.sincronia === pacote.sincronia && aberto.lista.conversas[0].caixa === "abc");
  confere("ligar: QR vencido (mais de 10 minutos) não abre", (await abrirNoNovo(espera, envelope, Date.now() + VALIDADE_DO_QR_MS + 1)) === null);
  const outroNovo = await prepararQr(CONTA);
  confere("ligar: envelope feito para outro aparelho novo não abre", (await abrirNoNovo(outroNovo.espera, envelope)) === null);
  // Quem viu só o canal e a chave pública (o servidor não vê nem isso; alguém que viu parte do QR) e forja sem q:
  const forjado = await selarParaONovo({ ...lido, q: sortear(32) }, { ...pacote, identidade: paraB64Url(sortear(32)) });
  confere("ataque: canal forjado sem o segredo do QR é recusado", (await abrirNoNovo(espera, forjado)) === null);
  await recusa("ligar: o aparelho velho não manda chaves de outra conta pelo QR", () => selarParaONovo(lido, { ...pacote, conta: OUTRA }), "outra_conta");
  // O aparelho novo faz as PRÓPRIAS chaves com a identidade que chegou.
  const novo = await novoAparelho(chavesDaContaDe(aberto), motor());
  confere("ligar: o aparelho novo tem chave e Proteus próprios, certificados pela mesma identidade", !iguais(novo.chave.publica, velho.chave.publica) && novo.impressao !== velho.impressao && certificadoConfere(conta.identidade.publica, novo.publico.certificado));
}

// ── Cópia de segurança ────────────────────────────────────────────────────────────────────────────────────────────────────
const conteudo = { v: 1, ...chavesDaContaParaLevar(conta), lista: { conversas: [1, 2, 3] }, codigos: { bia: "1".repeat(60) }, feitaDia: 20000 };
{
  const { chave, palavras } = novaChaveDaCopia();
  confere("cópia: 24 palavras em português", palavras.length === 24);
  confere("cópia: as palavras dão a mesma chave (com maiúsculas e espaços a mais)", iguais(chaveDasPalavras(`  ${palavras.join("   ").toUpperCase()} `), chave));
  const trocada = [...palavras];
  trocada[3] = trocada[3] === "abacate" ? "abaixo" : "abacate";
  confere("cópia: palavra trocada é recusada (soma de conferência)", chaveDasPalavras(trocada.join(" ")) === null);
  confere("cópia: 12 palavras não servem", chaveDasPalavras(palavras.slice(0, 12).join(" ")) === null);
  const arquivo = await cifrarCopia(chave, conteudo, null);
  confere("cópia: o arquivo fica na faixa de 64 KB", arquivo.length > FAIXAS_DA_COPIA[0] && arquivo.length < FAIXAS_DA_COPIA[0] + 200, String(arquivo.length));
  confere("cópia: o modo vem no cabeçalho", modoDoArquivo(arquivo)?.modo === "palavras");
  const aberta = await abrirCopia(chave, arquivo);
  confere("cópia: abre com a chave das palavras", aberta && aberta.identidade === conteudo.identidade && aberta.codigos.bia === conteudo.codigos.bia);
  confere("cópia: com outra chave não abre", (await abrirCopia(sortear(32), arquivo)) === null);
  const mexido = new Uint8Array(arquivo);
  mexido[mexido.length - 40] ^= 1;
  confere("ataque: cópia mexida não abre", (await abrirCopia(chave, mexido)) === null);
  const grande = await cifrarCopia(chave, { ...conteudo, historico: "x".repeat(100_000) }, null);
  confere("cópia: maior vai à faixa de 256 KB, em vários pedaços", grande.length > FAIXAS_DA_COPIA[1]);
  confere("ataque: cópia cortada no fim (sem o último pedaço) não abre", (await abrirCopia(chave, grande.subarray(0, grande.length - (64 * 1024 + 17)))) === null);
  confere("ataque: cópia com bytes a mais no fim não abre", (await abrirCopia(chave, new Uint8Array([...grande, 1, 2, 3]))) === null);
  const cab = new Uint8Array(arquivo);
  cab[5] ^= 1;
  confere("ataque: cabeçalho mexido não abre (é dado associado do primeiro pedaço)", (await abrirCopia(chave, cab)) === null);
  const outra = await cifrarCopia(chave, conteudo, null);
  confere("cópia: duas gravações iguais dão arquivos diferentes (cabeçalho do secretstream sorteado; nonce nunca se repete)", !iguais(outra.subarray(33, 57), arquivo.subarray(33, 57)));
  const comSessao = soOQueVai({ ...conteudo, proteus: "sessao", mls: "estado", xwingDaSemana: "x", preChaves: [1], aparelho: "chave" });
  confere("cópia: sessão Proteus, estado MLS, chave da semana, pré-chave e chave do aparelho NÃO entram", !("proteus" in comSessao) && !("mls" in comSessao) && !("xwingDaSemana" in comSessao) && !("preChaves" in comSessao) && !("aparelho" in comSessao));
  const restaurada = await abrirCopia(chave, await cifrarCopia(chave, { ...conteudo, proteus: "sessao" }, null));
  confere("cópia: nem se alguém puser no objeto (a lista fechada vale na ida e na volta)", restaurada && !("proteus" in restaurada));
  const depois = await novoAparelho(chavesDaContaDe(restaurada), motor());
  confere("cópia: restaurar cria aparelho NOVO (não ressuscita a chave do aparelho velho)", !iguais(depois.chave.publica, velho.chave.publica) && depois.impressao !== velho.impressao);
}
{
  const inicio = Date.now();
  const { chave, cabecalho } = await chaveDaFrase("uma frase longa que só eu sei");
  const ms = Date.now() - inicio;
  confere("frase: Argon2id com 64 MiB, 3 passadas, 1 linha", cabecalho.m === 64 * 1024 * 1024 && cabecalho.t === 3 && cabecalho.p === 1 && cabecalho.sal.length === 16);
  const arquivo = await cifrarCopia(chave, conteudo, cabecalho);
  const modo = modoDoArquivo(arquivo);
  confere("frase: o cabeçalho leva o sal e os valores", modo?.modo === "frase" && iguais(modo.argon2id.sal, cabecalho.sal) && modo.argon2id.m === cabecalho.m);
  const deNovo = await chaveDaFrase("uma frase longa que só eu sei", modo.argon2id);
  confere("frase: a mesma frase abre", (await abrirCopia(deNovo.chave, arquivo))?.conta === CONTA);
  const errada = await chaveDaFrase("uma frase longa que so eu sei", modo.argon2id);
  confere("frase: outra frase não abre", (await abrirCopia(errada.chave, arquivo)) === null);
  await recusa("ataque: arquivo com Argon2id mais fraco (o servidor mexe no cabeçalho) é recusado antes de derivar", () => chaveDaFrase("x", { ...modo.argon2id, m: 1024 }), "argon2id_fraco");
  console.log(`  (Argon2id 64 MiB: ${ms} ms neste computador)`);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
