// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote de moderação da Rede v2 (supabase/migracoes/2026-11-rede-moderacao.sql) num Postgres de verdade dentro do Node:
// níveis de confiança (regras públicas, sobe e desce sozinho, líder só pela coordenação) e seus limites (links, imagens, posts por
// dia), denúncia com protocolo (quem denuncia nunca aparece), fila por prioridade e por alcance, quebra-vidro de núcleo, ação com
// regra e motivo no registro só de inserção, recurso em 30 dias revisto por outra pessoa, modo lento, trava, silenciar no servidor,
// listas de bloqueio, rótulo de desinformação ligado à Checagem, a ponte da página /denunciar e as permissões. Também confere os
// tipos, o cliente, os textos nos seis idiomas, as rotas e os documentos. Carrega o install.sql, a fundação e a moderação.
// Uso: npm run testar:rede-moderacao
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { gravarSilenciosLocais, lerSilenciosLocais, silenciadoNoAparelho } from "../lib/rede/silenciar-local.ts";
import { CATEGORIAS_DE_DENUNCIA, prioridadeDaCategoria } from "../lib/rede/tipos-moderacao.ts";

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
const existe = (caminho) => fs.existsSync(new URL(`../${caminho}`, import.meta.url));
const fundacao = lerTexto("supabase/migracoes/2026-11-rede-fundacao.sql");
const migracao = lerTexto("supabase/migracoes/2026-11-rede-moderacao.sql");

await espera("a fundação instala sobre o install.sql", () => banco.exclusivo(() => banco.pg.exec(fundacao)));
await espera("a migração de moderação instala", () => banco.exclusivo(() => banco.pg.exec(migracao)));
await espera("instalar de novo não quebra nem duplica as regras dos níveis", async () => {
  await banco.exclusivo(() => banco.pg.exec(migracao));
  return (await um("select count(*)::int as n from interno.rede_niveis")).n;
}, (n) => n === 5);

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
// Coordenação e mediação passam pelo segundo fator (aal2), como no serviço real.
const como2fa = (sub) => ({ ...como(sub), aal: "aal2" });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas ──
const pessoas = {};
const nomes = ["autor", "autor2", "membro", "membro2", "denunciante", "equipe", "mod2", "coord", "modcom", "nucleo", "nucleomed", "nivel", "poster", "diario", "imagem", "lista1", "lista2", "lenta", "outro"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@mod.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Lutadora ${i + 1} ${nome}`]);
}
await dono("delete from interno.papeis where usuario <> $1", [pessoas.equipe]);
await dono("insert into interno.papeis (usuario, papel) select $1, 'educacao' where not exists (select 1 from interno.papeis where usuario = $1)", [pessoas.equipe]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'mediacao')", [pessoas.mod2]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [pessoas.coord]);
const VERSAO = 1;
await dono("insert into interno.rede_regras (versao, texto) values ($1, $2) on conflict do nothing", [VERSAO, "Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = $2 where id = $1", [pessoas[nome], VERSAO]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, $2)", [pessoas[nome], VERSAO]);
}
await dono("update auth.users set created_at = now() - interval '30 days'");
for (const nome of nomes) await dono("update interno.perfis set rede_handle = $2 where id = $1", [pessoas[nome], `pessoa_${nome}`]);

await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo, publico_padrao) values
  ('matematica', 'Matemática', 'disciplinas', 'aberta', 'internet'),
  ('moradia', 'Moradia', 'lutas', 'aberta', 'membros')`);
await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel) values ('moradia', $1, 'moderacao')", [pessoas.modcom]);
const nucleo = (await um("insert into interno.rede_nucleos (nome, cidade) values ('Núcleo do teste', 'Niterói') returning id")).id;
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'membro')", [nucleo, pessoas.nucleo]);
await dono("insert into interno.rede_nucleo_membros (nucleo, usuario, papel) values ($1, $2, 'mediacao')", [nucleo, pessoas.nucleomed]);

const postar = async (campos, autor = pessoas.autor, texto = "post do teste") => {
  const colunas = Object.keys(campos);
  const linha = await um(`insert into interno.rede_posts (autor, texto${colunas.length ? ", " + colunas.join(", ") : ""}) values ($1, $2${colunas.map((_, i) => `, $${i + 3}`).join("")}) returning id`, [autor, texto, ...Object.values(campos)]);
  return linha.id;
};
const post = async (id) => um("select * from interno.rede_posts where id = $1", [id]);
const avisosDe = async (quem) => (await todos("select texto from interno.avisos where para = $1", [quem])).map((x) => x.texto).join("\n");
const comoDono = (sub, texto, valores = []) =>
  banco.exclusivo(async () => {
    await banco.pg.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: "authenticated", sub })]);
    try {
      return await banco.pg.query(texto, valores);
    } finally {
      await banco.pg.query("select set_config('request.jwt.claims', '', false)");
    }
  });

// ───────────────────────────── 1. Níveis de confiança ─────────────────────────────
await espera("as regras dos níveis são públicas (visitante lê) e têm os 5 níveis", async () => rpc(visitante(), "rede_mod_niveis"), (r) => r.length === 5 && r[0].nome === "novo" && r[4].automatico === false && r[1].links >= r[0].links);
await espera("nível 0 para quem acabou de chegar (sem participação)", async () => (await rpc(como(pessoas.nivel), "rede_mod_meu_nivel")).nivel, (n) => n === 0);

