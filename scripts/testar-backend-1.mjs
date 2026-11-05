// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o back-end novo, parte 1 (Etapa 8, docs/backend-1.md): recursos ligados pelo banco, segunda pessoa, zerar 2FA e
// aparelhos, limites, constantes, destaques, apresentação de trilha, PR de conteúdo e correções aprovadas. Sem rede e sem banco:
// lê o SQL como texto e roda os módulos de lib/ com um "fetch" de mentira. Uso: npm run testar:backend-1
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { abrirPR, caminhoValido, configDoServidor, ErroGitHub, lerArquivo, manterFimDeLinha, nomeDoBranch, substituirTrecho, textoDoPR } from "../lib/conteudo-pr.ts";
import { definirVivos, ligado, PADRAO, RECURSOS, SO_PELO_NOME } from "../lib/recursos.ts";
import { carregarVivos, lerVivos } from "../lib/recursos-vivos.ts";

const ler = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const sql = ler("supabase", "migracoes", "2026-11-backend-1.sql");
const tela = ler("components", "painel", "BackendUm.tsx");
const painel = ler("components", "painel", "Painel.tsx");
const estrutura = ler("components", "painel", "estrutura.ts");
const rotaConteudo = ler("app", "api", "painel", "conteudo", "route.ts");
const rotaCorrecoes = ler("app", "api", "painel", "correcoes", "route.ts");
const rotaRecursos = ler("app", "api", "recursos", "route.ts");
const prLib = ler("lib", "conteudo-pr.ts");
let n = 0;
const ok = (nome, f) => {
  try {
    const r = f();
    if (r && typeof r.then === "function") return r.then(() => n++).catch((e) => { console.error("FALHOU:", nome, "\n ", e.message); process.exitCode = 1; });
    n++;
  } catch (e) {
    console.error("FALHOU:", nome, "\n ", e.message);
    process.exitCode = 1;
  }
};

