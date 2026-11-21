// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 137 e 138: o anexo cifrado do chat (áudio e vídeo curto), de ponta a ponta no Node.
//   1. o módulo (lib/rede/chat/anexo-cifrado.ts): o arquivo é cifrado com uma chave só dele, ganha enchimento até o degrau de 64 KiB,
//      e o corpo (chave, endereço, resumos, tamanhos, duração, prazo) vai e volta; mexido, não abre; tetos de tamanho e duração;
//   2. o depósito (app/api/alumia/anexo → lib/rede/chat/anexo-servidor.ts) sobre o banco local com a migração
//      20261127-p4-anexo-cifrado.sql: ANTES da migração a rota não guarda nada; depois, só com o interruptor ligado, só com passe
//      anônimo e sem sessão; o banco guarda só o resumo do endereço, o tamanho arredondado e o dia do vencimento; o depósito guarda
//      só o cifrado; ver uma vez e apagar tiram na hora; a faxina tira o vencido e põe o arquivo na fila;
//   3. a REGRA DE PRIVACIDADE: o servidor (banco, depósito e o que passou pela rota) nunca recebe o arquivo aberto nem a chave, não
//      guarda conta, endereço de rede nem hora; a mensagem do chat que leva o corpo tem o MESMO tamanho de envelope de um texto curto
//      (o tamanho do arquivo não vaza pelo envelope nem pelo ritmo);
//   4. o chat a dois (lib/rede/chat/r2/servico.ts) com o motor de verdade: o bloco "anexo" chega à outra pessoa e aos meus outros
//      aparelhos, o corpo fora do formato cai, "ver uma vez" não fica para quem mandou, e o texto depois do anexo segue normal;
//   5. o grupo (lib/rede/membros/grupo.ts, MLS): o anexo vai como tipo novo de conteúdo dentro da mensagem de aplicação;
//   6. no código: a flag só pelo nome, nada de Math.random, e a tela atrás da flag.
// Uso: npm run testar:p4-anexo-cifrado
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";
import { criarBanco } from "./banco-local.mjs";
import {
  abrirAnexo, comEnchimento, contextoDaConversa, corpoGuardado, corpoParaGuardar, lerCorpoDeAnexo, MAIOR_CIFRADO, montarCorpoDeAnexo, PASSO, prepararAnexo, TETOS,
} from "../lib/rede/chat/anexo-cifrado.ts";
import { caminhoDoResumo, resumoDoEndereco, tratarAnexo } from "../lib/rede/chat/anexo-servidor.ts";
import { baixarAnexo, depositarAnexo, tirarAnexo } from "../lib/rede/chat/anexo-deposito.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function recusa(nome, f, codigo) {
  try {
    await f();
    falhas.push(`${nome}: deveria recusar com "${codigo}"`);
  } catch (e) {
    if (String(e?.code ?? e?.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${e?.code ?? e?.message}"`);
  }
}
const canonico = (o) => JSON.stringify(o && Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
const contem = (grande, pequeno) => pequeno.length > 0 && Buffer.from(grande).indexOf(Buffer.from(pequeno)) >= 0;
const sorteio = (n) => {
  const b = new Uint8Array(new ArrayBuffer(n));
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(b.subarray(i, Math.min(n, i + 65536)));
  return b;
};
const b64 = (b) => Buffer.from(b).toString("base64url");

/** Um "áudio" Ogg de mentira: o cabeçalho de verdade e bytes sorteados (o tipo vale pelos primeiros bytes). */
function audioDeTeste(n) {
  const a = sorteio(n);
  a.set(new TextEncoder().encode("OggS"), 0);
  return a;
}
/** Um "vídeo" WebM de mentira (a assinatura Matroska). */
function videoDeTeste(n) {
  const v = sorteio(n);
  v.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  return v;
}

// ═══════════════════ 1. O módulo ═══════════════════
const CONVERSA = contextoDaConversa("r2", "conversa-de-teste");
const audio = audioDeTeste(150_000);
const pronto = await prepararAnexo(audio, "audio/ogg", 12_300, CONVERSA, { dias: 7 });
confere("módulo: o áudio vira tipo 'audio' pelos primeiros bytes", pronto.corpo.tipo === "audio" && pronto.corpo.mime === "audio/ogg");
confere("módulo: o cifrado tem o tamanho do degrau (múltiplo de 64 KiB + 16), não o do arquivo", pronto.cifrado.length === comEnchimento(150_000) + 16 && (pronto.cifrado.length - 16) % PASSO === 0 && pronto.cifrado.length !== 150_016);
confere("módulo: o tamanho de verdade vai só no corpo", pronto.corpo.aberto === 150_000 && pronto.corpo.tamanho === pronto.cifrado.length);
confere("módulo: o cifrado não contém nenhum pedaço do aberto", !contem(pronto.cifrado, audio.subarray(1000, 1032)) && !contem(pronto.cifrado, audio.subarray(0, 32)));
const chaveCrua = Buffer.from(pronto.corpo.chave, "base64url");
confere("módulo: a chave tem 32 bytes sorteados e não está no cifrado", chaveCrua.length === 32 && !contem(pronto.cifrado, chaveCrua));
const ENDERECO = "0123456789abcdef0123456789abcdef";
const corpoBytes = montarCorpoDeAnexo({ ...pronto.corpo, endereco: ENDERECO });
const lido = lerCorpoDeAnexo(corpoBytes);
confere("módulo: o corpo vai e volta igual", canonico(lido) === canonico({ ...pronto.corpo, endereco: ENDERECO }), JSON.stringify(lido));
confere("módulo: o corpo é pequeno (cabe no envelope de sempre)", corpoBytes.length < 200, String(corpoBytes.length));
confere("módulo: o corpo guardado no histórico volta igual", canonico(corpoGuardado(corpoParaGuardar(corpoBytes))) === canonico(lido));
const aberto = await abrirAnexo(pronto.cifrado, lido, CONVERSA);
confere("módulo: abre e corta o enchimento (o arquivo de volta, byte a byte)", aberto && aberto.length === audio.length && Buffer.from(aberto).equals(Buffer.from(audio)));
confere("módulo: em outra conversa (outro AAD) não abre", (await abrirAnexo(pronto.cifrado, lido, contextoDaConversa("r2", "outra"))) === null);
const mexido = new Uint8Array(pronto.cifrado);
mexido[500] ^= 1;
confere("módulo: cifrado mexido não abre (o resumo do cifrado não bate)", (await abrirAnexo(mexido, lido, CONVERSA)) === null);
confere("módulo: corpo com tamanho de verdade trocado não abre", (await abrirAnexo(pronto.cifrado, { ...lido, aberto: lido.aberto - 1 }, CONVERSA)) === null);
confere("módulo: corpo de outra versão não lê", lerCorpoDeAnexo(Uint8Array.from([2, ...corpoBytes.subarray(1)])) === null);
confere("módulo: corpo cortado ou com sobra não lê", lerCorpoDeAnexo(corpoBytes.subarray(0, corpoBytes.length - 1)) === null && lerCorpoDeAnexo(Uint8Array.from([...corpoBytes, 0])) === null);
{
  const outro = new Uint8Array(corpoBytes);
  new DataView(outro.buffer).setUint32(131, 70_000); // diz que o arquivo tem 70 000 bytes num cifrado de 3 degraus: não fecha
  confere("módulo: corpo com tamanho de verdade que não cabe no degrau não lê", lerCorpoDeAnexo(outro) === null);
}
await recusa("módulo: áudio de mais de 1 minuto é recusado no aparelho", () => prepararAnexo(audioDeTeste(2000), "audio/ogg", 61_000, CONVERSA, { dias: 1 }), "anexo_longo");
await recusa("módulo: áudio acima de 3 MB é recusado no aparelho", () => prepararAnexo(audioDeTeste(TETOS.audio.bytes + 1), "audio/ogg", 1000, CONVERSA, { dias: 1 }), "anexo_grande");
await recusa("módulo: arquivo que não é áudio nem vídeo (PDF) é recusado", () => prepararAnexo(Uint8Array.from(Buffer.from("%PDF-1.7 qualquer coisa")), "application/pdf", 0, CONVERSA, { dias: 1 }), "anexo_tipo");
await recusa("módulo: prazo fora de 1, 7 ou 30 dias é recusado", () => prepararAnexo(audioDeTeste(2000), "audio/ogg", 1000, CONVERSA, { dias: 3 }), "anexo_invalido");
// Item 138: o vídeo curto.
const video = videoDeTeste(2_500_000);
const pv = await prepararAnexo(video, "video/webm", 45_000, CONVERSA, { dias: 30, umaVez: true });
confere("138: o vídeo curto vira tipo 'video', com ver uma vez", pv.corpo.tipo === "video" && pv.corpo.mime === "video/webm" && pv.corpo.umaVez === true);
const lv = lerCorpoDeAnexo(montarCorpoDeAnexo({ ...pv.corpo, endereco: ENDERECO }));
confere("138: o vídeo abre de volta igual", lv && Buffer.from(await abrirAnexo(pv.cifrado, lv, CONVERSA)).equals(Buffer.from(video)));
await recusa("138: vídeo de mais de 1 minuto é recusado", () => prepararAnexo(videoDeTeste(5000), "video/webm", 60_001, CONVERSA, { dias: 1 }), "anexo_longo");
await recusa("138: vídeo acima do teto (159 degraus, 9,9 MiB) é recusado", () => prepararAnexo(videoDeTeste(TETOS.video.bytes + 1), "video/webm", 1000, CONVERSA, { dias: 1 }), "anexo_grande");
confere("138: o maior cifrado é o teto do vídeo arredondado mais a marca", MAIOR_CIFRADO === comEnchimento(TETOS.video.bytes) + 16 && MAIOR_CIFRADO === 159 * PASSO + 16);
confere("138: o maior cifrado passa inteiro pelo proxy do Next (10 MiB, proxyClientMaxBodySize padrão)", MAIOR_CIFRADO <= 10 * 1024 * 1024 && !/proxyClientMaxBodySize/.test(ler("next.config.ts")));
confere("138: o teto do banco e do depósito é o mesmo do aparelho", ler("supabase/migracoes/20261127-p4-anexo-cifrado.sql").includes(`tamanho <= ${MAIOR_CIFRADO} `) && ler("supabase/migracoes/20261127-p4-anexo-cifrado.sql").includes(`false, ${MAIOR_CIFRADO}, array`));
{
  // Um WebM do gravador de voz (o navegador diz "audio/webm") é áudio; sem pista, é vídeo.
  const w = videoDeTeste(4000);
  confere("módulo: WebM do gravador de voz é áudio", (await prepararAnexo(w, "audio/webm;codecs=opus", 1000, CONVERSA, { dias: 1 })).corpo.tipo === "audio");
}

// ═══════════════════ 2. O depósito sobre o banco local ═══════════════════
const SQL = ler("supabase/migracoes/20261127-p4-anexo-cifrado.sql").replace(/^﻿/, "");
// Depois da junção a migração já está no install.sql: o banco de antes é o install.sql cortado antes dela.
const bancoDeAntes = () => criarBanco(ler("supabase/install.sql").replace(/\r\n/g, "\n").includes(SQL.replace(/\r\n/g, "\n").trim()) ? { antesDe: SQL } : {});
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
confere("migração: termina passando a porta", /select interno\.alumia_trancar\(\);\s*$/.test(SQL));
confere("migração: diz que roda depois do p5-fim (banco 17)", SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)"));
confere("migração: não mexe na versão nem na lista da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
confere("migração: nada de endereço de rede", !/\binet\b|x-forwarded|cf-connecting|remote_addr|interno\.origem/i.test(semComentario));
confere("migração: a tabela não tem conta, hora nem tipo de arquivo", !/create table[^;]*\b(usuario|autor|conta|criado_em|em timestamptz|mime|tipo)\b[^;]*\);/is.test(semComentario.match(/create table if not exists interno\.alumia_anexos[\s\S]*?\);/)?.[0] ?? "x"));

/** O depósito em memória (o Storage), que anota tudo o que recebeu. */
function depositoNovo() {
  const d = { arquivos: new Map(), recebido: [], apagados: [] };
  return {
    d,
    guardar: async (c, b) => {
      if (d.arquivos.has(c)) return false;
      d.arquivos.set(c, new Uint8Array(b));
      d.recebido.push(new Uint8Array(b));
      return true;
    },
    ler: async (c) => d.arquivos.get(c) ?? null,
    apagar: async (c) => {
      d.apagados.push(c);
      return d.arquivos.delete(c);
    },
  };
}
/** O passe de mentira: "PrivateToken token=<x>" vale, e o resumo é o SHA-256 de x (o banco recusa o repetido). */
const conferirPasse = async (cab) => {
  const m = /^PrivateToken token="?([A-Za-z0-9_-]+)"?$/.exec((cab ?? "").trim());
  return m ? { ok: true, resumo: sha256(new TextEncoder().encode(m[1])) } : { ok: false, motivo: "sem_passe" };
};
function pecasCom(banco, deposito, rpcs) {
  return {
    async rpc(funcao, argumentos) {
      rpcs?.push({ funcao, argumentos });
      // A API do banco (PostgREST) aceita bytea como texto "\x…"; o banco local quer os bytes.
      const args = Object.fromEntries(Object.entries(argumentos).map(([k, v]) => [k, typeof v === "string" && /^\\x[0-9a-f]*$/.test(v) ? Buffer.from(v.slice(2), "hex") : v]));
      try {
        return { ok: true, dado: await banco.rpc({ papel: "service_role" }, funcao, args) };
      } catch (e) {
        return { ok: false, codigo: /^[a-z_:]{3,40}$/.test(e.message) ? e.message : "banco" };
      }
    },
    conferirPasse,
    guardar: deposito.guardar,
    ler: deposito.ler,
    apagar: deposito.apagar,
    sortear: (n) => crypto.getRandomValues(new Uint8Array(n)),
    // A flag, lida do banco (no site: recursoLigado("alumia-p4-anexo-cifrado")).
    ligado: async () => (await banco.dono("select coalesce((select ligado from interno.recursos_vivos where nome = 'alumia-p4-anexo-cifrado'), false) as l")).rows[0].l === true,
  };
}
const pedir = (metodo, q, corpo, cab = {}) => new Request(`https://alumia.invalid/api/alumia/anexo?${q}`, { method: metodo, headers: cab, ...(corpo ? { body: corpo } : {}) });
let passes = 0;
const novoPasse = () => `PrivateToken token="passe${++passes}x"`;

// Antes da migração: a rota não tem onde registrar, e nada fica no depósito.
{
  const banco = await bancoDeAntes();
  const dep = depositoNovo();
  const r = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado, { Authorization: novoPasse() }), pecasCom(banco, dep));
  confere("antes da migração: a rota não aceita o anexo (o banco não tem o registro)", r.status >= 400 && dep.d.arquivos.size === 0, String(r.status));
  await banco.pg.close?.();
}

