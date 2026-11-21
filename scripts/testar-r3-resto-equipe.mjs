// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (13): o chat da equipe sem autor, sem hora e sem leitura no banco (supabase/migracoes/20261125-r3-resto-r2.sql,
// lib/equipe/autoria.ts, lib/equipe/lidas.ts), num Postgres local, com o motor de verdade (@wireapp/core-crypto) e a identidade de
// verdade de cada pessoa (lib/sigilo.ts). Prova:
//   - com o banco inteiro na mão: nenhuma mensagem cifrada tem autor, nenhuma hora além do dia, nenhuma coluna de leitura, entrega ou
//     "digitando"; a ordem global sumiu (só o número por conversa);
//   - pela ordem das transações (xmin): o envio não grava NADA com a conta de quem enviou na mesma transação (antes: o limite por pessoa,
//     a hora de leitura de quem enviou); idem para subir um anexo;
//   - ponta a ponta: a Bia abre a mensagem da Ana e sabe que foi a Ana e a hora (de dentro, assinadas); com o id, o tipo ou o alvo
//     trocados pelo banco, a assinatura não confere; quem não tem a identidade da Ana não apaga nem edita (a ficha); a reação nova da
//     mesma pessoa troca a anterior sem o banco saber quem é; as contagens de não lidas vêm do "lido até" do aparelho, sem gravar;
//   - ataques: apagar com ficha de outra mensagem, editar com ficha errada, mensagem com id repetido, prender anexo de outra ficha.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-equipe.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { motorNoNode } from "./cifra-no-node.mjs";
import { assinar, certificarAparelho, novaIdentidade, novoAparelho, verificar } from "../lib/sigilo.ts";
import { criarMlsDaEquipe } from "../lib/equipe/mls.ts";
import { abrirMensagem, assinarMensagem, chaveDasFichas, contextoDaMensagem, edicaoValida, ficha, fichaDoEnvio, novoIdDeMensagem } from "../lib/equipe/autoria.ts";
import { lidas, marcarLida } from "../lib/equipe/lidas.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRACAO = "supabase/migracoes/20261125-r3-resto-r2.sql";
const sql = fs.readFileSync(path.join(raiz, MIGRACAO), "utf8");

let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
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
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 200)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

