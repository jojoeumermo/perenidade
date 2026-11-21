// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, grupo memória e luta (itens 43, 44, 115, 116, 119 e 121), atrás de "alumia-p4-memoria-e-luta":
//   · banco (supabase/migracoes/20261127-p4-memoria-e-luta.sql por cima do install.sql, duas vezes): o arquivo vivo com
//     consentimento por item e o "quero sair", a campanha com linha do tempo, o mural de vitórias e o podcast com RSS;
//   · as regras de privacidade de cada um (nenhum autor, nenhum número de pessoas, nenhum IP, nenhum texto de post copiado);
//   · as regras puras do aparelho (o "Neste dia na luta", o RSS do podcast, o desafio diário com a pontuação só no aparelho);
//   · as ligações (flag, rota, registro, painel, textos nos seis idiomas).
// Uso: npm run testar:p4-memoria-e-luta
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { RECURSOS, SO_PELO_NOME, ligado, lerRecursos } from "../lib/recursos.ts";
import { ROTAS_NOVAS } from "../lib/rede/rotas-novas.ts";
import { NOMES_DAS_FUNCOES } from "../components/painel/alumia/nomes-das-funcoes.ts";
import {
  FLAG_DA_MEMORIA, ROTAS_DA_MEMORIA, fatoDoDiaNaLuta, chaveDoDia, linkOk, slugOk, montarRssDoPodcast, perguntasDoDia, sementeDoDia,
  lerPontuacao, gravarPontuacao, apagarPontuacao, CHAVE_DA_PONTUACAO, CHAVE_DO_QUADRO, esconderTermo,
} from "../lib/rede/memoria/regras.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const existe = (c) => fs.existsSync(path.join(raiz, c));
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
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
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const TABELAS = ["rede_p4_memorias", "rede_p4_vitorias", "rede_p4_campanhas", "rede_p4_campanha_itens", "rede_p4_podcasts", "rede_p4_episodios"];
const SQL = normal(ler("supabase/migracoes/20261127-p4-memoria-e-luta.sql"));
const semComentario = SQL.replace(/--.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");

// ═══ 0. A migração, por fora ═══
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("cabeçalho com licença, \"Pode rodar mais de uma vez\" e a lei", SQL.startsWith("-- Instituto Lúcia") && SQL.includes("Pode rodar mais de uma vez") && /Lei: LGPD art\./.test(SQL));
ok("a migração não lê nem guarda endereço de rede", !/\binet\b|\bip\b|x-forwarded|cf-connecting|remote_addr|interno\.origem\(/i.test(semComentario));
ok("o interruptor entra no catálogo protegido por to_regclass", /if to_regclass\('interno\.recursos_catalogo'\) is not null then\s+insert into interno\.recursos_catalogo \(nome, so_pelo_nome\) values \('alumia-p4-memoria-e-luta', true\)/.test(SQL));
ok("nenhuma tabela nova tem coluna de contagem de pessoas", !/(seguidores|ouvintes|visualiza|quem_viu|plays|reproduc)\w*\s+(integer|bigint)/i.test(semComentario));
{
  const publicas = [...semComentario.matchAll(/create or replace function public\.(\w+)\([^)]*\)[^$]*?\$\$\s*(declare[\s\S]*?)?begin\s+([^;]+);/g)];
  const semPorta = publicas.filter((m) => !m[3].includes("interno.alumia_porta()")).map((m) => m[1]).filter((n) => n !== "rede_p4_memoria_orfas");
  ok(`toda função pública em plpgsql começa pela porta (${semPorta.join(", ")})`, semPorta.length === 0 && publicas.length >= 20);
}

// ═══ 1. Antes da migração: nada disso existia ═══
{
  // A migração ainda não está no install.sql (quem junta cola): o banco de antes é o install.sql inteiro. Se já estiver, corta antes dela.
  const banco = await criarBanco(normal(ler("supabase/install.sql")).includes(SQL) ? { antesDe: SQL } : {});
  const n = (await banco.dono("select count(*)::int n from pg_proc where proname like 'rede_p4_memoria%' or proname like 'rede_p4_podcast%'")).rows[0].n;
  ok(`antes: nenhuma função do arquivo vivo ou do podcast (${n})`, n === 0);
  await banco.pg.close?.();
}

// ═══ 2. Depois ═══
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const install = normal(ler("supabase/install.sql"));
await passa("a migração roda por cima do install.sql", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await passa("e de novo (idempotente)", () => banco.exclusivo(() => banco.pg.exec(SQL)));
if (install.includes(SQL)) ok("a migração está no fim do install.sql", noFimDoInstall(SQL, install));
{
  const r = (await dono("select interno.alumia_trancar() as r")).rows[0].r;
  ok(`trancar não acha nada aberto (${JSON.stringify(r.abertas)})`, r.abertas.length === 0);
  const t = (await dono(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          where n.nspname = 'interno' and c.relname = any($1) and c.relkind = 'r'`, [TABELAS])).rows;
  ok(`seis tabelas novas, todas com RLS ligada (${t.map((x) => x.relname).join(", ")})`, t.length === 6 && t.every((x) => x.relrowsecurity));
  const pol = (await dono("select count(*)::int n from pg_policies where schemaname = 'interno' and tablename = any($1)", [TABELAS])).rows[0].n;
  ok("nenhuma política nas tabelas (só as funções)", pol === 0);
  const cols = (await dono(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'interno' and table_name = any($1)`, [TABELAS])).rows;
  ok("nenhuma coluna de endereço de rede", !cols.some((c) => c.data_type === "inet" || /(^|_)ip($|_)|origem|endereco_rede/.test(c.column_name)));
  ok("nenhuma tabela guarda quem pediu para sair", !cols.some((c) => c.table_name === "rede_p4_memorias" && /pedido_por|quem_pediu|retirada_quem/.test(c.column_name)));
  const cat = (await dono("select so_pelo_nome from interno.recursos_catalogo where nome = 'alumia-p4-memoria-e-luta'")).rows[0];
  ok("o interruptor está no catálogo, só pelo nome", cat?.so_pelo_nome === true);
  const vivo = (await dono("select ligado from interno.recursos_vivos where nome = 'alumia-p4-memoria-e-luta'")).rows[0];
  ok("e começa desligado (sem decisão no painel)", vivo === undefined || vivo.ligado === false);
  const anon = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname ~ '^rede_p4_(memoria|vitoria|campanha|podcast|episodio)' and has_function_privilege('anon', p.oid, 'execute')`)).rows.map((x) => x.proname).sort();
  ok(`visitante só chama o RSS e a regra do depósito (${anon.join(", ")})`, JSON.stringify(anon) === JSON.stringify(["rede_p4_memoria_foto_pode", "rede_p4_podcast_rss"]));
  const deServico = (await dono(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname in ('rede_p4_podcast_audio', 'rede_p4_memoria_orfas')
                                   and has_function_privilege('service_role', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')`)).rows.length;
  ok("o caminho do áudio (que leva o id da conta) e a faxina: só a chave de serviço", deServico === 2);
}

