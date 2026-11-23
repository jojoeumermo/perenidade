// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fuzzing das funções do banco que recebem dados de fora: toda função de `public` que o papel pode executar (anon = qualquer um
// pela API, sem conta; authenticated = uma conta aprovada; service_role = as rotas do site, que repassam o que chegou de fora).
// A assinatura de cada função vem do próprio banco montado (pg_proc): nomes, tipos e quantos parâmetros têm valor padrão. Cada caso
// é uma chamada com valores do tipo certo quase sempre, e às vezes do tipo errado ou nulo. Falha: erro grave do Postgres (classe XX,
// 53, 54, 58), o banco local caindo, ou a chamada travando (quem vigia o tempo é rodar.mjs).
import crypto from "node:crypto";
import { montarAmbiente } from "./ambiente.mjs";
import { assinaturaDoErro, classeDoErro } from "./classificar.mjs";
import { jsonQualquer, textoEstranho } from "./gerador.mjs";

// Funções que esperam de propósito ou mexem no próprio banco de teste de um jeito que derruba os casos seguintes (não recebem dado de
// fora). Cada uma com o motivo.
const FORA = new Set([
  "alumia_trancar", // fecha a porta do banco (só a migração chama)
]);

/** As funções que o papel executa, com os parâmetros. */
async function funcoesDoPapel(banco, papel, soServico) {
  const r = await banco.pg.query(
    `select p.proname as nome, coalesce(p.proargnames, '{}') as nomes, p.pronargs as n, p.pronargdefaults as padroes,
            array(select format_type(t, null) from unnest(p.proargtypes) t) as tipos
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.prokind = 'f' and has_function_privilege($1, p.oid, 'execute')
        and (not $2 or not (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
        and not exists (select 1 from unnest(p.proargmodes) m where m in ('o', 'b', 't', 'v'))
      order by 1`,
    [papel, soServico],
  );
  return r.rows.filter((f) => !FORA.has(f.nome) && f.nomes.length >= f.n && f.nomes.slice(0, f.n).every((x) => /^[a-z_][a-z0-9_]*$/.test(x)));
}

/** Um valor para um tipo do Postgres (quase sempre do tipo certo). */
function valorPara(r, tipo, ctx) {
  if (r.chance(0.06)) return null;
  if (r.chance(0.04)) return textoEstranho(r); // tipo errado de propósito
  const base = tipo.replace(/\[\]$/, "");
  if (tipo.endsWith("[]")) return `{${Array.from({ length: r.ate(4) }, () => JSON.stringify(String(valorPara(r, base, ctx) ?? "")).replace(/\\u0000/g, "")).join(",")}}`;
  switch (base) {
    case "uuid":
      return r.chance(0.5) ? r.escolher(ctx.uuids) : crypto.randomUUID();
    case "integer": case "smallint": case "bigint":
      return r.escolher([0, 1, -1, 3, 2, 7, 30, 64, 100, 1000, 2 ** 31 - 1, -(2 ** 31), 2 ** 40, r.ate(50)]);
    case "numeric": case "real": case "double precision":
      return r.escolher([0, 0.5, -1, 1e10, "NaN", "Infinity", 3.14159]);
    case "boolean":
      return r.chance(0.5);
    case "jsonb": case "json":
      return JSON.stringify(r.chance(0.7) ? Object.fromEntries(Array.from({ length: r.ate(5) }, () => [r.escolher(ctx.chaves), jsonQualquer(r)])) : jsonQualquer(r));
    case "bytea":
      return r.bytes(r.escolher([0, 1, 16, 31, 32, 33, 64, 2048, 3184]));
    case "date":
      return r.escolher(["2026-11-18", "1970-01-01", "9999-12-31", "2026-02-29", "-infinity", "infinity", new Date().toISOString().slice(0, 10)]);
    case "timestamp with time zone": case "timestamp without time zone":
      return r.escolher([new Date().toISOString(), "1970-01-01T00:00:00Z", "infinity", "2000-01-01 25:00", "294276-12-31"]);
    case "inet":
      return r.escolher(["127.0.0.1", "::1", "10.0.0.0/8", "300.1.1.1"]);
    default:
      return r.chance(0.7) ? r.escolher(ctx.textos) : textoEstranho(r);
  }
}

