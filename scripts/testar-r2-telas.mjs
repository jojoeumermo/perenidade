// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a parte das telas da onda R2 (onda R2, as telas):
//   1. a troca do chat do beta: o aviso no alto do Início (components/rede/avisos/AvisoDaTroca.tsx) pelo contrato da conversa a dois
//      (a data em lib/rede/chat/r2/troca.ts e a limpeza em lib/rede/chat/r2/limpeza.ts, testadas pela frente dela); e o endereço do
//      chat e o .onion deixando passar as rotas do chat novo;
//   2. os textos: o aviso da troca tem a data em todos os idiomas; Privacidade, O que guardamos e Ajuda não dizem mais que o
//      servidor sabe quem está em cada conversa e dizem o que ele ainda vê; a denúncia com prova avisa que os trechos saem do
//      cifrado;
//   3. o banco depois de TODAS as migrações da R2 que estão na árvore (no ramo da frente, só a da denúncia com prova; depois da
//      junção, todas): nenhuma função ficou lendo tabela que saiu; o painel único e a moderação não leem caixa, pacote, diretório,
//      cofre, passe nem parte de chave de voto; as funções das caixas anônimas (quando existem) só a chave de serviço chama, e estão
//      na lista de exceções da porta; o painel mostra a denúncia com prova sem nada da caixa;
//   4. a porta do site (proxy.ts) não põe nem exige a sessão nas rotas anônimas das caixas.
// O que não está na árvore (as caixas antes da junção) sai escrito como "NÃO CONFERIDO", nunca como certo.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-telas.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avisoDaTroca } from "../lib/rede/avisos/troca.ts";
import { arquivoNoChat } from "../lib/rede/chat/origem.ts";
import { avisarTroca, dataDaTrocaNaTela } from "../lib/rede/chat/r2/troca.ts";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const json = (c) => JSON.parse(ler(c));

let certos = 0;
const falhas = [];
const naoConferido = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
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

// ═══════════════════ 1. A troca do chat do beta ═══════════════════
// A data e a limpeza são da conversa a dois (lib/rede/chat/r2/troca.ts e limpeza.ts, pelo contrato do desenho; o teste delas é o
// da frente da conversa). Aqui: o aviso no alto do Início usa esse contrato, decide certo, e vale para todo mundo.
ok("a decisão: antes da data, o aviso com a data", JSON.stringify(avisoDaTroca({ avisar: true, data: "01/12/2026", limpou: false, fechado: false })) === JSON.stringify({ tipo: "antes", data: "01/12/2026" }));
ok("a decisão: fechado nesta aba, some até a próxima aba", avisoDaTroca({ avisar: true, data: "01/12/2026", limpou: false, fechado: true }) === null);
ok("a decisão: sem data marcada, nada antes (o site não inventa data)", avisoDaTroca({ avisar: false, data: null, limpou: false, fechado: false }) === null);
ok("a decisão: a limpeza apagou agora o chat do beta, diz uma vez (com a data, ou sem ela)", avisoDaTroca({ avisar: false, data: "01/12/2026", limpou: true, fechado: true })?.tipo === "depois"
  && avisoDaTroca({ avisar: false, data: null, limpou: true, fechado: false })?.data === null);
ok("a data na tela vem do contrato da conversa a dois (DD/MM/AAAA) e o aviso de antes some quando o dia da troca começa", dataDaTrocaNaTela("2026-12-01") === "01/12/2026" && dataDaTrocaNaTela(null) === null
  && avisarTroca(Date.parse("2026-11-30T23:59:59Z"), "2026-12-01") && !avisarTroca(Date.parse("2026-12-01T00:00:00Z"), "2026-12-01") && !avisarTroca(Date.parse("2026-12-01T23:00:00Z"), "2026-12-01")
  && !avisarTroca(Date.parse("2026-12-02T00:00:01Z"), "2026-12-01") && !avisarTroca(Date.now(), null));
{
  const aviso = ler("components/rede/avisos/AvisoDaTroca.tsx");
  const fonte = aviso + ler("lib/rede/avisos/troca.ts");
  ok("nenhum Math.random nas peças do aviso", !fonte.includes("Math.random"));
  ok("o aviso chama a limpeza da conversa a dois (a mesma do chat) e não tem limpeza própria", aviso.includes('import("@/lib/rede/chat/r2/limpeza")') && aviso.includes("limparChatAntigo()") && !/deleteDatabase|localStorage/.test(aviso));
  ok("o aviso usa a data e os textos do contrato (troca.aviso, troca.depois, troca.depoisSemData)", aviso.includes('from "@/lib/rede/chat/r2/troca"') && ["t.troca.aviso", "t.troca.depois", "t.troca.depoisSemData"].every((x) => aviso.includes(x)));
  const lei = ler("components/rede/lei/encaixe.tsx");
  ok("o aviso está no alto do Início para todo mundo (encaixe da lei, sem a flag do chat)", lei.includes("avisos/AvisoDaTroca") && /topoDaLinha:[^\n]*AvisoDaTrocaNoInicio/.test(lei));
  ok("o chat não ganhou um segundo aviso desta frente (o do chat é da conversa a dois)", !/AvisoDaTroca/.test(ler("components/rede/chat/Tela.tsx") + ler("components/rede/chat/encaixe.tsx")));
}