const P = {};
for (const [i, nome] of ["ana", "bia", "cris", "duda", "eva"].entries()) {
  P[nome] = await criarUsuario(`${nome}@p4-memoria.local`, nome);
  await rpc({ papel: "authenticated", sub: P[nome], ip: `198.51.100.${i + 1}` }, "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1",
    [P[nome], `Pessoa ${i + 1}`, `pessoa_${nome}`]);
}
await dono("delete from interno.papeis");
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const id of Object.values(P)) await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [id]);
await dono("update auth.users set created_at = now() - interval '30 days'");
await dono(`insert into interno.rede_comunidades (slug, nome, categoria, tipo) values
  ('luta-moradia', 'Luta por moradia', 'disciplinas', 'aberta'), ('roda-fechada', 'Roda fechada', 'lutas', 'fechada') on conflict do nothing`);
// O "internet" (o que pode sair da Alumia) hoje só existe nas comunidades das disciplinas (interno.rede2_publico): por isso a aberta do
// teste é dessa categoria, para o RSS do podcast ter o que levar.
// ana modera as duas; bia e cris são membros da aberta; bia também da fechada; duda é membro da Alumia, mas de nenhuma; eva modera nada.
for (const [slug, quem, papel] of [["luta-moradia", "ana", "moderacao"], ["luta-moradia", "bia", "membro"], ["luta-moradia", "cris", "membro"], ["roda-fechada", "ana", "moderacao"], ["roda-fechada", "bia", "membro"]]) {
  await dono("insert into interno.rede_comunidade_membros (comunidade, usuario, papel, situacao) values ($1, $2, $3, 'ativo') on conflict do nothing", [slug, P[quem], papel]);
}
const como = (quem, funcao, args = {}) => rpc({ papel: "authenticated", sub: P[quem], ip: "198.51.100.9" }, funcao, args);
const comoVisitante = (funcao, args = {}) => rpc({ papel: "anon", ip: "198.51.100.10" }, funcao, args);
const comoServico = (funcao, args = {}) => rpc({ papel: "service_role", ip: "198.51.100.11" }, funcao, args);
const valor = (r) => (r && typeof r === "object" && "rows" in r ? r.rows[0] : r);
const chamar = async (quem, funcao, args) => {
  await dono("delete from interno.limites");
  const r = await como(quem, funcao, args);
  return r;
};

// ── Desligado: tudo recusa ──
await recusa("desligado: o arquivo vivo recusa", () => chamar("bia", "rede_p4_memorias", { p_comunidade: "luta-moradia" }), "desligado");
await recusa("desligado: o mural recusa", () => chamar("bia", "rede_p4_vitorias", {}), "desligado");
await recusa("desligado: as comunidades da pessoa recusam", () => chamar("bia", "rede_p4_ml_minhas", {}), "desligado");
await dono("insert into interno.rede_p4_podcasts (slug, comunidade, titulo) values ('antes-de-ligar', 'luta-moradia', 'Antes de ligar') on conflict do nothing");
ok("desligado: o RSS do podcast é nulo", (await comoVisitante("rede_p4_podcast_rss", { p_slug: "antes-de-ligar" })) === null);
await dono("delete from interno.rede_p4_podcasts where slug = 'antes-de-ligar'");
await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-p4-memoria-e-luta', true) on conflict (nome) do update set ligado = true");

// ── As comunidades da própria pessoa: só as dela, sem número de membros nem quem mais está ──
{
  const daBia = await passa("as comunidades da bia", () => chamar("bia", "rede_p4_ml_minhas", {}));
  ok(`a bia vê as duas dela, sem moderar (${JSON.stringify(daBia)})`, daBia?.length === 2 && daBia.every((c) => c.modero === false && Object.keys(c).sort().join() === "modero,nome,slug"));
  const daAna = await chamar("ana", "rede_p4_ml_minhas", {});
  ok("a ana modera as duas", daAna?.length === 2 && daAna.every((c) => c.modero === true));
  ok("a duda, de nenhuma comunidade, recebe a lista vazia", JSON.stringify(await chamar("duda", "rede_p4_ml_minhas", {})) === "[]");
}

