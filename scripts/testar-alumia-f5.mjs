// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o back-end dos stories da Alumia (F5; supabase/migracoes/20261109-alumia-f5.sql) num Postgres de verdade dentro do Node,
// pelo MESMO cliente que a tela usa (lib/rede/cliente-stories.ts): a matriz visitante / membro / seguidor / próximo / dono /
// bloqueado / conta sem adesão; some em 24 h (na hora, nas funções) e a faxina apaga; nenhuma tabela, coluna ou campo de "quem
// viu"; resposta só para a autora (e some com o story); reação sem nome; enquete secreta com soma só para a autora e a partir de
// 3; "me avise" sem ninguém saber quem pediu; denúncia urgente retém e guarda a prova; o depósito privado com a regra de leitura;
// EXIF fora (a limpeza da Edge Function faxina-stories); limites; permissões; e a migração rodando duas vezes.
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 --import ./scripts/carregar-ts.mjs scripts/testar-alumia-f5.mjs
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { comEnderecos, criarClienteDeStories, extensaoDaImagem } from "../lib/rede/cliente-stories.ts";
import { limparMetadados, rodada } from "../supabase/functions/faxina-stories/faxina.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
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

// ═══════════════════ 1. A limpeza de metadados (a Edge Function, sem rede) ═══════════════════
{
  const bytes = (...partes) => Uint8Array.from(partes.flat());
  const seg = (marca, conteudo) => [0xff, marca, ((conteudo.length + 2) >> 8) & 0xff, (conteudo.length + 2) & 0xff, ...conteudo];
  const txt = (s) => [...Buffer.from(s, "latin1")];
  const jpeg = bytes([0xff, 0xd8], seg(0xe0, txt("JFIF\0\x01\x01")), seg(0xe1, txt("Exif\0\0GPS-23.55,-46.63")), seg(0xfe, txt("comentario")), seg(0xdb, [0, 1, 2]), [0xff, 0xda, 0, 2, 9, 9, 9, 0xff, 0xd9]);
  const j = limparMetadados(jpeg);
  ok("JPEG: reconhecido e mudou", j?.formato === "jpeg" && j.mudou);
  ok("JPEG: o EXIF (com GPS) e o comentário saem", !Buffer.from(j.bytes).toString("latin1").includes("GPS") && !Buffer.from(j.bytes).toString("latin1").includes("comentario"));
  ok("JPEG: JFIF, tabela e a imagem ficam", Buffer.from(j.bytes).toString("latin1").includes("JFIF") && j.bytes.at(-1) === 0xd9 && j.bytes.includes(0xdb));
  ok("JPEG limpo de novo não muda", limparMetadados(j.bytes).mudou === false);

  const be = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (tipo, dados) => [...be(dados.length), ...txt(tipo), ...dados, 1, 2, 3, 4];
  const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk("IHDR", new Array(13).fill(0)), chunk("tEXt", txt("Author\0Fulana")), chunk("eXIf", txt("MM\0*GPS")), chunk("IDAT", [7, 7]), chunk("IEND", []));
  const p = limparMetadados(png);
  ok("PNG: texto e eXIf saem, a imagem fica", p?.formato === "png" && p.mudou && !Buffer.from(p.bytes).toString("latin1").includes("Fulana") && Buffer.from(p.bytes).toString("latin1").includes("IDAT"));

  const le = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const wchunk = (tipo, dados) => [...txt(tipo), ...le(dados.length), ...dados, ...(dados.length & 1 ? [0] : [])];
  const vp8x = [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const corpo = [...txt("WEBP"), ...wchunk("VP8X", vp8x), ...wchunk("VP8 ", [1, 2, 3, 4]), ...wchunk("EXIF", txt("GPS-23.5")), ...wchunk("XMP ", txt("<x:xmp/>"))];
  const webp = bytes(txt("RIFF"), le(corpo.length), corpo);
  const w = limparMetadados(webp);
  const ws = Buffer.from(w.bytes).toString("latin1");
  ok("WEBP: EXIF e XMP saem", w?.formato === "webp" && w.mudou && !ws.includes("GPS") && !ws.includes("xmp"));
  ok("WEBP: o VP8X para de anunciar EXIF/XMP", (w.bytes[20] & 0x0c) === 0);
  ok("WEBP: o tamanho do RIFF bate", Buffer.from(w.bytes).readUInt32LE(4) === w.bytes.length - 8);
  ok("o que não é imagem volta nulo", limparMetadados(Uint8Array.from(txt("<html>oi</html>"))) === null);
  ok("a extensão segue o tipo que o canvas devolveu", extensaoDaImagem("image/png").ext === "png" && extensaoDaImagem("image/webp").ext === "webp" && extensaoDaImagem("").tipo === "image/webp");
  const semUrl = await comEnderecos([{ id: "a", fundo: { tipo: "imagem", cor: "azul", caminho: "x/y.webp", url: "", alt: "" } }], async () => ({}));
  ok("sem endereço assinado, o story fica com o fundo de cor (nunca uma imagem quebrada)", semUrl[0].fundo.tipo === "listras");
  globalThis.__jpeg = jpeg;
}

