// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a identidade pública opcional da Alumia (supabase/migracoes/20261113-alumia-o7-identidade-publica.sql + lib/rede/identidade.ts):
// as regras puras (nome, recorte, bytes do WebP sem EXIF) e o banco (num Postgres de verdade dentro do Node, com a migração rodada
// DUAS vezes): nasce desligada e em codinome; só membro (18+) passa a público, e só dizendo que está ciente; o nome aparece na
// linha, no perfil e nos avisos; a foto é conferida byte a byte, espera a mediação e só quem tem conta vê; voltar ao codinome devolve
// o codinome guardado, APAGA a foto e tira o nome dos avisos; ninguém pega o codinome guardado; a matriz visitante / bloqueado /
// invisível / suspenso; e a porta da entrada em todas as funções novas.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-identidade.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import {
  arrumarNomePublico, fotoAceitavel, LADO_DA_FOTO, limitarRecorte, LIMITE_DA_FOTO, nomePublicoValido, problemaDoNomePublico, quadroDoRecorte, tipoDeFotoAceito, webpSemMetadados,
} from "../lib/rede/identidade.ts";

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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// ── WebP de mentira, só com a estrutura que o banco (e a tela) conferem ──
const u32 = (n) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
const pedaco = (id, dados) => Buffer.concat([Buffer.from(id, "latin1"), u32(dados.length), dados, dados.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
const webp = (...pedacos) => {
  const corpo = Buffer.concat([Buffer.from("WEBP"), ...pedacos]);
  return Buffer.concat([Buffer.from("RIFF"), u32(corpo.length), corpo]);
};
const url = (b) => `data:image/webp;base64,${b.toString("base64")}`;
const vp8x = (flags) => pedaco("VP8X", Buffer.concat([Buffer.from([flags, 0, 0, 0]), Buffer.from([0, 0, 0, 0, 0, 0])]));
const imagem = pedaco("VP8L", Buffer.from("2f000000100711118888fe0700", "hex"));
const BOA = url(webp(imagem));
const OUTRA = url(webp(imagem, pedaco("JUNK", Buffer.from("xx", "latin1"))));
const COM_EXIF = url(webp(vp8x(8), pedaco("EXIF", Buffer.from("Exif\0\0GPS fake", "latin1")), imagem));
const COM_XMP = url(webp(vp8x(4), imagem, pedaco("XMP ", Buffer.from("<x:xmpmeta/>", "latin1"))));
const COM_ICC = url(webp(vp8x(32), pedaco("ICCP", Buffer.from("perfil", "latin1")), imagem));
const ANIMADA = url(webp(vp8x(2), pedaco("ANIM", Buffer.from([0, 0, 0, 0, 0, 0])), imagem));

// ── 1. Regras puras ──
ok("nome: arruma espaços", arrumarNomePublico("  Maria   da  Silva ") === "Maria da Silva");
for (const bom of ["Maria da Silva", "João D'Ávila", "Ana-Clara Souza", "Li", "José Jr.", "Олга Иванова", "李娜"]) ok(`nome aceito: ${bom}`, nomePublicoValido(bom));
for (const [ruim, por] of [["M", "curto"], ["a".repeat(61), "longo"], ["Maria 2", "formato"], ["@maria", "formato"], ["Maria <b>", "formato"], ["-Maria", "formato"], ["Maria https", "formato"],
  ["Equipe Oficial", "reservado"], ["Instituto Lúcia", "reservado"], ["Moderação da Rede", "reservado"], ["Alumia", "reservado"]]) {
  ok(`nome recusado (${por}): ${ruim}`, problemaDoNomePublico(ruim) === por);
}
ok("nome: Lúcia sozinho é nome de gente e passa", nomePublicoValido("Lúcia Santos"));
ok("recorte: sem zoom pega o quadrado do meio", (() => {
  const q = quadroDoRecorte(400, 200, { zoom: 1, x: 0, y: 0 });
  return q.lado === 200 && q.sx === 100 && q.sy === 0;
})());
ok("recorte: na ponta não sai da imagem", (() => {
  const q = quadroDoRecorte(400, 200, { zoom: 2, x: 1, y: -1 });
  return q.lado === 100 && q.sx === 300 && q.sy === 0 && q.sx + q.lado <= 400;
})());
ok("recorte: valores fora do limite são contidos", (() => {
  const r = limitarRecorte({ zoom: 99, x: -7, y: Number.NaN });
  const q = quadroDoRecorte(300, 900, { zoom: 0.1, x: 5, y: 5 });
  return r.zoom === 4 && r.x === -1 && r.y === 0 && q.lado === 300 && q.sy === 600 && q.sx === 0;
})());
ok("foto: 240 px de lado e o mesmo limite do banco", LADO_DA_FOTO === 240 && LIMITE_DA_FOTO === 40000);
ok("foto: tipos aceitos para recortar (sem GIF nem SVG)", tipoDeFotoAceito("image/jpeg") && tipoDeFotoAceito("image/png") && tipoDeFotoAceito("image/webp") && !tipoDeFotoAceito("image/gif") && !tipoDeFotoAceito("image/svg+xml") && !tipoDeFotoAceito("text/html"));
ok("foto: WebP simples passa na tela", fotoAceitavel(BOA) && webpSemMetadados(new Uint8Array(Buffer.from(BOA.slice(23), "base64"))));
ok("foto: com EXIF (GPS, câmera) a tela recusa", !fotoAceitavel(COM_EXIF));
ok("foto: com XMP, perfil de cor ou animação a tela recusa", !fotoAceitavel(COM_XMP) && !fotoAceitavel(COM_ICC) && !fotoAceitavel(ANIMADA));
ok("foto: outro tipo, texto solto e acima do limite a tela recusa", !fotoAceitavel("data:image/png;base64," + BOA.slice(23)) && !fotoAceitavel("oi") && !fotoAceitavel(null) && !fotoAceitavel(BOA, 20));

// As telas: 6 idiomas com as mesmas chaves, sem palavra proibida, sem HTML cru, foto só por data URL conferida.
try {
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (k === "_rascunho" ? [] : v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}${Array.isArray(v) ? `[${v.length}]` : ""}`])).sort().join("|");
  const pt = ler("i18n/rede/identidade/pt.json");
  const base = chaves(JSON.parse(pt));
  for (const l of ["en", "es", "fr", "ru", "zh"]) ok(`identidade/${l}.json tem as mesmas chaves do pt`, chaves(JSON.parse(ler(`i18n/rede/identidade/${l}.json`))) === base);
  ok("o texto da tela não promete o que é proibido", !/diploma|universidade|algoritmo/i.test(pt));
  const telas = ["Identidade.tsx", "Recorte.tsx", "Lembrete.tsx"].map((f) => ler(`components/rede/identidade/${f}`)).join("\n") + ler("components/rede/ui/Avatar16.tsx");
  ok("nenhuma tela da identidade usa dangerouslySetInnerHTML", !/dangerouslySetInnerHTML\s*=/.test(telas));
  ok("a foto é conferida na tela antes de enviar (bytes sem EXIF)", /fotoAceitavel\(/.test(ler("components/rede/identidade/foto.ts")));
  ok("o recorte desenha num canvas (os pixels vão, os metadados ficam)", /getContext\("2d"\)/.test(ler("components/rede/identidade/foto.ts")) && /toDataURL\("image\/webp"/.test(ler("components/rede/identidade/foto.ts")));
  ok("as fotos dos outros ficam só na memória da aba (nada de localStorage)", !/localStorage|sessionStorage|indexedDB/.test(ler("lib/rede/fotos-publicas.ts")));
  ok("o rosto da rede mostra a foto pública e cai no mosaico sem ela", /useFotoPublica\(/.test(ler("components/rede/ui/Avatar16.tsx")) && /celulasDoAvatar\(/.test(ler("components/rede/ui/Avatar16.tsx")));
} catch (erro) {
  falhas.push(`as telas da identidade: ${erro.message}`);
}

// ── 2. Banco ──
const banco = await criarBanco();
const { dono: sql, criarUsuario, rpc } = banco;
const migracao = ler("supabase/migracoes/20261113-alumia-o7-identidade-publica.sql");
await espera("a migração instala", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(migracao)));
ok("a migração não mexe em rede_alumia_versao nem cria política", !/rede_alumia_versao|create policy/i.test(migracao));

let ip = 10;
const como = (sub, aal = "aal1") => ({ papel: "authenticated", sub, aal, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const nomes = ["ana", "beto", "caio", "bloq", "menor", "invis", "media", "coord", "dona"];
const P = {};
for (const nome of nomes) {
  P[nome] = await criarUsuario(`${nome}@identidade.local`, nome === "media" ? "Marta Mediadora" : nome);
  await rpc(como(P[nome]), "eu");
  await sql("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Codinome ${nome}`, `${nome}_id`]);
}
await sql("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "menor")) {
  await sql("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await sql("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await sql("update auth.users set created_at = now() - interval '30 days'");
await sql("delete from interno.papeis");
await sql("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'mediacao')", [P.coord, P.media]);
// O nome do painel de quem é da equipe (o civil): ninguém mais pode usá-lo como nome público.
await sql("update interno.perfis set nome = 'Marta Mediadora' where id = $1", [P.media]);
await sql("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.invis]);
await sql("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.ana, P.bloq]);
await sql("insert into interno.rede_orgs (perfil, tipo, verificada_em) values ($1, 'coletivo', now())", [P.dona]);
const A = (n, aal) => como(P[n], aal);
const perfil = async (n) => (await sql("select rede_identidade as modo, rede_codinome as nome, rede_codinome_reserva as reserva, rede_avatar as avatar, rede_avatar_dados as dados, rede_avatar_ok as aceita, rede_identidade_dia as dia from interno.perfis where id = $1", [P[n]])).rows[0];

// Nasce em codinome e com o interruptor desligado.
await espera("todo perfil nasce em codinome, sem nada guardado", async () => (await sql("select count(*)::int as n from interno.perfis where rede_identidade <> 'codinome' or rede_codinome_reserva is not null")).rows[0].n, (n) => n === 0);
await espera("a Ana vê a própria identidade: codinome, indisponível (desligado)", () => rpc(A("ana"), "rede_identidade_minha"), (r) => r.modo === "codinome" && r.nome === null && r.codinome === "Codinome ana" && r.foto === null && r.disponivel === false && r.federa === false);
await espera("o sim ou não do interruptor responde a visitante (o cadastro pergunta) e nasce em não", () => rpc(visitante(), "identidade_publica_aberta"), (r) => r === false);
await recusa("visitante não lê identidade", () => rpc(visitante(), "rede_identidade_minha"), "permission denied");
await recusa("com o interruptor desligado ninguém passa a público", () => rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: true }), "identidade_desligada");
await recusa("conta comum não liga o interruptor", () => rpc(A("ana"), "alumia_identidade_publica_ligar", { p_ligar: true }), "sem_permissao");
await espera("a coordenação liga o interruptor", () => rpc(A("coord", "aal2"), "alumia_identidade_publica_ligar", { p_ligar: true }), (r) => r.ligada === true && r.publicas === 0);
await espera("ligado, o sim ou não responde sim (a visitante e a quem tem conta)", async () => [await rpc(visitante(), "identidade_publica_aberta"), await rpc(A("ana"), "identidade_publica_aberta")], ([v, a]) => v === true && a === true);
await espera("agora está disponível para a Ana", () => rpc(A("ana"), "rede_identidade_minha"), (r) => r.disponivel === true);
await espera("conta de organização não escolhe", () => rpc(A("dona"), "rede_identidade_minha"), (r) => r.disponivel === false);

// Quem pode e como.
await recusa("menor (não é membro) não passa a público", () => rpc(A("menor"), "rede_identidade_publicar", { p_nome: "Menor de Idade", p_ciente: true }), "confirme_idade");
await recusa("sem dizer que está ciente não passa", () => rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: false }), "confirme_ciencia");
await recusa("ciente nulo também não", () => rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: null }), "confirme_ciencia");
await recusa("conta de organização não passa a público", () => rpc(A("dona"), "rede_identidade_publicar", { p_nome: "Dona da Conta", p_ciente: true }), "identidade_org");
for (const [ruim, codigo] of [["A", "invalido:nome"], ["a".repeat(61), "invalido:nome"], ["Ana 2000", "invalido:nome"], ["Ana <script>", "invalido:nome"], ["ana@exemplo.org", "invalido:nome"],
  ["Ana https", "invalido:nome"], ["Equipe Oficial", "nome_reservado"], ["Instituto Lúcia", "nome_reservado"], ["Coordenação Geral", "nome_reservado"],
  ["Codinome beto", "nome_usado"], ["codinome BETO", "nome_usado"]]) {
  await recusa(`nome recusado: ${ruim}`, () => rpc(A("ana"), "rede_identidade_publicar", { p_nome: ruim, p_ciente: true }), codigo);
}
ok("nada mudou depois das recusas", (await perfil("ana")).modo === "codinome" && (await perfil("ana")).nome === "Codinome ana");
// O nome da conta de quem é da equipe não é comparado: a resposta não pode servir de oráculo de quem é da equipe.
await espera("o nome civil de alguém da equipe não é recusado como \"usado\" (sem oráculo)", async () => {
  const r = await rpc(A("bloq"), "rede_identidade_publicar", { p_nome: "Marta Mediadora", p_ciente: true });
  await rpc(A("bloq"), "rede_identidade_codinome");
  return r;
}, (r) => r.modo === "publica" && r.nome === "Marta Mediadora");
await recusa("em codinome não se envia foto pública", () => rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: BOA }), "identidade_codinome");

