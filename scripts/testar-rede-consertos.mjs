// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote "consertos" da Rede (supabase/migracoes/2026-11-rede-consertos.sql, itens 1 a 9 do R4) num Postgres de
// verdade dentro do Node: contagens de apoio e "eu vou" só para autor/organizador (no SQL), idade mínima 18 (declaração de
// menos de 18 deixa a pessoa fora só da Rede e não se desfaz por um clique), paginação por cursor, "N novos" por aba, posts da
// Rede na segunda avaliação externa (tipo 'rede'), convites com hash, validade, limite de usos e revogação (e o código antigo em
// texto, que expira), e as permissões. Também confere o contrato dos tipos, do cliente e dos textos. Uso: npm run testar:rede-consertos
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { agruparConvite, conviteAntigoOk, conviteNovoOk, conviteOk, IDADE_MINIMA_REDE, normalizarConvite, rotuloDosNovos } from "../lib/rede/tipos-consertos.ts";
import { criarClienteConsertos } from "../lib/rede/cliente-consertos.ts";

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
const migracoes = ["fundacao", "consertos"].map((n) => lerTexto(`supabase/migracoes/2026-11-rede-${n}.sql`));

for (const sql of migracoes) await espera("a migração instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(sql)));
await espera("instalar os consertos de novo não quebra", () => banco.exclusivo(() => banco.pg.exec(migracoes[1])));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });
const servico = () => ({ papel: "service_role", ip: `192.0.2.${ip++}` });

// ── As pessoas ──
const pessoas = {};
const nomes = ["autor", "outro", "equipe", "menor", "sem18", "mediacao", "membro", "semconsent", "estranho"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@consertos.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Lutadora ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis where usuario <> $1", [pessoas.equipe]);
await dono("insert into interno.papeis (usuario, papel) select $1, 'educacao' where not exists (select 1 from interno.papeis where usuario = $1)", [pessoas.equipe]);
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of ["autor", "outro", "equipe", "mediacao", "membro", "estranho"]) {
  await dono("update interno.perfis set rede_18 = true, rede_16 = true where id = $1", [pessoas[nome]]);
}
for (const nome of ["autor", "outro", "equipe", "mediacao", "membro"]) {
  await dono("update interno.perfis set rede_consentimento = 1 where id = $1", [pessoas[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas[nome]]);
}
// Quem confirmou só os 16 anos (o que a Rede de hoje pedia): rede_16 verdadeiro, rede_18 falso.
await dono("update interno.perfis set rede_16 = true where id = $1", [pessoas.sem18]);
await dono("update auth.users set created_at = now() - interval '30 days'");

const postar = (quem, p) => rpc(como(pessoas[quem]), "rede_postar", { p });
const linha = (quem, modo, extra = {}) => rpc(quem === null ? visitante() : como(pessoas[quem]), "rede_fix_linha", { p_modo: modo, ...extra });

// ── 1. Contagens só para quem precisa (no SQL, não só na tela) ──
const post = await postar("autor", { texto: "Mutirão de leitura no sábado, tragam café." });
await espera("autor posta", () => Promise.resolve(post), (p) => p.id && p.meu === true);
await rpc(como(pessoas.outro), "rede_apoiar", { p_id: post.id, p_sim: true });
await rpc(como(pessoas.membro), "rede_apoiar", { p_id: post.id, p_sim: true });
const doAutor = (await linha("autor", "tudo")).itens.find((p) => p.id === post.id);
const doOutro = (await linha("outro", "tudo")).itens.find((p) => p.id === post.id);
const doVisitante = (await linha(null, "tudo")).itens.find((p) => p.id === post.id);
await espera("autor vê o total de apoios", () => Promise.resolve(doAutor), (p) => Number(p.apoios) === 2);
await espera("outra pessoa não recebe o total de apoios (nulo)", () => Promise.resolve(doOutro), (p) => p.apoios === null && p.apoiei === true);
await espera("visitante não recebe o total de apoios", () => Promise.resolve(doVisitante), (p) => p.apoios === null);
await espera("o post avulso (rede_post_ver) também esconde o total de apoios", () => rpc(como(pessoas.outro), "rede_post_ver", { p_id: post.id }), (r) => r.post.apoios === null);
await espera("a busca também esconde o total", () => rpc(como(pessoas.outro), "rede_buscar", { p_termo: "Mutirão" }), (r) => r.length === 1 && r[0].apoios === null);
await espera("a função antiga rede_linha também esconde", () => rpc(como(pessoas.outro), "rede_linha", { p_modo: "tudo" }), (r) => r.every((p) => p.apoios === null || p.meu));

const quando = new Date(Date.now() + 3 * 86400_000).toISOString();
const chamado = await postar("autor", { texto: "Assembleia da rua", chamado: { tipo: "assembleia", quando, onde: "Praça da Estação" } });
const r1 = await rpc(como(pessoas.outro), "rede_vou", { p_id: chamado.id, p_sim: true });
await rpc(como(pessoas.membro), "rede_vou", { p_id: chamado.id, p_sim: true });
await espera("quem marca 'eu vou' não recebe o total", () => Promise.resolve(r1), (r) => r.ok === true && r.vou === null);
await espera("o organizador vê o total de 'eu vou'", async () => (await linha("autor", "tudo")).itens.find((p) => p.id === chamado.id), (p) => Number(p.vou) === 2);
await espera("quem não organizou vê 'vou' nulo e o próprio estado", async () => (await linha("outro", "tudo")).itens.find((p) => p.id === chamado.id), (p) => p.vou === null && p.vou_eu === true);
await espera("o organizador, ao chamar rede_vou, recebe o total", () => rpc(como(pessoas.autor), "rede_vou", { p_id: chamado.id, p_sim: true }), (r) => Number(r.vou) === 3);
// O número de respostas só conta o que a pessoa pode ver.
await rpc(como(pessoas.outro), "rede_postar", { p: { texto: "uma resposta visível", resposta_a: post.id } });
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.estranho, pessoas.outro]);
await espera("respostas de quem a pessoa bloqueou não entram na conta dela", async () => (await linha("estranho", "tudo")).itens.find((p) => p.id === post.id), (p) => Number(p.respostas) === 0);
await espera("para os outros a resposta conta", async () => (await linha("membro", "tudo")).itens.find((p) => p.id === post.id), (p) => Number(p.respostas) === 1);