// ═══════════════════ 2. O banco ═══════════════════
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;

// O mínimo do Storage do Supabase (o banco local não tem): baldes, objetos com RLS e storage.foldername.
await banco.exclusivo(() => banco.pg.exec(`
  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text,
    owner_id text default (auth.uid())::text, created_at timestamptz not null default now(), metadata jsonb, unique (bucket_id, name));
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, delete on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
`));

ok("a migração está colada no install.sql (o integrador colou)", ler("supabase/install.sql").includes("Alumia · Onda 5 · F5"));
await espera("a F0 instala", () => banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f0-contrato.sql"))));
await espera("a F5 instala", () => banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f5.sql"))));
await espera("e instala de novo sem estrago (idempotente)", () => banco.exclusivo(() => banco.pg.exec(ler("supabase/migracoes/20261109-alumia-f5.sql"))));
await espera("o depósito rede-stories é privado, 3 MB, só imagem", () => um("select * from storage.buckets where id = 'rede-stories'"),
  (b) => b.public === false && Number(b.file_size_limit) === 3145728 && b.allowed_mime_types.join() === "image/webp,image/png,image/jpeg");

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });
const servico = { papel: "service_role" };

// ── As pessoas ──
const P = {};
const nomes = ["autora", "seguidor", "mutuo", "membro", "bloqueado", "semconta", "v1", "v2", "outra"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@f5.local`, nome);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Lutadora ${i + 1}`, `${nome}_f5`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "semconta")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
for (const nome of ["seguidor", "mutuo", "bloqueado", "v1", "v2", "semconta"]) await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P[nome], P.autora]);
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [P.autora, P.mutuo]);
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.autora, P.bloqueado]);

// Um ato da autora (F2 só pelo id) e um da "outra".
const ato = (await um("insert into interno.rede_posts (autor, texto, titulo, publico) values ($1, 'Passe livre já, todo mundo na praça', 'PASSE LIVRE JÁ', 'membros') returning id", [P.autora])).id;
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto) values ($1, now() + interval '2 days', 'São Paulo', 'Praça da Sé')", [ato]);
const atoDaOutra = (await um("insert into interno.rede_posts (autor, texto, titulo, publico) values ($1, 'Outro ato', 'OUTRO', 'membros') returning id", [P.outra])).id;
await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto) values ($1, now() + interval '3 days', 'Recife', 'Marco Zero')", [atoDaOutra]);

// O cliente da tela, sobre o banco local (o endereço assinado é simulado: o Storage de verdade não está aqui).
const cliente = (sub) =>
  criarClienteDeStories((f, a) => rpc(sub ? como(sub) : visitante(), f, a), async () => "", async (cs) => Object.fromEntries(cs.map((c) => [c, `https://assinado.local/${c}`])));
const C = Object.fromEntries(nomes.map((n) => [n, cliente(P[n])]));
const anon = cliente(null);

// ═══════════════════ 3. Publicar ═══════════════════
const base = { publico: "seguidores", fundo: { tipo: "listras", cor: "vermelho" }, texto: "PLENÁRIA DO NÚCLEO LESTE", legenda: "Panfletagem no RU · amanhã, 11h", imagem: null, alt: null, post_ref: null };
const atos = await espera("a autora vê o próprio ato para a contagem", () => C.autora.atos(), (l) => l.length === 1 && l[0].id === ato && l[0].titulo === "PASSE LIVRE JÁ");
await espera("quem não organiza nem confirmou não vê o ato para a contagem", () => C.membro.atos(), (l) => l.length === 0);
await dono("insert into interno.rede_vou (post, usuario) values ($1, $2)", [atoDaOutra, P.membro]);
await espera("quem confirmou vê (sem número de ninguém)", () => C.membro.atos(), (l) => l.length === 1 && Object.keys(l[0]).sort().join() === "id,inicio,titulo");

