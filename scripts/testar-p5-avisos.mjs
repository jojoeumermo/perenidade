// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova supabase/migracoes/20261126-p5-avisos.sql num Postgres de verdade (scripts/banco-local.mjs):
//   · Notificações (A8): os avisos da conta (entrada nova, autenticador) saem das notificações e vão para a Segurança, só da própria
//     pessoa, com o emblema; o mesmo aviso de moderação repetido vira um grupo; nos tipos sem nome, nenhum número abaixo de 3; quem
//     está invisível não aparece pelo nome;
//   · Convites (A18): 10 por mês; cancelar devolve a vaga e o código deixa de valer; nunca mais de 10 códigos que valem no mês;
//     "usados" não conta cancelado; a migração de novo não devolve duas vezes;
//   · Perfil e selos (A10): o selo da coordenação e o da equipe vêm do papel e somem com ele; nome com símbolo de selo é recusado em
//     qualquer caminho; nome quase igual ao de conta verificada abre denúncia automática sem quem denunciou; a coordenação troca
//     nome e @ sem os limites e usa o nome do instituto, e isso fica no registro; a vice e as outras pessoas, não.
// Com P5_AVISOS_ANTES=1, monta o banco SEM a migração: as provas de comportamento falham (prova de que o teste pega o defeito).
// Uso: npm run testar:p5-avisos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
const ANTES = process.env.P5_AVISOS_ANTES === "1";

let certos = 0;
const falhas = [];
const ok = (nome, cond, extra = "") => (cond ? certos++ : falhas.push(extra ? `${nome} (${extra})` : nome));
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

// ═══════════════════ 1. A migração ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261126-p5-avisos.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
if (!ANTES) {
  ok("a migração está no fim do install.sql", noFimDoInstall(SQL));
  ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
  ok("a migração não guarda nem lê endereço de rede", !/\binet\b|x-forwarded|cf-connecting|remote_addr/i.test(semComentario));
  ok("a migração não mexe na versão da Alumia nem na lista de exceções da porta", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
  ok("a migração diz de onde roda (depois do fim da R3, antes do p5-fim)", /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)[\s\S]{0,200}20261126-p5-fim\.sql vem por último/.test(SQL));
  ok("nenhum e-mail de conta no código", !/@[a-z0-9-]+\.(com|org|net)\b/i.test(semComentario));
}

const banco = ANTES ? await criarBanco({ antesDe: SQL }) : await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
if (!ANTES) {
  await espera("a migração roda de novo por cima (idempotente)", () => exec(SQL));
  const r = (await um("select interno.alumia_trancar() as r")).r;
  ok(`trancar não acha nada aberto (abertas: ${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const portas = await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_porta\\(\\)' as porta from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_aviso_seguranca_listar', 'rede_aviso_seguranca_ler', 'rede_aviso_listar', 'rede_aviso_ler', 'rede_alumia_emblemas',
      'alumia_convite_criar', 'alumia_convites_meus', 'alumia_convite_cancelar')`);
  ok("as funções públicas novas e redefinidas passam pela porta", portas.rows.length === 8 && portas.rows.every((x) => x.porta));
  const vol = await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    and p.proname in ('rede_aviso_seguranca_listar', 'rede_aviso_seguranca_ler') and p.provolatile <> 'v'`);
  ok("as funções novas que contam pedido (interno.limite) são volatile", vol.rows.length === 0);
}

// ═══════════════════ 2. Pessoas ═══════════════════
let ip = 10;
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: `198.51.100.${ip++ % 250}` });
const P = {};
const nomes = ["ana", "bia", "cid", "dani", "eva", "fe", "coord", "vice", "revi"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@p5avisos.local`, `Nome Civil ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Pessoa ${String.fromCharCode(65 + i)}`, `pessoa_${nome}`]);
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'vice'), ($3, 'revisao')", [P.coord, P.vice, P.revi]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const n of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[n]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");

