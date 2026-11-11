// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o B1 dos stories (supabase/migracoes/20261110-alumia-b1-stories.sql) num Postgres de verdade dentro do Node, pelo MESMO
// cliente que a tela usa (lib/rede/cliente-stories.ts): o cartão do post e do ato no story ("Pôr no story"), a caixa de respostas
// e a resposta publicada sem nome, as reações só a partir de 3, as figurinhas novas (decorativa, "vou", pessoa, #campanha e a
// corrente), a roda de confiança (um infiltrado que segue de volta NÃO vê), o público "só esta comunidade", os destaques
// arrumáveis (ordem, capa, trocar a foto pela borrada), as legendas e a música do vídeo, e a migração rodando duas vezes.
// Também as contas puras da música, das legendas e do recorte (lib/rede/stories/*).
// Uso: npm run testar:alumia-b1-stories
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { criarClienteDeStories } from "../lib/rede/cliente-stories.ts";

let certos = 0;
const falhas = [];
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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ═══════════════════ 1. Contas puras (sem banco) ═══════════════════
{
  const { MUSICAS, gerarMusica } = await import("../lib/rede/stories/musica.ts");
  const { legendaNoTempo, limparLegendas, partesDoVideo } = await import("../lib/rede/stories/legendas.ts");
  const { recorteValido, PROPORCOES } = await import("../lib/rede/stories/recorte.ts");
  ok("as músicas são as 4 da lista fechada (o banco aceita as mesmas)", MUSICAS.map((m) => m.id).join() === "batucada,marcha,ciranda,tambor");
  const amostras = gerarMusica("batucada", 8000, 2);
  ok("a música é gerada no aparelho, sem arquivo de fora, e não estoura", amostras.length === 16000 && amostras.every((x) => Math.abs(x) <= 1) && amostras.some((x) => x !== 0));
  ok("a mesma música sai igual (sem sorteio que mude a cada vez)", gerarMusica("marcha", 8000, 1).join() === gerarMusica("marcha", 8000, 1).join());
  const leg = limparLegendas([{ de: 2000, ate: 1000, texto: "x" }, { de: 0, ate: 1500, texto: "  oi  " }, { de: 500, ate: 90_000, texto: "longo" }, { de: 3000, ate: 4000, texto: "" }], 10_000);
  ok("as legendas: tira a vazia e a de tempo invertido, corta no fim do vídeo e ordena", leg.length === 2 && leg[0].texto === "oi" && leg[1].ate === 10_000);
  ok("a legenda certa no tempo", legendaNoTempo(leg, 300)?.texto === "oi" && legendaNoTempo(leg, 20_000) === null);
  ok("vídeo de 150 s vira 3 partes de até 60 s", JSON.stringify(partesDoVideo(150_000)) === JSON.stringify([{ inicio: 0, fim: 60_000 }, { inicio: 60_000, fim: 120_000 }, { inicio: 120_000, fim: 150_000 }]));
  ok("sobra curta junta na parte anterior (sem story de meio segundo)", partesDoVideo(60_400).length === 1);
  const r = recorteValido({ x: -1, y: 0.5, largura: 2, altura: 0.2 });
  ok("o recorte fica dentro da foto e com tamanho mínimo", r.x === 0 && r.largura === 1 && r.altura >= 0.2 && r.y + r.altura <= 1);
  ok("as proporções do recorte incluem a do story (9:16) e a livre", PROPORCOES.some((p) => p.id === "9:16") && PROPORCOES.some((p) => p.id === "livre"));
}

// ═══════════════════ 2. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;

await banco.exclusivo(() => banco.pg.exec(`
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text,
    owner_id text default (auth.uid())::text, created_at timestamptz not null default now(), metadata jsonb, unique (bucket_id, name));
  create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, delete on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
`));

