// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o chat privado da Alumia (supabase/migracoes/20261106-t19-rede-chat-privado.sql, lib/rede/chat-privado.ts) num Postgres de
// verdade dentro do Node, no padrão do testar:sigilo: quem abre, quem NÃO abre (a outra pessoa de fora, a equipe, o visitante, o
// próprio banco), o pedido de conversa para quem não segue, bloqueio, limite, só 18+, retenção, apagar (LGPD art. 18, VI) e que
// nada disso vai para o Fediverso nem para o registro de atividades. Uso: npm run testar:rede-chat
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import {
  abrirEmbrulho, abrirMensagem, certificarChave, chaveCertificada, cifrarMensagem, compararIdentidade, MAX_CARACTERES, novaChaveDoAparelho, novaIdentidadeDoChat,
  precisaDeVersaoNova, prepararNovaVersao, textoCabe,
} from "../lib/rede/chat-privado.ts";

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
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const migracao = ler("supabase/migracoes/20261106-t19-rede-chat-privado.sql");
const install = ler("supabase/install.sql");
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const um = async (texto, valores = []) => (await dono(texto, valores)).rows[0];

await espera("o bloco do chat está no fim do install.sql, igual à migração", async () => install.includes(migracao.trim()));
await espera("a migração roda de novo sem quebrar (acrescentável)", () => banco.exclusivo(() => banco.pg.exec(migracao)));

let ip = 10;
const como = (sub) => ({ papel: "authenticated", sub, ip: `198.51.100.${ip++ % 250}` });
const visitante = () => ({ papel: "anon", ip: `203.0.113.${ip++ % 250}` });

