// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, lote ação coletiva (Parte F: itens 89 a 100 e 122 a 126), atrás de "alumia-p4-coletiva":
//   · banco (supabase/migracoes/20261127-p4-coletiva.sql por cima do install.sql, duas vezes): cada item com as regras de privacidade
//     dele (nenhuma lista de pessoas, nenhum número abaixo de 3, nenhum IP, nenhum texto de post para terceiros);
//   · as regras puras do aparelho e do servidor (lib/rede/coletiva/*.ts): radar, modelos de documento, panfleto, tempo, Pix;
//   · as ligações (flag, rota, registro, painel, textos nos seis idiomas).
// Uso: npm run testar:p4-coletiva
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

const SQL = normal(ler("supabase/migracoes/20261127-p4-coletiva.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

// ═══ 0. A migração, por fora ═══
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("cabeçalho com licença, \"Pode rodar mais de uma vez\", a ordem da junção e a lei",
  SQL.startsWith("-- Instituto Lúcia") && SQL.includes("Pode rodar mais de uma vez") && SQL.includes("Roda depois de 20261126-p5-fim.sql (banco na versão 17)")
  && SQL.includes("quem junta põe antes do\n-- 20261127-p4-fim.sql") && /Lei: LGPD art\./.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(/i.test(semComentario));
ok("a migração não mexe na versão nem no install", !/rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("o interruptor entra no catálogo protegido por to_regclass", /if to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-coletiva', true\)/.test(SQL));
ok("nenhum Math.random nem random() decide segurança no banco", !/\brandom\(\)/.test(semComentario.replace(/order by random\(\)/g, "")));
{
  const publicas = [...semComentario.matchAll(/create or replace function public\.(\w+)\([^)]*\)[^$]*?\$\$\s*(declare[\s\S]*?)?begin\s+([^;]+);/g)];
  // As do "mandei" da pressão (item 89) são só da chave de serviço: começam conferindo o serviço, não a porta.
  const semPorta = publicas.filter((m) => !m[3].includes("interno.alumia_porta()") && !/^if not interno\.servico\(\) then perform interno\.erro\('sem_permissao'\)$/.test(m[3].trim())).map((m) => m[1]);
  ok(`toda função pública começa pela porta, ou pela chave de serviço (${semPorta.join(", ")})`, semPorta.length === 0 && publicas.length >= 4);
  const novas = [...semComentario.matchAll(/create or replace function (public|interno)\.(\w+)\(/g)].map((m) => m[2]);
  ok(`nenhuma função fora dos prefixos do lote (${novas.filter((n) => !/^rede_p4_(ac|press|carta|quest|ato|ciranda|pouso|filiac|pix|org_|frente|vitrine|rodizio)/.test(n)).join(", ")})`,
    novas.every((n) => /^rede_p4_(ac|press|carta|quest|ato|ciranda|pouso|filiac|pix|org_|frente|vitrine|rodizio)/.test(n)));
}

// ═══ 1. Antes da migração: nada disso existia ═══
{
  const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
  const n = (await banco.dono("select count(*)::int n from pg_proc where proname like 'rede_p4_ac\\_%' or proname like 'rede_p4_pressao%'")).rows[0].n;
  ok(`antes: nenhuma função do lote (${n})`, n === 0);
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const install = normal(ler("supabase/install.sql"));
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
const TABELAS = (await dono("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname like 'rede\\_p4\\_%' and c.relname = any($1)",
  [[...SQL.matchAll(/create table if not exists interno\.(\w+)/g)].map((m) => m[1])])).rows.map((r) => r.relname);
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const t = (await dono(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname = any($1)`, [TABELAS])).rows;
  ok(`as tabelas novas têm RLS ligada (${t.length})`, t.length === [...SQL.matchAll(/create table if not exists interno\./g)].length && t.every((x) => x.relrowsecurity));
  const pol = (await dono("select count(*)::int n from pg_policies where schemaname = 'interno' and tablename = any($1)", [TABELAS])).rows[0].n;
  ok("nenhuma política nas tabelas (só as funções)", pol === 0);
  const cols = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)`, [TABELAS])).rows;
  ok("nenhuma coluna de endereço de rede", !cols.some((c) => c.data_type === "inet" || /(^|_)ip($|_)|origem|endereco_rede/.test(c.column_name)));
  const cat = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-coletiva'")).rows[0];
  ok("o interruptor está no catálogo, só pelo nome", cat?.so_pelo_nome === true);
  const vivo = (await dono("select ligado from interno.recursos_vivos where nome = 'alumia-p4-coletiva'")).rows[0];
  ok("e começa desligado (sem decisão no painel)", vivo === undefined || vivo.ligado === false);
  const anon = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname like 'rede\\_p4\\_%' and p.proname ~ '^rede_p4_(ac|press|carta|quest|ato|ciranda|pouso|filiac|pix|org_|frente|vitrine|rodizio)'
                               and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((x) => x.proname);
  ok(`visitante não chama nenhuma função do lote (${anon.join(", ")})`, anon.length === 0);
  const internas = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'interno' and p.proname ~ '^rede_p4_(ac|press|carta|quest|ato|ciranda|pouso|filiac|pix|org_|frente|vitrine|rodizio)'
                                   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.proname);
  ok(`as ajudantes internas não abrem para ninguém (${internas.join(", ")})`, internas.length === 0);
}

const P = {};
const NOMES = ["ana", "bia", "cris", "duda", "eva", "fabi", "gil", "org", "org2", "org3"];
for (const [i, nome] of NOMES.entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-coletiva.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('luta-moradia', 'Luta por moradia', 'disciplinas', 'aberta', 'internet'), ('roda-fechada', 'Roda fechada', 'lutas', 'fechada', 'comunidade') on conflict do nothing`);
// ana modera as duas; bia, cris, eva e fabi são membros da aberta; bia também da fechada; duda é membro da Alumia, mas de nenhuma.
for (const [slug, quem, papel] of [["luta-moradia", "ana", "moderacao"], ["luta-moradia", "bia", "membro"], ["luta-moradia", "cris", "membro"], ["luta-moradia", "eva", "membro"],
  ["luta-moradia", "fabi", "membro"], ["roda-fechada", "ana", "moderacao"], ["roda-fechada", "bia", "membro"]]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ($1, $2, $3, 'ativo') on conflict do nothing", [slug, P[quem], papel]);
}
// As organizações: Lume (com selo, gerida por gil), Brasa (sem selo, gerida por gil) e Raiz (com selo, gerida por fabi).
await dono("update interno.perfis set rede_handle = 'lume', rede_codinome = 'Coletivo Lume' where id = $1", [P.org]);
await dono("update interno.perfis set rede_handle = 'brasa', rede_codinome = 'Coletivo Brasa' where id = $1", [P.org2]);
await dono("update interno.perfis set rede_handle = 'raiz', rede_codinome = 'Sindicato Raiz' where id = $1", [P.org3]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'coletivo', 'São Paulo', 'LUME', 'CNPJ', now())", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'coletivo', 'Recife', 'BRASA')", [P.org2]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'sindicato', 'Recife', 'RAIZ', 'CNPJ', now())", [P.org3]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono'), ($3, $2, 'dono'), ($4, $5, 'dono')", [P.org, P.gil, P.org2, P.org3, P.fabi]);

const como = (quem, funcao, args = {}) => rpc({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" }, funcao, args);
const chamar = async (quem, funcao, args) => {
  await dono("delete from interno.limites");
  return como(quem, funcao, args);
};
// Nenhuma resposta traz o id de pessoa nenhuma (só o das organizações, que são públicas), nem codinome ou @ de pessoa.
const PESSOAS = Object.entries(P).filter(([k]) => !k.startsWith("org"));
const semPessoas = (r) => { const s = JSON.stringify(r) ?? ""; return !PESSOAS.some(([k, id]) => s.includes(id) || s.includes(`pessoa_${k}`)) && !/Pessoa \d/.test(s); };

// ── Desligado: tudo recusa ──
await recusa("desligado: as minhas comunidades recusam", () => chamar("bia", "rede_p4_ac_minhas", {}), "desligado");
await recusa("desligado: as pressões recusam", () => chamar("bia", "rede_p4_pressoes", { p_comunidade: "luta-moradia" }), "desligado");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-coletiva', true) on conflict (nome) do update set ligado = true");

{
  const daBia = await passa("as comunidades e organizações da bia", () => chamar("bia", "rede_p4_ac_minhas", {}));
  ok(`a bia vê as duas comunidades dela, sem moderar, e nenhuma organização (${JSON.stringify(daBia)})`,
    daBia?.comunidades?.length === 2 && daBia.comunidades.every((c) => c.modero === false && Object.keys(c).sort().join() === "modero,nome,slug") && daBia.orgs.length === 0);
  const doGil = await chamar("gil", "rede_p4_ac_minhas", {});
  ok("o gil vê as duas organizações que gere, com o selo de cada uma", doGil?.orgs?.length === 2 && doGil.orgs.find((o) => o.handle === "lume")?.selo === true && doGil.orgs.find((o) => o.handle === "brasa")?.selo === false);
  ok("as organizações saem sem quem gere", semPessoas(doGil?.orgs));
}

// ═══ 89. Pressão em parlamentar ═══
// O "mandei" vai pelo servidor do site (app/api/alumia/voto/marca, tipos "pressao" e "pressao_ver"), como o "pouco útil" do item 132
// depois da auditoria (M1): o servidor confere a sessão, calcula a marca (HMAC com ALUMIA_VOTO_SEGREDO, que nunca vai ao banco) e
// chama o banco com a chave de serviço. O teste chama a rota de verdade, com um dublê do serviço de contas e do PostgREST que repassa
// ao banco local.
const servico = (funcao, args = {}) => rpc({ papel: "service_role", ip: "127.0.0.1" }, funcao, args);
const SEGREDO_DO_VOTO = "segredo-do-voto-para-o-teste-da-coletiva-0123456789";
{
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contas.duble";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anonima-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-de-teste";
  process.env.ALUMIA_VOTO_SEGREDO = SEGREDO_DO_VOTO;
  const doServico = [];
  const fetchAntes = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const cab = new Headers(init.headers);
    if (u.endsWith("/auth/v1/user")) {
      const quem = /^Bearer tok-([0-9a-f-]{36})$/.exec(cab.get("authorization") ?? "")?.[1];
      return quem ? Response.json({ id: quem, email_confirmed_at: "2026-01-01" }) : Response.json({ message: "sem" }, { status: 401 });
    }
    const m = /\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(u);
    if (m && cab.get("authorization") === "Bearer chave-de-servico-de-teste") {
      const args = JSON.parse(String(init.body || "{}"));
      doServico.push({ funcao: m[1], args });
      await dono("delete from interno.limites");
      try {
        return Response.json(await servico(m[1], args));
      } catch (e) {
        return Response.json({ message: e.message }, { status: 400 });
      }
    }
    return Response.json({ message: "sem dublê" }, { status: 404 });
  };
  try {
    const rota = await import("../app/api/alumia/voto/marca/route.ts");
    const { marcaDoVoto } = await import("../lib/rede/voto/servidor.ts");
    const pedido = (quem, corpo) => new Request("https://alumia.duble/api/alumia/voto/marca", {
      method: "POST", headers: { "Content-Type": "application/json", ...(quem ? { Authorization: `Bearer tok-${P[quem]}` } : {}) }, body: JSON.stringify(corpo),
    });
    const pelaRota = async (quem, corpo) => {
      const d = await (await rota.POST(pedido(quem, corpo))).json();
      if (!d?.ok) throw new Error(String(d?.motivo));
      return d.dado;
    };
    const mandei = (quem, id, sim) => pelaRota(quem, { tipo: "pressao", pressao: id, sim });
    const minhas = (quem, ids) => pelaRota(quem, { tipo: "pressao_ver", pressoes: ids });

    const PR = {
      comunidade: "luta-moradia", alvo: "Deputada Fulana de Tal", cargo: "Deputada federal", assunto: "Vote contra o PL dos despejos",
      mensagem: "Excelentíssima deputada, pedimos que vote contra o projeto que facilita despejos sem alternativa de moradia.",
      contatos: [{ tipo: "email", valor: "dep.fulana@camara.leg.br" }, { tipo: "telefone", valor: "(61) 3215-5000" }, { tipo: "site", valor: "https://www.camara.leg.br/deputados/0000" }],
    };
    await recusa("89: quem não modera não cria", () => chamar("bia", "rede_p4_pressao_criar", { p: PR }), "sem_permissao");
    await recusa("89: e-mail fora de domínio oficial é recusado", () => chamar("ana", "rede_p4_pressao_criar", { p: { ...PR, contatos: [{ tipo: "email", valor: "fulana@gmail.com" }] } }), "invalido:contato");
    await recusa("89: celular é recusado (contato oficial é o do gabinete)", () => chamar("ana", "rede_p4_pressao_criar", { p: { ...PR, contatos: [{ tipo: "telefone", valor: "(61) 99999-8888" }] } }), "invalido:contato");
    await recusa("89: site fora de domínio oficial é recusado", () => chamar("ana", "rede_p4_pressao_criar", { p: { ...PR, contatos: [{ tipo: "site", valor: "https://instagram.com/fulana" }] } }), "invalido:contato");
    await recusa("89: sem contato, não", () => chamar("ana", "rede_p4_pressao_criar", { p: { ...PR, contatos: [] } }), "invalido:contato");
    await recusa("89: mensagem com telefone de pessoa é recusada", () => chamar("ana", "rede_p4_pressao_criar", { p: { ...PR, mensagem: PR.mensagem + " Fale com a Maria: (11) 98888-7777." } }), "dado_pessoal");
    const criada = await passa("89: a mediação cria a pressão", () => chamar("ana", "rede_p4_pressao_criar", { p: PR }));
    const X = criada?.pressoes?.[0];
    ok("89: os contatos saem limpos (telefone só com números, e-mail em minúsculas)", X?.contatos?.[1]?.valor === "6132155000" && X?.contatos?.[0]?.valor === "dep.fulana@camara.leg.br");
    ok(`89: começa sem total (nada abaixo de 3), e a lista do banco não diz quem mandou (${JSON.stringify(Object.keys(X ?? {}))})`, X?.total === null && !("eu_mandei" in (X ?? {})));
    await recusa("89: sem sessão, não", () => pelaRota(null, { tipo: "pressao", pressao: X?.id, sim: true }), "entre_primeiro");
    for (const quem of ["bia", "cris"]) {
      const r = await passa(`89: ${quem} marca "mandei"`, () => mandei(quem, X?.id, true));
      ok(`89: o "mandei" devolve só a marca da própria pessoa e a comunidade (${JSON.stringify(r)})`, r?.eu === true && r?.comunidade === "luta-moradia" && Object.keys(r).sort().join() === "comunidade,eu");
    }
    await passa("89: marcar de novo não conta duas vezes", () => mandei("bia", X?.id, true));
    {
      const r = await chamar("duda", "rede_p4_pressoes", { p_comunidade: "luta-moradia" });
      ok("89: com 2, o total continua escondido (nem a mediação vê)", r?.pressoes?.[0]?.total === null && (await chamar("ana", "rede_p4_pressoes", { p_comunidade: "luta-moradia" }))?.pressoes?.[0]?.total === null);
    }
    await passa("89: duda (da Alumia, comunidade aberta) também manda", () => mandei("duda", X?.id, true));
    {
      const r = await chamar("eva", "rede_p4_pressoes", { p_comunidade: "luta-moradia" });
      ok("89: com 3, o total aparece", r?.pressoes?.[0]?.total === 3);
      ok("89: quem não mandou não tem marca", JSON.stringify(await minhas("eva", [X?.id]).catch((e) => e.message)) === "[]");
      ok("89: quem mandou vê só a própria marca", JSON.stringify(await minhas("bia", [X?.id]).catch((e) => e.message)) === JSON.stringify([X?.id]));
      ok("89: nenhuma resposta diz quem mandou", semPessoas(r) && !/marca|sal|eu_mandei/.test(JSON.stringify(r)));
    }
    await recusa("89: pressão que não existe não recebe marca", () => mandei("duda", "00000000-0000-4000-8000-000000000000", true), "nao_encontrado");
    {
      const marcas = (await dono("select encode(marca, 'hex') m from interno.rede_p4_pressao_marcas where pressao = $1", [X?.id])).rows.map((r) => r.m);
      ok("89: o banco guarda marcas, não contas", marcas.length === 3 && !marcas.some((m) => Object.values(P).some((id) => m.includes(id.replace(/-/g, "")))));
      const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_pressao_marcas' order by ordinal_position")).rows.map((r) => r.column_name).join();
      ok("89: a tabela das marcas não tem coluna de conta", cols === "pressao,marca");
      ok("89: a marca é o HMAC do servidor do site (o segredo dele, que o banco não tem)", ["bia", "cris", "duda"].every((q) => marcas.includes(marcaDoVoto(SEGREDO_DO_VOTO, "pressao", X?.id, P[q]))));
      ok("89: o servidor manda ao banco só a conta (para conferir as regras), a pressão, o sim e a marca",
        doServico.some((c) => c.funcao === "rede_p4_pressao_mandei") && doServico.filter((c) => c.funcao === "rede_p4_pressao_mandei").every((c) => Object.keys(c.args).sort().join() === "p_id,p_marca,p_sim,p_usuario"));
      // Auditoria do P4 (como o M1 do "pouco útil"): quem tem o banco inteiro (SQL Editor, chave de serviço ou um vazamento) não pode
      // descobrir quem mandou enquanto a pressão está aberta. Antes, a marca era sha256(sal ‖ conta) com o sal na linha da pressão, e
      // esta consulta devolvia as contas.
      const temSal = (await dono("select count(*)::int n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_pressoes' and column_name = 'sal'")).rows[0].n > 0;
      const temFuncao = (await dono("select to_regprocedure('interno.rede_p4_pressao_marca(bytea, uuid)') is not null as f")).rows[0].f;
      let achados = [];
      if (temSal && temFuncao) {
        achados = (await dono(`select f.rede_handle from interno.perfis f, interno.rede_p4_pressoes x where x.id = $1
                                 and exists (select 1 from interno.rede_p4_pressao_marcas m where m.pressao = x.id and m.marca = interno.rede_p4_pressao_marca(x.sal, f.id)) order by 1`, [X?.id])).rows.map((x) => x.rede_handle);
      }
      ok(`89 (ataque do dono do banco): recalcular a marca de cada conta não acha quem mandou (${achados.join(", ")})`, achados.length === 0 && !temSal && !temFuncao);
      const sem = (await dono(`select count(*)::int n from interno.perfis f, interno.rede_p4_pressao_marcas m
                                where m.pressao = $1 and (m.marca = sha256(convert_to($1::text || ':' || f.id::text, 'UTF8')) or m.marca = sha256(convert_to(f.id::text, 'UTF8')))`, [X?.id])).rows[0].n;
      ok("89 (ataque do dono do banco): sem o segredo, o sha256 da pressão e da conta não bate com marca nenhuma", sem === 0);
      const abertas = (await dono(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
                                     and p.proname in ('rede_p4_pressao_mandei', 'rede_p4_pressao_minhas')
                                     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.f);
      ok(`89: nem visitante nem conta chamam o "mandei" direto, só a chave de serviço (${abertas.join(", ")})`, abertas.length === 0);
      await recusa("89: uma conta não grava marca inventada (encher o total) chamando o banco direto",
        () => chamar("eva", "rede_p4_pressao_mandei", { p_usuario: P.eva, p_id: X?.id, p_sim: true, p_marca: "ab".repeat(32) }), "");
    }
    await passa("89: desfazer desconta", () => mandei("duda", X?.id, false));
    ok("89: com 2 de novo, o total some", (await chamar("eva", "rede_p4_pressoes", { p_comunidade: "luta-moradia" }))?.pressoes?.[0]?.total === null);
    await passa("89: duda marca de novo", () => mandei("duda", X?.id, true));
    await dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-p4-coletiva'");
    await recusa("89: com o lote desligado, não se marca", () => mandei("eva", X?.id, true), "desligado");
    ok("89: com o lote desligado, 'as minhas' vem vazio", JSON.stringify(await minhas("bia", [X?.id]).catch((e) => e.message)) === "[]");
    await dono("update interno.recursos_vivos set ligado = true where nome = 'alumia-p4-coletiva'");
    await recusa("89: quem não modera não encerra", () => chamar("bia", "rede_p4_pressao_encerrar", { p_id: X?.id }), "nao_encontrado");
    await passa("89: a mediação encerra", () => chamar("ana", "rede_p4_pressao_encerrar", { p_id: X?.id }));
    {
      const n = (await dono("select count(*)::int n from interno.rede_p4_pressao_marcas where pressao = $1", [X?.id])).rows[0].n;
      ok("89: ao encerrar, as marcas somem e o total fica", n === 0 && (await chamar("eva", "rede_p4_pressoes", { p_comunidade: "luta-moradia" }))?.pressoes?.[0]?.total === 3);
      ok("89: encerrada, ninguém aparece como 'mandei'", JSON.stringify(await minhas("bia", [X?.id]).catch((e) => e.message)) === "[]");
    }
    await recusa("89: encerrada não recebe mais marca", () => mandei("eva", X?.id, true), "encerrada");
    await recusa("89: a fechada não abre para quem é de fora", () => chamar("cris", "rede_p4_pressoes", { p_comunidade: "roda-fechada" }), "nao_encontrado");
  } finally {
    globalThis.fetch = fetchAntes;
  }
}
// O aparelho: o cliente junta a lista do banco com "as minhas" do servidor, e o "mandei" e "as minhas" passam pela rota do voto.
{
  const vc = ler("lib/rede/voto/cliente.ts");
  ok("89: o aparelho manda o 'mandei' e 'as minhas' pelo servidor do site", /rede_p4_pressao_mandei: \(a: Record<string, unknown>\) =>\s+votoPeloServidor\(\{ tipo: "pressao"/.test(vc) && /rede_p4_pressao_minhas: \(a: Record<string, unknown>\) =>\s+votoPeloServidor\(\{ tipo: "pressao_ver"/.test(vc));
  const { criarClienteDaColetiva, dubleDaColetiva } = await import("../lib/rede/coletiva/cliente.ts");
  const cli = criarClienteDaColetiva(dubleDaColetiva());
  const antes = await cli.pressoes("luta-moradia");
  const depois = await cli.mandei(antes.pressoes[0].id, true);
  ok("89: no dublê da prévia, o 'mandei' marca e a lista volta com a marca da pessoa", antes.pressoes[0].eu_mandei === false && depois.pressoes[0].eu_mandei === true && depois.pressoes[0].total === 13);
}

// ═══ 92. Campanha de cartas de solidariedade ═══
{
  const CA = { comunidade: "luta-moradia", para: "Rafael, preso na ocupação", situacao: "presa", sobre: "Preso durante a reintegração.", entrega: "Na visita de domingo, pela defesa." };
  await recusa("92: quem não modera não abre a campanha", () => chamar("bia", "rede_p4_carta_campanha", { p: CA }), "sem_permissao");
  await recusa("92: situação inventada, não", () => chamar("ana", "rede_p4_carta_campanha", { p: { ...CA, situacao: "sumida" } }), "invalido:situacao");
  await recusa("92: endereço na entrega, não", () => chamar("ana", "rede_p4_carta_campanha", { p: { ...CA, entrega: "Rua das Flores, 123, Centro" } }), "dado_pessoal");
  const r = await passa("92: a mediação abre a campanha", () => chamar("ana", "rede_p4_carta_campanha", { p: CA }));
  const C = r?.campanhas?.[0];
  ok("92: começa sem total e sem fila", C?.aprovadas === null && C?.fila?.length === 0);
  const carta = "Rafael, a luta não para. Estamos com você e com a sua família, todo dia.";
  await recusa("92: quem não é da comunidade não escreve (duda, da Alumia)", () => chamar("duda", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: carta } }), "sem_permissao");
  await recusa("92: carta curta, não", () => chamar("bia", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: "Força!" } }), "invalido:texto");
  await recusa("92: carta com telefone, não", () => chamar("bia", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: carta + " Me liga: (11) 98888-7777." } }), "dado_pessoal");
  await passa("92: bia escreve assinando com o codinome", () => chamar("bia", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: carta, assinar: true } }));
  await passa("92: cris escreve sem assinar", () => chamar("cris", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: carta.replace("todo dia", "sempre") } }));
  await passa("92: eva escreve sem assinar", () => chamar("eva", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: carta.replace("todo dia", "até o fim") } }));
  {
    const daBia = await chamar("bia", "rede_p4_cartas", { p_comunidade: "luta-moradia" });
    ok("92: quem escreveu vê só a própria carta, pendente, com a assinatura escolhida", daBia?.campanhas?.[0]?.minhas?.length === 1 && daBia.campanhas[0].minhas[0].estado === "pendente"
      && daBia.campanhas[0].minhas[0].assinatura === "Pessoa 2" && daBia.campanhas[0].fila.length === 0);
    const mod = await chamar("ana", "rede_p4_cartas", { p_comunidade: "luta-moradia" });
    const fila = mod?.campanhas?.[0]?.fila ?? [];
    ok("92: a mediação vê a fila com as três, só texto e assinatura", fila.length === 3 && fila.every((k) => Object.keys(k).sort().join() === "assinatura,id,texto"));
    ok("92: a fila não diz quem escreveu (a não ser o codinome que a própria pessoa escolheu assinar)",
      !PESSOAS.some(([, id]) => JSON.stringify(mod).includes(id)) && fila.filter((k) => k.assinatura !== "").length === 1);
    for (const k of fila) await passa("92: a mediação aprova", () => chamar("ana", "rede_p4_carta_decidir", { p_id: k.id, p_aprovar: true }));
  }
  {
    const vista = await chamar("fabi", "rede_p4_cartas", { p_comunidade: "luta-moradia" });
    ok("92: com 3 aprovadas, o total aparece para a comunidade", vista?.campanhas?.[0]?.aprovadas === 3 && semPessoas(vista));
    const ent = await passa("92: a mediação baixa a entrega", () => chamar("ana", "rede_p4_carta_entrega", { p_campanha: C?.id }));
    ok("92: a entrega tem as três, sem quem escreveu", ent?.cartas?.length === 3 && ent.para === CA.para && !PESSOAS.some(([, id]) => JSON.stringify(ent).includes(id)));
    await recusa("92: quem não modera não baixa a entrega", () => chamar("bia", "rede_p4_carta_entrega", { p_campanha: C?.id }), "nao_encontrado");
  }
  {
    const minha = (await chamar("cris", "rede_p4_cartas", { p_comunidade: "luta-moradia" }))?.campanhas?.[0]?.minhas?.[0];
    await passa("92: quem escreveu apaga a própria carta", () => chamar("cris", "rede_p4_carta_apagar", { p_id: minha?.id }));
    ok("92: com 2 aprovadas, o total some", (await chamar("fabi", "rede_p4_cartas", { p_comunidade: "luta-moradia" }))?.campanhas?.[0]?.aprovadas === null);
    await recusa("92: ninguém apaga a carta de outra pessoa", async () => {
      const daBia = (await chamar("bia", "rede_p4_cartas", { p_comunidade: "luta-moradia" }))?.campanhas?.[0]?.minhas?.[0];
      return chamar("eva", "rede_p4_carta_apagar", { p_id: daBia?.id });
    }, "nao_encontrado");
  }
  await passa("92: a mediação encerra", () => chamar("ana", "rede_p4_carta_encerrar", { p_campanha: C?.id, p_apagar: false }));
  await recusa("92: encerrada, ninguém escreve", () => chamar("fabi", "rede_p4_carta_escrever", { p: { campanha: C?.id, texto: carta } }), "encerrada");
  await passa("92: a mediação apaga a campanha", () => chamar("ana", "rede_p4_carta_encerrar", { p_campanha: C?.id, p_apagar: true }));
  ok("92: apagada a campanha, as cartas somem", (await dono("select count(*)::int n from interno.rede_p4_cartas")).rows[0].n === 0);
}

// ═══ 93. Questionário da base ═══
{
  const QU = {
    comunidade: "luta-moradia", titulo: "Como está o bairro", sobre: "Para a assembleia de março.",
    perguntas: [
      { tipo: "escolha", texto: "Você mora de aluguel?", opcoes: ["Sim", "Não"] },
      { tipo: "varias", texto: "O que mais falta?", opcoes: ["Água", "Luz", "Transporte"] },
      { tipo: "escala", texto: "De 1 a 5, quanto o aluguel pesa?" },
      { tipo: "aberta", texto: "O que a gente devia fazer?" },
    ],
  };
  await recusa("93: quem não modera não cria", () => chamar("bia", "rede_p4_quest_criar", { p: QU }), "sem_permissao");
  await recusa("93: tipo de pergunta inventado, não", () => chamar("ana", "rede_p4_quest_criar", { p: { ...QU, perguntas: [{ tipo: "nota", texto: "Uma nota?" }] } }), "invalido:perguntas");
  await recusa("93: escolha com uma opção só, não", () => chamar("ana", "rede_p4_quest_criar", { p: { ...QU, perguntas: [{ tipo: "escolha", texto: "Sim?", opcoes: ["Sim"] }] } }), "invalido:opcoes");
  const r = await passa("93: a mediação cria", () => chamar("ana", "rede_p4_quest_criar", { p: QU }));
  const Q = r?.questionarios?.[0];
  ok("93: as perguntas saem como a mediação mandou", Q?.perguntas?.length === 4 && Q.perguntas[2].opcoes.length === 0 && Q.relatorio === null);
  await recusa("93: quem não é da comunidade não responde", () => chamar("duda", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [0, [0], 3, ""] }), "sem_permissao");
  await recusa("93: opção que não existe, não", () => chamar("bia", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [5, [0], 3, ""] }), "invalido:respostas");
  await recusa("93: escala fora de 1 a 5, não", () => chamar("bia", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [0, [0], 9, ""] }), "invalido:respostas");
  ok("93: a resposta recusada não deixou rastro (nem a marca de quem respondeu)", (await dono("select count(*)::int n from interno.rede_p4_quest_responderam")).rows[0].n === 0);
  await passa("93: bia responde", () => chamar("bia", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [0, [0, 2], 5, "Fazer um mutirão de cadastro."] }));
  await recusa("93: bia não responde duas vezes", () => chamar("bia", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [1, [], 1, ""] }), "ja_respondeu");
  await passa("93: cris responde (pula a aberta)", () => chamar("cris", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [0, [0], 4, null] }));
  {
    const vista = await chamar("ana", "rede_p4_questionarios", { p_comunidade: "luta-moradia" });
    ok("93: com 2 respostas, nem a mediação vê relatório", vista?.questionarios?.[0]?.relatorio === null);
  }
  await passa("93: eva responde", () => chamar("eva", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [0, [1], 5, "Ir à prefeitura."] }));
  {
    const vista = await chamar("fabi", "rede_p4_questionarios", { p_comunidade: "luta-moradia" });
    const rel = vista?.questionarios?.[0]?.relatorio;
    ok("93: com 3, o relatório sai somado para a comunidade", rel?.respostas === 3 && rel.perguntas[0].opcoes[0].total === 3 && rel.perguntas[0].opcoes[1].total === null);
    ok("93: contagem abaixo de 3 sai nula (água 2, luz 1, transporte 1)", rel?.perguntas?.[1]?.opcoes?.map((o) => o.total).join() === ",,");
    ok("93: a escala também (o 5 tem 2: nulo)", rel?.perguntas?.[2]?.escala?.every((e) => e.total === null));
    ok("93: quem não modera não lê as abertas", rel?.perguntas?.[3]?.abertas === null && rel.perguntas[3].abertas_total === null);
    ok("93: nada diz quem respondeu", semPessoas(vista) && vista.questionarios[0].ja_respondi === false);
    const mod = await chamar("ana", "rede_p4_questionarios", { p_comunidade: "luta-moradia" });
    const ab = mod?.questionarios?.[0]?.relatorio?.perguntas?.[3]?.abertas;
    ok("93: a mediação lê as abertas, só o texto", Array.isArray(ab) && ab.length === 2 && ab.every((t) => typeof t === "string") && semPessoas(mod));
    ok("93: quem respondeu vê só que já respondeu", (await chamar("bia", "rede_p4_questionarios", { p_comunidade: "luta-moradia" }))?.questionarios?.[0]?.ja_respondi === true);
  }
  {
    const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_quest_respostas' order by ordinal_position")).rows.map((x) => x.column_name).join();
    ok("93: as respostas não guardam conta nem hora", cols === "id,questionario,pergunta,opcao,valor,texto");
    const cols2 = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_quest_responderam' order by ordinal_position")).rows.map((x) => x.column_name).join();
    ok("93: quem respondeu não guarda hora nem ligação com as respostas", cols2 === "questionario,quem");
  }
  await passa("93: a mediação encerra", () => chamar("ana", "rede_p4_quest_encerrar", { p_id: Q?.id, p_apagar: false }));
  await recusa("93: encerrado, ninguém responde", () => chamar("fabi", "rede_p4_quest_responder", { p_id: Q?.id, p_respostas: [0, [0], 3, ""] }), "encerrado");
}

// ═══ 122. Rodízio de tarefas ═══
{
  const hoje = (await dono("select current_date::text d")).rows[0].d;
  const RO = { comunidade: "luta-moradia", tarefa: "Limpeza da sede", sobre: "Sábado de manhã.", frequencia: "semanal", comeca: hoje };
  await recusa("122: quem não modera não cria", () => chamar("bia", "rede_p4_rodizio_criar", { p: RO }), "sem_permissao");
  await recusa("122: frequência inventada, não", () => chamar("ana", "rede_p4_rodizio_criar", { p: { ...RO, frequencia: "diaria" } }), "invalido:frequencia");
  await recusa("122: começo no passado, não", () => chamar("ana", "rede_p4_rodizio_criar", { p: { ...RO, comeca: "2020-01-01" } }), "invalido:data");
  const r = await passa("122: a mediação cria", () => chamar("ana", "rede_p4_rodizio_criar", { p: RO }));
  const R = r?.rodizios?.[0];
  ok("122: começa vazio, sem número de pessoas", R?.pessoas === null && R?.tem_gente === false && R?.minhas_vezes?.length === 0);
  await recusa("122: quem não é da comunidade não entra", () => chamar("duda", "rede_p4_rodizio_entrar", { p_id: R?.id, p_sim: true }), "sem_permissao");
  for (const quem of ["bia", "cris", "eva"]) await passa(`122: ${quem} entra`, () => chamar(quem, "rede_p4_rodizio_entrar", { p_id: R?.id, p_sim: true }));
  const datas = {};
  for (const quem of ["bia", "cris", "eva"]) datas[quem] = (await chamar(quem, "rede_p4_rodizios", { p_comunidade: "luta-moradia" }))?.rodizios?.[0]?.minhas_vezes ?? [];
  ok("122: cada uma recebe três datas, de 3 em 3 semanas", Object.values(datas).every((d) => d.length === 3 && (new Date(d[1]) - new Date(d[0])) === 21 * 86400e3));
  ok("122: as vezes não se repetem entre as pessoas", new Set(Object.values(datas).flat()).size === 9);
  ok("122: a primeira vez é de quem entrou primeiro (hoje é a da bia)", datas.bia?.[0] === hoje);
  {
    const mod = await chamar("ana", "rede_p4_rodizios", { p_comunidade: "luta-moradia" });
    ok("122: a mediação vê só quantas (3) e se tem gente, nunca a escala com nomes", mod?.rodizios?.[0]?.pessoas === 3 && mod.rodizios[0].tem_gente === true
      && mod.rodizios[0].minhas_vezes.length === 0 && semPessoas(mod));
    ok("122: nenhuma resposta traz as datas de outra pessoa", !JSON.stringify(mod).includes(datas.cris?.[0]));
  }
  await passa("122: cris sai", () => chamar("cris", "rede_p4_rodizio_entrar", { p_id: R?.id, p_sim: false }));
  {
    const v = (await chamar("fabi", "rede_p4_rodizios", { p_comunidade: "luta-moradia" }))?.rodizios?.[0];
    ok("122: com 2, o número some", v?.pessoas === null && v.tem_gente === true);
    const daEva = (await chamar("eva", "rede_p4_rodizios", { p_comunidade: "luta-moradia" }))?.rodizios?.[0]?.minhas_vezes ?? [];
    ok("122: a escala se refaz (agora de 2 em 2 semanas)", daEva.length === 3 && (new Date(daEva[1]) - new Date(daEva[0])) === 14 * 86400e3);
  }
  {
    const m = await passa("122: rodízio mensal também gira", () => chamar("ana", "rede_p4_rodizio_criar", { p: { ...RO, tarefa: "Ata da assembleia", frequencia: "mensal" } }));
    const id = m?.rodizios?.find((x) => x.frequencia === "mensal")?.id;
    await chamar("bia", "rede_p4_rodizio_entrar", { p_id: id, p_sim: true });
    const d = (await chamar("bia", "rede_p4_rodizios", { p_comunidade: "luta-moradia" }))?.rodizios?.find((x) => x.id === id)?.minhas_vezes ?? [];
    const esperadas = (await dono("select array[current_date, (current_date + interval '1 month')::date, (current_date + interval '2 months')::date]::text[] d")).rows[0].d;
    ok(`122: sozinha no mensal, a bia tem as três próximas, de mês em mês (${d.join()})`, d.join() === esperadas.join());
  }
  await passa("122: a mediação encerra", () => chamar("ana", "rede_p4_rodizio_encerrar", { p_id: R?.id, p_apagar: false }));
  ok("122: encerrado, ninguém fica guardado nele", (await dono("select count(*)::int n from interno.rede_p4_rodizio_pessoas where rodizio = $1", [R?.id])).rows[0].n === 0);
  await recusa("122: encerrado, ninguém entra", () => chamar("bia", "rede_p4_rodizio_entrar", { p_id: R?.id, p_sim: true }), "encerrado");
}

// ═══ 95. Selos de acessibilidade do ato ═══
const daqui = (horas) => new Date(Date.now() + horas * 3_600_000).toISOString();
const ATO = (await passa("o ato do teste (a ana chama na comunidade aberta)", () => chamar("ana", "rede_ato_publicar", { p: {
  titulo: "Fica Esperança", inicio: daqui(72), onde: "Praça da Sé", cidade: "São Paulo", descricao: "Vigília na porta da ocupação.", comunidade: "luta-moradia", publico: "internet",
} })))?.id;
const ATO_FECHADO = (await passa("um ato da comunidade fechada", () => chamar("ana", "rede_ato_publicar", { p: {
  titulo: "Roda fechada", inicio: daqui(48), onde: "Sede do coletivo", cidade: "Recife", descricao: "Encontro da roda.", comunidade: "roda-fechada", publico: "comunidade",
} })))?.id;
{
  const f = await passa("95: a ficha do ato para quem pode ver", () => chamar("duda", "rede_p4_ato", { p_ato: ATO }));
  ok("95: a ficha traz título, data, cidade e ponto, sem o texto do post e sem selos", f?.titulo === "Fica Esperança" && f.cidade === "São Paulo" && f.ponto === "Praça da Sé"
    && f.selos.length === 0 && f.organizo === false && !JSON.stringify(f).includes("Vigília"));
  await recusa("95: o ato da fechada não abre para quem é de fora", () => chamar("cris", "rede_p4_ato", { p_ato: ATO_FECHADO }), "nao_encontrado");
  await recusa("95: quem não organiza não marca selos", () => chamar("bia", "rede_p4_ato_selos", { p_ato: ATO, p_selos: ["libras"] }), "so_quem_organizou");
  await recusa("95: selo inventado, não", () => chamar("ana", "rede_p4_ato_selos", { p_ato: ATO, p_selos: ["rampa-magica"] }), "invalido:selos");
  const s = await passa("95: quem organiza marca cadeira, Libras e sombra", () => chamar("ana", "rede_p4_ato_selos", { p_ato: ATO, p_selos: ["sombra", "cadeira", "libras", "libras"] }));
  ok("95: os selos saem sem repetir, em ordem", JSON.stringify(s?.selos) === JSON.stringify(["cadeira", "libras", "sombra"]) && s.organizo === true);
  ok("95: quem vê o ato vê os selos", JSON.stringify((await chamar("duda", "rede_p4_ato", { p_ato: ATO }))?.selos) === JSON.stringify(["cadeira", "libras", "sombra"]));
  const meus = await passa("95: os atos que eu organizo", () => chamar("ana", "rede_p4_ato_meus", {}));
  ok("95: a ana organiza os dois; a duda, nenhum", meus?.length === 2 && JSON.stringify(await chamar("duda", "rede_p4_ato_meus", {})) === "[]");
  ok("95: a ficha não diz quem organiza nem quem confirmou", semPessoas(await chamar("duda", "rede_p4_ato", { p_ato: ATO })));
}

// ═══ 96. Ciranda no ato ou na reunião ═══
{
  await recusa("96: sem ciranda, não há o que reservar", () => chamar("bia", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 1 }), "sem_ciranda");
  await recusa("96: quem não organiza não abre", () => chamar("bia", "rede_p4_ciranda_abrir", { p_ato: ATO, p: { vagas: 8 } }), "so_quem_organizou");
  await recusa("96: vagas fora de 1 a 60, não", () => chamar("ana", "rede_p4_ciranda_abrir", { p_ato: ATO, p: { vagas: 0 } }), "invalido:vagas");
  await recusa("96: telefone em quem cuida, não", () => chamar("ana", "rede_p4_ciranda_abrir", { p_ato: ATO, p: { vagas: 8, cuidado: "Liga pra Rosa (11) 98888-7777" } }), "dado_pessoal");
  const a = await passa("96: quem organiza abre a ciranda com 8 vagas", () => chamar("ana", "rede_p4_ciranda_abrir", { p_ato: ATO, p: { vagas: 8, idades: "2 a 10 anos", cuidado: "Educadoras do coletivo" } }));
  ok("96: 8 sobram, nada reservado à vista (abaixo de 3)", a?.ciranda?.sobram === 8 && a.ciranda.reservadas === null && a.ciranda.lotada === false);
  await recusa("96: mais de 4 crianças numa reserva, não", () => chamar("bia", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 5 }), "invalido:criancas");
  await passa("96: bia reserva 2", () => chamar("bia", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 2 }));
  {
    const daAna = await chamar("ana", "rede_p4_ato", { p_ato: ATO });
    ok("96: com 2 reservadas, quem organiza ainda não vê o número", daAna?.ciranda?.reservadas === null && daAna.ciranda.sobram === 6);
  }
  await passa("96: cris reserva 4", () => chamar("cris", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 4 }));
  {
    const v = await chamar("duda", "rede_p4_ato", { p_ato: ATO });
    ok("96: sobram 2: \"poucas vagas\", sem o número", v?.ciranda?.sobram === null && v.ciranda.poucas === true && v.ciranda.minhas === 0);
    ok("96: quem organiza vê 6 reservadas", (await chamar("ana", "rede_p4_ato", { p_ato: ATO }))?.ciranda?.reservadas === 6);
    ok("96: a bia vê só as dela", (await chamar("bia", "rede_p4_ato", { p_ato: ATO }))?.ciranda?.minhas === 2);
    ok("96: nada diz quem reservou", semPessoas(await chamar("ana", "rede_p4_ato", { p_ato: ATO })));
  }
  await recusa("96: passar das vagas: lotada", () => chamar("eva", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 3 }), "lotada");
  await recusa("96: baixar as vagas abaixo do reservado, não", () => chamar("ana", "rede_p4_ciranda_abrir", { p_ato: ATO, p: { vagas: 5 } }), "invalido:vagas");
  await passa("96: eva reserva as 2 que sobram", () => chamar("eva", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 2 }));
  ok("96: lotada", (await chamar("duda", "rede_p4_ato", { p_ato: ATO }))?.ciranda?.lotada === true);
  await passa("96: bia cancela", () => chamar("bia", "rede_p4_ciranda_reservar", { p_ato: ATO, p_criancas: 0 }));
  ok("96: a reserva cancelada some do banco", (await dono("select count(*)::int n from interno.rede_p4_ciranda_reservas where quem = $1", [P.bia])).rows[0].n === 0);
  {
    const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_ciranda_reservas' order by ordinal_position")).rows.map((x) => x.column_name).join();
    ok("96: a reserva não guarda nome nem idade de criança", cols === "ato,quem,criancas");
  }
  await passa("96: quem organiza fecha a ciranda", () => chamar("ana", "rede_p4_ciranda_fechar", { p_ato: ATO }));
  ok("96: fechada, as reservas somem", (await dono("select count(*)::int n from interno.rede_p4_ciranda_reservas")).rows[0].n === 0);
}

// ═══ 100. Chave Pix oficial no perfil verificado ═══
{
  await recusa("100: quem não gere não define a chave", () => chamar("bia", "rede_p4_pix_definir", { p_handle: "lume", p_chave: "12.345.678/0001-90" }), "sem_permissao");
  await recusa("100: organização sem selo não tem chave oficial", () => chamar("gil", "rede_p4_pix_definir", { p_handle: "brasa", p_chave: "12.345.678/0001-90" }), "so_com_selo");
  await recusa("100: CPF de pessoa não é chave oficial", () => chamar("gil", "rede_p4_pix_definir", { p_handle: "lume", p_chave: "123.456.789-09" }), "dado_pessoal");
  await recusa("100: e-mail não é chave oficial", () => chamar("gil", "rede_p4_pix_definir", { p_handle: "lume", p_chave: "pix@lume.org" }), "dado_pessoal");
  const pg = await passa("100: quem gere a Lume (com selo) define a chave (CNPJ)", () => chamar("gil", "rede_p4_pix_definir", { p_handle: "lume", p_chave: "12.345.678/0001-90" }));
  ok("100: a página mostra a chave oficial, o selo e que eu giro", pg?.pix === "12.345.678/0001-90" && pg.selo === true && pg.gerencio === true);
  const vista = await passa("100: qualquer pessoa da Alumia vê a página", () => chamar("duda", "rede_p4_org_pagina", { p_handle: "lume" }));
  ok("100: a página não diz quem gere", vista?.pix === "12.345.678/0001-90" && vista.gerencio === false && semPessoas(vista));
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
  ok("100: sem o selo, a chave some da página (fica guardada)", (await chamar("duda", "rede_p4_org_pagina", { p_handle: "lume" }))?.pix === null);
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org]);
  const conferir = (quem, post) => chamar(quem, "rede_p4_pix_conferir", { p_post: post }).catch((e) => ({ erro: e.message }));
  const publicar = async (quem, texto) => (await chamar(quem, "rede_publicar", { p: { texto, comunidade: "luta-moradia", publico: "membros" } }))?.id;
  const falso = await passa("100: um post cita a @lume com outra chave", () => publicar("bia", "Ajude a greve do @lume! Pix: 98.765.432/0001-10"));
  const certo = await passa("100: outro cita a @lume com a chave oficial", () => publicar("cris", "Ajude a greve do @lume, Pix 12.345.678/0001-90"));
  const nome = await passa("100: outro cita o nome da organização com chave aleatória", () => publicar("eva", "O Coletivo Lume pede ajuda. Pix: 3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"));
  const semPix = await passa("100: outro cita a @lume sem falar em Pix", () => publicar("fabi", "Ato do @lume amanhã. CNPJ 98.765.432/0001-10 no site."));
  const r1 = await passa("100: confere o post com a chave errada", () => chamar("duda", "rede_p4_pix_conferir", { p_post: falso }));
  ok("100: avisa, com o @ e o nome da organização", r1?.alerta === true && r1.org?.handle === "lume" && r1.org?.nome === "Coletivo Lume");
  ok("100: o aviso não traz o texto do post nem a chave encontrada", !/98\.765|Ajude|greve/.test(JSON.stringify(r1)) && semPessoas(r1));
  ok("100: a chave oficial não avisa", (await conferir("duda", certo))?.alerta === false);
  ok("100: o nome da organização também vale", (await conferir("duda", nome))?.alerta === true);
  ok("100: sem falar em Pix, não avisa", (await conferir("duda", semPix))?.alerta === false);
  {
    const fechado = (await chamar("bia", "rede_publicar", { p: { texto: "Pix do @lume: 98.765.432/0001-10", comunidade: "roda-fechada", publico: "comunidade" } }))?.id;
    await recusa("100: quem não vê o post não confere", () => chamar("cris", "rede_p4_pix_conferir", { p_post: fechado }), "nao_encontrado");
  }
  await passa("100: vazio tira a chave", () => chamar("gil", "rede_p4_pix_definir", { p_handle: "lume", p_chave: "" }));
  ok("100: sem chave oficial, nada a conferir", (await conferir("duda", falso))?.alerta === false);
  await chamar("gil", "rede_p4_pix_definir", { p_handle: "lume", p_chave: "12.345.678/0001-90" });
}

// ═══ 124. Sala de imprensa da organização ═══
{
  ok("124: sem nada publicado, a sala é nula", (await chamar("duda", "rede_p4_org_pagina", { p_handle: "brasa" }))?.imprensa === null);
  await recusa("124: quem não gere não mexe", () => chamar("bia", "rede_p4_org_imprensa", { p_handle: "brasa", p: { email: "imprensa@brasa.org" } }), "sem_permissao");
  await recusa("124: cor que não é #rrggbb, não", () => chamar("gil", "rede_p4_org_imprensa", { p_handle: "brasa", p: { cores: ["vermelho"] } }), "invalido:cores");
  await recusa("124: e-mail torto, não", () => chamar("gil", "rede_p4_org_imprensa", { p_handle: "brasa", p: { email: "imprensa arroba brasa" } }), "invalido:email");
  const pg = await passa("124: quem gere salva o contato e o kit", () => chamar("gil", "rede_p4_org_imprensa", { p_handle: "brasa", p: {
    email: "Imprensa@Brasa.org", telefone: "(81) 3333-4444", sobre: "Coletivo de cultura do Recife.", cores: ["#C0392B", "#111111"], kit: "https://brasa.org/kit.zip" } }));
  ok("124: o contato sai limpo", pg?.imprensa?.email === "imprensa@brasa.org" && pg.imprensa.telefone === "8133334444" && pg.imprensa.cores.join() === "#c0392b,#111111");
  await recusa("124: release com CPF, não", () => chamar("gil", "rede_p4_org_release", { p_handle: "brasa", p: { titulo: "Nota", texto: "O companheiro de CPF 123.456.789-09 foi solto hoje." } }), "dado_pessoal");
  await recusa("124: release curto, não", () => chamar("gil", "rede_p4_org_release", { p_handle: "brasa", p: { titulo: "Nota", texto: "Curto." } }), "invalido:texto");
  const rel = await passa("124: quem gere publica o release", () => chamar("gil", "rede_p4_org_release", { p_handle: "brasa", p: { titulo: "Nota sobre a ocupação", texto: "O coletivo Brasa apoia a ocupação cultural do antigo cinema.", link: "https://brasa.org/nota" } }));
  ok("124: o release aparece na página", rel?.imprensa?.releases?.length === 1 && rel.imprensa.releases[0].link === "https://brasa.org/nota");
  ok("124: a página não diz quem gere nem quem escreveu", semPessoas(await chamar("duda", "rede_p4_org_pagina", { p_handle: "brasa" })));
  await recusa("124: quem não gere não tira o release", () => chamar("bia", "rede_p4_org_release_tirar", { p_id: rel?.imprensa?.releases?.[0]?.id }), "nao_encontrado");
  ok("124: quem gere tira", (await passa("124: tirar", () => chamar("gil", "rede_p4_org_release_tirar", { p_id: rel?.imprensa?.releases?.[0]?.id })))?.imprensa?.releases?.length === 0);
}

// ═══ 125. Vitrine da economia solidária ═══
{
  const IT = { nome: "Cooperativa Raiz Forte", sobre: "Hortaliças sem veneno.", categoria: "alimentos", cidade: "Recife", link: "https://raizforte.coop.br" };
  await recusa("125: organização sem selo não põe", () => chamar("gil", "rede_p4_vitrine_por", { p_handle: "brasa", p: IT }), "so_com_selo");
  await recusa("125: categoria inventada, não", () => chamar("fabi", "rede_p4_vitrine_por", { p_handle: "raiz", p: { ...IT, categoria: "cripto" } }), "invalido:categoria");
  await recusa("125: sem link, não", () => chamar("fabi", "rede_p4_vitrine_por", { p_handle: "raiz", p: { ...IT, link: "" } }), "invalido:link");
  await recusa("125: link sem https, não", () => chamar("fabi", "rede_p4_vitrine_por", { p_handle: "raiz", p: { ...IT, link: "http://raizforte.coop.br" } }), "invalido:link");
  const pg = await passa("125: a Raiz (com selo) põe a cooperativa", () => chamar("fabi", "rede_p4_vitrine_por", { p_handle: "raiz", p: IT }));
  ok("125: aparece na vitrine da organização", pg?.vitrine?.length === 1 && pg.vitrine[0].link === IT.link);
  await passa("125: e outro item, de artesanato", () => chamar("fabi", "rede_p4_vitrine_por", { p_handle: "raiz", p: { ...IT, nome: "Ateliê das Marias", categoria: "artesanato", cidade: "Olinda", link: "https://atelie.example.org" } }));
  const todos = await passa("125: a vitrine geral", () => chamar("duda", "rede_p4_vitrine", { p_categoria: "", p_cidade: "" }));
  ok("125: a geral junta os dois, com a organização (sem quem gere)", todos?.length === 2 && todos.every((x) => x.org?.handle === "raiz") && semPessoas(todos));
  ok("125: o filtro por categoria", (await chamar("duda", "rede_p4_vitrine", { p_categoria: "artesanato", p_cidade: "" }))?.length === 1);
  ok("125: o filtro por cidade (sem acento e sem caixa)", (await chamar("duda", "rede_p4_vitrine", { p_categoria: "", p_cidade: "RECIFE" }))?.length === 1);
  ok("125: nenhum preço, pagamento ou carrinho", !/preco|valor|pagar|carrinho|pix/i.test(JSON.stringify(Object.keys(todos?.[0] ?? {}))));
  await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org3]);
  ok("125: sem o selo, os itens somem", (await chamar("duda", "rede_p4_vitrine", { p_categoria: "", p_cidade: "" }))?.length === 0);
  await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org3]);
  await recusa("125: quem não gere não tira", () => chamar("bia", "rede_p4_vitrine_tirar", { p_id: todos?.[0]?.id }), "nao_encontrado");
  await passa("125: quem gere tira", () => chamar("fabi", "rede_p4_vitrine_tirar", { p_id: todos?.[0]?.id }));
}

// ═══ 126. Página de links da organização ═══
{
  await recusa("126: quem não gere não mexe", () => chamar("bia", "rede_p4_org_links", { p_handle: "lume", p_links: [] }), "sem_permissao");
  await recusa("126: link sem https, não", () => chamar("gil", "rede_p4_org_links", { p_handle: "lume", p_links: [{ titulo: "Site", url: "http://lume.org" }] }), "invalido:link");
  await recusa("126: link com usuário e senha, não", () => chamar("gil", "rede_p4_org_links", { p_handle: "lume", p_links: [{ titulo: "Site", url: "https://a:b@lume.org" }] }), "invalido:link");
  await recusa("126: mais de 20, não", () => chamar("gil", "rede_p4_org_links", { p_handle: "lume", p_links: Array.from({ length: 21 }, (_, i) => ({ titulo: `L${i}`, url: "https://lume.org" })) }), "invalido:links");
  const pg = await passa("126: quem gere monta a lista", () => chamar("gil", "rede_p4_org_links", { p_handle: "lume", p_links: [{ titulo: "Site", url: "https://lume.org" }, { titulo: "Campanha", url: "https://lume.org/campanha" }] }));
  ok("126: os links saem na ordem", pg?.links?.map((l) => l.titulo).join() === "Site,Campanha");
  ok("126: quem vê a página vê os links", (await chamar("duda", "rede_p4_org_pagina", { p_handle: "lume" }))?.links?.length === 2);
  ok("126: lista vazia tira todos", (await chamar("gil", "rede_p4_org_links", { p_handle: "lume", p_links: [] }))?.links?.length === 0);
  await chamar("gil", "rede_p4_org_links", { p_handle: "lume", p_links: [{ titulo: "Site", url: "https://lume.org" }] });
}

// ═══ 123. Frentes entre organizações ═══
{
  const ATO_LUME = (await passa("123: a Lume chama um ato", () => chamar("org", "rede_ato_publicar", { p: {
    titulo: "Frente pela moradia", inicio: daqui(96), onde: "Praça do Carmo", cidade: "Recife", descricao: "Ato da frente.", comunidade: "luta-moradia", publico: "internet",
  } })))?.id;
  await recusa("123: quem não gere não cria", () => chamar("bia", "rede_p4_frente_criar", { p: { org: "lume", slug: "frente-moradia", nome: "Frente pela Moradia" } }), "sem_permissao");
  await recusa("123: endereço torto, não", () => chamar("gil", "rede_p4_frente_criar", { p: { org: "lume", slug: "Frente Moradia!", nome: "Frente pela Moradia" } }), "invalido:slug");
  const f = await passa("123: o gil cria a frente pela Lume", () => chamar("gil", "rede_p4_frente_criar", { p: { org: "lume", slug: "frente-moradia", nome: "Frente pela Moradia", sobre: "Movimentos juntos." } }));
  const F = f?.id;
  ok("123: a Lume entra aceita", f?.orgs?.length === 1 && f.orgs[0].handle === "lume" && f.gerencio === true);
  ok("123: com uma organização só, a frente não aparece para os outros", (await chamar("duda", "rede_p4_frentes", {}))?.length === 0);
  await recusa("123: quem gere uma organização de fora não convida", () => chamar("fabi", "rede_p4_frente_convidar", { p_frente: F, p_org: "brasa" }), "sem_permissao");
  await passa("123: a Lume convida a Raiz", () => chamar("gil", "rede_p4_frente_convidar", { p_frente: F, p_org: "raiz" }));
  {
    const daFabi = await chamar("fabi", "rede_p4_frente", { p_slug: "frente-moradia" });
    ok("123: a Raiz vê o convite para responder; ainda não é da frente", daFabi?.para_responder?.[0]?.handle === "raiz" && daFabi.orgs.length === 1 && daFabi.gerencio === false);
    ok("123: quem é de fora não vê os convites", (await chamar("duda", "rede_p4_frente", { p_slug: "frente-moradia" }))?.convidadas?.length === 0);
  }
  await recusa("123: quem não gere a Raiz não aceita por ela", () => chamar("gil", "rede_p4_frente_responder", { p_frente: F, p_org: "raiz", p_aceitar: true }), "sem_permissao");
  await passa("123: a Raiz aceita", () => chamar("fabi", "rede_p4_frente_responder", { p_frente: F, p_org: "raiz", p_aceitar: true }));
  ok("123: com duas, a frente aparece para todos", (await chamar("duda", "rede_p4_frentes", {}))?.[0]?.orgs === 2);
  await recusa("123: a Raiz não põe ato que não organiza", () => chamar("fabi", "rede_p4_frente_ato", { p_frente: F, p_ato: ATO_LUME, p_por: true }), "so_quem_organizou");
  await recusa("123: quem é de fora não põe ato", () => chamar("ana", "rede_p4_frente_ato", { p_frente: F, p_ato: ATO, p_por: true }), "sem_permissao");
  const comAto = await passa("123: a Lume põe o ato dela", () => chamar("gil", "rede_p4_frente_ato", { p_frente: F, p_ato: ATO_LUME, p_por: true }));
  ok("123: o ato aparece na frente", comAto?.atos?.length === 1 && comAto.atos[0].titulo === "Frente pela moradia");
  const vista = await chamar("duda", "rede_p4_frente", { p_slug: "frente-moradia" });
  ok("123: a página mostra organizações e atos, nunca quem as gere", vista?.orgs?.length === 2 && vista.atos.length === 1 && semPessoas(vista) && !JSON.stringify(vista).includes(P.gil));
  await passa("123: a Raiz sai", () => chamar("fabi", "rede_p4_frente_responder", { p_frente: F, p_org: "raiz", p_aceitar: false }));
  const fim = await passa("123: a Lume sai: a frente acaba", () => chamar("gil", "rede_p4_frente_responder", { p_frente: F, p_org: "lume", p_aceitar: false }));
  ok("123: sem organização, a frente é apagada", fim?.apagada === true && (await dono("select count(*)::int n from interno.rede_p4_frentes")).rows[0].n === 0);
}

// ═══ 98. Pouso solidário ═══
{
  const dia = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  await recusa("98: organização sem selo não abre o pouso", () => chamar("gil", "rede_p4_pouso_abrir", { p_handle: "brasa", p_abrir: true, p_sobre: "" }), "so_com_selo");
  await recusa("98: sem pouso aberto, ninguém oferece", () => chamar("bia", "rede_p4_pouso_por", { p: { org: "lume", tipo: "oferta", cidade: "São Paulo", pessoas: 2, de: dia(10), ate: dia(12) } }), "nao_encontrado");
  await passa("98: a Lume abre o pouso", () => chamar("gil", "rede_p4_pouso_abrir", { p_handle: "lume", p_abrir: true, p_sobre: "Para o congresso de março." }));
  const OF = { org: "lume", tipo: "oferta", cidade: "São Paulo", pessoas: 2, de: dia(10), ate: dia(12), observacao: "Tenho um quarto e colchão." };
  await recusa("98: endereço na observação, não", () => chamar("bia", "rede_p4_pouso_por", { p: { ...OF, observacao: "Rua das Flores, 123, apto 4" } }), "dado_pessoal");
  await recusa("98: telefone na observação, não", () => chamar("bia", "rede_p4_pouso_por", { p: { ...OF, observacao: "Liga (11) 98888-7777" } }), "dado_pessoal");
  await recusa("98: data no passado, não", () => chamar("bia", "rede_p4_pouso_por", { p: { ...OF, de: "2020-01-01", ate: "2020-01-02" } }), "invalido:data");
  await recusa("98: mais de 30 dias, não", () => chamar("bia", "rede_p4_pouso_por", { p: { ...OF, ate: dia(60) } }), "invalido:data");
  await passa("98: bia oferece", () => chamar("bia", "rede_p4_pouso_por", { p: OF }));
  await passa("98: cris pede", () => chamar("cris", "rede_p4_pouso_por", { p: { ...OF, tipo: "pedido", pessoas: 1, observacao: "Venho de Recife para o congresso." } }));
  {
    const daDuda = await chamar("duda", "rede_p4_pouso", {});
    ok("98: quem não está nem gere vê só as organizações abertas", daDuda?.orgs?.length === 1 && daDuda.meus.length === 0 && daDuda.gestao.length === 0 && semPessoas(daDuda));
    const daBia = await chamar("bia", "rede_p4_pouso", {});
    ok("98: a bia vê só a oferta dela, sem o pedido da cris", daBia?.meus?.length === 1 && daBia.meus[0].tipo === "oferta" && !JSON.stringify(daBia).includes("Recife para"));
    const doGil = await chamar("gil", "rede_p4_pouso", {});
    const g = doGil?.gestao?.[0];
    ok("98: a gestão da Lume vê os dois lados, com codinome e @ para combinar", g?.ofertas?.length === 1 && g.pedidos.length === 1 && g.ofertas[0].handle === "pessoa_bia" && g.pedidos[0].codinome === "Pessoa 3");
    ok("98: nem a gestão recebe a conta (o id) de quem ofereceu", !JSON.stringify(doGil).includes(P.bia) && !JSON.stringify(doGil).includes(P.cris));
    ok("98: a gestão de outra organização não vê nada", (await chamar("fabi", "rede_p4_pouso", {}))?.gestao?.length === 0);
    await recusa("98: outra pessoa não mexe na oferta da bia", () => chamar("eva", "rede_p4_pouso_mudar", { p_id: g?.ofertas?.[0]?.id, p_acao: "tirar" }), "nao_encontrado");
    await recusa("98: quem ofereceu não marca combinado (é da gestão)", () => chamar("bia", "rede_p4_pouso_mudar", { p_id: g?.ofertas?.[0]?.id, p_acao: "combinado" }), "invalido:acao");
    const comb = await passa("98: a gestão marca combinado", () => chamar("gil", "rede_p4_pouso_mudar", { p_id: g?.pedidos?.[0]?.id, p_acao: "combinado" }));
    ok("98: o pedido fica combinado", comb?.gestao?.[0]?.pedidos?.[0]?.estado === "combinado");
    await passa("98: a bia tira a oferta dela", () => chamar("bia", "rede_p4_pouso_mudar", { p_id: g?.ofertas?.[0]?.id, p_acao: "tirar" }));
  }
  await dono("update interno.rede_p4_pouso set de = current_date - 20, ate = current_date - 10");
  {
    // A rotina diária do pg_cron (da junção): apaga o pouso vencido e a ficha de filiação vencida, com as mesmas regras das faxinas.
    // O PGlite não tem pg_cron: confere o comando agendado e que cada parte dele é SQL válido neste banco.
    const rotina = /cron\.schedule\('alumia-p4-coletiva-faxina', '[^']+',\s*'([^']+)'\)/.exec(ler("supabase/migracoes/20261127-p4-coletiva.sql"))?.[1] ?? "";
    ok("98 e 99: a rotina diária apaga o pouso que acabou há mais de 7 dias e a ficha vencida",
      /delete from interno\.rede_p4_pouso where ate < current_date - 7/.test(rotina) && /delete from interno\.rede_p4_filiacoes where apagar_em < current_date/.test(rotina));
    let validas = rotina.length > 0;
    for (const parte of rotina.split(";").map((x) => x.trim()).filter(Boolean)) {
      try { await dono(`explain ${parte}`); } catch { validas = false; }
    }
    ok("98 e 99: cada parte da rotina é SQL válido no banco montado", validas);
  }
  ok("98: a faxina tira o que acabou há mais de 7 dias", (await rpc({ papel: "service_role", ip: "198.51.100.11" }, "rede_p4_pouso_faxina", {})) === 1);
  await recusa("98: a faxina não é de quem tem conta", () => como("bia", "rede_p4_pouso_faxina", {}), "permission denied");
  await passa("98: a Lume fecha o pouso", () => chamar("gil", "rede_p4_pouso_abrir", { p_handle: "lume", p_abrir: false, p_sobre: "" }));
  ok("98: fechado, nada fica", (await dono("select count(*)::int n from interno.rede_p4_pouso")).rows[0].n === 0);
}

// ═══ 99. Ficha de filiação cifrada ═══
{
  const { ed25519 } = await import("@noble/curves/ed25519.js");
  const S = await import("../lib/rede/seguranca-pessoal/selo.ts");
  const F = await import("../lib/rede/coletiva/filiacao.ts");
  // A identidade (Ed25519) e a chave de segurança (X-Wing) do gil, que gere a Lume: de verdade, como o aparelho faria.
  const idPriv = ed25519.utils.randomSecretKey();
  const idPub = ed25519.getPublicKey(idPriv);
  const par = await S.novaChaveDeSeguranca();
  const r = (n) => crypto.getRandomValues(new Uint8Array(n));
  await dono("insert into interno.diretorio_contas (usuario, identidade, pedidos_xwing, pedidos_assinatura, pedidos_caixa, pedidos_pd) values ($1, $2, $3, $4, $5, $6) on conflict do nothing",
    [P.gil, idPub, r(1216), r(64), r(32), r(32)]);
  await dono("insert into interno.rede_p4_seg_chaves (usuario, publica, assinatura) values ($1, $2, $3) on conflict (usuario) do update set publica = excluded.publica, assinatura = excluded.assinatura",
    [P.gil, par.publica, ed25519.sign(S.textoDaChave(P.gil, par.publica), idPriv)]);

  ok("99: a construção é a da segurança pessoal, com rótulo próprio", S.ROTULOS.filiacao === "alumia/p4/seguranca/filiacao/v1" && new Set(Object.values(S.ROTULOS)).size === Object.values(S.ROTULOS).length);
  ok("99: a ficha sem nome não vale", F.fichaLimpa({ cidade: "Recife" }) === null);
  ok("99: a ficha só leva os campos conhecidos", JSON.stringify(Object.keys(F.fichaLimpa({ nome: "Maria", cpf: "123", cidade: " Recife " }))) === JSON.stringify(["nome", "cidade"]));
  ok("99: toda ficha vai com o mesmo tamanho", F.fichaEmBytes({ nome: "Ana" }).length === F.fichaEmBytes({ nome: "Ana".repeat(30), observacao: "x".repeat(900) }).length);
  ok("99: o CSV não deixa fórmula passar", F.fichasEmCsv([{ dia: "2026-11-20", ficha: { nome: "=HYPERLINK(1)" } }]).includes(`"'=HYPERLINK(1)"`));

  await recusa("99: organização sem selo não abre filiação", () => chamar("gil", "rede_p4_filiacao_abrir", { p_handle: "brasa", p_abrir: true, p_sobre: "" }), "so_com_selo");
  await recusa("99: fechada, não há para quem cifrar", () => chamar("bia", "rede_p4_filiacao_destinos", { p_handle: "lume" }), "nao_encontrado");
  await passa("99: a Lume abre a filiação", () => chamar("gil", "rede_p4_filiacao_abrir", { p_handle: "lume", p_abrir: true, p_sobre: "Nome e cidade bastam." }));
  ok("99: a Lume aparece pronta (a gestão tem chave), sem quem gere", JSON.stringify((await chamar("duda", "rede_p4_filiacao_orgs", {}))?.orgs?.map((o) => o.handle)) === '["lume"]');
  const destinos = await passa("99: as chaves para cifrar", () => chamar("bia", "rede_p4_filiacao_destinos", { p_handle: "lume" }));
  ok("99: só a chave de quem gere, sem nome nem @", destinos?.length === 1 && Object.keys(destinos[0]).sort().join() === "assinatura,conta,identidade,publica" && !/Pessoa|pessoa_/.test(JSON.stringify(destinos)));
  const ficha = { nome: "Maria da Silva", cidade: "São Paulo", contato: "Pelo chat da Alumia" };
  const pronta = await passa("99: o aparelho da bia monta e cifra", () => F.prepararFiliacao("lume", destinos, ficha));
  ok("99: o pedido não leva o texto da ficha nem o recibo", pronta && !JSON.stringify(pronta.pedido).includes("Maria") && !JSON.stringify(pronta.pedido).includes(pronta.recibo));
  {
    const trocado = destinos ? [{ ...destinos[0], publica: S.paraBase64(r(1216)) }] : [];
    await recusa("99: chave que não confere com a identidade: não cifra", () => F.prepararFiliacao("lume", trocado, ficha), "sem_destino");
  }
  await passa("99: a bia manda", () => chamar("bia", "rede_p4_filiacao_enviar", { p: pronta?.pedido }));
  await recusa("99: o mesmo id duas vezes, não", () => chamar("bia", "rede_p4_filiacao_enviar", { p: pronta?.pedido }), "invalido:id");
  await recusa("99: embrulho para quem não gere, não", async () => {
    const outra = await F.prepararFiliacao("lume", destinos, ficha);
    outra.pedido.embrulhos[0].conta = P.eva;
    return chamar("cris", "rede_p4_filiacao_enviar", { p: outra.pedido });
  }, "invalido:embrulhos");
  {
    const cols = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_filiacoes' order by ordinal_position")).rows.map((x) => x.column_name).join();
    ok("99: a ficha guardada não tem quem mandou nem a hora", cols === "id,org,cifra,recibo,criado_dia,apagar_em");
    const guardada = (await dono("select encode(cifra, 'escape') c from interno.rede_p4_filiacoes")).rows.map((x) => x.c).join();
    ok("99: o banco não tem o texto da ficha", guardada.length > 0 && !guardada.includes("Maria") && !guardada.includes("Paulo"));
  }
  await recusa("99: quem não gere não lê as fichas", () => chamar("bia", "rede_p4_filiacoes", { p_handle: "lume" }), "sem_permissao");
  const fichas = await passa("99: o gil lê as fichas (cifradas)", () => chamar("gil", "rede_p4_filiacoes", { p_handle: "lume" }));
  ok("99: as fichas vêm sem quem mandou", fichas?.length === 1 && semPessoas(fichas) && !JSON.stringify(fichas).includes(P.bia));
  const aberta = fichas?.[0] ? await F.abrirFiliacao(fichas[0].id, P.gil, par.privada, fichas[0].embrulho, fichas[0].cifra) : null;
  ok("99: só no aparelho do gil a ficha abre", aberta?.nome === "Maria da Silva" && aberta.cidade === "São Paulo");
  ok("99: com outra privada, não abre", fichas?.[0] ? (await F.abrirFiliacao(fichas[0].id, P.gil, (await S.novaChaveDeSeguranca()).privada, fichas[0].embrulho, fichas[0].cifra)) === null : false);
  ok("99: com outro id (troca de ficha), não abre", fichas?.[0] ? (await F.abrirFiliacao(crypto.randomUUID(), P.gil, par.privada, fichas[0].embrulho, fichas[0].cifra)) === null : false);
  await recusa("99: recibo errado não desfaz", () => chamar("eva", "rede_p4_filiacao_cancelar", { p_id: pronta?.pedido?.id, p_recibo: S.paraBase64(r(32)) }), "nao_encontrado");
  await passa("99: com o recibo, quem mandou desfaz (de qualquer conta: vale o recibo)", () => chamar("bia", "rede_p4_filiacao_cancelar", { p_id: pronta?.pedido?.id, p_recibo: pronta?.recibo }));
  ok("99: desfeita, a ficha some", (await dono("select count(*)::int n from interno.rede_p4_filiacoes")).rows[0].n === 0);
  {
    const outra = await F.prepararFiliacao("lume", destinos, { nome: "João" });
    await chamar("cris", "rede_p4_filiacao_enviar", { p: outra.pedido });
    await recusa("99: quem não gere não apaga", () => chamar("bia", "rede_p4_filiacao_apagar", { p_id: outra.pedido.id }), "nao_encontrado");
    await passa("99: a gestão apaga depois de baixar", () => chamar("gil", "rede_p4_filiacao_apagar", { p_id: outra.pedido.id }));
    const venc = await F.prepararFiliacao("lume", destinos, { nome: "Rosa" });
    await chamar("eva", "rede_p4_filiacao_enviar", { p: venc.pedido });
    await dono("update interno.rede_p4_filiacoes set apagar_em = current_date - 1");
    ok("99: a faxina tira as vencidas", (await rpc({ papel: "service_role", ip: "198.51.100.11" }, "rede_p4_filiacao_faxina", {})) === 1);
  }
  await passa("99: a Lume fecha a filiação", () => chamar("gil", "rede_p4_filiacao_abrir", { p_handle: "lume", p_abrir: false, p_sobre: "" }));
}

// ═══ As rotas do servidor (90 e 97): o fetch de fora é falso, para ver o que sai e o que volta ═══
const R = await import("../lib/rede/coletiva/regras.ts");
const REC = await import("../lib/recursos.ts");
const ligarRotas = (sim) => REC.definirVivos({ ligados: new Set(["rede-v2", "alumia-2", ...(sim ? ["alumia-p4-coletiva"] : [])]), desligados: new Set() });
const saidas = [];
let respostasDeFora = {};
globalThis.fetch = async (url, init) => {
  const u = String(url);
  saidas.push({ url: u, cabecalhos: { ...(init?.headers ?? {}) } });
  const chave = Object.keys(respostasDeFora).find((k) => u.startsWith(k));
  return chave ? new Response(JSON.stringify(respostasDeFora[chave]), { status: 200 }) : new Response("", { status: 404 });
};
const pedir = (rota, busca, cabecalhos = {}) => rota.GET(new Request(`https://exemplo.org/api/rede/coletiva/x?${busca}`, { headers: cabecalhos }));
const ESPIAO = { cookie: "sb-access-token=segredo", authorization: "Bearer segredo", "x-forwarded-for": "203.0.113.7" };
const semNadaDeQuemPede = () => saidas.every((s) => !JSON.stringify(s).includes("segredo") && !JSON.stringify(s).includes("203.0.113.7"));

// ═══ 90. Radar de projetos de lei ═══
{
  ok("90: lê o número do projeto de vários jeitos", JSON.stringify(["PL 1234/2024", "pl1234-2024", "PEC 45 de 2019", " PLP 7 2023 "].map((x) => R.lerProjeto(x, "camara") && R.chaveDoProjeto(R.lerProjeto(x, "camara"))))
    === JSON.stringify(["camara:PL:1234:2024", "camara:PL:1234:2024", "camara:PEC:45:2019", "camara:PLP:7:2023"]));
  ok("90: fora do formato, nada", ["", "XYZ 1/2024", "PL 0/2024", "PL 12/1900", "PL 1234", "<script>"].every((x) => R.lerProjeto(x, "senado") === null));
  ok("90: a chave vai e volta", R.chaveDoProjeto(R.projetoDaChave("senado:PL:2338:2023")) === "senado:PL:2338:2023" && R.projetoDaChave("senado:PL:2338:2023;drop") === null && R.projetoDaChave("camara:XX:1:2024") === null);
  ok("90: os endereços só vão aos dados abertos da Câmara e do Senado", [R.urlDaBuscaNaCamara(R.lerProjeto("PL 1/2024", "camara")), R.urlDoDetalheNaCamara(5), R.urlDaBuscaNoSenado(R.lerProjeto("PL 1/2024", "senado"))]
    .every((u) => ["dadosabertos.camara.leg.br", "legis.senado.leg.br"].includes(new URL(u).hostname) && new URL(u).protocol === "https:"));
  const proj = R.lerProjeto("PL 1234/2024", "camara");
  const s = R.situacaoDaCamara(proj, { dados: { id: 999, ementa: "  Dispõe   sobre a moradia. ", statusProposicao: { descricaoSituacao: "Aguardando Parecer", siglaOrgao: "CDU", dataHora: "2026-11-10T10:00" } } });
  ok("90: a situação da Câmara", s?.situacao === "Aguardando Parecer" && s.ementa === "Dispõe sobre a moradia." && s.orgao === "CDU" && s.quando === "2026-11-10T10:00" && s.link.startsWith("https://www.camara.leg.br/"));
  ok("90: a Câmara sem resultado", R.idNaCamara({ dados: [] }) === null && R.idNaCamara(null) === null && R.idNaCamara({ dados: [{ id: 42 }] }) === 42);
  const sen = R.situacaoDoSenado(R.lerProjeto("PL 2338/2023", "senado"), { PesquisaBasicaMateria: { Materias: { Materia: { Codigo: "157233", DadosBasicosMateria: { Ementa: "Uso de IA." }, SituacaoAtual: { DescricaoSituacao: "Em tramitação", SiglaLocal: "CCJ", DataSituacao: "2026-10-01" } } } } });
  ok("90: a situação do Senado", sen?.situacao === "Em tramitação" && sen.link.endsWith("/157233") && R.situacaoDoSenado(R.lerProjeto("PL 1/2024", "senado"), {}) === null);
  ok("90: o link de fora só se for do Senado", R.situacaoDoSenado(R.lerProjeto("PL 1/2024", "senado"), { PesquisaBasicaMateria: { Materias: { Materia: [{ Codigo: "x", UrlDetalheMateria: "https://malicioso.example/senado.leg.br" }] } } })?.link === "");
  // O que a pessoa segue fica só no aparelho, na chave que o "Sair rápido" apaga.
  ok("90: a lista do radar fica no aparelho, sob lucia:rede", R.CHAVE_DO_RADAR.startsWith("lucia:rede:"));
  ok("90: a lista guardada é conferida", R.lerSeguidos('[{"chave":"camara:PL:1:2024","visto":""},{"chave":"x","visto":""},5]').length === 1 && R.lerSeguidos("{lixo").length === 0
    && R.lerSeguidos(JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ chave: `camara:PL:${i + 1}:2024`, visto: "" })))).length === R.MAXIMO_SEGUIDOS);
  ok("90: andou quando o último andamento mudou", R.andou({ chave: "", visto: "2026-11-01" }, { quando: "2026-11-10" }) && !R.andou({ chave: "", visto: "2026-11-10" }, { quando: "2026-11-10" }) && !R.andou({ chave: "", visto: "" }, null));

  const rota = await import("../app/api/rede/coletiva/radar/route.ts");
  const fonte = ler("app/api/rede/coletiva/radar/route.ts");
  ok("90: a rota não lê sessão, cookie nem cabeçalho de quem pede", !/cookies\(|headers\(|pedido\.headers|authorization|x-forwarded/i.test(fonte));
  ligarRotas(false);
  ok("90: desligada, a rota responde 404", (await pedir(rota, "p=camara:PL:1234:2024")).status === 404 && saidas.length === 0);
  ligarRotas(true);
  ok("90: projeto inválido, 400 e nada sai", (await pedir(rota, "p=camara:PL:1234")).status === 400 && saidas.length === 0);
  respostasDeFora = {
    "https://dadosabertos.camara.leg.br/api/v2/proposicoes?": { dados: [{ id: 999 }] },
    "https://dadosabertos.camara.leg.br/api/v2/proposicoes/999": { dados: { id: 999, ementa: "Moradia.", statusProposicao: { descricaoSituacao: "Pronta para Pauta", siglaOrgao: "PLEN", dataHora: "2026-11-15T09:00" } } },
  };
  const r1 = await pedir(rota, "p=camara:PL:1234:2024", ESPIAO);
  const j1 = await r1.json();
  ok("90: a Câmara responde a situação", j1.situacao?.situacao === "Pronta para Pauta" && j1.situacao.chave === "camara:PL:1234:2024");
  ok("90: a resposta fica na borda (pública, uma entrada por projeto)", /public, max-age=\d+, s-maxage=3600/.test(r1.headers.get("cache-control") ?? ""));
  ok("90: só os dados abertos foram chamados, sem nada de quem pede", saidas.every((x) => new URL(x.url).hostname === "dadosabertos.camara.leg.br") && semNadaDeQuemPede());
  respostasDeFora = { "https://legis.senado.leg.br/": { PesquisaBasicaMateria: { Materias: { Materia: { Codigo: "1", SituacaoAtual: { DescricaoSituacao: "Arquivada" } } } } } };
  ok("90: o Senado também", (await (await pedir(rota, "p=senado:PL:1:2024", ESPIAO)).json()).situacao?.situacao === "Arquivada" && semNadaDeQuemPede());
  respostasDeFora = {};
  const r3 = await pedir(rota, "p=camara:PL:5:2024");
  ok("90: fora do ar, nada quebra (situação nula, cache curto)", r3.status === 200 && (await r3.json()).situacao === null && /s-maxage=600/.test(r3.headers.get("cache-control") ?? ""));
  saidas.length = 0;
}

// ═══ 91. Modelos de documento ═══
{
  ok("91: os cinco modelos", JSON.stringify(R.MODELOS) === '["lai","oficio","requerimento","ouvidoria","mp"]');
  ok("91: o prazo da LAI conta 20 dias corridos, mais 10 de prorrogação", JSON.stringify(R.prazoDaLai("2026-11-20")) === '{"resposta":"2026-12-10","prorrogada":"2026-12-20"}');
  ok("91: o prazo passa do mês e do ano", R.prazoDaLai("2026-12-20").resposta === "2027-01-09" && R.somarDias("2028-02-20", 10) === "2028-03-01");
  ok("91: a data por extenso", R.dataPorExtenso("2026-03-01") === "1 de março de 2026");
  const dados = { quem: "Coletivo Lume", para: "Secretaria Municipal de Habitação", assunto: "fila do aluguel social", texto: "Quantas famílias estão na fila?", cidade: "Recife" };
  const lai = R.montarDocumento("lai", dados, "2026-11-20");
  ok("91: o pedido da LAI cita a lei, o prazo com data e o recurso", lai.includes("Lei nº 12.527/2011") && lai.includes("10 de dezembro de 2026") && lai.includes("20 de dezembro de 2026") && lai.includes("art. 15") && lai.includes("Quantas famílias"));
  ok("91: a LAI não pede o motivo", lai.includes("art. 10, § 3º"));
  ok("91: todos os modelos levam o que a pessoa escreveu, o lugar e a data", R.MODELOS.every((m) => { const d = R.montarDocumento(m, dados, "2026-11-20"); return d.includes("Secretaria Municipal de Habitação") && d.includes("Recife, 20 de novembro de 2026.") && d.includes("Coletivo Lume"); }));
  ok("91: campo em branco vira linha para preencher à mão", R.montarDocumento("oficio", { quem: "", para: "", assunto: "", texto: "", cidade: "" }, "2026-11-20").includes("______"));
  ok("91: a denúncia à ouvidoria lembra a proteção de quem denuncia", R.montarDocumento("ouvidoria", dados, "2026-11-20").includes("13.460/2017"));
  ok("91: o documento é montado só no aparelho (as regras não chamam nada)", !/fetch\(|XMLHttpRequest|sendBeacon/.test(ler("lib/rede/coletiva/regras.ts")));
}

// ═══ 94. Panfleto com QR do ato ═══
{
  const id = "8f0e3c1a-1b2c-4d5e-8f90-123456789abc";
  const link = R.linkDoAto("https://exemplo.org/", "pt", id);
  ok("94: o QR aponta para a página do ato no nosso site", link === `https://exemplo.org/pt/alumia/ato/${id}`);
  ok("94: as linhas do panfleto: título, quando, onde e os selos", JSON.stringify(R.linhasDoPanfleto({ titulo: " Ato pela moradia ", inicio: "", cidade: "Recife", ponto: "Praça do Derby" }, "sáb., 28 nov., 15h", ["Libras", "Sombra"]))
    === JSON.stringify(["Ato pela moradia", "sáb., 28 nov., 15h", "Praça do Derby · Recife", "Libras · Sombra"]));
  ok("94: sem selos, sem a linha", R.linhasDoPanfleto({ titulo: "Ato", inicio: "", cidade: "Recife", ponto: "Praça" }, "hoje", []).length === 3);
  const svg = await passa("94: o QR sai em SVG, desenhado aqui", () => R.qrDoPanfleto(link));
  ok("94: o SVG é só desenho (sem script, sem endereço de fora)", typeof svg === "string" && svg.startsWith("<svg") && !/<script|href=|xlink|https?:\/\/(?!www\.w3\.org)/.test(svg));
  {
    // O QR lido de volta, como a câmera de quem passa leria: o mesmo endereço.
    const qrcode = (await import("qrcode")).default;
    const jsQR = (await import("jsqr")).default;
    const m = qrcode.create(link, { errorCorrectionLevel: "M" }).modules;
    const escala = 4, borda = 4, lado = (m.size + borda * 2) * escala;
    const px = new Uint8ClampedArray(lado * lado * 4).fill(255);
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) {
      if (!m.get(y, x)) continue;
      for (let dy = 0; dy < escala; dy++) for (let dx = 0; dx < escala; dx++) {
        const i = (((y + borda) * escala + dy) * lado + (x + borda) * escala + dx) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
    }
    ok("94: lido de volta, o QR dá o endereço do ato", jsQR(px, lado, lado)?.data === link);
  }
  await recusa("94: endereço de fora do ato não vira QR", () => R.qrDoPanfleto("https://golpe.example/pix"), "invalido:link");
  await recusa("94: javascript: não vira QR", () => R.qrDoPanfleto(`javascript:alert(1)//pt/alumia/ato/${id}`), "invalido:link");
}

// ═══ 97. Previsão do tempo do ato ═══
{
  ok("97: a busca é pela cidade, só no Brasil, no serviço aberto", (() => { const u = new URL(R.urlDaCidade(" Recife ")); return u.hostname === "geocoding-api.open-meteo.com" && u.searchParams.get("name") === "Recife" && u.searchParams.get("countryCode") === "BR"; })());
  ok("97: a previsão pede um dia só, no horário de Brasília", (() => { const u = new URL(R.urlDaPrevisao(-8.0539, -34.8811, "2026-11-28")); return u.hostname === "api.open-meteo.com" && u.searchParams.get("start_date") === "2026-11-28" && u.searchParams.get("end_date") === "2026-11-28" && u.searchParams.get("timezone") === "America/Sao_Paulo" && u.searchParams.get("latitude") === "-8.05"; })());
  ok("97: só dá para prever de hoje a 15 dias", R.diaPrevisivel("2026-11-20", "2026-11-20") && R.diaPrevisivel("2026-12-05", "2026-11-20") && !R.diaPrevisivel("2026-12-06", "2026-11-20") && !R.diaPrevisivel("2026-11-19", "2026-11-20") && !R.diaPrevisivel("amanhã", "2026-11-20"));
  ok("97: a cidade vira um ponto arredondado (a cidade, não a rua)", JSON.stringify(R.lerCidade({ results: [{ latitude: -8.05389, longitude: -34.88111, name: "Recife" }] })) === '{"lat":-8.05,"lon":-34.88,"nome":"Recife"}' && R.lerCidade({ results: [] }) === null && R.lerCidade(null) === null);
  ok("97: o tipo do tempo pelo código WMO", ["limpo", "nuvens", "neblina", "garoa", "chuva", "chuva", "temporal", "desconhecido"].join() === [0, 3, 45, 53, 63, 81, 95, null].map(R.tipoDoTempo).join());
  const prev = R.lerPrevisao({ daily: { time: ["2026-11-28"], weather_code: [61], temperature_2m_max: [29.6], temperature_2m_min: [22.2], precipitation_probability_max: [70] } }, "2026-11-28");
  ok("97: a previsão do dia", JSON.stringify(prev) === '{"dia":"2026-11-28","maxima":30,"minima":22,"chuva":70,"codigo":61,"tipo":"chuva"}');
  ok("97: sem o dia na resposta, nada", R.lerPrevisao({ daily: { time: ["2026-11-29"] } }, "2026-11-28") === null && R.lerPrevisao({}, "2026-11-28") === null);

  const rota = await import("../app/api/rede/coletiva/tempo/route.ts");
  const fonte = ler("app/api/rede/coletiva/tempo/route.ts");
  ok("97: a rota não lê sessão, cookie, cabeçalho nem posição de quem pede", !/cookies\(|headers\(|pedido\.headers|authorization|x-forwarded|latitude|geolocation/i.test(fonte));
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dia = R.somarDias(hoje, 3);
  saidas.length = 0;
  ligarRotas(false);
  ok("97: desligada, a rota responde 404", (await pedir(rota, `cidade=recife&dia=${dia}`)).status === 404 && saidas.length === 0);
  ligarRotas(true);
  const volta = await pedir(rota, `cidade=%20Recife%20&dia=${dia}`);
  ok("97: a cidade escrita de outro jeito volta para a forma única (uma entrada na borda)", volta.status === 308 && new URL(volta.headers.get("location"), "https://exemplo.org").searchParams.get("cidade") === "recife" && saidas.length === 0);
  ok("97: dia fora da previsão: nada sai", (await (await pedir(rota, `cidade=recife&dia=${R.somarDias(hoje, 20)}`)).json()).previsao === null && saidas.length === 0);
  respostasDeFora = {
    "https://geocoding-api.open-meteo.com/": { results: [{ latitude: -8.05389, longitude: -34.88111, name: "Recife" }] },
    "https://api.open-meteo.com/": { daily: { time: [dia], weather_code: [95], temperature_2m_max: [31], temperature_2m_min: [24], precipitation_probability_max: [80] } },
  };
  const r = await pedir(rota, `cidade=recife&dia=${dia}`, ESPIAO);
  const j = await r.json();
  ok("97: a previsão do ato", j.previsao?.tipo === "temporal" && j.previsao.chuva === 80 && j.cidade === "Recife" && j.fonte === "https://open-meteo.com/");
  ok("97: a resposta fica na borda por uma hora", /public, max-age=3600, s-maxage=3600/.test(r.headers.get("cache-control") ?? ""));
  ok("97: só o Open-Meteo foi chamado, com a cidade e nada de quem pede", saidas.length === 2 && saidas.every((x) => new URL(x.url).hostname.endsWith("open-meteo.com")) && semNadaDeQuemPede());
  respostasDeFora = {};
  ok("97: cidade que não existe: nada quebra", (await (await pedir(rota, `cidade=xyzzy&dia=${dia}`)).json()).motivo === "cidade");
  ok("97: os dois destinos estão na lista fechada do servidor", /"geocoding-api\.open-meteo\.com"/.test(ler("lib/externo.ts")) && /"api\.open-meteo\.com"/.test(ler("lib/externo.ts")));
  saidas.length = 0;
}

// ═══ 100, no cartão: o aviso de Pix só pergunta ao banco quando o post fala em Pix ═══
{
  ok("100: a palavra pix inteira, como o banco confere", ["Pix: 12.345.678/0001-90", "manda um PIX", "chave pix.", "(pix)"].every((x) => R.falaEmPix(x)));
  ok("100: sem a palavra, nem pergunta", ["pixel", "apix", "", null, "Pixação"].every((x) => !R.falaEmPix(x)));
  const aviso = ler("components/rede/coletiva/AvisoDePix.tsx");
  ok("100: o aviso só pergunta para quem tem conta e quando o post fala em Pix", /situacao\.logado && falaEmPix\(post\.texto\)/.test(aviso) && /conferirPix\(post\.id\)/.test(aviso));
  ok("100: o aviso não mostra a chave achada nem o texto do post", !/post\.texto\}|\.chave\b|r\.chave/.test(aviso.replace(/^\/\/.*$/gm, "").replace(/falaEmPix\(post\.texto\)/, "")) && /r\.alerta && r\.org \? r\.org : null/.test(aviso));
}

// ═══ As ligações: flag, rota, página, registro, encaixe, painel e textos ═══
{
  const recursos = ler("lib/recursos.ts");
  ok("a flag existe e é só pelo nome", /"alumia-p4-coletiva":/.test(recursos) && /SO_PELO_NOME[^;]*"alumia-p4-coletiva"/.test(recursos) && !/PADRAO[^;]*"alumia-p4-coletiva"/.test(recursos));
  ok("a rota nova com a flag, nunca indexada", /\{ nome: "acao-coletiva", caminho: "\/acao-coletiva", flag: "alumia-p4-coletiva", frente: "P4", indexar: false \}/.test(ler("lib/rede/rotas-novas.ts")));
  ok("a página da rota existe e usa a página nova (desligada, 404)", existe("app/[lang]/alumia/acao-coletiva/page.tsx") && /PaginaNova nome="acao-coletiva"/.test(ler("app/[lang]/alumia/acao-coletiva/page.tsx")));
  ok("o registro aponta para a tela, sem item fixo no menu", /"acao-coletiva": \{ componente: dynamic\(\(\) => import\("\.\/coletiva\/TelaDaColetiva"\), \{ ssr: false \}\), menu: "nenhum" \}/.test(ler("components/rede/registro.tsx")));
  const encaixes = ler("components/rede/encaixes.tsx");
  ok("o encaixe entra na lista depois da cultura e da organização (antes do modo ato; a ordem das ondas 10 a 13 fica igual)", /import \{ encaixe as coletiva \} from "\.\/coletiva\/encaixe";/.test(encaixes) && /criacaoColetiva, cultura, organizacao, coletiva, modoato,/.test(encaixes));
  const encaixe = ler("components/rede/coletiva/encaixe.tsx");
  ok("o encaixe fica vazio com a rota desligada", /!rotaNovaLigada\("acao-coletiva"\) \? \{\} :/.test(encaixe) && /situacao\.logado \? `\/\$\{lang\}\/alumia\/acao-coletiva` : null/.test(encaixe));
  ok("o painel único tem o nome e o que faz", /"alumia-p4-coletiva": \{ nome: "Ação coletiva"/.test(ler("components/painel/alumia/nomes-das-funcoes.ts")));
  const pt = JSON.parse(ler("i18n/rede/coletiva/pt.json"));
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort().join();
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = JSON.parse(ler(`i18n/rede/coletiva/${l}.json`));
    ok(`textos (${l}): as mesmas chaves do português e a marca de rascunho`, chaves(outro) === chaves(pt) && outro._rascunho === true);
    ok(`textos (${l}): o nome da tela na lista das rotas novas`, !!JSON.parse(ler(`i18n/rede/onda5/${l}.json`)).rotas?.["acao-coletiva"]?.titulo || !!JSON.stringify(JSON.parse(ler(`i18n/rede/onda5/${l}.json`))).includes("\"acao-coletiva\""));
  }
  ok("o português não é rascunho", pt._rascunho === undefined);
  // A tela não chama serviço de fora: só o banco (pelo cliente) e as nossas duas rotas, sem cookie.
  const tela = ["TelaDaColetiva", "AbaComunidade", "AbaAtos", "AbaLeis", "AbaOrgs", "AbaPouso", "AvisoDePix", "textos"].map((n) => ler(`components/rede/coletiva/${n}.tsx`.replace("textos.tsx", "textos.ts"))).join("\n");
  const fetches = [...tela.matchAll(/fetch\(`([^`$?]+)/g)].map((m) => m[1]);
  ok(`a tela só chama as nossas rotas (${fetches.join(", ")})`, fetches.length === 2 && fetches.every((f) => f.startsWith("/api/rede/coletiva/")) && (tela.match(/credentials: "omit"/g) ?? []).length === 2);
  ok("a tela não usa Math.random, nem sendBeacon, nem guarda nada além do radar", !/Math\.random|sendBeacon|sessionStorage|indexedDB\.open/.test(tela) && (tela.match(/localStorage\.(setItem|getItem|removeItem)/g) ?? []).length === 3);
  ok("o panfleto e o documento imprimem num quadro desta página, sem abrir nada de fora", /imprimirSozinho/.test(tela) && !/window\.open\(/.test(tela));
}

// ═══ (próximos itens) ═══

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
