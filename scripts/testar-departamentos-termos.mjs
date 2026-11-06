// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a etapa 8 (B10 e B15): supabase/migracoes/2026-11-departamentos-termos.sql num Postgres de verdade dentro do Node.
//   - "Design" e "Desenvolvimento" viram um departamento só; a arte vai para a Comunicação e ninguém perde acesso;
//   - o que ainda chegar como 'design' é mapeado; rodar a migração duas vezes não muda nada;
//   - termo de voluntário: quem tem o texto guardado continua; quem aceitou sem o texto volta a ver o termo;
//   - ninguém fica sem texto (o aceite exige o texto guardado).
// Uso: npm run testar:departamentos-termos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arquivoSql = path.join(raiz, "supabase/migracoes/2026-11-departamentos-termos.sql");
const sql = fs.readFileSync(arquivoSql, "utf8");

const banco = await criarBanco();
const { rpc, dono, criarUsuario } = banco;
let certos = 0;
const falhas = [];

async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
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
const confere = (nome, condicao) => (condicao ? certos++ : falhas.push(nome));

const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.50" });
const linhas = async (texto, valores = []) => (await dono(texto, valores)).rows;
const aplicar = () => banco.exclusivo(() => banco.pg.exec(sql));

// ── Contas, antes da migração ──
const ids = {};
for (const chave of ["coord", "arte", "arteEMarketing", "representante", "uiux", "antigo", "antigoSemVersao", "aceitou", "novo", "adesaoAntiga"]) {
  ids[chave] = await criarUsuario(`${chave}@teste.local`, `Pessoa ${chave}`);
  await rpc(como(ids[chave]), "eu");
  await dono("update interno.perfis set nome = $2 where id = $1", [ids[chave], `Pessoa ${chave}`]);
}
// O install.sql já traz esta migração no fim (e com ela o gatilho que vira "design" em "marketing"). Para reproduzir o banco de antes,
// com dados antigos, desligam-se os gatilhos até a migração rodar de novo (ela os recria, já ligados).
for (const tabela of ["papeis", "candidaturas", "inscricoes", "convites", "equipe_mensagens", "avisos_gerais"]) await dono(`alter table interno.${tabela} disable trigger lucia_unificar_design`);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao')", [ids.coord]);
await dono("insert into interno.papeis (usuario, papel, criado_em) values ($1, 'design', '2026-01-15T10:00:00Z')", [ids.arte]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'design'), ($1, 'marketing')", [ids.arteEMarketing]);
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'representante', 'design')", [ids.representante]);
await dono("insert into interno.papeis (usuario, papel) values ($1, 'desenvolvimento')", [ids.uiux]);
for (const chave of ["antigo", "antigoSemVersao", "aceitou", "novo", "adesaoAntiga"]) {
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'educacao')", [ids[chave]]);
}

// Dados que mencionam 'design' e precisam seguir para a Comunicação. A página do Design já foi apagada pela migração do install.sql: volta, como era.
await dono("insert into interno.departamentos_info (id) values ('design') on conflict do nothing");
await dono("insert into interno.departamento_quadro (departamento, titulo) values ('design', 'Cartaz do mutirão'), ('desenvolvimento', 'Tela de login')");
await dono("insert into interno.departamento_pedidos (de, para, titulo) values ('educacao', 'design', 'Capa da trilha'), ('design', 'jornalismo', 'Texto para o cartaz')");
await dono("insert into interno.departamento_bastoes (departamento, texto) values ('design', 'Os modelos da marca ficam no Estúdio de design.')");
await dono("update interno.departamentos_info set descricao = 'Texto editado pela coordenação do Design.' where id = 'design'");
await dono("insert into interno.equipe_mensagens (canal, para, corpo) values ('pedidos', 'design', 'c2.1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAA'), ('design', null, 'c2.1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBB')");
await dono("insert into interno.convites (selo, papel, expira_em) values (repeat('a', 64), 'design', now() + interval '3 days')");
await dono("insert into interno.inscricoes (nome, email, papel, mensagem) values ('Dani Desenhista', 'dani@teste.local', 'design', 'Quero ajudar com cartazes e capas, tenho prática com ilustração digital.')");
await dono("insert into interno.avisos_gerais (titulo, texto, para) values ('Reunião da arte', 'Quinta, às 19h.', array['design', 'educacao', 'design'])");

