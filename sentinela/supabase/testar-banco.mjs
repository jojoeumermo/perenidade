// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Prova as regras do banco do Sentinela em um Postgres de verdade dentro do Node (PGlite), sem tocar em serviço nenhum:
// quem pode o quê por papel, segundo fator obrigatório, convites, duas pessoas para bloquear, auditoria imutável.
// Uso: npm run testar:banco
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const pg = new PGlite();
await pg.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz not null default now());
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null default 'verified');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const sql = fs.readFileSync(path.join(raiz, "install.sql"), "utf8");
await pg.exec(sql);

let fila = Promise.resolve();
const exclusivo = (tarefa) => {
  const resultado = fila.then(tarefa, tarefa);
  fila = resultado.catch(() => {});
  return resultado;
};
const rpc = (quem, funcao, argumentos = {}) =>
  exclusivo(async () => {
    const nomes = Object.keys(argumentos);
    const claims = JSON.stringify({ role: quem.papel, ...(quem.sub ? { sub: quem.sub } : {}), ...(quem.aal ? { aal: quem.aal } : {}) });
    await pg.query("select set_config('request.jwt.claims', $1, false), set_config('request.headers', $2, false)", [claims, JSON.stringify({ "x-forwarded-for": quem.ip ?? "127.0.0.1" })]);
    await pg.exec(`set role ${quem.papel}`);
    try {
      const lista = nomes.map((nome, i) => `${nome} => $${i + 1}`).join(", ");
      const valores = nomes.map((nome) => (argumentos[nome] !== null && typeof argumentos[nome] === "object" && !Array.isArray(argumentos[nome]) ? JSON.stringify(argumentos[nome]) : argumentos[nome]));
      const resposta = await pg.query(`select public.${funcao}(${lista}) as r`, valores);
      return resposta.rows[0]?.r ?? null;
    } finally {
      await pg.exec("reset role");
    }
  });
const dono = (texto, valores = []) => exclusivo(async () => { await pg.query("select set_config('request.jwt.claims', '', false)"); return pg.query(texto, valores); });
const criarUsuario = async (email, convite) => (await dono("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify(convite ? { convite } : {})])).rows[0].id;

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 200)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 120)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

const anon = { papel: "anon" };
const servico = { papel: "service_role" };
const como = (sub, aal = "aal2") => ({ papel: "authenticated", sub, aal });
const semFator = (sub) => ({ papel: "authenticated", sub });

// ── Instalação e trancas ──
await espera("instalar duas vezes não quebra", () => pg.exec(sql));
await espera("tabelas ficam fora do alcance da API", () => dono("select count(*)::int as n from information_schema.role_table_grants where table_schema = 'vigia' and grantee in ('anon', 'authenticated', 'PUBLIC')"), (r) => r.rows[0].n === 0);
await recusa("anônimo não lê tabela interna", () => exclusivo(async () => { await pg.exec("set role anon"); try { return await pg.query("select * from vigia.perfis"); } finally { await pg.exec("reset role"); } }), "permission denied");
await recusa("logado não lê eventos direto", () => exclusivo(async () => { await pg.exec("set role authenticated"); try { return await pg.query("select * from vigia.eventos"); } finally { await pg.exec("reset role"); } }), "permission denied");
await recusa("anônimo não chama função de leitura", () => rpc(anon, "resumo"), "permission denied");
await recusa("logado não chama função do coletor", () => rpc(como("00000000-0000-0000-0000-000000000001"), "coleta_configuracao"), "permission denied");
await recusa("anônimo não cria alerta", () => rpc(anon, "alerta_criar", { p: { regra: "site_fora", titulo: "x" } }), "permission denied");

