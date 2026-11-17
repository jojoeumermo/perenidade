// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os INTERESSES na regra "Em roda" (onda 11, 11F; supabase/migracoes/20261117-alumia-o11-interesses.sql) num Postgres de
// verdade (scripts/banco-local.mjs, com o install.sql e a migração rodada duas vezes). O que este teste PROVA:
//   - SEM interesses, a ordem é exatamente a de antes: rede_o11_linha e rede_o11_desde dão o mesmo que rede_roda_linha e
//     rede_roda_desde, tela a tela e cursor a cursor, e rede_o11_montar dá o mesmo que rede_o7_montar, item a item;
//   - COM interesses, dentro de cada bloco de 6 horas, o que casa com eles vem antes (motivo 'interesse'), avisos e atos
//     continuam no alto, nada some, e o teto de 3 por tela continua valendo;
//   - "mais conteúdo": as conversas paralelas (cita, @ no começo, de quem a pessoa não segue, fora dos lugares dela) descem para o
//     fim do bloco, sem sumir; de quem ela segue, não descem;
//   - os interesses NUNCA ficam gravados: nenhuma linha de nenhuma tabela muda além do freio de leitura, e o texto dos interesses
//     não aparece em lugar nenhum do banco; a montagem é `stable`;
//   - duas pessoas com os mesmos interesses veem a mesma ordem; interesse torto é recusado;
//   - o aparelho (lib/rede/interesses.ts): o que cada resposta vira, a chave que o Sair rápido apaga, o ritmo, e o cliente da
//     linha que só chama a função nova com interesses (e volta à de antes se o banco não a tiver);
//   - os textos nas seis línguas (questionário e "Como a linha é montada").
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-interesses.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import * as I from "../lib/rede/interesses.ts";
import { criarClienteDaLinha } from "../lib/rede/cliente-linha.ts";
import { PREFIXO_DA_REDE } from "../lib/rede/saida.ts";

