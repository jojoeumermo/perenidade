// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a cifra dos POSTS RESTRITOS (C1; docs/rede/POSTS-RESTRITOS.md): a cifra de grupo (lib/rede/cifra-grupo.ts: X25519 +
// ML-KEM-768, AES-GCM-256 em blocos), o banco (supabase/migracoes/20261112-rede-grupos-cifrados.sql, num Postgres local) e o
// chaveiro do aparelho (lib/rede/grupo-chaveiro.ts) de ponta a ponta: quem é do núcleo lê, quem saiu não lê o que vem depois,
// quem nunca foi não lê nada, e o banco só guarda cifrado. Uso: npm run testar:cifra-grupo
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import {
  abrirPostDeGrupo, cifrarPostDeGrupo, contextoDoEmbrulhoDeGrupo, desembrulharChaveDeGrupo, embrulharChaveDeGrupo, novaChaveDeGrupo, novoParDeGrupo, publicaDeGrupo,
} from "../lib/rede/cifra-grupo.ts";
import { criarChaveiroDeGrupo } from "../lib/rede/grupo-chaveiro.ts";
import { TAMANHOS_DO_CIFRADO } from "../lib/rede/chat/padding.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = (v) => v !== false) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}"`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

// ── A cifra, sem banco ──
const ana = novoParDeGrupo();
const bia = novoParDeGrupo();
const G = "nucleo:00000000-0000-4000-8000-000000000001";
const chave = novaChaveDeGrupo();
const e1 = await embrulharChaveDeGrupo(chave, publicaDeGrupo(ana), contextoDoEmbrulhoDeGrupo(G, 1, "ana"));
await espera("o embrulho abre só com o par de quem recebe, no mesmo grupo, versão e pessoa", async () => [
  Buffer.compare(Buffer.from(await desembrulharChaveDeGrupo(e1, ana, contextoDoEmbrulhoDeGrupo(G, 1, "ana"))), Buffer.from(chave)) === 0,
  await desembrulharChaveDeGrupo(e1, bia, contextoDoEmbrulhoDeGrupo(G, 1, "ana")),
  await desembrulharChaveDeGrupo(e1, ana, contextoDoEmbrulhoDeGrupo(G, 2, "ana")),
  await desembrulharChaveDeGrupo(e1, ana, contextoDoEmbrulhoDeGrupo("nucleo:00000000-0000-4000-8000-000000000002", 1, "ana")),
  await desembrulharChaveDeGrupo(e1, ana, contextoDoEmbrulhoDeGrupo(G, 1, "bia")),
], (r) => r.join() === "true,,,,");
await espera("embrulho adulterado (qualquer parte) não abre", async () => {
  const partes = e1.split(".");
  const mexer = (t, i) => t.slice(0, i) + (t[i] === "A" ? "B" : "A") + t.slice(i + 1);
  const tentativas = [1, 2, 3, 4].map((k) => partes.map((p, i) => (i === k ? mexer(p, 5) : p)).join("."));
  return Promise.all(tentativas.map((t) => desembrulharChaveDeGrupo(t, ana, contextoDoEmbrulhoDeGrupo(G, 1, "ana"))));
}, (r) => r.every((x) => x === null));
await espera("o híbrido: com só o X25519 certo (ML-KEM de outra pessoa), o embrulho não abre", async () => {
  const misto = { x25519: ana.x25519, mlkem: bia.mlkem };
  return desembrulharChaveDeGrupo(e1, misto, contextoDoEmbrulhoDeGrupo(G, 1, "ana"));
}, (r) => r === null);
await espera("o post abre com a chave do grupo e só no mesmo grupo, versão e autor; o tamanho guardado cai nos blocos fixos", async () => {
  const curto = await cifrarPostDeGrupo(chave, 1, G, "ana", "ok");
  const medio = await cifrarPostDeGrupo(chave, 1, G, "ana", "x".repeat(200));
  return [
    await abrirPostDeGrupo(chave, curto, G, "ana"),
    await abrirPostDeGrupo(chave, curto, G, "bia"),
    await abrirPostDeGrupo(chave, curto.replace("p1.1.", "p1.2."), G, "ana"),
    await abrirPostDeGrupo(novaChaveDeGrupo(), curto, G, "ana"),
    curto.split(".")[3].length === medio.split(".")[3].length && TAMANHOS_DO_CIFRADO.includes(curto.split(".")[3].length),
  ];
}, (r) => r.join() === "ok,,,,true");

// ── O banco ──
const migracao = ler("supabase/migracoes/20261112-rede-grupos-cifrados.sql");
const install = ler("supabase/install.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await dono(t, v)).rows[0];
await espera("o install.sql traz a migração idêntica ao arquivo, e ela roda de novo sem erro", async () => {
  await banco.exclusivo(() => banco.pg.exec(migracao));
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return install.includes(migracao.trim());
});
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const P = {};
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia", "caio", "fora"]) {
  P[nome] = await criarUsuario(`${nome}@grupo.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1, rede_handle = $2 where id = $1", [P[nome], `${nome}_g`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
const nucleo = (await um("insert into interno.rede_nucleos (nome) values ('Núcleo do teste') returning id")).id;
for (const nome of ["ana", "bia", "caio"]) await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [nucleo, P[nome]]);
const GRUPO = `nucleo:${nucleo}`;

// O chaveiro de cada pessoa, falando com o banco local como ela, e guardando o par na memória.
const guardaEmMemoria = () => {
  const m = new Map();
  return { ler: async (u) => m.get(u) ?? null, guardar: async (u, par) => void m.set(u, par) };
};
const chaveiros = {};
for (const nome of ["ana", "bia", "caio", "fora"]) chaveiros[nome] = criarChaveiroDeGrupo({ chamar: (f, a) => rpc(como(P[nome]), f, a), guarda: guardaEmMemoria() });

