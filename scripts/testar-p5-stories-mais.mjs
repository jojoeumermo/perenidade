// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, A16, o resto dos stories (supabase/migracoes/20261126-p5-stories-mais.sql), num Postgres de verdade (scripts/banco-local.mjs):
//   · ANTES da migração (o banco montado só até ela): o teste com resposta certa, a contagem livre e a versão menor da foto não
//     existem (prova de que os testes de baixo falhariam sem ela);
//   · a foto em alta com a versão menor: a menor tem a MESMA regra de leitura da alta (antes de conferida, só a autora; quem não vê
//     o story nunca), não serve para vídeo nem é reaproveitada, sai ao trocar a foto, vira capa do destaque e entra na faxina com o
//     mesmo id (conferir e apagar), e o arquivo que nenhum story cita sai como órfão;
//   · o teste com resposta certa: quem vê não recebe a certa antes de responder; a resposta só pela chave de serviço; a urna não
//     tem pessoa; responder de novo não muda nada; a autora não responde; a soma só para a autora e só a partir de 3;
//   · a contagem livre: nome e hora da autora, de 1 minuto a 1 ano à frente, sem "me avise";
//   · a conferência logo depois de publicar confere as duas versões (dublês do depósito);
//   · o servidor do voto e o cliente levam a resposta do teste pelo mesmo caminho da enquete.
// Uso: npm run testar:p5-stories-mais
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { conferirStory } from "../lib/rede/stories/conferir-servidor.ts";
import { comEnderecos } from "../lib/rede/cliente-stories.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 500)}`);
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
const SQL = normal(ler("supabase/migracoes/20261126-p5-stories-mais.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração está no fim do install.sql (seguida só de migrações datadas)", noFimDoInstall(SQL));
ok("não mexe na versão nem na lista de exceções", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(semComentario));
ok("não grava pessoa junto da resposta do teste (as tabelas novas não têm coluna de pessoa)",
  !/rede_story_teste_(marcas|urna) \([^;]*\b(quem|usuario|autor)\b/.test(semComentario));

// Um depósito mínimo (o PGlite não tem o Storage): a função de publicar confere tipo e tamanho por ele.
const DEPOSITO = `
  create schema if not exists storage;
  create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text,
    created_at timestamptz not null default now(), metadata jsonb, unique (bucket_id, name));
`;

const P = {};
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2" });
async function prepararPessoas(banco, sufixo) {
  const { dono, criarUsuario, rpc } = banco;
  const nomes = ["autora", "segue", "estranha", "r1", "r2", "r3"];
  const ids = {};
  for (const nome of nomes) {
    ids[nome] = await criarUsuario(`${nome}${sufixo}@sm.local`, nome);
    await rpc(como(ids[nome]), "eu");
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
      [ids[nome], `Codinome ${nome}`, `${nome}_${sufixo}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [ids[nome]]);
  }
  await dono("update auth.users set created_at = now() - interval '30 days'");
  for (const nome of ["segue", "r1", "r2", "r3"]) await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2)", [ids[nome], ids.autora]);
  return ids;
}
const pedido = (extra = {}) => ({ publico: "seguidores", fundo: { tipo: "listras", cor: "azul" }, texto: "TESTE", legenda: null, imagem: null, alt: null, post_ref: null, figurinhas: [], ...extra });
const teste = (extra = {}) => ({ tipo: "teste", pergunta: "Em que ano foi a greve geral de 1917?", opcoes: ["1917", "1922", "1930"], certa: 0, ...extra });

// ═══════════════════ 1. ANTES: nada disto existia ═══════════════════
{
  const antes = await criarBanco({ antesDe: ler("supabase/migracoes/20261126-p5-stories-mais.sql") });
  const A = await prepararPessoas(antes, "a");
  await recusa("antes: o teste com resposta certa é recusado", () => antes.rpc(como(A.autora), "rede_story_publicar", { p: pedido({ figurinhas: [teste()] }) }), "invalido:figurinha");
  await recusa("antes: a contagem livre (sem ato) é recusada", () => antes.rpc(como(A.autora), "rede_story_publicar",
    { p: pedido({ figurinhas: [{ tipo: "contagem", livre: true, titulo: "Plenária", inicio: new Date(Date.now() + 86_400_000).toISOString() }] }) }), "invalido:contagem");
  const col = (await antes.dono("select count(*)::integer n from information_schema.columns where table_schema = 'interno' and table_name = 'rede_stories' and column_name = 'midia_menor'")).rows[0];
  ok("antes: não havia a versão menor da foto", col.n === 0);
  await antes.pg.close?.();
}

// ═══════════════════ 2. DEPOIS ═══════════════════
const banco = await criarBanco();
const { dono, rpc } = banco;
const um = async (s, v = []) => (await dono(s, v)).rows[0];
await espera("o depósito mínimo do teste", () => banco.exclusivo(() => banco.pg.exec(DEPOSITO)));
await espera("roda de novo por cima (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await espera("a porta continua trancada em tudo", () => um("select interno.alumia_trancar() as r"), (x) => x.r.abertas.length === 0);
Object.assign(P, await prepararPessoas(banco, "d"));
const subir = (sub, ext, mime, size) => {
  const nome = `${sub}/${randomUUID()}.${ext}`;
  return dono("insert into storage.objects (bucket_id, name, metadata) values ('rede-stories', $1, $2)", [nome, JSON.stringify({ size, mimetype: mime })]).then(() => nome);
};
const publicar = (sub, p) => rpc(como(sub), "rede_story_publicar", { p });
const abrir = async (sub, id) => (await rpc(como(sub), "rede_story_abrir", { p_handle: "autora_d" })).find((s) => s.id === id);

// ── 2.1 A foto em alta e a versão menor ──
{
  const alta = await subir(P.autora, "webp", "image/webp", 5_000_000);
  const menor = await subir(P.autora, "webp", "image/webp", 90_000);
  const s = await espera("publica a foto em alta (5 MB, acima dos 3 MB de antes) com a versão menor", () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: alta, menor })), (r) => r.id);
  const id = s?.id;
  await espera("a autora recebe as duas no story", () => abrir(P.autora, id), (x) => x?.fundo?.caminho === alta && x?.fundo?.menor === menor);
  await espera("ANTES de conferir: quem segue não abre a menor", () => rpc(como(P.segue), "rede_story_pode", { p_caminho: menor }), (r) => r === false);
  await espera("a autora abre a menor na hora", () => rpc(como(P.autora), "rede_story_pode", { p_caminho: menor }), (r) => r === true);
  await espera("o pedido de conferência devolve as duas", () => rpc(como(P.autora), "rede_story_conferir_pedir", { p_id: id }), (r) => r.caminho === alta && r.menor === menor);
  const lista = await espera("a faxina recebe a menor como mais uma linha com o mesmo id", () => rpc({ papel: "service_role" }, "rede_story_faxina_lista", { p_limite: 50 }),
    (l) => l.conferir.filter((x) => x.id === id).map((x) => x.caminho).sort().join() === [alta, menor].sort().join());
  ok("nenhuma das duas é órfã", !(lista?.orfaos ?? []).includes(menor));
  await espera("marcada como conferida pela chave de serviço", () => rpc({ papel: "service_role" }, "rede_story_faxina_feito", { p_apagados: [], p_conferidos: [id], p_ruins: [] }), (r) => r.conferidos === 1);
  await espera("DEPOIS: quem segue abre a menor e a alta", async () => [await rpc(como(P.segue), "rede_story_pode", { p_caminho: menor }), await rpc(como(P.segue), "rede_story_pode", { p_caminho: alta })], (r) => r[0] === true && r[1] === true);
  await espera("quem não segue não abre nenhuma das duas", async () => [await rpc(como(P.estranha), "rede_story_pode", { p_caminho: menor }), await rpc(como(P.estranha), "rede_story_pode", { p_caminho: alta })], (r) => r[0] === false && r[1] === false);

  // A capa do destaque é a menor.
  const d = await espera("guarda o story num destaque", () => rpc(como(P.autora), "rede_story_destaque_salvar", { p_destaque: null, p_titulo: "Greve", p_story: id, p_cor: null }), (r) => r.id);
  await espera("a capa do destaque usa a versão menor", () => rpc(como(P.segue), "rede_story_destaques", { p_handle: "autora_d" }), (l) => l.find((x) => x.id === d?.id)?.capa?.caminho === menor);

  // Recusas.
  const outra = await subir(P.autora, "webp", "image/webp", 80_000);
  await recusa("a menor não pode ser a mesma da alta", () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: outra, menor: outra })), "invalido:imagem");
  await recusa("a menor não é reaproveitada de outro story", async () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: await subir(P.autora, "webp", "image/webp", 1000), menor })), "invalido:imagem");
  await recusa("a menor não vem da pasta de outra pessoa", async () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: await subir(P.autora, "webp", "image/webp", 1000), menor: await subir(P.segue, "webp", "image/webp", 1000) })), "invalido:imagem");
  await recusa("a menor acima de 512 KB é recusada", async () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: await subir(P.autora, "webp", "image/webp", 1000), menor: await subir(P.autora, "webp", "image/webp", 700_000) })), "invalido:imagem");
  await recusa("a alta acima de 6 MB é recusada", async () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: await subir(P.autora, "webp", "image/webp", 7_000_000) })), "invalido:imagem");
  await recusa("vídeo não leva versão menor", async () => publicar(P.autora, pedido({ fundo: { tipo: "video", cor: "azul" }, imagem: await subir(P.autora, "mp4", "video/mp4", 1000), video: { duracao_ms: 3000, som: false }, menor: await subir(P.autora, "webp", "image/webp", 1000) })), "invalido:imagem");
  await espera("foto sem versão menor continua valendo (o aparelho antigo)", async () => publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: await subir(P.autora, "webp", "image/webp", 1000) })), (r) => r.id);

  // Trocar a foto (borrar de novo): a menor de antes sai e ninguém a abre mais.
  const nova = await subir(P.autora, "webp", "image/webp", 2_000_000);
  await espera("trocar a foto tira a versão menor", () => rpc(como(P.autora), "rede_story_trocar_midia", { p_story: id, p_caminho: nova }), (r) => r.ok);
  await espera("a menor de antes não abre mais para ninguém (nem para quem segue)", () => rpc(como(P.segue), "rede_story_pode", { p_caminho: menor }), (r) => r === false);
  await espera("e a linha não tem mais a menor", () => um("select midia_menor from interno.rede_stories where id = $1", [id]), (r) => r.midia_menor === null);
  await dono("update storage.objects set created_at = now() - interval '2 hours' where name = $1", [menor]);
  await espera("o arquivo da menor de antes sai como órfão na faxina", () => rpc({ papel: "service_role" }, "rede_story_faxina_lista", { p_limite: 200 }), (l) => l.orfaos.includes(menor));

  // Vencido: a faxina apaga as duas (o story sai do destaque antes).
  const alta2 = await subir(P.autora, "webp", "image/webp", 1000);
  const menor2 = await subir(P.autora, "webp", "image/webp", 1000);
  const s2 = await publicar(P.autora, pedido({ fundo: { tipo: "imagem", cor: "azul" }, imagem: alta2, menor: menor2 }));
  await dono("update interno.rede_stories set expira_em = now() - interval '1 minute', criado_em = now() - interval '2 hours' where id = $1", [s2.id]);
  await espera("vencido, a faxina recebe as duas para apagar com o mesmo id", () => rpc({ papel: "service_role" }, "rede_story_faxina_lista", { p_limite: 200 }),
    (l) => l.apagar.filter((x) => x.id === s2.id).map((x) => x.caminho).sort().join() === [alta2, menor2].sort().join());
  await espera("o envio comporta a foto em dois arquivos (60 por dia)", () => um("select pg_get_functiondef('public.rede_story_pode_enviar()'::regprocedure) d"), (r) => /v_n < 60/.test(r.d));
}

// ── 2.2 O teste com resposta certa ──
{
  await recusa("uma opção só", () => publicar(P.autora, pedido({ figurinhas: [teste({ opcoes: ["1917"] })] })), "invalido:teste");
  await recusa("cinco opções", () => publicar(P.autora, pedido({ figurinhas: [teste({ opcoes: ["a", "b", "c", "d", "e"] })] })), "invalido:teste");
  await recusa("a certa fora das opções", () => publicar(P.autora, pedido({ figurinhas: [teste({ certa: 3 })] })), "invalido:teste");
  await recusa("sem a certa", () => publicar(P.autora, pedido({ figurinhas: [teste({ certa: null })] })), "invalido:teste");
  await recusa("opções repetidas", () => publicar(P.autora, pedido({ figurinhas: [teste({ opcoes: ["Sim", "sim"] })] })), "invalido:opcao");
  await recusa("dois testes no mesmo story", () => publicar(P.autora, pedido({ figurinhas: [teste(), teste({ pergunta: "Outra?" })] })), "invalido:figurinhas");
  await recusa("dado pessoal na opção é barrado", () => publicar(P.autora, pedido({ figurinhas: [teste({ opcoes: ["123.456.789-09", "não"] })] })), "dado_pessoal");
  const s = await espera("publica o teste", () => publicar(P.autora, pedido({ figurinhas: [teste({ certa: 1, opcoes: ["1907", "1917", "1932"], pos: { x: 0.5, y: 0.6, giro: 0, escala: 1 } })] })), (r) => r.id);
  const id = s?.id;
  const visto = await espera("quem vê recebe a pergunta e as opções, SEM a certa", () => abrir(P.segue, id), (x) => {
    const f = x?.figurinhas?.[0];
    return f?.tipo === "teste" && f.opcoes.length === 3 && !("certa" in f) && !("soma" in f) && f.pos?.y === 0.6;
  });
  ok("…e nada no story diz a certa", !JSON.stringify(visto ?? {}).includes('"certa"'));
  await espera("a autora vê a certa e nenhuma soma (menos de 3)", () => abrir(P.autora, id), (x) => x?.figurinhas?.[0]?.certa === 1 && x.figurinhas[0].soma === null);
  await recusa("responder direto pelo banco não vale (vai pelo servidor)", () => rpc(como(P.segue), "rede_story_testar", { p_id: id, p_opcao: 1 }), "voto_pelo_servidor");
  await recusa("a função do servidor não abre para quem tem sessão", () => rpc(como(P.segue), "alumia_teste_story", { p_usuario: P.segue, p_story: id, p_opcao: 1, p_marca: "a".repeat(64) }), "permission denied");
  const servico = (quem, opcao, marca) => rpc({ papel: "service_role" }, "alumia_teste_story", { p_usuario: quem, p_story: id, p_opcao: opcao, p_marca: marca });
  const marca = (n) => n.toString(16).padStart(64, "0");
  await espera("quem segue responde e fica sabendo que errou e qual era a certa", () => servico(P.r1, 0, marca(1)), (r) => r.certa === 1 && r.minha === 0 && r.acertou === false);
  await espera("responder de novo não muda nada e não diz o que respondeu antes", () => servico(P.r1, 2, marca(1)), (r) => r.ja_respondeu === true && r.certa === 1 && !("minha" in r));
  await recusa("a autora não responde o próprio teste", () => servico(P.autora, 1, marca(9)), "sem_permissao");
  await recusa("quem não vê o story não responde", () => servico(P.estranha, 1, marca(8)), "nao_encontrado");
  await recusa("opção que não existe", () => servico(P.r2, 3, marca(2)), "invalido:opcao");
  await recusa("marca fora do formato", () => servico(P.r2, 1, "x"), "invalido:marca");
  await espera("a segunda pessoa acerta", () => servico(P.r2, 1, marca(2)), (r) => r.acertou === true);
  await espera("com 2 respostas a autora ainda não vê soma", () => abrir(P.autora, id), (x) => x?.figurinhas?.[0]?.soma === null);
  await espera("a terceira pessoa responde", () => servico(P.r3, 1, marca(3)), (r) => r.acertou === true);
  await espera("com 3 respostas a autora vê a soma por opção (nunca quem)", () => abrir(P.autora, id), (x) => JSON.stringify(x?.figurinhas?.[0]?.soma) === "[1,2,0]");
  await espera("quem vê continua sem a soma e sem a certa", () => abrir(P.r3, id), (x) => !("soma" in x.figurinhas[0]) && !("certa" in x.figurinhas[0]));
  await espera("a urna guarda só a opção (3 linhas, sem pessoa) e as marcas são só hash", async () => [
    (await dono("select count(*)::integer n from interno.rede_story_teste_urna where story = $1", [id])).rows[0].n,
    (await dono("select string_agg(column_name, ',' order by column_name) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_story_teste_urna'")).rows[0].c,
    (await dono("select string_agg(column_name, ',' order by column_name) c from information_schema.columns where table_schema = 'interno' and table_name = 'rede_story_teste_marcas'")).rows[0].c,
  ], (r) => r[0] === 3 && r[1] === "opcao,story" && r[2] === "marca,story");
  await espera("as tabelas novas têm RLS e nenhuma permissão direta", () => dono(`select c.relrowsecurity r, has_table_privilege('authenticated', c.oid, 'select') s from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'interno' and c.relname in ('rede_story_teste_marcas', 'rede_story_teste_urna')`), (x) => x.rows.length === 2 && x.rows.every((l) => l.r && !l.s));
  await espera("apagar o story leva as respostas junto", async () => {
    await rpc(como(P.autora), "rede_story_apagar", { p_id: id });
    return (await dono("select (select count(*) from interno.rede_story_teste_urna where story = $1) + (select count(*) from interno.rede_story_teste_marcas where story = $1) n", [id])).rows[0].n;
  }, (n) => Number(n) === 0);
}

// ── 2.3 A contagem livre ──
{
  const daqui = (ms) => new Date(Date.now() + ms).toISOString();
  const livre = (extra = {}) => ({ tipo: "contagem", livre: true, titulo: "Plenária da greve", inicio: daqui(3 * 86_400_000), ...extra });
  const s = await espera("publica a contagem livre", () => publicar(P.autora, pedido({ figurinhas: [livre()] })), (r) => r.id);
  await espera("quem vê recebe nome, hora, livre e nenhum ato", () => abrir(P.segue, s?.id), (x) => {
    const f = x?.figurinhas?.[0];
    return f?.tipo === "contagem" && f.livre === true && f.ato === null && f.titulo === "Plenária da greve" && f.avisar === false;
  });
  await recusa("sem \"me avise\" na contagem livre", () => rpc(como(P.segue), "rede_story_avisar", { p_id: s?.id, p_sim: true }), "nao_encontrado");
  await recusa("hora que já passou", () => publicar(P.autora, pedido({ figurinhas: [livre({ inicio: daqui(-60_000) })] })), "invalido:contagem");
  await recusa("mais de um ano à frente", () => publicar(P.autora, pedido({ figurinhas: [livre({ inicio: daqui(400 * 86_400_000) })] })), "invalido:contagem");
  await recusa("sem nome", () => publicar(P.autora, pedido({ figurinhas: [livre({ titulo: "  " })] })), "invalido:contagem");
  await recusa("sem a marca de livre, continua exigindo o ato", () => publicar(P.autora, pedido({ figurinhas: [livre({ livre: undefined })] })), "invalido:contagem");
}

// ═══════════════════ 3. A conferência logo depois de publicar, com as duas versões (dublês) ═══════════════════
{
  const exif = new TextEncoder().encode("Exif\0\0GPS-23.55,-46.63");
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, exif.length + 2, ...exif, 0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
  const u = randomUUID();
  const alta = `${u}/${randomUUID()}.jpg`;
  const menor = `${u}/${randomUUID()}.jpg`;
  const subidos = [];
  const marcas = [];
  const formas = (o = {}) => ({
    pedir: async () => ({ ok: true, caminho: alta, menor: o.semMenor ? null : menor }),
    baixar: async (c) => (c === menor && o.menorRuim ? new TextEncoder().encode("não sou imagem") : jpeg),
    subir: async (c) => { subidos.push(c); },
    marcar: async (id, r) => { marcas.push([id, r]); },
  });
  const r1 = await conferirStory("t", "id-1", formas());
  ok("confere as duas versões e marca uma vez", r1 === "conferido" && subidos.includes(alta) && subidos.includes(menor) && marcas.length === 1);
  const r2 = await conferirStory("t", "id-2", formas({ menorRuim: true }));
  ok("se a menor não é imagem, o story sai do ar (ruim)", r2 === "ruim" && marcas.at(-1)[1] === "ruim");
  subidos.length = 0;
  const r3 = await conferirStory("t", "id-3", formas({ semMenor: true }));
  ok("sem versão menor, confere só a alta (como antes)", r3 === "conferido" && subidos.length === 1 && subidos[0] === alta);
}

// ═══════════════════ 4. O servidor do voto, o cliente e os endereços ═══════════════════
{
  const rota = ler("app/api/alumia/voto/marca/route.ts");
  ok("o servidor do voto aceita o teste e manda a marca, nunca a pessoa no voto", /tipo === "teste"/.test(rota) && /alumia_teste_story/.test(rota) && /marcaDoVoto\(segredo, "teste"/.test(rota));
  const cli = ler("lib/rede/voto/cliente.ts");
  ok("o cliente leva a resposta pelo servidor e lembra só neste aparelho", /rede_story_testar:/.test(cli) && /lembrarVoto\("teste"/.test(cli));
  const lista = await comEnderecos(
    [{ id: "1", fundo: { tipo: "imagem", cor: "azul", caminho: "a/alta.webp", menor: "a/menor.webp", url: "", alt: "" } }],
    async (cs) => Object.fromEntries(cs.map((c) => [c, `https://assinado.local/${c}`])),
  );
  ok("o cliente assina as duas versões (a menor abre na hora)", lista[0].fundo.url.endsWith("alta.webp") && lista[0].fundo.urlMenor?.endsWith("menor.webp"));
}

// ═══════════════════ 5. A tela: quadros, rascunhos (só no aparelho), colagem, a hora da contagem livre ═══════════════════
{
  const { LIMITE_DE_QUADROS, porQuadroDepois, quadroTemConteudo, quadroVazio, tirarQuadro } = await import("../lib/rede/stories/quadros.ts");
  const { podarRascunhos, paraGuardar, resumir, MAXIMO_DE_RASCUNHOS, VIDA_DO_RASCUNHO, BASE_DOS_RASCUNHOS } = await import("../lib/rede/stories/rascunhos.ts");
  const { celulasDaColagem, cobrir, fotosDoModelo, MODELOS_DE_COLAGEM } = await import("../lib/rede/stories/colagem.ts");
  const { horaLocalParaIso, isoParaHoraLocal } = await import("../lib/rede/stories/tempo.ts");
  const { BASES_CONHECIDAS, basesParaApagar } = await import("../lib/modo-seguro.ts");

  const a = { ...quadroVazio("vermelho"), texto: "UM" };
  const novo = porQuadroDepois([a], 0);
  ok("novo quadro entra logo depois do atual, com a mesma cor, e vira o atual", novo?.lista.length === 2 && novo.atual === 1 && novo.lista[1].cor === "vermelho" && !quadroTemConteudo(novo.lista[1]));
  let cheia = [a];
  for (let i = 1; i < LIMITE_DE_QUADROS; i++) cheia = porQuadroDepois(cheia, i - 1).lista;
  ok(`no máximo ${LIMITE_DE_QUADROS} quadros`, cheia.length === LIMITE_DE_QUADROS && porQuadroDepois(cheia, 0) === null);
  const sem = tirarQuadro([a, { ...a, texto: "DOIS" }, { ...a, texto: "TRÊS" }], 2);
  ok("tirar o último volta ao de antes", sem.lista.length === 2 && sem.atual === 1 && sem.lista[1].texto === "DOIS");
  const so = tirarQuadro([a], 0);
  ok("tirar o único deixa um quadro vazio", so.lista.length === 1 && !quadroTemConteudo(so.lista[0]));

  const agora = Date.now();
  const lista = Array.from({ length: 13 }, (_, i) => ({ id: `r${i}`, atualizado: agora - i * 1000 }));
  lista.push({ id: "velho", atualizado: agora - VIDA_DO_RASCUNHO - 1 });
  const p = podarRascunhos(lista, agora);
  ok(`rascunhos: ficam os ${MAXIMO_DE_RASCUNHOS} mais novos de até 30 dias`, p.ficam.length === MAXIMO_DE_RASCUNHOS && p.ficam[0].id === "r0" && p.saem.includes("velho") && p.saem.includes("r12"));
  const blob = new Blob([new Uint8Array(10)], { type: "image/webp" });
  const guardados = paraGuardar([{ ...a, midia: { tipo: "imagem", blob, url: "blob:local" } }]);
  ok("o rascunho guarda a foto, nunca o endereço local", guardados[0].midia?.blob === blob && !("url" in guardados[0].midia));
  let grande = false;
  try {
    paraGuardar([{ ...a, midia: { tipo: "video", blob: { size: 200 * 1024 * 1024 }, url: "blob:x", duracao: 1000 } }]);
  } catch (e) {
    grande = e.message === "grande";
  }
  ok("vídeo grande demais não vira rascunho", grande);
  ok("o resumo usa o texto e a primeira foto", resumir({ id: "x", atualizado: 1, publico: "seguidores", comunidade: null, quadros: guardados }).texto === "UM");
  ok("a base dos rascunhos sai com o \"Sair de tudo\"", BASES_CONHECIDAS.includes(BASE_DOS_RASCUNHOS) && basesParaApagar([BASE_DOS_RASCUNHOS]).includes(BASE_DOS_RASCUNHOS));
  const cRas = ler("lib/rede/stories/rascunhos.ts");
  ok("os rascunhos não vão ao servidor (nada de rpc, fetch ou depósito)", !/fetch\(|rpc\(|storage\.from|chamar\(/.test(cRas.replace(/\/\/.*$/gm, "")));

  for (const m of MODELOS_DE_COLAGEM) {
    const cs = celulasDaColagem(m);
    ok(`colagem "${m}": células dentro da tela e sem sobreposição`, cs.every((c) => c.x >= 0 && c.y >= 0 && c.x + c.l <= 1.0001 && c.y + c.a <= 1.0001)
      && cs.every((c, i) => cs.every((d, j) => i === j || c.x + c.l <= d.x + 1e-9 || d.x + d.l <= c.x + 1e-9 || c.y + c.a <= d.y + 1e-9 || d.y + d.a <= c.y + 1e-9)));
  }
  ok("os modelos pedem 2, 2, 3 e 4 fotos", MODELOS_DE_COLAGEM.map(fotosDoModelo).join() === "2,2,3,4");
  const r = cobrir({ l: 4000, a: 3000 }, { l: 100, a: 200 });
  ok("a foto cobre a célula sem esticar (recorta o que sobra, no meio)", Math.abs(r.sl / r.sa - 0.5) < 1e-9 && r.sy === 0 && r.sx > 0);
  ok("a colagem é redesenhada num canvas (sem o metadado das fotos)", /drawImage/.test(ler("lib/rede/stories/colagem.ts")) && /toBlob/.test(ler("lib/rede/stories/colagem.ts")));

  const iso = new Date(Date.UTC(2027, 0, 15, 18, 30)).toISOString();
  ok("a hora da contagem livre vai e volta do campo de data", horaLocalParaIso(isoParaHoraLocal(iso)) === iso && horaLocalParaIso("lixo") === null);

  const criar = ler("components/rede/stories/Criar.tsx");
  ok("o criar publica cada quadro com a chave do envio e a versão menor", criar.includes("chave_envio: chaveDoEnvio.current") && /menor,\n/.test(criar) && criar.includes("comporFotoEmVersoes"));
  ok("o que já saiu sai da sequência (um tente de novo não repete)", criar.includes("restantes = restantes.slice(1);"));
}

console.log(`\nP5 · stories, o resto (A16): ${certos} certos, ${falhas.length} falhas.`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
