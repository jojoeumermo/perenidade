// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 3 e 5 (interruptor "alumia-p4-selo-contagens"):
//   · item 3: o selo de verificado para pessoas (pedir, fila, decidir, tirar, registro só de inserção, nenhum documento guardado) e o
//     nome reservado (cadastro e troca de codinome ou de @ parecido são recusados, por qualquer caminho; só a pessoa verificada a quem
//     a coordenação ligou o nome passa);
//   · item 5: as contagens públicas por escolha (duas chaves desligadas por padrão, número só a partir de 3, nunca a lista, e com as
//     chaves desligadas nenhuma função devolve o número a outra pessoa);
//   · antes da migração, um @ igual ao de uma figura pública passava (o problema existia);
//   · as peças da tela: flag, textos nos seis idiomas, painel, erro traduzido.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p4-selo-contagens.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { RECURSOS, SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";
import { ERROS_DA_REDE } from "../lib/rede/tipos.ts";
import { NOMES_DAS_FUNCOES } from "../components/painel/alumia/nomes-das-funcoes.ts";
import { criarClienteSelo, contagemPublicada } from "../lib/rede/selo-contagens/cliente.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
const FLAG = "alumia-p4-selo-contagens";

let certos = 0;
const falhas = [];
// Se o teste cair no meio, as falhas até ali aparecem (não só o erro que derrubou).
process.on("exit", (codigo) => {
  if (codigo && falhas.length && !process.env.P4_SELO_FIM) for (const f of falhas) console.log(`  ✗ ${f}`);
});
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

// ═══ 0. A migração, lida ═══
const SQL = normal(ler("supabase/migracoes/20261127-p4-selo-contagens.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração diz a lei e que pode rodar de novo", /Lei: LGPD art\./.test(SQL) && /Pode rodar mais de uma vez/.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem/i.test(semComentario));
ok("nenhuma coluna de documento, prova, e-mail ou link no selo das pessoas",
  !/create table if not exists interno\.rede_p4_[a-z_]+ \([^;]*\b(documento|prova|email|link|url|arquivo)\b[^;]*\);/i.test(semComentario));
ok("o registro do selo nunca é apagado nem alterado pelas funções", !/(delete from|update)\s+(interno\.)?rede_p4_selo_registro/i.test(semComentario));
{
  const publicas = [...semComentario.matchAll(/create or replace function public\.(rede_p4_[a-z_]+)\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$;/g)];
  ok(`são 13 funções públicas (${publicas.length})`, publicas.length === 13);
  ok("toda função pública começa pela porta", publicas.every((m) => /^\s*(declare[\s\S]*?)?begin\s+perform interno\.alumia_porta\(\);/.test(m[2])));
}

// ═══ 1. Antes: um @ de figura pública passava ═══
async function pessoas(banco, nomes) {
  const { dono, criarUsuario, rpc } = banco;
  const P = {};
  for (const [i, nome] of nomes.entries()) {
    P[nome] = await criarUsuario(`${nome}@p4-selo.local`, nome);
    await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [P[nome], `Pessoa ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)}`, `pessoa_${nome}`]);
  }
  await dono("delete from interno.papeis");
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
  await dono("update auth.users set created_at = now() - interval '30 days'");
  return P;
}
{
  // A migração ainda não está no install.sql (quem junta cola): o banco de antes é o install.sql inteiro. Se já estiver, corta antes dela.
  const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
  const P = await pessoas(banco, ["bia"]);
  const r = await passa("antes: o @ “lu1a_br” (Lula) entrava sem conferência", () =>
    banco.rpc({ papel: "authenticated", sub: P.bia, ip: "198.51.100.40" }, "rede_perfil_handle_definir", { p_handle: "lu1a_br" }));
  ok("antes: o @ foi gravado", r?.handle === "lu1a_br");
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, rpc } = banco;
const install = normal(ler("supabase/install.sql"));
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const k = (await dono("select k.so_pelo_nome, v.ligado from interno.recursos_catalogo k left join interno.recursos_vivos v on v.nome = k.nome where k.nome = $1", [FLAG])).rows[0];
  ok("o interruptor está no catálogo, só pelo nome e sem decisão (desligado)", k?.so_pelo_nome === true && k.ligado !== true);
  const rls = (await dono("select count(*)::int n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('rede_p4_selos', 'rede_p4_selo_pedidos', 'rede_p4_selo_registro', 'rede_p4_nomes_reservados', 'rede_p4_contagens') and c.relkind = 'r' and c.relrowsecurity")).rows[0].n;
  ok(`as cinco tabelas têm RLS ligada (${rls})`, rls === 5);
  const pol = (await dono("select count(*)::int n from pg_policies where schemaname = 'interno' and tablename like 'rede_p4_%'")).rows[0].n;
  ok("e nenhuma política (só as funções entram)", pol === 0);
}