const banco = await criarBanco();
const versaoAntes = (await banco.dono("select public.rede_alumia_versao() as v")).rows[0].v;
await banco.pg.exec(SQL);
await banco.pg.exec(SQL);
// A migração não mexe na versão (é do 20261127-p4-fim.sql): 17 antes da junção, 18 depois.
confere("migração: roda duas vezes sem erro, e a versão do banco não muda", versaoAntes >= 17 && (await banco.dono("select public.rede_alumia_versao() as v")).rows[0].v === versaoAntes);
const dep = depositoNovo();
const rpcs = [];
const P = pecasCom(banco, dep, rpcs);

{
  const r = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado, { Authorization: novoPasse() }), P);
  confere("flag desligada: o depósito responde 404 e não guarda nada", r.status === 404 && dep.d.arquivos.size === 0, String(r.status));
  confere("flag desligada: o passe não foi gasto", (await banco.dono("select count(*)::int n from interno.passes_gastos")).rows[0].n === 0);
  // Auditoria do P4 (B1): desligada, a rota não pode dizer que existe. Antes, só o POST com passe e o GET de endereço válido davam
  // 404; o resto respondia 401, 400 ou 502 (e o 401 "passe" mostrava que havia um depósito ali).
  const tentativas = [
    ["POST sem passe", pedir("POST", "d=7", pronto.cifrado)],
    ["POST com prazo inválido", pedir("POST", "d=3", pronto.cifrado, { Authorization: novoPasse() })],
    ["POST com cookie de sessão", pedir("POST", "d=7", pronto.cifrado, { Authorization: novoPasse(), Cookie: "sb-abc-auth-token=xyz" })],
    ["GET com endereço mal formado", pedir("GET", "e=xyz")],
    ["GET com cookie de sessão", pedir("GET", `e=${"a".repeat(32)}`, null, { Cookie: "sb-x=1" })],
    ["GET de endereço válido", pedir("GET", `e=${"a".repeat(32)}`)],
    ["DELETE", pedir("DELETE", `e=${"a".repeat(32)}`)],
    ["PUT", pedir("PUT", `e=${"a".repeat(32)}`)],
  ];
  const respostas = [];
  rpcs.length = 0;
  for (const [nome, pedido] of tentativas) {
    const r = await tratarAnexo(pedido, P);
    respostas.push(`${nome}: ${r.status} ${await r.text()}`);
  }
  confere("flag desligada: todo pedido (qualquer método, com ou sem passe, endereço bom ou ruim) dá o mesmo 404", respostas.every((x) => /: 404 {"erro":"nao_encontrado"}$/.test(x)), respostas.join(" | "));
  confere("flag desligada: a rota nem chama o banco", rpcs.length === 0, JSON.stringify(rpcs.map((x) => x.funcao)));
  confere("a rota do site confere a flag antes de tudo (recursoLigado)", ler("app/api/alumia/anexo/route.ts").includes('ligado: () => recursoLigado("alumia-p4-anexo-cifrado")') && ler("app/api/alumia/anexo/route.ts").includes('import { recursoLigado } from "@/lib/recursos-vivos";'));
}
await banco.dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-anexo-cifrado', true) on conflict (nome) do update set ligado = true");

