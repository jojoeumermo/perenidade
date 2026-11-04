// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote "conversa" da Rede v2 (supabase/migracoes/2026-11-rede-conversa.sql, itens 24 a 28 do R4) num Postgres de
// verdade dentro do Node: a árvore até 6 níveis com "continuar conversa", as três ordens (com a fórmula escrita), a resposta
// que resolveu (só quem fez a dúvida ou a moderação), a síntese fixada com histórico, as menções (aviso que respeita bloqueio,
// perfil invisível, matriz e post retido), a sugestão de @ e a citação (conteúdo restrito). Também confere as permissões, o
// contrato dos tipos, do cliente e dos textos. Uso: npm run testar:rede-conversa
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { continuaEmOutraPagina, inserirMencao, mencaoEmDigitacao, montarArvore, recuoDoNivel, trechosComMencoes } from "../lib/rede/tipos-conversa.ts";

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

const banco = await criarBanco({ semRede: true });
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;
const lerTexto = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const migracoes = ["fundacao", "conversa"].map((n) => fs.readFileSync(new URL(`../supabase/migracoes/2026-11-rede-${n}.sql`, import.meta.url), "utf8"));

for (const sql of migracoes) await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instalar a conversa de novo não quebra", () => banco.exclusivo(() => banco.pg.exec(migracoes[1])));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas ──
const P = {};
const nomes = ["autor", "membro", "outro", "moderadora", "bloqueado", "invisivel", "fora", "equipe", "silenciadora"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@conversa.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${i + 1} ${nome}`, `${nome}_luta`]);
}
await dono("delete from interno.papeis where usuario <> $1", [P.equipe]);
await dono("insert into interno.papeis (usuario, papel) select $1, 'educacao' where not exists (select 1 from interno.papeis where usuario = $1)", [P.equipe]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "fora")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.invisivel]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.autor, P.bloqueado]);
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet'), ('moradia', 'Moradia', 'lutas', 'aberta', 'membros')");
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('matematica', $1, 'moderacao')", [P.moderadora]);
const nucleo = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo do teste', 'Niterói') returning id")).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro'), ($1, $3, 'membro')", [nucleo, P.autor, P.membro]);

const postar = async (campos, autor = P.autor, texto = "post do teste") => {
  const todosOsCampos = { publico: "membros", ...campos };
  const colunas = Object.keys(todosOsCampos);
  const linha = await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, $2, ${colunas.map((_, i) => `$${i + 3}`).join(", ")}) returning id`, [autor, texto, ...Object.values(todosOsCampos)]);
  return linha.id;
};
const avisos = async (quem, filtro = "%") => (await um("select count(*)::int as n from interno.avisos where para = $1 and texto like $2", [quem, filtro])).n;
const arvore = (quem, id, ordem) => rpc(quem ? como(quem) : visitante(), "rede_conv_arvore", ordem ? { p_id: id, p_ordem: ordem } : { p_id: id });
const ids = (r) => r.respostas.map((x) => x.id);

// ── 24. A árvore: 6 níveis, "continuar conversa" ──
const raiz = await postar({ tipo: "duvida", titulo: "Como calcular a área?", corpo: "Preciso entender a área do círculo com calma." }, P.autor, "Preciso entender");
const cadeia = [raiz];
for (let i = 1; i <= 6; i++) cadeia.push(await postar({ resposta_a: cadeia[i - 1] }, i % 2 ? P.membro : P.outro, `nível ${i}`));
await espera("o banco numera a árvore (a cadeia vai de 0 a 6)", async () => (await todos("select profundidade from interno.rede_posts where id = any($1::uuid[]) order by profundidade", [cadeia])).map((l) => l.profundidade).join(","), (r) => r === "0,1,2,3,4,5,6");
const r0 = await arvore(P.membro, raiz);
await espera("a página do post mostra até o 5º nível abaixo dele (6 níveis com ele)", () => ids(r0), (r) => r.length === 5 && r[4] === cadeia[5] && !r.includes(cadeia[6]));
await espera("no 6º nível a resposta avisa que tem mais (continuar conversa)", () => r0.respostas[4].respostas, (n) => n === 1);
await espera("a ordem vem em árvore: cada resposta logo depois do que ela responde", () => r0.respostas.map((x) => x.resposta_a), (r) => r.join() === [cadeia[0], cadeia[1], cadeia[2], cadeia[3], cadeia[4]].join());
const r5 = await arvore(P.membro, cadeia[5]);
await espera("a página do 6º nível abre a continuação e traz a cadeia de cima", () => [ids(r5), r5.acima.length, r5.raiz], (r) => r[0].join() === cadeia[6] && r[1] === 5 && r[2] === raiz);
await espera("a árvore pede a ordem certa: nome inválido é recusado", () => arvore(P.membro, raiz, "aleatoria").then(() => "passou", (e) => e.message), (m) => String(m).includes("invalido:ordem"));
await espera("o nome do painel nunca sai: só codinome", () => JSON.stringify(r0).includes("conversa.local"), (v) => v === false);