const figs = [
  { tipo: "contagem", ato: atos?.[0]?.id, titulo: "inventado pelo pedido", inicio: "2020-01-01T00:00:00Z" },
  { tipo: "enquete", pergunta: "Vai ter ônibus?", opcoes: ["Sim", "Não"] },
  { tipo: "pergunta", texto: "O que não pode faltar?" },
];
const sSeg = await espera("publica para seguidores com contagem, enquete e pergunta", () => C.autora.publicar({ ...base, figurinhas: figs }), (r) => r.id && Math.abs(Date.parse(r.expira_em) - Date.now() - 24 * 3600_000) < 120_000);
const sMem = await espera("publica para membros (com link https)", () => C.autora.publicar({ ...base, publico: "membros", texto: "ATO HOJE", figurinhas: [{ tipo: "link", url: "https://exemplo.org/ato", rotulo: "Saiba mais" }] }), (r) => r.id);
await espera("publica para próximos", () => C.autora.publicar({ ...base, publico: "proximos", texto: "SÓ PRA QUEM É PERTO", figurinhas: [] }), (r) => r.id);

await recusa("CPF no texto é recusado", () => C.autora.publicar({ ...base, texto: "meu cpf 123.456.789-09", figurinhas: [] }), "dado_pessoal");
await recusa("telefone na pergunta é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "pergunta", texto: "liga (11) 98765-4321" }] }), "dado_pessoal");
await recusa("link sem https é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "link", url: "http://exemplo.org", rotulo: "x" }] }), "invalido:link");
await recusa("javascript: é recusado", () => C.autora.publicar({ ...base, figurinhas: [{ tipo: "link", url: "javascript:alert(1)", rotulo: "x" }] }), "invalido:link");
await recusa("4 figurinhas é recusado", () => C.autora.publicar({ ...base, figurinhas: [figs[2], figs[2], figs[2], figs[2]] }), "invalido:figurinhas");
await recusa("duas enquetes é recusado", () => C.autora.publicar({ ...base, figurinhas: [figs[1], figs[1]] }), "invalido:figurinhas");
await recusa("contagem de ato que não é meu nem confirmei é recusada", () => C.autora.publicar({ ...base, figurinhas: [{ ...figs[0], ato: atoDaOutra }] }), "invalido:contagem");
await recusa("story vazio é recusado", () => C.autora.publicar({ ...base, texto: "", legenda: null, figurinhas: [] }), "invalido:vazio");
await recusa("público inventado é recusado", () => C.autora.publicar({ ...base, publico: "internet", figurinhas: [] }), "invalido:publico");
await recusa("texto com mais de 140 é recusado", () => C.autora.publicar({ ...base, texto: "x".repeat(141), figurinhas: [] }), "invalido:texto");
await recusa("conta sem adesão (sem 18+ e consentimento) não publica", () => C.semconta.publicar({ ...base, figurinhas: [] }), "sem_permissao");
await recusa("visitante não publica (sem permissão na função)", () => rpc(visitante(), "rede_story_publicar", { p: { ...base, figurinhas: [] } }), "permission denied");
await recusa("fundo imagem sem imagem é recusado", () => C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, figurinhas: [] }), "invalido:imagem");

// ═══════════════════ 4. A matriz ═══════════════════
const quantos = async (c, handle = "autora_f5") => (await c.abrir(handle)).length;
await espera("seguidores: visitante 0, membro 0, seguidor 1+1, próximo 1+1+1, bloqueado 0, sem adesão 0, autora 3", async () => [
  await quantos(anon), await quantos(C.membro), await quantos(C.seguidor), await quantos(C.mutuo), await quantos(C.bloqueado), await quantos(C.semconta), await quantos(C.autora),
], (r) => r.join() === "0,1,2,3,0,0,3");
await espera("na visão de quem segue, os públicos certos (seguidores e membros, sem próximos)", async () => (await C.seguidor.abrir("autora_f5")).map((s) => s.publico).sort(), (l) => l.join() === "membros,seguidores");
await espera("a autora bloqueada também não vê o story de quem a bloqueou (nos dois sentidos)", async () => {
  await dono("insert into interno.rede_stories (autor, texto, publico, conferido) values ($1, 'do bloqueado', 'membros', true)", [P.bloqueado]);
  return C.autora.abrir("bloqueado_f5");
}, (l) => l.length === 0);
await espera("faixa: o seguidor vê a bolinha da autora com os ids certos", () => C.seguidor.faixa(), (f) => f.meus.length === 0 && f.grupos.length === 1 && f.grupos[0].autora.handle === "autora_f5" && f.grupos[0].ids.length === 2);
await espera("faixa: quem não segue não vê bolinha (o story para membros fica no perfil)", () => C.membro.faixa(), (f) => f.grupos.length === 0);
await espera("faixa: o bloqueado não vê", () => C.bloqueado.faixa(), (f) => f.grupos.length === 0);
await espera("faixa: visitante recebe vazia", () => anon.faixa(), (f) => f.meus.length === 0 && f.grupos.length === 0);
await espera("faixa: a autora vê os próprios ids", () => C.autora.faixa(), (f) => f.meus.length === 3);
await espera("a autora aparece com codinome e handle, nunca o nome civil nem e-mail", async () => (await C.seguidor.abrir("autora_f5"))[0].autora, (a) => a.nome === "Lutadora 1" && a.handle === "autora_f5" && !JSON.stringify(a).includes("@f5.local") && a.cor >= 1 && a.cor <= 5);
await recusa("abrir com handle fora do formato é recusado", () => C.seguidor.abrir("../x"), "invalido:handle");

