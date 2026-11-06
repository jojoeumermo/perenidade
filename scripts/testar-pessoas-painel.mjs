// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova T28, T29 e T30 (supabase/migracoes/20261106-pessoas-painel.sql) num Postgres de verdade dentro do Node:
//   - várias funções e várias disciplinas para a mesma pessoa numa ação só, com as regras de nível de sempre;
//   - os departamentos de hoje (Parcerias, Influenciadores, Representantes, RH, Revolucionários) sem perder os antigos;
//   - Revolucionários: quem participa só aparece para a coordenação e para o próprio departamento (LGPD, art. 11);
//   - convite com várias funções e departamentos, e a lista de convites com a situação de cada um;
//   - troca de e-mail: só a coordenação comunitária, com registro mascarado e aviso aos dois endereços;
//   - rodar a migração de novo não muda nada.
// Uso: npm run testar:pessoas-painel
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261106-pessoas-painel.sql"), "utf8");
const install = fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8").replace(/\r\n/g, "\n");

let certos = 0;
const falhas = [];
const confere = (nome, condicao) => (condicao ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !(await conferir(valor))) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return null;
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

confere("a migração está inteira no install.sql", install.includes(sql.replace(/\r\n/g, "\n").trim()));
confere("os grupos dos departamentos novos não viram grupo comum ao rodar o install.sql de novo", /departamento not in\s*\n[^;]*'revolucionarios'\);/.test(install));

const banco = await criarBanco();
const { rpc, dono, criarUsuario } = banco;
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2", ip: "203.0.113.70" });
const linhas = async (texto, valores = []) => (await dono(texto, valores)).rows;

const ids = {};
for (const chave of ["coord", "vice", "sup", "edu", "nova", "militante", "outra", "troca", "existente"]) {
  ids[chave] = await criarUsuario(`${chave}@teste.local`, `Pessoa ${chave}`);
  await rpc(como(ids[chave]), "eu");
  await dono("update interno.perfis set nome = $2 where id = $1", [ids[chave], `Pessoa ${chave}`]);
}
await dono("insert into interno.papeis (usuario, papel) values ($1, 'coordenacao'), ($2, 'vice'), ($3, 'supervisao')", [ids.coord, ids.vice, ids.sup]);
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'educacao', 'historia')", [ids.edu]);

// ── T30: departamentos ──
const deps = (await linhas("select id from interno.departamentos_info order by id")).map((r) => r.id);
for (const d of ["parcerias", "influenciadores", "representantes", "rh", "revolucionarios", "jornalismo", "educacao", "curadoria", "revisao", "traducao", "mentoria", "saude", "mediacao", "desenvolvimento", "coordenacao"]) {
  confere(`o departamento ${d} existe`, deps.includes(d));
}
const grupos = (await linhas("select departamento from interno.conversas where tipo = 'departamento'")).map((r) => r.departamento);
for (const d of ["parcerias", "influenciadores", "representantes", "rh", "revolucionarios"]) confere(`o grupo de conversa ${d} existe`, grupos.includes(d));

// ── T28: várias funções e disciplinas de uma vez ──
await espera(
  "a coordenação confia três funções e duas disciplinas numa ação só",
  () =>
    rpc(como(ids.coord), "papeis_conceder_varios", {
      p_usuario: ids.nova,
      p_itens: [
        { papel: "educacao", disciplina: "biologia" },
        { papel: "educacao", disciplina: "quimica" },
        { papel: "revisao", disciplina: null },
        { papel: "traducao", disciplina: null },
      ],
      p_departamentos: ["parcerias", "rh"],
    }),
  (r) => r.novas === 4 && r.departamentos === 2,
);
const daNova = await linhas("select papel, disciplina from interno.papeis where usuario = $1 order by papel, disciplina", [ids.nova]);
confere("a pessoa ficou com as quatro funções", daNova.length === 4 && daNova.filter((p) => p.papel === "educacao").length === 2);
confere("um recado só para a pessoa", (await linhas("select count(*)::int as n from interno.avisos where para = $1", [ids.nova]))[0].n === 1);
await espera("de novo, nada se duplica", () => rpc(como(ids.coord), "papeis_conceder_varios", { p_usuario: ids.nova, p_itens: [{ papel: "revisao" }], p_departamentos: ["rh"] }), (r) => r.novas === 0 && r.departamentos === 0);
await recusa(
  "tudo ou nada: educação sem disciplina recusa o lote inteiro",
  () => rpc(como(ids.coord), "papeis_conceder_varios", { p_usuario: ids.outra, p_itens: [{ papel: "curadoria" }, { papel: "educacao" }] }),
  "invalido:disciplina",
);
confere("e nada do lote recusado entrou", (await linhas("select count(*)::int as n from interno.papeis where usuario = $1", [ids.outra]))[0].n === 0);
await recusa("a supervisão não confia a curadoria", () => rpc(como(ids.sup), "papeis_conceder_varios", { p_usuario: ids.outra, p_itens: [{ papel: "curadoria" }] }), "sem_permissao");
await recusa("a supervisão não põe ninguém nos Revolucionários", () => rpc(como(ids.sup), "papeis_conceder_varios", { p_usuario: ids.outra, p_itens: [], p_departamentos: ["revolucionarios"] }), "sem_permissao");
await recusa("educação não confia função a ninguém", () => rpc(como(ids.edu), "papeis_conceder_varios", { p_usuario: ids.outra, p_itens: [{ papel: "revisao" }] }), "sem_permissao");
await recusa("departamento que não é de participação não entra", () => rpc(como(ids.coord), "papeis_conceder_varios", { p_usuario: ids.outra, p_itens: [], p_departamentos: ["curadoria"] }), "invalido:departamento");
await espera("a supervisão confia revisão e tradução juntas", () => rpc(como(ids.sup), "papeis_conceder_varios", { p_usuario: ids.outra, p_itens: [{ papel: "revisao" }, { papel: "traducao" }] }), (r) => r.novas === 2);
await espera("o papel_conceder de antes continua funcionando", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.edu, p_papel: "mentoria", p_disciplina: "historia" }), (r) => r.ok === true);
await espera("representante do RH (departamento novo)", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.edu, p_papel: "representante", p_disciplina: "rh" }), (r) => r.ok === true);
await recusa("a supervisão não nomeia representante dos Revolucionários", () => rpc(como(ids.sup), "papel_conceder", { p_usuario: ids.outra, p_papel: "representante", p_disciplina: "revolucionarios" }), "sem_permissao");