{
  const r = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado, { Authorization: novoPasse(), Cookie: "sb-abc-auth-token=xyz" }), P);
  confere("com cookie de sessão: recusado sem olhar o resto", r.status === 400 && (await r.json()).erro === "sem_sessao_aqui");
  const r2 = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado, { Authorization: "Bearer eyJ.conta" }), P);
  confere("com token de conta: recusado", r2.status === 400);
  const r3 = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado), P);
  confere("sem passe: recusado", r3.status === 401);
  const r4 = await tratarAnexo(pedir("POST", "d=7", audio, { Authorization: novoPasse() }), P);
  confere("tamanho fora do degrau (o arquivo cru, sem enchimento): recusado", r4.status === 400 && (await r4.json()).erro === "tamanho");
  const r5 = await tratarAnexo(pedir("POST", "d=3", pronto.cifrado, { Authorization: novoPasse() }), P);
  confere("prazo fora de 1, 7, 30: recusado", r5.status === 400);
  const r6 = await tratarAnexo(pedir("POST", "d=7", new Uint8Array(MAIOR_CIFRADO + PASSO), { Authorization: novoPasse() }), P);
  confere("acima do maior cifrado: recusado", r6.status === 413);
  confere("nenhum dos recusados guardou nada", dep.d.arquivos.size === 0);
}