// ═══════════════════ 1b. O chat novo no endereço próprio e no .onion ═══════════════════
// Lá o proxy só deixa passar os serviços que o chat usa (lib/rede/chat/origem.ts): sem as rotas da R2, o chat novo daria 404.
{
  const passa = (c) => arquivoNoChat(c) === null;
  const NOVAS = ["/api/alumia/caixa/lote", "/api/alumia/caixa/buscar", "/api/alumia/caixa/confirmar", "/api/alumia/caixa/trocar", "/api/alumia/caixa/apagar",
    "/api/alumia/pedido", "/api/alumia/pedido/desafio", "/api/alumia/diretorio/ler", "/api/alumia/diretorio/reivindicar", "/api/alumia/passes/chave",
    "/api/alumia/passes/emitir", "/api/alumia/franquia/denunciar"];
  const barradas = NOVAS.filter((c) => !passa(c));
  ok("no endereço do chat e no .onion passam as rotas do chat novo (caixas, pedidos, diretório, passes, denúncia com prova)", barradas.length === 0, barradas.join(", "));
  ok("e o resto continua barrado (voz, Fediverso, nomes parecidos)", ["/api/alumia/voz/retransmissao", "/api/fediverso/buscar", "/api/alumia/caixas", "/api/alumia/caixa-x", "/api/alumia/pedidos", "/api/alumia/passes2", "/api/alumia/portaria"].every((c) => arquivoNoChat(c) === "barrar"));
}

// ═══════════════════ 2. Os textos ═══════════════════
const LINGUAS = ["pt", "en", "es", "fr", "ru", "zh"];
for (const l of LINGUAS) {
  const c = json(`i18n/rede/chat/${l}.json`).troca;
  ok(`${l}: o aviso da troca tem a data, antes e depois`, c && c.aviso.includes("{data}") && c.depois.includes("{data}") && c.depoisSemData && !c.depoisSemData.includes("{data}"));
  const m = json(`i18n/rede/moderacao/${l}.json`);
  ok(`${l}: a denúncia com prova avisa antes que os trechos saem do cifrado, e a fila diz o limite`, m.denunciar.prova.saem.length > 25 && m.denunciar.prova.limite.length > 25 && m.fila.prova.explica.length > 50);
  const lei = json(`i18n/rede/lei/${l}.json`);
  ok(`${l}: Ajuda tem o grupo das conversas com 4 perguntas`, lei.ajuda.grupos.some((g) => g.perguntas.length === 4 && /beta|bêta|бета|测试/.test(JSON.stringify(g))));
  ok(`${l}: O que guardamos tem a caixa de pedidos, a lista e a cópia, os passes e a denúncia com prova`, lei.guardamos.grupos[2].linhas.length >= 9);
}
{
  const pt = json("i18n/rede/lei/pt.json");
  const tudo = JSON.stringify(pt);
  ok("pt: nenhum texto diz mais que o servidor sabe quem está em cada conversa", !/o servidor sabe quem está em cada conversa/i.test(tudo));
  ok("pt: a privacidade diz o que o servidor ainda vê na hora (endereço e horário) e que o banco não guarda", /endereço de rede e o horário/.test(pt.privacidade.secoes[3].itens[4]) && /o banco não guarda nada disso/.test(pt.privacidade.secoes[3].itens[4]));
  ok("pt: a caixa de pedidos aparece como ligada à conta (sem prometer o que o código não faz)", pt.guardamos.grupos[2].linhas.some((x) => /caixa de pedidos/.test(x.dado) && /ligada à sua conta/.test(x.onde)));
  ok("pt: a Ajuda diz que a prova não diz sozinha quem escreveu", pt.ajuda.grupos.some((g) => g.perguntas.some((q) => /não prova sozinho quem escreveu/.test(q.r))));
  ok("pt: o pânico já não diz Web Crypto (agora Argon2id)", !/Web Crypto/.test(tudo) && /Argon2id/.test(pt.privacidade.secoes[10].paragrafos[1]));
  ok("os rascunhos continuam marcados", LINGUAS.filter((l) => l !== "pt").every((l) => json(`i18n/rede/lei/${l}.json`)._rascunho === true && json(`i18n/rede/chat/${l}.json`)._rascunho === true && json(`i18n/rede/moderacao/${l}.json`)._rascunho === true));
}