// ── 2. Idade mínima 18 ──
await recusa("quem só confirmou 16 não posta mais na Rede de hoje", () => postar("sem18", { texto: "oi" }), "confirme_idade");
await recusa("quem não confirmou 18 não apoia", () => rpc(como(pessoas.sem18), "rede_apoiar", { p_id: post.id, p_sim: true }), "confirme_idade");
await espera("rede_eu diz que falta confirmar", () => rpc(como(pessoas.sem18), "rede_eu"), (r) => r.rede_18 === false && r.menor === false);
await espera("quem confirma 18 posta", async () => {
  await rpc(como(pessoas.sem18), "rede_confirmar_idade", { p_maior: true });
  return postar("sem18", { texto: "agora confirmei os 18" });
}, (p) => p.id);
await espera("a chamada antiga, sem argumento, confirma 18", async () => {
  await dono("update interno.perfis set rede_18 = false where id = $1", [pessoas.estranho]);
  await rpc(como(pessoas.estranho), "rede_confirmar_idade");
  return um("select rede_18 from interno.perfis where id = $1", [pessoas.estranho]);
}, (r) => r.rede_18 === true);
await espera("quem declara ter menos de 18 fica fora: resposta gentil", () => rpc(como(pessoas.menor), "rede_confirmar_idade", { p_maior: false }), (r) => r.ok === false && r.menor === true);
await espera("rede_eu mostra 'menor' para a tela dar a mensagem", () => rpc(como(pessoas.menor), "rede_eu"), (r) => r.menor === true && r.rede_18 === false);
await recusa("menor não posta", () => postar("menor", { texto: "oi" }), "idade_minima");
await recusa("menor não lê a linha (só a Rede)", () => linha("menor", "tudo"), "idade_minima");
await recusa("menor não lê a linha antiga", () => rpc(como(pessoas.menor), "rede_linha", { p_modo: "tudo" }), "idade_minima");
await recusa("menor não abre um post", () => rpc(como(pessoas.menor), "rede_post_ver", { p_id: post.id }), "idade_minima");
await recusa("menor não busca", () => rpc(como(pessoas.menor), "rede_buscar", { p_termo: "Mutirão" }), "idade_minima");
await recusa("menor não apoia", () => rpc(como(pessoas.menor), "rede_apoiar", { p_id: post.id, p_sim: true }), "idade_minima");
await recusa("menor não vira 18 por um clique depois", () => rpc(como(pessoas.menor), "rede_confirmar_idade", { p_maior: true }), "idade_minima");
await recusa("nem por update direto (a trava está no banco)", () => dono("update interno.perfis set rede_18 = true where id = $1", [pessoas.menor]), "idade_minima");
await recusa("rede_aderir da v2 também não deixa", () => rpc(como(pessoas.menor), "rede_aderir", { p_maior: true, p_versao: 1 }), "idade_minima");
await espera("o resto do site segue aberto: o painel da conta responde", () => rpc(como(pessoas.menor), "eu"), (r) => r && r.id === pessoas.menor);
await recusa("só a mediação desfaz a marca", () => rpc(como(pessoas.outro), "rede_fix_idade_rever", { p_usuario: pessoas.menor }), "sem_permissao");
await espera("a mediação desfaz um engano (registrado)", async () => {
  await rpc(como(pessoas.equipe), "rede_fix_idade_rever", { p_usuario: pessoas.menor });
  return um("select rede_menor_em from interno.perfis where id = $1", [pessoas.menor]);
}, (r) => r.rede_menor_em === null);
await espera("depois disso a pessoa confirma 18 e posta", async () => {
  await rpc(como(pessoas.menor), "rede_confirmar_idade", { p_maior: true });
  await dono("update interno.perfis set rede_consentimento = 1 where id = $1", [pessoas.menor]);
  return postar("menor", { texto: "voltei" });
}, (p) => p.id);
await espera("visitante lê a linha pública (a idade só vale para conta)", () => linha(null, "tudo"), (r) => Array.isArray(r.itens));

