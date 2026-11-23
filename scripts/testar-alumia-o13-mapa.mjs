// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o mapa e o ao vivo da onda 13 (supabase/migracoes/20261119-alumia-o13-mapa.sql, frente 13B) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · o lugar: a regra do banco (interno.rede_mapa_lugar) e a da tela (lib/rede/mapa/lugar.ts) dão o mesmo resultado;
//   · o desenho: os 27 estados e os 5.570 municípios do IBGE, todos dentro do desenho; nome repetido sem UF fica fora; a capital vence;
//   · o mapa: só agregado por cidade, número só a partir de 3, núcleo sem número e só de organização com selo que pôs no mapa;
//     só o que a pessoa vê (o visitante só o público na internet); cancelado e passado não contam; nenhuma pessoa na resposta;
//   · o ao vivo: a dona marca a própria; a moderação marca a da comunidade e convida; sem aceite ninguém vê; ordem de chegada
//     fixa; a convidada só responde ou passa a da vez; ninguém vota; quem perguntou só aparece se quis e é esquecido um dia
//     depois do fim; retirada com motivo da lista; limites;
//   · a porta, a RLS sem política, nenhuma função com parâmetro do tipo linha, e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o13-mapa.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { acharMunicipio, montarIndice } from "../lib/rede/mapa/indice.ts";
import { CAPITAIS, lugarEscrito, nomeNaChave, UFS } from "../lib/rede/mapa/lugar.ts";
import { caixaDoCaminho, enquadrar, limparMapa, pontosDoMapa, tamanhoDoPonto } from "../lib/rede/mapa/regras.ts";
import { DURACOES, LIMITES_DO_AO_VIVO as L, MOTIVOS_DA_RETIRADA } from "../lib/rede/mapa/tipos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 700)}`);
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
const sql = ler("supabase/migracoes/20261119-alumia-o13-mapa.sql");
const semComentario = sql.replace(/--.*$/gm, "");
ok("toda função nova é security definer com search_path fixo (menos as regras puras e o gatilho)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  const puras = ["interno.rede_mapa_lugar", "interno.rede_ama_fila_fixa", "interno.rede_ama_momento"];
  return funcoes.length >= 17 && funcoes.every((f) => /set search_path = interno, pg_temp/.test(f))
    && funcoes.filter((f) => !puras.some((p) => f.includes(p))).every((f) => /security definer set search_path = interno, pg_temp/.test(f));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 2
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede nem posição", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta|latitude|longitude|lat|lon|geo)\b/i.test(t)));
ok("nenhuma função recebe parâmetro do tipo linha de tabela", !/create or replace function [^(]+\([^)]*\binterno\.rede_[a-z_]+\b(?!\()/i.test(semComentario));
ok("não mexe na versão da Alumia, no install.sql nem em funções de outras frentes", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-300))
  && (sql.match(/create or replace function ([a-z_.]+)/g) ?? []).every((f) => /(rede_mapa|rede_ama)/.test(f)));
ok("os limites da tela são os do banco", sql.includes(`'titulo', ${L.tituloMin}, ${L.titulo})`) && sql.includes(`'texto', ${L.perguntaMin}, ${L.pergunta})`)
  && sql.includes(`'resposta', 1, ${L.resposta})`) && sql.includes(`v_min < ${L.minutosMin} or v_min > ${L.minutosMax}`) && sql.includes(`>= ${L.porCaixa} then perform interno.erro('muitos_pedidos')`)
  && sql.includes(`situacao = 'fila') >= ${L.esperandoPorPessoa}`) && sql.includes(`>= ${L.porSessao} then perform interno.erro('fila_cheia')`)
  && sql.includes(`now() + interval '${L.diasAdiante} days'`) && DURACOES.every((d) => d >= L.minutosMin && d <= L.minutosMax));
ok("os motivos da retirada da tela são os do banco", sql.includes(`motivo in (${MOTIVOS_DA_RETIRADA.map((m) => `'${m}'`).join(", ")})`));
ok("nenhum voto, nenhuma ordem por popularidade", !/\b(voto|votos|curtida|apoio_count|ranking)\b/i.test(semComentario));

// ═══════════════════ 1. O lugar e o desenho (regras puras) ═══════════════════
const CASOS = ["São Paulo", "São Paulo - SP", "sao paulo/sp", "Recife (PE)", "Recife, pe", "  Rio   de Janeiro ", "Olho D'Água das Flores", "Sento Sé", "Sento Sé - BA",
  "Bom Jesus", "Bom Jesus – PI", "Xique-Xique", "x", "", "Embu-Guaçu/sp", "Santa Rita do Pardo-MS", "Belém do São Francisco", "Paraty RJ", "Cidade - ZZ", "São Luís / MA"];
ok("lugar: UF escrita no fim sai do nome", JSON.stringify(lugarEscrito("São Paulo - SP")) === JSON.stringify({ nome: "sao paulo", uf: "SP" })
  && lugarEscrito("Recife (PE)")?.uf === "PE" && lugarEscrito("Sento Sé")?.uf === null && lugarEscrito("Sento Sé")?.nome === "sento se"
  && lugarEscrito("Cidade - ZZ")?.nome === "cidade zz" && lugarEscrito("x") === null && lugarEscrito("Olho D'Água das Flores")?.nome === "olho d agua das flores");

const malha = JSON.parse(ler("lib/rede/mapa/malha-brasil.json"));
const bruto = JSON.parse(ler("lib/rede/mapa/municipios.json"));
const indice = montarIndice(bruto);
ok("o desenho tem os 27 estados, cada um um caminho só de M, L e Z", Object.keys(malha.estados).sort().join() === [...UFS].sort().join()
  && Object.values(malha.estados).every((e) => /^(M[\d. L-]+Z)+$/.test(e.d) && e.centro.length === 2));
ok("o índice tem os 5.570 municípios do IBGE, em todas as UFs", indice.total === 5570 && Object.keys(bruto).sort().join() === [...UFS].sort().join());
ok("todo município cai dentro do desenho (com folga para Noronha)", [...indice.porNome.values()].flat().every((m) => m.x >= -10 && m.x <= 1075 && m.y >= -10 && m.y <= malha.altura + 10));
ok("cada capital é um município do índice na sua UF", Object.entries(CAPITAIS).every(([uf, nome]) => indice.porNome.get(nome)?.some((m) => m.uf === uf)));
ok("nome único: acha sem UF; nome repetido: só com UF, ou a capital", (() => {
  const sp = acharMunicipio(indice, "sao paulo", null);
  const rb = acharMunicipio(indice, "rio branco", null);
  const bj = acharMunicipio(indice, "bom jesus", null);
  const bjPi = acharMunicipio(indice, "bom jesus", "PI");
  const nenhum = acharMunicipio(indice, "vila que nao existe", null);
  const errado = acharMunicipio(indice, "sao paulo", "RJ");
  return sp.tipo === "municipio" && sp.municipio.uf === "SP" && rb.tipo === "municipio" && rb.municipio.uf === "AC" && bj.tipo === "varios" && bj.ufs.length >= 3
    && bjPi.tipo === "municipio" && bjPi.municipio.uf === "PI" && nenhum.tipo === "nenhum" && errado.tipo === "nenhum";
})());
ok("só um município termina numa sigla de UF (Sento Sé), e a regra o protege", [...indice.porNome.keys()].filter((k) => {
  const m = /^(.*?)[\s,/(–-]+([a-z]{2})\)?$/.exec(k);
  return m && UFS.includes(m[2].toUpperCase());
}).join() === "sento se" && acharMunicipio(indice, lugarEscrito("Sento Sé").nome, lugarEscrito("Sento Sé").uf).tipo === "municipio");
ok("o nome do IBGE na forma da chave", nomeNaChave("Olho D'Água das Flores") === "olho d agua das flores" && nomeNaChave("Embu-Guaçu") === "embu guacu");
ok("a tela desconfia do banco: número abaixo de 3 vira nulo, @ inválido sai", (() => {
  const m = limparMapa({ dias: 60, lugares: [{ nome: "sao paulo", uf: "XX", escrito: "", chamados: 2, chamados_ha: false, eventos: 7, eventos_ha: true, nucleos_ha: false,
    orgs: [{ handle: "lume", nome: "Lume" }, { handle: "Bad Handle!", nome: "x" }] }, { nome: "a" }] });
  const l = m.lugares[0];
  return m.lugares.length === 1 && l.uf === null && l.chamados === null && l.eventos === 7 && l.orgs.length === 1 && l.nucleos_ha && l.escrito === "sao paulo";
})());
ok("pontos: dois jeitos de escrever a mesma cidade viram um ponto; número só soma número", (() => {
  const base = { escrito: "x", chamados_ha: true, eventos: null, eventos_ha: false, nucleos_ha: false, orgs: [] };
  const { pontos, fora } = pontosDoMapa({ dias: 60, lugares: [
    { ...base, nome: "sao paulo", uf: null, chamados: 5 }, { ...base, nome: "sao paulo", uf: "SP", chamados: null },
    { ...base, nome: "recife", uf: null, chamados: null }, { ...base, nome: "recife", uf: "PE", chamados: null },
    { ...base, nome: "bom jesus", uf: null, chamados: null }, { ...base, nome: "lugar nenhum", uf: null, chamados: 4 },
  ] }, indice);
  const sp = pontos.find((p) => p.municipio.nome === "São Paulo");
  const re = pontos.find((p) => p.municipio.nome === "Recife");
  return pontos.length === 2 && sp.chamados === 5 && re.chamados === null && re.chamados_ha && fora.length === 2 && fora.some((f) => f.motivo === "varios") && fora.some((f) => f.motivo === "nenhum");
})());
ok("o ladrilho não distingue 1 de 2", (() => {
  const f = { chamados: true, eventos: true, nucleos: true };
  const p = (chamados, eventos) => ({ chamados, eventos, chamados_ha: true, eventos_ha: true, nucleos_ha: false });
  return tamanhoDoPonto(p(null, null), f) === 1 && tamanhoDoPonto(p(3, null), f) === 2 && tamanhoDoPonto(p(null, 12), f) === 3 && tamanhoDoPonto(p(12, null), { ...f, chamados: false }) === 1;
})());
ok("o zoom do estado fica na proporção do desenho", (() => {
  const c = enquadrar(caixaDoCaminho(malha.estados.DF.d), 1.05);
  return Math.abs(c[2] / c[3] - 1.05) < 0.03 && c[2] >= 40;
})());

// ═══════════════════ 2. As telas e os textos ═══════════════════
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  for (const pasta of ["mapa", "aovivo"]) {
    const pt = JSON.parse(ler(`i18n/rede/${pasta}/pt.json`));
    const base = formas(pt);
    for (const l of ["en", "es", "fr", "ru", "zh"]) {
      const j = JSON.parse(ler(`i18n/rede/${pasta}/${l}.json`));
      const outro = formas(j);
      const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
      ok(`${pasta}/${l}.json: mesmas chaves e marcadores do pt, marcado como rascunho ou revisado${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0 && (j._rascunho === true || !("_rascunho" in j)));
    }
    ok(`${pasta}: nenhum texto vazio no pt`, ![...base.values()].some((v) => v.endsWith(":vazio")));
    ok(`${pasta}: os textos não usam "diploma", "universidade" nem "algoritmo"`, ["pt", "en", "es", "fr", "ru", "zh"].every((l) => !/diploma|universidade|university|universidad|universit|algoritm|algorithm|алгоритм|算法/i.test(ler(`i18n/rede/${pasta}/${l}.json`))));
  }
  const pt = JSON.parse(ler("i18n/rede/aovivo/pt.json"));
  const codigos = [...new Set([...sql.matchAll(/interno\.erro\('([a-z_]+)(?::[a-z_]+)?'\)/g)].map((m) => m[1]))];
  ok(`todo erro da migração tem frase (${codigos.filter((c) => !pt.erros[c]).join(", ")})`, codigos.every((c) => typeof pt.erros[c] === "string"));
  ok("todo motivo de retirada tem nome", MOTIVOS_DA_RETIRADA.every((m) => typeof pt.moderar.motivos[m] === "string"));
  // As telas não carregam nada de fora (nem mapa, nem fonte, nem imagem): nenhum endereço http nos arquivos da frente.
  const telas = ["components/rede/mapa/TelaDoMapa.tsx", "components/rede/mapa/MapaDoBrasil.tsx", "components/rede/mapa/mapa.css", "components/rede/aovivo/SessaoAoVivo.tsx",
    "components/rede/aovivo/TelaAoVivo.tsx", "components/rede/aovivo/SessoesDaCaixa.tsx", "components/rede/aovivo/aovivo.css", "lib/rede/mapa/cliente.ts", "lib/rede/mapa/indice.ts"];
  ok("as telas do mapa e do ao vivo não chamam nada de fora", telas.every((f) => !/https?:\/\//.test(ler(f).replace(/^\s*(\/\/|\*).*$/gm, ""))));
  ok("nenhuma tela pede a posição do aparelho", telas.every((f) => !/geolocation|getCurrentPosition|watchPosition/.test(ler(f))));
  ok("as cores das telas só vêm dos tokens", ["components/rede/mapa/mapa.css", "components/rede/aovivo/aovivo.css"].every((f) => !/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i.test(ler(f).replace(/\/\*[\s\S]*?\*\//g, ""))));
}

// ═══════════════════ 3. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
// O install.sql inteiro de novo por cima: as definições finais (a R2 redefiniu funções desta migração) voltam a valer.
await espera("e o install.sql inteiro de novo por cima (as definições finais voltam)", () => banco.instalarDeNovo());
await banco.filiacaoDeTeste();
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
const PUBLICAS = ["rede_mapa", "rede_ama_marcar", "rede_ama_convite", "rede_ama_cancelar", "rede_ama_lista", "rede_ama", "rede_ama_perguntar", "rede_ama_responder", "rede_ama_retirar", "rede_ama_agenda"];
await espera("toda função pública nova passa pela porta", async () =>
  (await dono("select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)", [PUBLICAS])).rows,
(rs) => rs.length === PUBLICAS.length && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
await espera("visitante só lê: mapa, lista, sessão e agenda", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)`, [PUBLICAS])).rows,
(rs) => rs.every((r) => r.b && r.a === ["rede_mapa", "rede_ama_lista", "rede_ama", "rede_ama_agenda"].includes(r.proname)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => um("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t]),
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas novas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and (p.proname like 'rede\\_ama\\_%' or p.proname = 'rede_mapa_lugar')`)).rows,
(rs) => rs.length >= 6 && rs.every((r) => !r.a && !r.b));
await espera("nenhuma função nova recebe parâmetro do tipo linha (o Supabase barra o ALTER TABLE depois)", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('public', 'interno') and (p.proname like 'rede\\_ama%' or p.proname like 'rede\\_mapa%')
                 and exists (select 1 from unnest(p.proargtypes) t join pg_type ty on ty.oid = t where ty.typtype = 'c')`)).rows,
(rs) => rs.length === 0);
await espera("a regra do lugar do banco é a mesma da tela", async () => {
  const r = await um("select array_agg(to_jsonb(interno.rede_mapa_lugar(x)) order by i) as a from unnest($1::text[]) with ordinality t(x, i)", [CASOS]);
  return r.a.map((v, i) => [CASOS[i], v, lugarEscrito(CASOS[i])]).filter(([, banco, tela]) => JSON.stringify(banco) !== JSON.stringify(tela ? [tela.nome, tela.uf] : null));
}, (difs) => difs.length === 0);

const P = {};
const NOMES = ["dona", "mod", "conv", "m1", "m2", "m3", "m4", "m5", "bloq", "org", "org2", "orgsem"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o13.local`, nome);
  await rpc(como(P[nome]), "eu");
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const [i, nome] of NOMES.entries()) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_18 = true, rede_consentimento = 1, rede_handle = $3 where id = $1", [P[nome], `Codinome ${i + 1}`, `${nome}_o13`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
const A = (n) => como(P[n]);
const semPessoas = (r, menos = []) => { const s = JSON.stringify(r); return !Object.entries(P).filter(([k]) => !menos.includes(k)).some(([, id]) => s.includes(id)); };

// ═══════════════════ 4. O mapa ═══════════════════
let n = 0;
async function chamado(autor, cidade, tipo, publico, extra = "") {
  const id = (await um("insert into interno.rede_posts (autor, tipo, texto, publico) values ($1, 'chamado', $2, $3) returning id", [P[autor], `Chamado ${++n}`, publico])).id;
  await dono(`insert into interno.rede_chamados (post, inicio, cidade, ponto, tipo${extra ? ", situacao" : ""}) values ($1, now() + interval '2 days', $2, 'Praça', $3${extra ? ", $4" : ""})`,
    extra ? [id, cidade, tipo, extra] : [id, cidade, tipo]);
  return id;
}
for (let i = 0; i < 3; i++) await chamado("m1", i === 2 ? "São Paulo - SP" : "São Paulo", "ato", "internet");
await chamado("m2", "São Paulo", "mutirao", "membros");
await chamado("m2", "São Paulo", "assembleia", "internet");
await chamado("m3", "Recife/PE", "ato", "internet");
await chamado("m3", "Recife/PE", "roda", "internet");
await chamado("m3", "Recife/PE", "aula", "internet");
await chamado("m3", "Recife/PE", "outro", "membros");
await chamado("m4", "Cancelada", "ato", "internet", "cancelado");
{
  const velho = await chamado("m4", "Passado", "ato", "internet");
  await dono("update interno.rede_chamados set inicio = now() - interval '2 days' where post = $1", [velho]);
}
// Organizações: uma com selo e núcleo no mapa (com 4 pessoas: chama plena), uma com selo e núcleo fora do mapa, uma sem selo.
await dono("update interno.perfis set rede_handle = 'lume_o13', rede_codinome = 'Coletivo Lume' where id = $1", [P.org]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra, documento_tipo, verificada_em) values ($1, 'coletivo', 'Recife', 'LUME', 'CNPJ', now()), ($2, 'coletivo', 'Natal', 'BRASA', 'CNPJ', now())", [P.org, P.org2]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'coletivo', 'Natal', 'SEM')", [P.orgsem]);
const nucleo = async (org, cidade, uf, noMapa) => {
  const id = (await um("insert into interno.rede_nucleos (nome, org, org_cidade, org_uf, org_no_mapa) values ($1, $2, $3, $4, $5) returning id", [`Núcleo ${++n}`, P[org], cidade, uf, noMapa])).id;
  // Filiação de teste (scripts/banco-local.mjs, filiacaoDeTeste): o assunto aqui não é quem é do núcleo.
  for (const m of ["m1", "m2", "m3", "m4"]) await dono("insert into interno.teste_nucleo_membros (nucleo, usuario, entrou_em) values ($1, $2, now() - interval '2 hours')", [id, P[m]]);
};
await nucleo("org", "Recife", "PE", true);
await nucleo("org", "Olinda", "PE", true);
await nucleo("org2", "Natal", "RN", false);
await nucleo("orgsem", "Natal", "RN", true);
await dono("delete from interno.limites");

const lugarDe = (r, nome, uf) => r.lugares.find((l) => l.nome === nome && l.uf === uf);
await espera("membro: São Paulo com 4 chamados (ato e mutirão) e evento abaixo de 3 sem número", () => rpc(A("dona"), "rede_mapa"), (r) => {
  const sp = lugarDe(r, "sao paulo", null);
  const sp2 = lugarDe(r, "sao paulo", "SP");
  return r.dias === 60 && sp.chamados === 3 && sp.chamados_ha && sp.eventos === null && sp.eventos_ha && !sp.nucleos_ha && sp2.chamados === null && sp2.chamados_ha;
});
// Depois da R2 (membros escondidos) o servidor não sabe quantas pessoas há num núcleo: o "chama" do núcleo (interno.alumia_chama, que
// pedia 3 pessoas) não fica pleno, e o núcleo sai do mapa. Decisão registrada para o dono (o mapa dos núcleos).
await espera("membro: Recife com 3 eventos, chamado abaixo de 3; o núcleo não aparece (o servidor não sabe quantos há nele)", () => rpc(A("dona"), "rede_mapa"), (r) => {
  const re = lugarDe(r, "recife", "PE");
  return re.eventos === 3 && re.chamados === null && re.chamados_ha && !re.nucleos_ha && re.orgs.length === 0 && !("nucleos" in re);
});
await espera("o núcleo fora do mapa e o da organização sem selo não aparecem; cancelado e passado não contam", () => rpc(A("dona"), "rede_mapa"),
  (r) => !r.lugares.some((l) => l.nome === "natal" || l.nome === "cancelada" || l.nome === "passado") && !lugarDe(r, "olinda", "PE"));
await espera("nenhuma pessoa na resposta do mapa (só a organização)", () => rpc(A("dona"), "rede_mapa"), (r) => semPessoas(r, ["org"]));
// Fora das comunidades das disciplinas, "internet" vale como "membros" (interno.rede2_publico): o visitante não vê esses chamados.
await espera("visitante: só o que é público na internet (aqui, nada: os núcleos saíram do mapa com a R2)", () => rpc(visitante(), "rede_mapa"), (r) => {
  return !lugarDe(r, "sao paulo", null) && !lugarDe(r, "sao paulo", "SP") && !lugarDe(r, "recife", "PE") && semPessoas(r, ["org"]);
});
await espera("quem foi bloqueado pela organização não vê a organização no mapa", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.org, P.bloq]);
  return rpc(A("bloq"), "rede_mapa");
}, (r) => !lugarDe(r, "olinda", "PE") && !(lugarDe(r, "recife", "PE")?.orgs ?? []).length);

// ═══════════════════ 5. Ao vivo ═══════════════════
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('moradia-o13', 'Moradia', 'lutas', 'aberta', 'membros'), ('quimica-o13', 'Química', 'disciplinas', 'aberta', 'internet') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('moradia-o13', $1, 'moderacao'), ('quimica-o13', $1, 'moderacao') on conflict do nothing`, [P.mod]);
await dono("delete from interno.limites");
const daqui = (min) => new Date(Date.now() + min * 60e3).toISOString();

await recusa("começo em menos de 10 minutos", () => rpc(A("dona"), "rede_ama_marcar", { p_slug: null, p: { titulo: "Pergunte à dona", inicio: daqui(5) } }), "invalido:inicio");
await recusa("duração fora de 15 a 180", () => rpc(A("dona"), "rede_ama_marcar", { p_slug: null, p: { titulo: "Pergunte à dona", inicio: daqui(60), minutos: 240 } }), "invalido:minutos");
await recusa("título com telefone", () => rpc(A("dona"), "rede_ama_marcar", { p_slug: null, p: { titulo: "Liga (11) 98888-7777", inicio: daqui(60) } }), "dado_pessoal");
const pessoal = await espera("a dona marca a própria sessão (já sai marcada)", () => rpc(A("dona"), "rede_ama_marcar", { p_slug: null, p: { titulo: "Pergunte à dona da caixa", inicio: daqui(60), minutos: 60 } }),
  (r) => r.situacao === "marcada");
await recusa("quem não modera não marca na comunidade", () => rpc(A("m1"), "rede_ama_marcar", { p_slug: "moradia-o13", p: { titulo: "Sessão", inicio: daqui(60), convidada: "conv_o13" } }), "sem_permissao");
await recusa("convidada que não existe", () => rpc(A("mod"), "rede_ama_marcar", { p_slug: "moradia-o13", p: { titulo: "Sessão", inicio: daqui(60), convidada: "ninguem_o13" } }), "invalido:convidada");
const conv = await espera("a moderação marca e convida: sai como convite", () => rpc(A("mod"), "rede_ama_marcar", { p_slug: "moradia-o13", p: { titulo: "Moradia ao vivo", inicio: daqui(30), minutos: 30, convidada: "@conv_o13" } }),
  (r) => r.situacao === "convite");
await espera("o convite não guarda quem marcou", () => um("select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_ama'"),
  (r) => r.c === "id,dono,comunidade,convidada,titulo,inicio,fim,situacao,criado_em");
await espera("a convidada recebe um aviso", () => um("select count(*)::int n from interno.avisos where para = $1 and texto like '%convite%'", [P.conv]), (r) => r.n === 1);
await espera("sem aceite, quem é de fora não vê a sessão", () => rpc(A("m1"), "rede_ama_lista", { p_slug: "moradia-o13" }), (r) => r.sessoes.length === 0 && !r.cuida);
await recusa("nem pelo id", () => rpc(A("m1"), "rede_ama", { p_id: conv.id }), "nao_encontrado");
await espera("a moderação vê o convite esperando", () => rpc(A("mod"), "rede_ama_lista", { p_slug: "moradia-o13" }), (r) => r.cuida && r.sessoes.length === 1 && r.sessoes[0].situacao === "convite");
await espera("a convidada vê o convite na agenda", () => rpc(A("conv"), "rede_ama_agenda"), (r) => r.convites.length === 1 && r.convites[0].id === conv.id);
await recusa("outra pessoa não aceita por ela", () => rpc(A("m1"), "rede_ama_convite", { p_id: conv.id, p_aceita: true }), "nao_encontrado");
await espera("a convidada aceita", () => rpc(A("conv"), "rede_ama_convite", { p_id: conv.id, p_aceita: true }), (r) => r.situacao === "marcada");
await espera("agora quem é da Alumia vê, com o nome da convidada", () => rpc(A("m1"), "rede_ama_lista", { p_slug: "moradia-o13" }),
  (r) => r.sessoes.length === 1 && r.sessoes[0].convidada.handle === "conv_o13" && r.sessoes[0].momento === "antes" && r.sessoes[0].perguntas === null);

await recusa("a convidada não pergunta na própria sessão", () => rpc(A("conv"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "Posso perguntar?" }), "invalido:propria");
await recusa("pergunta com e-mail", () => rpc(A("m1"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "Me escreve: fulana@exemplo.org" }), "dado_pessoal");
const q1 = await espera("pergunta antes do começo entra na fila", () => rpc(A("m1"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "Como começar a assembleia?", p_mostrar_nome: true }), (r) => !!r.id);
const q2 = await espera("outra pessoa pergunta, sem mostrar o nome", () => rpc(A("m2"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "Quanto tempo antes avisar?" }), (r) => !!r.id);
const q3 = await espera("uma terceira", () => rpc(A("m3"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "E o síndico, pode proibir?" }), (r) => !!r.id);
for (let i = 0; i < 3; i++) await rpc(A("m4"), "rede_ama_perguntar", { p_id: conv.id, p_texto: `Pergunta extra número ${i + 1}` }).catch(() => undefined);
await recusa("no máximo 3 esperando por pessoa", () => rpc(A("m4"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "Mais uma, a quarta" }), "muitos_pedidos");
await espera("a sessão mostra as perguntas na ordem de chegada, com o nome só de quem quis, sem ninguém dentro", () => rpc(A("m5"), "rede_ama", { p_id: conv.id }), (r) =>
  r.lista.length === 6 && r.lista[0].id === q1.id && r.lista[1].id === q2.id && r.lista[0].quem === "Codinome 4" && r.lista[1].quem === null && r.vez === q1.id
  && r.perguntas === 6 && r.pode_perguntar && r.lista.every((q) => !("votos" in q)) && semPessoas(r, ["conv"]));
await espera("quem perguntou vê a própria marcada como sua", () => rpc(A("m2"), "rede_ama", { p_id: conv.id }), (r) => r.lista.filter((q) => q.minha).map((q) => q.id).join() === q2.id);
await recusa("a ordem não muda (gatilho)", () => dono("update interno.rede_ama_perguntas set criado_em = now() - interval '1 day' where id = $1", [q3.id]), "fila_fixa");
await recusa("o texto não muda (gatilho)", () => dono("update interno.rede_ama_perguntas set texto = 'Outro texto qualquer' where id = $1", [q3.id]), "fila_fixa");
await recusa("antes do começo a convidada não responde", () => rpc(A("conv"), "rede_ama_responder", { p_pergunta: q1.id, p_resposta: "Cedo demais" }), "fora_do_horario");

// Põe a sessão no ar (o relógio do teste anda).
await dono("update interno.rede_ama set inicio = now() - interval '5 minutes', fim = now() + interval '25 minutes' where id = $1", [conv.id]);
await recusa("só a convidada responde", () => rpc(A("mod"), "rede_ama_responder", { p_pergunta: q1.id, p_resposta: "Eu respondo" }), "nao_encontrado");
await recusa("a convidada não pula a fila", () => rpc(A("conv"), "rede_ama_responder", { p_pergunta: q2.id, p_resposta: "Pulando" }), "fora_da_vez");
await espera("a convidada responde a da vez", () => rpc(A("conv"), "rede_ama_responder", { p_pergunta: q1.id, p_resposta: "Com cartaz no elevador, duas semanas antes." }), (r) => r.situacao === "respondida");
await espera("quem perguntou recebe aviso, sem nome de ninguém", () => um("select texto from interno.avisos where para = $1 order by criado_em desc limit 1", [P.m1]),
  (r) => /respondida ao vivo/.test(r.texto) && !/Codinome/.test(r.texto));
await espera("e passa a seguinte", () => rpc(A("conv"), "rede_ama_responder", { p_pergunta: q2.id, p_resposta: null }), (r) => r.situacao === "passada");
await recusa("retirar com motivo fora da lista", () => rpc(A("mod"), "rede_ama_retirar", { p_pergunta: q3.id, p_motivo: "chata" }), "invalido:motivo");
await recusa("quem não cuida não retira a dos outros", () => rpc(A("m1"), "rede_ama_retirar", { p_pergunta: q3.id, p_motivo: "ofensa" }), "nao_encontrado");
await espera("a moderação retira com motivo", () => rpc(A("mod"), "rede_ama_retirar", { p_pergunta: q3.id, p_motivo: "fora_do_tema" }), (r) => r.retirada);
await espera("a retirada aparece sem o texto, com o motivo; a vez anda", () => rpc(A("m5"), "rede_ama", { p_id: conv.id }), (r) => {
  const q = r.lista.find((x) => x.id === q3.id);
  return q.situacao === "retirada" && q.texto === null && q.motivo === "fora_do_tema" && r.lista[0].resposta && r.lista[1].situacao === "passada" && r.vez === r.lista[3].id && r.momento === "ao_vivo";
});
await espera("quem perguntou tira a própria que espera", async () => {
  const s = await rpc(A("m4"), "rede_ama", { p_id: conv.id });
  const minha = s.lista.filter((q) => q.minha && q.situacao === "fila").at(-1);
  await rpc(A("m4"), "rede_ama_retirar", { p_pergunta: minha.id });
  return (await um("select count(*)::int n from interno.rede_ama_perguntas where id = $1", [minha.id])).n;
}, (n) => n === 0);
await espera("a agenda mostra a sessão no ar", () => rpc(A("m5"), "rede_ama_agenda"), (r) => r.ao_vivo.some((s) => s.id === conv.id) && r.convites.length === 0);
await espera("bloqueio com a convidada esconde a sessão", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.bloq, P.conv]);
  return rpc(A("bloq"), "rede_ama_agenda");
}, (r) => !r.ao_vivo.some((s) => s.id === conv.id));