const passeDoAudio = novoPasse();
const rAudio = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado, { Authorization: passeDoAudio }), P);
const respostaDoAudio = await rAudio.json();
const endereco = respostaDoAudio.endereco ?? "";
if (!endereco) console.log("POST do áudio:", rAudio.status, JSON.stringify(respostaDoAudio));
confere("depósito: guarda e devolve um endereço de 128 bits", rAudio.status === 200 && /^[0-9a-f]{32}$/.test(endereco ?? ""), String(rAudio.status));
const idH = resumoDoEndereco(endereco) ?? "0".repeat(64);
confere("depósito: o arquivo fica no caminho tirado do RESUMO do endereço (o endereço não aparece)", dep.d.arquivos.has(caminhoDoResumo(idH)) && ![...dep.d.arquivos.keys()].some((k) => k.replace(/[-/]/g, "").includes(endereco)));
{
  const r = await tratarAnexo(pedir("POST", "d=7", pronto.cifrado, { Authorization: passeDoAudio }), P);
  confere("depósito: o mesmo passe não serve duas vezes", r.status === 409 && dep.d.arquivos.size === 1);
}
const linhas = (await banco.dono("select * from interno.alumia_anexos")).rows;
confere("banco: uma linha só, com o resumo do endereço, o tamanho arredondado e o dia do vencimento", linhas.length === 1 && linhas[0].id_h === idH && linhas[0].tamanho === pronto.cifrado.length && Object.keys(linhas[0]).sort().join() === "id_h,tamanho,vence");
confere("banco: vence em 7 dias (só o dia, sem hora)", (await banco.dono("select (vence = current_date + 7) as ok, pg_typeof(vence)::text t from interno.alumia_anexos")).rows[0].ok === true);

// A REGRA DE PRIVACIDADE do item: o servidor nunca recebe o aberto nem a chave.
{
  const tudoDoServidor = Buffer.concat([
    ...dep.d.recebido.map((b) => Buffer.from(b)),
    Buffer.from(JSON.stringify(rpcs)),
    Buffer.from(JSON.stringify((await banco.dono("select * from interno.alumia_anexos")).rows)),
    Buffer.from(JSON.stringify((await banco.dono("select * from interno.passes_gastos")).rows)),
  ]);
  confere("privacidade: o servidor não tem nenhum pedaço do áudio aberto", !contem(tudoDoServidor, audio.subarray(0, 64)) && !contem(tudoDoServidor, audio.subarray(70_000, 70_064)));
  confere("privacidade: o servidor não tem a chave do arquivo (nem em base64)", !contem(tudoDoServidor, chaveCrua) && !tudoDoServidor.includes(pronto.corpo.chave));
  confere("privacidade: o banco não tem o endereço de verdade", !JSON.stringify((await banco.dono("select * from interno.alumia_anexos")).rows).includes(endereco));
  const colunas = (await banco.dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'alumia_anexos'")).rows.map((x) => x.column_name);
  confere("privacidade: nenhuma coluna de conta, endereço de rede ou hora", colunas.sort().join() === "id_h,tamanho,vence", colunas.join());
}

// O banco não abre para quem tem conta nem para anon.
for (const papel of ["anon", "authenticated"]) {
  for (const [f, a] of [["alumia_anexo_reservar", { p_id_h: "0".repeat(64), p_tamanho: PASSO + 16, p_dias: 1, p_passe: new Uint8Array(32) }], ["alumia_anexo_ver", { p_id_h: idH }], ["alumia_anexo_tirar", { p_id_h: idH }]]) {
    let negou = false;
    try {
      await banco.rpc({ papel, sub: papel === "authenticated" ? "aaaaaaaa-0000-4000-8000-000000000001" : undefined }, f, a);
    } catch (e) {
      negou = /permission denied|sem_permissao/.test(e.message);
    }
    confere(`banco: ${f} negado para ${papel}`, negou);
  }
  let leu = false;
  try {
    await banco.dono(`set role ${papel}`);
    await banco.dono("select * from interno.alumia_anexos");
    leu = true;
  } catch {
    leu = false;
  } finally {
    await banco.dono("reset role");
  }
  confere(`banco: a tabela não abre para ${papel}`, !leu);
}

// Baixar.
{
  const r = await tratarAnexo(pedir("GET", `e=${endereco}`), P);
  const b = new Uint8Array(await r.arrayBuffer());
  confere("baixar: devolve o cifrado, sem cache", r.status === 200 && Buffer.from(b).equals(Buffer.from(pronto.cifrado)) && r.headers.get("cache-control") === "no-store");
  confere("baixar: com cookie de sessão, recusado", (await tratarAnexo(pedir("GET", `e=${endereco}`, null, { Cookie: "sb-x=1" }), P)).status === 400);
  confere("baixar: endereço inventado dá 404", (await tratarAnexo(pedir("GET", `e=${"f".repeat(32)}`), P)).status === 404);
  confere("baixar: endereço fora do formato dá 400", (await tratarAnexo(pedir("GET", "e=xyz"), P)).status === 400);
}

// O caminho do aparelho (anexo-deposito.ts) contra a mesma rota: sem cookie, sem conta, com passe.
{
  const vistos = [];
  const pecasDoAparelho = {
    base: "",
    passe: async () => novoPasse(),
    fetch: async (url, init) => {
      vistos.push({ url: String(url), init });
      return tratarAnexo(new Request(`https://alumia.invalid${url}`, { method: init.method, headers: init.headers, body: init.body }), P);
    },
  };
  const end2 = await depositarAnexo(pv.cifrado, 30, pecasDoAparelho);
  confere("aparelho: deposita o vídeo e recebe o endereço", /^[0-9a-f]{32}$/.test(end2));
  confere("aparelho: todo pedido vai sem credencial nem referência", vistos.every((v) => v.init.credentials === "omit" && v.init.referrerPolicy === "no-referrer"));
  confere("aparelho: só o POST leva o passe; nenhum leva cookie", vistos.every((v) => !("Cookie" in (v.init.headers ?? {}))));
  const baixado = await baixarAnexo({ endereco: end2, tamanho: pv.cifrado.length }, pecasDoAparelho);
  confere("aparelho: baixa e abre o vídeo", baixado && Buffer.from(await abrirAnexo(baixado, { ...lv, endereco: end2 }, CONVERSA)).equals(Buffer.from(video)));
  confere("aparelho: tamanho diferente do corpo, não aceita", (await baixarAnexo({ endereco: end2, tamanho: pv.cifrado.length - PASSO }, pecasDoAparelho)) === null);
  await tirarAnexo(end2, pecasDoAparelho);
  confere("ver uma vez / apagar: some do banco e do depósito na hora", (await baixarAnexo({ endereco: end2, tamanho: pv.cifrado.length }, pecasDoAparelho)) === null
    && !dep.d.arquivos.has(caminhoDoResumo(resumoDoEndereco(end2))));
  const fila = (await banco.dono("select deposito, caminho from interno.alumia_arquivos_a_apagar where deposito = 'alumia-anexos'")).rows;
  confere("apagar: o caminho também entra na fila do servidor (garantia se o depósito falhar)", fila.some((x) => x.caminho === caminhoDoResumo(resumoDoEndereco(end2))));
  await recusa("aparelho: cifrado sem enchimento nem sai do aparelho", () => depositarAnexo(audio, 7, pecasDoAparelho), "anexo_grande");
}

// A faxina do prazo.
{
  await banco.dono("update interno.alumia_anexos set vence = current_date - 1 where id_h = $1", [idH]);
  confere("vencido: o depósito não entrega mais (mesmo antes da faxina)", (await tratarAnexo(pedir("GET", `e=${endereco}`), P)).status === 404);
  const n = (await banco.dono("select interno.alumia_anexos_faxina() n")).rows[0].n;
  confere("faxina: tira o vencido e põe o arquivo na fila do servidor", n === 1 && (await banco.dono("select count(*)::int n from interno.alumia_anexos")).rows[0].n === 0
    && (await banco.dono("select count(*)::int n from interno.alumia_arquivos_a_apagar where deposito = 'alumia-anexos' and caminho = $1", [caminhoDoResumo(idH)])).rows[0].n === 1);
}
{
  const faxina = ler("app/api/rede/exportar/faxina/route.ts");
  confere("faxina: a rota que esvazia a fila conhece o depósito novo", /"alumia-anexos"\]/.test(faxina));
}
// A flag desligada de novo: nada sai.
{
  const r = await tratarAnexo(pedir("POST", "d=1", pronto.cifrado, { Authorization: novoPasse() }), P);
  const e = (await r.json()).endereco;
  await banco.dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-p4-anexo-cifrado'");
  confere("flag desligada depois: o que estava guardado não sai mais", (await tratarAnexo(pedir("GET", `e=${e}`), P)).status === 404);
  await banco.dono("update interno.recursos_vivos set ligado = true where nome = 'alumia-p4-anexo-cifrado'");
}

