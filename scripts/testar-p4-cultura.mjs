// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, itens 38 a 42 (cultura): obra seriada com aviso de capítulo novo, mural de arte, cineclube, clube de leitura e playlist.
//   · antes da migração: nada disso existe (as funções não estão no banco e o encontro não pode ser de comunidade);
//   · com o interruptor desligado, tudo recusa com "desligado";
//   · cada item funciona e cumpre a regra de privacidade dele: nenhum número abaixo de 3, nenhuma lista de pessoas (nenhuma resposta
//     traz o id de ninguém), nenhum IP, nenhum texto de post no aviso, nenhum histórico do progresso de leitura;
//   · a tela: rota, flag, painel, registro, textos nos seis idiomas e nenhum pedido do aparelho a serviço de fora.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-p4-cultura.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { anoOk, imagemDaPrevia, linkDaPlaylist, localPublico, postDoEndereco } from "../lib/rede/cultura/regras.ts";
import { somarGrupo } from "../lib/rede/cultura/cliente.ts";
import { RECURSOS, SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";
import { ROTAS_NOVAS } from "../lib/rede/rotas-novas.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const igual = (nome, a, b) => ok(`${nome} (veio ${JSON.stringify(a)})`, JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b)));
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

const FLAG = "alumia-p4-cultura";
// O que é deste lote (os outros lotes do Prompt 4 também usam o prefixo rede_p4_).
const TABELAS = ["rede_p4_obras", "rede_p4_capitulos", "rede_p4_obra_seguir", "rede_p4_pecas", "rede_p4_cine_sessoes", "rede_p4_cine_diario", "rede_p4_livros",
  "rede_p4_leitura", "rede_p4_citacoes", "rede_p4_playlist"];
const PUBLICAS = ["rede_p4_cultura_ligado", "rede_p4_cultura_inicio", "rede_p4_obra_criar", "rede_p4_obra_apagar", "rede_p4_obra_capitulo",
  "rede_p4_obra_capitulo_tirar", "rede_p4_obras", "rede_p4_obra", "rede_p4_obra_seguir", "rede_p4_peca_criar", "rede_p4_peca_tirar", "rede_p4_mural",
  "rede_p4_cine", "rede_p4_cine_marcar", "rede_p4_cine_desmarcar", "rede_p4_cine_anotar", "rede_p4_cine_nota_tirar", "rede_p4_estante",
  "rede_p4_livro_por", "rede_p4_livro_situacao", "rede_p4_livro_tirar", "rede_p4_leitura_marcar", "rede_p4_citacao_por", "rede_p4_citacao_tirar",
  "rede_p4_playlist", "rede_p4_playlist_por", "rede_p4_playlist_tirar"];
const INTERNAS = ["rede_p4_cultura_ligado", "rede_p4_cultura_exige", "rede_p4_cult_le", "rede_p4_cult_escreve", "rede_p4_cult_comunidade", "rede_p4_cult_tres", "rede_p4_cult_post_meu",
  "rede_p4_cult_ve", "rede_p4_obra_json", "rede_p4_peca_json", "rede_p4_livro_json", "rede_p4_cult_local", "rede_p4_cult_ano"];
/** Compara objetos sem ligar para a ordem das chaves (o jsonb reordena). */
const ordenado = (v) => (Array.isArray(v) ? v.map(ordenado) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado(v[k])])) : v);
const SQL = normal(ler("supabase/migracoes/20261127-p4-cultura.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

// ═══ 0. A migração no padrão ═══
ok("a migração começa com a licença", SQL.startsWith("-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later"));
ok("a migração diz que pode rodar mais de uma vez e a lei", SQL.includes("Pode rodar mais de uma vez") && /-- Lei: LGPD art\./.test(SQL));
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem/i.test(semComentario));
ok("a migração não sobe a versão da Alumia", !/rede_alumia_versao/.test(semComentario));
ok("o interruptor entra no catálogo protegido por to_regclass", /to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-cultura', true\)/.test(SQL));
{
  const publicas = [...semComentario.matchAll(/create or replace function public\.(rede_p4_\w+)\([^)]*\)[^$]*?\$\$\s*declare[^;]*;?[\s\S]*?\bbegin\s+([^\n]*)/g)];
  const semDeclare = [...semComentario.matchAll(/create or replace function public\.(rede_p4_\w+)\([^)]*\)[^$]*?\$\$\s*begin\s+([^\n]*)/g)];
  const todas = [...publicas, ...semDeclare];
  ok(`as funções públicas são muitas (${todas.length})`, todas.length >= 27);
  const semPorta = todas.filter((m) => !m[2].startsWith("perform interno.alumia_porta();")).map((m) => m[1]);
  igual("toda função pública começa pela porta", semPorta, []);
  ok("nenhuma função pública tira valor do banco no declare (a porta vem antes)", !/create or replace function public\.rede_p4_\w+\([^)]*\)[^$]*\$\$\s*declare[^;]*:=\s*interno\./.test(semComentario));
}