// ── Primeira conta e dono ──
const dona = await criarUsuario("dona@teste.local");
await espera("primeira conta nasce sem papel e inativa", () => rpc(semFator(dona), "eu"), (r) => r && r.ativo === false && r.papel === "leitor");
await recusa("conta inativa não abre nada", () => rpc(como(dona), "resumo"), "sem_permissao");
await espera("promover dono pelo SQL Editor", () => dono("select public.promover_dono('dona@teste.local') as r"), (r) => /Pronto/.test(r.rows[0].r));
await recusa("promover dono não funciona pela API", () => rpc(anon, "promover_dono", { p_email: "dona@teste.local" }), "permission denied");
await espera("dono promovido", () => rpc(semFator(dona), "eu"), (r) => r.papel === "dono" && r.ativo === true && r.segundo_fator_na_sessao === false);
await recusa("sem o segundo fator na sessão, nenhuma tela abre", () => rpc(semFator(dona), "resumo"), "confirme_segundo_fator");
await recusa("sem o segundo fator, nem a equipe", () => rpc(semFator(dona), "equipe_listar"), "confirme_segundo_fator");
await espera("com o segundo fator, a visão geral abre", () => rpc(como(dona), "resumo"), (r) => r && "alertas_abertos" in r);
await espera("dono dá nome a si", () => rpc(como(dona), "perfil_salvar", { p_nome: "Dona Lúcia" }), (r) => r.ok);

// ── Convites ──
await recusa("segunda conta sem convite é recusada", () => criarUsuario("intruso@teste.local"), "convite_obrigatorio");
await recusa("dono sem segundo fator não convida", () => rpc(semFator(dona), "convite_criar", { p_email: "ana@teste.local", p_papel: "analista" }), "confirme_segundo_fator");
const convite = await rpc(como(dona), "convite_criar", { p_email: "ana@teste.local", p_papel: "analista" });
await espera("convite criado com código", async () => convite, (r) => typeof r.codigo === "string" && r.codigo.length === 64);
await espera("convite vai para a fila de e-mail sem o código no assunto", () => dono("select assunto, texto from vigia.emails"), (r) => r.rows.length === 1 && !r.rows[0].assunto.includes(convite.codigo) && r.rows[0].texto.includes(convite.codigo));
await espera("anônimo confere o convite", () => rpc(anon, "convite_ver", { p_codigo: convite.codigo }), (r) => r.valido === true && r.email === "ana@teste.local" && r.papel === "analista");
await espera("código errado não vale", () => rpc(anon, "convite_ver", { p_codigo: "x".repeat(64) }), (r) => r.valido === false);
await recusa("convite não serve para outro e-mail", () => criarUsuario("outro@teste.local", convite.codigo), "convite_de_outro_email");
const ana = await criarUsuario("ana@teste.local", convite.codigo);
await espera("convidada entra ativa com o papel do convite", () => rpc(semFator(ana), "eu"), (r) => r.papel === "analista" && r.ativo === true);
await espera("o código some da conta", () => dono("select raw_user_meta_data from auth.users where id = $1", [ana]), (r) => !("convite" in r.rows[0].raw_user_meta_data));
await espera("convite usado não vale mais", () => rpc(anon, "convite_ver", { p_codigo: convite.codigo }), (r) => r.valido === false);
await recusa("convite usado não cria outra conta", () => criarUsuario("terceiro@teste.local", convite.codigo), "convite_invalido");
const c2 = await rpc(como(dona), "convite_criar", { p_email: "leo@teste.local", p_papel: "leitor" });
const leo = await criarUsuario("leo@teste.local", c2.codigo);
await recusa("leitor não convida", () => rpc(como(leo), "convite_criar", { p_email: "z@teste.local", p_papel: "leitor" }), "sem_permissao");
await recusa("analista não convida", () => rpc(como(ana), "convite_criar", { p_email: "z@teste.local", p_papel: "leitor" }), "sem_permissao");
await espera("dono lista convites", () => rpc(como(dona), "convites_listar"), (r) => r.length === 2 && r.every((c) => c.usado));
await recusa("convite para papel inexistente", () => rpc(como(dona), "convite_criar", { p_email: "z@teste.local", p_papel: "admin" }), "invalido:papel");