// Termos antes da migração: "antigo" aceitou só com a data no perfil (com a versão vigente), "antigoSemVersao" nem tem a versão.
const termoTexto = "Termo de voluntário do Instituto Lúcia (versão 2026-10-20)\n\n1. Sou voluntário, de graça.\n\nDeclaro ter 18 anos ou mais.";
const vigente = (await linhas("select interno.termo_voluntario_vigente() as v"))[0].v;
await dono("update interno.perfis set termo_voluntario_em = now() - interval '30 days', termo_voluntario_versao = $2 where id = $1", [ids.antigo, vigente]);
await dono("update interno.perfis set termo_voluntario_em = now() - interval '90 days', termo_voluntario_versao = null where id = $1", [ids.antigoSemVersao]);
await rpc(como(ids.aceitou), "termo_registrar", { p_termo: "voluntario", p_versao: vigente, p_texto: termoTexto, p_dados: { maior_de_idade: true } });
await rpc(como(ids.aceitou), "termo_voluntario_aceitar");
await dono("insert into interno.termos_adesao (usuario, nome_completo, versao) values ($1, 'Pessoa Adesao Antiga', '2026-10-20')", [ids.adesaoAntiga]);

// Antes da migração, quem aceitou sem texto não vê o termo (é o defeito que a etapa corrige).
await espera("antes: o aceite sem texto passava direto", () => rpc(como(ids.antigo), "eu"), (e) => e.termo_voluntario === true);

// ── A migração ──
await espera("a migração roda", aplicar);
const papeisDe = async (id) => (await linhas("select papel, disciplina, criado_em from interno.papeis where usuario = $1 order by papel", [id]));
const contagem = async () => (await linhas(`select
  (select count(*)::int from interno.papeis) as papeis, (select count(*)::int from interno.papeis_historico) as historico,
  (select count(*)::int from interno.avisos) as avisos, (select count(*)::int from interno.departamento_quadro) as quadro,
  (select count(*)::int from interno.departamento_pedidos) as pedidos, (select count(*)::int from interno.departamento_bastoes) as bastoes,
  (select count(*)::int from interno.departamentos_info) as departamentos, (select count(*)::int from interno.conversa_membros) as membros`))[0];

// ── B10: papéis ──
{
  const a = await papeisDe(ids.arte);
  confere("quem era design passa a ser marketing, sem a função antiga", a.length === 1 && a[0].papel === "marketing");
  confere("a data de entrada na função é mantida", new Date(a[0].criado_em).toISOString().startsWith("2026-01-15"));
  const ab = await papeisDe(ids.arteEMarketing);
  confere("quem tinha design e marketing fica com um marketing só", ab.length === 1 && ab[0].papel === "marketing");
  const r = await papeisDe(ids.representante);
  confere("representante do Design passa a representar a Comunicação", r.length === 1 && r[0].papel === "representante" && r[0].disciplina === "jornalismo");
  const u = await papeisDe(ids.uiux);
  confere("quem era do desenvolvimento segue igual", u.length === 1 && u[0].papel === "desenvolvimento");
  confere("nenhuma linha 'design' sobrou", (await linhas("select count(*)::int as n from interno.papeis where papel = 'design' or disciplina = 'design'"))[0].n === 0);
  const h = await linhas("select papel, via, removido_em from interno.papeis_historico where usuario = $1", [ids.arte]);
  confere("o histórico de cargos fecha o design e abre o marketing, este como feito pelo sistema", h.length === 2 && h.some((x) => x.papel === "design" && x.removido_em) && h.some((x) => x.papel === "marketing" && x.via === "sistema" && !x.removido_em));
}
await espera("quem fazia arte continua com acesso ao Estúdio de design", () => rpc(como(ids.arte), "eu"), (e) => e.desenha === true);
await espera("quem fazia arte continua vendo o canal de arte do mural", () => rpc(como(ids.arte), "equipe_canais"), (c) => c.canais.includes("design") && c.canais.includes("marketing"));
await espera("o aviso de mudança chegou uma vez", async () => (await linhas("select texto from interno.avisos where para = $1", [ids.arte])), (a) => a.length === 1 && /Comunica/.test(a[0].texto) && a[0].texto.length <= 500);
await espera("quem era do desenvolvimento não ganha aviso nem perde o acesso técnico", async () => (await linhas("select count(*)::int as n from interno.avisos where para = $1", [ids.uiux])), (a) => a[0].n === 0);
await espera("o desenvolvimento ainda vê o diagnóstico técnico", () => rpc(como(ids.uiux), "diagnostico"), (d) => d && typeof d === "object");
await recusa("arte não vê o estado técnico (não ganhou acesso novo)", () => rpc(como(ids.arte), "diagnostico"), "sem_permissao");