// Antes de mudar: a Ana responde ao Beto (gera aviso com o codinome dela).
const postBeto = (await sql("insert into interno.rede_posts (autor, texto) values ($1, 'Post do Beto') returning id", [P.beto])).rows[0].id;
const postAna = (await sql("insert into interno.rede_posts (autor, texto) values ($1, 'Um post da Ana') returning id", [P.ana])).rows[0].id;
await sql("insert into interno.avisos (para, texto, categoria, tipo, post, ator) values ($1, $2, 'rede', 'resposta', $3, $4)", [P.beto, "Codinome ana respondeu ao seu post na Rede Lúcia: “oi”", postBeto, P.ana]);
await sql("insert into interno.avisos (para, texto, categoria, tipo, post, ator) values ($1, $2, 'rede', 'resposta', $3, $4)", [P.ana, "Codinome ana Paula respondeu ao seu post na Rede Lúcia: “oi”", postAna, P.caio]);

// A Ana passa a público.
const publica = await espera("a Ana passa a público com o nome dela", () => rpc(A("ana"), "rede_identidade_publicar", { p_nome: "  Ana   Souza ", p_ciente: true }),
  (r) => r.modo === "publica" && r.nome === "Ana Souza" && r.codinome === "Codinome ana" && r.foto === null && /^\d{4}-\d{2}-\d{2}$/.test(r.desde));
