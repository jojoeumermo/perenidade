// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a migração 20261114-alumia-o8-meusdados.sql (frente 8C: meus dados) num Postgres de verdade (scripts/banco-local.mjs),
// rodada DUAS vezes sobre o install.sql:
//   exportar   pede o segundo fator dos últimos 10 minutos, vale uma vez por dia e não leva nada de outra pessoa (nem o id, nem o
//              @ de quem curtiu, seguiu ou silenciou; só números a partir de 3);
//   apagar     com o segundo fator e o @ escrito; a conta some da rede na hora (perfil invisível, posts e stories fora do ar, nada
//              novo sai dela), o cancelar devolve só o que o pedido tirou, e no fim do prazo a rodada apaga de vez;
//   de vez     o que outras pessoas responderam ou citaram vira "[post apagado]" sem autora; a mídia vai para a fila do servidor; e
//              a VARREDURA de todas as tabelas interno.* (e auth.users) prova que nada da pessoa sobra: nem o id em coluna uuid, nem
//              o id, o e-mail ou o @ em coluna de texto. Só os dois registros que não se apagam (moderação e painel) podem citar o id;
//   painel     só número e prazo, só para a coordenação;
//   P18        conta_meus_dados sem as linhas em que a pessoa é alvo de outra e sem quem agiu.
// Uso: npm run testar:alumia-o8-meusdados
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

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
const sql = ler("supabase/migracoes/20261114-alumia-o8-meusdados.sql");
ok("toda função security definer tem search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 15 && funcoes.filter((f) => /security definer/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("toda função public é security definer", (() => {
  const publicas = sql.match(/create or replace function public\.[^(]+\([\s\S]*?\$\$/g) ?? [];
  return publicas.length === 8 && publicas.every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não apaga tabela nem coluna", !/drop table|drop column/i.test(sql));
ok("nenhum endereço de rede é lido nem guardado", !/x-forwarded-for|cf-connecting-ip|inet\b|interno\.origem\(\)/i.test(sql));

// ═══════════════════ 1. Banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
await espera("as funções da tela passam pela porta; as da fila de arquivos não são da API", async () => um(`select
    pg_get_functiondef('public.rede_meusdados_exportar()'::regprocedure) as e, pg_get_functiondef('public.rede_meusdados_apagar(text)'::regprocedure) as a,
    pg_get_functiondef('public.alumia_painel_apagamentos()'::regprocedure) as p,
    has_function_privilege('authenticated', 'public.rede_meusdados_arquivos_lista(integer)', 'execute') as lista_aut,
    has_function_privilege('service_role', 'public.rede_meusdados_arquivos_lista(integer)', 'execute') as lista_serv,
    has_function_privilege('authenticated', 'interno.alumia_md_apagar_de_vez(uuid)', 'execute') as de_vez_aut`),
  (r) => r.e.includes("alumia_porta") && r.a.includes("alumia_porta") && r.p.includes("alumia_porta") && !r.lista_aut && r.lista_serv && !r.de_vez_aut);

let ip = 10;
const agora = () => Math.floor(Date.now() / 1000);
/** A sessão de uma conta. `fator`: segundos desde o código do aplicativo (nulo = sessão aal2 sem código recente). */
const como = (sub, fator = null) => ({ papel: "authenticated", sub, aal: "aal2", fator, ip: `198.51.100.${ip++ % 250}` });
/** Como banco.rpc, mas com "amr" no token (o serviço de contas põe ali a hora de cada método de entrada). */
const chamar = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const amr = [{ method: "password", timestamp: agora() - 3600 }, ...(quem.fator === null || quem.fator === undefined ? [] : [{ method: "totp", timestamp: agora() - quem.fator }])];
    const claims = JSON.stringify({ role: "authenticated", sub: quem.sub, aal: quem.aal ?? "aal2", amr });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify({ "x-forwarded-for": quem.ip })]);
    await banco.pg.exec("set role authenticated");
    try {
      const nomes = Object.keys(argumentos);
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, nomes.map((n) => argumentos[n]))).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const servico = (texto, valores = []) =>
  banco.exclusivo(async () => {
    await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "service_role" })]);
    await banco.pg.exec("set role service_role");
    try {
      return (await banco.pg.query(texto, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });

const P = {};
const nomes = ["dona", "amiga", "outra", "coord"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o8.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o8`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('passe-livre', 'Passe Livre', 'lutas', 'aberta') on conflict (slug) do nothing");

// ── O que a dona fez (e o que outras pessoas fizeram com ela) ──
const post = async (autor, texto, extra = {}) =>
  (await um(
    "insert into interno.rede_posts (autor, texto, publico, resposta_a, root_id, quote_of, comunidade) values ($1, $2, 'internet', $3, $4, $5, $6) returning id",
    [autor, texto, extra.resposta_a ?? null, extra.root_id ?? null, extra.quote_of ?? null, extra.comunidade ?? null],
  )).id;
const SO = await post(P.dona, "Um post da dona que ninguém respondeu.");
const RAIZ = await post(P.dona, "A dona abre uma conversa.", { comunidade: "passe-livre" });
const DELA = await post(P.dona, "A dona responde a si mesma.", { resposta_a: RAIZ, root_id: RAIZ });
const DA_AMIGA = await post(P.amiga, "A amiga responde à resposta da dona.", { resposta_a: DELA, root_id: RAIZ });
const CITADO = await post(P.dona, "Um post da dona que a outra citou.");
const CITA = await post(P.outra, "A outra cita a dona.", { quote_of: CITADO });
const MODERADO = await post(P.dona, "Um post que a moderação já tinha tirado do ar.");
await dono("update interno.rede_posts set oculto = true where id = $1", [MODERADO]);
await dono("insert into interno.rede_midia (post, caminho, tipo, alt) values ($1, $2, 'image/webp', 'faixa no ato')", [SO, `${P.dona}/11111111-1111-4111-8111-111111111111.webp`]);
await dono("insert into interno.rede_midia (post, caminho, tipo, alt) values ($1, $2, 'image/webp', 'foto')", [RAIZ, `${P.dona}/22222222-2222-4222-8222-222222222222.webp`]);
await dono("insert into interno.rede_post_edicoes (post, texto_anterior) values ($1, 'versão antiga com erro')", [RAIZ]);
await dono("insert into interno.rede_stories (autor, publico, fundo, texto, midia_caminho, expira_em) values ($1, 'membros', 'imagem', 'story da dona', $2, now() + interval '20 hours')", [P.dona, `${P.dona}/33333333-3333-4333-8333-333333333333.webp`]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($3, $1)", [P.dona, P.outra, P.amiga]);
await dono("insert into interno.rede_salvos (usuario, post) values ($1, $2)", [P.dona, CITA]);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ('passe-livre', $1, 'membro', 'ativo')", [P.dona]);
await dono("insert into interno.rede_apoios (post, usuario) values ($1, $2)", [RAIZ, P.amiga]);
await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [P.outra, P.dona]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.dona, P.coord]);
await dono("insert into interno.avisos (para, texto, categoria, tipo, post, alvo, ator) values ($1, 'Alguém começou a seguir você na Alumia.', 'rede', 'seguidor', null, null, $2)", [P.dona, P.amiga]);
await dono("insert into interno.avisos (para, texto, categoria, tipo, ator_remoto) values ($1, 'Alguém de fora curtiu seu post', 'rede', 'fed_curtida', 'https://social.exemplo.org/users/quem_curtiu')", [P.dona]);
await dono("insert into interno.avisos (para, texto, categoria, tipo) values ($1, 'Um post seu foi retido pela moderação. Motivo: dado pessoal.', 'conta', 'moderacao')", [P.dona]);
await dono("insert into interno.avisos (para, texto, categoria, tipo, ator) values ($1, 'A dona apoiou o seu post.', 'rede', 'apoio', $2)", [P.amiga, P.dona]);
await dono("insert into interno.rede_perfil_campos (usuario, ordem, rotulo, valor) values ($1, 1, 'Luta', 'Passe livre')", [P.dona]);
await dono("insert into interno.rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em, chave_publica, chave_privada) values ($1, 'dona_o8', true, 2, now(), 'PUBLICA-DE-TESTE', 'PRIVADA-DE-TESTE')", [P.dona]);
await dono("insert into interno.rede_fed_fila (perfil, tipo, objeto, destino) values ($1, 'create', $2, 'https://social.exemplo.org/inbox')", [P.dona, SO]);
await dono("insert into interno.auditoria (quem, nome, acao, alvo) values ($1, 'Nome Civil dona', 'teste_da_dona', '')", [P.dona]);
await dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem) values ('remover', 'post', $1, 'r1', 'motivo da moderação', $2)", [MODERADO, P.coord]);

// ═══════════════════ 2. Exportar ═══════════════════
await recusa("exportar sem o código recente do aplicativo é recusado", () => chamar(como(P.dona, null), "rede_meusdados_exportar"), "confirme_segundo_fator");
await recusa("código de 20 minutos atrás também não vale", () => chamar(como(P.dona, 20 * 60), "rede_meusdados_exportar"), "confirme_segundo_fator");
const copia = await espera("com o código confirmado agora, a cópia sai", () => chamar(como(P.dona, 30), "rede_meusdados_exportar"), (r) => r?.formato === "alumia-meus-dados/1");
if (copia) {
  const texto = JSON.stringify(copia);
  ok("a cópia traz os posts da dona (todos, até o que a moderação tirou do ar)", copia.posts.length === 5 && copia.posts.some((p) => p.id === MODERADO && p.fora_do_ar));
  ok("a cópia traz a versão anterior e a mídia do post", copia.posts.some((p) => p.versoes_anteriores.length === 1 && p.midias.length === 1));
  ok("a cópia traz o story, os salvos, a comunidade e o campo do perfil", copia.stories.length === 1 && copia.salvos.length === 1 && copia.comunidades.length === 1 && copia.campos_do_perfil.length === 1);
  ok("quem a dona segue sai pelo @ (é escolha dela)", copia.seguindo.length === 1 && copia.seguindo[0].quem === "@outra_o8");
  ok("seguidores: só o número, e abaixo de 3 nem o número", copia.seguidores.quantos === null);
  ok("apoios e respostas de outras pessoas abaixo de 3: nulos", copia.posts.every((p) => p.apoios === null && p.respostas_de_outras_pessoas === null));
  ok("nenhum id de outra pessoa na cópia", ![P.amiga, P.outra, P.coord].some((id) => texto.includes(id)));
  ok("nem o @ de quem segue a dona ou a silenciou", !texto.includes("amiga_o8") && !texto.includes("Codinome 2"));
  ok("nem o endereço de quem curtiu de fora", !texto.includes("quem_curtiu"));
  ok("o aviso de seguidor vem sem texto; o da moderação vem inteiro", copia.avisos.some((a) => a.tipo === "seguidor" && a.texto === null) && copia.avisos.some((a) => a.tipo === "moderacao" && /retido/.test(a.texto)));
  ok("o bloqueio que a dona fez sai pelo @", copia.bloqueei.length === 1 && copia.bloqueei[0].quem === "@coord_o8");
  ok("a decisão da moderação vem sem quem decidiu", copia.decisoes_da_moderacao_sobre_mim.length === 1 && !("quem" in copia.decisoes_da_moderacao_sobre_mim[0]));
  ok("a lista de mídias tem só arquivos da pasta dela", copia.midias.length === 3 && copia.midias.every((m) => m.caminho.startsWith(`${P.dona}/`)));
  ok("a chave da federação não sai na cópia", !texto.includes("PRIVADA-DE-TESTE") && !texto.includes("PUBLICA-DE-TESTE"));
  ok("as conversas privadas não entram (texto que explica)", typeof copia.conversas_privadas === "string");
}
await recusa("uma cópia por dia", () => chamar(como(P.dona, 30), "rede_meusdados_exportar"), "muitos_pedidos");
await espera("a situação diz que a cópia de hoje já saiu", () => chamar(como(P.dona, null), "rede_meusdados_situacao"), (r) => r.exportou_hoje === true && r.palavra === "@dona_o8" && r.tem_funcao === false && r.apagamento === null && r.fator_recente === false);
await espera("com o código recente, a situação diz que o fator está fresco", () => chamar(como(P.dona, 60), "rede_meusdados_situacao"), (r) => r.fator_recente === true);

// ── P18 estendido: a cópia do site inteiro ──
// A outra aparece na cópia da dona só porque a dona a segue (rede_seguindo.quem): é escolha da dona. Quem a silenciou (a outra) e
// quem a seguiu e apoiou (a amiga) não aparecem.
await espera("conta_meus_dados não leva quem silenciou a dona nem quem agiu", () => chamar(como(P.dona, null), "conta_meus_dados"), (r) => {
  const texto = JSON.stringify(r);
  const outraSoNoSeguir = JSON.stringify({ ...r, "rede_seguindo.quem": [] }).includes(P.outra) === false;
  return !("rede_silenciados.pessoa" in r) && !texto.includes(P.amiga) && outraSoNoSeguir && !texto.includes("quem_curtiu") && (r["avisos.para"] ?? []).length === 3;
});
await espera("e a de quem silenciou continua levando o silenciar que ela mesma fez", () => chamar(como(P.outra, null), "conta_meus_dados"), (r) => (r["rede_silenciados.usuario"] ?? []).length === 1);
// Outras pessoas agindo sobre a dona: a sanção da coordenação (por), o agradecimento e o pedido de amizade da amiga (de → para).
await dono("insert into interno.alumia_sancoes (usuario, tipo, motivo, por, ate) values ($1, 'suspensao', 'Sanção de teste dada pela coordenação.', $2, now() + interval '1 day')", [P.dona, P.coord]);
await dono("insert into interno.agradecimentos (de, para, texto) values ($1, $2, 'Obrigada pela ajuda no ato.')", [P.amiga, P.dona]);
await dono("insert into interno.amizades (de, para) values ($1, $2)", [P.amiga, P.dona]);
await espera("a cópia do site inteiro não leva o id de nenhuma outra pessoa (nem quem sancionou, nem quem agradeceu, nem quem a dona segue)", () => chamar(como(P.dona, null), "conta_meus_dados"), (r) => {
  const texto = JSON.stringify(r);
  return ![P.amiga, P.outra, P.coord].some((id) => texto.includes(id)) && (r["alumia_sancoes.usuario"] ?? []).length === 1
    && !("agradecimentos.para" in r) && !("amizades.para" in r) && !texto.includes("Obrigada pela ajuda");
});
await espera("a regra é pelo valor: qualquer coluna (ou lista, como a de quem viu) com o id de outra conta sai; o resto fica", () => dono(
  "select interno.alumia_md_sem_terceiros(jsonb_build_object('autor', $1::text, 'qualquer', $2::text, 'visto_por', jsonb_build_array($3::text), 'por', null, 'nomeado_por', $1::text, 'de', 'x', 'origem', repeat('a', 64), 'texto', 'meu texto', 'post', gen_random_uuid()::text), $1::uuid) as r",
  [P.dona, P.amiga, P.coord]), (r) => Object.keys(r.rows[0].r).sort().join() === "autor,post,texto");

// ═══════════════════ 3. Apagar ═══════════════════
await recusa("apagar sem o código recente é recusado", () => chamar(como(P.dona, null), "rede_meusdados_apagar", { p_palavra: "@dona_o8" }), "confirme_segundo_fator");
await recusa("a palavra errada é recusada", () => chamar(como(P.dona, 30), "rede_meusdados_apagar", { p_palavra: "@outra_o8" }), "confirmacao_errada");
await recusa("quem tem função na casa não apaga por aqui", () => chamar(como(P.coord, 30), "rede_meusdados_apagar", { p_palavra: "@coord_o8" }), "tem_funcao");
const pedido = await espera("com o código e o @, o pedido é feito (7 dias)", () => chamar(como(P.dona, 30), "rede_meusdados_apagar", { p_palavra: " @DONA_o8 " }), (r) => {
  const dias = (new Date(r.apagar_em) - new Date(r.pedido_em)) / 86_400_000;
  return dias > 6.99 && dias < 7.01;
});
await espera("pedir de novo devolve o mesmo prazo", () => chamar(como(P.dona, 30), "rede_meusdados_apagar", { p_palavra: "@dona_o8" }), (r) => r.apagar_em === pedido?.apagar_em);
await espera("na hora: o perfil fica invisível, todos os posts e o story saem do ar e a federação desliga", () => um(`select
    (select rede_invisivel from interno.perfis where id = $1) as invisivel,
    (select count(*)::int from interno.rede_posts where autor = $1 and not oculto) as no_ar,
    (select count(*)::int from interno.rede_stories where autor = $1 and not retido) as stories_no_ar,
    (select ligado from interno.rede_fed_atores where perfil = $1) as fed,
    interno.rede2_pode_ver((select p from interno.rede_posts p where id = $2), $3) as amiga_ve`, [P.dona, RAIZ, P.amiga]),
  (r) => r.invisivel === true && r.no_ar === 0 && r.stories_no_ar === 0 && r.fed === false && r.amiga_ve === false);
await espera("a resposta da amiga continua no ar", () => um("select interno.rede2_pode_ver((select p from interno.rede_posts p where id = $1), $2) as v", [DA_AMIGA, P.outra]), (r) => r.v === true);
await recusa("nada novo sai da conta: post", () => post(P.dona, "tentando postar no prazo"), "conta_apagando");
await recusa("nada novo sai da conta: seguir", () => dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P.dona, P.coord]), "conta_apagando");
await espera("a situação mostra o pedido em curso", () => chamar(como(P.dona, null), "rede_meusdados_situacao"), (r) => r.apagamento?.apagar_em === pedido?.apagar_em);

// ── Painel: só número e prazo ──
await recusa("o painel de apagamentos não é para qualquer conta", () => chamar(como(P.amiga, null), "alumia_painel_apagamentos"), "sem_permissao");
await espera("a coordenação vê só quantos e quando vencem", () => chamar(como(P.coord, null), "alumia_painel_apagamentos"), (r) => {
  const texto = JSON.stringify(r);
  return r.total === 1 && r.por_dia.length === 1 && r.por_dia[0].n === 1 && !texto.includes(P.dona) && !texto.includes("dona");
});

// ── Cancelar ──
await espera("cancelar dentro do prazo", () => chamar(como(P.dona, null), "rede_meusdados_cancelar"), (r) => r.ok && r.havia && r.fediverso_desligado === true);
await espera("volta ao ar só o que o pedido tirou (o post que a moderação tirou continua fora)", () => um(`select
    (select rede_invisivel from interno.perfis where id = $1) as invisivel,
    (select count(*)::int from interno.rede_posts where autor = $1 and oculto) as fora,
    (select oculto from interno.rede_posts where id = $2) as moderado,
    (select count(*)::int from interno.rede_stories where autor = $1 and retido) as stories_fora,
    (select count(*)::int from interno.alumia_apagamentos) as pedidos`, [P.dona, MODERADO]),
  (r) => r.invisivel === false && r.fora === 1 && r.moderado === true && r.stories_fora === 0 && r.pedidos === 0);
await espera("depois de cancelar, posta de novo", () => post(P.dona, "Voltei."), (id) => Boolean(id));
await dono("delete from interno.rede_posts where texto = 'Voltei.'");
await espera("pede de novo", () => chamar(como(P.dona, 30), "rede_meusdados_apagar", { p_palavra: "@dona_o8" }), (r) => Boolean(r.apagar_em));
await dono("update interno.alumia_apagamentos set apagar_em = now() - interval '1 minute' where usuario = $1", [P.dona]);
await recusa("passado o prazo, não cancela mais", () => chamar(como(P.dona, null), "rede_meusdados_cancelar"), "prazo_passou");

// ═══════════════════ 4. A rodada: de vez ═══════════════════
const EMAIL = "dona@o8.local";
await espera("a rodada apaga de vez a conta vencida", async () => (await um("select interno.alumia_md_rodada() as r")).r, (r) => r.apagadas === 1 && r.falhas === 0);
await espera("a conversa da amiga continua; o post da dona acima dela vira \"[post apagado]\" sem autora", () => um(`select
    (select count(*)::int from interno.rede_posts where id = $1) as amiga,
    (select row_to_json(p) from (select autor, texto, titulo, corpo, oculto, apagado_em is not null as apagado from interno.rede_posts where id = $2) p) as dela,
    (select row_to_json(p) from (select autor, texto from interno.rede_posts where id = $3) p) as raiz,
    (select count(*)::int from interno.rede_midia where post = $3) as midia_da_raiz,
    (select count(*)::int from interno.rede_post_edicoes where post = $3) as edicoes`, [DA_AMIGA, DELA, RAIZ]),
  (r) => r.amiga === 1 && r.dela?.autor === null && r.dela.texto === "[post apagado]" && r.dela.oculto && r.dela.apagado && r.raiz?.autor === null && r.raiz.texto === "[post apagado]" && r.midia_da_raiz === 0 && r.edicoes === 0);
await espera("o post citado vira \"[post apagado]\"; a citação da outra continua apontando para ele", () => um("select (select texto from interno.rede_posts where id = $1) as citado, (select quote_of from interno.rede_posts where id = $2) as cita", [CITADO, CITA]),
  (r) => r.citado === "[post apagado]" && r.cita === CITADO);
await espera("o post que ninguém respondeu sai de vez", () => um("select count(*)::int as n from interno.rede_posts where id = $1", [SO]), (r) => r.n === 0);
await espera("a apoiadora não perdeu nada dela; a dona não está mais em lugar nenhum de seguir", () => um("select (select count(*)::int from interno.rede_seguindo where quem = $1 or segue = $1) as seguir, (select count(*)::int from auth.users where id = $1) as conta", [P.dona]), (r) => r.seguir === 0 && r.conta === 0);

// ── A fila de arquivos ──
await recusa("a fila de arquivos não é para conta comum", () => chamar(como(P.amiga, null), "rede_meusdados_arquivos_lista"), "permission denied");
const fila = await espera("os três arquivos da dona estão na fila do servidor", () => servico("select public.rede_meusdados_arquivos_lista(50) as r"), (r) => Array.isArray(r) && r.length === 3 && r.every((a) => a.caminho.startsWith(`${P.dona}/`)));
await espera("o servidor apagou: a fila esvazia", () => servico("select public.rede_meusdados_arquivos_feito($1::bigint[], '{}'::bigint[]) as r", [`{${(fila ?? []).map((a) => a.id).join(",")}}`]), (r) => r.apagados === 3);

// ── A varredura: nada da dona sobra ──
const PODEM_CITAR = new Set(["interno.rede_moderacao", "interno.alumia_painel_registro", "interno.audit_logs"]);
const colunas = (await dono(`select c.table_schema || '.' || c.table_name as tabela, c.column_name as coluna, c.data_type as tipo
  from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where (c.table_schema = 'interno' or (c.table_schema = 'auth' and c.table_name = 'users'))
    and c.data_type in ('uuid', 'text', 'character varying', 'jsonb', 'json', 'ARRAY')
  order by 1, 2`)).rows;
const sobras = [];
const procurar = [P.dona, EMAIL, "dona_o8"];
for (const c of colunas) {
  const col = `"${c.coluna}"`;
  const onde = c.tipo === "uuid" ? `${col} = $1::uuid` : `${col}::text like '%' || $1 || '%' or ${col}::text like '%' || $2 || '%' or ${col}::text like '%' || $3 || '%'`;
  const valores = c.tipo === "uuid" ? [P.dona] : procurar;
  const n = Number((await um(`select count(*)::int as n from ${c.tabela.replace(".", '."')}" where ${onde}`, valores)).n);
  if (n > 0 && !PODEM_CITAR.has(c.tabela)) sobras.push(`${c.tabela}.${c.coluna} (${n})`);
}
ok(`a varredura de ${colunas.length} colunas (todas as tabelas interno.* e auth.users) não acha nada da dona: ${sobras.join(", ") || "nada"}`, sobras.length === 0 && colunas.length > 500);
await espera("o registro da moderação continua (é a prova do processo)", () => um("select count(*)::int as n from interno.rede_moderacao where alvo = $1", [MODERADO]), (r) => r.n === 1);
await espera("as outras contas continuam inteiras", () => um("select count(*)::int as n from interno.perfis where id = any ($1::uuid[])", [`{${P.amiga},${P.outra},${P.coord}}`]), (r) => r.n === 3);
await espera("a rodada seguinte não tem nada a fazer", async () => (await um("select interno.alumia_md_rodada() as r")).r, (r) => r.apagadas === 0);
await recusa("a rodada não é para conta nenhuma", () => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub: P.amiga })]);
  await banco.pg.exec("set role authenticated");
  try {
    return (await banco.pg.query("select interno.alumia_md_rodada()")).rows;
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");

// ── Os textos da tela nos seis idiomas, com as mesmas chaves ──
const chaves = (v, p = "") => (v && typeof v === "object" ? Object.entries(v).flatMap(([k, f]) => chaves(f, p ? `${p}.${k}` : k)) : [p]);
const marcas = (v, p = "", s = {}) => {
  if (v && typeof v === "object") for (const [k, f] of Object.entries(v)) marcas(f, `${p}.${k}`, s);
  else if (typeof v === "string") s[p] = (v.match(/\{\w+\}/g) ?? []).sort().join();
  return s;
};
const textos = (l) => {
  try {
    return JSON.parse(ler(`i18n/rede/meusdados/${l}.json`));
  } catch {
    return null;
  }
};
const tPt = textos("pt");
ok("os textos da tela em português existem", tPt !== null);
const pt = chaves(tPt ?? {}).filter((k) => k !== "_rascunho").sort().join("|");
const mPt = marcas(tPt ?? {});
for (const lingua of ["en", "es", "fr", "ru", "zh"]) {
  const t = textos(lingua);
  ok(`os textos em ${lingua} têm as mesmas chaves do português`, t !== null && chaves(t).filter((k) => k !== "_rascunho").sort().join("|") === pt);
  const m = marcas(t ?? {});
  ok(`os textos em ${lingua} têm os mesmos marcadores ({n}, {quando}...)`, Object.entries(mPt).every(([k, v]) => m[k] === v));
}
// ── O .zip e a página do arquivo (lib/rede/meusdados/zip.ts e indice.ts) ──
const { zipar, nomeSeguro } = await import("../lib/rede/meusdados/zip.ts");
const { montarIndice } = await import("../lib/rede/meusdados/indice.ts");
const { inflateRawSync } = await import("node:zlib");
/** Lê o .zip pelo diretório central (como um programa de descompactar faria) e devolve { nome: bytes }. */
function lerZip(zip) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fim = zip.byteLength - 22;
  if (v.getUint32(fim, true) !== 0x06054b50) throw new Error("sem fim de diretório");
  const n = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const saida = {};
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("diretório central torto");
    const metodo = v.getUint16(p + 10, true);
    const tamC = v.getUint32(p + 20, true);
    const tamN = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + tamN));
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const corpo = zip.subarray(inicio, inicio + tamC);
    saida[nome] = metodo === 8 ? new Uint8Array(inflateRawSync(corpo)) : corpo;
    p += 46 + tamN;
  }
  return saida;
}
const imagem = new Uint8Array(5000).map((_, i) => (i * 7919) % 256);
const json = new TextEncoder().encode(JSON.stringify({ posts: Array.from({ length: 50 }, () => ({ texto: "Ocupar e resistir!" })) }));
const zip = zipar([{ nome: "meus-dados.json", dados: json }, { nome: "midias/rede-midia/a.webp", dados: imagem, guardado: true }, { nome: "../../fora.txt", dados: new Uint8Array([1]) }, { nome: "meus-dados.json", dados: new Uint8Array([2]) }]);
await espera("o .zip abre e devolve cada arquivo igual (o JSON comprimido, a imagem guardada)", async () => lerZip(zip), (z) =>
  Buffer.from(z["meus-dados.json"]).equals(Buffer.from(json)) && Buffer.from(z["midias/rede-midia/a.webp"]).equals(Buffer.from(imagem)) && zip.length < json.length + imagem.length);