// ── B10: dados e apelido ──
await espera("candidaturas, convites, inscrições e avisos usam a Comunicação", async () => (await linhas(`select
  (select papel from interno.convites where selo = repeat('a', 64)) as convite, (select papel from interno.inscricoes where email = 'dani@teste.local') as inscricao,
  (select para from interno.avisos_gerais where titulo = 'Reunião da arte') as aviso,
  (select para from interno.equipe_mensagens where canal = 'pedidos' limit 1) as pedido`))[0],
  (r) => r.convite === "marketing" && r.inscricao === "marketing" && r.pedido === "marketing" && r.aviso.length === 2 && r.aviso.includes("marketing") && r.aviso.includes("educacao") && !r.aviso.includes("design"));
await espera("a mensagem cifrada do canal de arte fica intocada", async () => (await linhas("select canal, corpo from interno.equipe_mensagens where canal = 'design'")), (m) => m.length === 1 && m[0].corpo.endsWith("BBBBBBBBBBBBBBBBBBBBBBB"));
await espera("o departamento Design sumiu da lista e não perdeu nada", async () => (await linhas("select count(*)::int as n from interno.departamentos_info where id = 'design'")), (r) => r[0].n === 0);
await espera("quadro, pedidos e bastões do Design foram para a Comunicação", async () => (await linhas(`select
  (select count(*)::int from interno.departamento_quadro where departamento = 'jornalismo' and titulo = 'Cartaz do mutirão') as q,
  (select count(*)::int from interno.departamento_quadro where departamento = 'design') as q_velho,
  (select count(*)::int from interno.departamento_pedidos where para = 'jornalismo' and titulo = 'Capa da trilha') as p,
  (select count(*)::int from interno.departamento_pedidos where para = 'design' or de = 'design') as p_velho,
  (select count(*)::int from interno.departamento_bastoes where departamento = 'jornalismo') as b`))[0],
  (r) => r.q === 1 && r.q_velho === 0 && r.p === 1 && r.p_velho === 0 && r.b === 1);
await espera("o quadro do Desenvolvimento não mudou", async () => (await linhas("select count(*)::int as n from interno.departamento_quadro where departamento = 'desenvolvimento'")), (r) => r[0].n === 1);
await espera("a lista de departamentos não traz mais o Design", () => rpc(como(ids.coord), "departamentos_resumo"), (l) => !l.some((d) => d.id === "design") && l.some((d) => d.id === "desenvolvimento") && l.some((d) => d.id === "jornalismo"));
await espera("o texto do Desenvolvimento diz UI/UX e o da Comunicação cita a arte", async () => (await linhas("select id, descricao from interno.departamentos_info where id in ('desenvolvimento', 'jornalismo')")),
  (l) => /UI\/UX/.test(l.find((d) => d.id === "desenvolvimento").descricao) && /design gráfico/.test(l.find((d) => d.id === "jornalismo").descricao));
