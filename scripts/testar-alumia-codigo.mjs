// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O código que faltava para o beta (supabase/migracoes/20261122-alumia-codigo.sql e as telas), num Postgres de verdade
// (scripts/banco-local.mjs):
//   · a migração roda duas vezes sobre o install.sql do ramo; trancar não acha nada aberto; uma definição só de cada função;
//   · a denúncia de post cifrado: o trecho aberto só de post cifrado e só de quem é do grupo; sem trecho, vai sem conteúdo; a fila
//     da moderação recebe o trecho ("aberto") e a marca de cifrado;
//   · o WebFinger pelo domínio VERIFICADO da organização: o banco só responde pela organização com selo, dona do domínio, pelo
//     @nome dela; perder o selo ou o domínio tira a resposta na hora; a rota não abre conexão com o domínio pedido;
//   · o Update(Person) da identidade pública: passar a público, trocar o nome e voltar ao codinome põem o Update na fila;
//   · as telas: o formulário diz o custo do trecho, o selo do servidor num formato só, o tocador próprio, a pílula no claro e o
//     exemplo da prévia sem o Tião daqui (P8).
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-codigo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 600)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. O arquivo ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261122-alumia-codigo.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não guarda nem lê endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
ok("a migração não mexe na versão da Alumia", !/rede_alumia_versao/.test(semComentario));
ok("a migração não escreve 'Rede Lúcia'", !SQL.includes("Rede Lúcia"));
ok("nenhuma tabela nova e nenhuma permissão de tabela", !/create table|grant [a-z, ]+ on (table )?interno\./i.test(semComentario));
ok("nenhuma política (RLS sem políticas)", !/create policy/i.test(semComentario));
{
  const redefinidas = [...semComentario.matchAll(/create or replace function ([a-z_]+\.[a-z0-9_]+)\(/g)].map((m) => m[1]);
  ok(`a migração redefine só as três (${redefinidas.join(", ")})`, redefinidas.join() === "public.rede_mod_denunciar,interno.rede3_mod_item,public.rede_fed_mudanca_servidor");
}

// ═══════════════════ 1. O banco do zero e a migração duas vezes ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const linhas = async (s, v = []) => (await dono(s, v)).rows;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
await espera("a migração roda por cima do install.sql", () => exec(SQL));
await espera("e de novo (idempotente)", () => exec(SQL));
{
  const r = (await um("select interno.alumia_trancar() as r")).r;
  ok(`trancar não acha nada aberto (abertas: ${JSON.stringify(r.abertas)})`, r.trancadas === 0 && r.abertas.length === 0);
  const n = await linhas(`select p.proname, count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where (s.nspname, p.proname) in (('public', 'rede_mod_denunciar'), ('interno', 'rede3_mod_item'), ('public', 'rede_fed_mudanca_servidor')) group by p.proname`);
  ok(`uma definição só de cada (${n.map((x) => `${x.proname}=${x.n}`).join(", ")})`, n.length === 3 && n.every((x) => x.n === 1));
  const d = await um("select prosrc from pg_proc where oid = to_regprocedure('public.rede_mod_denunciar(text, text, text, text, text)')");
  ok("denunciar (cinco parâmetros) passa pela porta", Boolean(d?.prosrc.includes("perform interno.alumia_porta()")));
  const g = await um(`select has_function_privilege('anon', 'public.rede_mod_denunciar(text, text, text, text, text)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.rede_mod_denunciar(text, text, text, text, text)', 'execute') as autent,
    has_function_privilege('anon', 'interno.rede3_mod_item(interno.rede_denuncias)', 'execute') as item_anon,
    has_function_privilege('authenticated', 'interno.rede3_mod_item(interno.rede_denuncias)', 'execute') as item_autent,
    has_function_privilege('anon', 'public.rede_fed_mudanca_servidor(text, text, jsonb)', 'execute') as fed_anon`);
  ok("denunciar: só com conta; o item da fila: ninguém de fora; a federação: com a chave pública (e o segredo)", !g.anon && g.autent && !g.item_anon && !g.item_autent && g.fed_anon);
  const fed = await um("select prosrc from pg_proc where oid = to_regprocedure('public.rede_fed_mudanca_servidor(text, text, jsonb)')");
  ok("a ação de quem segue (Move) continua inteira", Boolean(fed?.prosrc.includes("from rede_fed_seguindo where ator = v_ator order by criado_em limit 2000")));
  ok("a federação continua fora da porta (o servidor chama sem sessão)", Boolean(fed && !fed.prosrc.includes("alumia_porta()")));
}
await espera("nenhuma função com valor padrão que dependa do tipo linha de uma tabela", () => linhas(`
  select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.pronargdefaults > 0 and n.nspname in ('public', 'interno')
    and exists (select 1 from unnest((p.proargtypes::oid[])[p.pronargs - p.pronargdefaults : p.pronargs - 1]) t (o)
                join pg_type ty on ty.oid = t.o join pg_class c on c.oid = ty.typrelid where c.relkind in ('r', 'p'))`), (r) => r.length === 0);

try {
  // ═══════════════════ 2. Pessoas, núcleo, comunidade fechada ═══════════════════
  let ip = 10;
  const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
  const anon = { papel: "anon", ip: "203.0.113.9" };
  const P = {};
  const nomes = ["ana", "bia", "caio", "duda", "org", "eva", "mod"];
  for (const [i, nome] of nomes.entries()) {
    P[nome] = await criarUsuario(`${nome}@codigo.local`, nome);
    await rpc(como(P[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1, rede_modo = 'aberto' where id = $1",
      [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'mediacao')", [P.mod]);
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  const zerar = () => dono("delete from interno.limites");

  const { id: NUCLEO } = await um("insert into interno.rede_nucleos (nome) values ('Núcleo do teste') returning id");
  for (const n of ["ana", "bia", "duda"]) await dono("insert into interno.rede_nucleo_membros (nucleo, usuario) values ($1, $2)", [NUCLEO, P[n]]);
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('roda-fechada', 'Roda fechada', 'lutas', 'fechada') on conflict do nothing");
  for (const n of ["ana", "bia"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('roda-fechada', $1, 'ativo')", [P[n]]);
  const CIFRA = "p2.3.dmV0b3I.Y2lmcmFkb3NlZ3JlZG9wYWxhdnJhdW5pY2E";
  const publicar = async (quem, pedido) => {
    await zerar();
    return rpc(como(P[quem]), "rede_publicar", { p: pedido });
  };
  const denunciar = async (quem, alvo, extra = {}) => {
    await zerar();
    return rpc(como(P[quem]), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvo, p_categoria: "ameaca", p_texto: "", ...extra });
  };

  // ═══════════════════ 3. A denúncia de post cifrado ═══════════════════
  const cifrado = await espera("a Ana publica um post cifrado no núcleo", () => publicar("ana", { publico: "nucleo", nucleo: NUCLEO, grupo: `nucleo:${NUCLEO}`, corpo_grupo: CIFRA }), (r) => r?.corpo_grupo === CIFRA);
  const daRoda = await espera("e um na comunidade fechada", () => publicar("ana", { comunidade: "roda-fechada", publico: "comunidade", grupo: "comunidade:roda-fechada", corpo_grupo: CIFRA }), (r) => r?.corpo_grupo === CIFRA);
  const aberto = await espera("e um aberto no núcleo", () => publicar("ana", { publico: "nucleo", nucleo: NUCLEO, texto: "Reunião na quinta, às 19h." }), (r) => r?.texto?.startsWith("Reunião"));

  const TRECHO = "Ato de quinta: levem a lista de quem vai e o endereço da casa da vereadora.";
  const comTrecho = await espera("a Bia (do núcleo) denuncia o post cifrado mandando o trecho que abriu", () => denunciar("bia", cifrado?.id, { p_trecho: `  ${TRECHO}  ` }), (r) => r?.protocolo && r.ja === false);
  await espera("o trecho fica na denúncia (sem os espaços das pontas)", () => um("select trecho, texto from interno.rede_denuncias where protocolo = $1", [comTrecho?.protocolo]), (r) => r.trecho === TRECHO && r.texto === "");
  await espera("a Duda (do núcleo) denuncia sem trecho: vai sem conteúdo", async () => {
    const r = await denunciar("duda", cifrado?.id);
    return um("select trecho from interno.rede_denuncias where protocolo = $1", [r.protocolo]);
  }, (r) => r.trecho === null);
  await espera("a Duda denuncia de novo, agora com o trecho: entra na denúncia aberta (a mesma)", async () => {
    const r = await denunciar("duda", cifrado?.id, { p_trecho: "Um trecho." });
    const n = await um("select count(*)::int as n, max(trecho) as trecho from interno.rede_denuncias where quem = $1", [P.duda]);
    return [r.ja, n.n, n.trecho];
  }, (r) => r.join() === "true,1,Um trecho.");
  await espera("na comunidade fechada também (a Bia é membro)", () => denunciar("bia", daRoda?.id, { p_trecho: "Trecho da roda." }), (r) => r?.protocolo);
  await recusa("trecho em post aberto: recusa (o texto já está lá)", () => denunciar("bia", aberto?.id, { p_trecho: "inventado" }), "invalido:trecho");
  await recusa("trecho em denúncia de perfil: recusa", () => rpc(como(P.bia), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "pessoa_caio", p_categoria: "spam", p_texto: "", p_trecho: "x" }), "invalido:trecho");
  await recusa("trecho grande demais: recusa", () => denunciar("bia", daRoda?.id, { p_trecho: "a".repeat(1001) }), "invalido:trecho");
  await recusa("quem não é do grupo nem vê o post cifrado (não denuncia, com ou sem trecho)", () => denunciar("caio", cifrado?.id, { p_trecho: "x" }), "nao_encontrado");
  await recusa("a autora não denuncia o próprio post", () => denunciar("ana", cifrado?.id, { p_trecho: "x" }), "sem_permissao");
  await espera("a chamada de quatro parâmetros (a tela de antes) continua valendo", async () => {
    await zerar();
    return rpc(como(P.bia), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: aberto?.id, p_categoria: "spam", p_texto: "" });
  }, (r) => r?.protocolo);
  await recusa("visitante não denuncia pela função", () => rpc(anon, "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: cifrado?.id, p_categoria: "spam", p_texto: "", p_trecho: "x" }), "permission denied");
  {
    // Quem sai do grupo deixa de ver o post e não manda mais trecho (a regra é a do grupo, conferida na hora).
    await dono("delete from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [NUCLEO, P.duda]);
    await recusa("quem saiu do núcleo não denuncia mais com trecho", () => denunciar("duda", cifrado?.id, { p_trecho: "outro" }), "nao_encontrado");
  }
  {
    // A fila da moderação (o item): o trecho aberto e a marca de cifrado; o post de núcleo continua sem o texto de prévia.
    const item = await um("select interno.rede3_mod_item(d) as j from interno.rede_denuncias d where protocolo = $1", [comTrecho?.protocolo]);
    ok(`a fila recebe o trecho aberto e a marca de cifrado (${JSON.stringify(item?.j)?.slice(0, 200)})`, item?.j.aberto === TRECHO && item.j.cifrado === true && item.j.trecho === null);
    const semCifra = await um("select interno.rede3_mod_item(d) as j from interno.rede_denuncias d where alvo = $1 limit 1", [aberto?.id]);
    ok("post aberto: cifrado falso, aberto nulo", semCifra?.j.cifrado === false && semCifra.j.aberto === null);
  }
  await espera("nenhum trecho fora de post cifrado no banco", () => um(`select count(*)::int as n from interno.rede_denuncias d
    left join interno.rede_posts p on d.alvo_tipo = 'post' and p.id::text = d.alvo where d.trecho is not null and p.corpo_grupo is null`), (r) => r.n === 0);

  // ═══════════════════ 4. O WebFinger pelo domínio da organização ═══════════════════
  const SEGREDO = "s".repeat(48);
  await dono("insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object('segredo_hash', encode(sha256(convert_to($1, 'UTF8')), 'hex'))) on conflict (chave) do update set valor = interno.configuracoes.valor || excluded.valor", [SEGREDO]);
  const org = (p) => rpc(anon, "rede_fed_mudanca_servidor", { p_segredo: SEGREDO, p_acao: "org_dominio", p });
  await dono("insert into interno.rede_orgs (perfil, tipo, verificada_em) values ($1, 'coletivo', now()) on conflict (perfil) do update set verificada_em = now()", [P.org]);
  await dono("insert into interno.rede_org_dominios (org, dominio, desafio, situacao, metodo, verificado_em) values ($1, 'coletivo.example.org', $2, 'esperando', null, null)", [P.org, "a".repeat(32)]);
  await espera("domínio ainda não verificado: nada", () => org({ dominio: "coletivo.example.org", nome: "pessoa_org" }), (r) => r === null);
  await dono("update interno.rede_org_dominios set situacao = 'verificado', metodo = 'txt', verificado_em = now() where org = $1", [P.org]);
  await espera("verificado: responde pelo @nome da organização", () => org({ dominio: "Coletivo.Example.org.", nome: "@Pessoa_Org" }), (r) => r?.handle === "pessoa_org");
  await espera("outro @nome no domínio da organização: nada (o domínio não vira endereço de qualquer conta)", () => org({ dominio: "coletivo.example.org", nome: "pessoa_ana" }), (r) => r === null);
  await espera("domínio de ninguém: nada (não diz se existe)", () => org({ dominio: "outro.example.org", nome: "pessoa_org" }), (r) => r === null);
  await espera("domínio torto, endereço de máquina ou nome torto: nada", async () => Promise.all([
    org({ dominio: "127.0.0.1", nome: "pessoa_org" }), org({ dominio: "localhost", nome: "pessoa_org" }), org({ dominio: "a..b", nome: "pessoa_org" }),
    org({ dominio: "coletivo.example.org/x", nome: "pessoa_org" }), org({ dominio: "coletivo.example.org", nome: "x" }), org({}),
  ]), (r) => r.every((x) => x === null));
  await recusa("sem o segredo: recusa", () => rpc(anon, "rede_fed_mudanca_servidor", { p_segredo: "x".repeat(40), p_acao: "org_dominio", p: { dominio: "coletivo.example.org", nome: "pessoa_org" } }), "sem_permissao");
  await espera("a organização suspensa: nada, na hora", async () => {
    await dono("update interno.perfis set suspenso = true where id = $1", [P.org]);
    const r = await org({ dominio: "coletivo.example.org", nome: "pessoa_org" });
    await dono("update interno.perfis set suspenso = false where id = $1", [P.org]);
    return r;
  }, (r) => r === null);
  await espera("perdeu o selo: nada, na hora", async () => {
    await dono("update interno.rede_orgs set verificada_em = null where perfil = $1", [P.org]);
    const r = await org({ dominio: "coletivo.example.org", nome: "pessoa_org" });
    await dono("update interno.rede_orgs set verificada_em = now() where perfil = $1", [P.org]);
    return r;
  }, (r) => r === null);
  await espera("tirou o domínio: nada, na hora", async () => {
    await dono("delete from interno.rede_org_dominios where org = $1", [P.org]);
    return org({ dominio: "coletivo.example.org", nome: "pessoa_org" });
  }, (r) => r === null);
  await espera("a ação do Move (quem segue) continua", () => rpc(anon, "rede_fed_mudanca_servidor", { p_segredo: SEGREDO, p_acao: "quem_segue", p: { ator: "https://remota.teste/users/x" } }), (r) => Array.isArray(r));
  await recusa("ação inventada: recusa", () => rpc(anon, "rede_fed_mudanca_servidor", { p_segredo: SEGREDO, p_acao: "qualquer", p: {} }), "invalido:acao");

  // ═══════════════════ 5. Update(Person) da identidade pública ═══════════════════
  {
    const srv = (acao, p = {}) => rpc(anon, "rede_fed_servidor", { p_segredo: SEGREDO, p_acao: acao, p });
    await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em, chave_publica, chave_privada) values ($1, 'pessoa_eva', true, 1, now(), '-----BEGIN PUBLIC KEY-----v', 'v1:v') on conflict do nothing", [P.eva]);
    const ATOR = "https://remota.teste/users/lia";
    await srv("seguidor", { handle: "pessoa_eva", ator: ATOR, inbox: `${ATOR}/inbox`, compartilhada: "https://remota.teste/inbox", pedido: "https://remota.teste/f/1", sim: true });
    const updates = async () => (await um("select count(*)::int as n from interno.rede_fed_fila where perfil = $1 and tipo = 'update' and objeto = 'ator:pessoa_eva'", [P.eva])).n;
    const entregar = () => dono("update interno.rede_fed_fila set feito_em = now() where perfil = $1 and tipo = 'update' and objeto = 'ator:pessoa_eva'", [P.eva]);
    await dono("select interno.alumia_identidade_publica_ligar(true)");
    const nome = async () => (await srv("ator", { handle: "pessoa_eva" })).nome;
    await espera("antes: o ator sai com o codinome", nome, (n) => n === "Pessoa 6");
    let antes = await updates();
    await espera("a Eva passa a público: o Update(Person) vai para quem a segue lá fora", async () => {
      await zerar();
      await rpc(como(P.eva), "rede_identidade_publicar", { p_nome: "Eva Martins", p_ciente: true });
      return [(await updates()) - antes, await nome()];
    }, (r) => r[0] >= 1 && r[1] === "Eva Martins");
    await entregar();
    antes = await updates();
    await espera("troca o nome público: outro Update, com o nome novo", async () => {
      await zerar();
      await rpc(como(P.eva), "rede_identidade_publicar", { p_nome: "Eva M. Souza", p_ciente: true });
      return [(await updates()) - antes, await nome()];
    }, (r) => r[0] >= 1 && r[1] === "Eva M. Souza");
    await entregar();
    antes = await updates();
    await espera("volta ao codinome: outro Update, que tira o nome dos servidores que respeitam o Update", async () => {
      await zerar();
      await rpc(como(P.eva), "rede_identidade_codinome", { p_novo_handle: null });
      return [(await updates()) - antes, await nome()];
    }, (r) => r[0] >= 1 && r[1] === "Pessoa 6");
    await espera("a foto enviada nunca sai no ator (só o rosto da galeria)", () => srv("ator", { handle: "pessoa_eva" }), (a) => a.avatar_url === null || /^\/rede\/avatares\/a\d\d\.svg$/.test(a.avatar_url));
  }
} catch (erro) {
  falhas.push(`o banco: ${erro.message}`);
}

// ═══════════════════ 6. O código das telas e da rota ═══════════════════
try {
  const enderecos = await import("../lib/rede/fediverso/enderecos.ts");
  const e = { dominio: "alumia.example.org", dominioCurto: "example.org" };
  const doms = enderecos.dominiosDaConta(e, true);
  const c = enderecos.contaDeOutroDominio;
  ok("contaDeOutroDominio: acct de domínio que não é da Alumia vira {usuario, dominio}", JSON.stringify(c("acct:Coletivo@Coletivo.Example.Org", doms)) === JSON.stringify({ usuario: "coletivo", dominio: "coletivo.example.org" }));
  ok("contaDeOutroDominio: os domínios da Alumia, endereço de máquina, porta, localhost e nome torto ficam de fora",
    [c("acct:x_x@alumia.example.org", doms), c("acct:abc@example.org", doms), c("acct:abc@127.0.0.1", doms), c("acct:abc@[::1]", doms), c("acct:abc@x.org:8443", doms),
      c("acct:abc@localhost", doms), c("acct:a@x.org", doms), c("https://x.org/@abc", doms), c("acct:abc@x", doms), c("acct:abc@-x.org", doms), c(`acct:abc@${"a".repeat(250)}.org`, doms)].every((x) => x === null));
  const rota = ler("app/.well-known/webfinger/route.ts");
  ok("a rota pergunta ao banco (org_dominio) e não abre conexão com o domínio pedido", /org_dominio/.test(rota) && !/fetch\(|pedirAoFediverso|node:dns|lookup\(/.test(rota));
  ok("a resposta pelo domínio da organização tem cache curto (o selo sai na hora)", /\] \}, 60\);/.test(rota) && /max-age=\$\{segundos\}/.test(rota));

  const form = ler("components/rede/moderacao/FormularioDeDenuncia.tsx");
  const pt = JSON.parse(ler("i18n/rede/moderacao/pt.json"));
  ok("o formulário: o trecho só de post cifrado que abriu, e o aviso do custo", /postCifrado\(/.test(form) && /abrirNoAparelho/.test(form) && /trechoContido/.test(form) && typeof pt.denunciar?.cifrado?.custo === "string"
    && pt.denunciar.cifrado.custo.includes("a moderação vai ler este trecho; o resto continua cifrado"));
  const { trechoContido } = await import("../components/rede/moderacao/trecho.ts");
  ok("trechoContido: só o que está no texto aberto (sem inventar)", trechoContido("Ato de quinta, às 18h.", "quinta, às 18h") && !trechoContido("Ato de quinta.", "sexta") && !trechoContido("Ato", "") && trechoContido("Ato  de\nquinta", "Ato de quinta"));
  const fila = ler("components/rede/moderacao/FilaDeDenuncias.tsx");
  ok("a fila mostra o trecho aberto com o aviso de que foi escrito por quem denunciou", /item\.aberto/.test(fila) && /item\.cifrado/.test(fila));

  const selo = ler("components/rede/fediverso/SeloDoServidor.tsx");
  ok("o selo do servidor num formato só (o servidor; o title diz que é do Fediverso)", /title=\{/.test(selo) && !/md:hidden|md:inline/.test(selo));
  const cartao = ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx");
  ok("o cartão usa o selo de sempre (nenhuma pílula feita à mão)", /<SeloDoServidor/.test(cartao) && !/preencher\(t\.cartao\.doFediverso/.test(cartao));

  const tocador = ler("components/rede/midia/TocadorDeAudio.tsx");
  ok("o tocador próprio: botão, barra que se arrasta pelo teclado (range) e o tempo dito", /type="range"/.test(tocador) && /aria-valuetext/.test(tocador) && /aria-label/.test(tocador));
  const usam = ["components/rede/publicar/Complementos.tsx", "components/rede/midia/NaResposta.tsx", "components/rede/publicar/ExtrasDoEscrever.tsx"].map(ler);
  ok("o áudio do post, da resposta e o gravado usam o tocador próprio (nada de controls do navegador)", usam.every((t) => /TocadorDeAudio/.test(t) && !/<audio[^>]*\bcontrols\b/.test(t)));

  const tokens = ler("styles/alumia-tokens.css");
  ok("a pílula no claro: fundo de 6% e letra escurecida", /\[data-al-tema="claro"\] \.al-pilula[\s\S]{0,300}6%[\s\S]{0,300}color-mix\(in srgb, var\(--al-cor, var\(--al-com-1\)\) 80%, var\(--al-texto\)\)/.test(tokens));

  const exemplos = ler("lib/rede/publicar/exemplos-alumia2.ts");
  ok("P8: o Tião só existe como gente de fora; o post de exemplo daqui é de outra autora", !/Tião|tiao/.test(exemplos) && /exemplo-ocupacao/.test(exemplos));
  ok("P8: a Linha não filtra mais o Tião daqui", !/TIAO_DA_PREVIA|semOTiaoDaqui/.test(ler("components/rede/Linha.tsx")));
} catch (erro) {
  falhas.push(`as telas e a rota: ${erro.message}`);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