// ── 3. Paginação por cursor ──
const base = Date.now() - 3 * 3600_000;
for (let i = 0; i < 45; i++) {
  // Três posts por instante: o desempate pelo id precisa funcionar.
  await dono("insert into interno.rede_posts (autor, texto, criado_em, publico, alcance) values ($1, $2, $3, 'internet', 'publico')", [pessoas.autor, `post de volume ${i}`, new Date(base + Math.floor(i / 3) * 1000).toISOString()]);
}
const ids = [];
let cursor = null;
let paginas = 0;
for (;;) {
  const pg = await linha("outro", "tudo", { p_cursor: cursor, p_limite: 20 });
  paginas++;
  for (const p of pg.itens) ids.push(p.id);
  cursor = pg.proximo;
  if (!cursor || paginas > 10) break;
}
await espera("a paginação percorre tudo, sem repetir", () => Promise.resolve(ids), (l) => new Set(l).size === l.length && l.length >= 47);
await espera("a primeira página tem 20 e há próxima", async () => linha("outro", "tudo"), (r) => r.itens.length === 20 && typeof r.proximo === "string");
await espera("o limite máximo é 50", async () => linha("outro", "tudo", { p_limite: 500 }), (r) => r.itens.length > 20 && r.itens.length <= 50);
const p1 = await linha("outro", "tudo", { p_limite: 10 });
await dono("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'chegou no meio da leitura', 'internet', 'publico')", [pessoas.autor]);
const p2 = await linha("outro", "tudo", { p_limite: 10, p_cursor: p1.proximo });
await espera("post que chega no meio não repete nem empurra a página", () => Promise.resolve(p2), (r) => r.itens.every((x) => !p1.itens.some((y) => y.id === x.id)) && !r.itens.some((x) => x.texto === "chegou no meio da leitura"));
await recusa("cursor inválido é recusado", () => linha("outro", "tudo", { p_cursor: "lixo" }), "invalido:cursor");
await recusa("modo inválido é recusado", () => linha("outro", "inexistente"), "invalido:modo");
await espera("o modo 'chamados' vem numa página só", () => linha("outro", "chamados"), (r) => r.proximo === null && r.itens.some((p) => p.id === chamado.id));
await espera("o modo 'seguindo' só traz quem a pessoa segue (e ela mesma)", async () => {
  await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2) on conflict do nothing", [pessoas.membro, pessoas.autor]);
  return linha("membro", "seguindo");
}, (r) => r.itens.length > 0 && r.itens.every((p) => p.autor.id === pessoas.autor || p.autor.id === pessoas.membro));
await espera("o perfil invisível devolve página vazia", async () => {
  await dono("update interno.perfis set rede_invisivel = true where id = $1", [pessoas.autor]);
  const r = await linha("outro", "perfil", { p_usuario: pessoas.autor });
  await dono("update interno.perfis set rede_invisivel = false where id = $1", [pessoas.autor]);
  return r;
}, (r) => r.itens.length === 0 && r.proximo === null);

// ── 4. "N novos" por aba ──
const antes = new Date().toISOString();
await new Promise((r) => setTimeout(r, 40));
await dono("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'novo do autor', 'internet', 'publico')", [pessoas.autor]);
await dono("insert into interno.rede_posts (autor, texto, publico, alcance) values ($1, 'novo do outro', 'internet', 'publico')", [pessoas.outro]);
await espera("'N novos' da aba Tudo conta só posts de outras pessoas", () => rpc(como(pessoas.membro), "rede_fix_novos", { p_modo: "tudo", p_comunidade: null, p_usuario: null, p_desde: antes }), (n) => n === 2);
await espera("'N novos' da aba Seguindo conta só de quem a pessoa segue", () => rpc(como(pessoas.membro), "rede_fix_novos", { p_modo: "seguindo", p_comunidade: null, p_usuario: null, p_desde: antes }), (n) => n === 1);
await espera("quem escreveu não conta os próprios posts como novos", () => rpc(como(pessoas.autor), "rede_fix_novos", { p_modo: "tudo", p_comunidade: null, p_usuario: null, p_desde: antes }), (n) => n === 1);
await espera("todas as abas de uma vez, cada uma com a sua data", () => rpc(como(pessoas.membro), "rede_fix_novos_abas", { p_desde: { seguindo: antes, minhas: antes, tudo: new Date().toISOString() } }), (r) => r.seguindo === 1 && r.minhas === 0 && r.tudo === 0);
await espera("aba sem data fica de fora e data ruim não quebra", () => rpc(como(pessoas.membro), "rede_fix_novos_abas", { p_desde: { tudo: "ontem à noite" } }), (r) => !("tudo" in r) && !("seguindo" in r));
await espera("o contador não passa de 100", async () => {
  await dono("insert into interno.rede_posts (autor, texto, publico, alcance) select $1, 'enchente ' || g, 'internet', 'publico' from generate_series(1, 120) g", [pessoas.outro]);
  return rpc(como(pessoas.membro), "rede_fix_novos", { p_modo: "tudo", p_comunidade: null, p_usuario: null, p_desde: antes });
}, (n) => n === 100);
await espera("rotuloDosNovos mostra 99+ no teto", () => Promise.resolve([rotuloDosNovos(5), rotuloDosNovos(100)]), (l) => l[0] === "5" && l[1] === "99+");