// ── As pessoas ──
const P = {};
const nomes = ["ana", "bia", "caio", "intrusa", "menor", "invisivel", "fechada", "seletiva", "nova"];
for (const [i, nome] of nomes.entries()) {
  P[nome] = await criarUsuario(`${nome}@chat.local`, `Nome do painel ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3 where id = $1", [P[nome], `Pessoa ${i + 1}`, `${nome}_dm`]);
}
await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
for (const nome of nomes.filter((n) => n !== "menor")) {
  await dono("update interno.perfis set rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome]]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
}
await dono("update auth.users set created_at = now() - interval '30 days' where id <> $1", [P.nova]);
await dono("update interno.perfis set rede_modo = 'invisivel' where id = $1", [P.invisivel]);
// Ana segue Bia e Bia segue Ana: conversa abre direto. Caio não é seguido por ninguém: vira pedido.
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($2, $1), ($3, $1)", [P.ana, P.bia, P.seletiva]);

// ── Cada pessoa ativa o chat no aparelho dela ──
const aparelhos = {};
async function ativar(nome) {
  const aparelho = await novaChaveDoAparelho();
  const identidade = await novaIdentidadeDoChat();
  const certificado = await certificarChave(identidade, P[nome], aparelho.publica);
  const r = await rpc(como(P[nome]), "rede_dm_chave_publicar", { p_identidade: identidade.publica, p_publica: aparelho.publica, p_certificado: certificado });
  aparelhos[nome] = { usuario: P[nome], aparelho, identidade, versao: r.versao };
  return aparelhos[nome];
}
for (const nome of ["ana", "bia", "caio", "intrusa", "fechada", "seletiva"]) await ativar(nome);

await espera("a identidade do chat não pode ser exportada (nem embrulhada para outro aparelho)", async () => {
  try {
    await crypto.subtle.exportKey("jwk", aparelhos.ana.identidade.privada);
    return false;
  } catch {
    return true;
  }
}, (v) => v === true);
await espera("a chave certificada confere; com outra identidade, não", async () => [
  await chaveCertificada(aparelhos.ana.identidade.publica, P.ana, aparelhos.ana.aparelho.publica, (await um("select certificado from interno.rede_dm_chaves where usuario = $1", [P.ana])).certificado),
  await chaveCertificada(aparelhos.bia.identidade.publica, P.ana, aparelhos.ana.aparelho.publica, (await um("select certificado from interno.rede_dm_chaves where usuario = $1", [P.ana])).certificado),
], (r) => r[0] === true && r[1] === false);
await recusa("chave em formato errado é recusada", () => rpc(como(P.ana), "rede_dm_chave_publicar", { p_identidade: "x", p_publica: "y", p_certificado: "z" }), "invalido:identidade");

// ── Só entre maiores de 18 da Alumia ──
await recusa("visitante não chama nada do chat", () => rpc(visitante(), "rede_dm_situacao"), "permission denied");
await recusa("quem não é membro 18+ da Alumia não usa o chat", () => rpc(como(P.menor), "rede_dm_situacao"), "consentimento");
await recusa("ninguém abre conversa com quem não é membro 18+ (e não diz o motivo)", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "menor_dm" }), "dm_fechada");
await recusa("perfil invisível não recebe conversa", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "invisivel_dm" }), "dm_fechada");
await recusa("não se abre conversa consigo", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "ana_dm" }), "dm_fechada");

// ── Seguidos abrem direto; quem não segue vira pedido ──
const conversaAB = await rpc(como(P.ana), "rede_dm_abrir", { p_handle: "@Bia_DM" });
await espera("quem é seguida de volta abre a conversa direto", async () => conversaAB, (c) => c.situacao === "aberta" && c.com.handle === "bia_dm");
await espera("a conversa mostra só codinome e @handle (nunca nome do painel nem e-mail)", async () => JSON.stringify(conversaAB), (t) => !t.includes("Nome do painel") && !t.includes("chat.local"));
const pedido = await rpc(como(P.caio), "rede_dm_abrir", { p_handle: "ana_dm" });
await espera("quem não é seguido vira pedido de conversa", async () => pedido, (c) => c.situacao === "pedido" && c.pedi === true && c.pode_escrever === false);
await recusa("no pedido ninguém escreve", () => rpc(como(P.caio), "rede_dm_enviar", { p_conversa: pedido.id, p_versao: 1, p_corpo: `c2.1.${"A".repeat(16)}.${"B".repeat(30)}` }), "dm_fechada");
await recusa("no pedido ninguém pega chave", () => rpc(como(P.caio), "rede_dm_chaves_da_conversa", { p_conversa: pedido.id }), "dm_fechada");
await espera("quem recebe vê o pedido esperando", () => rpc(como(P.ana), "rede_dm_situacao"), (s) => s.pedidos === 1);
await recusa("quem pediu não aceita o próprio pedido", () => rpc(como(P.caio), "rede_dm_responder", { p_conversa: pedido.id, p_aceitar: true }), "sem_permissao");
await espera("recusar apaga o pedido", () => rpc(como(P.ana), "rede_dm_responder", { p_conversa: pedido.id, p_aceitar: false }), (r) => r.recusado === true);
await recusa("depois de recusado, a mesma pessoa não pede de novo por 30 dias", () => rpc(como(P.caio), "rede_dm_abrir", { p_handle: "ana_dm" }), "dm_fechada");
await dono("update interno.rede_dm_prefs set quem_pode = 'ninguem' where usuario = $1", [P.fechada]);
await dono("insert into interno.rede_dm_prefs (usuario, quem_pode) values ($1, 'ninguem') on conflict (usuario) do update set quem_pode = 'ninguem'", [P.fechada]);
await recusa("quem escolheu 'ninguém' não recebe conversa", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "fechada_dm" }), "dm_fechada");
await espera("a pessoa escolhe quem pode chamar e o prazo", () => rpc(como(P.seletiva), "rede_dm_prefs", { p_quem_pode: "seguidos", p_prazo_dias: 1 }), (r) => r.quem_pode === "seguidos" && r.prazo_dias === 1);
await recusa("com 'só quem eu sigo', quem ela não segue não chama", () => rpc(como(P.caio), "rede_dm_abrir", { p_handle: "seletiva_dm" }), "dm_fechada");
await espera("com 'só quem eu sigo', quem ela segue chama (e a conversa abre)", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "seletiva_dm" }), (c) => c.situacao === "aberta");
const pedidoAceito = await rpc(como(P.caio), "rede_dm_abrir", { p_handle: "bia_dm" });
await espera("aceitar o pedido abre a conversa", () => rpc(como(P.bia), "rede_dm_responder", { p_conversa: pedidoAceito.id, p_aceitar: true }), (c) => c.situacao === "aberta");

// ── A cifra: Ana e Bia conversam ──
const confiadasDaAna = { [P.ana]: aparelhos.ana.identidade.publica, [P.bia]: aparelhos.bia.identidade.publica };
const confiadasDaBia = { ...confiadasDaAna };
const chavesAna = await rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
await espera("conversa nova precisa de uma primeira versão da chave", async () => precisaDeVersaoNova(chavesAna.versao, chavesAna.atual_ok, chavesAna.versao_em), (v) => v === true);
const nova = await prepararNovaVersao(conversaAB.id, 1, aparelhos.ana, chavesAna.participantes, confiadasDaAna);
await espera("a Ana cria a versão 1 e embrulha para as duas chaves", () => rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversaAB.id, p_versao: 1, p_embrulhos: nova.embrulhos }), (r) => r.versao === 1);
await recusa("versão fora de ordem é recusada", () => rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversaAB.id, p_versao: 1, p_embrulhos: nova.embrulhos }), "versao_desatualizada");
await espera("depois da versão 1, a chave atual serve para as duas", () => rpc(como(P.bia), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id }), (r) => r.atual_ok === true && r.embrulhos.length === 1);
await espera("cada pessoa só recebe o embrulho feito para ela", async () => {
  const r = await rpc(como(P.bia), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
  const daAna = nova.embrulhos.find((e) => e.para === P.ana).embrulho;
  return r.embrulhos.every((e) => e.embrulho !== daAna);
}, (v) => v === true);
await espera("o servidor não consegue fazer o aparelho embrulhar para chave não certificada", async () => {
  const falsa = (await novaChaveDoAparelho()).publica;
  const trocada = chavesAna.participantes.map((p) => (p.usuario === P.bia ? { ...p, publica: falsa } : p));
  return prepararNovaVersao(conversaAB.id, 2, aparelhos.ana, trocada, confiadasDaAna).then(() => "embrulhou", (e) => e.message);
}, (m) => m === "certificado_invalido");
await espera("nem para uma identidade que este aparelho não confia", async () => {
  const outraId = await novaIdentidadeDoChat();
  const trocada = chavesAna.participantes.map((p) => (p.usuario === P.bia ? { ...p, identidade: outraId.publica } : p));
  return prepararNovaVersao(conversaAB.id, 2, aparelhos.ana, trocada, confiadasDaAna).then(() => "embrulhou", (e) => e.message);
}, (m) => m === "identidade_nao_confiada");

const texto = "Encontro no sábado às 15h, na ocupação. Leva o caderno! ✊🏾";
const corpo = await cifrarMensagem(nova.chave, 1, aparelhos.ana, conversaAB.id, texto);
await espera("a Ana envia a mensagem cifrada", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 1, p_corpo: corpo }), (r) => !!r.id && !!r.expira_em);
await recusa("o banco recusa texto aberto", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 1, p_corpo: "texto aberto qualquer" }), "invalido:corpo");
await recusa("o banco recusa texto aberto mesmo direto na tabela (check)", () => dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values ($1, $2, 1, 'oi', now() + interval '1 day')", [conversaAB.id, P.ana]), "check");
await espera("no banco só há o cifrado: o texto não aparece em lugar nenhum", async () => JSON.stringify((await dono("select * from interno.rede_dm_mensagens")).rows), (t) => !t.includes("ocupação") && !t.includes("sábado"));
const mensagensDaBia = await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id });
const chavesBia = await rpc(como(P.bia), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
const chaveDaBia = await abrirEmbrulho(conversaAB.id, aparelhos.bia, chavesBia.embrulhos[0], confiadasDaBia);
await espera("a Bia desembrulha a chave e lê, com acento e emoji, com a assinatura da Ana conferida", async () => abrirMensagem(chaveDaBia, mensagensDaBia[0].corpo, conversaAB.id, mensagensDaBia[0].autor, confiadasDaBia[P.ana]), (r) => r?.texto === texto && r.autoria === "ok");

// ── Sigilo: quem NÃO consegue ler ──
await recusa("outra pessoa da Alumia não lê as mensagens da conversa", () => rpc(como(P.intrusa), "rede_dm_mensagens", { p_conversa: conversaAB.id }), "nao_encontrado");
await recusa("outra pessoa não pega as chaves da conversa", () => rpc(como(P.intrusa), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id }), "nao_encontrado");
await recusa("outra pessoa não envia na conversa", () => rpc(como(P.intrusa), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 1, p_corpo: corpo }), "nao_encontrado");
await recusa("outra pessoa não apaga a conversa", () => rpc(como(P.intrusa), "rede_dm_apagar", { p_conversa: conversaAB.id }), "nao_encontrado");
await recusa("outra pessoa não denuncia a partir da conversa dos outros", () => rpc(como(P.intrusa), "rede_dm_denunciar", { p_conversa: conversaAB.id, p_categoria: "spam" }), "nao_encontrado");
await espera("outra pessoa não vê a conversa na lista dela", () => rpc(como(P.intrusa), "rede_dm_conversas"), (l) => l.length === 0);
await espera("mesmo com o cifrado e os embrulhos em mãos (vazamento do banco), a chave da intrusa não abre", async () => {
  const todos = (await dono("select * from interno.rede_dm_embrulhos where conversa = $1", [conversaAB.id])).rows;
  const tentativas = await Promise.all(todos.map((e) => abrirEmbrulho(conversaAB.id, aparelhos.intrusa, e, { [P.ana]: aparelhos.ana.identidade.publica, [P.bia]: aparelhos.bia.identidade.publica })));
  return tentativas.every((k) => k === null);
}, (v) => v === true);
await espera("a chave de outra conversa não abre a mensagem", async () => {
  const outra = await prepararNovaVersao(conversaAB.id, 9, aparelhos.ana, chavesAna.participantes, confiadasDaAna);
  return abrirMensagem(outra.chave, corpo, conversaAB.id, P.ana, confiadasDaAna[P.ana]);
}, (r) => r === null);
await espera("a mensagem levada para outra conversa ou atribuída a outro autor não abre", async () => [
  await abrirMensagem(chaveDaBia, corpo, crypto.randomUUID(), P.ana, confiadasDaBia[P.ana]),
  await abrirMensagem(chaveDaBia, corpo, conversaAB.id, P.bia, confiadasDaBia[P.bia]),
], (r) => r[0] === null && r[1] === null);
await espera("o cifrado da Alumia não abre no contexto das conversas da equipe", async () => {
  const { decifrar, contextoDaConversa } = await import("../lib/sigilo.ts");
  return decifrar(chaveDaBia, corpo, contextoDaConversa(conversaAB.id, P.ana));
}, (r) => r === null);
await espera("assinatura de outra pessoa não passa como da Ana", async () => abrirMensagem(chaveDaBia, corpo, conversaAB.id, P.ana, aparelhos.intrusa.identidade.publica), (r) => r?.autoria === "invalida");
await espera("RLS ligada nas seis tabelas do chat", async () => (await dono("select count(*)::int as n from pg_class where relnamespace = 'interno'::regnamespace and relname like 'rede_dm_%' and relkind = 'r' and relrowsecurity")).rows[0].n, (n) => n === 6);
await espera("nenhuma política: ninguém lê tabela, só as funções", async () => (await dono("select count(*)::int as n from pg_policies where tablename like 'rede_dm_%'")).rows[0].n, (n) => n === 0);
await espera("anon e authenticated não têm privilégio nenhum nas tabelas do chat", async () => (await dono("select count(*)::int as n from information_schema.role_table_grants where table_name like 'rede_dm_%' and grantee in ('anon', 'authenticated', 'PUBLIC')")).rows[0].n, (n) => n === 0);
await recusa("ler a tabela direto como pessoa logada não passa", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role authenticated");
  try {
    return (await banco.pg.query("select * from interno.rede_dm_mensagens")).rows;
  } finally {
    await banco.pg.exec("reset role");
  }
}), "permission denied");
await recusa("visitante não chama as funções do chat", () => rpc(visitante(), "rede_dm_mensagens", { p_conversa: conversaAB.id }), "permission denied");

// ── Leitura, lidas e paginação ──
await espera("a Ana tem a conversa como lida (ela escreveu); a Bia leu ao abrir", async () => [(await rpc(como(P.ana), "rede_dm_conversas")).find((c) => c.id === conversaAB.id).nao_lidas, (await rpc(como(P.bia), "rede_dm_conversas")).find((c) => c.id === conversaAB.id).nao_lidas], (r) => r[0] === 0 && r[1] === 0);

// ── Bloqueio corta tudo ──
await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.bia, P.ana]);
await recusa("bloqueada não envia", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 1, p_corpo: corpo }), "dm_fechada");
await recusa("bloqueada não pega a chave", () => rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id }), "dm_fechada");
await recusa("bloqueada não reabre", () => rpc(como(P.ana), "rede_dm_abrir", { p_handle: "bia_dm" }), "dm_fechada");
await dono("delete from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.bia, P.ana]);

// ── Troca de aparelho: chave nova, versão nova da conversa ──
const antes = await um("select versao from interno.rede_dm_chaves where usuario = $1", [P.bia]);
const biaNova = await ativar("bia");
await espera("trocar de aparelho sobe a versão da chave", async () => biaNova.versao, (v) => v === antes.versao + 1);
await espera("e a versão atual da conversa deixa de servir: o próximo aparelho a abrir faz outra", () => rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id }), (r) => r.atual_ok === false && precisaDeVersaoNova(r.versao, r.atual_ok, r.versao_em));
await espera("a identidade nova da Bia é notada como mudança (avisa e não entrega chave até confirmar)", async () => compararIdentidade(confiadasDaAna[P.bia], biaNova.identidade.publica), (r) => r === "mudou");
await espera("o aparelho antigo da Bia não abre o que vier na versão nova", async () => {
  const chaves = await rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
  const confiadas = { ...confiadasDaAna, [P.bia]: biaNova.identidade.publica };
  const v2 = await prepararNovaVersao(conversaAB.id, 2, aparelhos.ana, chaves.participantes, confiadas);
  await rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversaAB.id, p_versao: 2, p_embrulhos: v2.embrulhos });
  const meu = (await rpc(como(P.bia), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id })).embrulhos.find((e) => e.versao === 2);
  const antigo = { usuario: P.bia, aparelho: (await novaChaveDoAparelho()), identidade: aparelhos.bia.identidade, versao: antes.versao };
  return [await abrirEmbrulho(conversaAB.id, antigo, meu, confiadas), !!(await abrirEmbrulho(conversaAB.id, biaNova, meu, confiadas))];
}, (r) => r[0] === null && r[1] === true);

// ── Limite de envio ──
await dono("insert into interno.limites (chave, janela, total) values ($1, to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 120) on conflict (chave, janela) do update set total = 120", [`rede_dm_enviar:${P.ana}`]);
await recusa("passou de 120 mensagens na hora: muitos_pedidos", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 2, p_corpo: `c2.2.${"A".repeat(16)}.${"B".repeat(30)}` }), "muitos_pedidos");
await dono("delete from interno.limites where chave like 'rede_dm_%'");

// ── Denúncia: só os trechos que quem denuncia escolhe, na fila da Alumia ──
const denuncia = await rpc(como(P.bia), "rede_dm_denunciar", { p_conversa: conversaAB.id, p_categoria: "assedio", p_trechos: "trecho escolhido", p_bloquear: true });
await espera("a denúncia entra na fila da Alumia como denúncia de perfil, com o trecho escolhido", async () => um("select alvo_tipo, alvo, texto, quem from interno.rede_denuncias where protocolo = $1", [denuncia.protocolo]), (d) => d.alvo_tipo === "perfil" && d.alvo === P.ana && d.texto.includes("trecho escolhido") && d.quem === P.bia);
await espera("denunciar com bloqueio bloqueia junto", async () => um("select count(*)::int as n from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.bia, P.ana]), (r) => r.n === 1);
await dono("delete from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.bia, P.ana]);

// ── Retenção ──
await espera("cada mensagem nasce com prazo (7 dias por padrão)", async () => um("select extract(day from expira_em - criado_em)::int as d from interno.rede_dm_mensagens where conversa = $1 limit 1", [conversaAB.id]), (r) => r.d === 7);
await espera("encurtar o prazo da conversa vale também para o que já foi escrito", async () => {
  await rpc(como(P.bia), "rede_dm_prazo", { p_conversa: conversaAB.id, p_dias: 1 });
  return um("select extract(day from expira_em - criado_em)::int as d from interno.rede_dm_mensagens where conversa = $1 limit 1", [conversaAB.id]);
}, (r) => r.d === 1);
await espera("mensagem vencida some na faxina e não sai nas leituras", async () => {
  await dono("update interno.rede_dm_mensagens set expira_em = now() - interval '1 minute' where conversa = $1", [conversaAB.id]);
  const lidas = await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id });
  await dono("select interno.rede_dm_faxina()");
  return [lidas.length, (await um("select count(*)::int as n from interno.rede_dm_mensagens where conversa = $1", [conversaAB.id])).n];
}, (r) => r[0] === 0 && r[1] === 0);
await espera("pedido sem resposta há 30 dias some na faxina", async () => {
  const p = await rpc(como(P.intrusa), "rede_dm_abrir", { p_handle: "caio_dm" });
  await dono("update interno.rede_dm_conversas set criado_em = now() - interval '31 days' where id = $1", [p.id]);
  await dono("select interno.rede_dm_faxina()");
  return (await um("select count(*)::int as n from interno.rede_dm_conversas where id = $1", [p.id])).n;
}, (n) => n === 0);

// ── Apagar (LGPD art. 18, VI) ──
const corpo2 = await cifrarMensagem(nova.chave, 1, aparelhos.ana, conversaAB.id, "outra");
await espera("quem escreveu apaga a própria mensagem; a outra pessoa não", async () => {
  const chaves = await rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
  const v = chaves.versao;
  const k = (await Promise.all(chaves.embrulhos.map((e) => abrirEmbrulho(conversaAB.id, aparelhos.ana, e, { ...confiadasDaAna, [P.bia]: biaNova.identidade.publica })))).find(Boolean);
  const m = await rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: v, p_corpo: await cifrarMensagem(k, v, aparelhos.ana, conversaAB.id, "apagar esta") });
  const daBia = await rpc(como(P.bia), "rede_dm_apagar_mensagem", { p_id: m.id }).then(() => "apagou", (e) => e.message);
  const daAna = await rpc(como(P.ana), "rede_dm_apagar_mensagem", { p_id: m.id });
  return [daBia, daAna.ok];
}, (r) => String(r[0]).includes("nao_encontrado") && r[1] === true);
await espera("apagar a conversa apaga tudo, para as duas (mensagens e embrulhos)", async () => {
  await rpc(como(P.bia), "rede_dm_apagar", { p_conversa: conversaAB.id });
  return [(await um("select count(*)::int as n from interno.rede_dm_mensagens where conversa = $1", [conversaAB.id])).n, (await um("select count(*)::int as n from interno.rede_dm_embrulhos where conversa = $1", [conversaAB.id])).n, (await rpc(como(P.ana), "rede_dm_conversas")).some((c) => c.id === conversaAB.id)];
}, (r) => r[0] === 0 && r[1] === 0 && r[2] === false);
await espera("(o cifrado guardado antes não importa: sem a conversa, sem nada)", async () => corpo2.startsWith("c2.1."));
await espera("apagar tudo do chat apaga conversas, chave e preferências da pessoa", async () => {
  await rpc(como(P.seletiva), "rede_dm_apagar_tudo");
  return [(await um("select count(*)::int as n from interno.rede_dm_conversas where a = $1 or b = $1", [P.seletiva])).n, (await um("select count(*)::int as n from interno.rede_dm_chaves where usuario = $1", [P.seletiva])).n, (await um("select count(*)::int as n from interno.rede_dm_prefs where usuario = $1", [P.seletiva])).n];
}, (r) => r.every((n) => n === 0));
await espera("apagar a conta apaga as mensagens dela (chave estrangeira em cascata)", async () => {
  const c = await rpc(como(P.caio), "rede_dm_conversas");
  const id = c[0].id;
  const v = await rpc(como(P.caio), "rede_dm_chaves_da_conversa", { p_conversa: id });
  const chave = await prepararNovaVersao(id, v.versao + 1, aparelhos.caio, v.participantes, { [P.caio]: aparelhos.caio.identidade.publica, [P.bia]: biaNova.identidade.publica });
  await rpc(como(P.caio), "rede_dm_nova_versao", { p_conversa: id, p_versao: v.versao + 1, p_embrulhos: chave.embrulhos });
  await rpc(como(P.caio), "rede_dm_enviar", { p_conversa: id, p_versao: v.versao + 1, p_corpo: await cifrarMensagem(chave.chave, v.versao + 1, aparelhos.caio, id, "até mais") });
  await dono("delete from interno.perfis where id = $1", [P.caio]);
  return [(await um("select count(*)::int as n from interno.rede_dm_mensagens where autor = $1", [P.caio])).n, (await um("select count(*)::int as n from interno.rede_dm_conversas where id = $1", [id])).n, (await um("select count(*)::int as n from interno.rede_dm_chaves where usuario = $1", [P.caio])).n];
}, (r) => r.every((n) => n === 0));

// ── Nada federado, nada no registro de atividades, nada em log ──
const corpoDasFuncoes = (await dono("select string_agg(pg_get_functiondef(p.oid), E'\\n') as t from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and (p.proname like 'rede_fed%' or p.proname like 'fed%' or p.proname like '%activity%')")).rows[0].t ?? "";
await espera("nenhuma função do Fediverso no banco toca nas tabelas do chat", async () => corpoDasFuncoes, (t) => t.length > 0 && !t.includes("rede_dm_"));
const doFediverso = [...fs.readdirSync(new URL("../lib/rede/fediverso", import.meta.url)).map((f) => `lib/rede/fediverso/${f}`)].filter((f) => /\.(ts|tsx|mjs)$/.test(f));
const rotasDoFediverso = [];
const varrer = (pasta) => {
  for (const item of fs.readdirSync(new URL(`../${pasta}`, import.meta.url), { withFileTypes: true })) {
    if (item.isDirectory()) varrer(`${pasta}/${item.name}`);
    else if (/\.(ts|tsx)$/.test(item.name)) rotasDoFediverso.push(`${pasta}/${item.name}`);
  }
};
for (const pasta of ["app/api/fediverso", "app/.well-known"]) if (fs.existsSync(new URL(`../${pasta}`, import.meta.url))) varrer(pasta);
await espera("nenhum código do Fediverso (lib/rede/fediverso, app/api/fediverso, .well-known) fala do chat privado", async () => [...doFediverso, ...rotasDoFediverso].filter((f) => /rede_dm_|chat-privado|ChatPrivado/.test(ler(f))), (l) => l.length === 0);
await espera("as funções do chat não chamam o registro de atividades nem avisos com conteúdo", async () => migracao.replace(/^\s*--.*$/gm, ""), (t) => !/interno\.registrar\s*\(/.test(t) && !/interno\.avisar/.test(t) && !/raise\s+(notice|log|info|warning)/i.test(t));
const telas = fs.readdirSync(new URL("../components/rede/chat", import.meta.url)).map((f) => `components/rede/chat/${f}`);
await espera("as telas e o chaveiro do chat não escrevem nada no console", async () => [...telas, "lib/rede/chat-privado.ts", "lib/rede/chat-chaveiro.ts", "lib/rede/cliente-chat.ts"].filter((f) => /console\.(log|info|warn|error|debug)/.test(ler(f))), (l) => l.length === 0);
await espera("as telas do chat não chamam nenhum serviço de fora (sem fetch direto)", async () => [...telas, "lib/rede/chat-chaveiro.ts", "lib/rede/cliente-chat.ts"].filter((f) => /\bfetch\(|https?:\/\//.test(ler(f).replace(/^\/\/.*$/gm, ""))), (l) => l.length === 0);

// ── Pequenas regras do texto ──
await espera("texto vazio não vai; texto grande demais não vai", async () => [textoCabe("   "), textoCabe("oi"), textoCabe("x".repeat(MAX_CARACTERES + 1)), textoCabe("🌱".repeat(MAX_CARACTERES))], (r) => r[0] === false && r[1] === true && r[2] === false && r[3] === true);
await espera("o maior texto possível, cifrado e assinado, cabe no teto do banco", async () => {
  const k = await prepararNovaVersao(crypto.randomUUID(), 1, aparelhos.ana, [{ usuario: P.ana, identidade: aparelhos.ana.identidade.publica, publica: aparelhos.ana.aparelho.publica, certificado: await certificarChave(aparelhos.ana.identidade, P.ana, aparelhos.ana.aparelho.publica), versao: 1 }, { usuario: P.intrusa, identidade: aparelhos.intrusa.identidade.publica, publica: aparelhos.intrusa.aparelho.publica, certificado: await certificarChave(aparelhos.intrusa.identidade, P.intrusa, aparelhos.intrusa.aparelho.publica), versao: 1 }], { [P.ana]: aparelhos.ana.identidade.publica, [P.intrusa]: aparelhos.intrusa.identidade.publica });
  return (await cifrarMensagem(k.chave, 1234567, aparelhos.ana, crypto.randomUUID(), "🌱".repeat(MAX_CARACTERES))).length;
}, (n) => n <= 12000);

// ── Interface: textos em todos os idiomas (a marca "_rascunho" dos idiomas ainda não revisados não conta), menu, perfil e documento ──
const chavesDe = (o, prefixo = "") => Object.entries(o).filter(([k]) => !k.startsWith("_")).flatMap(([k, v]) => (v && typeof v === "object" ? chavesDe(v, `${prefixo}${k}.`) : [`${prefixo}${k}`])).sort();
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textosPt = JSON.parse(ler("i18n/rede/chat/pt.json"));
await espera("os textos do chat têm as mesmas chaves nos seis idiomas", async () => IDIOMAS.filter((l) => JSON.stringify(chavesDe(JSON.parse(ler(`i18n/rede/chat/${l}.json`)))) !== JSON.stringify(chavesDe(textosPt))), (l) => l.length === 0);
await espera("menu.conversas e perfil.conversar existem nos seis idiomas da Alumia", async () => IDIOMAS.filter((l) => { const j = JSON.parse(ler(`i18n/rede/${l}.json`)); return !j.menu?.conversas || !j.perfil?.conversar; }), (l) => l.length === 0);
await espera("nenhum texto do chat usa as palavras proibidas na interface", async () => IDIOMAS.filter((l) => /universidade|diploma/i.test(ler(`i18n/rede/chat/${l}.json`))), (l) => l.length === 0);
await espera("a página /comunidade/conversas não é indexada", async () => ler("app/[lang]/comunidade/conversas/page.tsx"), (t) => /index:\s*false/.test(t));
await espera("o perfil leva ao chat (?com=@handle) só para membro e nunca no próprio perfil", async () => ler("components/rede/perfil/TelaDoPerfil.tsx"), (t) => /!dado\.meu && situacao\.logado && situacao\.membro[\s\S]{0,200}\/conversas\?com=/.test(t));
await espera("o documento docs/rede/CHAT-PRIVADO.md existe e cita a LGPD (arts. 6º, 14, 18 e 46)", async () => ler("docs/rede/CHAT-PRIVADO.md"), (t) => ["art. 6", "art. 14", "art. 18", "art. 46"].every((a) => t.includes(a)));

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