// Ordem das irmãs
const dupla = await postar({ tipo: "duvida", titulo: "Qual caminho seguir agora?", corpo: "Quero saber qual caminho seguir primeiro." });
const a1 = await postar({ resposta_a: dupla }, P.membro, "primeira");
const a2 = await postar({ resposta_a: dupla }, P.outro, "segunda");
const a3 = await postar({ resposta_a: dupla }, P.moderadora, "terceira");
await dono("update interno.rede_posts set criado_em = now() - interval '3 hours' where id = $1", [a1]);
await dono("update interno.rede_posts set criado_em = now() - interval '2 hours' where id = $1", [a2]);
await dono("update interno.rede_posts set criado_em = now() - interval '1 hours' where id = $1", [a3]);
await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'util'), ($1, $3, 'util'), ($4, $2, 'util')", [a3, P.membro, P.outro, a2]);
await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio'), ($1, $3, 'apoio'), ($1, $4, 'apoio')", [a1, P.membro, P.outro, P.moderadora]);
await espera("mais antigas: da primeira à última", async () => ids(await arvore(P.membro, dupla, "antigas")), (r) => r.join() === [a1, a2, a3].join());
await espera("mais novas: da última à primeira", async () => ids(await arvore(P.membro, dupla, "novas")), (r) => r.join() === [a3, a2, a1].join());
await espera("mais úteis (padrão): quem tem mais 'útil' primeiro", async () => ids(await arvore(P.membro, dupla)), (r) => r.join() === [a3, a2, a1].join());
await espera("a ordem por 'útil' ignora os apoios (só o autor os vê): a de 3 apoios não sobe", async () => ids(await arvore(P.membro, dupla, "uteis")).indexOf(a1), (i) => i === 2);
await espera("filhas ficam sob a mãe, mesmo na ordem por 'útil'", async () => {
  const f = await postar({ resposta_a: a1 }, P.outro, "filha da primeira");
  const r = ids(await arvore(P.membro, dupla, "uteis"));
  return r.indexOf(f) === r.indexOf(a1) + 1;
}, (v) => v === true);

