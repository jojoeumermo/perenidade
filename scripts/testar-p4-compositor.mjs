// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o compositor do prompt 4 (supabase/migracoes/20261127-p4-compositor.sql, interruptor "alumia-p4-compositor") num Postgres de
// verdade (scripts/banco-local.mjs), com a migração rodada DUAS vezes sobre o install.sql do ramo:
//   27  álbum de até 20 imagens (10 com o interruptor desligado), a regra de ordem e os níveis, a imagem 1 a 20 no meio do texto longo;
//   26  capa (uma das imagens do texto longo) e capítulos ("## " abre um), com o índice e as páginas feitos na tela;
//   28  o filtro "esconder imagens sem descrição" (só no aparelho) e o lembrete antes de publicar;
//   29  "Mande a sua": o total de pessoas diferentes que responderam, nulo abaixo de 3, nunca uma lista;
//   117 versão curta (só no texto longo, até 280, com a mesma conferência de dado pessoal e a mesma triagem);
//   118 a fonte escolhida ao escrever, na mesma tabela do "Fonte?" (interno.rede_fontes), e o selo "com fonte".
// E a regra de privacidade de cada um: nada disso entra em post cifrado; nenhuma função devolve pessoa; o total some abaixo de 3;
// quem não vê o post não vê o que ele guardou; o filtro não chega ao servidor.
// Com ALUMIA_P4C_SEM_MIGRACAO=1, roda sem a migração (o "antes"): as conferências do banco têm de falhar.
// Uso: npm run testar:p4-compositor
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import * as P4 from "../lib/rede/publicar/p4-compositor.ts";
import * as C from "../lib/rede/publicar/compositor.ts";
import { capitulosDoTexto, fonteDoCapitulo, indiceDoTexto, lerTextoFormatado } from "../lib/rede/texto/formatado.ts";
import { limparFonte } from "../lib/rede/texto/limpar.ts";
import { aplicarMarca } from "../lib/rede/texto/inserir.ts";
import { RECURSOS, SO_PELO_NOME } from "../lib/recursos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const SEM = process.env.ALUMIA_P4C_SEM_MIGRACAO === "1";
const FLAG = "alumia-p4-compositor";

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. O arquivo ═══════════════════
const sql = ler("supabase/migracoes/20261127-p4-compositor.sql");
const semComentario = sql.replace(/^\s*--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("cabeçalho: roda depois das 20261127-p4-* da primeira junção e antes do p4-fim", /Roda depois das migrações 20261127-p4-\*/.test(sql) && /antes do\s*\n?--\s*20261127-p4-fim\.sql/.test(sql));
ok("cabeçalho: diz a função, a lei e cita cada função existente redefinida", /Lei: LGPD/.test(sql) && ["public.rede_publicar(jsonb)", "interno.rede_o12_separar(jsonb, uuid)", "public.rede_pub_corrigir(uuid, jsonb)", "interno.rede_texto_limpo(text)", "public.rede_mod_niveis()", "public.rede_mod_meu_nivel()"].every((f) => sql.slice(0, 4000).includes(f)));
ok("as funções existentes vêm inteiras (sem replace na definição viva)", !/replace\(v_def/.test(sql) && (sql.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length === 6);
ok("a porta passa em toda função nova (alumia_trancar no fim)", /select interno\.alumia_trancar\(\);\s*$/.test(sql));
ok("não mexe na versão da Alumia, em rede_ve nem na lista da porta", !/rede_alumia_versao|function interno\.rede_ve\(|alumia_porta_aberta/.test(semComentario));
ok("nenhum endereço de rede", !/\bip\b|x-forwarded|cf-connecting|\binet\b/i.test(semComentario));
ok("duas tabelas novas, em interno, com RLS e sem política nem permissão", (sql.match(/create table if not exists interno\./g) ?? []).length === 2 && (sql.match(/enable row level security/g) ?? []).length === 2 && !/create policy/i.test(sql) && !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
ok("o interruptor entra no catálogo só pelo nome, protegido por to_regclass", /to_regclass\('interno\.recursos_catalogo'\)[\s\S]{0,200}'alumia-p4-compositor', true/.test(sql));

// ═══════════════════ 1. As peças puras ═══════════════════
ok("a flag existe, só pelo nome", FLAG in RECURSOS && SO_PELO_NOME.includes(FLAG));
ok("27: o teto é 20 com o álbum e 10 sem ele", P4.limiteDeImagens(true) === 20 && P4.limiteDeImagens(false) === 10 && P4.LIMITE_DO_ALBUM === 20 && C.LIMITE_DO_ALBUM === 20);
ok("27: a colagem desenha até 20 ladrilhos, fechando as 6 colunas", [11, 15, 20].every((n) => {
  const l = C.ladrilhosDaColagem(n);
  return l.length === n && l.reduce((s, x) => s + x.colunas * x.linhas, 0) % 6 === 0;
}) && C.ladrilhosDaColagem(25).length === 20);
ok("27: imagem 1 a 20 no meio do texto longo; a 21 vira a descrição", limparFonte("![a](imagem:1) ![b](imagem:12) ![c](imagem:20) ![d](imagem:21) ![e](imagem:0)") === "![a](imagem:1) ![b](imagem:12) ![c](imagem:20) d e");
ok("27: o leitor desenha a imagem 15 no meio", (() => {
  const b = lerTextoFormatado("texto\n\n![foto do ato](imagem:15)");
  return b.some((x) => x.t === "imagem" && x.n === 15);
})());
ok("27: o botão \"Pôr a imagem 12 aqui\" escreve a 12 (e não a 2)", aplicarMarca("", 0, 0, "imagem12", "foto").valor.includes("(imagem:12)"));
ok("28: imagem sem descrição é achada; com descrição, não", P4.temImagemSemDescricao({ midia: [{ alt: "ok" }, { alt: "  " }] }) && !P4.temImagemSemDescricao({ midia: [{ alt: "a" }] }) && !P4.temImagemSemDescricao({ midia: null }));
ok("28: o filtro tira só os posts com imagem sem descrição, na mesma ordem", (() => {
  const l = [{ id: 1, midia: [{ alt: "" }] }, { id: 2, midia: [] }, { id: 3, midia: [{ alt: "x" }] }];
  return JSON.stringify(P4.semImagensSemDescricao(l, true).map((p) => p.id)) === "[2,3]" && P4.semImagensSemDescricao(l, false).length === 3;
})());
ok("28: o filtro fica só no aparelho (lucia:rede, apagado pelo Sair rápido); armazenamento quebrado = desligado", (() => {
  const m = new Map();
  const a = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  P4.gravarEsconderSemDescricao(a, true);
  const ligado = P4.lerEsconderSemDescricao(a);
  P4.gravarEsconderSemDescricao(a, false);
  const quebrado = { getItem: () => { throw new Error("x"); } };
  return P4.CHAVE_SEM_DESCRICAO.startsWith("lucia:rede") && ligado && !P4.lerEsconderSemDescricao(a) && !P4.lerEsconderSemDescricao(quebrado) && !P4.lerEsconderSemDescricao(null);
})());
ok("29: o total só a partir de 3 (abaixo, nada)", P4.totalDoConvite(2) === null && P4.totalDoConvite(0) === null && P4.totalDoConvite(3) === 3 && P4.totalDoConvite(null) === null && P4.totalDoConvite(Number.NaN) === null);
ok("117: a versão curta tem até 280", P4.LIMITE_DO_RESUMO === 280);
ok("118: a fonte colada vira link ou caso do Vale; rastreio não vale", JSON.stringify(P4.fonteDoCampo("https://exemplo.org/materia")) === '{"link":"https://exemplo.org/materia"}'
  && JSON.stringify(P4.fonteDoCampo("https://institutolucia.org/pt/vale-o-escrito/caso/greve-1980")) === '{"vale":"greve-1980"}'
  && P4.fonteDoCampo("https://exemplo.org/x?utm_source=zap") === null && P4.fonteDoCampo("") === null && P4.fonteDoCampo("javascript:alert(1)") === null);
{
  const longo = { longo: true, resposta: false, tipo: "discussao", imagens: 2 };
  const curto = { longo: false, resposta: false, tipo: "post", imagens: 0 };
  const resp = { longo: false, resposta: true, tipo: "post", imagens: 0 };
  const e = (x) => ({ ...P4.ESCOLHAS_VAZIAS, ...x });
  ok("as escolhas: versão curta e capa só no texto longo", P4.problemaDasEscolhas(e({ resumo: "x" }), curto) === "invalido_resumo" && P4.problemaDasEscolhas(e({ capa: 0 }), curto) === "invalido_capa" && P4.problemaDasEscolhas(e({ resumo: "x", capa: 1 }), longo) === null && P4.problemaDasEscolhas(e({ capa: 2 }), longo) === "invalido_capa");
  ok("as escolhas: convite só em post de abertura; fonte nunca em resposta", P4.problemaDasEscolhas(e({ convite: true }), curto) === null && P4.problemaDasEscolhas(e({ convite: true }), longo) === "invalido_convite" && P4.problemaDasEscolhas(e({ convite: true }), resp) === "invalido_convite" && P4.problemaDasEscolhas(e({ fonte: "https://exemplo.org/a" }), resp) === "invalido_fonte");
  ok("o pedido leva só o que vale (resposta não leva nada)", JSON.stringify(P4.camposDoP4(e({ resumo: " curta ", capa: 1, fonte: "https://exemplo.org/a" }), longo)) === '{"resumo":"curta","capa":1,"fonte":{"link":"https://exemplo.org/a"}}'
    && Object.keys(P4.camposDoP4(e({ resumo: "x", convite: true, fonte: "https://exemplo.org/a" }), resp)).length === 0 && !P4.usaP4({}) && P4.usaP4({ convite: true }));
}
ok("26: capítulos: cada \"## \" abre um; o \"### \" fica dentro; a abertura entra só com texto", (() => {
  const t = "Abertura do boletim.\n\n## Primeiro\n\nTexto um.\n\n### Detalhe\n\nmais\n\n## Segundo\n\nTexto dois.";
  const c = capitulosDoTexto(t);
  return c.length === 3 && c[0].titulo === null && c[1].titulo === "Primeiro" && c[2].titulo === "Segundo" && JSON.stringify(indiceDoTexto(t)) === '["Primeiro","Segundo"]'
    && fonteDoCapitulo(t, 1).includes("### Detalhe") && !fonteDoCapitulo(t, 1).includes("Segundo") && fonteDoCapitulo(t, 2) === "Texto dois." && fonteDoCapitulo(t, 9) === "";
})());
ok("26: título dentro de bloco de código não abre capítulo", capitulosDoTexto("## Um\n\n```\n## não é título\n```\n\n## Dois\n\nx").length === 2 && fonteDoCapitulo("## Um\n\n```\n## não\n```\n\n## Dois\n\nx", 0).includes("## não"));
ok("26: sem título nenhum, um capítulo só", capitulosDoTexto("só texto corrido").length === 1 && indiceDoTexto("só texto corrido").length === 0);

// ═══════════════════ 2. Banco e pessoas ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

if (!SEM) {
  await espera("a migração instala sobre o install.sql do ramo", () => exec(sql));
  await espera("de novo (idempotente)", () => exec(sql));
}

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const P = {};
const nomes = ["ana", "bia", "caio", "duda", "eva", "fabi"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@p4c.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
const zerar = () => dono("delete from interno.limites");
for (const nome of ["ana", "bia", "duda"]) await dono("insert into interno.rede_lideres (usuario) values ($1) on conflict do nothing", [P[nome]]);
const ligar = (sim) => dono("insert into interno.recursos_vivos (nome, ligado) values ($1, $2) on conflict (nome) do update set ligado = $2", [FLAG, sim]).catch((e) => falhas.push(`ligar o interruptor: ${e.message}`));
const caminho = (quem) => `${P[quem]}/${randomUUID()}.jpg`;
const imagens = (quem, n, legenda = (i) => `Legenda ${i + 1}`, alt = (i) => `Foto ${i + 1} do ato`) =>
  Array.from({ length: n }, (_, i) => ({ caminho: caminho(quem), alt: alt(i), largura: 800, altura: 600, ...(legenda ? { legenda: legenda(i) } : {}) }));
const p4 = (quem, p) => rpc(como(P[quem]), "rede_pub_p4_publicar", { p });
const o12 = (quem, p) => rpc(como(P[quem]), "rede_pub_o12_publicar", { p });
const extras = (quem, ids) => rpc(quem ? como(P[quem]) : visitante(), "rede_pub_p4_extras", { p_ids: ids });
const longo = (x = {}) => ({ tipo: "discussao", titulo: "Boletim da ocupação", corpo: "Abertura do boletim de novembro.\n\n## A assembleia\n\nDecidimos ficar.\n\n## Os próximos passos\n\nMutirão no sábado.", ...x });

// ── O interruptor ──
await espera("o interruptor está no catálogo, só pelo nome, e nasce desligado", async () => um("select k.so_pelo_nome, v.ligado from interno.recursos_catalogo k left join interno.recursos_vivos v on v.nome = k.nome where k.nome = $1", [FLAG]),
  (r) => r?.so_pelo_nome === true && r.ligado !== true);

// ═══════════════════ 3. Item 27: o álbum ═══════════════════
await recusa("27 desligado: 11 imagens continuam recusadas (o teto é 10)", () => o12("ana", { texto: "Onze fotos", midia: imagens("ana", 11) }), "invalido:midia");
await espera("27 desligado: as regras públicas dos níveis mostram 10 para regular e líder", () => rpc(visitante(), "rede_mod_niveis", {}), (l) => JSON.stringify(l.map((n) => n.imagens)) === "[1,2,6,10,10]");
await recusa("27 desligado: as escolhas do prompt 4 não passam", () => p4("ana", { texto: "Convite", convite: true }), "desligado");
await espera("27 desligado: sem escolha nenhuma, a função nova só repassa para a da onda 12", () => p4("ana", { texto: "Um post comum, sem nada do prompt 4" }), (r) => r?.id && JSON.stringify(r.p4) === "{}");
await ligar(true);
await zerar();
const vinte = await espera("27 ligado: 20 imagens com legenda em carrossel", () => o12("ana", { texto: "Vinte fotos do ato", midia: imagens("ana", 20), arranjo: "carrossel" }),
  (r) => r?.id && Object.keys(r.o12?.legendas ?? {}).length === 20);
await espera("27: no banco, 20 imagens na ordem de 0 a 19 e 20 legendas", async () => um(`select count(*)::int as n, min(ordem) as a, max(ordem) as b,
  (select count(*)::int from interno.rede_o12_midia l join interno.rede_midia m on m.id = l.midia where m.post = $1) as l from interno.rede_midia where post = $1`, [vinte?.id]),
(r) => r.n === 20 && r.a === 0 && r.b === 19 && r.l === 20);
await recusa("27 ligado: 21 imagens, recusa", () => o12("ana", { texto: "x", midia: imagens("ana", 21) }), "invalido:midia");
await recusa("27 ligado: 21 imagens pela função de sempre, recusa", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "x", midia: imagens("ana", 21, null) } }), "invalido:midia");
await zerar();
await espera("27 ligado: 15 imagens pela função de sempre (sem legenda)", () => rpc(como(P.ana), "rede_publicar", { p: { texto: "Quinze fotos", midia: imagens("ana", 15, null) } }), (r) => r?.midia?.length === 15);
await recusa("27: o nível de confiança continua valendo (caio, nível baixo, não põe 12)", () => o12("caio", { texto: "Muitas", midia: imagens("caio", 12, null) }), "nivel_imagens");
await espera("27 ligado: as regras públicas mostram 20 para regular e líder", () => rpc(visitante(), "rede_mod_niveis", {}), (l) => JSON.stringify(l.map((n) => n.imagens)) === "[1,2,6,20,20]");
await espera("27: \"o meu nível\" diz o teto que vale", () => rpc(como(P.ana), "rede_mod_meu_nivel", {}), (r) => r?.lider === true && r.atual?.imagens === 20);
await espera("27: a correção aceita 20 descrições", async () => {
  const m = (await dono("select id::text from interno.rede_midia where post = $1 order by ordem", [vinte.id])).rows.map((x) => x.id);
  await rpc(como(P.ana), "rede_pub_corrigir", { p_post: vinte.id, p: { alts: m.map((id) => ({ id, alt: "descrição nova" })) } });
  return (await um("select count(*)::int as n from interno.rede_midia where post = $1 and alt = 'descrição nova'", [vinte.id])).n;
}, (n) => n === 20);
await espera("27: a regra de ordem vai até 19 e a dos níveis até 20", async () => (await dono(`select pg_get_constraintdef(oid) as d from pg_constraint
  where (conrelid = 'interno.rede_midia'::regclass and conname = 'rede_midia_ordem_check') or (conrelid = 'interno.rede_niveis'::regclass and conname = 'rede_niveis_imagens_check') order by conname`)).rows.map((r) => r.d),
(d) => d.length === 2 && /ordem <= 19/.test(d[0]) && /imagens <= 20/.test(d[1]));
for (const [i, entrada] of ["![a](imagem:1) ![b](imagem:12) ![c](imagem:20) ![d](imagem:21)", "[x](imagem:15) [y](imagem:30)", "texto ![e](imagem:9)"].entries()) {
  await espera(`27: a limpeza do banco e a do aparelho são a mesma (imagem 1 a 20) (${i + 1})`, async () => (await um("select interno.rede_texto_limpo($1) as x", [entrada])).x, (x) => x === limparFonte(entrada));
}
await espera("27: o texto longo guarda a imagem 12 no meio", async () => {
  await zerar();
  const r = await o12("ana", { tipo: "discussao", titulo: "Galeria do mutirão", corpo: "Fotos do dia.\n\n![a doze](imagem:12)\n\nfim", midia: imagens("ana", 12, null) });
  return (await um("select corpo from interno.rede_posts where id = $1", [r.id])).corpo;
}, (c) => c.includes("![a doze](imagem:12)"));

// ═══════════════════ 4. Item 117: a versão curta ═══════════════════
await zerar();
const comResumo = await espera("117: texto longo com versão curta", () => p4("bia", longo({ resumo: "Ficamos. Mutirão no sábado." })), (r) => r?.id && r.p4?.resumo === "Ficamos. Mutirão no sábado.");
await recusa("117: versão curta em post curto, recusa", () => p4("bia", { texto: "curto", resumo: "x" }), "invalido:resumo");
await recusa("117: versão curta de 281 letras, recusa", () => p4("bia", longo({ resumo: "a".repeat(281) })), "invalido:resumo");
await recusa("117: versão curta com telefone, dado pessoal", () => p4("bia", longo({ resumo: "Liga no (11) 98765-4321" })), "dado_pessoal");
await recusa("117: versão curta com xingamento de ódio vai para a leitura", () => p4("bia", longo({ resumo: "olha esse macaco" })), "resumo_revisar");
await recusa("117: versão curta que não é texto, recusa", () => p4("bia", longo({ resumo: 12 })), "invalido:resumo");
await espera("117: nada ficou dos recusados (tudo ou nada)", async () => (await um("select count(*)::int as n from interno.rede_posts where autor = $1", [P.bia])).n, (n) => n === 1);

// ═══════════════════ 5. Item 26: capa e capítulos ═══════════════════
await zerar();
const artigo = await espera("26: texto longo com 3 imagens e a segunda como capa", () => p4("duda", longo({ midia: imagens("duda", 3, null), capa: 1 })), (r) => r?.id && r.p4?.capa === 1);
await recusa("26: capa fora das imagens, recusa", () => p4("duda", longo({ midia: imagens("duda", 2, null), capa: 2 })), "invalido:capa");
await recusa("26: capa sem imagem nenhuma, recusa", () => p4("duda", longo({ capa: 0 })), "invalido:capa");
await recusa("26: capa em post curto, recusa", () => p4("duda", { texto: "foto", midia: imagens("duda", 1, null), capa: 0 }), "invalido:capa");
await recusa("26: capa que não é número, recusa", () => p4("duda", longo({ midia: imagens("duda", 1, null), capa: "0" })), "invalido:capa");
await espera("26: o cartão recebe a capa pelo id da imagem e a conta dos capítulos", async () => {
  const r = await extras("caio", [artigo.id]);
  const capa = (await um("select id::text from interno.rede_midia where post = $1 and ordem = 1", [artigo.id])).id;
  return { e: r[artigo.id], capa };
}, ({ e, capa }) => e?.capa === capa && e.capitulos === 2);
await espera("26: um texto longo com um título só não diz \"capítulos\"", async () => {
  await zerar();
  const r = await p4("duda", longo({ corpo: "Um texto sem divisão nenhuma, mas comprido.\n\n## Só um", resumo: "curto" }));
  return (await extras("caio", [r.id]))[r.id];
}, (e) => e?.resumo === "curto" && e.capitulos === undefined);
await espera("26: o banco conta os capítulos como a tela (\"# \" e \"## \"; \"### \" não)", async () => (await um("select interno.rede_p4c_capitulos($1) as n", ["# Um\n\n### dentro\n\n## Dois\n\ntexto\n## Três"])).n, (n) => n === 3);

// ═══════════════════ 6. Item 118: a fonte ═══════════════════
await zerar();
const comFonte = await espera("118: post com fonte (link)", () => p4("eva", { texto: "A prefeitura cortou 30% da merenda.", fonte: { link: "https://exemplo.org/diario-oficial/123" } }), (r) => r?.id && r.p4?.fonte?.link);
await espera("118: a fonte fica na mesma tabela do \"Fonte?\" (rede_fontes)", async () => um("select link, vale from interno.rede_fontes where post = $1", [comFonte?.id]), (r) => r?.link === "https://exemplo.org/diario-oficial/123" && r.vale === null);
await recusa("118: link com rastreio, recusa", () => p4("eva", { texto: "x", fonte: { link: "https://exemplo.org/a?utm_source=zap" } }), "invalido:fonte");
await recusa("118: link sem http, recusa", () => p4("eva", { texto: "x", fonte: { link: "javascript:alert(1)//aaaa" } }), "invalido:fonte");
await recusa("118: fonte vazia, recusa", () => p4("eva", { texto: "x", fonte: {} }), "invalido:fonte");
await recusa("118: caso do Vale com forma errada, recusa", () => p4("eva", { texto: "x", fonte: { vale: "Caso Com Espaço" } }), "invalido:vale");
await dono("insert into interno.vale_entradas (id, dossie, situacao, confianca, doc, retirado_em) values ('caso-retirado', 'teste', 'arquivado', 'primaria', '{}', now()) on conflict do nothing");
await recusa("118: caso do Vale retirado do ar, recusa (a mesma regra do \"Fonte?\")", () => p4("eva", { texto: "x", fonte: { vale: "caso-retirado" } }), "invalido:vale");
await espera("118: caso do Vale no ar (ou nos arquivos do site) vale", () => p4("eva", { texto: "Segundo a checagem do Instituto.", fonte: { vale: "greve-de-1980" } }), (r) => r?.p4?.fonte?.vale === "greve-de-1980");
await recusa("118: fonte em resposta, recusa (a fonte é do post de abertura)", () => p4("eva", { texto: "x", resposta_a: comFonte.id, fonte: { link: "https://exemplo.org/b" } }), "invalido:fonte");
await espera("118: o cartão recebe a fonte", async () => (await extras("fabi", [comFonte.id]))[comFonte.id], (e) => e?.fonte?.link === "https://exemplo.org/diario-oficial/123");

// ═══════════════════ 7. Item 29: "Mande a sua" ═══════════════════
await zerar();
const convite = await espera("29: post-convite", () => p4("ana", { texto: "Mande a sua: uma frase sobre por que você luta.", convite: true }), (r) => r?.id && r.p4?.convite === true);
await recusa("29: convite em resposta, recusa", () => p4("ana", { texto: "x", resposta_a: convite.id, convite: true }), "invalido:convite");
await recusa("29: convite em texto longo, recusa", () => p4("ana", longo({ convite: true })), "invalido:convite");
await recusa("29: convite que não é sim ou não, recusa", () => p4("ana", { texto: "x", convite: "sim" }), "invalido:convite");
const responder = (quem, texto, extra = {}) => rpc(como(P[quem]), "rede_publicar", { p: { texto, resposta_a: convite.id, ...extra } });
await espera("29: a autora respondendo não conta; duas pessoas: nenhum número", async () => {
  await zerar();
  await responder("ana", "Eu começo: pela moradia.");
  await responder("bia", "Pela escola pública.");
  await responder("bia", "E pelo passe livre.");
  await responder("caio", "Por quem veio antes.");
  return (await extras("duda", [convite.id]))[convite.id];
}, (e) => e?.convite === true && e.total === undefined);
await espera("29: com uma imagem também vale; a terceira pessoa faz aparecer o 3", async () => {
  await zerar();
  await responder("duda", "Minha arte para o convite", { midia: imagens("duda", 1, null) });
  return (await extras("eva", [convite.id]))[convite.id];
}, (e) => e?.total === 3);
await espera("29: resposta escondida pela moderação não conta (volta a não ter número)", async () => {
  await dono("update interno.rede_posts set oculto = true where resposta_a = $1 and autor = $2", [convite.id, P.duda]);
  const r = (await extras("eva", [convite.id]))[convite.id];
  await dono("update interno.rede_posts set oculto = false where resposta_a = $1 and autor = $2", [convite.id, P.duda]);
  return r;
}, (e) => e?.convite === true && e.total === undefined);

// ═══════════════════ 8. A regra de privacidade de cada item ═══════════════════
await espera("privacidade: nada do que volta traz pessoa (id, @ ou codinome)", async () => JSON.stringify(await extras("fabi", [convite.id, comFonte.id, artigo.id, comResumo.id])),
  (s) => s.length > 10 && !nomes.some((n) => s.includes(P[n]) || s.includes(`pessoa_${n}`) || /Pessoa \d/.test(s)));
await espera("privacidade (29): nenhuma função do prompt 4 devolve lista; o total é um número só", async () => (await extras("fabi", [convite.id]))[convite.id],
  (e) => Object.keys(e).sort().join() === "convite,total" && typeof e.total === "number");
await espera("privacidade: post só para membros não mostra nada a visitante", async () => {
  await dono("update interno.rede_posts set publico = 'membros' where id = $1", [comFonte.id]);
  return extras(null, [comFonte.id]);
}, (r) => Object.keys(r).length === 0);
await espera("privacidade: post removido pela moderação não mostra nada a outra pessoa", async () => {
  await dono("update interno.rede_posts set oculto = true where id = $1", [comResumo.id]);
  const outra = await extras("caio", [comResumo.id]);
  const autora = await extras("bia", [comResumo.id]);
  await dono("update interno.rede_posts set oculto = false where id = $1", [comResumo.id]);
  return { outra, autora };
}, ({ outra, autora }) => Object.keys(outra).length === 0 && autora[comResumo.id]?.resumo);
await recusa("privacidade (cifrado): versão curta, capa, convite e fonte não entram num pedido de post cifrado", () => p4("ana", { texto: "", grupo: "comunidade:fechada", corpo_grupo: "p2.1.abc", convite: true }), "invalido:grupo");
await espera("privacidade (cifrado): nem por fora — a tabela recusa ligar escolha a um post cifrado", async () => {
  const x = await um("insert into interno.rede_posts (autor, texto, grupo, corpo_grupo) values ($1, '', 'comunidade:fechada', 'p2.1.abc') returning id::text", [P.ana]);
  try {
    await dono("insert into interno.rede_p4c_post (post, convite) values ($1, true)", [x.id]);
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => /invalido:grupo/.test(m));
await espera("privacidade (cifrado): o cartão de um post cifrado não recebe nada do prompt 4", async () => {
  const x = await um("select id::text from interno.rede_posts where corpo_grupo is not null limit 1");
  return extras("ana", [x.id]);
}, (r) => Object.keys(r).length === 0);
await espera("privacidade (28): o servidor não tem onde guardar o filtro de imagens sem descrição", async () => (await um(`select count(*)::int as n from information_schema.columns
  where table_schema = 'interno' and table_name like 'rede\\_p4c\\_%' and (column_name like '%descri%' or column_name like '%filtro%' or column_name like '%esconder%')`)).n, (n) => n === 0);
await espera("privacidade: desligado, o cartão não recebe nada (nem o que já foi gravado)", async () => {
  await ligar(false);
  const r = await extras("fabi", [convite.id, artigo.id]);
  await ligar(true);
  return r;
}, (r) => Object.keys(r).length === 0);
await espera("privacidade: as tabelas novas têm RLS, nenhuma política e nenhuma permissão", async () => (await dono(`select c.relname, c.relrowsecurity as r,
  (select count(*)::int from pg_policies p where p.schemaname = 'interno' and p.tablename = c.relname) as n,
  (select count(*)::int from information_schema.role_table_grants g where g.table_schema = 'interno' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated', 'PUBLIC')) as g
  from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'interno' and c.relname like 'rede\\_p4c\\_%' and c.relkind = 'r'`)).rows,
(rs) => rs.length === 2 && rs.every((r) => r.r === true && r.n === 0 && r.g === 0));
const daTela = ["rede_pub_p4_publicar", "rede_pub_p4_agendar", "rede_pub_p4_extras"];
await espera("as da tela passam pela porta; só conta logada escreve; o que o post guardou também para visitante (rede_ve decide)", async () => (await dono(`select p.proname, p.prosrc ~ 'interno\\.alumia_porta\\(\\)' as porta,
  has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as aut
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any ($1)`, [daTela])).rows,
(rs) => rs.length === daTela.length && rs.every((r) => r.porta && r.aut && r.anon === (r.proname === "rede_pub_p4_extras")));
await espera("as de dentro ninguém chama pela API", async () => um(`select bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) as alguma, count(*)::int as n
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede\\_p4c\\_%'`), (r) => r.n >= 7 && r.alguma === false);
await espera("a porta continua sem nenhuma função aberta", async () => (await um("select interno.alumia_trancar() as r")).r, (r) => Array.isArray(r.abertas) && r.abertas.length === 0);
await recusa("visitante não publica", () => rpc(visitante(), "rede_pub_p4_publicar", { p: { texto: "x" } }), "permission denied");

// ═══════════════════ 9. Agendado ═══════════════════
await espera("agendado: a versão curta e a fonte valem quando o post sai", async () => {
  await zerar();
  const quando = (await um("select to_char((now() + interval '2 hours') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD\"T\"HH24:MI') as l")).l;
  const a = await rpc(como(P.fabi), "rede_pub_p4_agendar", { p: longo({ resumo: "Versão curta agendada", fonte: { link: "https://exemplo.org/fonte-agendada" } }), p_local: quando, p_fuso: "America/Sao_Paulo", p_opcoes: {} });
  await dono("update interno.rede_agendados set quando = now() - interval '1 minute' where id = $1", [a.id]);
  await dono("select interno.rede3_pub_rodar($1)", [P.fabi]);
  const g = await um("select estado, post::text from interno.rede_agendados where id = $1", [a.id]);
  const e = g.post ? await um("select e.resumo, f.link from interno.rede_p4c_post e left join interno.rede_fontes f on f.post = e.post where e.post = $1", [g.post]) : null;
  return { estado: g.estado, e };
}, (r) => r.estado === "publicado" && r.e?.resumo === "Versão curta agendada" && r.e.link === "https://exemplo.org/fonte-agendada");

// ═══════════════════ 10. As telas (fonte) ═══════════════════
const escrever = ler("components/rede/publicar/alumia2/EscreverDaAlumia2.tsx");
const extrasTs = ler("components/rede/publicar/ExtrasDoEscrever.tsx");
ok("27: o Escrever oferece o teto do interruptor (20 ou 10), e não o 10 fixo", extrasTs.includes('limiteDeImagens(ligado("alumia-p4-compositor"))') && !/slice\(0, LIMITE_DE_IMAGENS\)/.test(extrasTs));
ok("27: as imagens do post no meio do texto vão até 20 (o cartão busca as 20)", (() => { const u = ler("components/rede/texto/usarImagensDoPost.ts"); return u.includes("midia.slice(0, 20)") && u.includes("imagem:(?:[1-9]|1[0-9]|20)") && !u.includes("[1-4]"); })());
ok("27: o texto do máximo diz o número de verdade", JSON.parse(ler("i18n/rede/publicar/pt.json")).imagens.maximo.includes("{n}"));
if (fs.existsSync(path.join(raiz, "components/rede/publicar/p4/CamposDoP4.tsx"))) {
  ok("o Escrever leva as escolhas do prompt 4 pela função dele", escrever.includes("redeP4.publicar(") && escrever.includes("redeP4.agendar("));
  ok("o Escrever não manda escolhas do prompt 4 no post cifrado nem no fio", /grupoCifrado && usaP4\(camposP4\)/.test(escrever) && /fioLigado && usaP4\(camposP4\)/.test(escrever));
}

{
  const anexo = ler("components/rede/publicar/p4/AnexoDoP4.tsx");
  const linha = ler("components/rede/Linha.tsx");
  const encaixe = ler("components/rede/publicar/p4/encaixe.tsx");
  ok("29 (privacidade): o cartão só mostra o total pelo totalDoConvite (nunca abaixo de 3) e nunca uma lista", anexo.includes("totalDoConvite(e.total)") && !anexo.split("e.convite &&")[1]?.split("</div>")[0]?.includes(".map(") && Boolean(anexo.split("e.convite &&")[1]?.split("</div>")[0] ?? ""));
  ok("o cartão de post cifrado nem pede o que o prompt 4 guardou", anexo.includes("useExtrasDoPost(post.id, !post.corpo_grupo)"));
  ok("o cartão não mudou (D10): o prompt 4 entra pelo encaixe anexosDoCartao", encaixe.includes("anexosDoCartao: [AnexoDoP4") && !ler("components/rede/CartaoDePost.tsx").includes("p4") && !ler("components/rede/publicar/alumia2/CartaoDaAlumia2.tsx").includes("AnexoDoP4"));
  ok("desligado, o encaixe fica vazio", /!ligado\("alumia-p4-compositor"\)\s*\?\s*\{\}/.test(encaixe));
  ok("28: o lembrete de descrever a imagem continua antes de publicar (uma vez; o segundo toque publica)", escrever.includes("!lembrouAlt && pub.imagens.some((i) => !i.alt.trim())") && escrever.includes("al2?.t.escrever.semAlt"));
  ok("28: a linha esconde os posts com imagem sem descrição só com o filtro do aparelho e o interruptor", linha.includes("semImagensSemDescricao(semSilencio, true)") && linha.includes("ligado(\"alumia-p4-compositor\") && lerEsconderSemDescricao(window.localStorage)"));
  ok("28 (privacidade): o filtro não chama o banco", !/rpc|chamar|redeP4/.test(ler("components/rede/publicar/p4/FiltroSemDescricao.tsx")));
  ok("as escolhas do prompt 4 não aparecem na resposta nem no ato", escrever.includes("{p4Ligado && tp4 && !resposta && (") && escrever.includes("p4Ligado && !resposta && tipo !== \"ato\" ? camposDoP4("));
  ok("a leitura em páginas usa só o post (rede_post), sem nada de fora", (() => { const l = ler("components/rede/publicar/p4/LeituraEmPaginas.tsx"); return l.includes("rede.post(post.id)") && !/https?:\/\//.test(l.replace(/\/\/.*$/gm, "")); })());
}

// ═══════════════════ 11. A15 do P5: escrever e comentar na barrinha ═══════════════════
{
  const topo = ler("components/rede/publicar/alumia2/TopoDaLinha2.tsx");
  const conversa = ler("components/rede/conversa/TelaDaConversaAlumia.tsx");
  const barra = escrever.slice(escrever.indexOf("if (barrinha) {"), escrever.indexOf("if (barrinha) {") + 4000);
  ok("A15: a barrinha é o próprio Escrever (o mesmo publicar, a mesma chave do envio e o mesmo Desfazer de 10 s)", barra.includes("void publicar()") && barra.includes("{avisoFlutuante}") && escrever.includes("const avisoFlutuante = envio ?") && (escrever.match(/\{avisoFlutuante\}/g) ?? []).length === 2);
  ok("A15: a barrinha tem o Expandir, que leva o texto para o editor completo", barra.includes("barrinha.aoExpandir(texto)"));
  ok("A15: a barrinha não guarda rascunho a cada tecla nem puxa o foco ao aparecer", escrever.includes("if (resposta || previa || envio || barrinha) return;") && escrever.includes("if (naBarrinha) return;"));
  ok("A15: no Início, a barrinha só com o interruptor (desligado, o botão de sempre abre a janela)", topo.includes('ligado("alumia-p4-compositor")') && topo.includes("{pode && !naBarrinha && (") && topo.includes("<EscreverNaBarrinha"));
  ok("A15: na conversa, o Expandir da caixa de resposta só com o interruptor", conversa.includes('aoExpandir={ligado("alumia-p4-compositor") ? aoExpandir : undefined}'));
}

// ═══════════════════ Fim ═══════════════════
if (falhas.length) {
  console.error(`compositor (prompt 4): ${falhas.length} falha(s), ${certos} certas`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`compositor (prompt 4): ${certos} conferências certas`);
process.exit(0);