const MIGRACAO = "supabase/migracoes/20261110-alumia-b1-stories.sql";
ok("a migração está colada inteira no fim do install.sql", ler("supabase/install.sql").includes(ler(MIGRACAO).trim()));
await espera("a F5 e a de vídeo instalam (com o depósito)", () => banco.exclusivo(async () => {
  await banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f5.sql"));
  await banco.pg.exec(ler("supabase/migracoes/20261110-alumia-stories-video.sql"));
}));
await espera("o B1 instala por cima", () => banco.exclusivo(() => banco.pg.exec(ler(MIGRACAO))));
await espera("e de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(ler(MIGRACAO))));
await espera("as tabelas novas têm RLS e nenhuma permissão direta", () => todos(`select c.relname, c.relrowsecurity,
    has_table_privilege('authenticated', c.oid, 'select') as sel, has_table_privilege('anon', c.oid, 'select') as anon
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('rede_roda', 'rede_story_mencao_aviso')`),
(l) => l.length === 2 && l.every((x) => x.relrowsecurity && !x.sel && !x.anon));
await espera("as funções novas são security definer com search_path fechado", () => todos(`select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('rede_story_post', 'rede_story_respostas', 'rede_story_caixa', 'rede_roda', 'rede_roda_mudar', 'rede_story_destaque_ordem',
  'rede_story_destaque_ordenar', 'rede_story_destaque_capa', 'rede_story_trocar_midia', 'rede_story_da_comunidade', 'rede_story_responder_pergunta')`),
(l) => l.length === 11 && l.every((x) => x.prosecdef && String(x.proconfig).includes("search_path=interno, pg_temp")));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

const P = {};
const nomes = ["autora", "amiga", "infiltrado", "membro", "bloqueado", "mod", "v1", "v2", "v3"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@b1.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Lutadora ${i + 1}`, `${nome}_b1`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
// O infiltrado segue a autora e ela segue de volta (o "proximos" antigo deixava ele ver); a amiga também segue.
for (const nome of ["amiga", "infiltrado", "bloqueado", "v1", "v2", "v3"]) await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P[nome], P.autora]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($1, $3)", [P.autora, P.infiltrado, P.amiga]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.autora, P.bloqueado]);
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('passe-livre', 'Passe Livre', 'lutas', 'aberta'), ('nucleo-leste', 'Núcleo Leste', 'lutas', 'fechada')`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario) values ('passe-livre', $1), ('nucleo-leste', $1), ('nucleo-leste', $2)`, [P.autora, P.amiga]);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('passe-livre', $1, 'moderacao')`, [P.mod]);

const cliente = (sub) =>
  criarClienteDeStories((f, a) => rpc(sub ? como(sub) : visitante(), f, a), async () => "", async (cs) => Object.fromEntries(cs.map((c) => [c, `https://assinado.local/${c}`])));
const C = Object.fromEntries(nomes.map((n) => [n, cliente(P[n])]));
const anon = cliente(null);
const comoNoBanco = async (sub, sql, valores = []) => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub })]);
  await banco.pg.exec("set role authenticated");
  try {
    return (await banco.pg.query(sql, valores)).rows;
  } finally {
    await banco.pg.exec("reset role");
  }
});
const enviar = (sub, nome, mime, size) => comoNoBanco(sub, "insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2) returning name", [`${sub}/${nome}`, JSON.stringify({ size, mimetype: mime })]);
const base = { publico: "seguidores", fundo: { tipo: "listras", cor: "vermelho" }, texto: "ATO NA REITORIA", legenda: null, imagem: null, alt: null, post_ref: null, figurinhas: [] };
const abrirComo = async (quem, id) => (await C[quem].abrir("autora_b1")).find((s) => s.id === id);

// ═══════════════════ 3. Pôr no story: o cartão do post e do ato ═══════════════════
const post = (await um("insert into interno.rede_posts (autor, texto, publico) values ($1, 'A assembleia aprovou a greve por tempo indeterminado', 'membros') returning id", [P.membro])).id;
const ato = (await um("insert into interno.rede_posts (autor, texto, titulo, publico) values ($1, 'Todo mundo na praça', 'PASSE LIVRE JÁ', 'membros') returning id", [P.autora])).id;
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto) values ($1, now() + interval '2 days', 'São Paulo', 'Praça da Sé, em frente à catedral')", [ato]);
const sPost = await espera("a autora põe o post de outra pessoa no story", () => C.autora.publicar({ ...base, texto: "", post_ref: post }), (r) => r.id);
await espera("quem vê recebe o cartão do post (autora e começo do texto)", async () => (await abrirComo("amiga", sPost?.id))?.post,
  (p) => p?.tipo === "post" && p.id === post && p.autora?.handle === "membro_b1" && p.texto.startsWith("A assembleia"));