// Representantes e participação contam no departamento e no grupo de conversa.
const conversaDe = async (dep) => (await linhas("select id from interno.conversas where departamento = $1", [dep]))[0].id;
const noGrupo = async (dep, usuario) => (await linhas("select 1 from interno.conversa_membros where conversa = $1 and usuario = $2", [await conversaDe(dep), usuario])).length === 1;
confere("o representante do RH entra no grupo dos Representantes", await noGrupo("representantes", ids.edu));
confere("quem participa do RH entra no grupo do RH", await noGrupo("rh", ids.nova));
const rh = await espera("a página do RH lista quem participa", () => rpc(como(ids.edu), "departamento_ver", { p_id: "rh" }), (d) => d.pessoas.some((p) => p.id === ids.nova) && d.pessoas.some((p) => p.id === ids.edu && p.responde));

// ── Revolucionários: dado sensível ──
await espera("a coordenação põe alguém nos Revolucionários", () => rpc(como(ids.coord), "papeis_conceder_varios", { p_usuario: ids.militante, p_itens: [], p_departamentos: ["revolucionarios"] }), (r) => r.departamentos === 1);
confere("a supervisão não entra no grupo dos Revolucionários", !(await noGrupo("revolucionarios", ids.sup)));
confere("quem é dos Revolucionários entra no grupo", await noGrupo("revolucionarios", ids.militante));
await espera("quem é de fora não vê quem participa dos Revolucionários", () => rpc(como(ids.edu), "departamento_ver", { p_id: "revolucionarios" }), (d) => d.reservado === true && d.pessoas.length === 0);
await espera("a coordenação vê", () => rpc(como(ids.coord), "departamento_ver", { p_id: "revolucionarios" }), (d) => d.pessoas.some((p) => p.id === ids.militante));
await espera("o próprio militante vê", () => rpc(como(ids.militante), "departamento_ver", { p_id: "revolucionarios" }), (d) => d.reservado === false && d.pessoas.length === 1);
await espera("quem só participa vê só os próprios departamentos na lista", () => rpc(como(ids.militante), "departamentos_resumo"), (l) => l.length === 1 && l[0].id === "revolucionarios" && l[0].meu === true);
await espera("a equipe vê todos os departamentos, inclusive os novos", () => rpc(como(ids.edu), "departamentos_resumo"), (l) => ["parcerias", "influenciadores", "representantes", "rh", "revolucionarios", "jornalismo"].every((id) => l.some((d) => d.id === id)));
await espera("a supervisão não vê a participação na lista da equipe", () => rpc(como(ids.sup), "voluntarios_listar"), (l) => !l.find((p) => p.id === ids.militante).departamentos.includes("revolucionarios"));
await espera("a coordenação vê na lista da equipe", () => rpc(como(ids.coord), "voluntarios_listar"), (l) => l.find((p) => p.id === ids.militante).departamentos.includes("revolucionarios") && l.find((p) => p.id === ids.nova).departamentos.length === 2);
confere("o registro não diz o nome do departamento sensível", (await linhas("select count(*)::int as n from interno.auditoria where acao = 'departamento_incluido' and detalhes ->> 'departamento' = 'revolucionarios'"))[0].n === 0);
await recusa("a supervisão não tira ninguém dos Revolucionários", () => rpc(como(ids.sup), "departamento_membro_remover", { p_departamento: "revolucionarios", p_usuario: ids.militante }), "sem_permissao");
await espera("a pessoa sai sozinha de um departamento", () => rpc(como(ids.nova), "departamento_membro_remover", { p_departamento: "parcerias", p_usuario: ids.nova }), (r) => r.ok);
confere("e sai do grupo de conversa dele", !(await noGrupo("parcerias", ids.nova)));

