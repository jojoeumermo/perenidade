// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o pacote avisos da Rede v2 (supabase/migracoes/2026-11-rede-avisos.sql, supabase/functions/_shared/push.mjs, public/sw.js,
// components/rede/avisos) num Postgres de verdade dentro do Node: o aviso de resposta que a fundação grava vira grupo ("Fulana e
// mais 2 responderam"), o apoio só mostra a quantidade, cada aviso passa pela matriz de visibilidade, bloqueio e silêncio valem,
// a moderação nunca se desliga, as preferências mandam, o resumo semanal nasce desligado e só leva contagens e títulos públicos,
// o aviso no celular só aceita serviço de entrega conhecido e só leva o número. Também confere a cifra do Web Push (RFC 8291) com
// um receptor escrito à parte, a assinatura VAPID, os textos nos seis idiomas e o service worker. Uso: npm run testar:rede-avisos
import crypto from "node:crypto";
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import { cifrar, assinarVapid, conteudoDoAviso, deBase64Url, paraBase64Url, rodada as rodadaDePush } from "../supabase/functions/_shared/push.mjs";
import { fraseDoAviso, TIPOS_DE_AVISO } from "../lib/rede/tipos-avisos.ts";

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

const lerTexto = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const banco = await criarBanco({ semRede: true });
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];
const todos = async (texto, valores = []) => (await dono(texto, valores)).rows;

