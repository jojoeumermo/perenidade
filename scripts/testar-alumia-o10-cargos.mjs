// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova cargos e chegada da onda 10 (supabase/migracoes/20261116-alumia-o10-cargos.sql) num Postgres de verdade
// (scripts/banco-local.mjs), com a migração rodada TRÊS vezes sobre o install.sql:
//   · cargo SEM a permissão não passa em nenhuma das funções que ela libera (a conferência é no banco); convite não aceito não
//     vale; cada permissão libera só as funções dela; cargo nenhum cria cargo, convida ou nomeia; sair da comunidade tira o cargo;
//   · ninguém fora da moderação vê quem tem cargo: só o número, a partir de 3;
//   · a etiqueta da pessoa só da lista fechada, a oferecida só depois do aceite, e nenhuma função diz quem tem uma etiqueta;
//   · as boas-vindas chegam num aviso, e a escolha dos interesses não vem ao banco;
//   · regras antes de postar: o banco barra o post sem o aceite, de novo quando as regras mudam, e a moderação passa;
//   · o prazo do fixado: o post sai do alto sozinho, com a linha no registro de moderação;
//   · as listas da tela (components/rede/comunidades/cargos/regras.ts) iguais às do banco, e os textos nas seis línguas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o10-cargos.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { chaveDosInteresses, diasAte, escolhidosQueExistem, fimDoPrazo, LIMITES, limparHandle, PERMISSOES, PRAZO_MAXIMO_DIAS, PRAZOS_DO_FIXADO } from "../components/rede/comunidades/cargos/regras.ts";

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
const sql = ler("supabase/migracoes/20261116-alumia-o10-cargos.sql");
const PURAS = /(alumia_o10_permissoes|alumia_o10_permissao_texto|alumia_o10_interesses)\(/;
ok("toda função nova é security definer com search_path fixo (menos as puras, que não leem tabela)", (() => {
  const funcoes = sql.match(/create or replace function [^(]+\([\s\S]*?\$\$/g) ?? [];
  return funcoes.length >= 30 && funcoes.every((f) => /security definer set search_path = interno, pg_temp/.test(f) || PURAS.test(f.split("\n")[0]));
})());
const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
ok("as tabelas novas nascem com RLS e sem permissão para anon e authenticated", tabelas.length === 7
  && tabelas.every((t) => sql.includes(`alter table interno.${t} enable row level security`)) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("nenhuma tabela guarda endereço de rede", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /\b(inet|cidr|endereco|ip|porta)\b/.test(t)));
ok("nenhuma tabela guarda os interesses escolhidos por alguém", !(sql.match(/create table if not exists interno\.[a-z_]+ \([\s\S]*?\n\);/g) ?? []).some((t) => /interesse/.test(t) && /usuario\s+uuid/.test(t)));
ok("não mexe na versão da Alumia, no install.sql e termina passando a porta em tudo", !/function public\.rede_alumia_versao/.test(sql) && /interno\.alumia_trancar\(\)/.test(sql.slice(-500)));
ok("a lista de permissões da tela é a do banco (regra da tabela e função)", (() => {
  const lista = PERMISSOES.map((p) => `'${p}'`).join(", ");
  return sql.includes(`permissoes <@ array[${lista}]::text[]`) && sql.includes(`select array[${lista}]::text[]`);
})());
ok("os limites da tela são os do banco", sql.includes(`char_length(nome) between ${LIMITES.cargoNomeMin} and ${LIMITES.cargoNome}`)
  && sql.includes(`char_length(descricao) <= ${LIMITES.cargoDescricao}`) && sql.includes(`char_length(nome) between ${LIMITES.etiquetaMin} and ${LIMITES.etiqueta}`)
  && sql.includes(`char_length(boas_vindas) <= ${LIMITES.boasVindas}`) && sql.includes(`jsonb_array_length(interesses) <= ${LIMITES.interesses}`)
  && sql.includes(`'interesses', ${LIMITES.interesseNomeMin}, ${LIMITES.interesseNome}`) && sql.includes(`'interesses', 0, ${LIMITES.interesseTexto}`)
  && sql.includes(`>= ${LIMITES.cargos} then perform interno.erro('invalido:limite_de_cargos')`) && sql.includes(`jsonb_array_length(p) > ${LIMITES.etiquetas}`)
  && sql.includes(`interval '${PRAZO_MAXIMO_DIAS} days'`));
ok("os prazos do fixado cabem no do banco (1 hora a 180 dias)", PRAZOS_DO_FIXADO.every((d) => d === null || (d >= 1 && d <= PRAZO_MAXIMO_DIAS)));
ok("cada função refeita confere a permissão certa", [
  ["rede_com_pedidos", "pedidos"], ["rede_com_decidir_pedido", "pedidos"], ["alumia_com_pedidos", "pedidos"], ["alumia_com_perguntas_salvar", "pedidos"],
  ["rede_com_regras_salvar", "regras"], ["rede_com_etiquetas_salvar", "etiquetas"], ["rede_com_fixar", "fixar"],
].every(([f, p]) => new RegExp(`function public\\.${f}\\([\\s\\S]*?alumia_o10_pode\\(c\\.slug, v, '${p}'\\)[\\s\\S]*?end \\$\\$;`).test(sql)));

// ═══════════════════ 0b. As contas da tela ═══════════════════
ok("o @nome limpo como o banco procura", limparHandle("  @@Maria_Luta ") === "maria_luta" && limparHandle("@") === "");
ok("o fim do prazo em dias, dentro do teto", (() => {
  const agora = Date.UTC(2026, 10, 16, 12);
  return fimDoPrazo(null, agora) === null && fimDoPrazo(7, agora) === new Date(agora + 7 * 86_400_000).toISOString()
    && fimDoPrazo(999, agora) === new Date(agora + PRAZO_MAXIMO_DIAS * 86_400_000).toISOString();
})());
ok("dias até o prazo, arredondado para cima", (() => {
  const agora = Date.UTC(2026, 10, 16, 12);
  return diasAte(null, agora) === null && diasAte(new Date(agora - 1).toISOString(), agora) === 0 && diasAte(new Date(agora + 1.2 * 86_400_000).toISOString(), agora) === 2;
})());
ok("interesses escolhidos que a comunidade tirou somem da escolha", JSON.stringify(escolhidosQueExistem(["a", "b", "a", "z"], [{ chave: "a", nome: "", texto: "" }, { chave: "b", nome: "", texto: "" }])) === '["a","b"]');
ok("a escolha mora numa chave da Alumia (o Sair rápido apaga junto)", chaveDosInteresses("moradia").startsWith("lucia:rede:"));

// Os textos: as seis línguas com as mesmas chaves, listas do mesmo tamanho e os mesmos marcadores {x}; nenhuma palavra proibida.
{
  const formas = (v, p = "", out = new Map()) => {
    if (Array.isArray(v)) { out.set(p, `lista:${v.length}`); v.forEach((x, i) => formas(x, `${p}[${i}]`, out)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "_rascunho") formas(x, p ? `${p}.${k}` : k, out); }
    else out.set(p, typeof v === "string" ? `texto:${(v.match(/\{\w+\}/g) ?? []).sort().join()}${v.trim() ? "" : ":vazio"}` : typeof v);
    return out;
  };
  const pt = JSON.parse(ler("i18n/rede/cargos/pt.json"));
  const base = formas(pt);
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const outro = formas(JSON.parse(ler(`i18n/rede/cargos/${l}.json`)));
    const dif = [...base].filter(([k, v]) => outro.get(k) !== v).map(([k]) => k).concat([...outro.keys()].filter((k) => !base.has(k)));
    ok(`cargos/${l}.json tem as mesmas chaves, listas e marcadores do pt${dif.length ? ` (difere em ${dif.slice(0, 4).join(", ")})` : ""}`, dif.length === 0);
  }
  ok("o rótulo da aba no encaixe é o \"aba\" de cada língua", (() => {
    const enc = ler("components/rede/comunidades/cargos/encaixe.tsx");
    return ["pt", "en", "es", "fr", "ru", "zh"].every((l) => enc.includes(`${l}: ${JSON.stringify(JSON.parse(ler(`i18n/rede/cargos/${l}.json`)).aba)}`));
  })());
  ok("nenhum texto vazio no pt", ![...base.values()].some((v) => v.endsWith(":vazio")));
  ok("os textos não usam \"diploma\", \"universidade\" nem \"algoritmo\"", !/diploma|universidade|algoritmo/i.test(JSON.stringify(pt)));
  ok("toda permissão tem nome e explicação", PERMISSOES.every((p) => typeof pt.permissoes[p]?.nome === "string" && typeof pt.permissoes[p]?.texto === "string"));
  ok("todo erro novo do banco tem texto", ["leia_as_regras", "sem_permissao", "invalido:pessoa", "invalido:nome_repetido", "invalido:limite_de_cargos", "invalido:prazo", "generico"].every((c) => typeof pt.erros[c] === "string"));
}

// ═══════════════════ 1. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: `198.51.100.${ip++ % 250}` });
const visitante = { papel: "anon", ip: "203.0.113.10" };
const zerar = () => dono("delete from interno.limites");

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("e uma terceira vez sem estrago", () => exec(sql));
await espera("a regra da porta não deixa nenhuma função aberta", async () => (await dono("select interno.alumia_trancar() as r")).rows[0].r, (r) => r.abertas.length === 0);
await espera("toda função pública nova ou refeita passa pela porta", async () =>
  (await dono(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
               and (p.proname like 'alumia\\_cargos\\_%' or p.proname = any (array['rede_com_pedidos', 'rede_com_decidir_pedido', 'alumia_com_pedidos', 'alumia_com_perguntas_salvar', 'rede_com_regras_salvar', 'rede_com_etiquetas_salvar', 'rede_com_fixar']))`)).rows,
(rs) => rs.length === 24 && rs.every((r) => /interno\.alumia_porta\(\)/.test(r.prosrc)));
for (const t of tabelas) {
  await espera(`${t}: RLS ligada e nenhuma política`, async () => (await dono("select c.relrowsecurity as r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) as n from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0],
    (r) => r.r === true && r.n === 0);
}
await espera("as funções internas não abrem para anon nem para quem tem conta", async () =>
  (await dono(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as a, has_function_privilege('authenticated', p.oid, 'execute') as b
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'alumia\\_o10\\_%'`)).rows,
(rs) => rs.length >= 10 && rs.every((r) => !r.a && !r.b)); // o prefixo alumia_o10_ é de todas as frentes da onda 10: depois da junta são mais
await espera("nenhuma função pública devolve quem tem uma etiqueta ou um cargo pelo nome dele", async () =>
  (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'alumia\\_cargos\\_%' and p.proname ~ '(quem|lista_de|pessoas|membros)'`)).rows,
(rs) => rs.length === 0);

const P = {};
const NOMES = ["coord", "mod", "sec", "form", "acolhe", "membro", "membro2", "membro3", "membro4", "fora", "pede1", "pede2"];
for (const nome of NOMES) {
  P[nome] = await criarUsuario(`${nome}@o10.local`, `Pessoa ${nome}`);
  await rpc(como(P[nome]), "eu");
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
await dono("delete from interno.papeis");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
for (const nome of NOMES) {
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Codinome ${nome}`, `o10_${nome}`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '60 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('o10-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('o10-restrita', 'Restrita do teste', 'lutas', 'restrita', 'membros'),
  ('o10-outra', 'Outra do teste', 'lutas', 'aberta', 'membros') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('o10-moradia', $1, 'moderacao'), ('o10-moradia', $2, 'membro'), ('o10-moradia', $3, 'membro'), ('o10-moradia', $4, 'membro'),
  ('o10-moradia', $5, 'membro'), ('o10-moradia', $6, 'membro'), ('o10-moradia', $7, 'membro'), ('o10-moradia', $8, 'membro'),
  ('o10-restrita', $1, 'moderacao'), ('o10-restrita', $2, 'membro'), ('o10-outra', $2, 'membro')`,
  [P.mod, P.sec, P.form, P.acolhe, P.membro, P.membro2, P.membro3, P.membro4]);
await dono("insert into interno.rede_comunidade_regras (comunidade, numero, titulo, texto) values ('o10-moradia', 1, 'Respeito sempre', 'Sem ataque pessoal.') on conflict do nothing");

const M = como(P.mod);
const S = () => como(P.sec);
const postar = (quem, texto, extra = {}) => rpc(como(P[quem]), "rede_publicar", { p: { texto, ...extra } });
// Post direto na tabela com a sessão da pessoa (os gatilhos rodam com auth.uid() dela), sem os filtros gerais de rede_publicar.
const inserir = (quem, texto, comunidade = null) => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
  return (await tx.query("insert into interno.rede_posts (autor, texto, comunidade) values ($1, $2, $3) returning id", [P[quem], texto, comunidade])).rows[0].id;
}));
const avisosDe = async (quem, trecho) => (await dono("select texto from interno.avisos where para = $1 and texto like $2", [P[quem], `%${trecho}%`])).rows.map((r) => r.texto);

// Um post fixável e um pedido esperando, para provar as funções de cada permissão.
const postA = (await postar("membro", "Mutirão de sábado na ocupação.", { comunidade: "o10-moradia" })).id;
const postB = (await postar("membro2", "Assembleia na quarta, 19h.", { comunidade: "o10-moradia" })).id;
await rpc(como(P.pede1), "rede_com_entrar", { p_slug: "o10-restrita" });

// Cada função que uma permissão libera, chamada por quem: devolve a promessa da chamada.
const TENTATIVAS = {
  pedidos: [
    ["rede_com_pedidos", (q, slug = "o10-moradia") => rpc(q, "rede_com_pedidos", { p_slug: slug })],
    ["alumia_com_pedidos", (q, slug = "o10-moradia") => rpc(q, "alumia_com_pedidos", { p_slug: slug })],
    ["alumia_com_perguntas_salvar", (q, slug = "o10-moradia") => rpc(q, "alumia_com_perguntas_salvar", { p_slug: slug, p_perguntas: [] })],
  ],
  regras: [
    ["rede_com_regras_salvar", (q) => rpc(q, "rede_com_regras_salvar", { p_slug: "o10-moradia", p_regras: [{ titulo: "Respeito sempre", texto: "Sem ataque pessoal." }] })],
    ["alumia_cargos_chegada_salvar (regras_antes)", (q) => rpc(q, "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { regras_antes: false } })],
  ],
  boas_vindas: [
    ["alumia_cargos_chegada_salvar (boas_vindas)", (q) => rpc(q, "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { boas_vindas: "" } })],
  ],
  etiquetas: [
    ["rede_com_etiquetas_salvar", (q) => rpc(q, "rede_com_etiquetas_salvar", { p_slug: "o10-moradia", p_etiquetas: [{ nome: "Dúvida", cor: "" }] })],
    ["alumia_cargos_etiquetas_salvar", async (q) => rpc(q, "alumia_cargos_etiquetas_salvar", { p_slug: "o10-moradia", p: (await rpc(M, "alumia_cargos_painel", { p_slug: "o10-moradia" })).etiquetas })],
    ["alumia_cargos_etiqueta_tirar", (q) => rpc(q, "alumia_cargos_etiqueta_tirar", { p_slug: "o10-moradia", p_handle: "o10_fora" })],
  ],
  fixar: [
    ["rede_com_fixar", (q) => rpc(q, "rede_com_fixar", { p_slug: "o10-moradia", p_post: postA, p_sim: true })],
  ],
};
async function provarSo(nome, quem, liberadas) {
  for (const [perm, lista] of Object.entries(TENTATIVAS)) {
    for (const [f, chamar] of lista) {
      await zerar();
      if (liberadas.includes(perm)) await espera(`${nome}: ${f} passa (tem "${perm}")`, () => chamar(quem));
      else await recusa(`${nome}: ${f} não passa (sem "${perm}")`, () => chamar(quem), "sem_permissao");
    }
  }
}

// ═══════════════════ 2. Ninguém de fora da moderação mexe ═══════════════════
await provarSo("membro comum, sem cargo", como(P.membro), []);
await recusa("membro comum não cria cargo", () => rpc(como(P.membro), "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Secretaria", permissoes: ["pedidos"] } }), "sem_permissao");
await recusa("decidir pedido sem a permissão", () => rpc(como(P.membro), "rede_com_decidir_pedido", { p_slug: "o10-restrita", p_usuario: P.pede1, p_aceita: true }), "sem_permissao");

// ═══════════════════ 3. A moderação cria cargos com a lista fechada ═══════════════════
await zerar();
await recusa("permissão fora da lista é recusada", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Xerife", permissoes: ["banir"] } }), "invalido:permissoes");
await recusa("campo desconhecido é recusado", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Xerife", poder: "tudo" } }), "invalido:cargo");
await recusa("nome curto demais", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "X" } }), "invalido:nome");
const vazio = await espera("cargo sem permissão nenhuma (só o nome)", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Acolhida", descricao: "Recebe quem chega." } }),
  (r) => r.permissoes.length === 0);
const sec = await espera("cargo Secretaria com pedidos e boas-vindas (repetida some)", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Secretaria", permissoes: ["pedidos", "boas_vindas", "pedidos"] } }),
  (r) => JSON.stringify(r.permissoes) === '["pedidos","boas_vindas"]');
const form = await espera("cargo Formação com fixar", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Formação", permissoes: ["fixar"] } }), (r) => r.permissoes[0] === "fixar");
const tudo = await espera("cargo Comissão com todas as permissões", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Comissão", permissoes: [...PERMISSOES] } }), (r) => r.permissoes.length === 5);
await recusa("nome repetido (sem olhar maiúsculas)", () => rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "SECRETARIA" } }), "invalido:nome_repetido");
await recusa("convidar quem não é da comunidade", () => rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: sec.id, p_handle: "@o10_fora" }), "invalido:pessoa");
await recusa("convidar @nome que não existe", () => rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: sec.id, p_handle: "@ninguem_aqui" }), "invalido:pessoa");
await espera("convidar pelo @nome: fica convidado e a pessoa é avisada", async () => {
  const r = await rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: sec.id, p_handle: "@O10_Sec" });
  return { r, avisos: await avisosDe("sec", "convidou você para o cargo") };
}, ({ r, avisos }) => r.situacao === "convidado" && avisos.length === 1 && avisos[0].includes("aceitar pedidos de entrada"));
await espera("convidar de novo não duplica", () => rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: sec.id, p_handle: "o10_sec" }), (r) => r.situacao === "convidado");

await provarSo("a moderação da comunidade", M, [...PERMISSOES]);
await provarSo("a coordenação (cuida da comunidade em geral)", como(P.coord), [...PERMISSOES]);

// ═══════════════════ 4. Convite não aceito não vale nada ═══════════════════
await espera("convidar para o cargo com tudo, sem aceitar", () => rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: tudo.id, p_handle: "o10_membro4" }));
await provarSo("convidada para o cargo com tudo, sem aceitar", como(P.membro4), []);
await espera("ela recusa e o convite some", () => rpc(como(P.membro4), "alumia_cargos_responder", { p_cargo: tudo.id, p_aceita: false }), (r) => r.situacao === null);
await recusa("responder de novo não acha convite", () => rpc(como(P.membro4), "alumia_cargos_responder", { p_cargo: tudo.id, p_aceita: true }), "nao_encontrado");

// ═══════════════════ 5. Cargo sem permissão não passa ═══════════════════
await espera("cargo vazio aceito", async () => {
  await rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: vazio.id, p_handle: "o10_acolhe" });
  return rpc(como(P.acolhe), "alumia_cargos_responder", { p_cargo: vazio.id, p_aceita: true });
}, (r) => r.situacao === "ativo");
await provarSo("cargo aceito SEM permissão nenhuma", como(P.acolhe), []);

// ═══════════════════ 6. Cada permissão libera só as funções dela ═══════════════════
await espera("a Secretaria aceita o convite", () => rpc(S(), "alumia_cargos_responder", { p_cargo: sec.id, p_aceita: true }), (r) => r.situacao === "ativo");
await provarSo("Secretaria (pedidos e boas-vindas)", S(), ["pedidos", "boas_vindas"]);
await recusa("pedidos de outra comunidade continuam fechados para a Secretaria", () => rpc(S(), "rede_com_pedidos", { p_slug: "o10-restrita" }), "sem_permissao");
await espera("Formação aceita", async () => {
  await rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: form.id, p_handle: "o10_form" });
  return rpc(como(P.form), "alumia_cargos_responder", { p_cargo: form.id, p_aceita: true });
}, (r) => r.situacao === "ativo");
await provarSo("Formação (fixar)", como(P.form), ["fixar"]);
await espera("a Formação dá prazo ao fixado", () => rpc(como(P.form), "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postA, p_ate: new Date(Date.now() + 3 * 86_400_000).toISOString() }), (r) => r.post === postA && r.ate);
await recusa("a Secretaria não dá prazo ao fixado", () => rpc(S(), "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postA, p_ate: null }), "sem_permissao");
for (const quem of ["sec", "form"]) {
  await recusa(`${quem}: cargo não cria cargo`, () => rpc(como(P[quem]), "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: null, p: { nome: "Outro cargo" } }), "sem_permissao");
  await recusa(`${quem}: cargo não convida`, () => rpc(como(P[quem]), "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: sec.id, p_handle: "o10_membro" }), "sem_permissao");
  await recusa(`${quem}: cargo não tira ninguém de cargo`, () => rpc(como(P[quem]), "alumia_cargos_tirar", { p_slug: "o10-moradia", p_cargo: form.id, p_usuario: P.form }), "sem_permissao");
  await recusa(`${quem}: cargo não apaga cargo`, () => rpc(como(P[quem]), "alumia_cargos_apagar", { p_slug: "o10-moradia", p_id: vazio.id }), "sem_permissao");
}
await espera("a Secretaria decide um pedido de entrada (aceita) da comunidade dela", async () => {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ('o10-moradia', $1, 'membro', 'pendente') on conflict do nothing", [P.pede2]);
  return rpc(S(), "rede_com_decidir_pedido", { p_slug: "o10-moradia", p_usuario: P.pede2, p_aceita: true });
}, (r) => r.ok === true);

// ═══════════════════ 7. Mudar as permissões vale na hora; sair tira o cargo ═══════════════════
await zerar();
await espera("a moderação tira 'pedidos' da Secretaria e quem tem o cargo é avisado", async () => {
  await rpc(M, "alumia_cargos_salvar", { p_slug: "o10-moradia", p_id: sec.id, p: { nome: "Secretaria", permissoes: ["boas_vindas"] } });
  return avisosDe("sec", "pode fazer em");
}, (a) => a.length === 1);
await recusa("na hora, a Secretaria já não lê os pedidos", () => rpc(S(), "rede_com_pedidos", { p_slug: "o10-moradia" }), "sem_permissao");
await espera("conta suspensa: o cargo não vale", async () => {
  await dono("update interno.perfis set suspenso = true where id = $1", [P.form]);
  try {
    await rpc(como(P.form), "rede_com_fixar", { p_slug: "o10-moradia", p_post: postB, p_sim: true });
    return "passou";
  } catch (e) {
    return String(e.message);
  } finally {
    await dono("update interno.perfis set suspenso = false where id = $1", [P.form]);
  }
}, (r) => r !== "passou");
await espera("quem sai da comunidade perde o cargo (e a permissão)", async () => {
  await rpc(como(P.form), "rede_com_sair", { p_slug: "o10-moradia" });
  return (await dono("select count(*)::int as n from interno.alumia_cargo_pessoas where usuario = $1", [P.form])).rows[0].n;
}, (n) => n === 0);
await recusa("e não fixa mais nada", () => rpc(como(P.form), "rede_com_fixar", { p_slug: "o10-moradia", p_post: postB, p_sim: true }), "sem_permissao");
await espera("quem tem cargo deixa quando quer", async () => {
  await rpc(como(P.acolhe), "alumia_cargos_deixar", { p_cargo: vazio.id });
  return (await dono("select count(*)::int as n from interno.alumia_cargo_pessoas where usuario = $1", [P.acolhe])).rows[0].n;
}, (n) => n === 0);

// ═══════════════════ 8. O que se vê dos cargos ═══════════════════
await espera("o pedido novo avisa também quem tem 'pedidos' (e não só a moderação)", async () => {
  await rpc(M, "alumia_cargos_salvar", { p_slug: "o10-restrita", p_id: null, p: { nome: "Portaria", permissoes: ["pedidos"] } });
  const k = (await rpc(M, "alumia_cargos_painel", { p_slug: "o10-restrita" })).cargos[0];
  await rpc(M, "alumia_cargos_convidar", { p_slug: "o10-restrita", p_cargo: k.id, p_handle: "o10_sec" });
  await rpc(S(), "alumia_cargos_responder", { p_cargo: k.id, p_aceita: true });
  await rpc(como(P.pede2), "rede_com_entrar", { p_slug: "o10-restrita" });
  return avisosDe("sec", "entrar em “Restrita do teste” esperando quem cuida dos pedidos");
}, (a) => a.length === 1);
await espera("três pessoas com o cargo Comissão", async () => {
  for (const q of ["membro", "membro2", "membro3"]) {
    await rpc(M, "alumia_cargos_convidar", { p_slug: "o10-moradia", p_cargo: tudo.id, p_handle: `o10_${q}` });
    await rpc(como(P[q]), "alumia_cargos_responder", { p_cargo: tudo.id, p_aceita: true });
  }
  return true;
});
const doMembro = await espera("quem não modera vê os cargos, o que podem e quantas pessoas (só a partir de 3), e nunca quem", () => rpc(como(P.membro4), "alumia_cargos_painel", { p_slug: "o10-moradia" }),
  (r) => r.modero === false && r.permissoes.length === 0 && r.cargos.length === 4
    && r.cargos.find((k) => k.nome === "Comissão").pessoas === 3 && r.cargos.find((k) => k.nome === "Secretaria").pessoas === null
    && r.gestao.pessoas === undefined && !["membro", "membro2", "membro3", "sec"].some((n) => JSON.stringify(r).includes(P[n]) || JSON.stringify(r).includes(`o10_${n}`)));
ok("o painel do membro não traz a contagem de pedidos nem os fixados", doMembro && doMembro.gestao.pedidos === undefined && doMembro.gestao.fixados === undefined);
await espera("visitante lê os cargos de uma comunidade aberta das disciplinas, sem ninguém", async () => {
  await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('o10-disc', 'Disciplina do teste', 'disciplinas', 'aberta', 'internet') on conflict do nothing");
  return rpc(visitante, "alumia_cargos_painel", { p_slug: "o10-disc" });
}, (r) => r.cargos.length === 0 && r.situacao === null && r.precisa_ler === false);
await espera("a moderação vê quem tem cada cargo, para poder tirar", () => rpc(M, "alumia_cargos_painel", { p_slug: "o10-moradia" }),
  (r) => r.modero && r.permissoes.length === 5 && r.gestao.pessoas.some((x) => x.usuario === P.membro && x.situacao === "ativo") && typeof r.gestao.pedidos === "number");
await espera("quem tem a Comissão (fixar e pedidos) vê os fixados e os pedidos, mas não quem tem cargo", () => rpc(como(P.membro), "alumia_cargos_painel", { p_slug: "o10-moradia" }),
  (r) => r.permissoes.length === 5 && Array.isArray(r.gestao.fixados) && typeof r.gestao.pedidos === "number" && r.gestao.pessoas === undefined
    && r.meus_cargos.some((k) => k.nome === "Comissão" && k.situacao === "ativo"));
await espera("a moderação tira alguém do cargo e ele é avisado", async () => {
  await rpc(M, "alumia_cargos_tirar", { p_slug: "o10-moradia", p_cargo: tudo.id, p_usuario: P.membro3 });
  return avisosDe("membro3", "decisão da moderação");
}, (a) => a.length === 1);
await espera("apagar um cargo avisa quem o tinha", async () => {
  await rpc(M, "alumia_cargos_apagar", { p_slug: "o10-moradia", p_id: vazio.id });
  return (await dono("select count(*)::int as n from interno.alumia_cargos where id = $1", [vazio.id])).rows[0].n;
}, (n) => n === 0);

// ═══════════════════ 9. Etiqueta da pessoa: lista fechada, aceite e nenhuma lista de quem tem ═══════════════════
await zerar();
const etiquetas = await espera("a moderação escreve a lista fechada", () => rpc(M, "alumia_cargos_etiquetas_salvar", { p_slug: "o10-moradia", p: [
  { nome: "Moradora", quem_da: "pessoa" }, { nome: "Professora", quem_da: "pessoa" }, { nome: "Advogada popular", quem_da: "moderacao" }] }),
(r) => r.length === 3 && r[2].quem_da === "moderacao");
const [moradora, professora, advogada] = etiquetas ?? [];
await recusa("nome repetido na lista", () => rpc(M, "alumia_cargos_etiquetas_salvar", { p_slug: "o10-moradia", p: [{ nome: "Moradora" }, { nome: "moradora" }] }), "invalido:nome_repetido");
await recusa("quem_da desconhecido", () => rpc(M, "alumia_cargos_etiquetas_salvar", { p_slug: "o10-moradia", p: [{ nome: "Moradora", quem_da: "qualquer" }] }), "invalido:etiquetas");
await recusa("etiqueta que não é da lista não existe (texto livre não passa)", () => rpc(como(P.membro4), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: "00000000-0000-4000-8000-000000000000" }), "nao_encontrado");
await recusa("quem não é da comunidade não escolhe etiqueta", () => rpc(como(P.fora), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: moradora.id }), "sem_permissao");
await espera("a pessoa escolhe a própria etiqueta", () => rpc(como(P.membro4), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: moradora.id }), (r) => r.etiqueta.nome === "Moradora");
await espera("e troca (fica uma só)", async () => {
  await rpc(como(P.membro4), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: professora.id });
  return (await dono("select count(*)::int as n from interno.alumia_etiqueta_de where usuario = $1 and situacao = 'vale'", [P.membro4])).rows[0].n;
}, (n) => n === 1);
await recusa("a que só a moderação dá não se escolhe sozinha", () => rpc(como(P.membro2), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: advogada.id }), "sem_permissao");
await recusa("só se oferece a que a moderação dá", () => rpc(M, "alumia_cargos_etiqueta_oferecer", { p_slug: "o10-moradia", p_etiqueta: moradora.id, p_handle: "o10_membro2" }), "invalido:etiqueta");
await recusa("quem não tem 'etiquetas' não oferece", () => rpc(S(), "alumia_cargos_etiqueta_oferecer", { p_slug: "o10-moradia", p_etiqueta: advogada.id, p_handle: "o10_membro2" }), "sem_permissao");
await espera("a moderação oferece; a pessoa é avisada; a oferta ainda não aparece em post nenhum", async () => {
  await rpc(M, "alumia_cargos_etiqueta_oferecer", { p_slug: "o10-moradia", p_etiqueta: advogada.id, p_handle: "o10_membro2" });
  return { avisos: await avisosDe("membro2", "ofereceu a você a etiqueta"), nos: await rpc(como(P.membro4), "alumia_cargos_etiquetas_dos_posts", { p_posts: [postB] }) };
}, ({ avisos, nos }) => avisos.length === 1 && nos.length === 0);
await espera("a oferta aparece só para ela, no painel dela", () => rpc(como(P.membro2), "alumia_cargos_painel", { p_slug: "o10-moradia" }), (r) => r.ofertas.length === 1 && r.ofertas[0].nome === "Advogada popular" && r.minha_etiqueta === null);
await espera("ela aceita, e a etiqueta aparece nos posts dela daquela comunidade", async () => {
  await rpc(como(P.membro2), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: advogada.id });
  return rpc(como(P.membro4), "alumia_cargos_etiquetas_dos_posts", { p_posts: [postA, postB] });
}, (r) => r.length === 1 && r[0].post === postB && r[0].etiqueta === "Advogada popular");
await espera("fora daquela comunidade, a etiqueta não aparece", async () => {
  const fora = (await postar("membro2", "Post na outra comunidade.", { comunidade: "o10-outra" })).id;
  return rpc(como(P.membro4), "alumia_cargos_etiquetas_dos_posts", { p_posts: [fora] });
}, (r) => r.length === 0);
await espera("o painel de ninguém traz quem tem uma etiqueta", async () => [await rpc(M, "alumia_cargos_painel", { p_slug: "o10-moradia" }), await rpc(como(P.membro), "alumia_cargos_painel", { p_slug: "o10-moradia" })],
  (rs) => rs.every((r) => !JSON.stringify(r).includes(P.membro4) && !JSON.stringify(r).includes("o10_membro4")));
await recusa("mais de 100 posts de uma vez", () => rpc(como(P.membro4), "alumia_cargos_etiquetas_dos_posts", { p_posts: Array.from({ length: 101 }, () => postA) }), "invalido:posts");
await espera("a moderação tira a etiqueta de alguém, que é avisada", async () => {
  await rpc(M, "alumia_cargos_etiqueta_tirar", { p_slug: "o10-moradia", p_handle: "@o10_membro2" });
  return { avisos: await avisosDe("membro2", "tirou a sua etiqueta"), nos: await rpc(como(P.membro4), "alumia_cargos_etiquetas_dos_posts", { p_posts: [postB] }) };
}, ({ avisos, nos }) => avisos.length === 1 && nos.length === 0);
await espera("a pessoa tira a própria etiqueta", async () => {
  await rpc(como(P.membro4), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: null });
  return (await dono("select count(*)::int as n from interno.alumia_etiqueta_de where usuario = $1", [P.membro4])).rows[0].n;
}, (n) => n === 0);
await espera("tirar uma etiqueta da lista tira de quem a tinha", async () => {
  await rpc(como(P.membro4), "alumia_cargos_etiqueta_escolher", { p_slug: "o10-moradia", p_etiqueta: moradora.id });
  await rpc(M, "alumia_cargos_etiquetas_salvar", { p_slug: "o10-moradia", p: [{ id: professora.id, nome: "Professora", quem_da: "pessoa" }] });
  return (await dono("select count(*)::int as n from interno.alumia_etiqueta_de where usuario = $1", [P.membro4])).rows[0].n;
}, (n) => n === 0);

// ═══════════════════ 10. Boas-vindas e interesses ═══════════════════
await zerar();
await recusa("interesse repetido", () => rpc(S(), "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { interesses: [{ nome: "Estudar" }, { nome: "estudar" }] } }), "invalido:nome_repetido");
await recusa("mais de 8 interesses", () => rpc(S(), "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { interesses: Array.from({ length: 9 }, (_, i) => ({ nome: `Interesse ${i}` })) } }), "invalido:interesses");
await recusa("chave desconhecida", () => rpc(S(), "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { quem_escolheu: [] } }), "invalido:chegada");
await espera("a Secretaria (boas-vindas) escreve as boas-vindas e os interesses", () => rpc(S(), "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: {
  boas_vindas: "Que bom ter você na luta pela moradia. Leia as regras e se apresente.",
  interesses: [{ nome: "Estudar", texto: "Comece pela cartilha da wiki." }, { nome: "Ir aos mutirões", texto: "Todo sábado, 9h." }] } }),
(r) => r.interesses.length === 2 && r.interesses.every((i) => /^[0-9a-f]{10}$/.test(i.chave)) && r.boas_vindas.startsWith("Que bom"));
await espera("a chave do interesse sai do nome (estável quando se reescreve)", async () => {
  const a = (await rpc(S(), "alumia_cargos_painel", { p_slug: "o10-moradia" })).chegada.interesses[0].chave;
  const r = await rpc(S(), "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { interesses: [{ nome: "Ir aos mutirões", texto: "Sábado." }, { nome: "Estudar", texto: "Cartilha." }] } });
  return r.interesses[1].chave === a;
}, (x) => x === true);
await espera("quem entra numa comunidade aberta recebe as boas-vindas num aviso", async () => {
  await rpc(como(P.fora), "rede_com_entrar", { p_slug: "o10-moradia" });
  return avisosDe("fora", "Boas-vindas a");
}, (a) => a.length === 1 && a[0].includes("Que bom ter você"));
await espera("pedido aceito também recebe as boas-vindas", async () => {
  await rpc(M, "alumia_cargos_chegada_salvar", { p_slug: "o10-restrita", p: { boas_vindas: "Boas-vindas à restrita." } });
  await rpc(M, "rede_com_decidir_pedido", { p_slug: "o10-restrita", p_usuario: P.pede1, p_aceita: true });
  return avisosDe("pede1", "Boas-vindas à restrita");
}, (a) => a.length === 1);
await espera("o banco não tem onde guardar a escolha de interesses de ninguém", async () =>
  (await dono("select table_name from information_schema.columns where table_schema = 'interno' and table_name like 'alumia\\_%' and column_name = 'usuario' and table_name ~ 'interesse'")).rows,
(rs) => rs.length === 0);

// ═══════════════════ 11. Regras antes de postar ═══════════════════
await zerar();
await recusa("a Secretaria (sem 'regras') não liga as regras antes", () => rpc(S(), "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { regras_antes: true } }), "sem_permissao");
await espera("a moderação liga", () => rpc(M, "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { regras_antes: true } }), (r) => r.regras_antes === true);
await espera("a tela pergunta antes: precisa aceitar", () => rpc(como(P.membro4), "alumia_cargos_regras_para_postar", { p_slug: "o10-moradia" }), (r) => r.precisa === true);
await recusa("o banco barra o post de quem não aceitou", () => inserir("membro4", "Quero falar do despejo.", "o10-moradia"), "leia_as_regras");
await recusa("e a resposta também", () => postar("membro4", "Concordo.", { resposta_a: postA }), "leia_as_regras");
await espera("quem modera passa", () => inserir("mod", "Aviso da moderação.", "o10-moradia"));
await espera("fora da comunidade nada muda", () => inserir("membro4", "Post solto, sem comunidade."));
await espera("a pessoa aceita as regras", () => rpc(como(P.membro4), "alumia_cargos_regras_aceitar", { p_slug: "o10-moradia" }), (r) => Boolean(r.lidas_em));
await espera("e posta", () => inserir("membro4", "Agora sim: quero falar do despejo.", "o10-moradia"));
await espera("o painel diz que ela já aceitou", () => rpc(como(P.membro4), "alumia_cargos_painel", { p_slug: "o10-moradia" }), (r) => r.precisa_ler === false && r.regras_lidas_em && r.regras.length === 1);
await espera("as regras mudam: o aceite antigo não vale mais", async () => {
  await dono("update interno.alumia_regras_lidas set lidas_em = now() - interval '1 hour' where usuario = $1", [P.membro4]);
  await dono("update interno.alumia_chegada set regras_em = now() - interval '2 hours' where comunidade = 'o10-moradia'");
  await rpc(M, "rede_com_regras_salvar", { p_slug: "o10-moradia", p_regras: [{ titulo: "Respeito sempre", texto: "" }, { titulo: "Nada de dado pessoal", texto: "" }] });
  return rpc(como(P.membro4), "alumia_cargos_regras_para_postar", { p_slug: "o10-moradia" });
}, (r) => r.precisa === true);
await recusa("e o banco barra de novo", () => inserir("membro4", "Mais uma.", "o10-moradia"), "leia_as_regras");
await espera("sair da comunidade apaga o aceite", async () => {
  await rpc(como(P.membro4), "rede_com_sair", { p_slug: "o10-moradia" });
  return (await dono("select count(*)::int as n from interno.alumia_regras_lidas where usuario = $1", [P.membro4])).rows[0].n;
}, (n) => n === 0);
await rpc(M, "alumia_cargos_chegada_salvar", { p_slug: "o10-moradia", p: { regras_antes: false } });
await espera("desligado, ninguém precisa aceitar", () => rpc(como(P.membro3), "alumia_cargos_regras_para_postar", { p_slug: "o10-moradia" }), (r) => r.precisa === false);

// ═══════════════════ 12. Prazo do fixado ═══════════════════
await zerar();
await recusa("prazo curto demais (menos de 1 hora)", () => rpc(M, "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postA, p_ate: new Date(Date.now() + 60_000).toISOString() }), "invalido:prazo");
await recusa("prazo longo demais (mais de 180 dias)", () => rpc(M, "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postA, p_ate: new Date(Date.now() + 200 * 86_400_000).toISOString() }), "invalido:prazo");
await recusa("post que não está fixado não ganha prazo", () => rpc(M, "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postB, p_ate: new Date(Date.now() + 86_400_000).toISOString() }), "nao_encontrado");
await espera("o painel de quem fixa mostra o prazo", () => rpc(M, "alumia_cargos_painel", { p_slug: "o10-moradia" }), (r) => r.gestao.fixados.some((f) => f.post === postA && f.ate));
await espera("passou o prazo: o post sai do alto sozinho, com a linha no registro", async () => {
  await dono("update interno.alumia_fixado_prazo set ate = now() - interval '1 minute' where post = $1", [postA]);
  const n = (await dono("select interno.alumia_o10_vencer_fixados(null) as n")).rows[0].n;
  const p = (await dono("select fixado from interno.rede_posts where id = $1", [postA])).rows[0];
  const reg = (await dono("select quem, motivo from interno.rede_moderacao where alvo = $1 and motivo like '%prazo do fixado venceu%'", [String(postA)])).rows;
  return { n, p, reg };
}, ({ n, p, reg }) => n === 1 && p.fixado === false && reg.length === 1 && reg[0].quem === null);
await espera("a leitura da aba também tira os vencidos", async () => {
  await rpc(M, "rede_com_fixar", { p_slug: "o10-moradia", p_post: postB, p_sim: true });
  await rpc(M, "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postB, p_ate: new Date(Date.now() + 2 * 3_600_000).toISOString() });
  await dono("update interno.alumia_fixado_prazo set ate = now() - interval '1 minute' where post = $1", [postB]);
  await rpc(como(P.membro), "alumia_cargos_painel", { p_slug: "o10-moradia" });
  return (await dono("select fixado from interno.rede_posts where id = $1", [postB])).rows[0].fixado;
}, (f) => f === false);
await espera("soltar o fixado tira o prazo junto", async () => {
  await rpc(M, "rede_com_fixar", { p_slug: "o10-moradia", p_post: postA, p_sim: true });
  await rpc(M, "alumia_cargos_fixar_prazo", { p_slug: "o10-moradia", p_post: postA, p_ate: new Date(Date.now() + 86_400_000).toISOString() });
  await rpc(M, "rede_com_fixar", { p_slug: "o10-moradia", p_post: postA, p_sim: false });
  return (await dono("select count(*)::int as n from interno.alumia_fixado_prazo where post = $1", [postA])).rows[0].n;
}, (n) => n === 0);

// ═══════════════════ 13. Nada de endereço de rede ═══════════════════
await espera("nenhuma coluna nova guarda endereço", async () =>
  (await dono("select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)", [tabelas])).rows,
(rs) => rs.length > 0 && !rs.some((c) => c.data_type === "inet" || /(^|_)(ip|endereco|porta)($|_)/.test(c.column_name)));

if (falhas.length) {
  console.error(`\n${falhas.length} falha(s), ${certos} certo(s):`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`cargos e chegada (onda 10): ${certos} conferências certas.`);
process.exit(0);