let certos = 0;
const falhas = [];
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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ler = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const sql = ler("supabase/migracoes/20261117-alumia-o11-interesses.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
await espera("a migração instala", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(sql)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

const p = {};
const nomes = ["ana", "bia", "um", "dois", "tres", "quatro", "cinco", "seis", "mod"];
for (const [i, nome] of nomes.entries()) {
  p[nome] = await criarUsuario(`${nome}@o11.local`, nome);
  await rpc(como(p[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [p[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [p[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [p[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");

// ═══════════════════ Funções e portas ═══════════════════
const publicas = ["rede_o11_linha", "rede_o11_desde"];
const internas = ["rede_o11_interesses", "rede_o11_liga", "rede_o11_paralela", "rede_o11_montar"];
await espera("as funções públicas são security definer com search_path fixo e passam pela porta", async () =>
  (await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [publicas])).rows,
(rs) => rs.length === 2 && rs.every((r) => r.prosecdef && r.cfg.includes("search_path=interno, pg_temp") && /^\s*(declare[\s\S]*?)?begin\s+perform interno\.alumia_porta\(\);/i.test(r.prosrc.replace(/^[\s\S]*?(?=declare|begin)/i, ""))));
await espera("a regra das portas não acha função da rede aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r.abertas) && r.abertas.length === 0);
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = any($1)`, [internas])).rows,
(rs) => rs.length === internas.length && rs.every((r) => !r.a && !r.b));
await espera("a montagem com interesses é stable (não consegue gravar nada)", async () =>
  (await dono(`select p.proname, p.provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = any($1)`, [internas])).rows,
(rs) => rs.length === internas.length && rs.every((r) => r.provolatile === "s"));
await espera("a migração não cria tabela nem coluna", async () => [/create table/i.test(sql), /alter table/i.test(sql), /\binsert into\b/i.test(sql), /\bupdate\s+\w/i.test(sql.replace(/on conflict[^;]*/gi, ""))],
  (r) => igual(r, [false, false, false, false]));
const PROIBIDAS = /rede_reacoes|rede_apoios|rede_salvos|rede_vou|rede_alumia_reac|rede_avisos|lido|visto|clique/i;
await espera("o ingrediente não lê nenhuma tabela de comportamento", async () =>
  (await dono(`select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname in ('rede_o11_liga', 'rede_o11_paralela', 'rede_o11_interesses')`)).rows,
(rs) => rs.length === 3 && rs.every((r) => !PROIBIDAS.test(r.prosrc) && !/count\(/i.test(r.prosrc)));
await recusa("visitante não chama rede_o11_linha", () => rpc(visitante(), "rede_o11_linha", { p_aba: "tudo" }), "permission denied");

// ═══════════════════ O cenário ═══════════════════
const SEIS_H = 6 * 3600 * 1000;
const agora = Date.now();
const P = Math.floor(agora / SEIS_H) * SEIS_H - SEIS_H;
const PP = P - SEIS_H;
const em = (base, minutos) => new Date(base + minutos * 60000).toISOString();
const post = async (autor, texto, quando, mais = {}) =>
  (await um(
    `insert into interno.rede_posts (autor, texto, publico, criado_em, tipo, fixado, comunidade, nucleo, quote_of)
     values ($1, $2, 'membros', $3, $4, $5, $6, $7, $8) returning id`,
    [p[autor], texto, quando, mais.tipo ?? "post", mais.fixado ?? false, mais.comunidade ?? null, mais.nucleo ?? null, mais.cita ?? null],
  )).id;

const id = {};
// Bloco P: "um" publica quatro vezes (uma com #moradia); os outros, uma ou duas.
id.a1 = await post("um", "Um, primeira do bloco.", em(P, 10));
id.a2 = await post("um", "Um, sobre #moradia no centro.", em(P, 20));
id.a3 = await post("um", "Um, terceira do bloco.", em(P, 30));
id.a4 = await post("um", "Um, quarta do bloco.", em(P, 40));
id.b1 = await post("dois", "Dois no bloco.", em(P, 15));
id.c1 = await post("tres", "Três pergunta: como faço a inscrição do #enem?", em(P, 5), { tipo: "duvida" });
id.d1 = await post("quatro", "Quatro abre uma discussão.", em(P, 25), { tipo: "discussao" });
// Conversas paralelas: cinco e seis (que ninguém segue) citam e chamam pelo @.
id.x1 = await post("cinco", "@pessoa_seis concordo com você nisso.", em(P, 50));
id.x2 = await post("seis", "Olha o que a cinco disse.", em(P, 55), { cita: id.b1 });
id.x3 = await post("dois", "@pessoa_um bom ponto.", em(P, 45));
// Bloco PP: um comum, um aviso fixado, um chamado para amanhã.
id.e1 = await post("dois", "Dois no bloco de antes, sobre #saude.", em(PP, 50));
id.e2 = await post("cinco", "Cinco no bloco de antes.", em(PP, 40));
id.av = await post("mod", "Aviso da moderação: manutenção no domingo.", em(PP, 10), { tipo: "aviso", fixado: true });
id.ato1 = await post("tres", "Assembleia do bairro amanhã.", em(PP, 20), { tipo: "chamado" });
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto, tipo) values ($1, now() + interval '24 hours', 'São Paulo', 'Praça da Sé', 'assembleia')", [id.ato1]);
id.velho = await post("quatro", "Quatro, dez dias atrás.", new Date(agora - 10 * 86400000).toISOString());
// Ana e Bia fazem AS MESMAS escolhas: seguem um, dois, tres, quatro e a moderação (não seguem cinco nem seis).
for (const quem of ["ana", "bia"]) for (const alvo of ["um", "dois", "tres", "quatro", "mod"]) {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [p[quem], p[alvo]]);
}

const nome = (x) => Object.entries(id).find(([, v]) => v === x)?.[0] ?? x;
const nomesDe = (r) => r.itens.map((x) => nome(x.id));
const antiga = (quem, aba = "tudo", modo = "roda", filtro = null, cursor = null) =>
  rpc(como(p[quem]), "rede_roda_linha", { p_aba: aba, p_modo: modo, p_filtro: filtro, p_cursor: cursor });
const nova = (quem, interesses, aba = "tudo", modo = "roda", filtro = null, cursor = null) =>
  rpc(como(p[quem]), "rede_o11_linha", { p_aba: aba, p_modo: modo, p_filtro: filtro, p_cursor: cursor, p_interesses: interesses });
// O que muda de uma chamada para outra (o instante) fica fora da comparação.
const semInstante = (r) => ({ ...r, instante: null, proximo: r.proximo?.replace(/^r\|[^|]+\|/, "r|T|").replace(/^d\|/, "d|") ?? null });

// ═══════════════════ Sem interesses, a ordem de antes ═══════════════════
await zerar();
const TELA_ANTIGA = nomesDe(await antiga("ana"));
for (const [rotulo, vazio] of [["nulo", null], ["vazio", {}], ["só o ritmo não existe no banco: objeto vazio", {}]]) {
  await espera(`sem interesses (${rotulo}): a mesma tela, os mesmos motivos e o mesmo cursor da rede_roda_linha`, async () => {
    const [a, b] = [await antiga("ana"), await nova("ana", vazio)];
    return [semInstante(a), semInstante(b)];
  }, ([a, b]) => igual(a, b) && a.itens.length > 0);
}
await espera("sem interesses: a tela 2 e a continuação em ordem de chegada também são iguais", async () => {
  const saida = [];
  for (const chamar of [(c) => antiga("ana", "tudo", "roda", null, c), (c) => nova("ana", null, "tudo", "roda", null, c)]) {
    const telas = [];
    let cursor = null;
    for (let k = 0; k < 4; k++) {
      const r = await chamar(cursor);
      telas.push(nomesDe(r));
      cursor = r.proximo;
      if (!cursor) break;
    }
    saida.push(telas);
  }
  return saida;
}, ([a, b]) => igual(a, b) && a.flat().includes("velho"));
for (const [aba, filtro] of [["seguindo", null], ["comunidades", null], ["tudo", { tipos: ["duvida", "post"] }], ["tudo", { tags: ["moradia"] }]]) {
  await espera(`sem interesses: rede_o11_montar = rede_o7_montar, item a item (${aba} ${JSON.stringify(filtro)})`, async () => {
    const args = [aba, JSON.stringify(filtro ?? {}), p.ana];
    const a = (await dono("select pos, tela, id, porque from interno.rede_o7_montar($1, $2::jsonb, $3, now())", args)).rows;
    const b = (await dono("select pos, tela, id, porque from interno.rede_o11_montar($1, $2::jsonb, $3, now(), null, false, null)", args)).rows;
    return [a, b];
  }, ([a, b]) => igual(a, b));
}
await espera("sem interesses: 'enquanto você esteve fora' igual ao de antes", async () => {
  const desde = new Date(P - 60_000).toISOString();
  const a = await rpc(como(p.ana), "rede_roda_desde", { p_aba: "tudo", p_desde: desde });
  const b = await rpc(como(p.ana), "rede_o11_desde", { p_aba: "tudo", p_desde: desde, p_interesses: null });
  return [a, b].map((r) => ({ novos: r.novos, ids: r.destaques.map((x) => x.id), porques: r.destaques.map((x) => x.o7_porque) }));
}, ([a, b]) => igual(a, b) && a.novos > 0);
await espera("ordem de chegada: os interesses não mudam nada", async () => [nomesDe(await antiga("ana", "tudo", "chegada")), nomesDe(await nova("ana", { tags: ["moradia"], conteudo: true }, "tudo", "chegada"))],
  ([a, b]) => igual(a, b));

// ═══════════════════ Com interesses ═══════════════════
await zerar();
const MORADIA = { tags: ["moradia"] };
await espera("com #moradia: o post da pauta vem primeiro no bloco dele, com o motivo 'interesse'", () => nova("ana", MORADIA),
  (r) => {
    const n = nomesDe(r);
    return n[0] === "av" && n[1] === "ato1" && n[2] === "a2" && r.itens[2].o7_porque === "interesse";
  });
await espera("nada some: o mesmo conjunto de posts, só em outra ordem", async () => {
  const todosA = [];
  const todosB = [];
  for (const [lista, chamar] of [[todosA, (c) => antiga("ana", "tudo", "roda", null, c)], [todosB, (c) => nova("ana", MORADIA, "tudo", "roda", null, c)]]) {
    let cursor = null;
    for (let k = 0; k < 4; k++) {
      const r = await chamar(cursor);
      lista.push(...nomesDe(r));
      cursor = r.proximo;
      if (!cursor) break;
    }
  }
  return [todosA.slice().sort(), todosB.slice().sort(), igual(todosA, todosB)];
}, ([a, b, mesmaOrdem]) => igual(a, b) && !mesmaOrdem);
await espera("o post de interesse só sobe dentro do bloco dele (o bloco anterior continua depois)", async () => {
  const r = await nova("ana", { tags: ["saude"] });
  const n = nomesDe(r);
  return [n.indexOf("e1"), Math.max(...["a1", "a3", "a4", "b1", "c1", "d1"].map((x) => n.indexOf(x)))];
}, ([e1, ultimoDoBlocoNovo]) => e1 > ultimoDoBlocoNovo);
await espera("tipos e estudo: dúvida e discussão sobem; o resto segue a roda", async () => nomesDe(await nova("ana", { tipos: ["discussao", "duvida"] })).slice(2, 4),
  (n) => igual(n.slice().sort(), ["c1", "d1"]));
await espera("o teto de 3 por tela vale com interesses", async () => {
  const r = await nova("ana", MORADIA);
  const porAutor = {};
  for (const x of r.itens) porAutor[x.autor?.id ?? x.autor_id ?? x.handle ?? JSON.stringify(x.autor)] = (porAutor[x.autor?.id ?? x.autor_id ?? x.handle ?? JSON.stringify(x.autor)] ?? 0) + 1;
  return Math.max(...Object.values(porAutor));
}, (m) => m <= 3);
await espera("Ana e Bia, com os mesmos interesses, veem a mesma ordem", async () => [nomesDe(await nova("ana", MORADIA)), nomesDe(await nova("bia", MORADIA))], ([a, b]) => igual(a, b));
await espera("a mesma pessoa, com e sem interesses: só a ordem muda (Bia sem interesses vê a de antes)", async () => [nomesDe(await nova("bia", null)), TELA_ANTIGA], ([a, b]) => igual(a, b));

// ═══════════════════ Mais conteúdo: as conversas paralelas descem ═══════════════════
await zerar();
let conteudo;
await espera("mais conteúdo: as conversas paralelas de quem Ana não segue vão para o fim do bloco", async () => (conteudo = await nova("ana", { conteudo: true })),
  (r) => {
    const n = nomesDe(r);
    const doBloco = n.filter((x) => ["a1", "a2", "a3", "a4", "b1", "c1", "d1", "x1", "x2", "x3"].includes(x));
    return igual(doBloco.slice(-2).sort(), ["x1", "x2"]);
  });
await espera("…sem sumir", async () => {
  const todos = [];
  let cursor = null;
  for (let k = 0; k < 4; k++) {
    const r = await nova("ana", { conteudo: true }, "tudo", "roda", null, cursor);
    todos.push(...nomesDe(r));
    cursor = r.proximo;
    if (!cursor) break;
  }
  return todos;
}, (t) => t.includes("x1") && t.includes("x2"));
await espera("…e o @ de quem Ana SEGUE não é conversa paralela (fica na roda)", async () => {
  const n = nomesDe(conteudo);
  const doBloco = n.filter((x) => ["a1", "a2", "a3", "a4", "b1", "c1", "d1", "x1", "x2", "x3"].includes(x));
  return doBloco.indexOf("x3") < doBloco.indexOf("x1");
}, (x) => x === true);
await espera("quem passa a seguir a autora da conversa paralela vê a conversa de volta na roda", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [p.bia, p.cinco]);
  const b = nomesDe(await nova("bia", { conteudo: true }));
  await dono("delete from interno.rede_seguindo where quem = $1 and segue = $2", [p.bia, p.cinco]);
  const doBloco = b.filter((x) => ["a1", "a2", "a3", "a4", "b1", "c1", "d1", "x1", "x2", "x3"].includes(x));
  return doBloco.at(-1);
}, (ultimo) => ultimo === "x2");

// ═══════════════════ Nada é gravado ═══════════════════
await zerar();
const MARCA = "zz_marca_o11_unica";
const retrato = async () => {
  const tabelas = (await dono("select tablename from pg_tables where schemaname = 'interno' and tablename <> 'limites' order by 1")).rows.map((r) => r.tablename);
  const saida = {};
  for (const t of tabelas) saida[t] = (await um(`select count(*)::int as n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as h from interno.${t} x`)).n + ":" + (await um(`select coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as h from interno.${t} x`)).h;
  return saida;
};
const antes = await retrato();
await espera("ler a linha com interesses várias vezes (todas as abas e o 'enquanto fora')", async () => {
  const int = { tags: [MARCA, "moradia"], tipos: ["chamado"], estudo: true, nucleos: true, conteudo: true, comunidades: ["zz-comunidade-o11"] };
  for (const aba of ["tudo", "seguindo", "comunidades", "temas"]) await nova("ana", int, aba);
  await rpc(como(p.ana), "rede_o11_desde", { p_aba: "tudo", p_desde: new Date(P - 60_000).toISOString(), p_interesses: int });
  return true;
});
await espera("nenhuma tabela mudou (fora o freio de leitura)", async () => {
  const depois = await retrato();
  return Object.keys(antes).filter((t) => antes[t] !== depois[t]);
}, (mudaram) => mudaram.length === 0);
await espera("o texto dos interesses não está em lugar nenhum do banco", async () => {
  const tabelas = (await dono("select schemaname, tablename from pg_tables where schemaname not in ('pg_catalog', 'information_schema')")).rows;
  const achou = [];
  for (const t of tabelas) {
    const r = await um(`select count(*)::int as n from "${t.schemaname}"."${t.tablename}" x where x::text like $1`, [`%${MARCA}%`]);
    if (r.n > 0) achou.push(`${t.schemaname}.${t.tablename}`);
  }
  return achou;
}, (achou) => achou.length === 0);

// ═══════════════════ Interesse torto ═══════════════════
for (const [rotulo, torto] of [
  ["chave desconhecida", { curtidas: 10 }],
  ["tipo que não existe", { tipos: ["patrocinado"] }],
  ["tema torto", { tags: ["a b c"] }],
  ["temas demais", { tags: Array.from({ length: 31 }, (_, k) => `tema_${k}`) }],
  ["conteudo que não é sim/não", { conteudo: "sim" }],
  ["não é objeto", ["moradia"]],
]) {
  // O tema torto cai na conferência de #tema de sempre (invalido:tag); o resto, na dos interesses.
  await recusa(`interesse torto: ${rotulo}`, () => nova("ana", torto), rotulo === "tema torto" ? "invalido:tag" : "invalido:interesses");
}

// ═══════════════════ O aparelho (lib/rede/interesses.ts) ═══════════════════
{
  const caixa = new Map();
  const g = { getItem: (k) => caixa.get(k) ?? null, setItem: (k, v) => void caixa.set(k, v), removeItem: (k) => void caixa.delete(k) };
  await espera("aparelho: sem respostas, nada guardado e nenhum filtro", async () => [I.lerInteresses(g), I.filtroDosInteresses(g), I.foraMinimo(g)], (r) => igual(r, [null, null, 8 * 3600_000]));
  await espera("aparelho: a chave começa pelo prefixo que o Sair rápido apaga", async () => I.CHAVE_DOS_INTERESSES.startsWith(PREFIXO_DA_REDE), (x) => x === true);
  await espera("aparelho: as respostas viram o filtro escrito na tela", async () => {
    const r = { v: 1, objetivos: ["atos", "estudo", "nucleo", "amizades"], pautas: ["moradia"], estudos: ["enem"], conversa: "conteudo", ritmo: "pouco" };
    I.guardarInteresses(r, g);
    return [I.filtroDosInteresses(g), I.foraMinimo(g)];
  }, ([f, fora]) => igual(f, { tipos: ["chamado", "duvida"], tags: ["despejo_zero", "enem", "moradia", "sem_teto"], estudo: true, nucleos: true, conteudo: true }) && fora === 24 * 3600_000);
  await espera("aparelho: só 'conhecer pessoas' e meio a meio não muda a ordem", async () => I.interessesNaLinha({ ...I.INTERESSES_VAZIOS, objetivos: ["amizades"] }), (f) => igual(f, {}));
  await espera("aparelho: resposta mexida à mão perde o que não existe", async () => I.arrumarInteresses({ objetivos: ["atos", "patrocinio"], pautas: ["moradia", 3], conversa: "tudo", ritmo: "muito", extra: 1 }),
    (r) => igual(r, { v: 1, objetivos: ["atos"], pautas: ["moradia"], estudos: [], conversa: "equilibrio", ritmo: "muito" }));
  await espera("aparelho: todo #tema que o questionário gera é aceito pelo banco", async () => {
    const tudo = I.interessesNaLinha({ v: 1, objetivos: [...I.OBJETIVOS], pautas: [...I.PAUTAS], estudos: [...I.ESTUDOS], conversa: "conteudo", ritmo: "medio" });
    const r = await um("select interno.rede_o11_interesses($1::jsonb) as r", [JSON.stringify(tudo)]);
    return [tudo.tags.length, r.r.tags.length];
  }, ([a, b]) => a > 0 && a <= 30 && a === b);
  await espera("aparelho: apagar tira tudo deste aparelho", async () => {
    I.guardarInteresses(null, g);
    return [I.lerInteresses(g), caixa.size];
  }, (r) => igual(r, [null, 0]));
}
{
  // O cliente da linha: sem interesses, a chamada de antes, igual; com interesses, a nova; banco sem a nova, a de antes.
  const pedidos = [];
  const falso = (semNova) => async (funcao, argumentos) => {
    pedidos.push([funcao, Object.keys(argumentos).sort().join(",")]);
    if (semNova && funcao.startsWith("rede_o11_")) throw Object.assign(new Error("não existe"), { code: "PGRST202" });
    return { itens: [], proximo: null };
  };
  await espera("cliente: sem interesses, rede_roda_linha com os argumentos de antes", async () => {
    pedidos.length = 0;
    await criarClienteDaLinha(falso(false), () => null).linha("tudo", "roda");
    return pedidos;
  }, (r) => igual(r, [["rede_roda_linha", "p_aba,p_cursor,p_filtro,p_modo"]]));
  await espera("cliente: com interesses, rede_o11_linha com p_interesses", async () => {
    pedidos.length = 0;
    await criarClienteDaLinha(falso(false), () => ({ tags: ["moradia"] })).linha("tudo", "roda");
    return pedidos;
  }, (r) => igual(r, [["rede_o11_linha", "p_aba,p_cursor,p_filtro,p_interesses,p_modo"]]));
  await espera("cliente: na ordem de chegada, os interesses nem saem do aparelho", async () => {
    pedidos.length = 0;
    await criarClienteDaLinha(falso(false), () => ({ tags: ["moradia"] })).linha("tudo", "chegada");
    return pedidos;
  }, (r) => igual(r, [["rede_roda_linha", "p_aba,p_cursor,p_filtro,p_modo"]]));
  await espera("cliente: banco sem a função nova volta para a de antes", async () => {
    pedidos.length = 0;
    await criarClienteDaLinha(falso(true), () => ({ tags: ["moradia"] })).desde("tudo", new Date().toISOString());
    return pedidos.map((x) => x[0]);
  }, (r) => igual(r, ["rede_o11_desde", "rede_roda_desde"]));
}

// ═══════════════════ Os textos ═══════════════════
const chaves = (v, pre = "", saida = new Map()) => {
  if (Array.isArray(v)) {
    saida.set(pre, `lista:${v.length}`);
    v.forEach((x, k) => chaves(x, `${pre}[${k}]`, saida));
  } else if (v && typeof v === "object") {
    // "_rascunho" marca a tradução ainda não revista: não é texto da tela.
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) chaves(x, pre ? `${pre}.${k}` : k, saida);
  }
  else saida.set(pre, typeof v === "string" && v.trim() ? (v.match(/\{\w+\}/g) ?? []).sort().join() : "vazio");
  return saida;
};
for (const pasta of ["interesses", "linha"]) {
  const pt = chaves(JSON.parse(ler(`i18n/rede/${pasta}/pt.json`)));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    await espera(`textos (${pasta}): ${l} tem as mesmas chaves e marcadores que o pt, sem texto vazio`, async () => {
      const outro = chaves(JSON.parse(ler(`i18n/rede/${pasta}/${l}.json`)));
      return [...pt].filter(([k, v]) => outro.get(k) !== v).concat([...outro].filter(([k]) => !pt.has(k))).map(([k]) => k);
    }, (dif) => dif.length === 0);
  }
}
{
  const t = JSON.parse(ler("i18n/rede/interesses/pt.json"));
  await espera("textos: toda opção do questionário tem nome nos textos", async () =>
    [...I.OBJETIVOS.filter((o) => !t.objetivos[o]), ...I.PAUTAS.filter((o) => !t.pautas[o]), ...I.ESTUDOS.filter((o) => !t.estudos[o]), ...I.CONVERSAS.filter((o) => !t.conversas[o]), ...I.RITMOS.filter((o) => !t.ritmos[o])],
  (falta) => falta.length === 0);
  const tudo = ler("i18n/rede/interesses/pt.json") + ler("i18n/rede/linha/pt.json");
  await espera("textos novos sem as palavras proibidas", async () => /diploma|universidade|algoritmo/i.test(tudo), (x) => x === false);
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHA ${f}`);
await banco.fechar?.();
process.exit(falhas.length ? 1 : 0);