// Todas as migrações da Rede que existem, na ordem de docs/rede/V2.md.
const ORDEM = ["fundacao", "consertos", "perfil", "publicar", "conversa", "descoberta", "comunidades", "avisos", "moderacao"];
const migracoes = ORDEM.map((n) => `supabase/migracoes/2026-11-rede-${n}.sql`).filter((c) => fs.existsSync(new URL(`../${c}`, import.meta.url)));
for (const caminho of migracoes) await espera(`a migração ${caminho.split("/").pop()} instala`, () => banco.exclusivo(() => banco.pg.exec(lerTexto(caminho))));
const avisosSql = lerTexto("supabase/migracoes/2026-11-rede-avisos.sql");
await espera("instalar o pacote avisos de novo não quebra", () => banco.exclusivo(() => banco.pg.exec(avisosSql)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++}` });
const servico = () => ({ papel: "service_role", ip: `198.51.100.${ip++}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++}` });

// ── As pessoas ──
const pessoas = {};
const nomes = ["autor", "ana", "bia", "caio", "dora", "eva", "nova", "semconta", "invisivel"];
for (const [i, nome] of nomes.entries()) {
  pessoas[nome] = await criarUsuario(`${nome}@avisos.local`, nome);
  await rpc(como(pessoas[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true where id = $1", [pessoas[nome], `Lutadora${i + 1}${nome}`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "semconta")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [pessoas[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1)", [pessoas[nome]]);
}
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [pessoas.invisivel]);
// Contas velhas: o teto de posts por hora é cheio.
await dono("update auth.users set created_at = now() - interval '30 days'");
const codinome = (nome) => `Lutadora${nomes.indexOf(nome) + 1}${nome}`;

const postar = async (campos, autor = pessoas.autor, texto = "texto do post de teste") => {
  const colunas = Object.keys(campos);
  return (await um(`insert into interno.rede_posts (autor, texto, ${colunas.join(", ")}) values ($1, $2, ${colunas.map((_, i) => `$${i + 3}`).join(", ")}) returning id`, [autor, texto, ...Object.values(campos)])).id;
};
const listar = (nome, args = {}) => rpc(como(pessoas[nome]), "rede_aviso_listar", args);
const limpar = () => dono("delete from interno.avisos");

// ── 1. O aviso de resposta que a fundação grava vira um grupo ──
const post1 = await postar({ publico: "membros" });
const respostaDe = async (nome, texto, pai = post1) => rpc(como(pessoas[nome]), "rede_publicar", { p: { texto, resposta_a: pai } });
await espera("a resposta pelo caminho de sempre grava o aviso com tipo, post, alvo e ator (e o texto antigo fica, para a Rede de hoje)", async () => {
  await limpar();
  const r = await respostaDe("ana", "Concordo muito com você, SEGREDO-DA-RESPOSTA.");
  const linha = await um("select tipo, post, alvo, ator, texto, categoria from interno.avisos where para = $1", [pessoas.autor]);
  return { linha, r };
}, ({ linha, r }) => linha.tipo === "resposta" && linha.post === post1 && linha.alvo === r.id && linha.ator === pessoas.ana && linha.categoria === "rede" && linha.texto.includes("respondeu ao seu post na Rede Lúcia"));
await espera("a lista traz um item de resposta com o codinome, sem nenhum trecho do texto", async () => {
  const r = await listar("autor");
  return r;
}, (r) => r.itens.length === 1 && r.itens[0].tipo === "resposta" && r.itens[0].total === 1 && r.itens[0].pessoas === 1 && r.itens[0].atores[0] === codinome("ana") && r.itens[0].texto === null && !JSON.stringify(r).includes("SEGREDO-DA-RESPOSTA") && r.nao_lidos === 1);
await espera("três pessoas respondendo ao mesmo post viram UM grupo: total 3, 3 pessoas, 2 nomes", async () => {
  await respostaDe("bia", "Também acho.");
  await respostaDe("caio", "Eu também.");
  return listar("autor");
}, (r) => r.itens.length === 1 && r.itens[0].total === 3 && r.itens[0].pessoas === 3 && r.itens[0].atores.length === 2 && r.itens[0].post === post1);
await espera("a mesma pessoa respondendo duas vezes: 4 avisos, 3 pessoas", async () => {
  await respostaDe("ana", "Só mais uma coisa.");
  return listar("autor");
}, (r) => r.itens[0].total === 4 && r.itens[0].pessoas === 3);
const post2 = await postar({ publico: "membros" });
await espera("resposta a outro post é outro grupo; o mais novo vem primeiro", async () => {
  await respostaDe("bia", "Outra conversa.", post2);
  return listar("autor");
}, (r) => r.itens.length === 2 && r.itens[0].post === post2 && r.itens[1].post === post1);
await espera("quem responde ao próprio post não avisa a si mesmo", async () => {
  const antes = (await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.autor])).n;
  await respostaDe("autor", "Eu mesmo respondo.", post1);
  return (await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.autor])).n === antes;
});

// ── 2. Apoio: só a quantidade ──
await limpar();
const post3 = await postar({ publico: "membros" });
await espera("um apoio vira aviso 'apoio' sem nome", async () => {
  await rpc(como(pessoas.bia), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: true });
  return listar("autor");
}, (r) => r.itens.length === 1 && r.itens[0].tipo === "apoio" && r.itens[0].total === 1 && Array.isArray(r.itens[0].atores) && r.itens[0].atores.length === 0 && r.itens[0].texto === null);
await espera("três apoios: um grupo de 3, e a resposta inteira nunca cita quem apoiou", async () => {
  await rpc(como(pessoas.caio), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: true });
  await rpc(como(pessoas.dora), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: true });
  return listar("autor");
}, (r) => r.itens[0].total === 3 && r.itens[0].pessoas === 3 && !JSON.stringify(r).includes(codinome("bia")) && !JSON.stringify(r).includes(codinome("caio")) && !JSON.stringify(r).includes(codinome("dora")) && !JSON.stringify(r).includes(pessoas.bia));
await espera("apoiar de novo (ou ligar e desligar) não soma aviso", async () => {
  await rpc(como(pessoas.bia), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: true });
  await rpc(como(pessoas.bia), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: false });
  await rpc(como(pessoas.bia), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: true });
  return listar("autor");
}, (r) => r.itens[0].total === 3);
await espera("desfazer o apoio tira o aviso: quem apoiou não deixa rastro", async () => {
  await rpc(como(pessoas.caio), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: false });
  return [await listar("autor"), (await um("select count(*)::int as n from interno.avisos where tipo = 'apoio' and ator = $1", [pessoas.caio])).n];
}, ([r, n]) => r.itens[0].total === 2 && n === 0);
await espera("apoiar o próprio post não gera aviso (e a própria Rede já não deixa)", async () => {
  const antes = (await um("select count(*)::int as n from interno.avisos")).n;
  await rpc(como(pessoas.autor), "rede_reagir", { p_post: post3, p_tipo: "apoio", p_sim: true }).catch(() => undefined);
  await dono("insert into interno.rede_reacoes (post, usuario, tipo) values ($1, $2, 'apoio') on conflict do nothing", [post3, pessoas.autor]);
  return (await um("select count(*)::int as n from interno.avisos")).n === antes;
});

// ── 3. A matriz vale para o aviso ──
await limpar();
const post4 = await postar({ publico: "membros" });
const resposta4 = await postar({ publico: "membros", resposta_a: post4 }, pessoas.ana, "resposta que vai sumir");
await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $3, $4, null)", [pessoas.autor, post4, resposta4, pessoas.ana]);
await espera("aviso de resposta visível aparece", () => listar("autor"), (r) => r.itens.length === 1);
await espera("resposta removida pela moderação: o aviso some (a matriz manda)", async () => {
  await dono("update interno.rede_posts set oculto = true where id = $1", [resposta4]);
  return listar("autor");
}, (r) => r.itens.length === 0 && r.nao_lidos === 0);
await dono("update interno.rede_posts set oculto = false, retido = true where id = $1", [resposta4]);
await espera("resposta retida para revisão: o aviso também some", () => listar("autor"), (r) => r.itens.length === 0);
await dono("update interno.rede_posts set retido = false, apagado_em = now() where id = $1", [resposta4]);
await espera("resposta apagada: o aviso também some", () => listar("autor"), (r) => r.itens.length === 0);
await limpar();
const postEquipe = await postar({ publico: "equipe" }, pessoas.ana);
await dono("select interno.rede3_aviso_criar($1, 'mencao', $2, $2, $3, null)", [pessoas.bia, postEquipe, pessoas.ana]);
await espera("menção em post só da equipe: quem não pode ver o post não vê o aviso", () => listar("bia"), (r) => r.itens.length === 0 && r.nao_lidos === 0);
await espera("o resumo e o contador também respeitam a matriz", async () => [await rpc(como(pessoas.bia), "rede_aviso_contar"), (await rpc(como(pessoas.bia), "rede_aviso_resumo_ver")).n], ([c, n]) => c === 0 && n === 0);
const postDoSilencio = await postar({ publico: "membros" }, pessoas.ana, "post de quem será silenciado");
await dono("select interno.rede3_aviso_criar($1, 'mencao', $2, $2, $3, null)", [pessoas.caio, postDoSilencio, pessoas.ana]);
await espera("menção em post visível aparece", () => listar("caio"), (r) => r.itens.length === 1 && r.itens[0].tipo === "mencao");
await espera("pessoa silenciada por mim: o aviso dela some", async () => {
  await dono("insert into interno.rede_silenciados (usuario, pessoa) values ($1, $2)", [pessoas.caio, pessoas.ana]);
  return listar("caio");
}, (r) => r.itens.length === 0);
await dono("delete from interno.rede_silenciados");
await espera("pessoa bloqueada: não nasce aviso dela (nem para quem bloqueou, nem para quem foi bloqueada)", async () => {
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [pessoas.dora, pessoas.eva]);
  const antes = (await um("select count(*)::int as n from interno.avisos")).n;
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [pessoas.dora, pessoas.eva]);
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [pessoas.eva, pessoas.dora]);
  return (await um("select count(*)::int as n from interno.avisos")).n === antes;
});
await dono("delete from interno.rede_bloqueios");
await espera("conta suspensa não recebe aviso", async () => {
  await dono("update interno.perfis set suspenso = true where id = $1", [pessoas.nova]);
  const antes = (await um("select count(*)::int as n from interno.avisos")).n;
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [pessoas.nova, pessoas.ana]);
  await dono("update interno.perfis set suspenso = false where id = $1", [pessoas.nova]);
  return (await um("select count(*)::int as n from interno.avisos")).n === antes;
});
await espera("seguidores agrupam: 'Fulana e mais 1'; quem tem o perfil invisível aparece sem nome", async () => {
  await limpar();
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [pessoas.autor, pessoas.ana]);
  await dono("select interno.rede3_aviso_criar($1, 'seguidor', null, null, $2, null)", [pessoas.autor, pessoas.invisivel]);
  return listar("autor");
}, (r) => r.itens.length === 1 && r.itens[0].tipo === "seguidor" && r.itens[0].pessoas === 2 && r.itens[0].atores.length === 2 && r.itens[0].atores.includes(null) && !JSON.stringify(r).includes(codinome("invisivel")));
await espera("moderação não depende do post: um aviso de moderação sobre post removido ainda chega, com o texto escrito pela moderação", async () => {
  await limpar();
  const removido = await postar({ publico: "membros", oculto: true }, pessoas.autor);
  await dono("select interno.rede3_aviso_criar($1, 'moderacao', $2, null, null, $3)", [pessoas.autor, removido, "Seu post foi retirado (protocolo ABC123). Você pode recorrer."]);
  return listar("autor");
}, (r) => r.itens.length === 1 && r.itens[0].tipo === "moderacao" && r.itens[0].texto.includes("ABC123") && r.itens[0].titulo === null);
await espera("aviso antigo de texto (sem estrutura) continua aparecendo, com o texto", async () => {
  await limpar();
  await dono("select interno.avisar_em($1, 'Um novo aparelho entrou na sua conta.', 'conta')", [pessoas.autor]);
  await dono("select interno.avisar_em($1, 'Você entrou em “Moradia”.', 'rede')", [pessoas.autor]);
  return listar("autor");
}, (r) => r.itens.length === 2 && r.itens.every((i) => i.tipo === null && i.texto));
await espera("o sino da equipe (categoria 'equipe') nunca aparece na Rede", async () => {
  await dono("select interno.avisar($1, 'Foto para aprovar (sino da equipe).')", [pessoas.autor]);
  return listar("autor");
}, (r) => r.itens.length === 2 && !JSON.stringify(r).includes("sino da equipe"));

// ── 4. Páginas, contador e ler ──
await limpar();
const pais = [];
for (let i = 0; i < 5; i++) {
  const p = await postar({ publico: "membros" });
  pais.push(p);
  await dono("select interno.rede3_aviso_criar($1, 'citacao', $2, $2, $3, null)", [pessoas.autor, p, pessoas.ana]);
  await dono("update interno.avisos set criado_em = now() - make_interval(mins => $1) where post = $2", [10 - i, p]);
}
await espera("paginação por cursor: páginas de 2, sem repetir nem perder nenhum dos 5 grupos", async () => {
  const vistos = [];
  let cursor = null;
  for (let n = 0; n < 6; n++) {
    const pagina = await listar("autor", { p_cursor: cursor, p_limite: 2 });
    vistos.push(...pagina.itens.map((i) => i.post));
    cursor = pagina.proximo;
    if (!cursor) break;
  }
  return vistos;
}, (v) => v.length === 5 && new Set(v).size === 5 && v[0] === pais[4]);
await recusa("cursor malformado é recusado", () => listar("autor", { p_cursor: "x'; drop", p_limite: 2 }), "invalido:cursor");
await espera("contar devolve o número de grupos não lidos", () => rpc(como(pessoas.autor), "rede_aviso_contar"), (n) => n === 5);
await espera("ler marca o grupo (e só ele)", async () => {
  const pagina = await listar("autor", { p_limite: 1 });
  const r = await rpc(como(pessoas.autor), "rede_aviso_ler", { p_id: pagina.itens[0].id });
  return r;
}, (r) => r.ok && r.nao_lidos === 4);
await recusa("ler aviso alheio é recusado", async () => rpc(como(pessoas.ana), "rede_aviso_ler", { p_id: (await um("select id from interno.avisos where para = $1 limit 1", [pessoas.autor])).id }), "nao_encontrado");
await espera("ler tudo zera o contador", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_ler", {});
  return rpc(como(pessoas.autor), "rede_aviso_contar");
}, (n) => n === 0);
await espera("ler um grupo marca todos os avisos dele de uma vez", async () => {
  await limpar();
  const p = await postar({ publico: "membros" });
  for (const quem of ["ana", "bia", "caio"]) await dono("select interno.rede3_aviso_criar($1, 'citacao', $2, $2, $3, null)", [pessoas.autor, p, pessoas[quem]]);
  const pagina = await listar("autor");
  await rpc(como(pessoas.autor), "rede_aviso_ler", { p_id: pagina.itens[0].id });
  return (await um("select count(*)::int as n from interno.avisos where not lido")).n;
}, (n) => n === 0);

// ── 5. Preferências ──
await limpar();
await espera("padrões: site ligado, celular e resumo desligados", () => rpc(como(pessoas.ana), "rede_aviso_prefs_ver"), (p) => TIPOS_DE_AVISO.every((t) => p.site[t] === true && p.push[t] === false) && p.resumo === false && p.push_aparelhos === 0 && p.membro === true);
await espera("desligar 'apoio' no site: apoios novos não viram aviso", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "apoio", p_canal: "site", p_ligado: false });
  const p = await postar({ publico: "membros" });
  await rpc(como(pessoas.bia), "rede_reagir", { p_post: p, p_tipo: "apoio", p_sim: true });
  return (await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.autor])).n;
}, (n) => n === 0);
await espera("desligar 'resposta' no site: a resposta pelo caminho de sempre não vira aviso", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resposta", p_canal: "site", p_ligado: false });
  const p = await postar({ publico: "membros" });
  await respostaDe("ana", "Resposta que não avisa.", p);
  return (await um("select count(*)::int as n from interno.avisos where para = $1", [pessoas.autor])).n;
}, (n) => n === 0);
await recusa("a moderação no site não se desliga", () => rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "moderacao", p_canal: "site", p_ligado: false }), "invalido:tipo");
await espera("moderação segue chegando mesmo com tudo desligado", async () => {
  await dono("select interno.rede3_aviso_criar($1, 'moderacao', null, null, null, 'Sua denúncia DEF456 andou: em análise.')", [pessoas.autor]);
  return (await um("select count(*)::int as n from interno.avisos where para = $1 and tipo = 'moderacao'", [pessoas.autor])).n;
}, (n) => n === 1);
await recusa("tipo inventado", () => rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "spam", p_canal: "site", p_ligado: true }), "invalido:tipo");
await recusa("canal inventado", () => rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resposta", p_canal: "sms", p_ligado: true }), "invalido:canal");
await recusa("e-mail só existe para o resumo", () => rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resposta", p_canal: "email", p_ligado: true }), "invalido:canal");
await recusa("o resumo só existe por e-mail", () => rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resumo", p_canal: "site", p_ligado: true }), "invalido:canal");
await recusa("quem não entrou na Rede não liga e-mail", () => rpc(como(pessoas.semconta), "rede_aviso_prefs_salvar", { p_tipo: "resumo", p_canal: "email", p_ligado: true }), "consentimento");
await recusa("visitante não vê preferências", () => rpc(visitante(), "rede_aviso_prefs_ver"), "permission denied");
await espera("conta sem Rede ainda lê os próprios avisos da conta", async () => {
  await dono("select interno.avisar_em($1, 'Alerta de segurança da conta.', 'conta')", [pessoas.semconta]);
  return listar("semconta");
}, (r) => r.itens.length === 1);
await rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "apoio", p_canal: "site", p_ligado: true });
await rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resposta", p_canal: "site", p_ligado: true });

// ── 6. Resumo semanal por e-mail ──
await limpar();
await dono("delete from interno.emails");
await dono("update interno.configuracoes set valor = valor where chave = 'email'");
const tituloPublico = "Como calcular a área de um terreno https://golpe.example/x";
const publico1 = await postar({ publico: "internet", comunidade: "matematica", tipo: "duvida", titulo: tituloPublico }, pessoas.autor, "texto interno SEGREDO-DO-POST-PUBLICO");
const privado1 = await postar({ publico: "membros", tipo: "discussao", titulo: "Título de conversa só para membros" }, pessoas.autor, "texto SEGREDO-DO-POST-PRIVADO");
await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $2, $3, null)", [pessoas.autor, publico1, pessoas.ana]);
await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $2, $3, null)", [pessoas.autor, privado1, pessoas.bia]);
await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $2, $3, null)", [pessoas.autor, privado1, pessoas.caio]);
await dono("select interno.rede3_aviso_criar($1, 'apoio', $2, null, $3, null)", [pessoas.autor, privado1, pessoas.dora]);
await espera("a prévia do resumo leva contagens e só o título PÚBLICO, sem link, sem nome, sem texto de post", async () => (await rpc(como(pessoas.autor), "rede_aviso_resumo_ver")), (r) =>
  r.n === 4 && r.texto.includes("3 respostas") && r.texto.includes("1 apoio") && r.texto.includes("Como calcular a área de um terreno") && !r.texto.includes("golpe.example") && !r.texto.includes("https://golpe")
  && !r.texto.includes("Título de conversa só para membros") && !r.texto.includes("SEGREDO") && !Object.keys(pessoas).some((n) => r.texto.includes(codinome(n))) && r.texto.includes("/pt/comunidade/avisos"));
await espera("desligado por padrão: a rotina semanal não manda nada", async () => {
  const n = (await um("select interno.rede3_aviso_resumo_semanal() as n")).n;
  return [n, (await um("select count(*)::int as n from interno.emails where tipo = 'rede_resumo'")).n];
}, ([n, f]) => n === 0 && f === 0);
await espera("ligado: a rotina semanal enfileira UM e-mail com a mesma coisa, e o link de saída aponta para as preferências", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resumo", p_canal: "email", p_ligado: true });
  const n = (await um("select interno.rede3_aviso_resumo_semanal() as n")).n;
  const e = await um("select para, assunto, texto, sair, status from interno.emails where tipo = 'rede_resumo'");
  return { n, e };
}, ({ n, e }) => n === 1 && e.para === "autor@avisos.local" && e.status === "pendente" && e.texto.includes("3 respostas") && !e.texto.includes("SEGREDO") && !e.texto.includes("golpe.example") && e.sair.endsWith("/pt/comunidade/avisos"));
await espera("na mesma semana não manda outro", async () => (await um("select interno.rede3_aviso_resumo_semanal() as n")).n, (n) => n === 0);
await espera("quem leu tudo não recebe resumo vazio", async () => {
  await dono("delete from interno.emails");
  await rpc(como(pessoas.autor), "rede_aviso_ler", {});
  return [(await um("select interno.rede3_aviso_resumo_semanal() as n")).n, (await rpc(como(pessoas.autor), "rede_aviso_resumo_ver")).n];
}, ([n, v]) => n === 0 && v === 0);
await espera("quem desligou o e-mail 'rede_resumo' em Minha conta também não recebe", async () => {
  await dono("update interno.avisos set lido = false");
  await dono("update interno.perfis set emails_desligados = array['rede_resumo'] where id = $1", [pessoas.autor]);
  const n = (await um("select interno.rede3_aviso_resumo_semanal() as n")).n;
  await dono("update interno.perfis set emails_desligados = '{}' where id = $1", [pessoas.autor]);
  return n;
}, (n) => n === 0);
await espera("desligar o resumo para de mandar", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_prefs_salvar", { p_tipo: "resumo", p_canal: "email", p_ligado: false });
  return (await um("select interno.rede3_aviso_resumo_semanal() as n")).n;
}, (n) => n === 0);
await espera("a faxina semanal apaga o que foi lido há mais de 120 dias", async () => {
  await dono("update interno.avisos set lido = true, criado_em = now() - interval '130 days' where para = $1", [pessoas.autor]);
  await dono("select interno.rede3_aviso_resumo_semanal()");
  return (await um("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'rede'", [pessoas.autor])).n;
}, (n) => n === 0);

// ── 7. Aviso no celular ──
await limpar();
const par = crypto.createECDH("prime256v1");
par.generateKeys();
const chaveAparelho = paraBase64Url(par.getPublicKey());
const segredoAuth = paraBase64Url(crypto.randomBytes(16));
const endpoint = "https://fcm.googleapis.com/fcm/send/abcdefghijklmnopqrstuvwxyz0123456789";
await recusa("endereço fora dos serviços de entrega conhecidos é recusado (o servidor chama esse endereço)", () => rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: "https://evil.example.com/push/abc", p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }), "invalido:endpoint");
await recusa("endereço interno é recusado", () => rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: "https://169.254.169.254/latest/meta-data", p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }), "invalido:endpoint");
await recusa("endereço http é recusado", () => rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: "http://fcm.googleapis.com/fcm/send/abc", p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }), "invalido:endpoint");
await recusa("domínio parecido (fcm.googleapis.com.evil.com) é recusado", () => rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: "https://fcm.googleapis.com.evil.com/x", p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }), "invalido:endpoint");
await recusa("chave malformada é recusada", () => rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: "curta", p_auth: segredoAuth, p_lang: "pt" }), "invalido:chave");
await recusa("quem não entrou na Rede não liga o celular", () => rpc(como(pessoas.semconta), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }), "consentimento");
await recusa("visitante não assina", () => rpc(visitante(), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }), "permission denied");
await espera("assinar guarda o aparelho e liga o celular para resposta, menção, chamado e moderação", async () => rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "en" }),
  (p) => p.push_aparelhos === 1 && p.push.resposta && p.push.mencao && p.push.moderacao && p.push.chamado && !p.push.apoio && !p.push.seguidor);
await espera("assinar de novo o mesmo aparelho não duplica", async () => { await rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" }); return (await um("select count(*)::int as n from interno.rede_push_assinaturas")).n; }, (n) => n === 1);
await espera("a assinatura não aparece em nenhuma função de leitura (nem para a própria pessoa)", async () => JSON.stringify([await rpc(como(pessoas.autor), "rede_aviso_prefs_ver"), await listar("autor")]), (j) => !j.includes("fcm.googleapis") && !j.includes(chaveAparelho) && !j.includes(segredoAuth));
await espera("limite de 5 aparelhos por pessoa", async () => {
  for (let i = 0; i < 4; i++) await rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: `https://fcm.googleapis.com/fcm/send/outro-aparelho-numero-${i}-xxxxxxxxxxxx`, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" });
  try {
    await rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: "https://fcm.googleapis.com/fcm/send/sexto-aparelho-xxxxxxxxxxxxxxxx", p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" });
    return "passou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("invalido:aparelhos"));
await dono("delete from interno.rede_push_assinaturas where endpoint <> $1", [endpoint]);
await recusa("quem não é o serviço não chama a fila do envio", () => rpc(como(pessoas.autor), "rede_aviso_push_pendentes", {}), "permission denied");
await recusa("o resultado do envio também é só do serviço", () => rpc(como(pessoas.autor), "rede_aviso_push_resultado", { p_id: "00000000-0000-0000-0000-000000000000", p_ok: true }), "permission denied");
await espera("sem aviso novo, a fila do envio vem vazia", () => rpc(servico(), "rede_aviso_push_pendentes", {}), (r) => Array.isArray(r) && r.length === 0);
const postPush = await postar({ publico: "membros" });
await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $2, $3, null)", [pessoas.autor, postPush, pessoas.ana]);
await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $2, $3, null)", [pessoas.autor, postPush, pessoas.bia]);
await dono("select interno.rede3_aviso_criar($1, 'apoio', $2, null, $3, null)", [pessoas.autor, postPush, pessoas.caio]);
let paraEnviar;
await espera("aviso novo: a fila leva o aparelho com o NÚMERO de grupos e o idioma, e nada do texto", async () => {
  paraEnviar = await rpc(servico(), "rede_aviso_push_pendentes", {});
  return paraEnviar;
}, (r) => r.length === 1 && r[0].endpoint === endpoint && r[0].n === 2 && r[0].lang === "pt" && Object.keys(r[0]).sort().join() === "auth,endpoint,id,lang,n,p256dh" && !JSON.stringify(r).includes(codinome("ana")));
await espera("os avisos já empurrados não saem de novo (nem antes dos 10 minutos)", () => rpc(servico(), "rede_aviso_push_pendentes", {}), (r) => r.length === 0);
await espera("aviso de tipo que a pessoa não ligou para o celular (apoio) não dispara sozinho", async () => {
  await dono("update interno.rede_push_assinaturas set ultimo_envio = now() - interval '1 hour'");
  const p = await postar({ publico: "membros" });
  await dono("select interno.rede3_aviso_criar($1, 'apoio', $2, null, $3, null)", [pessoas.autor, p, pessoas.dora]);
  return rpc(servico(), "rede_aviso_push_pendentes", {});
}, (r) => r.length === 0);
await espera("aviso lido antes do envio não vira aviso no celular", async () => {
  const p = await postar({ publico: "membros" });
  await dono("select interno.rede3_aviso_criar($1, 'resposta', $2, $2, $3, null)", [pessoas.autor, p, pessoas.dora]);
  await rpc(como(pessoas.autor), "rede_aviso_ler", {});
  return rpc(servico(), "rede_aviso_push_pendentes", {});
}, (r) => r.length === 0);
await espera("resultado 410: o aparelho que não existe mais é apagado", async () => {
  await rpc(servico(), "rede_aviso_push_resultado", { p_id: paraEnviar[0].id, p_ok: false, p_gone: true });
  return (await um("select count(*)::int as n from interno.rede_push_assinaturas")).n;
}, (n) => n === 0);
await espera("falhas repetidas (5) também apagam o aparelho", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" });
  const id = (await um("select id from interno.rede_push_assinaturas")).id;
  for (let i = 0; i < 5; i++) await rpc(servico(), "rede_aviso_push_resultado", { p_id: id, p_ok: false });
  return (await um("select count(*)::int as n from interno.rede_push_assinaturas")).n;
}, (n) => n === 0);
await espera("cancelar apaga a assinatura do aparelho", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" });
  const r = await rpc(como(pessoas.autor), "rede_aviso_push_cancelar", { p_endpoint: endpoint });
  return r;
}, (r) => r.removidos === 1 && r.push_aparelhos === 0);
await espera("cancelar o aparelho de outra pessoa não faz nada", async () => {
  await rpc(como(pessoas.autor), "rede_aviso_push_assinar", { p_endpoint: endpoint, p_p256dh: chaveAparelho, p_auth: segredoAuth, p_lang: "pt" });
  const r = await rpc(como(pessoas.ana), "rede_aviso_push_cancelar", { p_endpoint: endpoint });
  return [r.removidos, (await um("select count(*)::int as n from interno.rede_push_assinaturas")).n];
}, ([r, n]) => r === 0 && n === 1);
await espera("apagar a conta apaga as assinaturas (cascata)", async () => {
  await dono("delete from interno.perfis where id = $1", [pessoas.autor]).catch(() => undefined);
  return (await um("select count(*)::int as n from interno.rede_push_assinaturas")).n;
}, (n) => n === 0);