// ── T29: convites ──
const convite = await espera(
  "convite pessoal com três funções e um departamento",
  () =>
    rpc(como(ids.coord), "convite_criar", {
      p: { email: "chegando@teste.local", extras: [{ papel: "educacao", disciplina: "fisica" }, { papel: "educacao", disciplina: "matematica" }, { papel: "revisao" }], departamentos: ["influenciadores"], dias: 7 },
    }),
  (r) => r.codigo && r.email_enviado,
);
const correio = await linhas("select texto from interno.emails where para = 'chegando@teste.local' and tipo = 'convite'");
confere("o e-mail do convite diz as funções", correio.length === 1 && /funções de/.test(correio[0].texto));
confere("o e-mail do convite não fala de departamento", correio.length === 1 && !/influenciadores/i.test(correio[0].texto));
if (convite) {
  const chegou = await criarUsuario("chegando@teste.local", "Quem chega", convite.codigo);
  const deQuemChegou = await linhas("select papel, disciplina from interno.papeis where usuario = $1 order by papel, disciplina", [chegou]);
  confere("quem chega pelo convite recebe as três funções", deQuemChegou.length === 3);
  confere("e o departamento do convite", (await linhas("select 1 from interno.departamento_membros where usuario = $1 and departamento = 'influenciadores'", [chegou])).length === 1);
}
await espera("o convite da comunidade continua sem função", () => rpc(como(ids.coord), "convite_criar", { p: { usos: 10, dias: 3 } }), (r) => r.codigo && !r.email_enviado);
await espera("o convite de uma função só continua igual", () => rpc(como(ids.coord), "convite_criar", { p: { email: "um@teste.local", papel: "traducao", dias: 2 } }), (r) => r.codigo);
const cancelar = await espera("convite para cancelar", () => rpc(como(ids.coord), "convite_criar", { p: { email: "cancela@teste.local", papel: "revisao" } }), (r) => r.id);
if (cancelar) await rpc(como(ids.coord), "convite_revogar", { p_id: cancelar.id });
await dono("update interno.convites set expira_em = now() - interval '1 day' where email = 'um@teste.local'");
await espera(
  "a lista de convites diz a situação de cada um e quem usou",
  () => rpc(como(ids.coord), "convites_listar"),
  (l) =>
    l.find((c) => c.email === "chegando@teste.local")?.situacao === "usado" &&
    l.find((c) => c.email === "chegando@teste.local")?.usado_por.length === 1 &&
    l.find((c) => c.email === "cancela@teste.local")?.situacao === "cancelado" &&
    l.find((c) => c.email === "um@teste.local")?.situacao === "vencido" &&
    l.find((c) => c.email === "")?.situacao === "valendo",
);
await recusa("a supervisão não vê convites", () => rpc(como(ids.sup), "convites_listar"), "sem_permissao");
await recusa("convite com departamento inventado", () => rpc(como(ids.coord), "convite_criar", { p: { email: "x@teste.local", departamentos: ["inventado"] } }), "invalido:departamento");