const sAto = await espera("a autora põe o próprio ato no story", () => C.autora.publicar({ ...base, texto: "", post_ref: ato }), (r) => r.id);
await espera("o cartão do ato leva a data e a cidade, NUNCA o ponto exato nem quem vai", async () => (await abrirComo("amiga", sAto?.id))?.post,
  (p) => p?.tipo === "ato" && p.titulo === "PASSE LIVRE JÁ" && p.cidade === "São Paulo" && p.situacao === "confirmado" && !JSON.stringify(p).includes("catedral") && !("vou" in p) && !("total" in p));
await espera("a prévia do 'criar' é o mesmo cartão", () => C.autora.post(ato), (p) => p?.tipo === "ato" && p.cidade === "São Paulo");
await dono("update interno.rede_posts set apagado_em = now() where id = $1", [post]);
await espera("post apagado depois vira 'indisponível' (sem dizer o porquê)", async () => (await abrirComo("amiga", sPost?.id))?.post, (p) => p?.tipo === "indisponivel" && p.id === null);
await recusa("visitante não pede prévia", () => anon.post(ato), "permission denied");

// ═══════════════════ 4. Figurinhas novas ═══════════════════
const sDeco = await espera("até 3 decorativas além das interativas", () => C.autora.publicar({ ...base, figurinhas: [
  { tipo: "decorativa", nome: "punho" }, { tipo: "decorativa", nome: "lampiao", pos: { x: 0.2, y: 0.3, giro: 10, escala: 1.1 } }, { tipo: "decorativa", nome: "megafone" },
  { tipo: "pergunta", texto: "O que levar?" }] }), (r) => r.id);
await espera("quem vê recebe as decorativas pelo nome, no lugar", async () => (await abrirComo("amiga", sDeco?.id))?.figurinhas,
  (l) => l.length === 4 && l[1].tipo === "decorativa" && l[1].nome === "lampiao" && l[1].pos?.x === 0.2);
await recusa("decorativa fora da lista é recusada", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "decorativa", nome: "<svg onload=x>" }] }), "invalido:decorativa");
await recusa("quatro decorativas é recusado", () => C.autora.publicar({ ...base, figurinhas: Array(4).fill({ tipo: "decorativa", nome: "flor" }) }), "invalido:figurinhas");

const sVou = await espera("figurinha 'vou' de um ato que eu vejo", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "vou", ato }] }), (r) => r.id);
await espera("quem vê recebe o 'vou' sem total (menos de 3)", async () => (await abrirComo("amiga", sVou?.id))?.figurinhas[0],
  (f) => f.tipo === "vou" && f.ato === ato && f.titulo === "PASSE LIVRE JÁ" && f.cidade === "São Paulo" && f.vou_eu === false && f.total == null && f.encerrado === false);