// ── 5. Segunda avaliação externa: o ramo 'rede' ──
await dono("insert into interno.configuracoes (chave, valor) values ('comunidade', '{\"avaliacao_externa\": true}'::jsonb) on conflict (chave) do update set valor = interno.configuracoes.valor || '{\"avaliacao_externa\": true}'::jsonb");
const espera1 = await postar("autor", { texto: "Um post comum que espera a segunda avaliação." });
await espera("com a avaliação externa ligada o post pede avaliação e nasce retido", () => Promise.resolve(espera1), (p) => p.avaliar === true && p.retido === true);
await espera("o motivo é 'aguardando_avaliacao' e ninguém mais o vê", async () => ({
  linha: await um("select retido, oculto, motivo from interno.rede_posts where id = $1", [espera1.id]),
  outro: (await linha("outro", "tudo")).itens.some((p) => p.id === espera1.id),
}), (r) => r.linha.retido && r.linha.oculto && r.linha.motivo === "aguardando_avaliacao" && r.outro === false);
await recusa("a avaliação é só do serviço (autenticado não pega o texto)", () => rpc(como(pessoas.autor), "comunidade_para_avaliar", { p_tipo: "rede", p_id: espera1.id }), "sem_permissao");
await espera("o serviço pega o texto do post da Rede para avaliar", () => rpc(servico(), "comunidade_para_avaliar", { p_tipo: "rede", p_id: espera1.id }), (r) => r && r.texto.includes("segunda avaliação"));
await espera("enquanto avalia, o post não é entregue de novo", () => rpc(servico(), "comunidade_para_avaliar", { p_tipo: "rede", p_id: espera1.id }), (r) => r === null);
await espera("resultado limpo publica", () => rpc(servico(), "comunidade_avaliada", { p_tipo: "rede", p_id: espera1.id, p_resultado: { sinalizado: false, categorias: {}, notas: { hate: 0.01, violence: 0.02 } } }), (r) => r.veredito === "publicar");
await espera("publicado, o post aparece para os outros", async () => (await linha("outro", "tudo")).itens.some((p) => p.id === espera1.id), (v) => v === true);
const espera2 = await postar("autor", { texto: "Outro post para avaliar com ameaça." });
await rpc(servico(), "comunidade_para_avaliar", { p_tipo: "rede", p_id: espera2.id });
await espera("ameaça apontada com clareza barra", () => rpc(servico(), "comunidade_avaliada", { p_tipo: "rede", p_id: espera2.id, p_resultado: { sinalizado: true, categorias: { "harassment/threatening": true }, notas: { harassment: 0.95 } } }), (r) => r.veredito === "bloquear");
const espera3 = await postar("autor", { texto: "Terceiro post, o serviço de avaliação falha." });
await rpc(servico(), "comunidade_para_avaliar", { p_tipo: "rede", p_id: espera3.id });
await espera("falha da avaliação nunca publica: vai para a fila de revisão", () => rpc(servico(), "comunidade_avaliada", { p_tipo: "rede", p_id: espera3.id, p_resultado: { erro: "fora_do_ar" } }), (r) => r.veredito === "revisar");
await espera("o post em revisão segue oculto", () => um("select oculto, retido from interno.rede_posts where id = $1", [espera3.id]), (r) => r.oculto === true && r.retido === true);
const espera4 = await postar("outro", { texto: "Resposta que espera a avaliação.", resposta_a: post.id });
const avisosAntes = Number((await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.autor])).n);
await rpc(servico(), "comunidade_para_avaliar", { p_tipo: "rede", p_id: espera4.id });
await rpc(servico(), "comunidade_avaliada", { p_tipo: "rede", p_id: espera4.id, p_resultado: { sinalizado: false, categorias: {}, notas: { hate: 0.01 } } });
await espera("a resposta publicada depois da avaliação avisa quem foi respondido", async () => Number((await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.autor])).n), (n) => n === avisosAntes + 1);
const espera5 = await postar("autor", { texto: "Quinto post, ainda não avaliado." });
await espera("a recuperação lista o post da Rede que ficou esperando", () => rpc(servico(), "comunidade_pendentes"), (l) => l.some((i) => i.tipo === "rede" && i.id === espera5.id) && !l.some((i) => i.id === espera1.id));
await espera("avaliar post já decidido é ignorado", () => rpc(servico(), "comunidade_avaliada", { p_tipo: "rede", p_id: espera1.id, p_resultado: { sinalizado: false, categorias: {}, notas: { hate: 0.01 } } }), (r) => r.veredito === "ignorado");
await recusa("tipo desconhecido continua recusado", () => rpc(servico(), "comunidade_para_avaliar", { p_tipo: "lixo", p_id: espera1.id }), "invalido:tipo");
await espera("o ramo dos tópicos do Fórum segue funcionando (sem pendência = lista sem erro)", () => rpc(servico(), "comunidade_pendentes"), (l) => Array.isArray(l));
await dono("update interno.configuracoes set valor = valor || '{\"avaliacao_externa\": false}'::jsonb where chave = 'comunidade'");
await espera("com a avaliação desligada o post publica direto", () => postar("autor", { texto: "Sem avaliação externa, publica direto." }), (p) => p.avaliar === false && p.retido === false);