// Acaba a sessão: depois de um dia, o banco esquece quem perguntou; o nome que a pessoa quis mostrar fica.
await dono("update interno.rede_ama set inicio = now() - interval '2 days', fim = now() - interval '2 days' + interval '30 minutes' where id = $1", [conv.id]);
await recusa("acabou: não recebe pergunta", () => rpc(A("m5"), "rede_ama_perguntar", { p_id: conv.id, p_texto: "Ainda dá tempo?" }), "travado");
await espera("acabou: quem perguntou é esquecido, o nome escolhido fica", async () => {
  const s = await rpc(A("m5"), "rede_ama", { p_id: conv.id });
  const resto = await um("select count(*) filter (where quem is not null)::int as com from interno.rede_ama_perguntas where ama = $1", [conv.id]);
  return { s, resto };
}, ({ s, resto }) => resto.com === 0 && s.momento === "encerrada" && s.lista[0].quem === "Codinome 4" && !s.pode_perguntar);
await recusa("acabou há mais de uma hora: a convidada não responde mais", async () => {
  const s = await rpc(A("conv"), "rede_ama", { p_id: conv.id });
  return rpc(A("conv"), "rede_ama_responder", { p_pergunta: s.vez, p_resposta: "Tarde" });
}, "fora_do_horario");

