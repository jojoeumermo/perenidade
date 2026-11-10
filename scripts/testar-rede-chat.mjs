// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o chat privado da Alumia (supabase/migracoes/20261106-t19-rede-chat-privado.sql, 20261110-chat-blocos.sql,
// lib/rede/chat-privado.ts, lib/rede/chat/*) num Postgres de verdade dentro do Node, no padrão do testar:sigilo: quem abre, quem
// NÃO abre (a outra pessoa de fora, a equipe, o visitante, o próprio banco), o pedido de conversa para quem não segue, bloqueio,
// limite, só 18+, retenção, apagar (LGPD art. 18, VI) e que nada disso vai para o Fediverso nem para o registro de atividades.
// E o formato "c3": mensagem em blocos de tamanho fixo, sem assinatura, com repetição e buraco notados, o "c2" antigo só para
// leitura, versão da chave com prazo no banco, faxina certa dos embrulhos, o "apagar tudo" do Sair rápido e o QR do código.
// Uso: npm run testar:rede-chat
import fs from "node:fs";
import { criarBanco } from "./banco-local.mjs";
import {
  abrirEmbrulho, abrirMensagem, certificarChave, chaveCertificada, cifrarMensagem, codigoDeSeguranca, compararIdentidade, contextoDaMensagem, formatoDe, MAX_CARACTERES,
  novaChaveDoAparelho, novaIdentidadeDoChat, precisaDeVersaoNova, prepararNovaVersao, textoCabe, versaoDe,
} from "../lib/rede/chat-privado.ts";
import { abrirC3, cifrarC3, contextoC3 } from "../lib/rede/chat/c3.ts";
import {
  aoApagarTudoDoChat, apagarPrefixoDaGaveta, apagarTudoDoChat, BANCO_DO_CHAT, CONHECIDAS, CONTAS, guardarNaGaveta, lerDaGaveta, lerPrefixoDaGaveta, ORDEM, reabrirDepoisDeApagar,
} from "../lib/rede/chat/gaveta.ts";
import { buracos, chaveDaOrdem, comContadorUsado, julgar, proximoContador, registroVencido, VIDA_DO_REGISTRO_DIAS } from "../lib/rede/chat/ordem.ts";
import { preencher, TAMANHOS_DO_BLOCO, TAMANHOS_DO_CIFRADO, tamanhoDoBloco, tirarPreenchimento } from "../lib/rede/chat/padding.ts";
import { codigoComMetadeEscondida, conferirMetade, conferirQr, GRUPOS_DA_METADE, grupoDoCodigo, metadeDaOutraPessoa } from "../lib/rede/chat/verificacao.ts";
import { rodarLimpezas } from "../lib/rede/saida.ts";
import { assinarTexto, cifrar, deBase64, lerQrDaSeguranca, metadeDoCodigo, paraBase64, qrDaSeguranca } from "../lib/sigilo.ts";

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
// A correção T33 (supabase/migracoes/20261107-t33-seguranca.sql) vem depois da T19, no install.sql também.
const t33 = ler("supabase/migracoes/20261107-t33-seguranca.sql");
await espera("a correção T33 está no fim do install.sql e roda de novo depois da T19", async () => {
  if (!install.includes(t33.trim())) return false;
  await banco.exclusivo(() => banco.pg.exec(t33));
  return true;
}, (v) => v === true);

// A migração dos blocos (formato "c3") vem depois das duas, no install.sql também. Aqui ela é aplicada de novo, duas vezes,
// para provar que pode rodar de novo.
const blocos = ler("supabase/migracoes/20261110-chat-blocos.sql");
await espera("o bloco das mensagens em blocos está no install.sql, igual à migração e depois da T19 e da T33", async () => install.includes(blocos.trim()) && install.indexOf(blocos.trim()) > install.indexOf(t33.trim()) && install.indexOf(t33.trim()) > install.indexOf(migracao.trim()));
await espera("no install.sql, nada depois do bloco das mensagens em blocos redefine o envio do chat", async () => /create or replace function public\.rede_dm_(enviar|mensagens|nova_versao)\s*\(/.test(install.slice(install.indexOf(blocos.trim()) + blocos.trim().length)), (tem) => tem === false);
await espera("a migração dos blocos roda depois da T19 e da T33, e roda de novo sem quebrar", async () => {
  await banco.exclusivo(() => banco.pg.exec(blocos));
  await banco.exclusivo(() => banco.pg.exec(blocos));
  return (await dono("select count(*)::int as n from pg_constraint where conrelid = 'interno.rede_dm_mensagens'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%c2%'")).rows[0].n;
}, (n) => n === 1);
const LISTA_DOS_TAMANHOS = "(363, 704, 1387, 2752, 5483, 8214, 10944)";
await espera("os tamanhos do cifrado são os mesmos no aparelho e no banco (na regra da tabela e na função)", async () => [`(${TAMANHOS_DO_CIFRADO.join(", ")})`, blocos.split(LISTA_DOS_TAMANHOS).length - 1], (r) => r[0] === LISTA_DOS_TAMANHOS && r[1] === 2);
await espera("os blocos são 256, 512, 1024, 2048 e depois de 2048 em 2048 até 8192", async () => TAMANHOS_DO_BLOCO.join(","), (t) => t === "256,512,1024,2048,4096,6144,8192");

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
await recusa("versão nova logo em seguida, com as chaves de sempre, é recusada (T33: sem laço de versões)", async () => {
  const outra = await prepararNovaVersao(conversaAB.id, 2, aparelhos.ana, chavesAna.participantes, confiadasDaAna);
  return rpc(como(P.ana), "rede_dm_nova_versao", { p_conversa: conversaAB.id, p_versao: 2, p_embrulhos: outra.embrulhos });
}, "versao_desatualizada");
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
const corpo = await cifrarMensagem(nova.chave, 1, aparelhos.ana, conversaAB.id, texto, 1);
await espera("a Ana envia a mensagem cifrada", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 1, p_corpo: corpo }), (r) => !!r.id && !!r.expira_em);
await recusa("o banco recusa texto aberto", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 1, p_corpo: "texto aberto qualquer" }), "invalido:corpo");
await recusa("o banco recusa texto aberto mesmo direto na tabela (check)", () => dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values ($1, $2, 1, 'oi', now() + interval '1 day')", [conversaAB.id, P.ana]), "check");
await espera("no banco só há o cifrado: o texto não aparece em lugar nenhum", async () => JSON.stringify((await dono("select * from interno.rede_dm_mensagens")).rows), (t) => !t.includes("ocupação") && !t.includes("sábado"));
const mensagensDaBia = await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id });
const chavesBia = await rpc(como(P.bia), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
const chaveDaBia = await abrirEmbrulho(conversaAB.id, aparelhos.bia, chavesBia.embrulhos[0], confiadasDaBia);
await espera("a Bia desembrulha a chave e lê, com acento e emoji (c3: sem assinatura, com identificador e contador)", async () => abrirMensagem(chaveDaBia, mensagensDaBia[0].corpo, conversaAB.id, mensagensDaBia[0].autor, confiadasDaBia[P.ana]), (r) => r?.texto === texto && r.formato === "c3" && r.autoria === null && r.contador === 1 && /^[A-Za-z0-9_-]{22}$/.test(r.id));
await espera("o que vai para o banco é c3, e a versão sai do corpo", async () => [formatoDe(corpo), versaoDe(corpo), formatoDe("texto aberto")], (r) => r[0] === "c3" && r[1] === 1 && r[2] === null);

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
await espera("a mensagem c3 abre igual seja qual for a identidade informada: não há assinatura para conferir (negabilidade)", async () => abrirMensagem(chaveDaBia, corpo, conversaAB.id, P.ana, aparelhos.intrusa.identidade.publica), (r) => r?.texto === texto && r.autoria === null);
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
await recusa("passou de 120 mensagens na hora: muitos_pedidos", () => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 2, p_corpo: `c3.2.${"A".repeat(16)}.${"B".repeat(363)}` }), "muitos_pedidos");
await dono("delete from interno.limites where chave like 'rede_dm_%'");

// ── Formato c3 no banco: só blocos, c2 só para leitura, versão com prazo, faxina certa ──
const confiadasNovas = { ...confiadasDaAna, [P.bia]: biaNova.identidade.publica };
const embrulhoV2 = async (nome) => (await rpc(como(P[nome]), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id })).embrulhos.find((e) => e.versao === 2);
const chaveV2DaAna = await abrirEmbrulho(conversaAB.id, aparelhos.ana, await embrulhoV2("ana"), confiadasNovas);
const chaveV2DaBia = await abrirEmbrulho(conversaAB.id, biaNova, await embrulhoV2("bia"), confiadasNovas);
const enviarAB = (p_corpo) => rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: 2, p_corpo });
const corpoV2 = await cifrarMensagem(chaveV2DaAna, 2, aparelhos.ana, conversaAB.id, "segunda versão", 1);
const enviadaV2 = await enviarAB(corpoV2);
await espera("a Ana envia na versão 2, em c3", async () => enviadaV2, (r) => !!r.id);
await recusa("o banco recusa c3 com um caractere a mais que o bloco (pela função)", () => enviarAB(`c3.2.${"A".repeat(16)}.${"B".repeat(364)}`), "invalido:corpo");
await recusa("o banco recusa c3 com um caractere a menos que o bloco (pela função)", () => enviarAB(`c3.2.${"A".repeat(16)}.${"B".repeat(362)}`), "invalido:corpo");
await recusa("o banco recusa c3 de tamanho livre (pela função)", () => enviarAB(`c3.2.${"A".repeat(16)}.${"B".repeat(1000)}`), "invalido:corpo");
await recusa("o banco recusa c3 com a versão do corpo diferente da versão do envio", () => enviarAB(`c3.3.${"A".repeat(16)}.${"B".repeat(363)}`), "invalido:corpo");
await recusa("o banco recusa c3 fora do bloco mesmo direto na tabela (check)", () => dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values ($1, $2, 2, $3, now() + interval '1 day')", [conversaAB.id, P.ana, `c3.2.${"A".repeat(16)}.${"B".repeat(500)}`]), "check");
await espera("a tabela aceita os sete tamanhos de bloco, e só eles", async () => {
  const aceitos = [];
  for (const n of [...TAMANHOS_DO_CIFRADO, 23, 364, 2751, 10945]) {
    const r = await dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values ($1, $2, 2, $3, now() + interval '1 day') returning id", [conversaAB.id, P.ana, `c3.2.${"A".repeat(16)}.${"B".repeat(n)}`]).then((x) => x.rows[0].id, () => null);
    if (r) {
      aceitos.push(n);
      await dono("delete from interno.rede_dm_mensagens where id = $1", [r]);
    }
  }
  return aceitos.join(",");
}, (t) => t === TAMANHOS_DO_CIFRADO.join(","));

// Uma data em que o aparelho ainda abre c2 (o teste não depende do dia em que roda).
const DENTRO_DO_PRAZO_DO_C2 = Date.parse("2026-11-15T00:00:00Z");
// O formato antigo: uma mensagem c2 como as que já estavam no banco antes (assinada, cifrada com lib/sigilo.ts).
const lugarAntigo = contextoDaMensagem(conversaAB.id, P.ana);
const corpoC2 = await cifrar(chaveV2DaAna, 2, await assinarTexto(aparelhos.ana.identidade, "mensagem antiga, assinada", lugarAntigo, 2), lugarAntigo);
await recusa("o banco recusa c2 novo: o formato antigo é só para leitura", () => enviarAB(corpoC2), "invalido:corpo");
const antiga = (await dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values ($1, $2, 2, $3, now() + interval '7 days') returning id", [conversaAB.id, P.ana, corpoC2])).rows[0].id;
await espera("o c2 que já estava no banco continua saindo nas leituras, abrindo e conferindo a assinatura", async () => {
  const lida = (await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id })).find((m) => m.id === antiga);
  return [formatoDe(lida.corpo), await abrirMensagem(chaveV2DaBia, lida.corpo, conversaAB.id, lida.autor, aparelhos.ana.identidade.publica, DENTRO_DO_PRAZO_DO_C2)];
}, (r) => r[0] === "c2" && r[1]?.texto === "mensagem antiga, assinada" && r[1].formato === "c2" && r[1].autoria === "ok" && r[1].contador === null);
await espera("no c2 antigo, assinatura de outra pessoa não passa como da Ana", async () => abrirMensagem(chaveV2DaBia, corpoC2, conversaAB.id, P.ana, aparelhos.intrusa.identidade.publica, DENTRO_DO_PRAZO_DO_C2), (r) => r?.autoria === "invalida");
await espera("um c3 com o rótulo trocado para c2 não abre, nem um c2 com rótulo de c3 (a amarra leva o formato)", async () => [
  await abrirMensagem(chaveV2DaBia, corpoV2.replace(/^c3\./, "c2."), conversaAB.id, P.ana, aparelhos.ana.identidade.publica),
  await abrirMensagem(chaveV2DaBia, corpoC2.replace(/^c2\./, "c3."), conversaAB.id, P.ana, aparelhos.ana.identidade.publica),
], (r) => r[0] === null && r[1] === null);
await dono("delete from interno.rede_dm_mensagens where id = $1", [antiga]);