// Todas as funções public.* criadas no SQL.
const publicas = [...sql.matchAll(/create or replace function public\.([a-z0-9_]+)\(([^)]*)\)/g)].map((m) => ({ nome: m[1], args: m[2] }));
const internas = [...sql.matchAll(/create or replace function interno\.([a-z0-9_]+)\(/g)].map((m) => m[1]);
const nomes = publicas.map((f) => f.nome);

// ───────── 1. Recursos ligados sem publicar de novo
ok("catálogo do SQL = lib/recursos.ts", () => {
  const bloco = sql.slice(sql.indexOf("insert into interno.recursos_catalogo"), sql.indexOf("on conflict (nome) do update set so_pelo_nome"));
  const dados = [...bloco.matchAll(/\('([a-z0-9-]+)', (true|false)\)/g)].map((m) => [m[1], m[2] === "true"]);
  const doSql = new Map(dados);
  assert.deepEqual([...doSql.keys()].sort(), Object.keys(RECURSOS).sort());
  for (const nome of Object.keys(RECURSOS)) assert.equal(doSql.get(nome), SO_PELO_NOME.includes(nome), `so_pelo_nome de ${nome}`);
});
ok("funções de recursos existem", () => ["recursos_lidos", "recursos_estado", "recurso_ajustar"].forEach((f) => assert.ok(nomes.includes(f), f)));
ok("ligar recurso só-pelo-nome abre pedido de segunda pessoa", () => {
  const corpo = sql.slice(sql.indexOf("function public.recurso_ajustar"), sql.indexOf("-- ───────────────────────── 2."));
  assert.match(corpo, /if p_ligar and k\.so_pelo_nome then[\s\S]*pedir_confirmacao\('recurso'/);
  assert.match(corpo, /return jsonb_build_object\('aguardando', true/);
});
ok("recursos_lidos é público e só devolve nomes", () => {
  const corpo = sql.slice(sql.indexOf("function public.recursos_lidos"), sql.indexOf("function public.recursos_estado"));
  assert.ok(!corpo.includes("por,") && !corpo.includes("'por'"));
  assert.match(sql, /'recursos_lidos\(\)', 'site_constantes_ler\(\)', 'destaques_ler\(\)', 'trilha_apresentacao_ler\(text, text\)'\] loop[\s\S]*grant execute on function public\.%s to anon, authenticated/);
});
ok("ligado(): sem banco, o comportamento antigo", () => {
  definirVivos({ ligados: new Set(), desligados: new Set() });
  assert.equal(ligado("escola", new Set(["todos"])), false);
  assert.equal(ligado("escola", new Set(["escola"])), true);
  assert.equal(ligado("exercicios", new Set(["-exercicios"])), false);
  assert.equal(ligado("turma", new Set()), PADRAO.includes("turma"));
  assert.equal(ligado("enem-curso", new Set(["todos"])), true);
});
ok("ligado(): banco liga, inclusive só-pelo-nome; banco desliga sempre", () => {
  definirVivos({ ligados: new Set(["escola", "enem-video"]), desligados: new Set(["turma"]) });
  assert.equal(ligado("escola", new Set()), false, "lista explícita ignora o banco");
  assert.equal(ligado("escola"), process.env.NEXT_PUBLIC_RECURSOS?.includes("-escola") ? false : true);
  assert.equal(ligado("enem-video"), process.env.NEXT_PUBLIC_RECURSOS?.includes("-enem-video") ? false : true);
  assert.equal(ligado("turma"), false, "desligado no banco vence o padrão");
  assert.equal(ligado("vale-o-escrito"), process.env.NEXT_PUBLIC_RECURSOS?.split(",").includes("vale-o-escrito") ?? false, "sem decisão do banco, só-pelo-nome continua pelo nome");
  definirVivos({ ligados: new Set(), desligados: new Set() });
});
ok("lerVivos ignora lixo e prefere desligado", () => {
  const v = lerVivos({ ligados: ["escola", "inventado", 3, "turma"], desligados: ["turma", { x: 1 }] });
  assert.deepEqual([...v.ligados], ["escola"]);
  assert.deepEqual([...v.desligados], ["turma"]);
  assert.deepEqual([...lerVivos(null).ligados], []);
  assert.deepEqual([...lerVivos("x").desligados], []);
});
await ok("carregarVivos: cache curto, falha segura", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.test/";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-publica-de-teste";
  let chamado;
  const falso = async (url, init) => {
    chamado = { url, init };
    return { ok: true, json: async () => ({ ligados: ["escola"], desligados: [] }) };
  };
  const v = await carregarVivos(falso);
  assert.equal(chamado.url, "https://exemplo.supabase.test/rest/v1/rpc/recursos_lidos");
  assert.equal(chamado.init.next.revalidate, 60);
  assert.deepEqual([...v.ligados], ["escola"]);
  const falha = await carregarVivos(async () => {
    throw new Error("rede");
  });
  assert.equal(falha.ligados.size, 0);
  definirVivos({ ligados: new Set(), desligados: new Set() });
});
ok("rota /api/recursos: cache de 60 s e só nomes", () => {
  assert.match(rotaRecursos, /s-maxage=60/);
  assert.ok(!/rpcNoBanco|service_role/.test(rotaRecursos));
});

// ───────── 2 e 3. Segunda pessoa, zerar 2FA e aparelhos
ok("funções de confirmação existem", () => ["confirmacoes_listar", "confirmacao_decidir", "confirmacao_cancelar", "zerar_2fa_pedir", "zerar_aparelhos_pedir", "zerar_pessoas"].forEach((f) => assert.ok(nomes.includes(f), f)));
ok("quem pediu não confirma o próprio pedido", () => {
  const corpo = sql.slice(sql.indexOf("function public.confirmacao_decidir"), sql.indexOf("function public.confirmacao_cancelar"));
  assert.match(corpo, /if c\.pedido_por = v then perform interno\.erro\('segunda_pessoa'\)/);
  assert.match(corpo, /expira_em < now\(\)/);
});
ok("zerar 2FA apaga fatores e sessões; aparelhos só a lista de acessos", () => {
  const corpo = sql.slice(sql.indexOf("function interno.executar_confirmacao"), sql.indexOf("/** Abre um pedido"));
  assert.match(corpo, /delete from auth\.mfa_factors where user_id/);
  assert.match(corpo, /delete from auth\.sessions where user_id/);
  assert.match(corpo, /delete from aparelhos where usuario = v_alvo/);
  assert.ok(!/chat_aparelhos/.test(corpo), "não toca nas chaves das conversas cifradas");
  assert.match(corpo, /interno\.avisar\(v_alvo/);
});
ok("zerar a conta de coordenação só pela liderança e com motivo", () => {
  const corpo = sql.slice(sql.indexOf("function interno.pedir_zerar"), sql.indexOf("create or replace function public.zerar_2fa_pedir"));
  assert.match(corpo, /papel in \('coordenacao', 'vice'\)\) and not interno\.lider\(\)/);
  assert.match(corpo, /'motivo', 10, 500/);
});
ok("segunda avaliação externa: privacidade e segunda pessoa", () => {
  const corpo = sql.slice(sql.indexOf("function public.avaliacao_externa_pedir"), sql.indexOf("-- ───────────────────────── 5."));
  assert.match(corpo, /p_privacidade_ok is distinct from true then perform interno\.erro/);
  assert.match(corpo, /pedir_confirmacao\('avaliacao_externa'/);
  assert.match(sql, /art\. 33/);
});

// ───────── 5 a 8. Limites, constantes, destaques, trilhas
ok("limites ajustáveis: limite() lê limites_config e os valores têm teto", () => {
  assert.match(sql, /create or replace function interno\.limite\(p_acao text, p_maximo integer, p_minutos integer\)/);
  assert.match(sql, /select maximo, minutos into v_max, v_min from limites_config where acao = p_acao/);
  assert.match(sql, /maximo integer not null check \(maximo between 1 and 5000\)/);
  ["limites_listar", "limite_ajustar", "limite_restaurar"].forEach((f) => assert.ok(nomes.includes(f), f));
});
ok("constantes do site: só chaves do modelo, formato conferido", () => {
  assert.match(sql, /site_constantes_modelo\(\) \? coalesce\(p_chave, ''\)/);
  assert.match(sql, /interno\.valida_constante\(p_chave, t\)/);
  ["site_constantes_ler", "site_constantes_listar", "site_constante_gravar"].forEach((f) => assert.ok(nomes.includes(f), f));
});
ok("destaques e aula da semana: 6 posições, caminho do próprio site, semana igual a lib/lambe-do-dia.ts", () => {
  assert.match(sql, /posicao smallint primary key check \(posicao between 1 and 6\)/);
  assert.match(sql, /caminho text not null check \(caminho ~ '\^\/\[a-z0-9\/_-\]\{1,160\}\$'\)/);
  assert.match(sql, /\+ 3\) \/ 7\)/, "semana = (dia + 3) / 7");
  assert.match(ler("lib", "lambe-do-dia.ts"), /Math\.floor\(\(diaDe\(data\) \+ 3\) \/ 7\)/);
  ["destaques_ler", "destaques_listar", "destaque_salvar", "destaque_remover", "aula_semana_definir", "aula_semana_limpar"].forEach((f) => assert.ok(nomes.includes(f), f));
});
ok("apresentação da trilha: 6 idiomas e texto de 10 a 1200", () => {
  assert.match(sql, /idioma in \('pt', 'en', 'es', 'fr', 'ru', 'zh'\)/);
  assert.match(sql, /char_length\(texto\) between 10 and 1200/);
  ["trilha_apresentacao_ler", "trilhas_apresentacao_listar", "trilha_apresentacao_salvar"].forEach((f) => assert.ok(nomes.includes(f), f));
});

