// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a porta de entrada da Alumia (supabase/migracoes/20261114-alumia-o8-porta.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql, e a conta pura da prova de trabalho
// (lib/rede/convites/prova*.ts: o desafio assinado e com prazo, resolvido com a Web Crypto do Node, a mesma do navegador).
// O centro: nenhum endereço de rede chega ao banco; o desafio vale uma vez; o freio por rede e o teto da casa por hora seguram a
// enxurrada (com alerta e aviso à coordenação); com a porta ligada, pular o servidor não adianta; o convite leva à triagem e não
// aprova; ninguém vê quem convidou quem e a marca "veio por convite" some quando a triagem decide.
// Uso: npm run testar:alumia-o8-porta
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { dificuldadeDaPressao, DIFICULDADE_BASE, DIFICULDADE_MAXIMA, DIFICULDADE_SEM_MEDIDA, zerosIniciais } from "../lib/rede/convites/prova.ts";
import { chaveDoFreio, chaveDosDesafios, conferirDesafio, emitirDesafio } from "../lib/rede/convites/prova-servidor.ts";
import { resolverDesafio } from "../lib/rede/convites/prova-aparelho.ts";
import { enderecoDoPedido, impressaoDaRede, veioDaBorda } from "../lib/rede/painel/impressao.ts";
import { IMPRESSAO_SEM_REDE, impressaoDoFreio } from "../lib/rede/convites/servidor.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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
    if (codigo instanceof RegExp ? codigo.test(String(erro.message)) : String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. Os arquivos ═══════════════════
const sql = ler("supabase/migracoes/20261114-alumia-o8-porta.sql");
ok("toda função nova é security definer com search_path fixo (menos as duas puras de data, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = /interno\.(alumia_cadastro_hora|alumia_convite_mes)\(/;
  return funcoes.length >= 17 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || puras.test(f));
})());
ok("as sete tabelas nascem em interno, com RLS e sem política nem permissão direta", (sql.match(/create table if not exists interno\.alumia_[a-z_]+/g) ?? []).length === 7
  && /enable row level security/.test(sql) && !/create policy/i.test(sql) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede, impressão do painel ou código de convite", (() => {
  const tabelas = sql.match(/create table if not exists interno\.alumia_[a-z_]+ \([\s\S]*?\n\);/g) ?? [];
  return tabelas.length === 7 && !tabelas.some((t) => /\b(inet|cidr|endereco|ip|porta_origem|impressao|codigo|email)\b/.test(t));
})());
ok("não mexe no install.sql, na versão da Alumia nem na lista das funções abertas", !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(sql));
ok("termina passando as funções novas pela porta da entrada", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
for (const rota of ["conta", "pedido", "desafio", "convite"]) {
  const texto = ler(`app/api/alumia/porta/${rota}/route.ts`);
  ok(`a rota ${rota} não lê endereço nem manda endereço ao banco (só a impressão, calculada na hora)`, !/cf-connecting-ip|x-forwarded-for|x-real-ip|enderecoDoPedido|p_endereco|console\./.test(texto));
}
ok("a conta é pedida ao serviço de contas só depois de o banco conferir a porta", (() => {
  const t = ler("app/api/alumia/porta/conta/route.ts");
  const rpc = t.indexOf('rpcDeServico<{ ok: boolean; motivo?: string }>("alumia_cadastro_passar"');
  // Onda 9: a conta nasce pela API de administração (o cadastro público do serviço de contas pode ficar desligado).
  return rpc > 0 && t.indexOf('servicoDeContas("/admin/users"') > rpc && t.indexOf("conferirDesafio(c?.desafio") < rpc && !t.includes("/auth/v1/signup");
})());
ok("o criar conta usa a prova do aparelho e, junto, o desafio da Cloudflare com a resposta para o servidor (decisão de 13/11)", (() => {
  const f = ler("components/rede/entrada/Formularios.tsx");
  const criar = f.slice(f.indexOf("export function FormCriar"), f.indexOf("export function FormPedido"));
  return /<Captcha action="conta"/.test(criar) && /turnstile: desafio\.token/.test(criar) && /<ProvaDoAparelho/.test(criar) && /antesDoPedido\(\)/.test(f);
})());
ok("a página do convite abre sem conta (a entrada deixa passar pelo encaixe)", /LIVRES_DA_PORTA\.test\(caminho\)/.test(ler("components/rede/entrada/PortaoDaAlumia.tsx")));

// ═══════════════════ 1. A prova de trabalho ═══════════════════
const SEGREDO = "segredo-de-teste-com-mais-de-32-letras-0123456789";
const chave = chaveDosDesafios(SEGREDO);
ok("a chave dos desafios sai do segredo do servidor, com rótulo próprio (não é a da impressão)", chave.equals(chaveDosDesafios(SEGREDO)) && !chave.equals(chaveDosDesafios(SEGREDO + "x")) && chave.length === 32);
ok("segredo curto: chave sorteada no processo (a mesma até reiniciar)", chaveDosDesafios("curto").equals(chaveDosDesafios(undefined)) && !chaveDosDesafios("curto").equals(chave));
ok("os bits zero do começo", zerosIniciais(new Uint8Array([0, 0, 0x0f, 0xff])) === 20 && zerosIniciais(new Uint8Array([0x80])) === 0 && zerosIniciais(new Uint8Array([0, 1])) === 15);
ok("sem pressão, a dificuldade base; sem medida, a de cautela", dificuldadeDaPressao({ rede: 0, rede_teto: 3, casa: 0, casa_teto: 60 }) === DIFICULDADE_BASE && dificuldadeDaPressao(null) === DIFICULDADE_SEM_MEDIDA);
ok("a mesma rede de novo sobe um bit por vez (até 4)", dificuldadeDaPressao({ rede: 2, rede_teto: 3, casa: 0, casa_teto: 60 }) === DIFICULDADE_BASE + 2 && dificuldadeDaPressao({ rede: 40, rede_teto: 3, casa: 0, casa_teto: 60 }) === DIFICULDADE_BASE + 4);
ok("a casa perto do teto sobe: metade +1, três quartos +2, 90% +3; nunca passa do teto", dificuldadeDaPressao({ rede: 0, rede_teto: 3, casa: 30, casa_teto: 60 }) === DIFICULDADE_BASE + 1
  && dificuldadeDaPressao({ rede: 0, rede_teto: 3, casa: 45, casa_teto: 60 }) === DIFICULDADE_BASE + 2 && dificuldadeDaPressao({ rede: 9, rede_teto: 3, casa: 59, casa_teto: 60 }) === DIFICULDADE_MAXIMA);

const agora = Date.now();
const d1 = emitirDesafio("conta", 16, chave, agora);
ok("o desafio tem momento, dificuldade, prazo de 10 minutos, sorteio e assinatura (e nada de quem pediu)", /^p1\.conta\.16\.\d{13}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(d1.desafio) && d1.vence === agora + 600_000);
ok("dificuldade fora da faixa é trazida para dentro", emitirDesafio("conta", 3, chave, agora).dificuldade === DIFICULDADE_BASE && emitirDesafio("conta", 40, chave, agora).dificuldade === DIFICULDADE_MAXIMA);
const resposta = await resolverDesafio(d1.desafio, d1.dificuldade);
const certa = conferirDesafio(d1.desafio, resposta, "conta", chave, agora + 1000);
ok("o aparelho resolve com a Web Crypto e o servidor aceita, com o selo do desafio", certa.ok && /^[0-9a-f]{64}$/.test(certa.selo) && certa.dificuldade === 16);
ok("resposta errada não passa", (() => {
  for (let i = 0; i < 50; i++) {
    const r = conferirDesafio(d1.desafio, `zz${i}`, "conta", chave, agora + 1000);
    if (r.ok) return false;
  }
  return true;
})());
ok("o desafio de um momento não vale para o outro", conferirDesafio(d1.desafio, resposta, "pedido", chave, agora + 1000).ok === false);
ok("assinatura de outra chave não passa", conferirDesafio(d1.desafio, resposta, "conta", chaveDosDesafios(SEGREDO + "y"), agora + 1000).ok === false);
ok("mexer na dificuldade quebra a assinatura", conferirDesafio(d1.desafio.replace(".16.", ".15."), resposta, "conta", chave, agora + 1000).ok === false);
ok("vencido não passa", (() => {
  const r = conferirDesafio(d1.desafio, resposta, "conta", chave, agora + 601_000);
  return !r.ok && r.motivo === "desafio_vencido";
})());
ok("lixo não passa", ["", "p1.conta", null, 42, "x".repeat(300)].every((x) => conferirDesafio(x, resposta, "conta", chave, agora).ok === false));
const IMP = impressaoDaRede("203.0.113.7", SEGREDO);
ok("o resumo do freio muda com a hora e com o momento, e não é a impressão", (() => {
  const a = chaveDoFreio(IMP, "conta", agora), b = chaveDoFreio(IMP, "conta", agora + 3_600_000), c = chaveDoFreio(IMP, "pedido", agora);
  return /^[0-9a-f]{64}$/.test(a) && a !== b && a !== c && a !== IMP && chaveDoFreio(null, "conta") === null && chaveDoFreio("lixo", "conta") === null;
})());

ok("sem impressão, os pedidos dividem um balde só no freio (o banco nunca pula o freio da rede)", impressaoDoFreio(null) === IMPRESSAO_SEM_REDE && chaveDoFreio(impressaoDoFreio(null), "conta") !== null && impressaoDoFreio(IMP) === IMP);
ok("as rotas da conta e do pedido mandam o balde quando não há impressão; o desafio sobe ao máximo em produção", ["conta", "pedido"].every((r) => /chaveDoFreio\(impressaoDoFreio\(impressao\)/.test(ler(`app/api/alumia/porta/${r}/route.ts`)))
  && /semImpressaoEmProducao\(impressao\) \? DIFICULDADE_MAXIMA/.test(ler("app/api/alumia/porta/desafio/route.ts")));
{
  const SINAL = "sinal-da-borda-de-teste-com-mais-de-32-letras";
  const com = new Headers({ "cf-connecting-ip": "203.0.113.9", "x-alumia-borda": SINAL });
  const sem = new Headers({ "cf-connecting-ip": "203.0.113.9" });
  const antes = process.env.ALUMIA_BORDA_SEGREDO;
  process.env.ALUMIA_BORDA_SEGREDO = SINAL;
  ok("com o segredo da borda definido, o cf-connecting-ip só vale com o sinal da borda (quem chega à origem por fora não escolhe o endereço)",
    enderecoDoPedido(com, true) === "203.0.113.9" && enderecoDoPedido(sem, true) === null && enderecoDoPedido(new Headers({ "cf-connecting-ip": "203.0.113.9", "x-alumia-borda": "outro" }), true) === null);
  if (antes === undefined) delete process.env.ALUMIA_BORDA_SEGREDO;
  else process.env.ALUMIA_BORDA_SEGREDO = antes;
  ok("sem o segredo da borda, vale o cf-connecting-ip como antes", veioDaBorda(sem, undefined) && enderecoDoPedido(sem, true) === "203.0.113.9");
}

// ═══════════════════ 2. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const servico = { papel: "service_role", ip: "127.0.0.1" };
const hex = (n) => n.toString(16).padStart(64, "0");
let contador = 1;
const selo = () => hex(contador++);
const vence = () => new Date(Date.now() + 9 * 60_000).toISOString();
const passar = (args) => rpc(servico, "alumia_cadastro_passar", { p_chave: null, p_impressao: null, p_usuario: null, p_convite: null, p_vence: vence(), p_selo: selo(), ...args });

const P = {};
for (const nome of ["coord", "mediador", "membro", "novo", "outro", "terceiro", "quarto"]) {
  P[nome] = await criarUsuario(`${nome}@porta.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.mediador]);
await dono("update interno.perfis set rede_codinome = 'Codinome coord', rede_codinome_ok = true where id = $1", [P.coord]);
for (const nome of ["membro", "mediador"]) {
  await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P[nome]]);
}

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("a configuração nasce com a porta desligada e os tetos padrão", async () => (await dono("select valor from interno.configuracoes where chave = 'alumia_cadastro'")).rows[0].valor,
  (v) => v.ligada === false && v.teto_hora === 60 && v.convites_mes === 3 && v.rede_contas_hora === 3 && v.rede_pedidos_hora === 6);

// Quem chama o quê
for (const f of [["alumia_cadastro_pressao", { p_chave: null, p_momento: "conta" }], ["alumia_cadastro_passar", { p_momento: "conta", p_chave: null, p_selo: hex(9999), p_vence: vence() }], ["alumia_convite_conferir", { p_codigo: "0".repeat(32) }]]) {
  await recusa(`visitante não chama ${f[0]}`, () => rpc(visitante, f[0], f[1]), /permission denied|sem_permissao/);
  await recusa(`conta comum não chama ${f[0]}`, () => rpc(como(P.membro), f[0], f[1]), /permission denied|sem_permissao/);
}
for (const f of ["alumia_convite_criar", "alumia_convites_meus", "alumia_triagem_convites", "alumia_painel_porta"]) {
  await recusa(`visitante não chama ${f}`, () => rpc(visitante, f), /permission denied|entre_primeiro|sem_permissao|alumia_entrada/);
}
// Na junção da onda 8, a marca da triagem entrou na lista de exceções da porta, como as outras funções da triagem (que têm a regra
// delas: papel e segundo fator): a mediação ainda não aprovada na Alumia também vê a marca com a trava ligada.
await espera("as funções de membro e do painel ganharam a porta da entrada; a da triagem fica com a regra dela; as do servidor não precisam (só a chave de serviço chama)", async () => (await dono(`
  select p.proname, position('interno.alumia_porta()' in p.prosrc) > 0 as porta from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('alumia_convite_criar', 'alumia_convites_meus', 'alumia_convite_cancelar', 'alumia_triagem_convites', 'alumia_painel_porta', 'alumia_painel_porta_ajustar', 'alumia_cadastro_passar')`)).rows,
  (rows) => rows.length === 7 && rows.every((r) => (["alumia_cadastro_passar", "alumia_triagem_convites"].includes(r.proname) ? !r.porta : r.porta)));

// ── A prova, o freio e o teto ──
const chaveA = chaveDoFreio(IMP, "conta");
const chaveB = chaveDoFreio(impressaoDaRede("198.51.100.20", SEGREDO), "conta");
await espera("a pressão de uma rede nova: zero, com os tetos", () => rpc(servico, "alumia_cadastro_pressao", { p_chave: chaveA, p_momento: "conta" }), (r) => r.rede === 0 && r.rede_teto === 3 && r.casa === 0 && r.casa_teto === 60);
const umSelo = selo();
await espera("conta nova passa", () => passar({ p_momento: "conta", p_chave: chaveA, p_selo: umSelo, p_impressao: IMP }), (r) => r.ok === true);
await espera("o mesmo desafio não vale duas vezes", () => passar({ p_momento: "conta", p_chave: chaveA, p_selo: umSelo, p_impressao: IMP }), (r) => r.ok === false && r.motivo === "desafio_usado");
await passar({ p_momento: "conta", p_chave: chaveA });
await passar({ p_momento: "conta", p_chave: chaveA });
await espera("a quarta conta da mesma rede na mesma hora para no freio", () => passar({ p_momento: "conta", p_chave: chaveA }), (r) => r.ok === false && r.motivo === "muitos_pedidos");
await espera("outra rede passa", () => passar({ p_momento: "conta", p_chave: chaveB }), (r) => r.ok === true);
await espera("a pressão sobe: a rede já passou e a casa contou", () => rpc(servico, "alumia_cadastro_pressao", { p_chave: chaveA, p_momento: "conta" }), (r) => r.rede === 4 && r.casa === 4);
await espera("recusas contam no número da hora (para o painel), sem contar como conta", async () => (await dono("select contas, recusados from interno.alumia_cadastro_horas")).rows[0], (h) => h.contas === 4 && h.recusados === 2);
await recusa("prazo absurdo não entra", () => passar({ p_momento: "conta", p_vence: new Date(Date.now() + 3 * 3_600_000).toISOString() }), "invalido:prazo");
await recusa("selo torto não entra", () => passar({ p_momento: "conta", p_selo: "abc" }), "invalido:desafio");
await espera("o banco não guarda a impressão: só o resumo do freio, que é outro", async () => (await dono("select count(*)::int as n from interno.alumia_cadastro_freio where chave = $1", [IMP])).rows[0].n, (n) => n === 0);

// Rede barrada pelo painel
await dono("insert into interno.alumia_impressao_banimentos (id, motivo, ate) values ('00000000-0000-4000-8000-0000000000b1', 'Enxurrada de contas falsas no teste.', now() + interval '1 day')");
await dono("insert into interno.alumia_impressao_banidas (banimento, impressao) values ('00000000-0000-4000-8000-0000000000b1', $1)", [impressaoDaRede("192.0.2.66", SEGREDO)]);
await espera("rede barrada pelo painel não cria conta", () => passar({ p_momento: "conta", p_impressao: impressaoDaRede("192.0.2.66", SEGREDO) }), (r) => r.ok === false && r.motivo === "rede_barrada");
await dono("update interno.alumia_impressao_banimentos set encerrado_em = now()");
await espera("banimento encerrado: a rede volta", () => passar({ p_momento: "conta", p_impressao: impressaoDaRede("192.0.2.66", SEGREDO) }), (r) => r.ok === true);

// O teto da casa por hora, com alerta e um aviso só
await dono("delete from interno.alumia_cadastro_horas");
await dono("update interno.configuracoes set valor = valor || '{\"teto_hora\": 5}' where chave = 'alumia_cadastro'");
const avisosAntes = Number((await dono("select count(*) as n from interno.avisos where para = $1", [P.coord])).rows[0].n);
for (let i = 0; i < 5; i++) await passar({ p_momento: "conta" });
await espera("a sexta conta da hora para no teto da casa", () => passar({ p_momento: "conta" }), (r) => r.ok === false && r.motivo === "porta_cheia");
await passar({ p_momento: "conta" });
await espera("a hora fica marcada com o alerta e a coordenação recebe UM aviso", async () => ({
  h: (await dono("select alerta_em is not null as alerta, recusados from interno.alumia_cadastro_horas")).rows[0],
  n: Number((await dono("select count(*) as n from interno.avisos where para = $1", [P.coord])).rows[0].n) - avisosAntes,
}), ({ h, n }) => h.alerta && h.recusados === 2 && n === 1);
await espera("o teto das contas não fecha os pedidos (cada um tem o seu)", () => passar({ p_momento: "pedido", p_usuario: P.quarto }), (r) => r.ok === true);
await dono("update interno.configuracoes set valor = valor || '{\"teto_hora\": 60}' where chave = 'alumia_cadastro'");

// ── O pedido de entrada com a porta ligada ──
const pedir = (quem, codinome) => rpc(como(quem, "aal1"), "alumia_entrada_pedir", { p_codinome: codinome, p_motivo: "Quero me organizar com o núcleo do meu bairro.", p_maior: true, p_versao: 1, p_aceite: true });
await espera("com a porta desligada, o pedido sai sem passe (como antes)", () => pedir(P.terceiro, "Faisca Terceira"), (r) => r.situacao === "em_analise");
await dono("update interno.configuracoes set valor = valor || '{\"ligada\": true}' where chave = 'alumia_cadastro'");
await recusa("com a porta ligada, pular o servidor não adianta: sem passe, o banco recusa", () => pedir(P.novo, "Faisca Nova"), "alumia_porta");
await espera("o servidor dá o passe depois da prova", () => passar({ p_momento: "pedido", p_usuario: P.novo }), (r) => r.ok === true && r.convite === "nenhum");
await espera("com o passe, o pedido sai", () => pedir(P.novo, "Faisca Nova"), (r) => r.situacao === "em_analise");
await espera("o passe vale uma vez (o pedido gastou)", async () => (await dono("select count(*)::int as n from interno.alumia_cadastro_passes where usuario = $1", [P.novo])).rows[0].n, (n) => n === 0);
await recusa("pedir de novo sem outro passe é recusado", () => pedir(P.novo, "Faisca Nova"), "alumia_porta");
await espera("passe vencido não vale", async () => {
  await passar({ p_momento: "pedido", p_usuario: P.novo });
  await dono("update interno.alumia_cadastro_passes set vence_em = now() - interval '1 minute' where usuario = $1", [P.novo]);
  try {
    await pedir(P.novo, "Faisca Nova");
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => /alumia_porta/.test(m));
await espera("a triagem decide sem passe nenhum (a regra é só para o pedido de quem pede)", async () => {
  const ficha = (await dono("select id from interno.alumia_entrada where usuario = $1", [P.terceiro])).rows[0].id;
  return rpc(como(P.coord), "alumia_triagem_decidir", { p_id: ficha, p_aprovar: false, p_motivo: "Pedido de teste, recusado de propósito." });
});

// ── Convites ──
await recusa("quem não está dentro não gera convite", () => rpc(como(P.novo), "alumia_convite_criar"), "sem_permissao");
const c1 = await espera("quem está dentro gera um convite: o código sai uma vez, com o prazo de 7 dias", () => rpc(como(P.membro), "alumia_convite_criar"),
  (r) => /^[0-9a-f]{32}$/.test(r.codigo) && r.restam === 2 && Math.abs(new Date(r.vence_em).getTime() - Date.now() - 7 * 86_400_000) < 120_000);
await espera("o banco guarda só o resumo do código", async () => (await dono("select selo from interno.alumia_convites where id = $1", [c1?.id])).rows[0].selo, (s) => /^[0-9a-f]{64}$/.test(s) && !s.includes(c1?.codigo ?? "-"));
await espera("o resumo é o SHA-256 do código (interno.selo)", async () => (await dono("select selo = interno.selo($2) as igual from interno.alumia_convites where id = $1", [c1?.id, c1?.codigo])).rows[0].igual, (v) => v === true);
const c2 = await rpc(como(P.membro), "alumia_convite_criar");
const c3 = await rpc(como(P.membro), "alumia_convite_criar");
await recusa("o quarto convite do mês passa do teto", () => rpc(como(P.membro), "alumia_convite_criar"), "teto_de_convites");
await espera("a página do convite pergunta pelo servidor: vale, com o prazo, sem dizer de quem", () => rpc(servico, "alumia_convite_conferir", { p_codigo: c2.codigo }),
  (r) => r.valido === true && r.vence_em && Object.keys(r).sort().join() === "valido,vence_em");
await espera("código que não existe: não vale (e não diz mais nada)", () => rpc(servico, "alumia_convite_conferir", { p_codigo: "f".repeat(32) }), (r) => r.valido === false && Object.keys(r).length === 1);
await espera("os meus convites: o teto, o que resta e a situação de cada um, nunca quem usou", () => rpc(como(P.membro), "alumia_convites_meus"),
  (r) => r.teto === 3 && r.no_mes === 3 && r.restam === 0 && r.pode === true && r.convites.length === 3 && r.convites.every((c) => Object.keys(c).sort().join() === "criado_em,id,situacao,vence_em"));
await espera("cancelar um convite meu", () => rpc(como(P.membro), "alumia_convite_cancelar", { p_id: c3.id }), (r) => r.ok);
await recusa("não cancelo o convite de outra pessoa", () => rpc(como(P.mediador), "alumia_convite_cancelar", { p_id: c2.id }), "nao_encontrado");
await espera("cancelado não vale mais", () => rpc(servico, "alumia_convite_conferir", { p_codigo: c3.codigo }), (r) => r.valido === false);
await espera("cancelado continua contando no teto do mês", () => rpc(como(P.membro), "alumia_convites_meus"), (r) => r.restam === 0 && r.convites.some((c) => c.situacao === "cancelado"));

await espera("quem gerou não usa o próprio convite", () => passar({ p_momento: "pedido", p_usuario: P.membro, p_convite: c1.codigo }), (r) => r.ok === true && r.convite === "invalido");
// Ruído: um convite aberto de outra pessoa, que não pode ficar com a versão (xmin/xmax) da transação do pedido.
await dono("insert into interno.alumia_entrada (usuario, situacao, origem, decidido_em) values ($1, 'aprovada', 'cadastro', now()) on conflict (usuario) do update set situacao = 'aprovada'", [P.coord]);
const cRuido = await rpc(como(P.coord), "alumia_convite_criar");
await espera("o pedido com convite: o convite sai da tabela e a conta ganha só a marca", () => passar({ p_momento: "pedido", p_usuario: P.outro, p_convite: c1.codigo }), (r) => r.ok === true && r.convite === "aceito");
await espera("o convite usado não fica no banco (nem com outra situação)", async () => (await dono("select count(*)::int as n from interno.alumia_convites where id = $1", [c1.id])).rows[0].n, (n) => n === 0);
await espera("ataque pelo xmin: nenhum convite vivo tem a versão (xmin ou xmax) da transação que gravou a marca e o passe", async () => {
  const marca = (await dono("select xmin::text as x from interno.alumia_convite_pedidos where usuario = $1", [P.outro])).rows[0].x;
  const passe = (await dono("select xmin::text as x from interno.alumia_cadastro_passes where usuario = $1", [P.outro])).rows[0].x;
  const casam = (await dono("select count(*)::int as n from interno.alumia_convites where xmin::text in ($1, $2) or xmax::text in ($1, $2)", [marca, passe])).rows[0].n;
  return { marca, passe, casam };
}, ({ marca, passe, casam }) => marca === passe && casam === 0);
await espera("o convite que não vale não é tocado (nem trava de linha da transação do pedido)", async () => {
  const antes = (await dono("select xmin::text as x, xmax::text as y from interno.alumia_convites where id = $1", [cRuido.id])).rows[0];
  const r = await passar({ p_momento: "pedido", p_usuario: P.coord, p_convite: cRuido.codigo });
  const depois = (await dono("select xmin::text as x, xmax::text as y from interno.alumia_convites where id = $1", [cRuido.id])).rows[0];
  return r.convite === "invalido" && antes.x === depois.x && antes.y === depois.y;
}, (v) => v === true);
await espera("o convite usado conta no número do mês, sem aparecer na lista", () => rpc(como(P.membro), "alumia_convites_meus"),
  (r) => r.usados === 1 && r.no_mes === 3 && r.restam === 0 && r.convites.length === 2 && !r.convites.some((c) => c.id === c1.id));
await espera("o mesmo convite não serve a mais ninguém", () => passar({ p_momento: "pedido", p_usuario: P.quarto, p_convite: c1.codigo }), (r) => r.convite === "invalido");
await espera("a marca não diz qual convite, e o convite não diz quem usou", async () => (await dono(`
  select table_name, string_agg(column_name, ',' order by column_name) as colunas from information_schema.columns
  where table_schema = 'interno' and table_name in ('alumia_convite_pedidos', 'alumia_convites') group by table_name order by table_name`)).rows,
  (rows) => rows.find((r) => r.table_name === "alumia_convite_pedidos")?.colunas === "usuario" && rows.find((r) => r.table_name === "alumia_convites")?.colunas === "criado_em,criado_por,id,selo,situacao,vence_em");
await espera("o convite não aprova: o pedido fica em análise como qualquer outro", () => pedir(P.outro, "Faisca Outra"), (r) => r.situacao === "em_analise");
const fichaOutro = (await dono("select id from interno.alumia_entrada where usuario = $1", [P.outro])).rows[0].id;
const fichaNovo = (await dono("select id from interno.alumia_entrada where usuario = $1", [P.novo])).rows[0].id;
await espera("a triagem vê que veio por convite (só o número da ficha, nunca de quem)", () => rpc(como(P.mediador), "alumia_triagem_convites"), (ids) => ids.includes(fichaOutro) && !ids.includes(fichaNovo));
await recusa("quem não é da triagem não vê nem isso", () => rpc(como(P.membro), "alumia_triagem_convites"), "sem_permissao");
await recusa("a triagem sem o segundo fator também não", () => rpc(como(P.mediador, "aal1"), "alumia_triagem_convites"), "sem_permissao");
await espera("a triagem decide e a marca some", async () => {
  await rpc(como(P.mediador), "alumia_triagem_decidir", { p_id: fichaOutro, p_aprovar: true, p_motivo: "" });
  return {
    marca: (await dono("select count(*)::int as n from interno.alumia_convite_pedidos where usuario = $1", [P.outro])).rows[0].n,
    fila: await rpc(como(P.mediador), "alumia_triagem_convites"),
  };
}, ({ marca, fila }) => marca === 0 && !fila.includes(fichaOutro));

// O convite atravessa o teto da hora (o freio da rede continua)
await dono("delete from interno.alumia_cadastro_horas");
await dono("update interno.configuracoes set valor = valor || '{\"teto_hora\": 5}' where chave = 'alumia_cadastro'");
for (let i = 0; i < 5; i++) await passar({ p_momento: "pedido", p_usuario: P.quarto });
await espera("com a porta cheia, pedido sem convite espera", () => passar({ p_momento: "pedido", p_usuario: P.quarto }), (r) => r.motivo === "porta_cheia");
await espera("pedido com convite válido passa por cima do teto", () => passar({ p_momento: "pedido", p_usuario: P.quarto, p_convite: c2.codigo }), (r) => r.ok === true && r.convite === "aceito");
const chaveQ = chaveDoFreio(impressaoDaRede("198.51.100.77", SEGREDO), "pedido");
await espera("mas não por cima do freio da rede", async () => {
  await dono("update interno.configuracoes set valor = valor || '{\"teto_hora\": 60}' where chave = 'alumia_cadastro'");
  for (let i = 0; i < 6; i++) await passar({ p_momento: "pedido", p_usuario: P.quarto, p_chave: chaveQ });
  return passar({ p_momento: "pedido", p_usuario: P.quarto, p_chave: chaveQ, p_convite: "a".repeat(32) });
}, (r) => r.motivo === "muitos_pedidos");

// ── O painel ──
await recusa("conta comum não abre a porta no painel", () => rpc(como(P.membro), "alumia_painel_porta"), "sem_permissao");
await recusa("a mediação também não (não entra no painel)", () => rpc(como(P.mediador), "alumia_painel_porta"), "sem_permissao");
await espera("a coordenação vê a porta: ligada, tetos, as horas e os convites, só números", () => rpc(como(P.coord), "alumia_painel_porta"),
  (r) => r.ligada === true && r.teto_hora === 60 && Array.isArray(r.horas) && r.horas.length >= 1 && r.horas.every((h) => Object.keys(h).sort().join() === "alerta,contas,hora,pedidos,recusados")
    && r.alerta === true && typeof r.convites.abertos === "number");
await recusa("ajustar pede motivo", () => rpc(como(P.coord), "alumia_painel_porta_ajustar", { p_ligada: false, p_teto_hora: 80, p_convites_mes: 5, p_rede_contas_hora: 3, p_rede_pedidos_hora: 6, p_motivo: "curto" }), "invalido:motivo");
await recusa("teto absurdo não entra", () => rpc(como(P.coord), "alumia_painel_porta_ajustar", { p_ligada: false, p_teto_hora: 1, p_convites_mes: 5, p_rede_contas_hora: 3, p_rede_pedidos_hora: 6, p_motivo: "Ajuste de teste do teto da porta." }), "invalido:teto_hora");
await espera("a coordenação ajusta, e fica no registro do painel", async () => {
  const r = await rpc(como(P.coord), "alumia_painel_porta_ajustar", { p_ligada: false, p_teto_hora: 80, p_convites_mes: 5, p_rede_contas_hora: 4, p_rede_pedidos_hora: 7, p_motivo: "Ajuste de teste do teto da porta." });
  const reg = (await dono("select count(*)::int as n from interno.alumia_painel_registro where acao = 'porta_ajustada'")).rows[0].n;
  return { r, reg };
}, ({ r, reg }) => r.ligada === false && r.teto_hora === 80 && r.convites_mes === 5 && r.rede_contas_hora === 4 && reg === 1);
await espera("o teto novo de convites vale na hora", () => rpc(como(P.membro), "alumia_convites_meus"), (r) => r.teto === 5 && r.restam === 2);
await espera("teto 0 desliga os convites", async () => {
  await rpc(como(P.coord), "alumia_painel_porta_ajustar", { p_ligada: false, p_teto_hora: 80, p_convites_mes: 0, p_rede_contas_hora: 4, p_rede_pedidos_hora: 7, p_motivo: "Convites desligados no teste." });
  try {
    await rpc(como(P.membro), "alumia_convite_criar");
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => /teto_de_convites/.test(m));

// ── A faxina e a idempotência ──
await espera("a faxina leva desafios e passes vencidos, o freio de ontem e as horas antigas", async () => {
  await dono("insert into interno.alumia_cadastro_gastos (selo, vence_em) values ($1, now() - interval '1 minute')", [hex(888888)]);
  await dono("insert into interno.alumia_cadastro_freio (chave, janela, total) values ($1, now() - interval '2 days', 1)", [hex(777777)]);
  await dono("insert into interno.alumia_cadastro_horas (hora) values (date_trunc('hour', now()) - interval '9 days')");
  return (await dono("select interno.alumia_cadastro_faxina() as r")).rows[0].r;
}, (r) => r.gastos >= 1 && r.freio >= 1 && r.horas >= 1);
const antes = (await dono("select (select count(*) from interno.alumia_convites)::int as convites, (select valor from interno.configuracoes where chave = 'alumia_cadastro') as cfg")).rows[0];
await espera("a terceira vez não apaga convite nem ajuste", async () => {
  await exec(sql);
  return (await dono("select (select count(*) from interno.alumia_convites)::int as convites, (select valor from interno.configuracoes where chave = 'alumia_cadastro') as cfg")).rows[0];
}, (depois) => depois.convites === antes.convites && JSON.stringify(depois.cfg) === JSON.stringify(antes.cfg));
await espera("conta apagada leva os convites e a marca dela", async () => {
  await dono("delete from interno.perfis where id = $1", [P.membro]);
  return (await dono("select count(*)::int as n from interno.alumia_convites where criado_por = $1", [P.membro])).rows[0].n;
}, (n) => n === 0);

console.log(`testar:alumia-o8-porta — ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