// ── Teto de cinco contas ──
const c3 = await rpc(como(dona), "convite_criar", { p_email: "q4@teste.local", p_papel: "leitor" });
const c4 = await rpc(como(dona), "convite_criar", { p_email: "q5@teste.local", p_papel: "leitor" });
await criarUsuario("q4@teste.local", c3.codigo);
await criarUsuario("q5@teste.local", c4.codigo);
await recusa("sexto convite não sai", () => rpc(como(dona), "convite_criar", { p_email: "q6@teste.local", p_papel: "leitor" }), "limite_contas");
const q5 = (await dono("select id from auth.users where email = 'q5@teste.local'")).rows[0].id;
await espera("dono desativa uma conta", () => rpc(como(dona), "conta_ativar", { p_usuario: q5, p_ativa: false }), (r) => r.ok);
await recusa("conta desativada não entra", () => rpc(como(q5), "resumo"), "sem_permissao");
await recusa("dono não desativa a si", () => rpc(como(dona), "conta_ativar", { p_usuario: dona, p_ativa: false }), "nao_a_si_mesmo");
await recusa("último dono não se rebaixa", () => rpc(como(dona), "papel_mudar", { p_usuario: dona, p_papel: "leitor" }), "ultimo_dono");
await espera("dono promove analista", () => rpc(como(dona), "papel_mudar", { p_usuario: ana, p_papel: "analista" }), (r) => r.ok);
await recusa("analista não muda papéis", () => rpc(como(ana), "papel_mudar", { p_usuario: leo, p_papel: "dono" }), "sem_permissao");
await espera("equipe visível a todos; e-mails só para o dono", async () => [await rpc(como(leo), "equipe_listar"), await rpc(como(dona), "equipe_listar")], ([deLeo, deDona]) => deLeo.find((p) => p.id === dona).email === "" && deDona.find((p) => p.id === ana).email === "ana@teste.local");