// ═══════════════════ 3. Notificações (A8) ═══════════════════
{
  await zerar();
  await dono("select interno.avisar_em($1, 'Entrada nova na sua conta: Chrome em Windows, em 18/11/2026 às 14:46 (hora de Brasília). Se não foi você, abra Segurança na Alumia e desconecte todos os aparelhos.', 'conta')", [P.ana]);
  await dono("select interno.avisar_em($1, 'Um aplicativo autenticador novo foi cadastrado na sua conta. Se não foi você, troque a senha agora e fale com a coordenação.', 'conta')", [P.ana]);
  await dono("select interno.avisar_em($1, 'Um aplicativo autenticador novo foi cadastrado na sua conta. Se não foi você, troque a senha agora e fale com a coordenação.', 'conta')", [P.ana]);
  const lista = await espera("Notificações: a lista abre", () => rpc(como(P.ana), "rede_aviso_listar", {}), (r) => Array.isArray(r?.itens));
  ok("Notificações: os avisos da conta não aparecem nas notificações", lista && !lista.itens.some((i) => /Entrada nova|autenticador/.test(i.texto ?? "")));
  await espera("Notificações: o número do menu não conta os avisos da conta", () => rpc(como(P.ana), "rede_aviso_contar"), (n) => n === 0);
  const seg = await espera("Segurança: os avisos da conta moram lá", () => rpc(como(P.ana), "rede_aviso_seguranca_listar"), (r) => r?.itens?.length === 2);
  ok("Segurança: o mesmo aviso no mesmo dia vem uma vez, com quantas vezes", seg?.itens?.some((i) => /autenticador/.test(i.texto) && i.vezes === 2));
  ok("Segurança: dois não lidos", seg?.nao_lidos === 2);
  await espera("Segurança: o emblema do menu conta os não lidos", () => rpc(como(P.ana), "rede_alumia_emblemas"), (r) => r?.seguranca === 2);
  await espera("Segurança: outra pessoa não vê os avisos da Ana", () => rpc(como(P.bia), "rede_aviso_seguranca_listar"), (r) => r?.itens?.length === 0);
  await espera("Notificações: 'marcar tudo como lido' não mexe nos avisos de segurança", () => rpc(como(P.ana), "rede_aviso_ler", { p_id: null }), (r) => r?.ok);
  await espera("… eles continuam não lidos na Segurança", () => rpc(como(P.ana), "rede_aviso_seguranca_listar"), (r) => r?.nao_lidos === 2);
  await espera("Segurança: marcar como lidos", () => rpc(como(P.ana), "rede_aviso_seguranca_ler"), (r) => r?.ok);
  await espera("… e o emblema zera", () => rpc(como(P.ana), "rede_alumia_emblemas"), (r) => r?.seguranca === 0);
  await recusa("Segurança: visitante não lê", () => rpc({ papel: "anon" }, "rede_aviso_seguranca_listar"), "");
}
{
  // O mesmo aviso de moderação quatro vezes (imagem 31): um grupo só.
  await zerar();
  const texto = "Um post seu foi retirado da Rede (regra: norma 1). Decisão de uma pessoa da moderação. Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: teste";
  for (let i = 0; i < 4; i++) await dono("select interno.rede3_mod_avisar_afetado($1, $2)", [P.bia, texto]);
  const r = await espera("moderação repetida: a lista abre", () => rpc(como(P.bia), "rede_aviso_listar", {}), (x) => Array.isArray(x?.itens));
  const iguais = r?.itens?.filter((i) => i.texto === texto) ?? [];
  ok(`moderação repetida: o mesmo aviso aparece uma vez (apareceu ${iguais.length})`, iguais.length === 1 && iguais[0].total === 4);
  await espera("moderação repetida: um não lido no número", () => rpc(como(P.bia), "rede_aviso_contar"), (n) => n === 1);
  await espera("moderação repetida: ler o grupo lê os quatro", () => rpc(como(P.bia), "rede_aviso_ler", { p_id: iguais[0]?.id ?? null }), (x) => x?.nao_lidos === 0);
}
{
  // Acender (apoio): nunca quem, e nenhum número abaixo de 3.
  await zerar();
  const post = (await um("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'Plenária no sábado.', 'membros', 'publico') returning id", [P.cid])).id;
  const acender = (quem) => dono("select interno.rede3_aviso_criar($1, 'apoio', $2, null, $3, null)", [P.cid, post, P[quem]]);
  await acender("ana");
  await acender("bia");
  const doApoio = async () => (await rpc(como(P.cid), "rede_aviso_listar", {}))?.itens?.find((i) => i.tipo === "apoio");
  const dois = await espera("acender: a notificação existe", doApoio, (i) => !!i);
  ok(`acender com 2 pessoas: o banco não manda o 2 (pessoas=${dois?.pessoas}, total=${dois?.total})`, dois?.pessoas === 1 && dois?.total === 1);
  ok("acender: nunca o nome de quem acendeu", Array.isArray(dois?.atores) && dois.atores.length === 0);
  await acender("dani");
  const tres = await espera("acender com 3 pessoas: o número aparece", doApoio, (i) => i?.pessoas === 3);
  ok("acender com 3: ainda sem nome", tres?.atores?.length === 0);
}
{
  // Seguir: o nome aparece, menos de quem está invisível.
  await zerar();
  await dono("update interno.perfis set rede_modo = 'invisivel', rede_invisivel = true where id = $1", [P.eva]);
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [P.dani, P.eva]);
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [P.dani, P.fe]);
  const s = await espera("seguidores: a notificação existe", async () => (await rpc(como(P.dani), "rede_aviso_listar", {}))?.itens?.find((i) => i.tipo === "seguidor"), (i) => !!i);
  const nomesDosAtores = (s?.atores ?? []).filter(Boolean);
  ok(`seguidores: quem está visível aparece, a invisível não (${JSON.stringify(s?.atores)})`, nomesDosAtores.length === 1 && s.atores.includes(null));
  await dono("update interno.perfis set rede_modo = 'aberto', rede_invisivel = false where id = $1", [P.eva]);
}