// ═══ 1. Antes: nada disso existe ═══
// Colada no install.sql (depois da junção), o banco de antes é o install.sql cortado antes dela.
const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
const { dono, rpc } = banco;
const install = normal(ler("supabase/install.sql"));
{
  const n = (await dono("select count(*)::int n from pg_proc where proname like 'rede_p4_obra%' or proname like 'rede_p4_playlist%'")).rows[0].n;
  igual("antes: as funções da cultura não existem", n, 0);
  const nucleoObrigatorio = (await dono("select is_nullable from information_schema.columns where table_schema = 'interno' and table_name = 'rede_encontros' and column_name = 'nucleo'")).rows[0].is_nullable;
  igual("antes: o encontro só podia ser de núcleo", nucleoObrigatorio, "NO");
}

// ═══ 2. A migração ═══
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  igual("trancar não acha nada aberto", r.abertas, []);
  const semPorta = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\\_p4\\_%' and p.prosrc !~ 'interno\\.alumia_(porta|passa)\\(\\)'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows.map((x) => x.proname);
  // As que só o servidor do site chama (execute só para service_role) a porta não alcança; a regra de leitura do depósito da
  // memória (20261127-p4-memoria-e-luta.sql) passa por interno.alumia_passa().
  igual("no banco, toda rede_p4_ que anon ou authenticated chamam tem a porta", semPorta, []);
  const tabelas = (await dono(`select c.relname, c.relrowsecurity, (select count(*) from pg_policy po where po.polrelid = c.oid)::int as politicas
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and c.relname = any($1) order by 1`, [TABELAS])).rows;
  ok(`são 10 tabelas novas (${tabelas.map((t) => t.relname).join(", ")})`, tabelas.length === 10);
  igual("todas com RLS ligada e sem política", tabelas.filter((t) => !t.relrowsecurity || t.politicas > 0).map((t) => t.relname), []);
  const ip = (await dono(`select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'interno' and table_name = any($1)
    and (data_type in ('inet', 'cidr') or column_name ~ '(^|_)(ip|origem|endereco_ip)($|_)')`, [TABELAS])).rows.map((x) => x.c);
  igual("nenhuma coluna de endereço de rede", ip, []);
  const leitura = (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_leitura' order by ordinal_position")).rows.map((x) => x.column_name);
  igual("o progresso de leitura não tem data (sem histórico de comportamento)", leitura, ["livro", "usuario", "pct"]);
  const execAnon = (await dono(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any($1) and has_function_privilege('anon', p.oid, 'execute')`, [PUBLICAS])).rows[0].n;
  igual("visitante sem sessão não chama nenhuma função da cultura", execAnon, 0);
  const internas = (await dono(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname = any($1) and has_function_privilege('authenticated', p.oid, 'execute')`, [INTERNAS])).rows[0].n;
  igual("as peças de dentro não são chamáveis por quem tem sessão", internas, 0);
}