// ── Coletor ──
await espera("coletor lê a configuração", () => rpc(servico, "coleta_configuracao"), (r) => r.configuracoes.site && Array.isArray(r.regras));
await espera("coletor grava verificação", () => rpc(servico, "coleta_verificacao", { p: { alvo: "site", no_ar: true, status: 200, ms: 180, hash: "abc", cabecalhos: { "strict-transport-security": "max-age=63072000" }, nota: 92 } }), (r) => r.id > 0);
await espera("coletor grava métricas", () => rpc(servico, "coleta_metricas", { p: [{ em: new Date().toISOString(), requisicoes: 1200, bloqueios: 30 }] }), (r) => r.gravadas === 1);
const eventos = [
  { fonte: "waf", tipo: "bloqueio", gravidade: "media", ip: "203.0.113.9", pais: "BR", asn: "AS64500", asn_nome: "Exemplo", caminho: "/wp-admin", acao: "block", regra: "managed", impressao: "waf-1" },
  { fonte: "waf", tipo: "bloqueio", gravidade: "media", ip: "203.0.113.9", pais: "BR", caminho: "/.env", acao: "block", impressao: "waf-2" },
  { fonte: "auth", tipo: "login_falho", gravidade: "baixa", ip: "198.51.100.7", pais: "US", impressao: "auth-1" },
  { fonte: "invalida", tipo: "x", impressao: "x-1" },
];
await espera("coletor grava eventos e ignora fonte desconhecida", () => rpc(servico, "coleta_eventos", { p: eventos }), (r) => r.novos === 3);
await espera("o mesmo evento não entra duas vezes", () => rpc(servico, "coleta_eventos", { p: eventos }), (r) => r.novos === 0);
await espera("coletor grava DNS e detecta mudança", async () => {
  await rpc(servico, "coleta_dns", { p: [{ nome: "institutolucia.org", tipo: "A", valores: ["1.1.1.1"] }] });
  return rpc(servico, "coleta_dns", { p: [{ nome: "institutolucia.org", tipo: "A", valores: ["2.2.2.2"] }] });
}, (r) => r.mudancas.length === 1 && r.mudancas[0].de[0] === "1.1.1.1");
await espera("certificado novo é apontado uma vez", async () => [await rpc(servico, "coleta_certificados", { p: [{ crt_id: 1, emissor: "Let's Encrypt", nomes: ["institutolucia.org"] }] }), await rpc(servico, "coleta_certificados", { p: [{ crt_id: 1 }] })], ([a, b]) => a.novos.length === 1 && b.novos.length === 0);
await espera("terceiro novo é apontado uma vez", async () => [await rpc(servico, "coleta_terceiros", { p: [{ pagina: "/", tipo: "script", host: "evil.example" }] }), await rpc(servico, "coleta_terceiros", { p: [{ pagina: "/", tipo: "script", host: "evil.example" }] })], ([a, b]) => a.novos.length === 1 && b.novos.length === 0);
await espera("domínio parecido que passa a resolver é apontado", async () => {
  await rpc(servico, "coleta_dominios", { p: [{ dominio: "institutolucia.com", resolve: false }] });
  return rpc(servico, "coleta_dominios", { p: [{ dominio: "institutolucia.com", resolve: true }] });
}, (r) => r.passaram_a_resolver.length === 1);
await espera("deploys e alertas do GitHub", async () => [await rpc(servico, "coleta_deploys", { p: [{ id: "dpl_1", estado: "READY", ambiente: "production", ramo: "master" }] }), await rpc(servico, "coleta_github", { p: [{ id: "dependabot:1", tipo: "dependabot", gravidade: "high", titulo: "x" }] })], ([d, g]) => d.mudaram.length === 1 && g.novos.length === 1);
await espera("postura e CSP", async () => [await rpc(servico, "coleta_postura", { p: { nota: 88, componentes: [{ nome: "HSTS", pontos: 10 }] } }), await rpc(servico, "coleta_csp", { p: { impressao: "csp-1", diretiva: "script-src", bloqueado: "https://evil.example/x.js" } })], ([a, b]) => a.ok && b.gravadas === 1);
await espera("alerta criado com lista de quem avisar (só e-mail dos que optaram)", () => rpc(servico, "alerta_criar", { p: { regra: "site_fora", gravidade: "critica", titulo: "Site fora do ar", impressao: "site_fora" } }), (r) => r.id > 0 && Array.isArray(r.avisar) && r.avisar.length >= 1 && r.avisar.every((a) => a.email && !("detalhes" in a)));
await espera("alerta repetido em uma hora é ignorado", () => rpc(servico, "alerta_criar", { p: { regra: "site_fora", gravidade: "critica", titulo: "Site fora do ar", impressao: "site_fora" } }), (r) => r.ignorado === "repetido");
await espera("regra desligada não gera alerta", async () => {
  await rpc(como(dona), "regra_salvar", { p_id: "csp_violacoes", p_ligada: false });
  return rpc(servico, "alerta_criar", { p: { regra: "csp_violacoes", gravidade: "baixa", titulo: "x", impressao: "csp" } });
}, (r) => r.ignorado === "regra_desligada");
await recusa("leitor não mexe em regras", () => rpc(como(leo), "regra_salvar", { p_id: "site_fora", p_ligada: false }), "sem_permissao");