ok("o que volta não traz id nem e-mail", publica && Object.keys(publica).sort().join() === "codinome,desde,disponivel,federa,foto,modo,nome");
ok("no banco: nome mostrado, codinome guardado, dia", await perfil("ana").then((f) => f.modo === "publica" && f.nome === "Ana Souza" && f.reserva === "Codinome ana" && f.dia !== null));
await espera("o nome aparece no post dela na linha", () => rpc(A("beto"), "rede_post", { p_id: postAna }), (r) => (r.post?.autor?.codinome ?? r.autor?.codinome) === "Ana Souza");
await espera("e na página do perfil", () => rpc(A("beto"), "rede_perfil_de", { p_handle: "ana_id" }), (r) => r.codinome === "Ana Souza");
await espera("o aviso que ela gerou passa a mostrar o nome", async () => (await sql("select texto from interno.avisos where ator = $1", [P.ana])).rows[0].texto, (t) => t === "Ana Souza respondeu ao seu post na Rede Lúcia: “oi”");
await espera("aviso de OUTRA pessoa com começo parecido não muda", async () => (await sql("select texto from interno.avisos where ator = $1", [P.caio])).rows[0].texto, (t) => t.startsWith("Codinome ana Paula respondeu"));
await espera("o registro guarda só que mudou, nunca o nome", async () => (await sql("select detalhes::text as d, alvo from interno.auditoria where acao = 'rede_identidade' order by criado_em desc limit 1")).rows[0], (r) => r && !r.d.includes("Ana") && r.alvo === "" && r.d.includes("publica"));