const bases = [];
for (let i = 0; i < 60; i++) bases.push(await postar({ publico: "membros" }, pessoas.autor2));
await espera("5 participações e 30 dias de conta: nível 1", async () => {
  for (const b of bases.slice(0, 5)) await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio')", [b, pessoas.nivel]);
  return (await rpc(como(pessoas.nivel), "rede_mod_meu_nivel")).nivel;
}, (n) => n === 1);
await espera("30 participações e 3 posts: nível 2", async () => {
  for (const b of bases.slice(5, 30)) await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio')", [b, pessoas.nivel]);
  for (let i = 0; i < 3; i++) await postar({ publico: "membros" }, pessoas.nivel);
  return (await rpc(como(pessoas.nivel), "rede_mod_meu_nivel")).nivel;
}, (n) => n === 2);
await espera("60 dias, 120 participações e 20 posts: nível 3", async () => {
  await dono("update auth.users set created_at = now() - interval '70 days' where id = $1", [pessoas.nivel]);
  for (const b of bases.slice(30)) await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio')", [b, pessoas.nivel]);
  for (const b of bases) await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'util')", [b, pessoas.nivel]);
  for (let i = 0; i < 17; i++) await postar({ publico: "membros" }, pessoas.nivel);
  const r = await rpc(como(pessoas.nivel), "rede_mod_meu_nivel");
  return [r.nivel, r.proximo, r.dados.participacoes];
}, (r) => r[0] === 3 && r[1] === null && r[2] === 120);
await espera("só a coordenação designa líder; líder é nível 4", async () => {
  let recusado = false;
  try {
    await rpc(como(pessoas.equipe), "rede_mod_lider", { p_handle: "pessoa_nivel", p_sim: true });
  } catch (e) {
    recusado = String(e.message).includes("sem_permissao");
  }
  await rpc(como2fa(pessoas.coord), "rede_mod_lider", { p_handle: "pessoa_nivel", p_sim: true });
  const lider = (await rpc(como(pessoas.nivel), "rede_mod_meu_nivel")).nivel;
  await rpc(como2fa(pessoas.coord), "rede_mod_lider", { p_handle: "pessoa_nivel", p_sim: false });
  const volta = (await rpc(como(pessoas.nivel), "rede_mod_meu_nivel")).nivel;
  return [recusado, lider, volta];
}, (r) => r[0] === true && r[1] === 4 && r[2] === 3);
await espera("uma decisão procedente (post removido) faz o nível descer", async () => {
  const alvo = await postar({ publico: "membros" }, pessoas.nivel);
  await dono("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, regra, motivo) values ('remover', 'post', $1, 'normas 1', 'motivo do teste')", [alvo]);
  return (await rpc(como(pessoas.nivel), "rede_mod_meu_nivel")).nivel;
}, (n) => n === 0);

// ───────────────────────────── 2. Limites por nível ─────────────────────────────
await recusa("nível 0: dois links num post passam do limite", () => rpc(como(pessoas.poster), "rede_publicar", { p: { texto: "veja https://a.org e https://b.org" } }), "nivel_links");
await espera("nível 0: um link passa", () => rpc(como(pessoas.poster), "rede_publicar", { p: { texto: "veja https://a.org" } }), (r) => r.id);
await espera("limite diário: o teto de posts do nível vale em 24 horas", async () => {
  await dono("insert into interno.rede_posts (autor, texto, publico) select $1, 'antigo', 'membros' from generate_series(1, 30)", [pessoas.diario]);
  try {
    await rpc(como(pessoas.diario), "rede_publicar", { p: { texto: "mais um" } });
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("limite_diario"));
await espera("limite de imagens: nível 0 aceita 1; a segunda é recusada", async () => {
  const p = await rpc(como(pessoas.imagem), "rede_publicar", { p: { texto: "com imagem" } });
  const inserir = (ordem) => comoDono(pessoas.imagem, "insert into interno.rede_midia (post, caminho, tipo, ordem) values ($1, gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.jpg', 'image/jpeg', $2)", [p.id, ordem]);
  await inserir(0);
  try {
    await inserir(1);
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("nivel_imagens"));
await espera("quem modera não é barrado pelo limite de links", () => rpc(como(pessoas.equipe), "rede_publicar", { p: { texto: "https://a.org https://b.org https://c.org", publico: "membros" } }), (r) => r.id);

// ───────────────────────────── 3. Modo lento e trava ─────────────────────────────
const raizLenta = (await rpc(como(pessoas.modcom), "rede_publicar", { p: { texto: "conversa para o modo lento", comunidade: "moradia" } })).id;
await recusa("só quem modera liga o modo lento", () => rpc(como(pessoas.membro), "rede_mod_modo_lento", { p_tipo: "comunidade", p_alvo: "moradia", p_segundos: 60 }), "sem_permissao");
await recusa("modo lento com valor absurdo é recusado", () => rpc(como(pessoas.modcom), "rede_mod_modo_lento", { p_tipo: "comunidade", p_alvo: "moradia", p_segundos: 2 }), "invalido:segundos");
await espera("a moderação da comunidade liga o modo lento (e a tela pode saber)", async () => {
  await rpc(como(pessoas.modcom), "rede_mod_modo_lento", { p_tipo: "comunidade", p_alvo: "moradia", p_segundos: 60 });
  return rpc(visitante(), "rede_mod_lento_de", { p_tipo: "comunidade", p_alvo: "moradia" });
}, (n) => n === 60);
await espera("modo lento: o primeiro post passa, o segundo não; quem modera não é barrado", async () => {
  await rpc(como(pessoas.lenta), "rede_publicar", { p: { texto: "primeiro", comunidade: "moradia" } });
  let segundo = "passou";
  try {
    await rpc(como(pessoas.lenta), "rede_publicar", { p: { texto: "segundo", comunidade: "moradia" } });
  } catch (e) {
    segundo = String(e.message);
  }
  const mod1 = await rpc(como(pessoas.modcom), "rede_publicar", { p: { texto: "mod 1", comunidade: "moradia" } });
  const mod2 = await rpc(como(pessoas.modcom), "rede_publicar", { p: { texto: "mod 2", comunidade: "moradia" } });
  return [segundo.includes("modo_lento"), Boolean(mod1.id && mod2.id)];
}, (r) => r[0] && r[1]);
await espera("o modo lento registra a ação (só inserção) e desliga com 0", async () => {
  await rpc(como(pessoas.modcom), "rede_mod_modo_lento", { p_tipo: "comunidade", p_alvo: "moradia", p_segundos: 0 });
  const n = (await um("select count(*)::int as n from interno.rede_moderacao where acao = 'modo_lento' and alvo = 'moradia'")).n;
  const lento = await rpc(visitante(), "rede_mod_lento_de", { p_tipo: "comunidade", p_alvo: "moradia" });
  const livre = await rpc(como(pessoas.lenta), "rede_publicar", { p: { texto: "agora pode", comunidade: "moradia" } });
  return [n, lento, Boolean(livre.id)];
}, (r) => r[0] === 2 && r[1] === 0 && r[2] === true);
await espera("modo lento numa conversa: a segunda resposta seguida é barrada", async () => {
  await rpc(como(pessoas.modcom), "rede_mod_modo_lento", { p_tipo: "conversa", p_alvo: raizLenta, p_segundos: 300 });
  await rpc(como(pessoas.lenta), "rede_publicar", { p: { texto: "resposta 1", resposta_a: raizLenta } });
  try {
    await rpc(como(pessoas.lenta), "rede_publicar", { p: { texto: "resposta 2", resposta_a: raizLenta } });
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("modo_lento"));

// ───────────────────────────── 4. Denúncia, fila e quebra-vidro ─────────────────────────────
const alvo1 = await postar({ publico: "membros" }, pessoas.autor, "post denunciado por spam");
const denuncia1 = await rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvo1, p_categoria: "spam", p_texto: "propaganda repetida" });
await espera("a denúncia devolve protocolo e prioridade 3 para spam", async () => denuncia1, (r) => /^[0-9A-F]{10}$/.test(r.protocolo) && r.prioridade === 3 && r.ja === false);
await espera("denunciar de novo o mesmo alvo devolve o mesmo protocolo", () => rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvo1, p_categoria: "spam" }), (r) => r.protocolo === denuncia1.protocolo && r.ja === true);
await recusa("não se denuncia o próprio post", () => rpc(como(pessoas.autor), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvo1, p_categoria: "spam" }), "sem_permissao");
await recusa("não se denuncia o que não se pode ver (post só da equipe)", async () => rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: await postar({ publico: "equipe" }), p_categoria: "spam" }), "nao_encontrado");
await recusa("visitante não denuncia pela função da Rede (usa a página Denunciar)", () => rpc(visitante(), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvo1, p_categoria: "spam" }), "permission denied");
await recusa("categoria inventada é recusada", () => rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvo1, p_categoria: "brincadeira" }), "invalido:categoria");