// ═══ 44. Arquivo vivo da luta ═══
const MEM = { comunidade: "luta-moradia", titulo: "A ocupação de 2019", texto: "Trinta famílias entraram no prédio vazio.", quando: "2019-05-12" };
await recusa("44: sem consentimento, não entra", () => chamar("bia", "rede_p4_memoria_enviar", { p: MEM }), "invalido:consentimento");
await recusa("44: consentimento inventado, não entra", () => chamar("bia", "rede_p4_memoria_enviar", { p: { ...MEM, consentimento: "talvez" } }), "invalido:consentimento");
await recusa("44: quem não é da comunidade não envia", () => chamar("duda", "rede_p4_memoria_enviar", { p: { ...MEM, consentimento: "sem_pessoas" } }), "sem_permissao");
await recusa("44: foto sem a declaração dos rostos, não sobe", () => chamar("bia", "rede_p4_memoria_enviar", { p: { ...MEM, consentimento: "pessoas_consentiram", foto: { ext: "jpg", largura: 10, altura: 10 } } }), "rostos_nao_conferidos");
await recusa("44: data no futuro, não", () => chamar("bia", "rede_p4_memoria_enviar", { p: { ...MEM, consentimento: "sem_pessoas", quando: "2999-01-01" } }), "invalido:data");
const memTexto = await passa("44: memória só com texto e consentimento entra (na fila)", () => chamar("bia", "rede_p4_memoria_enviar", { p: { ...MEM, consentimento: "sem_pessoas" } }));
ok("44: a memória nova vai para a fila, não aparece sozinha", memTexto?.estado === "pendente" && memTexto?.minha === true);
const reserva = await passa("44: com foto e rostos conferidos, reserva o lugar", () =>
  chamar("cris", "rede_p4_memoria_enviar", { p: { ...MEM, titulo: "O despejo que não houve", consentimento: "pessoas_consentiram", foto: { ext: "jpg", largura: 800, altura: 600, rostos_conferidos: true } } }));
ok("44: o caminho da foto não diz nada de ninguém (só o id da memória)", reserva && /^[0-9a-f-]{36}\.jpg$/.test(reserva.caminho) && !reserva.caminho.includes(P.cris));
const enviada = reserva ? await passa("44: a foto chegou: vai para a fila", () => chamar("cris", "rede_p4_memoria_enviada", { p_id: reserva.id })) : null;
ok("44: a da foto também espera a mediação", enviada?.estado === "pendente");
{
  const vista = await passa("44: outra pessoa da comunidade abre o arquivo", () => chamar("bia", "rede_p4_memorias", { p_comunidade: "luta-moradia" }));
  ok("44: antes da mediação, ninguém vê no arquivo", vista?.memorias?.length === 0 && vista?.fila?.length === 0);
  ok("44: quem enviou vê a própria na fila", vista?.minhas?.length === 1);
  const mod = await passa("44: a mediação vê a fila", () => chamar("ana", "rede_p4_memorias", { p_comunidade: "luta-moradia" }));
  ok(`44: a fila tem as duas (${mod?.fila?.length})`, mod?.fila?.length === 2 && mod?.modero === true);
  ok("44: nem a mediação recebe quem enviou", !JSON.stringify(mod).includes(P.bia) && !JSON.stringify(mod).includes(P.cris) && !/autor|codinome|handle/.test(JSON.stringify(mod)));
}
await recusa("44: quem não modera não decide", () => chamar("bia", "rede_p4_memoria_decidir", { p_id: reserva?.id, p_publicar: true }), "nao_encontrado");
await passa("44: a mediação publica a da foto", () => chamar("ana", "rede_p4_memoria_decidir", { p_id: reserva?.id, p_publicar: true }));
await passa("44: e recusa a outra (some)", () => chamar("ana", "rede_p4_memoria_decidir", { p_id: memTexto?.id, p_publicar: false }));
{
  const n = (await dono("select count(*)::int n from interno.rede_p4_memorias where id = $1", [memTexto?.id])).rows[0].n;
  ok("44: a recusada não fica guardada", n === 0);
  const vista = await chamar("duda", "rede_p4_memorias", { p_comunidade: "luta-moradia" });
  ok("44: comunidade aberta: qualquer membro da Alumia vê a publicada", vista?.memorias?.length === 1 && vista.memorias[0].foto === true && vista.posso_enviar === false);
  ok("44: o consentimento do item vai junto", vista?.memorias?.[0]?.consentimento === "pessoas_consentiram");
}
await recusa("44: a fechada não abre para quem é de fora", () => chamar("cris", "rede_p4_memorias", { p_comunidade: "roda-fechada" }), "nao_encontrado");
{
  const pode = async (quem) => valor(await dono(`select (select set_config('request.jwt.claims', $2, true)) is not null and public.rede_p4_memoria_foto_pode($1) as pode`,
    [reserva.caminho, JSON.stringify({ role: "authenticated", sub: P[quem] })])).pode;
  const podeAntes = await passa("44: a regra do depósito deixa quem vê a comunidade ler a foto", () => como("duda", "rede_p4_memoria_foto", { p_id: reserva.id }));
  ok("44: o endereço da foto vem do depósito próprio", podeAntes?.bucket === "rede-memoria" && podeAntes?.caminho === reserva.caminho);
  void pode;
}
// Quem aparece pede para sair: sai da vista na hora, sem guardar quem pediu.
const antesDeSair = (await dono("select count(*)::int n from interno.auditoria")).rows[0]?.n ?? 0;
await passa("44: quem aparece pede para sair (um toque)", () => chamar("duda", "rede_p4_memoria_sair", { p_id: reserva?.id }));
{
  const vista = await chamar("bia", "rede_p4_memorias", { p_comunidade: "luta-moradia" });
  ok("44: depois do pedido, a memória sai do arquivo na hora", vista?.memorias?.length === 0);
  await recusa("44: e a foto deixa de ser lida", () => como("bia", "rede_p4_memoria_foto", { p_id: reserva.id }), "nao_encontrado");
  const linha = (await dono("select * from interno.rede_p4_memorias where id = $1", [reserva.id])).rows[0];
  ok("44: o registro diz só 'a pedido de quem aparece', sem quem pediu", linha?.estado === "retirada" && linha?.retirada_por === "aparece" && !Object.values(linha).some((x) => String(x) === P.duda));
  const depois = (await dono("select count(*)::int n from interno.auditoria")).rows[0]?.n ?? 0;
  const aud = (await dono("select count(*)::int n from interno.auditoria where quem = $1", [P.duda])).rows[0].n;
  ok("44: o pedido não vai ao registro de auditoria com o nome de quem pediu", aud === 0 && depois === antesDeSair);
  const dela = await chamar("cris", "rede_p4_memorias", { p_comunidade: "luta-moradia" });
  ok("44: quem enviou vê que saiu a pedido de quem aparece", dela?.minhas?.[0]?.estado === "retirada" && dela.minhas[0].retirada_por === "aparece" && dela.minhas[0].foto === false);
}
await passa("44: quem enviou apaga a própria memória de vez", () => chamar("cris", "rede_p4_memoria_apagar", { p_id: reserva?.id }));
ok("44: apagada, não sobra linha", (await dono("select count(*)::int n from interno.rede_p4_memorias where id = $1", [reserva?.id])).rows[0].n === 0);