const P = await pessoas(banco, ["ana", "bia", "cris", "dani", "eva", "fil", "equipe"]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.equipe]);
let ip = 60;
const como = (n, extra = {}) => ({ papel: "authenticated", sub: P[n], ip: `198.51.100.${ip++ % 250}`, ...extra });
const EQUIPE = () => como("equipe", { aal: "aal2" });
const r = (n, f, a) => rpc(n === "equipe" ? EQUIPE() : como(n), f, a);
const ligar = (sim) => dono("insert into interno.recursos_vivos (nome, ligado) values ($1, $2) on conflict (nome) do update set ligado = $2", [FLAG, sim]);
const limpar = () => dono("delete from interno.limites");

// ── 2.1 Desligado: nada abre, nada conta, nada bloqueia ──
{
  const meu = await passa("desligado: rede_p4_meu responde", () => r("ana", "rede_p4_meu"));
  ok("desligado: rede_p4_meu diz só {ligado: false}", JSON.stringify(meu) === '{"ligado":false}');
  await recusa("desligado: pedir o selo é recusado", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "pessoa_publica", p_canal: "gabinete" }), "desligado");
  await recusa("desligado: salvar as chaves é recusado", () => r("ana", "rede_p4_contagens_salvar", { p_seguidores: true, p_apoios: true }), "desligado");
  // A coordenação prepara a lista antes de ligar.
  const lula = await passa("desligado: a coordenação já pode reservar nomes", () => r("equipe", "rede_p4_reservado_salvar", { p_nome: "Lula" }));
  await passa("desligado: o @ parecido ainda passa (o bloqueio é do interruptor)", () => r("fil", "rede_perfil_handle_definir", { p_handle: "lula_fil" }));
  await dono("update interno.perfis set rede_handle = 'pessoa_fil', rede_handle_em = null where id = $1", [P.fil]);
  ok("desligado: o selo de ninguém aparece", (await r("bia", "rede_p4_selo_de", { p_handle: "pessoa_ana" })) === null);
  ok("desligado: a contagem não sai", JSON.stringify(await r("bia", "rede_p4_seguidores_de", { p_handle: "pessoa_ana" })) === '{"mostra":false}');
  ok("desligado: os apoios não saem", JSON.stringify(await r("bia", "rede_p4_apoios_de", { p_posts: [crypto.randomUUID()] })) === "{}");
  globalThis.LULA = lula?.id;
}
await ligar(true);