// O codinome guardado é dela.
await recusa("ninguém pega o codinome guardado", () => rpc(A("caio"), "rede_codinome_definir", { p_codinome: "Codinome ana" }), "codinome_usado");
await recusa("nem com outra caixa e acento", () => rpc(A("caio"), "rede_codinome_definir", { p_codinome: "CODINOME ANÁ" }), "codinome_usado");
await recusa("nem como nome público, e a resposta é a de um nome inválido (não diz que alguém o guardou)", () => rpc(A("caio"), "rede_identidade_publicar", { p_nome: "Codinome ana", p_ciente: true }), "invalido:nome");
await recusa("codinome igual ao nome público de alguém continua recusado", () => rpc(A("caio"), "rede_codinome_definir", { p_codinome: "Ana Souza" }), "codinome_usado");
await espera("o sorteio de codinome livre pula o guardado", async () => (await sql("select interno.rede_codinome_livre('Codinome ana') as c")).rows[0].c, (c) => c !== "Codinome ana");
await espera("nomes de verdade podem repetir (homônimos)", () => rpc(A("caio"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: true }), (r) => r.modo === "publica" && r.nome === "Ana Souza" && r.codinome === "Codinome caio");
await recusa("em público, a troca de codinome de sempre não mexe no nome mostrado", () => rpc(A("caio"), "rede_codinome_definir", { p_codinome: "Outro Codinome" }), "identidade_nome_travado");
ok("e o nome continua o que ela escolheu", (await perfil("caio")).nome === "Ana Souza" && (await perfil("caio")).reserva === "Codinome caio");
await espera("trocar o nome público mantém o codinome guardado", () => rpc(A("caio"), "rede_identidade_publicar", { p_nome: "Caio Lima", p_ciente: true }), (r) => r.nome === "Caio Lima" && r.codinome === "Codinome caio");