// ═══════════════════ 5. Nada de "quem viu" ═══════════════════
await espera("nenhuma tabela ou coluna de visualização nos stories", () => todos(`
  select table_name, column_name from information_schema.columns where table_schema = 'interno' and table_name like 'rede_stor%'
    and (column_name ~* '(vist|visualiz|viu|view|seen|leitor|abriu)' or table_name ~* '(vist|visualiz|view|seen)')`), (l) => l.length === 0);
await espera("nenhum campo de visto no que a tela recebe", async () => JSON.stringify([await C.seguidor.abrir("autora_f5"), await C.autora.meus(), await C.seguidor.faixa()]), (t) => !/vist|visualiz|viu|views|seen/i.test(t));
const linhasAntes = await um("select (select count(*) from interno.rede_story_respostas) + (select count(*) from interno.rede_story_reacoes) + (select count(*) from interno.rede_story_votos) + (select count(*) from interno.limites where chave like 'rede5%' or chave like 'rede2%') as n");
await C.seguidor.abrir("autora_f5");
await C.seguidor.faixa();
await espera("abrir e ver a faixa não gravam nada (nem limite)", () => um("select (select count(*) from interno.rede_story_respostas) + (select count(*) from interno.rede_story_reacoes) + (select count(*) from interno.rede_story_votos) + (select count(*) from interno.limites where chave like 'rede5%' or chave like 'rede2%') as n"), (r) => r.n === linhasAntes.n);

// ═══════════════════ 6. Figurinhas ═══════════════════
const doSeg = async (c) => (await c.abrir("autora_f5")).find((s) => s.id === sSeg?.id);
await espera("a contagem traz o título e a hora DO ATO (não os do pedido)", async () => (await doSeg(C.seguidor)).figurinhas[0], (f) => f.tipo === "contagem" && f.ato === ato && f.titulo === "PASSE LIVRE JÁ" && !f.inicio.startsWith("2020") && f.avisar === false);
await espera("votar: devolve o meu voto e nenhuma soma", () => C.seguidor.votar(sSeg.id, 0), (f) => f.meu_voto === 0 && f.soma == null);
await espera("votar de novo não muda o voto", () => C.seguidor.votar(sSeg.id, 1), (f) => f.meu_voto === 0);
await espera("com 1 voto, a autora vê 'poucas pessoas' (soma nula)", async () => (await C.autora.meus()).find((s) => s.id === sSeg.id).figurinhas[1], (f) => f.soma == null && f.meu_voto == null);
await C.v1.votar(sSeg.id, 0);
await C.v2.votar(sSeg.id, 1);
await espera("com 3 votos, a autora vê a soma [2, 1]", async () => (await C.autora.meus()).find((s) => s.id === sSeg.id).figurinhas[1], (f) => JSON.stringify(f.soma) === "[2,1]");
await espera("quem votou continua sem ver a soma", async () => (await doSeg(C.v1)).figurinhas[1], (f) => f.soma == null && f.meu_voto === 0);
await recusa("a autora não vota na própria enquete", () => C.autora.votar(sSeg.id, 0), "sem_permissao");
await recusa("quem não vê o story não vota", () => C.membro.votar(sSeg.id, 0), "nao_encontrado");
await recusa("story sem enquete: votar dá nao_encontrado", () => C.seguidor.votar(sMem.id, 0), "nao_encontrado");
await espera("o voto não guarda hora", () => todos("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'rede_story_votos'"), (l) => l.map((x) => x.column_name).sort().join() === "opcao,quem,story");