// ═══════════════════ 4. Convites (A18) ═══════════════════
{
  await zerar();
  const meus = (quem) => rpc(como(P[quem]), "alumia_convites_meus");
  await espera("convites: o teto é 10 por mês", () => meus("ana"), (r) => r?.teto === 10 && r?.restam === 10);
  const gerados = [];
  for (let i = 0; i < 3; i++) gerados.push(await rpc(como(P.ana), "alumia_convite_criar"));
  await espera("convites: 3 gerados, restam 7", () => meus("ana"), (r) => r?.restam === 7 && r?.usados === 0);
  const cancelado = await espera("convites: cancelar devolve a vaga", () => rpc(como(P.ana), "alumia_convite_cancelar", { p_id: gerados[0].id }), (r) => r?.ok && r?.restam === 8);
  ok("convites: o cancelar diz quantos restam", cancelado?.restam === 8);
  await espera("convites: na lista, restam 8, nenhum usado, e o cancelado saiu", () => meus("ana"), (r) => r?.restam === 8 && r?.usados === 0 && r?.convites?.length === 2 && !r.convites.some((c) => c.id === gerados[0].id));
  ok("convites: o cancelado sai do banco (nada fica dizendo que existiu)", Number((await um("select count(*) n from interno.alumia_convites where id = $1", [gerados[0].id])).n) === 0);
  await espera("convites: o código cancelado não vale mais", () => rpc({ papel: "service_role" }, "alumia_convite_conferir", { p_codigo: gerados[0].codigo }), (r) => r?.valido === false);
  await espera("convites: o código aberto vale", () => rpc({ papel: "service_role" }, "alumia_convite_conferir", { p_codigo: gerados[1].codigo }), (r) => r?.valido === true);
  await recusa("convites: cancelar de novo não devolve outra vaga", () => rpc(como(P.ana), "alumia_convite_cancelar", { p_id: gerados[0].id }), "nao_encontrado");
  await recusa("convites: ninguém cancela o convite de outra pessoa", () => rpc(como(P.bia), "alumia_convite_cancelar", { p_id: gerados[1].id }), "nao_encontrado");
  // Usado: sai do banco na hora (como a entrada faz).
  await dono("delete from interno.alumia_convites where id = $1", [gerados[1].id]);
  await espera("convites: o usado conta como usado", () => meus("ana"), (r) => r?.usados === 1 && r?.restam === 8);
  // Gera até acabar: nunca mais de 10 códigos que valem (abertos ou usados) no mês, mesmo cancelando.
  for (let i = 0; i < 30; i++) {
    await zerar();
    try {
      const c = await rpc(como(P.ana), "alumia_convite_criar");
      if (i % 3 === 0) await rpc(como(P.ana), "alumia_convite_cancelar", { p_id: c.id });
    } catch {
      break;
    }
  }
  const valem = Number((await um("select count(*) n from interno.alumia_convites where criado_por = $1 and situacao = 'aberto'", [P.ana])).n) + 1;
  ok(`convites: no máximo 10 códigos que valem no mês (${valem})`, valem === 10);
  await recusa("convites: depois do teto, recusa", () => rpc(como(P.ana), "alumia_convite_criar"), "teto_de_convites");
  if (!ANTES) {
    const antes = (await um("select gerados from interno.alumia_convite_cotas where criado_por = $1", [P.ana])).gerados;
    await exec(SQL);
    const depois = (await um("select gerados from interno.alumia_convite_cotas where criado_por = $1", [P.ana])).gerados;
    ok(`convites: rodar a migração de novo não devolve vaga de novo (${antes} → ${depois})`, antes === depois);
    // Um cancelado de antes da migração (ficava no banco e gastava a vaga): a migração tira e devolve a vaga, uma vez só.
    await dono("insert into interno.alumia_convite_cotas (criado_por, mes) values ($1, interno.alumia_convite_mes()) on conflict do nothing", [P.bia]);
    await dono("update interno.alumia_convite_cotas set gerados = 2 where criado_por = $1 and mes = interno.alumia_convite_mes()", [P.bia]);
    await dono("insert into interno.alumia_convites (selo, criado_por, situacao) values (interno.selo(md5(random()::text)), $1, 'cancelado'), (interno.selo(md5(random()::text)), $1, 'aberto')", [P.bia]);
    await exec(SQL);
    await exec(SQL);
    await espera("convites: o cancelado de antes sai e devolve a vaga, uma vez só", () => rpc(como(P.bia), "alumia_convites_meus"), (r) => r?.no_mes === 1 && r?.restam === 9 && r?.convites?.length === 1);
    await dono("update interno.configuracoes set valor = jsonb_set(valor, '{convites_mes}', '5'::jsonb) where chave = 'alumia_cadastro'");
    await exec(SQL);
    ok("convites: o número que a coordenação escolheu no painel fica", (await um("select valor ->> 'convites_mes' as n from interno.configuracoes where chave = 'alumia_cadastro'")).n === "5");
    await dono("update interno.configuracoes set valor = jsonb_set(valor, '{convites_mes}', '10'::jsonb) where chave = 'alumia_cadastro'");
  }
}