// ── 7b. Aviso antigo com trecho de post no texto: o trecho nunca sai ──
await espera('aviso antigo sem estrutura não vaza trecho de post', async () => {
  await dono("insert into interno.avisos (para, texto, categoria) values ($1, 'Fulana respondeu ao seu post na Rede Lúcia: “segredo do post”', 'rede'), ($1, 'Sua resposta foi marcada como a que resolveu a dúvida “titulo secreto” na Rede Lúcia.', 'rede')", [pessoas.ana]);
  const r = await listar('ana', { p_limite: 50 });
  return JSON.stringify(r);
}, (j) => !j.includes('segredo do post') && !j.includes('titulo secreto') && j.includes('Alguém respondeu ao seu post na Rede Lúcia.'));

// ── 8. Permissões ──
await recusa("visitante não lista avisos", () => rpc(visitante(), "rede_aviso_listar", {}), "permission denied");
await recusa("visitante não conta avisos", () => rpc(visitante(), "rede_aviso_contar", {}), "permission denied");
for (const funcao of ["rede3_aviso_criar", "rede3_aviso_grupos", "rede3_aviso_resumo", "rede3_aviso_resumo_semanal", "rede3_push_disparar"]) {
  await espera(`função interna ${funcao} não é chamável de fora`, () => banco.exclusivo(async () => {
    await banco.pg.exec("set role authenticated");
    try {
      const args = { rede3_aviso_criar: "null, 'resposta', null, null, null", rede3_aviso_grupos: "null", rede3_aviso_resumo: "null" }[funcao] ?? "";
      await banco.pg.query(`select interno.${funcao}(${args})`);
      return "passou";
    } catch (e) {
      return e.message;
    } finally {
      await banco.pg.exec("reset role");
    }
  }), (m) => m.includes("permission denied"));
}
await espera("a tabela das assinaturas não é lida de fora", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try {
    await banco.pg.query("select * from interno.rede_push_assinaturas");
    return "passou";
  } catch (e) {
    return e.message;
  } finally {
    await banco.pg.exec("reset role");
  }
}), (m) => m.includes("permission denied"));
await espera("nenhuma tabela nova no esquema public", async () => (await todos("select tablename from pg_tables where schemaname = 'public' and tablename like 'rede%'")).length, (n) => n === 0);
await espera("a tabela das assinaturas tem RLS ligada", async () => (await um("select relrowsecurity as r from pg_class where oid = 'interno.rede_push_assinaturas'::regclass")).r, (r) => r === true);