// Visitante: só a da comunidade aberta das disciplinas; a pessoal pede conta.
const quim = await rpc(A("mod"), "rede_ama_marcar", { p_slug: "quimica-o13", p: { titulo: "Química ao vivo", inicio: daqui(120), convidada: "mod_o13" } });
await espera("quem modera e convida a si mesma já sai marcada", () => um("select situacao from interno.rede_ama where id = $1", [quim.id]), (r) => r.situacao === "marcada");
await espera("visitante vê a sessão da comunidade aberta", () => rpc(visitante(), "rede_ama_lista", { p_slug: "quimica-o13" }), (r) => r.sessoes.length === 1 && !r.cuida);
await recusa("visitante não pergunta", () => rpc(visitante(), "rede_ama_perguntar", { p_id: quim.id, p_texto: "Posso perguntar sem conta?" }), "permission denied");
await recusa("visitante não vê caixa de pessoa", () => rpc(visitante(), "rede_ama_lista", { p_handle: "dona_o13" }), "entre_primeiro");
await espera("quem tem conta vê a sessão pessoal da dona", () => rpc(A("m1"), "rede_ama_lista", { p_handle: "dona_o13" }), (r) => r.sessoes.length === 1 && r.sessoes[0].id === pessoal.id);
await recusa("quem perguntou na comunidade e foi banido não pergunta", async () => {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('quimica-o13', $1, 'banido') on conflict (comunidade, usuario) do update set situacao = 'banido'", [P.m2]);
  return rpc(A("m2"), "rede_ama_perguntar", { p_id: quim.id, p_texto: "Banida pergunta?" });
}, "sem_permissao");