await espera("os nomes dos grupos de conversa foram ajustados", async () => (await linhas("select departamento, nome from interno.conversas where departamento in ('design', 'desenvolvimento')")),
  (l) => l.find((c) => c.departamento === "design").nome === "Arte e design (Comunicação)" && l.find((c) => c.departamento === "desenvolvimento").nome === "UI/UX e Desenvolvimento");
await espera("quem faz arte está no grupo de arte e no da Comunicação", async () => (await linhas(`select c.departamento from interno.conversa_membros m join interno.conversas c on c.id = m.conversa where m.usuario = $1 and c.tipo = 'departamento'`, [ids.arte])),
  (l) => l.some((c) => c.departamento === "design") && l.some((c) => c.departamento === "jornalismo") && l.some((c) => c.departamento === "marketing"));
await espera("os nomes das funções no banco", async () => (await linhas("select interno.nome_papel('design') as d, interno.nome_papel('desenvolvimento') as v, interno.nome_papel('marketing') as m"))[0],
  (n) => /arte/.test(n.d) && n.v === "UI/UX e desenvolvimento" && /arte e design gráfico/.test(n.m));

// O apelido: o que chegar depois como 'design' vira Comunicação.
await dono("insert into interno.papeis (usuario, papel) values ($1, 'design')", [ids.novo]);
await espera("conceder 'design' depois da migração concede a Comunicação", async () => (await papeisDe(ids.novo)).map((p) => p.papel).sort(), (l) => l.join() === "educacao,marketing");
await dono("insert into interno.convites (selo, papel, expira_em) values (repeat('b', 64), 'design', now() + interval '3 days')");
await dono("insert into interno.equipe_mensagens (canal, para, corpo) values ('pedidos', 'design', 'c2.1.AAAAAAAAAAAAAAAA.CCCCCCCCCCCCCCCCCCCCCCC')");
await dono("insert into interno.avisos_gerais (titulo, texto, para) values ('Outro aviso', 'Sexta.', array['design'])");
await espera("convite, pedido e aviso novos para 'design' também vão para a Comunicação", async () => (await linhas(`select
  (select papel from interno.convites where selo = repeat('b', 64)) as c, (select para from interno.equipe_mensagens where corpo like '%CCCCC%') as p,
  (select para from interno.avisos_gerais where titulo = 'Outro aviso') as a`))[0], (r) => r.c === "marketing" && r.p === "marketing" && r.a.join() === "marketing");
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'representante', 'design')", [ids.novo]);
await espera("representante do 'design' novo vira representante da Comunicação", async () => (await papeisDe(ids.novo)).filter((p) => p.papel === "representante"), (l) => l.length === 1 && l[0].disciplina === "jornalismo");

// ── B15: termos ──
await espera("quem aceitou com o texto guardado continua sem ver o termo", () => rpc(como(ids.aceitou), "eu"), (e) => e.termo_voluntario === true);
await espera("quem aceitou sem o texto volta a ver o termo", () => rpc(como(ids.antigo), "eu"), (e) => e.termo_voluntario === false);
await espera("quem aceitou sem versão nenhuma também vê o termo (antes não via)", () => rpc(como(ids.antigoSemVersao), "eu"), (e) => e.termo_voluntario === false);
await espera("quem nunca aceitou vê o termo", () => rpc(como(ids.novo), "eu"), (e) => e.termo_voluntario === false);
await recusa("confirmar sem ter o texto guardado é recusado", () => rpc(como(ids.antigo), "termo_voluntario_aceitar"), "falta_termo");
await recusa("o novo também não confirma sem texto", () => rpc(como(ids.novo), "termo_voluntario_aceitar"), "falta_termo");
await espera("o aceite antigo aparece para a coordenação como 'antigo', sem texto", () => rpc(como(ids.coord), "termos_aceites_listar"),
  (l) => l.some((a) => a.nome === "Pessoa antigo" && a.antigo === true && a.sha256 === "") && l.some((a) => a.nome === "Pessoa aceitou" && a.antigo === false && /^[a-f0-9]{64}$/.test(a.sha256)));