await espera("quem é do núcleo cifra; quem é do núcleo abre; o banco só guarda a parte pública e embrulhos", async () => {
  for (const n of ["ana", "bia", "caio"]) await chaveiros[n].preparar(P[n]);
  const post = await chaveiros.ana.cifrar(GRUPO, P.ana, "Reunião quinta, 19h, na sede.");
  const bia = await chaveiros.bia.abrir(GRUPO, P.bia, P.ana, post);
  const caio = await chaveiros.caio.abrir(GRUPO, P.caio, P.ana, post);
  const textoNoBanco = (await dono("select string_agg(publica, '') as a from interno.rede_grupo_chaves")).rows[0].a + (await dono("select string_agg(embrulho, '') as a from interno.rede_grupo_embrulhos")).rows[0].a;
  return [bia, caio, (await um("select count(*)::int as n from interno.rede_grupo_embrulhos where grupo = $1 and versao = 1", [GRUPO])).n, textoNoBanco.includes("Reunião")];
}, (r) => r.join() === "Reunião quinta, 19h, na sede.,Reunião quinta, 19h, na sede.,3,false");
await recusa("quem não é do núcleo não pega o estado do grupo", () => rpc(como(P.fora), "rede_grupo_estado", { p_grupo: GRUPO }), "nao_encontrado");
await espera("quem não é do núcleo não abre o post (nem com o próprio par publicado)", async () => {
  const post = await chaveiros.ana.cifrar(GRUPO, P.ana, "segredo do núcleo");
  return chaveiros.fora.abrir(GRUPO, P.fora, P.ana, post);
}, (t) => t === null);
await recusa("versão nova que deixa alguém do núcleo de fora é recusada", async () => {
  const estado = await rpc(como(P.ana), "rede_grupo_estado", { p_grupo: GRUPO });
  const k = novaChaveDeGrupo();
  const so = estado.membros.filter((m) => m.usuario !== P.caio);
  return rpc(como(P.ana), "rede_grupo_versao_nova", { p_grupo: GRUPO, p_versao: estado.atual + 1, p_embrulhos: await Promise.all(so.map(async (m) => ({ para: m.usuario, embrulho: await embrulharChaveDeGrupo(k, m.publica, contextoDoEmbrulhoDeGrupo(GRUPO, estado.atual + 1, m.usuario)) }))) });
}, "invalido:membros");
await recusa("versão nova com embrulho para quem não é do núcleo também", async () => {
  await chaveiros.fora.preparar(P.fora);
  const estado = await rpc(como(P.ana), "rede_grupo_estado", { p_grupo: GRUPO });
  const k = novaChaveDeGrupo();
  const intruso = (await um("select publica from interno.rede_grupo_chaves where usuario = $1", [P.fora])).publica;
  const todos = [...estado.membros, { usuario: P.fora, publica: intruso }];
  return rpc(como(P.ana), "rede_grupo_versao_nova", { p_grupo: GRUPO, p_versao: estado.atual + 1, p_embrulhos: await Promise.all(todos.map(async (m) => ({ para: m.usuario, embrulho: await embrulharChaveDeGrupo(k, m.publica, contextoDoEmbrulhoDeGrupo(GRUPO, estado.atual + 1, m.usuario)) }))) });
}, "invalido:membros");
await recusa("versão que pula número é recusada (duas pessoas ao mesmo tempo: uma ganha)", () => rpc(como(P.ana), "rede_grupo_versao_nova", { p_grupo: GRUPO, p_versao: 99, p_embrulhos: [] }), "versao_ocupada");
await espera("o Caio sai do núcleo: o próximo post cria a versão seguinte, que ele não abre; o que ele já tinha continua igual", async () => {
  const antes = await chaveiros.ana.cifrar(GRUPO, P.ana, "antes de sair");
  const leuAntes = await chaveiros.caio.abrir(GRUPO, P.caio, P.ana, antes);
  const versaoAntes = (await um("select max(versao)::int as v from interno.rede_grupo_versoes where grupo = $1", [GRUPO])).v;
  await dono("delete from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, P.caio]);
  const depois = await chaveiros.bia.cifrar(GRUPO, P.bia, "depois que o Caio saiu");
  const versaoDepois = (await um("select max(versao)::int as v from interno.rede_grupo_versoes where grupo = $1", [GRUPO])).v;
  return [leuAntes, versaoDepois === versaoAntes + 1, await chaveiros.caio.abrir(GRUPO, P.caio, P.bia, depois), await chaveiros.ana.abrir(GRUPO, P.ana, P.bia, depois)];
}, (r) => r.join("|") === "antes de sair|true||depois que o Caio saiu");
await recusa("chave pública fora do formato é recusada", () => rpc(como(P.ana), "rede_grupo_chave_publicar", { p_publica: "g1.x.y" }), "invalido:publica");
await espera("visitante não chama nada dos grupos", async () => (await um("select has_function_privilege('anon', 'public.rede_grupo_estado(text)', 'execute') as e")).e, (e) => e === false);
await espera("as tabelas não abrem para ninguém de fora (só pelas funções)", async () => um(`select has_table_privilege('authenticated', 'interno.rede_grupo_embrulhos', 'select') as a, has_table_privilege('anon', 'interno.rede_grupo_chaves', 'select') as b`), (r) => r.a === false && r.b === false);

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
