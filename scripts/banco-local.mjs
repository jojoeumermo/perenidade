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

export async function criarBanco() {
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
  const sql = fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8");
  await pg.exec(sql);

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
      if (!/^[a-z_]+$/.test(funcao)) throw new Error("função inválida");
      const nomes = Object.keys(argumentos);
      for (const nome of nomes) if (!/^[a-z_][a-z0-9_]*$/.test(nome)) throw new Error("argumento inválido");
      const claims = JSON.stringify({ role: quem.papel, ...(quem.sub ? { sub: quem.sub } : {}), ...(quem.aal ? { aal: quem.aal } : {}) });
      const headers = JSON.stringify({ "x-forwarded-for": quem.ip ?? "127.0.0.1" });
      await pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, headers]);
      await pg.exec(`set role ${quem.papel === "service_role" ? "service_role" : quem.papel === "authenticated" ? "authenticated" : "anon"}`);
      try {
        const lista = nomes.map((nome, i) => `${nome} => $${i + 1}`).join(", ");
        const valores = nomes.map((nome) => {
          const valor = argumentos[nome];
          return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? JSON.stringify(valor) : valor;
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

  return { pg, rpc, dono, criarUsuario, exclusivo, instalarDeNovo: () => exclusivo(() => pg.exec(sql)) };
}