// Visibilidade na árvore
const secreta = await postar({ resposta_a: dupla }, P.bloqueado, "do bloqueado");
await espera("resposta de pessoa bloqueada pelo autor da dúvida não aparece para ele", async () => ids(await arvore(P.autor, dupla)).includes(secreta), (v) => v === false);
await espera("...mas aparece para quem não bloqueou", async () => ids(await arvore(P.membro, dupla)).includes(secreta), (v) => v === true);
const doNucleo = await postar({ publico: "nucleo", nucleo, tipo: "discussao", titulo: "Reunião do núcleo", corpo: "Vamos combinar a reunião do núcleo." });
const filhaNucleo = await postar({ resposta_a: doNucleo, publico: "nucleo", nucleo }, P.membro, "resposta do núcleo");
await espera("conversa de núcleo: quem é de fora não abre", () => arvore(P.outro, doNucleo).then(() => "abriu", (e) => e.message), (m) => String(m).includes("nao_encontrado"));
await espera("conversa de núcleo: quem é do núcleo vê a resposta", async () => ids(await arvore(P.autor, doNucleo)), (r) => r.join() === filhaNucleo);
await espera("a resposta de um post removido some da árvore", async () => {
  await dono("update interno.rede_posts set oculto = true where id = $1", [a2]);
  const r = ids(await arvore(P.membro, dupla));
  await dono("update interno.rede_posts set oculto = false where id = $1", [a2]);
  return r.includes(a2);
}, (v) => v === false);
await espera("resposta de pessoa silenciada vem sem o texto", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [P.silenciadora, P.outro]);
  const r = await arvore(P.silenciadora, dupla);
  const x = r.respostas.find((i) => i.id === a2);
  return [x.silenciada, x.texto];
}, (r) => r[0] === true && r[1] === "");
const aberta = await postar({ publico: "internet", comunidade: "matematica", tipo: "discussao", titulo: "Aberta para a internet", corpo: "Texto aberto para todo mundo." });
const filhaAberta = await postar({ resposta_a: aberta, publico: "internet", comunidade: "matematica" }, P.membro, "resposta aberta");
await espera("visitante lê a árvore de uma conversa aberta à internet", async () => ids(await arvore(null, aberta)), (r) => r.join() === filhaAberta);
await espera("visitante não abre conversa só para membros", () => arvore(null, raiz).then(() => "abriu", (e) => e.message), (m) => String(m).includes("nao_encontrado"));

// ── 27. A resposta que resolveu ──
const resp1 = cadeia[1];
await recusa("quem não fez a dúvida nem modera não marca", () => rpc(como(P.outro), "rede_conv_aceitar", { p_resposta: resp1, p_sim: true }), "sem_permissao");
await recusa("visitante não marca", () => rpc(visitante(), "rede_conv_aceitar", { p_resposta: resp1, p_sim: true }), "permission denied");
await recusa("só em conversa de dúvida", () => rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: filhaNucleo, p_sim: true }), "invalido:tipo");
await recusa("o próprio post raiz não é uma resposta", () => rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: raiz, p_sim: true }), "nao_encontrado");
await espera("quem fez a dúvida marca a resposta que resolveu", () => rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: a1, p_sim: true }), (r) => r.aceita === a1);
await espera("a resposta que resolveu avisa quem a escreveu", () => avisos(P.membro, "%resolveu%"), (n) => n === 1);
await espera("marcar de novo a mesma não avisa de novo", async () => {
  await rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: a1, p_sim: true });
  return avisos(P.membro, "%resolveu%");
}, (n) => n === 1);
await espera("na ordem por 'útil' a que resolveu vem primeiro", async () => ids(await arvore(P.membro, dupla))[0], (i) => i === a1);
await espera("na ordem por data a que resolveu não pula a fila", async () => ids(await arvore(P.membro, dupla, "antigas"))[0] === a1 && ids(await arvore(P.membro, dupla, "novas"))[0] !== a1, (v) => v === true);
await espera("o post da dúvida mostra 'aceita' e a página diz quem pode marcar", async () => {
  const r = await arvore(P.autor, dupla);
  const o = await arvore(P.outro, dupla);
  return [r.post.aceita, r.pode_aceitar, o.pode_aceitar];
}, (r) => r[0] === a1 && r[1] === true && r[2] === false);
await espera("a moderação da comunidade marca outra (a marca troca, só há uma)", async () => {
  await dono("update interno.rede_posts set comunidade = 'matematica', publico = 'membros' where id = any($1::uuid[])", [[dupla, a1, a2, a3]]);
  const r = await rpc(como(P.moderadora), "rede_conv_aceitar", { p_resposta: a3, p_sim: true });
  return [r.aceita, (await um("select aceita from interno.rede_posts where id = $1", [dupla])).aceita];
}, (r) => r[0] === a3 && r[1] === a3);
await espera("a equipe do instituto também marca", () => rpc(como(P.equipe), "rede_conv_aceitar", { p_resposta: a2, p_sim: true }), (r) => r.aceita === a2);
await espera("desmarcar só vale para a que está marcada", async () => {
  await rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: a1, p_sim: false });
  const antes = (await um("select aceita from interno.rede_posts where id = $1", [dupla])).aceita;
  const r = await rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: a2, p_sim: false });
  return [antes, r.aceita];
}, (r) => r[0] === a2 && r[1] === null);
await espera("quem marca a própria resposta não recebe aviso de si", async () => {
  const d = await postar({ tipo: "duvida", titulo: "Dúvida minha mesmo", corpo: "Respondo a minha própria dúvida." });
  const rr = await postar({ resposta_a: d }, P.autor, "eu mesma");
  await rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: rr, p_sim: true });
  return avisos(P.autor, "%resolveu%");
}, (n) => n === 0);
await espera("a dúvida travada ainda pode ser resolvida", async () => {
  const d = await postar({ tipo: "duvida", titulo: "Dúvida travada ok", corpo: "Esta conversa foi travada depois.", travado: true });
  const rr = await postar({ resposta_a: d }, P.membro, "resposta");
  return rpc(como(P.autor), "rede_conv_aceitar", { p_resposta: rr, p_sim: true });
}, (r) => Boolean(r.aceita));

