// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Um Postgres de verdade rodando dentro do Node (sem instalar nada), com o install.sql aplicado.
// Serve para os testes (testar-banco.mjs) e para desenvolver o painel sem tocar no banco real
// (backend-local.mjs). Tudo fica só na memória: fechou, sumiu.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `semRede`: carrega o install.sql só até o começo dos blocos da Rede v2 (supabase/migracoes/2026-11-rede-*.sql, que ficam no fim). Os
 * testes de cada pacote da Rede usam isso para aplicar as migrações eles mesmos, na ordem que querem, sobre o banco de antes da v2.
 * `antesDe`: carrega o install.sql só até o começo deste trecho (o texto inteiro de uma migração colada no fim). Serve para montar
 * o banco como estava antes de uma onda e provar o SQL da onda por cima dele.
 */
export async function criarBanco({ semRede = false, antesDe = "" } = {}) {
  // O pgcrypto vem ligado no serviço real (no esquema "extensions"); é com ele que a coordenação grava uma senha redefinida.
  const pg = new PGlite({ extensions: { pgcrypto } });
  // O mínimo que o serviço real já traz pronto: papéis, a extensão de criptografia e o esquema de autenticação.
  await pg.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      encrypted_password text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  let sql = fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8");
  if (semRede) {
    const corte = sql.indexOf("-- ───────────────────────────── Rede Lúcia v2: fundação das funções");
    if (corte < 0) throw new Error("install.sql sem o bloco da fundação da Rede v2");
    sql = sql.slice(0, corte);
  }
  if (antesDe) {
    const semCr = (t) => t.replace(/\r\n/g, "\n");
    const corte = semCr(sql).lastIndexOf(semCr(antesDe.replace(/^\uFEFF/, "")).trim());
    if (corte < 0) throw new Error("install.sql sem o trecho pedido em antesDe");
    sql = semCr(sql).slice(0, corte);
  }
  await pg.exec(sql);
  // ALUMIA_BANCO_EXTRAS: migrações (caminhos separados por vírgula, a partir da raiz) aplicadas DEPOIS do install.sql completo. Serve
  // para rodar os testes de sempre sobre o banco como ele vai ficar depois da junção de uma onda, antes de a junção colar as
  // migrações no install.sql. Só sem `semRede`/`antesDe` (esses montam o banco de antes).
  if (!semRede && !antesDe && process.env.ALUMIA_BANCO_EXTRAS) {
    for (const c of process.env.ALUMIA_BANCO_EXTRAS.split(",").map((x) => x.trim()).filter(Boolean)) {
      await pg.exec(fs.readFileSync(path.isAbsolute(c) ? c : path.join(raiz, c), "utf8"));
    }
  }

  let fila = Promise.resolve();
  /** Uma chamada por vez: cada uma troca o papel e as credenciais da sessão. */
  const exclusivo = (tarefa) => {
    const resultado = fila.then(tarefa, tarefa);
    fila = resultado.catch(() => {});
    return resultado;
  };

  /**
   * Chama uma função pública como a API faria: com o papel do banco e os dados do token.
   * quem = { papel: "anon" | "authenticated" | "service_role", sub?: uuid, ip?: string, aal?: "aal1" | "aal2" }
   */
  const rpc = (quem, funcao, argumentos = {}) =>
    exclusivo(async () => {
      if (!/^[a-z_][a-z0-9_]*$/.test(funcao)) throw new Error("função inválida");
      const nomes = Object.keys(argumentos);
      for (const nome of nomes) if (!/^[a-z_][a-z0-9_]*$/.test(nome)) throw new Error("argumento inválido");
      const claims = JSON.stringify({ role: quem.papel, ...(quem.sub ? { sub: quem.sub } : {}), ...(quem.aal ? { aal: quem.aal } : {}) });
      // quem.cabecalhos: cabeçalhos a mais do pedido (ex.: "x-alumia-envio", a chave do envio), como a API os passa ao banco.
      const headers = JSON.stringify({ ...(quem.cabecalhos ?? {}), "x-forwarded-for": quem.ip ?? "127.0.0.1" });
      await pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, headers]);
      await pg.exec(`set role ${quem.papel === "service_role" ? "service_role" : quem.papel === "authenticated" ? "authenticated" : "anon"}`);
      try {
        const lista = nomes.map((nome, i) => `${nome} => $${i + 1}`).join(", ");
        const valores = nomes.map((nome) => {
          const valor = argumentos[nome];
          // bytea vai como bytes (Uint8Array/Buffer); objeto vai como JSON.
          return valor !== null && typeof valor === "object" && !Array.isArray(valor) && !(valor instanceof Uint8Array) ? JSON.stringify(valor) : valor;
        });
        const resposta = await pg.query(`select public.${funcao}(${lista}) as r`, valores);
        return resposta.rows[0]?.r ?? null;
      } finally {
        await pg.exec("reset role");
      }
    });

  /** SQL como dono do banco (o que o SQL Editor faz). */
  const dono = (texto, valores = []) =>
    exclusivo(async () => {
      await pg.query("select set_config('request.jwt.claims', '', false)");
      return pg.query(texto, valores);
    });

  /** Cria uma conta. Depois que existe coordenação, só entra quem traz o código de um convite válido. */
  const criarUsuario = async (email, nome, convite) =>
    (await dono("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify({ full_name: nome, ...(convite ? { convite } : {}) })])).rows[0].id;

  /**
   * SÓ PARA OS TESTES de antes da R2 cujo assunto não é a filiação (fundos, mandatos, mapa, perfil da organização...): desde a R2
   * (membros escondidos, 20261124-r2-membros.sql) o banco não sabe quem é de qual núcleo, e as funções que dependiam disso leem
   * interno.rede_nucleo_sem_membros(), que em produção não devolve ninguém. Aqui ela passa a ler uma tabela de teste
   * (interno.teste_nucleo_membros), no lugar onde uma credencial anônima de verdade entraria. Chame de novo depois de instalar de novo
   * (o install.sql redefine a função). Nenhum teste da R2 usa isto para provar sigilo.
   */
  const filiacaoDeTeste = () =>
    exclusivo(() =>
      pg.exec(`
        create table if not exists interno.teste_nucleo_membros (nucleo uuid not null, usuario uuid not null, papel text not null default 'membro',
          entrou_em timestamptz not null default now(), primary key (nucleo, usuario));
        create or replace function interno.rede_nucleo_sem_membros() returns table (nucleo uuid, usuario uuid, papel text, entrou_em timestamptz)
        language sql stable security definer set search_path = interno, pg_temp as $$ select nucleo, usuario, papel, entrou_em from interno.teste_nucleo_membros $$;
      `),
    );
  /**
   * SÓ PARA OS TESTES que provam o código de uma migração de antes da R2 rodando-a de novo por cima do banco montado (a F4, o acervo
   * da onda 10, o núcleo da Escola): a tabela de filiação aos núcleos e o núcleo nos posts e na Escola, que a R2 (membros escondidos)
   * tirou, voltam só neste banco de teste, para o código daquela migração rodar como rodava. O que vale hoje está provado em
   * scripts/testar-r2-membros-banco.mjs.
   */
  const legadoDosNucleos = () =>
    exclusivo(() =>
      pg.exec(`
        create table if not exists interno.rede_nucleo_membros (
          nucleo uuid not null references interno.rede_nucleos (id) on delete cascade, usuario uuid not null references interno.perfis (id) on delete cascade,
          papel text not null default 'membro' check (papel in ('mediacao', 'membro')), entrou_em timestamptz not null default now(), primary key (nucleo, usuario));
        create index if not exists rede_nucleo_membros_usuario on interno.rede_nucleo_membros (usuario);
        alter table interno.rede_posts drop constraint if exists rede_posts_sem_nucleo;
        alter table interno.escola_militancia drop constraint if exists escola_militancia_sem_nucleo;
        alter table interno.escola_bancas drop constraint if exists escola_bancas_sem_nucleo;
        -- E as funções da R2 que leem a filiação (interno.rede_nucleo_sem_membros(), vazia em produção) leem esta mesma tabela.
        create or replace function interno.rede_nucleo_sem_membros() returns table (nucleo uuid, usuario uuid, papel text, entrou_em timestamptz)
        language sql stable security definer set search_path = interno, pg_temp as $$ select nucleo, usuario, papel, entrou_em from interno.rede_nucleo_membros $$;
      `),
    );
  return { pg, rpc, dono, criarUsuario, exclusivo, filiacaoDeTeste, legadoDosNucleos, instalarDeNovo: () => exclusivo(() => pg.exec(sql)) };
}