// ── 2.2 A lista dos nomes reservados ──
await recusa("quem não é da coordenação não reserva nome", () => r("bia", "rede_p4_reservado_salvar", { p_nome: "Marielle Franco" }), "sem_permissao");
await recusa("quem não é da coordenação não lê a lista", () => r("bia", "rede_p4_reservados"), "sem_permissao");
await recusa("coordenação sem o segundo fator não reserva", () => rpc(como("equipe"), "rede_p4_reservado_salvar", { p_nome: "Marielle Franco" }), "sem_permissao");
const marielle = await passa("a coordenação reserva “Marielle Franco”", () => r("equipe", "rede_p4_reservado_salvar", { p_nome: "Marielle Franco" }));
await recusa("nome curto demais é recusado", () => r("equipe", "rede_p4_reservado_salvar", { p_nome: "Zé" }), "invalido:nome");
{
  const de_novo = await passa("“LUL4” é o mesmo nome que “Lula” (não duplica)", () => r("equipe", "rede_p4_reservado_salvar", { p_nome: "LUL4" }));
  ok("a mesma grafia devolve o mesmo nome", de_novo?.id === globalThis.LULA && de_novo?.nome === "Lula");
  const lista = await r("equipe", "rede_p4_reservados");
  ok(`a lista tem os dois nomes, sem dizer quem é a pessoa (${JSON.stringify(lista)})`, Array.isArray(lista) && lista.length === 2
    && lista.every((x) => Object.keys(x).sort().join() === "id,nome,verificado"));
}

// ── 2.3 O nome reservado no cadastro e na troca ──
const NAO = ["lula", "LULA", "lu1a", "luula", "lula2026", "lula_br", "lulareal", "o_lula", "lula_sp", "sou_lula", "l_u_l_a", "mar1ellefranco", "mariele_franco", "marielle_f_ranco"];
for (const h of NAO) {
  await limpar();
  await recusa(`troca de @ para “${h}”: recusada`, () => r("bia", "rede_perfil_handle_definir", { p_handle: h }), h.length > 20 || !/^[a-z0-9_]{3,20}$/i.test(h) ? "invalido" : "nome_reservado");
}
for (const h of ["tallulah", "lulu_da_vila", "marielly", "franco_de_sp"]) {
  await limpar();
  await dono("update interno.perfis set rede_handle_em = null where id = $1", [P.bia]);
  const x = await passa(`@ que só lembra de longe (“${h}”): passa`, () => r("bia", "rede_perfil_handle_definir", { p_handle: h }));
  ok(`“${h}” foi gravado`, x?.handle === h);
}
await dono("update interno.perfis set rede_handle = 'pessoa_bia', rede_handle_em = null where id = $1", [P.bia]);
for (const c of ["Lúla", "L U L A", "Mariele Franco", "Marielle Franco Silva"]) {
  await limpar();
  await recusa(`codinome “${c}” no cadastro: recusado`, () => r("cris", "rede_codinome_definir", { p_codinome: c }), "nome_reservado");
}
await limpar();
await passa("codinome comum (“Ana Clara”) passa", () => r("cris", "rede_codinome_definir", { p_codinome: "Ana Clara" }));
await recusa("por qualquer caminho: gravar o @ direto na tabela também é recusado", () =>
  dono("update interno.perfis set rede_handle = 'lula_sp' where id = $1", [P.dani]), "nome_reservado");
await recusa("e uma conta nova já com o codinome reservado também", () =>
  dono("insert into interno.perfis (id, rede_codinome) select gen_random_uuid(), 'Marielle Franco'"), "nome_reservado");
await passa("mudar outra coisa do perfil (a bio) não dispara a conferência", () =>
  dono("update interno.perfis set rede_bio = 'oi' where id = $1", [P.dani]));

// ── 2.4 O selo de verificado ──
await recusa("pedido com tipo inventado: recusado", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "pago", p_canal: "gabinete" }), "invalido:tipo");
await recusa("pedido com canal inventado: recusado", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "pessoa_publica", p_canal: "rg" }), "invalido:canal");
await recusa("organização usa o selo das organizações", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "organizacao", p_canal: "gabinete" }), "usar_selo_org");
await limpar();
const pedido = await passa("a pessoa pede o selo (pessoa pública, pelo gabinete)", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "pessoa_publica", p_canal: "gabinete" }));
ok("o pedido espera", pedido?.situacao === "esperando");
await recusa("um pedido por vez", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "educadora", p_canal: "email_institucional" }), "ja_pedido");
{
  const meu = await r("ana", "rede_p4_meu");
  ok(`rede_p4_meu mostra o pedido e as chaves desligadas (${JSON.stringify(meu)})`, meu.ligado === true && meu.pedido?.tipo === "pessoa_publica" && meu.selo === null
    && meu.seguidores === false && meu.apoios === false);
}
await recusa("quem não é da coordenação não vê a fila", () => r("bia", "rede_p4_selo_fila"), "sem_permissao");
const fila = await r("equipe", "rede_p4_selo_fila");
ok(`a fila tem o pedido, só com codinome, @, tipo, canal e data (${JSON.stringify(fila)})`, fila.length === 1 && fila[0].handle === "pessoa_ana"
  && Object.keys(fila[0]).sort().join() === "canal,codinome,criadoEm,handle,id,tipo");
