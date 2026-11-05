// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a pesquisa anônima dos 12 eixos da equipe (docs/eixos-equipe.md): a ordem fixa dos 12 números, o agregado com
// mínimo de 5, o SQL (nenhuma tabela em public, só agregado, sem data nem valor ligado à pessoa, funções sem acesso de
// anon) e a tela (sem a palavra proibida, só o vetor de 12 números vai ao banco). Uso: npm run testar:eixos-equipe
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AVISO_DA_PESQUISA, MINIMO_DA_PESQUISA, ORDEM_DOS_EIXOS, VERSAO_DO_AVISO_EIXOS, vetorParaEnvio } from "../lib/eixos/equipe.ts";
import { agregarPontos } from "../lib/eixos/pontuacao.ts";

const ler = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const dados = JSON.parse(ler("content", "eixos.json"));
const sql = ler("supabase", "migracoes", "2026-11-eixos-equipe.sql");
const tela = ler("components", "painel", "EixosEquipe.tsx");
const textos = ler("lib", "eixos", "equipe.ts");
let n = 0;
const ok = (nome, f) => {
  try {
    f();
    n++;
  } catch (e) {
    console.error("FALHOU:", nome, "\n ", e.message);
    process.exitCode = 1;
  }
};

ok("a ordem dos 12 eixos é a de content/eixos.json e a do SQL", () => {
  assert.deepEqual([...ORDEM_DOS_EIXOS], dados.eixos.map((e) => e.id));
  const m = sql.match(/array\[((?:'[a-z]+',?)+)\]/);
  assert.ok(m, "lista de eixos no SQL");
  assert.deepEqual(m[1].replaceAll("'", "").split(","), [...ORDEM_DOS_EIXOS]);
});
ok("vetorParaEnvio: 12 números na ordem fixa; recusa falta e fora de 0 a 100", () => {
  const pontos = Object.fromEntries(ORDEM_DOS_EIXOS.map((id, i) => [id, i * 9]));
  assert.deepEqual(vetorParaEnvio(pontos), ORDEM_DOS_EIXOS.map((_, i) => i * 9));
  assert.throws(() => vetorParaEnvio({ ...pontos, poder: 101 }));
  assert.throws(() => vetorParaEnvio({ ...pontos, poder: -1 }));
  const { tecnologia, ...sem } = pontos;
  assert.throws(() => vetorParaEnvio(sem));
});
ok("agregado: nulo abaixo de 5, média e faixas com 5", () => {
  const eixos = dados.eixos;
  const um = (v) => Object.fromEntries(eixos.map((e) => [e.id, v]));
  assert.equal(MINIMO_DA_PESQUISA, 5);
  assert.equal(agregarPontos(eixos, [um(10), um(20), um(30), um(40)], MINIMO_DA_PESQUISA), null);
  const a = agregarPontos(eixos, [um(0), um(25), um(50), um(75), um(100)], MINIMO_DA_PESQUISA);
  assert.equal(a.n, 5);
  assert.equal(a.media.poder, 50);
  assert.deepEqual(a.distribuicao.poder, [1, 1, 1, 1, 1]);
});
ok("SQL: nenhuma tabela em public; tabelas internas com RLS e sem acesso de anon", () => {
  assert.ok(!/create table[^;]*\bpublic\./i.test(sql));
  for (const t of ["eixos_equipe_vivo", "eixos_equipe_publicado", "eixos_equipe_marcas"]) {
    assert.ok(new RegExp(`create table if not exists interno\\.${t}`).test(sql), t);
    assert.ok(new RegExp(`alter table interno\\.${t} enable row level security`).test(sql), `rls ${t}`);
  }
  assert.ok(/revoke all on interno\.eixos_equipe_vivo[^;]*from anon, authenticated/.test(sql));
});
ok("SQL: funções public.* security definer com search_path fixo, sem grant a anon", () => {
  const fns = [...sql.matchAll(/create or replace function (public\.\w+)\(/g)].map((m) => m[1]);
  assert.deepEqual(fns.sort(), ["public.eixos_equipe_enviar", "public.eixos_equipe_estado", "public.eixos_equipe_resultado"]);
  assert.equal([...sql.matchAll(/security definer set search_path = interno, pg_temp/g)].length, 3);
  assert.ok(!/grant execute[^;]*to[^;]*\banon\b/.test(sql));
  assert.ok(!/grant execute on function interno\./.test(sql));
});
ok("SQL: marca separada do valor e sem data; coordenação só vê com 5 ou mais, em degraus de 5", () => {
  const marcas = sql.match(/create table if not exists interno\.eixos_equipe_marcas \(([^;]*?)\);/s)[1];
  assert.ok(!/created_at|criado|timestamp|data\b/i.test(marcas), "marca sem data");
  assert.ok(!/soma|pontos|baldes|valor/i.test(marcas), "marca sem valor");
  assert.ok(/n % 5 = 0/.test(sql) && /if p\.n < 5/.test(sql));
  assert.ok(/interno\.coord\(\)/.test(sql.split("eixos_equipe_resultado")[1]));
  assert.ok(/p_consentimento is distinct from true/.test(sql));
});
ok("tela: só o vetor de 12 números vai ao banco, com consentimento e versão", () => {
  assert.ok(/eixos_equipe_enviar", \{ p_pontos: pontos, p_consentimento: consenti, p_versao: VERSAO_DO_AVISO_EIXOS \}/.test(tela));
  assert.ok(!/localStorage|setItem\([^)]*respostas/.test(tela.replace(/CHAVE_CONVITE/g, "")), "respostas não vão ao disco");
  assert.ok(/import\("@\/content\/eixos\.json"\)/.test(tela), "perguntas por dynamic import");
  assert.ok(VERSAO_DO_AVISO_EIXOS.length > 0);
});
ok("aviso: anônimo, finalidade, LGPD art. 5º II, 11 I, 8º § 4º e 12; opcional; sem palavra proibida", () => {
  const todo = Object.values(AVISO_DA_PESQUISA).join(" ");
  for (const trecho of ["anônima", "Para que serve", "art. 5º, II", "art. 11, I", "art. 8º, § 4º", "art. 12", "opcional", "5 ou mais"]) assert.ok(todo.includes(trecho), trecho);
  assert.ok(!/universidade|diploma/i.test(todo + tela + textos));
});
ok("Painel e estrutura: seção registrada, só para voluntário, resultado só da coordenação", () => {
  // O registro de seções e a casca saíram de Painel.tsx para casca/ no redesenho (docs/PAINEL-REDESENHO.md): lemos os dois.
  const painel = ler("components", "painel", "Painel.tsx") + "\n" + ler("components", "painel", "casca", "Dentro.tsx");
  assert.ok(/id: "eixos-equipe"[^\n]*mostra: voluntario/.test(painel));
  assert.ok(/<EixosEquipe coordena=\{lidera \|\| can\(eu, "vice"\)\}/.test(painel));
  assert.ok(/"eixos-equipe": \{ espaco: "equipe"/.test(ler("components", "painel", "estrutura.ts")));
});

console.log(`eixos-equipe: ${n} conferências ok.`);