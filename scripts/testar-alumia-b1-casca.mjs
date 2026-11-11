// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a B1 da casca da Alumia (supabase/migracoes/20261110-alumia-b1-casca.sql) num Postgres de verdade (banco local, sem
// rede): quem pode citar (no banco, por trigger), enquete com resultado só no fim e ordem embaralhada, corrigir aviso / texto
// alternativo / tirar imagem, agendar com repetição e "quando o ato terminar", o agendador (só a chave de serviço) e o
// rascunho na conta só cifrado. Também RLS, nenhuma permissão direta, security definer com search_path fixo e idempotência.
// Uso: npm run testar:alumia-b1-casca
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
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

const b1 = ler("supabase/migracoes/20261110-alumia-b1-casca.sql");
await espera("a B1 da casca está colada inteira no fim do install.sql", async () => ler("supabase/install.sql").includes(b1.trim()), (v) => v === true);

const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
await espera("a B1 instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(b1)));
await espera("e mais uma vez", () => banco.exclusivo(() => banco.pg.exec(b1)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });
const servico = () => ({ papel: "service_role", ip: "127.0.0.1" });

const p = {};
const nomes = ["autora", "amiga", "outra", "quarta", "quinta"];
for (const [i, nome] of nomes.entries()) {
  p[nome] = await criarUsuario(`${nome}@b1.local`, nome);
  await rpc(como(p[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [p[nome], `Pessoa ${i + 1}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [p[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [p[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.rede_niveis set imagens = 4, links = 50, posts_dia = 5000").catch(() => undefined);
// A autora segue a amiga (para "quem eu sigo pode citar").
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [p.autora, p.amiga]);
const zerar = () => dono("delete from interno.limites");
const publicarB1 = (quem, pedido) => rpc(como(p[quem]), "rede_pub_publicar_mais", { p: pedido });
const citar = (quem, alvo, texto = "Assino embaixo.") => rpc(como(p[quem]), "rede_conv_citar", { p: { texto, citar: alvo, publico: "membros" } });

// ═══════════════════ Tabelas e funções ═══════════════════
for (const tabela of ["rede_b1_post", "rede_b1_enquete"]) {
  await espera(`${tabela}: RLS ligada`, async () => (await um("select relrowsecurity as r from pg_class where oid = $1::regclass", [`interno.${tabela}`])).r, (r) => r === true);
  await espera(`${tabela}: nenhuma permissão para anon/authenticated`, async () =>
    (await um(`select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name = $1 and grantee in ('anon', 'authenticated', 'PUBLIC')`, [tabela])).n, (n) => n === 0);
}
const novas = ["rede_pub_publicar_mais", "rede_pub_corrigir", "rede_pub_agendar_mais", "rede_pub_meus_atos", "rede_pub_agendados", "rede_pub_rascunhos_apagar_todos", "rede_pub_detalhes"];
await espera("as funções públicas da B1 são security definer com search_path fixo", async () =>
  (await dono(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [novas])).rows,
(rs) => rs.length === novas.length && rs.every((r) => r.prosecdef && r.cfg.includes("search_path=interno, pg_temp")));
for (const f of ["rede_pub_publicar_mais", "rede_pub_corrigir", "rede_pub_meus_atos", "rede_pub_rascunhos_apagar_todos"]) {
  await recusa(`visitante não chama ${f}`, () => rpc(visitante(), f, f === "rede_pub_corrigir" ? { p_post: crypto.randomUUID(), p: {} } : f === "rede_pub_publicar_mais" ? { p: { texto: "x" } } : {}), "permission denied");
}
await recusa("o agendador geral não abre para quem tem conta", () => rpc(como(p.autora), "rede_pub_agendados_rodar"), "permission denied");

// ═══════════════════ Quem pode citar ═══════════════════
const fechado = await publicarB1("autora", { texto: "Nota da assembleia de ontem: a pauta segue aberta.", publico: "membros" });
await espera("post novo nasce com ninguém cita", async () => (await um("select citar_quem from interno.rede_b1_post where post = $1", [fechado.id])).citar_quem, (c) => c === "ninguem");
await espera("publicar_b1 devolve o post e a escolha", async () => fechado, (r) => /^[0-9a-f-]{36}$/.test(r.id) && r.citar_quem === "ninguem");
await recusa("ninguém cita: a outra pessoa não consegue citar", () => citar("outra", fechado.id), "citar_fechado");
await espera("…e a citação recusada não deixou post solto", async () => (await um("select count(*)::int as n from interno.rede_posts where autor = $1", [p.outra])).n, (n) => n === 0);
await espera("a própria autora sempre pode citar o seu", () => citar("autora", fechado.id, "Atualizo: a pauta fecha sexta."), (r) => r.citado && r.citado.id === fechado.id);
await zerar();
const seguindo = await publicarB1("autora", { texto: "Quem eu sigo pode citar este.", publico: "membros", citar_quem: "seguindo" });
await espera("quem a autora segue cita", () => citar("amiga", seguindo.id), (r) => r.citado?.id === seguindo.id);
await recusa("quem ela não segue não cita", () => citar("outra", seguindo.id), "citar_fechado");
const aberto = await publicarB1("autora", { texto: "Todo mundo pode citar este chamado.", publico: "membros", citar_quem: "todos" });
await espera("todos: qualquer pessoa cita", () => citar("outra", aberto.id), (r) => r.citado?.id === aberto.id);
await recusa("citar_quem inválido", () => publicarB1("autora", { texto: "x", citar_quem: "meio-mundo" }), "invalido:citar_quem");
await espera("post de antes da B1 (sem linha) segue citável por todos", async () => {
  await dono("delete from interno.rede_b1_post where post = $1", [fechado.id]);
  const r = await citar("quarta", fechado.id);
  await dono("insert into interno.rede_b1_post (post) values ($1)", [fechado.id]);
  return r;
}, (r) => r.citado?.id === fechado.id);
await recusa("a trigger vale para qualquer caminho (update direto também)", async () => {
  const x = await publicarB1("quinta", { texto: "Um post meu qualquer.", publico: "membros" });
  return dono("update interno.rede_posts set quote_of = $1 where id = $2", [seguindo.id, x.id]);
}, "citar_fechado");
await espera("detalhes: quem lê sabe se pode citar; só a autora vê a escolha", async () => {
  const d1 = await rpc(como(p.outra), "rede_pub_detalhes", { p_ids: [seguindo.id, aberto.id] });
  const d2 = await rpc(como(p.autora), "rede_pub_detalhes", { p_ids: [seguindo.id] });
  const d3 = await rpc(visitante(), "rede_pub_detalhes", { p_ids: [aberto.id] });
  return [d1, d2, d3];
}, ([d1, d2, d3]) => d1[seguindo.id].citar === false && d1[aberto.id].citar === true && !("citar_quem" in d1[seguindo.id]) && d2[seguindo.id].citar_quem === "seguindo" && (!d3[aberto.id] || !("citar" in d3[aberto.id])));

// ═══════════════════ Enquete avançada ═══════════════════
await zerar();
const enq = await publicarB1("autora", { tipo: "enquete", texto: "Qual dia da assembleia?", publico: "membros", enquete: { opcoes: ["terça", "quarta", "quinta", "sábado"], horas: 24, so_no_fim: true, embaralhar: true } });
const opcoes = (await dono("select id from interno.rede_opcoes where enquete = $1 order by ordem", [enq.id])).rows.map((r) => r.id);
const det = async (quem, id = enq.id) => (await rpc(quem ? como(p[quem]) : visitante(), "rede_pub_detalhes", { p_ids: [id] }))[id]?.enquete;
await espera("a enquete guarda resultado só no fim e embaralhar", async () => await um("select so_no_fim, embaralhar from interno.rede_b1_enquete where post = $1", [enq.id]), (r) => r.so_no_fim === true && r.embaralhar === true);
for (const quem of ["amiga", "outra", "quarta"]) await rpc(como(p[quem]), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[0]] });
await espera("antes do prazo, nem quem votou vê a parcial", () => det("amiga"), (e) => e.total == null && e.opcoes.every((o) => o.votos == null) && e.so_no_fim === true);
await espera("nem a autora vê a parcial", () => det("autora"), (e) => e.total == null && e.opcoes.every((o) => o.votos == null));
await recusa("o voto continua travado (não se troca)", () => rpc(como(p.amiga), "rede_pub_enquete_votar", { p_post: enq.id, p_opcoes: [opcoes[1]] }), "ja_votou");
await espera("cada pessoa vê uma ordem própria e estável", async () => {
  const ordens = [];
  for (const quem of nomes) ordens.push((await det(quem)).opcoes.map((o) => o.id).join());
  const deNovo = (await det("autora")).opcoes.map((o) => o.id).join();
  return { ordens, deNovo };
}, ({ ordens, deNovo }) => deNovo === ordens[0] && new Set(ordens).size > 1 && ordens.every((o) => o.split(",").sort().join() === [...opcoes].sort().join()));
await espera("depois do prazo, todo mundo vê os totais", async () => {
  await dono("update interno.rede_enquetes set prazo = now() - interval '1 minute' where post = $1", [enq.id]);
  return det("quinta");
}, (e) => e.encerrada === true && e.total === 3 && e.opcoes.some((o) => o.votos === 3));
const comum = await publicarB1("autora", { tipo: "enquete", texto: "Vamos de faixa ou de cartaz?", publico: "membros", enquete: { opcoes: ["faixa", "cartaz"], horas: 24 } });
await rpc(como(p.amiga), "rede_pub_enquete_votar", { p_post: comum.id, p_opcoes: [(await um("select id from interno.rede_opcoes where enquete = $1 order by ordem limit 1", [comum.id])).id] });
await espera("enquete comum: quem votou vê a parcial (como antes)", () => det("amiga", comum.id), (e) => e.total === 1 && e.so_no_fim === false);
await espera("enquete comum: a ordem é a de quem fez", async () => (await det("outra", comum.id)).opcoes.map((o) => o.texto).join(), (o) => o === "faixa,cartaz");
await recusa("so_no_fim tem que ser verdadeiro ou falso", () => publicarB1("autora", { tipo: "enquete", texto: "?", enquete: { opcoes: ["a", "b"], horas: 24, so_no_fim: "sim" } }), "invalido:enquete");

// ═══════════════════ Corrigir depois de publicar ═══════════════════
await zerar();
const comFoto = await publicarB1("autora", { texto: "Fotos do mutirão de sábado.", publico: "membros" });
const m1 = crypto.randomUUID();
const m2 = crypto.randomUUID();
await dono(`insert into interno.rede_midia (id, post, caminho, tipo, ordem, alt) values ($1, $3, $4, 'image/jpeg', 0, ''), ($2, $3, $5, 'image/jpeg', 1, 'mutirão')`, [m1, m2, comFoto.id, `${p.autora}/${crypto.randomUUID()}.jpg`, `${p.autora}/${crypto.randomUUID()}.jpg`]);
const corrigir = (quem, id, campos) => rpc(como(p[quem]), "rede_pub_corrigir", { p_post: id, p: campos });
await recusa("outra pessoa não corrige", () => corrigir("outra", comFoto.id, { aviso: "imagem forte" }), "sem_permissao");
await espera("a autora põe um aviso de conteúdo depois", () => corrigir("autora", comFoto.id, { aviso: "  imagem forte  " }), (r) => r.post.aviso === "imagem forte");
await espera("a autora corrige o texto alternativo esquecido", async () => {
  await corrigir("autora", comFoto.id, { alts: [{ id: m1, alt: "Gente pintando o muro da escola" }] });
  return (await um("select alt from interno.rede_midia where id = $1", [m1])).alt;
}, (a) => a === "Gente pintando o muro da escola");
await espera("alt de imagem de OUTRO post não muda", async () => {
  const outro = await publicarB1("autora", { texto: "Outro post.", publico: "membros" });
  await corrigir("autora", outro.id, { alts: [{ id: m2, alt: "trocado" }] });
  return (await um("select alt from interno.rede_midia where id = $1", [m2])).alt;
}, (a) => a === "mutirão");
await recusa("dado pessoal no alt é recusado", () => corrigir("autora", comFoto.id, { alts: [{ id: m1, alt: "CPF 123.456.789-09" }] }), "dado_pessoal");
await espera("tirar a imagem com o rosto: some do post, a outra volta a ser a primeira e o caminho volta para a tela apagar", async () => {
  const r = await corrigir("autora", comFoto.id, { tirar: [m1] });
  const resto = (await dono("select id, ordem from interno.rede_midia where post = $1", [comFoto.id])).rows;
  return { r, resto };
}, ({ r, resto }) => r.tirados.length === 1 && String(r.tirados[0]).endsWith(".jpg") && resto.length === 1 && resto[0].id === m2 && resto[0].ordem === 0);
await espera("depois dos 15 minutos, corrigir marca editado", async () => {
  await dono("update interno.rede_posts set criado_em = now() - interval '1 hour', editado_em = null where id = $1", [comFoto.id]);
  return (await corrigir("autora", comFoto.id, { aviso: "luto" })).post;
}, (x) => x.editado_em !== null && x.aviso === "luto");
await espera("a autora abre a citação depois", async () => {
  await corrigir("autora", fechado.id, { citar_quem: "todos" });
  return rpc(como(p.quinta), "rede_pub_detalhes", { p_ids: [fechado.id] });
}, (d) => d[fechado.id].citar === true);

// ═══════════════════ Agendar: repetir e depois do ato ═══════════════════
await zerar();
const em = (h) => new Date(Date.now() + h * 3600_000).toISOString();
const agendarB1 = (quem, pedido, quando, opcoes) => rpc(como(p[quem]), "rede_pub_agendar_mais", { p: pedido, p_quando: quando, p_opcoes: opcoes });
const semanal = await agendarB1("autora", { texto: "Assembleia hoje, 19h, no galpão.", publico: "membros" }, em(2), { repetir: "semana", vezes: 3 });
await espera("agendar toda semana: guarda a repetição e a data final", async () => await um("select repetir, vezes, repetir_ate, quando from interno.rede_agendados where id = $1", [semanal.id]),
  (r) => r.repetir === "semana" && r.vezes === 1 && Math.round((new Date(r.repetir_ate) - new Date(r.quando)) / 86400000) === 14);
await recusa("repetir com imagem não pode (o arquivo só nasce uma vez)", () => agendarB1("autora", { texto: "x", midia: [{ caminho: "a/b.jpg", alt: "" }] }, em(2), { repetir: "semana", vezes: 2 }), "repetir_sem_arquivo");
await recusa("repetir mais de 12 vezes não", () => agendarB1("autora", { texto: "x" }, em(2), { repetir: "semana", vezes: 40 }), "invalido:repetir");
await espera("o agendador (chave de serviço) publica o que venceu e marca a próxima vez 7 dias depois", async () => {
  await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [semanal.id]);
  const n = await rpc(servico(), "rede_pub_agendados_rodar");
  const feito = await um("select estado, post from interno.rede_agendados where id = $1", [semanal.id]);
  const prox = (await dono("select vezes, quando from interno.rede_agendados where autor = $1 and estado = 'pendente' and repetir = 'semana'", [p.autora])).rows;
  return { n, feito, prox };
}, ({ n, feito, prox }) => n >= 1 && feito.estado === "publicado" && feito.post && prox.length === 1 && prox[0].vezes === 2 && new Date(prox[0].quando) > new Date(Date.now() + 6 * 86400000));
await espera("na última vez, não marca mais nenhuma", async () => {
  for (let i = 0; i < 3; i++) {
    await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where autor = $1 and estado = 'pendente' and repetir = 'semana'", [p.autora]);
    await zerar();
    await rpc(servico(), "rede_pub_agendados_rodar");
  }
  return (await dono("select vezes, estado from interno.rede_agendados where autor = $1 and repetir = 'semana' order by vezes", [p.autora])).rows;
}, (rs) => rs.length === 3 && rs.every((r) => r.estado === "publicado") && rs.at(-1).vezes === 3);

// Um ato que a autora chamou e um de outra pessoa.
const ato = await um("insert into interno.rede_posts (autor, tipo, texto) values ($1, 'chamado', 'Vigília na ocupação') returning id", [p.autora]);
await dono("insert into interno.rede_chamados (post, inicio, fim, cidade, ponto) values ($1, now() + interval '1 day', now() + interval '1 day 2 hours', 'São Paulo', 'Praça da Sé')", [ato.id]);
const atoDaOutra = await um("insert into interno.rede_posts (autor, tipo, texto) values ($1, 'chamado', 'Ato da outra') returning id", [p.outra]);
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto) values ($1, now() + interval '2 days', 'Recife', 'Marco Zero')", [atoDaOutra.id]);
await espera("meus atos: só os que eu chamei, com o fim", () => rpc(como(p.autora), "rede_pub_meus_atos"), (l) => l.length === 1 && l[0].id === ato.id && l[0].fim);
await recusa("depois do ato de outra pessoa, não", () => agendarB1("autora", { texto: "Obrigada a quem foi!" }, null, { apos_ato: atoDaOutra.id }), "invalido:ato");
const depois = await agendarB1("autora", { texto: "Obrigada a quem foi! Fotos amanhã.", publico: "membros" }, null, { apos_ato: ato.id });
await espera("depois do ato: a hora é o fim do ato", async () => {
  const a = await um("select quando from interno.rede_agendados where id = $1", [depois.id]);
  const c = await um("select fim from interno.rede_chamados where post = $1", [ato.id]);
  return Math.abs(new Date(a.quando) - new Date(c.fim));
}, (d) => d < 1000);
await espera("o ato foi adiado: o post espera junto", async () => {
  await dono("update interno.rede_chamados set inicio = inicio + interval '1 day', fim = fim + interval '1 day' where post = $1", [ato.id]);
  await rpc(como(p.autora), "rede_pub_agendados");
  const a = await um("select quando from interno.rede_agendados where id = $1", [depois.id]);
  const c = await um("select fim from interno.rede_chamados where post = $1", [ato.id]);
  return Math.abs(new Date(a.quando) - new Date(c.fim));
}, (d) => d < 1000);
await espera("a fila mostra a repetição e o depois do ato", () => rpc(como(p.autora), "rede_pub_agendados"), (l) => l.some((a) => a.apos_ato === true && a.estado === "pendente") && l.some((a) => a.repetir === "semana"));
await espera("o ato foi cancelado: o post não sai (falhou: ato_cancelado)", async () => {
  await dono("update interno.rede_chamados set cancelado = true where post = $1", [ato.id]);
  await rpc(servico(), "rede_pub_agendados_rodar");
  return um("select estado, erro from interno.rede_agendados where id = $1", [depois.id]);
}, (r) => r.estado === "falhou" && r.erro === "ato_cancelado");
await espera("o limite de uso vale (30 por hora)", async () => {
  await zerar();
  let erro = "";
  for (let i = 0; i < 31 && !erro; i++) {
    await dono("delete from interno.rede_agendados where autor = $1 and estado = 'pendente'", [p.amiga]);
    await agendarB1("amiga", { texto: `teste ${i}`, publico: "membros" }, em(3), {}).catch((e) => (erro = e.message));
  }
  return erro;
}, (e) => e.includes("muitos_pedidos"));

// ═══════════════════ Rascunho só cifrado ═══════════════════
await zerar();
const salvar = (quem, r) => rpc(como(p[quem]), "rede_pub_rascunho_salvar", { p: r });
await recusa("rascunho em texto claro não vai mais à conta", () => salvar("autora", { tipo: "post", texto: "Denúncia: o vereador X…" }), "rascunho_sem_cifra");
const cifra = Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString("base64");
const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("base64");
const guardado = await salvar("autora", { v: 1, iv, cifra, texto: "isto não pode ficar" });
await espera("o cifrado é guardado, e só a cifra (o texto que veio junto é jogado fora)", async () => (await um("select pedido from interno.rede_rascunhos where id = $1", [guardado.id])).pedido,
  (pd) => pd.cifra === cifra && pd.iv === iv && !("texto" in pd) && !("tipo" in pd));
await recusa("iv torto não passa", () => salvar("autora", { v: 1, iv: "curto", cifra }), "invalido:rascunho");
await recusa("cifra que não é base64 não passa", () => salvar("autora", { v: 1, iv, cifra: "<script>alert(1)</script>".repeat(3) }), "invalido:tamanho");
await espera("a lista devolve a cifra só para a dona", async () => [await rpc(como(p.autora), "rede_pub_rascunhos"), await rpc(como(p.outra), "rede_pub_rascunhos")],
  ([minha, dela]) => minha.length === 1 && minha[0].cifra === cifra && dela.length === 0);
await espera("apagar todos (ao desligar guardar na conta)", async () => {
  await salvar("autora", { v: 1, iv, cifra });
  await salvar("outra", { v: 1, iv, cifra });
  const r = await rpc(como(p.autora), "rede_pub_rascunhos_apagar_todos");
  const resto = await um("select count(*) filter (where autor = $1)::int as minha, count(*) filter (where autor = $2)::int as dela from interno.rede_rascunhos", [p.autora, p.outra]);
  return { r, resto };
}, ({ r, resto }) => r.apagados === 2 && resto.minha === 0 && resto.dela === 1);

// ═══════════════════ Fim ═══════════════════
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s) (${certos} certas):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`✓ Alumia B1 · casca no banco: ${certos} verificações certas.`);
process.exit(0);