// ═══════════════════ 3 e 4. O chat a dois, com o motor de verdade ═══════════════════
const { motorNoNode } = await import("./cifra-no-node.mjs");
const { spqrNoNode } = await import("./spqr-no-node.mjs");
const { paraB64Url, texto, juntar } = await import("../lib/rede/chat/r2/bytes.ts");
const { ChatDoAparelho } = await import("../lib/rede/chat/r2/servico.ts");
const { cofreDaLista } = await import("../lib/rede/aparelhos/sincronia.ts");
const { TAMANHOS_DO_ARQUIVO } = await import("../lib/rede/aparelhos/arquivo.ts");
const { TAMANHO_DO_PEDIDO } = await import("../lib/rede/chat/r2/pedido.ts");
const { ROTULOS_DE_FORA } = await import("../lib/rede/chat/r2/rotulos.ts");
const { montar, novoBloco } = await import("../lib/rede/chat/r2/bloco.ts");
const M = await motorNoNode();
const SPQR = await spqrNoNode();
const H = (rotulo, v) => sha256(juntar(texto(rotulo), v));
const servidor = { caixas: new Map(), contas: new Map(), aparelhos: new Map(), preChaves: new Map(), cofres: new Map(), depositos: [] };
const relogio = { agora: Date.UTC(2026, 10, 27, 12) };
const dia = () => new Date(relogio.agora).toISOString().slice(0, 10);
const caixaDe = (id) => servidor.caixas.get(paraB64Url(H(ROTULOS_DE_FORA.caixa, id)));
const codinomeDe = {};
function transporteDe(usuario) {
  return {
    async criarCaixa(c) {
      const k = paraB64Url(H(ROTULOS_DE_FORA.caixa, c.id));
      const plh = paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl));
      const ja = servidor.caixas.get(k);
      if (ja) {
        if (ja.pl_h !== plh) throw new Error("caixa_existe");
        return;
      }
      servidor.caixas.set(k, { pd_h: paraB64Url(c.pdH), pd_anterior_h: null, pl_h: plh, proxima: 1, pacotes: [] });
    },
    async depositar(c, envelope, franquia) {
      const cx = caixaDe(c.id);
      const pdh = paraB64Url(H(ROTULOS_DE_FORA.passeDeposito, c.pd));
      const aceito = !!cx && (cx.pd_h === pdh || cx.pd_anterior_h === pdh);
      servidor.depositos.push({ tamanho: envelope.length, envelope: new Uint8Array(envelope), aceito });
      if (aceito) cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: franquia && new Uint8Array(franquia), dia: dia() });
      return { ok: true };
    },
    async buscar(c, cursor) {
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return [];
      return cx.pacotes.filter((p) => p.ordem > cursor).map((p) => ({ ...p, marca: null }));
    },
    async confirmar(c, ate) {
      const cx = caixaDe(c.id);
      if (cx && cx.pl_h === paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) cx.pacotes = cx.pacotes.filter((p) => p.ordem > ate);
    },
    async trocar(c, pdH, bloqueio) {
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return;
      cx.pd_anterior_h = bloqueio ? null : cx.pd_h;
      cx.pd_h = paraB64Url(pdH);
    },
    async apagar(c) {
      const k = paraB64Url(H(ROTULOS_DE_FORA.caixa, c.id));
      const cx = servidor.caixas.get(k);
      if (cx && cx.pl_h === paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) servidor.caixas.delete(k);
    },
    async lerDiretorio(codinome) {
      const [u, c] = [...servidor.contas].find(([, x]) => x.codinome === codinome) ?? [];
      if (!u) return null;
      const aparelhos = [...servidor.aparelhos.values()].filter((a) => a.usuario === u).map((a) => ({ ...a, usuario: undefined }));
      return { usuario: u, identidade: c.identidade, pedidosXwing: c.pedidosXwing, pedidosAssinatura: c.pedidosAssinatura, pedidosCaixa: c.pedidosCaixa, pedidosPd: c.pedidosPd, aparelhos };
    },
    async reivindicar(u) {
      const saida = [];
      for (const [k, a] of servidor.aparelhos) {
        if (a.usuario !== u) continue;
        const lista = servidor.preChaves.get(k) ?? [];
        const i = lista.findIndex((p) => !p.ultima);
        const p = i >= 0 ? lista.splice(i, 1)[0] : lista.find((x) => x.ultima);
        if (p) saida.push({ aparelho: a.aparelho, id: p.id, pre: p.pkb, assinatura: p.assinatura });
      }
      return saida;
    },
    async depositarPedido(codinome, envelope) {
      if (envelope.length !== TAMANHO_DO_PEDIDO) throw new Error("tamanho");
      const c = [...servidor.contas.values()].find((x) => x.codinome === codinome);
      if (c) await this.depositar({ id: c.pedidosCaixa, pd: c.pedidosPd }, envelope, null);
    },
    async publicarConta(c) {
      const k = paraB64Url(H(ROTULOS_DE_FORA.caixa, c.pedidosCaixa));
      const ja = servidor.caixas.get(k);
      servidor.caixas.set(k, { pd_h: paraB64Url(H(ROTULOS_DE_FORA.passeDeposito, c.pedidosPd)), pd_anterior_h: null, pl_h: paraB64Url(H(ROTULOS_DE_FORA.passeLeitura, c.pedidosPl)), proxima: ja?.proxima ?? 1, pacotes: ja?.pacotes ?? [] });
      const publico = { ...c };
      delete publico.pedidosPl;
      servidor.contas.set(usuario, { ...publico, codinome: codinomeDe[usuario] });
    },
    async publicarAparelho(a) {
      servidor.aparelhos.set(paraB64Url(a.aparelho), { ...a, usuario });
    },
    async publicarPreChaves(aparelho, lista) {
      servidor.preChaves.set(paraB64Url(aparelho), [...lista]);
    },
    async tirarAparelho(aparelho) {
      servidor.aparelhos.delete(paraB64Url(aparelho));
    },
    async lerCofre(tipo) {
      return servidor.cofres.get(`${usuario}:${tipo}`) ?? null;
    },
    async gravarCofre(tipo, versao, blob) {
      if (!TAMANHOS_DO_ARQUIVO.includes(blob.length)) throw new Error("invalido:tamanho");
      const k = `${usuario}:${tipo}`;
      if ((servidor.cofres.get(k)?.versao ?? 0) !== versao) return "versao_ocupada";
      servidor.cofres.set(k, { versao: versao + 1, blob: new Uint8Array(blob) });
      return { versao: versao + 1 };
    },
  };
}
function historicoNovo() {
  const m = new Map();
  return {
    m,
    async guardar(x) {
      m.set(`${x.conversa}:${x.id}:${x.aparelho}`, { ...x });
    },
    async apagar(conversa, id, autor) {
      for (const [k, x] of m) if (x.conversa === conversa && x.id === id && x.autor === autor) m.delete(k);
    },
    async apagarConversa(conversa) {
      for (const [k, x] of m) if (x.conversa === conversa) m.delete(k);
    },
    async editar(conversa, id, autor, t) {
      for (const x of m.values()) if (x.conversa === conversa && x.id === id && x.autor === autor) Object.assign(x, { texto: t, editada: true });
    },
    da: (conversa) => [...m.values()].filter((x) => x.conversa === conversa),
  };
}
async function aparelho(usuario, codinome) {
  codinomeDe[usuario] = codinome;
  const motor = M.CoreCrypto.new(await M.Database.inMemory());
  const historico = historicoNovo();
  const deps = {
    motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async () => undefined,
    sigo: async () => false, conferirRegistro: async () => "confere", agora: () => relogio.agora,
  };
  const chat = await ChatDoAparelho.nascer(deps, usuario, codinome);
  return { chat, historico, usuario };
}
const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
const BIA = "bbbbbbbb-0000-4000-8000-000000000002";
const A = await aparelho(ANA, "ana");
const B = await aparelho(BIA, "bia");
for (const x of [A, B]) await x.chat.rotinaAnonima();
for (const x of [A, B]) await x.chat.rotinaComSessao();
const conv = await A.chat.pedirConversa("bia", "oi");
await B.chat.receberPedidos();
await B.chat.aceitar(conv);
await A.chat.receber();
await B.chat.receber();
const ola = await A.chat.mandarTexto(conv, "oi");
await B.chat.receber();
confere("chat: a conversa abriu e o texto chegou", B.historico.da(conv).some((x) => x.id === ola.id));