// ── 28. A síntese fixada ──
await recusa("quem não abriu a conversa nem modera não escreve a síntese", () => rpc(como(P.outro), "rede_conv_sintese", { p_raiz: dupla, p_texto: "Resumo." }), "sem_permissao");
await recusa("a síntese é da raiz, não de uma resposta", () => rpc(como(P.autor), "rede_conv_sintese", { p_raiz: a1, p_texto: "Resumo." }), "nao_encontrado");
await recusa("síntese sem dado pessoal: CPF recusado", () => rpc(como(P.autor), "rede_conv_sintese", { p_raiz: dupla, p_texto: "Fale com 123.456.789-09" }), "dado_pessoal");
await recusa("síntese sem dado pessoal: e-mail recusado", () => rpc(como(P.autor), "rede_conv_sintese", { p_raiz: dupla, p_texto: "Escreva para alguem@exemplo.com" }), "dado_pessoal");
await recusa("síntese com mais de 1.500 caracteres é recusada", () => rpc(como(P.autor), "rede_conv_sintese", { p_raiz: dupla, p_texto: "a".repeat(1501) }), "invalido");
await recusa("visitante não escreve síntese", () => rpc(visitante(), "rede_conv_sintese", { p_raiz: dupla, p_texto: "x" }), "permission denied");
await espera("quem abriu a conversa escreve a síntese", () => rpc(como(P.autor), "rede_conv_sintese", { p_raiz: dupla, p_texto: "Resumo 1: o caminho é começar pela base." }), (r) => r.versoes === 1 && r.autor.includes("autor"));
await espera("a moderação escreve outra: a anterior sai do alto e fica no histórico", async () => {
  const r = await rpc(como(P.moderadora), "rede_conv_sintese", { p_raiz: dupla, p_texto: "Resumo 2: base primeiro, depois a prática." });
  const a = await arvore(P.membro, dupla);
  return [r.versoes, a.sintese.texto, a.sintese.versoes];
}, (r) => r[0] === 2 && r[1].startsWith("Resumo 2") && r[2] === 2);
await espera("o histórico traz as duas versões, a atual marcada, da mais nova para a mais antiga", async () => (await rpc(como(P.membro), "rede_conv_sintese_historico", { p_raiz: dupla })).map((v) => [v.texto.slice(0, 8), v.atual]), (r) => r.length === 2 && r[0][0] === "Resumo 2" && r[0][1] === true && r[1][0] === "Resumo 1" && r[1][1] === false);
await espera("a página diz quem pode escrever a síntese", async () => [(await arvore(P.autor, dupla)).pode_sintese, (await arvore(P.outro, dupla)).pode_sintese, (await arvore(P.moderadora, dupla)).pode_sintese], (r) => r.join() === "true,false,true");
await espera("texto vazio retira a síntese e o histórico continua", async () => {
  const r = await rpc(como(P.autor), "rede_conv_sintese", { p_raiz: dupla, p_texto: "   " });
  const a = await arvore(P.membro, dupla);
  const h = await rpc(como(P.membro), "rede_conv_sintese_historico", { p_raiz: dupla });
  return [r, a.sintese, h.length, h.every((v) => !v.atual)];
}, (r) => r[0] === null && r[1] === null && r[2] === 2 && r[3] === true);
await espera("o histórico de uma conversa que a pessoa não pode ver não existe", () => rpc(como(P.outro), "rede_conv_sintese_historico", { p_raiz: doNucleo }).then(() => "abriu", (e) => e.message), (m) => String(m).includes("nao_encontrado"));
await espera("visitante lê o histórico de conversa aberta à internet", async () => {
  await rpc(como(P.moderadora), "rede_conv_sintese", { p_raiz: aberta, p_texto: "Resumo da conversa aberta." });
  return (await rpc(visitante(), "rede_conv_sintese_historico", { p_raiz: aberta })).length;
}, (n) => n === 1);
await espera("o registro guarda quem marcou e quem escreveu a síntese", async () => (await um("select count(*)::int as n from interno.auditoria where acao like 'rede_resolveu%' or acao like 'rede_sintese%'")).n, (n) => n >= 5);