// ═══ 116. Mural de vitórias ═══
await recusa("116: quem não modera não registra vitória", () => chamar("bia", "rede_p4_vitoria_registrar", { p: { comunidade: "luta-moradia", titulo: "Vitória", quando: "2024-03-01" } }), "sem_permissao");
await recusa("116: fonte que não é https, não", () => chamar("ana", "rede_p4_vitoria_registrar", { p: { comunidade: "luta-moradia", titulo: "Vitória", fonte: "http://exemplo.org" } }), "invalido:link");
await recusa("116: fonte com usuário no endereço, não", () => chamar("ana", "rede_p4_vitoria_registrar", { p: { comunidade: "luta-moradia", titulo: "Vitória", fonte: "https://x@exemplo.org/a" } }), "invalido:link");
const vit = await passa("116: a mediação registra a vitória", () =>
  chamar("ana", "rede_p4_vitoria_registrar", { p: { comunidade: "luta-moradia", titulo: "Desapropriação do prédio", texto: "O prédio virou moradia popular.", quando: "2024-03-01", fonte: "https://exemplo.org/noticia" } }));
await passa("116: e uma na fechada", () => chamar("ana", "rede_p4_vitoria_registrar", { p: { comunidade: "roda-fechada", titulo: "Vitória da roda", quando: "2024-04-01" } }));
{
  const mural = await chamar("duda", "rede_p4_vitorias", {});
  ok("116: o mural de quem é de fora mostra só a da comunidade aberta", mural?.vitorias?.length === 1 && mural.vitorias[0].id === vit?.id && mural.posso_registrar.length === 0);
  const daBia = await chamar("bia", "rede_p4_vitorias", {});
  ok("116: quem é da fechada vê as duas, da mais nova para a mais antiga", daBia?.vitorias?.length === 2 && daBia.vitorias[0].titulo === "Vitória da roda");
  const daAna = await chamar("ana", "rede_p4_vitorias", { p_comunidade: "luta-moradia" });
  ok("116: a mediação vê onde pode registrar", daAna?.posso_registrar?.length === 2 && daAna.vitorias[0].posso_tirar === true);
  ok("116: o mural não diz quem registrou", !JSON.stringify(daAna).includes(P.ana) && !/autor|codinome|handle|criada_por/.test(JSON.stringify(daAna)));
}