const alvoGrave = await postar({ publico: "membros" }, pessoas.autor, "post com dado de outra pessoa");
const denunciaGrave = await rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvoGrave, p_categoria: "exposicao", p_texto: "endereço de uma pessoa" });
await espera("exposição de dados: prioridade 1 e o post fica retido por precaução (reversível)", async () => {
  const p = await post(alvoGrave);
  const reg = await um("select acao, regra, quem from interno.rede_moderacao where alvo = $1 and acao = 'reter'", [alvoGrave]);
  return [denunciaGrave.prioridade, denunciaGrave.retido, p.retido, p.oculto, reg.regra, reg.quem];
}, (r) => r[0] === 1 && r[1] === true && r[2] === true && r[3] === true && r[4] === "precaucao" && r[5] === null);
await espera("o autor é avisado da retenção por precaução, com o caminho do recurso", async () => avisosDe(pessoas.autor), (t) => t.includes("retido por precaução") && t.includes("recorrer"));

const alvoMoradia = await postar({ publico: "membros", comunidade: "moradia" }, pessoas.autor2, "post da moradia denunciado");
await rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: alvoMoradia, p_categoria: "odio" });
const denunciaPerfil = await rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "perfil", p_alvo: "@pessoa_autor2", p_categoria: "assedio" });
await espera("denunciar perfil e comunidade funciona", async () => {
  const c = await rpc(como(pessoas.denunciante), "rede_mod_denunciar", { p_alvo_tipo: "comunidade", p_alvo: "moradia", p_categoria: "outro", p_texto: "regras ignoradas" });
  return [denunciaPerfil.protocolo.length, c.protocolo.length];
}, (r) => r[0] === 10 && r[1] === 10);

await espera("a equipe vê a fila com a prioridade 1 na frente", async () => {
  const fila = await rpc(como(pessoas.equipe), "rede_mod_fila", { p_situacao: "abertas" });
  return [fila[0].prioridade, fila[0].categoria, fila.some((i) => i.protocolo === denuncia1.protocolo), fila.length];
}, (r) => r[0] === 1 && r[1] === "exposicao" && r[2] === true && r[3] >= 5);
await espera("a fila nunca revela quem denunciou", async () => {
  const fila = await rpc(como(pessoas.equipe), "rede_mod_fila", {});
  const aberta = await rpc(como(pessoas.equipe), "rede_mod_abrir", { p_denuncia: fila[0].id });
  const tudo = JSON.stringify([fila, aberta]);
  return [tudo.includes(pessoas.denunciante), tudo.includes("pessoa_denunciante"), tudo.includes("denunciante")];
}, (r) => r.every((x) => x === false));
await recusa("quem não modera não vê a fila", () => rpc(como(pessoas.membro), "rede_mod_fila", {}), "sem_permissao");
await espera("a moderação da comunidade vê só o que é da comunidade dela", async () => {
  const fila = await rpc(como(pessoas.modcom), "rede_mod_fila", {});
  const alvos = fila.map((i) => `${i.alvo_tipo}:${i.alvo}`);
  return [alvos.includes(`post:${alvoMoradia}`), alvos.includes("comunidade:moradia"), alvos.includes(`post:${alvo1}`), alvos.some((a) => a.startsWith("perfil:"))];
}, (r) => r[0] === true && r[1] === true && r[2] === false && r[3] === false);
await espera("minhas denúncias: protocolo e andamento, só as minhas", async () => {
  const minhas = await rpc(como(pessoas.denunciante), "rede_mod_minhas_denuncias");
  const dosOutros = await rpc(como(pessoas.membro), "rede_mod_minhas_denuncias");
  return [minhas.length >= 5, minhas.every((m) => !("quem" in m)), dosOutros.length];
}, (r) => r[0] && r[1] && r[2] === 0);

// Núcleo: o conteúdo só abre com quebra-vidro registrada e avisada à mediação do núcleo.
const alvoNucleo = await postar({ publico: "nucleo", nucleo }, pessoas.nucleo, "conversa interna do núcleo");
const denunciaNucleo = await rpc(como(pessoas.nucleo), "rede_mod_denunciar", { p_alvo_tipo: "post", p_alvo: await postar({ publico: "nucleo", nucleo }, pessoas.nucleomed, "post do mediador"), p_categoria: "ameaca" });
await espera("fila: post de núcleo aparece sem trecho do conteúdo", async () => {
  const fila = await rpc(como(pessoas.equipe), "rede_mod_fila", {});
  const item = fila.find((i) => i.protocolo === denunciaNucleo.protocolo);
  return [Boolean(item), item?.nucleo, item?.trecho];
}, (r) => r[0] && r[1] === true && r[2] === null);
await espera("abrir denúncia de núcleo: quebra-vidro registrada uma vez e a mediação do núcleo é avisada", async () => {
  const fila = await rpc(como(pessoas.equipe), "rede_mod_fila", {});
  const item = fila.find((i) => i.protocolo === denunciaNucleo.protocolo);
  const a = await rpc(como(pessoas.equipe), "rede_mod_abrir", { p_denuncia: item.id });
  await rpc(como(pessoas.equipe), "rede_mod_abrir", { p_denuncia: item.id });
  const n = (await um("select count(*)::int as n from interno.rede_moderacao where acao = 'quebra_vidro' and denuncia = $1", [item.id])).n;
  return [a.alvo.texto, n, (await avisosDe(pessoas.nucleomed)).includes("moderação geral abriu")];
}, (r) => r[0] === "post do mediador" && r[1] === 1 && r[2] === true);
await recusa("sem denúncia, a equipe geral não age em post de núcleo", () => rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: alvoNucleo, p_acao: "remover", p_regra: "normas 1", p_motivo: "teste" }), "nao_encontrado");
await recusa("denúncia de outro post não serve de passe para agir em post de núcleo", async () => {
  const fila = await rpc(como(pessoas.equipe), "rede_mod_fila", {});
  const outra = fila.find((i) => i.alvo_tipo === "post" && i.alvo !== alvoNucleo && !i.nucleo);
  if (!outra) throw new Error("sem denúncia de outro post para o teste");
  return rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: outra.id, p_alvo_tipo: "post", p_alvo: alvoNucleo, p_acao: "remover", p_regra: "normas 1", p_motivo: "teste" });
}, "invalido:alvo");
await espera("a mediação do núcleo age no post do núcleo sem denúncia", () => rpc(como(pessoas.nucleomed), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: alvoNucleo, p_acao: "reter", p_regra: "normas 2", p_motivo: "conversa fora do tema do núcleo" }), (r) => r.acao);