// ── 9. Web Push: cifra (RFC 8291), VAPID (RFC 8292) e rodada ──
/** Um receptor escrito à parte, só com node:crypto, que decifra o corpo como o navegador faria. */
function decifrarComoOAparelho(corpo, ecdhDoAparelho, authSecret) {
  const sal = corpo.subarray(0, 16);
  const rs = corpo.readUInt32BE(16);
  const idlen = corpo[20];
  const chaveServidor = corpo.subarray(21, 21 + idlen);
  const cifrado = corpo.subarray(21 + idlen);
  const segredo = ecdhDoAparelho.computeSecret(chaveServidor);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), ecdhDoAparelho.getPublicKey(), chaveServidor]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", segredo, authSecret, info, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, sal, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, sal, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(cifrado.subarray(cifrado.length - 16));
  const aberto = Buffer.concat([d.update(cifrado.subarray(0, cifrado.length - 16)), d.final()]);
  return { rs, idlen, texto: aberto.subarray(0, aberto.lastIndexOf(2)).toString("utf8"), delimitador: aberto[aberto.length - 1] };
}
await espera("a cifra do Web Push (aes128gcm) é decifrada por um receptor independente, com o molde {n, l}", async () => {
  const corpo = Buffer.from(await cifrar(conteudoDoAviso(7, "es"), chaveAparelho, segredoAuth));
  return decifrarComoOAparelho(corpo, par, deBase64Url(segredoAuth));
}, (r) => r.rs === 4096 && r.idlen === 65 && r.delimitador === 2 && JSON.parse(r.texto).n === 7 && JSON.parse(r.texto).l === "es" && Object.keys(JSON.parse(r.texto)).sort().join() === "l,n");
await espera("cada envio usa sal e chave novos (dois envios do mesmo conteúdo diferem)", async () => {
  const a = Buffer.from(await cifrar(conteudoDoAviso(1, "pt"), chaveAparelho, segredoAuth));
  const b = Buffer.from(await cifrar(conteudoDoAviso(1, "pt"), chaveAparelho, segredoAuth));
  return !a.equals(b);
});
await espera("o conteúdo do aviso só leva número (limitado a 99) e idioma conhecido", async () => [JSON.parse(new TextDecoder().decode(conteudoDoAviso(500, "xx"))), JSON.parse(new TextDecoder().decode(conteudoDoAviso(-3, "ru"))), JSON.parse(new TextDecoder().decode(conteudoDoAviso("texto de post", "zh")))],
  ([a, b, c]) => a.n === 99 && a.l === "pt" && b.n === 0 && b.l === "ru" && c.n === 0);