// ── 6. Convites com hash, validade, limite de usos e revogação ──
const espaco = await rpc(como(pessoas.equipe), "rede_espaco_criar", { p_nome: "Núcleo de teste dos consertos", p_descricao: "" });
await espera("o espaço nasce com um convite de código novo (32 caracteres)", () => Promise.resolve(espaco), (r) => conviteNovoOk(r.codigo) && /^fechado-/.test(r.slug));
await espera("o banco guarda só o hash do código", async () => {
  const linhas = await todos("select token_hash, usos_max, usos from interno.rede_convites where espaco = $1", [espaco.slug]);
  const hash = (await um("select encode(sha256(convert_to($1, 'UTF8')), 'hex') as h", [espaco.codigo])).h;
  const texto = await um("select count(*)::int as n from interno.rede_convites where token_hash = $1 or token_hash like '%' || $1 || '%'", [espaco.codigo]);
  return { linhas, hash, achouTexto: texto.n };
}, (r) => r.linhas.length === 1 && r.linhas[0].token_hash === r.hash && r.achouTexto === 0 && r.linhas[0].usos_max === 20);
await espera("o código antigo em texto do espaço novo já nasce vencido e sem uso", async () => um("select codigo_expira_em <= now() as vencido from interno.rede_espacos where slug = $1", [espaco.slug]), (r) => r.vencido === true);
await espera("entrar com o código novo funciona (aceita traços e maiúsculas)", () => rpc(como(pessoas.membro), "rede_espaco_entrar", { p_codigo: agruparConvite(espaco.codigo).toUpperCase() }), (r) => r.tipo === "espaco" && r.slug === espaco.slug);
await espera("quem já é do espaço entra de novo sem gastar um uso", async () => {
  await rpc(como(pessoas.membro), "rede_fix_convite_usar", { p_codigo: espaco.codigo });
  return um("select usos from interno.rede_convites where espaco = $1", [espaco.slug]);
}, (r) => r.usos === 1);
await espera("o espaço aparece em 'meus espaços' sem nenhum código", () => rpc(como(pessoas.equipe), "rede_meus_espacos"), (l) => l.length === 1 && l[0].codigo === null && l[0].cuido === true && l[0].convites === 1);
await recusa("quem não cuida não gera convite", () => rpc(como(pessoas.membro), "rede_fix_convite_criar", { p_alvo: espaco.slug }), "sem_permissao");
await recusa("quem não cuida não lista convites", () => rpc(como(pessoas.membro), "rede_fix_convites_listar", { p_alvo: espaco.slug }), "sem_permissao");
await recusa("visitante não gera convite", () => rpc(visitante(), "rede_fix_convite_criar", { p_alvo: espaco.slug }), "permission denied");
await recusa("validade fora de 1 a 30 dias é recusada", () => rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: espaco.slug, p_dias: 90 }), "invalido:dias");
await recusa("usos fora de 1 a 200 é recusado", () => rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: espaco.slug, p_usos: 0 }), "invalido:usos");
const um1 = await rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: espaco.slug, p_dias: 2, p_usos: 1 });
await espera("convite de um uso", () => Promise.resolve(um1), (r) => conviteNovoOk(r.codigo) && r.usos_max === 1);
await espera("o primeiro a usar entra", () => rpc(como(pessoas.outro), "rede_fix_convite_usar", { p_codigo: um1.codigo }), (r) => r.slug === espaco.slug);
const naoVale = (nome, promessa) => espera(nome, promessa, (r) => r.ok === false && r.erro === "convite_vencido");
await naoVale("o limite de usos vale: a segunda pessoa não entra", () => rpc(como(pessoas.autor), "rede_fix_convite_usar", { p_codigo: um1.codigo }));
const rev = await rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: espaco.slug, p_dias: 5, p_usos: 5 });
await espera("revogar um convite", () => rpc(como(pessoas.equipe), "rede_fix_convite_revogar", { p_id: rev.id }), (r) => r.ok === true);
await naoVale("convite revogado não entra", () => rpc(como(pessoas.autor), "rede_fix_convite_usar", { p_codigo: rev.codigo }));
await recusa("quem não cuida não revoga", () => rpc(como(pessoas.membro), "rede_fix_convite_revogar", { p_id: rev.id }), "sem_permissao");
await espera("a rotina de manutenção só roda com a chave de serviço", async () => {
  try {
    await rpc(como(pessoas.equipe), "rede_fix_manutencao");
    return false;
  } catch {
    return true;
  }
}, (v) => v === true);
await espera("a manutenção troca os códigos vencidos", async () => {
  await dono("insert into interno.rede_espacos (slug, nome, criado_por, codigo, codigo_expira_em) values ('fechado-antigo-3', 'Outro vencido', $1, 'QqWwEeRr1122', now() - interval '2 days')", [pessoas.equipe]);
  await rpc(servico(), "rede_fix_manutencao");
  return um("select codigo, codigo_apagado_em is not null as apagado from interno.rede_espacos where slug = 'fechado-antigo-3'");
}, (r) => r.codigo !== "QqWwEeRr1122" && r.apagado === true);
const vel = await rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: espaco.slug, p_dias: 1, p_usos: 5 });
await dono("update interno.rede_convites set validade = now() - interval '1 minute' where id = $1", [vel.id]);
await naoVale("convite vencido pela data não entra", () => rpc(como(pessoas.autor), "rede_fix_convite_usar", { p_codigo: vel.codigo }));
await naoVale("código errado é 'convite_vencido' (não diz por quê)", () => rpc(como(pessoas.autor), "rede_fix_convite_usar", { p_codigo: "0123456789abcdef0123456789abcdef" }));
await naoVale("lixo no lugar do código também", () => rpc(como(pessoas.autor), "rede_fix_convite_usar", { p_codigo: "xx" }));
await espera("a lista de convites mostra estado e usos, sem código nem hash", async () => rpc(como(pessoas.equipe), "rede_fix_convites_listar", { p_alvo: espaco.slug }), (l) => l.length === 4 && l.every((c) => !("token_hash" in c) && !("codigo" in c)) && l.some((c) => c.revogado) && l.some((c) => c.vencido && !c.revogado));
await recusa("convite não serve para quem não confirmou 18", () => rpc(como(pessoas.semconsent), "rede_fix_convite_usar", { p_codigo: um1.codigo }), "confirme_idade");
await espera("o código antigo ainda vale dentro dos 30 dias (e a mediação foi avisada na migração)", async () => {
  await dono("insert into interno.rede_espacos (slug, nome, criado_por, codigo, codigo_expira_em) values ('fechado-antigo-1', 'Espaço antigo', $1, 'AbCdEfGh1234', now() + interval '10 days')", [pessoas.equipe]);
  await dono("insert into interno.rede_espaco_membros (espaco, usuario, cuida) values ('fechado-antigo-1', $1, true)", [pessoas.equipe]);
  return rpc(como(pessoas.estranho), "rede_espaco_entrar", { p_codigo: "AbCdEfGh1234" });
}, (r) => r.slug === "fechado-antigo-1" && r.antigo === true);
await espera("quem cuida vê até quando vale o código antigo, nunca o código", () => rpc(como(pessoas.equipe), "rede_meus_espacos"), (l) => { const e = l.find((x) => x.slug === "fechado-antigo-1"); return e && e.codigo === null && e.codigo_antigo_ate; });
await dono("insert into interno.rede_espacos (slug, nome, criado_por, codigo, codigo_expira_em) values ('fechado-antigo-2', 'Espaço antigo vencido', $1, 'ZzYyXxWw9876', now() - interval '1 day')", [pessoas.equipe]);
await naoVale("depois dos 30 dias o código antigo não entra", () => rpc(como(pessoas.membro), "rede_espaco_entrar", { p_codigo: "ZzYyXxWw9876" }));
await espera("e o texto vencido é trocado por um sorteado", () => um("select codigo, codigo_apagado_em is not null as apagado from interno.rede_espacos where slug = 'fechado-antigo-2'"), (r) => r.codigo !== "ZzYyXxWw9876" && r.apagado === true);
await espera("'novo_codigo' revoga os convites e o código antigo e devolve um convite novo", async () => {
  const r = await rpc(como(pessoas.equipe), "rede_espaco_cuidar", { p_slug: "fechado-antigo-1", p_acao: "novo_codigo" });
  const velho = await um("select codigo_expira_em <= now() as vencido from interno.rede_espacos where slug = 'fechado-antigo-1'");
  return { r, velho };
}, (x) => conviteNovoOk(x.r.codigo) && x.velho.vencido === true);
await naoVale("depois de 'novo_codigo' o código antigo não entra mais", () => rpc(como(pessoas.membro), "rede_espaco_entrar", { p_codigo: "AbCdEfGh1234" }));