// Limites e cancelamento.
for (let i = 0; i < 2; i++) await rpc(A("dona"), "rede_ama_marcar", { p_slug: null, p: { titulo: `Outra sessão ${i}`, inicio: daqui(300 + i * 200) } });
await recusa("no máximo 3 sessões por vir em cada caixa", () => rpc(A("dona"), "rede_ama_marcar", { p_slug: null, p: { titulo: "A quarta", inicio: daqui(900) } }), "muitos_pedidos");
await rpc(A("m1"), "rede_ama_perguntar", { p_id: pessoal.id, p_texto: "Pergunta que vai sumir" });
await recusa("quem é de fora não cancela", () => rpc(A("m1"), "rede_ama_cancelar", { p_id: pessoal.id }), "nao_encontrado");
await espera("a dona cancela: as perguntas somem junto", async () => {
  await rpc(A("dona"), "rede_ama_cancelar", { p_id: pessoal.id });
  return um("select (select situacao from interno.rede_ama where id = $1) s, (select count(*)::int from interno.rede_ama_perguntas where ama = $1) n", [pessoal.id]);
}, (r) => r.s === "cancelada" && r.n === 0);
await espera("a tabela das perguntas não guarda endereço de rede", () => um("select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_ama_perguntas'"),
  (r) => r.c === "id,ama,seq,quem,nome,texto,situacao,resposta,motivo,criado_em,respondida_em");