// ═══════════════════ 3. O banco depois das migrações da R2 ═══════════════════
const MIGRACOES = fs.readdirSync(path.join(raiz, "supabase/migracoes")).filter((n) => /^20261124-r2-.*\.sql$/.test(n)).sort();
const FIM = MIGRACOES.indexOf("20261124-r2-fim.sql");
if (FIM >= 0) MIGRACOES.push(MIGRACOES.splice(FIM, 1)[0]);
const banco = await criarBanco();
const { dono, criarUsuario, rpc } = banco;
const exec = (s) => banco.exclusivo(() => banco.pg.exec(s));
const um = async (s, v = []) => (await dono(s, v)).rows[0];
const linhas = async (s, v = []) => (await dono(s, v)).rows;
const tabelasAntes = new Set((await linhas("select n.nspname || '.' || c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','p','v','m') and n.nspname in ('interno','public')")).map((x) => x.t));
for (const m of MIGRACOES) await espera(`a migração ${m} instala por cima do install.sql`, () => exec(ler(`supabase/migracoes/${m}`)));
ok("há ao menos a migração desta frente", MIGRACOES.includes("20261124-r2-franquia.sql"), MIGRACOES.join(", "));
const tabelasDepois = new Set((await linhas("select n.nspname || '.' || c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','p','v','m') and n.nspname in ('interno','public')")).map((x) => x.t));
const sairam = [...tabelasAntes].filter((t) => !tabelasDepois.has(t)).map((t) => t.split(".")[1]);
const funcoes = await linhas(`select p.oid::int oid, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' nome, p.prosrc corpo
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno', 'public') and p.prokind = 'f'`);
{
  const quebradas = funcoes.filter((f) => sairam.some((t) => new RegExp(`\\b${t}\\b`).test(f.corpo))).map((f) => f.nome);
  ok(`nenhuma função ficou lendo uma tabela que saiu (${sairam.length} saíram)`, quebradas.length === 0, quebradas.slice(0, 12).join(", "));
}
{
  // O que só o aparelho deve ler ou que liga gente a conversa: o painel e a moderação não tocam.
  const SECRETAS = /\b(caixas|pacotes|caixa_contagem|passes_gastos|passes_emitidos|diretorio_aparelhos|diretorio_pre_chaves|diretorio_pacotes_mls|diretorio_contas|rede_cofres_da_conta|rede_consulta_chaves|rede_consulta_aberturas)\b/;
  const doPainel = funcoes.filter((f) => /\.(alumia_admin_|alumia_painel_|rede_painel_|rede_mod_|rede3_mod_)/.test(f.nome));
  const leem = doPainel.filter((f) => SECRETAS.test(f.corpo)).map((f) => f.nome);
  ok(`o painel único e a moderação (${doPainel.length} funções) não leem caixa, pacote, diretório, cofre, passe nem parte de chave de voto`, doPainel.length > 50 && leem.length === 0, leem.join(", "));
}
{
  const anonimas = funcoes.filter((f) => /^public\.(rede_caixa_|rede_diretorio_ler|rede_diretorio_reivindicar|rede_passe_gastar)/.test(f.nome));
  if (anonimas.length === 0) naoConferido.push("as funções das caixas anônimas (não estão neste ramo; conferir depois da junção, rodando este teste de novo)");
  for (const f of anonimas) {
    const assinatura = f.nome.replace(/^public\./, "");
    const p = await um("select has_function_privilege('anon', $1::oid, 'execute') a, has_function_privilege('authenticated', $1::oid, 'execute') b, has_function_privilege('service_role', $1::oid, 'execute') c", [f.oid]);
    ok(`caixa anônima ${assinatura}: só a chave de serviço chama (nem anon nem conta)`, !p.a && !p.b && p.c);
  }
  if (anonimas.length) {
    const porta = (await um("select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = 'alumia_porta_aberta' limit 1"))?.d ?? "";
    const fora = anonimas.map((f) => f.nome.replace(/^public\.|\(.*$/g, "")).filter((n) => !porta.includes(n));
    ok("as caixas anônimas estão escritas na lista de exceções da porta (não usam a sessão de conta)", fora.length === 0, fora.join(", "));
  }
}
{
  const P = {};
  for (const nome of ["coord", "bia", "ana"]) {
    P[nome] = await criarUsuario(`${nome}@r2telas.local`, `Pessoa ${nome}`);
    await rpc({ papel: "authenticated", sub: P[nome], aal: "aal2" }, "eu");
  }
  await dono("insert into interno.rede_regras (versao, texto) values (1, $1) on conflict do nothing", ["Normas da Rede para o teste. ".repeat(4)]);
  await dono("delete from interno.papeis");
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [P.coord]);
  for (const nome of Object.keys(P)) {
    await dono("update interno.perfis set rede_codinome = $2, rede_codinome_ok = true, rede_handle = $3, rede_18 = true, rede_consentimento = 1, rede_modo = 'aberto' where id = $1", [P[nome], `Codinome ${nome}`, `c_${nome}`]);
    await dono("insert into interno.rede_consentimentos (usuario, versao) values ($1, 1) on conflict do nothing", [P[nome]]);
  }
  await dono("update auth.users set created_at = now() - interval '30 days'");
  const d = await espera("uma denúncia com prova entra pela chave de serviço", () => rpc({ papel: "service_role" }, "rede_franquia_denunciar", { p_usuario: P.bia, p: { categoria: "ameaca", autor: "c_ana", prova: [{ texto: "Sei onde você mora.", dia: "2026-11-20", origem: "conversa" }] } }), (x) => x?.protocolo);
  const C = { papel: "authenticated", sub: P.coord, aal: "aal2" };
  await espera("o painel único lista a denúncia com o texto conferido, sem nada da caixa e sem quem denunciou", () => rpc(C, "alumia_painel_denuncias", {}), (lista) => {
    const item = lista.find((i) => i.protocolo === d?.protocolo);
    const texto = JSON.stringify(item ?? {});
    return item && Array.isArray(item.prova) && item.prova[0].texto === "Sei onde você mora." && !/caixa"|marca|"kf"|conteudo/.test(texto) && !texto.includes(P.bia);
  });
  await espera("o painel único abre a denúncia (em análise) e decide como antes", async () => {
    const item = (await rpc(C, "alumia_painel_denuncias", {})).find((i) => i.protocolo === d?.protocolo);
    return rpc(C, "alumia_painel_denuncia", { p_id: item.id });
  }, (x) => x && JSON.stringify(x).includes("em_analise"));
  await espera("o painel único sem o segundo fator não abre", () => rpc({ ...C, aal: "aal1" }, "alumia_painel_denuncias", {}).then(() => "abriu", (e) => String(e.message)), (x) => /sem_permissao|segundo_fator|aal/.test(x));
}
await banco.fechar?.();

