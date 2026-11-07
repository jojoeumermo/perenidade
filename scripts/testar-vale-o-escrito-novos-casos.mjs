// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere os lotes de casos novos do Vale o Escrito (content/vale-o-escrito/novos-casos/*.json) contra o formato e as
// regras de publicação (lib/vale-o-escrito/regras.ts, pela mesma conferência que dados.ts usa), ANTES de a curadoria
// juntá-los aos arquivos publicados (content/vale-o-escrito/entradas/<dossie>.json). Sem rede, sem banco.
//
// Regras extras deste lote (decisão da coordenação, 05/11/2026): cada caso só entra com FONTE OFICIAL (processo,
// investigação oficial ou dado oficial) e SITUAÇÃO JURÍDICA preenchidas; nada de duplicar caso que já está publicado
// (mesmo id ou mesmo link de fonte); tudo chega como "pendente-curadoria" (não é publicado até a revisão humana).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SLUGS_DOS_DOSSIES } from "../lib/vale-o-escrito/catalogo.ts";
import { conferirArquivo, lerArquivoBruto } from "../lib/vale-o-escrito/dados.ts";
import { TIPOS_PRIMARIOS, SITUACOES } from "../lib/vale-o-escrito/tipos.ts";

const pasta = path.join(process.cwd(), "content", "vale-o-escrito", "novos-casos");
let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};

const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((n) => n.endsWith(".json")).sort() : [];
console.log(`Vale o Escrito: ${arquivos.length} lote(s) de casos novos em content/vale-o-escrito/novos-casos/`);

// O que já está publicado (para não duplicar por id nem por link).
const publicados = SLUGS_DOS_DOSSIES.map((s) => lerArquivoBruto(s)).filter(Boolean);
const idsPublicados = new Set(publicados.flatMap((a) => (a.entradas ?? []).map((e) => e.id)));
const linksPublicados = new Set(publicados.flatMap((a) => (a.entradas ?? []).flatMap((e) => (e.fontes ?? []).map((f) => f.url))));
const nomePorPessoaPublicada = new Map(publicados.flatMap((a) => (a.pessoas ?? []).map((p) => [p.id, p.nome])));

const idsVistos = new Map();
for (const nome of arquivos) {
  const bruto = JSON.parse(fs.readFileSync(path.join(pasta, nome), "utf8"));
  const entradas = bruto.entradas ?? [];

  caso(`${nome}: dossiê cadastrado e lote não vazio`, () => {
    assert.ok(SLUGS_DOS_DOSSIES.includes(bruto.dossie), `dossiê "${bruto.dossie}" fora da lista`);
    assert.ok(entradas.length > 0, "lote vazio");
  });

  caso(`${nome}: todas as entradas passam nas regras (nenhuma descartada)`, () => {
    const lido = conferirArquivo(bruto);
    assert.deepEqual(lido.descartadas, [], `descartadas:\n${lido.descartadas.join("\n")}`);
    assert.equal(lido.pendentes.length, entradas.length, "toda entrada nova tem de passar como pendente-curadoria");
    assert.equal(lido.entradas.length, 0, "nada do lote pode sair como publicado antes da curadoria");
  });

  caso(`${nome}: fonte oficial e situação jurídica em cada caso (regra da coordenação)`, () => {
    for (const en of entradas) {
      assert.equal(en.revisao, "pendente-curadoria", `${en.id}: revisao`);
      assert.ok(SITUACOES.includes(en.situacao), `${en.id}: situação jurídica`);
      assert.ok(en.fontes.some((f) => TIPOS_PRIMARIOS.includes(f.tipo)), `${en.id}: sem fonte oficial`);
      for (const p of en.pessoas ?? []) assert.ok(SITUACOES.includes(p.situacao), `${en.id}/${p.pessoaId}: situação da pessoa`);
      assert.ok(typeof en.notaDaCuradoria === "string" && en.notaDaCuradoria.length > 20, `${en.id}: nota para a curadoria`);
      assert.ok(en.lugar?.regiao, `${en.id}: lugar sem UF`);
    }
  });

  caso(`${nome}: nada duplicado com o que já está publicado (id e link)`, () => {
    for (const en of entradas) {
      assert.ok(!idsPublicados.has(en.id), `${en.id}: já publicado`);
      for (const f of en.fontes) assert.ok(!linksPublicados.has(f.url), `${en.id}: link já usado em caso publicado (${f.url})`);
      assert.ok(!idsVistos.has(en.id), `${en.id}: repetido em ${idsVistos.get(en.id)}`);
      idsVistos.set(en.id, nome);
    }
    for (const p of bruto.pessoas ?? []) {
      const outro = nomePorPessoaPublicada.get(p.id);
      assert.ok(!outro || outro === p.nome, `pessoa ${p.id}: id já usado para "${outro}"`);
    }
  });

  caso(`${nome}: nenhum CPF e nenhum link sem https`, () => {
    const texto = JSON.stringify(bruto);
    assert.ok(!/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(texto), "CPF no arquivo");
    for (const en of entradas) for (const f of en.fontes) assert.ok(f.url.startsWith("https://"), `${en.id}/${f.id}: use https`);
  });
}

console.log(`\n${total} conferências ok.`);
