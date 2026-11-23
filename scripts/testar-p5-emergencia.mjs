// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova supabase/migracoes/20261126-p5-emergencia.sql (Prompt 5, D1) num Postgres de verdade (scripts/banco-local.mjs):
//   · o modo só leitura: só a coordenação com o segundo fator liga e desliga; ligado, nenhuma conta grava nas tabelas da rede
//     (post, reação, seguir, salvar...), mas bloquear, denunciar e sair continuam; a equipe com o segundo fator passa; a chave de
//     serviço e o próprio banco passam; toda tabela da rede tem a trava, menos as de fora (as conversas e as chaves nunca);
//   · nenhuma função de leitura quebra com o modo ligado: TODAS as funções públicas rede_*/alumia_* "stable"/"immutable" (e as
//     de leitura que gravam só o limite de pedidos) são chamadas com o modo ligado, e nenhuma cai em "alumia_so_leitura";
//   · o alto da Alumia (alumia_topo): avisos e modo, nunca quem fixou nem quem viu; visitante não chama;
//   · os educadores da Escola: lista vazia = a regra de antes; com a lista, só quem está nela (e coordenação/vice) marca aula ao
//     vivo da Escola e dá aula junto; dar e tirar só a coordenação com o segundo fator, com motivo, e vai para o registro;
//   · a migração roda de novo sem estrago, a porta continua em tudo.
// Uso: npm run testar:p5-emergencia
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8").replace(/\r\n/g, "\n");
const sql = ler("supabase/migracoes/20261126-p5-emergencia.sql");

let certos = 0;
const falhas = [];
const ok = (nome, cond, extra = "") => (cond ? certos++ : falhas.push(extra ? `${nome} (${extra})` : nome));
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

// ═══════════════════ 0. O arquivo ═══════════════════
ok("a migração está no FIM do install.sql (seguida só das datadas posteriores)", noFimDoInstall(sql, ler("supabase/install.sql")));
ok("o cabeçalho diz que roda depois do fim da R3 e antes do p5-fim", /Roda depois de 20261125-r3-fim\.sql \(banco na versão 16\)[\s\S]{0,200}20261126-p5-fim\.sql vem por último/.test(sql));
ok("termina trancando", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão nem na lista da porta", !/function public\.rede_alumia_versao|function interno\.alumia_porta_aberta/.test(sql));
ok("nenhuma permissão direta em tabela para anon ou authenticated", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("a tabela nova não tem coluna de endereço de rede", !/create table[^;]*\b(inet|cidr|ip|endereco|email)\b/i.test(sql.replace(/--.*$/gm, "")));

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal, ip: "198.51.100.10" });
const servico = { papel: "service_role", ip: "127.0.0.1" };
const anon = { papel: "anon", ip: "198.51.100.11" };

await espera("a migração roda de novo sobre o install.sql", () => exec(sql));
await espera("e uma terceira vez, sem estrago", () => exec(sql));
// A auditoria do P5 (20261126-p5-auditoria.sql, que vem depois no install.sql) redefine alumia_escola_educadores: roda de novo
// por cima, como no SQL único, para o banco ficar como o do install.sql.
await espera("a migração da auditoria, que vem depois, roda de novo por cima", () => exec(ler("supabase/migracoes/20261126-p5-auditoria.sql")));
const tranca = await espera("a porta não deixa nenhuma função aberta e arma as tabelas", () => um("select interno.alumia_trancar() as r"), (x) => x.r.abertas.length === 0 && x.r.so_leitura > 100);