// ═══════════════════ 0. O arquivo ═══════════════════
ok("a migração tem cabeçalho com a função e a lei", /Alumia · R3 · o que a R2 deixou/.test(sql) && /Leis e princípios: LGPD/.test(sql));
ok("a migração não tem endereço de rede, porta nem caminho do computador", !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\|\/home\/|\/opt\//.test(sql));
ok("nenhuma função recebe linha de tabela com valor padrão", !/\(\s*[a-z_]+\s+interno\.[a-z_]+\s+default/i.test(sql));
ok("o nome antigo da rede não aparece", !/Rede Lúcia/.test(sql));

// ═══════════════════ 1. O banco, com conversa e mensagens de antes ═══════════════════
// Montado até antes desta migração (se ela já estiver colada no install.sql, depois da junção): o estado de antes é o da R2.
const banco = await criarBanco({ antesDe: sql }).catch(() => criarBanco());
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
const P = {};
for (const nome of ["ana", "bia", "caio", "fora"]) {
  P[nome] = await criarUsuario(`${nome}@r3e.local`, `Pessoa ${nome}`);
  await rpc({ papel: "authenticated", sub: P[nome] }, "eu");
}
for (const nome of ["ana", "bia", "caio"]) await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'educacao', 'matematica') on conflict do nothing", [P[nome]]);
const como = (u) => ({ papel: "authenticated", sub: u });
const conversa = (await dono("insert into interno.conversas (tipo, nome) values ('grupo', 'Exatas') returning id")).rows[0].id;
for (const nome of ["ana", "bia", "caio"]) await dono("insert into interno.conversa_membros (conversa, usuario) values ($1, $2)", [conversa, P[nome]]);
// O estado de antes: uma mensagem cifrada com autor e hora, um aviso do sistema, a leitura de cada um.
await dono(`insert into interno.conversa_mensagens (conversa, autor, corpo, versao, tipo) values ($1, $2, 'm1.1.${"A".repeat(395)}', 1, 'texto')`, [conversa, P.ana]);
await dono("insert into interno.conversa_mensagens (conversa, autor, corpo, versao, tipo, detalhe) values ($1, $2, 'sistema', 0, 'sistema', '{}')", [conversa, P.ana]);
await dono("update interno.conversa_membros set lido_em = now(), digitando_em = now(), digitando = 'texto' where conversa = $1", [conversa]);

await espera("a migração instala sobre o install.sql", () => exec(sql));
await espera("de novo (idempotente)", () => exec(sql));
await espera("o install.sql inteiro de novo e a migração por cima", async () => {
  await banco.instalarDeNovo();
  await exec(sql);
  return true;
});

// ═══════════════════ 2. O banco inteiro na mão (antes de qualquer mensagem nova) ═══════════════════
await espera("a mensagem cifrada de antes saiu (não tem o autor por dentro); o aviso do sistema ficou, com número", async () => (await dono("select tipo, numero from interno.conversa_mensagens where conversa = $1", [conversa])).rows, (r) => r.length === 1 && r[0].tipo === "sistema" && Number(r[0].numero) === 1);
const colunasDe = async (t) => (await dono("select column_name as c, data_type as t from information_schema.columns where table_schema = 'interno' and table_name = $1", [t])).rows;
const cm = await colunasDe("conversa_mensagens");
ok("conversa_mensagens: a hora virou dia (criado_em e expira_em são date)", cm.find((c) => c.c === "criado_em")?.t === "date" && cm.find((c) => c.c === "expira_em")?.t === "date");
ok("conversa_mensagens: a ordem global saiu; o número por conversa ficou", !cm.some((c) => c.c === "ordem") && cm.some((c) => c.c === "numero"));
ok("conversa_mensagens: nenhuma coluna com hora", !cm.some((c) => /timestamp/.test(c.t)), cm.map((c) => `${c.c}:${c.t}`).join());
const mb = await colunasDe("conversa_membros");
ok("conversa_membros: sem lido_em, recebido_em, digitando_em, digitando, avisado_em", !mb.some((c) => /^(lido_em|recebido_em|digitando_em|digitando|avisado_em)$/.test(c.c)), mb.map((c) => c.c).join());
ok("conversas: a última movimentação é só o dia", (await colunasDe("conversas")).find((c) => c.c === "movida_em")?.t === "date");
await recusa("o banco recusa mensagem cifrada com autor (a regra fica na tabela)", () => dono(`insert into interno.conversa_mensagens (conversa, numero, autor, corpo, versao, tipo, dono) values ($1, 99, $2, 'x', 1, 'texto', '\\x${"00".repeat(32)}')`, [conversa, P.ana]), "conversa_mensagens_sem_autor");
await recusa("e mensagem cifrada sem o resumo de dono", () => dono("insert into interno.conversa_mensagens (conversa, numero, corpo, versao, tipo) values ($1, 98, 'x', 1, 'texto')", [conversa]), "conversa_mensagens_dono");
ok("as funções que gravavam leitura e digitando não existem mais", (await dono("select count(*)::int as n from pg_proc where proname in ('chat_digitando','chat_recebidas')")).rows[0].n === 0);
ok("chat_enviar e chat_apagar só na forma nova", (await dono("select array_agg(oid::regprocedure::text order by 1) as f from pg_proc where proname in ('chat_enviar','chat_apagar','chat_anexo_enviar')")).rows[0].f.join() === "chat_anexo_enviar(uuid,text,boolean,text),chat_apagar(uuid,text),chat_enviar(uuid,uuid,text,text,uuid,uuid[],text,text)");
ok("as funções novas de interno: ninguém de fora chama", (await dono(`select bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')) as ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname in ('chat_resumo_da_ficha','chat_dono','chat_proximo_numero','chat_lido_ate')`)).rows[0].ok === true);

// ═══════════════════ 3. Aparelhos, identidades e o MLS ═══════════════════
const M = await motorNoNode();
await dono("delete from interno.limites").catch(() => undefined);
async function aparelhoDe(quem) {
  const par = await novoAparelho();
  const id = await novaIdentidade();
  const r = await rpc(como(P[quem]), "chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: `teste de ${quem}`, p_assina: id.publica, p_certificado: await certificarAparelho(id, P[quem], par.publica) });
  const conhecidas = new Map();
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const memoria = new Map();
  const mls = criarMlsDaEquipe({
    chamar: (f, a) => rpc(como(P[quem]), f, a),
    aparelho: r.id,
    usuario: P[quem],
    assinar: (t) => assinar(id.privada, t),
    verificar,
    identidadeDe: (u) => conhecidas.get(u) ?? null,
    guarda: { ler: async (c) => memoria.get(c) ?? null, guardar: async (c, v) => void memoria.set(c, v), apagar: async (c) => void memoria.delete(c) },
    abrirMotor: async () => ({ M, cc }),
  });
  const ap = { quem, id: r.id, identidade: id, mls, chave: await chaveDasFichas(id) };
  ap.carregar = async () => {
    const e = await mls.estado(conversa, true);
    for (const p of e.identidades) if (p.assina && !conhecidas.has(p.usuario)) conhecidas.set(p.usuario, p.assina);
  };
  /** O que components/painel/Sigilo.tsx faz para enviar (enviarMensagem). Devolve o lugar, o corpo e a resposta do banco. */
  ap.enviar = async ({ texto, tipo = "texto", alvo = null, anexos = null, prova = null, hora = Date.now(), id: idDada = null }) => {
    await ap.carregar();
    const l = { conversa, id: idDada ?? novoIdDeMensagem(), tipo, alvo };
    const corpo = await mls.cifrar(conversa, contextoDaMensagem(conversa, l.id), (epoca) => assinarMensagem(id, l, epoca, P[quem], hora, texto));
    const { dono: d } = fichaDoEnvio(ap.chave, l);
    const resposta = await rpc(como(P[quem]), "chat_enviar", { p_id: conversa, p_mensagem: l.id, p_corpo: corpo, p_tipo: tipo, p_alvo: alvo, p_anexos: anexos, p_dono: d, p_prova: prova });
    return { l, corpo, resposta };
  };
  ap.abrir = async (l, corpo) => {
    await ap.carregar().catch(() => undefined);
    const r = await mls.abrir(conversa, corpo, contextoDaMensagem(conversa, l.id));
    return r ? abrirMensagem(r.texto, l, r.epoca, (u) => conhecidas.get(u) ?? null) : null;
  };
  return ap;
}
const A = await aparelhoDe("ana"), B = await aparelhoDe("bia"), C = await aparelhoDe("caio");
for (const ap of [B, C]) await ap.mls.preparar();

// ═══════════════════ 4. Ponta a ponta ═══════════════════
const hora = Date.now();
const m1 = await espera("a Ana envia (o aparelho escolhe o id; o banco devolve o número)", () => A.enviar({ texto: "Reunião às 15h.", hora }), (r) => r.resposta.id === r.l.id && Number(r.resposta.numero) === 2);
const aberta = await espera("a Bia abre: o texto, quem escreveu (a Ana) e a hora vêm de dentro, com a assinatura conferida", () => B.abrir(m1.l, m1.corpo), (r) => r.texto === "Reunião às 15h." && r.autor === P.ana && r.hora === hora && r.autoria === "ok");
await espera("com o id trocado (o banco põe o corpo em outra linha), não abre", () => B.abrir({ ...m1.l, id: novoIdDeMensagem() }, m1.corpo), (r) => r === null);
await espera("com o tipo trocado (texto vira reação), a assinatura não confere", () => B.abrir({ ...m1.l, tipo: "reacao" }, m1.corpo), (r) => r === null || r.autoria !== "ok");
await espera("o banco não guardou autor nem hora; o dia (o do banco) e o número sim", async () => (await dono("select autor, criado_em::text as dia, current_date::text as hoje, numero from interno.conversa_mensagens where id = $1", [m1.l.id])).rows[0], (r) => r.autor === null && r.dia === r.hoje && Number(r.numero) === 2);
await espera("chat_ver não tem autor, nome, hora, leitura nem digitando nas mensagens cifradas", () => rpc(como(P.bia), "chat_ver", { p_id: conversa }), (v) => {
  const m = v.mensagens.find((x) => x.id === m1.l.id);
  return m && m.autor === null && !("nome" in m) && !("minha" in m) && !("criado_em" in m) && m.dia && v.membros.every((x) => !("lido_em" in x) && !("recebido_em" in x) && !("digitando" in x));
});

// Pela ordem das transações: nada com a conta da Ana na transação do envio.
{
  const xmin = (await dono("select xmin::text as x from interno.conversa_mensagens where id = $1", [m1.l.id])).rows[0].x;
  const tabelas = (await dono("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('interno','public') and c.relkind = 'r'")).rows.map((r) => r.relname);
  const achados = [];
  for (const t of tabelas) {
    const linhas = (await dono(`select row_to_json(x)::text as j from interno."${t}" x where x.xmin::text = $1`, [xmin]).catch(() => dono(`select row_to_json(x)::text as j from public."${t}" x where x.xmin::text = $1`, [xmin]).catch(() => ({ rows: [] })))).rows;
    for (const l of linhas) if (l.j.includes(P.ana)) achados.push(`${t}: ${l.j.slice(0, 120)}`);
  }
  ok("pela ordem das transações: o envio não gravou nada com a conta de quem enviou", achados.length === 0, achados.join(" | "));
}

// Editar e apagar com a ficha.
const fichaM1 = ficha(A.chave, "mensagem", conversa, m1.l.id);
await recusa("a Bia não edita a mensagem da Ana (não tem a ficha)", () => B.enviar({ texto: "editado", tipo: "edicao", alvo: m1.l.id, prova: ficha(B.chave, "mensagem", conversa, m1.l.id) }), "sem_permissao");
await recusa("nem sem ficha", () => B.enviar({ texto: "editado", tipo: "edicao", alvo: m1.l.id, prova: null }), "sem_permissao");
const ed = await espera("a Ana edita (com a ficha da original)", () => A.enviar({ texto: "Reunião às 16h.", tipo: "edicao", alvo: m1.l.id, prova: fichaM1, hora: hora + 60_000 }), (r) => Boolean(r.resposta.id));
const edAberta = ed && (await B.abrir(ed.l, ed.corpo));
ok("a edição vale no aparelho da Bia (mesmo autor, dentro do prazo, pela hora assinada)", edicaoValida(aberta, edAberta) && edAberta.texto === "Reunião às 16h.");
const tarde = await A.enviar({ texto: "muito depois", tipo: "edicao", alvo: m1.l.id, prova: fichaM1, hora: hora + 20 * 60_000 });
ok("edição fora dos 15 minutos (pela hora assinada) não vale no aparelho", !edicaoValida(aberta, await B.abrir(tarde.l, tarde.corpo)));

// Reações: a mesma pessoa troca a própria, sem o banco saber quem é.
await espera("a Bia reage", () => B.enviar({ texto: '{"emoji":"👍"}', tipo: "reacao", alvo: m1.l.id }));
await espera("a Bia troca a reação (a anterior sai)", () => B.enviar({ texto: '{"emoji":"🎉"}', tipo: "reacao", alvo: m1.l.id }));
await espera("o Caio reage", () => C.enviar({ texto: '{"emoji":"👍"}', tipo: "reacao", alvo: m1.l.id }));
await espera("ficam duas reações (uma de cada um), sem autor no banco", async () => (await dono("select count(*)::int as n, count(autor)::int as a, count(distinct dono)::int as d from interno.conversa_mensagens where alvo = $1 and tipo = 'reacao'", [m1.l.id])).rows[0], (r) => r.n === 2 && r.a === 0 && r.d === 2);
await espera("o resumo de dono não se repete entre as mensagens da mesma pessoa", async () => (await dono("select count(*)::int as n, count(distinct dono)::int as d from interno.conversa_mensagens where tipo <> 'sistema'")).rows[0], (r) => r.n === r.d);

// Anexos: sobem com o resumo da ficha, sem autor; só a mesma ficha prende.
const lAnexo = { conversa, id: novoIdDeMensagem(), tipo: "texto", alvo: null };
const { dono: donoAnexo } = fichaDoEnvio(A.chave, lAnexo);
const anexo = await espera("a Ana sobe um anexo (sem autor no banco)", () => rpc(como(P.ana), "chat_anexo_enviar", { p_conversa: conversa, p_cifrado: Buffer.alloc(64, 7).toString("base64"), p_uma_vez: false, p_dono: donoAnexo }), (r) => Boolean(r.id));
{
  const xmin = (await dono("select xmin::text as x, autor from interno.conversa_anexos where id = $1", [anexo.id])).rows[0];
  const lim = (await dono("select count(*)::int as n from interno.limites where xmin::text = $1", [xmin.x])).rows[0].n;
  ok("subir anexo não grava autor nem limite por pessoa na mesma transação", xmin.autor === null && lim === 0);
}
await recusa("a Bia não prende o anexo da Ana na mensagem dela (outra ficha)", () => B.enviar({ texto: "roubei", anexos: [anexo.id] }), "invalido:anexos");
await espera("a Ana prende o anexo na mensagem (mesma ficha); preso, fica só com o dia", async () => {
  await A.enviar({ texto: "segue o arquivo", anexos: [anexo.id], id: lAnexo.id });
  return (await dono("select mensagem, dono, to_char(criado_em at time zone 'UTC', 'HH24:MI:SS') as h from interno.conversa_anexos where id = $1", [anexo.id])).rows[0];
}, (r) => r.mensagem === lAnexo.id && r.dono === null && r.h === "00:00:00");

// Apagar.
await recusa("a Bia não apaga a mensagem da Ana", () => rpc(como(P.bia), "chat_apagar", { p_id: m1.l.id, p_prova: ficha(B.chave, "mensagem", conversa, m1.l.id) }), "nao_encontrado");
await recusa("a Ana não apaga com a ficha de outra mensagem dela", () => rpc(como(P.ana), "chat_apagar", { p_id: m1.l.id, p_prova: ficha(A.chave, "mensagem", conversa, lAnexo.id) }), "nao_encontrado");
await recusa("id repetido não entra", () => A.enviar({ texto: "de novo", id: lAnexo.id }), "invalido:mensagem");
await espera("a Ana apaga a dela (as edições e reações vão junto)", async () => {
  await rpc(como(P.ana), "chat_apagar", { p_id: m1.l.id, p_prova: fichaM1 });
  return (await dono("select count(*)::int as n from interno.conversa_mensagens where id = $1 or alvo = $1", [m1.l.id])).rows[0].n;
}, (n) => n === 0);

// Não lidas: pelo "lido até" do aparelho, sem gravar.
const resumo = (lista) => lista.find((c) => c.id === conversa);
await espera("sem nada lido no aparelho, as mensagens de texto contam como não lidas", () => rpc(como(P.bia), "chat_conversas", { p_lidos: {} }), (l) => resumo(l).nao_lidas >= 1 && resumo(l).ultima && !("autor" in resumo(l).ultima) && !("minha" in resumo(l).ultima));
const ultimo = Number((await dono("select ultimo_numero from interno.conversas where id = $1", [conversa])).rows[0].ultimo_numero);
await espera("com o lido até o último número, nenhuma", () => rpc(como(P.bia), "chat_conversas", { p_lidos: { [conversa]: ultimo } }), (l) => resumo(l).nao_lidas === 0);
await espera("presença conta pelo mapa do aparelho", async () => [(await rpc(como(P.bia), "presenca", { p_lidos: {} })).conversas, (await rpc(como(P.bia), "presenca", { p_lidos: { [conversa]: ultimo } })).conversas], ([a, b]) => a === 1 && b === 0);
await espera("contar não grava o mapa em lugar nenhum", async () => (await dono("select count(*)::int as n from interno.conversa_membros where avisado_ate <> 0")).rows[0].n, (n) => n === 0);
{
  const mem = new Map();
  const a = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  marcarLida(P.bia, conversa, 5, a);
  marcarLida(P.bia, conversa, 3, a);
  marcarLida(P.bia, "nao-e-uuid", 9, a);
  ok("o lido até do aparelho só anda para a frente e só guarda conversa válida, numa chave que o pânico apaga", JSON.stringify(lidas(P.bia, a)) === JSON.stringify({ [conversa]: 5 }) && [...mem.keys()].every((k) => k.startsWith("lucia-")));
}

// O aviso por e-mail: conta por número, sem hora de leitura; quem visitou o painel no dia não recebe.
await espera("o aviso por e-mail roda (sem lido_em) e anda o avisado_ate só de quem não passou pelo painel", async () => {
  await dono("update interno.perfis set visto_em = now() - interval '5 days' where id = $1", [P.caio]);
  await dono("update interno.conversa_mensagens set criado_em = current_date - 1 where conversa = $1", [conversa]);
  await dono("select interno.chat_emails()");
  return (await dono("select usuario, avisado_ate from interno.conversa_membros where conversa = $1", [conversa])).rows;
}, (r) => r.every((x) => (x.usuario === P.caio ? true : Number(x.avisado_ate) === 0)));

// ═══════════════════ 5. O cliente ═══════════════════
const sigilo = fs.readFileSync(path.join(raiz, "components/painel/Sigilo.tsx"), "utf8");
const conversas = fs.readFileSync(path.join(raiz, "components/painel/Conversas.tsx"), "utf8");
const casca = fs.readFileSync(path.join(raiz, "components/painel/casca/Dentro.tsx"), "utf8");
ok("o painel não chama mais as funções de leitura e digitando", !/chat_digitando|chat_recebidas/.test(conversas));
ok("o painel envia pelo caminho novo (id, ficha e assinatura de dentro)", /enviarMensagem/.test(sigilo) && /fichaDoEnvio/.test(sigilo) && /p_mensagem/.test(sigilo) && /enviarMensagem\(/.test(conversas));
ok("o painel não usa mais o autor nem a hora do banco nas mensagens", !/mensagem\.criado_em|membro\.lido_em|membro\.recebido_em|membro\.digitando/.test(conversas));
ok("a casca conta as não lidas com o lido até do aparelho", /instantaneoDasLidas\(/.test(casca) &&/p_lidos/.test(casca));

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