// ── 25. Menções ──
const publicar = (quem, p) => rpc(como(quem), "rede_publicar", { p });
await espera("a menção avisa a pessoa mencionada, com o codinome de quem escreveu", async () => {
  await publicar(P.autor, { texto: "Oi @membro_luta, olha isto aqui" });
  return avisos(P.membro, "%mencionou você%Oi @membro_luta%");
}, (n) => n === 1);
await espera("o aviso nunca leva o nome do painel", async () => (await um("select texto from interno.avisos where para = $1 and texto like '%mencionou%'", [P.membro])).texto.includes("autor@"), (v) => v === false);
await espera("quem se menciona não é avisado", async () => {
  await publicar(P.autor, { texto: "Falo comigo mesma @autor_luta" });
  return avisos(P.autor, "%mencionou%");
}, (n) => n === 0);
await espera("quem foi bloqueado pelo autor não é avisado", async () => {
  await publicar(P.autor, { texto: "Não é para @bloqueado_luta" });
  return avisos(P.bloqueado, "%mencionou%");
}, (n) => n === 0);
await espera("perfil invisível não é avisado", async () => {
  await publicar(P.autor, { texto: "Chamando @invisivel_luta" });
  return avisos(P.invisivel, "%mencionou%");
}, (n) => n === 0);
await espera("quem não entrou na Rede (sem consentimento) não é avisado", async () => {
  await publicar(P.autor, { texto: "Chamando @fora_luta" });
  return avisos(P.fora, "%mencionou%");
}, (n) => n === 0);
await espera("quem não pode ver o post não é avisado (núcleo)", async () => {
  await publicar(P.autor, { texto: "Reunião, @outro_luta", publico: "nucleo", nucleo });
  return avisos(P.outro, "%mencionou%");
}, (n) => n === 0);
await espera("quem é do núcleo é avisado da menção no núcleo", async () => {
  await publicar(P.autor, { texto: "Reunião, @membro_luta", publico: "nucleo", nucleo });
  return avisos(P.membro, "%Reunião%");
}, (n) => n === 1);
await espera("quem silenciou o autor não é avisado", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2) on conflict do nothing", [P.silenciadora, P.autor]);
  await publicar(P.autor, { texto: "Oi @silenciadora_luta" });
  return avisos(P.silenciadora, "%mencionou%");
}, (n) => n === 0);
await espera("a mesma pessoa citada duas vezes no mesmo post recebe um aviso só", async () => {
  await publicar(P.autor, { texto: "@outro_luta e de novo @outro_luta" });
  return avisos(P.outro, "%e de novo%");
}, (n) => n === 1);
await espera("no máximo 5 menções por post", async () => {
  for (const n of ["u1", "u2", "u3", "u4", "u5", "u6", "u7"]) {
    const id = await criarUsuario(`${n}@conversa.local`, n);
    await rpc(como(id), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [id, `Extra ${n}`, `extra_${n}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [id]);
    P[n] = id;
  }
  await dono("update auth.users set created_at = now() - interval '30 days'");
  await publicar(P.autor, { texto: "@extra_u1 @extra_u2 @extra_u3 @extra_u4 @extra_u5 @extra_u6 @extra_u7" });
  let total = 0;
  for (const n of ["u1", "u2", "u3", "u4", "u5", "u6", "u7"]) total += await avisos(P[n], "%mencionou%");
  return total;
}, (n) => n === 5);
await espera("post retido não avisa; quando a mediação libera, avisa uma vez", async () => {
  const x = await postar({ retido: true, oculto: true }, P.autor, "Retido para @extra_u3 ler");
  await dono("delete from interno.avisos where para = $1", [P.u3]);
  await dono("update interno.rede_posts set retido = false, oculto = false where id = $1", [x]);
  const depois = await avisos(P.u3, "%mencionou%");
  await dono("update interno.rede_posts set retido = true where id = $1", [x]);
  await dono("update interno.rede_posts set retido = false where id = $1", [x]);
  return [depois, await avisos(P.u3, "%mencionou%")];
}, (r) => r[0] === 1 && r[1] === 1);
await espera("e-mail no texto é recusado como dado pessoal (não vira menção)", () => publicar(P.autor, { texto: "escreva para fulano@exemplo.com" }).then(() => "passou", (e) => e.message), (m) => String(m).includes("dado_pessoal"));

// ── Sugestão de @ ──
await espera("sugerir devolve gente da Rede pelo começo do @handle", async () => (await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: "mem" })).map((x) => x.handle), (r) => r.join() === "membro_luta");
await espera("sugerir ignora o @ digitado e as maiúsculas", async () => (await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: "@MEM" })).length, (n) => n === 1);
await espera("sugerir não mostra perfil invisível, bloqueado, a si mesma nem quem não entrou na Rede", async () => {
  const achados = (await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: "", p_post: dupla })).map((x) => x.handle);
  for (const l of ["i", "b", "a", "f", "e", "m", "o"]) achados.push(...(await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: l })).map((x) => x.handle));
  return achados.filter((h) => ["invisivel_luta", "bloqueado_luta", "autor_luta", "fora_luta"].includes(h));
}, (r) => r.length === 0);
await espera("com o post, quem já está na conversa vem primeiro", async () => (await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: "", p_post: dupla })).map((x) => x.handle).slice(0, 3).sort().join(), (r) => r === "membro_luta,moderadora_luta,outro_luta");
await espera("com post restrito, só entra quem pode ver o post", async () => (await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: "", p_post: doNucleo })).map((x) => x.handle), (r) => r.join() === "membro_luta");
await espera("sugerir sem prefixo e sem post não devolve ninguém", async () => (await rpc(como(P.autor), "rede_conv_sugerir", { p_prefixo: "" })).length, (n) => n === 0);
await recusa("visitante não pede sugestão", () => rpc(visitante(), "rede_conv_sugerir", { p_prefixo: "me" }), "permission denied");
await recusa("quem não entrou na Rede não pede sugestão", () => rpc(como(P.fora), "rede_conv_sugerir", { p_prefixo: "me" }), "consentimento");

// ── 26. Citar ──
const alvo = await postar({ publico: "membros" }, P.membro, "Texto do post citado, bem visível");
const alvoNucleo = await postar({ publico: "nucleo", nucleo }, P.membro, "Texto do núcleo, só do núcleo");
await espera("citar liga o post e o trecho aparece para quem pode ver o original", async () => {
  const c = await rpc(como(P.autor), "rede_conv_citar", { p: { texto: "Concordo com isto", citar: alvo } });
  const v = await rpc(como(P.outro), "rede_post", { p_id: c.id });
  return [c.citado.id, v.post.citado.trecho];
}, (r) => r[0] === alvo && r[1].startsWith("Texto do post citado"));
await espera("quem foi citado é avisado; quem se cita não", async () => {
  const antes = await avisos(P.membro, "%citou o seu post%");
  const meu = await postar({ publico: "membros" }, P.autor, "meu próprio post");
  await rpc(como(P.autor), "rede_conv_citar", { p: { texto: "Citando a mim mesma", citar: meu } });
  return [antes, await avisos(P.autor, "%citou o seu post%")];
}, (r) => r[0] >= 1 && r[1] === 0);
await espera("citar um post do núcleo num post para membros: quem é de fora vê só 'conteúdo restrito'", async () => {
  const c = await rpc(como(P.autor), "rede_conv_citar", { p: { texto: "Citando o núcleo", citar: alvoNucleo } });
  const fora = await rpc(como(P.outro), "rede_post", { p_id: c.id });
  const dentro = await rpc(como(P.membro), "rede_post", { p_id: c.id });
  return [fora.post.citado, JSON.stringify(fora.post).includes("Texto do núcleo"), dentro.post.citado.trecho];
}, (r) => r[0].restrito === true && r[1] === false && r[2].startsWith("Texto do núcleo"));
await recusa("não se cita o que não se pode ver", () => rpc(como(P.outro), "rede_conv_citar", { p: { texto: "Citando às cegas", citar: alvoNucleo } }), "nao_encontrado");
await recusa("citar sem dizer o quê", () => rpc(como(P.autor), "rede_conv_citar", { p: { texto: "Citando nada" } }), "invalido:citar");
await recusa("citar com id inválido", () => rpc(como(P.autor), "rede_conv_citar", { p: { texto: "Citando mal", citar: "nao-e-um-id" } }), "invalido:citar");
await recusa("citar não pula as regras de publicar (dado pessoal)", () => rpc(como(P.autor), "rede_conv_citar", { p: { texto: "Meu CPF 123.456.789-09", citar: alvo } }), "dado_pessoal");
await recusa("visitante não cita", () => rpc(visitante(), "rede_conv_citar", { p: { texto: "x", citar: alvo } }), "permission denied");
await espera("citar um post removido não é possível", async () => {
  const r = await postar({ oculto: true }, P.membro, "removido");
  return rpc(como(P.autor), "rede_conv_citar", { p: { texto: "x", citar: r } }).then(() => "passou", (e) => e.message);
}, (m) => String(m).includes("nao_encontrado"));

// ── As contas puras do cliente (lib/rede/tipos-conversa.ts) ──
await espera("trechosComMencoes separa o texto sem perder letra e acha só menção de verdade", () => {
  const texto = "Oi @Ana_luta, veja com @bia e a@ex.com e @@x @ab e @carlos99!";
  const t = trechosComMencoes(texto);
  return [t.map((x) => x.valor).join("") === texto, t.filter((x) => x.tipo === "mencao").map((x) => x.handle)];
}, (r) => r[0] === true && r[1].join() === "ana_luta,bia,carlos99");
await espera("mencaoEmDigitacao acha o @ sob o cursor e inserirMencao troca por @nome com espaço", () => {
  const a = mencaoEmDigitacao("olá @me", 7);
  const b = mencaoEmDigitacao("olá @membro_luta pronto", 4);
  const c = mencaoEmDigitacao("email a@b", 9);
  const novo = inserirMencao("olá @me e mais", 7, "membro_luta");
  return [a, b, c, novo];
}, (r) => r[0].prefixo === "me" && r[0].inicio === 4 && r[1] === null && r[2] === null && r[3].texto === "olá @membro_luta e mais" && r[3].cursor === 17);
await espera("montarArvore e o nível 6: a cadeia vira filhas aninhadas e o 5º nível abaixo continua em outra página", () => {
  const post = (id, pai, respostas) => ({ id, resposta_a: pai, respostas });
  const lista = [post("a", "raiz", 1), post("b", "a", 1), post("c", "b", 1), post("d", "c", 1), post("e", "d", 1), post("orfa", "sumiu", 0), post("f2", "raiz", 0)];
  const nos = montarArvore("raiz", lista);
  const fila = [];
  const andar = (n) => { fila.push(n); n.filhos.forEach(andar); };
  nos.forEach(andar);
  return [nos.length, fila.map((n) => n.post.id + n.nivel).join(), fila.filter(continuaEmOutraPagina).map((n) => n.post.id), recuoDoNivel(1), recuoDoNivel(9)];
}, (r) => r[0] === 2 && r[1] === "a1,b2,c3,d4,e5,f21" && r[2].join() === "e" && r[3] === 0 && r[4] === 4);

// ── Permissões ──
await espera("nenhuma função interna do pacote é executável por anon ou authenticated", async () => todos(`select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r
  where n.nspname = 'interno' and p.proname like 'rede3\\_conv\\_%' and r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, p.oid, 'execute')`), (r) => r.length === 0);
await espera("as tabelas novas ficam fechadas (RLS e nenhuma permissão para os papéis do cliente)", async () => todos(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join pg_roles r
  where n.nspname = 'interno' and c.relname in ('rede_sinteses', 'rede_mencoes') and (not c.relrowsecurity or (r.rolname in ('anon', 'authenticated') and has_table_privilege(r.oid, c.oid, 'select')))`), (r) => r.length === 0);
await espera("nada novo no esquema public além das funções", async () => todos("select tablename from pg_tables where schemaname = 'public' and tablename like 'rede%'"), (r) => r.length === 0);
await espera("anon executa só a leitura (árvore e histórico da síntese)", async () => um(`select
  has_function_privilege('anon', 'public.rede_conv_arvore(uuid, text)', 'execute') as arvore, has_function_privilege('anon', 'public.rede_conv_sintese_historico(uuid)', 'execute') as historico,
  has_function_privilege('anon', 'public.rede_conv_aceitar(uuid, boolean)', 'execute') as aceitar, has_function_privilege('anon', 'public.rede_conv_sintese(uuid, text)', 'execute') as sintese,
  has_function_privilege('anon', 'public.rede_conv_sugerir(text, uuid)', 'execute') as sugerir, has_function_privilege('anon', 'public.rede_conv_citar(jsonb)', 'execute') as citar,
  has_function_privilege('authenticated', 'public.rede_conv_citar(jsonb)', 'execute') as citar_auth`), (r) => r.arvore && r.historico && !r.aceitar && !r.sintese && !r.sugerir && !r.citar && r.citar_auth);
await espera("nenhuma função do pacote sai sem search_path fixo", async () => todos("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prosecdef and p.proname like 'rede%conv%' and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))"), (r) => r.length === 0);

// ── O cliente, os tipos e os textos ──
await espera("os arquivos do pacote existem, sem atalhos '@/' nos de lib, e o cliente chama as funções do contrato", async () => {
  const tipos = lerTexto("lib/rede/tipos-conversa.ts");
  const cliente = lerTexto("lib/rede/cliente-conversa.ts");
  const textos = lerTexto("lib/rede/textos-conversa.ts");
  const funcoes = ["rede_conv_arvore", "rede_conv_aceitar", "rede_conv_sintese", "rede_conv_sintese_historico", "rede_conv_sugerir", "rede_conv_citar"];
  return [/from "@\//.test(tipos), /from "@\//.test(cliente), /from "@\//.test(textos), funcoes.every((f) => cliente.includes(`"${f}"`)), fs.existsSync(new URL("../components/rede/conversa/TelaDaConversa.tsx", import.meta.url))];
}, (r) => r[0] === false && r[1] === false && r[2] === false && r[3] && r[4]);
await espera("os seis idiomas do pacote têm as mesmas chaves (pt final; os outros rascunho marcado) e a fórmula escrita", async () => {
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const pt = JSON.parse(lerTexto("i18n/rede/conversa/pt.json"));
  const base = achatar(pt).filter((k) => k !== "_rascunho").sort();
  const r = { formula: typeof pt.ordem.formulaUteis === "string" && pt.ordem.formulaUteis.length > 40, ptFinal: pt._rascunho !== true };
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/conversa/${l}.json`));
    r[l] = JSON.stringify(achatar(j).filter((k) => k !== "_rascunho").sort()) === JSON.stringify(base) && j._rascunho === true;
  }
  return r;
}, (r) => Object.values(r).every(Boolean));
await espera("a tela da conversa não usa window.alert/confirm/prompt", async () => {
  const dir = new URL("../components/rede/conversa/", import.meta.url);
  return fs.readdirSync(dir).map((f) => fs.readFileSync(new URL(f, dir), "utf8")).filter((t) => /\b(window\.)?(alert|confirm|prompt)\(/.test(t)).length;
}, (n) => n === 0);

console.log(`Rede v2 (conversa): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
