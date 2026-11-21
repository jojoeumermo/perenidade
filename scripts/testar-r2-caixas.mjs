// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as caixas anônimas da R2 (supabase/migracoes/20261124-r2-caixas.sql) num Postgres local (scripts/banco-local.mjs), com a
// migração rodada DUAS vezes sobre o install.sql. Os ataques de quem tem o banco inteiro estão escritos como teste:
//   - o arquivo da migração no padrão (cabeçalho, porta no fim, sem endereço, sem parâmetro de linha com valor padrão);
//   - só o servidor do site chama as funções das caixas (nem visitante nem conta), e elas estão na lista de exceções da porta;
//   - criar, depositar, buscar, confirmar, trocar, apagar; passe errado responde igual ao certo; bloqueio corta na hora; teto por
//     caixa; um único "commit" por caixa; tamanho fixo; passe e desafio gastos só uma vez;
//   - o lote: o mesmo xmin para todos e a posição no disco sorteada;
//   - com acesso total ao banco, nenhuma linha liga caixa a conta: nenhuma coluna de conta, de hora ou de sequência nas tabelas das
//     caixas e dos passes, e o identificador da caixa só aparece nelas;
//   - o diretório (publicar com sessão, ler sem sessão, pré-chave entregue uma vez, a caixa de pedidos não aponta para caixa alheia);
//   - o registro de transparência com as linhas novas (a corrente fecha) e a chave de passes do dia (uma por dia);
//   - a limpeza de 30 dias, a marca dos passes do dia, a denúncia com prova na fila.
// Com R2_SEM_MIGRACAO=1, roda sem a migração e mostra o que falta.
// Uso: npm run testar:r2-caixas
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261124-r2-caixas.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");
const semMigracao = process.env.R2_SEM_MIGRACAO === "1";

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 400)}`);
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

const sorteio = (n) => crypto.randomBytes(n);
const b64 = (b) => Buffer.from(b).toString("base64");
const hexDe = (b) => Buffer.from(b); // o PGlite manda bytea como Uint8Array
const resumo = (rotulo, valor) => crypto.createHash("sha256").update(Buffer.concat([Buffer.from(rotulo, "utf8"), Buffer.from(valor)])).digest();
const caixaNova = (multi = false) => {
  const id = sorteio(32), pd = sorteio(32), pl = sorteio(32);
  return { id, pd, pl, multi, idH: resumo("alumia/r2/caixa", id), pdH: resumo("alumia/r2/passe-deposito", pd), plH: resumo("alumia/r2/passe-leitura", pl) };
};
// Os tamanhos aceitos (os mesmos de lib/rede/caixas/tamanhos.ts, conferidos lá contra o banco).
const DUPLA = [2048, 4096, 8192, 16384, 24576, 32768].map((n) => 1120 + n + 16);
const GRUPO = [2048, 8192, 32768, 131072].map((n) => 34 + n + 16);
const PEDIDO = 1120 + 4096 + 16;
const LIGAR = 1120 + 65536 + 16;

// ═══════════════════ 0. O arquivo da migração ═══════════════════
ok("a migração tem cabeçalho com a função e a lei", /Reforço 2 · Caixas anônimas/.test(sql) && /Leis: LGPD/.test(sql));
ok("a migração termina com a porta", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("a migração não tem endereço de rede nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função da migração recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok("nenhum corpo de função fala o nome antigo da rede", !/Rede Lúcia/.test(sql.replace(/^--.*$/gm, "")));
ok("nada de random() nas caixas (a ordem sorteada usa gen_random_bytes)", !/\brandom\(\)/.test(sql));

// ═══════════════════ 1. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const agora = () => Math.floor(Date.now() / 1000);
/** Chama uma função como a API faria: o papel e o token (sem token para o servidor do site e para o visitante). */
const rpc = (quem, funcao, argumentos = {}) =>
  banco.exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const papel = quem.papel ?? "authenticated";
    const claims = papel === "authenticated"
      ? JSON.stringify({ role: papel, sub: quem.sub, aal: "aal2", session_id: quem.sessao, iat: agora() - 30, exp: agora() + 3600 })
      : JSON.stringify({ role: papel });
    await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', '{}', false)", [claims]);
    await banco.pg.exec(`set role ${papel}`);
    try {
      const lista = nomes.map((n, i) => `${n} => $${i + 1}`).join(", ");
      const valores = nomes.map((n) => {
        const v = argumentos[n];
        return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Uint8Array) ? JSON.stringify(v) : v;
      });
      return (await banco.pg.query(`select public.${funcao}(${lista}) as r`, valores)).rows[0]?.r ?? null;
    } finally {
      await banco.pg.exec("reset role");
    }
  });
const servidor = { papel: "service_role" };
const visitante = { papel: "anon" };

if (!semMigracao) {
  await espera("a migração instala sobre o install.sql", () => exec(sql));
  await espera("de novo (idempotente)", () => exec(sql));
  // Na ordem das migrações, a da denúncia com prova (20261124-r2-franquia.sql) vem depois e troca a função da denúncia pela dela.
  await espera("e a da denúncia com prova, por cima (a ordem do install.sql)", () => exec(fs.readFileSync(path.join(raiz, "supabase/migracoes/20261124-r2-franquia.sql"), "utf8")));
}
await espera("a porta tranca tudo (nenhuma função aberta)", () => dono("select interno.alumia_trancar() as r"), (r) => (r.rows[0].r.abertas ?? []).length === 0);

// ═══════════════════ 2. Quem chama o quê ═══════════════════
const ANONIMAS = ["rede_caixa_lote", "rede_caixa_buscar", "rede_caixa_confirmar", "rede_caixa_trocar", "rede_caixa_apagar", "rede_passe_gastar",
  "rede_diretorio_ler", "rede_diretorio_reivindicar", "rede_passes_chave_registrar", "rede_franquia_denunciar"];
const COM_SESSAO = ["rede_diretorio_conta", "rede_diretorio_publicar", "rede_diretorio_pre_chaves", "rede_diretorio_pacotes_mls",
  "rede_diretorio_tirar_aparelho", "rede_diretorio_apagar", "rede_passes_marcar_hoje"];
const privs = (await dono(`
  select p.proname as nome, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut,
    has_function_privilege('service_role', p.oid, 'execute') as serv, p.prosrc ~ 'interno\\.alumia_(porta|passa)\\(\\)' as porta,
    interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid)) as excecao,
    p.prosecdef as definer, coalesce(array_to_string(p.proconfig, ','), '') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [[...ANONIMAS, ...COM_SESSAO]])).rows;