await recusa("quem não é da coordenação não decide", () => r("bia", "rede_p4_selo_decidir", { p_id: fila[0].id, p_aceitar: true, p_motivo: "", p_reservado: null }), "sem_permissao");
await recusa("recusar sem motivo não vale", () => r("equipe", "rede_p4_selo_decidir", { p_id: fila[0].id, p_aceitar: false, p_motivo: "não", p_reservado: null }), "invalido:motivo");
await passa("a coordenação dá o selo e liga o nome “Lula” à pessoa", () => r("equipe", "rede_p4_selo_decidir", { p_id: fila[0].id, p_aceitar: true, p_motivo: "", p_reservado: globalThis.LULA }));
{
  const sobra = (await dono("select count(*)::int n from interno.rede_p4_selo_pedidos")).rows[0].n;
  ok("o pedido some depois de decidido (nada dele fica guardado)", sobra === 0);
  const reg = (await dono("select alvo, acao, tipo, por from interno.rede_p4_selo_registro")).rows;
  ok(`o registro tem a decisão, quem decidiu e quando (${JSON.stringify(reg)})`, reg.length === 1 && reg[0].alvo === P.ana && reg[0].acao === "dado" && reg[0].por === P.equipe);
  const aviso = (await dono("select count(*)::int n from interno.avisos where para = $1 and texto like '%selo de verificado%'", [P.ana])).rows[0].n;
  ok("a pessoa recebe o aviso", aviso === 1);
  const lista = await r("equipe", "rede_p4_reservados");
  ok("na lista, “Lula” aparece como verificado (sem dizer quem)", lista.find((x) => x.nome === "Lula")?.verificado === true);
}
await recusa("o registro não se altera", () => dono("update interno.rede_p4_selo_registro set motivo = 'x'"), "não se altera");
await recusa("o registro não se apaga", () => dono("delete from interno.rede_p4_selo_registro"), "não se altera");
await recusa("o registro não se esvazia", () => dono("truncate interno.rede_p4_selo_registro"), "não se altera");
{
  const selo = await r("bia", "rede_p4_selo_de", { p_handle: "@pessoa_ana" });
  ok(`o selo aparece para os outros: tipo, desde e "coordenação" (${JSON.stringify(selo)})`, selo?.tipo === "pessoa_publica" && selo?.por === "coordenacao"
    && /^\d{4}-\d{2}-\d{2}$/.test(selo?.desde) && Object.keys(selo).sort().join() === "desde,por,tipo");
  ok("quem verificou nunca sai como pessoa", !JSON.stringify(selo).includes(P.equipe));
  ok("perfil sem selo: nulo", (await r("ana", "rede_p4_selo_de", { p_handle: "pessoa_bia" })) === null);
}
{
  // Auditoria do P4 (B2): com a flag desligada depois de dar o selo, o selo não pode continuar valendo em lugar nenhum (antes,
  // interno.alumia_verificada seguia true e o gatilho do nome parecido tratava a pessoa como verificada).
  const verificada = async () => (await dono("select interno.alumia_verificada($1) as v", [P.ana])).rows[0].v;
  ok("com a flag ligada, quem tem o selo conta como verificada", (await verificada()) === true);
  await ligar(false);
  ok("com a flag desligada, o selo dado não conta mais como verificada", (await verificada()) === false);
  ok("e o perfil não mostra o selo", (await r("bia", "rede_p4_selo_de", { p_handle: "@pessoa_ana" })) === null);
  ok("a equipe continua verificada com a flag desligada (regra do Prompt 5)", (await dono("select interno.alumia_verificada($1) as v", [P.equipe])).rows[0].v === true);
  await ligar(true);
  ok("religada, o selo volta a valer (nada foi apagado)", (await verificada()) === true);
}
await limpar();
const comNome = await passa("a pessoa verificada pode usar o nome ligado a ela", () => r("ana", "rede_perfil_handle_definir", { p_handle: "lula_br" }));
ok("o @ dela foi gravado", comNome?.handle === "lula_br");
await limpar();
await recusa("outra pessoa continua sem poder", () => r("bia", "rede_perfil_handle_definir", { p_handle: "lula_rj" }), "nome_reservado");
await limpar();
await recusa("a verificada não pega outro nome reservado (Marielle)", () => r("ana", "rede_codinome_definir", { p_codinome: "Marielle Franco" }), "nome_reservado");
await limpar();
await recusa("com selo, não se pede de novo", () => r("ana", "rede_p4_selo_pedir", { p_tipo: "educadora", p_canal: "gabinete" }), "ja_verificada");
{
  // O selo das organizações (já existente) sai do mesmo jeito.
  await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, verificada_em) values ($1, 'coletivo', 'São Paulo', 'ORG', now())", [P.eva]);
  const org = await r("bia", "rede_p4_selo_de", { p_handle: "pessoa_eva" });
  ok(`o selo da organização sai como "organizacao" (${JSON.stringify(org)})`, org?.tipo === "organizacao" && org?.por === "coordenacao");
  await dono("delete from interno.rede_orgs where perfil = $1", [P.eva]);
}
{
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.ana, P.fil]);
  ok("quem foi bloqueado não vê o selo", (await r("fil", "rede_p4_selo_de", { p_handle: "lula_br" })) === null);
  await dono("delete from interno.rede_bloqueios");
}
await recusa("quem não é da coordenação não tira o selo", () => r("bia", "rede_p4_selo_tirar", { p_handle: "lula_br", p_motivo: "motivo comprido o bastante" }), "sem_permissao");
await recusa("tirar sem motivo não vale", () => r("equipe", "rede_p4_selo_tirar", { p_handle: "lula_br", p_motivo: "curto" }), "invalido:motivo");
await passa("a coordenação tira o selo, com motivo", () => r("equipe", "rede_p4_selo_tirar", { p_handle: "lula_br", p_motivo: "A pessoa pediu para sair da verificação." }));
{
  ok("sem selo, o perfil não mostra mais", (await r("bia", "rede_p4_selo_de", { p_handle: "lula_br" })) === null);
  const reg = (await dono("select acao, motivo from interno.rede_p4_selo_registro order by id")).rows;
  ok("o registro ganha a retirada com o motivo", reg.length === 2 && reg[1].acao === "tirado" && reg[1].motivo.startsWith("A pessoa pediu"));
  ok("e o nome volta a ficar bloqueado (sem dono)", (await r("equipe", "rede_p4_reservados")).find((x) => x.nome === "Lula")?.verificado === false);
  await recusa("tirar de quem não tem selo: não encontrado", () => r("equipe", "rede_p4_selo_tirar", { p_handle: "pessoa_bia", p_motivo: "motivo comprido o bastante" }), "nao_encontrado");
}
await limpar();
await dono("update interno.perfis set rede_handle_em = null where id = $1", [P.ana]);
await recusa("sem o selo, a troca para outro nome parecido volta a ser recusada", () => r("ana", "rede_perfil_handle_definir", { p_handle: "lu1a" }), "nome_reservado");
await passa("a coordenação tira “Marielle Franco” da lista", () => r("equipe", "rede_p4_reservado_tirar", { p_id: marielle?.id }));
await limpar();
await passa("fora da lista, o codinome passa", () => r("dani", "rede_codinome_definir", { p_codinome: "Marielle Franco" }));
await dono("update interno.perfis set rede_handle = 'pessoa_ana' where id = $1", [P.ana]).catch(() => undefined);

