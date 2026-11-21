// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ambiente dos alvos de fuzzing que passam pelas rotas do site: o banco local (PGlite, o install.sql inteiro) atrás de um
// PostgREST de mentira na memória (o mesmo desenho de scripts/testar-r2-juncao.mjs), as variáveis de ambiente de teste e as rotas
// importadas direto, sem servidor. Nada sai da máquina: o PostgREST escuta só em 127.0.0.1, numa porta sorteada pelo sistema.
import crypto from "node:crypto";
import http from "node:http";
import { criarBanco } from "../../banco-local.mjs";

export const SERVICO = "chave-de-servico-de-teste"; // gitleaks:allow (valor de teste)
export const ANON = "chave-publica-de-teste"; // gitleaks:allow (valor de teste)

/**
 * Sobe o banco e o PostgREST de mentira e põe o endereço nas variáveis de ambiente ANTES de importar as rotas (elas leem o endereço
 * ao carregar). Devolve o banco, as contas criadas (aprovadas, com codinome) e `importarRotas`.
 */
export async function montarAmbiente({ contas = ["ana", "bia"] } = {}) {
  const banco = await criarBanco();
  const agoraS = () => Math.floor(Date.now() / 1000);
  const sessoes = new Map();
  // O último erro do banco em cada chamada pelo PostgREST de mentira (o código SQLSTATE), para o alvo saber se a rota deixou passar
  // ao banco um valor que ele não aceita (erro de tipo, de limite) em vez de recusar antes.
  const errosDoBanco = [];
  // As funções chamadas pelo PostgREST de mentira (as últimas 200), para um teste saber se a rota chegou ao banco.
  const chamadas = [];
  // Os parâmetros bytea de cada função (em qualquer versão dela). O PostgREST de verdade manda tudo como texto e o Postgres lê
  // "\x00ff" como bytes SÓ quando o parâmetro é bytea; num parâmetro text, é o texto "\x00ff" mesmo. Converter sempre fazia o
  // fuzzing achar erro de codificação que não existe (uma rota mandando o texto "\x00ff" num campo text).
  const byteaDe = new Map();
  const parametrosBytea = async (funcao) => {
    if (!byteaDe.has(funcao)) {
      const r = await banco.pg.query(
        `select a.nome from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           lateral unnest(p.proargnames, p.proargtypes::regtype[]::text[]) as a(nome, tipo)
         where n.nspname = 'public' and p.proname = $1 and a.tipo = 'bytea'`,
        [funcao],
      );
      byteaDe.set(funcao, new Set(r.rows.map((x) => x.nome)));
    }
    return byteaDe.get(funcao);
  };
  const rpcComo = (bearer, funcao, argumentos) =>
    banco.exclusivo(async () => {
      const bytea = /^[a-z_][a-z0-9_]*$/.test(funcao) ? await parametrosBytea(funcao) : new Set();
      let claims;
      if (bearer === SERVICO) claims = { role: "service_role" };
      else if (bearer?.startsWith("conta.") && sessoes.has(bearer.slice(6))) {
        claims = { role: "authenticated", sub: bearer.slice(6), aal: "aal2", session_id: sessoes.get(bearer.slice(6)), iat: agoraS() - 30, exp: agoraS() + 3600 };
      } else claims = { role: "anon" };
      await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [JSON.stringify(claims)]);
      await banco.pg.exec(`set role ${claims.role}`);
      try {
        const nomes = Object.keys(argumentos);
        if (nomes.some((n) => !/^[a-z_][a-z0-9_]*$/.test(n))) throw new Error("parametro desconhecido");
        const valores = nomes.map((n) => {
          const v = argumentos[n];
          if (typeof v === "string" && bytea.has(n) && /^\\x[0-9a-f]*$/i.test(v)) return Buffer.from(v.slice(2), "hex");
          // Lista vai como lista (o PGlite escreve a lista do Postgres quando o parâmetro é uuid[]/text[], e JSON quando é jsonb), como
          // o PostgREST faz; objeto vai como texto JSON.
          return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
        });
        const r = (await banco.pg.query(`select public.${funcao}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, valores)).rows[0]?.r ?? null;
        return JSON.parse(JSON.stringify(r, (k, v) => (v?.type === "Buffer" && Array.isArray(v.data) ? `\\x${Buffer.from(v.data).toString("hex")}` : v)));
      } finally {
        await banco.pg.exec("reset role");
      }
    });

  const servidorFalso = http.createServer(async (req, res) => {
    let corpo = "";
    for await (const pedaco of req) corpo += pedaco;
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/auth/v1/user") {
      if (bearer?.startsWith("conta.") && sessoes.has(bearer.slice(6))) return res.end(JSON.stringify({ id: bearer.slice(6), email_confirmed_at: "2026-01-01" }));
      res.statusCode = 401;
      return res.end("{}");
    }
    const m = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(req.url ?? "");
    if (!m) {
      res.statusCode = 404;
      return res.end("{}");
    }
    chamadas.push(m[1]);
    if (chamadas.length > 200) chamadas.shift();
    try {
      res.end(JSON.stringify(await rpcComo(bearer, m[1], corpo ? JSON.parse(corpo) : {})));
    } catch (erro) {
      errosDoBanco.push({ funcao: m[1], codigo: erro.code ?? null, mensagem: String(erro.message).slice(0, 200) });
      if (errosDoBanco.length > 50) errosDoBanco.shift();
      res.statusCode = /permission denied/.test(erro.message) ? 401 : 400;
      res.end(JSON.stringify({ message: erro.message }));
    }
  });
  await new Promise((r) => servidorFalso.listen(0, "127.0.0.1", r));
  const SUPA = `http://127.0.0.1:${servidorFalso.address().port}`;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: SUPA,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
    SUPABASE_SERVICE_ROLE_KEY: SERVICO,
    ALUMIA_PASSES_SEGREDO: "segredo-dos-passes-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
    ALUMIA_FRANQUIA_SEGREDO: "segredo-da-franquia-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
    ALUMIA_IMPRESSAO_SEGREDO: "segredo-da-impressao-de-teste-com-mais-de-32", // gitleaks:allow (valor de teste)
    ALUMIA_VOTO_SEGREDO: "segredo-do-voto-de-teste-com-mais-de-32-letras", // gitleaks:allow (valor de teste)
  });

  const { dono, criarUsuario } = banco;
  const ids = {};
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const nome of contas) {
    ids[nome] = await criarUsuario(`${nome}@fuzz.local`, `Pessoa ${nome}`);
    sessoes.set(ids[nome], crypto.randomUUID());
    await rpcComo(`conta.${ids[nome]}`, "eu", {}).catch(() => undefined);
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [ids[nome], `Codinome ${nome}`, `fz_${nome}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [ids[nome]]);
  }
  await dono("update auth.users set created_at = now() - interval '30 days'");
  await dono("select interno.alumia_entrada_ligar(true)");
  for (const nome of contas) {
    await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [ids[nome]]);
  }
  // O "localStorage" de quem chama os módulos de aparelho (as rotas não usam; alguns módulos leem ao carregar).
  const guardado = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) },
  });

  /** Importa as rotas pedidas (caminho a partir de app/api/). */
  const importarRotas = async (caminhos) => {
    const rotas = {};
    for (const c of caminhos) rotas[c] = await import(`../../../app/api/${c}/route.ts`);
    return rotas;
  };
  const fechar = () => new Promise((r) => servidorFalso.close(() => r()));
  return { banco, ids, sessoes, SUPA, rpcComo, importarRotas, fechar, errosDoBanco, chamadas };
}