// O tamanho do envelope do texto curto, para comparar.
servidor.depositos.length = 0;
await A.chat.mandarTexto(conv, "ok");
const tamanhoDoTexto = servidor.depositos.map((d) => d.tamanho);
servidor.depositos.length = 0;
// O anexo de verdade, com o contexto desta conversa, e um vídeo grande: o envelope não muda.
const ctx = contextoDaConversa("r2", conv);
const pa = await prepararAnexo(audioDeTeste(900_000), "audio/ogg", 30_000, ctx, { dias: 7 });
const corpoA = montarCorpoDeAnexo({ ...pa.corpo, endereco: "00112233445566778899aabbccddeeff" });
const ma = await A.chat.mandarAnexo(conv, corpoA);
const tamanhoDoAnexo = servidor.depositos.map((d) => d.tamanho);
confere("ritmo: o envelope do anexo tem o MESMO tamanho do de um texto curto (o tamanho do arquivo não aparece)", tamanhoDoAnexo.length > 0 && tamanhoDoAnexo.join() === tamanhoDoTexto.join(), `${tamanhoDoAnexo} / ${tamanhoDoTexto}`);
confere("privacidade: nenhum envelope leva a chave, o endereço ou o arquivo às claras", servidor.depositos.every((d) => !contem(d.envelope, Buffer.from(pa.corpo.chave, "base64url")) && !contem(d.envelope, Buffer.from("00112233445566778899aabbccddeeff", "hex")) && !contem(d.envelope, pa.cifrado.subarray(0, 64))));
confere("chat: quem mandou guarda a própria cópia com o corpo", A.historico.da(conv).some((x) => x.id === ma.id && x.anexo === paraB64Url(corpoA) && x.texto === ""));
confere("chat: chegou a um aparelho da outra pessoa", ma.entregues === 1);
await B.chat.receber();
const naBia = B.historico.da(conv).find((x) => x.id === ma.id);
confere("chat: a Bia recebe o anexo, com o autor certo", naBia && naBia.autor === ANA && naBia.anexo === paraB64Url(corpoA));
confere("chat: a cópia da Bia abre o corpo e vence no prazo do anexo", naBia && corpoGuardado(naBia.anexo)?.endereco === "00112233445566778899aabbccddeeff" && naBia.expira - naBia.quando === 7 * 86_400_000);
confere("franquia: o anexo não vira prova (a denúncia com prova é de texto) e o texto segue com a dele", naBia && naBia.prova === null);
const vv = await prepararAnexo(videoDeTeste(4_000_000), "video/webm", 59_000, ctx, { dias: 1, umaVez: true });
servidor.depositos.length = 0;
const mv = await A.chat.mandarAnexo(conv, montarCorpoDeAnexo({ ...vv.corpo, endereco: "ffeeddccbbaa99887766554433221100" }));
confere("138: o vídeo de 4 MB também sai no envelope do texto curto", servidor.depositos.map((d) => d.tamanho).join() === tamanhoDoTexto.join());
confere("138: ver uma vez não fica para quem mandou", !A.historico.da(conv).some((x) => x.id === mv.id));
await B.chat.receber();
const vBia = B.historico.da(conv).find((x) => x.id === mv.id);
confere("138: a Bia recebe o vídeo marcado como ver uma vez, vencendo em 1 dia", vBia && vBia.umaVez === true && vBia.expira - vBia.quando === 86_400_000);
await recusa("chat: corpo fora do formato nem sai", () => A.chat.mandarAnexo(conv, new Uint8Array(150)), "anexo_invalido");
const depois = await A.chat.mandarTexto(conv, "e o texto depois do anexo?");
await B.chat.receber();
confere("chat: o texto depois do anexo chega normal (a ordem não quebra)", B.historico.da(conv).some((x) => x.id === depois.id && x.texto === "e o texto depois do anexo?" && !x.avisos.length));
{
  // Ataque: um bloco "anexo" com corpo inventado, cifrado por um aparelho de verdade, cai no aparelho de quem recebe.
  const antes = B.historico.da(conv).length;
  // (o enviarBloco é privado no TypeScript; aqui o teste faz o papel de um aparelho alterado, que manda o bloco sem conferir)
  const r = await A.chat.enviarBloco(conv, "anexo", new Uint8Array(150), await A.chat.destinosDaConversa(conv), false);
  confere("ataque: o bloco inventado saiu do aparelho alterado", r.entregues === 1);
  await B.chat.receber();
  confere("chat: bloco anexo fora do formato não entra no histórico", B.historico.da(conv).length === antes);
}
confere("bloco: o tipo anexo (3) é o reservado no bloco r2", (() => {
  const b = montar(novoBloco({ tipo: "anexo", conversa: new Uint8Array(16), contador: 1, anterior: new Uint8Array(32), prazo: 1, corpo: corpoA }));
  return b[1] === 3;
})());