// ───────────────────────────── 5. Ações com regra e motivo ─────────────────────────────
await recusa("ação desconhecida", () => rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: alvo1, p_acao: "explodir", p_regra: "normas 1", p_motivo: "teste" }), "invalido:acao");
await recusa("ação sem regra", () => rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: alvo1, p_acao: "remover", p_regra: "", p_motivo: "teste de motivo" }), "invalido:regra");
await recusa("ação sem motivo", () => rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: alvo1, p_acao: "remover", p_regra: "normas 1", p_motivo: "" }), "invalido:motivo");
await recusa("quem não modera o lugar não age", () => rpc(como(pessoas.membro), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: alvo1, p_acao: "remover", p_regra: "normas 1", p_motivo: "teste de motivo" }), "nao_encontrado");
const filaAgora = await rpc(como(pessoas.equipe), "rede_mod_fila", {});
const itemSpam = filaAgora.find((i) => i.protocolo === denuncia1.protocolo);
await espera("remover pela denúncia: post some, autor é avisado, denúncia resolvida, quem denunciou é avisado", async () => {
  await rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: itemSpam.id, p_alvo_tipo: "post", p_alvo: alvo1, p_acao: "remover", p_regra: "normas 4", p_motivo: "Propaganda repetida em várias conversas." });
  const p = await post(alvo1);
  const d = await um("select situacao from interno.rede_denuncias where id = $1", [itemSpam.id]);
  const reg = await um("select regra, motivo, quem from interno.rede_moderacao where alvo = $1 and acao = 'remover'", [alvo1]);
  return [p.oculto, d.situacao, reg.regra, reg.quem === pessoas.equipe, (await avisosDe(pessoas.autor)).includes("retirado da Rede"), (await avisosDe(pessoas.denunciante)).includes(denuncia1.protocolo)];
}, (r) => r[0] && r[1] === "resolvida" && r[2] === "normas 4" && r[3] && r[4] && r[5]);
await espera("o autor do post removido vê o motivo (e só ele)", async () => {
  const dele = await rpc(como(pessoas.autor), "rede_post", { p_id: alvo1 });
  let dosOutros = "viu";
  try {
    await rpc(como(pessoas.membro), "rede_post", { p_id: alvo1 });
  } catch (e) {
    dosOutros = String(e.message);
  }
  return [dele.post.retido, dele.post.motivo.includes("Propaganda"), dosOutros.includes("nao_encontrado")];
}, (r) => r[0] && r[1] && r[2]);
await espera("o registro de moderação não se altera nem se apaga", async () => {
  const r = [];
  for (const sql of ["update interno.rede_moderacao set motivo = 'outro motivo qualquer'", "delete from interno.rede_moderacao", "truncate interno.rede_moderacao"]) {
    try {
      await dono(sql);
      r.push("passou");
    } catch (e) {
      r.push(sql.startsWith("truncate") ? true : String(e.message).includes("não se altera"));
    }
  }
  return r;
}, (r) => r.every((x) => x === true));
await espera("travar e destravar a conversa (a fundação recusa resposta em conversa travada)", async () => {
  const raiz = await postar({ publico: "membros" }, pessoas.autor2, "conversa a travar");
  await rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: raiz, p_acao: "travar", p_regra: "normas 5", p_motivo: "A conversa saiu do rumo." });
  let travada = "passou";
  try {
    await rpc(como(pessoas.membro2), "rede_publicar", { p: { texto: "resposta", resposta_a: raiz } });
  } catch (e) {
    travada = String(e.message);
  }
  await rpc(como(pessoas.equipe), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: raiz, p_acao: "destravar", p_regra: "normas 5", p_motivo: "Voltou ao normal." });
  const livre = await rpc(como(pessoas.membro2), "rede_publicar", { p: { texto: "resposta agora", resposta_a: raiz } });
  return [travada.includes("travado"), Boolean(livre.id)];
}, (r) => r[0] && r[1]);
await espera("banir e desbanir uma pessoa de uma comunidade (a moderação dela decide)", async () => {
  await recusa("banir sem a comunidade", () => rpc(como(pessoas.modcom), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "perfil", p_alvo: "pessoa_membro", p_acao: "banir", p_regra: "normas 6", p_motivo: "Reincidência" }), "invalido:contexto");
  await rpc(como(pessoas.modcom), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "perfil", p_alvo: "pessoa_membro", p_acao: "banir", p_regra: "normas 6", p_motivo: "Reincidência em ofensas", p_contexto: "moradia" });
  let barrado = "passou";
  try {
    await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "ainda aqui?", comunidade: "moradia" } });
  } catch (e) {
    barrado = String(e.message);
  }
  await rpc(como(pessoas.modcom), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "perfil", p_alvo: "pessoa_membro", p_acao: "desbanir", p_regra: "normas 6", p_motivo: "Pediu desculpas", p_contexto: "moradia" });
  const volta = await rpc(como(pessoas.membro), "rede_publicar", { p: { texto: "voltei", comunidade: "moradia" } });
  return [barrado.includes("sem_permissao"), Boolean(volta.id)];
}, (r) => r[0] && r[1]);
await recusa("ninguém bane a equipe", () => rpc(como(pessoas.modcom), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "perfil", p_alvo: "pessoa_equipe", p_acao: "banir", p_regra: "normas 6", p_motivo: "teste", p_contexto: "moradia" }), "sem_permissao");
await espera("descartar uma denúncia pede o motivo, vai ao registro e avisa quem denunciou", async () => {
  const item = filaAgora.find((i) => i.protocolo === denunciaPerfil.protocolo);
  let semNota = "passou";
  try {
    await rpc(como(pessoas.equipe), "rede_mod_denuncia_situacao", { p_denuncia: item.id, p_situacao: "descartada", p_nota: "" });
  } catch (e) {
    semNota = String(e.message);
  }
  await rpc(como(pessoas.equipe), "rede_mod_denuncia_situacao", { p_denuncia: item.id, p_situacao: "descartada", p_nota: "Perfil dentro das normas, sem assédio." });
  const reg = await um("select regra from interno.rede_moderacao where acao = 'descartar' and denuncia = $1", [item.id]);
  return [semNota.includes("invalido:nota"), reg.regra, (await avisosDe(pessoas.denunciante)).includes("não encontramos violação")];
}, (r) => r[0] && r[1] === "sem_violacao" && r[2]);