await espera("me avise: liga o lembrete", () => C.seguidor.avisar(sSeg.id, true), (r) => r.avisar === true);
await espera("o seguidor vê a contagem marcada; o v1 não", async () => [(await doSeg(C.seguidor)).figurinhas[0].avisar, (await doSeg(C.v1)).figurinhas[0].avisar], (r) => r.join() === "true,false");
await espera("a autora não fica sabendo quem pediu (a figurinha dela não diz)", async () => (await C.autora.meus()).find((s) => s.id === sSeg.id).figurinhas[0], (f) => f.avisar === false && !("quem" in f) && !("total" in f));
await espera("desligar e ligar de novo", async () => [(await C.v1.avisar(sSeg.id, true)).avisar, (await C.v1.avisar(sSeg.id, false)).avisar], (r) => r.join() === "true,false");

// ═══════════════════ 7. Resposta e reação: só para a autora ═══════════════════
await espera("responder: ok", () => C.seguidor.responder(sSeg.id, "Força, tô dentro!"), (r) => r.ok);
await espera("a resposta chega SÓ à autora, num aviso dela", () => todos("select para, texto, ator from interno.avisos where texto like 'Resposta ao seu story%'"), (l) => l.length === 1 && l[0].para === P.autora && l[0].texto.includes("Força, tô dentro!") && l[0].ator === P.seguidor);
await espera("a autora lê pela lista de avisos dela", () => rpc(como(P.autora), "rede_aviso_listar", {}), (r) => r.itens.some((i) => (i.texto ?? "").includes("Força, tô dentro!")));
await espera("o aviso não aparece para mais ninguém", () => rpc(como(P.v1), "rede_aviso_listar", {}), (r) => !JSON.stringify(r).includes("Força"));
await recusa("a autora não responde a si mesma", () => C.autora.responder(sSeg.id, "oi"), "sem_permissao");
await recusa("quem não vê não responde", () => C.membro.responder(sSeg.id, "oi"), "nao_encontrado");
await recusa("o bloqueado não responde", () => C.bloqueado.responder(sSeg.id, "oi"), "nao_encontrado");
await recusa("resposta vazia é recusada", () => C.seguidor.responder(sSeg.id, "   "), "invalido:texto");
await espera("reagir: ok", () => C.v1.reagir(sSeg.id, "punho"), (r) => r.ok);
await espera("reagir de novo troca a reação, sem somar avisos", async () => {
  await C.v1.reagir(sSeg.id, "chama");
  return todos("select texto, ator from interno.avisos where para = $1 and texto like 'Alguém reagiu%'", [P.autora]);
}, (l) => l.length === 1 && l[0].texto.includes("chama") && l[0].ator === null);
await recusa("reação fora do conjunto fechado é recusada", () => C.v1.reagir(sSeg.id, "💩"), "invalido:reacao");

// ═══════════════════ 8. O depósito ═══════════════════
const comoNoBanco = async (sub, sql, valores = []) => banco.exclusivo(async () => {
  await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub })]);
  await banco.pg.exec("set role authenticated");
  try {
    return (await banco.pg.query(sql, valores)).rows;
  } finally {
    await banco.pg.exec("reset role");
  }
});
const caminho = `${P.autora}/0123456789abcdef0123456789abcdef.webp`;
const meta = JSON.stringify({ size: 120000, mimetype: "image/webp" });
await espera("a autora envia para a própria pasta", () => comoNoBanco(P.autora, "insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2) returning name", [caminho, meta]), (l) => l.length === 1);
await recusa("ninguém envia para a pasta de outra pessoa", () => comoNoBanco(P.seguidor, "insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2)", [`${P.autora}/ffffffffffffffffffffffffffffffff.webp`, meta]), "row-level security");
await recusa("conta sem adesão não envia nem para a própria pasta", () => comoNoBanco(P.semconta, "insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2)", [`${P.semconta}/ffffffffffffffffffffffffffffffff.webp`, meta]), "row-level security");
await recusa("imagem que não foi enviada é recusada", () => C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: `${P.autora}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp`, figurinhas: [] }), "invalido:imagem");
await recusa("imagem da pasta de outra pessoa é recusada", () => C.seguidor.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: caminho, figurinhas: [] }), "invalido:imagem");
const sImg = await espera("publica com a imagem enviada", () => C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: caminho, alt: "Faixa na praça", figurinhas: [] }), (r) => r.id);
await recusa("a mesma imagem não serve a dois stories", () => C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: caminho, figurinhas: [] }), "invalido:imagem");
await espera("quem vê recebe o endereço assinado no lugar do caminho", async () => (await C.seguidor.abrir("autora_f5")).find((s) => s.id === sImg.id).fundo, (f) => f.tipo === "imagem" && f.url === `https://assinado.local/${caminho}` && f.alt === "Faixa na praça");
await espera("leitura do depósito: o seguidor lê, o membro de fora, o bloqueado e a conta sem adesão não", async () => [
  (await comoNoBanco(P.seguidor, "select name from storage.objects where bucket_id = 'rede-stories'")).length,
  (await comoNoBanco(P.membro, "select name from storage.objects where bucket_id = 'rede-stories'")).length,
  (await comoNoBanco(P.bloqueado, "select name from storage.objects where bucket_id = 'rede-stories'")).length,
  (await comoNoBanco(P.semconta, "select name from storage.objects where bucket_id = 'rede-stories'")).length,
  (await comoNoBanco(P.autora, "select name from storage.objects where bucket_id = 'rede-stories'")).length,
], (r) => r.join() === "1,0,0,0,1");
await espera("visitante não tem regra de leitura no depósito", () => um("select count(*)::int as n from pg_policies where tablename = 'objects' and policyname like 'rede_stories%' and 'anon' = any (roles)"), (r) => r.n === 0);
await espera("a imagem nasce sem conferir; o texto nasce conferido", () => todos("select fundo, conferido from interno.rede_stories where autor = $1 order by criado_em", [P.autora]), (l) => l.every((x) => x.conferido === (x.fundo !== "imagem")));