/** Monta o alvo de um papel. */
export function alvoDoBanco(papel, { soServico = false } = {}) {
  return {
    async preparar() {
      const amb = await montarAmbiente({ contas: ["ana", "bia"] });
      const funcoes = await funcoesDoPapel(amb.banco, papel, soServico);
      // Valores que existem de verdade (para as chamadas passarem das primeiras conferências e irem fundo).
      const uuids = [amb.ids.ana, amb.ids.bia, ...(await amb.banco.pg.query("select id from interno.rede_comunidades limit 5").catch(() => ({ rows: [] }))).rows.map((x) => x.id)];
      const textos = ["fz_ana", "fz_bia", "Codinome ana", "geral", "pt", "conta", "pedido", "entrada", "aberto", "publico", "rede", "ana@fuzz.local"];
      const chaves = ["id", "tipo", "texto", "titulo", "corpo", "slug", "itens", "acao", "visibilidade", "publico", "opcoes", "nome", "valor", "lista", "p", "limite", "antes", "depois"];
      const estatisticas = new Map();
      return { amb, funcoes, uuids, textos, chaves, estatisticas };
    },
    sementes(ctx) {
      return ctx.funcoes.slice(0, 400).map((f) => ({ funcao: f.nome, args: null }));
    },
    gerar(r, ctx) {
      const f = r.escolher(ctx.funcoes);
      return { funcao: f.nome, args: null };
    },
    resumir: (caso) => (typeof caso?.funcao === "string" ? caso.funcao : "função mutada"),
    /** Sorteia os argumentos (antes de o caso ser avisado a quem vigia: o caso que travar fica guardado inteiro). */
    completar(caso, r, ctx) {
      const f = ctx.funcoes.find((x) => x.nome === caso?.funcao) ?? r.escolher(ctx.funcoes);
      let args = Array.isArray(caso?.args) ? caso.args.slice(0, f.n) : null;
      // Sem argumentos, ou menos do que a função exige (a mutação trocou a função e ficou com os de outra): sorteia de novo.
      if (!args || args.length < f.n - f.padroes || r.chance(0.5)) {
        const n = f.n - (r.chance(0.5) ? r.ate(f.padroes + 1) : 0);
        args = f.tipos.slice(0, n).map((t) => {
          const v = valorPara(r, t, ctx);
          return Buffer.isBuffer(v) ? { bytea: v.toString("hex") } : v;
        });
      }
      // Depois de uma mutação, um argumento pode ter virado objeto: vai como texto JSON (o Postgres decide se aceita).
      const ehBytea = (v) => v && typeof v === "object" && typeof v.bytea === "string" && /^([0-9a-f]{2})*$/.test(v.bytea);
      args = args.map((v) => (v && typeof v === "object" && !ehBytea(v) ? JSON.stringify(v) : v));
      return { funcao: f.nome, args, fim: r.chance(0.5) ? "commit" : "rollback" };
    },
    async executar(caso, ctx) {
      const f = ctx.funcoes.find((x) => x.nome === caso.funcao);
      const n = caso.args.length;
      // Tudo vai como texto e o Postgres converte (o `::text::tipo`): quem decide se o valor serve é o banco, como pela API.
      const params = caso.args.map((v) => (v === null || v === undefined ? null : typeof v === "object" ? `\\x${v.bytea}` : String(v)));
      const sql = `select public.${f.nome}(${f.nomes.slice(0, n).map((nome, i) => `${nome} => $${i + 1}::text::${f.tipos[i]}`).join(", ")}) as r`;
      try {
        await ctx.amb.banco.exclusivo(async () => {
          const agoraS = Math.floor(Date.now() / 1000);
          const claims = papel === "anon" ? { role: "anon" } : papel === "service_role" ? { role: "service_role" } : { role: "authenticated", sub: ctx.amb.ids.ana, aal: "aal2", session_id: ctx.amb.sessoes.get(ctx.amb.ids.ana), iat: agoraS - 30, exp: agoraS + 3600 };
          await ctx.amb.banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify(claims)]);
          await ctx.amb.banco.pg.exec(`set role ${claims.role}`);
          try {
            await ctx.amb.banco.pg.query("begin");
            await ctx.amb.banco.pg.query(sql, params);
            await ctx.amb.banco.pg.query(caso.fim === "commit" ? "commit" : "rollback");
          } catch (erro) {
            await ctx.amb.banco.pg.query("rollback").catch(() => undefined);
            throw erro;
          } finally {
            await ctx.amb.banco.pg.exec("reset role");
          }
        });
      } catch (erro) {
        const classe = classeDoErro(erro);
        const chave = `${f.nome}:${erro?.code ?? "?"}`;
        ctx.estatisticas.set(chave, (ctx.estatisticas.get(chave) ?? 0) + 1);
        if (classe === "grave" || classe === "desconhecido") return { falha: { tipo: `banco_${classe}`, assinatura: assinaturaDoErro(f.nome, erro) } };
        return { caminho: chave };
      }
      ctx.estatisticas.set(`${f.nome}:ok`, (ctx.estatisticas.get(`${f.nome}:ok`) ?? 0) + 1);
      return { caminho: `${f.nome}:ok` };
    },
    /** Quantas funções, quantas chegaram ao fim sem erro ao menos uma vez, e os códigos de recusa mais comuns. */
    relatorio(ctx) {
      const comOk = new Set([...ctx.estatisticas.keys()].filter((k) => k.endsWith(":ok")).map((k) => k.slice(0, -3)));
      const codigos = new Map();
      for (const [k, n] of ctx.estatisticas) if (!k.endsWith(":ok")) codigos.set(k.split(":").pop(), (codigos.get(k.split(":").pop()) ?? 0) + n);
      return { funcoes: ctx.funcoes.length, chamadas: [...ctx.estatisticas.keys()].map((k) => k.slice(0, k.lastIndexOf(":"))).filter((v, i, a) => a.indexOf(v) === i).length, com_ok: comOk.size, codigos: Object.fromEntries([...codigos].sort((a, b) => b[1] - a[1]).slice(0, 12)) };
    },
    encerrar: (ctx) => ctx.amb.fechar(),
  };
}