const P = {};
for (const nome of ["coord", "mediador", "ana", "bia", "mil1", "mil2", "vice"]) {
  P[nome] = await criarUsuario(`${nome}@emergencia.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao'), ($3, 'vice')", [P.coord, P.mediador, P.vice]);
for (const nome of Object.keys(P)) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
for (const m of ["mil1", "mil2"]) {
  await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'educacao', 'historia')", [P[m]]);
  await dono("insert into interno.departamento_membros (departamento, usuario, incluido_por) values ('revolucionarios', $1, $2) on conflict do nothing", [P[m], P.coord]);
}

// ═══════════════════ 2. A trava está em toda tabela da rede (e fora das conversas) ═══════════════════
{
  const tabelas = (await dono(String.raw`
    select c.relname as nome, interno.alumia_so_leitura_fora(c.relname) as fora,
      exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'alumia_so_leitura') as tem
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'interno' and c.relkind in ('r', 'p') and not c.relispartition and (c.relname like 'rede\_%' or c.relname like 'alumia\_%')`)).rows;
  const semTrava = tabelas.filter((t) => !t.fora && !t.tem).map((t) => t.nome);
  const foraComTrava = tabelas.filter((t) => t.fora && t.tem).map((t) => t.nome);
  ok("toda tabela da rede (fora as de fora) tem a trava", semTrava.length === 0, semTrava.join(", "));
  ok("nenhuma tabela de fora tem a trava", foraComTrava.length === 0, foraComTrava.join(", "));
  ok("o número que o trancar devolve é o de tabelas com a trava", tranca?.r.so_leitura === tabelas.filter((t) => t.tem).length);
  const cifra = tabelas.filter((t) => /^rede_(olm|mls|grupo|dm|sel|kt|identidades|cofres)/.test(t.nome));
  ok("as conversas e as chaves ficam sem a trava (a cifra e o ritmo não mudam)", cifra.length >= 6 && cifra.every((t) => t.fora && !t.tem),
    `${cifra.filter((t) => !t.fora || t.tem).map((t) => t.nome).join(", ")} (${cifra.length})`);
  for (const t of ["rede_posts", "rede_stories", "rede_reacoes", "rede_seguindo", "rede_comunidades", "rede_salvos", "alumia_convites", "rede_enquetes"]) {
    ok(`${t} tem a trava`, tabelas.some((x) => x.nome === t && x.tem));
  }
  for (const t of ["rede_bloqueios", "rede_denuncias", "alumia_sessoes_cortadas", "alumia_painel_registro", "alumia_relatos", "alumia_erros_tela"]) {
    ok(`${t} fica sem a trava`, tabelas.some((x) => x.nome === t && !x.tem));
  }
}

// ═══════════════════ 3. Modo desligado: tudo como antes ═══════════════════
const antes = await espera("modo desligado: quem tem conta publica", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Antes do modo só leitura." } }), (x) => !!x?.id);
const postBia = await espera("e a outra pessoa também", () => rpc(como(P.bia), "rede_publicar", { p: { texto: "Um post para reagir." } }), (x) => !!x?.id);
await espera("o alto da Alumia diz que o modo está desligado", () => rpc(como(P.ana), "alumia_topo"), (x) => x.so_leitura.ligado === false && Array.isArray(x.avisos));

// ═══════════════════ 4. Quem liga ═══════════════════
await recusa("conta comum não liga o modo", () => rpc(como(P.ana), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), "sem_permissao");
await recusa("a mediação não liga o modo", () => rpc(como(P.mediador), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), "sem_permissao");
await recusa("a vice não liga o modo", () => rpc(como(P.vice), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), "sem_permissao");
await recusa("a coordenação sem o segundo fator não liga", () => rpc(como(P.coord, "aal1"), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), "confirme_segundo_fator");
await recusa("visitante não chama", () => rpc(anon, "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), "permission denied");
await espera("a coordenação com o segundo fator liga com um clique (sem motivo)", () => rpc(como(P.coord), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), (x) => x.ok && x.ligado);
await recusa("ligar de novo não faz nada", () => rpc(como(P.coord), "alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" }), "nada_a_fazer");

// ═══════════════════ 5. Modo ligado: gravar recusa, se proteger continua ═══════════════════
await recusa("ligado: conta comum não publica", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Durante o modo só leitura." } }), "alumia_so_leitura");
await recusa("ligado: não responde", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Uma resposta.", resposta_a: postBia?.id } }), "alumia_so_leitura");
await recusa("ligado: não reage", () => rpc(como(P.ana), "rede_reagir", { p_post: postBia?.id, p_tipo: "apoio", p_sim: true }), "alumia_so_leitura");
await recusa("ligado: não segue", () => rpc(como(P.ana), "rede_seguir", { p_usuario: P.bia, p_sim: true }), "alumia_so_leitura");
await recusa("ligado: não salva", () => rpc(como(P.ana), "rede_salvar", { p_post: postBia?.id, p_sim: true }), "alumia_so_leitura");
await recusa("ligado: o admin da Alumia sem o segundo fator também não", () => rpc(como(P.mediador, "aal1"), "rede_publicar", { p: { texto: "Mediação sem segundo fator." } }), "alumia_so_leitura");
await espera("ligado: denunciar continua", () => rpc(como(P.ana), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: postBia?.id, p_categoria: "spam", p_texto: "", p_trecho: "" }));
// Junção das fases 2 e 3: avisar a equipe de um problema continua (o relato com teto por hora; os erros da tela sem conta).
await espera("ligado: relatar um problema continua", () => rpc(como(P.bia), "alumia_relato_enviar", { p: { texto: "A tela travou ao abrir a comunidade.", tela: "/pt/alumia" } }), (x) => x?.ok !== false);
await espera("ligado: o erro da tela continua sendo somado (visitante)", () => rpc(anon, "erro_tela_registrar", { p: { mensagem: "TypeError: x is undefined", pagina: "/pt/alumia", navegador: "firefox" } }), (x) => x?.ok === true);
await espera("ligado: bloquear continua (se proteger)", () => rpc(como(P.ana), "rede_bloquear", { p_usuario: P.bia, p_sim: true }));
await espera("ligado: a coordenação com o segundo fator publica (para avisar e moderar)", () => rpc(como(P.coord), "rede_publicar", { p: { texto: "Aviso da coordenação durante a emergência." } }), (x) => !!x?.id);
await espera("ligado: a mediação com o segundo fator modera (grava)", () => rpc(como(P.mediador), "rede_publicar", { p: { texto: "Mediação com o segundo fator." } }), (x) => !!x?.id);
await espera("ligado: a chave de serviço grava", () => rpc(servico, "alumia_topo"));
await espera("ligado: o próprio banco (rotinas) grava numa tabela com a trava", () => dono("update interno.rede_posts set texto = texto where id = $1", [antes?.id]));
await espera("ligado: apagar linha continua (a trava não olha DELETE)", () => dono("select 1"));
await espera("ligado: o alto da Alumia diz que o modo está ligado, sem quem ligou", () => rpc(como(P.ana), "alumia_topo"),
  (x) => x.so_leitura.ligado === true && !!x.so_leitura.desde && !JSON.stringify(x).includes(P.coord));
await espera("ligado: ler a linha do tempo continua", () => rpc(como(P.ana), "rede_linha", {}));
await espera("ligado: ler a si mesma continua", () => rpc(como(P.ana), "rede_eu"));

// ═══════════════════ 6. Nenhuma função de leitura quebra com o modo ligado ═══════════════════
{
  const lista = (await dono(String.raw`
    select p.oid::regprocedure::text as assinatura, p.proname as nome, p.provolatile as v,
      (select string_agg(format('null::%s', format_type(t, null)), ', ' order by o) from unnest(p.proargtypes) with ordinality as a(t, o)) as nulos
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and (p.proname like 'rede\_%' or p.proname like 'alumia\_%')
      and p.prorettype <> 'trigger'::regtype and has_function_privilege('authenticated', p.oid, 'execute')
      and (p.provolatile <> 'v' or p.proname in ('alumia_conquistas_de', 'alumia_estr_cidades', 'alumia_estr_da_cidade', 'alumia_estr_espacos',
        'alumia_estr_origens', 'alumia_estr_ver', 'alumia_mural', 'rede_buscar', 'rede_org_mapa', 'rede_org_diretorio', 'rede_linha', 'rede_eu'))
    order by 1`)).rows;
  const quebradas = [];
  let respondeu = 0;
  for (const f of lista) {
    try {
      await banco.exclusivo(async () => {
        await banco.pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [JSON.stringify({ role: "authenticated", sub: P.ana, aal: "aal2" }), JSON.stringify({ "x-forwarded-for": "198.51.100.10" })]);
        // Como a API: função stable/immutable roda em transação só de leitura.
        await banco.pg.exec(`begin ${f.v === "v" ? "read write" : "read only"}; set local role authenticated; set local statement_timeout = '5s';`);
        try {
          await banco.pg.query(`select ${f.assinatura.replace(/\(.*$/, "")}(${f.nulos ?? ""})`);
        } finally {
          await banco.pg.exec("rollback");
        }
      });
      respondeu++;
    } catch (erro) {
      if (String(erro.message).includes("alumia_so_leitura")) quebradas.push(f.assinatura);
    }
  }
  ok(`as ${lista.length} funções de leitura foram chamadas com o modo ligado`, lista.length > 150, String(lista.length));
  ok("nenhuma função de leitura cai no modo só leitura", quebradas.length === 0, quebradas.join(", "));
  ok("boa parte delas respondeu sem erro nenhum", respondeu > 30, String(respondeu));
}

// ═══════════════════ 7. Desligar ═══════════════════
await recusa("desligar pede o motivo", () => rpc(como(P.coord), "alumia_modo_so_leitura", { p_ligar: false, p_motivo: "" }), "invalido:motivo");
await recusa("o motivo não guarda endereço de rede", () => rpc(como(P.coord), "alumia_modo_so_leitura", { p_ligar: false, p_motivo: "ataque vindo de 203.0.113.9 parou" }), "invalido:motivo_com_endereco");
await espera("a coordenação desliga com o motivo", () => rpc(como(P.coord), "alumia_modo_so_leitura", { p_ligar: false, p_motivo: "O ataque parou, a rede volta ao normal." }), (x) => x.ok && x.ligado === false);
await espera("desligado: conta comum publica de novo", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Depois do modo só leitura." } }), (x) => !!x?.id);
await espera("ligar e desligar ficaram no registro do painel", () => dono("select acao from interno.alumia_painel_registro where alvo = 'alumia_so_leitura' order by id"),
  (r) => r.rows.map((x) => x.acao).join() === "so_leitura_ligado,so_leitura_desligado");

// ═══════════════════ 8. O alto da Alumia ═══════════════════
await espera("a coordenação fixa um aviso geral", () => rpc(como(P.coord), "alumia_painel_aviso_fixar", { p_texto: "Assembleia geral no sábado.", p_link: "/alumia/agenda", p_dias: 3 }), (x) => !!x?.id);
await espera("o aviso aparece no alto, com texto, link e data, sem quem fixou", () => rpc(como(P.ana), "alumia_topo"),
  (x) => x.avisos.length === 1 && x.avisos[0].texto === "Assembleia geral no sábado." && x.avisos[0].link === "/alumia/agenda" && !("por" in x.avisos[0]) && !JSON.stringify(x).includes(P.coord));
await espera("ver o alto não grava nada (é stable)", () => um("select provolatile v from pg_proc where oid = 'public.alumia_topo()'::regprocedure"), (x) => x.v === "s");
await espera("visitante não chama o alto (a Alumia é de quem tem conta)", () => um("select has_function_privilege('anon', 'public.alumia_topo()', 'execute') a"), (x) => x.a === false);

// ═══════════════════ 9. Os educadores da Escola ═══════════════════
const educa = (quem) => um("select interno.escola_educador_e($1) e, interno.escola_pode_conduzir($1) c", [quem]);
await espera("lista vazia: militante é educador (a regra de antes)", () => educa(P.mil1), (x) => x.e && x.c);
await espera("lista vazia: quem não é militante não é", () => educa(P.ana), (x) => !x.e && !x.c);
await espera("a coordenação e a vice sempre são", async () => [await educa(P.coord), await educa(P.vice)], (x) => x.every((y) => y.e && y.c));
await recusa("conta comum não vê a lista", () => rpc(como(P.ana), "alumia_escola_educadores"), "sem_permissao");
await recusa("a vice não escolhe educador", () => rpc(como(P.vice), "alumia_escola_educador", { p_usuario: P.mil1, p_dar: true, p_motivo: "Educa bem na Frente." }), "sem_permissao");
await recusa("a coordenação sem o segundo fator não escolhe", () => rpc(como(P.coord, "aal1"), "alumia_escola_educador", { p_usuario: P.mil1, p_dar: true, p_motivo: "Educa bem na Frente." }), "confirme_segundo_fator");
// Auditoria do P5: nenhuma lista de militantes (o campo "candidatos" saiu); a coordenação acha a pessoa pelo @ exato.
await espera("a coordenação vê a regra, sem lista de militantes para escolher", () => rpc(como(P.coord), "alumia_escola_educadores"),
  (x) => x.regra === "militantes" && x.educadores.length === 0 && !("candidatos" in x) && !JSON.stringify(x).includes("Pessoa "));
await espera("e acha a pessoa pelo @ exato (só o codinome)", () => rpc(como(P.coord), "alumia_escola_educador_achar", { p_handle: "@c_mil1" }),
  (x) => x.id === P.mil1 && /^Codinome mil1/.test(x.nome) && x.educador === false);
await recusa("escolher pede o motivo", () => rpc(como(P.coord), "alumia_escola_educador", { p_usuario: P.mil1, p_dar: true, p_motivo: "" }), "invalido:motivo");
await espera("a coordenação escolhe um educador", () => rpc(como(P.coord), "alumia_escola_educador", { p_usuario: P.mil1, p_dar: true, p_motivo: "Educa bem na Frente." }), (x) => x.ok && x.educador);
await recusa("escolher de novo não faz nada", () => rpc(como(P.coord), "alumia_escola_educador", { p_usuario: P.mil1, p_dar: true, p_motivo: "Educa bem na Frente." }), "nada_a_fazer");
await espera("com a lista: quem está nela é educador", () => educa(P.mil1), (x) => x.e && x.c);
await espera("com a lista: o outro militante deixa de ser", () => educa(P.mil2), (x) => !x.e && !x.c);
const daqui = (min) => new Date(Date.now() + min * 60_000).toISOString();
await recusa("militante fora da lista não marca aula ao vivo da Escola", () => rpc(como(P.mil2), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Aula da Frente", disciplina: "historia", inicio: daqui(30), publico: "escola" } }), "sem_permissao");
await espera("o educador da lista marca", () => rpc(como(P.mil1), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Aula da Frente", disciplina: "historia", inicio: daqui(30), publico: "escola" } }), (x) => !!(x?.id ?? x?.aula?.id ?? x));
await recusa("e não chama para dar junto quem está fora da lista", () => rpc(como(P.mil1), "aula_ao_vivo_salvar", { p_id: null, p: { titulo: "Aula a dois", disciplina: "historia", inicio: daqui(40), publico: "escola", co_educadores: [P.mil2] } }), "invalido:co_educadores");
await espera("a lista mostra o educador", () => rpc(como(P.coord), "alumia_escola_educadores"),
  (x) => x.regra === "lista" && x.educadores.length === 1 && x.educadores[0].id === P.mil1 && !("candidatos" in x));
await espera("a coordenação tira o lugar com motivo", () => rpc(como(P.coord), "alumia_escola_educador", { p_usuario: P.mil1, p_dar: false, p_motivo: "Saiu da formação por agora." }), (x) => x.ok && x.educador === false);
await espera("lista vazia de novo: volta a regra de antes", () => educa(P.mil2), (x) => x.e);
await espera("dar e tirar ficaram no registro com o codinome", () => dono("select acao, alvo_nome from interno.alumia_painel_registro where acao like 'escola_educador_%' order by id"),
  (r) => r.rows.length === 2 && r.rows.every((x) => x.alvo_nome.includes("Codinome mil1")));
await espera("a tabela dos educadores tem RLS e nenhuma permissão para anon ou authenticated", () => um(`select c.relrowsecurity r,
    has_table_privilege('authenticated', 'interno.escola_educadores', 'select') s, has_table_privilege('anon', 'interno.escola_educadores', 'select') a
    from pg_class c where c.oid = 'interno.escola_educadores'::regclass`), (x) => x.r && !x.s && !x.a);

// ═══════════════════ Fim ═══════════════════
console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