// A foto: bytes conferidos, mediação, quem vê.
for (const [nome, dados] of [["EXIF (GPS, câmera)", COM_EXIF], ["XMP", COM_XMP], ["perfil de cor", COM_ICC], ["animação", ANIMADA], ["PNG com rótulo de WebP", "data:image/webp;base64," + Buffer.from("\x89PNG\r\n\x1a\n0000000000000000", "latin1").toString("base64")],
  ["outro tipo", "data:image/jpeg;base64," + BOA.slice(23)], ["texto solto", "https://exemplo.org/foto.jpg"], ["grande demais", "data:image/webp;base64," + "A".repeat(40001)]]) {
  await recusa(`foto recusada: ${nome}`, () => rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: dados }), "invalido:imagem");
}
ok("foto recusada não deixa nada no banco", (await perfil("ana")).dados === null);
await recusa("visitante não envia foto", () => rpc(visitante(), "rede_identidade_foto_enviar", { p_dados: BOA }), "permission denied");
await espera("a Ana envia a foto: fica pendente", () => rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: BOA }), (r) => r.foto?.dados === BOA && r.foto.pendente === true);
await espera("pendente: a própria Ana vê o carimbo", () => rpc(A("ana"), "rede_identidade_de", { p_handles: ["ana_id", "@Beto_ID ", "nao_existe"] }), (r) => typeof r.ana_id?.foto === "string" && r.ana_id.foto.length === 8 && !("beto_id" in r) && !("nao_existe" in r));
await espera("pendente: o Beto vê que é pública, sem foto", () => rpc(A("beto"), "rede_identidade_de", { p_handles: ["ana_id", "caio_id"] }), (r) => r.ana_id && r.ana_id.foto === null && r.caio_id && r.caio_id.foto === null);
await espera("pendente: o Beto não recebe a foto", () => rpc(A("beto"), "rede_identidade_foto", { p_handle: "ana_id" }), (r) => r === null);
await espera("pendente: a Ana recebe a própria foto", () => rpc(A("ana"), "rede_identidade_foto", { p_handle: "@ana_id" }), (r) => r === BOA);
await espera("a foto entra na fila da mediação (a mesma das imagens de perfil)", () => rpc(A("media", "aal2"), "rede_perfil_imagens_fila"), (r) => r.some((x) => x.usuario === P.ana && x.tipo === "avatar" && x.dados === BOA));
await recusa("conta comum não vê a fila", () => rpc(A("beto"), "rede_perfil_imagens_fila"), "sem_permissao");
await espera("a mediação aceita", () => rpc(A("media", "aal2"), "rede_perfil_imagem_decidir", { p_usuario: P.ana, p_tipo: "avatar", p_aceitar: true }), (r) => r.ok === true);
const carimbo = await espera("aceita: o Beto vê o carimbo", () => rpc(A("beto"), "rede_identidade_de", { p_handles: ["ana_id"] }), (r) => typeof r.ana_id?.foto === "string");
await espera("aceita: o Beto recebe a foto", () => rpc(A("beto"), "rede_identidade_foto", { p_handle: "ana_id" }), (r) => r === BOA);
await espera("visitante não recebe nada (nem quem é pública, nem foto)", async () => { try { return await rpc(visitante(), "rede_identidade_de", { p_handles: ["ana_id"] }); } catch (e) { return String(e.message); } }, (r) => typeof r === "string" ? r.includes("permission denied") : Object.keys(r).length === 0);
await recusa("visitante não recebe a foto", () => rpc(visitante(), "rede_identidade_foto", { p_handle: "ana_id" }), "permission denied");
await espera("quem a Ana bloqueou não vê identidade nem foto", async () => [await rpc(A("bloq"), "rede_identidade_de", { p_handles: ["ana_id"] }), await rpc(A("bloq"), "rede_identidade_foto", { p_handle: "ana_id" })], ([d, f]) => Object.keys(d).length === 0 && f === null);
await espera("trocar a foto volta a ficar pendente e muda o carimbo", async () => {
  const r = await rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: OUTRA });
  const meu = await rpc(A("ana"), "rede_identidade_de", { p_handles: ["ana_id"] });
  const dele = await rpc(A("beto"), "rede_identidade_de", { p_handles: ["ana_id"] });
  return [r.foto.pendente, meu.ana_id.foto, dele.ana_id.foto];
}, ([pendente, meu, dele]) => pendente === true && typeof meu === "string" && meu !== carimbo?.ana_id?.foto && dele === null);
await espera("a mediação recusa: a foto some do banco e a Ana é avisada", async () => {
  await rpc(A("media", "aal2"), "rede_perfil_imagem_decidir", { p_usuario: P.ana, p_tipo: "avatar", p_aceitar: false });
  return [await perfil("ana"), (await sql("select count(*)::int as n from interno.avisos where para = $1 and texto like 'Sua foto de perfil não foi aceita%'", [P.ana])).rows[0].n];
}, ([f, n]) => f.dados === null && f.avatar === null && f.modo === "publica" && n === 1);
await espera("a equipe que cuida da rede tem a foto aceita na hora", async () => {
  await rpc(A("media", "aal2"), "rede_identidade_publicar", { p_nome: "Marta Mediadora", p_ciente: true });
  return rpc(A("media", "aal2"), "rede_identidade_foto_enviar", { p_dados: BOA });
}, (r) => r.modo === "publica" && r.nome === "Marta Mediadora" && r.foto.pendente === false);
await espera("apagar a foto: some do banco na hora", async () => {
  await rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: BOA });
  const r = await rpc(A("ana"), "rede_identidade_foto_remover");
  return [r, await perfil("ana")];
}, ([r, f]) => r.foto === null && r.modo === "publica" && f.dados === null && f.avatar === null && f.aceita === false);