// Núcleo da v2 (rede_nucleos): convite com escopo, consentimento e mediação.
const nucleo = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo v2 do teste', 'Niterói') returning id")).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao')", [nucleo, pessoas.mediacao]);
const cn = await rpc(como(pessoas.mediacao), "rede_fix_convite_criar", { p_alvo: nucleo, p_escopo: "membro", p_dias: 3, p_usos: 2 });
await espera("a mediação do núcleo gera convite", () => Promise.resolve(cn), (r) => conviteNovoOk(r.codigo));
await recusa("quem é do núcleo mas não da mediação não gera", async () => {
  await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro')", [nucleo, pessoas.membro]);
  return rpc(como(pessoas.membro), "rede_fix_convite_criar", { p_alvo: nucleo });
}, "sem_permissao");
await recusa("entrar em núcleo exige o consentimento da Rede", () => rpc(como(pessoas.estranho), "rede_fix_convite_usar", { p_codigo: cn.codigo }), "consentimento");
await espera("com consentimento entra no núcleo", () => rpc(como(pessoas.outro), "rede_fix_convite_usar", { p_codigo: cn.codigo }), (r) => r.tipo === "nucleo" && r.nucleo === nucleo);
await espera("entrou como membro (não como mediação)", () => um("select papel from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, pessoas.outro]), (r) => r.papel === "membro");
const cm = await rpc(como(pessoas.mediacao), "rede_fix_convite_criar", { p_alvo: nucleo, p_escopo: "mediacao", p_usos: 1 });
await espera("convite de escopo mediação entrega a mediação", async () => {
  await rpc(como(pessoas.autor), "rede_fix_convite_usar", { p_codigo: cm.codigo });
  return um("select papel from interno.rede_nucleo_membros where nucleo = $1 and usuario = $2", [nucleo, pessoas.autor]);
}, (r) => r.papel === "mediacao");
await recusa("alvo que não existe", () => rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: "fechado-nao-existe" }), "nao_encontrado");
await recusa("alvo que não é espaço nem uuid", () => rpc(como(pessoas.equipe), "rede_fix_convite_criar", { p_alvo: "qualquer coisa" }), "invalido:alvo");
await espera("um convite só tem um alvo (a trava do banco)", async () => {
  try {
    await dono("insert into interno.rede_convites (nucleo, espaco, token_hash, validade) values ($1, $2, repeat('a', 64), now() + interval '1 day')", [nucleo, espaco.slug]);
    return false;
  } catch {
    return true;
  }
}, (v) => v === true);
await espera("convite sem alvo também não existe", async () => {
  try {
    await dono("insert into interno.rede_convites (token_hash, validade) values (repeat('b', 64), now() + interval '1 day')");
    return false;
  } catch {
    return true;
  }
}, (v) => v === true);
await espera("o limite de tentativas de entrar existe", async () => {
  const quem = como(pessoas.estranho);
  let barrou = false;
  for (let i = 0; i < 30 && !barrou; i++) {
    try {
      await rpc(quem, "rede_fix_convite_usar", { p_codigo: "0123456789abcdef0123456789abcdef" });
    } catch (erro) {
      if (String(erro.message).includes("muitos_pedidos")) barrou = true;
    }
  }
  return barrou;
}, (b) => b === true);

