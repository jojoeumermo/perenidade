// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, grupo "criação coletiva" (supabase/migracoes/20261127-p4-criacao-coletiva.sql, flag "alumia-p4-criacao-coletiva"):
//   item 33  rascunho coletivo de nota ou manifesto: uma página da wiki da comunidade, com sugestões de troca de trecho (aceitar vira
//            uma versão nova da wiki; recusar não muda o texto), comentários e o fechar da moderação. Ninguém (nem a moderação) vê
//            quem sugeriu ou comentou: só "minha".
//   item 34  anotar trechos do acervo (as páginas da wiki) e discutir à margem: só quem é da comunidade lê e escreve, mesmo na
//            comunidade aberta, cuja wiki qualquer conta lê. Núcleo: o servidor não sabe quem é de cada núcleo (R2), e a margem do
//            núcleo não existe aqui (pendência do prompt 2).
//   item 36  estúdio de cartaz: a identidade da organização (cores com contraste AA, fonte da Alumia, assinatura sem link), que só
//            quem gerencia grava; o cartaz é desenhado no aparelho (lib/rede/criacao/cartaz.ts).
//   item 37  zine: o banco só entrega os posts que podem sair (os de outras pessoas pela regra do RSS e do cartão; os dela, só os de
//            público aberto); a folha A4 dobrável é montada no aparelho (lib/rede/criacao/zine.ts).
// Antes da migração as funções não existem (a falha de antes); depois, tudo abaixo passa.
// Uso: npm run testar:p4-criacao-coletiva
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { comSugestao, pedacos, reancorar, selecaoValida, trechoParaSugerir, vezes } from "../lib/rede/criacao/margem.ts";
import { contraste, desenharCartaz, erroDaIdentidade, IDENTIDADE_DA_ALUMIA, MODELOS, nomeDoArquivo, sobre, TAMANHOS_DO_CARTAZ } from "../lib/rede/criacao/cartaz.ts";
import { idDoPost, montarZine, ORDEM_NA_FOLHA } from "../lib/rede/criacao/zine.ts";
import { criarClienteDaCriacao, dubleDaCriacao } from "../lib/rede/criacao/cliente.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(detalhe ? `${nome} (${detalhe})` : nome));
async function recusa(nome, fazer, codigo) {
  try {
    const v = await fazer();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(v)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
async function passa(nome, fazer) {
  try {
    const v = await fazer();
    certos++;
    return v;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

// ═══ 0. O arquivo da migração ═══
const ARQUIVO = "supabase/migracoes/20261127-p4-criacao-coletiva.sql";
const SQL = normal(ler(ARQUIVO));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
ok("a migração diz que roda depois das da onda 1 e antes do p4-fim", SQL.includes("Roda depois das migrações 20261127-p4-* da onda 1") && SQL.includes("antes do 20261127-p4-fim.sql"));
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem/i.test(semComentario));
ok("a migração não sobe a versão do banco nem mexe na lista da porta", !/rede_alumia_versao|alumia_porta_lista/i.test(semComentario));
ok("a migração não redefine função de fora do grupo (só cria rede_p4_cc_*)",
  [...semComentario.matchAll(/create or replace function (\w+)\.(\w+)/g)].every((m) => m[2].startsWith("rede_p4_cc_")));
ok("as permissões só tocam nas funções do grupo", [...semComentario.matchAll(/p\.proname like '([^']+)'/g)].every((m) => m[1] === "rede\\_p4\\_cc\\_%"));
ok("nenhum Math.random nem random() na migração", !/random\(\)/i.test(semComentario));
{
  const install = ler("supabase/install.sql");
  if (install.includes("rede_p4_cc_")) ok("a migração está colada no fim do install.sql (quem junta colou)", noFimDoInstall(SQL, install));
  else ok("a migração não está colada no install.sql (quem junta cola)", true);
}
ok("o teste está no package.json", JSON.parse(ler("package.json")).scripts["testar:p4-criacao-coletiva"]?.includes("testar-p4-criacao-coletiva.mjs"));

// ═══ 1. Antes e depois ═══
const install = ler("supabase/install.sql");
const banco = await criarBanco(install.includes("rede_p4_cc_") ? { antesDe: SQL } : {});
const { dono, rpc, criarUsuario } = banco;
await recusa("antes: rede_p4_cc_pagina não existe", () => dono("select public.rede_p4_cc_pagina('x', 'y')"), "does not exist");
await recusa("antes: rede_p4_cc_zine_posts não existe", () => dono("select public.rede_p4_cc_zine_posts('{}'::uuid[])"), "does not exist");
await recusa("antes: rede_p4_cc_org_identidade_salvar não existe", () => dono("select public.rede_p4_cc_org_identidade_salvar('x', '{}'::jsonb)"), "does not exist");
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));

const TABELAS = ["rede_p4_cc_rascunhos", "rede_p4_cc_sugestoes", "rede_p4_cc_anotacoes", "rede_p4_cc_anotacao_respostas", "rede_p4_cc_org_identidade"];
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const cat = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-criacao-coletiva'")).rows;
  ok("a flag está no catálogo, só pelo nome", cat.length === 1 && cat[0].so_pelo_nome === true);
  ok("a flag nasce desligada (sem decisão no painel)", (await dono("select count(*)::int n from interno.recursos_vivos where nome = 'alumia-p4-criacao-coletiva'")).rows[0].n === 0);
  for (const t of TABELAS) {
    const x = (await dono("select c.relrowsecurity r, (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = $2) n, has_table_privilege('authenticated', $1, 'select') s, has_table_privilege('anon', $1, 'select') a from pg_class c where c.oid = $1::regclass", [`interno.${t}`, t])).rows[0];
    ok(`${t}: RLS ligada, nenhuma política, nenhuma permissão direta`, x.r === true && x.n === 0 && !x.s && !x.a);
  }
  const colunas = (await dono("select table_name t, string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'interno' and table_name = any($1) group by table_name", [TABELAS])).rows;
  ok("nenhuma tabela do grupo guarda endereço de rede, aparelho ou nome de quem lê", colunas.every((x) => !/(^|,)(ip|origem|endereco|aparelho|leu|viu|lido)/.test(x.c)), JSON.stringify(colunas));
  const internas = (await dono(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede\\_p4\\_cc\\_%'
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows[0].n;
  ok("as funções de dentro não abrem para ninguém pela API", internas === 0);
  const publicas = (await dono(`select p.proname, p.prosrc, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') b
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_p4\\_cc\\_%'`)).rows;
  ok(`as funções da tela (${publicas.length}) só abrem para conta logada`, publicas.length >= 14 && publicas.every((x) => !x.a && x.b));
  ok("toda função da tela passa pela porta na primeira linha", publicas.every((x) => /^\s*(declare[\s\S]*?)?begin\s+perform interno\.alumia_porta\(\);/.test(x.prosrc)));
}

// ═══ 2. As pessoas, a comunidade e a organização ═══
// mod (modera a comunidade), edita (membro que edita a wiki), membro (membro que não edita: a wiki pede "experientes"), fora (da
// Alumia, mas não da comunidade, que é aberta), gestora (gerencia a organização), outra (sem nada).
const P = {};
const NOMES = ["mod", "edita", "membro", "fora", "gestora", "outra", "longe"];
for (const [i, nome] of NOMES.entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-cc.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Codinome ${nome}`, `cc_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('cc-moradia', 'Moradia do teste', 'lutas', 'aberta', 'membros'),
  ('cc-fechada', 'Fechada do teste', 'lutas', 'fechada', 'membros'),
  ('cc-redacao', 'Redação do teste', 'disciplinas', 'aberta', 'internet') on conflict do nothing`);
await dono(`insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values
  ('cc-moradia', $1, 'moderacao'), ('cc-moradia', $2, 'membro'), ('cc-moradia', $3, 'membro'), ('cc-fechada', $2, 'membro'), ('cc-redacao', $4, 'membro')`,
  [P.mod, P.edita, P.membro, P.fora]);
await dono("insert into interno.rede_acervo_wiki_regra (comunidade, quem) values ('cc-moradia', 'experientes') on conflict (comunidade) do update set quem = excluded.quem");
await dono("insert into interno.rede_lideres (usuario) values ($1) on conflict do nothing", [P.edita]);
await dono("insert into interno.rede_orgs (perfil, tipo, cidade, palavra) values ($1, 'coletivo', 'Recife', 'CC')", [P.outra]);
await dono("insert into interno.rede_org_gestores (org, gestor, papel) values ($1, $2, 'dono')", [P.outra, P.gestora]);
const como = (quem) => ({ papel: "authenticated", sub: P[quem], aal: "aal2", ip: "198.51.100.9" });
const chamar = async (quem, funcao, args = {}) => {
  await dono("delete from interno.limites");
  return rpc(como(quem), funcao, args);
};
ok("as pessoas são membros da Alumia", (await dono("select bool_and(interno.rede2_membro(u)) b from unnest($1::uuid[]) u", [Object.values(P)])).rows[0].b === true);
ok("quem edita a wiki: só a moderação e quem tem nível (a regra pede experientes)",
  (await dono("select interno.rede_alumia_wiki_edita('cc-moradia', $1) a, interno.rede_alumia_wiki_edita('cc-moradia', $2) b, interno.rede_alumia_wiki_edita('cc-moradia', $3) c", [P.mod, P.edita, P.membro])).rows[0].c === false);

// Uma página do acervo (a wiki de sempre, pela função de sempre).
const CORPO = "Direito à moradia. Todo despejo precisa de ordem judicial. Peça a ordem e ligue para a assessoria.";
await passa("a página do acervo nasce pela wiki de sempre", () => chamar("edita", "rede_alumia_wiki_salvar", { p_slug: "cc-moradia", p_pagina: null, p_titulo: "Cartilha de direitos", p_corpo: CORPO, p_resumo: "", p_base: null }));

// ── Desligado: tudo recusa ──
ok("desligado: a tela não vê a criação coletiva", (await chamar("edita", "rede_p4_cc_aberto")) === false);
await recusa("desligado: a margem recusa", () => chamar("edita", "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" }), "desligado");
await recusa("desligado: o rascunho recusa", () => chamar("edita", "rede_p4_cc_rascunho_criar", { p_slug: "cc-moradia", p_titulo: "Nota", p_tipo: "nota", p_corpo: "x" }), "desligado");
await recusa("desligado: o estúdio recusa", () => chamar("gestora", "rede_p4_cc_estudio_orgs"), "desligado");
await recusa("desligado: a zine recusa", () => chamar("edita", "rede_p4_cc_zine_meus"), "desligado");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-criacao-coletiva', true) on conflict (nome) do update set ligado = true");
ok("ligado: a tela vê a criação coletiva", (await chamar("edita", "rede_p4_cc_aberto")) === true);
await dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-2'").catch(() => {});
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-2', false) on conflict (nome) do update set ligado = false");
ok("com a Alumia 2 desligada no painel, a criação coletiva também desliga", (await chamar("edita", "rede_p4_cc_aberto")) === false);
await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");
await recusa("visitante sem conta: recusa", () => rpc({ papel: "anon", ip: "198.51.100.50" }, "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" }), "permission denied");

// ═══ Item 34: a margem do acervo ═══
{
  // A wiki da comunidade aberta é lida por qualquer conta; a margem, não.
  const wikiDeFora = await passa("item 34: quem não é da comunidade lê a wiki aberta (como antes)", () => chamar("fora", "rede_alumia_wiki", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" }));
  ok("item 34: a wiki de sempre não mostra a margem", !JSON.stringify(wikiDeFora ?? {}).includes("anotac"));
  await recusa("item 34 (privacidade): quem não é da comunidade não abre a margem", () => chamar("fora", "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" }), "sem_permissao");
  await recusa("item 34 (privacidade): quem não é da comunidade não anota", () => chamar("fora", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 1, p_inicio: 0, p_fim: 18, p_texto: "Eu de fora" }), "sem_permissao");
  await recusa("item 34: comunidade fechada nem aparece para quem é de fora", () => chamar("fora", "rede_p4_cc_rascunhos", { p_slug: "cc-fechada" }), "nao_encontrado");

  const inicio = CORPO.indexOf("Todo despejo");
  const fim = inicio + "Todo despejo precisa de ordem judicial.".length;
  const a = await passa("item 34: quem é da comunidade (sem editar a wiki) anota um trecho", () => chamar("membro", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 1, p_inicio: inicio, p_fim: fim, p_texto: "Vale citar o artigo do CPC aqui?" }));
  ok("item 34: o trecho anotado é o do texto", a?.trecho === "Todo despejo precisa de ordem judicial.");
  await passa("item 34: comentário da página inteira (sem trecho)", () => chamar("mod", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 1, p_inicio: null, p_fim: null, p_texto: "Revisar até sexta." }));
  await recusa("item 34: versão velha dá conflito", () => chamar("membro", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 9, p_inicio: 0, p_fim: 5, p_texto: "x" }), "conflito");
  await recusa("item 34: trecho fora do texto", () => chamar("membro", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 1, p_inicio: 0, p_fim: 9999, p_texto: "x" }), "invalido:trecho");
  await recusa("item 34: trecho de mais de 500 letras", () => chamar("membro", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 1, p_inicio: 0, p_fim: 501, p_texto: "x" }), "invalido:trecho");
  await recusa("item 34: CPF na anotação", () => chamar("membro", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_versao: 1, p_inicio: null, p_fim: null, p_texto: "o meu é 123.456.789-00" }), "dado_pessoal");
  const r = await passa("item 34: outra pessoa da comunidade responde à margem", () => chamar("edita", "rede_p4_cc_anotacao_responder", { p_id: a?.id, p_texto: "Vale, eu acho." }));
  await recusa("item 34 (privacidade): quem é de fora não responde", () => chamar("fora", "rede_p4_cc_anotacao_responder", { p_id: a?.id, p_texto: "Eu de fora" }), "sem_permissao");

  const vistaMod = await chamar("mod", "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" });
  const vistaMembro = await chamar("membro", "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" });
  ok("item 34: a margem tem as duas anotações e a resposta", vistaMod?.anotacoes?.length === 2 && vistaMod.anotacoes.some((x) => x.respostas.length === 1));
  ok("item 34: \"minha\" é verdade só para quem escreveu", vistaMembro.anotacoes.find((x) => x.id === a?.id)?.minha === true && vistaMod.anotacoes.find((x) => x.id === a?.id)?.minha === false);
  const texto = JSON.stringify(vistaMod);
  ok("item 34 (privacidade): nem a moderação recebe quem escreveu (nenhum id, codinome nem @ de pessoa)",
    !NOMES.some((n) => texto.includes(P[n]) || texto.includes(`Codinome ${n}`) || texto.includes(`cc_${n}`)) && !/"autor"|"editou"|"quem"/.test(texto));
  ok("item 34 (privacidade): nenhuma contagem de quem anotou ou leu", !/"(total|quantos|pessoas|leram|vistas)"/.test(texto));
  ok("item 34: quem não edita a wiki pode anotar, mas não editar nem decidir", vistaMembro.pode.anotar === true && vistaMembro.pode.editar === false && vistaMembro.pode.decidir === false);

  await recusa("item 34: quem é de outra pessoa não marca como resolvida (sem editar)", () => chamar("membro", "rede_p4_cc_anotacao_resolver", { p_id: vistaMod.anotacoes.find((x) => x.minha).id, p_sim: true }), "sem_permissao");
  ok("item 34: quem escreveu marca a própria como resolvida", (await chamar("membro", "rede_p4_cc_anotacao_resolver", { p_id: a?.id, p_sim: true }))?.resolvida === true);
  await recusa("item 34: apagar a resposta de outra pessoa", () => chamar("membro", "rede_p4_cc_apagar", { p_tipo: "resposta", p_id: r?.id }), "sem_permissao");
  ok("item 34: a moderação apaga a resposta (e o registro não diz de quem era)", (await chamar("mod", "rede_p4_cc_apagar", { p_tipo: "resposta", p_id: r?.id }))?.apagado === true);
  const reg = (await dono("select quem, alvo, detalhes::text d from interno.auditoria where acao = 'alumia_p4_apagar_resposta'")).rows;
  ok("item 34: a moderação fica no registro (como quem apagou), sem o nome nem o id de quem escreveu",
    reg.length === 1 && reg[0].quem === P.mod && reg[0].alvo === "cc-moradia/cartilha-de-direitos" && !Object.entries(P).some(([n, id]) => n !== "mod" && `${reg[0].alvo}${reg[0].d}`.includes(id)));

  // Quem sai da comunidade perde a margem.
  await dono("delete from interno.rede_comunidade_membros where comunidade = 'cc-moradia' and usuario = $1", [P.membro]);
  await recusa("item 34: quem saiu da comunidade não abre mais a margem", () => chamar("membro", "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos" }), "sem_permissao");
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('cc-moradia', $1, 'membro')", [P.membro]);
}

// ═══ Item 33: o rascunho coletivo ═══
{
  const MANIFESTO = "Nós, moradoras da ocupação, exigimos diálogo. A prefeitura precisa ouvir antes de despejar.";
  await recusa("item 33: quem não edita a wiki não começa rascunho", () => chamar("membro", "rede_p4_cc_rascunho_criar", { p_slug: "cc-moradia", p_titulo: "Manifesto da ocupação", p_tipo: "manifesto", p_corpo: MANIFESTO }), "sem_permissao");
  await recusa("item 33: tipo fora da lista", () => chamar("edita", "rede_p4_cc_rascunho_criar", { p_slug: "cc-moradia", p_titulo: "Manifesto da ocupação", p_tipo: "panfleto", p_corpo: MANIFESTO }), "invalido:tipo");
  const novo = await passa("item 33: quem edita a wiki começa um rascunho de manifesto", () => chamar("edita", "rede_p4_cc_rascunho_criar", { p_slug: "cc-moradia", p_titulo: "Manifesto da ocupação", p_tipo: "manifesto", p_corpo: MANIFESTO }));
  ok("item 33: o rascunho é uma página da wiki (rascunho-…), versão 1", novo?.pagina === "rascunho-manifesto-da-ocupacao" && novo?.versao === 1);
  await recusa("item 33: o mesmo título de novo", () => chamar("edita", "rede_p4_cc_rascunho_criar", { p_slug: "cc-moradia", p_titulo: "Manifesto da ocupação", p_tipo: "manifesto", p_corpo: MANIFESTO }), "ja_existe");
  const pag = novo?.pagina;
  const hist = await passa("item 33: as versões são as da wiki (o histórico de sempre)", () => chamar("membro", "rede_alumia_wiki_historico", { p_slug: "cc-moradia", p_pagina: pag, p_versao: null }));
  ok("item 33: o histórico da wiki tem a primeira versão", hist?.versoes?.length === 1);
  const lista = await chamar("membro", "rede_p4_cc_rascunhos", { p_slug: "cc-moradia" });
  ok("item 33: a lista mostra o rascunho, sem autor e sem contagem", lista?.rascunhos?.length === 1 && lista.rascunhos[0].tipo === "manifesto" && !/"autor"|"total"|"quantos"/.test(JSON.stringify(lista)));
  ok("item 33: quem não edita não vê o botão de começar", lista?.pode_criar === false);
  ok("item 34: a lista traz as outras páginas do acervo para anotar", lista?.paginas?.length === 1 && lista.paginas[0].pagina === "cartilha-de-direitos");
  const minhas = await chamar("membro", "rede_p4_cc_minhas_comunidades");
  ok("itens 33 e 34: as minhas comunidades (só a de que sou), sem contagem", JSON.stringify((minhas ?? []).map((c) => c.slug)) === JSON.stringify(["cc-moradia"]) && !/"(total|pessoas|membros)"/.test(JSON.stringify(minhas)));
  ok("itens 33 e 34: quem é de fora não tem nenhuma comunidade da margem aqui", JSON.stringify((await chamar("fora", "rede_p4_cc_minhas_comunidades")).map((c) => c.slug)) === JSON.stringify(["cc-redacao"]));
  await recusa("item 33 (privacidade): quem é de fora não vê a lista de rascunhos", () => chamar("fora", "rede_p4_cc_rascunhos", { p_slug: "cc-moradia" }), "sem_permissao");

  const s1 = await passa("item 33: quem é da comunidade sugere trocar um trecho", () => chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 1, p_trecho: "exigimos diálogo", p_proposta: "exigimos diálogo e moradia digna", p_motivo: "fica mais forte" }));
  await recusa("item 33: sugestão sobre versão velha dá conflito", () => chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 7, p_trecho: "exigimos", p_proposta: "pedimos" }), "conflito");
  await recusa("item 33: o trecho tem de estar no texto (e uma vez só)", () => chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 1, p_trecho: "não está aqui", p_proposta: "x" }), "invalido:trecho");
  await recusa("item 33: proposta igual ao trecho", () => chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 1, p_trecho: "exigimos", p_proposta: "exigimos" }), "invalido:proposta");
  await recusa("item 33 (privacidade): quem é de fora não sugere", () => chamar("fora", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 1, p_trecho: "exigimos", p_proposta: "pedimos" }), "sem_permissao");
  await recusa("item 33: página que não é rascunho não recebe sugestão", () => chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: "cartilha-de-direitos", p_base: 1, p_trecho: "Direito", p_proposta: "Dever" }), "nao_e_rascunho");
  const s2 = await passa("item 33: uma segunda sugestão (tirar um trecho)", () => chamar("mod", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 1, p_trecho: " antes de despejar", p_proposta: "", p_motivo: "" }));

  const vista = await chamar("edita", "rede_p4_cc_pagina", { p_slug: "cc-moradia", p_pagina: pag });
  ok("item 33: a página mostra as duas sugestões abertas e quem edita pode decidir", vista?.sugestoes?.length === 2 && vista.pode.decidir === true && vista.rascunho?.tipo === "manifesto");
  const tv = JSON.stringify(vista);
  ok("item 33 (privacidade): as sugestões não dizem quem sugeriu (nem para quem decide)", !NOMES.some((n) => tv.includes(P[n]) || tv.includes(`Codinome ${n}`) || tv.includes(`cc_${n}`)) && !/"autor"/.test(tv));
  await recusa("item 33: quem não edita não decide", () => chamar("membro", "rede_p4_cc_sugestao_decidir", { p_id: s2?.id, p_aceitar: true }), "sem_permissao");

  const aceita = await passa("item 33: aceitar vira uma versão nova da wiki", () => chamar("edita", "rede_p4_cc_sugestao_decidir", { p_id: s1?.id, p_aceitar: true }));
  ok("item 33: versão 2", aceita?.versao === 2 && aceita?.situacao === "aceita");
  const w2 = await chamar("membro", "rede_alumia_wiki", { p_slug: "cc-moradia", p_pagina: pag });
  ok("item 33: o texto da wiki mudou só no trecho", JSON.stringify(w2).includes("exigimos diálogo e moradia digna. A prefeitura precisa ouvir antes de despejar."));
  const v2 = (await dono("select editou, resumo from interno.rede_alumia_wiki_versoes where comunidade = 'cc-moradia' and pagina = $1 and versao = 2", [pag])).rows[0];
  ok("item 33 (privacidade): a versão nova leva quem aceitou (como toda edição da wiki), nunca quem sugeriu", v2?.editou === P.edita && v2?.resumo === "Sugestão aceita");
  await recusa("item 33: decidir de novo", () => chamar("edita", "rede_p4_cc_sugestao_decidir", { p_id: s1?.id, p_aceitar: false }), "ja_decidida");
  // A segunda sugestão foi feita sobre a versão 1; o trecho ainda está no texto, então aceitar ainda dá certo.
  ok("item 33: recusar não muda o texto", (await chamar("edita", "rede_p4_cc_sugestao_decidir", { p_id: s2?.id, p_aceitar: false }))?.versao === 2);
  // Conflito: o trecho some do texto antes de a sugestão ser aceita.
  const s3 = await chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 2, p_trecho: "A prefeitura", p_proposta: "O governo" });
  await chamar("edita", "rede_alumia_wiki_salvar", { p_slug: "cc-moradia", p_pagina: pag, p_titulo: "Manifesto da ocupação", p_corpo: "Texto todo novo, sem o trecho.", p_resumo: "", p_base: 2 });
  await recusa("item 33: o trecho sumiu do texto: conflito, e a sugestão continua aberta", () => chamar("edita", "rede_p4_cc_sugestao_decidir", { p_id: s3?.id, p_aceitar: true }), "conflito");
  ok("item 33: a sugestão com conflito continua aberta", (await dono("select situacao from interno.rede_p4_cc_sugestoes where id = $1", [s3?.id])).rows[0]?.situacao === "aberta");
  ok("item 33: quem sugeriu retira a própria sugestão aberta", (await chamar("membro", "rede_p4_cc_apagar", { p_tipo: "sugestao", p_id: s3?.id }))?.apagado === true);
  await passa("item 33: comentário no rascunho (a margem)", () => chamar("membro", "rede_p4_cc_anotar", { p_slug: "cc-moradia", p_pagina: pag, p_versao: 3, p_inicio: null, p_fim: null, p_texto: "Gostei." }));

  await recusa("item 33: só a moderação fecha", () => chamar("edita", "rede_p4_cc_rascunho_fechar", { p_slug: "cc-moradia", p_pagina: pag, p_fechar: true }), "sem_permissao");
  ok("item 33: a moderação fecha o rascunho", (await chamar("mod", "rede_p4_cc_rascunho_fechar", { p_slug: "cc-moradia", p_pagina: pag, p_fechar: true }))?.situacao === "fechado");
  ok("item 33: fechado, a página da wiki trava", (await dono("select travada from interno.rede_alumia_wiki where comunidade = 'cc-moradia' and pagina = $1", [pag])).rows[0]?.travada === true);
  await recusa("item 33: fechado, ninguém sugere", () => chamar("membro", "rede_p4_cc_sugerir", { p_slug: "cc-moradia", p_pagina: pag, p_base: 3, p_trecho: "Texto", p_proposta: "Letra" }), "travado");
  await recusa("item 33: fechado, a wiki não aceita edição de quem não modera", () => chamar("edita", "rede_alumia_wiki_salvar", { p_slug: "cc-moradia", p_pagina: pag, p_titulo: "Manifesto da ocupação", p_corpo: "Outro", p_resumo: "", p_base: 3 }), "");
  ok("item 33: a moderação reabre", (await chamar("mod", "rede_p4_cc_rascunho_fechar", { p_slug: "cc-moradia", p_pagina: pag, p_fechar: false }))?.situacao === "aberto");
}

// ═══ Item 36: a identidade da organização para o estúdio ═══
{
  const ID = { fundo: "#0F0E0D", destaque: "#e8321f", texto: "#f3efe6", fonte: "archivo", assinatura: "Coletivo CC · Recife" };
  await recusa("item 36: quem não gerencia não grava a identidade", () => chamar("membro", "rede_p4_cc_org_identidade_salvar", { p_handle: "cc_outra", p: ID }), "sem_permissao");
  await recusa("item 36: contraste baixo (cinza claro sobre branco) recusa", () => chamar("gestora", "rede_p4_cc_org_identidade_salvar", { p_handle: "cc_outra", p: { ...ID, fundo: "#ffffff", texto: "#cccccc" } }), "invalido:contraste");
  await recusa("item 36: cor que não é #rrggbb", () => chamar("gestora", "rede_p4_cc_org_identidade_salvar", { p_handle: "cc_outra", p: { ...ID, destaque: "red" } }), "invalido:cor");
  await recusa("item 36: fonte fora das da Alumia", () => chamar("gestora", "rede_p4_cc_org_identidade_salvar", { p_handle: "cc_outra", p: { ...ID, fonte: "comic" } }), "invalido:fonte");
  await recusa("item 36: link na assinatura", () => chamar("gestora", "rede_p4_cc_org_identidade_salvar", { p_handle: "cc_outra", p: { ...ID, assinatura: "veja www.exemplo.org" } }), "invalido:assinatura");
  const salvo = await passa("item 36: quem gerencia grava a identidade", () => chamar("gestora", "rede_p4_cc_org_identidade_salvar", { p_handle: "cc_outra", p: ID }));
  ok("item 36: as cores ficam em minúsculas", salvo?.fundo === "#0f0e0d" && salvo?.fonte === "archivo");
  const orgs = await chamar("gestora", "rede_p4_cc_estudio_orgs");
  ok("item 36: o estúdio mostra a organização de quem gerencia, com a identidade", orgs?.length === 1 && orgs[0].handle === "cc_outra" && orgs[0].gerencio === true && orgs[0].identidade?.destaque === "#e8321f");
  ok("item 36 (privacidade): o estúdio não diz quem mais gerencia nem quantas pessoas", !/"(gestores|gestoras|pessoas|membros|total)"/.test(JSON.stringify(orgs)));
  ok("item 36: quem não fala pela organização não vê nada no estúdio", (await chamar("membro", "rede_p4_cc_estudio_orgs"))?.length === 0);
  const colunas = (await dono("select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_cc_org_identidade'")).rows[0].c;
  ok(`item 36 (privacidade): a identidade não guarda imagem nem quem mudou (${colunas})`, colunas === "org,fundo,destaque,texto,fonte,assinatura,mudou_em");
}

// ═══ Item 37: a zine ═══
{
  const inserir = (quem, texto, extra = {}) => banco.exclusivo(() => banco.pg.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: P[quem], aal: "aal2" })]);
    return (await tx.query("insert into interno.rede_posts (autor, texto, comunidade, publico) values ($1, $2, $3, $4) returning id",
      [P[quem], texto, extra.comunidade ?? null, extra.publico ?? null])).rows[0].id;
  }));
  const meuAberto = await inserir("edita", "Meu texto para a zine", { publico: "membros" });
  const meuSeguidores = await inserir("edita", "Só para quem me segue", { publico: "seguidores" });
  const meuFechada = await inserir("edita", "Dentro da fechada", { comunidade: "cc-fechada", publico: "membros" });
  const meuCifrado = await inserir("edita", "Vai ser cifrado", { comunidade: "cc-moradia", publico: "membros" });
  // O post da comunidade cifrada (prompt 2): texto vazio e o cifrado em corpo_grupo.
  await dono("update interno.rede_posts set grupo = 'comunidade:cc-moradia', corpo_grupo = 'p2.cifrado-de-teste', texto = '', titulo = null, corpo = null where id = $1", [meuCifrado]);
  const deFora = await inserir("fora", "Redação aberta para a internet", { comunidade: "cc-redacao", publico: "internet" });
  const deForaMembros = await inserir("fora", "Só para membros da Alumia", { publico: "membros" });
  const deForaFechado = await inserir("mod", "Texto de outra pessoa", { publico: "membros" });

  const sai = (await dono("select interno.alumia_alc_sai(p) s from interno.rede_posts p where id = $1", [deFora])).rows[0].s;
  ok("item 37: o post de outra pessoa aberto à internet pode sair (a regra do RSS)", sai === true);
  const z = await passa("item 37: a zine com os sete pedidos (e um repetido)", () => chamar("edita", "rede_p4_cc_zine_posts", { p_ids: [deFora, meuAberto, meuSeguidores, meuFechada, meuCifrado, deForaMembros, deForaFechado, meuAberto] }));
  const ids = (z?.itens ?? []).map((x) => x.id);
  ok("item 37: entram só o meu aberto e o de outra pessoa que pode sair, na ordem pedida", JSON.stringify(ids) === JSON.stringify([deFora, meuAberto]), JSON.stringify(ids));
  ok("item 37: \"fora\" conta os pedidos que ficaram de fora (sem repetir)", z?.fora === 5);
  ok("item 37 (privacidade): restrito não sai, nem o da própria pessoa (seguidores, comunidade fechada, cifrado)", ![meuSeguidores, meuFechada, meuCifrado].some((id) => ids.includes(id)));
  ok("item 37 (privacidade): post só para membros de outra pessoa não sai", !ids.includes(deForaMembros) && !ids.includes(deForaFechado));
  const tz = JSON.stringify(z);
  ok("item 37 (privacidade): sem foto, sem lugar de ato e sem número", !/"(imagens|fotos|lugar|local|apoios|respostas|total)"/.test(tz));
  ok("item 37: cada item diz se é meu (para a opção de esconder a autora)", z?.itens?.find((x) => x.id === meuAberto)?.meu === true && z?.itens?.find((x) => x.id === deFora)?.meu === false);
  await recusa("item 37: mais de 12 posts", () => chamar("edita", "rede_p4_cc_zine_posts", { p_ids: Array.from({ length: 13 }, () => crypto.randomUUID()) }), "invalido:muitos");
  const meus = await passa("item 37: os meus posts que cabem na zine", () => chamar("edita", "rede_p4_cc_zine_meus"));
  ok("item 37: a lista dos meus só tem o aberto", JSON.stringify((meus ?? []).map((x) => x.id)) === JSON.stringify([meuAberto]));
  // A trava da entrada (alumia_exigida) fecha o que sai: o de outra pessoa não vem.
  const travou = await dono("insert into interno.configuracoes (chave, valor) values ('alumia_entrada', '{\"exigir\": true}'::jsonb) on conflict (chave) do update set valor = excluded.valor").then(() => true).catch(() => false);
  if (travou && (await dono("select interno.alumia_exigida() e")).rows[0].e === true) {
    // A porta da Alumia fecha a conta sem entrada aprovada; se passar, o de outra pessoa ainda não sai.
    const zt = await chamar("edita", "rede_p4_cc_zine_posts", { p_ids: [deFora, meuAberto] }).catch((e) => ({ recusou: String(e.message) }));
    ok("item 37: com a trava da entrada, o de outra pessoa não sai", zt?.recusou?.includes("alumia_entrada") || !(zt?.itens ?? []).some((x) => x.id === deFora), JSON.stringify(zt).slice(0, 120));
    await dono("delete from interno.configuracoes where chave = 'alumia_entrada'");
  }
  const gravou = (await dono("select count(*)::int n from interno.rede_p4_cc_rascunhos where pagina like 'zine%'")).rows[0].n;
  ok("item 37: a zine não grava nada no banco", gravou === 0);
}

// ═══ As peças do aparelho (lib/rede/criacao) ═══
{
  // Itens 33 e 34: a margem.
  const T = "Peça a ordem. Peça a ordem e ligue.";
  ok("margem: vezes conta sem expressão regular (e sem sobrepor)", vezes(T, "Peça a ordem") === 2 && vezes("aaaa", "aa") === 2 && vezes(T, "") === 0);
  const sql = (await dono("select interno.rede_p4_cc_vezes($1, $2) a, interno.rede_p4_cc_vezes($1, $3) b, interno.rede_p4_cc_vezes($1, $4) c", [T, "Peça a ordem", "ligue", "(.*)"])).rows[0];
  ok("margem: a conta do aparelho é a mesma do banco", sql.a === vezes(T, "Peça a ordem") && sql.b === vezes(T, "ligue") && sql.c === vezes(T, "(.*)"));
  const a = { id: "a", versao: 1, inicio: 14, fim: 26, trecho: "Peça a ordem" };
  ok("margem: na mesma versão, a anotação fica onde foi feita", JSON.stringify(reancorar(T, a, 1)) === JSON.stringify({ inicio: 14, fim: 26 }));
  const T2 = "Antes de tudo: " + T;
  ok("margem: em outra versão, acha o trecho mais perto do lugar de antes", reancorar(T2, a, 2)?.inicio === 15 && reancorar("Peça a ordem. x. Peça a ordem", { ...a, inicio: 20 }, 2)?.inicio === 17);
  ok("margem: o trecho sumiu: nula (a tela diz que mudou)", reancorar("Outro texto.", a, 2) === null);
  ok("margem: comentário da página inteira não tem lugar no texto", reancorar(T, { id: "b", versao: 1, inicio: null, fim: null, trecho: "" }, 1) === null);
  const ps = pedacos("abcdef", [{ id: "x", inicio: 1, fim: 4 }, { id: "y", inicio: 3, fim: 5 }, { id: "z", inicio: 9, fim: 12 }]);
  ok("margem: os pedaços cobrem o texto inteiro e marcam os cruzamentos", ps.map((p) => p.texto).join("") === "abcdef" && JSON.stringify(ps.find((p) => p.texto === "d")?.ids) === JSON.stringify(["x", "y"]) && ps[0].ids.length === 0);
  ok("margem: a seleção tira os espaços das pontas", JSON.stringify(selecaoValida("  ola mundo  ", 0, 13)) === JSON.stringify({ inicio: 2, fim: 11, trecho: "ola mundo" }));
  ok("margem: seleção vazia ou de mais de 500 letras não anota", selecaoValida("   ", 0, 3) === null && selecaoValida("x".repeat(600), 0, 501) === null && selecaoValida("x".repeat(600), 0, 500) !== null);
  ok("margem: trecho para sugerir tem de aparecer uma vez", trechoParaSugerir(T, "Peça a ordem") === "repetido" && trechoParaSugerir(T, "nada") === "nenhuma" && trechoParaSugerir(T, "ligue") === null);
  ok("margem: a prévia da troca é a mesma do banco (só quando o trecho é único)", comSugestao(T, "ligue", "telefone") === "Peça a ordem. Peça a ordem e telefone." && comSugestao(T, "Peça a ordem", "x") === T && comSugestao("custa $5", "$5", "$&") === "custa $&");

  // Item 36: o cartaz.
  ok("cartaz: o contraste vai de 1 a 21", Math.abs(contraste("#000000", "#ffffff") - 21) < 0.01 && Math.abs(contraste("#777777", "#777777") - 1) < 1e-9);
  for (const [x, y] of [["#0f0e0d", "#f3efe6"], ["#ffffff", "#cccccc"], ["#e8321f", "#ffffff"], ["#23408e", "#f0b323"]]) {
    const doBanco = Number((await dono("select interno.rede_p4_cc_contraste($1, $2) c", [x, y])).rows[0].c);
    ok(`cartaz: o contraste ${x} e ${y} é o mesmo no aparelho e no banco`, Math.abs(doBanco - contraste(x, y)) < 1e-6, `${doBanco} e ${contraste(x, y)}`);
  }
  ok("cartaz: a identidade da Alumia passa", erroDaIdentidade(IDENTIDADE_DA_ALUMIA) === null);
  ok("cartaz: o aparelho recusa com os códigos do banco", erroDaIdentidade({ ...IDENTIDADE_DA_ALUMIA, fundo: "#ffffff", texto: "#cccccc" }) === "invalido:contraste"
    && erroDaIdentidade({ ...IDENTIDADE_DA_ALUMIA, destaque: "red" }) === "invalido:cor" && erroDaIdentidade({ ...IDENTIDADE_DA_ALUMIA, fonte: "comic" }) === "invalido:fonte"
    && erroDaIdentidade({ ...IDENTIDADE_DA_ALUMIA, assinatura: "https://x.org" }) === "invalido:assinatura");
  ok("cartaz: o texto sobre o destaque é o de mais contraste", sobre("#ffc21a") === "#0f0e0d" && sobre("#23408e") === "#ffffff");
  // Um contexto de mentira: anota o que seria desenhado. Nada de rede, nada de imagem de fora.
  for (const modelo of MODELOS) {
    const escritos = [];
    let retangulos = 0;
    const ctx = {
      font: "", fillStyle: "", textBaseline: "", textAlign: "",
      measureText: (t) => ({ width: t.length * (parseInt(/(\d+)px/.exec(ctx.font)?.[1] ?? "10", 10) * 0.55) }),
      fillText: (t, x, y) => escritos.push({ t, x, y }),
      fillRect: () => retangulos++,
    };
    desenharCartaz(ctx, modelo, IDENTIDADE_DA_ALUMIA, { chamada: "Ato", titulo: "Moradia é direito", texto: "Todo mundo junto na praça. ".repeat(20), quando: "Sábado, 10h", onde: "Praça central", assinatura: "Coletivo Exemplo" }, "sans-serif");
    const { largura, altura } = TAMANHOS_DO_CARTAZ[modelo];
    ok(`cartaz ${modelo}: desenha o título, o quando e a assinatura`, escritos.some((e) => /MORADIA|Moradia/.test(e.t)) && escritos.some((e) => e.t.includes("Sábado")) && escritos.some((e) => e.t === "Coletivo Exemplo"));
    ok(`cartaz ${modelo}: nada sai da folha`, escritos.every((e) => e.x >= 0 && e.x < largura && e.y > 0 && e.y <= altura), JSON.stringify(escritos.filter((e) => !(e.y > 0 && e.y <= altura))).slice(0, 200));
    ok(`cartaz ${modelo}: pinta o fundo e a faixa`, retangulos >= 12);
  }
  ok("cartaz: o nome do arquivo é limpo", nomeDoArquivo("Ato pela Moradia: já!", "lambe") === "lambe-ato-pela-moradia-ja.png" && nomeDoArquivo("", "cartaz") === "cartaz-alumia.png");

  // Item 37: a zine.
  const post = (i, texto, autor = "Codinome X") => ({ id: `id-${i}`, tipo: "post", titulo: i === 0 ? "Por que **ocupar**" : null, texto, longo: false, aviso: "", criado_em: "", comunidade: null, autor: { codinome: autor, handle: "x" }, meu: true });
  const z3 = montarZine([post(0, "Curto."), post(1, "Outro [link](https://exemplo.org) curto."), post(2, "Frase. ".repeat(200))], { titulo: "Nossa zine", esconderAutora: false });
  ok("zine: com três posts, um por página (2, 3 e 4), e o resto em branco", z3.miolo.map((p) => p.partes.length).join() === "1,1,1,0,0,0" && z3.miolo[0].numero === 2);
  ok("zine: o markdown vira texto simples (sem link)", z3.miolo[0].partes[0].titulo === "Por que ocupar" && z3.miolo[1].partes[0].texto === "Outro link curto.");
  ok("zine: texto longo é cortado e contado", z3.miolo[2].partes[0].texto.length <= 600 && z3.cortados === 1);
  ok("zine: a autora aparece pelo codinome", z3.miolo[0].partes[0].autora === "Codinome X");
  const zSem = montarZine([post(0, "a"), post(1, "b")], { titulo: "", esconderAutora: true });
  ok("zine (privacidade): esconder quem escreveu tira o codinome de toda a zine", zSem.miolo.every((p) => p.partes.every((x) => x.autora === null)) && !JSON.stringify(zSem).includes("Codinome"));
  ok("zine: sem título, a capa diz Zine", zSem.capa.titulo === "Zine");
  const z12 = montarZine(Array.from({ length: 13 }, (_, i) => post(i, "Texto do post. ".repeat(10))), { titulo: "x", esconderAutora: false });
  ok("zine: com doze posts, dois por página, e o décimo terceiro fica de fora", z12.miolo.every((p) => p.partes.length === 2) && z12.cortados >= 1);
  ok("zine: a folha tem as 8 páginas, uma vez cada, a fileira de cima de cabeça para baixo",
    JSON.stringify(ORDEM_NA_FOLHA.map((q) => q.pagina).sort()) === "[1,2,3,4,5,6,7,8]" && ORDEM_NA_FOLHA.slice(0, 4).every((q) => q.invertida) && ORDEM_NA_FOLHA.slice(4).every((q) => !q.invertida));
  ok("zine: o id do post sai do link colado", idDoPost("https://exemplo/pt/alumia/post/5EDC5C95-301e-4316-8adc-58c2c4393ccb?x=1") === "5edc5c95-301e-4316-8adc-58c2c4393ccb" && idDoPost("nada") === null);

  // O cliente: cada chamada é uma função do grupo que existe na migração; o dublê da prévia não chama nada.
  const chamadas = [];
  const cli = criarClienteDaCriacao(async (f, x) => (chamadas.push([f, x]), null));
  await Promise.all([cli.aberto(), cli.minhasComunidades(), cli.rascunhos("s"), cli.criarRascunho("s", "t", "nota", "c"), cli.pagina("s", "p"), cli.sugerir("s", "p", 1, "a", "b", ""),
    cli.decidir("i", true), cli.anotar("s", "p", 1, null, null, "t"), cli.responder("i", "t"), cli.resolver("i", true), cli.apagar("anotacao", "i"), cli.fechar("s", "p", true),
    cli.estudioOrgs(), cli.salvarIdentidade("h", IDENTIDADE_DA_ALUMIA), cli.zinePosts(["a"]), cli.zineMeus()]);
  const existentes = new Set([...SQL.matchAll(/function public\.(rede_p4_cc_\w+)/g)].map((m) => m[1]));
  ok(`o cliente só chama funções do grupo que existem (${chamadas.length})`, chamadas.length === 16 && chamadas.every(([f]) => existentes.has(f)), chamadas.map(([f]) => f).filter((f) => !existentes.has(f)).join());
  const d = dubleDaCriacao();
  ok("o dublê da prévia anda sem banco", d.previa === true && (await d.minhasComunidades()).length === 1 && (await d.pagina("s", "cartilha-de-direitos")).anotacoes.length === 1);
}

// ═══ Os arquivos do grupo: a flag, os textos, a rota e a tela ═══
ok("a flag está em lib/recursos.ts, só pelo nome", /"alumia-p4-criacao-coletiva"/.test(ler("lib/recursos.ts")) && /SO_PELO_NOME[^;]*"alumia-p4-criacao-coletiva"/.test(ler("lib/recursos.ts")));
{
  // Os textos: o português é o final; os outros cinco têm as mesmas chaves e a marca "_rascunho" (a tela fica em português até a revisão).
  const chaves = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${pre}${k}.`) : [`${pre}${k}${Array.isArray(v) ? `[${v.length}]` : ""}`])).filter((k) => k !== "_rascunho").sort();
  const pt = JSON.parse(ler("i18n/rede/criacao-coletiva/pt.json"));
  ok("textos: o português não é rascunho", !("_rascunho" in pt));
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const x = JSON.parse(ler(`i18n/rede/criacao-coletiva/${l}.json`));
    ok(`textos ${l}: rascunho, com as mesmas chaves do português`, typeof x._rascunho === "string" && x._rascunho.length > 0 && JSON.stringify(chaves(x)) === JSON.stringify(chaves(pt)));
  }
  const usados = [...ler("components/rede/criacao/Margem.tsx").matchAll(/\bm\.(\w+)/g), ...ler("components/rede/criacao/Cartaz.tsx").matchAll(/\bc\.(\w+)/g), ...ler("components/rede/criacao/Zine.tsx").matchAll(/\bz\.(\w+)/g)];
  const faltam = usados.filter((u) => {
    const pacote = u.input.includes("const z = t.zine") && u[0].startsWith("z.") ? pt.zine : u[0].startsWith("c.") && u.input.includes("const c = t.cartaz") ? pt.cartaz : pt.margem;
    return !(u[1] in pacote);
  }).map((u) => u[0]);
  ok(`textos: toda chave que a tela usa existe em português (${[...new Set(faltam)].join(", ")})`, faltam.length === 0);
  for (const codigo of ["desligado", "sem_permissao", "nao_encontrado", "conflito", "invalido:trecho", "invalido:proposta", "invalido:contraste", "dado_pessoal", "ja_existe", "ja_decidida", "travado", "nao_e_rascunho", "muitos_pedidos"])
    ok(`textos: o erro ${codigo} do banco tem frase`, typeof pt.erros[codigo] === "string");

  // A rota, o registro e o menu.
  const rotas = ler("lib/rede/rotas-novas.ts");
  ok("a rota /criacao nasce atrás da flag do grupo e nunca é indexada", /\{ nome: "criacao-coletiva", caminho: "\/criacao", flag: "alumia-p4-criacao-coletiva", frente: "P4", indexar: false \}/.test(rotas));
  // Auditoria do P4 (B7): a descrição da flag no painel dizia /alumia/criar. Toda descrição que cita um endereço /alumia/… de uma
  // flag com rota registrada tem de citar um endereço que essa flag de fato abre.
  {
    const registradas = [...rotas.matchAll(/caminho: "([^"]+)", flag: "([^"]+)"/g)].map((m) => ({ caminho: m[1], flag: m[2] }));
    const erradas = [];
    for (const m of ler("lib/recursos.ts").matchAll(/^\s*"([a-z0-9-]+)": "([^"]*)"/gm)) {
      const daFlag = registradas.filter((x) => x.flag === m[1]).map((x) => x.caminho);
      if (!daFlag.length) continue;
      for (const c of m[2].matchAll(/\/alumia(\/[a-z0-9\-/]+)/g)) if (!daFlag.includes(c[1])) erradas.push(`${m[1]}: /alumia${c[1]}`);
    }
    ok(`a descrição de cada flag no painel cita o endereço de verdade da rota (${erradas.join(", ")})`, erradas.length === 0);
  }
  ok("a página passa pela PaginaNova (404 com a flag desligada)", /PaginaNova nome="criacao-coletiva"/.test(ler("app/[lang]/alumia/criacao/page.tsx")));
  ok("a tela está no registro com import dinâmico", /"criacao-coletiva": \{ componente: dynamic\(\(\) => import\("\.\/criacao\/TelaDaCriacaoColetiva"\), \{ ssr: false \}\)/.test(ler("components/rede/registro.tsx")));
  ok("o menu só ganha o item com a rota ligada", /!rotaNovaLigada\("criacao-coletiva"\) \? \{\} :/.test(ler("components/rede/criacao/encaixe.tsx")) && /criacaoColetiva/.test(ler("components/rede/encaixes.tsx")));
  ok("a rota responde no endereço da Alumia", /"criacao",/.test(ler("lib/rede/alumia.ts")));
  // Regra 6: nada sai para terceiros pelo navegador; o cartaz e a zine não chamam endereço nenhum.
  const tela = ["TelaDaCriacaoColetiva", "Margem", "Cartaz", "Zine", "cliente"].map((n) => ler(`components/rede/criacao/${n}.${n === "cliente" ? "ts" : "tsx"}`)).join("\n")
    + ["margem", "cartaz", "zine", "cliente"].map((n) => ler(`lib/rede/criacao/${n}.ts`)).join("\n");
  ok("regra 6: nenhuma chamada a outro endereço (fetch, XHR, imagem ou fonte de fora)", !/\bfetch\(|XMLHttpRequest|https?:\/\/(?!exemplo)/.test(tela.replace(/\/\/.*$/gm, "")));
  ok("nada de Math.random", !/Math\.random/.test(tela));
  ok("a tela não guarda nada no navegador (nem rascunho de cartaz)", !/localStorage|sessionStorage|indexedDB/.test(tela));
  const css = ler("components/rede/criacao/criacao.css");
  ok("alvos de toque de 44 px e movimento reduzido no CSS", /min-height: 44px/.test(css) && /prefers-reduced-motion: reduce/.test(css));
}


await banco.pg.close?.();
console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("criação coletiva (itens 33, 34, 36 e 37): tudo certo");