// ═══════════════════ 4. A porta do site e as rotas anônimas ═══════════════════
{
  const proxy = ler("proxy.ts");
  ok("a porta do site (proxy.ts) não põe cookie de sessão nem Authorization nas rotas das caixas", !/api\/alumia\/(caixa|diretorio|pedido|passes)[^\n]*(cookie|Authorization)/i.test(proxy));
  const rotas = ["app/api/alumia/caixa", "app/api/alumia/diretorio", "app/api/alumia/pedido"].filter((r) => fs.existsSync(path.join(raiz, r)));
  if (rotas.length === 0) naoConferido.push("as rotas anônimas das caixas (não estão neste ramo): a recusa do cookie sb-* e da sessão fica para o teste das caixas depois da junção");
  for (const r of rotas) {
    const arquivos = fs.readdirSync(path.join(raiz, r), { recursive: true }).filter((n) => String(n).endsWith("route.ts")).map((n) => path.join(r, String(n)));
    for (const a of arquivos) ok(`${a}: não pede a sessão da conta (sem contaDoToken nem getUser)`, !/contaDoToken|auth\.getUser|getSession/.test(ler(a)));
  }
  ok("a denúncia com prova vai COM a sessão de quem denuncia e não chama nenhuma rota das caixas", /Authorization: `Bearer/.test(ler("lib/rede/franquia/cliente.ts")) && !/api\/alumia\/caixa/.test(ler("lib/rede/franquia/cliente.ts")));
}

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
for (const n of naoConferido) console.log(`  NÃO CONFERIDO: ${n}`);
process.exit(falhas.length ? 1 : 0);
