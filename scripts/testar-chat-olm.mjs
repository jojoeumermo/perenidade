// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o chat privado da Alumia na biblioteca do Matrix (supabase/migracoes/20261113-chat-olm.sql, lib/rede/chat/olm.ts) num
// Postgres de verdade dentro do Node, com a biblioteca de verdade (@matrix-org/matrix-sdk-crypto-wasm): quem abre, quem NÃO abre
// (a intrusa, o banco trocando a chave do aparelho), o que o banco aceita (só "m1" nos tamanhos certos, só recado Olm, só para
// contato), bloqueio, apagar tudo e o tamanho fixo das mensagens.
// Uso: npm run testar:chat-olm
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { lerBloco, montarBloco } from "../lib/rede/chat/c3.ts";
import { TAMANHOS_DO_BLOCO } from "../lib/rede/chat/padding.ts";
import { abrirAparelho, abrirBloco, cifrarBloco, eM1, fecharAparelho, salaDaVersao, sincronizar, TAMANHOS_DO_M1 } from "../lib/rede/chat/olm.ts";

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

const migracao = ler("supabase/migracoes/20261113-chat-olm.sql");
const install = ler("supabase/install.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

await espera("a migração da biblioteca está no install.sql, depois da dos blocos", async () => install.includes(migracao.trim()) && install.indexOf(migracao.trim()) > install.indexOf(ler("supabase/migracoes/20261110-chat-blocos.sql").trim()));
await espera("a migração roda de novo sem quebrar", async () => {
  await banco.exclusivo(() => banco.pg.exec(migracao));
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return true;
});
await espera("os tamanhos do m1 são os mesmos no aparelho e no banco (regra da tabela e função)", async () => migracao.split(`(${TAMANHOS_DO_M1.join(", ")})`).length - 1, (n) => n === 2);

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });

// ── As pessoas ──
const P = {};
const nomes = ["ana", "bia", "intrusa"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@olm.local`, `Nome do painel ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${i + 1}`, `${nome}_olm`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($2, $1)", [P.ana, P.bia]);

// O banco como a biblioteca o vê: as funções da migração, chamadas como a pessoa.
const transporte = (nome) => ({
  publicar: (p) => rpc(como(P[nome]), "rede_olm_publicar", { p }),
  consultar: (usuarios) => rpc(como(P[nome]), "rede_olm_consultar", { p_usuarios: usuarios }),
  reivindicar: (p) => rpc(como(P[nome]), "rede_olm_reivindicar", { p }),
  enviar: (tipo, mensagens) => rpc(como(P[nome]), "rede_olm_enviar", { p_tipo: tipo, p_mensagens: mensagens }),
  receber: () => rpc(como(P[nome]), "rede_olm_receber"),
  confirmar: (ate) => rpc(como(P[nome]), "rede_olm_confirmar", { p_ate: ate }),
});
// Em quem cada aparelho confia ("confiar na primeira vez": o que a tela guarda na gaveta).
const confia = { ana: {}, bia: {}, intrusa: {} };
const A = {};
const letras = { ana: "AAAAAAAAAA", bia: "BBBBBBBBBB", intrusa: "IIIIIIIIII" };
for (const nome of nomes) A[nome] = await abrirAparelho({ usuario: P[nome], dispositivo: letras[nome], transporte: transporte(nome), confiavel: async (u) => confia[nome][u] ?? null });

await espera("ativar publica a chave do chat na biblioteca: identidade 'o' + ed25519, certificado 'olm1', versão 1", async () => um("select identidade, publica, certificado, versao from interno.rede_dm_chaves where usuario = $1", [P.ana]),
  (k) => k.identidade === `o${A.ana.identidade.ed25519}` && k.publica === `o${A.ana.identidade.curve25519}` && k.certificado === "olm1" && k.versao === 1);
await espera("o aparelho deixa chaves de uso único e uma de reserva no banco", async () => um("select (select count(*)::int from interno.rede_olm_unicas where usuario = $1) as unicas, (select count(*)::int from interno.rede_olm_reserva where usuario = $1) as reserva", [P.ana]),
  (r) => r.unicas > 0 && r.reserva === 1);
await espera("as tabelas da biblioteca não são lidas por ninguém (RLS ligada, sem política)", async () => (await dono("select relname, relrowsecurity from pg_class where relname in ('rede_olm_aparelhos','rede_olm_unicas','rede_olm_reserva','rede_olm_caixa')")).rows,
  (r) => r.length === 4 && r.every((t) => t.relrowsecurity));
await espera("quem entrou e visitante não têm permissão nenhuma nas tabelas da biblioteca", async () => um("select bool_or(has_table_privilege(r, t, 'select') or has_table_privilege(r, t, 'insert')) as algum from unnest(array['anon','authenticated']) r, unnest(array['interno.rede_olm_aparelhos','interno.rede_olm_unicas','interno.rede_olm_reserva','interno.rede_olm_caixa']) t"), (r) => r.algum === false);
await recusa("aparelho com o id de outra pessoa é recusado", () => rpc(como(P.intrusa), "rede_olm_publicar", { p: { device_keys: { user_id: `@${P.ana}:alumia.invalid`, device_id: "XXXXXXXXXX", keys: {} } } }), "invalido:aparelho");

// ── A conversa ──
const conversa = (await rpc(como(P.ana), "rede_dm_abrir", { p_handle: "bia_olm" })).id;
const chaveVersao = async (nome) => (await um("select versao from interno.rede_dm_chaves where usuario = $1", [P[nome]])).versao;
const marcas = async () => [{ para: P.ana, chave_versao: await chaveVersao("ana"), embrulho: "olm1" }, { para: P.bia, chave_versao: await chaveVersao("bia"), embrulho: "olm1" }];
await recusa("versão da conversa com embrulho do formato antigo é recusada para contas na biblioteca", async () => rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversa, p_versao: 1, p_embrulhos: (await marcas()).map((m) => ({ ...m, embrulho: `w1.${"A".repeat(16)}.${"B".repeat(64)}` })) }), "invalido:embrulho");
await espera("versão nova só com a marca 'olm1' (a chave vai pelo Olm, nunca pelo banco)", async () => rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversa, p_versao: 1, p_embrulhos: await marcas() }), (r) => r.versao === 1);
await espera("a versão vale para a chave atual dos dois (atual_ok)", async () => rpc(como(P.bia), "rede_dm_chaves_da_conversa", { p_conversa: conversa }), (r) => r.atual_ok === true && r.participantes.length === 2);

// Primeira vez: cada uma guarda a identidade que o servidor mostra da outra.
const daConversa = await rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversa });
for (const p of daConversa.participantes) {
  if (p.usuario === P.bia) confia.ana[P.bia] = p.identidade.slice(1);
  if (p.usuario === P.ana) confia.bia[P.ana] = p.identidade.slice(1);
}

// ── Contato: só quem tem conversa aberta vê a chave do aparelho e pega chave de uso único ──
await espera("Ana vê a chave do aparelho de Bia", async () => rpc(como(P.ana), "rede_olm_consultar", { p_usuarios: [P.bia] }), (r) => Object.keys(r.device_keys[`@${P.bia}:alumia.invalid`]).join() === "BBBBBBBBBB");
await espera("a intrusa (sem conversa) não vê a chave do aparelho de Bia", async () => rpc(como(P.intrusa), "rede_olm_consultar", { p_usuarios: [P.bia] }), (r) => Object.keys(r.device_keys[`@${P.bia}:alumia.invalid`]).length === 0);
await espera("a intrusa não pega chave de uso único de Bia", async () => rpc(como(P.intrusa), "rede_olm_reivindicar", { p: { [`@${P.bia}:alumia.invalid`]: { BBBBBBBBBB: "signed_curve25519" } } }), (r) => Object.keys(r.one_time_keys[`@${P.bia}:alumia.invalid`]).length === 0);
await espera("a intrusa não deixa recado para Bia", async () => rpc(como(P.intrusa), "rede_olm_enviar", { p_tipo: "m.room.encrypted", p_mensagens: { [`@${P.bia}:alumia.invalid`]: { BBBBBBBBBB: { algorithm: "m.olm.v1.curve25519-aes-sha2", ciphertext: {} } } } }), (r) => r.enviados === 0);
await recusa("recado em texto (sem Olm) é recusado", () => rpc(como(P.ana), "rede_olm_enviar", { p_tipo: "m.room.encrypted", p_mensagens: { [`@${P.bia}:alumia.invalid`]: { BBBBBBBBBB: { algorithm: "m.megolm.v1.aes-sha2", ciphertext: "x" } } } }), "invalido:recado");
await recusa("recado de outro tipo (pedido de chave, por exemplo) é recusado", () => rpc(como(P.ana), "rede_olm_enviar", { p_tipo: "m.room_key_request", p_mensagens: {} }), "invalido:recado");

// ── Ana escreve, Bia lê ──
const enviar = async (nome, versao, texto, contador) => {
  const corpo = await cifrarBloco(A[nome], conversa, versao, nome === "ana" ? P.bia : P.ana, montarBloco(texto, contador));
  await rpc(como(P[nome]), "rede_dm_enviar", { p_conversa: conversa, p_versao: versao, p_corpo: corpo });
  return corpo;
};
const corpo1 = await enviar("ana", 1, "Oi, Bia! Tudo certo para o ato?", 1);
await espera("o corpo vai no formato m1", async () => corpo1, (c) => eM1(c) && c.startsWith("m1.1."));
await espera("no banco, nada do texto: só o m1", async () => (await um("select corpo from interno.rede_dm_mensagens where conversa = $1", [conversa])).corpo, (c) => c === corpo1 && !c.includes("ato"));
await sincronizar(A.bia);
const abrirComo = async (nome, corpo, autor) => {
  const bloco = await abrirBloco(A[nome], corpo, conversa, P[autor], nome === autor ? A[nome].identidade.ed25519 : confia[nome][P[autor]] ?? null);
  return bloco && lerBloco(bloco);
};
await espera("Bia abre a mensagem de Ana", () => abrirComo("bia", corpo1, "ana"), (m) => m?.texto === "Oi, Bia! Tudo certo para o ato?" && m.contador === 1);
await espera("Ana abre a própria mensagem", () => abrirComo("ana", corpo1, "ana"), (m) => m?.texto === "Oi, Bia! Tudo certo para o ato?");
await espera("a recusa de abrir com o autor trocado (Bia como autora)", () => abrirComo("bia", corpo1, "bia"), (m) => m === null);
await espera("a intrusa não abre (mesmo com a mensagem na mão)", async () => {
  await sincronizar(A.intrusa);
  return abrirBloco(A.intrusa, corpo1, conversa, P.ana, A.ana.identidade.ed25519);
}, (m) => m === null);
await espera("a mensagem não abre como de outra versão nem de outra conversa", async () => [
  await abrirBloco(A.bia, corpo1.replace(/^m1\.1\./, "m1.2."), conversa, P.ana, confia.bia[P.ana]),
  await abrirBloco(A.bia, corpo1, "99999999-9999-4999-8999-999999999999", P.ana, confia.bia[P.ana]),
], (r) => r.every((x) => x === null));
const corpo2 = await enviar("bia", 1, "Tudo! Te vejo lá.", 1);
await sincronizar(A.ana);
await espera("Ana abre a resposta de Bia", () => abrirComo("ana", corpo2, "bia"), (m) => m?.texto === "Tudo! Te vejo lá.");
await espera("os recados lidos somem da caixa do banco", async () => (await um("select count(*)::int as n from interno.rede_olm_caixa where para in ($1, $2)", [P.ana, P.bia])).n, (n) => n === 0);
await espera("as salas da biblioteca têm o mesmo tamanho em toda versão", async () => [salaDaVersao(conversa, 1).length, salaDaVersao(conversa, 9_999_999).length], (r) => r[0] === r[1]);

// ── O que o banco aceita como mensagem ──
await recusa("conta na biblioteca não envia mais 'c3'", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversa, p_versao: 1, p_corpo: `c3.1.${"A".repeat(16)}.${"B".repeat(363)}` }), "invalido:corpo");
await recusa("texto aberto é recusado", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversa, p_versao: 1, p_corpo: "oi" }), "invalido:corpo");
await recusa("m1 de tamanho fora da lista é recusado", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversa, p_versao: 1, p_corpo: corpo1 + "AAAA" }), "invalido:corpo");
await recusa("m1 de outra versão é recusado", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversa, p_versao: 1, p_corpo: corpo1.replace(/^m1\.1\./, "m1.2.") }), "invalido:corpo");
await recusa("a tabela recusa m1 fora da lista mesmo por fora das funções", () => dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values ($1, $2, 1, $3, now() + interval '1 day')", [conversa, P.ana, corpo1 + "AAAA"]), "rede_dm_mensagens_corpo_formato");

// ── Tamanho fixo: o cifrado só diz em qual dos sete blocos o texto coube ──
const tamanhos = new Map();
let contador = 2;
for (const n of [0, 100, 300, 700, 1500, 3000, 5000, 7900]) {
  const bloco = montarBloco("x".repeat(n), contador++);
  const corpo = await cifrarBloco(A.ana, conversa, 1, P.bia, bloco);
  tamanhos.set(bloco.length, [...new Set([...(tamanhos.get(bloco.length) ?? []), corpo.split(".")[3].length])]);
}
await espera("cada bloco dá sempre o mesmo tamanho de cifrado, e é o da lista", async () => TAMANHOS_DO_BLOCO.map((b) => tamanhos.get(b)), (l) => l.every((t, i) => t?.length === 1 && t[0] === TAMANHOS_DO_M1[i]));
await espera("o maior corpo cabe no teto do banco (15000)", async () => 3 + 7 + 1 + 43 + 1 + TAMANHOS_DO_M1[6], (n) => n <= 15000);

// ── O banco troca a chave do aparelho de Bia pela da intrusa: Ana não entrega a chave da versão nova ──
const aparelhoDaBia = await um("select * from interno.rede_olm_aparelhos where usuario = $1", [P.bia]);
const daIntrusa = await um("select * from interno.rede_olm_aparelhos where usuario = $1", [P.intrusa]);
await dono("update interno.rede_olm_aparelhos set dispositivo = $2, ed25519 = $3, curve25519 = $4, chaves = jsonb_set($5::jsonb, '{user_id}', to_jsonb($6::text)) where usuario = $1",
  [P.bia, daIntrusa.dispositivo, daIntrusa.ed25519, daIntrusa.curve25519, JSON.stringify(daIntrusa.chaves), `@${P.bia}:alumia.invalid`]);
await dono("update interno.rede_dm_conversas set versao_em = now() - interval '1 hour' where id = $1", [conversa]);
await rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversa, p_versao: 2, p_embrulhos: await marcas() });
const corpoSegredo = await cifrarBloco(A.ana, conversa, 2, P.bia, montarBloco("segredo da versão 2", 1));
await espera("nenhum recado sai para o aparelho falso", async () => (await um("select count(*)::int as n from interno.rede_olm_caixa where para = $1", [P.bia])).n, (n) => n === 0);
await espera("a intrusa não abre a versão nova", async () => {
  await sincronizar(A.intrusa);
  return abrirBloco(A.intrusa, corpoSegredo, conversa, P.ana, A.ana.identidade.ed25519);
}, (m) => m === null);
await dono("update interno.rede_olm_aparelhos set dispositivo = $2, ed25519 = $3, curve25519 = $4, chaves = $5 where usuario = $1",
  [P.bia, aparelhoDaBia.dispositivo, aparelhoDaBia.ed25519, aparelhoDaBia.curve25519, JSON.stringify(aparelhoDaBia.chaves)]);

// ── Bloqueio corta tudo ──
await rpc(como(P.bia), "rede_bloquear", { p_usuario: P.ana, p_sim: true });
await espera("com bloqueio, Ana não vê mais a chave do aparelho de Bia", async () => rpc(como(P.ana), "rede_olm_consultar", { p_usuarios: [P.bia] }), (r) => Object.keys(r.device_keys[`@${P.bia}:alumia.invalid`]).length === 0);
await espera("com bloqueio, recado de Ana não chega", async () => rpc(como(P.ana), "rede_olm_enviar", { p_tipo: "m.room.encrypted", p_mensagens: { [`@${P.bia}:alumia.invalid`]: { BBBBBBBBBB: { algorithm: "m.olm.v1.curve25519-aes-sha2", ciphertext: {} } } } }), (r) => r.enviados === 0);
await rpc(como(P.bia), "rede_bloquear", { p_usuario: P.ana, p_sim: false });

// ── Apagar tudo do chat: some tudo da biblioteca ──
await rpc(como(P.intrusa), "rede_dm_apagar_tudo");
await espera("depois de apagar tudo, nada da intrusa fica nas tabelas da biblioteca", async () => um("select (select count(*)::int from interno.rede_olm_aparelhos where usuario = $1) + (select count(*)::int from interno.rede_olm_unicas where usuario = $1) + (select count(*)::int from interno.rede_olm_reserva where usuario = $1) as n", [P.intrusa]), (r) => r.n === 0);

// ── Nada federado, nada em log ──
await espera("nenhuma função da biblioteca chama o registro de atividades nem faz raise notice", async () => migracao, (t) => !/interno\.registrar|raise notice/.test(t));
await espera("nada do Fediverso toca nas tabelas da biblioteca", async () => {
  const pastas = ["lib/rede/fediverso", "app/api/fediverso"];
  const achados = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory()) andar(caminho);
      else if (/rede_olm_/.test(ler(caminho))) achados.push(caminho);
    }
  };
  for (const p of pastas) andar(p);
  return achados;
}, (a) => a.length === 0);

for (const nome of nomes) fecharAparelho(A[nome]);
console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