// Repetição: o banco (ou quem o controla) devolve a mesma mensagem como se fosse outra. O aparelho nota e não mostra de novo.
await espera("a mesma mensagem voltando como outra linha do banco é notada como repetida", async () => {
  const copia = (await dono("insert into interno.rede_dm_mensagens (conversa, autor, versao, corpo, criado_em, expira_em) select conversa, autor, versao, corpo, now() + interval '1 second', expira_em from interno.rede_dm_mensagens where id = $1 returning id", [enviadaV2.id])).rows[0].id;
  const lidas = (await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id })).filter((m) => m.versao === 2).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const chave = chaveDaOrdem(P.bia, conversaAB.id, P.ana, 2);
  let registro = null;
  const juizos = [];
  for (const m of lidas) {
    const aberta = await abrirMensagem(chaveV2DaBia, m.corpo, conversaAB.id, m.autor, null);
    const r = julgar(registro, 0, chave, { servidor: m.id, autor: m.autor, versao: m.versao, id: aberta.id, contador: aberta.contador });
    registro = r.registro;
    juizos.push(r.juizo);
  }
  // Lendo tudo de novo (a tela busca a cada 8 s), o juízo é o mesmo: a primeira já foi vista, a cópia continua repetida.
  for (const m of lidas) {
    const aberta = await abrirMensagem(chaveV2DaBia, m.corpo, conversaAB.id, m.autor, null);
    juizos.push(julgar(registro, 0, chave, { servidor: m.id, autor: m.autor, versao: m.versao, id: aberta.id, contador: aberta.contador }).juizo);
  }
  await dono("delete from interno.rede_dm_mensagens where id = $1", [copia]);
  return juizos.join(",");
}, (t) => t === "nova,repetida,vista,repetida");

// A versão da chave tem prazo também no banco: 8 dias (o aparelho troca aos 7).
const corpoV2b = await cifrarMensagem(chaveV2DaAna, 2, aparelhos.ana, conversaAB.id, "ainda na versão 2", 2);
await dono("update interno.rede_dm_conversas set versao_em = now() - interval '9 days' where id = $1", [conversaAB.id]);
await recusa("o banco recusa envio em versão da chave com mais de 8 dias", () => enviarAB(corpoV2b), "versao_desatualizada");
await dono("update interno.rede_dm_conversas set versao_em = now() - interval '7 days 12 hours' where id = $1", [conversaAB.id]);
await espera("entre 7 e 8 dias o banco ainda aceita (folga), mas o aparelho já pede versão nova antes de enviar", async () => {
  const em = (await um("select versao_em from interno.rede_dm_conversas where id = $1", [conversaAB.id])).versao_em;
  return [precisaDeVersaoNova(2, true, new Date(em).toISOString()), !!(await enviarAB(corpoV2b)).id];
}, (r) => r[0] === true && r[1] === true);
await dono("update interno.rede_dm_conversas set versao_em = now() where id = $1", [conversaAB.id]);
await espera("o chaveiro confere a idade da versão no envio, não só ao abrir a conversa", async () => ler("lib/rede/chat-chaveiro.ts"), (t) => /export async function enviarTexto[\s\S]{0,700}precisaDeVersaoNova\(atual\.versao, true, atual\.versaoEm\)/.test(t));

// Faxina certa (sem sorteio): embrulho de versão antiga some quando não há mais mensagem viva daquela versão.
const embrulhosDaVersao = async (v) => (await um("select count(*)::int as n from interno.rede_dm_embrulhos where conversa = $1 and versao = $2", [conversaAB.id, v])).n;
await espera("enquanto há mensagem viva da versão 1, os embrulhos dela ficam (mesmo com envios e leituras)", async () => {
  await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id });
  return [await embrulhosDaVersao(1), await embrulhosDaVersao(2)];
}, (r) => r[0] === 2 && r[1] === 2);
await espera("vencida a última mensagem da versão 1, a próxima leitura apaga os embrulhos dela (e só os dela)", async () => {
  await dono("update interno.rede_dm_mensagens set expira_em = now() - interval '1 minute' where conversa = $1 and versao = 1", [conversaAB.id]);
  await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id });
  return [await embrulhosDaVersao(1), await embrulhosDaVersao(2), (await um("select count(*)::int as n from interno.rede_dm_mensagens where conversa = $1 and versao = 1", [conversaAB.id])).n];
}, (r) => r[0] === 0 && r[1] === 2 && r[2] === 0);
await espera("a faxina da conversa não depende de sorteio (a função não chama random) e roda no envio, na versão nova e na leitura", async () => {
  const corpoDa = async (nome) => (await um("select pg_get_functiondef(p.oid) as t from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and p.proname = $2", [nome.split(".")[0], nome.split(".")[1]])).t;
  return [/random\s*\(/.test(await corpoDa("interno.rede_dm_faxina_da_conversa")), ...(await Promise.all(["public.rede_dm_enviar", "public.rede_dm_nova_versao", "public.rede_dm_mensagens"].map(corpoDa))).map((t) => t.includes("rede_dm_faxina_da_conversa"))];
}, (r) => r[0] === false && r.slice(1).every(Boolean));
await espera("as funções novas do chat não têm privilégio para visitante nem para quem entrou (só as da API, para quem entrou)", async () => (await dono("select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as entrou from pg_proc p join pg_namespace n on n.oid = p.pronamespace where (n.nspname = 'interno' and p.proname in ('rede_dm_corpo_c3', 'rede_dm_faxina_da_conversa')) or (n.nspname = 'public' and p.proname in ('rede_dm_enviar', 'rede_dm_nova_versao', 'rede_dm_mensagens')) order by p.proname")).rows,
  (l) => l.length === 5 && l.every((f) => f.anon === false && f.entrou === !["rede_dm_corpo_c3", "rede_dm_faxina_da_conversa"].includes(f.proname)));

// ── Denúncia: só os trechos que quem denuncia escolhe, na fila da Alumia ──
const denuncia = await rpc(como(P.bia), "rede_dm_denunciar", { p_conversa: conversaAB.id, p_categoria: "assedio", p_trechos: "trecho escolhido", p_bloquear: true });
await espera("a denúncia entra na fila da Alumia como denúncia de perfil, com o trecho escolhido", async () => um("select alvo_tipo, alvo, texto, quem from interno.rede_denuncias where protocolo = $1", [denuncia.protocolo]), (d) => d.alvo_tipo === "perfil" && d.alvo === P.ana && d.texto.includes("trecho escolhido") && d.quem === P.bia);
await espera("denunciar com bloqueio bloqueia junto", async () => um("select count(*)::int as n from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.bia, P.ana]), (r) => r.n === 1);
await dono("delete from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.bia, P.ana]);

// ── Retenção ──
await espera("cada mensagem nasce com prazo (7 dias por padrão)", async () => um("select extract(day from expira_em - criado_em)::int as d from interno.rede_dm_mensagens where conversa = $1 limit 1", [conversaAB.id]), (r) => r.d === 7);
await espera("encurtar o prazo vale só para as mensagens novas: o que já foi escrito fica (T33: ninguém apaga provas)", async () => {
  await rpc(como(P.ana), "rede_dm_prazo", { p_conversa: conversaAB.id, p_dias: 1 });
  return [(await um("select extract(day from expira_em - criado_em)::int as d from interno.rede_dm_mensagens where conversa = $1 limit 1", [conversaAB.id])).d, (await um("select prazo_dias from interno.rede_dm_conversas where id = $1", [conversaAB.id])).prazo_dias];
}, (r) => r[0] === 7 && r[1] === 1);
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
const corpo2 = await cifrarMensagem(nova.chave, 1, aparelhos.ana, conversaAB.id, "outra", 2);
const chaveAtualDaAna = async () => {
  const chaves = await rpc(como(P.ana), "rede_dm_chaves_da_conversa", { p_conversa: conversaAB.id });
  const k = (await Promise.all(chaves.embrulhos.map((e) => abrirEmbrulho(conversaAB.id, aparelhos.ana, e, { ...confiadasDaAna, [P.bia]: biaNova.identidade.publica })))).find(Boolean);
  return { v: chaves.versao, k };
};
await espera("com denúncia aberta da outra pessoa, quem escreveu não apaga a mensagem (T33: é prova)", async () => {
  const { v, k } = await chaveAtualDaAna();
  const m = await rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: v, p_corpo: await cifrarMensagem(k, v, aparelhos.ana, conversaAB.id, "ameaça guardada", 3) });
  return rpc(como(P.ana), "rede_dm_apagar_mensagem", { p_id: m.id }).then(() => "apagou", (e) => e.message);
}, (r) => String(r).includes("dm_fechada"));
await dono("update interno.rede_denuncias set situacao = 'resolvida' where quem = $1", [P.bia]);
await espera("quem escreveu apaga a própria mensagem; a outra pessoa não", async () => {
  const { v, k } = await chaveAtualDaAna();
  const m = await rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: v, p_corpo: await cifrarMensagem(k, v, aparelhos.ana, conversaAB.id, "apagar esta", 4) });
  const daBia = await rpc(como(P.bia), "rede_dm_apagar_mensagem", { p_id: m.id }).then(() => "apagou", (e) => e.message);
  const daAna = await rpc(como(P.ana), "rede_dm_apagar_mensagem", { p_id: m.id });
  return [daBia, daAna.ok];
}, (r) => String(r[0]).includes("nao_encontrado") && r[1] === true);
await espera("com bloqueio, quem escreveu não apaga a mensagem (T33)", async () => {
  const { v, k } = await chaveAtualDaAna();
  const m = await rpc(como(P.ana), "rede_dm_enviar", { p_conversa: conversaAB.id, p_versao: v, p_corpo: await cifrarMensagem(k, v, aparelhos.ana, conversaAB.id, "outra ameaça", 5) });
  await dono("insert into interno.rede_bloqueios (quem, bloqueado) values ($1, $2)", [P.bia, P.ana]);
  const r = await rpc(como(P.ana), "rede_dm_apagar_mensagem", { p_id: m.id }).then(() => "apagou", (e) => e.message);
  await dono("delete from interno.rede_bloqueios where quem = $1 and bloqueado = $2", [P.bia, P.ana]);
  return r;
}, (r) => String(r).includes("dm_fechada"));
await espera("quem apaga a conversa tira só da própria lista: a outra pessoa continua lendo e denunciando (T33)", async () => {
  await rpc(como(P.ana), "rede_dm_apagar", { p_conversa: conversaAB.id });
  const daAna = (await rpc(como(P.ana), "rede_dm_conversas")).some((c) => c.id === conversaAB.id);
  const anaLe = (await rpc(como(P.ana), "rede_dm_mensagens", { p_conversa: conversaAB.id })).length;
  const biaLe = (await rpc(como(P.bia), "rede_dm_mensagens", { p_conversa: conversaAB.id })).length;
  const den = await rpc(como(P.bia), "rede_dm_denunciar", { p_conversa: conversaAB.id, p_categoria: "ameaca", p_trechos: "a ameaça guardada" });
  return [daAna, anaLe, biaLe, Boolean(den.protocolo)];
}, (r) => r[0] === false && r[1] === 0 && r[2] >= 1 && r[3] === true);
await espera("quando as duas apagam, tudo some (mensagens e embrulhos)", async () => {
  await rpc(como(P.bia), "rede_dm_apagar", { p_conversa: conversaAB.id });
  return [(await um("select count(*)::int as n from interno.rede_dm_mensagens where conversa = $1", [conversaAB.id])).n, (await um("select count(*)::int as n from interno.rede_dm_embrulhos where conversa = $1", [conversaAB.id])).n, (await rpc(como(P.ana), "rede_dm_conversas")).some((c) => c.id === conversaAB.id)];
}, (r) => r[0] === 0 && r[1] === 0 && r[2] === false);
await espera("(o cifrado guardado antes não importa: sem a conversa, sem nada)", async () => corpo2.startsWith("c3.1."));
await espera("apagar tudo do chat tira as conversas da lista e apaga a chave e as preferências da pessoa", async () => {
  await rpc(como(P.seletiva), "rede_dm_apagar_tudo");
  const semChave = (await um("select count(*)::int as n from interno.rede_dm_chaves where usuario = $1", [P.seletiva])).n;
  return [(await rpc(como(P.seletiva), "rede_dm_conversas")).length, semChave, (await um("select count(*)::int as n from interno.rede_dm_prefs where usuario = $1", [P.seletiva])).n];
}, (r) => r.every((n) => n === 0));
await espera("apagar a conta apaga as mensagens dela (chave estrangeira em cascata)", async () => {
  const c = await rpc(como(P.caio), "rede_dm_conversas");
  const id = c[0].id;
  const v = await rpc(como(P.caio), "rede_dm_chaves_da_conversa", { p_conversa: id });
  const chave = await prepararNovaVersao(id, v.versao + 1, aparelhos.caio, v.participantes, { [P.caio]: aparelhos.caio.identidade.publica, [P.bia]: biaNova.identidade.publica });
  await rpc(como(P.caio), "rede_dm_nova_versao", { p_conversa: id, p_versao: v.versao + 1, p_embrulhos: chave.embrulhos });
  await rpc(como(P.caio), "rede_dm_enviar", { p_conversa: id, p_versao: v.versao + 1, p_corpo: await cifrarMensagem(chave.chave, v.versao + 1, aparelhos.caio, id, "até mais", 1) });
  await dono("delete from interno.perfis where id = $1", [P.caio]);
  return [(await um("select count(*)::int as n from interno.rede_dm_mensagens where autor = $1", [P.caio])).n, (await um("select count(*)::int as n from interno.rede_dm_conversas where id = $1", [id])).n, (await um("select count(*)::int as n from interno.rede_dm_chaves where usuario = $1", [P.caio])).n];
}, (r) => r.every((n) => n === 0));

