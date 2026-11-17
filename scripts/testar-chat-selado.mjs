// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o remetente selado do chat privado (supabase/migracoes/20261113-chat-selado.sql, lib/rede/chat/selado.ts e a cifra de
// aparelho para aparelho de lib/rede/chat/olm.ts) num Postgres de verdade dentro do Node, com as bibliotecas de verdade: o banco
// não guarda quem mandou nem a hora, a mensagem sai do banco quando é entregue, só quem tem a senha de entrega deposita, só quem
// recebe abre, e ninguém se passa por outra pessoa.
// Uso: npm run testar:chat-selado
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { lerBloco, montarBloco } from "../lib/rede/chat/c3.ts";
import { abrirAparelho, cifrarParaAparelho, entregarABiblioteca, fecharAparelho, idMatrix, sincronizar } from "../lib/rede/chat/olm.ts";
import { abrirEnvelope, CARACTERES_DO_ENVELOPE, novaSenhaDeEntrega, novoParDoEnvelope, selar } from "../lib/rede/chat/selado.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (conferir(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 200)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const migracao = ler("supabase/migracoes/20261113-chat-selado.sql");
const install = ler("supabase/install.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

await espera("a migração está no install.sql, depois da do Olm, e roda de novo", async () => {
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return install.includes(migracao.trim()) && install.indexOf(migracao.trim()) > install.indexOf(ler("supabase/migracoes/20261113-chat-olm.sql").trim());
}, (v) => v === true);
await espera("os tamanhos do envelope são os mesmos no aparelho e no banco", async () => CARACTERES_DO_ENVELOPE.map((n) => n - 1498).join(", "), (l) => migracao.split(`(${l})`).length - 1 === 2);
await espera("a caixa não tem coluna de quem mandou, de conversa nem de hora", async () => (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_sel_caixa' order by ordinal_position")).rows.map((r) => r.column_name).join(","), (c) => c === "id,para,envelope,dia");

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

const P = {};
const nomes = ["ana", "bia", "intrusa"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@selado.local`, `Nome do painel ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${i + 1}`, `${nome}_sel`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($2, $1), ($3, $1), ($1, $3)", [P.ana, P.bia, P.intrusa]);

const transporte = (nome) => ({
  publicar: (p) => rpc(como(P[nome]), "rede_olm_publicar", { p }),
  consultar: (usuarios) => rpc(como(P[nome]), "rede_olm_consultar", { p_usuarios: usuarios }),
  reivindicar: (p) => rpc(como(P[nome]), "rede_olm_reivindicar", { p }),
  enviar: (tipo, mensagens) => rpc(como(P[nome]), "rede_olm_enviar", { p_tipo: tipo, p_mensagens: mensagens }),
  receber: () => rpc(como(P[nome]), "rede_olm_receber"),
  confirmar: (ate) => rpc(como(P[nome]), "rede_olm_confirmar", { p_ate: ate }),
});
const confia = { ana: {}, bia: {}, intrusa: {} };
const A = {};
const letras = { ana: "AAAAAAAAAA", bia: "BBBBBBBBBB", intrusa: "IIIIIIIIII" };
for (const nome of nomes) A[nome] = await abrirAparelho({ usuario: P[nome], dispositivo: letras[nome], transporte: transporte(nome), confiavel: async (u) => confia[nome][u]?.ed25519 ?? null });
// Ana conversa com Bia e com a intrusa (que tenta se passar por Bia).
for (const outra of ["bia_sel", "intrusa_sel"]) await rpc(como(P.ana), "rede_dm_abrir", { p_handle: outra });
for (const [a, b] of [["ana", "bia"], ["bia", "ana"], ["ana", "intrusa"], ["intrusa", "ana"]]) confia[a][P[b]] = { ed25519: A[b].identidade.ed25519, curve25519: A[b].identidade.curve25519 };

// ── O aperto de mão: cada uma manda à outra, por Olm, a senha de entrega e a chave do envelope ──
const minhas = {};
for (const nome of nomes) {
  minhas[nome] = { ...(await novaSenhaDeEntrega()), par: await novoParDoEnvelope() };
  await rpc(como(P[nome]), "rede_sel_entrega_publicar", { p_resumos: [minhas[nome].resumo] });
}
const conhecidas = { ana: {}, bia: {}, intrusa: {} };
async function apertoDeMao(de, para) {
  const { dispositivo, cifrado } = await cifrarParaAparelho(A[de], P[para], "alumia.entrega", { senha: minhas[de].senha, envelope: minhas[de].par.publica });
  await rpc(como(P[de]), "rede_olm_enviar", { p_tipo: "m.room.encrypted", p_mensagens: { [idMatrix(P[para])]: { [dispositivo]: cifrado } } });
}
async function receberApertos(nome) {
  for (const r of await sincronizar(A[nome])) {
    if (r.tipo !== "alumia.entrega" || confia[nome][r.de]?.curve25519 !== r.curve25519) continue;
    conhecidas[nome][r.de] = { senha: r.conteudo.senha, envelope: r.conteudo.envelope };
  }
}
await apertoDeMao("ana", "bia");
await apertoDeMao("bia", "ana");
await apertoDeMao("intrusa", "ana");
await receberApertos("bia");
await receberApertos("ana");
await espera("Bia recebeu de Ana, por Olm, a senha de entrega e a chave do envelope", async () => conhecidas.bia[P.ana], (c) => typeof c?.senha === "string" && c.envelope === minhas.ana.par.publica);
await espera("o banco guarda só o resumo da senha, nunca a senha", async () => (await um("select resumos from interno.rede_sel_entrega where usuario = $1", [P.ana])).resumos, (r) => r.length === 1 && r[0] === minhas.ana.resumo && r[0] !== minhas.ana.senha);

// ── Bia manda uma mensagem selada para Ana ──
async function mandar(de, para, texto, contador, comoQuem = de) {
  const bloco = montarBloco(texto, contador);
  const { cifrado } = await cifrarParaAparelho(A[de], P[para], "alumia.dm", { b: Buffer.from(bloco).toString("base64") });
  const envelope = await selar(conhecidas[de][P[para]]?.envelope ?? minhas[para].par.publica, { de: P[comoQuem], cifrado });
  await rpc(visitante(), "rede_sel_depositar", { p_para: P[para], p_senha: conhecidas[de][P[para]]?.senha ?? "x".repeat(43), p_envelope: envelope });
  return envelope;
}
async function abrirCaixa(nome) {
  const caixa = await rpc(como(P[nome]), "rede_sel_receber");
  const abertas = [];
  for (const item of caixa) {
    const dentro = await abrirEnvelope(minhas[nome].par.privada, item.envelope);
    if (!dentro) continue;
    const [recado] = await entregarABiblioteca(A[nome], [{ sender: idMatrix(dentro.de), type: "m.room.encrypted", content: dentro.cifrado }]);
    // Só vale se o aparelho que cifrou é o aparelho confiável de quem o envelope diz ter mandado.
    if (!recado || recado.de !== dentro.de || recado.curve25519 !== confia[nome][dentro.de]?.curve25519 || recado.tipo !== "alumia.dm") continue;
    abertas.push({ de: dentro.de, ...lerBloco(Buffer.from(recado.conteudo.b, "base64")) });
  }
  if (caixa.length) await rpc(como(P[nome]), "rede_sel_confirmar", { p_ate: caixa[caixa.length - 1].id });
  return abertas;
}
const env1 = await mandar("bia", "ana", "Oi, Ana! Chegou bem?", 1);
await espera("no banco: para quem, o envelope e o dia. Nada de quem mandou nem de hora", async () => um("select * from interno.rede_sel_caixa where para = $1", [P.ana]),
  (r) => r.envelope === env1 && Object.keys(r).sort().join(",") === "dia,envelope,id,para" && !r.envelope.includes(P.bia) && !r.envelope.includes("Chegou"));
await espera("Ana abre e sabe que foi Bia (pelo aparelho dela, que o Olm confere)", () => abrirCaixa("ana"), (m) => m.length === 1 && m[0].de === P.bia && m[0].texto === "Oi, Ana! Chegou bem?");
await espera("depois de entregue, a mensagem SAIU do banco", async () => (await um("select count(*)::int as n from interno.rede_sel_caixa where para = $1", [P.ana])).n, (n) => n === 0);
await mandar("ana", "bia", "Cheguei! Obrigada.", 1);
await espera("Bia abre a resposta de Ana", () => abrirCaixa("bia"), (m) => m.length === 1 && m[0].de === P.ana && m[0].texto === "Cheguei! Obrigada.");
await mandar("ana", "bia", "Segunda mensagem.", 2);
await mandar("bia", "ana", "Recebi as duas.", 2);
await espera("o Double Ratchet segue nas duas direções", async () => [(await abrirCaixa("bia"))[0]?.texto, (await abrirCaixa("ana"))[0]?.texto], (r) => r[0] === "Segunda mensagem." && r[1] === "Recebi as duas.");

// ── Quem não pode ──
await recusa("sem a senha de entrega, ninguém deposita na caixa", async () => rpc(visitante(), "rede_sel_depositar", { p_para: P.ana, p_senha: "y".repeat(43), p_envelope: env1 }), "dm_fechada");
await recusa("envelope fora dos tamanhos é recusado", async () => rpc(visitante(), "rede_sel_depositar", { p_para: P.ana, p_senha: conhecidas.bia[P.ana].senha, p_envelope: env1 + "AAAA" }), "invalido:envelope");
await espera("a intrusa não abre o envelope feito para Ana", async () => abrirEnvelope(minhas.intrusa.par.privada, env1), (r) => r === null);
await espera("a intrusa se passando por Bia (diz 'de: Bia' por dentro): Ana descarta", async () => {
  conhecidas.intrusa[P.ana] = { senha: conhecidas.intrusa[P.ana]?.senha ?? (await (async () => { await receberApertos("intrusa"); return conhecidas.intrusa[P.ana]?.senha; })()), envelope: minhas.ana.par.publica };
  await apertoDeMao("ana", "intrusa");
  await receberApertos("intrusa");
  await mandar("intrusa", "ana", "Sou a Bia, me passa a senha.", 1, "bia");
  return abrirCaixa("ana");
}, (m) => m.length === 0);
await recusa("quem não entrou não pega caixa", () => rpc(visitante(), "rede_sel_receber"), "permission denied");
await espera("ler a caixa de outra pessoa: cada uma só vê a própria", async () => {
  await mandar("bia", "ana", "Só para Ana.", 3);
  const daIntrusa = await rpc(como(P.intrusa), "rede_sel_receber");
  await abrirCaixa("ana");
  return daIntrusa.length;
}, (n) => n === 0);

// ── Trocar a senha de entrega (ao bloquear alguém): a antiga para de valer ──
const nova = await novaSenhaDeEntrega();
await rpc(como(P.ana), "rede_sel_entrega_publicar", { p_resumos: [nova.resumo] });
await recusa("depois da troca, a senha antiga não deposita mais", async () => mandar("bia", "ana", "ainda dá?", 4), "dm_fechada");

// ── Tamanho fixo ──
const tamanhos = new Set();
for (const n of [0, 200, 900, 1900, 4000, 7900]) {
  const bloco = montarBloco("x".repeat(n), 10 + n);
  const { cifrado } = await cifrarParaAparelho(A.bia, P.ana, "alumia.dm", { b: Buffer.from(bloco).toString("base64") });
  tamanhos.add(`${bloco.length}:${(await selar(minhas.ana.par.publica, { de: P.bia, cifrado })).length}`);
}
await espera("cada bloco cai num tamanho fixo de envelope (da lista)", async () => [...tamanhos], (l) => l.every((x) => CARACTERES_DO_ENVELOPE.includes(Number(x.split(":")[1]))));

// ── Apagar tudo do chat: a caixa e as senhas somem ──
await rpc(como(P.intrusa), "rede_dm_apagar_tudo");
await espera("apagar tudo do chat leva a caixa e as senhas", async () => um("select (select count(*)::int from interno.rede_sel_entrega where usuario = $1) + (select count(*)::int from interno.rede_sel_caixa where para = $1) as n", [P.intrusa]), (r) => r.n === 0);
await espera("nada do chat selado chama o registro de atividades nem faz raise notice", async () => migracao, (t) => !/interno\.registrar|raise notice/.test(t));

for (const nome of nomes) fecharAparelho(A[nome]);
console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
