// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a leitura dos casos do banco (lib/vale-o-escrito/banco.ts): formato de cada linha, junção com os arquivos (o
// banco vence no mesmo id), descarte do que é inválido sem quebrar, volta aos arquivos quando o banco falha, e os fios
// da teia (curvas com semente) e os nós fixos. Sem rede: o fetch é de mentira.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buscarPublicadas, conferirLinha, juntarArquivosEBanco, lerTudoComBanco } from "../lib/vale-o-escrito/banco.ts";
import { SLUGS_DOS_DOSSIES } from "../lib/vale-o-escrito/catalogo.ts";
import { lerArquivoBruto, lerTudo } from "../lib/vale-o-escrito/dados.ts";
import { fioDaTeia, sementeDoPar } from "../lib/vale-o-escrito/visual.ts";

let total = 0;
const caso = async (nome, fn) => {
  await fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const ler = (...partes) => fs.readFileSync(path.join(process.cwd(), ...partes), "utf8");
const copia = (x) => JSON.parse(JSON.stringify(x));

const brutos = new Map(SLUGS_DOS_DOSSIES.map((slug) => [slug, lerArquivoBruto(slug)]));
const doArquivo = lerTudo();
const totalDoArquivo = doArquivo.reduce((n, d) => n + d.entradas.length, 0);
const dossieComCaso = doArquivo.find((d) => d.entradas.length > 0);
assert.ok(dossieComCaso, "há pelo menos um caso em arquivo");
const casoDoArquivo = dossieComCaso.entradas[0];
const linhaDe = (doc) => ({ id: doc.id, dossie: doc.dossie, situacao: doc.situacao, confianca: doc.confianca, doc, publicado_em: "2026-11-08T00:00:00Z", atualizado_em: "2026-11-08T00:00:00Z" });
const contar = (lidos) => lidos.reduce((n, d) => n + d.entradas.length, 0);

console.log("Casos do banco");
await caso("linha fora do formato é recusada (sem lançar erro)", () => {
  for (const ruim of [null, 1, "x", [], {}, { id: "A B", dossie: dossieComCaso.dossie, doc: {} }, { id: "ok-id", dossie: "nao-existe", doc: {} }]) {
    assert.equal(conferirLinha(ruim).ok, false);
  }
  const outroId = linhaDe({ ...copia(casoDoArquivo), id: "outro-id" });
  outroId.id = casoDoArquivo.id;
  assert.equal(conferirLinha(outroId).ok, false, "id da linha diferente do documento");
  assert.equal(conferirLinha(linhaDe(copia(casoDoArquivo))).ok, true);
});

await caso("o banco vence no mesmo id; caso novo entra; inválido sai sem derrubar a página", () => {
  const trocado = copia(casoDoArquivo);
  trocado.titulo = `${trocado.titulo} (versão do banco)`;
  const novo = { ...copia(casoDoArquivo), id: "2026-caso-so-no-banco" };
  const semFonte = { ...copia(casoDoArquivo), id: "2026-caso-sem-fonte", fontes: [] };
  const { lidos, descartadas } = juntarArquivosEBanco(brutos, [linhaDe(trocado), linhaDe(novo), linhaDe(semFonte), null, 42, { lixo: true }]);
  assert.equal(contar(lidos), totalDoArquivo + 1, "um caso a mais (o novo); o trocado não duplica; o inválido não entra");
  const todas = lidos.flatMap((d) => d.entradas);
  assert.equal(todas.filter((e) => e.id === casoDoArquivo.id).length, 1);
  assert.equal(todas.find((e) => e.id === casoDoArquivo.id).titulo, trocado.titulo);
  assert.ok(todas.some((e) => e.id === novo.id));
  assert.ok(!todas.some((e) => e.id === semFonte.id));
  assert.ok(descartadas.length >= 3, "as três linhas de lixo ficam registradas");
});

await caso("campos internos do documento não saem para o público", () => {
  const comNota = { ...copia(casoDoArquivo), nota: "texto interno", revisor: "alguém" };
  const { lidos } = juntarArquivosEBanco(brutos, [linhaDe(comNota)]);
  const e = lidos.flatMap((d) => d.entradas).find((x) => x.id === casoDoArquivo.id);
  assert.ok(e && !("nota" in e) && !("revisor" in e));
});

await caso("pessoas e ligações que vêm no documento do banco entram (o banco vence no mesmo id)", () => {
  const dossie = doArquivo.find((d) => d.pessoas.length > 0 && d.entradas.some((e) => e.pessoas.length > 0));
  if (!dossie) return;
  const en = dossie.entradas.find((e) => e.pessoas.length > 0);
  const pessoa = dossie.pessoas.find((p) => p.id === en.pessoas[0].pessoaId);
  const doc = { ...copia(en), pessoasPublicas: [{ ...copia(pessoa), nome: `${pessoa.nome}` }], ligacoes: dossie.ligacoes.filter((l) => l.entradaId === en.id) };
  const { lidos } = juntarArquivosEBanco(brutos, [linhaDe(doc)]);
  const d = lidos.find((x) => x.dossie === dossie.dossie);
  assert.ok(d.pessoas.some((p) => p.id === pessoa.id));
  assert.equal(d.ligacoes.filter((l) => l.entradaId === en.id).length, dossie.ligacoes.filter((l) => l.entradaId === en.id).length);
});

await caso("banco fora do ar, com erro ou resposta estranha: null (valem os arquivos); o pedido leva prazo", async () => {
  const antes = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, chave: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.equal(await buscarPublicadas(async () => assert.fail("sem variáveis não busca")), null);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.invalid/";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-de-teste";
  let pedido = null;
  const resposta = (corpo, ok = true) => async (url, init) => {
    pedido = { url, init };
    return { ok, json: async () => corpo };
  };
  assert.deepEqual(await buscarPublicadas(resposta([{ id: "x" }])), [{ id: "x" }]);
  assert.equal(pedido.url, "https://exemplo.invalid/rest/v1/rpc/vale_publicadas");
  assert.equal(pedido.init.method, "GET");
  assert.equal(pedido.init.next.revalidate, 300);
  assert.ok(pedido.init.signal instanceof AbortSignal, "com prazo");
  assert.equal(await buscarPublicadas(resposta([], false)), null);
  assert.equal(await buscarPublicadas(resposta({ erro: 1 })), null);
  assert.equal(await buscarPublicadas(async () => { throw new Error("rede"); }), null);
  if (antes.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = antes.url;
  if (antes.chave === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = antes.chave;
});

await caso("sem variáveis de ambiente (build sem banco): lerTudoComBanco devolve só os arquivos", async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.equal(contar(await lerTudoComBanco()), totalDoArquivo);
});

await caso("as páginas do observatório leem pelo banco e se refazem a cada 5 minutos", () => {
  const consulta = ler("lib", "vale-o-escrito", "consulta.ts");
  assert.ok(consulta.includes("lerTudoComBanco") && consulta.includes("async function dadosDoObservatorio"));
  for (const p of ["page.tsx", "arsenal/page.tsx", "caso/[id]/page.tsx", "pessoa/[id]/page.tsx", "organizacao/[id]/page.tsx"]) {
    const t = ler("app", "[lang]", "vale-o-escrito", ...p.split("/"));
    assert.ok(t.includes("export const revalidate = 300;"), p);
    assert.ok(t.includes("await dadosDoObservatorio("), p);
  }
});

console.log("Teia");
await caso("fio de teia: curva cúbica, a mesma para o mesmo par (nos dois sentidos), diferente entre pares", () => {
  const p = { x: 0, y: 0 };
  const q = { x: 200, y: 0 };
  const a = fioDaTeia(p, q, sementeDoPar("pessoa:a", "entrada:b", "l1"));
  const b = fioDaTeia(p, q, sementeDoPar("entrada:b", "pessoa:a", "l1"));
  assert.deepEqual(a, b);
  assert.match(a.d, /^M0,0 C[-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+ 200,0$/);
  const formas = new Set();
  for (let i = 0; i < 40; i++) {
    const f = fioDaTeia(p, q, sementeDoPar("pessoa:a", `entrada:${i}`, `l${i}`));
    formas.add(f.d);
    assert.ok(f.espessura >= 0.6 && f.espessura <= 1.4, "espessura");
    assert.ok(f.opacidade >= 0.55 && f.opacidade <= 1, "opacidade");
    assert.ok(Number.isFinite(f.mx) && Number.isFinite(f.my));
  }
  assert.ok(formas.size >= 38, "os fios não são todos iguais");
  const zero = fioDaTeia(p, p, "x");
  assert.ok(Number.isFinite(zero.mx) && !zero.d.includes("NaN"), "par no mesmo ponto não quebra");
});
await caso("nós fixos: a teia não arrasta nem pinça nós; Esc e clique fora fecham a ficha e o foco volta ao nó", () => {
  const teia = ler("components", "vale-o-escrito", "Teia.tsx");
  assert.ok(!/movidos|aoPressionar|prenderArrasto/.test(teia), "sem arrasto de nó");
  assert.ok(teia.includes("gestos: false"), "toque e roda ficam com a página");
  const prim = ler("components", "vale-o-escrito", "Primitivas.tsx");
  assert.ok(prim.includes("fioDaTeia") && prim.includes("data-chave") && !prim.includes("onPointerDown"));
  const obs = ler("components", "vale-o-escrito", "Observatorio.tsx");
  assert.ok(obs.includes('"Escape"') && obs.includes("fecharFicha") && obs.includes("data-chave") && obs.includes("data-visao={visao}"));
  const css = ler("styles", "vale-o-escrito.css");
  assert.ok(/\.ve-viz\[data-visao="teia"\]\s*\{\s*touch-action: auto;/.test(css));
});

console.log(`\n${total} conferências dos casos do banco e da teia passaram.`);