await espera("quem foi recusado e apaga tudo do chat continua sem poder pedir de novo (T33: a recusa é de quem recusou)", async () => {
  const p = await rpc(como(P.intrusa), "rede_dm_abrir", { p_handle: "bia_dm" });
  await rpc(como(P.bia), "rede_dm_responder", { p_conversa: p.id, p_aceitar: false });
  await rpc(como(P.intrusa), "rede_dm_apagar_tudo");
  await ativar("intrusa");
  return rpc(como(P.intrusa), "rede_dm_abrir", { p_handle: "bia_dm" }).then(() => "abriu", (e) => e.message);
}, (r) => String(r).includes("dm_fechada"));

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
await espera("as funções do chat não chamam o registro de atividades nem avisos com conteúdo", async () => `${migracao}\n${blocos}`.replace(/^\s*--.*$/gm, ""), (t) => !/interno\.registrar\s*\(/.test(t) && !/interno\.avisar/.test(t) && !/raise\s+(notice|log|info|warning)/i.test(t));
const telas = fs.readdirSync(new URL("../components/rede/chat", import.meta.url)).map((f) => `components/rede/chat/${f}`);
const pecas = fs.readdirSync(new URL("../lib/rede/chat", import.meta.url)).map((f) => `lib/rede/chat/${f}`);
await espera("as telas e o chaveiro do chat não escrevem nada no console", async () => [...telas, ...pecas, "lib/rede/chat-privado.ts", "lib/rede/chat-chaveiro.ts", "lib/rede/cliente-chat.ts"].filter((f) => /console\.(log|info|warn|error|debug)/.test(ler(f))), (l) => l.length === 0);
await espera("as telas do chat não chamam nenhum serviço de fora (sem fetch direto)", async () => [...telas, ...pecas, "lib/rede/chat-chaveiro.ts", "lib/rede/cliente-chat.ts"].filter((f) => /\bfetch\(|https?:\/\//.test(ler(f).replace(/^\/\/.*$/gm, ""))), (l) => l.length === 0);

// ── Pequenas regras do texto ──
await espera("texto vazio não vai; texto grande demais não vai", async () => [textoCabe("   "), textoCabe("oi"), textoCabe("x".repeat(MAX_CARACTERES + 1)), textoCabe("🌱".repeat(MAX_CARACTERES))], (r) => r[0] === false && r[1] === true && r[2] === false && r[3] === true);
await espera("o maior texto possível, cifrado no maior bloco, cabe no teto do banco (10972 caracteres)", async () => {
  const k = await prepararNovaVersao(crypto.randomUUID(), 1, aparelhos.ana, [{ usuario: P.ana, identidade: aparelhos.ana.identidade.publica, publica: aparelhos.ana.aparelho.publica, certificado: await certificarChave(aparelhos.ana.identidade, P.ana, aparelhos.ana.aparelho.publica), versao: 1 }, { usuario: P.intrusa, identidade: aparelhos.intrusa.identidade.publica, publica: aparelhos.intrusa.aparelho.publica, certificado: await certificarChave(aparelhos.intrusa.identidade, P.intrusa, aparelhos.intrusa.aparelho.publica), versao: 1 }], { [P.ana]: aparelhos.ana.identidade.publica, [P.intrusa]: aparelhos.intrusa.identidade.publica });
  return (await cifrarMensagem(k.chave, 1234567, aparelhos.ana, crypto.randomUUID(), "🌱".repeat(MAX_CARACTERES), 1)).length;
}, (n) => n === 10972 && n <= 12000);

// ── Preenchimento em blocos (lib/rede/chat/padding.ts) ──
const bytes = (n, v = 7) => new Uint8Array(n).fill(v);
const tentar = (fazer) => {
  try {
    fazer();
    return "passou";
  } catch (erro) {
    return erro.message;
  }
};
await espera("o preenchimento vai e volta, sempre no menor bloco em que o conteúdo cabe", async () => [0, 1, 252, 253, 508, 509, 1020, 1021, 2044, 2045, 4092, 4093, 6140, 6141, 8188].map((n) => {
  const bloco = preencher(bytes(n));
  const volta = tirarPreenchimento(bloco);
  return [bloco.length, tamanhoDoBloco(n) === bloco.length && volta.length === n && volta.every((x) => x === 7)];
}), (l) => l.map((x) => x[0]).join(",") === "256,256,256,512,512,1024,1024,2048,2048,4096,4096,6144,6144,8192,8192" && l.every((x) => x[1]));
await espera("conteúdo maior que o maior bloco é recusado", async () => tentar(() => preencher(bytes(8189))), (m) => m === "conteudo_grande");
const adulterado = (mexer) => {
  const bloco = preencher(bytes(100));
  mexer(bloco);
  return tentar(() => tirarPreenchimento(bloco));
};
await espera("preenchimento adulterado é erro: sobra que não é zero, comprimento que não bate, bloco maior que o preciso, tamanho fora da lista", async () => [
  adulterado((b) => { b[255] = 1; }),
  adulterado((b) => { b[104] = 1; }),
  adulterado((b) => { new DataView(b.buffer).setUint32(0, 300); }),
  adulterado((b) => { new DataView(b.buffer).setUint32(0, 99); }),
  tentar(() => {
    const grande = new Uint8Array(512);
    new DataView(grande.buffer).setUint32(0, 100);
    tirarPreenchimento(grande);
  }),
  tentar(() => tirarPreenchimento(new Uint8Array(300))),
], (l) => l.length === 6 && l.every((m) => m === "preenchimento_invalido"));

// ── O formato c3 (lib/rede/chat/c3.ts): tamanho fixo, sem assinatura, adulteração recusada ──
const chaveLivre = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
const conversaLivre = crypto.randomUUID();
const amarraC3 = (versao) => new TextEncoder().encode(contextoC3(conversaLivre, P.ana, versao));
await espera("todo c3 cai num dos sete tamanhos: um \"ok\" e um parágrafo curto ficam iguais no banco", async () => {
  const textos = ["ok", "x".repeat(50), "x".repeat(200), "x".repeat(224), "x".repeat(225), "é".repeat(300), "x".repeat(1000), "x".repeat(2000), "🌱".repeat(700), "🌱".repeat(2000)];
  const tamanhos = [];
  for (const [i, t] of textos.entries()) tamanhos.push((await cifrarMensagem(chaveLivre, 1, { usuario: P.ana }, conversaLivre, t, i + 1)).split(".")[3].length);
  return tamanhos;
}, (l) => l.every((n) => TAMANHOS_DO_CIFRADO.includes(n)) && l.join(",") === "363,363,363,363,704,1387,2752,2752,5483,10944");
await espera("a mensagem c3 não leva assinatura: dentro do cifrado há só identificador, contador e texto (e cifrar nem recebe a identidade)", async () => {
  const escrito = "sem assinatura";
  const cifrado = await cifrarMensagem(chaveLivre, 3, { usuario: P.ana }, conversaLivre, escrito, 9);
  const partes = cifrado.split(".");
  const bloco = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(partes[2]), additionalData: amarraC3(3) }, chaveLivre, deBase64(partes[3])));
  const conteudo = tirarPreenchimento(bloco);
  return [conteudo.length === 16 + 4 + 8 + new TextEncoder().encode(escrito).length, new TextDecoder().decode(conteudo.subarray(28)) === escrito, new DataView(conteudo.buffer).getUint32(16), /s1\./.test(new TextDecoder("latin1").decode(bloco))];
}, (r) => r[0] === true && r[1] === true && r[2] === 9 && r[3] === false);
await espera("o chat não assina mensagem em lugar nenhum (a identidade só certifica a chave do aparelho)", async () => ["lib/rede/chat-privado.ts", "lib/rede/chat-chaveiro.ts", ...pecas].filter((f) => /assinarTexto/.test(ler(f))), (l) => l.length === 0);
await espera("mesmo sem assinatura, adulteração é recusada: cifrado, marca, vetor, versão, conversa, autor, chave e tamanho", async () => {
  const inteiro = await cifrarC3(chaveLivre, 3, conversaLivre, P.ana, "íntegra", 1);
  const partes = inteiro.split(".");
  const mexer = (t, i) => t.slice(0, i) + (t[i] === "A" ? "B" : "A") + t.slice(i + 1);
  const outraChave = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  return [
    await abrirC3(chaveLivre, inteiro, conversaLivre, P.ana),
    await abrirC3(chaveLivre, [partes[0], partes[1], partes[2], mexer(partes[3], 10)].join("."), conversaLivre, P.ana),
    await abrirC3(chaveLivre, [partes[0], partes[1], partes[2], mexer(partes[3], partes[3].length - 2)].join("."), conversaLivre, P.ana),
    await abrirC3(chaveLivre, [partes[0], partes[1], mexer(partes[2], 3), partes[3]].join("."), conversaLivre, P.ana),
    await abrirC3(chaveLivre, ["c3", "4", partes[2], partes[3]].join("."), conversaLivre, P.ana),
    await abrirC3(chaveLivre, inteiro, crypto.randomUUID(), P.ana),
    await abrirC3(chaveLivre, inteiro, conversaLivre, P.bia),
    await abrirC3(outraChave, inteiro, conversaLivre, P.ana),
    await abrirC3(chaveLivre, inteiro.slice(0, -1), conversaLivre, P.ana),
  ];
}, (r) => r[0]?.texto === "íntegra" && r[0].contador === 1 && r.slice(1).every((x) => x === null));
await espera("bloco com preenchimento errado não abre, mesmo cifrado com a chave certa (o certo, feito do mesmo jeito, abre)", async () => {
  const fechar = async (bloco) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return `c3.1.${paraBase64(iv)}.${paraBase64(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: amarraC3(1) }, chaveLivre, bloco)))}`;
  };
  const errado = preencher(bytes(40));
  errado[200] = 1;
  return [await abrirC3(chaveLivre, await fechar(preencher(bytes(40))), conversaLivre, P.ana), await abrirC3(chaveLivre, await fechar(errado), conversaLivre, P.ana)];
}, (r) => r[0] !== null && r[1] === null);
await espera("negabilidade: quem tem a chave da conversa consegue montar uma mensagem que abre como da outra pessoa; por isso nenhuma serve de prova para terceiros", async () => abrirMensagem(chaveLivre, await cifrarC3(chaveLivre, 1, conversaLivre, P.ana, "escrita pela Bia, com a chave das duas", 1), conversaLivre, P.ana, aparelhos.ana.identidade.publica), (r) => r?.formato === "c3" && r.autoria === null && r.texto.startsWith("escrita pela Bia"));