// ═══ 3. As pessoas e as comunidades ═══
const NOMES = ["ana", "bia", "caio", "duda", "eva", "fia"];
const P = {};
for (const [i, nome] of NOMES.entries()) {
  P[nome] = await banco.criarUsuario(`${nome}@p4-cultura.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Codinome ${nome}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono("insert into interno.rede_comunidades (slug, nome, categoria, tipo) values ('cine-praca', 'Cine Praça', 'lutas', 'aberta'), ('roda-fechada', 'Roda fechada', 'lutas', 'fechada') on conflict do nothing");
for (const nome of ["ana", "bia", "caio", "duda", "eva"]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao, papel) values ('cine-praca', $1, 'ativo', $2) on conflict do nothing", [P[nome], nome === "ana" ? "moderacao" : "membro"]);
}
for (const nome of ["ana", "caio"]) await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, situacao) values ('roda-fechada', $1, 'ativo') on conflict do nothing", [P[nome]]);

const como = (nome) => ({ papel: "authenticated", sub: P[nome], ip: "198.51.100.9" });
const chamar = async (nome, funcao, argumentos = {}) => {
  await dono("delete from interno.limites");
  return rpc(como(nome), funcao, argumentos);
};
const IDS = new Set(Object.values(P));
/** Nenhuma resposta traz o id de uma pessoa (nenhuma lista de pessoas, nem escondida no JSON). */
const semPessoas = (nome, r) => {
  const texto = JSON.stringify(r ?? null);
  ok(`${nome}: a resposta não traz o id de ninguém`, ![...IDS].some((id) => texto.includes(id)));
};

// ═══ 4. Desligado ═══
await recusa("desligado: criar obra recusa", () => chamar("ana", "rede_p4_obra_criar", { p: { titulo: "Cordel da greve", genero: "cordel" } }), "desligado");
await recusa("desligado: a playlist recusa", () => chamar("ana", "rede_p4_playlist", { p_comunidade: "cine-praca" }), "desligado");
igual("desligado: a tela sabe que está desligado", await chamar("ana", "rede_p4_cultura_ligado"), false);
await dono("insert into interno.recursos_vivos (nome, ligado) values ($1, true) on conflict (nome) do update set ligado = true", [FLAG]);
igual("ligado pelo painel: a tela sabe", await chamar("ana", "rede_p4_cultura_ligado"), true);
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-2', false) on conflict (nome) do update set ligado = false");
await recusa("com a Alumia 2 desligada no painel, a cultura também", () => chamar("ana", "rede_p4_obras", { p: {} }), "desligado");
await dono("delete from interno.recursos_vivos where nome = 'alumia-2'");
{
  const inicio = await passa("início: as comunidades de quem chama", () => chamar("ana", "rede_p4_cultura_inicio"));
  igual("início: só as comunidades da própria pessoa", (inicio?.comunidades ?? []).map((c) => [c.slug, c.modero]), [["cine-praca", true], ["roda-fechada", false]]);
  semPessoas("início", inicio);
}

const publicar = async (nome, pedido) => {
  await dono("delete from interno.limites");
  return rpc(como(nome), "rede_publicar", { p: pedido });
};

// ═══ 5. Item 38: obra seriada ═══
{
  const TEXTO = "No sertão da fábrica, o apito chamou a greve.";
  const cap1 = await passa("38: ana publica o primeiro capítulo como post", () => publicar("ana", { texto: TEXTO }));
  const cap2 = await passa("38: e o segundo", () => publicar("ana", { texto: "Segundo canto: a assembleia na porta." }));
  const fechado = await passa("38: e um terceiro só para a roda fechada", () => publicar("ana", { comunidade: "roda-fechada", publico: "comunidade", texto: "Canto da roda." }));
  const alheio = await passa("38: bia publica um post dela", () => publicar("bia", { texto: "Post da bia." }));
  await recusa("38: gênero fora da lista recusa", () => chamar("ana", "rede_p4_obra_criar", { p: { titulo: "Romance", genero: "romance" } }), "invalido:genero");
  // fia sem o consentimento das normas deixa de ser membro da Rede: não cria obra.
  await dono("delete from interno.rede_consentimentos where usuario = $1", [P.fia]);
  await recusa("38: quem não é membro da Rede não cria", () => chamar("fia", "rede_p4_obra_criar", { p: { titulo: "Obra", genero: "conto" } }), "");
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P.fia]);
  const obra = await passa("38: ana cria a obra (cordel)", () => chamar("ana", "rede_p4_obra_criar", { p: { titulo: "Cordel da greve", genero: "cordel", sinopse: "Uma greve em versos." } }));
  semPessoas("38: obra criada", obra);
  igual("38: a autora aparece pelo codinome", obra?.autor, "Codinome ana");
  if (obra?.id && cap1?.id && cap2?.id && fechado?.id && alheio?.id) {
    await recusa("38: post de outra pessoa não vira capítulo", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: alheio.id }), "nao_encontrado");
    await recusa("38: outra pessoa não liga capítulo na obra da ana", () => chamar("bia", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: alheio.id }), "nao_encontrado");
    // Ninguém segue ainda: o capítulo 1 não avisa ninguém.
    await passa("38: capítulo 1", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: cap1.id, p_titulo: "O apito" }));
    await recusa("38: o mesmo post não entra duas vezes", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: cap1.id }), "ja_ligado");
    for (const nome of ["bia", "caio", "duda"]) await passa(`38: ${nome} segue a obra`, () => chamar(nome, "rede_p4_obra_seguir", { p_id: obra.id, p_seguir: true }));
    await recusa("38: a autora não segue a própria obra", () => chamar("ana", "rede_p4_obra_seguir", { p_id: obra.id, p_seguir: true }), "invalido:minha");
    const antes = (await dono("select count(*)::int n from interno.avisos where post is not null and texto like 'Saiu um capítulo novo%'")).rows[0].n;
    igual("38: sem capítulo novo depois de seguir, nenhum aviso ainda", antes, 0);
    await passa("38: capítulo 2", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: cap2.id, p_titulo: "A assembleia" }));
    const avisos = (await dono("select para, texto, post from interno.avisos where texto like 'Saiu um capítulo novo%' order by para")).rows;
    igual("38: o capítulo novo avisa as três que seguem", avisos.map((a) => a.para).sort(), [P.bia, P.caio, P.duda].sort());
    ok("38: o aviso leva o capítulo e não o texto do post", avisos.every((a) => a.post === cap2.id && !a.texto.includes("assembleia") && !a.texto.includes("Segundo canto")));
    // O capítulo da roda fechada: só caio (que é da roda) recebe e vê.
    await passa("38: capítulo 3, da roda fechada", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: fechado.id }));
    const doFechado = (await dono("select para from interno.avisos where post = $1", [fechado.id])).rows.map((a) => a.para);
    igual("38: o aviso do capítulo fechado só vai para quem pode vê-lo", doFechado, [P.caio]);
    const vistaBia = await passa("38: bia abre a obra", () => chamar("bia", "rede_p4_obra", { p_id: obra.id }));
    igual("38: bia vê só os capítulos que pode ver", (vistaBia?.lista ?? []).map((c) => c.numero), [1, 2]);
    igual("38: quem segue não vê quantas pessoas seguem", vistaBia?.seguidores ?? null, null);
    igual("38: bia sabe que segue", vistaBia?.sigo, true);
    semPessoas("38: a obra vista por quem segue", vistaBia);
    const vistaCaio = await passa("38: caio (da roda) abre a obra", () => chamar("caio", "rede_p4_obra", { p_id: obra.id }));
    igual("38: caio vê os três", (vistaCaio?.lista ?? []).map((c) => c.numero), [1, 2, 3]);
    const vistaAna = await passa("38: ana abre a obra", () => chamar("ana", "rede_p4_obra", { p_id: obra.id }));
    igual("38: a autora vê o número de quem segue, porque são 3", vistaAna?.seguidores, 3);
    semPessoas("38: a obra vista pela autora", vistaAna);
    await passa("38: duda deixa de seguir", () => chamar("duda", "rede_p4_obra_seguir", { p_id: obra.id, p_seguir: false }));
    const comDuas = await passa("38: ana abre de novo", () => chamar("ana", "rede_p4_obra", { p_id: obra.id }));
    igual("38: com 2 pessoas seguindo, nenhum número (nunca abaixo de 3)", comDuas?.seguidores ?? null, null);
    const lista = await passa("38: as obras que bia segue", () => chamar("bia", "rede_p4_obras", { p: { filtro: "seguindo" } }));
    igual("38: a lista do que bia segue", (lista?.itens ?? []).map((o) => [o.titulo, o.capitulos]), [["Cordel da greve", 2]]);
    semPessoas("38: a lista de obras", lista);
    const deCordel = await passa("38: as obras de cordel para eva", () => chamar("eva", "rede_p4_obras", { p: { genero: "cordel" } }));
    igual("38: eva acha a obra pelo gênero", (deCordel?.itens ?? []).length, 1);
    await passa("38: ana tira o capítulo 2", () => chamar("ana", "rede_p4_obra_capitulo_tirar", { p_obra: obra.id, p_numero: 2 }));
    const postFica = (await dono("select apagado_em is null as no_ar from interno.rede_posts where id = $1", [cap2.id])).rows[0]?.no_ar;
    igual("38: tirar o capítulo não apaga o post", postFica, true);
    // A obra cujos capítulos ninguém de fora vê não aparece para quem é de fora.
    const soFechada = await passa("38: ana cria uma obra só com capítulo fechado", () => chamar("ana", "rede_p4_obra_criar", { p: { titulo: "Poemas da roda", genero: "poesia" } }));
    const outroFechado = await publicar("ana", { comunidade: "roda-fechada", publico: "comunidade", texto: "Poema da roda." });
    if (soFechada?.id) {
      await passa("38: capítulo fechado na obra nova", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: soFechada.id, p_post: outroFechado.id }));
      await recusa("38: bia (de fora da roda) nem acha a obra", () => chamar("bia", "rede_p4_obra", { p_id: soFechada.id }), "nao_encontrado");
      await recusa("38: e não consegue segui-la", () => chamar("bia", "rede_p4_obra_seguir", { p_id: soFechada.id, p_seguir: true }), "nao_encontrado");
    }
    // Post cifrado não vira capítulo (o título ficaria aberto no servidor).
    const cifrado = await publicar("ana", { comunidade: "roda-fechada", publico: "comunidade", grupo: "comunidade:roda-fechada", corpo_grupo: "p2.3.dmV0b3I.Y2lmcmFkb3NlZ3JlZG9wYWxhdnJhdW5pY2E" }).catch(() => null);
    if (cifrado?.id) await recusa("38: post cifrado não vira capítulo", () => chamar("ana", "rede_p4_obra_capitulo", { p_obra: obra.id, p_post: cifrado.id }), "invalido:cifrado");
    else falhas.push("38: não deu para publicar o post cifrado do teste");
    // Bloqueio: quem a autora bloqueou não acha a obra.
    await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2) on conflict do nothing", [P.ana, P.eva]);
    await recusa("38: quem foi bloqueada não abre a obra", () => chamar("eva", "rede_p4_obra", { p_id: obra.id }), "nao_encontrado");
    await dono("delete from interno.rede_bloqueios");
  }
}

// ═══ 6. Item 39: mural de arte ═══
{
  const arte = await passa("39: bia publica a foto de um lambe", () => publicar("bia", { texto: "Lambe novo na parede da escola." }));
  const roda = await passa("39: caio publica na roda fechada", () => publicar("caio", { comunidade: "roda-fechada", publico: "comunidade", texto: "Desenho da roda." }));
  if (arte?.id && roda?.id) {
    await recusa("39: linguagem fora da lista recusa", () => chamar("bia", "rede_p4_peca_criar", { p: { post: arte.id, titulo: "Lambe", linguagem: "nft" } }), "invalido:linguagem");
    await recusa("39: post de outra pessoa não vira peça", () => chamar("ana", "rede_p4_peca_criar", { p: { post: arte.id, titulo: "Lambe", linguagem: "lambe" } }), "nao_encontrado");
    const peca = await passa("39: bia põe a peça no portfólio", () => chamar("bia", "rede_p4_peca_criar", { p: { post: arte.id, titulo: "Lambe da escola", linguagem: "lambe" } }));
    igual("39: a peça sai com o codinome", peca?.autor, "Codinome bia");
    semPessoas("39: a peça", peca);
    await recusa("39: o mesmo post não vira duas peças", () => chamar("bia", "rede_p4_peca_criar", { p: { post: arte.id, titulo: "De novo", linguagem: "lambe" } }), "ja_ligado");
    await passa("39: caio põe a peça da roda", () => chamar("caio", "rede_p4_peca_criar", { p: { post: roda.id, titulo: "Desenho da roda", linguagem: "desenho" } }));
    const muralEva = await passa("39: eva vê o mural", () => chamar("eva", "rede_p4_mural", { p: {} }));
    igual("39: eva (de fora da roda) vê só a peça que pode ver", (muralEva?.itens ?? []).map((x) => x.titulo), ["Lambe da escola"]);
    semPessoas("39: o mural", muralEva);
    const muralAna = await passa("39: ana (da roda) vê o mural", () => chamar("ana", "rede_p4_mural", { p: {} }));
    igual("39: ana vê as duas", (muralAna?.itens ?? []).map((x) => x.titulo).sort(), ["Desenho da roda", "Lambe da escola"]);
    const lambes = await passa("39: o mural só de lambes", () => chamar("ana", "rede_p4_mural", { p: { linguagem: "lambe" } }));
    igual("39: o filtro por linguagem", (lambes?.itens ?? []).length, 1);
    const portfolio = await passa("39: o portfólio de bia pelo @", () => chamar("eva", "rede_p4_mural", { p: { handle: "@pessoa_bia" } }));
    igual("39: o portfólio diz o codinome", portfolio?.autor, "Codinome bia");
    igual("39: e traz as peças dela", (portfolio?.itens ?? []).length, 1);
    await recusa("39: portfólio de @ que não existe", () => chamar("eva", "rede_p4_mural", { p: { handle: "ninguem_aqui" } }), "nao_encontrado");
    await recusa("39: outra pessoa não tira a peça", () => chamar("eva", "rede_p4_peca_tirar", { p_id: peca.id }), "nao_encontrado");
    await passa("39: bia tira a peça", () => chamar("bia", "rede_p4_peca_tirar", { p_id: peca.id }));
  }
}

// ═══ 7. Item 40: cineclube ═══
{
  const daqui = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await recusa("40: quem não modera não marca sessão", () => chamar("bia", "rede_p4_cine_marcar", { p: { comunidade: "cine-praca", quando: daqui, local_tipo: "biblioteca", local_texto: "Biblioteca do bairro", filme: "Eles não usam black-tie" } }), "sem_permissao");
  await recusa("40: endereço de casa recusa", () => chamar("ana", "rede_p4_cine_marcar", { p: { comunidade: "cine-praca", quando: daqui, local_tipo: "outro", local_texto: "Rua das Flores, 123", filme: "Filme" } }), "dado_pessoal");
  await recusa("40: CEP recusa", () => chamar("ana", "rede_p4_cine_marcar", { p: { comunidade: "cine-praca", quando: daqui, local_tipo: "outro", local_texto: "perto do 01310-100", filme: "Filme" } }), "dado_pessoal");
  await recusa("40: ano absurdo recusa", () => chamar("ana", "rede_p4_cine_marcar", { p: { comunidade: "cine-praca", quando: daqui, local_tipo: "praca", local_texto: "", filme: "Filme", ano: 1700 } }), "invalido:ano");
  const sessao = await passa("40: a moderação marca a sessão", () => chamar("ana", "rede_p4_cine_marcar", { p: { comunidade: "cine-praca", quando: daqui, local_tipo: "biblioteca", local_texto: "Biblioteca do bairro", filme: "Eles não usam black-tie", ano: "1981", sinopse: "Greve e família." } }));
  const encontro = sessao?.id ? (await dono("select nucleo, comunidade from interno.rede_encontros where id = $1", [sessao.id])).rows[0] : null;
  igual("40: a sessão é um encontro da comunidade (sem núcleo)", encontro, { nucleo: null, comunidade: "cine-praca" });
  await recusa("40: encontro sem dono nenhum o banco recusa", () => dono("insert into interno.rede_encontros (quando, local_tipo) values (now(), 'praca')"), "rede_encontros_um_dono");
  await passa("40: bia anota no diário", () => chamar("bia", "rede_p4_cine_anotar", { p: { comunidade: "cine-praca", filme: "Eles não usam black-tie", ano: 1981, nota: "A roda falou da greve de 1979.", sessao: sessao?.id } }));
  await recusa("40: quem não é da comunidade não anota", () => chamar("fia", "rede_p4_cine_anotar", { p: { comunidade: "cine-praca", filme: "Filme" } }), "sem_permissao");
  const cine = await passa("40: fia (membro da Rede, comunidade aberta) lê o cineclube", () => chamar("fia", "rede_p4_cine", { p_comunidade: "cine-praca" }));
  igual("40: a sessão que vem, com o filme", (cine?.sessoes ?? []).map((s) => [s.filme, s.ano, s.local_tipo]), [["Eles não usam black-tie", 1981, "biblioteca"]]);
  igual("40: o diário, sem dizer quem escreveu", (cine?.diario ?? []).map((d) => Object.keys(d).sort()), [["ano", "em", "filme", "id", "minha", "nota"]]);
  ok("40: fia não modera nem escreve", cine?.modero === false && cine?.posso === false);
  ok("40: sem número de quem viu e sem ranking", !/"(vistos|presentes|ranking|total|vou)"/.test(JSON.stringify(cine)));
  semPessoas("40: o cineclube", cine);
  await recusa("40: a roda fechada não abre para quem é de fora", () => chamar("bia", "rede_p4_cine", { p_comunidade: "roda-fechada" }), "nao_encontrado");
  const nota = cine?.diario?.[0]?.id;
  if (nota) await recusa("40: outra pessoa não tira a anotação", () => chamar("caio", "rede_p4_cine_nota_tirar", { p_id: nota }), "nao_encontrado");
  if (nota) await passa("40: a moderação tira a anotação", () => chamar("ana", "rede_p4_cine_nota_tirar", { p_id: nota }));
  if (sessao?.id) await recusa("40: quem não modera não desmarca", () => chamar("bia", "rede_p4_cine_desmarcar", { p_id: sessao.id }), "nao_encontrado");
  if (sessao?.id) await passa("40: a moderação desmarca", () => chamar("ana", "rede_p4_cine_desmarcar", { p_id: sessao.id }));
}

// ═══ 8. Item 41: clube de leitura ═══
{
  const livro = await passa("41: bia põe um livro na estante", () => chamar("bia", "rede_p4_livro_por", { p: { comunidade: "cine-praca", titulo: "Quarto de despejo", autoria: "Carolina Maria de Jesus" } }));
  igual("41: o livro entra como próximo", livro?.situacao, "proximo");
  await recusa("41: quem não modera não muda a situação", () => chamar("bia", "rede_p4_livro_situacao", { p_id: livro?.id, p_situacao: "lendo" }), "nao_encontrado");
  await passa("41: a moderação põe em leitura", () => chamar("ana", "rede_p4_livro_situacao", { p_id: livro?.id, p_situacao: "lendo" }));
  await passa("41: bia marca 40%", () => chamar("bia", "rede_p4_leitura_marcar", { p_livro: livro?.id, p_pct: 40 }));
  const comDuas = await passa("41: caio marca 100%", () => chamar("caio", "rede_p4_leitura_marcar", { p_livro: livro?.id, p_pct: 100 }));
  igual("41: com 2 leitoras, o grupo não mostra número nenhum", comDuas?.grupo, { leitoras: null, media: null, terminaram: null });
  igual("41: caio vê o próprio progresso", comDuas?.eu, 100);
  const comTres = await passa("41: duda marca 60%", () => chamar("duda", "rede_p4_leitura_marcar", { p_livro: livro?.id, p_pct: 63 }));
  igual("41: com 3, o grupo somado: 3 leitoras, média arredondada de 10 em 10, e quem terminou só a partir de 3", comTres?.grupo, { leitoras: 3, media: 70, terminaram: null });
  const deFora = await passa("41: eva vê a estante", () => chamar("eva", "rede_p4_estante", { p_comunidade: "cine-praca" }));
  const visto = deFora?.livros?.[0];
  igual("41: eva vê o grupo, não o progresso de ninguém", [visto?.eu ?? null, visto?.grupo?.leitoras], [null, 3]);
  semPessoas("41: a estante", deFora);
  await passa("41: bia põe uma citação", () => chamar("bia", "rede_p4_citacao_por", { p_livro: livro?.id, p_texto: "A fome é a escravatura atual.", p_pagina: "27" }));
  const comCitacao = await passa("41: eva lê a citação", () => chamar("eva", "rede_p4_estante", { p_comunidade: "cine-praca" }));
  const citacao = comCitacao?.livros?.[0]?.citacoes?.[0];
  igual("41: a citação sai sem quem pôs", citacao && Object.keys(citacao).sort(), ["id", "minha", "pagina", "texto"]);
  await recusa("41: quem não é da comunidade não marca progresso", () => chamar("fia", "rede_p4_leitura_marcar", { p_livro: livro?.id, p_pct: 10 }), "sem_permissao");
  await recusa("41: progresso acima de 100 recusa", () => chamar("bia", "rede_p4_leitura_marcar", { p_livro: livro?.id, p_pct: 101 }), "invalido:pct");
  const apagou = await passa("41: duda apaga o próprio progresso", () => chamar("duda", "rede_p4_leitura_marcar", { p_livro: livro?.id, p_pct: null }));
  igual("41: e o grupo volta a não mostrar número", apagou?.grupo?.leitoras ?? null, null);
  const linhas = (await dono("select count(*)::int n from interno.rede_p4_leitura where usuario = $1", [P.duda])).rows[0].n;
  igual("41: o progresso apagado some do banco (nada fica guardado)", linhas, 0);
  if (citacao?.id) await recusa("41: outra pessoa não tira a citação", () => chamar("eva", "rede_p4_citacao_tirar", { p_id: citacao.id }), "nao_encontrado");
  if (citacao?.id) await passa("41: quem pôs tira a citação", () => chamar("bia", "rede_p4_citacao_tirar", { p_id: citacao.id }));
  await passa("41: a moderação tira o livro", () => chamar("ana", "rede_p4_livro_tirar", { p_id: livro?.id }));
  const sobra = (await dono("select count(*)::int n from interno.rede_p4_leitura")).rows[0].n;
  igual("41: o progresso sai junto com o livro", sobra, 0);
}

// ═══ 9. Item 42: playlist coletiva ═══
{
  const img = "/api/rede/previa/imagem?u=https%3A%2F%2Fi.exemplo.org%2Fa.jpg&s=abc";
  const item = await passa("42: bia põe um link com a prévia do servidor", () => chamar("bia", "rede_p4_playlist_por", { p: { comunidade: "cine-praca", url: "https://musica.exemplo.org/faixa/123", titulo: "Canto de luta", imagem: img, dominio: "outro.dominio" } }));
  igual("42: o domínio é tirado do próprio link (o do aparelho não conta)", item?.dominio, "musica.exemplo.org");
  await recusa("42: javascript: recusa", () => chamar("bia", "rede_p4_playlist_por", { p: { comunidade: "cine-praca", url: "javascript:alert(1)//x.org", titulo: "x" } }), "invalido:url");
  await recusa("42: link com usuário e senha recusa", () => chamar("bia", "rede_p4_playlist_por", { p: { comunidade: "cine-praca", url: "https://eu:senha@musica.exemplo.org/a", titulo: "x" } }), "invalido:url");
  await recusa("42: o mesmo link não entra duas vezes", () => chamar("caio", "rede_p4_playlist_por", { p: { comunidade: "cine-praca", url: "https://musica.exemplo.org/faixa/123", titulo: "x" } }), "ja_ligado");
  await passa("42: imagem de fora é ignorada", () => chamar("caio", "rede_p4_playlist_por", { p: { comunidade: "cine-praca", url: "https://video.exemplo.net/v/9", titulo: "", imagem: "https://rastreador.exemplo.com/pixel.gif" } }));
  await recusa("42: quem não é da comunidade não põe", () => chamar("fia", "rede_p4_playlist_por", { p: { comunidade: "cine-praca", url: "https://musica.exemplo.org/faixa/9", titulo: "x" } }), "sem_permissao");
  const lista = await passa("42: fia lê a playlist", () => chamar("fia", "rede_p4_playlist", { p_comunidade: "cine-praca" }));
  igual("42: os links, do mais novo ao mais antigo", (lista?.itens ?? []).map((x) => [x.titulo, x.dominio, x.imagem]), [["video.exemplo.net", "video.exemplo.net", null], ["Canto de luta", "musica.exemplo.org", img]]);
  igual("42: cada link sem quem pôs", (lista?.itens ?? [])[0] && Object.keys(lista.itens[0]).sort(), ["dominio", "id", "imagem", "minha", "nota", "titulo", "url"]);
  semPessoas("42: a playlist", lista);
  const id = lista?.itens?.[1]?.id;
  if (id) await recusa("42: outra pessoa não tira", () => chamar("caio", "rede_p4_playlist_tirar", { p_id: id }), "nao_encontrado");
  if (id) await passa("42: quem pôs tira", () => chamar("bia", "rede_p4_playlist_tirar", { p_id: id }));
}

// ═══ 10. A parte pura (lib/rede/cultura/regras.ts) ═══
igual("regras: link bom", linkDaPlaylist("  https://Musica.Exemplo.org/a?b=1 "), { url: "https://Musica.Exemplo.org/a?b=1", dominio: "musica.exemplo.org" });
igual("regras: links ruins", ["javascript:alert(1)", "ftp://x.org/a", "https://eu:x@a.org/b", "https://localhost/a", "http://a b.org"].map(linkDaPlaylist), [null, null, null, null, null]);
igual("regras: só a imagem do nosso proxy", [imagemDaPrevia("/api/rede/previa/imagem?u=x&s=y"), imagemDaPrevia("https://fora.org/a.png"), imagemDaPrevia(null)], ["/api/rede/previa/imagem?u=x&s=y", null, null]);
igual("regras: local público", [localPublico("Biblioteca do bairro"), localPublico("Rua das Flores, 123"), localPublico("CEP 01310-100")], [true, false, false]);
igual("regras: ano", [anoOk(""), anoOk("1981"), anoOk("1700"), anoOk("81")], [true, true, false, false]);
{
  const id = "0f8b3c2a-1d4e-4f5a-9b6c-7d8e9f0a1b2c";
  igual("regras: o post pelo endereço colado", [postDoEndereco(`https://exemplo.org/pt/alumia/p/${id}`), postDoEndereco(`/pt/p/${id.toUpperCase()}?x=1`), postDoEndereco(id),
    postDoEndereco("https://exemplo.org/pt/alumia/u/fulana"), postDoEndereco(`${id}x`), postDoEndereco("")], [id, id, id, null, null, null]);
  igual("regras: o grupo somado do dublê é o do banco", [somarGrupo([40, 100]), somarGrupo([40, 100, 63]), somarGrupo([100, 100, 100])],
    [{ leitoras: null, media: null, terminaram: null }, { leitoras: 3, media: 70, terminaram: null }, { leitoras: 3, media: 100, terminaram: 3 }]);
}

