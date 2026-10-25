// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os depósitos de arquivos (Supabase Storage) com um esquema "storage" simulado: o install.sql inteiro roda com os blocos
// de depósito ativos (no banco de testar-banco eles são pulados) e as regras de envio que contam arquivos são exercitadas
// de verdade: perguntas gravadas do podcast e PDFs da Gaveta, as duas abertas a qualquer conta. Uso: npm run testar:depositos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = new PGlite({ extensions: { pgcrypto } });
await pg.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz not null default now(), metadata jsonb);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, delete on storage.objects to anon, authenticated;
`);
await pg.exec(fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8"));
const politicas = (await pg.query("select policyname from pg_policies where schemaname = 'storage' order by 1")).rows.map((r) => r.policyname);
const esperadas = ["envios_envio", "gaveta_envio", "podcast_producao_envio", "radio_envio_coordenacao", "saude_envio", "videoaulas_envio", "estudio_publicacoes_envio"];

const usuario = "7b1f6c2e-0000-4000-8000-000000000001";
await pg.query("insert into auth.users (id, email) values ($1, 'lia@teste.local')", [usuario]);
await pg.query("insert into interno.perfis (id, nome) values ($1, 'Lia Teste') on conflict do nothing", [usuario]);
let certos = 0, falhas = [];
async function enviar(bucket, nome) {
  await pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: usuario })]);
  await pg.exec("set role authenticated");
  try {
    await pg.query("insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)", [bucket, nome, usuario]);
    return "entrou";
  } catch (e) {
    return /row-level security/.test(e.message) ? "barrado" : `erro: ${e.message}`;
  } finally {
    await pg.exec("reset role");
  }
}
const espera = (nome, ok) => (ok ? certos++ : falhas.push(nome));
espera("o install.sql cria todas as regras de depósito", esperadas.every((p) => politicas.includes(p)));
const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

espera("pergunta com áudio na própria pasta entra", (await enviar("podcast-producao", `perguntas/${usuario}/p-${id()}.webm`)) === "entrou");
espera("zip na pasta de perguntas é barrado", (await enviar("podcast-producao", `perguntas/${usuario}/p-${id()}.zip`)) === "barrado");
espera("pasta de outra pessoa é barrada", (await enviar("podcast-producao", `perguntas/7b1f6c2e-0000-4000-8000-000000000002/p-${id()}.webm`)) === "barrado");
espera("nome fora do padrão é barrado", (await enviar("podcast-producao", `perguntas/${usuario}/qualquer.webm`)) === "barrado");
for (let i = 0; i < 4; i++) await enviar("podcast-producao", `perguntas/${usuario}/p-${id()}.ogg`);
espera("a sexta pergunta do dia é barrada", (await enviar("podcast-producao", `perguntas/${usuario}/p-${id()}.webm`)) === "barrado");

espera("PDF da Gaveta na própria pasta entra", (await enviar("gaveta", `${usuario}/${crypto.randomUUID()}.pdf`)) === "entrou");
espera("Gaveta: arquivo que não é .pdf é barrado", (await enviar("gaveta", `${usuario}/${crypto.randomUUID()}.html`)) === "barrado");
for (let i = 0; i < 5; i++) await enviar("gaveta", `${usuario}/${crypto.randomUUID()}.pdf`);
espera("Gaveta: o sétimo PDF do dia é barrado", (await enviar("gaveta", `${usuario}/${crypto.randomUUID()}.pdf`)) === "barrado");

await pg.query("update interno.perfis set suspenso = true where id = $1", [usuario]);
await pg.query("delete from storage.objects");
espera("conta suspensa não envia pergunta", (await enviar("podcast-producao", `perguntas/${usuario}/p-${id()}.webm`)) === "barrado");
espera("conta suspensa não envia PDF", (await enviar("gaveta", `${usuario}/${crypto.randomUUID()}.pdf`)) === "barrado");

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
