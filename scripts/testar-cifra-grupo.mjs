// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os grupos cifrados em MLS (supabase/migracoes/20261113-rede-grupos-mls.sql, lib/rede/grupo-mls.ts) num Postgres de
// verdade dentro do Node, com a biblioteca de verdade (ts-mls, suíte X-Wing): quem lê, quem NÃO lê (quem é de fora, quem saiu,
// quem entrou depois), a ordem dos commits no banco, o servidor tentando pôr uma chave falsa, e o formato do post.
// Uso: npm run testar:cifra-grupo
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { criarChaveiroDeGrupo, epocaDoPost, SUITE } from "../lib/rede/grupo-mls.ts";

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

const migracao = ler("supabase/migracoes/20261113-rede-grupos-mls.sql");
const install = ler("supabase/install.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await dono(t, v)).rows[0];
await espera("o install.sql traz a migração idêntica ao arquivo, e ela roda de novo sem erro", async () => {
  await banco.exclusivo(() => banco.pg.exec(migracao));
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return install.includes(migracao.trim());
}, (v) => v === true);
await espera("a cifra de grupo feita à mão saiu (arquivo, migração e install.sql)", async () => [
  fs.existsSync(new URL("../lib/rede/cifra-grupo.ts", import.meta.url)),
  fs.existsSync(new URL("../supabase/migracoes/20261112-rede-grupos-cifrados.sql", import.meta.url)),
  install.includes("rede_grupo_versao_nova"),
], (r) => r.every((x) => x === false));
await espera("a suíte é a híbrida contra computador quântico (X-Wing: X25519 + ML-KEM-768)", async () => SUITE, (s) => s === "MLS_256_XWING_AES256GCM_SHA512_Ed25519");

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const P = {};
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
const nomes = ["ana", "bia", "caio", "duda", "fora"];
for (const nome of nomes) {
  P[nome] = await criarUsuario(`${nome}@grupo.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1, rede_handle = $2 where id = $1", [P[nome], `${nome}_g`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
const nucleo = (await um("insert into interno.rede_nucleos (nome) values ('Núcleo do teste') returning id")).id;
for (const nome of ["ana", "bia", "caio"]) await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [nucleo, P[nome]]);
const GRUPO = `nucleo:${nucleo}`;

const guardaEmMemoria = () => {
  const m = new Map();
  return { ler: async (k) => m.get(k) ?? null, guardar: async (k, v) => void m.set(k, v), apagar: async (k) => void m.delete(k), _m: m };
};
const guardas = {};
const chaveiros = {};
for (const nome of nomes) {
  guardas[nome] = guardaEmMemoria();
  chaveiros[nome] = criarChaveiroDeGrupo({ chamar: (f, a) => rpc(como(P[nome]), f, a), guarda: guardas[nome] });
}

// ── Banco: só membro, ordem dos commits ──
await recusa("quem não é do núcleo não pega o estado do grupo", () => rpc(como(P.fora), "rede_mls_estado", { p_grupo: GRUPO }), "nao_encontrado");
await recusa("quem não é do núcleo não grava commit", () => rpc(como(P.fora), "rede_mls_commit", { p_grupo: GRUPO, p_epoca: 1, p_commit: "AAAA", p_info: "AAAA" }), "nao_encontrado");
await espera("as tabelas do MLS não são lidas por ninguém (RLS ligada, sem permissão)", async () => um("select bool_or(has_table_privilege(r, t, 'select') or has_table_privilege(r, t, 'insert')) as algum from unnest(array['anon','authenticated']) r, unnest(array['interno.rede_mls_pacotes','interno.rede_mls_commits','interno.rede_mls_info','interno.rede_mls_boasvindas']) t"), (r) => r.algum === false);

// Bia e Caio publicam pacotes antes; Ana cria o grupo ao escrever.
await chaveiros.bia.preparar(P.bia);
await chaveiros.caio.preparar(P.caio);
await espera("cada pessoa deixa pacotes de chave no banco", async () => um("select count(*)::int as n from interno.rede_mls_pacotes where usuario = $1", [P.bia]), (r) => r.n === 10);

const post1 = await chaveiros.ana.cifrar(GRUPO, P.ana, "Reunião do núcleo sábado, 15h.");
await espera("o post sai no formato p2, época 1", async () => post1, (c) => /^p2\.1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/.test(c) && epocaDoPost(c) === 1);
await espera("no banco, nenhum texto: só commits e boas-vindas", async () => (await dono("select commit from interno.rede_mls_commits where grupo = $1", [GRUPO])).rows.map((r) => r.commit).join(""), (t) => t.length > 0 && !t.includes("Reuni"));
await espera("Bia lê (entrou pelas boas-vindas)", () => chaveiros.bia.abrir(GRUPO, P.bia, P.ana, post1), (t) => t === "Reunião do núcleo sábado, 15h.");
await espera("Caio lê", () => chaveiros.caio.abrir(GRUPO, P.caio, P.ana, post1), (t) => t === "Reunião do núcleo sábado, 15h.");
await espera("Ana relê o próprio post", () => chaveiros.ana.abrir(GRUPO, P.ana, P.ana, post1), (t) => t === "Reunião do núcleo sábado, 15h.");
await espera("com o autor trocado, não abre", () => chaveiros.bia.abrir(GRUPO, P.bia, P.bia, post1), (t) => t === null);
await espera("quem é de fora não abre (nem consegue o estado)", () => chaveiros.fora.abrir(GRUPO, P.fora, P.ana, post1), (t) => t === null);
await espera("post mexido não abre", () => chaveiros.bia.abrir(GRUPO, P.bia, P.ana, post1.slice(0, -3) + (post1.endsWith("A") ? "BBB" : "AAA")), (t) => t === null);
const post2 = await chaveiros.bia.cifrar(GRUPO, P.bia, "Levo o som.");
await espera("Bia escreve na mesma época (ninguém entrou nem saiu)", async () => epocaDoPost(post2), (e) => e === 1);
await espera("Ana lê o de Bia", () => chaveiros.ana.abrir(GRUPO, P.ana, P.bia, post2), (t) => t === "Levo o som.");
await recusa("commit que pula época é recusado (duas pessoas ao mesmo tempo: uma ganha)", () => rpc(como(P.ana), "rede_mls_commit", { p_grupo: GRUPO, p_epoca: 9, p_commit: "AAAA", p_info: "AAAA" }), "versao_ocupada");

// ── Caio sai do núcleo: a próxima época o deixa de fora ──
await dono("delete from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, P.caio]);
const post3 = await chaveiros.ana.cifrar(GRUPO, P.ana, "Mudou o lugar da reunião.");
await espera("depois que Caio saiu, o post vai numa época nova", async () => epocaDoPost(post3), (e) => e === 2);
await espera("Bia lê o post novo", () => chaveiros.bia.abrir(GRUPO, P.bia, P.ana, post3), (t) => t === "Mudou o lugar da reunião.");
await espera("Caio (que saiu) não lê o post novo", () => chaveiros.caio.abrir(GRUPO, P.caio, P.ana, post3), (t) => t === null);
await espera("o que Caio já tinha recebido, ele relê (isso não tem volta em nenhum sistema)", () => chaveiros.caio.abrir(GRUPO, P.caio, P.ana, post1), (t) => t === "Reunião do núcleo sábado, 15h.");

// ── Duda entra depois: lê o que vem, não o que veio antes ──
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [nucleo, P.duda]);
const post4 = await chaveiros.duda.cifrar(GRUPO, P.duda, "Oi, cheguei agora.");
await espera("Duda entra sozinha (commit externo, sem pacote publicado) e escreve numa época nova", async () => epocaDoPost(post4), (e) => e === 3);
await espera("Ana lê o post de Duda", () => chaveiros.ana.abrir(GRUPO, P.ana, P.duda, post4), (t) => t === "Oi, cheguei agora.");
await espera("Duda não lê o que veio antes de entrar", () => chaveiros.duda.abrir(GRUPO, P.duda, P.ana, post3), (t) => t === null);

// ── O servidor tenta pôr uma chave falsa no lugar de Bia ──
// Um aparelho novo "da Bia" (outra chave de assinatura) entra pela GroupInfo e grava o commit: os aparelhos que já conheciam a
// Bia recusam o grupo ("grupo_suspeito") e não escrevem mais nele.
await espera("o aparelho honesto não aceita a mesma pessoa duas vezes no grupo (não entra como a Bia de novo)", () => criarChaveiroDeGrupo({ chamar: (f, a) => rpc(como(P.bia), f, a), guarda: guardaEmMemoria() }).cifrar(GRUPO, P.bia, "sou eu").then(() => "passou", (e) => e.message), (m) => m === "grupo_suspeito");
{
  // O servidor (ou quem o domina) monta à mão um commit externo com outra chave "da Bia" e grava.
  const M = await import("ts-mls");
  const impl = await M.getCiphersuiteImpl(M.getCiphersuiteFromName(SUITE));
  const b64 = (u) => Buffer.from(u).toString("base64");
  const estado = await rpc(como(P.bia), "rede_mls_estado", { p_grupo: GRUPO, p_desde: 999 });
  const info = M.decodeMlsMessage(Buffer.from(estado.info.info, "base64"), 0)[0].groupInfo;
  const kp = await M.generateKeyPackage({ credentialType: "basic", identity: new TextEncoder().encode(P.bia) }, M.defaultCapabilities(), M.defaultLifetime, [], impl);
  const r = await M.joinGroupExternal(info, kp.publicPackage, kp.privatePackage, false, impl);
  const novaInfo = await M.createGroupInfoWithExternalPubAndRatchetTree(r.newState, [], impl);
  await rpc(como(P.bia), "rede_mls_commit", { p_grupo: GRUPO, p_epoca: Number(r.newState.groupContext.epoch), p_commit: b64(M.encodeMlsMessage({ publicMessage: r.publicMessage, wireformat: "mls_public_message", version: "mls10" })), p_info: b64(M.encodeMlsMessage({ groupInfo: novaInfo, wireformat: "mls_group_info", version: "mls10" })) });
}
await recusa("com a Bia aparecendo com outra chave, Ana recusa escrever no grupo", () => chaveiros.ana.cifrar(GRUPO, P.ana, "segredo"), "grupo_suspeito");

// ── Pequenas regras ──
await recusa("pacote fora do formato é recusado", () => rpc(como(P.ana), "rede_mls_pacotes_publicar", { p_pacotes: ["não é base64!"] }), "invalido:pacote");
await espera("ninguém guarda mais de 20 pacotes", async () => {
  await chaveiros.ana.preparar(P.ana);
  for (let i = 0; i < 3; i++) await rpc(como(P.ana), "rede_mls_pacotes_publicar", { p_pacotes: Array(10).fill("QUFBQQ==") });
  return (await um("select count(*)::int as n from interno.rede_mls_pacotes where usuario = $1", [P.ana])).n;
}, (n) => n === 20);
await espera("nada do Fediverso toca nas tabelas do MLS", async () => {
  const achados = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const caminho = `${dir}/${e.name}`;
      if (e.isDirectory()) andar(caminho);
      else if (/rede_mls_/.test(ler(caminho))) achados.push(caminho);
    }
  };
  for (const p of ["lib/rede/fediverso", "app/api/fediverso"]) andar(p);
  return achados;
}, (a) => a.length === 0);

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