await espera("a assinatura VAPID (ES256) confere com a chave pública, com a audiência certa", async () => {
  const vapid = crypto.createECDH("prime256v1");
  vapid.generateKeys();
  const publica = paraBase64Url(vapid.getPublicKey());
  const privada = paraBase64Url(vapid.getPrivateKey());
  const jwt = await assinarVapid({ endpoint, chavePublica: publica, chavePrivada: privada, assunto: "mailto:institutolucia@tutamail.com", agora: 1_800_000_000_000 });
  const [cabeca, corpo, assinatura] = jwt.split(".");
  const chave = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: paraBase64Url(vapid.getPublicKey().subarray(1, 33)), y: paraBase64Url(vapid.getPublicKey().subarray(33)) }, format: "jwk" });
  const confere = crypto.verify("sha256", Buffer.from(`${cabeca}.${corpo}`), { key: chave, dsaEncoding: "ieee-p1363" }, deBase64Url(assinatura));
  return { confere, cabeca: JSON.parse(Buffer.from(deBase64Url(cabeca)).toString()), corpo: JSON.parse(Buffer.from(deBase64Url(corpo)).toString()) };
}, (r) => r.confere && r.cabeca.alg === "ES256" && r.corpo.aud === "https://fcm.googleapis.com" && r.corpo.exp === 1_800_000_000 + 43200 && r.corpo.sub.startsWith("mailto:"));
await espera("a rodada de envio usa o banco e devolve o resultado de cada um (ok, 410, falha)", async () => {
  const vapid = crypto.createECDH("prime256v1");
  vapid.generateKeys();
  const config = { chavePublica: paraBase64Url(vapid.getPublicKey()), chavePrivada: paraBase64Url(vapid.getPrivateKey()), assunto: "mailto:institutolucia@tutamail.com" };
  const fila = [1, 2, 3].map((i) => ({ id: `id-${i}`, endpoint: `https://fcm.googleapis.com/fcm/send/aparelho-${i}`, p256dh: chaveAparelho, auth: segredoAuth, lang: "pt", n: i }));
  const resultados = [];
  const chamar = async (funcao, args) => {
    if (funcao === "rede_aviso_push_pendentes") return fila;
    resultados.push(args);
    return { ok: true };
  };
  const pedidos = [];
  const buscar = async (url, opcoes) => {
    pedidos.push({ url, opcoes });
    return { ok: url.endsWith("-1"), status: url.endsWith("-1") ? 201 : url.endsWith("-2") ? 410 : 500 };
  };
  const contagem = await rodadaDePush({ chamar, vapid: config, buscar, pausa: 0 });
  const auth = pedidos[0].opcoes.headers.Authorization;
  const corpo = Buffer.from(pedidos[0].opcoes.body);
  return { contagem, resultados, auth, aberto: decifrarComoOAparelho(corpo, par, deBase64Url(segredoAuth)), cabecalhos: pedidos[0].opcoes.headers };
}, (r) => r.contagem.enviados === 1 && r.contagem.removidos === 1 && r.contagem.falhas === 1 && r.resultados.length === 3 && r.resultados[1].p_gone === true && r.resultados[0].p_ok === true
  && r.auth.startsWith("vapid t=") && r.cabecalhos["Content-Encoding"] === "aes128gcm" && r.cabecalhos.TTL === "3600" && JSON.parse(r.aberto.texto).n === 1);