// ═══════════════════ 5. O grupo (MLS) ═══════════════════
{
  const { ed25519 } = await import("@noble/curves/ed25519.js");
  const { SUITE_MLS } = await import("../lib/rede/cifra/motor.ts");
  const { Grupo, TransporteDoMotor } = await import("../lib/rede/membros/grupo.ts");
  const { ENVELOPES_DE_GRUPO } = await import("../lib/rede/membros/embrulho.ts");
  const { ENVELOPE_DO_PEDIDO, selarPedido } = await import("../lib/rede/membros/entrada.ts");
  const hx = (b) => Buffer.from(b).toString("hex");
  const Hg = (rotulo, b) => hx(sha256(juntar(texto(rotulo), b)));
  const ACEITOS = new Set([...ENVELOPES_DE_GRUPO, ENVELOPE_DO_PEDIDO]);
  const sg = { caixas: new Map(), guardado: [] };
  const transporte = {
    async criar(c) {
      const k = Hg("alumia/r2/caixa", c.id);
      if (sg.caixas.has(k)) return;
      sg.caixas.set(k, { pd: Hg("alumia/r2/passe-deposito", c.pd), pl: Hg("alumia/r2/passe-leitura", c.pl), unicoFeito: false, proxima: 1, pacotes: [] });
    },
    async depositar(c, envelope, _f, unico) {
      const cx = sg.caixas.get(Hg("alumia/r2/caixa", c.id));
      if (!ACEITOS.has(envelope.length)) return { ok: false, erro: "tamanho" };
      if (!cx || cx.pd !== Hg("alumia/r2/passe-deposito", c.pd)) return { ok: true };
      if (unico) {
        if (cx.unicoFeito) return { ok: false, erro: "ocupada" };
        cx.unicoFeito = true;
      }
      cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: null, marca: null, dia: "2026-11-27" });
      sg.guardado.push(Buffer.from(envelope));
      return { ok: true };
    },
    async buscar(c, cursor) {
      const cx = sg.caixas.get(Hg("alumia/r2/caixa", c.id));
      if (!cx || cx.pl !== Hg("alumia/r2/passe-leitura", c.pl)) return [];
      return cx.pacotes.filter((p) => p.ordem > cursor).slice(0, 50);
    },
  };
  async function ap(nome) {
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
  const [apAna, apBia] = [await ap("ana"), await ap("bia")];
  const ana = await Grupo.criar(apAna, "grupo", true);
  const pub = ana.publicacaoDaEntrada("0b7c1e52-5d0c-4a63-9a43-5f2a6c1d9e10");
  const { pedido, resposta } = await Grupo.montarPedido(apBia, "");
  await transporte.depositar({ id: Buffer.from(pub.caixa, "base64url"), pd: Buffer.from(pub.pd, "base64url") }, await selarPedido(Buffer.from(pub.xwing, "base64url"), pedido));
  const [pBia] = await ana.pedidosDeEntrada();
  await ana.aceitar(pBia);
  const bia = await Grupo.entrarPelaResposta(apBia, resposta, pedido.kr, "grupo");
  confere("grupo: a Bia entrou", bia !== null);
  const ctxG = contextoDaConversa("grupo", hx(ana.id));
  const pg = await prepararAnexo(audioDeTeste(300_000), "audio/ogg", 20_000, ctxG, { dias: 30 });
  const corpoG = montarCorpoDeAnexo({ ...pg.corpo, endereco: "aaaabbbbccccddddeeeeffff00001111" });
  const antes = sg.guardado.length;
  await ana.mandarAnexo(corpoG);
  await bia.receber();
  const mG = bia.mensagens.find((m) => m.tipo === "anexo");
  confere("grupo: o anexo chega como tipo novo de conteúdo, com o autor certo", mG && Buffer.from(mG.corpo).equals(Buffer.from(corpoG)) && mG.autor === b64(apAna.identidade.publica));
  const novos = Buffer.concat(sg.guardado.slice(antes));
  confere("grupo: o servidor não vê a chave nem o endereço", !contem(novos, Buffer.from(pg.corpo.chave, "base64url")) && !contem(novos, Buffer.from("aaaabbbbccccddddeeeeffff00001111", "hex")));
  confere("grupo: o envelope do anexo tem um dos tamanhos fixos de sempre", sg.guardado.slice(antes).every((e) => ENVELOPES_DE_GRUPO.includes(e.length)));
  await recusa("grupo: corpo fora do formato nem sai", () => ana.mandarAnexo(new Uint8Array(150)), "anexo_invalido");
  confere("grupo: abre o arquivo com o contexto do grupo", (await abrirAnexo(pg.cifrado, lerCorpoDeAnexo(mG.corpo), ctxG)) !== null);
}

