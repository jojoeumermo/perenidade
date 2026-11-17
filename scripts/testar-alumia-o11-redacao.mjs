// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a frente 11D (redação entre pares, a roda de correção): supabase/migracoes/20261117-alumia-o11-redacao.sql num Postgres de
// verdade (scripts/banco-local.mjs), rodada DUAS vezes sobre o install.sql, com o lacre do servidor (lib/rede/redacao/servidor.ts):
//   roda      o tema da coordenação, entregar, pedir uma redação, corrigir pelas 5 competências (0 a 200, de 40 em 40), largar;
//   cegueira  quem corrige não recebe nada da autora; a autora não recebe nada de quem corrigiu; antes da devolução ela nem sabe
//             quantas leituras chegaram; depois da devolução o teste faz o papel de quem lê o banco inteiro e TENTA casar quem corrigiu
//             com a redação: pelas colunas, pelo xmin, pelo crédito da troca, pela ordem no disco (ctid) contra o xmin do crédito,
//             pelo freio, pelo lacre sem o segredo. E não consegue; a leitura que repõe outra só aparece depois da rodada;
//   troca     quem não corrigiu não recebe; corrigiu, recebe;
//   denúncia  a mediação julga sem saber de quem é; abusiva tira a leitura, devolve a redação à roda e afasta quem escreveu, sem
//             que a tela da mediação receba o nome;
//   apagar    30 dias depois da devolução (e 21 depois do começo da semana, sem devolução) tudo some de vez, pelo agendador.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-redacao.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const fonte = (c) => (existe(c) ? ler(c) : "");
const arquivosDe = (pasta) => (existe(pasta) ? fs.readdirSync(path.join(raiz, pasta), { recursive: true }).map((f) => `${pasta}/${String(f).replace(/\\/g, "/")}`).filter((f) => /\.(tsx?|css|json)$/.test(f)) : []);

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

// ═══════════════════ 0. Os arquivos ═══════════════════
const sql = ler("supabase/migracoes/20261117-alumia-o11-redacao.sql");
ok("toda função security definer da migração tem search_path fixo", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 20 && funcoes.filter((f) => /security definer/.test(f)).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
ok("a migração termina chamando as portas", sql.trimEnd().endsWith("select interno.alumia_trancar();"));
ok("a migração não lê nem guarda endereço de rede", !/x-forwarded-for|cf-connecting-ip|\binet\b|ip_address|interno\.origem\(\)/i.test(sql));
ok("o agendador da roda está marcado no pg_cron", /cron\.schedule\('alumia-redacao-rodada', '\*\/10 \* \* \* \*', 'select interno\.alumia_redacao_rodada\(\)'\)/.test(sql));
ok("a correção não tem corretor, hora nem valor padrão no id", (() => {
  const m = /create table if not exists interno\.alumia_redacao_correcoes \(([\s\S]*?)\n\);/.exec(sql);
  return m && !/corretor|usuario|autora|timestamptz|serial|identity|sequence/i.test(m[1]) && /\bid uuid primary key,/.test(m[1]);
})());
ok("o crédito da troca não aponta para a redação", (() => {
  const m = /create table if not exists interno\.alumia_redacao_creditos \(([\s\S]*?)\n\);/.exec(sql);
  return m && !/redacao|correcao|timestamptz/i.test(m[1]);
})());
const rotaCorrigir = fonte("app/api/alumia/redacao/corrigir/route.ts");
const rotaAfastar = fonte("app/api/alumia/redacao/afastar/route.ts");
const servidorTs = fonte("lib/rede/redacao/servidor.ts");
ok("a correção passa pelo servidor, que sorteia o id e calcula o lacre", /idDaCorrecao\(\)/.test(rotaCorrigir) && /lacreDaCorrecao\(/.test(rotaCorrigir) && /alumia_redacao_corrigir/.test(rotaCorrigir) && /contaDoToken/.test(rotaCorrigir));
ok("o afastamento confere o lacre no servidor e não devolve a pessoa à tela", /donaDoLacre\(/.test(rotaAfastar) && /alumia_redacao_afastar_dados/.test(rotaAfastar) && !/resposta\(\{[^}]*dona[^}]*\}/.test(rotaAfastar));
ok("o lacre é HMAC do node:crypto com rótulo próprio, comparado em tempo constante", /createHmac\("sha256"/.test(servidorTs) && /alumia:redacao:lacre/.test(servidorTs) && /timingSafeEqual/.test(servidorTs));
ok("nenhuma cifra feita à mão na frente", [servidorTs, rotaCorrigir, rotaAfastar, ...arquivosDe("components/rede/estudo/redacao").map(fonte)].every((t) => !/createCipheriv|createDecipheriv|subtle\.(encrypt|decrypt|deriveBits|deriveKey)|createECDH|hkdfSync/.test(t)));
const telas = arquivosDe("components/rede/estudo/redacao");
ok("as telas existem", telas.some((f) => f.endsWith("TelaDaRedacao.tsx")) && telas.some((f) => f.endsWith("cliente.ts")));
ok("nenhum arquivo do navegador lê a chave de serviço ou o segredo", telas.every((c) => !/SERVICE_ROLE|ALUMIA_VOTO_SEGREDO|node:crypto/.test(fonte(c))));
ok("nenhum script, fonte ou imagem de fora nas telas", telas.every((c) => !/https?:\/\/(?!localhost)/.test(fonte(c).replace(/\/\/ .*$/gm, ""))));
ok("os textos existem nos 6 idiomas", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => existe(`i18n/rede/redacao/${l}.json`)));
{
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort().join();
  const pt = JSON.parse(fonte("i18n/rede/redacao/pt.json") || "{}");
  ok("os 6 idiomas têm as mesmas chaves", ["en", "es", "fr", "ru", "zh"].every((l) => chaves(JSON.parse(fonte(`i18n/rede/redacao/${l}.json`) || "{}")) === chaves(pt)));
  ok("sem palavra vetada nos textos novos", ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|algoritmo|university|universidad|universit|algorithm|algoritmo|диплом|университет|алгоритм|文凭|大学|算法/i.test(fonte(`i18n/rede/redacao/${l}.json`))));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (t, v = []) => (await dono(t, v)).rows[0];
const linhas = async (t, v = []) => (await dono(t, v)).rows;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2" });
const chamar = (sub, funcao, argumentos = {}) => rpc(como(sub), funcao, argumentos);
const servico = (funcao, argumentos = {}) => rpc({ papel: "service_role" }, funcao, argumentos);

const nomes = ["coord", "mediador", "a", "b", "c", "d", "e", "f", "g", "h", "fora"];
const P = {};
const CODINOME = {};
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@o11.local`, `Nome Civil ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
  CODINOME[nome] = `Codinome ${String(i + 1).padStart(2, "0")}`;
  if (nome !== "fora") {
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], CODINOME[nome], `${nome}_o11`]);
  }
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "fora")) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.mediador]);