// ── 10. Tipos, textos, service worker, rotas e função ──
const frases = JSON.parse(lerTexto("i18n/rede/avisos/pt.json")).frases;
await espera("fraseDoAviso monta 'Ana e mais 3 responderam', os singulares, o sem nome e o apoio (nunca com nome)", () => [
  fraseDoAviso({ tipo: "resposta", total: 4, pessoas: 4, atores: ["Ana", "Bia"], texto: null }, frases, "r"),
  fraseDoAviso({ tipo: "resposta", total: 1, pessoas: 1, atores: ["Ana"], texto: null }, frases, "r"),
  fraseDoAviso({ tipo: "resposta", total: 3, pessoas: 1, atores: ["Ana"], texto: null }, frases, "r"),
  fraseDoAviso({ tipo: "mencao", total: 2, pessoas: 2, atores: [null, null], texto: null }, frases, "r"),
  fraseDoAviso({ tipo: "apoio", total: 3, pessoas: 3, atores: ["Escapou"], texto: null }, frases, "r"),
  fraseDoAviso({ tipo: null, total: 1, pessoas: 1, atores: [], texto: "Sua denúncia andou." }, frases, "r"),
  fraseDoAviso({ tipo: "chamado", total: 1, pessoas: 1, atores: [], texto: null }, frases, "reserva"),
], ([a, b, c, d, e, f, g]) => a === "Ana e mais 3 responderam ao seu post." && b === "Ana respondeu ao seu post." && c === "Ana respondeu 3 vezes ao seu post." && d === "2 pessoas mencionaram você." && e === "3 pessoas apoiaram o seu post." && f === "Sua denúncia andou." && g === "reserva");
await espera("os seis idiomas têm as mesmas chaves (pt é o texto final; os outros são rascunho marcado)", async () => {
  const achatar = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? achatar(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const pt = achatar(JSON.parse(lerTexto("i18n/rede/avisos/pt.json"))).sort();
  const r = {};
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(lerTexto(`i18n/rede/avisos/${l}.json`));
    r[l] = { iguais: JSON.stringify(achatar(j).filter((k) => k !== "_rascunho").sort()) === JSON.stringify(pt), rascunho: j._rascunho === true };
  }
  return { r, ptSemRascunho: !("_rascunho" in JSON.parse(lerTexto("i18n/rede/avisos/pt.json"))) };
}, ({ r, ptSemRascunho }) => ptSemRascunho && Object.values(r).every((x) => x.iguais && x.rascunho));
await espera("cada idioma tem as frases de todos os tipos agrupados, com os mesmos marcadores", async () => {
  const marcadores = (t) => (t.match(/\{\w+\}/g) ?? []).sort().join();
  const pt = JSON.parse(lerTexto("i18n/rede/avisos/pt.json")).frases;
  const faltas = [];
  for (const l of ["en", "es", "fr", "ru", "zh"]) {
    const f = JSON.parse(lerTexto(`i18n/rede/avisos/${l}.json`)).frases;
    for (const tipo of Object.keys(pt)) for (const chave of Object.keys(pt[tipo])) if (marcadores(f[tipo][chave]) !== marcadores(pt[tipo][chave])) faltas.push(`${l}.${tipo}.${chave}`);
  }
  return faltas;
}, (f) => f.length === 0);
await espera("o service worker trata push e clique, mostra só o número e não guarda texto de post", async () => {
  const sw = lerTexto("public/sw.js");
  return [/addEventListener\("push"/.test(sw), /addEventListener\("notificationclick"/.test(sw), /showNotification/.test(sw), /\/comunidade\/avisos/.test(sw), /dados\.(texto|corpo|body|titulo)\b/.test(sw), /const VERSAO = "v4"/.test(sw)];
}, (r) => r[0] && r[1] && r[2] && r[3] && !r[4] && r[5]);
await espera("a rota /comunidade/avisos existe, dá 404 com o recurso desligado e entra no registro e no menu", async () => {
  const rota = lerTexto("app/[lang]/comunidade/avisos/page.tsx");
  const registro = lerTexto("components/rede/registro.tsx");
  const casca = lerTexto("components/rede/Casca.tsx");
  return [/ligado\("rede-v2"\)/.test(rota), /notFound\(\)/.test(rota), /nome: "avisos"/.test(rota), /avisos: \{[^}]*avisos\/Tela/.test(registro), /chave: "avisos"[^\n]*\/avisos/.test(casca)];
}, (r) => r.every(Boolean));
await espera("a função enviar-push e o guia dos segredos existem; o guia cita os segredos e a chave pública", async () => {
  const funcao = lerTexto("supabase/functions/enviar-push/index.ts");
  const guia = lerTexto("docs/rede/AVISOS.md");
  return [/rede_aviso_push_pendentes|rodada/.test(funcao), /x-lucia-segredo/.test(funcao), ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_PUBLIC_KEY", "PUSH_SEGREDO", "EMAILS", "enviar-push", "lucia-rede-resumo"].every((s) => guia.includes(s))];
}, (r) => r[0] && r[1] && r[2]);
await espera("os arquivos do pacote não usam alert, confirm nem prompt da janela, e a tela lê os textos sob demanda", async () => {
  const arquivos = ["components/rede/avisos/Tela.tsx", "components/rede/avisos/push.ts"];
  return [arquivos.some((a) => /\b(window\.)?(alert|confirm|prompt)\(/.test(lerTexto(a))), /import\("\.\.\/\.\.\/i18n\/rede\/avisos\/pt\.json"\)/.test(lerTexto("lib/rede/textos-avisos.ts")), /from "@\//.test(lerTexto("lib/rede/tipos-avisos.ts")), /from "@\//.test(lerTexto("lib/rede/cliente-avisos.ts"))];
}, (r) => !r[0] && r[1] && !r[2] && !r[3]);

console.log(`Rede v2 (avisos): ${certos} certos, ${falhas.length} falhas.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