// ═══════════════════ 6. No código ═══════════════════
{
  const recursos = ler("lib/recursos.ts");
  confere("flag: alumia-p4-anexo-cifrado existe e é só pelo nome", /"alumia-p4-anexo-cifrado":/.test(recursos) && /SO_PELO_NOME[^;]*"alumia-p4-anexo-cifrado"/.test(recursos));
  confere("flag: no catálogo do banco, protegida por to_regclass", /to_regclass\('interno\.recursos_catalogo'\)[\s\S]*'alumia-p4-anexo-cifrado', true/.test(SQL));
  const arquivos = ["lib/rede/chat/anexo-cifrado.ts", "lib/rede/chat/anexo-servidor.ts", "lib/rede/chat/anexo-deposito.ts", "app/api/alumia/anexo/route.ts"];
  for (const a of arquivos) confere(`sorteio: ${a} sem Math.random`, !/Math\.random/.test(ler(a).replace(/\/\/.*$/gm, "")));
  // A tela (components/rede/chat/AnexoCifrado.tsx e Conversa.tsx).
  const tela = ler("components/rede/chat/AnexoCifrado.tsx");
  const conversa = ler("components/rede/chat/Conversa.tsx");
  confere("tela: os botões só com a flag ligada", /const comAnexo = ligado\("alumia-p4-anexo-cifrado"\)/.test(conversa) && /\{comAnexo && ta && !editando && \(/.test(conversa));
  // Da terceira junção: a posição do perto (itens 2 e 7) também fica fora, na mesma linha.
  confere("tela: o anexo fica fora da denúncia com prova", /m\.anexo === undefined && m\.posicao === undefined\);/.test(conversa));
  confere("tela: nada de reconhecimento de fala nem serviço de fora (regra 6)", !/SpeechRecognition|webkitSpeech|https?:\/\//.test(tela.replace(/^\s*\/\/.*$/gm, "")));
  confere("tela: o vídeo passa pela limpeza de metadado NO APARELHO antes de cifrar", /limparVideo\(/.test(tela) && tela.indexOf("limparVideo(") < tela.indexOf("await mandar(new Uint8Array(limpo.bytes)"));
  confere("tela: nada baixa sozinho (só ao tocar)", /onClick=\{\(\) => void abrir\(\)\}/.test(tela) && !/useEffect\([^)]*abrir\(/.test(tela));
  const chaveiro = ler("lib/rede/chat-chaveiro.ts");
  const envio = chaveiro.slice(chaveiro.indexOf("export async function enviarAnexo"), chaveiro.indexOf("export async function abrirAnexoDaMensagem"));
  confere("chaveiro: cifra antes de depositar, e o que sobe é o cifrado", envio.indexOf("prepararAnexo(") > 0 && envio.indexOf("prepararAnexo(") < envio.indexOf("depositarAnexo(cifrado"));
  // As traduções: as mesmas chaves nos seis idiomas, e as cinco novas com a marca de rascunho.
  const pacote = (l) => JSON.parse(ler(`i18n/rede/chat-anexo/${l}.json`));
  const chavesPt = Object.keys(pacote("pt")).sort().join();
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const p = pacote(l);
    confere(`textos: ${l} com as mesmas chaves e a marca _rascunho`, p._rascunho === true && Object.keys(p).filter((k) => k !== "_rascunho").sort().join() === chavesPt);
  }
  confere("textos: o português é o final (sem marca)", pacote("pt")._rascunho === undefined);
  const rota = ler("lib/rede/chat/anexo-servidor.ts").replace(/\/\/.*$/gm, "");
  confere("rota: não lê endereço de rede nem escreve log", !/x-forwarded|cf-connecting|x-real-ip|console\./i.test(rota));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA: " + f);
process.exit(falhas.length ? 1 : 0);