await espera("'vou' pelo story é a mesma confirmação do ato", () => C.amiga.vou(ato, true), (r) => r.vou_eu === true);
for (const n of ["v1", "v2"]) await C[n].vou(ato, true);
// O ataque: quem olha o story no instante em que alguém confirma não pode ver o total mudar (o marco de 15 minutos dos atos).
await espera("confirmar pelo story NÃO muda o total no mesmo marco (3 pessoas, total ainda nulo)", async () => (await abrirComo("amiga", sVou?.id))?.figurinhas[0], (f) => f.vou_eu === true && f.total == null);
// Faz o tempo andar: o que entrou recua 20 minutos, para cair antes do último marco.
const passarMarco = async () => {
  await dono("update interno.rede_vou set criado_em = criado_em - interval '20 minutes'");
  await dono("update interno.rede_stories set criado_em = criado_em - interval '20 minutes', expira_em = expira_em - interval '20 minutes'");
};
await passarMarco();
await espera("depois do marco, com 3 pessoas, o total aparece (e quem vê sabe que foi)", async () => (await abrirComo("amiga", sVou?.id))?.figurinhas[0], (f) => f.vou_eu === true && f.total === 3);
await C.v3.vou(ato, true);
await espera("a 4ª confirmação não vira 4 na hora", async () => (await abrirComo("v2", sVou?.id))?.figurinhas[0], (f) => f.total === 3);
await C.v3.vou(ato, false);
await espera("…e nunca quem vai", async () => JSON.stringify((await abrirComo("v3", sVou?.id))?.figurinhas[0]), (t) => !t.includes("amiga_b1") && !t.includes("Lutadora"));
await recusa("'vou' de ato que não existe é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "vou", ato: post }] }), "invalido:vou");

const sPessoa = await espera("menção a pessoa (pelo @)", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "pessoa", handle: "@amiga_b1" }] }), (r) => r.id);
await espera("a pessoa mencionada recebe um aviso", () => um("select count(*)::int as n from interno.avisos where para = $1 and texto like '%mencionada num story%'", [P.amiga]), (r) => r.n === 1);
await espera("quem vê recebe o @ e o codinome", async () => (await abrirComo("v1", sPessoa?.id))?.figurinhas[0], (f) => f.tipo === "pessoa" && f.handle === "amiga_b1" && f.nome);
await recusa("mencionar quem eu bloqueei é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "pessoa", handle: "bloqueado_b1" }] }), "invalido:pessoa");
await recusa("mencionar a mim mesma é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "pessoa", handle: "autora_b1" }] }), "invalido:pessoa");

const sCamp = await espera("#campanha com corrente", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "campanha", tag: "#PasseLivre", corrente: true }] }), (r) => r.id);
await espera("a # vem limpa e o total da corrente só a partir de 3", async () => (await abrirComo("amiga", sCamp?.id))?.figurinhas[0], (f) => f.tag === "passelivre" && f.corrente === true && f.total == null);
for (const n of ["amiga", "v1"]) await C[n].publicar({ ...base, publico: "membros", figurinhas: [{ tipo: "campanha", tag: "passelivre", corrente: true }] });
await espera("três pessoas na corrente: no mesmo marco o total ainda não aparece", async () => (await abrirComo("amiga", sCamp?.id))?.figurinhas[0], (f) => f.total == null);
await passarMarco();
await espera("depois do marco, o total da corrente aparece", async () => (await abrirComo("amiga", sCamp?.id))?.figurinhas[0], (f) => f.total === 3);
await recusa("# com espaço ou símbolo é recusada", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "campanha", tag: "passe livre!" }] }), "invalido:campanha");

// ═══════════════════ 5. Respostas e reações com volta ═══════════════════
const sPerg = sDeco;
await espera("responder à pergunta", () => C.amiga.responderPergunta(sPerg.id, "Água e protetor"), (r) => r.ok);
await espera("responder comum ao mesmo story", () => C.v1.responder(sPerg.id, "Tô dentro!"), (r) => r.ok);
await recusa("a autora não responde à própria pergunta", () => C.autora.responderPergunta(sPerg.id, "eu"), "sem_permissao");
await recusa("pergunta em story sem pergunta é recusada", () => C.amiga.responderPergunta(sVou.id, "oi"), "nao_encontrado");
const resp = await espera("a autora lista as respostas, marcando a da pergunta", () => C.autora.respostas(sPerg.id),
  (l) => l.length === 2 && l.some((r) => r.pergunta && r.texto === "Água e protetor" && r.de?.handle === "amiga_b1") && l.some((r) => !r.pergunta));
await recusa("outra pessoa não lista as respostas do meu story", () => C.amiga.respostas(sPerg.id), "nao_encontrado");
await espera("a caixa traz o story com 2 respostas, 1 da pergunta", () => C.autora.caixa(), (l) => l.length === 1 && l[0].id === sPerg.id && l[0].n === 2 && l[0].perguntas === 1);
const daPergunta = resp?.find((r) => r.pergunta);
const sResp = await espera("publicar a resposta num story novo", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "resposta", resposta: daPergunta?.id, pergunta: "", texto: "" }] }), (r) => r.id);
await espera("…vai a pergunta e a resposta, SEM quem respondeu", async () => (await abrirComo("v2", sResp?.id))?.figurinhas[0],
  (f) => f.tipo === "resposta" && f.pergunta === "O que levar?" && f.texto === "Água e protetor" && !JSON.stringify(f).includes("amiga"));