// ═══════════════════ 5b. Desligado no painel ═══════════════════
// A variável de montagem só esconde a tela; com a decisão "desligado" no painel (interno.recursos_vivos), o banco também recusa.
const painel = (nome, ligado) => dono("insert into interno.recursos_vivos (nome, ligado) values ($1, $2) on conflict (nome) do update set ligado = $2", [nome, ligado]);
await espera("sem decisão no painel, vale a montagem: o mapa responde", () => rpc(visitante(), "rede_mapa"), (r) => Array.isArray(r?.lugares));
await espera("\"alumia-mapa\" desligado no painel: o mapa recusa, a quem tem conta e ao visitante", async () => {
  await painel("alumia-mapa", false);
  const r = [await rpc(A("dona"), "rede_mapa").then(() => "passou", (e) => e.message), await rpc(visitante(), "rede_mapa").then(() => "passou", (e) => e.message)];
  await dono("delete from interno.recursos_vivos where nome = 'alumia-mapa'");
  return r;
}, (r) => r.every((e) => e.includes("desligado")));
await espera("\"alumia-ao-vivo\" desligado no painel: a agenda e a lista vêm vazias; sessão, perguntar e marcar recusam", async () => {
  await painel("alumia-ao-vivo", false);
  const agenda = await rpc(A("m5"), "rede_ama_agenda");
  const lista = await rpc(A("mod"), "rede_ama_lista", { p_handle: null, p_slug: "quimica-o13" });
  const erros = [];
  for (const [f, a] of [["rede_ama", { p_id: quim.id }], ["rede_ama_perguntar", { p_id: quim.id, p_texto: "Com o painel desligado" }],
    ["rede_ama_marcar", { p_slug: null, p: { titulo: "Sessão desligada", inicio: new Date(Date.now() + 86400e3).toISOString(), minutos: 30 } }]]) {
    erros.push(await rpc(A("m5"), f, a).then(() => "passou", (e) => e.message));
  }
  await dono("delete from interno.recursos_vivos where nome = 'alumia-ao-vivo'");
  return { agenda, lista, erros };
}, (r) => r.agenda.ao_vivo.length === 0 && r.agenda.proximas.length === 0 && r.agenda.convites.length === 0 && r.lista.sessoes.length === 0 && r.erros.every((e) => e.includes("desligado")));
await espera("a Alumia nova desligada no painel também fecha o mapa", async () => {
  await painel("alumia-2", false);
  const r = await rpc(A("dona"), "rede_mapa").then(() => "passou", (e) => e.message);
  await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");
  return r;
}, (r) => r.includes("desligado"));

// ═══════════════════ 6. A porta com a trava ligada ═══════════════════
await espera("com a trava ligada, conta não aprovada não usa nada daqui", async () => {
  await dono("select interno.alumia_entrada_ligar(true)");
  const novata = await criarUsuario("novata@o13.local", "novata");
  const erros = [];
  for (const [f, a] of [["rede_mapa", {}], ["rede_ama_agenda", {}], ["rede_ama_perguntar", { p_id: quim.id, p_texto: "Novata pergunta" }]]) {
    erros.push(await rpc(como(novata), f, a).then(() => "passou", (e) => e.message));
  }
  await dono("select interno.alumia_entrada_ligar(false)");
  return erros;
}, (es) => es.every((e) => e.includes("alumia_entrada")));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