// ═══════════════════ 2. A migração ═══════════════════
await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("e de novo, sem estrago (idempotente)", () => exec(sql));
await espera("as portas: nenhuma função public.rede_*/alumia_* ficou aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r?.abertas) && r.abertas.length === 0);
const DO_SERVIDOR = ["alumia_redacao_corrigir", "alumia_redacao_afastar_dados", "alumia_redacao_afastar"];
const DE_MEMBRO = ["alumia_redacao_roda", "alumia_redacao_entregar", "alumia_redacao_apagar", "alumia_redacao_pegar", "alumia_redacao_largar", "alumia_redacao_denunciar",
  "alumia_redacao_temas", "alumia_redacao_tema_definir", "alumia_redacao_mediacao", "alumia_redacao_mediar"];
await espera("as funções do servidor só aceitam a chave de serviço", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname = any ($1) and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute'))`, [DO_SERVIDOR]), (l) => l.length === 0);
await espera("as funções de membro passam pela porta", () => linhas(`select p.proname, pg_get_functiondef(p.oid) s from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any ($1)`, [DE_MEMBRO]),
  (l) => l.length === DE_MEMBRO.length && l.every((x) => x.s.includes("alumia_porta")));
await espera("visitante sem conta não chama nada da roda", () => linhas(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'alumia\\_redacao\\_%' and has_function_privilege('anon', p.oid, 'execute')`), (l) => l.length === 0);
await espera("as tabelas têm RLS e nenhuma política", () => linhas(`select c.relname, c.relrowsecurity, (select count(*) from pg_policy p where p.polrelid = c.oid)::int pol from pg_class c
    where c.relnamespace = 'interno'::regnamespace and c.relname like 'alumia\\_redac%' and c.relkind = 'r'`), (l) => l.length === 7 && l.every((x) => x.relrowsecurity && x.pol === 0));
await espera("a correção não tem coluna de pessoa nem de hora", () => linhas(`select a.attname, format_type(a.atttypid, a.atttypmod) t from pg_attribute a where a.attrelid = 'interno.alumia_redacao_correcoes'::regclass and a.attnum > 0 and not a.attisdropped`),
  (l) => l.map((x) => x.attname).sort().join() === "ficha,id,lacre,liberada,redacao,removida" && !l.some((x) => /timestamp/.test(x.t)));

const SEGREDO = "segredo-do-voto-para-o-teste-0123456789";
const { lacreDaCorrecao, donaDoLacre, idDaCorrecao, segredoDoLacre } = await import("../lib/rede/redacao/servidor.ts");
ok("sem segredo (ou curto), sem lacre", segredoDoLacre("") === null && segredoDoLacre("curto") === null && segredoDoLacre(SEGREDO) === SEGREDO);
const rodada = () => um("select interno.alumia_redacao_rodada() as r").then((x) => x.r);
const roda = (quem) => chamar(P[quem], "alumia_redacao_roda");
const texto = (quem) => `Redação de teste escrita para a roda. ${"A desigualdade no acesso à educação no Brasil precisa de políticas públicas permanentes. ".repeat(6)} Assinatura nenhuma, ${quem}.`;
const ficha = (nota = 160, extra = "") => ({
  competencias: [1, 2, 3, 4, 5].map((n) => ({ nota, comentario: `Comentário da competência ${n}: bom caminho, revise o trecho. ${extra}` })),
  geral: "Um texto bem encaminhado; capriche na proposta de intervenção.",
});
/** O que o servidor do site faz: sorteia o id, calcula o lacre e chama o banco com a chave de serviço. */
const ordemDasCorrecoes = [];
const corrigir = (quem, leitura, f = ficha()) => {
  const id = idDaCorrecao();
  ordemDasCorrecoes.push(id);
  return servico("alumia_redacao_corrigir", { p_usuario: P[quem], p_leitura: leitura, p_correcao: id, p_ficha: f, p_lacre: lacreDaCorrecao(SEGREDO, id, P[quem]) });
};
const naoTemNinguem = (coisa, menos = []) => {
  const t = JSON.stringify(coisa);
  return nomes.filter((n) => !menos.includes(n)).every((n) => !t.includes(P[n]) && !t.includes(CODINOME[n]) && !t.includes(`${n}_o11`));
};

try {
// ═══════════════════ 3. O tema da semana ═══════════════════
const SEMANA = (await um("select interno.semana_atual()::text s")).s;
await recusa("quem não é da coordenação não lança tema", () => chamar(P.a, "alumia_redacao_tema_definir", { p_semana: SEMANA, p_titulo: "Os desafios da mobilidade urbana no Brasil", p_motivadores: "" }), "sem_permissao");
await recusa("quem não é da coordenação não vê a agenda dos temas", () => chamar(P.a, "alumia_redacao_temas"), "sem_permissao");
await espera("sem tema, a roda diz que não há tema", () => roda("a"), (r) => r.tema === null && r.entreguei === false && r.pode_tema === false && r.pode_mediar === false && r.denuncias_abertas === null);
await recusa("sem tema, não se entrega", () => chamar(P.a, "alumia_redacao_entregar", { p_titulo: "", p_texto: texto("a") }), "sem_tema");
await recusa("semana que não começa na segunda não vale", async () => chamar(P.coord, "alumia_redacao_tema_definir", { p_semana: (await um("select (interno.semana_atual() + 2)::text s")).s, p_titulo: "Os desafios da mobilidade urbana no Brasil", p_motivadores: "" }), "invalido:semana");
await espera("a coordenação lança o tema da semana", () => chamar(P.coord, "alumia_redacao_tema_definir", { p_semana: SEMANA, p_titulo: "Caminhos para enfrentar a evasão escolar no Brasil", p_motivadores: "Texto I: dados do censo escolar.\nTexto II: relato de estudante." }), (r) => r.semana === SEMANA);
await espera("e deixa a próxima pronta", async () => chamar(P.coord, "alumia_redacao_tema_definir", { p_semana: (await um("select (interno.semana_atual() + 7)::text s")).s, p_titulo: "O direito à moradia nas grandes cidades", p_motivadores: "" }), (r) => !!r.semana);
await espera("a agenda dos temas para a coordenação", () => chamar(P.coord, "alumia_redacao_temas"), (l) => l.length === 10 && l.filter((t) => t.titulo).length === 2 && l.find((t) => t.semana === SEMANA).editavel === true);
await espera("o tema aparece na roda", () => roda("a"), (r) => r.tema?.titulo === "Caminhos para enfrentar a evasão escolar no Brasil" && r.semana === SEMANA);
await recusa("quem não é membro da Alumia não abre a roda", () => chamar(P.fora, "alumia_redacao_roda"), "confirme_idade");

// ═══════════════════ 4. Entregar ═══════════════════
await recusa("redação curta demais", () => chamar(P.a, "alumia_redacao_entregar", { p_titulo: "", p_texto: "curta" }), "invalido:curta");
await recusa("redação longa demais", () => chamar(P.a, "alumia_redacao_entregar", { p_titulo: "", p_texto: "x".repeat(3601) }), "invalido:longa");
const RED = {};
for (const n of ["a", "b", "c", "d"]) {
  RED[n] = (await espera(`${n} entrega a redação`, () => chamar(P[n], "alumia_redacao_entregar", { p_titulo: `Título ${n}`, p_texto: texto(n) }), (r) => r.situacao === "na_roda" && r.falta_corrigir === 2 && r.correcoes === null))?.id;
}
await recusa("uma por semana", () => chamar(P.a, "alumia_redacao_entregar", { p_titulo: "", p_texto: texto("a") }), "ja_entregou");
await recusa("o tema não muda depois que chegou redação", () => chamar(P.coord, "alumia_redacao_tema_definir", { p_semana: SEMANA, p_titulo: "Outro tema qualquer para a semana", p_motivadores: "" }), "ja_tem_redacao");
await espera("a roda conta as que esperam leitura (a partir de 3; a da própria pessoa fora)", () => roda("e"), (r) => r.esperando === 4);
await espera("com menos de 3, sem número", () => roda("a"), (r) => r.esperando === 3);

// ═══════════════════ 5. Pedir uma redação e corrigir: a cegueira de quem corrige ═══════════════════
const leituraB1 = await espera("b pede uma redação: recebe o texto, o tema e o prazo, sem a autora", () => chamar(P.b, "alumia_redacao_pegar"),
  (l) => !!l.id && !!l.texto && l.tema && !!l.prazo && Object.keys(l).sort().join() === "id,motivadores,prazo,semana,tema,texto,titulo" && naoTemNinguem(l));
ok("o id da leitura não é o id da redação", leituraB1 && !Object.values(RED).includes(leituraB1.id));
ok("b nunca recebe a própria redação", leituraB1 && (await um("select r.autora from interno.alumia_redacao_leituras l join interno.alumia_redacoes r on r.id = l.redacao where l.id = $1", [leituraB1.id])).autora !== P.b);
await recusa("ficha com nota fora do passo de 40", () => corrigir("b", leituraB1.id, { ...ficha(), competencias: ficha().competencias.map((c, i) => (i === 2 ? { ...c, nota: 150 } : c)) }), "invalido:nota");
await recusa("ficha com nota acima de 200", () => corrigir("b", leituraB1.id, ficha(240)), "invalido:nota");
await recusa("ficha com comentário curto", () => corrigir("b", leituraB1.id, { ...ficha(), competencias: ficha().competencias.map((c, i) => (i === 0 ? { ...c, comentario: "ok" } : c)) }), "invalido:comentario");
await recusa("ficha com 4 competências", () => corrigir("b", leituraB1.id, { ...ficha(), competencias: ficha().competencias.slice(0, 4) }), "invalido:ficha");
await recusa("outra pessoa não corrige a leitura de b", () => corrigir("c", leituraB1.id), "nao_encontrado");
await recusa("quem tem sessão não grava correção direto no banco", () => chamar(P.b, "alumia_redacao_corrigir", { p_usuario: P.b, p_leitura: leituraB1.id, p_correcao: idDaCorrecao(), p_ficha: ficha(), p_lacre: null }), "permission denied");
const limitesAntes = (await um("select count(*)::int n from interno.limites")).n;
await espera("b corrige pelo servidor", () => corrigir("b", leituraB1.id), (r) => r.corrigida === true && r.feitas === 1);
await espera("corrigir não grava freio com o id da pessoa", () => um("select count(*)::int n from interno.limites"), (x) => x.n === limitesAntes);
await recusa("a mesma leitura não se corrige duas vezes", () => corrigir("b", leituraB1.id), "nao_encontrado");

// Largar e o prazo.
const larga = await espera("c pede uma redação", () => chamar(P.c, "alumia_redacao_pegar"), (l) => !!l.id);
await espera("e larga", () => chamar(P.c, "alumia_redacao_largar", { p_leitura: larga.id }), (r) => r.largada === true);
const vence = await espera("c pede outra", () => chamar(P.c, "alumia_redacao_pegar"), (l) => !!l.id);
await dono("update interno.alumia_redacao_leituras set prazo = now() - interval '1 minute' where id = $1", [vence.id]);
await recusa("passou do prazo, não corrige", () => corrigir("c", vence.id), "prazo");
await espera("o agendador solta a leitura vencida", () => rodada(), (r) => r.soltas === 1);

// A roda inteira: cada um corrige 2.
for (const n of ["a", "b", "c", "d"]) {
  for (;;) {
    const r = await roda(n);
    const feitas = r.corrigi.find((x) => x.semana === SEMANA).feitas;
    if (feitas >= 2) break;
    const l = await chamar(P[n], "alumia_redacao_pegar");
    if (l.nenhuma) break;
    ok(`${n} não recebe a própria redação nem a autora`, naoTemNinguem(l) && !l.texto.endsWith(`nenhuma, ${n}.`));
    await corrigir(n, l.id);
  }
}
// "e" ajuda enquanto alguma redação tiver menos de 2 leituras.
const faltaLeitura = async () => (await um("select count(*)::int n from interno.alumia_redacoes r where (select count(*) from interno.alumia_redacao_correcoes c where c.redacao = r.id) < 2")).n > 0;
while (await faltaLeitura()) {
  const l = await chamar(P.e, "alumia_redacao_pegar");
  if (l.nenhuma) break;
  await corrigir("e", l.id);
}
await espera("todas as redações têm 2 leituras ou mais", () => linhas("select r.id, (select count(*) from interno.alumia_redacao_correcoes c where c.redacao = r.id)::int n from interno.alumia_redacoes r"), (l) => l.length === 4 && l.every((x) => x.n >= 2));
await espera("cada autora cumpriu a troca", () => linhas("select interno.alumia_red_feitas(u, $1) feitas from unnest($2::uuid[]) u", [SEMANA, [P.a, P.b, P.c, P.d]]), (l) => l.length === 4 && l.every((x) => x.feitas >= 2));
await espera("corrigir não mexe no crédito (a leitura feita é que conta até a rodada)", () => linhas("select * from interno.alumia_redacao_creditos where semana = $1", [SEMANA]), (l) => l.length === 0);

// ── Antes da devolução, a autora não sabe nada das leituras ──
await espera("antes da devolução: nada das leituras, nem quantas chegaram", () => roda("a"), (r) => {
  const m = r.minhas.find((x) => x.id === RED.a);
  return m.situacao === "na_roda" && m.correcoes === null && m.falta_corrigir === 0 && naoTemNinguem(r, ["a"]) && !/leituras_recebidas|recebidas/.test(JSON.stringify(m));
});
const antes = await linhas("select l.redacao, l.corretor from interno.alumia_redacao_leituras l where l.feita");
ok("antes da devolução, a leitura liga quem corrigiu à redação (é o que a devolução desfaz)", antes.length >= 8);

// ═══════════════════ 6. A devolução pelo agendador e o ataque de quem lê o banco ═══════════════════
await espera("o agendador devolve as 4", () => rodada(), (r) => r.devolvidas === 4 && r.desligadas === 4);
await espera("nenhuma linha 'quem leu' sobrou das redações devolvidas", () => linhas("select * from interno.alumia_redacao_leituras where redacao = any ($1)", [Object.values(RED)]), (l) => l.length === 0);
{
  const correcoes = await linhas("select xmin::text x, id::text, redacao::text, lacre from interno.alumia_redacao_correcoes");
  const creditos = await linhas("select xmin::text x, usuario::text from interno.alumia_redacao_creditos");
  ok("pelo xmin: as correções foram regravadas juntas pelo agendador", new Set(correcoes.map((c) => c.x)).size === 1);
  ok("pelo xmin: todos os créditos da roda foram escritos na mesma transação das correções (o xmin não ordena ninguém)",
    creditos.length >= 4 && creditos.every((k) => k.x === correcoes[0].x));
  // O ataque da revisão: as correções pela ordem no disco (ctid) contra os créditos pela ordem do xmin.
  const porCtid = (await linhas("select id::text from interno.alumia_redacao_correcoes order by ctid")).map((x) => x.id);
  const feitasAntes = ordemDasCorrecoes.filter((id) => porCtid.includes(id));
  ok("pela ordem no disco: as correções não estão na ordem em que foram feitas", porCtid.length >= 8 && porCtid.join() !== feitasAntes.join());
  ok("pela ordem no disco: os créditos também não (escritos de novo em ordem sorteada, todos com o mesmo xmin)",
    new Set(creditos.map((k) => k.x)).size === 1);
  ok("os ids das correções são sorteados (uuid v4), não seguem ordem", correcoes.every((c) => c.id[14] === "4"));
  ok("o lacre não contém a pessoa", correcoes.every((c) => /^[0-9a-f]{64}$/.test(c.lacre) && nomes.every((n) => !c.lacre.includes(P[n].replace(/-/g, "")))));
  const corretores = [...new Set(antes.map((x) => x.corretor))];
  ok("sem o segredo do servidor, o lacre não bate com ninguém", correcoes.every((c) => donaDoLacre("outro-segredo-qualquer-para-tentar-0123456789", c.id, c.lacre, corretores) === null));
  // Quem lê o banco inteiro: em toda tabela de interno, toda linha que menciona quem corrigiu não menciona redação nem correção.
  const tabelas = (await linhas("select c.relname from pg_class c where c.relnamespace = 'interno'::regnamespace and c.relkind = 'r'")).map((t) => t.relname);
  const ids = [...Object.values(RED), ...correcoes.map((c) => c.id)];
  let ligacoes = 0;
  for (const t of tabelas) {
    const l = await linhas(`select t::text s from interno.${t} t where ${corretores.map((_, i) => `t::text like $${i + 1}`).join(" or ")}`, corretores.map((c) => `%${c}%`));
    for (const x of l) if (ids.some((id) => x.s.includes(id))) ligacoes++;
  }
  // A autora fica ligada à PRÓPRIA redação (é dela); as autoras também corrigiram: conta só a ligação de quem corrigiu com redação alheia.
  const proprias = Object.entries(RED).map(([n, id]) => [P[n], id]);
  let alheias = 0;
  for (const t of tabelas) {
    const l = await linhas(`select t::text s from interno.${t} t where ${corretores.map((_, i) => `t::text like $${i + 1}`).join(" or ")}`, corretores.map((c) => `%${c}%`));
    for (const x of l) for (const c of corretores) if (x.s.includes(c) && ids.some((id) => x.s.includes(id) && !proprias.some(([p, r]) => p === c && r === id))) alheias++;
  }
  ok("depois da devolução, nenhuma linha do banco liga quem corrigiu a uma redação ou correção alheia", alheias === 0);
  void ligacoes;
}

// ── A autora recebe, sem saber de quem ──
const devolvida = await espera("devolvida: as leituras com as notas e os comentários, sem ninguém", () => roda("a"), (r) => {
  const m = r.minhas.find((x) => x.id === RED.a);
  return m.situacao === "devolvida" && m.correcoes.length >= 2 && m.correcoes.every((c) => c.total === 800 && c.competencias.length === 5 && !c.removida && c.denuncia === null)
    && naoTemNinguem(m) && Object.keys(m.correcoes[0]).sort().join() === "competencias,denuncia,geral,id,removida,total" && !!m.apagar_em;
});
const corA = devolvida?.minhas.find((x) => x.id === RED.a).correcoes ?? [];

// ═══════════════════ 7. A troca: quem não corrige não recebe ═══════════════════
await espera("f entrega e não corrige", () => chamar(P.f, "alumia_redacao_entregar", { p_titulo: "", p_texto: texto("f") }), (r) => r.falta_corrigir === 2);
const redF = (await um("select id from interno.alumia_redacoes where autora = $1", [P.f])).id;
for (const n of ["g", "e"]) {
  const l = await chamar(P[n], "alumia_redacao_pegar");
  ok(`${n} pega a redação de f (a única esperando)`, (await um("select redacao from interno.alumia_redacao_leituras where id = $1", [l.id])).redacao === redF);
  await corrigir(n, l.id);
}
await rodada();
await espera("f não corrigiu: não recebe", () => roda("f"), (r) => r.minhas[0].situacao === "na_roda" && r.minhas[0].correcoes === null && r.minhas[0].falta_corrigir === 2);
await espera("redação já devolvida não recebe terceira leitura, e quem corrigiu não a pega de novo", () => linhas("select id from interno.alumia_red_candidatas($1)", [P.c]),
  (l) => !Object.values(RED).some((id) => l.some((x) => x.id === id)));
await espera("f pede para ler: só havia devolvidas, a roda está cheia e a troca dela fica cumprida", () => chamar(P.f, "alumia_redacao_pegar"), (x) => x.nenhuma === true && x.dispensada === true);
await rodada();
await espera("f recebe", () => roda("f"), (r) => r.minhas[0].situacao === "devolvida" && r.minhas[0].correcoes.length === 2 && naoTemNinguem(r.minhas[0]));
await espera("as leituras feitas das devolvidas se desligam", () => linhas("select * from interno.alumia_redacao_leituras where feita"), (l) => l.length === 0);

// A roda cheia: h entrega quando todas as outras já têm as leituras todas; ela pede para ler, não há o que ler, e a troca dela fica
// cumprida. Antes, sem ter tentado, ela não recebe.
const redH = (await espera("h entrega", () => chamar(P.h, "alumia_redacao_entregar", { p_titulo: "", p_texto: texto("h") }), (r) => r.falta_corrigir === 2))?.id;
for (;;) {
  const l = await chamar(P.g, "alumia_redacao_pegar");
  if (l.nenhuma) break;
  await corrigir("g", l.id);
}
for (const n of ["a", "b"]) {
  const l = await chamar(P[n], "alumia_redacao_pegar");
  if (!l.nenhuma) await corrigir(n, l.id);
}
await rodada();
await espera("h ainda não tentou ler: não recebe", () => roda("h"), (r) => r.minhas[0].id === redH && r.minhas[0].situacao === "na_roda" && r.minhas[0].falta_corrigir === 2);
await espera("h pede para ler e a roda está cheia: a troca fica cumprida", () => chamar(P.h, "alumia_redacao_pegar"), (r) => r.nenhuma === true && r.dispensada === true);
await espera("o crédito diz só 'dispensada', sem redação", () => um("select c::text s from interno.alumia_redacao_creditos c where usuario = $1", [P.h]), (x) => x.s.includes(",t,") && !x.s.includes(redH));
await rodada();
await espera("e h recebe", () => roda("h"), (r) => r.minhas[0].situacao === "devolvida" && r.minhas[0].correcoes.length >= 2 && naoTemNinguem(r.minhas[0]));
await espera("quem não tem redação na roda não ganha dispensa", () => chamar(P.g, "alumia_redacao_pegar"), (r) => r.nenhuma === true && r.dispensada === false);

// ═══════════════════ 8. A denúncia, a mediação e o afastamento cego ═══════════════════
const alvo = corA[0];
const quemEscreveu = await (async () => {
  for (const n of nomes) if (alvo && donaDoLacre(SEGREDO, alvo.id, (await um("select lacre from interno.alumia_redacao_correcoes where id = $1", [alvo.id])).lacre, [P[n]])) return n;
  return null;
})();
ok("(o teste sabe, pelo segredo, quem escreveu a leitura denunciada)", !!quemEscreveu);
await recusa("quem não é a autora não denuncia", () => chamar(P.b, "alumia_redacao_denunciar", { p_correcao: alvo.id, p_motivo: "Comentários ofensivos sobre mim." }), "nao_encontrado");
await recusa("motivo curto", () => chamar(P.a, "alumia_redacao_denunciar", { p_correcao: alvo.id, p_motivo: "ruim" }), "invalido:motivo");
await espera("a autora denuncia a leitura", () => chamar(P.a, "alumia_redacao_denunciar", { p_correcao: alvo.id, p_motivo: "A leitura só tem xingamentos, nada sobre o texto." }), (c) => c.denuncia === "aberta");
await recusa("uma denúncia por leitura", () => chamar(P.a, "alumia_redacao_denunciar", { p_correcao: alvo.id, p_motivo: "De novo a mesma leitura ofensiva." }), "ja_denunciada");
await recusa("quem não é da mediação não vê a fila", () => chamar(P.b, "alumia_redacao_mediacao"), "sem_permissao");
const fila = await espera("a mediação vê a denúncia, a correção e o texto, sem ninguém", () => chamar(P.mediador, "alumia_redacao_mediacao"), (l) => l.length === 1 && l[0].correcao.id === alvo.id && !!l[0].texto && naoTemNinguem(l));
await espera("a roda conta as denúncias para a mediação", () => roda("mediador"), (r) => r.pode_mediar === true && r.denuncias_abertas === 1);
await recusa("quem não é da mediação não decide", () => chamar(P.b, "alumia_redacao_mediar", { p_denuncia: fila[0].id, p_abusiva: true, p_nota: "" }), "sem_permissao");
await espera("a mediação julga abusiva: o afastamento fica pendente, sem nome", () => chamar(P.mediador, "alumia_redacao_mediar", { p_denuncia: fila[0].id, p_abusiva: true, p_nota: "Ofensa pessoal." }), (r) => r.situacao === "abusiva" && r.afastamento === "pendente" && naoTemNinguem(r));
await recusa("decidida não se decide de novo", () => chamar(P.mediador, "alumia_redacao_mediar", { p_denuncia: fila[0].id, p_abusiva: false, p_nota: "" }), "ja_decidida");
await espera("a leitura sai da tela da autora (marcada como tirada)", () => roda("a"), (r) => r.minhas.find((x) => x.id === RED.a).correcoes.find((c) => c.id === alvo.id).removida === true);
await recusa("quem tem sessão não pede os dados do afastamento", () => chamar(P.mediador, "alumia_redacao_afastar_dados", { p_denuncia: fila[0].id }), "permission denied");
// O que app/api/alumia/redacao/afastar faz.
const dados = await espera("o servidor recebe o lacre e quem corrigiu na roda", () => servico("alumia_redacao_afastar_dados", { p_denuncia: fila[0].id }), (d) => d.pendente === true && d.candidatos.length >= 5 && /^[0-9a-f]{64}$/.test(d.lacre));
const dona = donaDoLacre(SEGREDO, dados.correcao, dados.lacre, dados.candidatos);
ok("o servidor acha quem escreveu pelo lacre", dona === P[quemEscreveu]);
await espera("e afasta", () => servico("alumia_redacao_afastar", { p_denuncia: fila[0].id, p_usuario: dona }), (r) => r.afastamento === "feito");
await espera("o lacre some depois do afastamento", () => um("select lacre from interno.alumia_redacao_correcoes where id = $1", [alvo.id]), (x) => x.lacre === null);
await espera("a denúncia não guarda a pessoa", () => um("select d::text s from interno.alumia_redacao_denuncias d where id = $1", [fila[0].id]), (x) => nomes.every((n) => !x.s.includes(P[n])));
await recusa("quem foi afastada não pede redação", () => chamar(P[quemEscreveu], "alumia_redacao_pegar"), "afastada");
await espera("e vê até quando", () => roda(quemEscreveu), (r) => !!r.afastada_ate);
await espera("afastar de novo não muda nada", () => servico("alumia_redacao_afastar", { p_denuncia: fila[0].id, p_usuario: P.b }), (r) => r.afastamento === "feito");
await espera("a fila da mediação esvazia", () => chamar(P.mediador, "alumia_redacao_mediacao"), (l) => l.length === 0);
await espera("a redação de a volta para a roda por uma leitura nova, só para quem não corrigiu nada naquela roda", async () => [
  await linhas("select id from interno.alumia_red_candidatas($1)", [P.coord]), await linhas("select id from interno.alumia_red_candidatas($1)", [P.g])],
  ([coord, g]) => coord.some((x) => x.id === RED.a) && !g.some((x) => x.id === RED.a));
// A leitura de reposição só aparece para a autora depois da rodada (nunca na hora em que foi feita).
{
  const antesDaRepor = (await roda("a")).minhas.find((x) => x.id === RED.a).correcoes.length;
  const l = await espera("quem não corrigiu na roda pega a leitura de reposição", () => chamar(P.coord, "alumia_redacao_pegar"), (x) => !!x.id && naoTemNinguem(x));
  ok("a leitura de reposição é a redação de a", l && (await um("select redacao from interno.alumia_redacao_leituras where id = $1", [l.id])).redacao === RED.a);
  if (l) await corrigir("coord", l.id);
  await espera("logo depois de corrigir, a autora não vê a leitura nova", () => roda("a"), (r) => r.minhas.find((x) => x.id === RED.a).correcoes.length === antesDaRepor);
  await espera("nem consegue denunciar o que não foi liberado", async () => (await um("select count(*)::int n from interno.alumia_redacao_correcoes where redacao = $1 and not liberada", [RED.a])).n, (n) => n === 1);
  await rodada();
  await espera("depois da rodada, a leitura nova aparece e a linha 'quem leu' sumiu", async () => [await roda("a"), await linhas("select 1 from interno.alumia_redacao_leituras where redacao = $1", [RED.a])],
    ([r, l2]) => r.minhas.find((x) => x.id === RED.a).correcoes.length === antesDaRepor + 1 && l2.length === 0);
  await espera("a denúncia já julgada continua lá depois da regravação", () => roda("a"), (r) => r.minhas.find((x) => x.id === RED.a).correcoes.find((c) => c.id === alvo.id)?.denuncia === "abusiva");
}
// Não abusiva.
await chamar(P.a, "alumia_redacao_denunciar", { p_correcao: corA[1].id, p_motivo: "Achei a nota injusta demais para o texto." });
const fila2 = await chamar(P.mediador, "alumia_redacao_mediacao");
await espera("não abusiva: a leitura fica", () => chamar(P.mediador, "alumia_redacao_mediar", { p_denuncia: fila2[0].id, p_abusiva: false, p_nota: "" }), (r) => r.situacao === "nao_abusiva" && r.afastamento === "nao");
await espera("e a autora vê a decisão", () => roda("a"), (r) => r.minhas.find((x) => x.id === RED.a).correcoes.find((c) => c.id === corA[1].id).denuncia === "nao_abusiva");

// ═══════════════════ 8b. A roda que fecha: leituras de redação não devolvida e a medalha ═══════════════════
{
  const VELHA = (await um("select (interno.semana_atual() - 14)::text s")).s;
  await dono("insert into interno.alumia_redacao_temas (semana, titulo) values ($1, 'Um tema de uma roda que já fechou') on conflict do nothing", [VELHA]);
  const redVelha = (await um("insert into interno.alumia_redacoes (semana, autora, texto, apagar_em) values ($1, $2, $3, now() + interval '7 days') returning id", [VELHA, P.h, texto("h")])).id;
  const corVelha = idDaCorrecao();
  await dono("insert into interno.alumia_redacao_leituras (redacao, corretor, prazo, feita) values ($1, $2, now() + interval '1 day', true)", [redVelha, P.e]);
  await dono("insert into interno.alumia_redacao_correcoes (id, redacao, ficha) values ($1, $2, $3)", [corVelha, redVelha, JSON.stringify(ficha())]);
  const medalhaAntes = (await um("select coalesce((select progresso from interno.alumia_conquistas where usuario = $1 and medalha = 'redacao' and alvo = ''), 0) n", [P.e])).n;
  await espera("a roda fechou sem devolução (h não corrigiu nada nela): a rodada desliga mesmo assim", () => rodada(), (r) => r.medalhas >= 1);
  await espera("a linha 'quem leu' da redação não devolvida sumiu e virou crédito", async () => [
    await linhas("select 1 from interno.alumia_redacao_leituras where redacao = $1", [redVelha]), await um("select interno.alumia_red_feitas($1, $2) n", [P.e, VELHA]),
    await um("select liberada from interno.alumia_redacao_correcoes where id = $1", [corVelha])],
    ([l, f, c]) => l.length === 0 && f.n === 1 && c.liberada === false);
  await espera("a medalha da redação contou a correção quando a roda fechou", () => um("select progresso n from interno.alumia_conquistas where usuario = $1 and medalha = 'redacao' and alvo = ''", [P.e]), (x) => x.n === medalhaAntes + 1);
  await rodada();
  await espera("e não conta de novo", () => um("select progresso n from interno.alumia_conquistas where usuario = $1 and medalha = 'redacao' and alvo = ''", [P.e]), (x) => x.n === medalhaAntes + 1);
  await espera("a roda desta semana ainda não contou medalha", () => linhas("select 1 from interno.alumia_redacao_creditos where semana = $1 and medalha", [SEMANA]), (l) => l.length === 0);
}

// ═══════════════════ 9. Apagar de vez ═══════════════════
const correcoesDeA = (await linhas("select id::text from interno.alumia_redacao_correcoes where redacao = $1", [RED.a])).map((x) => x.id);
await dono("update interno.alumia_redacoes set apagar_em = now() - interval '1 minute', devolvida_em = now() - interval '30 days 1 minute' where id = $1", [RED.a]);
await espera("30 dias depois da devolução, o agendador apaga", () => rodada(), (r) => r.apagadas === 1);
await espera("a redação, as correções e as denúncias somem de vez", async () => {
  const tabelas = (await linhas("select c.relname from pg_class c where c.relnamespace = 'interno'::regnamespace and c.relkind = 'r'")).map((t) => t.relname);
  let achou = 0;
  for (const t of tabelas) {
    const ids = [RED.a, ...correcoesDeA, fila[0].id, fila2[0].id];
    achou += (await linhas(`select 1 from interno.${t} t where ${ids.map((_, i) => `t::text like $${i + 1}`).join(" or ")}`, ids.map((id) => `%${id}%`))).length;
  }
  return achou;
}, (n) => n === 0);
// Sem devolução: 21 dias depois do começo da semana.
await dono("insert into interno.alumia_redacao_temas (semana, titulo) values (interno.semana_atual() - 28, 'Um tema antigo da roda passada') on conflict do nothing");
await dono("insert into interno.alumia_redacoes (semana, autora, texto, apagar_em) values (interno.semana_atual() - 28, $1, $2, ((interno.semana_atual() - 28 + 21)::timestamp at time zone 'America/Sao_Paulo'))", [P.g, texto("g")]);
await espera("a não devolvida some 21 dias depois do começo da semana", () => rodada(), (r) => r.apagadas === 1);
await espera("a autora apaga a dela quando quer", () => chamar(P.b, "alumia_redacao_apagar", { p_id: RED.b }), (r) => r.apagada === true);
await recusa("e só a dela", () => chamar(P.b, "alumia_redacao_apagar", { p_id: RED.c }), "nao_encontrado");
await espera("conta apagada leva a redação e o crédito junto", async () => {
  await dono("delete from interno.perfis where id = $1", [P.d]);
  return linhas("select 1 from interno.alumia_redacoes where autora = $1 union all select 1 from interno.alumia_redacao_creditos where usuario = $1", [P.d]);
}, (l) => l.length === 0);
} catch (e) {
  falhas.push(`o teste parou: ${e.message}`);
}

await banco.pg.close();
console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHA ${f}`);
process.exit(falhas.length ? 1 : 0);