// ═══════════════════ 9. Denúncia retém ═══════════════════
const den = await espera("o membro denuncia o story para membros por exposição: retido na hora, com protocolo", () => C.membro.denunciar(sMem.id, "exposicao", "mostra o endereço de alguém"), (r) => /^[0-9A-F]{10}$/.test(r.protocolo));
await espera("de novo devolve o mesmo protocolo", () => C.membro.denunciar(sMem.id, "exposicao"), (r) => r.protocolo === den?.protocolo);
await espera("retido: some para todos, a autora ainda vê", async () => [await quantos(C.membro), (await C.seguidor.abrir("autora_f5")).some((s) => s.id === sMem.id), (await C.autora.meus()).some((s) => s.id === sMem.id)], (r) => r.join() === "0,false,true");
await espera("a retenção fica no registro de moderação (sem quem denunciou)", () => um("select acao, quem from interno.rede_moderacao where alvo_tipo = 'story' and alvo = $1", [sMem.id]), (r) => r?.acao === "reter" && r.quem === null);
await espera("a denúncia guarda o alvo 'story'", () => um("select alvo_tipo, prioridade from interno.rede_denuncias where protocolo = $1", [den.protocolo]), (r) => r.alvo_tipo === "story" && r.prioridade === 1);
await recusa("a autora não denuncia o próprio story", () => C.autora.denunciar(sSeg.id, "spam"), "sem_permissao");
await espera("spam não retém", () => C.v1.denunciar(sSeg.id, "spam"), (r) => r.retido === false);
await espera("mas guarda o story enquanto a denúncia está aberta (a moderação precisa ler)", () => um("select interno.rede5_story_em_prova($1) as p", [sSeg.id]), (x) => x.p === true);
await dono("update interno.rede_denuncias set situacao = 'descartada' where alvo_tipo = 'story' and alvo = $1", [sSeg.id]);