// ── 7. Permissões ──
const internas = ["rede_fix_menor_trava", "rede_fix_idade", "rede_post_json", "rede_fix_na_linha", "rede_fix_cuida", "rede_fix_expirar_codigos", "rede_fix_alvo"];
for (const nome of internas) {
  const r = await um(
    "select bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) as aberta from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = $1",
    [nome],
  );
  await espera(`interno.${nome} não é executável pelo cliente`, () => Promise.resolve(r), (x) => x.aberta === false);
}
const publicas = ["rede_fix_linha", "rede_fix_novos", "rede_fix_novos_abas", "rede_fix_convite_criar", "rede_fix_convite_usar", "rede_fix_convite_revogar", "rede_fix_convites_listar", "rede_fix_idade_rever"];
for (const nome of publicas) {
  const r = await um(
    "select count(*)::int as n, bool_and(p.prosecdef) as definer, bool_and(coalesce(p.proconfig::text, '') like '%search_path=interno%') as caminho from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1",
    [nome],
  );
  await espera(`public.${nome} é security definer com search_path fixo`, () => Promise.resolve(r), (x) => x.n >= 1 && x.definer === true && x.caminho === true);
}
await espera("nenhuma tabela nova no esquema public", async () => um("select count(*)::int as n from pg_tables where schemaname = 'public'"), (r) => r.n === 0);
await espera("o convite não tem coluna para o código em texto", async () => um("select count(*)::int as n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_convites' and column_name in ('codigo', 'token', 'segredo')"), (r) => r.n === 0);