await recusa("a resposta comum (não da pergunta) não vira story", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "resposta", resposta: resp?.find((r) => !r.pergunta)?.id }] }), "invalido:resposta");
await recusa("outra pessoa não publica a resposta da minha pergunta", () => C.amiga.publicar({ ...base, figurinhas: [{ tipo: "resposta", resposta: daPergunta?.id }] }), "invalido:resposta");

await C.amiga.reagir(sPerg.id, "punho");
await C.v1.reagir(sPerg.id, "punho");
await espera("2 reações: a autora vê só 'poucas'", async () => (await C.autora.meus()).find((s) => s.id === sPerg.id)?.reacoes, (r) => r.total === null && r.poucas === true && r.por.punho === null);
await C.v2.reagir(sPerg.id, "punho");
await espera("3 reações: o total aparece, por tipo só a partir de 3", async () => (await C.autora.meus()).find((s) => s.id === sPerg.id),
  (s) => s.reacoes.total === 3 && s.reacoes.por.punho === 3 && s.reacoes.por.chama === null && s.respostas === 2);
await espera("quem vê não recebe reações nem respostas do story", async () => await abrirComo("amiga", sPerg.id), (s) => s.reacoes == null && s.respostas == null);

// ═══════════════════ 6. Roda de confiança ═══════════════════
await espera("a roda nasce vazia", () => C.autora.roda(), (l) => l.length === 0);
await espera("pôr a amiga na roda", () => C.autora.mudarRoda("@amiga_b1", true), (l) => l.length === 1 && l[0].handle === "amiga_b1");
await recusa("pôr quem eu bloqueei na roda é recusado", () => C.autora.mudarRoda("bloqueado_b1", true), "nao_encontrado");
await recusa("visitante não lê roda", () => anon.roda(), "permission denied");
const sRoda = await C.autora.publicar({ ...base, publico: "proximos", texto: "SÓ PRA RODA" });
await espera("a amiga (na roda) vê", async () => !!(await abrirComo("amiga", sRoda.id)), (x) => x === true);
// A promessa "ninguém sabe em que rodas está": o story da roda chega a ela sem marca nenhuma; só a autora vê "proximos".
await espera("o story da roda chega à amiga SEM dizer que é da roda", async () => abrirComo("amiga", sRoda.id), (s) => s.publico === "seguidores" && !JSON.stringify(s).includes("proximos"));
await espera("a autora vê que publicou para a roda", async () => (await C.autora.meus()).find((s) => s.id === sRoda.id), (s) => s.publico === "proximos");
ok("o visor só mostra o selo da roda no meu story", /publico === "proximos" && atual.meu ?/.test(ler("components/rede/stories/Visor.tsx")));
await espera("o infiltrado que segue de volta NÃO vê", async () => !!(await abrirComo("infiltrado", sRoda.id)), (x) => x === false);
await espera("a amiga não tem como saber em que rodas está (nenhuma função devolve)", () => todos(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc ~ 'rede_roda' and p.prosrc ~ 'membro = v\\b'`), (l) => l.length === 0);
await espera("tirar da roda: deixa de ver", async () => {
  await C.autora.mudarRoda("amiga_b1", false);
  return !!(await abrirComo("amiga", sRoda.id));
}, (x) => x === false);
await C.autora.mudarRoda("amiga_b1", true);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.amiga, P.autora]);
await espera("bloquear tira da roda (nos dois sentidos)", () => C.autora.roda(), (l) => l.length === 0);
await dono("delete from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.amiga, P.autora]);

// ═══════════════════ 7. Público "só esta comunidade" e a menção ═══════════════════
const sCom = await espera("story só para o Núcleo Leste", () => C.autora.publicar({ ...base, publico: "comunidade", comunidade: "nucleo-leste", texto: "REUNIÃO DO NÚCLEO" }), (r) => r.id);
await espera("a amiga (membro do núcleo) vê, com o nome da comunidade", async () => (await abrirComo("amiga", sCom?.id))?.comunidade, (c) => c?.slug === "nucleo-leste" && c.nome === "Núcleo Leste");
await espera("quem segue mas não é do núcleo não vê", async () => !!(await abrirComo("v1", sCom?.id)), (x) => x === false);
await recusa("público de comunidade de que não sou membro é recusado", () => C.v1.publicar({ ...base, publico: "comunidade", comunidade: "nucleo-leste" }), "invalido:comunidade");
await recusa("público de comunidade sem dizer qual é recusado", () => C.autora.publicar({ ...base, publico: "comunidade" }), "invalido:comunidade");
await C.autora.publicar({ ...base, publico: "membros", figurinhas: [{ tipo: "comunidade", slug: "passe-livre", nome: "" }] });
await C.v1.publicar({ ...base, publico: "membros", figurinhas: [{ tipo: "comunidade", slug: "passe-livre", nome: "" }] });
await espera("a moderação recebe UM aviso agregado no dia, sem quem mencionou", () => todos("select texto, ator from interno.avisos where para = $1 and texto like 'Stories mencionaram%'", [P.mod]),
  (l) => l.length === 1 && l[0].ator === null && !l[0].texto.includes("Lutadora"));
await espera("a página da comunidade lista as bolinhas dos stories que a mencionam", () => C.membro.daComunidade("passe-livre"),
  (l) => l.length === 2 && l.every((g) => g.ids.length >= 1 && g.autora?.handle));
await espera("comunidade fechada: quem não é membro não lista nada", () => C.membro.daComunidade("nucleo-leste"), (l) => l.length === 0);
await espera("comunidade fechada: membro vê o story só para ela", () => C.amiga.daComunidade("nucleo-leste"), (l) => l.length === 1 && l[0].ids.includes(sCom?.id));

// ═══════════════════ 8. Vídeo: legendas e música ═══════════════════
const vid = `${P.autora}/0123456789abcdef0123456789abcdef.mp4`;
await enviar(P.autora, "0123456789abcdef0123456789abcdef.mp4", "video/mp4", 4_000_000);
const sVid = await espera("vídeo com legendas e música da Alumia", () => C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: vid,
  video: { duracao_ms: 10_000, som: true, musica: "batucada", legendas: [{ de: 0, ate: 2500, texto: "Bom dia, gente" }, { de: 3000, ate: 6000, texto: "TODOS À PRAÇA", grande: true }] } }), (r) => r.id);
await espera("quem vê recebe as legendas no tempo e o nome da música", async () => await abrirComo("amiga", sVid?.id),
  (s) => s.legendas?.length === 2 && s.legendas[1].grande === true && s.legendas[0].de === 0 && s.musica === "batucada");
await recusa("música fora da lista é recusada", async () => {
  await enviar(P.autora, "11111111111111111111111111111111.mp4", "video/mp4", 1000);
  return C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/11111111111111111111111111111111.mp4`, video: { duracao_ms: 5000, som: true, musica: "https://spotify.example/x" } });
}, "invalido:musica");
await recusa("legenda depois do fim do vídeo é recusada", () => C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/11111111111111111111111111111111.mp4`,
  video: { duracao_ms: 5000, som: false, legendas: [{ de: 1000, ate: 9000, texto: "x" }] } }), "invalido:legendas");
await recusa("legenda com telefone é recusada", () => C.autora.publicar({ ...base, fundo: { tipo: "video", cor: "azul" }, imagem: `${P.autora}/11111111111111111111111111111111.mp4`,
  video: { duracao_ms: 5000, som: false, legendas: [{ de: 0, ate: 2000, texto: "liga 11 98765-4321" }] } }), "dado_pessoal");
await recusa("música em story sem vídeo é recusada", () => C.autora.publicar({ ...base, video: { duracao_ms: 5000, som: false, musica: "marcha" } }), "invalido:video");

// ═══════════════════ 9. Destaques arrumáveis ═══════════════════
const f1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp";
const f2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp";
await enviar(P.autora, f1, "image/webp", 50_000);
await enviar(P.autora, f2, "image/webp", 50_000);
const sF1 = await C.autora.publicar({ ...base, publico: "membros", fundo: { tipo: "imagem", cor: "azul" }, imagem: `${P.autora}/${f1}`, alt: "Faixa na escadaria" });
const sF2 = await C.autora.publicar({ ...base, publico: "membros", fundo: { tipo: "imagem", cor: "azul" }, imagem: `${P.autora}/${f2}`, alt: "Gente de braço dado" });
const dA = await C.autora.salvarDestaque({ destaque: null, titulo: "Greve", story: sF1.id, cor: "vermelho" });
await C.autora.salvarDestaque({ destaque: dA.id, titulo: null, story: sF2.id });
const dB = await C.autora.salvarDestaque({ destaque: null, titulo: "Ocupação", story: sVou.id, cor: "verde" });
await espera("os destaques nascem na ordem de criação", () => C.v1.destaques("autora_b1"), (l) => l.map((d) => d.titulo).join() === "Greve,Ocupação");
await espera("reordenar os destaques", async () => {
  await C.autora.ordenarDestaques([dB.id, dA.id]);
  return C.v1.destaques("autora_b1");
}, (l) => l.map((d) => d.titulo).join() === "Ocupação,Greve");
await espera("a capa padrão é a primeira foto", async () => (await C.v1.destaques("autora_b1")).find((d) => d.id === dA.id)?.capa?.caminho, (c) => c === `${P.autora}/${f1}`);
await espera("escolher a capa (a segunda foto)", async () => {
  await C.autora.capaDoDestaque(dA.id, sF2.id);
  return (await C.v1.destaques("autora_b1")).find((d) => d.id === dA.id);
}, (d) => d.capa?.caminho === `${P.autora}/${f2}` && d.capa_story === undefined);
await espera("só a dona sabe qual story é a capa", async () => (await C.autora.destaques("autora_b1")).find((d) => d.id === dA.id)?.capa_story, (c) => c === sF2.id);
await recusa("capa com story que não está no destaque é recusada", () => C.autora.capaDoDestaque(dA.id, sVou.id), "invalido:capa");
await recusa("outra pessoa não mexe na ordem do meu destaque", () => C.amiga.ordenarNoDestaque(dA.id, [sF2.id, sF1.id]), "nao_encontrado");
await espera("reordenar os stories dentro do destaque", async () => {
  await C.autora.ordenarNoDestaque(dA.id, [sF2.id, sF1.id]);
  return C.v1.destaque(dA.id);
}, (l) => l.map((s) => s.id).join() === `${sF2.id},${sF1.id}`);
await espera("renomear e trocar a cor de um destaque existente", () => C.autora.salvarDestaque({ destaque: dA.id, titulo: "Greve 2026", story: null, cor: "dourado" }), (d) => d.titulo === "Greve 2026" && d.cor === "dourado");
// O "borrar de novo" quando vira destaque: a foto nova (borrada) troca a antiga.
const f3 = "cccccccccccccccccccccccccccccccc.webp";
await enviar(P.autora, f3, "image/webp", 40_000);
await espera("trocar a foto pela versão borrada", () => C.autora.trocarMidia(sF1.id, `${P.autora}/${f3}`), (r) => r.ok);
await espera("…e o destaque passa a mostrar a nova", async () => (await C.v1.destaque(dA.id)).find((s) => s.id === sF1.id)?.fundo?.caminho, (c) => c === `${P.autora}/${f3}`);
await recusa("trocar a foto de story de outra pessoa é recusado", () => C.amiga.trocarMidia(sF1.id, `${P.amiga}/${f3}`), "nao_encontrado");
await recusa("trocar por arquivo de outra pasta é recusado", () => C.autora.trocarMidia(sF1.id, `${P.amiga}/dddddddddddddddddddddddddddddddd.webp`), "invalido:imagem");
await espera("apagar um destaque", () => C.autora.apagarDestaque(dB.id), (r) => r.apagado);

// ═══════════════════ 10. Nada de quem viu, nada federa ═══════════════════
await espera("nenhuma coluna de quem viu nas tabelas novas", () => todos(`select table_name, column_name from information_schema.columns where table_schema = 'interno'
  and table_name in ('rede_roda', 'rede_story_mencao_aviso') and column_name ~* '(vist|visualiz|viu|view|seen|ip)'`), (l) => l.length === 0);
await espera("nenhuma função da federação lê a roda ou os stories", () => todos(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (p.proname like 'rede_fed%' or p.proname like 'fed_%') and (p.prosrc ~ 'rede_stor' or p.prosrc ~ 'rede_roda')`), (l) => l.length === 0);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