// ═══════════════════ 10. Some em 24 h e a faxina ═══════════════════
await recusa("ninguém publica com mais de 24 h", () => dono("insert into interno.rede_stories (autor, texto, conferido, expira_em) values ($1, 'x', true, now() + interval '25 hours')", [P.autora]), "rede_stories_24h");
await dono("update interno.rede_stories set expira_em = now() - interval '1 minute' where id = any ($1)", [[sSeg.id, sMem.id, sImg.id]]);
await espera("vencido: some na hora para quem segue e para a autora", async () => [await quantos(C.seguidor), (await C.autora.meus()).length], (r) => r.join() === "0,1");
await recusa("vencido: responder dá nao_encontrado", () => C.seguidor.responder(sSeg.id, "oi"), "nao_encontrado");
await recusa("vencido: a regra do depósito também fecha", async () => {
  const l = await comoNoBanco(P.seguidor, "select name from storage.objects where bucket_id = 'rede-stories'");
  if (l.length === 0) throw new Error("fechado");
  return l;
}, "fechado");
await recusa("faxina: visitante não chama", () => rpc(visitante(), "rede_story_faxina_lista", {}), "permission denied");
await recusa("faxina: quem tem conta não chama", () => rpc(como(P.autora), "rede_story_faxina_lista", {}), "permission denied");
await espera("a rodada do banco apaga o vencido sem arquivo e mantém o que está em prova", async () => {
  const r = (await um("select interno.rede5_story_faxina() as r")).r;
  const ficam = (await todos("select id from interno.rede_stories where id = any ($1)", [[sSeg.id, sMem.id, sImg.id]])).map((x) => x.id);
  return { r, ficam };
}, ({ r, ficam }) => r.apagados >= 1 && r.chamou === false && !ficam.includes(sSeg.id) && ficam.includes(sMem.id) && ficam.includes(sImg.id));
await espera("com o story, saem a resposta, o aviso dela, a reação, os votos e as figurinhas", () => um(`select (select count(*) from interno.rede_story_respostas)::int + (select count(*) from interno.rede_story_reacoes)::int
  + (select count(*) from interno.rede_story_votos)::int + (select count(*) from interno.rede_story_figurinhas where story = $1)::int
  + (select count(*) from interno.avisos where texto like 'Resposta ao seu story%' or texto like 'Alguém reagiu%')::int as n`, [sSeg.id]), (r) => r.n === 0);

// O órfão (envio abandonado há mais de 1 hora) e uma imagem nova com EXIF para conferir.
const orfao = `${P.autora}/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp`;
await dono("insert into storage.objects (bucket_id, name, metadata, created_at) values ('rede-stories', $1, $2, now() - interval '2 hours')", [orfao, meta]);
const comExif = `${P.autora}/cccccccccccccccccccccccccccccccc.jpg`;
await dono("insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2)", [comExif, JSON.stringify({ size: 2000, mimetype: "image/jpeg" })]);
const sExif = await C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: comExif, figurinhas: [] });
const falso = `${P.autora}/dddddddddddddddddddddddddddddddd.png`;
await dono("insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2)", [falso, JSON.stringify({ size: 20, mimetype: "image/png" })]);
const sFalso = await C.autora.publicar({ ...base, fundo: { tipo: "imagem", cor: "azul" }, imagem: falso, figurinhas: [] });

const removidos = [];
const subidos = [];
const r = await espera("a Edge Function: confere, limpa, apaga arquivos e depois as linhas", () => rodada({
  chamar: (f, a) => rpc(servico, f, a),
  baixar: async (c) => (c === comExif ? globalThis.__jpeg : Uint8Array.from(Buffer.from("<html>não é png</html>"))),
  subir: async (c, bytes, tipo) => subidos.push([c, bytes, tipo]),
  remover: async (cs) => removidos.push(...cs),
}), (x) => x.conferidos === 1 && x.limpos === 1 && x.ruins === 1 && x.apagados === 1 && x.orfaos === 1);
ok("o JPEG com EXIF subiu de novo, limpo", subidos.length === 1 && subidos[0][0] === comExif && subidos[0][2] === "image/jpeg" && !Buffer.from(subidos[0][1]).toString("latin1").includes("GPS"));
ok("o arquivo do story vencido e o órfão saíram do depósito; o da prova ficou", removidos.includes(caminho) && removidos.includes(orfao) && !removidos.includes(falso) && r !== undefined);
await espera("a linha do vencido saiu; a da prova ficou; a conferida ficou conferida; a falsa saiu do ar", async () => ({
  img: (await todos("select 1 from interno.rede_stories where id = $1", [sImg.id])).length,
  prova: (await todos("select 1 from interno.rede_stories where id = $1", [sMem.id])).length,
  exif: (await um("select conferido from interno.rede_stories where id = $1", [sExif.id])).conferido,
  falso: (await um("select expira_em <= now() as fora from interno.rede_stories where id = $1", [sFalso.id])).fora,
}), (x) => x.img === 0 && x.prova === 1 && x.exif === true && x.falso === true);
await espera("decidida a denúncia, a prova sai na próxima rodada", async () => {
  await dono("update interno.rede_denuncias set situacao = 'resolvida' where alvo_tipo = 'story' and alvo = $1", [sMem.id]);
  await um("select interno.rede5_story_faxina() as r");
  return todos("select 1 from interno.rede_stories where id = $1", [sMem.id]);
}, (l) => l.length === 0);