// Invisível e suspensa.
await espera("perfil invisível em público não é anunciado aos outros (só a ela)", async () => {
  await rpc(A("invis"), "rede_identidade_publicar", { p_nome: "Ivo Invisível", p_ciente: true });
  await rpc(A("invis"), "rede_identidade_foto_enviar", { p_dados: BOA });
  await sql("update interno.perfis set rede_avatar_ok = true where id = $1", [P.invis]);
  return [await rpc(A("beto"), "rede_identidade_de", { p_handles: ["invis_id"] }), await rpc(A("beto"), "rede_identidade_foto", { p_handle: "invis_id" }), await rpc(A("invis"), "rede_identidade_de", { p_handles: ["invis_id"] })];
}, ([d, f, eu]) => Object.keys(d).length === 0 && f === null && typeof eu.invis_id?.foto === "string");
await espera("conta suspensa não é anunciada nem entrega foto", async () => {
  await sql("update interno.perfis set suspenso = true where id = $1", [P.media]);
  const r = [await rpc(A("beto"), "rede_identidade_de", { p_handles: ["media_id"] }), await rpc(A("beto"), "rede_identidade_foto", { p_handle: "media_id" })];
  await sql("update interno.perfis set suspenso = false where id = $1", [P.media]);
  return r;
}, ([d, f]) => Object.keys(d).length === 0 && f === null);

// O interruptor desligado depois: fotos param, quem é público pode voltar.
await espera("a Ana envia de novo e a mediação aceita", async () => {
  await rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: BOA });
  await rpc(A("media", "aal2"), "rede_perfil_imagem_decidir", { p_usuario: P.ana, p_tipo: "avatar", p_aceitar: true });
  return rpc(A("beto"), "rede_identidade_foto", { p_handle: "ana_id" });
}, (r) => r === BOA);
await espera("ligado: a função antiga do rosto entrega a foto aceita, como antes", async () => [await rpc(A("beto"), "rede_perfil_imagem", { p_usuario: P.ana, p_tipo: "avatar" }), await rpc(A("beto"), "rede_perfil_avatares", { p_usuarios: [P.ana] })],
  ([f, lote]) => f === BOA && lote[P.ana] === "envio");
