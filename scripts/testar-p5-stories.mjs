// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, A16 (supabase/migracoes/20261126-p5-stories.sql e o servidor do site), num Postgres de verdade (scripts/banco-local.mjs):
//   · a mídia do story só chega a outra pessoa depois de conferida no servidor (public.rede_story_pode): antes, quem segue abria o
//     arquivo do jeito que chegou (com o GPS, se um aparelho alterado mandasse) até a faxina passar; a autora vê na hora;
//   · public.rede_story_conferir_pedir: só a autora, só enquanto não foi conferido;
//   · a conferência logo depois de publicar (lib/rede/stories/conferir-servidor.ts), com dublês do depósito: a foto com EXIF/GPS sobe
//     de novo sem ele e é marcada; o arquivo que não é imagem sai do ar; falha no depósito não marca nada;
//   · o cliente pede a conferência depois de publicar com mídia, e só com mídia;
//   · os ajustes da foto (brilho, contraste, saturação) só viram números conhecidos no filtro.
// Uso: npm run testar:p5-stories
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { conferirStory } from "../lib/rede/stories/conferir-servidor.ts";
import { criarClienteDeStories } from "../lib/rede/cliente-stories.ts";
import { ajustesValidos, filtroCompleto, SEM_AJUSTE } from "../lib/rede/stories/midia.ts";
import { limparMetadados } from "../supabase/functions/faxina-stories/faxina.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. O arquivo ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261126-p5-stories.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração está no fim do install.sql (seguida só de migrações datadas)", noFimDoInstall(SQL));
ok("não mexe na versão nem na lista de exceções", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("as funções: rede_story_pode (redefinida) e rede_story_conferir_pedir (nova)",
  [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]).join() === "public.rede_story_pode,public.rede_story_conferir_pedir");