await rpc(como(ids.antigo), "termo_registrar", { p_termo: "voluntario", p_versao: vigente, p_texto: termoTexto, p_dados: { maior_de_idade: true } });
await rpc(como(ids.antigo), "termo_voluntario_aceitar");
await espera("depois de ler e aceitar, o painel abre", () => rpc(como(ids.antigo), "eu"), (e) => e.termo_voluntario === true);
await espera("o texto fica guardado para sempre e a pessoa o lê de novo", () => rpc(como(ids.antigo), "termos_meus"), (l) => l.length === 1 && l[0].texto === termoTexto && l[0].versao === vigente);
await espera("a coordenação lê o texto pelo id e o antigo deixa de ser 'sem texto'", async () => {
  const lista = await rpc(como(ids.coord), "termos_aceites_listar");
  return { lista, texto: await rpc(como(ids.coord), "termos_aceites_listar", { p_texto_de: lista.find((a) => a.nome === "Pessoa antigo" && a.id).id }) };
}, (r) => r.texto.texto === termoTexto && !r.lista.some((a) => a.nome === "Pessoa antigo" && a.antigo));
await recusa("o texto guardado não se apaga", () => dono("delete from interno.termos_aceites"), "não se alteram");
await espera("um aceite novo (versão vigente, com texto) abre o painel", async () => {
  await rpc(como(ids.novo), "termo_registrar", { p_termo: "voluntario", p_versao: vigente, p_texto: termoTexto, p_dados: { menor: true, responsavel: "Responsável Legal", responsavel_autoriza: true } });
  await rpc(como(ids.novo), "termo_voluntario_aceitar");
  return rpc(como(ids.novo), "eu");
}, (e) => e.termo_voluntario === true);
await recusa("texto de outra versão não vale para a versão vigente", async () => {
  await rpc(como(ids.antigoSemVersao), "termo_registrar", { p_termo: "voluntario", p_versao: "1999-01-01", p_texto: termoTexto, p_dados: {} });
  return rpc(como(ids.antigoSemVersao), "termo_voluntario_aceitar");
}, "falta_termo");
await espera("termo de adesão das Horas sem texto guardado avisa 'sem_texto'", () => rpc(como(ids.adesaoAntiga), "termo_meu"), (t) => t.sem_texto === true && t.versao === "2026-10-20");
await espera("depois de registrar o texto, o termo de adesão não está mais sem texto", async () => {
  await rpc(como(ids.adesaoAntiga), "termo_registrar", { p_termo: "adesao", p_versao: "2026-10-20", p_texto: `${termoTexto}\nNome completo: Pessoa Adesao Antiga`, p_dados: {} });
  return rpc(como(ids.adesaoAntiga), "termo_meu");
}, (t) => t.sem_texto === false);

// ── Idempotência: a migração duas vezes, e depois a instalação inteira de novo ──
const antes = await contagem();
const termosAntes = (await linhas("select count(*)::int as n from interno.termos_aceites"))[0].n;
await espera("rodar a migração de novo", aplicar);
await espera("segunda rodada não muda nada (papéis, histórico, avisos, quadro, pedidos, bastões, grupos)", contagem, (depois) => JSON.stringify(depois) === JSON.stringify(antes));
await espera("segunda rodada não toca nos termos", async () => (await linhas("select count(*)::int as n from interno.termos_aceites"))[0].n, (n) => n === termosAntes);
await espera("quem já aceitou continua aceito na segunda rodada", () => rpc(como(ids.aceitou), "eu"), (e) => e.termo_voluntario === true && true);
await espera("quem aceitou de novo continua aceito", () => rpc(como(ids.antigo), "eu"), (e) => e.termo_voluntario === true);
await espera("instalar de novo e aplicar a migração não quebra", async () => { await banco.instalarDeNovo(); await aplicar(); return contagem(); }, (c) => c.papeis === antes.papeis);
await espera("depois da reinstalação o Design continua fora da lista", () => rpc(como(ids.coord), "departamentos_resumo"), (l) => !l.some((d) => d.id === "design"));
await espera("depois da reinstalação quem aceitou segue aceito", () => rpc(como(ids.aceitou), "eu"), (e) => e.termo_voluntario === true);