await espera("desligar pelo SQL Editor", async () => (await sql("select interno.alumia_identidade_publica_ligar(false) as r")).rows[0].r, (r) => r.ligada === false && r.publicas >= 3);
await espera("desligado: nenhuma foto é anunciada nem entregue", async () => [await rpc(A("beto"), "rede_identidade_de", { p_handles: ["ana_id"] }), await rpc(A("beto"), "rede_identidade_foto", { p_handle: "ana_id" })], ([d, f]) => d.ana_id?.foto === null && f === null);
await espera("desligado: as funções antigas do rosto também não entregam a foto de quem está em público", async () => [
  await rpc(A("beto"), "rede_perfil_imagem", { p_usuario: P.ana, p_tipo: "avatar" }),
  await rpc(A("ana"), "rede_perfil_imagem", { p_usuario: P.ana, p_tipo: "avatar" }),
  await rpc(A("beto"), "rede_perfil_avatares", { p_usuarios: [P.ana] }),
], ([dele, meu, lote]) => dele === null && meu === null && !(P.ana in lote));
await recusa("desligado: ninguém envia foto", () => rpc(A("ana"), "rede_identidade_foto_enviar", { p_dados: BOA }), "identidade_desligada");
await recusa("desligado: ninguém troca o nome público", () => rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana S", p_ciente: true }), "identidade_desligada");
await espera("desligado: o Caio volta ao codinome mesmo assim", () => rpc(A("caio"), "rede_identidade_codinome"), (r) => r.modo === "codinome" && r.codinome === "Codinome caio" && r.nome === null && r.codinome_trocado === false);
await sql("select interno.alumia_identidade_publica_ligar(true)");

// A volta da Ana: codinome de volta, foto apagada, nome fora dos avisos e de toda leitura.
await sql("insert into interno.avisos (para, texto, categoria, tipo, post, ator) values ($1, $2, 'rede', 'mencao', $3, $4)", [P.beto, "Ana Souza mencionou você na Rede Lúcia: “vem”", postAna, P.ana]);
const volta = await espera("a Ana volta ao codinome", () => rpc(A("ana"), "rede_identidade_codinome"), (r) => r.modo === "codinome" && r.nome === null && r.codinome === "Codinome ana" && r.foto === null && r.desde === null && r.codinome_trocado === false);
ok("no banco: codinome de volta, nada guardado, foto APAGADA", await perfil("ana").then((f) => f.modo === "codinome" && f.nome === "Codinome ana" && f.reserva === null && f.dados === null && f.avatar === null && f.aceita === false && f.dia === null));
await espera("o nome sumiu de todo aviso que ela gerou", async () => (await sql("select texto from interno.avisos where ator = $1 order by criado_em", [P.ana])).rows.map((r) => r.texto), (t) => t.length === 2 && t.every((x) => x.startsWith("Codinome ana ") && !x.includes("Ana Souza")));
await espera("o nome não aparece mais em coluna nenhuma do perfil dela", async () => (await sql("select to_jsonb(f)::text as t from interno.perfis f where id = $1", [P.ana])).rows[0].t, (t) => !t.includes("Ana Souza") && !t.includes(BOA.slice(23, 60)));
await espera("o post volta a mostrar o codinome", () => rpc(A("beto"), "rede_post", { p_id: postAna }), (r) => (r.post?.autor?.codinome ?? r.autor?.codinome) === "Codinome ana");
await espera("o perfil volta a mostrar o codinome", () => rpc(A("beto"), "rede_perfil_de", { p_handle: "ana_id" }), (r) => r.codinome === "Codinome ana" && r.avatar?.tipo === null);
await espera("ninguém mais recebe identidade pública nem foto dela", async () => [await rpc(A("beto"), "rede_identidade_de", { p_handles: ["ana_id"] }), await rpc(A("beto"), "rede_identidade_foto", { p_handle: "ana_id" }), await rpc(A("ana"), "rede_identidade_foto", { p_handle: "ana_id" })], ([d, f, eu]) => Object.keys(d).length === 0 && f === null && eu === null);
await espera("voltar de novo não muda nada (já está em codinome)", () => rpc(A("ana"), "rede_identidade_codinome"), (r) => r.modo === "codinome" && r.codinome === "Codinome ana");
await espera("e dá para escolher de novo depois (reversível nos dois sentidos)", async () => {
  const a = await rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: true });
  const b = await rpc(A("ana"), "rede_identidade_codinome");
  return [a, b];
}, ([a, b]) => a.modo === "publica" && a.foto === null && b.modo === "codinome" && b.codinome === "Codinome ana");
ok("a volta não devolve dado além da própria identidade", volta && !("id" in volta));
await espera("a volta pode trocar o @ junto, sem a espera de 30 dias, e o @ antigo fica livre", async () => {
  await rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: true });
  await sql("update interno.perfis set rede_handle_em = now() where id = $1", [P.ana]);
  const r = await rpc(A("ana"), "rede_identidade_codinome", { p_novo_handle: "@Ana_Nova " });
  return [r, (await sql("select rede_handle from interno.perfis where id = $1", [P.ana])).rows[0].rede_handle, (await sql("select count(*)::int as n from interno.perfis where rede_handle = 'ana_id'")).rows[0].n];
}, ([r, h, velho]) => r.modo === "codinome" && r.handle === "ana_nova" && h === "ana_nova" && velho === 0);
await espera("na volta, @ já usado, torto ou que imita a equipe é recusado e nada muda", async () => {
  const erros = [];
  for (const h of ["beto_id", "a", "equipe_x"]) {
    await rpc(A("ana"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: true });
    try { await rpc(A("ana"), "rede_identidade_codinome", { p_novo_handle: h }); erros.push("passou"); } catch (e) { erros.push(String(e.message)); }
  }
  const f = await perfil("ana");
  await rpc(A("ana"), "rede_identidade_codinome");
  await sql("update interno.perfis set rede_handle = 'ana_id' where id = $1", [P.ana]);
  return [erros, f.modo];
}, ([e, modo]) => /handle_usado/.test(e[0]) && /invalido:handle/.test(e[1]) && /handle_reservado/.test(e[2]) && modo === "publica");
await espera("o codinome guardado em uso por acidente: a volta dá um novo e avisa", async () => {
  await rpc(A("beto"), "rede_identidade_publicar", { p_nome: "Beto Ramos", p_ciente: true });
  await sql("alter table interno.perfis disable trigger alumia_identidade_guarda");
  await sql("drop index interno.perfis_rede_codinome_reserva_unico");
  await sql("update interno.perfis set rede_codinome = 'Codinome beto' where id = $1", [P.bloq]);
  await sql("alter table interno.perfis enable trigger alumia_identidade_guarda");
  const r = await rpc(A("beto"), "rede_identidade_codinome");
  await sql("update interno.perfis set rede_codinome = 'Codinome bloq' where id = $1", [P.bloq]);
  return r;
}, (r) => r.modo === "codinome" && r.codinome_trocado === true && r.codinome && r.codinome !== "Codinome beto");
await espera("instala de novo com gente em público (e recria o índice que faltava)", async () => {
  await rpc(A("caio"), "rede_identidade_publicar", { p_nome: "Caio Lima", p_ciente: true });
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return [await perfil("caio"), (await sql("select count(*)::int as n from pg_indexes where schemaname = 'interno' and indexname in ('perfis_rede_codinome_unico', 'perfis_rede_codinome_reserva_unico')")).rows[0].n];
}, ([f, n]) => f.modo === "publica" && f.nome === "Caio Lima" && f.reserva === "Codinome caio" && n === 2);