// ── Leitura por papel ──
await espera("leitor vê a visão geral, ameaças e integridade", async () => [await rpc(como(leo), "resumo"), await rpc(como(leo), "ameacas_resumo"), await rpc(como(leo), "integridade_ver"), await rpc(como(leo), "plataforma_ver")], ([r, a, i, p]) => r.site.no_ar === true && a.ips[0].ip === "203.0.113.9" && a.ips[0].total === 2 && i.dns.length === 1 && p.deploys.length === 1);
await espera("eventos com filtro", () => rpc(como(leo), "eventos_listar", { p: { fonte: "waf", busca: "wp-admin" } }), (r) => r.length === 1 && r[0].caminho === "/wp-admin");
await espera("quem olhou as ameaças fica na auditoria", () => dono("select count(*)::int as n from vigia.auditoria where acao = 'viu:ameacas' and quem = $1", [leo]), (r) => r.rows[0].n === 1);
await espera("tela vista entra na auditoria", async () => { await rpc(como(leo), "tela_vista", { p_tela: "eventos" }); return dono("select count(*)::int as n from vigia.auditoria where acao = 'viu:eventos'"); }, (r) => r.rows[0].n === 1);
await recusa("leitor não vê a auditoria", () => rpc(como(leo), "auditoria_listar"), "sem_permissao");
await espera("dono vê a auditoria", () => rpc(como(dona), "auditoria_listar"), (r) => r.length > 5 && r.some((a) => a.acao === "convite_criado"));
await recusa("leitor não marca alerta", () => rpc(como(leo), "alerta_marcar", { p_id: 1, p_estado: "visto" }), "sem_permissao");
await espera("analista marca alerta", () => rpc(como(ana), "alerta_marcar", { p_id: 1, p_estado: "silenciado", p_horas: 2 }), (r) => r.ok);
await espera("alerta silenciado não volta", () => rpc(servico, "alerta_criar", { p: { regra: "site_fora", gravidade: "critica", titulo: "Site fora do ar", impressao: "site_fora" } }), (r) => r.ignorado);

// ── Incidentes e ações em duas pessoas ──
await recusa("leitor não abre incidente", () => rpc(como(leo), "incidente_abrir", { p: { titulo: "Teste" } }), "sem_permissao");
const inc = await rpc(como(ana), "incidente_abrir", { p: { titulo: "Varredura de /wp-admin", gravidade: "alta", modelo: "credenciais", alerta: 1 } });
await espera("analista abre incidente e o alerta fica ligado", () => rpc(como(leo), "incidente_ver", { p_id: inc.id }), (r) => r.numero === 1 && r.alertas === 1 && r.notas.length === 1);
await espera("vincular eventos", () => rpc(como(ana), "incidente_vincular", { p_id: inc.id, p_eventos: [1, 2] }), (r) => r.ok);
await espera("nota e atribuição", async () => { await rpc(como(ana), "incidente_nota", { p_id: inc.id, p_texto: "Olhando." }); return rpc(como(ana), "incidente_atualizar", { p_id: inc.id, p: { estado: "investigando", atribuido_a: ana } }); }, (r) => r.estado === "investigando" && r.atribuido_nome === "");
await recusa("alvo inválido", () => rpc(como(ana), "acao_propor", { p: { tipo: "bloquear_ip", alvo: "não é ip", motivo: "teste de alvo" } }), "invalido:alvo");
await recusa("leitor não propõe bloqueio", () => rpc(como(leo), "acao_propor", { p: { tipo: "bloquear_ip", alvo: "203.0.113.9", motivo: "varredura" } }), "sem_permissao");
const acao = await rpc(como(ana), "acao_propor", { p: { incidente: inc.id, tipo: "bloquear_ip", alvo: "203.0.113.9", motivo: "varredura insistente", duracao_horas: 48 } });
await espera("ação proposta aguarda confirmação", async () => acao, (r) => r.estado === "proposta");
await espera("o coletor ainda não vê nada para executar", () => rpc(servico, "acoes_pendentes"), (r) => r.executar.length === 0);
await recusa("quem propôs não confirma", () => rpc(como(ana), "acao_confirmar", { p_id: acao.id, p_confirmar: true }), "outra_pessoa_confirma");
await recusa("leitor não confirma", () => rpc(como(leo), "acao_confirmar", { p_id: acao.id, p_confirmar: true }), "sem_permissao");
await espera("dono confirma", () => rpc(como(dona), "acao_confirmar", { p_id: acao.id, p_confirmar: true }), (r) => r.estado === "confirmada" && r.confirmada_nome === "Dona Lúcia");
await recusa("não se confirma duas vezes", () => rpc(como(dona), "acao_confirmar", { p_id: acao.id, p_confirmar: true }), "ja_decidida");
await espera("agora o coletor vê a ação", () => rpc(servico, "acoes_pendentes"), (r) => r.executar.length === 1 && r.executar[0].alvo === "203.0.113.9");
await espera("coletor registra a execução", () => rpc(servico, "acao_resultado", { p_id: acao.id, p_estado: "executada", p_resultado: { id: "cf-1" }, p_referencia: "cf-1" }), (r) => r.ok);
await espera("tudo ficou no incidente e na auditoria", async () => [await rpc(como(leo), "incidente_ver", { p_id: inc.id }), await dono("select count(*)::int as n from vigia.auditoria where acao in ('acao_proposta', 'acao_confirmada', 'acao_executada')")], ([i, a]) => i.acoes_lista[0].estado === "executada" && i.notas.length >= 5 && a.rows[0].n === 3);
await espera("desbloqueio referencia a ação executada", () => rpc(como(ana), "acao_propor", { p: { tipo: "desbloquear", alvo: acao.id, motivo: "falso positivo" } }), (r) => r.estado === "proposta");
await espera("resolver o incidente resolve os alertas ligados", async () => { await rpc(como(dona), "incidente_atualizar", { p_id: inc.id, p: { estado: "resolvido" } }); return dono("select estado from vigia.alertas where id = 1"); }, (r) => r.rows[0].estado === "resolvido");