// ── Repetição e ordem (lib/rede/chat/ordem.ts) ──
const chaveO = chaveDaOrdem("eu", "conv", "ela", 1);
const recebida = (servidor, id, contador, versao = 1) => ({ servidor, autor: "ela", versao, id, contador });
await espera("repetição: a primeira vez é nova, ler de novo é vista, o mesmo conteúdo como outra mensagem é repetida", async () => {
  const a = julgar(null, 0, chaveO, recebida("s1", "i1", 1), 1000);
  const b = julgar(a.registro, 0, chaveO, recebida("s2", "i2", 2));
  const c = julgar(b.registro, 0, chaveO, recebida("s1", "i1", 1));
  const d = julgar(b.registro, 0, chaveO, recebida("s9", "i1", 1));
  const e = julgar(b.registro, 0, chaveO, recebida("s2", "i1", 1));
  return [a.juizo, b.juizo, c.juizo, d.juizo, e.juizo, b.registro.maior, Object.keys(b.registro).sort().join(","), c.registro === b.registro];
}, (r) => r.join("|") === "nova|nova|vista|repetida|repetida|2|chave,desde,maior,vistas|true");
await espera("versão que este aparelho já fechou (piso) não passa como nova: sai como 'fechada' (mostrada com aviso, nunca escondida); o registro vence em 45 dias", async () => [
  julgar(null, 3, chaveDaOrdem("eu", "conv", "ela", 3), recebida("s", "i", 1, 3)).juizo,
  julgar(null, 3, chaveDaOrdem("eu", "conv", "ela", 4), recebida("s", "i", 1, 4)).juizo,
  registroVencido({ chave: chaveO, desde: 0, maior: 1, vistas: {} }, (VIDA_DO_REGISTRO_DIAS + 1) * 86_400_000),
  registroVencido({ chave: chaveO, desde: 0, maior: 1, vistas: {} }, 86_400_000),
], (r) => r.join(",") === "fechada,nova,true,false");
await espera("buraco: avisa depois do contador que falta; o começo não é buraco; cada autor e cada versão contam à parte", async () => {
  const m = (servidor, autor, versao, contador) => ({ servidor, autor, versao, contador });
  return [
    [...buracos([m("a", "ela", 1, 1), m("b", "ela", 1, 2), m("d", "ela", 1, 4)])].join(","),
    [...buracos([m("c", "ela", 1, 3), m("d", "ela", 1, 4), m("e", "ela", 1, 5)])].join(","),
    [...buracos([m("a", "ela", 1, 5), m("b", "eu", 1, 1), m("c", "ela", 2, 1), m("d", "eu", 1, 2)])].join(","),
    [...buracos([m("z", "ela", 1, 9), m("a", "ela", 1, 1), m("b", "ela", 1, 2)])].join(","),
  ];
}, (r) => r.join("|") === "d|||z");
await espera("contador: o próximo é sempre maior que o maior já visto ou usado", async () => {
  const r1 = comContadorUsado(null, chaveO, proximoContador(null), 5);
  const r2 = comContadorUsado(r1, chaveO, proximoContador(r1));
  const visto = julgar(r2, 0, chaveO, recebida("s", "i", 7)).registro;
  return [r1.maior, r2.maior, proximoContador(visto)];
}, (r) => r.join(",") === "1,2,8");
await espera("a tela mostra o aviso discreto de buraco e a linha de repetida, e o chaveiro confere a ordem ao abrir", async () => [ler("components/rede/chat/Conversa.tsx"), ler("lib/rede/chat-chaveiro.ts")],
  (r) => /faltas\.has\(m\.id\) && <p[^>]*>\{t\.conversa\.faltam\}/.test(r[0]) && /if \(m\.repetida\) return <li[^>]*>\{t\.conversa\.repetida\}/.test(r[0]) && /await naFilaDaOrdem\(\(\) => conferirOrdem\(sessao, abertas, internos\)\)/.test(r[1])
    // A tela usa a ordem do contador (não a hora do servidor) e mostra os avisos de ordem trocada, de mensagem duvidosa e de mensagem minha ainda não recebida.
    && /ordem\.ordenadas\.map\(/.test(r[0]) && !/\{mensagens\.map\(/.test(r[0]) && /ordem\.foraDeOrdem\.has\(m\.id\) && <p[^>]*>\{t\.conversa\.foraDeOrdem\}/.test(r[0]) && /m\.duvidosa && <p[^>]*>\{t\.conversa\.duvidosa\}/.test(r[0]) && /ordem\.semConfirmar\.has\(m\.id\)/.test(r[0]));

// ── O que fica no aparelho e o "apagar tudo" do Sair rápido (lib/rede/chat/gaveta.ts), com um IndexedDB de mentira ──
// O falso segue as regras do IndexedDB que importam aqui: abrir um banco que não existe cria o banco e chama "upgradeneeded"
// com oldVersion 0; desfazer (abort) essa transação desfaz a criação e a abertura falha com AbortError; apagar o banco avisa
// cada conexão aberta ("versionchange", newVersion null) e, se alguma não fechar, fica "blocked" até ela fechar; conexão
// fechada não abre transação.
function indexedDBDeMentira() {
  const bancos = new Map();
  const esperando = [];
  const tarde = (fazer) => setTimeout(fazer, 0);
  const depois = (resultado) => {
    const pedido = { result: resultado };
    tarde(() => pedido.onsuccess?.({ target: pedido }));
    return pedido;
  };
  const dentro = (faixa, chave) => (typeof faixa === "object" && faixa !== null ? chave >= faixa.lower && chave <= faixa.upper : chave === faixa);
  const soltar = () => {
    for (const item of [...esperando]) {
      if (item.dados.conexoes.size) continue;
      esperando.splice(esperando.indexOf(item), 1);
      item.fim();
    }
  };
  const conexao = (dados) => {
    const c = {
      fechada: false,
      onversionchange: null,
      objectStoreNames: { contains: (n) => dados.gavetas.has(n) },
      createObjectStore: (n, { keyPath }) => void dados.gavetas.set(n, { keyPath, linhas: new Map() }),
      transaction: (n) => {
        if (c.fechada) throw new DOMException("conexão fechada", "InvalidStateError");
        return {
          objectStore: () => {
            const g = dados.gavetas.get(n);
            return {
              get: (k) => depois(structuredClone(g.linhas.get(k))),
              getAll: (faixa) => depois([...g.linhas].filter(([k]) => dentro(faixa, k)).map(([, v]) => structuredClone(v))),
              put: (v) => {
                g.linhas.set(v[g.keyPath], structuredClone(v));
                return depois(v[g.keyPath]);
              },
              delete: (faixa) => {
                for (const k of [...g.linhas.keys()]) if (dentro(faixa, k)) g.linhas.delete(k);
                return depois(undefined);
              },
            };
          },
        };
      },
      close: () => {
        if (c.fechada) return;
        c.fechada = true;
        dados.conexoes.delete(c);
        soltar();
      },
    };
    return c;
  };
  return {
    bancos,
    /** Quantas vezes um banco foi CRIADO (aberto quando não existia e não desfeito). */
    criados: 0,
    /** "normal"; "lanca": apagar o banco lança; "mudo": o pedido de apagar nunca responde. */
    modo: "normal",
    open(nome, versao) {
      const pedido = { result: undefined, error: null, transaction: null };
      tarde(() => {
        let dados = bancos.get(nome);
        const criado = !dados;
        const antiga = dados?.versao ?? 0;
        if (!dados) bancos.set(nome, (dados = { versao: 0, gavetas: new Map(), conexoes: new Set() }));
        const c = conexao(dados);
        dados.conexoes.add(c);
        pedido.result = c;
        if (antiga < versao) {
          let desfeita = false;
          const gavetasAntes = new Map(dados.gavetas);
          pedido.transaction = { abort: () => void (desfeita = true) };
          pedido.onupgradeneeded?.({ oldVersion: antiga, newVersion: versao, target: pedido });
          pedido.transaction = null;
          if (desfeita) {
            c.fechada = true;
            dados.conexoes.delete(c);
            if (criado) bancos.delete(nome);
            else dados.gavetas = gavetasAntes;
            pedido.result = undefined;
            pedido.error = new DOMException("desfeito", "AbortError");
            pedido.onerror?.({ target: pedido, preventDefault() {} });
            return;
          }
          dados.versao = versao;
          if (criado) this.criados++;
        }
        pedido.onsuccess?.({ target: pedido });
      });
      return pedido;
    },
    deleteDatabase(nome) {
      if (this.modo === "lanca") throw new Error("o navegador não deixou");
      const pedido = {};
      if (this.modo === "mudo") return pedido;
      tarde(() => {
        const dados = bancos.get(nome);
        const fim = () => {
          if (bancos.get(nome) === dados) bancos.delete(nome);
          pedido.onsuccess?.({});
        };
        if (!dados) return fim();
        for (const c of [...dados.conexoes]) c.onversionchange?.({ oldVersion: dados.versao, newVersion: null });
        if (dados.conexoes.size) {
          pedido.onblocked?.({});
          esperando.push({ dados, fim });
        } else fim();
      });
      return pedido;
    },
  };
}
const falso = indexedDBDeMentira();
const porIndexedDB = (valor) => Object.defineProperty(globalThis, "indexedDB", { value: valor, configurable: true, writable: true });
porIndexedDB(falso);
globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
const contaDeTeste = () => ({ usuario: "u1", aparelho: { publica: "p" }, identidade: { publica: "i" } });
await espera("o aparelho guarda e lê nas três gavetas, acha por prefixo e fecha a conexão depois de cada uso", async () => {
  // Só a ativação (criar) cria o banco; as outras gravações vão para ele depois.
  await guardarNaGaveta(CONTAS, contaDeTeste(), { criar: true });
  await guardarNaGaveta(CONHECIDAS, { chave: "u1:u2", identidade: "x", verificado: true });
  await guardarNaGaveta(ORDEM, { chave: "u1:c1:u2:1", desde: 1, maior: 3, vistas: { a: "b" } });
  await guardarNaGaveta(ORDEM, { chave: "u1:c1:u2:piso", versao: 0 });
  await guardarNaGaveta(ORDEM, { chave: "u1:c2:u2:1", desde: 1, maior: 1, vistas: {} });
  const guardado = falso.bancos.get(BANCO_DO_CHAT);
  return [(await lerDaGaveta(CONTAS, "u1"))?.aparelho.publica, (await lerDaGaveta(CONHECIDAS, "u1:u2"))?.verificado, (await lerPrefixoDaGaveta(ORDEM, "u1:c1:")).length, [...guardado.gavetas.keys()].sort().join(","), guardado.conexoes.size];
}, (r) => r.join("|") === "p|true|2|conhecidas,contas,ordem|0");
await espera("apagar por prefixo tira só o que é daquela conversa", async () => {
  await apagarPrefixoDaGaveta(ORDEM, "u1:c2:");
  return [(await lerPrefixoDaGaveta(ORDEM, "u1:c2:")).length, (await lerPrefixoDaGaveta(ORDEM, "u1:")).length];
}, (r) => r[0] === 0 && r[1] === 2);
await espera("o que o aparelho guarda da ordem não tem texto nenhum: só identificadores e contadores", async () => JSON.stringify(await lerPrefixoDaGaveta(ORDEM, "u1:")), (t) => !/texto|corpo/.test(t));
await espera("apagarTudoDoChat não deixa nada: banco inteiro, memória e o que as telas registraram; e nada é gravado depois", async () => {
  let limpou = 0;
  aoApagarTudoDoChat(() => void limpou++);
  aoApagarTudoDoChat(() => {
    throw new Error("limpeza quebrada");
  });
  const inicio = performance.now();
  await apagarTudoDoChat();
  const ms = performance.now() - inicio;
  const sobrou = [await lerDaGaveta(CONTAS, "u1"), await lerDaGaveta(CONHECIDAS, "u1:u2"), ...(await lerPrefixoDaGaveta(ORDEM, "u1:"))].filter(Boolean).length;
  // Um pedido que estava no caminho não recria o banco nem a memória.
  await guardarNaGaveta(CONTAS, contaDeTeste());
  return [falso.bancos.has(BANCO_DO_CHAT), sobrou, limpou, await lerDaGaveta(CONTAS, "u1"), falso.bancos.size, ms < 400];
}, (r) => r[0] === false && r[1] === 0 && r[2] === 1 && r[3] === null && r[4] === 0 && r[5] === true);
await espera("o apagar tudo nunca lança e nunca segura a saída: navegador que recusa, que não responde, ou sem IndexedDB", async () => {
  const tempos = [];
  for (const modo of ["lanca", "mudo", "sem"]) {
    reabrirDepoisDeApagar();
    porIndexedDB(modo === "sem" ? undefined : falso);
    falso.modo = modo;
    const inicio = performance.now();
    await apagarTudoDoChat();
    tempos.push(performance.now() - inicio);
  }
  porIndexedDB(falso);
  falso.modo = "normal";
  reabrirDepoisDeApagar();
  return tempos;
}, (l) => l.length === 3 && l.every((ms) => ms < 700));
await espera("pendurado no Sair rápido, o apagar tudo cabe com folga no teto de 0,8 s e leva o banco embora", async () => {
  await guardarNaGaveta(CONTAS, contaDeTeste(), { criar: true });
  const tinha = falso.bancos.has(BANCO_DO_CHAT);
  const inicio = performance.now();
  await rodarLimpezas([() => apagarTudoDoChat()]);
  const ms = performance.now() - inicio;
  reabrirDepoisDeApagar();
  return [tinha, falso.bancos.size, ms < 400];
}, (r) => r[0] === true && r[1] === 0 && r[2] === true);
// Duas abas: cada import com "?aba=" é outra instância do módulo (outra página), sobre o MESMO IndexedDB de mentira.
await espera("ATAQUE (achado alto): o pânico numa aba limpa também a OUTRA aba aberta, e a busca que estava no caminho não recria o banco", async () => {
  reabrirDepoisDeApagar();
  porIndexedDB(falso);
  falso.modo = "normal";
  const abaB = await import("../lib/rede/chat/gaveta.ts?aba=B");
  // A aba A ativa o chat; a aba B está com a conversa aberta (gravou o que chegou e a tela registrou a limpeza dela).
  await guardarNaGaveta(CONTAS, contaDeTeste(), { criar: true });
  await abaB.guardarNaGaveta(ORDEM, { chave: "u1:c1:u2:1", desde: 1, maior: 1, vistas: { a: "s1" } });
  let limpouB = 0;
  abaB.aoApagarTudoDoChat(() => void limpouB++);
  const criadosAntes = falso.criados;
  await apagarTudoDoChat();
  await new Promise((pronto) => setTimeout(pronto, 50));
  // O aviso entre abas: a aba B se limpa SEM precisar tocar no banco (as chaves na memória dela somem na hora).
  const antesDeTocar = [limpouB, abaB.chatApagadoAqui()];
  // Depois do pânico, a aba B continua tentando: a busca de 8 s que estava no caminho grava e lê.
  await abaB.guardarNaGaveta(ORDEM, { chave: "u1:c1:u2:1", desde: 1, maior: 2, vistas: { b: "s2" } });
  const mudou = await abaB.mudarNaGaveta(ORDEM, "u1:c1:u2:1", () => ({ chave: "u1:c1:u2:1", desde: 1, maior: 3, vistas: {} }));
  const lido = await abaB.lerDaGaveta(ORDEM, "u1:c1:u2:1");
  const porPrefixo = await abaB.lerPrefixoDaGaveta(ORDEM, "u1:");
  return [...antesDeTocar, limpouB, abaB.chatApagadoAqui(), falso.bancos.has(BANCO_DO_CHAT), falso.criados - criadosAntes, mudou, lido, porPrefixo.length];
}, (r) => JSON.stringify(r) === "[1,true,1,true,false,0,null,null,0]");
await espera("ATAQUE (achado alto/médio): a saída do site apaga o banco por fora, sem aviso entre abas; a aba que já tinha visto o banco se limpa e não o recria, nem com uma leitura no caminho", async () => {
  reabrirDepoisDeApagar();
  const original = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  const abaC = await import("../lib/rede/chat/gaveta.ts?aba=C");
  let limpouC = 0;
  abaC.aoApagarTudoDoChat(() => void limpouC++);
  globalThis.BroadcastChannel = original;
  await guardarNaGaveta(CONTAS, contaDeTeste(), { criar: true });
  await abaC.guardarNaGaveta(ORDEM, { chave: "u1:c9:u2:1", desde: 1, maior: 1, vistas: { a: "s1" } });
  const criadosAntes = falso.criados;
  // A saída do site (lib/modo-seguro.ts) apaga o banco direto, enquanto a aba C está no meio de uma leitura.
  const noCaminho = abaC.lerPrefixoDaGaveta(ORDEM, "u1:");
  const apagando = new Promise((pronto) => {
    const p = indexedDB.deleteDatabase(BANCO_DO_CHAT);
    p.onsuccess = pronto;
  });
  const lidaNoCaminho = await noCaminho;
  await apagando;
  await abaC.guardarNaGaveta(ORDEM, { chave: "u1:c9:u2:1", desde: 1, maior: 5, vistas: {} });
  const depois = await abaC.lerDaGaveta(ORDEM, "u1:c9:u2:1");
  // E uma aba que só soube depois (a primeira leitura dela já acha o banco sumido): também se limpa, sem recriar.
  const abaD = await import("../lib/rede/chat/gaveta.ts?aba=D");
  let limpouD = 0;
  abaD.aoApagarTudoDoChat(() => void limpouD++);
  const lidaD = await abaD.lerDaGaveta(CONTAS, "u1");
  return [lidaNoCaminho.length <= 1, limpouC, abaC.chatApagadoAqui(), depois, falso.bancos.has(BANCO_DO_CHAT), falso.criados - criadosAntes, lidaD, limpouD];
}, (r) => JSON.stringify(r) === "[true,1,true,null,false,0,null,0]");
await espera("depois do pânico, só a ativação (criar) recria o banco e solta a trava", async () => {
  await guardarNaGaveta(CONTAS, contaDeTeste(), { criar: true });
  const ok = [falso.bancos.has(BANCO_DO_CHAT), (await lerDaGaveta(CONTAS, "u1"))?.usuario];
  await apagarTudoDoChat();
  reabrirDepoisDeApagar();
  return ok;
}, (r) => r[0] === true && r[1] === "u1");
await espera("a tela das conversas e a da conversa aberta se limpam no pânico de qualquer aba (lista, conversa, rascunho, códigos)", async () => [ler("components/rede/chat/Tela.tsx"), ler("components/rede/chat/Conversa.tsx")],
  (r) => /aoApagarTudoDoChat\(\(\) => \{\s*setAberta\(null\);\s*setLista\(\[\]\);/.test(r[0]) && /aoApagarTudoDoChat\(\(\) => \{\s*sessaoRef\.current = null;[\s\S]{0,200}setTexto\(""\);/.test(r[1]));
await espera("o encaixe do chat pendura o apagar tudo no Sair rápido, o chaveiro o exporta, e a gaveta não importa nada", async () => [ler("components/rede/chat/encaixe.tsx"), ler("lib/rede/chat-chaveiro.ts"), ler("lib/rede/chat/gaveta.ts")],
  (r) => /aoSairRapido:\s*\[\(\) => apagarTudoDoChat\(\)\]/.test(r[0]) && /export async function apagarTudoDoChat\(\): Promise<void>/.test(r[1]) && /aoApagarTudoDoChat\(esquecerSessoes\)/.test(r[1]) && !/^import /m.test(r[2]));
await espera("mensagem aberta, rascunho e chave de conversa nunca vão para o armazenamento do navegador", async () => [...telas, ...pecas, "lib/rede/chat-chaveiro.ts", "lib/rede/chat-privado.ts"].filter((f) => /localStorage|sessionStorage/.test(ler(f))), (l) => l.length === 0);

// ── O chaveiro de verdade (lib/rede/chat-chaveiro.ts) contra um servidor que mente ──
// O chaveiro fala com o banco local; cada chamada passa por `servidor`, que o teste troca para mentir do jeito de cada ataque.
const chaveiro = await import("../lib/rede/chat-chaveiro.ts");
const { chat: clienteDoChat, criarClienteDoChat } = await import("../lib/rede/cliente-chat.ts");
const { anotarVersao, chaveDasVersoes, ordemDaTela, podeFechar, relogioConfiavel, versaoVelhaAqui, julgarAntiga } = await import("../lib/rede/chat/ordem.ts");
const { C2_ABRE_ATE } = await import("../lib/rede/chat-privado.ts");
const { mudarNaGaveta } = await import("../lib/rede/chat/gaveta.ts");
for (const nome of ["rui", "sol"]) {
  P[nome] = await criarUsuario(`${nome}@chat.local`, `Nome do painel ${nome}`);
  await rpc(como(P[nome]), "eu");
  await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1 where id = $1", [P[nome], `Pessoa ${nome}`, `${nome}_dm`]);
  await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  await dono("update auth.users set created_at = now() - interval '30 days' where id = $1", [P[nome]]);
}
await dono("insert into interno.rede_seguindo (quem, segue) values ($1, $2), ($2, $1)", [P.rui, P.sol]);
let quem = "rui";
const mentiras = {};
const chamadas = [];
const doBanco = async (funcao, argumentos = {}) => {
  try {
    return await rpc(como(P[quem]), funcao, argumentos);
  } catch (erro) {
    const codigo = String(erro.message).match(/^[a-z_]+(?::[a-z_]+)?/)?.[0] ?? String(erro.message);
    throw Object.assign(new Error(codigo), { code: codigo });
  }
};
const servidor = async (funcao, argumentos = {}) => {
  chamadas.push(funcao);
  return mentiras[funcao] ? mentiras[funcao](argumentos, () => doBanco(funcao, argumentos)) : doBanco(funcao, argumentos);
};
Object.assign(clienteDoChat, criarClienteDoChat(servidor));
const semMentiras = () => {
  for (const k of Object.keys(mentiras)) delete mentiras[k];
};
const tentarCodigo = (promessa) => promessa.then(() => "passou", (e) => e.code ?? e.message);
const situacaoDe = async (nome) => {
  quem = nome;
  return servidor("rede_dm_situacao");
};
reabrirDepoisDeApagar();
porIndexedDB(falso);
falso.modo = "normal";
quem = "rui";
const euRui = await chaveiro.ativarNesteAparelho(P.rui);
quem = "sol";
const euSol = await chaveiro.ativarNesteAparelho(P.sol);
await espera("o chaveiro ativa o aparelho e o reconhece pela situação do servidor", async () => [(await chaveiro.estadoDoAparelho(await situacaoDe("rui"))).estado, (await chaveiro.estadoDoAparelho(await situacaoDe("sol"))).estado], (r) => r.join(",") === "pronto,pronto");
quem = "rui";
const conversaRS = (await servidor("rede_dm_abrir", { p_handle: "sol_dm" })).id;
const abrirComo = async (nome, anterior, opcoes) => {
  quem = nome;
  return nome === "rui" ? chaveiro.abrirSessao(euRui, conversaRS, P.sol, anterior, opcoes) : chaveiro.abrirSessao(euSol, conversaRS, P.rui, anterior, opcoes);
};
const lerComo = async (nome, sessao, mexer = (l) => l) => {
  quem = nome;
  return chaveiro.abrirMensagens(sessao, mexer(await servidor("rede_dm_mensagens", { p_conversa: conversaRS })));
};
let sessaoRui = await abrirComo("rui");
let sessaoSol = await abrirComo("sol");
quem = "rui";
sessaoRui = await chaveiro.enviarTexto(sessaoRui, "primeira do Rui");
await espera("o chaveiro de verdade: versão 1, envio em c3 e leitura do outro lado", async () => {
  const lidas = await lerComo("sol", sessaoSol);
  return [sessaoRui.versao, sessaoSol.versao, lidas.map((m) => m.texto).join("|"), lidas[0]?.contador];
}, (r) => r.join(",") === "1,1,primeira do Rui,1");
quem = "sol";
await chaveiro.confiarNaIdentidade(sessaoSol, euRui.identidade.publica, true);
sessaoSol = await abrirComo("sol", sessaoSol);
await espera("a Sol compara o código e a conversa fica verificada neste aparelho", async () => sessaoSol.verificado, (v) => v === true);

// Repetição e linha duplicada, com o chaveiro de verdade.
await espera("ATAQUE (servidor repete): a mesma linha duas vezes sai uma vez só; o mesmo c3 sob outro id sai como repetida, sem texto", async () => {
  const lista = await (async () => {
    quem = "sol";
    return servidor("rede_dm_mensagens", { p_conversa: conversaRS });
  })();
  const dobrada = await chaveiro.abrirMensagens(sessaoSol, [...lista, { ...lista[0], criado_em: new Date(Date.now() + 1000).toISOString() }]);
  const outraLinha = await chaveiro.abrirMensagens(sessaoSol, [...lista, { ...lista[0], id: crypto.randomUUID(), criado_em: new Date(Date.now() + 2000).toISOString() }]);
  return [dobrada.length, outraLinha.length, outraLinha.filter((m) => m.repetida).length, outraLinha.find((m) => m.repetida)?.texto ?? "sem-texto"];
}, (r) => JSON.stringify(r) === '[1,2,1,"sem-texto"]');

// Identidade trocada de quem estava VERIFICADO.
const falsa = await novaIdentidadeDoChat();
const aparelhoFalso = await novaChaveDoAparelho();
const certificadoFalso = await certificarChave(falsa, P.rui, aparelhoFalso.publica);
const trocarRui = (participante) => (dados) => ({ ...dados, participantes: dados.participantes.map((p) => (p.usuario === P.rui ? { ...p, ...participante } : p)) });
await espera("ATAQUE (servidor troca a identidade de quem estava verificado): a marca cai, nada sai, um clique não passa, outra identidade não passa", async () => {
  mentiras.rede_dm_chaves_da_conversa = async (_a, real) => trocarRui({ identidade: falsa.publica, publica: aparelhoFalso.publica, certificado: certificadoFalso })(await real());
  const s = await abrirComo("sol", sessaoSol);
  const antesDeEnviar = chamadas.filter((c) => c === "rede_dm_enviar").length;
  const r = [
    s.mudou === falsa.publica, s.exigeComparar, s.verificado,
    await tentarCodigo(chaveiro.enviarTexto(s, "não pode sair")),
    await tentarCodigo(chaveiro.confiarNaIdentidade(s, falsa.publica, false)),
    await tentarCodigo(chaveiro.confiarNaIdentidade(s, (await novaIdentidadeDoChat()).publica, true)),
    chamadas.filter((c) => c === "rede_dm_enviar").length - antesDeEnviar,
  ];
  // Recarregar a página não tira a exigência: o que está guardado ainda é a identidade verdadeira, verificada.
  const deNovo = await abrirComo("sol", null);
  semMentiras();
  return [...r, deNovo.exigeComparar];
}, (r) => JSON.stringify(r) === '[true,true,false,"dm_exige_comparar","dm_exige_comparar","dm_identidade_mudou",0,true]');

// A mesma identidade assinando a chave de outro aparelho (o que um script na página do Rui conseguiria fazer UMA vez).
const aparelhoDoAtacante = await novaChaveDoAparelho();
const certificadoRoubado = await certificarChave(euRui.identidade, P.rui, aparelhoDoAtacante.publica);
await espera("ATAQUE (XSS no aparelho do Rui assina a chave do atacante com a identidade dele): a Sol nota a chave estranha, não envia, não aceita e não abre embrulho dela", async () => {
  const embrulhoDoAtacante = (await prepararNovaVersao(conversaRS, 99, { usuario: P.rui, aparelho: aparelhoDoAtacante, identidade: euRui.identidade, versao: 1 },
    [{ usuario: P.rui, identidade: euRui.identidade.publica, publica: aparelhoDoAtacante.publica, certificado: certificadoRoubado, versao: 1 },
      { usuario: P.sol, identidade: euSol.identidade.publica, publica: euSol.aparelho.publica, certificado: await certificarChave(euSol.identidade, P.sol, euSol.aparelho.publica), versao: euSol.versao }],
    { [P.rui]: euRui.identidade.publica, [P.sol]: euSol.identidade.publica })).embrulhos.find((e) => e.para === P.sol);
  mentiras.rede_dm_chaves_da_conversa = async (_a, real) => {
    const dados = trocarRui({ publica: aparelhoDoAtacante.publica, certificado: certificadoRoubado })(await real());
    return { ...dados, embrulhos: [...dados.embrulhos, { versao: 99, chave_versao: embrulhoDoAtacante.chave_versao, embrulho: embrulhoDoAtacante.embrulho, de: P.rui, de_publica: aparelhoDoAtacante.publica, de_certificado: certificadoRoubado }] };
  };
  const s = await abrirComo("sol", null);
  const r = [s.chaveEstranha, s.mudou !== null, s.verificado, s.chaves.has(99), await tentarCodigo(chaveiro.enviarTexto(s, "não pode sair")), await tentarCodigo(chaveiro.confiarNaIdentidade(s, euRui.identidade.publica, true))];
  semMentiras();
  return r;
}, (r) => JSON.stringify(r) === '[true,true,false,false,"dm_chave_estranha","dm_chave_estranha"]');

// Versão da chave: o servidor não faz o aparelho voltar nem ficar preso.
await dono("update interno.rede_dm_conversas set versao_em = now() - interval '7 days 1 hour' where id = $1", [conversaRS]);
sessaoRui = await abrirComo("rui", sessaoRui);
await espera("passados 7 dias, o aparelho faz a versão 2 sozinho", async () => sessaoRui.versao, (v) => v === 2);
await espera("ATAQUE (servidor volta a versão): a Sol já viu a 2; o servidor diz que a atual é a 1; a conversa não abre e nada é enviado", async () => {
  await abrirComo("sol", null);
  mentiras.rede_dm_chaves_da_conversa = async (_a, real) => ({ ...(await real()), versao: 1, versao_em: new Date().toISOString(), atual_ok: true });
  const r = await tentarCodigo(abrirComo("sol", null));
  semMentiras();
  return r;
}, (r) => r === "dm_versao_voltou");
await espera("ATAQUE (servidor prende a chave): mente a idade da versão e recusa a nova; pela conta do aparelho ela passou de 7 dias, e nada é enviado", async () => {
  // Este aparelho viu a versão 2 há 8 dias (a hora da última leitura é de agora: o relógio é de confiança).
  const chave = chaveDasVersoes(P.rui, conversaRS);
  await mudarNaGaveta(ORDEM, chave, (m) => ({ ...m, desde: Date.now() - 8 * 86_400_000, lida: Date.now() }));
  await dono("update interno.rede_dm_conversas set versao_em = now() - interval '1 hour' where id = $1", [conversaRS]);
  mentiras.rede_dm_chaves_da_conversa = async (_a, real) => ({ ...(await real()), versao_em: new Date().toISOString(), atual_ok: true });
  mentiras.rede_dm_nova_versao = async () => {
    throw Object.assign(new Error("versao_desatualizada"), { code: "versao_desatualizada" });
  };
  // A página é recarregada: a sessão nova lê do aparelho quando a versão foi vista.
  sessaoRui = await abrirComo("rui", sessaoRui);
  const antes = chamadas.filter((c) => c === "rede_dm_enviar").length;
  quem = "rui";
  const r = [await tentarCodigo(chaveiro.enviarTexto(sessaoRui, "na chave presa")), chamadas.filter((c) => c === "rede_dm_enviar").length - antes];
  // O servidor deixa trocar: a versão nova sai e o envio vai.
  delete mentiras.rede_dm_nova_versao;
  quem = "rui";
  sessaoRui = await chaveiro.enviarTexto(sessaoRui, "na chave nova");
  semMentiras();
  return [...r, sessaoRui.versao];
}, (r) => JSON.stringify(r) === '["dm_versao_presa",0,3]');
await espera("relógio do aparelho atrasado (o banco recusa a versão por velha): o aparelho força a versão nova e o envio vai", async () => {
  await dono("update interno.rede_dm_conversas set versao_em = now() - interval '9 days' where id = $1", [conversaRS]);
  // O aparelho acha a versão nova (o servidor, ou o relógio atrasado, diz que é de agora).
  mentiras.rede_dm_chaves_da_conversa = async (_a, real) => ({ ...(await real()), versao_em: new Date().toISOString() });
  quem = "rui";
  sessaoRui = await abrirComo("rui", sessaoRui);
  const antes = sessaoRui.versao;
  sessaoRui = await chaveiro.enviarTexto(sessaoRui, "com o relógio atrasado");
  semMentiras();
  return [antes, sessaoRui.versao];
}, (r) => r[1] === r[0] + 1);
await espera("e a Sol lê tudo o que foi enviado, sem buraco nem repetida", async () => {
  // A Sol confere de novo a identidade verdadeira (o teste do atacante deixou a sessão antiga para trás).
  sessaoSol = await abrirComo("sol", null);
  const lidas = await lerComo("sol", sessaoSol);
  const naTela = chaveiro.ordemDaConversa(lidas, P.sol).ordenadas;
  return [naTela.filter((m) => m.texto).map((m) => m.texto).join("|"), lidas.some((m) => m.repetida), chaveiro.depoisDeBuraco(lidas).size];
}, (r) => r[0] === "primeira do Rui|na chave nova|com o relógio atrasado" && r[1] === false && r[2] === 0);

// Formato antigo regravado pelo servidor.
await espera("ATAQUE (servidor regrava c2 antigo): a mesma c2 sob outro id é repetida; c2 depois de c3 do mesmo autor e versão sai com aviso; depois do prazo, c2 não abre", async () => {
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const lugar = contextoDaMensagem(conversaRS, P.rui);
  const velha = await cifrar(k, 5, await assinarTexto(euRui.identidade, "c2 antiga", lugar, 5), lugar);
  const resumo = "a".repeat(64);
  const chave = chaveDaOrdem(P.sol, conversaRS, P.rui, 5);
  const a = julgarAntiga(null, 0, chave, { servidor: "s1", versao: 5, resumo });
  const b = julgarAntiga(a.registro, 0, chave, { servidor: "s2", versao: 5, resumo });
  const c = julgarAntiga(a.registro, 0, chave, { servidor: "s1", versao: 5, resumo });
  const comC3 = julgar(null, 0, chave, { servidor: "s3", autor: P.rui, versao: 5, id: "id-c3", contador: 1 }).registro;
  const d = julgarAntiga(comC3, 0, chave, { servidor: "s4", versao: 5, resumo: "b".repeat(64) });
  return [a.juizo, b.juizo, c.juizo, d.juizo, (await abrirMensagem(k, velha, conversaRS, P.rui, euRui.identidade.publica, C2_ABRE_ATE - 1))?.autoria, await abrirMensagem(k, velha, conversaRS, P.rui, euRui.identidade.publica, C2_ABRE_ATE + 1)];
}, (r) => JSON.stringify(r) === '["nova","repetida","vista","duvidosa","ok",null]');

// Ordem e relógio (lib/rede/chat/ordem.ts).
await espera("ATAQUE (servidor reordena): dentro de cada pessoa vale o contador; a troca é avisada; resposta antes da pergunta é avisada; o que a outra ainda não tinha recebido é marcado", async () => {
  const m = (id, autor, contador, minuto, visto = null) => ({ id, autor, versao: 1, contador, criado_em: `2026-11-10T10:${String(minuto).padStart(2, "0")}:00Z`, visto });
  // O servidor pôs a 2 da Sol antes da 1; e a resposta do Rui (que já tinha visto a 2 da Sol) antes dela.
  const r = ordemDaTela([m("s2", "sol", 2, 1), m("s1", "sol", 1, 2), m("r1", "rui", 1, 3, { versao: 1, contador: 2 }), m("s3", "sol", 3, 4, { versao: 1, contador: 0 })], "rui");
  const r2 = ordemDaTela([m("r1", "rui", 1, 1, { versao: 1, contador: 2 }), m("s1", "sol", 1, 2), m("s2", "sol", 2, 3)], "rui");
  const r3 = ordemDaTela([m("r1", "rui", 1, 1), m("r2", "rui", 2, 2), m("s1", "sol", 1, 3, { versao: 1, contador: 1 })], "rui");
  return [r.ordenadas.map((x) => x.id).join(","), [...r.foraDeOrdem].sort().join(","), [...r2.foraDeOrdem].join(","), [...r3.semConfirmar].join(",")];
}, (r) => JSON.stringify(r) === '["s1,s2,r1,s3","s1,s2","r1","r2"]');
await espera("ATAQUE (relógio do aparelho mexido): a versão atual nunca fecha; nada vence se o relógio voltou ou saltou dias; a versão antiga vence com relógio de confiança", async () => {
  const DIA = 86_400_000;
  const agora = Date.now();
  const velho = { chave: "x", desde: agora - 50 * DIA, maior: 3, vistas: {} };
  return [
    podeFechar(velho, 4, 4, agora - 60_000, agora), podeFechar(velho, 3, 4, agora + DIA, agora), podeFechar(velho, 3, 4, agora - 10 * DIA, agora), podeFechar(velho, 3, 4, null, agora), podeFechar(velho, 3, 4, agora - 60_000, agora),
    relogioConfiavel(agora - DIA, agora), anotarVersao({ chave: "v", topo: 4, desde: 1, lida: 1 }, "v", 3).voltou, anotarVersao({ chave: "v", topo: 4, desde: 1, lida: 1 }, "v", 5, 99).marca.desde, versaoVelhaAqui(agora - 8 * DIA, 7, agora), versaoVelhaAqui(agora - 6 * DIA, 7, agora),
  ];
}, (r) => JSON.stringify(r) === "[false,false,false,false,true,true,true,99,true,false]");
await espera("o c3 leva dentro 'até onde eu já tinha recebido' e o chaveiro preenche com o que chegou da outra pessoa", async () => {
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const corpoVisto = await cifrarMensagem(k, 2, { usuario: P.ana }, conversaLivre, "resposta", 4, { versao: 2, contador: 7 });
  const aberta = await abrirMensagem(k, corpoVisto, conversaLivre, P.ana, null);
  return [aberta.visto.versao, aberta.visto.contador, /cifrarMensagem\(chave, usada\.versao, usada\.eu, usada\.conversa, texto, contador, await vistoDaOutra\(usada\)\)/.test(ler("lib/rede/chat-chaveiro.ts"))];
}, (r) => JSON.stringify(r) === "[2,7,true]");
Object.assign(clienteDoChat, criarClienteDoChat(async () => {
  throw new Error("fora_do_teste");
}));

// ── Código de segurança: QR e comparar de novo (lib/rede/chat/verificacao.ts) ──
const codigoAB = await codigoDeSeguranca(aparelhos.ana.identidade.publica, aparelhos.bia.identidade.publica);
const codigoAI = await codigoDeSeguranca(aparelhos.ana.identidade.publica, aparelhos.intrusa.identidade.publica);
await espera("QR do código de segurança: ida e volta, igual nos dois lados", async () => [lerQrDaSeguranca(qrDaSeguranca(codigoAB)) === codigoAB, (await codigoDeSeguranca(aparelhos.bia.identidade.publica, aparelhos.ana.identidade.publica)) === codigoAB, conferirQr(qrDaSeguranca(codigoAB), codigoAB)], (r) => r[0] === true && r[1] === true && r[2] === "confere");
await espera("QR errado: código de outra pessoa não confere; QR de outra coisa não é código", async () => [
  conferirQr(qrDaSeguranca(codigoAI), codigoAB),
  conferirQr(`lucia:aparelho:12345678:${aparelhos.ana.aparelho.publica}`, codigoAB),
  conferirQr("qualquer coisa", codigoAB),
  conferirQr(qrDaSeguranca(codigoAB).slice(0, -1), codigoAB),
], (r) => r.join(",") === "nao_confere,outro,outro,outro");
await espera("o QR desenhado (qrcode) é lido de volta (jsqr) e confere só com o código certo", async () => {
  const { default: QRCode } = await import("qrcode");
  const modulo = await import("jsqr");
  const jsQR = modulo.default?.default ?? modulo.default;
  const { modules } = QRCode.create(qrDaSeguranca(codigoAB), { errorCorrectionLevel: "M" });
  const escala = 4;
  const margem = 4;
  const lado = (modules.size + 2 * margem) * escala;
  const pontos = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.data[y * modules.size + x]) continue;
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const i = (((y + margem) * escala + dy) * lado + (x + margem) * escala + dx) * 4;
          pontos[i] = pontos[i + 1] = pontos[i + 2] = 0;
        }
      }
    }
  }
  const lido = jsQR(pontos, lado, lado)?.data ?? "";
  return [lido === qrDaSeguranca(codigoAB), conferirQr(lido, codigoAB), conferirQr(lido, codigoAI)];
}, (r) => r[0] === true && r[1] === "confere" && r[2] === "nao_confere");
const metadeDaAna = await metadeDoCodigo(aparelhos.ana.identidade.publica);
const metadeDaBia = await metadeDoCodigo(aparelhos.bia.identidade.publica);
await espera("comparar de novo: a metade da outra pessoa é achada no código, nos dois lados, e fica escondida na tela", async () => {
  const daBia = metadeDaOutraPessoa(codigoAB, metadeDaAna);
  const daAna = metadeDaOutraPessoa(codigoAB, metadeDaBia);
  const naTela = codigoComMetadeEscondida(codigoAB, daBia.inicio);
  const escondidos = naTela.map((g, i) => (g === "•••••" ? i : -1)).filter((i) => i >= 0);
  return [
    daBia.numeros === metadeDaBia, daAna.numeros === metadeDaAna, daBia.inicio !== daAna.inicio,
    escondidos.length === GRUPOS_DA_METADE && escondidos[0] === daBia.inicio && escondidos.at(-1) === daBia.inicio + 5,
    naTela.filter((g) => g !== "•••••").join("") === metadeDaAna,
    metadeDaOutraPessoa(codigoAB, "0".repeat(30)),metadeDaOutraPessoa("1".repeat(60), "1".repeat(30)),
  ];
}, (r) => r.slice(0, 5).every((x) => x === true) && r[5] === null && r[6] === null);
await espera("comparar de novo: só os trinta números da OUTRA pessoa passam (com ou sem espaços); a minha metade, um grupo só ou errado, não", async () => {
  const comEspacos = metadeDaBia.replace(/(.{5})/g, "$1 ");
  const umGrupoErrado = `${metadeDaBia.slice(0, 25)}${metadeDaBia.slice(25) === "00000" ? "00001" : "00000"}`;
  return [
    conferirMetade(codigoAB, metadeDaAna, metadeDaBia), conferirMetade(codigoAB, metadeDaAna, ` ${comEspacos} `),
    conferirMetade(codigoAB, metadeDaAna, metadeDaAna), conferirMetade(codigoAB, metadeDaAna, metadeDaBia.slice(0, 5)), conferirMetade(codigoAB, metadeDaAna, umGrupoErrado),
    conferirMetade(codigoAB, metadeDaAna, ""), conferirMetade(codigoAB, metadeDaAna, `${metadeDaBia.slice(0, 29)}x`), conferirMetade(codigoAB, metadeDaAna, codigoAB),
  ];
}, (r) => r.join(",") === "true,true,false,false,false,false,false,false");
await espera("ATAQUE (achado alto): o servidor troca a identidade da Bia por uma falsa; nada do que a Bia de verdade diz passa, em nenhuma posição", async () => {
  // O código que o aparelho da Ana calcula com a identidade falsa. A Bia de verdade lê, da tela dela, a metade dela.
  const falsas = await Promise.all([1, 2, 3].map(() => novaIdentidadeDoChat()));
  const resultados = [];
  for (const falsa of falsas) {
    const codigoFalso = await codigoDeSeguranca(aparelhos.ana.identidade.publica, falsa.publica);
    const outra = metadeDaOutraPessoa(codigoFalso, metadeDaAna);
    // Na velha regra, metade dos grupos pedidos era da Ana e conferia com qualquer identidade falsa. Agora a tela só pede a
    // metade da outra pessoa: nem a metade verdadeira da Bia, nem a da Ana, nem um grupo de cada passa.
    const mistura = codigoFalso.slice(0, 30) === metadeDaAna ? `${metadeDaAna.slice(0, 15)}${metadeDaBia.slice(15)}` : `${metadeDaBia.slice(0, 15)}${metadeDaAna.slice(15)}`;
    resultados.push(outra !== null && outra.numeros !== metadeDaBia, conferirMetade(codigoFalso, metadeDaAna, metadeDaBia), conferirMetade(codigoFalso, metadeDaAna, metadeDaAna), conferirMetade(codigoFalso, metadeDaAna, mistura),
      conferirQr(qrDaSeguranca(codigoAB), codigoFalso));
  }
  return resultados.join(",");
}, (t) => t === "true,false,false,false,nao_confere,".repeat(3).slice(0, -1));
await espera("identidade trocada de quem estava verificado: a marca cai, o envio fica retido e um clique não basta", async () => [ler("lib/rede/chat-chaveiro.ts"), ler("components/rede/chat/Conversa.tsx")],
  (r) => /sessao\.exigeComparar = !!conhecida\?\.verificado;\s*sessao\.verificado = false;/.test(r[0])
    && /if \(sessao\.exigeComparar && !verificado\) throw erroDoChat\("dm_exige_comparar"\)/.test(r[0])
    && /if \(atual\.mudou\) throw erroDoChat\(retida\(atual\)\)/.test(r[0]) && /s\.exigeComparar \? "dm_exige_comparar"/.test(r[0])
    // A tela passa a identidade do código COMPARADO (não a da sessão na hora do clique), e o chaveiro recusa se ela mudou no meio.
    && /sessao\.exigeComparar \? \([\s\S]{0,500}<CompararDeNovo[^>]*aoConferir=\{\(\) => void confiar\(paraComparar\.identidade, true\)\}/.test(r[1])
    && /if \(!esperada \|\| identidade !== esperada\) throw erroDoChat\("dm_identidade_mudou"\)/.test(r[0])
    && (r[1].match(/confiar\(sessao\.mudou as string, false\)/g) ?? []).length === 1 && !/confiarNaIdentidade\(atual, atual\.mudou/.test(r[1])
    && /disabled=\{ocupado \|\| !textoCabe\(texto\) \|\| !!sessao\.mudou\}/.test(r[1]));
await espera("outra chave no servidor para a própria conta: a tela explica o risco e pede o \"entendi\" antes de criar chave nova", async () => [ler("components/rede/chat/Tela.tsx"), ler("lib/rede/chat-chaveiro.ts")],
  (r) => /aparelho\.estado === "outro_aparelho" && !entendi/.test(r[0]) && /aparelho\.tinhaChaveAqui && <p role="alert"[^>]*>\{t\.ativar\.outroTinha\}/.test(r[0]) && /\{t\.ativar\.outroRisco\}/.test(r[0]) && /tinhaChaveAqui: !!guardado/.test(r[1]));
await espera("câmera: só liga com o toque da pessoa e desliga ao fechar, ao ler e quando a aba vai para o fundo", async () => [ler("components/rede/chat/Qr.tsx"), ler("components/rede/chat/Conversa.tsx")],
  (r) => (r[0].match(/getUserMedia\(/g) ?? []).length === 1 && (r[0].match(/getTracks\(\)\.forEach\(\(faixa\) => faixa\.stop\(\)\)/g) ?? []).length === 2 && /visibilitychange/.test(r[0])
    && /\{lendoQr && \(\s*<LeitorDeQr/.test(r[1]) && /\{lendo && \(\s*<LeitorDeQr/.test(r[1]) && (r[1].match(/setLendoQr\(true\)|setLendo\(true\)/g) ?? []).length === 2 && !/useEffect\([^)]*setLendo(Qr)?\(true\)/.test(r[1]));
await espera("denúncia: a tela diz que os trechos marcados saem do cifrado e vão em texto aberto para a moderação", async () => [ler("components/rede/chat/Denuncia.tsx"), JSON.parse(ler("i18n/rede/chat/pt.json")).denuncia.aberto],
  (r) => /\{t\.denuncia\.aberto\}/.test(r[0]) && /saem do cifrado/.test(r[1]) && /texto aberto/.test(r[1]) && /moderação/.test(r[1]));
await espera("na prévia nada do chat chama o banco: o chaveiro sai antes em cada função e o cliente usa o dublê", async () => [ler("lib/rede/chat-chaveiro.ts"), ler("lib/rede/cliente-chat.ts")],
  (r) => (r[0].match(/if \(PREVIA_DO_CHAT\)/g) ?? []).length >= 7 && /PREVIA_DO_CHAT \? chamarDubleDoChat\(\) : chamar/.test(r[1]));
await espera("o documento explica o c3: blocos, negabilidade, repetição e ordem, rotação, identidade trocada e Sair rápido", async () => ler("docs/rede/CHAT-PRIVADO.md"), (t) => ["c3.", "negabilidade", "363", "10944", "8 dias", "Sair rápido", "20261110-chat-blocos.sql", "PASSO A PASSO"].every((x) => t.includes(x)));

// ── Interface: textos em todos os idiomas (a marca "_rascunho" dos idiomas ainda não revisados não conta), menu, perfil e documento ──
const chavesDe = (o, prefixo = "") => Object.entries(o).filter(([k]) => !k.startsWith("_")).flatMap(([k, v]) => (v && typeof v === "object" ? chavesDe(v, `${prefixo}${k}.`) : [`${prefixo}${k}`])).sort();
const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textosPt = JSON.parse(ler("i18n/rede/chat/pt.json"));
await espera("os textos do chat têm as mesmas chaves nos seis idiomas", async () => IDIOMAS.filter((l) => JSON.stringify(chavesDe(JSON.parse(ler(`i18n/rede/chat/${l}.json`)))) !== JSON.stringify(chavesDe(textosPt))), (l) => l.length === 0);
await espera("menu.conversas e perfil.conversar existem nos seis idiomas da Alumia", async () => IDIOMAS.filter((l) => { const j = JSON.parse(ler(`i18n/rede/${l}.json`)); return !j.menu?.conversas || !j.perfil?.conversar; }), (l) => l.length === 0);
await espera("nenhum texto do chat usa as palavras proibidas na interface", async () => IDIOMAS.filter((l) => /universidade|diploma/i.test(ler(`i18n/rede/chat/${l}.json`))), (l) => l.length === 0);
await espera("a página /alumia/conversas não é indexada", async () => ler("app/[lang]/alumia/conversas/page.tsx"), (t) => /index:\s*false/.test(t));
await espera("o perfil leva ao chat (?com=@handle) só para membro e nunca no próprio perfil", async () => ler("components/rede/perfil/TelaDoPerfil.tsx"), (t) => /!dado\.meu && situacao\.logado && situacao\.membro[\s\S]{0,200}\/conversas\?com=/.test(t));
await espera("o documento docs/rede/CHAT-PRIVADO.md existe e cita a LGPD (arts. 6º, 14, 18 e 46)", async () => ler("docs/rede/CHAT-PRIVADO.md"), (t) => ["art. 6", "art. 14", "art. 18", "art. 46"].every((a) => t.includes(a)));

console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