// ── 2.5 As contagens públicas por escolha ──
// ana é seguida por bia e cris há uma hora (antes do marco) e escreve um post que bia e cris apoiaram há uma hora.
for (const n of ["bia", "cris"]) {
  await dono("insert into interno.rede_seguindo (quem, segue, criado_em) values ($1, $2, now() - interval '1 hour')", [P[n], P.ana]);
}
await limpar();
const post = await passa("ana publica um post aberto", () => r("ana", "rede_publicar", { p: { texto: "Um post para contar apoios." } }));
for (const n of ["bia", "cris"]) {
  await dono("insert into interno.rede_reacoes (post, usuario, tipo, criado_em) values ($1, $2, 'apoio', now() - interval '1 hour')", [post?.id, P[n]]);
}
const seg = (quem) => r(quem, "rede_p4_seguidores_de", { p_handle: "pessoa_ana" });
const apo = (quem) => r(quem, "rede_p4_apoios_de", { p_posts: [post?.id] });
ok("chaves desligadas (padrão): seguidores não saem", JSON.stringify(await seg("dani")) === '{"mostra":false}');
ok("chaves desligadas (padrão): apoios não saem", JSON.stringify(await apo("dani")) === "{}");
{
  const perfil = await r("dani", "rede_perfil_de", { p_handle: "pessoa_ana" });
  ok("e o perfil de sempre não traz nenhum número de seguidores", !/seguidor|seguem|total/i.test(Object.keys(perfil ?? {}).join()));
  const cartao = (await dono("select interno.rede_post_v2(p, $2) as c from interno.rede_posts p where p.id = $1", [post?.id, P.dani])).rows[0]?.c;
  ok("e o cartão do post não traz o total de apoios para outra pessoa", cartao && cartao.apoios === null);
}
await limpar();
await passa("ana liga as duas chaves", () => r("ana", "rede_p4_contagens_salvar", { p_seguidores: true, p_apoios: true }));
{
  const s = await seg("dani");
  ok(`com 2 seguidoras: "menos de 3", sem número (${JSON.stringify(s)})`, s.mostra === true && s.total === null && Object.keys(s).sort().join() === "mostra,total");
  const a = await apo("dani");
  ok(`com 2 apoios: "menos de 3", sem número (${JSON.stringify(a)})`, post?.id in a && a[post?.id] === null);
}
await dono("insert into interno.rede_seguindo (quem, segue, criado_em) values ($1, $2, now() - interval '1 hour')", [P.dani, P.ana]);
await dono("insert into interno.rede_reacoes (post, usuario, tipo, criado_em) values ($1, $2, 'apoio', now() - interval '1 hour')", [post?.id, P.dani]);
ok("com 3 seguidoras: o número aparece", (await seg("fil")).total === 3);
ok("com 3 apoios: o número aparece", (await apo("fil"))[post?.id] === 3);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P.eva, P.ana]);
await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio')", [post?.id, P.eva]);
ok("quem acabou de seguir só conta no próximo marco (ninguém vê o efeito do próprio toque)", (await seg("eva")).total === 3);
ok("quem acabou de apoiar também", (await apo("eva"))[post?.id] === 3);
{
  const s = JSON.stringify(await seg("fil")) + JSON.stringify(await apo("fil"));
  ok("nenhuma lista: nenhum id de quem segue ou apoiou sai", !["bia", "cris", "dani", "eva"].some((n) => s.includes(P[n])));
}
ok("a autora não recebe pelos apoios públicos o próprio post (ela já vê no cartão)", JSON.stringify(await apo("ana")) === "{}");
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.ana, P.fil]);
ok("quem foi bloqueado não vê a contagem de seguidores", JSON.stringify(await seg("fil")) === '{"mostra":false}');
ok("nem a de apoios", JSON.stringify(await apo("fil")) === "{}");
await dono("delete from interno.rede_bloqueios");
await recusa("mais de 100 posts de uma vez: recusado", () => r("fil", "rede_p4_apoios_de", { p_posts: Array.from({ length: 101 }, () => crypto.randomUUID()) }), "invalido:posts");
await limpar();
await passa("ana desliga só a de seguidores", () => r("ana", "rede_p4_contagens_salvar", { p_seguidores: false, p_apoios: true }));
ok("desligada: a contagem de seguidores some", JSON.stringify(await seg("fil")) === '{"mostra":false}');
ok("a de apoios continua (eva ainda não entrou no marco)", (await apo("fil"))[post?.id] === 3);
await limpar();
await passa("ana desliga as duas", () => r("ana", "rede_p4_contagens_salvar", { p_seguidores: false, p_apoios: false }));
ok("as duas desligadas apagam a escolha (nada fica guardado)", (await dono("select count(*)::int n from interno.rede_p4_contagens")).rows[0].n === 0);
ok("e nenhum número sai", JSON.stringify(await apo("fil")) === "{}" && JSON.stringify(await seg("fil")) === '{"mostra":false}');
{
  // Nenhuma função da Rede (as do catálogo inteiro) devolve o total de seguidores de ana a outra pessoa: busca o número 5 (as
  // seguidoras são 4 agora + 1) num punhado de funções que mostram perfil.
  await dono("insert into interno.rede_seguindo (quem, segue, criado_em) values ($1, $2, now() - interval '1 hour')", [P.fil, P.ana]);
  const respostas = [];
  for (const [f, a] of [["rede_perfil_de", { p_handle: "pessoa_ana" }], ["rede_p4_seguidores_de", { p_handle: "pessoa_ana" }], ["rede_p4_selo_de", { p_handle: "pessoa_ana" }]]) {
    respostas.push(JSON.stringify(await r("dani", f, a).catch(() => null)));
  }
  ok("com as chaves desligadas, nenhuma das funções do perfil devolve o total", respostas.every((t) => !/"(seguidores|total|seguem)":\s*5/.test(t)));
}
await ligar(false);
await limpar();
await passa("interruptor desligado de novo: o bloqueio de nome para", () => r("bia", "rede_perfil_handle_definir", { p_handle: "lula_bia" }));