// ───────────────────────────── 6. Recurso (30 dias, outra pessoa revê) ─────────────────────────────
const decisoes = await rpc(como(pessoas.autor), "rede_mod_minhas_decisoes");
const decisaoRemocao = decisoes.find((d) => d.acao === "remover" && d.alvo === alvo1);
await espera("o autor vê a decisão com regra, motivo e prazo, sem saber quem decidiu", async () => [Boolean(decisaoRemocao), decisaoRemocao?.pode_recorrer, decisaoRemocao?.regra, JSON.stringify(decisoes).includes(pessoas.equipe)], (r) => r[0] && r[1] === true && r[2] === "normas 4" && r[3] === false);
await recusa("recurso curto demais", () => rpc(como(pessoas.autor), "rede_mod_recorrer", { p_acao: decisaoRemocao.id, p_texto: "não" }), "invalido:texto");
await recusa("só quem foi atingido recorre", () => rpc(como(pessoas.membro), "rede_mod_recorrer", { p_acao: decisaoRemocao.id, p_texto: "Eu quero recorrer da decisão dos outros." }), "nao_encontrado");
await espera("recorrer em até 30 dias funciona uma vez só", async () => {
  await rpc(como(pessoas.autor), "rede_mod_recorrer", { p_acao: decisaoRemocao.id, p_texto: "Era um aviso de um mutirão, não propaganda." });
  try {
    await rpc(como(pessoas.autor), "rede_mod_recorrer", { p_acao: decisaoRemocao.id, p_texto: "De novo, para ver se deixa." });
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("recurso_ja_feito"));
await espera("fora do prazo de 30 dias não dá para recorrer", async () => {
  const velho = await postar({ publico: "membros" }, pessoas.autor2);
  const m = await um("insert into interno.rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, criado_em) values ('remover', 'post', $1, 'normas 1', 'decisão antiga do teste', now() - interval '40 days') returning id", [velho]);
  try {
    await rpc(como(pessoas.autor2), "rede_mod_recorrer", { p_acao: m.id, p_texto: "Já faz muito tempo, mas quero recorrer." });
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("prazo_vencido"));
const filaRecursos = await rpc(como(pessoas.equipe), "rede_mod_recursos");
const recurso = filaRecursos.find((r) => r.acao.alvo === alvo1);
await espera("o recurso aparece para a moderação, marcado como 'minha' para quem decidiu", async () => [Boolean(recurso), recurso?.minha], (r) => r[0] && r[1] === true);
await recusa("quem decidiu a ação não revê o recurso", () => rpc(como(pessoas.equipe), "rede_mod_rever", { p_recurso: recurso.id, p_decisao: "revertido", p_motivo: "Eu mesma revejo." }), "outra_pessoa");
await espera("o gatilho do banco também barra a mesma pessoa", async () => {
  try {
    await dono("update interno.rede_recursos set revisou = $2 where id = $1", [recurso.id, pessoas.equipe]);
    return "passou";
  } catch (e) {
    return String(e.message);
  }
}, (m) => m.includes("outra pessoa"));
await espera("outra pessoa da moderação reverte: o post volta, o autor é avisado, a decisão final fica no registro", async () => {
  await rpc(como2fa(pessoas.mod2), "rede_mod_rever", { p_recurso: recurso.id, p_decisao: "revertido", p_motivo: "O texto é aviso de mutirão; a remoção foi um engano." });
  const p = await post(alvo1);
  const r = await um("select situacao, revisou from interno.rede_recursos where id = $1", [recurso.id]);
  const reg = await um("select count(*)::int as n from interno.rede_moderacao where acao = 'recurso_revertido' and alvo = $1", [alvo1]);
  const vista = await rpc(como(pessoas.membro), "rede_post", { p_id: alvo1 });
  return [p.oculto, r.situacao, r.revisou === pessoas.mod2, reg.n, (await avisosDe(pessoas.autor)).includes("recurso foi aceito"), Boolean(vista.post.id)];
}, (r) => r[0] === false && r[1] === "revertido" && r[2] && r[3] === 1 && r[4] && r[5]);
await espera("decisão revertida não conta como procedente para o nível", async () => (await rpc(como(pessoas.autor), "rede_mod_meu_nivel")).procedentes_90, (n) => n === 0);

// ───────────────────────────── 7. Silenciar no servidor ─────────────────────────────
const postDoAutorParaSilenciar = await postar({ publico: "membros" }, pessoas.autor, "post para silenciar");
const idsDaLinha = async (quem) => (await rpc(como(quem), "rede_linha", { p_aba: "tudo", p_limite: 50 })).itens.map((i) => i.id);
await espera("silenciar uma pessoa tira os posts dela da linha, sem avisar ninguém", async () => {
  const antes = (await idsDaLinha(pessoas.membro2)).includes(postDoAutorParaSilenciar);
  const avisosAntes = (await avisosDe(pessoas.autor)).length;
  const s = await rpc(como(pessoas.membro2), "rede_mod_silenciar", { p_tipo: "pessoa", p_alvo: "@pessoa_autor" });
  const depois = (await idsDaLinha(pessoas.membro2)).includes(postDoAutorParaSilenciar);
  const outraPessoa = (await idsDaLinha(pessoas.membro)).includes(postDoAutorParaSilenciar);
  await rpc(como(pessoas.membro2), "rede_mod_silenciar_remover", { p_id: s.id });
  const volta = (await idsDaLinha(pessoas.membro2)).includes(postDoAutorParaSilenciar);
  return [antes, depois, outraPessoa, volta, (await avisosDe(pessoas.autor)).length === avisosAntes];
}, (r) => r[0] === true && r[1] === false && r[2] === true && r[3] === true && r[4] === true);
await espera("silenciar uma palavra (sem acento) e uma conversa", async () => {
  const p = await postar({ publico: "membros" }, pessoas.autor2, "Promoção imperdível de ônibus");
  await rpc(como(pessoas.membro2), "rede_mod_silenciar", { p_tipo: "palavra", p_alvo: "promocao" });
  const palavra = (await idsDaLinha(pessoas.membro2)).includes(p);
  const raiz = await postar({ publico: "membros" }, pessoas.autor2, "conversa que não interessa");
  await rpc(como(pessoas.membro2), "rede_mod_silenciar", { p_tipo: "conversa", p_alvo: raiz });
  const conversa = (await idsDaLinha(pessoas.membro2)).includes(raiz);
  const lista = await rpc(como(pessoas.membro2), "rede_mod_silenciados");
  return [palavra, conversa, lista.map((x) => x.tipo).sort().join(",")];
}, (r) => r[0] === false && r[1] === false && r[2] === "conversa,palavra");
await recusa("não se silencia a si mesma", () => rpc(como(pessoas.membro2), "rede_mod_silenciar", { p_tipo: "pessoa", p_alvo: "pessoa_membro2" }), "nao_encontrado");
await recusa("dias fora do intervalo", () => rpc(como(pessoas.membro2), "rede_mod_silenciar", { p_tipo: "palavra", p_alvo: "algo", p_dias: 500 }), "invalido:dias");
await espera("desfazer só mexe no que é da própria pessoa", async () => {
  const lista = await rpc(como(pessoas.membro2), "rede_mod_silenciados");
  const r = await rpc(como(pessoas.membro), "rede_mod_silenciar_remover", { p_id: lista[0].id });
  return [r.ok, (await rpc(como(pessoas.membro2), "rede_mod_silenciados")).length];
}, (r) => r[0] === false && r[1] === 2);

// ───────────────────────────── 8. Listas de bloqueio da mediação ─────────────────────────────
await recusa("só a mediação do lugar vê a lista", () => rpc(como(pessoas.membro), "rede_mod_lista", { p_escopo_tipo: "comunidade", p_escopo: "moradia" }), "sem_permissao");
await espera("palavra da lista: o post nasce retido para leitura (nada some em silêncio)", async () => {
  await rpc(como(pessoas.modcom), "rede_mod_lista_adicionar", { p_escopo_tipo: "comunidade", p_escopo: "moradia", p_tipo: "palavra", p_valor: "Golpezinho", p_motivo: "golpe recorrente" });
  const p = await rpc(como(pessoas.lista1), "rede_publicar", { p: { texto: "olha esse GOLPEZINHO aqui", comunidade: "moradia" } });
  const fila = await rpc(como(pessoas.modcom), "rede_mod_retidos");
  const doutro = await rpc(como(pessoas.lista2), "rede_publicar", { p: { texto: "texto limpo", comunidade: "moradia" } });
  return [p.retido, p.motivo, fila.some((x) => x.id === p.id), doutro.retido];
}, (r) => r[0] === true && r[1] === "lista_da_mediacao" && r[2] === true && r[3] === false);
await espera("pessoa na lista: não escreve no lugar; sair da lista devolve", async () => {
  const item = await rpc(como(pessoas.modcom), "rede_mod_lista_adicionar", { p_escopo_tipo: "comunidade", p_escopo: "moradia", p_tipo: "pessoa", p_valor: "@pessoa_lista2", p_motivo: "assédio" });
  let barrada = "passou";
  try {
    await rpc(como(pessoas.lista2), "rede_publicar", { p: { texto: "tento de novo", comunidade: "moradia" } });
  } catch (e) {
    barrada = String(e.message);
  }
  await rpc(como(pessoas.modcom), "rede_mod_lista_remover", { p_id: item.id });
  const volta = await rpc(como(pessoas.lista2), "rede_publicar", { p: { texto: "voltei a escrever", comunidade: "moradia" } });
  return [barrada.includes("lista_bloqueio"), Boolean(volta.id)];
}, (r) => r[0] && r[1]);
await recusa("a equipe nunca entra na lista", () => rpc(como(pessoas.modcom), "rede_mod_lista_adicionar", { p_escopo_tipo: "comunidade", p_escopo: "moradia", p_tipo: "pessoa", p_valor: "@pessoa_equipe" }), "sem_permissao");
await espera("a mediação do núcleo mantém a lista do núcleo; liberar um retido pela fila", async () => {
  await rpc(como(pessoas.nucleomed), "rede_mod_lista_adicionar", { p_escopo_tipo: "nucleo", p_escopo: nucleo, p_tipo: "palavra", p_valor: "segredo" });
  const lista = await rpc(como(pessoas.nucleomed), "rede_mod_lista", { p_escopo_tipo: "nucleo", p_escopo: nucleo });
  const p = await rpc(como(pessoas.nucleo), "rede_publicar", { p: { texto: "isto é um segredo", publico: "nucleo", nucleo } });
  const retidos = await rpc(como(pessoas.nucleomed), "rede_mod_retidos");
  await rpc(como(pessoas.nucleomed), "rede_mod_agir", { p_denuncia: null, p_alvo_tipo: "post", p_alvo: p.id, p_acao: "restaurar", p_regra: "lista", p_motivo: "Falso positivo da lista." });
  return [lista.length, p.retido, retidos.some((x) => x.id === p.id), (await post(p.id)).retido];
}, (r) => r[0] === 1 && r[1] === true && r[2] === true && r[3] === false);

// ───────────────────────────── 9. Rótulo de desinformação ─────────────────────────────
const slugChecagem = "a-terra-e-plana";
await espera("a checagem usada no teste existe em content/checagens", async () => existe(`content/checagens/${slugChecagem}.md`), (v) => v === true);
const postInternet = await postar({ publico: "internet", comunidade: "matematica" }, pessoas.autor, "a Terra é plana, dizem");
const postMembros = await postar({ publico: "membros" }, pessoas.autor, "outro post");
await recusa("só quem modera rotula", () => rpc(como(pessoas.membro), "rede_mod_rotular", { p_post: postInternet, p_checagem: slugChecagem, p_veredito: "Falso", p_titulo: "A Terra é plana" }), "nao_encontrado");
await recusa("o slug da checagem é conferido", () => rpc(como(pessoas.equipe), "rede_mod_rotular", { p_post: postInternet, p_checagem: "Slug Ruim!", p_veredito: "Falso" }), "invalido:checagem");
await espera("rotular não apaga: o post continua visível e ganha o rótulo com o link da checagem", async () => {
  await rpc(como(pessoas.equipe), "rede_mod_rotular", { p_post: postInternet, p_checagem: slugChecagem, p_veredito: "Falso", p_titulo: "A Terra é plana" });
  await rpc(como(pessoas.equipe), "rede_mod_rotular", { p_post: postMembros, p_checagem: slugChecagem, p_veredito: "Falso", p_titulo: "A Terra é plana" });
  const p = await post(postInternet);
  const anonimo = await rpc(visitante(), "rede_mod_detalhes", { p_ids: [postInternet, postMembros, "00000000-0000-0000-0000-000000000000"] });
  const membro = await rpc(como(pessoas.membro), "rede_mod_detalhes", { p_ids: [postInternet, postMembros] });
  const v = await rpc(visitante(), "rede_linha", { p_aba: "geral" });
  return [p.oculto, Object.keys(anonimo), anonimo[postInternet]?.rotulo.checagem, Object.keys(membro).length, v.itens.some((i) => i.id === postInternet)];
}, (r) => r[0] === false && r[1].length === 1 && r[1][0] === postInternet && r[2] === slugChecagem && r[3] === 2 && r[4] === true);
await espera("retirar o rótulo fica no registro", async () => {
  await rpc(como(pessoas.equipe), "rede_mod_desrotular", { p_post: postInternet, p_motivo: "Checagem revista." });
  const d = await rpc(como(pessoas.membro), "rede_mod_detalhes", { p_ids: [postInternet] });
  const n = (await um("select count(*)::int as n from interno.rede_moderacao where acao in ('rotular', 'desrotular') and alvo = $1", [postInternet])).n;
  return [Object.keys(d).length, n];
}, (r) => r[0] === 0 && r[1] === 2);

// ───────────────────────────── 10. A ponte da página /denunciar ─────────────────────────────
await espera("visitante denuncia pela página /denunciar um post público e ele entra na fila, sem conta", async () => {
  const antes = (await um("select count(*)::int as n from interno.rede_denuncias")).n;
  await rpc(visitante(), "denunciar", { p_alvo: `/pt/comunidade/p/${postInternet}`, p_motivo: "Exposição de dados pessoais", p_detalhes: "Mostra o endereço de uma pessoa no texto.", p_site: "", p_urgente: false });
  const linha = await um("select alvo_tipo, alvo, categoria, prioridade, quem from interno.rede_denuncias order by criado_em desc limit 1");
  return [(await um("select count(*)::int as n from interno.rede_denuncias")).n - antes, linha.alvo_tipo, linha.alvo === postInternet, linha.categoria, linha.prioridade, linha.quem];
}, (r) => r[0] === 1 && r[1] === "post" && r[2] && r[3] === "exposicao" && r[4] === 1 && r[5] === null);
await espera("visitante não leva à fila um post que não pode ver", async () => {
  const antes = (await um("select count(*)::int as n from interno.rede_denuncias")).n;
  await rpc(visitante(), "denunciar", { p_alvo: `/pt/comunidade/p/${postMembros}`, p_motivo: "Spam", p_detalhes: "Isto é um post só para membros da Rede.", p_site: "", p_urgente: false });
  return (await um("select count(*)::int as n from interno.rede_denuncias")).n - antes;
}, (n) => n === 0);
await espera("a categoria sai do motivo livre (ameaça, menores, golpe, outro)", async () => {
  const c = async (m) => (await um("select interno.rede3_mod_categoria($1) as c", [m])).c;
  return [await c("Ameaça de morte"), await c("Criança em risco"), await c("Golpe do falso prêmio"), await c("Outra coisa")];
}, (r) => r.join(",") === "ameaca,menores,golpe,outro");

// ───────────────────────────── 11. Permissões ─────────────────────────────
await espera("nenhuma função interna da moderação é chamável de fora", async () => {
  const linhas = await todos(`select p.oid::regprocedure::text as f, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname like 'rede3\\_mod\\_%'`);
  return [linhas.length >= 14, linhas.filter((l) => l.anon || l.auth).map((l) => l.f)];
}, (r) => r[0] && r[1].length === 0);
await espera("as públicas: leitura aberta só em níveis, modo lento e rótulos; o resto exige conta", async () => {
  const linhas = await todos(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_mod\\_%'`);
  const abertas = linhas.filter((l) => l.anon).map((l) => l.proname).sort().join(",");
  return [linhas.length, abertas, linhas.every((l) => l.auth)];
}, (r) => r[0] >= 25 && r[1] === "rede_mod_detalhes,rede_mod_lento_de,rede_mod_niveis" && r[2]);
await espera("as tabelas novas têm RLS ligada e nenhum acesso para anon e authenticated", async () => {
  const linhas = await todos(`select c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select') as anon, has_table_privilege('authenticated', c.oid, 'select') as auth
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relname in ('rede_niveis', 'rede_lideres', 'rede_lento', 'rede_bloqueio_lista', 'rede_rotulos')`);
  return [linhas.length, linhas.every((l) => l.relrowsecurity && !l.anon && !l.auth)];
}, (r) => r[0] === 5 && r[1]);
await espera("nenhuma tabela nova no esquema public", async () => (await um("select count(*)::int as n from pg_tables where schemaname = 'public' and tablename like 'rede%'")).n, (n) => n === 0);

// ───────────────────────────── 12. Cliente, tipos, textos, rotas, documentos ─────────────────────────────
await espera("as categorias de denúncia e a prioridade batem com o banco", async () => {
  const noBanco = [];
  for (const c of CATEGORIAS_DE_DENUNCIA) noBanco.push([c, Number((await um("select interno.rede2_prioridade($1) as p", [c])).p)]);
  return noBanco.every(([c, p]) => prioridadeDaCategoria(c) === p);
}, (v) => v === true);
await espera("o cliente tem uma chamada para cada função pública do pacote, sem '@/' nos módulos puros", async () => {
  const cliente = lerTexto("lib/rede/cliente-moderacao.ts");
  const funcoes = (await todos(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'rede\\_mod\\_%'`)).map((x) => x.proname);
  const semChamada = funcoes.filter((f) => !cliente.includes(`"${f}"`));
  const comAtalho = ["lib/rede/tipos-moderacao.ts", "lib/rede/cliente-moderacao.ts", "lib/rede/silenciar-local.ts", "lib/rede/textos-moderacao.ts"].filter((a) => /from "@\//.test(lerTexto(a)));
  return [semChamada, comAtalho];
}, (r) => r[0].length === 0 && r[1].length === 0);
await espera("os seis idiomas têm as mesmas chaves (pt é o final; os outros cinco são rascunho marcado)", async () => {
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const pt = achatar(JSON.parse(lerTexto("i18n/rede/moderacao/pt.json"))).sort();
  const resultado = {};
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/moderacao/${l}.json`));
    const chaves = achatar(j).filter((k) => k !== "_rascunho").sort();
    resultado[l] = { iguais: JSON.stringify(chaves) === JSON.stringify(pt), rascunho: j._rascunho === true };
  }
  return resultado;
}, (r) => Object.values(r).every((x) => x.iguais && x.rascunho));
await espera("cada idioma mantém os {marcadores} do português", async () => {
  const marcadores = (t) => (t.match(/\{\w+\}/g) ?? []).sort().join("");
  const lerPares = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? lerPares(v, `${pre}${k}.`) : typeof v === "string" ? [[`${pre}${k}`, v]] : []));
  const pt = Object.fromEntries(lerPares(JSON.parse(lerTexto("i18n/rede/moderacao/pt.json"))));
  const erros = [];
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    for (const [k, v] of lerPares(JSON.parse(lerTexto(`i18n/rede/moderacao/${l}.json`)))) if (k in pt && marcadores(v) !== marcadores(pt[k])) erros.push(`${l}:${k}`);
  }
  return erros;
}, (e) => e.length === 0);
await espera("os códigos de erro do banco têm texto nos seis idiomas (pacote e Rede)", async () => {
  const codigos = ["modo_lento", "nivel_links", "nivel_imagens", "limite_diario", "lista_bloqueio", "outra_pessoa", "prazo_vencido", "recurso_ja_feito", "muitos_silenciados", "lista_cheia"];
  const faltam = [];
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const pacote = JSON.parse(lerTexto(`i18n/rede/moderacao/${l}.json`)).erros;
    const rede = JSON.parse(lerTexto(`i18n/rede/${l}.json`)).erros;
    for (const c of codigos) if (!pacote[c]) faltam.push(`${l}:pacote:${c}`);
    for (const c of ["modo_lento", "nivel_links", "nivel_imagens", "limite_diario", "lista_bloqueio"]) if (!rede[c]) faltam.push(`${l}:rede:${c}`);
  }
  return faltam;
}, (f) => f.length === 0);
await espera("as quatro rotas existem, guardam o recurso rede-v2 (404 desligado) e não são indexadas", async () => {
  const dir = "app/[lang]/comunidade";
  return ["moderacao", "denuncias", "silenciados", "cuidado"].map((r) => {
    const t = existe(`${dir}/${r}/page.tsx`) ? lerTexto(`${dir}/${r}/page.tsx`) : "";
    return { r, ok: /ligado\("rede-v2"\)/.test(t) && /notFound\(\)/.test(t) && /index: false/.test(t) && t.includes(`nome: "${r}"`) };
  });
}, (r) => r.every((x) => x.ok));
await espera("as telas estão no registro, com import dinâmico, e o cartão usa as ações de cuidado", async () => {
  const reg = lerTexto("components/rede/registro.tsx");
  const cartao = lerTexto("components/rede/CartaoDePost.tsx");
  return [["moderacao", "denuncias", "silenciados", "cuidado"].every((n) => new RegExp(`${n}: \\{ componente: dynamic\\(\\(\\) => import\\("\\./moderacao/`).test(reg)), cartao.includes("AcoesDeCuidado"), cartao.includes("RotuloDoPost")];
}, (r) => r[0] && r[1] && r[2]);
await espera("nenhuma tela usa alert, confirm ou prompt do navegador", async () => {
  const dir = "components/rede/moderacao";
  const achados = [];
  for (const arq of fs.readdirSync(new URL(`../${dir}`, import.meta.url))) {
    if (/(^|[^\w.])(alert|confirm|prompt)\(/.test(lerTexto(`${dir}/${arq}`).replace(/aria-|role="alert"/g, ""))) achados.push(arq);
  }
  return achados;
}, (a) => a.length === 0);
await espera("a rota de moderação só manda slug, título e veredito das checagens, e nada lê disco em componente global", async () => {
  const pagina = lerTexto("app/[lang]/comunidade/moderacao/page.tsx");
  const base = lerTexto("components/rede/moderacao/base.tsx");
  return [/getFactChecks\(lang\)\.map\(\(c\) => \[c\.slug, c\.title \?\? c\.claim, c\.verdict\]\)/.test(pagina), !/from "node:fs"|from "fs"/.test(base + lerTexto("components/rede/moderacao/NoCartao.tsx"))];
}, (r) => r[0] && r[1]);
await espera("os documentos existem e citam o STF (Temas 533 e 987), o art. 19 e o art. 21 do Marco Civil, a LGPD e a ECA Digital", async () => {
  const moderacao = existe("docs/rede/MODERACAO.md") ? lerTexto("docs/rede/MODERACAO.md") : "";
  const privacidade = existe("docs/rede/PRIVACIDADE.md") ? lerTexto("docs/rede/PRIVACIDADE.md") : "";
  return [/533/.test(moderacao) && /987/.test(moderacao) && /art\. 19/.test(moderacao) && /art\. 21/.test(moderacao), /13\.709/.test(privacidade) && /15\.211/.test(privacidade) && /art\. 11/i.test(privacidade), /30 dias/.test(moderacao)];
}, (r) => r[0] && r[1] && r[2]);

// ───────────────────────────── 13. Silenciar só no aparelho (lógica pura) ─────────────────────────────
const exemplo = { autor: { handle: "joana" }, titulo: null, texto: "Promoção de ÔNIBUS", comunidade: "moradia", raiz: "r1" };
await espera("silêncio local: por pessoa, palavra sem acento, comunidade e conversa", async () => [
  silenciadoNoAparelho(exemplo, [{ tipo: "pessoa", valor: "joana" }]),
  silenciadoNoAparelho(exemplo, [{ tipo: "palavra", valor: "onibus" }]),
  silenciadoNoAparelho(exemplo, [{ tipo: "comunidade", valor: "moradia" }]),
  silenciadoNoAparelho(exemplo, [{ tipo: "conversa", valor: "r1" }]),
  silenciadoNoAparelho(exemplo, [{ tipo: "pessoa", valor: "maria" }, { tipo: "palavra", valor: "x" }]),
], (r) => r[0] && r[1] && r[2] && r[3] && !r[4]);
await espera("silêncio local: o que venceu não vale; lista estranha vira vazia; gravar respeita o limite e o armazenamento bloqueado", async () => {
  const velho = silenciadoNoAparelho(exemplo, [{ tipo: "pessoa", valor: "joana", ate: "2020-01-01T00:00:00Z" }], Date.parse("2026-01-01"));
  const memoria = new Map();
  const armazem = { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v) };
  const gravou = gravarSilenciosLocais(armazem, Array.from({ length: 300 }, (_, i) => ({ tipo: "palavra", valor: `p${i}` })));
  const lida = lerSilenciosLocais(armazem);
  memoria.set("lucia:rede:silenciados", "{isto não é json");
  const estranha = lerSilenciosLocais(armazem);
  memoria.set("lucia:rede:silenciados", JSON.stringify([{ tipo: "hackear", valor: "x" }, { tipo: "pessoa", valor: "ok" }, 7]));
  const filtrada = lerSilenciosLocais(armazem);
  const bloqueado = gravarSilenciosLocais({ setItem() { throw new Error("bloqueado"); } }, []);
  return [velho, gravou, lida.length, estranha.length, filtrada.length, bloqueado, lerSilenciosLocais(null).length];
}, (r) => r[0] === false && r[1] === true && r[2] === 200 && r[3] === 0 && r[4] === 1 && r[5] === false && r[6] === 0);

console.log(`Rede v2 (moderação): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
