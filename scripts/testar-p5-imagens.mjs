// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, A20 (supabase/migracoes/20261126-p5-imagens.sql, lib/rede/publicar/versoes.ts), num Postgres de verdade
// (scripts/banco-local.mjs), com um depósito de mentira (storage.objects):
//   · a versão menor da imagem (".v640", ".v1080") abre para quem a principal abre, e só: quem não vê o post não abre a versão; uma
//     versão "solta" (de principal que não é de post) não abre para ninguém além da dona da pasta (essa parte é a regra do depósito);
//   · a faxina da mídia órfã não apaga a versão de uma imagem em uso e apaga a versão de uma principal que saiu;
//   · os nomes das versões, o srcset e o que o envio, o cartão e o apagar fazem com elas.
// Uso: npm run testar:p5-imagens
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import {
  caminhoDaVersao,
  caminhosComVersoes,
  ehCaminhoDeImagemPrincipal,
  ehLarguraDeVersao,
  montarSrcset,
  tamanhosDaImagem,
  versoesPara,
} from "../lib/rede/publicar/versoes.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => {
  try {
    return fs.readFileSync(path.join(raiz, c), "utf8");
  } catch {
    return "";
  }
};
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
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

// ═══════════════════ 0. Os nomes e o srcset ═══════════════════
const A = "0f8fad5b-d9cb-469f-a165-70867728950e";
const principal = `${A}/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp`;
ok("principal reconhecida", ehCaminhoDeImagemPrincipal(principal) && ehCaminhoDeImagemPrincipal(principal.replace(".webp", ".jpg")));
ok("áudio, versão e caminho estranho não são principal", !ehCaminhoDeImagemPrincipal(principal.replace(".webp", ".ogg")) && !ehCaminhoDeImagemPrincipal(`${principal}.v640`) && !ehCaminhoDeImagemPrincipal(`../${principal}`) && !ehCaminhoDeImagemPrincipal(`${A}/x.webp`));
ok("o nome da versão segue a principal", caminhoDaVersao(principal, 640) === `${principal}.v640`);
ok("só as larguras conhecidas", ehLarguraDeVersao(640) && ehLarguraDeVersao(1080) && !ehLarguraDeVersao(2000) && !ehLarguraDeVersao(0));
ok("versões só menores que a imagem", versoesPara(1600).join() === "640,1080" && versoesPara(900).join() === "640" && versoesPara(640).length === 0 && versoesPara(null).length === 0);
ok("apagar leva as versões junto", caminhosComVersoes(principal).join() === `${principal},${principal}.v640,${principal}.v1080` && caminhosComVersoes("x/y.ogg").join() === "x/y.ogg");
ok("srcset em ordem de largura", montarSrcset([{ largura: 1600, url: "p" }, { largura: 640, url: "a" }, { largura: 1080, url: "b" }]) === "a 640w, b 1080w, p 1600w");
ok("sem versão, sem srcset", montarSrcset([{ largura: 1600, url: "p" }]) === "" && montarSrcset([]) === "");
ok("tamanhos: sozinha e em grade", tamanhosDaImagem(1).includes("100vw") && tamanhosDaImagem(3).includes("50vw"));

// ═══════════════════ 1. O arquivo ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261126-p5-imagens.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração está no fim do install.sql", SQL.length > 0 && noFimDoInstall(SQL));
ok("não mexe na versão nem na lista de exceções", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("as funções: rede_pub_midia_pode e rede_midia_faxina_lista (redefinidas), nenhuma nova",
  [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]).join() === "public.rede_pub_midia_pode,public.rede_midia_faxina_lista");

// ═══════════════════ 2. O banco (montado com o install.sql do ramo) ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });

const P = {};
for (const nome of ["autora", "segue", "estranha"]) {
  P[nome] = await criarUsuario(`${nome}@im.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of Object.keys(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P.segue, P.autora]);

const emUso = `${P.autora}/${randomUUID()}.webp`;
const rp = await espera("a autora publica, só para quem segue, com uma imagem", () =>
  rpc(como(P.autora), "rede_publicar", { p: { texto: "Foto do ato", publico: "seguidores", midia: [{ caminho: emUso, alt: "O ato", largura: 1600, altura: 1200 }] } }),
  (r) => r?.id && r?.midia?.length === 1,
);
const pode = (quem, caminho) => rpc(como(P[quem]), "rede_pub_midia_pode", { p_caminho: caminho });
if (rp) {
  await espera("quem segue abre a principal", () => pode("segue", emUso), (r) => r === true);
  await espera("quem segue abre a versão de 640", () => pode("segue", `${emUso}.v640`), (r) => r === true);
  await espera("quem segue abre a versão de 1080", () => pode("segue", `${emUso}.v1080`), (r) => r === true);
  await espera("quem não segue NÃO abre a versão (a matriz de sempre)", () => pode("estranha", `${emUso}.v640`), (r) => r === false);
  await espera("quem não segue NÃO abre a principal", () => pode("estranha", emUso), (r) => r === false);
  await espera("largura inventada não abre", () => pode("segue", `${emUso}.v9999`), (r) => r === false);
  await espera("sufixo no meio não engana", () => pode("segue", `${emUso}.v640.v640`), (r) => r === false);
  await espera("visitante não abre a versão", () => rpc({ papel: "anon", ip: "203.0.113.9" }, "rede_pub_midia_pode", { p_caminho: `${emUso}.v640` }), (r) => r === false);
}
const solta = `${P.autora}/${randomUUID()}.webp`;
await espera("a versão de uma principal que não é de post não abre para ninguém pela matriz", () => pode("segue", `${solta}.v640`), (r) => r === false);

// O depósito de mentira: a faxina lê storage.objects.
await dono("create schema if not exists storage");
await dono("create table if not exists storage.objects (bucket_id text, name text, created_at timestamptz default now())");
const velho = "now() - interval '2 days'";
for (const nome of [emUso, `${emUso}.v640`, `${emUso}.v1080`, solta, `${solta}.v640`, `${solta}.v1080`, `${P.autora}/${randomUUID()}.webp.v640`])
  await dono(`insert into storage.objects (bucket_id, name, created_at) values ('rede-midia', $1, ${velho})`, [nome]);
await dono("insert into storage.objects (bucket_id, name) values ('rede-midia', $1)", [`${solta}.v640-novo`]);
const lista = await espera("a faxina lista (chave de serviço)", () => rpc({ papel: "service_role" }, "rede_midia_faxina_lista", { p_limite: 100 }), (r) => Array.isArray(r));
if (lista) {
  ok("faxina: a principal em uso fica", !lista.includes(emUso));
  ok("faxina: as versões da imagem em uso ficam", !lista.includes(`${emUso}.v640`) && !lista.includes(`${emUso}.v1080`), JSON.stringify(lista));
  ok("faxina: a principal órfã e as versões dela saem", lista.includes(solta) && lista.includes(`${solta}.v640`) && lista.includes(`${solta}.v1080`));
  ok("faxina: a versão sem principal sai", lista.some((n) => /\.webp\.v640$/.test(n) && !n.startsWith(solta) && !n.startsWith(emUso)));
  ok("faxina: o que tem menos de 24 horas fica", !lista.includes(`${solta}.v640-novo`));
}

// Roda de novo por cima (idempotente) e a porta continua trancada.
await espera("a migração roda de novo por cima", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await espera("a porta continua trancada em tudo", () => um("select interno.alumia_trancar() as r"), (x) => x.r.abertas.length === 0);
const def = await um("select pg_get_functiondef('public.rede_pub_midia_pode(text)'::regprocedure) d");
ok("a regra de leitura continua com a porta e a matriz de quem vê", /alumia_passa\(\)/.test(def.d) && /interno\.rede_ve\(p, auth\.uid\(\)\)/.test(def.d) && /rede_audios/.test(def.d));
const vol = await um("select provolatile v from pg_proc where oid = 'public.rede_pub_midia_pode(text)'::regprocedure");
ok("a regra de leitura continua stable (não grava nada)", vol.v === "s");

// ═══════════════════ 3. O envio, o cartão e o apagar ═══════════════════
const rota = ler("app/api/rede/midia/route.ts");
// Auditoria do P5: a versão é feita no servidor, da principal já limpa (scripts/testar-p5-auditoria.mjs prova os bytes).
ok("rota: a versão sai da principal já limpa, no servidor, ao lado dela", /versoesDaPrincipal\(bytes, id\.mime, largura\)/.test(rota) && /guardarComServico\(caminhoDaVersao\(reserva\.dado\.caminho, v\.largura\), v\.bytes, id\.mime\)/.test(rota));
ok("rota: a versão mandada pelo aparelho é recusada", /searchParams\.has\("versao_de"\)\) return resposta\(\{ erro: "versao_no_servidor" \}, 410\)/.test(rota));
ok("rota: não escreve log nem lê endereço de rede", !/console\.|x-forwarded|cf-connecting/i.test(rota));
const extras = ler("components/rede/publicar/ExtrasDoEscrever.tsx");
ok("envio: o aparelho não manda versão (a imagem final vai uma vez só)", !/subirVersoes|enviarVersao/.test(extras));
const api = ler("components/rede/publicar/api.ts");
ok("apagar do depósito leva as versões", api.includes(".flatMap(caminhosComVersoes)"));
ok("cartão: um pedido só para assinar a principal e as versões", /createSignedUrls\(caminhos, 3600\)/.test(api));
const comp = ler("components/rede/publicar/Complementos.tsx");
ok("cartão: srcset e sizes na imagem do post", comp.includes("srcSet={srcset || undefined}") && comp.includes("sizes={srcset ? tamanhosDaImagem(total) : undefined}"));

console.log(`\nP5 · imagens por tela (A20): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