// ═══ 115. Página de campanha ═══
// Um post aberto, um ato e um post da fechada, para a linha do tempo.
const post = async (quem, comunidade, texto, publico = "internet") => {
  await dono("delete from interno.limites");
  return como(quem, "rede_publicar", { p: { comunidade, publico, texto } });
};
const pAberto = await passa("115: um post da comunidade aberta", () => post("bia", "luta-moradia", "Assembleia hoje às 19h na ocupação."));
const pMembros = await passa("115: um post só para quem é da comunidade", () => post("bia", "luta-moradia", "Só para quem é da comunidade.", "comunidade"));
let ato = null;
if (pAberto?.id) {
  ato = await passa("115: um ato da comunidade (o chamado)", async () => {
    const p = await post("ana", "luta-moradia", "Ato pela moradia no centro.");
    await dono("insert into interno.rede_chamados (post, inicio, cidade, ponto) values ($1, '2024-02-10 15:00-03', 'São Paulo', 'Praça da Sé')", [p.id]);
    return p;
  });
}
await recusa("115: quem não modera não abre campanha", () => chamar("bia", "rede_p4_campanha_criar", { p: { comunidade: "luta-moradia", titulo: "Moradia já" } }), "sem_permissao");
const camp = await passa("115: a mediação abre a campanha", () => chamar("ana", "rede_p4_campanha_criar", { p: { comunidade: "luta-moradia", titulo: "Moradia já", sobre: "A luta do prédio da rua do Carmo." } }));
if (camp?.id) {
  await passa("115: põe o ato (a data vem do começo do ato)", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "ato", post: ato?.id, titulo: "Ato no centro" } }));
  await passa("115: põe um post", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "post", post: pAberto?.id, titulo: "Chamado para a assembleia", quando: "2024-01-05" } }));
  await passa("115: põe o post só da comunidade", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "post", post: pMembros?.id, titulo: "Recado interno", quando: "2024-01-06" } }));
  await passa("115: põe um documento (título e link https)", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "documento", titulo: "Ofício à prefeitura", link: "https://exemplo.org/oficio.pdf", quando: "2024-01-20" } }));
  await passa("115: põe a vitória (a data vem dela)", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "vitoria", vitoria: vit?.id, titulo: "Desapropriação" } }));
  await recusa("115: documento sem link, não", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "documento", titulo: "Sem link", quando: "2024-01-20" } }), "invalido:link");
  await recusa("115: post como ato, quando não é ato, não", () => chamar("ana", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "ato", post: pAberto?.id, titulo: "Não é ato" } }), "invalido:ato");
  await recusa("115: quem não modera não põe item", () => chamar("bia", "rede_p4_campanha_por", { p: { campanha: camp.id, tipo: "documento", titulo: "Doc", link: "https://exemplo.org", quando: "2024-01-01" } }), "nao_encontrado");
  const deFora = await chamar("duda", "rede_p4_campanha", { p_id: camp.id });
  ok(`115: a linha do tempo de quem é de fora não mostra o post só da comunidade (${deFora?.linha?.length})`, deFora?.linha?.length === 4 && !deFora.linha.some((i) => i.post === pMembros?.id));
  ok("115: em ordem de data", deFora?.linha?.map((i) => i.quando).join() === ["2024-01-05", "2024-01-20", "2024-02-10", "2024-03-01"].join());
  const daBia = await chamar("bia", "rede_p4_campanha", { p_id: camp.id });
  ok("115: quem é da comunidade vê os cinco itens", daBia?.linha?.length === 5);
  ok("115: a linha do tempo não copia texto de post (só o id e o título da mediação)", !JSON.stringify(daBia).includes("Assembleia hoje") && !JSON.stringify(daBia).includes("Só para quem é da comunidade."));
  ok("115: nem quem escreveu cada post", !JSON.stringify(daBia).includes(P.bia) && !/autor|codinome|handle/.test(JSON.stringify(daBia)));
  const lista = await chamar("duda", "rede_p4_campanhas", {});
  ok("115: a lista de campanhas mostra a da comunidade aberta", lista?.campanhas?.length === 1 && lista.posso_abrir.length === 0);
  const tirado = await passa("115: a mediação tira um item", () => chamar("ana", "rede_p4_campanha_tirar", { p_item: daBia.linha[0].id }));
  ok("115: e ele sai da linha", tirado?.linha?.length === 4);
  await passa("115: a mediação encerra a campanha (fica de pé como memória)", () => chamar("ana", "rede_p4_campanha_encerrar", { p_id: camp.id, p_encerrada: true }));
}

// ═══ 119. Podcast ═══
const comAudio = async (quem, comunidade, publico) => {
  const p = await post(quem, comunidade, "Episódio: a história da ocupação.", publico);
  await dono("insert into interno.rede_audios (post, caminho, tipo, duracao) values ($1, $2, 'audio/webm', 50)", [p.id, `${P[quem]}/${crypto.randomUUID()}.webm`]);
  return p;
};
const ep1 = await passa("119: um post aberto com áudio", () => comAudio("ana", "luta-moradia", "internet"));
const ep2 = await passa("119: um post só da comunidade com áudio", () => comAudio("ana", "luta-moradia", "comunidade"));
await recusa("119: quem não modera não cria podcast", () => chamar("bia", "rede_p4_podcast_criar", { p: { comunidade: "luta-moradia", slug: "vozes-da-ocupacao", titulo: "Vozes" } }), "sem_permissao");
await recusa("119: endereço inválido, não", () => chamar("ana", "rede_p4_podcast_criar", { p: { comunidade: "luta-moradia", slug: "Vozes!", titulo: "Vozes" } }), "invalido:slug");
const pod = await passa("119: a mediação cria o podcast", () => chamar("ana", "rede_p4_podcast_criar", { p: { comunidade: "luta-moradia", slug: "vozes-da-ocupacao", titulo: "Vozes da ocupação", sobre: "As histórias de quem luta por moradia." } }));
if (pod) {
  await recusa("119: post sem áudio não vira episódio", () => chamar("ana", "rede_p4_episodio_por", { p: { podcast: "vozes-da-ocupacao", post: pAberto?.id, titulo: "Sem áudio" } }), "invalido:sem_audio");
  await passa("119: episódio 1 (post aberto)", () => chamar("ana", "rede_p4_episodio_por", { p: { podcast: "vozes-da-ocupacao", post: ep1?.id, titulo: "A ocupação", notas: "Como tudo começou." } }));
  await passa("119: episódio 2 (post só da comunidade)", () => chamar("ana", "rede_p4_episodio_por", { p: { podcast: "vozes-da-ocupacao", post: ep2?.id, titulo: "Só para a comunidade" } }));
  await recusa("119: o mesmo post duas vezes, não", () => chamar("ana", "rede_p4_episodio_por", { p: { podcast: "vozes-da-ocupacao", post: ep1?.id, titulo: "De novo" } }), "invalido:repetido");
  const daBia = await chamar("bia", "rede_p4_podcast", { p_slug: "vozes-da-ocupacao" });
  ok("119: na Alumia, quem é da comunidade ouve os dois", daBia?.episodios?.length === 2 && daBia.episodios[0].numero === 2 && daBia.episodios[0].duracao === 50);
  const daDuda = await chamar("duda", "rede_p4_podcast", { p_slug: "vozes-da-ocupacao" });
  ok("119: quem é de fora da comunidade ouve só o aberto", daDuda?.episodios?.length === 1 && daDuda.episodios[0].post === ep1?.id);
  const rss = await passa("119: o RSS sai para o visitante", () => comoVisitante("rede_p4_podcast_rss", { p_slug: "vozes-da-ocupacao" }));
  ok("119: o RSS leva só o episódio que já pode sair da Alumia", rss?.episodios?.length === 1 && rss.episodios[0].titulo === "A ocupação");
  ok("119: o RSS não leva o texto do post, o autor nem número de quem ouve", !JSON.stringify(rss).includes("Episódio: a história") && !JSON.stringify(rss).includes(P.ana) && !/autor|codinome|handle|ouvintes|plays/.test(JSON.stringify(rss)));
  const ids = (JSON.stringify(rss).match(UUID) ?? []).filter((u) => u !== rss?.episodios?.[0]?.id);
  ok(`119: o único id no RSS é o do episódio (${ids.join(",")})`, ids.length === 0);
  await recusa("119: o visitante não pede o caminho do áudio (ele leva o id da conta de quem gravou)", () => comoVisitante("rede_p4_podcast_audio", { p_slug: "vozes-da-ocupacao", p_episodio: rss?.episodios?.[0]?.id }), "permission denied");
  const audio = await comoServico("rede_p4_podcast_audio", { p_slug: "vozes-da-ocupacao", p_episodio: rss?.episodios?.[0]?.id });
  ok("119: o áudio do episódio que sai vem do depósito dos posts", audio?.bucket === "rede-midia" && /\.webm$/.test(audio?.caminho ?? ""));
  const ep2id = daBia?.episodios?.[0]?.id;
  ok("119: o áudio do episódio só da comunidade não sai", (await comoServico("rede_p4_podcast_audio", { p_slug: "vozes-da-ocupacao", p_episodio: ep2id })) === null);
  // Comunidade fechada: nunca sai.
  await dono("insert into interno.rede_p4_podcasts (slug, comunidade, titulo) values ('roda-por-dentro', 'roda-fechada', 'Por dentro') on conflict do nothing");
  ok("119: podcast de comunidade fechada não tem RSS", (await comoVisitante("rede_p4_podcast_rss", { p_slug: "roda-por-dentro" })) === null);
  // Com a Alumia desligada pelo painel (o alcance), nada sai.
  await dono("insert into interno.recursos_vivos (nome, ligado) values ('alumia-alcance', false) on conflict (nome) do update set ligado = false");
  ok("119: com o alcance desligado no painel, o RSS é nulo", (await comoVisitante("rede_p4_podcast_rss", { p_slug: "vozes-da-ocupacao" })) === null);
  await dono("delete from interno.recursos_vivos where nome = 'alumia-alcance'");
  // Com a trava da entrada ligada, nada sai (a porta recusa o visitante, ou a regra devolve nulo).
  await dono("update interno.recursos_vivos set ligado = false where nome = 'alumia-p4-memoria-e-luta'");
  ok("119: com o interruptor desligado, o RSS é nulo", (await comoVisitante("rede_p4_podcast_rss", { p_slug: "vozes-da-ocupacao" })) === null);
  await dono("update interno.recursos_vivos set ligado = true where nome = 'alumia-p4-memoria-e-luta'");
}

