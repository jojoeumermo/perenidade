// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o B1 do perfil e das organizações (supabase/migracoes/20261110-alumia-b1-perfil-org.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada mais duas vezes sobre o install.sql. Matriz: visitante, dona (gestora),
// membros de núcleo, membro de fora, bloqueado. Regras: quem ocupa função só para quem é de dentro; eleição com voto secreto,
// quórum e mandato sozinho; Ata Viva em que a pessoa vê só a própria posição e a mesa vê a fila por codinome, fila e sinais que
// somem ao carimbar/fechar e mosaico só a partir de 3; caixa com duplo CONFERIDO por duas pessoas diferentes, saldo só do conferido
// e doador que nunca aparece; lampião com pauta, tarefa, convite (só o hash), chama e mapa opcional; Tear que nasce de consulta e
// de ata e avisa a função no prazo vencido; diretório sem contagem de pessoas; aba Atos da organização. Nenhuma resposta traz id
// de pessoa.
// Uso: npm run testar:alumia-b1-perfil-org
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { centavosDe, conferirLancamento, conviteDoFragmento, linkDoConvite, mosaicoDosSinais, ordinalDaFila, tremeOLampiao } from "../lib/rede/org/b1.ts";

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

const sql = ler("supabase/migracoes/20261110-alumia-b1-perfil-org.sql");
ok("a migração está colada no FIM do install.sql (seguida só das datadas posteriores)", noFimDoInstall(sql, ler("supabase/install.sql")));
ok("toda função nova é security definer (ou imutável) com search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 40 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f) && (/security definer/.test(f) || /immutable/.test(f)));
})());
ok("nenhuma permissão direta nas tabelas para anon/authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("a migração cita a LGPD e o ECA com o artigo", /art\. 11/.test(sql) && /art\. 6º, III/.test(sql) && /art\. 9º/.test(sql));
ok("o package.json tem a linha do teste", /"testar:alumia-b1-perfil-org"/.test(ler("package.json")));

// ═══════════════════ 0. As regras puras do cliente (lib/rede/org/b1.ts) ═══════════════════
ok("cliente: o mosaico dos sinais some abaixo de 3", mosaicoDosSinais(null) === null && mosaicoDosSinais({ concordo: 0.5, duvida: 0.2, bloqueio: 0.1, abstencao: 0.2, pessoas: 3 })?.length === 10);
ok("cliente: o mosaico tem 10 casas na ordem concordo, dúvida, bloqueio, abstenção", mosaicoDosSinais({ concordo: 0.6, duvida: 0.2, bloqueio: 0.1, abstencao: 0.1, pessoas: 9 })?.join() === "concordo,concordo,concordo,concordo,concordo,concordo,duvida,duvida,bloqueio,abstencao");
ok("cliente: o lampião treme nos últimos 15 s (e não antes, nem depois do tempo)", tremeOLampiao(15) && tremeOLampiao(1) && !tremeOLampiao(16) && !tremeOLampiao(0));
ok("cliente: o ordinal da fila", ordinalDaFila(1, "pt") === "1ª" && ordinalDaFila(4, "pt") === "4ª" && ordinalDaFila(2, "en") === "2nd" && ordinalDaFila(3, "en") === "3rd" && ordinalDaFila(11, "en") === "11th");
ok("cliente: o valor do caixa", centavosDe("12,50") === 1250 && centavosDe("1.234,5") === 123450 && centavosDe("10") === 1000 && centavosDe("abc") === null && centavosDe("0") === null && centavosDe("12.5") === 1250);
ok("cliente: o lançamento com CPF, telefone ou e-mail na descrição é barrado antes de mandar", conferirLancamento({ descricao: "Doação de Maria, CPF 123.456.789-09", valor: "10" }).descricao === "dado_pessoal" && conferirLancamento({ descricao: "Pix 98888-7777", valor: "10" }).descricao === "dado_pessoal" && !conferirLancamento({ descricao: "Rifa do fundo de greve", valor: "10" }).descricao);

ok("textos: os 6 idiomas têm as mesmas chaves (os 5 de fora marcados como rascunho)", (() => {
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = chaves(JSON.parse(ler("i18n/rede/org-b1/pt.json"))).sort().join();
  return ["en", "es", "fr", "ru", "zh"].every((l) => { const j = JSON.parse(ler(`i18n/rede/org-b1/${l}.json`)); return j._rascunho === true && chaves(j).sort().join() === base; });
})());
ok("cliente: o convite vai no fragmento (#), que não chega a servidor nenhum", linkDoConvite("https://x.org", "pt", "lume", "0123456789abcdef0123456789abcdef").includes("#convite=") && conviteDoFragmento("#convite=0123456789ABCDEF0123456789abcdef") === "0123456789abcdef0123456789abcdef" && conviteDoFragmento("#convite=curto") === null);

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await espera("a migração instala de novo sobre o install.sql (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));

// ── pessoas ──
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["org", "dona", "t1", "t2", "m1", "m2", "m3", "m4", "fora", "bloq"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@b1org.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_b1o`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_handle = 'lume', rede_codinome = 'Coletivo Lume' where id = $1", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'coletivo', 'São Paulo', 'LUME', 'CNPJ', now())", [P.org]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono')", [P.org, P.dona]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.org, P.bloq]);
const A = (n) => como(P[n]);
const semIds = (r) => { const s = JSON.stringify(r); return !Object.values(P).filter((x) => x !== P.org).some((id) => s.includes(id)); };

// ═══════════════════ 1. Lampião: núcleo com pauta, tarefa, convite, chama e mapa ═══════════════════
let NUC;
{
  await recusa("membro não acende núcleo", () => rpc(A("m1"), "rede_org_nucleo_criar", { p_handle: "lume", p: { nome: "Núcleo Leste", quando: "terças", onde: "Itaquera" } }), "sem_permissao");
  await recusa("pauta com telefone é dado pessoal", () => rpc(A("dona"), "rede_org_nucleo_criar", { p_handle: "lume", p: { nome: "Núcleo X", quando: "terças", onde: "Sé", pauta: "Liga (11) 98888-7777" } }), "dado_pessoal");
  await recusa("estado que não existe", () => rpc(A("dona"), "rede_org_nucleo_criar", { p_handle: "lume", p: { nome: "Núcleo X", quando: "terças", onde: "Sé", uf: "ZZ" } }), "invalido:nucleo");
  const r = await espera("a dona acende o lampião com pauta, tarefa, cidade, estado e convite", () => rpc(A("dona"), "rede_org_nucleo_criar", { p_handle: "lume", p: {
    nome: "Núcleo Leste", quando: "terças, 19h", onde: "Biblioteca de Itaquera", cor: 2, pauta: "1. Quem somos\n2. O que queremos", tarefa: "Colar 20 cartazes", cidade: "São Paulo", uf: "sp", mapa: false, convite: { dias: 7, usos: 5 },
  } }), (x) => x.id && /^[0-9a-f]{32}$/.test(x.convite?.codigo ?? "") && x.convite.usos === 5);
  NUC = r?.id;
  await espera("o convite guarda só o hash (o código não fica no banco)", () => um("select count(*)::int n from interno.rede_convites where nucleo = $1 and token_hash <> $2 and usos_max = 5", [NUC, r?.convite?.codigo]), (x) => x.n === 1);
  await espera("a pauta e a tarefa ficam guardadas", () => um("select org_pauta, org_tarefa, org_uf, org_no_mapa from interno.rede_nucleos where id = $1", [NUC]), (x) => x.org_pauta.startsWith("1. Quem") && x.org_tarefa === "Colar 20 cartazes" && x.org_uf === "SP" && x.org_no_mapa === false);
  await espera("só quem fundou: a chama está apagada", () => rpc(A("m1"), "rede_org_perfil", { p_handle: "lume" }), (o) => o.nucleos[0].chama === "apagado" && o.nucleos[0].pauta === null && o.nucleos[0].mapa === null);
  await espera("m1 entra pelo convite", () => rpc(A("m1"), "rede_fix_convite_usar", { p_codigo: r?.convite?.codigo }), (x) => x.ok !== false);
  await espera("com a 1ª pessoa, brasa", () => rpc(A("m1"), "rede_org_perfil", { p_handle: "lume" }), (o) => o.nucleos[0].chama === "brasa" && o.nucleos[0].pauta?.startsWith("1. Quem") && o.nucleos[0].tarefa === "Colar 20 cartazes");
  for (const n of ["m2", "m3"]) await rpc(A(n), "rede_fix_convite_usar", { p_codigo: r?.convite?.codigo });
  await espera("com a 3ª pessoa, chama plena (sem o número)", () => rpc(visitante(), "rede_org_perfil", { p_handle: "lume" }), (o) => o.nucleos[0].chama === "plena" && o.nucleos[0].pauta === null && !JSON.stringify(o).includes("\"membros\""));
  await espera("fora do mapa por padrão: o mapa está vazio", () => rpc(visitante(), "rede_org_mapa"), (m) => Array.isArray(m) && m.length === 0);
  await recusa("membro comum não põe no mapa", () => rpc(A("m1"), "rede_org_nucleo_mapa", { p_nucleo: NUC, p_sim: true }), "sem_permissao");
  await espera("a dona põe no mapa", () => rpc(A("dona"), "rede_org_nucleo_mapa", { p_nucleo: NUC, p_sim: true }), (x) => x.mapa === true && x.chama === "plena");
  await espera("o mapa mostra o estado e a cidade, sem número", () => rpc(visitante(), "rede_org_mapa"), (m) => m.length === 1 && m[0].uf === "SP" && m[0].cidades[0] === "São Paulo" && Object.keys(m[0]).sort().join() === "cidades,uf");
  await espera("quem gerencia vê se está no mapa", () => rpc(A("dona"), "rede_org_perfil", { p_handle: "lume" }), (o) => o.nucleos[0].mapa === true && o.dentro === true && o.mesa === true);
  await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro'), ($1, $3, 'membro'), ($1, $4, 'membro') on conflict do nothing", [NUC, P.t1, P.t2, P.m4]);
}

// ═══════════════════ 2. Funções e mandatos ═══════════════════
let TES, MESA, COM;
{
  const fim = new Date(Date.now() + 200 * 86400e3).toISOString().slice(0, 10);
  await recusa("membro não cria função", () => rpc(A("m1"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "tesouraria", nome: "Tesouraria", permissoes: ["caixa"], vagas: 2 } }), "sem_permissao");
  await recusa("permissão que não existe", () => rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "tesouraria", nome: "Tesouraria", permissoes: ["tudo"] } }), "invalido:permissoes");
  await rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "tesouraria", nome: "Tesouraria", permissoes: ["caixa"], vagas: 2 } });
  await rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "coordenacao", nome: "Mesa", permissoes: ["mesa", "tear"], vagas: 1 } });
  const f = await espera("a dona cria as funções", () => rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "comunicacao", nome: "Comunicação", permissoes: ["avisos"], vagas: 1 } }), (x) => x.funcoes.length === 3 && x.gerencio === true);
  TES = f?.funcoes.find((x) => x.nome === "Tesouraria")?.id;
  MESA = f?.funcoes.find((x) => x.nome === "Mesa")?.id;
  COM = f?.funcoes.find((x) => x.nome === "Comunicação")?.id;
  await recusa("nome repetido", () => rpc(A("dona"), "rede_org_funcao_salvar", { p_handle: "lume", p: { tipo: "outra", nome: "tesouraria", permissoes: [] } }), "funcao_existe");
  await recusa("só quem é de um núcleo ocupa função", () => rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: TES, handle: "fora_b1o", fim } }), "nao_encontrado");
  await recusa("mandato sem data de fim no futuro", () => rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: TES, handle: "t1_b1o", fim: "2020-01-01" } }), "invalido:fim");
  await rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: TES, handle: "t1_b1o", fim } });
  await rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: TES, handle: "t2_b1o", fim } });
  await recusa("a tesouraria tem 2 vagas", () => rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: TES, handle: "m4_b1o", fim } }), "sem_vaga");
  await espera("a pessoa nomeada recebe o aviso", () => um("select count(*)::int n from interno.avisos where para = $1 and texto like '%Tesouraria%'", [P.t1]), (x) => x.n === 1);
  await espera("quem é de dentro vê quem ocupa (codinome, @ e fim) e as minhas", () => rpc(A("t1"), "rede_org_funcoes", { p_handle: "lume" }), (x) => x.dentro === true && x.funcoes.find((y) => y.id === TES)?.ocupantes.length === 2 && x.minhas.length === 1 && x.minhas[0].permissoes.includes("caixa") && semIds(x));
  await espera("visitante vê só os nomes das funções, nunca quem ocupa", () => rpc(visitante(), "rede_org_funcoes", { p_handle: "lume" }), (x) => x.dentro === false && x.funcoes.length === 3 && x.funcoes.every((y) => y.ocupantes === null) && !/Codinome/.test(JSON.stringify(x)));
  await espera("membro de fora também não vê quem ocupa", () => rpc(A("fora"), "rede_org_funcoes", { p_handle: "lume" }), (x) => x.funcoes.every((y) => y.ocupantes === null));
  await espera("bloqueado não vê nada", () => rpc(A("bloq"), "rede_org_funcoes", { p_handle: "lume" }), (x) => x === null);
  const mand = (await rpc(A("t2"), "rede_org_funcoes", { p_handle: "lume" }))?.minhas[0]?.mandato;
  await recusa("outra pessoa não encerra o mandato dos outros", () => rpc(A("m1"), "rede_org_mandato_encerrar", { p_mandato: mand }), "nao_encontrado");
  await espera("a pessoa sai da função quando quiser", () => rpc(A("t2"), "rede_org_mandato_encerrar", { p_mandato: mand }), (x) => x.minhas.length === 0);
  await rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: TES, handle: "t2_b1o", fim } });
  await espera("e volta nomeada", () => rpc(A("t2"), "rede_org_funcoes", { p_handle: "lume" }), (x) => x.minhas.length === 1);
}

// ═══════════════════ 3. Eleições internas ═══════════════════
{
  const em = (h) => new Date(Date.now() + h * 3600e3).toISOString();
  const fim = new Date(Date.now() + 400 * 86400e3).toISOString().slice(0, 10);
  await recusa("membro não marca eleição", () => rpc(A("m1"), "rede_org_eleicao_abrir", { p_handle: "lume", p: { funcao: COM, inscricoesAte: em(2), prazo: em(30), mandatoFim: fim } }), "sem_permissao");
  await recusa("inscrições curtas demais", () => rpc(A("dona"), "rede_org_eleicao_abrir", { p_handle: "lume", p: { funcao: COM, inscricoesAte: em(0.1), prazo: em(30), mandatoFim: fim } }), "invalido:inscricoes");
  await recusa("quórum abaixo de 3", () => rpc(A("dona"), "rede_org_eleicao_abrir", { p_handle: "lume", p: { funcao: COM, inscricoesAte: em(2), prazo: em(30), mandatoFim: fim, quorum: 2 } }), "invalido:quorum");
  const l = await espera("a dona marca a eleição da Comunicação com quórum 3", () => rpc(A("dona"), "rede_org_eleicao_abrir", { p_handle: "lume", p: { funcao: COM, inscricoesAte: em(2), prazo: em(30), mandatoFim: fim, quorum: 3 } }), (x) => x.length === 1 && x[0].situacao === "inscricoes");
  const E = l?.[0]?.id;
  await recusa("duas eleições abertas para a mesma função", () => rpc(A("dona"), "rede_org_eleicao_abrir", { p_handle: "lume", p: { funcao: COM, inscricoesAte: em(2), prazo: em(30), mandatoFim: fim } }), "eleicao_aberta");
  await espera("quem é de fora não vê a eleição", () => rpc(A("fora"), "rede_org_eleicoes", { p_handle: "lume" }), (x) => x === null);
  await recusa("nem visitante", () => rpc(visitante(), "rede_org_eleicoes", { p_handle: "lume" }), "permission denied");
  await recusa("membro de fora não se candidata", () => rpc(A("fora"), "rede_org_eleicao_candidatar", { p_eleicao: E, p_sim: true }), "nao_encontrado");
  await espera("m1 se candidata", () => rpc(A("m1"), "rede_org_eleicao_candidatar", { p_eleicao: E, p_sim: true }), (x) => x.souCandidata === true && x.candidatos.length === 1 && semIds(x));
  await rpc(A("m2"), "rede_org_eleicao_candidatar", { p_eleicao: E, p_sim: true });
  await espera("fecham as inscrições: a votação abre sozinha como consulta ranqueada com 'Reabrir a eleição'", async () => {
    await dono("update interno.rede_org_eleicoes set inscricoes_ate = now() - interval '1 minute' where id = $1", [E]);
    return rpc(A("m3"), "rede_org_eleicoes", { p_handle: "lume" });
  }, (x) => x[0].situacao === "votacao" && x[0].consulta?.metodo === "ranqueada" && x[0].consulta.opcoes.length === 3 && x[0].consulta.possoVotar === true);
  await recusa("ninguém se candidata depois das inscrições", () => rpc(A("m3"), "rede_org_eleicao_candidatar", { p_eleicao: E, p_sim: true }), "inscricoes_fechadas");
  await espera("a consulta da eleição não aparece para quem é de fora no perfil", () => rpc(A("fora"), "rede_org_perfil", { p_handle: "lume" }), (o) => o.consultas.every((c) => !c.eleicao));
  const lista = await rpc(A("m3"), "rede_org_eleicoes", { p_handle: "lume" });
  const C = lista?.[0]?.consulta;
  const op = (i) => C?.opcoes[i]?.id;
  for (const [n, rk] of [["m1", [op(0), op(1)]], ["m2", [op(1), op(0)]], ["m3", [op(0)]], ["m4", [op(0), op(2)]]]) {
    await espera(`${n} vota em segredo`, () => rpc(A(n), "rede_org_consulta_votar", { p_consulta: C?.id, p_ranking: rk }), (x) => JSON.stringify(x) === '{"votei":true}');
  }
  await espera("o voto não guarda ligação com a pessoa (cédula e votante separados)", () => um("select count(*)::int n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_consulta_cedulas' and column_name in ('usuario', 'pessoa', 'votante')"), (x) => x.n === 0);
  await espera("fecha o prazo: m1 é eleita com mandato até a data marcada", async () => {
    await dono("update interno.rede_org_eleicoes set prazo = now() - interval '1 minute' where id = $1", [E]); await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [C?.id]);
    return rpc(A("m2"), "rede_org_eleicoes", { p_handle: "lume" });
  }, (x) => x[0].situacao === "apurada" && x[0].eleita?.handle === "m1_b1o" && x[0].consulta.votantes === 4);
  await espera("o mandato nasce da eleição, sem o dono dar o cargo", () => rpc(A("m1"), "rede_org_funcoes", { p_handle: "lume" }), (x) => x.minhas.some((m) => m.funcao === COM && m.fim === fim));
  await espera("a eleita recebe o aviso", () => um("select count(*)::int n from interno.avisos where para = $1 and texto like '%foi eleita%'", [P.m1]), (x) => x.n === 1);
  // Sem quórum: ninguém assume.
  const l2 = await rpc(A("dona"), "rede_org_eleicao_abrir", { p_handle: "lume", p: { funcao: MESA, inscricoesAte: em(2), prazo: em(30), mandatoFim: fim, quorum: 10 } });
  const E2 = l2?.find((x) => x.funcao.id === MESA)?.id;
  await rpc(A("m3"), "rede_org_eleicao_candidatar", { p_eleicao: E2, p_sim: true });
  await dono("update interno.rede_org_eleicoes set inscricoes_ate = now() - interval '1 minute' where id = $1", [E2]);
  await espera("a rotina abre a votação no relógio", () => dono("select interno.alumia_org_rotina() as r"), (x) => x.rows[0].r.eleicoes >= 1);
  const c2 = (await rpc(A("m1"), "rede_org_eleicoes", { p_handle: "lume" }))?.find((x) => x.id === E2)?.consulta;
  for (const n of ["m1", "m2", "m3"]) await rpc(A(n), "rede_org_consulta_votar", { p_consulta: c2?.id, p_ranking: [c2?.opcoes[0]?.id] });
  await dono("update interno.rede_org_eleicoes set prazo = now() - interval '1 minute' where id = $1", [E2]); await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [c2?.id]);
  await espera("sem quórum (3 de 10), ninguém é eleito", () => rpc(A("m1"), "rede_org_eleicoes", { p_handle: "lume" }), (x) => x.find((y) => y.id === E2)?.situacao === "sem_quorum" && x.find((y) => y.id === E2)?.eleita === null);
  // A Mesa vai para m4 por nomeação (para os testes da ata).
  await rpc(A("dona"), "rede_org_mandato_dar", { p_handle: "lume", p: { funcao: MESA, handle: "m4_b1o", fim } });
}

// ═══════════════════ 4. Ata Viva e sinais de consenso ═══════════════════
{
  await recusa("membro sem função de mesa não abre ata", () => rpc(A("m1"), "rede_org_ata_abrir", { p_handle: "lume", p: { titulo: "Assembleia", pontos: ["Tarifa zero"] } }), "sem_permissao");
  await recusa("ata sem pauta", () => rpc(A("m4"), "rede_org_ata_abrir", { p_handle: "lume", p: { titulo: "Assembleia", pontos: [] } }), "invalido:pontos");
  const a = await espera("a mesa (função) abre a Ata Viva com 3 pontos", () => rpc(A("m4"), "rede_org_ata_abrir", { p_handle: "lume", p: { titulo: "Assembleia de novembro", pontos: ["Tarifa zero", "Fundo de greve", "Calendário"], falaSegundos: 90 } }), (x) => x.situacao === "aberta" && x.pontos.length === 3 && x.souMesa === true && x.pontoAtual === x.pontos[0].id && x.falaSegundos === 90);
  const ATA = a?.id;
  await espera("quem é de fora não vê a ata aberta", () => rpc(A("fora"), "rede_org_ata", { p_id: ATA }), (x) => x === null);
  await espera("visitante não vê a ata aberta", () => rpc(visitante(), "rede_org_ata", { p_id: ATA }), (x) => x === null);
  await recusa("quem é de fora não se inscreve", () => rpc(A("fora"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "favor" }), "nao_encontrado");
  await recusa("posição que não existe", () => rpc(A("m1"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "talvez" }), "invalido:posicao");
  await rpc(A("m1"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "favor" });
  await rpc(A("m2"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "contra" });
  const m3 = await espera("m3 se inscreve: vê só a própria posição e o lugar (3ª), nunca a fila", () => rpc(A("m3"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "esclarecimento" }), (x) => x.minha?.posicao === "esclarecimento" && x.minha.lugar === 3 && x.fila === null && x.naFila === 3 && x.souMesa === false);
  ok("a resposta de quem não é mesa não traz codinome nem id de ninguém", m3 && semIds(m3) && !/Codinome/.test(JSON.stringify(m3)));
  await espera("trocar a posição não muda o lugar", () => rpc(A("m1"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "contra" }), (x) => x.minha.lugar === 1 && x.minha.posicao === "contra");
  const mesa = await espera("a mesa vê a fila por codinome e em ordem de chegada, com as funções", () => rpc(A("m4"), "rede_org_ata", { p_id: ATA }), (x) => x.fila.length === 3 && x.fila.map((f) => f.codinome).join() === "Codinome 5,Codinome 6,Codinome 7" && x.fila[0].funcoes.includes("Comunicação"));
  ok("nem a mesa recebe id de pessoa", mesa && semIds(mesa));
  await espera("a mesa chama a próxima: a fala começa com posição e tempo", () => rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "chamar" } }), (x) => x.fala?.posicao === "contra" && x.fala.quem === "Codinome 5" && x.fila.length === 2);
  await espera("quem fala vê que é a vez dela, e o público não vê quem é", async () => [await rpc(A("m1"), "rede_org_ata", { p_id: ATA }), await rpc(A("m2"), "rede_org_ata", { p_id: ATA })], ([eu, outra]) => eu.fala.souEu === true && eu.minha === null && outra.fala.quem === null && outra.fala.souEu === false && outra.minha.lugar === 1);
  await recusa("sinais fechados: não dá sinal", () => rpc(A("m1"), "rede_org_ata_sinal", { p_ata: ATA, p_sinal: "concordo" }), "sinais_fechados");
  await rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "sinais_abrir" } });
  await rpc(A("m1"), "rede_org_ata_sinal", { p_ata: ATA, p_sinal: "concordo" });
  await espera("com 2 sinais, o mosaico não aparece (mas a pessoa vê o próprio)", () => rpc(A("m2"), "rede_org_ata_sinal", { p_ata: ATA, p_sinal: "bloqueio" }), (x) => x.sinais.abertos && x.sinais.mosaico === null && x.sinais.meu === "bloqueio" && x.sinais.haBloqueio === null);
  await espera("a mesa vê 'há bloqueio' mesmo abaixo de 3, sem saber de quem", () => rpc(A("m4"), "rede_org_ata", { p_id: ATA }), (x) => x.sinais.haBloqueio === true && x.sinais.mosaico === null && semIds(x));
  await rpc(A("m3"), "rede_org_ata_sinal", { p_ata: ATA, p_sinal: "concordo" });
  await espera("com 3 sinais, o mosaico em passos de 10 %", () => rpc(A("t1"), "rede_org_ata_sinal", { p_ata: ATA, p_sinal: "duvida" }), (x) => x.sinais.mosaico?.concordo === 0.5 && x.sinais.mosaico.bloqueio === 0.2 && x.sinais.mosaico.duvida === 0.2 && x.sinais.mosaico.pessoas === 4 && !("haBloqueio" in x.sinais.mosaico) && x.sinais.haBloqueio === null);
  await recusa("sinal que não existe", () => rpc(A("m1"), "rede_org_ata_sinal", { p_ata: ATA, p_sinal: "viva" }), "invalido:sinal");
  await recusa("membro não carimba", () => rpc(A("m1"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "carimbar", carimbo: "aprovado" } }), "sem_permissao");
  await recusa("carimbo que não existe", () => rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "carimbar", carimbo: "talvez" } }), "invalido:carimbo");
  await recusa("deliberação com telefone é dado pessoal", () => rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "carimbar", carimbo: "aprovado", deliberacao: "Ligar 98888-7777" } }), "dado_pessoal");
  const prazo = new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10);
  const c = await espera("APROVADO com função e prazo: vira fio do Tear e a ata vai ao próximo ponto", () => rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "carimbar", carimbo: "aprovado", deliberacao: "Levar a pauta à audiência pública", funcao: COM, prazo } }), (x) => x.pontos[0].carimbo === "aprovado" && x.pontoAtual === x.pontos[1].id && x.fila.length === 0 && x.fala === null && x.pontos[0].sinais?.concordo === 0.5 && !("pessoas" in x.pontos[0].sinais));
  ok("o agregado guardado no ponto não traz pessoa", c && semIds(c.pontos));
  await espera("carimbar apaga a fila e os sinais do ponto", () => um("select (select count(*) from interno.rede_org_ata_falas where ata = $1)::int f, (select count(*) from interno.rede_org_ata_sinais s join interno.rede_org_ata_pontos p on p.id = s.ponto where p.ata = $1)::int s", [ATA]), (x) => x.f === 0 && x.s === 0);
  await espera("o fio nasce da ata, com a função de verdade", () => rpc(A("m1"), "rede_org_tear", { p_handle: "lume" }), (x) => x.fios.some((f) => f.origem === "ata" && f.funcao === "Comunicação" && f.texto === "Levar a pauta à audiência pública"));
  await rpc(A("m2"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "favor" });
  await rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "carimbar", carimbo: "vai_a_base", deliberacao: "Consulta aos núcleos" } });
  await rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "tempo", segundos: 60 } });
  await recusa("tempo fora do limite", () => rpc(A("m4"), "rede_org_ata_mesa", { p_ata: ATA, p: { acao: "tempo", segundos: 5 } }), "invalido:tempo");
  await rpc(A("m1"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "favor" });
  await recusa("membro não fecha a ata", () => rpc(A("m1"), "rede_org_ata_fechar", { p_ata: ATA, p_publicar: null }), "sem_permissao");
  const f = await espera("a mesa fecha a ata e publica como post da organização", () => rpc(A("m4"), "rede_org_ata_fechar", { p_ata: ATA, p_publicar: "internet" }), (x) => x.ata.situacao === "fechada" && x.ata.post && /APROVADO/.test(x.texto) && /VAI À BASE/.test(x.texto) && /SEM DELIBERAÇÃO/.test(x.texto));
  ok("o texto da ata não traz quem falou", f && !/Codinome/.test(f.texto) && semIds(f));
  await espera("a fila SOME quando a ata fecha", () => um("select count(*)::int n from interno.rede_org_ata_falas where ata = $1", [ATA]), (x) => x.n === 0);
  await espera("o post é da organização (quem fechou não aparece)", () => um("select autor, como from interno.rede_posts where id = $1", [f?.ata?.post]), (x) => x.autor === P.org && x.como === P.org);
  await espera("visitante vê a ata fechada, sem ninguém", () => rpc(visitante(), "rede_org_atas", { p_handle: "lume" }), (x) => x.atas.length === 1 && x.atas[0].situacao === "fechada" && x.atas[0].fila === null && x.atas[0].sinais === null && semIds(x));
  await recusa("ata fechada não recebe inscrição", () => rpc(A("m1"), "rede_org_ata_inscrever", { p_ata: ATA, p_posicao: "favor" }), "ata_fechada");
}

// ═══════════════════ 5. Caixa transparente ═══════════════════
{
  await recusa("membro comum não abre caixa", () => rpc(A("m1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo de greve", tipo: "greve" } }), "sem_permissao");
  await recusa("Pix com CPF de pessoa é recusado", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo de greve", tipo: "greve", pix: "123.456.789-09" } }), "dado_pessoal");
  const c = await espera("a tesouraria abre o fundo de greve (Pix da organização como texto)", () => rpc(A("t1"), "rede_org_caixa_criar", { p_handle: "lume", p: { nome: "Fundo de greve", tipo: "greve", pix: "12.345.678/0001-90", link: "https://exemplo.org/doar" } }), (x) => x.caixas.length === 1 && x.tesouraria === true);
  const CX = c?.caixas[0]?.id;
  await recusa("a dona (sem função de tesouraria) não lança", () => rpc(A("dona"), "rede_org_caixa_lancar", { p_caixa: CX, p: { tipo: "entrada", centavos: "5000", descricao: "Rifa", dia: new Date().toISOString().slice(0, 10) } }), "sem_permissao");
  await recusa("descrição com nome e CPF de doador", () => rpc(A("t1"), "rede_org_caixa_lancar", { p_caixa: CX, p: { tipo: "entrada", centavos: "5000", descricao: "Doação CPF 123.456.789-09", dia: new Date().toISOString().slice(0, 10) } }), "dado_pessoal");
  const hoje = new Date().toISOString().slice(0, 10);
  const comExif = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), Buffer.from("Exif\0\0"), Buffer.alloc(200, 1)]).toString("base64");
  await recusa("foto da nota com EXIF é recusada", () => rpc(A("t1"), "rede_org_caixa_lancar", { p_caixa: CX, p: { tipo: "saida", centavos: "100", descricao: "Faixa", dia: hoje, nota: comExif, mime: "image/jpeg" } }), "invalido:nota");
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 1, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(200, 7)]).toString("base64");
  await rpc(A("t1"), "rede_org_caixa_lancar", { p_caixa: CX, p: { tipo: "entrada", centavos: "50000", descricao: "Rifa do fundo de greve", dia: hoje } });
  const l = await espera("a tesouraria lança uma saída com a foto da nota (webp, sem EXIF)", () => rpc(A("t1"), "rede_org_caixa_lancar", { p_caixa: CX, p: { tipo: "saida", centavos: "12000", descricao: "Tinta para as faixas", dia: hoje, nota: webp, mime: "image/webp" } }), (x) => x.caixas[0].lancamentos.length === 2 && x.caixas[0].saldo === 0 && x.caixas[0].esperando === 2);
  const [L1, L2] = [l?.caixas[0].lancamentos.find((x) => x.tipo === "entrada")?.id, l?.caixas[0].lancamentos.find((x) => x.tipo === "saida")?.id];
  await espera("visitante não vê o que não foi conferido duas vezes; saldo zero", () => rpc(visitante(), "rede_org_caixa", { p_handle: "lume" }), (x) => x.caixas[0].lancamentos.length === 0 && x.caixas[0].saldo === 0 && x.caixas[0].esperando === null);
  await rpc(A("t1"), "rede_org_caixa_conferir", { p_lancamento: L1 });
  await recusa("a mesma pessoa não carimba duas vezes", () => rpc(A("t1"), "rede_org_caixa_conferir", { p_lancamento: L1 }), "outra_pessoa");
  await recusa("membro sem tesouraria não confere", () => rpc(A("m1"), "rede_org_caixa_conferir", { p_lancamento: L1 }), "sem_permissao");
  await espera("a segunda tesoureira carimba: entra no saldo", () => rpc(A("t2"), "rede_org_caixa_conferir", { p_lancamento: L1 }), (x) => x.caixas[0].saldo === 50000 && x.caixas[0].lancamentos.find((y) => y.id === L1)?.carimbos === 2);
  await recusa("lançamento conferido não sai", () => rpc(A("t1"), "rede_org_caixa_retirar", { p_lancamento: L1 }), "ja_conferido");
  await rpc(A("t2"), "rede_org_caixa_conferir", { p_lancamento: L2 });
  await rpc(A("t1"), "rede_org_caixa_conferir", { p_lancamento: L2 });
  const pub = await espera("visitante vê o saldo público (entrada 500, saída 120) e os lançamentos conferidos", () => rpc(visitante(), "rede_org_caixa", { p_handle: "lume" }), (x) => x.caixas[0].saldo === 38000 && x.caixas[0].entradas === 50000 && x.caixas[0].saidas === 12000 && x.caixas[0].lancamentos.length === 2 && x.caixas[0].lancamentos.every((y) => y.nota === false && y.meu === false));
  ok("o caixa não traz quem lançou nem quem conferiu", pub && semIds(pub) && !/lancou|conferiu1|conferiu2/.test(JSON.stringify(pub)));
  await espera("quem é de dentro vê a foto da nota", () => rpc(A("m1"), "rede_org_caixa_nota", { p_lancamento: L2 }), (x) => x.mime === "image/webp" && x.url.startsWith("data:image/webp;base64,"));
  await recusa("quem é de fora não vê a nota", () => rpc(A("fora"), "rede_org_caixa_nota", { p_lancamento: L2 }), "nao_encontrado");
}

// ═══════════════════ 6. Tear ligado à consulta e aviso de prazo ═══════════════════
{
  const r = await rpc(A("dona"), "rede_org_consulta_abrir", { p_handle: "lume", p: { pergunta: "Vamos à greve geral?", metodo: "simples", opcoes: ["Sim", "Não"], prazo: new Date(Date.now() + 2 * 3600e3).toISOString(), compromisso: "Seguimos a maioria." } });
  const prazo = new Date(Date.now() + 5 * 86400e3).toISOString().slice(0, 10);
  await recusa("não nasce fio de consulta ainda aberta", () => rpc(A("dona"), "rede_org_tear_fio", { p_handle: "lume", p: { consulta: r?.id, funcaoId: COM, prazo } }), "invalido:consulta");
  await dono("update interno.rede_consultas set prazo = now() - interval '1 minute' where id = $1", [r?.id]);
  await espera("a função 'tear' (Mesa) tece o fio a partir da consulta fechada", () => rpc(A("m4"), "rede_org_tear_fio", { p_handle: "lume", p: { consulta: r?.id, funcaoId: COM, prazo } }), (x) => x.fios.some((f) => f.origem === "consulta" && f.texto === "Vamos à greve geral?"));
  await recusa("um fio por consulta", () => rpc(A("m4"), "rede_org_tear_fio", { p_handle: "lume", p: { consulta: r?.id, funcaoId: COM, prazo } }), "ja_tecido");
  await espera("o perfil marca a consulta que virou fio", () => rpc(A("m1"), "rede_org_perfil", { p_handle: "lume" }), (o) => o.consultas.find((c) => c.id === r?.id)?.virouFio === true);
  await dono("update interno.rede_org_encaminhamentos set prazo = current_date - 1 where origem = 'consulta'");
  await espera("a rotina avisa uma vez quem ocupa a função do fio vencido", async () => { await dono("select interno.alumia_org_rotina()"); await dono("select interno.alumia_org_rotina()"); return um("select count(*)::int n from interno.avisos where para = $1 and texto like '%passou do prazo%'", [P.m1]); }, (x) => x.n === 1);
  await espera("e o Tear mostra o vencido", () => rpc(visitante(), "rede_org_tear", { p_handle: "lume" }), (x) => x.vencidos === 1 && x.fios.every((f) => f.funcao === null && f.prazo === null));
}

// ═══════════════════ 7. Plenária lida de novo, diretório e atos ═══════════════════
{
  const pl = await rpc(A("dona"), "rede_org_plenaria_abrir", { p_handle: "lume", p: { titulo: "Plenária aberta", descricao: "", inicio: new Date(Date.now() + 3600e3).toISOString(), sala: null } });
  await rpc(A("dona"), "rede_org_plenaria_mudar", { p_id: pl?.id, p_situacao: "ao_vivo", p_sala: "https://sala.exemplo.org/lume" });
  await rpc(A("m1"), "rede_org_plenaria_perguntar", { p_plenaria: pl?.id, p_texto: "Quando é o próximo ato?", p_mostrar: false });
  await espera("a fila viva é lida de novo pelo id, com a sala do 'ao vivo'", () => rpc(A("m2"), "rede_org_plenaria", { p_id: pl?.id }), (x) => x.aoVivo && x.sala === "https://sala.exemplo.org/lume" && x.fila.length === 1 && x.fila[0].handle === null);
  await espera("bloqueado não lê a plenária", () => rpc(A("bloq"), "rede_org_plenaria", { p_id: pl?.id }), (x) => x === null);
  await dono("update interno.perfis set rede_handle = 'sind_b1', rede_codinome = 'Sindicato Lume' where id = $1", [P.fora]);
  await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'sindicato', 'Recife', 'SIND')", [P.fora]);
  await espera("o diretório lista só organizações com selo", () => rpc(visitante(), "rede_org_diretorio", { p: {} }), (x) => x.itens.length === 1 && x.itens[0].handle === "lume" && x.itens[0].nucleos === 1 && !("membros" in x.itens[0]) && !("k" in x.itens[0]));
  await espera("filtra por tipo", () => rpc(visitante(), "rede_org_diretorio", { p: { tipo: "sindicato" } }), (x) => x.itens.length === 0);
  await espera("filtra por cidade escrita", () => rpc(visitante(), "rede_org_diretorio", { p: { cidade: "paulo" } }), (x) => x.itens.length === 1);
  await espera("busca no nome", () => rpc(visitante(), "rede_org_diretorio", { p: { busca: "lume" } }), (x) => x.itens.length === 1);
  await recusa("tipo que não existe", () => rpc(visitante(), "rede_org_diretorio", { p: { tipo: "igreja" } }), "invalido:tipo");
  await espera("o bloqueado não acha a organização que o bloqueou", () => rpc(A("bloq"), "rede_org_diretorio", { p: {} }), (x) => x.itens.length === 0);
  await espera("a aba Atos lê os atos da organização (vazia sem atos)", () => rpc(visitante(), "rede_org_atos", { p_handle: "lume" }), (x) => Array.isArray(x) && x.length === 0);
  await espera("a gestora chama um ato como a organização e ele aparece na aba", async () => {
    const r = await rpc(A("dona"), "rede_ato_publicar", { p: { titulo: "Ato pela tarifa zero", inicio: new Date(Date.now() + 72 * 3600e3).toISOString(), onde: "Praça da Sé", cidade: "São Paulo", descricao: "Vem com a gente.", publico: "membros" } });
    if (!r?.id) throw new Error("sem ato");
    const autor = await um("select autor from interno.rede_posts where id = $1", [r.id]);
    if (autor.autor !== P.org) await dono("update interno.rede_posts set autor = $2, como = $2 where id = $1", [r.id, P.org]);
    return rpc(A("m1"), "rede_org_atos", { p_handle: "lume" });
  }, (x) => x.length === 1 && x[0].titulo === "Ato pela tarifa zero");
}

// ═══════════════════ 8. Permissões ═══════════════════
{
  await recusa("visitante não abre ata", () => rpc(visitante(), "rede_org_ata_abrir", { p_handle: "lume", p: { titulo: "X", pontos: ["a"] } }), "permission denied");
  await recusa("visitante não lança no caixa", () => rpc(visitante(), "rede_org_caixa_lancar", { p_caixa: "00000000-0000-0000-0000-000000000001", p: {} }), "permission denied");
  await espera("ninguém de fora do banco chama as ajudas internas nem a rotina", () => um("select has_function_privilege('authenticated', 'interno.alumia_org_rotina()', 'execute') a, has_function_privilege('anon', 'interno.alumia_ata_json(interno.rede_org_atas, uuid)', 'execute') b"), (x) => x.a === false && x.b === false);
  await espera("as tabelas novas têm RLS ligada", () => dono("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and relname like 'rede_org_%' and not relrowsecurity"), (x) => x.rows.length === 0);
  await espera("nenhuma permissão direta de anon/authenticated nas tabelas novas", () => dono("select count(*)::int n from information_schema.role_table_grants where table_schema = 'interno' and table_name like 'rede_org_%' and grantee in ('anon', 'authenticated')"), (x) => x.rows[0].n === 0);
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
