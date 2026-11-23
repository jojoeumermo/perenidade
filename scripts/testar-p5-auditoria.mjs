// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova supabase/migracoes/20261126-p5-auditoria.sql (os consertos da auditoria do Prompt 5) num Postgres de verdade, com um
// depósito (storage) mínimo como o do Supabase, para as regras do depósito serem criadas pelo install.sql e postas à prova. Cada
// parte é um ataque escrito como teste: falhava antes do conserto e passa depois.
//   1. O depósito do post: ninguém com conta grava direto no rede-midia (nem a versão .v640/.v1080, nem a troca de uma foto já
//      publicada); só o servidor do site grava, no caminho que o banco reservou como a pessoa, e a versão menor sai da principal.
//   2. O story conferido: o arquivo já citado por um story não é trocado por outro no mesmo caminho.
//   3. O modo só leitura: a conta comum não troca o nome, o @, a foto, a capa nem a bio da rede.
//   4. Os educadores da Escola: nenhuma lista de militantes; a coordenação acha uma pessoa pelo @ exato.
//   5. Os erros da tela: sem CPF, IP, token nem texto entre aspas; o endereço só com a primeira parte conhecida; a enxurrada de
//      um visitante não cega o registro.
//   6. As funções do painel sem execução para visitante; ferias_marcar(date) segue a regra nova.
//   7. O resumo das pendências na tela da própria pessoa usa a sessão dela (sem segundo fator inventado).
// Uso: npm run testar:p5-auditoria
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { mensagemLimpa, telaLimpa } from "../lib/rede/beta/tela.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8").replace(/\r\n/g, "\n");

let certos = 0;
const falhas = [];
const ok = (nome, cond, extra = "") => (cond ? certos++ : falhas.push(extra ? `${nome} (${extra})` : nome));
async function tenta(f) {
  try {
    return { ok: true, v: await f() };
  } catch (e) {
    return { ok: false, e: String(e.message) };
  }
}

// ═══════════════════ 0. O arquivo ═══════════════════
const SQL = ler("supabase/migracoes/20261126-p5-auditoria.sql");
ok("a migração está no fim do install.sql (seguida só das datadas posteriores)", noFimDoInstall(SQL, ler("supabase/install.sql")));
ok("o cabeçalho diz que roda depois do fim da R3 e antes do p5-fim", /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)[\s\S]{0,200}20261126-p5-fim\.sql vem por último/.test(SQL));
ok("termina trancando", /select interno\.alumia_trancar\(\);\s*$/.test(SQL));
ok("não mexe na versão nem na lista da porta", !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(SQL));
ok("nenhuma permissão direta em tabela para anon ou authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(SQL));

// ═══════════════════ O banco, com um depósito mínimo ═══════════════════
const pg = new PGlite({ extensions: { pgcrypto } });
await pg.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text,
    raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
    owner uuid, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`);
await pg.exec(ler("supabase/install.sql"));
// A migração roda de novo por cima, sem estrago.
const denovo = await tenta(() => pg.exec(SQL));
ok("a migração roda de novo por cima", denovo.ok, denovo.e);

/** Uma transação como a API: o papel do banco, o token e a origem. */
async function como(quem, fn, { readOnly = false } = {}) {
  const claims = quem.papel === "anon" ? { role: "anon" } : quem.papel === "service_role" ? { role: "service_role" } : { role: "authenticated", sub: quem.sub, aal: quem.aal ?? "aal2" };
  await pg.exec("begin" + (readOnly ? " read only" : ""));
  try {
    await pg.query("select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)", [JSON.stringify(claims), JSON.stringify({ "x-forwarded-for": quem.ip ?? "203.0.113.9" })]);
    await pg.exec(`set local role ${quem.papel}`);
    const r = await fn();
    await pg.exec("commit");
    return r;
  } catch (e) {
    await pg.exec("rollback");
    throw e;
  }
}
const rpc = (quem, f, args = {}) =>
  como(quem, async () => {
    const nomes = Object.keys(args);
    const vals = nomes.map((n) => (args[n] !== null && typeof args[n] === "object" && !Array.isArray(args[n]) ? JSON.stringify(args[n]) : args[n]));
    return (await pg.query(`select public.${f}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`, vals)).rows[0]?.r ?? null;
  });
const dono = (s, v = []) => pg.query(s, v);
const um = async (s, v = []) => (await dono(s, v)).rows[0];

const P = {};
for (const n of ["coord", "med", "m1", "m2", "mil"]) {
  P[n] = (await um("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [`${n}@auditoria.local`, JSON.stringify({ full_name: `Pessoa ${n}` })])).id;
  await rpc({ papel: "authenticated", sub: P[n] }, "eu").catch(() => {});
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.med]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
let i = 0;
for (const n of Object.keys(P)) {
  i++;
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[n], `Codinome ${n}`, `h_${n}_${i}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[n]]);
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P[n]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [P.m2, P.m1]);
const A = (n, aal = "aal2") => ({ papel: "authenticated", sub: P[n], aal });
const ANON = { papel: "anon" };
const SERVICO = { papel: "service_role" };
const subir = (quem, bucket, nome, tamanho = 1000, mime = "image/jpeg") =>
  tenta(() => como(quem, () => pg.query("insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)", [bucket, nome, quem.sub ?? null, JSON.stringify({ mimetype: mime, size: tamanho })])));