// ── T29: troca de e-mail ──
await recusa("a coordenação pedagógica não troca e-mail", () => rpc(como(ids.vice), "usuario_email_trocar", { p_usuario: ids.troca, p_email: "novo@teste.local", p_motivo: "pediu no grupo" }), "sem_permissao");
await recusa("a supervisão não troca e-mail", () => rpc(como(ids.sup), "usuario_email_trocar", { p_usuario: ids.troca, p_email: "novo@teste.local", p_motivo: "pediu no grupo" }), "sem_permissao");
await recusa("sem motivo, não troca", () => rpc(como(ids.coord), "usuario_email_trocar", { p_usuario: ids.troca, p_email: "novo@teste.local", p_motivo: "" }), "invalido:motivo");
await recusa("e-mail de outra conta, não troca", () => rpc(como(ids.coord), "usuario_email_trocar", { p_usuario: ids.troca, p_email: "existente@teste.local", p_motivo: "pediu no grupo" }), "email_em_uso");
await recusa("e-mail torto, não troca", () => rpc(como(ids.coord), "usuario_email_trocar", { p_usuario: ids.troca, p_email: "sem-arroba", p_motivo: "pediu no grupo" }), "invalido:email");
await recusa("o mesmo e-mail, não troca", () => rpc(como(ids.coord), "usuario_email_trocar", { p_usuario: ids.troca, p_email: "TROCA@teste.local", p_motivo: "pediu no grupo" }), "email_igual");
await recusa("a coordenação não troca o próprio por aqui", () => rpc(como(ids.coord), "usuario_email_trocar", { p_usuario: ids.coord, p_email: "eu@teste.local", p_motivo: "pediu no grupo" }), "invalido:usuario");
await espera("a coordenação troca o e-mail", () => rpc(como(ids.coord), "usuario_email_trocar", { p_usuario: ids.troca, p_email: " Novo@Teste.local ", p_motivo: "A pessoa pediu pelo grupo do RH" }), (r) => r.ok && r.email === "novo@teste.local");
confere("o e-mail da conta mudou", (await linhas("select email from auth.users where id = $1", [ids.troca]))[0].email === "novo@teste.local");
const registro = await linhas("select detalhes from interno.auditoria where acao = 'email_trocado'");
confere("o registro guarda o e-mail mascarado", registro.length === 1 && registro[0].detalhes.de === "t***@teste.local" && registro[0].detalhes.para === "n***@teste.local" && !JSON.stringify(registro[0].detalhes).includes("troca@"));
const avisos = await linhas("select para from interno.emails where tipo = 'conta_email' order by para");
confere("o endereço antigo e o novo recebem aviso", avisos.map((a) => a.para).join(",") === "novo@teste.local,troca@teste.local");
confere("a pessoa recebe um recado no painel", (await linhas("select count(*)::int as n from interno.avisos where para = $1 and categoria = 'conta'", [ids.troca]))[0].n === 1);
await espera("a supervisão continua sem ver e-mails", () => rpc(como(ids.sup), "voluntarios_listar"), (l) => l.every((p) => p.email === ""));

// ── Rodar de novo não muda nada ──
const antes = await linhas("select (select count(*) from interno.papeis) a, (select count(*) from interno.departamento_membros) b, (select count(*) from interno.conversas) c, (select count(*) from interno.departamentos_info) d");
await banco.exclusivo(() => banco.pg.exec(sql));
const depois = await linhas("select (select count(*) from interno.papeis) a, (select count(*) from interno.departamento_membros) b, (select count(*) from interno.conversas) c, (select count(*) from interno.departamentos_info) d");
confere("rodar a migração de novo não muda nada", JSON.stringify(antes) === JSON.stringify(depois));
await banco.instalarDeNovo();
confere("rodar o install.sql inteiro de novo mantém os grupos dos departamentos novos", (await linhas("select count(*)::int as n from interno.conversas where tipo = 'departamento' and departamento in ('parcerias', 'influenciadores', 'representantes', 'rh', 'revolucionarios')"))[0].n === 5);
confere("e a participação de cada um", (await linhas("select count(*)::int as n from interno.departamento_membros"))[0].n === Number(depois[0].b));
void rh;

// ── A tela usa o que o banco oferece ──
const tela = (arquivo) => fs.readFileSync(path.join(raiz, "components/painel", arquivo), "utf8");
confere("Confiar função usa a ação de várias funções", tela("Pessoas.tsx").includes('"papeis_conceder_varios"') && tela("Pessoas.tsx").includes("<EscolhaDeFuncoes"));
confere("o convite leva funções extras e departamentos", /extras,\s*departamentos: deps/.test(tela("Convites.tsx")));
confere("a lista de convites tem abas por situação e busca", tela("Convites.tsx").includes('"Vencidos e cancelados"') && tela("Convites.tsx").includes("<Busca"));
confere("a troca de e-mail chama o banco e só aparece para a coordenação comunitária", tela("TrocarEmail.tsx").includes('"usuario_email_trocar"') && tela("Pessoas.tsx").includes("{lider && <TrocarEmail"));
const lista = tela("departamentos-do-instituto.ts");
confere("os departamentos da tela batem com os do banco", ["parcerias", "influenciadores", "representantes", "rh", "revolucionarios"].every((id) => lista.includes(`id: "${id}"`) && sql.includes(`'${id}'`)));
confere("Revolucionários marcado como sensível na tela", /id: "revolucionarios"[^}]*sensivel: true/.test(lista));
for (const arquivo of ["Pessoas.tsx", "PessoasExtras.tsx", "Convites.tsx", "EscolhaDeFuncoes.tsx", "TrocarEmail.tsx", "departamentos-do-instituto.ts"]) {
  confere(`${arquivo}: sem "universidade" nem "diploma"`, !/universidade|diploma/i.test(tela(arquivo)));
}

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s) (${certos} certos):`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ pessoas no painel (T28, T29, T30): ${certos} conferências certas.`);
