// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova supabase/migracoes/20261126-p5-somente-leitura.sql num Postgres de verdade (scripts/banco-local.mjs): a API do banco roda
// função "stable" ou "immutable" numa transação só de leitura, e função assim não pode chegar a nada que grave (interno.limite
// conta o pedido gravando). Aqui as chamadas vão como a API faz: só leitura se a função é stable/immutable, o papel, a função.
//   · nenhuma função pública "stable"/"immutable" chega (direto ou por outras funções do banco) a uma que grava;
//   · Comunidades → Por cidade (alumia_estr_cidades, alumia_estr_da_cidade), a busca e o diretório das organizações respondem
//     numa transação só de leitura, para visitante e para quem tem conta;
//   · o limite de pedidos continua contando; a migração roda de novo sem estrago; a porta continua em tudo.
// Uso: npm run testar:p5-somente-leitura
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261126-p5-somente-leitura.sql"), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, extra = "") => (cond ? certos++ : falhas.push(extra ? `${nome} (${extra})` : nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

ok("a migração está no fim do install.sql", fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8").includes(sql.trim()));
ok("a migração não redefine corpo de função nem mexe na versão ou na porta", !/create or replace function|rede_alumia_versao|alumia_porta_aberta/.test(sql));

const banco = await criarBanco();
const { dono } = banco;
await espera("a migração roda de novo sem estrago", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("e uma terceira vez", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("a porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);

// ── 1. Nenhuma função pública "stable"/"immutable" chega a uma que grava ──────────────────────────────────────────────────────
{
  const fs_ = (await dono(String.raw`select n.nspname || '.' || p.proname as nome, p.provolatile as v, p.prosrc as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prokind = 'f'`)).rows;
  const por = new Map();
  for (const f of fs_) por.set(f.nome, [...(por.get(f.nome) ?? []), f]);
  // Quem já trata a transação só de leitura (interno.origem) não conta.
  const tolerante = (src) => /read_only_sql_transaction/.test(src);
  const gravaDireto = (src) => /\b(insert\s+into|update\s+[a-z_.]+\s+set|delete\s+from)\b/i.test(src);
  const chama = (src) => [...new Set([...src.matchAll(/\b(interno|public)\.([a-z0-9_]+)\s*\(/gi)].map((m) => `${m[1]}.${m[2]}`))];
  const memo = new Map();
  const grava = (nome, pilha = new Set()) => {
    if (memo.has(nome)) return memo.get(nome);
    if (pilha.has(nome)) return false;
    pilha.add(nome);
    const r = (por.get(nome) ?? []).some((f) => !tolerante(f.src) && (gravaDireto(f.src) || chama(f.src).some((c) => c !== nome && grava(c, pilha))));
    pilha.delete(nome);
    memo.set(nome, r);
    return r;
  };
  const ruins = fs_.filter((f) => f.nome.startsWith("public.") && f.v !== "v" && !tolerante(f.src) && (gravaDireto(f.src) || chama(f.src).some((c) => grava(c)))).map((f) => f.nome);
  ok("nenhuma função pública stable/immutable chega a uma que grava", ruins.length === 0, ruins.join(", "));
  ok("as vinte da migração estão volatile", fs_.filter((f) => /public\.(alumia_estr_(cidades|da_cidade|ver|espacos|origens)|rede_buscar|rede_org_(mapa|diretorio)|alumia_mural)$/.test(f.nome)).every((f) => f.v === "v"));
}

// ── 2. As chamadas como a API faz: transação só de leitura ────────────────────────────────────────────────────────────────────
const ana = await banco.criarUsuario("ana@exemplo.org", "Ana");
const so = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [JSON.stringify(quem), JSON.stringify({ "x-forwarded-for": "203.0.113.20" })]);
    // Como a API: transação só de leitura quando a função é stable ou immutable; de leitura e escrita quando é volatile.
    const marca = (await banco.pg.query("select p.provolatile as v from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1", [funcao])).rows[0]?.v;
    await banco.pg.exec(`begin ${marca === "v" ? "read write" : "read only"}; set local role ${quem.role};`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      const valores = nomes.map((n) => (argumentos[n] !== null && typeof argumentos[n] === "object" && !Array.isArray(argumentos[n]) ? JSON.stringify(argumentos[n]) : argumentos[n]));
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("rollback");
    }
  });
const visitante = { role: "anon" };
const comConta = { role: "authenticated", sub: ana, aal: "aal2" };
const naoCaiPorLeitura = async (nome, fazer) => {
  try {
    await fazer();
    certos++;
  } catch (erro) {
    // Erro de regra (por exemplo "nao_encontrado") é resposta; só a transação só de leitura é falha.
    if (/read-only/.test(erro.message)) falhas.push(`${nome}: ${erro.message}`);
    else certos++;
  }
};
for (const [quem, rotulo] of [[visitante, "visitante"], [comConta, "com conta"]]) {
  await espera(`Por cidade, a lista dos municípios responde em só leitura (${rotulo})`, () => so(quem, "alumia_estr_cidades"), (r) => Array.isArray(r));
  await espera(`Por cidade, as comunidades de um município respondem em só leitura (${rotulo})`, () => so(quem, "alumia_estr_da_cidade", { p_uf: "SP", p_municipio: "São Paulo" }), (r) => r && Array.isArray(r.itens));
  await naoCaiPorLeitura(`a aba Estrutura responde em só leitura (${rotulo})`, () => so(quem, "alumia_estr_ver", { p_slug: "nao-existe" }));
  await naoCaiPorLeitura(`o mapa das organizações responde em só leitura (${rotulo})`, () => so(quem, "rede_org_mapa"));
  await naoCaiPorLeitura(`o diretório das organizações responde em só leitura (${rotulo})`, () => so(quem, "rede_org_diretorio", { p: {} }));
  await naoCaiPorLeitura(`o mural da Escola responde em só leitura (${rotulo})`, () => so(quem, "alumia_mural"));
}
await naoCaiPorLeitura("a busca responde em só leitura", () => so(comConta, "rede_buscar", { p_termo: "ato" }));

// ── 3. O limite continua contando (fora da transação só de leitura, como a API grava) ────────────────────────────────────────
await dono("delete from interno.limites");
await espera("o pedido continua contado no limite", () => banco.rpc({ papel: "authenticated", sub: ana, aal: "aal2", ip: "203.0.113.21" }, "alumia_estr_cidades"), () => true);
await espera("e a conta aparece em interno.limites", async () => (await dono("select count(*)::int as n from interno.limites where chave like 'alumia_estr_ler:%'")).rows[0].n, (n) => n >= 1);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