const apagar = (quem, bucket, nome) => tenta(() => como(quem, () => pg.query("delete from storage.objects where bucket_id = $1 and name = $2", [bucket, nome])));
const ve = async (quem, bucket, nome) => como(quem, async () => (await pg.query("select count(*)::int n from storage.objects where bucket_id = $1 and name = $2", [bucket, nome])).rows[0].n === 1);

// ═══════════════════ 1. O depósito do post ═══════════════════
{
  // A foto que o servidor do site guardou (chave de serviço) num caminho reservado como m1, e o post com ela.
  const reserva = await tenta(() => rpc(A("m1"), "rede_pub_midia_reservar", { p_ext: "jpg" }));
  ok("a reserva do caminho continua como a pessoa", reserva.ok && reserva.v.caminho.startsWith(`${P.m1}/`), reserva.e);
  const foto = reserva.ok ? reserva.v.caminho : `${P.m1}/${randomUUID()}.jpg`;
  const peloServidor = await subir(SERVICO, "rede-midia", foto);
  ok("o servidor do site (chave de serviço) grava a foto no caminho reservado", peloServidor.ok, peloServidor.e);
  const pub = await tenta(() => rpc(A("m1"), "rede_publicar", { p: { texto: "Foto do ato", midia: [{ caminho: foto, alt: "O ato", largura: 1600, altura: 1200 }] } }));
  ok("m1 publica o post com a foto", pub.ok && pub.v?.id, pub.e);
  ok("m2 abre a foto do post (base)", await ve(A("m2"), "rede-midia", foto));

  const versao = await subir(A("m1"), "rede-midia", `${foto}.v640`);
  ok("ATAQUE: m1 sobe direto ao depósito a 'versão' .v640 de uma foto publicada (qualquer imagem, com EXIF) — recusado", !versao.ok);
  ok("e m2 não recebe versão nenhuma", !(await ve(A("m2"), "rede-midia", `${foto}.v640`)));

  const fora = await apagar(A("m1"), "rede-midia", foto);
  const troca = await subir(A("m1"), "rede-midia", foto);
  ok("ATAQUE: m1 apaga a foto publicada e sobe outra no mesmo caminho (sem a limpeza do servidor) — recusado", !troca.ok, `apagar ${fora.ok}`);

  const direto = await subir(A("m1"), "rede-midia", `${P.m1}/${randomUUID()}.jpg`);
  ok("ATAQUE: m1 sobe uma foto direto ao rede-midia, sem /api/rede/midia — recusado", !direto.ok);
  const outraPasta = await subir(A("m1"), "rede-midia", `${P.m2}/${randomUUID()}.jpg`);
  ok("na pasta de outra pessoa, também recusado", !outraPasta.ok);

  // A cota: o servidor grava com a chave de serviço (que passa por cima da regra do depósito); a reserva confere a cota.
  await dono("insert into interno.configuracoes (chave, valor) values ('midia_cota', '{\"bytes\": 10485760}'::jsonb) on conflict (chave) do update set valor = excluded.valor");
  await subir(SERVICO, "rede-midia", `${P.m1}/${randomUUID()}.jpg`, 11 * 1024 * 1024);
  const cheia = await tenta(() => rpc(A("m1"), "rede_pub_midia_reservar", { p_ext: "jpg" }));
  ok("a reserva recusa quem passou da cota (midia_cheia)", !cheia.ok && /midia_cheia/.test(cheia.e), cheia.e ?? JSON.stringify(cheia.v));
  await dono("delete from interno.configuracoes where chave = 'midia_cota'");
  await dono("delete from storage.objects where metadata ->> 'size' = $1", [String(11 * 1024 * 1024)]);
  const volta = await tenta(() => rpc(A("m1"), "rede_pub_midia_reservar", { p_ext: "jpg" }));
  ok("dentro da cota, a reserva volta a sair", volta.ok, volta.e);

  // A rota e o aparelho.
  const rota = ler("app/api/rede/midia/route.ts");
  ok("rota: a versão pedida pelo aparelho não existe mais (versao_de recusado)", /versao_de[\s\S]{0,200}410/.test(rota) && !/guardarNoDeposito\(token/.test(rota));
  ok("rota: grava com a chave de serviço no caminho que o banco reservou como a pessoa", /rede_pub_midia_reservar/.test(rota) && /guardarComServico\(reserva\.dado\.caminho/.test(rota));
  ok("rota: as versões saem da principal já limpa, no servidor", /versoesDaPrincipal\(bytes/.test(rota));
  ok("rota: não escreve log nem lê endereço de rede", !/console\.|x-forwarded|cf-connecting/i.test(rota));
  const extras = ler("components/rede/publicar/ExtrasDoEscrever.tsx");
  const api = ler("components/rede/publicar/api.ts");
  ok("aparelho: não manda mais versão nenhuma", !/subirVersoes|enviarVersao/.test(extras) && !/export async function enviarVersao/.test(api));
}

// A versão feita no servidor: da principal, na largura certa, sem metadado nenhum.
const modVersoes = await tenta(() => import("../lib/rede/publicar/versoes-servidor.ts"));
ok("a versão menor é feita no servidor (lib/rede/publicar/versoes-servidor.ts)", modVersoes.ok, modVersoes.e);
if (modVersoes.ok) {
  const { versoesDaPrincipal } = modVersoes.v;
  const sharp = (await import("sharp")).default;
  const comGps = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "Fulana de Tal", Artist: "Fulana" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 33/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" } })
    .toBuffer();
  ok("a imagem de prova tem EXIF com GPS (base)", comGps.includes(Buffer.from("Exif")) && comGps.includes(Buffer.from("Fulana")));
  const vs = await versoesDaPrincipal(new Uint8Array(comGps), "image/jpeg", 1600);
  ok("saem as versões 640 e 1080 de uma principal de 1600", vs.map((v) => v.largura).join() === "640,1080", JSON.stringify(vs.map((v) => v.largura)));
  for (const v of vs) {
    const m = await sharp(Buffer.from(v.bytes)).metadata();
    const b = Buffer.from(v.bytes);
    ok(`a versão ${v.largura}: largura certa, mesma proporção, JPEG`, m.width === v.largura && Math.abs(m.height - Math.round((v.largura * 1200) / 1600)) <= 1 && m.format === "jpeg");
    ok(`a versão ${v.largura}: sem EXIF, sem GPS, sem nome`, !m.exif && !b.includes(Buffer.from("Exif")) && !b.includes(Buffer.from("Fulana")));
  }
  ok("principal pequena não ganha versão", (await versoesDaPrincipal(new Uint8Array(await sharp({ create: { width: 600, height: 400, channels: 3, background: "#fff" } }).png().toBuffer()), "image/png", 600)).length === 0);
  ok("o que não é imagem não vira versão", (await versoesDaPrincipal(new Uint8Array([1, 2, 3, 4]), "image/jpeg", 1600)).length === 0);
}

// ═══════════════════ 2. O story conferido ═══════════════════
{
  const cam = `${P.m1}/${randomUUID().replace(/-/g, "")}.jpg`;
  const r0 = await subir(A("m1"), "rede-stories", cam);
  ok("m1 sobe a foto do story (base: o envio direto do story continua)", r0.ok, r0.e);
  const s = (await um("insert into interno.rede_stories (autor, fundo, midia_caminho, conferido) values ($1, 'imagem', $2, true) returning id", [P.m1, cam])).id;
  ok("m2 (que segue m1) abre o story conferido (base)", await ve(A("m2"), "rede-stories", cam));
  const fora = await apagar(A("m1"), "rede-stories", cam);
  const troca = await subir(A("m1"), "rede-stories", cam);
  const c = (await um("select conferido from interno.rede_stories where id = $1", [s])).conferido;
  ok("ATAQUE: m1 apaga a foto do story conferido e sobe outra no mesmo caminho — recusado", !troca.ok, `apagar ${fora.ok}, conferido ${c}`);
  ok("e m2 não recebe arquivo trocado", !(await ve(A("m2"), "rede-stories", cam)));
  const menor = `${P.m1}/${randomUUID().replace(/-/g, "")}.jpg`;
  await dono("update interno.rede_stories set midia_menor = $2 where id = $1", [s, menor]);
  const trocaMenor = await subir(A("m1"), "rede-stories", menor);
  ok("ATAQUE: o mesmo com o caminho da versão menor do story — recusado", !trocaMenor.ok);
  const nova = `${P.m1}/${randomUUID().replace(/-/g, "")}.jpg`;
  const r1 = await subir(A("m1"), "rede-stories", nova);
  ok("um caminho novo continua aceito (trocar a foto do story vai por rede_story_trocar_midia, que volta o conferido)", r1.ok, r1.e);
  const peloServidor = await tenta(() => como(SERVICO, () => pg.query("update storage.objects set metadata = metadata where bucket_id = 'rede-stories' and name = $1", [nova])));
  ok("a conferência do servidor regrava o arquivo (chave de serviço)", peloServidor.ok, peloServidor.e);
}

// ═══════════════════ 3. O modo só leitura e o perfil da rede ═══════════════════
{
  const lig = await tenta(() => rpc(A("coord"), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }));
  ok("a coordenação liga o modo só leitura", lig.ok, lig.e);
  const antes = await um("select rede_codinome, rede_handle, rede_bio from interno.perfis where id = $1", [P.m1]);
  for (const [f, args] of [
    ["rede_codinome_definir", { p_codinome: "Nome Trocado Na Crise" }],
    ["rede_perfil_handle_definir", { p_handle: "trocado_na_crise" }],
    ["rede_perfil_editar", { p: { bio: "Bio trocada durante a emergência" } }],
  ]) {
    const r = await tenta(() => rpc(A("m1"), f, args));
    ok(`ATAQUE: com o modo ligado, a conta comum chama ${f} — recusado com alumia_so_leitura`, !r.ok && /alumia_so_leitura/.test(r.e), r.e ?? JSON.stringify(r.v).slice(0, 160));
  }
  const depois = await um("select rede_codinome, rede_handle, rede_bio from interno.perfis where id = $1", [P.m1]);
  ok("o nome, o @ e a bio da rede ficaram como estavam", JSON.stringify(antes) === JSON.stringify(depois), `${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);
  const trava = await tenta(() => como(A("m1"), () => pg.query("select 1")));
  ok("(sessão de pé)", trava.ok);
  const coord = await tenta(() => rpc(A("coord"), "rede_codinome_definir", { p_codinome: "Codinome da Coordenacao" }));
  ok("a coordenação com o segundo fator passa (para moderar e desligar)", coord.ok || !/alumia_so_leitura/.test(coord.e ?? ""), coord.e);
  const ferias = await tenta(() => rpc(A("med"), "ferias_marcar", { p_de: null, p_ate: null }));
  ok("o que não é perfil da rede (as férias do painel) continua, mesmo na tabela de perfis", ferias.ok, ferias.e);
  await dono("update interno.perfis set rede_bio = 'Bio de antes' where id = $1", [P.m2]);
  const sair = await tenta(() => rpc(A("m2"), "rede_perfil_editar", { p: { bio: "" } }));
  const bio = (await um("select rede_bio from interno.perfis where id = $1", [P.m2])).rede_bio;
  ok("tirar (pôr vazio) não é trocar: continua", sair.ok && (bio ?? "") === "", `${sair.e ?? ""} bio=${bio}`);
  await rpc(A("coord"), "alumia_modo_so_leitura", { p_ligar: false, p_motivo: "Fim do teste da auditoria." });
  const deNovo = await tenta(() => rpc(A("m1"), "rede_codinome_definir", { p_codinome: "Codinome Novo Depois" }));
  ok("com o modo desligado, trocar o nome volta a valer", deNovo.ok || !/alumia_so_leitura/.test(deNovo.e ?? ""), deNovo.e);
}

// ═══════════════════ 4. Os educadores da Escola, sem lista de militantes ═══════════════════
{
  await dono("insert into interno.departamento_membros (usuario, departamento) values ($1, 'revolucionarios') on conflict do nothing", [P.mil]).catch(() => {});
  const l = await tenta(() => rpc(A("coord"), "alumia_escola_educadores"));
  ok("a coordenação lê os educadores", l.ok, l.e);
  ok("ATAQUE: a resposta não traz lista de militantes da Frente (candidatos)", l.ok && !("candidatos" in (l.v ?? {})) && !JSON.stringify(l.v).includes(P.mil), JSON.stringify(l.v).slice(0, 200));
  const achou = await tenta(() => rpc(A("coord"), "alumia_escola_educador_achar", { p_handle: "@h_m2_4" }));
  ok("a coordenação acha uma pessoa pelo @ exato (uma por vez)", achou.ok && achou.v?.id === P.m2 && /Codinome m2/.test(achou.v?.nome ?? ""), achou.e ?? JSON.stringify(achou.v));
  ok("a busca não diz se a pessoa está na Frente", achou.ok && Object.keys(achou.v).sort().join() === "educador,id,nome");
  const quase = await tenta(() => rpc(A("coord"), "alumia_escola_educador_achar", { p_handle: "h_m2" }));
  ok("pedaço de @ não acha ninguém", !quase.ok && /nao_encontrado/.test(quase.e), quase.e);
  for (const [quem, aal, cod] of [["m1", "aal2", "sem_permissao"], ["coord", "aal1", "confirme_segundo_fator"], ["med", "aal2", "sem_permissao"]]) {
    const r = await tenta(() => rpc(A(quem, aal), "alumia_escola_educador_achar", { p_handle: "h_m2_4" }));
    ok(`${quem} (${aal}) não usa a busca`, !r.ok && r.e.includes(cod), r.e);
  }
  const dar = await tenta(() => rpc(A("coord"), "alumia_escola_educador", { p_usuario: P.m2, p_dar: true, p_motivo: "Dá aula de história na Escola." }));
  ok("e dá o lugar de educador com o id achado", dar.ok, dar.e);
  const tela = ler("components/painel/alumia/admin/Emergencia.tsx");
  ok("a tela não mostra lista de militantes; acha pelo @", !/candidatos/.test(tela) && /alumia_escola_educador_achar/.test(tela));
}

// ═══════════════════ 5. Os erros da tela ═══════════════════
{
  const limpo = async (t) => (await um("select interno.alumia_p5_texto_limpo($1) r", [t])).r;
  const end = async (t) => (await um("select interno.alumia_p5_endereco_limpo($1) r", [t])).r;
  const msgs = [
    ["CPF 123.456.789-09 inválido", /123\.456|789/],
    ["Token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMifQ.c2lnbmF0dXJh expirou", /eyJ|c2lnbmF0/],
    ["Cannot read properties of undefined (reading 'Maria da Silva')", /Maria/],
    ["Unexpected token “Joana Souza”", /Joana/],
    ['falhou "Fulano Beltrano"', /Fulano/],
    ["ip 198.51.100.23 bloqueado", /198\.51/],
    ["ipv6 2001:db8:85a3::8a2e:370:7334 caiu", /2001:db8|7334/],
    [`chave da sessão ${["sk", "live", "ABCdefGHIjklMNOpqr"].join("_")}`, /sk_live|ABCdef/],  // montada na hora: não parece chave para o gitleaks
    ["base64 dGhpcyBpcyBhIHNlY3JldCB0b2tlbjEyMw== no corpo", /dGhpcyBp/],
    ["telefone (11) 98765-4321", /98765|4321/],
    ["e-mail fulano@exemplo.org falhou", /fulano/],
  ];
  for (const [t, ruim] of msgs) {
    const r = await limpo(t);
    ok(`ATAQUE: texto_limpo("${t}") não guarda o dado → "${r}"`, !ruim.test(r));
  }
  for (const [t, bom] of [
    ["Cannot read properties of undefined (reading 'map')", "(reading 'map')"],
    ["ChunkLoadError: Loading chunk 4521 failed.", "ChunkLoadError: Loading chunk :x failed."],
    ["TypeError: Failed to fetch", "TypeError: Failed to fetch"],
  ]) {
    const r = await limpo(t);
    ok(`o erro útil continua legível: "${t}" → "${r}"`, r.includes(bom));
  }
  for (const [t, ruim, esperado] of [
    ["/alumia/perfil/fulana", /fulana/],
    ["/pt/alumia/comunidades/sem-teto-zona-sul", /sem-teto/, "/pt/alumia/comunidades/:x"],
    ["/alumia/conversas/abc123def", /abc123/],
    ["/alumia/buscar/joao%20silva", /joao/],
    ["/alumia/pacote/ocupacao-da-rua-tal", /ocupacao/, "/alumia/pacote/:x"],
    ["/alumia/qualquer-nome-de-pessoa", /qualquer/, "/alumia/:x"],
    ["/pt/alumia/@fulana", /fulana/, "/pt/alumia/:x"],
    ["https://x.org/pt/alumia/u/fulana?x=1#y", /fulana/, "/pt/alumia/u/:x"],
    ["/c/sala-de-luta/sobre", /sala/, "/c/:x"],
    ["/pt/alumia", null, "/pt/alumia"],
    ["/pt/alumia/explorar", null, "/pt/alumia/explorar"],
  ]) {
    const r = await end(t);
    ok(`ATAQUE: endereco_limpo("${t}") → "${r}"`, (!ruim || !ruim.test(r)) && (!esperado || r === esperado));
  }
  // O aparelho limpa igual ao banco.
  const todos = [...msgs.map((m) => m[0]), "Cannot read properties of undefined (reading 'map')", "ChunkLoadError: Loading chunk 4521 failed.", "TypeError: x (fulana@exemplo.org) https://a.b/c?d=1 @fulana 123e4567-e89b-42d3-a456-426614174000 21987654321"];
  const dif = [];
  for (const t of todos) if (mensagemLimpa(t) !== (await limpo(t))) dif.push(`"${mensagemLimpa(t)}" x "${await limpo(t)}"`);
  ok("a mensagem limpa no aparelho é a mesma do banco", dif.length === 0, dif.join("; "));
  const dif2 = [];
  for (const t of ["/alumia/perfil/fulana", "/pt/alumia/comunidades/sem-teto", "/alumia/pacote/x", "/pt/alumia/@fulana", "https://x.org/pt/alumia/u/fulana?x=1#y", "/pt/alumia", "/pt/alumia/", "/c/a/b", "/en/alumia/explorar"])
    if (telaLimpa(t) !== (await end(t))) dif2.push(`${t}: "${telaLimpa(t)}" x "${await end(t)}"`);
  ok("o endereço limpo no aparelho é o mesmo do banco", dif2.length === 0, dif2.join("; "));

  // A enxurrada: um visitante, de muitas origens, manda lixo diferente a cada vez.
  await dono("delete from interno.alumia_erros_tela");
  const visto = await tenta(() => rpc({ papel: "anon", ip: "198.51.100.200" }, "erro_tela_registrar", { p: { mensagem: "TypeError: o erro que se repete", pagina: "/pt/alumia", versao: "1", navegador: "chrome" } }));
  ok("um erro de verdade entra (base)", visto.ok, visto.e);
  await rpc({ papel: "anon", ip: "198.51.100.201" }, "erro_tela_registrar", { p: { mensagem: "TypeError: o erro que se repete", pagina: "/pt/alumia", versao: "1", navegador: "chrome" } });
  for (let k = 0; k < 2100; k++) {
    await tenta(() => rpc({ papel: "anon", ip: `198.51.${100 + Math.floor(k / 250)}.${k % 250}` }, "erro_tela_registrar", { p: { mensagem: `lixo ${"abc".repeat(k % 7)} ${k.toString(36)}x`, pagina: `/alumia/explorar`, versao: "1", navegador: "chrome" } }));
  }
  const n = (await um("select count(*)::int n from interno.alumia_erros_tela where dia = current_date")).n;
  ok("o teto do dia continua (no máximo 2000 linhas)", n <= 2000, String(n));
  const novo = await tenta(() => rpc({ papel: "anon", ip: "203.0.113.77" }, "erro_tela_registrar", { p: { mensagem: "TypeError: o erro novo de verdade", pagina: "/pt/alumia", versao: "1", navegador: "firefox" } }));
  const guardado = (await um("select count(*)::int n from interno.alumia_erros_tela where mensagem like '%erro novo de verdade%'")).n;
  ok("ATAQUE: depois da enxurrada, o erro de verdade que chega ainda é guardado", novo.ok && guardado === 1, `${novo.e ?? ""} guardado=${guardado}`);
  const repete = (await um("select coalesce(sum(vezes), 0)::int n from interno.alumia_erros_tela where mensagem like '%erro que se repete%'")).n;
  ok("o erro que se repetiu não foi tirado pela enxurrada", repete === 2, String(repete));
}

// ═══════════════════ 6. As funções do painel e o visitante ═══════════════════
{
  const g = (await dono(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('contribuicao_editar', 'territorio_parceiro_definir', 'ferias_marcar') and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((x) => x.f);
  ok("ATAQUE: nenhuma das funções do painel tem execução para visitante", g.length === 0, g.join(", "));
  const visitante = await tenta(() => rpc(ANON, "ferias_marcar", { p_ate: null }));
  ok("o visitante que chama ferias_marcar é barrado já na permissão", !visitante.ok && /permission denied/.test(visitante.e), visitante.e);
  for (const f of ["contribuicao_editar(uuid,jsonb)", "territorio_parceiro_definir(uuid,text,boolean)", "ferias_marcar(date,date)", "ferias_marcar(date)"]) {
    const r = await um(`select has_function_privilege('authenticated', 'public.${f}'::regprocedure, 'execute') a`);
    ok(`a conta continua chamando ${f}`, r.a === true);
  }
  const longe = await tenta(() => rpc(A("med"), "ferias_marcar", { p_ate: new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10) }));
  ok("ferias_marcar(date) segue a regra nova (até 120 dias)", !longe.ok && /invalido:ate/.test(longe.e), longe.e);
  await dono("update interno.perfis set ferias_proxima_de = current_date + 10, ferias_proxima_ate = current_date + 20 where id = $1", [P.med]);
  const curta = await tenta(() => rpc(A("med"), "ferias_marcar", { p_ate: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) }));
  const f = await um("select ferias_ate, ferias_proxima_de from interno.perfis where id = $1", [P.med]);
  ok("ATAQUE: a assinatura velha não deixa as férias marcadas antes penduradas (é a nova, com começo e fim)", curta.ok && f.ferias_ate && f.ferias_proxima_de === null, `${curta.e ?? ""} ${JSON.stringify(f)}`);
  await rpc(A("med"), "ferias_marcar", { p_de: null, p_ate: null });
}

// ═══════════════════ 7. O resumo das pendências e a sessão da própria pessoa ═══════════════════
{
  // A conta prova a sessão com que painel_resumo roda: uma função de teste no lugar de uma linha que só a sessão com o segundo
  // fator contaria.
  const def = (await um("select pg_get_functiondef('interno.pendencias_linhas(uuid)'::regprocedure) d")).d;
  ok("o resumo não inventa o segundo fator para a sessão da própria pessoa", /if auth\.uid\(\) is not distinct from p_usuario then/.test(def), def.slice(0, 200));
  await dono("alter function public.painel_resumo() rename to painel_resumo_teste_original");
  await dono(`create function public.painel_resumo() returns jsonb language sql stable as $$
    select jsonb_build_object('fila', case when coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal' = 'aal2' then 7 else 0 end) $$`);
  const aal1 = await tenta(() => rpc(A("coord", "aal1"), "pendencias_email_ver"));
  ok("ATAQUE: a sessão sem o segundo fator não vê, na prévia, o que só a sessão com ele contaria", aal1.ok && aal1.v.previa === null, aal1.e ?? JSON.stringify(aal1.v?.previa));
  const aal2 = await tenta(() => rpc(A("coord"), "pendencias_email_ver"));
  ok("com o segundo fator, a prévia mostra as contagens", aal2.ok && aal2.v.previa?.total === 7, aal2.e ?? JSON.stringify(aal2.v?.previa));
  const rotina = await tenta(() => dono("select interno.pendencias_montar($1) r", [P.coord]));
  ok("a rotina do e-mail (sem sessão) continua montando o resumo", rotina.ok && rotina.v.rows[0].r?.total === 7, rotina.e);
  const claims = await um("select current_setting('request.jwt.claims', true) c");
  ok("e devolve a sessão como estava", (claims.c ?? "") === "");
  await dono("drop function public.painel_resumo()");
  await dono("alter function public.painel_resumo_teste_original() rename to painel_resumo");
}

// ═══════════════════ A porta ═══════════════════
{
  const t = await um("select interno.alumia_trancar() r");
  ok("a porta não deixa nenhuma função aberta", t.r.abertas.length === 0, JSON.stringify(t.r.abertas));
}

console.log(`\nP5 · consertos da auditoria: ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