// ── Configuração, relatório, auditoria imutável, limpeza ──
await recusa("segredo não cabe na configuração", () => rpc(como(dona), "configuracoes_salvar", { p_chave: "plataformas", p: { cloudflare_token: "abc" } }), "segredo_nao_cabe_aqui");
await espera("dono salva configuração", () => rpc(como(dona), "configuracoes_salvar", { p_chave: "plataformas", p: { cloudflare_zona: "zona1", github_repositorio: "x/y" } }), (r) => r.cloudflare_zona === "zona1");
await recusa("analista não salva configuração", () => rpc(como(ana), "configuracoes_salvar", { p_chave: "site", p: { url: "https://x" } }), "sem_permissao");
await espera("relatório exportável", () => rpc(como(leo), "relatorio", { p_desde: new Date(Date.now() - 86400000).toISOString(), p_ate: new Date().toISOString() }), (r) => r.periodo && r.trafego.requisicoes === 1200 && r.incidentes.length === 1);
await espera("exportar fica na auditoria", () => dono("select count(*)::int as n from vigia.auditoria where acao = 'exportou:relatorio'"), (r) => r.rows[0].n === 1);
await recusa("ninguém apaga a auditoria, nem o dono do banco", () => dono("delete from vigia.auditoria"), "auditoria_imutavel");
await recusa("ninguém edita a auditoria", () => dono("update vigia.auditoria set acao = 'x'"), "auditoria_imutavel");
await espera("avisos por pessoa", () => rpc(como(leo), "avisos_configurar", { p: { email: false, desktop: true, minimo: "alta" } }), (r) => r.email === false && r.minimo === "alta");
await espera("quem desligou o e-mail não é avisado", () => rpc(servico, "alerta_criar", { p: { regra: "dns_mudou", gravidade: "critica", titulo: "DNS mudou", impressao: "dns" } }), (r) => !r.avisar.some((a) => a.email === "leo@teste.local"));
await espera("fila de e-mails: pegar e confirmar", async () => { const fila = await rpc(servico, "emails_pendentes"); await rpc(servico, "email_resultado", { p_id: fila[0].id, p_ok: true }); return dono("select status, texto from vigia.emails where id = $1", [fila[0].id]); }, (r) => r.rows[0].status === "enviado" && r.rows[0].texto === "");
await espera("limpeza roda", () => rpc(servico, "coleta_limpeza"), (r) => r.ok);
await espera("reinstalar não apaga nada", async () => { await pg.exec(sql); return dono("select (select count(*) from vigia.eventos)::int as e, (select count(*) from vigia.perfis)::int as p"); }, (r) => r.rows[0].e === 3 && r.rows[0].p === 5);

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