// ═══════════════════ 1. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2" });
await espera("roda de novo por cima", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await espera("a porta continua trancada em tudo", () => um("select interno.alumia_trancar() as r"), (x) => x.r.abertas.length === 0);
const def = await um("select pg_get_functiondef('public.rede_story_pode(text)'::regprocedure) d");
ok("a definição nova é a de antes mais o conferido (a matriz de quem vê continua)", /alumia_passa\(\)/.test(def.d) && /rede5_story_ve\(s, auth\.uid\(\)\)/.test(def.d) && /rede5_story_ve_destaque/.test(def.d) && /s\.conferido or s\.autor = auth\.uid\(\)/.test(def.d));

const P = {};
for (const nome of ["autora", "segue", "estranha"]) {
  P[nome] = await criarUsuario(`${nome}@st.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P.segue, P.autora]);
const caminho = `${P.autora}/${randomUUID()}.webp`;
const story = (await um("insert into interno.rede_stories (autor, fundo, midia_caminho, publico) values ($1, 'imagem', $2, 'seguidores') returning id", [P.autora, caminho])).id;

await espera("ANTES de conferir: quem segue NÃO abre o arquivo", () => rpc(como(P.segue), "rede_story_pode", { p_caminho: caminho }), (r) => r === false);
await espera("a autora abre o próprio arquivo na hora", () => rpc(como(P.autora), "rede_story_pode", { p_caminho: caminho }), (r) => r === true);
await recusa("só a autora pede a conferência", () => rpc(como(P.segue), "rede_story_conferir_pedir", { p_id: story }), "nao_encontrado");
await recusa("visitante não pede", () => rpc({ papel: "anon" }, "rede_story_conferir_pedir", { p_id: story }), "permission denied");
await espera("a autora recebe o caminho enquanto não foi conferido", () => rpc(como(P.autora), "rede_story_conferir_pedir", { p_id: story }), (r) => r.caminho === caminho);
await espera("a marca de conferido só pela chave de serviço", () => rpc({ papel: "service_role" }, "rede_story_faxina_feito", { p_apagados: [], p_conferidos: [story], p_ruins: [] }), (r) => r.conferidos === 1);
await espera("DEPOIS de conferir: quem segue abre", () => rpc(como(P.segue), "rede_story_pode", { p_caminho: caminho }), (r) => r === true);
await espera("quem não segue continua sem abrir (a matriz de sempre)", () => rpc(como(P.estranha), "rede_story_pode", { p_caminho: caminho }), (r) => r === false);
await espera("conferido, o pedido não devolve mais caminho", () => rpc(como(P.autora), "rede_story_conferir_pedir", { p_id: story }), (r) => r.caminho === null);

// ═══════════════════ 2. A conferência logo depois de publicar (dublês) ═══════════════════
{
  // Um JPEG mínimo com um APP1 de EXIF (com "GPS") antes do começo da imagem.
  const exif = new TextEncoder().encode("Exif\0\0GPS-23.55,-46.63");
  const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
  const jpeg = new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
  const jpgCaminho = `${P.autora}/${randomUUID()}.jpg`;
  const subidos = [];
  const marcas = [];
  const formas = (o = {}) => ({
    pedir: async () => ({ ok: true, caminho: o.caminho ?? jpgCaminho }),
    baixar: async () => { if (o.falhar) throw new Error("caiu"); return o.bytes ?? jpeg; },
    subir: async (c, b, t) => { subidos.push({ c, b, t }); },
    marcar: async (id, r) => { marcas.push([id, r]); },
  });
  const r1 = await conferirStory("token", "id-1", formas());
  ok("a foto com EXIF/GPS: sobe de novo sem ele e é marcada como conferida", r1 === "conferido" && subidos.length === 1 && !new TextDecoder().decode(subidos[0].b).includes("GPS") && marcas[0][1] === "conferido");
  ok("o que subiu é o mesmo que a faxina produz", JSON.stringify([...subidos[0].b]) === JSON.stringify([...limparMetadados(jpeg).bytes]));
  const r2 = await conferirStory("token", "id-2", formas({ bytes: new TextEncoder().encode("não sou imagem") }));
  ok("arquivo que não é imagem: sai do ar (ruim)", r2 === "ruim" && marcas.at(-1)[1] === "ruim");
  const n = marcas.length;
  const r3 = await conferirStory("token", "id-3", formas({ falhar: true }));
  ok("o depósito caiu: nada é marcado (a faxina tenta de novo)", r3 === "falhou" && marcas.length === n);
  const r4 = await conferirStory("token", "id-4", { ...formas(), pedir: async () => ({ ok: false, erro: "nao_encontrado", status: 404 }) });
  ok("story de outra pessoa: o erro do banco volta, nada é baixado", typeof r4 === "object" && r4.erro === "nao_encontrado");
  const r5 = await conferirStory("token", "id-5", formas({ caminho: "../../etc/passwd" }));
  ok("caminho estranho não é baixado", r5 === "falhou");
  const rota = ler("app/api/rede/stories/conferir/route.ts");
  ok("a rota pede o token, não escreve log e não lê endereço de rede", /tokenDe\(pedido\)/.test(rota) && !/console\.|x-forwarded|cf-connecting/i.test(rota));
}

// ═══════════════════ 3. O cliente pede a conferência ═══════════════════
{
  const pedidas = [];
  const cliente = criarClienteDeStories(async () => ({ id: "s-1", expira_em: "" }), async () => "", async () => ({}), async (id) => { pedidas.push(id); });
  await cliente.publicar({ publico: "seguidores", fundo: { tipo: "imagem", cor: "azul" }, texto: "", legenda: null, imagem: "u/x.webp", figurinhas: [] });
  await cliente.publicar({ publico: "seguidores", fundo: { tipo: "listras", cor: "azul" }, texto: "só texto", legenda: null, imagem: null, figurinhas: [] });
  ok("publicar com mídia pede a conferência; só texto, não", pedidas.length === 1 && pedidas[0] === "s-1");
}

// ═══════════════════ 4. Os ajustes da foto ═══════════════════
ok("sem ajuste e sem filtro: nenhum filtro", filtroCompleto("nenhum", SEM_AJUSTE) === "none");
ok("os ajustes viram brightness, contrast e saturate", filtroCompleto("nenhum", { brilho: 20, contraste: -10, saturacao: 5 }) === "brightness(1.20) contrast(0.90) saturate(1.05)");
ok("o filtro da lista vem antes dos ajustes", filtroCompleto("pb", { brilho: 10 }).startsWith("grayscale(1) contrast(1.12) brightness(1.10)"));
ok("fora do limite vira o limite; lixo vira zero", JSON.stringify(ajustesValidos({ brilho: 400, contraste: -400, saturacao: Number.NaN })) === JSON.stringify({ brilho: 50, contraste: -50, saturacao: 0 }));
ok("nunca texto livre no filtro", filtroCompleto("url(javascript:alert(1))", { brilho: "1); background: red" }) === "none");

console.log(`\nP5 · stories (A16): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