// ═══ 11. A tela: flag, rota, painel, registro, textos ═══
ok("a flag existe em RECURSOS", FLAG in RECURSOS);
ok("a flag é só pelo nome", SO_PELO_NOME.includes(FLAG));
igual("\"todos\" não liga a cultura (desligada por padrão)", ligado(FLAG, lerRecursos("todos")), false);
igual("o nome liga", ligado(FLAG, lerRecursos(`todos,${FLAG}`)), true);
{
  const rota = ROTAS_NOVAS.find((r) => r.nome === "cultura");
  igual("a rota /cultura está em ROTAS_NOVAS com a flag e sem indexar", rota && [rota.caminho, rota.flag, rota.indexar], ["/cultura", FLAG, false]);
  const pagina = existe("app/[lang]/alumia/cultura/page.tsx") ? ler("app/[lang]/alumia/cultura/page.tsx") : "";
  ok("a página passa pela PaginaNova (404 com a flag desligada)", pagina.includes('metadadosDaRotaNova("cultura"') && pagina.includes('<PaginaNova nome="cultura"'));
  ok("a tela está no registro com import dinâmico", /cultura: \{ componente: dynamic\(\(\) => import\("\.\/cultura\/TelaDaCultura"\), \{ ssr: false \}\)/.test(ler("components/rede/registro.tsx")));
  ok("o host próprio conhece a rota", /"cultura"/.test(ler("lib/rede/alumia.ts")));
  ok("o painel único descreve o interruptor", /"alumia-p4-cultura": \{ nome: "[^"]+", sobre: "[^"]+" \}/.test(ler("components/painel/alumia/nomes-das-funcoes.ts")));
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  const lerJson = (c) => (existe(c) ? JSON.parse(ler(c)) : {});
  const textos = Object.fromEntries(idiomas.map((l) => [l, lerJson(`i18n/rede/cultura/${l}.json`)]));
  for (const l of idiomas) {
    igual(`textos ${l}: as mesmas chaves do português`, chaves(textos[l]).filter((k) => !chaves(textos.pt).includes(k)).concat(chaves(textos.pt).filter((k) => !chaves(textos[l]).includes(k))), []);
    ok(`textos ${l}: ${l === "pt" ? "sem" : "com"} a marca de rascunho`, l === "pt" ? !("_rascunho" in textos[l]) : textos[l]._rascunho === true);
  }
  for (const l of idiomas) {
    const onda5 = lerJson(`i18n/rede/onda5/${l}.json`);
    ok(`onda5 ${l}: título e descrição da tela`, !!onda5.telas?.cultura?.titulo && !!onda5.telas?.cultura?.descricao);
  }
  // Nada vai a terceiros pelo navegador: a tela só fala com o banco e com a prévia do nosso servidor; nenhum player embutido.
  const pasta = "components/rede/cultura";
  const fontes = (existe(pasta) ? fs.readdirSync(path.join(raiz, pasta)) : []).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => [f, ler(`${pasta}/${f}`)]);
  ok("a pasta da tela existe", fontes.length >= 3);
  const fetches = fontes.flatMap(([f, t]) => [...t.matchAll(/fetch\(\s*([`"'][^`"']*)/g)].map((m) => `${f}:${m[1]}`));
  igual("o único fetch do aparelho é a prévia do nosso servidor", fetches.filter((x) => !x.includes("/api/rede/previa?url=")), []);
  {
    const playlist = fontes.find(([f]) => f === "Playlist.tsx")?.[1] ?? "";
    const api = ler("components/rede/publicar/api.ts");
    const corpo = api.slice(api.indexOf("export async function gerarPrevia"), api.indexOf("export async function gerarPrevia") + 400);
    ok("a playlist pede a prévia só pela rota do nosso servidor (gerarPrevia, a mesma do compositor)", /import \{ gerarPrevia \} from "@\/components\/rede\/publicar\/api"/.test(playlist)
      && /fetch\(`\/api\/rede\/previa\?url=\$\{encodeURIComponent\(url\)\}`/.test(corpo));
    ok("a imagem da faixa só entra se for do nosso proxy", (playlist.match(/imagemDaPrevia\(/g) ?? []).length >= 3);
  }
  ok("nenhum iframe, embed ou player de fora", fontes.every(([, t]) => !/<iframe|<embed|<object|<audio\s+src=|<video\s+src=/i.test(t)));
  ok("nenhum serviço de música é chamado pelo nome", fontes.every(([, t]) => !/(open\.spotify|api\.spotify|youtube\.com\/oembed|soundcloud\.com\/oembed|deezer\.com\/api)/i.test(t)));
  ok("os links de fora abrem sem levar a página de origem", fontes.some(([, t]) => t.includes('rel="noopener noreferrer nofollow"')));
  ok("a tela não guarda nada no aparelho", fontes.every(([, t]) => !/localStorage|sessionStorage|indexedDB/.test(t)));
  ok("o pacote de textos não promete cifra (a cultura não é cifrada)", !/cifrad[oa] de ponta/i.test(JSON.stringify(textos.pt)) || /não é cifrad/i.test(JSON.stringify(textos.pt)));
}
ok("o e2e da cultura existe", existe("e2e/p4-cultura.spec.ts"));
ok("o script está no package.json", /"testar:p4-cultura": "node [^"]*scripts\/testar-p4-cultura\.mjs"/.test(ler("package.json")));

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