ok("as dezessete funções existem", privs.length === ANONIMAS.length + COM_SESSAO.length, `${privs.length}`);
for (const f of privs.filter((x) => ANONIMAS.includes(x.nome))) {
  ok(`${f.nome}: só o servidor do site chama (nem visitante, nem conta)`, !f.anon && !f.aut && f.serv);
  ok(`${f.nome}: está na lista de exceções escrita da porta`, f.excecao);
}
for (const f of privs.filter((x) => COM_SESSAO.includes(x.nome))) {
  ok(`${f.nome}: só quem entrou, e com a porta`, !f.anon && f.aut && f.porta && !f.excecao);
}
ok("todas security definer com search_path fixo", privs.every((f) => f.definer && /search_path=interno, pg_temp/.test(f.config)));
const internasAbertas = (await dono(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and (p.proname like 'caixa\\_%' or p.proname like 'diretorio\\_%' or p.proname in ('rede_kt_resumo2', 'rede_kt_acrescentar', 'rede_caixas_limpeza'))
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.proname);
ok(`as peças de dentro não são de ninguém (abertas: ${internasAbertas.join(", ")})`, internasAbertas.length === 0);
const kt = (await dono("select has_function_privilege('anon', 'public.rede_kt_trecho(bigint)', 'execute') as a, (select prosrc from pg_proc where oid = 'public.rede_kt_trecho(bigint)'::regprocedure) as s")).rows[0];
ok("o registro público continua aberto a qualquer um, sem a porta", kt.a && !/alumia_porta/.test(kt.s));
await recusa("visitante não chama o lote", () => rpc(visitante, "rede_caixa_lote", { p_itens: [], p_dia: "2026-01-01" }), "permission denied");

// ═══════════════════ 3. As pessoas ═══════════════════
const P = {};
for (const nome of ["ana", "bia", "caio"]) {
  P[nome] = await criarUsuario(`${nome}@r2.local`, `Pessoa ${nome}`);
  await rpc({ sub: P[nome], sessao: crypto.randomUUID() }, "eu").catch(() => undefined);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["ana", "bia", "caio"]) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `r2_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("select interno.alumia_entrada_ligar(true)");
await dono("insert into interno.alumia_entrada (usuario, situacao) values ($1, 'aprovada'), ($2, 'aprovada'), ($3, 'aprovada') on conflict (usuario) do update set situacao = 'aprovada'", [P.ana, P.bia, P.caio]);
const ana = { sub: P.ana, sessao: crypto.randomUUID() }, bia = { sub: P.bia, sessao: crypto.randomUUID() }, caio = { sub: P.caio, sessao: crypto.randomUUID() };
const hoje = (await dono("select interno.caixa_hoje()::text as d")).rows[0].d;
const lote = (itens, dia = hoje) => rpc(servidor, "rede_caixa_lote", { p_itens: itens, p_dia: dia });
const criar = (c, passe = sorteio(32)) => ({ acao: "criar", id_h: b64(c.idH), pd_h: b64(c.pdH), pl_h: b64(c.plH), multi: c.multi, gastos: [b64(passe)] });
const depositar = (c, tamanho = DUPLA[0], extra = {}) => ({ acao: "depositar", id_h: b64(c.idH), pd: b64(c.pd), envelope: b64(sorteio(tamanho)), ...extra });
const buscar = (c, cursor = 0) => rpc(servidor, "rede_caixa_buscar", { p_id_h: c.idH, p_pl: c.pl, p_cursor: cursor });
const contar = async (c) => (await dono("select count(*)::int as n from interno.pacotes where caixa_h = $1", [hexDe(c.idH)])).rows[0].n;

// ═══════════════════ 4. Criar e depositar ═══════════════════
const daAna = caixaNova(), daBia = caixaNova();
const passeA = sorteio(32);
await espera("criar a caixa com um passe", () => lote([criar(daAna, passeA), criar(daBia)]), (r) => r.resultados.every((x) => x.ok));
await espera("criar de novo com os mesmos resumos: ok (idempotente)", () => lote([criar(daAna)]), (r) => r.resultados[0].ok === true);
await espera("criar com o mesmo id e outros passes: recusa (ninguém toma a caixa alheia)", () => lote([criar({ ...caixaNova(), idH: daAna.idH })]), (r) => r.resultados[0].erro === "existe");
await espera("o mesmo passe numa caixa nova: recusa", () => lote([criar(caixaNova(), passeA)]), (r) => r.resultados[0].erro === "passe_usado");
await espera("criar sem passe: recusa", () => lote([{ ...criar(caixaNova()), gastos: [] }]), (r) => r.resultados[0].erro === "invalido");
for (const t of [...DUPLA, ...GRUPO.slice(0, 3), PEDIDO]) {
  await espera(`depositar ${t} bytes`, () => lote([depositar(daAna, t)]), (r) => r.resultados[0].ok === true);
}
await espera("depositar o tamanho do grupo de 131122 e do canal de ligar", () => lote([depositar(daAna, GRUPO[3]), depositar(daAna, LIGAR)]), (r) => r.resultados.every((x) => x.ok));
await espera("tamanho fora da lista: recusa", () => lote([depositar(daAna, 3000)]), (r) => r.resultados[0].erro === "tamanho");
const antes = await contar(daAna);
await espera("passe de depósito errado responde igual ao certo", () => lote([{ ...depositar(daAna), pd: b64(sorteio(32)) }]), (r) => JSON.stringify(r.resultados[0]) === JSON.stringify({ ok: true }));
ok("e não grava nada", (await contar(daAna)) === antes);
await espera("caixa que não existe responde igual", () => lote([depositar(caixaNova())]), (r) => JSON.stringify(r.resultados[0]) === JSON.stringify({ ok: true }));
await recusa("dia de anteontem: o lote é recusado", () => lote([depositar(daAna)], "2020-01-01"), "invalido:dia");

// ═══════════════════ 5. Buscar, confirmar ═══════════════════
const lidos = await espera("buscar com o passe de leitura", () => buscar(daAna), (r) => r.pacotes.length === antes && r.pacotes[0].ordem === 1);
ok("a ordem dentro da caixa cresce de 1 em 1", lidos && lidos.pacotes.every((p, i) => p.ordem === i + 1));
ok("o pacote volta igual em tamanho e com o dia (sem hora)", lidos && Buffer.from(lidos.pacotes[0].envelope, "base64").length === DUPLA[0] && lidos.pacotes[0].dia === hoje);
await espera("buscar com outro passe de leitura: lista vazia (igual à caixa vazia)", () => rpc(servidor, "rede_caixa_buscar", { p_id_h: daAna.idH, p_pl: sorteio(32), p_cursor: 0 }), (r) => r.pacotes.length === 0);
await espera("buscar depois do cursor", () => buscar(daAna, 5), (r) => r.pacotes.length === antes - 5 && r.pacotes[0].ordem === 6);
await espera("confirmar com outro passe não apaga", () => rpc(servidor, "rede_caixa_confirmar", { p_id_h: daAna.idH, p_pl: sorteio(32), p_ate: 99 }), () => true);
ok("(nada saiu)", (await contar(daAna)) === antes);
await rpc(servidor, "rede_caixa_confirmar", { p_id_h: daAna.idH, p_pl: daAna.pl, p_ate: 5 });
ok("confirmar até 5: os cinco primeiros SAEM do banco", (await contar(daAna)) === antes - 5);
const grupo = caixaNova(true);
await lote([criar(grupo)]);
await lote([depositar(grupo, GRUPO[0]), depositar(grupo, GRUPO[0])]);
await rpc(servidor, "rede_caixa_confirmar", { p_id_h: grupo.idH, p_pl: grupo.pl, p_ate: 2 });
ok("na caixa de vários leitores, confirmar não apaga (os outros membros ainda vão ler)", (await contar(grupo)) === 2);

// ═══════════════════ 6. Um commit por caixa, teto, troca e bloqueio ═══════════════════
await espera("o primeiro depósito único passa", () => lote([depositar(grupo, GRUPO[0], { unico: true })]), (r) => r.resultados[0].ok === true);
await espera("o segundo depósito único na mesma caixa: ocupada", () => lote([depositar(grupo, GRUPO[0], { unico: true })]), (r) => r.resultados[0].erro === "ocupada");
await espera("depósito comum continua passando", () => lote([depositar(grupo, GRUPO[0])]), (r) => r.resultados[0].ok === true);
await dono("update interno.caixa_contagem set n = 1000 where caixa_h = $1", [hexDe(daBia.idH)]);
await dono("insert into interno.caixa_contagem (caixa_h, dia, n) values ($1, interno.caixa_hoje(), 1000) on conflict (caixa_h, dia) do update set n = 1000", [hexDe(daBia.idH)]);
await espera("teto de 1000 por dia na caixa de um leitor: cheia", () => lote([depositar(daBia)]), (r) => r.resultados[0].erro === "cheia");
await dono("delete from interno.caixa_contagem where caixa_h = $1", [hexDe(daBia.idH)]);

const pdNovo = sorteio(32);
await espera("trocar o passe de depósito (sem bloqueio)", () => rpc(servidor, "rede_caixa_trocar", { p_id_h: daBia.idH, p_pl: daBia.pl, p_pd_h_novo: resumo("alumia/r2/passe-deposito", pdNovo), p_pl_h_novo: null, p_bloqueio: false }), (r) => r.ok);
let n0 = await contar(daBia);
await lote([depositar(daBia), depositar({ ...daBia, pd: pdNovo })]);
ok("sem bloqueio, o passe anterior vale mais 7 dias (mensagem no caminho chega)", (await contar(daBia)) === n0 + 2);
const pdBloqueio = sorteio(32);
await rpc(servidor, "rede_caixa_trocar", { p_id_h: daBia.idH, p_pl: daBia.pl, p_pd_h_novo: resumo("alumia/r2/passe-deposito", pdBloqueio), p_pl_h_novo: null, p_bloqueio: true });
n0 = await contar(daBia);
const respBloqueado = await lote([{ ...depositar(daBia), pd: b64(pdNovo) }]);
ok("bloqueio: quem foi bloqueado recebe a mesma resposta de sempre", JSON.stringify(respBloqueado.resultados[0]) === JSON.stringify({ ok: true }));
ok("e nada chega na caixa", (await contar(daBia)) === n0);
await lote([{ ...depositar(daBia), pd: b64(pdBloqueio) }]);
ok("quem tem o passe novo continua depositando", (await contar(daBia)) === n0 + 1);
await espera("trocar sem o passe de leitura: recusa", () => rpc(servidor, "rede_caixa_trocar", { p_id_h: daBia.idH, p_pl: sorteio(32), p_pd_h_novo: sorteio(32), p_pl_h_novo: null, p_bloqueio: true }), (r) => r.erro === "nao_encontrada");

// ═══════════════════ 7. O lote: um xmin, ordem física sorteada ═══════════════════
const muitas = Array.from({ length: 24 }, () => caixaNova());
await lote(muitas.map((c) => criar(c)));
await lote(muitas.map((c) => depositar(c)));
const fisico = (await dono(`select p.caixa_h, p.xmin::text as x, p.ctid::text as c from interno.pacotes p where p.caixa_h = any($1::bytea[]) order by p.ctid`, [muitas.map((c) => hexDe(c.idH))])).rows;
ok("as 24 linhas do lote têm o mesmo xmin", fisico.length === 24 && new Set(fisico.map((x) => x.x)).size === 1);
const ordemNoDisco = fisico.map((x) => muitas.findIndex((c) => Buffer.from(x.caixa_h).equals(c.idH)));
ok("e a posição no disco não é a ordem de chegada", ordemNoDisco.some((v, i) => v !== i), ordemNoDisco.join(","));
const caixasNoDisco = (await dono(`select k.id_h from interno.caixas k where k.id_h = any($1::bytea[]) order by k.ctid`, [muitas.map((c) => hexDe(c.idH))])).rows
  .map((x) => muitas.findIndex((c) => Buffer.from(x.id_h).equals(c.idH)));
ok("nem a das caixas criadas no mesmo lote", caixasNoDisco.some((v, i) => v !== i));

// ═══════════════════ 8. O diretório ═══════════════════
const conta = (extra = {}) => {
  const caixa = caixaNova();
  return { caixa, p: { identidade: b64(sorteio(32)), pedidos_xwing: b64(sorteio(1216)), pedidos_assinatura: b64(sorteio(64)), pedidos_caixa: b64(caixa.id), pedidos_pd: b64(caixa.pd), pedidos_pl_h: b64(caixa.plH), ...extra } };
};
await recusa("visitante não publica no diretório", () => rpc(visitante, "rede_diretorio_conta", { p: conta().p }), "permission denied");
const contaBia = conta();
await espera("a Bia publica a conta (identidade, chave e caixa de pedidos)", () => rpc(bia, "rede_diretorio_conta", { p: contaBia.p }), (r) => r.ok);
await espera("publicar de novo é idempotente", () => rpc(bia, "rede_diretorio_conta", { p: contaBia.p }), (r) => r.ok);
await recusa("o Caio não aponta a caixa de pedidos dele para a caixa de pedidos da Bia", () => rpc(caio, "rede_diretorio_conta", { p: { ...conta().p, pedidos_caixa: b64(contaBia.caixa.id), pedidos_pd: b64(contaBia.caixa.pd) } }), "caixa_ocupada");
await recusa("nem para a caixa de conversa da Ana", () => rpc(caio, "rede_diretorio_conta", { p: { ...conta().p, pedidos_caixa: b64(daAna.id) } }), "caixa_ocupada");
const dir = await espera("ler o diretório da Bia sem sessão, pelo codinome", () => rpc(servidor, "rede_diretorio_ler", { p_codinome: "codinome BIA" }), (r) => r?.usuario === P.bia && r.pedidos_caixa === b64(contaBia.caixa.id) && r.aparelhos.length === 0);
ok("o diretório não diz quantas pré-chaves sobram", dir && !JSON.stringify(dir).includes("restantes"));
await espera("codinome que não existe: nulo", () => rpc(servidor, "rede_diretorio_ler", { p_codinome: "ninguem aqui" }), (r) => r === null);

const aparelho = sorteio(32);
const ap = { aparelho: b64(aparelho), certificado: b64(sorteio(64)), proteus_impressao: b64(sorteio(32)), xwing_semana: b64(sorteio(1216)), xwing_assinatura: b64(sorteio(64)), semana: 2900 };
await espera("a Bia publica um aparelho", () => rpc(bia, "rede_diretorio_publicar", { p_aparelho: ap }), (r) => r.ok);
await recusa("o Caio não toma o aparelho da Bia", () => rpc(caio, "rede_diretorio_publicar", { p_aparelho: ap }), "aparelho_de_outra_conta");
const pre = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, pkb: b64(sorteio(83)), assinatura: b64(sorteio(64)), ultima: false }));
pre.push({ id: 65535, pkb: b64(sorteio(83)), assinatura: b64(sorteio(64)), ultima: true });
await espera("as pré-chaves do aparelho", () => rpc(bia, "rede_diretorio_pre_chaves", { p_aparelho: aparelho, p_lista: pre }), (r) => r.gravadas === 4);
await recusa("o Caio não publica pré-chave no aparelho da Bia", () => rpc(caio, "rede_diretorio_pre_chaves", { p_aparelho: aparelho, p_lista: pre }), "nao_encontrado");
const passeR = sorteio(32);
const r1 = await espera("reivindicar uma pré-chave com passe", () => rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "proteus", p_passe: passeR }), (r) => r.length === 1 && [1, 2, 3].includes(r[0].id)); // sorteada entre as comuns (revisão final: não a de menor número)
await recusa("o mesmo passe de novo: recusa", () => rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "proteus", p_passe: passeR }), "passe_usado");
for (let i = 0; i < 2; i++) await rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "proteus", p_passe: sorteio(32) });
await espera("acabadas as comuns, vem a última (e ela fica)", async () => [await rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "proteus", p_passe: sorteio(32) }), await rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "proteus", p_passe: sorteio(32) })],
  ([a, b]) => a[0].id === 65535 && b[0].id === 65535);
ok("cada pré-chave comum saiu do banco ao ser entregue", r1 && (await dono("select count(*)::int as n from interno.diretorio_pre_chaves where not ultima")).rows[0].n === 0);
await rpc(bia, "rede_diretorio_pacotes_mls", { p_aparelho: aparelho, p_lista: [{ ref: b64(sorteio(32)), pacote: b64(sorteio(1500)) }] });
await espera("um pacote MLS, entregue uma vez", async () => [await rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "mls", p_passe: sorteio(32) }), await rpc(servidor, "rede_diretorio_reivindicar", { p_usuario: P.bia, p_tipo: "mls", p_passe: sorteio(32) })],
  ([a, b]) => a.length === 1 && b.length === 0);

// O pedido de conversa na caixa de pedidos da Bia (pelo codinome).
const pedido = (gastos = [sorteio(32), sorteio(32)], tamanho = PEDIDO) => ({ acao: "pedido", codinome: "Codinome bia", envelope: b64(sorteio(tamanho)), gastos: gastos.map(b64) });
const g = [sorteio(32), sorteio(32)];
await espera("o pedido de conversa entra na caixa de pedidos", () => lote([pedido(g)]), (r) => r.resultados[0].ok === true);
await espera("o mesmo passe e desafio de novo: recusa", () => lote([pedido(g)]), (r) => r.resultados[0].erro === "passe_usado");
await espera("o mesmo desafio com outro passe: recusa", () => lote([pedido([sorteio(32), g[1]])]), (r) => r.resultados[0].erro === "passe_usado");
await espera("pedido em tamanho de outro uso: recusa", () => lote([pedido(undefined, DUPLA[0] + 4096)]), (r) => r.resultados[0].erro === "tamanho");
await espera("pedido para quem não tem chat novo", () => lote([{ ...pedido(), codinome: "Codinome caio" }]), (r) => r.resultados[0].erro === "sem_pedidos");
await espera("a Bia lê o pedido na caixa dela", () => buscar(contaBia.caixa), (r) => r.pacotes.length === 1 && Buffer.from(r.pacotes[0].envelope, "base64").length === PEDIDO);

// ═══════════════════ 9. Quem tem o banco inteiro não liga caixa a conta ═══════════════════
// A conversa da Ana com a Bia: cada uma tem a caixa de entrada (criadas acima) e as duas depositaram. O atacante tem tudo do banco.
const TABELAS = ["caixas", "pacotes", "caixa_contagem", "passes_gastos", "passes_emitidos"];
const colunas = (await dono(`select c.table_name as t, c.column_name as c, c.data_type as d, c.column_default as pad, c.is_identity as ident
  from information_schema.columns c where c.table_schema = 'interno' and c.table_name = any($1)`, [TABELAS])).rows;
ok("nenhuma coluna de conta (uuid) nas tabelas das caixas e dos passes", !colunas.some((c) => c.d === "uuid"), colunas.filter((c) => c.d === "uuid").map((c) => `${c.t}.${c.c}`).join(","));
ok("nenhuma coluna de hora (só o dia)", !colunas.some((c) => /time/.test(c.d)), colunas.filter((c) => /time/.test(c.d)).map((c) => `${c.t}.${c.c}`).join(","));
ok("nenhuma sequência ou identidade (sem número que diga a ordem global)", !colunas.some((c) => c.ident === "YES" || /nextval/.test(c.pad ?? "")));
const fks = (await dono(`select conrelid::regclass::text as t, confrelid::regclass::text as r from pg_constraint where contype = 'f' and conrelid::regclass::text = any($1)`, [TABELAS.map((t) => `interno.${t}`)])).rows;
ok("as tabelas das caixas só apontam umas para as outras (nunca para perfis)", fks.every((f) => /interno\.caixas$/.test(f.r)), fks.map((f) => `${f.t}->${f.r}`).join(","));
// O identificador (e o resumo) da caixa de conversa da Ana procurado em TODAS as colunas de todas as tabelas do banco.
const todas = (await dono(`select table_schema as s, table_name as t, column_name as c, data_type as d from information_schema.columns
  where table_schema in ('interno', 'public', 'auth') and data_type in ('bytea', 'text', 'jsonb', 'character varying', 'ARRAY')`)).rows;
const achados = new Set();
for (const coluna of todas) {
  for (const agulha of [daAna.id, daAna.idH, daAna.pd, daAna.pl]) {
    const q = coluna.d === "bytea"
      ? `select 1 from "${coluna.s}"."${coluna.t}" where position($1::bytea in "${coluna.c}") > 0 limit 1`
      : `select 1 from "${coluna.s}"."${coluna.t}" where "${coluna.c}"::text like '%' || $2 || '%' or "${coluna.c}"::text like '%' || $3 || '%' limit 1`;
    const r = await dono(q, coluna.d === "bytea" ? [hexDe(agulha)] : [b64(agulha), Buffer.from(agulha).toString("hex")]).catch(() => ({ rows: [] }));
    if (r.rows.length) achados.add(`${coluna.s}.${coluna.t}.${coluna.c}`);
  }
}
ok("a caixa de conversa só aparece nas tabelas das caixas (que não têm conta)", [...achados].every((x) => /^interno\.(caixas|pacotes|caixa_contagem)\./.test(x)), [...achados].join(", "));
ok("o id cru e os passes crus não estão no banco (só os resumos)", (await dono("select count(*)::int as n from interno.caixas where id_h = $1 or pd_h = $1 or pl_h = $1", [hexDe(daAna.id)])).rows[0].n === 0);
const linhaDaCaixa = (await dono("select * from interno.caixas where id_h = $1", [hexDe(daAna.idH)])).rows[0];
ok("a linha da caixa tem só resumos, o tipo, a contagem e o vencimento em semana", Object.keys(linhaDaCaixa ?? {}).sort().join(",") === "id_h,multi,pd_anterior_ate,pd_anterior_h,pd_h,pl_h,proxima,unico_feito,vence"
  && new Date(linhaDaCaixa.vence).getUTCDay() === 1, JSON.stringify({ k: Object.keys(linhaDaCaixa ?? {}), v: linhaDaCaixa?.vence }));
ok("o passe gasto está só como resumo, sem conta", (await dono("select count(*)::int as n from interno.passes_gastos where resumo = $1", [hexDe(passeA)])).rows[0].n === 1);

// ═══════════════════ 10. O registro de transparência ═══════════════════
const linhas = (await rpc(visitante, "rede_kt_trecho", { p_desde: 0 }));
ok("o registro anotou a conta e o aparelho da Bia", linhas.some((l) => l.tipo === "conta" && l.identidade.startsWith("r2:")) && linhas.some((l) => l.tipo === "aparelho" && l.identidade.startsWith(`a2:${b64(aparelho)}`)));
const passesPub = sorteio(49);
await espera("a chave de passes do dia entra no registro", () => rpc(servidor, "rede_passes_chave_registrar", { p_dia: hoje, p_publica: passesPub }), (r) => r.ok);
await espera("a mesma chave de novo: ok, sem linha nova", async () => [await rpc(servidor, "rede_passes_chave_registrar", { p_dia: hoje, p_publica: passesPub }), (await rpc(visitante, "rede_kt_trecho", { p_desde: 0 })).length], ([r, n]) => r.ok && n === linhas.length + 1);
await recusa("outra chave para o mesmo dia: alarme", () => rpc(servidor, "rede_passes_chave_registrar", { p_dia: hoje, p_publica: sorteio(49) }), "chave_do_dia_diferente");
await rpc(bia, "rede_diretorio_tirar_aparelho", { p_aparelho: aparelho });
const corrente = await rpc(visitante, "rede_kt_trecho", { p_desde: 0 });
ok("tirar o aparelho deixa a linha 'aparelho-fora'", corrente.at(-1).tipo === "aparelho-fora");
const sha = (t) => crypto.createHash("sha256").update(t, "utf8").digest("base64");
let anterior = "A".repeat(43) + "=";
let fecha = true;
for (const l of corrente) {
  const esperado = l.tipo === "olm" ? sha(`${anterior}|${l.seq}|${l.quem}|${l.identidade}|${l.versao}|${l.dia}`) : sha(`${anterior}|${l.seq}|${l.tipo}|${l.quem}|${l.identidade}|${l.versao}|${l.dia}`);
  if (esperado !== l.resumo) fecha = false;
  anterior = l.resumo;
}
ok("qualquer um refaz a corrente inteira (o tipo dentro do resumo)", fecha && corrente.length >= 4);
await dono("update interno.rede_kt set tipo = 'conta' where seq = (select min(seq) from interno.rede_kt where tipo = 'aparelho')");
const mexida = await rpc(visitante, "rede_kt_trecho", { p_desde: 0 });
anterior = "A".repeat(43) + "=";
let fechaMexida = true;
for (const l of mexida) {
  if (sha(`${anterior}|${l.seq}|${l.tipo}|${l.quem}|${l.identidade}|${l.versao}|${l.dia}`) !== l.resumo) fechaMexida = false;
  anterior = l.resumo;
}
ok("trocar o tipo de uma linha quebra a corrente (o servidor não reescreve o passado sem o aparelho notar)", !fechaMexida);

// ═══════════════════ 11. Passes do dia, denúncia, limpeza ═══════════════════
const marca = sorteio(32);
await espera("a primeira marca do dia: pode pegar o lote", () => rpc(ana, "rede_passes_marcar_hoje", { p_marca: marca }), (r) => r === true);
await espera("a segunda, no mesmo dia: não pode", () => rpc(ana, "rede_passes_marcar_hoje", { p_marca: marca }), (r) => r === false);
await recusa("visitante não pega passes", () => rpc(visitante, "rede_passes_marcar_hoje", { p_marca: sorteio(32) }), "permission denied");
await dono("update interno.perfis set suspenso = true where id = $1", [P.caio]);
await recusa("conta suspensa não pega passes", () => rpc(caio, "rede_passes_marcar_hoje", { p_marca: sorteio(32) }), "");
await dono("update interno.perfis set suspenso = false where id = $1", [P.caio]);
ok("a marca não guarda a conta", !(await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'passes_emitidos'")).rows.some((c) => /usuario|conta|quem/.test(c.column_name)));

// A função da denúncia é a da frente da denúncia com prova (p_usuario, p), que roda depois desta: a prova guardada é só o texto, o dia
// e a origem de cada trecho.
await espera("a denúncia com prova entra na fila", () => rpc(servidor, "rede_franquia_denunciar", { p_usuario: P.ana, p: { categoria: "assedio", autor: "r2_bia", prova: [{ texto: "texto exato da mensagem", dia: hoje, origem: "conversa" }] } }), (r) => /^[A-Z0-9]{10}$/.test(r.protocolo));
ok("como denúncia de perfil, com o trecho na prova", JSON.stringify((await dono("select prova from interno.rede_denuncias where alvo = $1 order by criado_em desc limit 1", [P.bia])).rows[0]?.prova ?? null).includes("texto exato da mensagem"));
await recusa("não denuncia a si mesma", () => rpc(servidor, "rede_franquia_denunciar", { p_usuario: P.ana, p: { categoria: "spam", autor: "r2_ana", prova: [{ texto: "x", dia: hoje, origem: "conversa" }] } }), "sem_permissao");

await dono("update interno.pacotes set dia = interno.caixa_hoje() - 31 where caixa_h = $1", [hexDe(daBia.idH)]);
await dono("insert into interno.passes_gastos (resumo, dia) values ($1, interno.caixa_hoje() - 3)", [hexDe(sorteio(32))]);
await dono("update interno.caixas set vence = interno.caixa_hoje() - 1 where id_h = $1", [hexDe(grupo.idH)]);
await dono("update interno.caixas set vence = interno.caixa_hoje() - 1 where id_h = $1", [hexDe(contaBia.caixa.idH)]);
await espera("o pacote de mais de 30 dias não é entregue nem antes da limpeza", () => buscar(daBia), (r) => r.pacotes.length === 0);
const limpeza = await espera("a limpeza diária", () => dono("select interno.rede_caixas_limpeza() as r"), (r) => r.rows[0].r.pacotes > 0 && r.rows[0].r.caixas === 1 && r.rows[0].r.passes === 1);
ok("tira os pacotes velhos e a caixa vencida, e deixa a caixa de pedidos de quem está no diretório", limpeza && (await contar(daBia)) === 0 && (await contar(grupo)) === 0
  && (await dono("select count(*)::int as n from interno.caixas where id_h = $1", [hexDe(contaBia.caixa.idH)])).rows[0].n === 1);
await espera("apagar a caixa com o passe de leitura", async () => { await rpc(servidor, "rede_caixa_apagar", { p_id_h: daAna.idH, p_pl: daAna.pl }); return contar(daAna); }, (n) => n === 0);
ok("e a caixa sai", (await dono("select count(*)::int as n from interno.caixas where id_h = $1", [hexDe(daAna.idH)])).rows[0].n === 0);
await rpc(bia, "rede_diretorio_apagar");
ok("apagar o diretório leva a caixa de pedidos junto", (await dono("select count(*)::int as n from interno.caixas where id_h = $1", [hexDe(contaBia.caixa.idH)])).rows[0].n === 0
  && (await dono("select count(*)::int as n from interno.diretorio_contas where usuario = $1", [P.bia])).rows[0].n === 0);

console.log(`${certos} certos, ${falhas.length} falhas${semMigracao ? " (sem a migração)" : ""}`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