// ───────── 9 e 10. PR de conteúdo e correções
ok("caminhoValido", () => {
  assert.ok(caminhoValido("content/paginas/conduta.md"));
  assert.ok(caminhoValido("content/trilhas/a-cidade-que-o-povo-fez/_trilha.md"));
  assert.ok(caminhoValido("content/paginas/creditos.en.md"));
  for (const ruim of ["content/paginas/../../package.json", "content/saude/x.md", "content/vale-o-escrito/x.md", "content/eixos.json", "content/paginas/x.json", "content//paginas/x.md", "app/x.md", "content/paginas/X.md", "content/paginas/./x.md", "content/paginas/.x.md", "content/paginas", "", null, 3, "content/paginas/" + "a".repeat(200) + ".md"])
    assert.equal(caminhoValido(ruim), false, String(ruim));
});
ok("substituirTrecho só troca quando o trecho é único", () => {
  assert.deepEqual(substituirTrecho("a b c", "b", "X"), { ok: true, texto: "a X c" });
  assert.deepEqual(substituirTrecho("a b b", "b", "X"), { ok: false, erro: "trecho_repetido" });
  assert.deepEqual(substituirTrecho("a c", "b", "X"), { ok: false, erro: "trecho_ausente" });
  assert.deepEqual(substituirTrecho("a", "", "X"), { ok: false, erro: "trecho_vazio" });
  assert.equal(substituirTrecho("a $& b", "$&", "$1").texto, "a $1 b", "sem padrões especiais de replace");
});
ok("manterFimDeLinha", () => {
  assert.equal(manterFimDeLinha("a\r\nb", "a\nc"), "a\r\nc");
  assert.equal(manterFimDeLinha("a\nb", "a\r\nc"), "a\nc");
});
ok("nomeDoBranch", () => {
  const b = nomeDoBranch("content/trilhas/A-b/c_d.md".toLowerCase(), new Date("2026-11-05T10:20:30Z"), "ab12");
  assert.equal(b, "painel/trilhas-a-b-c-d-20261105102030-ab12");
  assert.match(nomeDoBranch("content/paginas/conduta.md"), /^painel\/[a-z0-9-]+-\d{14}-[a-z0-9]{1,6}$/);
});
ok("textoDoPR não leva nome de pessoa e diz que nada foi publicado", () => {
  const e = textoDoPR("edicao", "content/paginas/conduta.md", "corrige\nacento");
  const c = textoDoPR("correcao", "content/paginas/conduta.md", "");
  assert.match(e.titulo, /^Edição pelo painel: paginas\/conduta\.md$/);
  assert.match(c.titulo, /^Correção aprovada/);
  assert.match(e.corpo, /Nada foi publicado/);
  assert.ok(!e.corpo.includes("\ncorrige"), "quebra de linha do resumo some");
  assert.ok(!/@|nome:|por:/i.test(e.corpo));
});
await ok("abrirPR: ref, branch, arquivo, PR; nunca merge", async () => {
  const chamadas = [];
  const falso = async (url, init = {}) => {
    chamadas.push({ url: String(url), metodo: init.method ?? "GET", corpo: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    if (/\/git\/ref\/heads\/master$/.test(url)) return { ok: true, json: async () => ({ object: { sha: "base123" } }) };
    if (/\/git\/refs$/.test(url)) return { ok: true, json: async () => ({}) };
    if (/\/contents\//.test(url) && init.method === "PUT") return { ok: true, json: async () => ({}) };
    if (/\/pulls$/.test(url)) return { ok: true, json: async () => ({ number: 77, html_url: "https://github.com/o/r/pull/77" }) };
    throw new Error("chamada inesperada " + url);
  };
  const c = { token: "segredo", repo: "o/r", base: "master" };
  const r = await abrirPR(c, { caminho: "content/paginas/conduta.md", novoTexto: "novo texto", shaAtual: "abc", tipo: "edicao", resumo: "teste" }, falso, new Date("2026-11-05T10:00:00Z"));
  assert.equal(r.numero, 77);
  assert.deepEqual(chamadas.map((x) => x.metodo), ["GET", "POST", "PUT", "POST"]);
  assert.ok(chamadas.every((x) => x.auth === "Bearer segredo"));
  assert.equal(chamadas[1].corpo.sha, "base123");
  assert.match(chamadas[1].corpo.ref, /^refs\/heads\/painel\//);
  assert.equal(chamadas[2].corpo.sha, "abc");
  assert.equal(Buffer.from(chamadas[2].corpo.content, "base64").toString("utf8"), "novo texto");
  assert.equal(chamadas[2].corpo.branch, r.branch);
  assert.equal(chamadas[3].corpo.base, "master");
  assert.ok(!chamadas.some((x) => /merge/.test(x.url)), "nunca junta");
  await assert.rejects(() => abrirPR(c, { caminho: "content/saude/x.md", novoTexto: "x", shaAtual: "a", tipo: "edicao", resumo: "" }, falso), ErroGitHub);
  await assert.rejects(() => abrirPR(c, { caminho: "content/paginas/x.md", novoTexto: "x".repeat(200_001), shaAtual: "a", tipo: "edicao", resumo: "" }, falso), ErroGitHub);
  const quebrado = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(() => abrirPR(c, { caminho: "content/paginas/x.md", novoTexto: "x", shaAtual: "a", tipo: "edicao", resumo: "" }, quebrado), /base:403/);
});
await ok("lerArquivo decodifica base64 em UTF-8", async () => {
  const texto = "olá, mundo — ção\n";
  const falso = async () => ({ ok: true, json: async () => ({ content: Buffer.from(texto).toString("base64"), sha: "s1", encoding: "base64" }) });
  assert.deepEqual(await lerArquivo({ token: "t", repo: "o/r", base: "master" }, "content/paginas/x.md", falso), { texto, sha: "s1" });
});
ok("configDoServidor: sem token, nada liga", () => {
  assert.equal(configDoServidor({}), null);
  assert.deepEqual(configDoServidor({ GITHUB_CONTEUDO_TOKEN: "t" }), { token: "t", repo: "jojoeumermo/perenidade", base: "master" });
  assert.equal(configDoServidor({ GITHUB_CONTEUDO_TOKEN: "t", GITHUB_PUBLICAR_REPO: "a/b", GITHUB_CONTEUDO_BASE: "main" }).repo, "a/b");
});
ok("o token do GitHub fica só no servidor", () => {
  assert.ok(!tela.includes("GITHUB_") && !tela.includes("process.env"));
  assert.ok(!/NEXT_PUBLIC_GITHUB/.test(prLib + rotaConteudo + rotaCorrecoes));
  assert.match(rotaConteudo, /rpcNoBanco<boolean>\("conteudo_pode_editar"/);
  assert.match(rotaCorrecoes, /rpcNoBanco<[^>]*>\("correcao_para_aplicar"/);
  assert.ok(!/\/merge/.test(prLib + rotaConteudo + rotaCorrecoes), "nada chama a API de merge");
});
ok("correção: quem propõe não aprova, e só aprovada vai ao PR", () => {
  const dec = sql.slice(sql.indexOf("function public.correcao_decidir"), sql.indexOf("function public.correcao_para_aplicar"));
  assert.match(dec, /if c\.proposta_por = v then perform interno\.erro\('segunda_pessoa'\)/);
  const aplicar = sql.slice(sql.indexOf("function public.correcao_para_aplicar"), sql.indexOf("function public.correcao_aplicada"));
  assert.match(aplicar, /if c\.status <> 'aprovada' then perform interno\.erro\('nao_aprovada'\)/);
  ["correcao_propor", "correcoes_listar", "correcao_decidir", "correcao_para_aplicar", "correcao_aplicada", "conteudo_pode_editar", "conteudo_pr_registrar", "conteudo_prs_listar"].forEach((f) => assert.ok(nomes.includes(f), f));
  assert.match(rotaCorrecoes, /substituirTrecho/);
  assert.match(tela, /Aprovada, a correção segue sozinha para o PR|aplicar\(x\.id\)/);
});

// ───────── SQL: esquema e permissões
ok("nenhuma tabela no esquema public", () => {
  assert.ok(!/create table[^;]*\bpublic\./i.test(sql));
  const tabelas = [...sql.matchAll(/create table if not exists interno\.([a-z_]+)/g)].map((m) => m[1]);
  assert.ok(tabelas.length >= 10);
  for (const t of tabelas) assert.ok(sql.includes(`'${t}'`), `RLS e revoke de ${t}`);
});
ok("toda função public.* é security definer com search_path fixo", () => {
  assert.ok(publicas.length >= 30, `achei ${publicas.length}`);
  for (const f of publicas) {
    const ini = sql.indexOf(`function public.${f.nome}(`);
    const cab = sql.slice(ini, ini + 700);
    assert.match(cab, /security definer set search_path = interno, pg_temp/, f.nome);
  }
});
ok("toda função public.* tem revoke de public e grant só no bloco de permissões", () => {
  const blocos = sql.slice(sql.indexOf("-- ───────────────────────── Permissões das funções public.*"));
  for (const f of publicas) {
    const assinatura = `${f.nome}(${f.args.split(",").map((a) => a.trim().replace(/^p_[a-z0-9_]+\s+/, "").replace(/\s+default\s+.*$/, "")).filter(Boolean).join(", ")})`;
    assert.ok(blocos.includes(`'${assinatura}'`), `sem permissão: ${assinatura}`);
  }
  assert.match(blocos, /revoke all on function public\.%s from public/);
  assert.match(blocos, /revoke all on function public\.%s from anon/);
});
ok("só as 4 leituras públicas vão para anon", () => {
  const publicosAnon = blocosAnon();
  assert.deepEqual(publicosAnon.sort(), ["destaques_ler", "recursos_lidos", "site_constantes_ler", "trilha_apresentacao_ler"]);
  function blocosAnon() {
    const m = sql.match(/foreach f in array array\[('recursos_lidos[^\]]*)\] loop/);
    return [...m[1].matchAll(/'([a-z_]+)\(/g)].map((x) => x[1]);
  }
});
ok("funções internas não ficam executáveis por anon/authenticated", () => {
  assert.ok(internas.length >= 7);
  const bloco = sql.slice(sql.indexOf("foreach f in array array['site_constantes_modelo()'"), sql.indexOf("-- ───────────────────────── 1."));
  assert.match(bloco, /revoke all on function interno\.%s from public/);
  assert.match(bloco, /from anon, authenticated/);
  for (const nome of ["site_constantes_modelo", "valida_constante", "executar_confirmacao", "pedir_confirmacao", "edita_conteudo"]) assert.ok(bloco.includes(`'${nome}(`), nome);
  assert.match(sql, /revoke all on function interno\.pedir_zerar\(text, uuid, text\) from public/);
});
ok("SQL é acrescentável e não toca em install.sql", () => {
  assert.ok(!/drop table|truncate|drop schema/i.test(sql));
  assert.ok(!/^\s*delete from (perfis|papeis|auditoria|configuracoes)\b/im.test(sql));
  assert.ok(!/create table (?!if not exists)/.test(sql), "create table sem if not exists");
  assert.ok(!/create function/.test(sql), "só create or replace");
});
ok("a auditoria registra cada mudança", () => {
  for (const acao of ["recurso_ligado", "recurso_desligado", "confirmacao_pedida", "confirmacao_decidida", "segundo_fator_zerado", "aparelhos_zerados", "limite_ajustado", "site_constante", "destaque_salvo", "aula_semana_definida", "trilha_apresentacao", "conteudo_pr_aberto", "correcao_proposta", "correcao_decidida", "correcao_aplicada"])
    assert.ok(sql.includes(`'${acao}'`), acao);
});

// ───────── Telas
ok("seções registradas no painel e no mapa", () => {
  for (const id of ["controles-avancados", "confirmacoes"]) {
    assert.match(painel, new RegExp(`\\{ id: "${id}", nome: [^\\n]*grupo: "[^"]*", mostra:`));
    assert.ok(new RegExp(`"?${id}"?: \\{ espaco:`).test(estrutura), id);
  }
  assert.match(painel, /<ControlesAvancados /);
  assert.match(painel, /<Confirmacoes \/>/);
  assert.match(estrutura, /confirmacoes: \{ espaco: "seguranca"/);
});
ok("toda função do SQL com tela é chamada pela tela (ou pela rota)", () => {
  const usadas = [...tela.matchAll(/(?:agir\(|useLista(?:<[^>]*(?:<[^>]*>[^>]*)*>)?\()"([a-z0-9_]+)"/g)].map((m) => m[1]);
  const doServidor = ["conteudo_pode_editar", "conteudo_pr_registrar", "correcao_para_aplicar", "correcao_aplicada", "recursos_lidos", "site_constantes_ler", "destaques_ler", "trilha_apresentacao_ler"];
  for (const f of nomes) assert.ok(usadas.includes(f) || doServidor.includes(f), `função sem tela: ${f}`);
});
ok("a tela usa os componentes únicos, sem window.confirm/prompt nem cor à mão", () => {
  assert.ok(!/window\.(confirm|prompt)|\bconfirm\(|\bprompt\(/.test(tela.replace(/confirmar\(|perguntarTexto\(/g, "")));
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(tela));
  assert.match(tela, /from "\.\/ui"/);
});
ok("sem a palavra proibida em nada do pacote", () => {
  const todos = [sql, tela, prLib, rotaConteudo, rotaCorrecoes, ler("lib", "recursos-vivos.ts"), ler("docs", "backend-1.md")].join("\n").toLowerCase();
  assert.ok(!todos.includes("universidade") && !todos.includes("diploma"));
});
ok("a documentação cita a lei e lista os itens", () => {
  const doc = ler("docs", "backend-1.md");
  assert.match(doc, /Lei 13\.709\/2018/);
  assert.match(doc, /art\. 33/);
  for (const t of ["GITHUB_CONTEUDO_TOKEN", "recursos_lidos", "segunda pessoa", "limites", "constantes", "aula da semana", "apresentação", "PR"]) assert.ok(doc.toLowerCase().includes(t.toLowerCase()), t);
});

console.log(`testar-backend-1: ${n} conferências ok${process.exitCode ? ", COM FALHAS" : ""}`);