// ═══ Privacidade geral: nenhum número de pessoas, nenhuma lista ═══
{
  const todas = [
    await chamar("ana", "rede_p4_memorias", { p_comunidade: "luta-moradia" }), await chamar("ana", "rede_p4_vitorias", {}),
    await chamar("ana", "rede_p4_campanhas", {}), await chamar("ana", "rede_p4_podcasts", {}),
  ];
  const texto = JSON.stringify(todas);
  ok("nenhuma resposta traz o id de uma pessoa", !Object.values(P).some((id) => texto.includes(id)));
  ok("nenhuma resposta traz contagem de pessoas", !/"(total|membros|pessoas|seguidores|ouvintes|apoios|quantos)"\s*:/.test(texto));
}

// ═══ 3. As regras do aparelho ═══
ok("flag e rotas: o nome do grupo", FLAG_DA_MEMORIA === "alumia-p4-memoria-e-luta");
{
  const resposta = { dia: "20/11", fatos: [
    { ano: 1695, texto: "Zumbi dos Palmares é morto.", link: "javascript:alert(1)" },
    { ano: 2003, texto: "Dia da Consciência Negra.", link: "https://pt.wikipedia.org/wiki/Dia_da_Consci%C3%AAncia_Negra", extra: "x" },
  ] };
  const f = fatoDoDiaNaLuta(resposta);
  ok(`43: o fato do quadro é o primeiro com link https, só com ano, texto e link (${JSON.stringify(f)})`, f?.ano === 2003 && f.texto === "Dia da Consciência Negra." && Object.keys(f).sort().join() === "ano,link,texto");
  ok("43: resposta vazia ou estranha, nada (o quadro não aparece)", fatoDoDiaNaLuta(null) === null && fatoDoDiaNaLuta({ fatos: [] }) === null && fatoDoDiaNaLuta({ fatos: "x" }) === null);
  ok("43: o fato de outro dia leva a data dele", fatoDoDiaNaLuta({ fatos: [{ ano: 1917, texto: "Greve geral.", link: "https://exemplo.org/a", dia: "21/11" }] })?.dia === "21/11");
  ok("43: a chave do dia é o dia em Brasília (02h UTC ainda é ontem)", chaveDoDia(new Date("2026-11-21T02:00:00Z")) === "2026-11-20");
  const conteudo = JSON.parse(ler("content/neste-dia.json"));
  ok("43: o arquivo do site tem fatos para o quadro", Array.isArray(conteudo.fatos) && conteudo.fatos.length > 30);
  const quadro = ler("components/rede/memoria/NesteDiaNaLuta.tsx");
  ok("43: o quadro lê só o nosso servidor (/api/neste-dia), nunca a Wikipédia pelo aparelho", quadro.includes("/api/neste-dia") && !/wikimedia\.org|wikipedia\.org/.test(quadro));
  ok("43: o pedido vai sem credencial (nada de quem lê)", /credentials: "omit"/.test(quadro));
  ok("43: o link do fato abre sem levar de onde veio", quadro.includes('rel="noopener noreferrer nofollow"'));
  ok("43: \"fechar por hoje\" guarda só a data, no aparelho", quadro.includes("setItem(CHAVE_DO_QUADRO, dia)") && CHAVE_DO_QUADRO === "alumia-neste-dia-fechado");
  const encaixe = ler("components/rede/memoria/encaixe.tsx");
  ok("43: entra pelo encaixe topoDaLinha (sem mexer na Linha), atrás da rota do grupo", /topoDaLinha: \[NesteDiaNaLuta/.test(encaixe) && /rotaNovaLigada\("memoria-da-luta"\) \? \{\} :/.test(encaixe)
    && ler("components/rede/encaixes.tsx").includes('import { encaixe as memoria } from "./memoria/encaixe";') && /alcance, memoria, questoes,/.test(ler("components/rede/encaixes.tsx")));
  ok("43: o item do menu só para quem tem conta", (encaixe.match(/situacao\.logado \?/g) ?? []).length === 2);
}
ok("links: só https", linkOk("https://exemplo.org/a") && !linkOk("http://exemplo.org") && !linkOk("javascript:alert(1)") && !linkOk("https://u@exemplo.org"));
ok("endereço do podcast", slugOk("vozes-da-ocupacao") && !slugOk("Vozes!") && !slugOk("ab"));
{
  const xml = montarRssDoPodcast(
    { slug: "vozes", titulo: "Vozes <da> ocupação", sobre: "Histórias & lutas", comunidade: "luta-moradia", comunidade_nome: "Luta por moradia",
      episodios: [{ id: "11111111-1111-4111-8111-111111111111", titulo: "A ocupação", notas: "Como começou", numero: 1, criado_em: "2024-01-05T12:00:00Z", duracao: 50, tipo: "audio/webm" }] },
    { site: "https://exemplo.org", alumia: "", lang: "pt" },
  );
  ok("119: o RSS é RSS 2.0 com itunes", xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && xml.includes('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"'));
  ok("119: o texto vai escapado", xml.includes("Vozes &lt;da&gt; ocupação") && xml.includes("Histórias &amp; lutas"));
  ok("119: o áudio aponta para a nossa rota (nunca o depósito direto)", xml.includes('<enclosure url="https://exemplo.org/api/rede/podcast/vozes/11111111-1111-4111-8111-111111111111"') && !xml.includes("supabase"));
  ok("119: a duração e o tipo vão no item", xml.includes("<itunes:duration>50</itunes:duration>") && xml.includes('type="audio/webm"'));
  ok("119: não se mistura com o podcast do Instituto (feed e rota próprios)", !xml.includes("/podcast.xml") && !xml.includes("Instituto Lúcia</itunes:author>"));
}
{
  const verbetes = Array.from({ length: 40 }, (_, i) => ({ termo: `Termo${i}`, resumo: `Termo${i} é uma ideia número ${i} da luta do povo trabalhador.` }));
  const a = perguntasDoDia(verbetes, "2026-11-20");
  const b = perguntasDoDia(verbetes, "2026-11-20");
  const c = perguntasDoDia(verbetes, "2026-11-21");
  ok("121: cinco perguntas por dia", a.length === 5);
  ok("121: o mesmo dia dá o mesmo desafio para todo mundo", JSON.stringify(a) === JSON.stringify(b));
  ok("121: outro dia, outro desafio", JSON.stringify(a) !== JSON.stringify(c));
  ok("121: a semente é só a data", sementeDoDia("2026-11-20") === sementeDoDia("2026-11-20") && sementeDoDia("2026-11-20") !== sementeDoDia("2026-11-21"));
  ok("121: cada pergunta tem a certa entre as opções e o termo escondido", a.every((p) => p.opcoes[p.certa] === p.termo && !p.enunciado.includes(p.termo)));
  // A pontuação só no aparelho: um armazenamento falso, sem servidor.
  const guarda = new Map();
  const loja = { getItem: (k) => guarda.get(k) ?? null, setItem: (k, v) => guarda.set(k, String(v)), removeItem: (k) => guarda.delete(k) };
  gravarPontuacao(loja, "2026-11-20", 4, 5);
  ok("121: a pontuação fica só no aparelho, de hoje", JSON.stringify(lerPontuacao(loja, "2026-11-20")) === JSON.stringify({ acertos: 4, total: 5 }));
  ok("121: nada de sequência nem de dias anteriores guardados", Object.keys(JSON.parse(guarda.get(CHAVE_DA_PONTUACAO))).sort().join() === "acertos,dia,total");
  ok("121: outro dia não lê a de ontem", lerPontuacao(loja, "2026-11-21") === null);
  apagarPontuacao(loja);
  ok("121: apagar some com tudo", guarda.size === 0);
  const quebrada = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
  ok("121: sem armazenamento, nada quebra", lerPontuacao(quebrada, "2026-11-20") === null && (gravarPontuacao(quebrada, "2026-11-20", 1, 5), true));
  const tela = ler("components/rede/memoria/TelaDoDesafio.tsx").replace(/^\s*\/\/.*$/gm, "");
  ok("121: a tela do desafio não manda a pontuação para lugar nenhum", !/fetch\([^)]*(pontua|resultado)|chamar\(|rpc\(/.test(tela) && !/ranking|sequ[eê]ncia de dias/i.test(tela));
  const rota = ler("app/api/rede/desafio/route.ts");
  ok("121: a rota do desafio não lê quem pede", !/headers\.get|x-forwarded|cookies\(|authorization/i.test(rota));
}

{
  ok("121: o termo some do enunciado, com ou sem acento, e o resto fica como está", esconderTermo("A Greve geral parou o país; greves vieram.", "greve") === "A ____ geral parou o país; ____s vieram."
    && esconderTermo("Organização dos trabalhadores.", "organizacao") === "____ dos trabalhadores.");
  // O podcast pelo servidor: o RSS lê como visitante; o áudio sai pela nossa rota, achado com a chave de serviço, sem redirecionar.
  const rss = ler("app/api/rede/podcast/[slug]/route.ts");
  const audio = ler("app/api/rede/podcast/[slug]/[episodio]/route.ts");
  const servidor = ler("lib/rede/memoria/servidor.ts");
  ok("119: as rotas do podcast respondem 404 com o grupo ou o alcance desligados, ou a Alumia interditada", [rss, audio].every((r) => /if \(!rotaNovaLigada\("memoria-da-luta"\) \|\| !alcanceLigado\(\) \|\| \(await alumiaInterditada\(\)\)\) return naoAchado\(\);/.test(r)));
  ok("119: as rotas não leem quem pede (nem cabeçalho, nem cookie)", [rss, audio].every((r) => !/pedido\.headers|x-forwarded|cf-connecting|cookies\(|authorization/i.test(r)));
  ok("119: o áudio não redireciona ao depósito (entrega os bytes pela nossa rota)", !/Response\.redirect|status: 30[1278]|Location/.test(audio) && /new Response\(arquivo\.body/.test(audio));
  ok("119: o caminho do áudio é achado com a chave de serviço e só no depósito dos posts", /chamarBanco<\{ bucket: string; caminho: string; tipo: string \}>\(servico\(\), "rede_p4_podcast_audio"/.test(servidor) && /bucket !== "rede-midia"/.test(servidor));
  const cliente = ler("lib/rede/memoria/cliente.ts");
  ok("o cliente não tem campo de autor, codinome ou número de pessoas", !/autor|codinome|handle|ouvintes|membros:|total:/.test(cliente.replace(/\/\/.*$/gm, "")));
  const telas = ["TelaDaMemoria", "AbaVitorias", "AbaCampanhas", "AbaArquivo", "AbaPodcasts", "TelaDoDesafio", "NesteDiaNaLuta"].map((n) => ler(`components/rede/memoria/${n}.tsx`)).join("\n");
  ok("as telas não usam confirm() nem alert() do navegador", !/\b(window\.)?(confirm|alert|prompt)\(/.test(telas.replace(/confirmar\(/g, "")));
  ok("as telas não mandam nada a terceiros (só /api do próprio site)", !/fetch\(\s*["'`]https?:/.test(telas));
  ok("nenhum Math.random nas regras e nas telas", !/Math\.random/.test(telas + ler("lib/rede/memoria/regras.ts")));
  ok("o teste da tela existe (computador e 390 px)", existe("e2e/p4-memoria-e-luta.spec.ts"));
}

// ═══ 4. As ligações ═══
ok("a flag existe e é só pelo nome", FLAG_DA_MEMORIA in RECURSOS && SO_PELO_NOME.includes(FLAG_DA_MEMORIA));
ok("\"todos\" não liga; o nome liga", ligado(FLAG_DA_MEMORIA, lerRecursos("todos")) === false && ligado(FLAG_DA_MEMORIA, lerRecursos(`todos,${FLAG_DA_MEMORIA}`)) === true);
ok("o painel descreve a função", typeof NOMES_DAS_FUNCOES[FLAG_DA_MEMORIA]?.sobre === "string" && NOMES_DAS_FUNCOES[FLAG_DA_MEMORIA].sobre.length > 40);
{
  const registro = ler("components/rede/registro.tsx");
  const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
  const onda5 = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler(`i18n/rede/onda5/${l}.json`))]));
  for (const nome of ROTAS_DA_MEMORIA) {
    const r = ROTAS_NOVAS.find((x) => x.nome === nome);
    ok(`rota ${nome}: em ROTAS_NOVAS com a flag do grupo`, r?.flag === FLAG_DA_MEMORIA && r.indexar === false);
    const pagina = `app/[lang]/alumia${r?.caminho}/page.tsx`;
    ok(`rota ${nome}: a página passa pela PaginaNova`, existe(pagina) && ler(pagina).includes(`nome="${nome}"`) && ler(pagina).includes("metadadosDaRotaNova"));
    ok(`rota ${nome}: no registro com import dinâmico`, new RegExp(`"?${nome}"?: \\{ componente: dynamic`).test(registro));
    for (const l of idiomas) ok(`rota ${nome}: título em ${l}`, !!onda5[l].telas[nome]?.titulo && !!onda5[l].telas[nome]?.descricao);
  }
  const pt = JSON.parse(ler("i18n/rede/memoria/pt.json"));
  const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).filter((k) => k !== "_rascunho").sort();
  for (const l of idiomas.slice(1)) {
    const t = JSON.parse(ler(`i18n/rede/memoria/${l}.json`));
    ok(`textos ${l}: marcados como rascunho`, t._rascunho === true);
    ok(`textos ${l}: as mesmas chaves do português`, JSON.stringify(chaves(t)) === JSON.stringify(chaves(pt)));
  }
  ok("textos pt: não é rascunho", pt._rascunho === undefined);
  ok("textos: o arquivo vivo explica o consentimento e o 'quero sair'", /consent/i.test(JSON.stringify(pt.memoria)) && /sair/i.test(pt.memoria.sair));
  ok("textos: o desafio diz que a pontuação fica no aparelho", /aparelho/.test(pt.desafio.privacidade));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  ✗ ${f}`);
  process.exit(1);
}
process.exit(0);