// ═══════════════════ 5. Perfil e selos (A10) ═══════════════════
{
  await zerar();
  const selos = async (quem) => (await um("select interno.rede3_perfil_selos($1) as s", [P[quem]])).s;
  ok("selo: a coordenação tem o selo da coordenação e o da equipe", (await selos("coord")).includes("coordenacao") && (await selos("coord")).includes("equipe"));
  ok("selo: a vice tem o da equipe, não o da coordenação", (await selos("vice")).includes("equipe") && !(await selos("vice")).includes("coordenacao"));
  ok("selo: quem é da equipe ganha o selo automaticamente", (await selos("revi")).includes("equipe"));
  ok("selo: quem não é da equipe não tem", !(await selos("ana")).includes("equipe"));
  await dono("delete from interno.papeis where usuario = $1", [P.revi]);
  ok("selo: quem sai da equipe perde o selo", !(await selos("revi")).includes("equipe"));

  // Símbolo de selo em nome: recusado em qualquer caminho.
  for (const nome of ["Ana ✓", "Ana ✔", "Ana ☑", "Ana ✅", "Ana 🔵", "Ana ☑️", "Ana Verificada", "Ana Oficial"]) {
    await recusa(`nome com selo falso (${nome}) não grava nem direto no banco`, () => dono("update interno.perfis set rede_codinome = $2 where id = $1", [P.ana, nome]), "nome_com_selo");
  }
  await recusa("codinome com 'Oficial' pela função", () => rpc(como(P.ana), "rede_codinome_definir", { p_codinome: "Bia Oficial" }), "nome_com_selo");
  await espera("um nome comum continua passando", () => rpc(como(P.ana), "rede_codinome_definir", { p_codinome: "Ana do Bairro" }), (r) => r?.nome === "Ana do Bairro");

  // Nome quase igual ao de conta verificada: denúncia automática, sem quem denunciou.
  await zerar();
  await dono("update interno.perfis set rede_codinome = 'Rosa Vermelha' where id = $1", [P.vice]);
  await espera("nome parecido: a troca passa (a moderação decide)", () => rpc(como(P.bia), "rede_codinome_definir", { p_codinome: "R0sa Verme1ha" }), (r) => r?.nome === "R0sa Verme1ha");
  const den = await dono("select quem, alvo_tipo, alvo, texto from interno.rede_denuncias where alvo = $1", [P.bia]);
  ok(`nome parecido: a moderação recebe uma denúncia automática (${den.rows.length})`, den.rows.length === 1 && den.rows[0].quem === null && den.rows[0].alvo_tipo === "perfil");
  ok("nome parecido: a denúncia não diz de quem é o nome parecido", den.rows.length === 1 && !den.rows[0].texto.includes("Rosa Vermelha") && !den.rows[0].texto.includes(P.vice));
  await rpc(como(P.cid), "rede_codinome_definir", { p_codinome: "Girassol Azul" });
  ok("nome diferente: nenhuma denúncia", Number((await um("select count(*) n from interno.rede_denuncias where alvo = $1", [P.cid])).n) === 0);

  // Poderes da coordenação: pelo papel, no registro; a vice e as outras pessoas não.
  await zerar();
  await espera("coordenação: usa o nome do instituto", () => rpc(como(P.coord), "rede_codinome_definir", { p_codinome: "Instituto Lúcia" }), (r) => r?.nome === "Instituto Lúcia");
  await recusa("vice: não usa o nome do instituto", () => rpc(como(P.vice), "rede_codinome_definir", { p_codinome: "Lúcia Coordenação" }), "codinome_reservado");
  await recusa("outra pessoa: não usa o nome do instituto", () => rpc(como(P.dani), "rede_codinome_definir", { p_codinome: "Instituto Vermelho" }), "codinome_reservado");
  await recusa("coordenação sem o autenticador na sessão: não tem o poder", () => rpc(como(P.coord, "aal1"), "rede_codinome_definir", { p_codinome: "Instituto Lúcia Oficial" }), "");
  await espera("coordenação: troca o @ duas vezes seguidas", async () => {
    await rpc(como(P.coord), "rede_perfil_handle_definir", { p_handle: "institutolucia" });
    return rpc(como(P.coord), "rede_perfil_handle_definir", { p_handle: "coordenacao_il" });
  }, (r) => r?.handle === "coordenacao_il");
  await rpc(como(P.dani), "rede_perfil_handle_definir", { p_handle: "dani_um" });
  await recusa("outra pessoa: espera 30 dias para trocar o @ de novo", () => rpc(como(P.dani), "rede_perfil_handle_definir", { p_handle: "dani_dois" }), "handle_recente");
  for (let i = 0; i < 14; i++) await rpc(como(P.coord), "rede_codinome_definir", { p_codinome: `Coordenação ${String.fromCharCode(65 + i)}` }).catch(() => null);
  ok("coordenação: troca o nome quantas vezes quiser", (await um("select rede_codinome from interno.perfis where id = $1", [P.coord])).rede_codinome === "Coordenação N");
  const reg = await dono("select acao from interno.auditoria where acao like 'alumia_coordenacao_%'");
  ok(`coordenação: os usos do poder ficam no registro (${reg.rows.length})`, reg.rows.some((r) => r.acao === "alumia_coordenacao_codinome") && reg.rows.some((r) => r.acao === "alumia_coordenacao_handle"));
  const regNome = await dono("select detalhes::text as d from interno.auditoria where acao like 'alumia_coordenacao_%'");
  ok("coordenação: o registro não guarda o nome escolhido", regNome.rows.every((r) => !/Coordenação|Instituto/.test(r.d)));
}

console.log(`testar-p5-avisos${ANTES ? " (banco SEM a migração)" : ""}: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗ " + f);
process.exit(falhas.length ? 1 : 0);