await espera("o .zip não deixa nome sair da pasta nem repete nome", async () => Object.keys(lerZip(zip)), (nomes) => nomes.includes("fora.txt") && nomes.includes("meus-dados-2.json") && nomes.every((n) => !n.includes("..")));
ok("nome seguro tira barra do começo e ..", nomeSeguro("/../a/./b\\c") === "a/b/c");
const pagina = montarIndice(
  { gerado_em: new Date().toISOString(), perfil: { codinome: "<script>alert(1)</script>" }, posts: [{ texto: "\"><img src=x onerror=alert(1)>", apoios: null }], seguidores: { quantos: null }, midias: [] },
  tPt?.arquivo ?? {},
  { lang: "pt", arquivos: [{ caminho: "u/a.webp", local: "midias/rede-midia/a.webp" }, { caminho: "u/b.mp4", link: "https://exemplo.supabase.co/storage/v1/object/sign/x?token=1" }] },
);
ok("a página do arquivo escapa o que vem do banco", !pagina.includes("<script>alert") && !pagina.includes("<img src=x") && pagina.includes("&lt;script&gt;"));
ok("a página do arquivo não tem script nem busca nada de fora", !/<script|<link|@import|src="https?:/i.test(pagina) && pagina.includes("default-src 'none'"));
ok("a página diz \"menos de 3\" no lugar do número abaixo do piso", pagina.includes("menos de 3"));
ok("a página mostra a imagem da pasta do .zip e o link temporário só como link", pagina.includes('src="midias/rede-midia/a.webp"') && pagina.includes('href="https://exemplo.supabase.co'));

const proibidas = /diploma|universidade|algoritmo/i;
ok("nenhuma palavra proibida nos textos em português", !proibidas.test(JSON.stringify(tPt ?? {})));

await banco.pg.close?.();
console.log(`Alumia (meus dados, onda 8): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