// ── 8. O contrato do cliente, dos tipos e dos textos ──
const chamadas = [];
const cliente = criarClienteConsertos(async (funcao, argumentos) => {
  chamadas.push([funcao, argumentos]);
  return null;
});
await cliente.linha("tudo", { cursor: "c" });
await cliente.novos("seguindo", "2026-11-04T00:00:00Z");
await cliente.novosPorAba({ tudo: "2026-11-04T00:00:00Z" });
await cliente.confirmarIdade(false);
await cliente.conviteCriar("fechado-x", { dias: 3, usos: 4 });
await cliente.conviteUsar("abc");
await cliente.conviteRevogar("id");
await cliente.convites("fechado-x");
const quais = chamadas.map((c) => c[0]);
await espera("o cliente chama as funções do contrato", () => Promise.resolve(quais), (l) => ["rede_fix_linha", "rede_fix_novos", "rede_fix_novos_abas", "rede_confirmar_idade", "rede_fix_convite_criar", "rede_fix_convite_usar", "rede_fix_convite_revogar", "rede_fix_convites_listar"].every((n, i) => l[i] === n));
await espera("o cliente manda os parâmetros com os nomes do SQL", () => Promise.resolve(chamadas), (c) => c[0][1].p_cursor === "c" && c[0][1].p_limite === 20 && c[3][1].p_maior === false && c[4][1].p_dias === 3 && c[4][1].p_usos === 4 && c[4][1].p_escopo === "membro");
await espera("idade mínima da Rede é 18", () => Promise.resolve(IDADE_MINIMA_REDE), (n) => n === 18);
await espera("conferências do código do convite", () => Promise.resolve([conviteOk("AbCdEfGh1234"), conviteAntigoOk("AbCdEfGh1234"), conviteNovoOk(espaco.codigo), conviteNovoOk("AbCdEfGh1234"), conviteOk("curto"), normalizarConvite("ab-cd ef")]), (l) => l[0] && l[1] && l[2] && !l[3] && !l[4] && l[5] === "abcdef");
await espera("agruparConvite separa de quatro em quatro", () => Promise.resolve(agruparConvite("0123456789abcdef")), (t) => t === "0123-4567-89ab-cdef");

const chaves = (o) => Object.keys(o).filter((k) => k !== "_rascunho").sort();
const pt = JSON.parse(lerTexto("i18n/rede/consertos/pt.json"));
for (const lang of ["en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(lerTexto(`i18n/rede/consertos/${lang}.json`));
  await espera(`textos ${lang}: mesmas chaves do português, marcados como rascunho, sem valor vazio`, () => Promise.resolve(t), (x) => x._rascunho === true && JSON.stringify(chaves(x)) === JSON.stringify(chaves(pt)) && Object.values(x).every((v) => v === true || (typeof v === "string" && v.trim())));
}
await espera("textos pt: o texto final não é rascunho e fala em 18 anos", () => Promise.resolve(pt), (x) => !("_rascunho" in x) && /18/.test(x.menorTexto) && /\{n\}/.test(x.novosAba) && /\{data\}/.test(x.conviteAntigo));
for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const d = JSON.parse(lerTexto(`i18n/${lang}.json`)).rede;
  await espera(`dicionário ${lang}: a idade da Rede é 18, não 16`, () => Promise.resolve(d), (r) => /18/.test(r.idadeTexto) && /18/.test(r.idadeOk) && /18/.test(r.erros.confirme_idade) && !/16/.test(r.idadeOk));
}
const rede = lerTexto("components/comunidade/Rede.tsx");
await espera("a Rede de hoje não mostra mais o código em texto nem usa a linha sem cursor", () => Promise.resolve(rede), (t) => !/\be\.codigo\b/.test(t) && t.includes("useLinha") && t.includes("BotaoEscrever") && t.includes("rede_confirmar_idade") === false && t.includes("Idade"));
const comunidade = lerTexto("components/comunidade/ComunidadeComRede.tsx");
await espera("o Fórum só carrega sob demanda (dynamic import com esqueleto)", () => Promise.resolve(comunidade), (t) => t.includes("dynamic(") && !/^import \{ Forum \} from/m.test(t) && t.includes("EsqueletoDoForum"));
const entrar = lerTexto("components/SignIn.tsx");
await espera("a entrada tem o 'esqueci a senha'", () => Promise.resolve(entrar), (t) => t.includes("EsqueciASenha"));
const senha = lerTexto("components/rede/consertos/EsqueciASenha.tsx");
await espera("o 'esqueci a senha' usa resetPasswordForEmail e volta para a tela de entrar", () => Promise.resolve(senha), (t) => t.includes("resetPasswordForEmail") && t.includes("/entrar") && t.includes("captchaToken"));
const funcao = lerTexto("supabase/functions/avaliar-comunidade/index.ts");
await espera("a função avaliar-comunidade aceita o tipo 'rede'", () => Promise.resolve(funcao), (t) => /"aula_chat", "rede"\]/.test(t));
const backend = lerTexto("lib/backend.ts");
await espera("evaluatePost aceita 'rede'", () => Promise.resolve(backend), (t) => /"aula_chat" \| "rede"/.test(t));
await espera("nenhum arquivo do pacote lê disco", () => Promise.resolve(["lib/rede/tipos-consertos.ts", "lib/rede/cliente-consertos.ts", "components/rede/consertos/contexto.tsx", "components/rede/consertos/Convites.tsx"].map(lerTexto)), (l) => l.every((t) => !/from "node:fs"|require\("fs"\)|readFileSync/.test(t)));

console.log(`\n${certos} certas, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
process.exit(0);