// ── Segurança do arquivo ──
await espera("funções internas novas não são chamáveis de fora", () => banco.exclusivo(async () => {
  await banco.pg.exec("set role anon");
  try { await banco.pg.query("select interno.papel_sem_design('design')"); return false; } catch { return true; } finally { await banco.pg.exec("reset role"); }
}), (ok) => ok === true);
await espera("nenhuma tabela no esquema public", async () => (await linhas("select count(*)::int as n from information_schema.tables where table_schema = 'public'"))[0].n, (n) => n === 0);
confere("o SQL não cria tabela em public", !/create\s+table[^;]*\bpublic\./i.test(sql));
confere("o SQL não mexe no install.sql nem apaga termos", !/delete\s+from\s+interno\.termos_aceites|drop\s+table/i.test(sql));
confere("toda função public do arquivo é security definer com search_path fechado", [...sql.matchAll(/create or replace function public\.[\s\S]*?\$\$;?/gi)].every((m) => /security definer set search_path = interno, pg_temp/.test(m[0]) || /language sql stable security definer set search_path = interno, pg_temp/.test(m[0])));
for (const palavra of ["universidade", "diploma"]) confere(`o SQL não usa "${palavra}"`, !sql.toLowerCase().includes(palavra));

// ── Telas: nada de 'design' para escolher, textos novos ──
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");
const comum = ler("components/painel/comum.tsx");
confere("comum.tsx: Desenvolvimento chama UI/UX e Desenvolvimento", /desenvolvimento: "UI\/UX e Desenvolvimento"/.test(comum));
confere("comum.tsx: design aparece como parte da Comunicação", /design: "Comunicação: arte e design gráfico"/.test(comum));
confere("comum.tsx: função aposentada não é oferecida", /papelAposentado = \(papel: string\) => papel === "design"/.test(comum));
for (const arquivo of ["Convites", "Avisos", "Pessoas"]) confere(`${arquivo}.tsx não oferece a função design`, /papelAposentado/.test(ler(`components/painel/${arquivo}.tsx`)));
confere("a candidatura de voluntário não oferece design", !/volunteerRoles = \[[^\]]*"design"/.test(ler("components/VolunteerForm.tsx")));
confere("Painel.tsx: pedir função não oferece design", !/pediveis = \(\[[^\]]*"design"/.test(ler("components/painel/Painel.tsx") + ler("components/painel/casca/Dentro.tsx")));
confere("Equipe.tsx: pedido de ajuda vai para a Comunicação por padrão", /useState<Role\["papel"\]>\("marketing"\)/.test(ler("components/painel/Equipe.tsx")));
confere("Departamentos.tsx: nomes novos", /desenvolvimento: "UI\/UX e Desenvolvimento"/.test(ler("components/painel/Departamentos.tsx")) || /id: "desenvolvimento", nome: "UI\/UX e Desenvolvimento"/.test(ler("components/painel/departamentos-do-instituto.ts")));
confere("Termo.tsx explica o aceite de novo", /não ficou guardado/.test(ler("components/painel/Termo.tsx")));
confere("Horas.tsx usa sem_texto", /sem_texto/.test(ler("components/painel/Horas.tsx")));
confere("e2e: o ajudante registra o texto antes de aceitar", /termo_registrar/.test(ler("e2e/ajuda.ts")) && !/"termo_voluntario_aceitar"\)\.catch/.test(ler("e2e/fumaca.spec.ts")));
for (const arquivo of ["components/painel/Termo.tsx", "components/painel/comum.tsx", "docs/DEPARTAMENTOS-TERMOS.md"]) {
  confere(`${arquivo} sem "universidade" nem "diploma"`, !/universidade|diploma/i.test(ler(arquivo)));
}

console.log(`${certos} conferências ok, ${falhas.length} falhas`);
for (const f of falhas) console.log(` ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