// Tabela e permissões: nada direto.
await espera("as funções internas não são chamáveis de fora", async () => (await sql(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'interno' and p.proname like 'alumia_identidade%' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).rows[0].n, (n) => n === 0);
await espera("visitante não chama nenhuma função pública da identidade", async () => (await sql(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'rede_identidade%' or p.proname = 'alumia_identidade_publica_ligar') and has_function_privilege('anon', p.oid, 'execute')`)).rows[0].n, (n) => n === 0);
await espera("toda função nova é security definer com search_path fixo", async () => (await sql(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (p.proname like 'rede_identidade%' or p.proname like 'alumia_identidade%') and (not p.prosecdef or not coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=interno, pg_temp%')`)).rows[0].n, (n) => n === 0);

// ── 3. A porta da entrada ──
const FUNCOES = [
  ["rede_identidade_minha", {}], ["rede_identidade_publicar", { p_nome: "Caio Lima", p_ciente: true }], ["rede_identidade_codinome", {}],
  ["rede_identidade_foto_enviar", { p_dados: BOA }], ["rede_identidade_foto_remover", {}], ["rede_identidade_de", { p_handles: ["ana_id"] }],
  ["rede_identidade_foto", { p_handle: "ana_id" }], ["alumia_identidade_publica_ligar", { p_ligar: true }],
];
await espera("todas as funções novas têm a porta", async () => (await sql(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'rede_identidade%' or p.proname = 'alumia_identidade_publica_ligar') and p.prosrc ~ 'interno\\.alumia_porta\\(\\)'`)).rows[0].n, (n) => n === FUNCOES.length);
await espera("a regra não deixou nenhuma função aberta", async () => (await sql("select interno.alumia_trancar() as r")).rows[0].r, (r) => Array.isArray(r.abertas) && r.abertas.length === 0);
await espera("com a trava desligada a porta não atrapalha", () => rpc(A("ana"), "rede_identidade_minha"), (r) => r.modo === "codinome");
await espera("a coordenação liga a trava da entrada", async () => (await sql("select interno.alumia_entrada_ligar(true) as r")).rows[0].r, (r) => r.exigir === true);
const NOVA = await criarUsuario("nova@identidade.local", "nova");
await rpc(como(NOVA), "eu");
for (const [f, args] of FUNCOES) {
  await recusa(`trava ligada: conta não aprovada não chama ${f}`, () => rpc(como(NOVA, "aal2"), f, args), "alumia_entrada");
  await recusa(`trava ligada: aprovada sem o segundo fator não chama ${f}`, () => rpc(A("ana", "aal1"), f, args), "alumia_entrada");
}
await espera("trava ligada: o sim ou não continua respondendo ao cadastro (não é função de membro)", () => rpc(visitante(), "identidade_publica_aberta"), (r) => r === true);
await espera("o sim ou não é security definer, com search_path fixo, e não devolve mais nada", async () => (await sql(`select p.prosecdef as d, array_to_string(p.proconfig, ',') as c, p.prorettype::regtype::text as t from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'identidade_publica_aberta'`)).rows[0], (r) => r.d === true && r.c.includes("search_path=interno, pg_temp") && r.t === "boolean");
await espera("trava ligada: aprovada com o segundo fator usa", () => rpc(A("ana", "aal2"), "rede_identidade_minha"), (r) => r.modo === "codinome" && r.disponivel === true);
await espera("trava ligada: e passa a público", () => rpc(A("ana", "aal2"), "rede_identidade_publicar", { p_nome: "Ana Souza", p_ciente: true }), (r) => r.modo === "publica");
await espera("trava ligada: e volta", () => rpc(A("ana", "aal2"), "rede_identidade_codinome"), (r) => r.modo === "codinome" && r.codinome === "Codinome ana");

console.log(`testar-alumia-identidade: ${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log("  ✗ " + f);
  process.exit(1);
}