// ═══════════════════ 11. Lembrete do ato ═══════════════════
await espera("o lembrete vira aviso quando o ato está a menos de 1 hora, e sai", async () => {
  await dono("update interno.rede_chamados set inicio = now() + interval '30 minutes' where post = $1", [ato]);
  const n = (await um("select interno.rede5_story_lembretes() as n")).n;
  // Pedido como 'chamado'; com a B1 da comunidade (20261110-alumia-b1-comunidade.sql) o aviso de ato fica gravado como 'ato'.
  const avisos = await todos("select para, tipo, post from interno.avisos where tipo = 'ato' and post = $1", [ato]);
  const sobrou = await todos("select 1 from interno.rede_story_lembretes where ato = $1", [ato]);
  return { n, avisos, sobrou };
}, ({ n, avisos, sobrou }) => n === 1 && avisos.length === 1 && avisos[0].para === P.seguidor && sobrou.length === 0);

// ═══════════════════ 12. Apagar ═══════════════════
const sApagar = await C.autora.publicar({ ...base, figurinhas: [] });
await C.seguidor.responder(sApagar.id, "vou levar faixa");
await recusa("outra pessoa não apaga o story da autora", () => C.seguidor.apagar(sApagar.id), "nao_encontrado");
await espera("a autora apaga: some na hora, com a resposta e o aviso", async () => {
  await C.autora.apagar(sApagar.id);
  return um("select (select count(*) from interno.rede_stories where id = $1)::int + (select count(*) from interno.avisos where texto like '%vou levar faixa%')::int as n", [sApagar.id]);
}, (x) => x.n === 0);

// ═══════════════════ 13. Permissões, trava do painel e limites ═══════════════════
for (const t of ["rede_stories", "rede_story_figurinhas", "rede_story_respostas", "rede_story_reacoes", "rede_story_votos", "rede_story_lembretes"]) {
  await recusa(`ninguém de fora lê interno.${t}`, () => comoNoBanco(P.autora, `select * from interno.${t}`), "permission denied");
}
await espera("RLS ligada em todas as tabelas novas", () => todos("select relname from pg_class where relnamespace = 'interno'::regnamespace and relname like 'rede_stor%' and relkind = 'r' and not relrowsecurity"), (l) => l.length === 0);
await espera("toda função nova é security definer com search_path = interno, pg_temp", () => todos(`select p.proname from pg_proc p where (p.proname like 'rede_story%' or p.proname like 'rede5_story%')
  and p.proname <> 'rede5_story_tirar_aviso' and p.proname <> 'rede5_story_pos' /* pura (immutable), só arruma o lugar da figurinha */ and not (p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=interno, pg_temp%')`), (l) => l.length === 0);
await espera("visitante só executa a faixa e abrir", () => todos(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'rede_story%'
  and has_function_privilege('anon', p.oid, 'execute') order by 1`), (l) => l.map((x) => x.proname).join() === "rede_story_abrir,rede_story_faixa");
await espera("o cliente da tela chama só funções que existem, com os parâmetros certos", async () => {
  const chamadas = [];
  const c = criarClienteDeStories(async (f, a) => (chamadas.push([f, Object.keys(a ?? {})]), []), async () => "", async () => ({}));
  const id = "00000000-0000-0000-0000-000000000000";
  await Promise.all([c.faixa(), c.abrir("x_y"), c.meus(), c.publicar({}), c.apagar(id), c.responder(id, "t"), c.reagir(id, "punho"), c.votar(id, 0), c.avisar(id, true), c.atos(), c.denunciar(id, "spam", "")]);
  const faltam = [];
  for (const [f, args] of chamadas) {
    const p = await um("select proargnames from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]);
    if (!p || args.some((a) => !(p.proargnames ?? []).includes(a))) faltam.push(f);
  }
  return faltam;
}, (l) => l.length === 0);

await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-stories', false)");
await recusa("desligado no painel: publicar recusa", () => C.autora.publicar({ ...base, figurinhas: [] }), "recurso_desligado");
await recusa("desligado no painel: a faixa também", () => C.seguidor.faixa(), "recurso_desligado");
await espera("desligado no painel: o envio ao depósito fecha", () => comoNoBanco(P.autora, "select public.rede_story_pode_enviar() as p"), (l) => l[0].p === false);
await dono("delete from interno.recursos_vivos where nome = 'alumia-stories'");
await dono("insert into interno.limites_config (acao, maximo, minutos) values ('rede5_story_publicar', 1, 1440) on conflict (acao) do update set maximo = 1");
await recusa("passou do limite de stories do dia", () => C.autora.publicar({ ...base, figurinhas: [] }), "muitos_pedidos");

await banco.pg.close?.();
console.log(`Alumia (F5, back-end dos stories): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