// ═══ 3. As peças da tela ═══
ok("a flag existe em RECURSOS", FLAG in RECURSOS);
ok("a flag é só pelo nome", SO_PELO_NOME.includes(FLAG));
ok('"todos" não liga a flag', ligado(FLAG, lerRecursos("todos")) === false);
ok("o nome liga a flag", ligado(FLAG, lerRecursos(`todos,${FLAG}`)) === true);
ok("o painel único descreve o interruptor", typeof NOMES_DAS_FUNCOES[FLAG]?.sobre === "string" && NOMES_DAS_FUNCOES[FLAG].sobre.length > 40);
ok("nome_reservado é erro da Rede", ERROS_DA_REDE.includes("nome_reservado"));
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  ok(`${l}: o erro nome_reservado tem texto`, typeof JSON.parse(ler(`i18n/rede/${l}.json`)).erros?.nome_reservado === "string");
}
{
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort();
  const pt = JSON.parse(ler("i18n/rede/selo-contagens/pt.json"));
  ok("pt: sem a marca de rascunho", !("_rascunho" in pt));
  ok("pt: o selo diz quem verificou e que não é apoio", /coordenação da Alumia/.test(pt.selo.explica) && /não quer dizer que a Alumia apoia/i.test(pt.selo.explica));
  ok("pt: o selo diz que é gratuito", /gratuito/i.test(pt.selo.pedir.sobre));
  ok("pt: as duas chaves com os nomes da especificação", pt.contagens.seguidores === "Mostrar quantas pessoas me seguem" && pt.contagens.apoios === "Mostrar o número de apoios nos meus posts");
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(ler(`i18n/rede/selo-contagens/${l}.json`));
    ok(`${l}: marcado como rascunho`, t._rascunho === true);
    ok(`${l}: as mesmas chaves do pt`, chaves(t).join() === chaves(pt).join());
  }
}
{
  // O cliente chama as funções que a migração cria, com os nomes dos argumentos dela.
  const chamadas = [];
  const c = criarClienteSelo(async (funcao, argumentos) => {
    chamadas.push([funcao, Object.keys(argumentos ?? {}).sort().join()]);
    return null;
  });
  await c.meu(); await c.pedir("educadora", "gabinete"); await c.desistir(); await c.seloDe("x"); await c.seguidoresDe("x"); await c.apoiosDe(["a"]);
  await c.salvarContagens(true, false); await c.fila(); await c.decidir("i", true, "", null); await c.tirar("x", "m"); await c.reservados(); await c.reservar("n"); await c.tirarReservado(1);
  const assinaturas = new Map([...semComentario.matchAll(/create or replace function public\.(rede_p4_[a-z_]+)\(([^)]*)\)/g)].map((m) => [m[1],
    m[2].split(",").map((a) => a.trim().split(/\s+/)[0]).filter(Boolean).sort().join()]));
  ok(`o cliente chama as 13 funções (${chamadas.length})`, chamadas.length === 13);
  for (const [f, a] of chamadas) ok(`o cliente chama ${f} com os argumentos certos (${a})`, assinaturas.get(f) === a);
  ok("contagemPublicada: 3 ou mais é número, nulo é menos de 3, sem escolha nada", contagemPublicada(3) === 3 && contagemPublicada(null) === "menos" && contagemPublicada(undefined) === null);
}
{
  const editar = ler("components/rede/perfil/EditarPerfil.tsx");
  const cabecalho = ler("components/rede/perfil/livre/Cabecalho.tsx");
  const pagina = ler("components/rede/perfil/livre/PaginaDoPerfil.tsx");
  const painel = ler("components/painel/alumia/admin/PainelUnico.tsx");
  ok("editar o perfil mostra o bloco do selo e das chaves só com a flag", /seloContagensLigado\(\) \? <BlocoSeloEContagens/.test(editar));
  ok("o cabeçalho do perfil mostra o selo só com a flag e fora da prévia", /!previa && seloContagensLigado\(\) \? <SeloDaPessoa/.test(cabecalho));
  ok("o perfil mostra a contagem só com a flag (sem a escolha, a frase de sempre)", /seloContagensLigado\(\) && !previa\(\) \? \(\s*<ContagemDoPerfil[^>]*semEscolha=/.test(pagina));
  // A peça ApoiosPublicos é deste grupo; o cartão do post (CartaoDaAlumia2) a
  // encaixa só para quem não escreveu, com o interruptor ligado e fora dos exemplos da prévia.
  ok("o cartão do post encaixa os apoios públicos só para quem não escreveu e com o interruptor", ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx").includes("{CONTAGENS_P4 && !exemplo && !post.meu && <ApoiosPublicos post={post.id} lang={lang} />}") && ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx").includes("const CONTAGENS_P4 = seloContagensLigado();"));
  ok("o painel único tem a aba do selo e dos nomes reservados", /SeloDasPessoas/.test(painel) && /"selo-pessoas"/.test(painel));
  const tela = ler("components/rede/selo-contagens/PecasDoSelo.tsx");
  ok("a peça dos apoios para o cartão existe", /export function ApoiosPublicos/.test(tela));
  ok("a contagem abaixo de 3 usa o PorQueSemNumero", /PorQueSemNumero/.test(tela));
  ok("o selo explica num toque (botão com aria-expanded)", /aria-expanded/.test(tela));
}

process.env.P4_SELO_FIM = "1";
console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
