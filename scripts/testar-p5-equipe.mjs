// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova supabase/migracoes/20261126-p5-equipe.sql num Postgres de verdade dentro do Node, e o caminho inteiro do certificado:
//   - parceiro do instituto: papel por território, só a coordenação confia, o vínculo anda com o papel, cada parceiro edita a
//     página do próprio território (e só dela), qualquer pessoa lê o que mudou sem saber quem mudou;
//   - férias com "de" e "até": as de depois só valem no dia, a volta é sozinha, cancelar limpa tudo;
//   - fila de revisão: quem revisa corrige o idioma (e disciplina, página, título…), o histórico guarda o de antes, quem enviou é
//     avisado de quais campos mudaram, e o autor não muda a disciplina sozinho;
//   - e-mail das pendências: desligado não manda nada; ligado manda só contagens, um por dia, nunca a quem está de férias ou
//     desligou; só a coordenação liga a chave;
//   - certificado de ponta a ponta: termo, horas contadas pela plataforma, pedido, abertura, assinaturas, emissão e a conferência
//     pública pelo código (a mesma chamada da página /certificado);
//   - rádio: com só os canais de áudio (sem endereço de transmissão) a rádio vai ao ar e o público vê os canais.
// Uso: npm run testar:p5-equipe
// Para ver o teste falhar sem a migração: P5_ANTES=1 npm run testar:p5-equipe (monta o banco de antes dela).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(raiz, "supabase/migracoes/20261126-p5-equipe.sql"), "utf8");
const install = fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8");

let certos = 0;
const falhas = [];
const confere = (nome, condicao) => (condicao ? certos++ : falhas.push(nome));
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

// ── O arquivo ──
confere("a migração está colada no fim do install.sql, idêntica ao arquivo (seguida só das datadas posteriores)", noFimDoInstall(sql, install));
confere("a migração vem depois do fim da R3", install.lastIndexOf("Alumia · Reforço 3 · fim") < install.lastIndexOf(sql.slice(0, 300)));
confere("não mexe na versão nem na lista de exceções da porta", !/rede_alumia_versao|alumia_porta_aberta/.test(sql.replace(/^--.*$/gm, "")));
confere("nenhuma permissão direta em tabela", !/grant [a-z, ]+ on (table )?interno\./i.test(sql));
confere("toda tabela nova nasce com RLS", ["territorio_paginas", "contribuicao_alteracoes", "pendencias_email"].every((t) => sql.includes(`alter table interno.${t} enable row level security`)));
confere("nenhuma função nova começa com rede_ ou alumia_ (a porta não precisa de exceção)", !/create or replace function public\.(rede|alumia)_/.test(sql));
confere("o e-mail das pendências não leva título, nome nem texto (só as contagens da Mesa)", !/c\.titulo|f\.nome|corpo/.test(sql.slice(sql.indexOf("interno.pendencias_linhas"), sql.indexOf("interno.pendencias_montar"))));

const banco = await criarBanco(process.env.P5_ANTES ? { antesDe: sql } : {});
const { rpc, dono, criarUsuario } = banco;
const anon = { papel: "anon" };
const como = (sub) => ({ papel: "authenticated", sub, aal: "aal2" });
const linhas = async (texto, valores = []) => (await dono(texto, valores)).rows;

const ids = {};
for (const chave of ["coord", "vice", "sup", "rev", "edu", "edu2", "parc", "parc2", "trad", "fora", "radio"]) {
  ids[chave] = await criarUsuario(`${chave}@teste.local`, `Pessoa ${chave}`);
  await rpc(como(ids[chave]), "eu");
  await dono("update interno.perfis set nome = $2 where id = $1", [ids[chave], `Pessoa ${chave}`]);
}
await dono(`insert into interno.papeis (usuario, papel, disciplina) values ($1, 'coordenacao', null), ($2, 'vice', null), ($3, 'supervisao', null), ($4, 'revisao', null),
  ($5, 'educacao', 'espanhol'), ($6, 'educacao', 'historia'), ($7, 'traducao', null), ($8, 'jornalismo', null)`, [ids.coord, ids.vice, ids.sup, ids.rev, ids.edu, ids.edu2, ids.trad, ids.radio]);

// ── 1. Parceiro do instituto ──
await recusa("a supervisão não confia o papel de parceiro", () => rpc(como(ids.sup), "papeis_conceder_varios", { p_usuario: ids.parc, p_itens: [{ papel: "parceiro", disciplina: "noizocupa" }], p_departamentos: [] }), "sem_permissao");
await recusa("parceiro sem território não existe", () => rpc(como(ids.coord), "papeis_conceder_varios", { p_usuario: ids.parc, p_itens: [{ papel: "parceiro", disciplina: "" }], p_departamentos: [] }), "invalido:territorio");
await espera("a coordenação confia \"parceiro do instituto\" pela tela de funções, e o território fica ligado", async () => {
  await rpc(como(ids.coord), "papeis_conceder_varios", { p_usuario: ids.parc, p_itens: [{ papel: "parceiro", disciplina: "noizocupa" }], p_departamentos: [] });
  return [await rpc(como(ids.parc), "territorio_meus"), (await rpc(como(ids.parc), "eu")).papeis.map((p) => `${p.papel}:${p.disciplina}`),
    (await linhas("select count(*)::int as n from interno.departamento_membros where usuario = $1 and departamento = 'parcerias'", [ids.parc]))[0].n];
}, ([meus, papeis, parcerias]) => JSON.stringify(meus) === '["noizocupa"]' && papeis.includes("parceiro:noizocupa") && parcerias === 1);
await espera("o nome do papel aparece em português", () => linhas("select interno.nome_papel('parceiro') as n"), (r) => r[0].n === "parceiro do instituto");
await espera("ligar pelo caminho antigo (Parceiros dos territórios) também dá o papel", async () => {
  await rpc(como(ids.coord), "territorio_parceiro_definir", { p_usuario: ids.parc2, p_territorio: "coletivo-kamikaze", p_ligar: true });
  return (await rpc(como(ids.parc2), "eu")).papeis.map((p) => `${p.papel}:${p.disciplina}`);
}, (r) => r.includes("parceiro:coletivo-kamikaze"));
const pagina = { linha: "Arte, ocupação e cultura da quebrada.", sobre: "Texto novo escrito pelo próprio coletivo, com mais detalhe.", quem: "", instagram: "@noiz.ocupa", temas: ["Ocupação", "Arte", ""] };
await espera("o parceiro edita a página do próprio território", () => rpc(como(ids.parc), "territorio_pagina_salvar", { p_territorio: "noizocupa", p: pagina }), (r) => r.linha === pagina.linha && r.instagram === "noiz.ocupa" && JSON.stringify(r.temas) === '["Ocupação","Arte"]' && r.quem === "");
await recusa("e não edita a de outro território", () => rpc(como(ids.parc2), "territorio_pagina_salvar", { p_territorio: "noizocupa", p: pagina }), "sem_permissao");
await recusa("quem não é parceiro não edita", () => rpc(como(ids.fora), "territorio_pagina_salvar", { p_territorio: "noizocupa", p: pagina }), "sem_permissao");
await recusa("visitante não edita", () => rpc(anon, "territorio_pagina_salvar", { p_territorio: "noizocupa", p: pagina }), "");
await recusa("instagram inventado é recusado", () => rpc(como(ids.parc), "territorio_pagina_salvar", { p_territorio: "noizocupa", p: { ...pagina, instagram: "https://x.test/a" } }), "invalido:instagram");
await recusa("mais de 12 temas é recusado", () => rpc(como(ids.parc), "territorio_pagina_salvar", { p_territorio: "noizocupa", p: { ...pagina, temas: Array.from({ length: 13 }, (_, i) => `Tema ${i}`) } }), "invalido:temas");
await espera("a coordenação também edita qualquer página", () => rpc(como(ids.coord), "territorio_pagina_salvar", { p_territorio: "coletivo-desordem", p: { linha: "Linha nova da Desordem." } }), (r) => r.linha === "Linha nova da Desordem.");
await espera("qualquer visitante lê o que mudou, sem saber quem mudou", () => rpc(anon, "territorio_pagina", { p_territorio: "noizocupa" }), (r) => r.sobre === pagina.sobre && !("atualizado_por" in r) && !JSON.stringify(r).includes(ids.parc));
await espera("território sem mudança devolve nada (fica o texto do site)", () => rpc(anon, "territorio_pagina", { p_territorio: "na-atividade" }), (r) => r === null);
await espera("a edição fica no registro de ações", () => linhas("select count(*)::int as n from interno.auditoria where acao = 'territorio_pagina_editada' and alvo = 'noizocupa'"), (r) => r[0].n === 1);
await espera("retirar o papel desliga o território (e ele deixa de editar)", async () => {
  const papel = (await linhas("select id from interno.papeis where usuario = $1 and papel = 'parceiro'", [ids.parc2]))[0].id;
  await rpc(como(ids.coord), "papel_remover", { p_id: papel });
  return [await rpc(como(ids.parc2), "territorio_meus"), await rpc(como(ids.parc2), "territorio_pagina_salvar", { p_territorio: "coletivo-kamikaze", p: pagina }).then(() => "editou", (e) => e.message)];
}, ([meus, editou]) => meus.length === 0 && editou.includes("sem_permissao"));
await espera("quem já era ligado antes da migração ganha o papel quando ela roda", async () => {
  await dono("insert into interno.territorio_parceiros (territorio, usuario) values ('noisme-studios', $1)", [ids.fora]);
  await banco.exclusivo(() => banco.pg.exec(sql));
  return (await rpc(como(ids.fora), "eu")).papeis.map((p) => `${p.papel}:${p.disciplina}`);
}, (r) => r.includes("parceiro:noisme-studios"));
await dono("delete from interno.papeis where usuario = $1", [ids.fora]);

// ── 2. Férias com "de" e "até" ──
const D = {};
for (const n of [3, 5, 10, 20, 30, 50, 60, 200]) D[n] = (await linhas(`select (current_date + ${n})::text as d`))[0].d;
const dia = (n) => D[n];
await espera("férias marcadas para depois não começam hoje", () => rpc(como(ids.edu), "ferias_marcar", { p_de: dia(10), p_ate: dia(20) }), (r) => r.ferias_ate === null && r.proxima_de === (dia(10)) && r.proxima_ate === (dia(20)));
await espera("e a pessoa não está de férias hoje", () => linhas("select interno.de_ferias($1) as f", [ids.edu]), (r) => r[0].f === false);
await recusa("o começo depois do fim é recusado", async () => rpc(como(ids.edu), "ferias_marcar", { p_de: dia(30), p_ate: dia(20) }), "invalido:de");
await recusa("mais de 120 dias de férias é recusado", async () => rpc(como(ids.edu), "ferias_marcar", { p_de: dia(10), p_ate: dia(200) }), "invalido:ate");
await espera("no dia do começo, as férias passam a valer sozinhas", async () => {
  await dono("update interno.perfis set ferias_proxima_de = current_date where id = $1", [ids.edu]);
  const antes = await rpc(como(ids.edu), "ferias_ver");
  const n = (await linhas("select interno.ferias_comecar() as n"))[0].n;
  return [antes, n, await rpc(como(ids.edu), "ferias_ver"), (await linhas("select ferias_ate::text as a from interno.perfis where id = $1", [ids.edu]))[0].a];
}, async ([antes, n, depois, ate]) => antes.ferias_ate === (dia(20)) && n === 1 && depois.ferias_ate === (dia(20)) && depois.proxima_de === null && ate === (dia(20)));
await espera("sem \"de\", valem já (como antes)", () => rpc(como(ids.edu2), "ferias_marcar", { p_de: null, p_ate: null }).then(async () => rpc(como(ids.edu2), "ferias_marcar", { p_de: null, p_ate: dia(5) })), async (r) => r.ferias_ate === (dia(5)));
await espera("cancelar limpa as de agora e as de depois", async () => {
  await rpc(como(ids.edu2), "ferias_marcar", { p_de: dia(50), p_ate: dia(60) });
  return rpc(como(ids.edu2), "ferias_marcar", { p_de: null, p_ate: null });
}, (r) => r.ferias_ate === null && r.proxima_de === null);
await espera("a versão antiga (só o \"até\") continua funcionando", async () => rpc(como(ids.edu2), "ferias_marcar", { p_ate: dia(3) }), async (r) => r.ferias_ate === (dia(3)));
await dono("update interno.perfis set ferias_ate = null where id = $1", [ids.edu2]);

// ── 3. Fila de revisão ──
const traducao = await rpc(como(ids.trad), "contribuir", {
  p: { tipo: "traducao", disciplina: "espanhol", titulo: "El alfabeto y los sonidos del español", corpo: "Las 27 letras del alfabeto español y sus sonidos, con ejemplos.", alvo: "/trilhas/espanhol-do-zero/o-alfabeto-e-os-sons-do-espanhol", dados: { idioma: "en", resumo: "Las 27 letras." }, fontes: [] },
});
const versao = async () => (await linhas("select coalesce(editado_em, criado_em) as v from interno.contribuicoes where id = $1", [traducao.id]))[0].v.toISOString();
const atual = async () => (await linhas("select titulo, corpo, dados, fontes, disciplina, alvo from interno.contribuicoes where id = $1", [traducao.id]))[0];
const editar = async (quem, mudar) => { const c = await atual(); return rpc(como(quem), "contribuicao_editar", { p_id: traducao.id, p: { titulo: c.titulo, corpo: c.corpo, dados: c.dados, fontes: c.fontes, versao: await versao(), ...mudar } }); };
await espera("a revisão corrige o idioma de inglês para espanhol", async () => editar(ids.rev, { dados: { ...(await atual()).dados, idioma: "es" } }), async (r) => r.ok && JSON.stringify(r.campos) === '["idioma"]' && (await atual()).dados.idioma === "es");
await espera("o histórico guarda o valor de antes", () => rpc(como(ids.rev), "contribuicao_alteracoes", { p_id: traducao.id }), (r) => r.length === 1 && r[0].campos[0] === "idioma" && r[0].antes.dados.idioma === "en" && r[0].quem === "Pessoa");
await espera("quem enviou é avisado de quais campos mudaram", () => rpc(como(ids.trad), "avisos_meus"), (r) => r.some((a) => a.texto.includes("Quem revisa alterou o seu envio") && a.texto.includes("idioma")));
await espera("quem enviou também lê o histórico", () => rpc(como(ids.trad), "contribuicao_alteracoes", { p_id: traducao.id }), (r) => r.length === 1);
await recusa("quem não tem nada com o envio não lê o histórico", () => rpc(como(ids.parc), "contribuicao_alteracoes", { p_id: traducao.id }), "sem_permissao");
await espera("o educador da disciplina corrige a disciplina, a página e o título de uma vez", () => editar(ids.edu, { disciplina: "espanhol", alvo: "/trilhas/espanhol-do-zero/o-alfabeto", titulo: "El alfabeto del español" }), async (r) => r.ok && r.campos.includes("alvo") && r.campos.includes("titulo") && (await atual()).alvo === "/trilhas/espanhol-do-zero/o-alfabeto");
await recusa("página fora do formato é recusada", () => editar(ids.rev, { alvo: "javascript:alert(1)" }), "invalido:alvo");
await recusa("idioma que o site não tem é recusado", async () => editar(ids.rev, { dados: { ...(await atual()).dados, idioma: "xx" } }), "invalido:idioma");
await recusa("o autor não muda a disciplina sozinho (mudaria quem decide)", () => editar(ids.trad, { disciplina: "historia" }), "sem_permissao");
await espera("mas o autor ainda corrige o próprio texto", () => editar(ids.trad, { corpo: "Las 27 letras del alfabeto español y sus sonidos, con muchos ejemplos." }), (r) => r.ok && r.campos[0] === "corpo");
await recusa("quem não revisa nem enviou não edita", () => editar(ids.parc, { titulo: "Título de quem não devia" }), "sem_permissao");
await espera("o histórico guarda só o tamanho do texto antigo (não devolve o texto inteiro)", () => rpc(como(ids.rev), "contribuicao_alteracoes", { p_id: traducao.id }), (r) => r.length === 3 && r[0].quem === "quem enviou" && typeof r[0].antes.corpo_tamanho === "number" && !("corpo" in r[0].antes));

// ── 4. E-mail das pendências ──
const emails = async () => linhas("select para, assunto, texto from interno.emails where tipo = 'pendencias' order by para");
await espera("a chave geral nasce desligada e a rotina não manda nada", async () => [(await linhas("select interno.pendencias_enviar() as n"))[0].n, (await emails()).length], ([n, e]) => n === 0 && e === 0);
await recusa("só a coordenação liga a chave", () => rpc(como(ids.vice), "pendencias_email_ligar", { p_ligado: true }), "sem_permissao");
await espera("a pessoa vê a própria escolha e a prévia (só contagens)", () => rpc(como(ids.rev), "pendencias_email_ver"), (r) => r.frequencia === "diario" && r.ligado === false && r.previa?.linhas.some((l) => /^\d+ (item|itens) esperando revisão$/.test(l)));
await espera("quem desliga não recebe", () => rpc(como(ids.edu2), "pendencias_email_definir", { p_frequencia: "desligado" }), (r) => r.frequencia === "desligado");
await recusa("frequência inventada é recusada", () => rpc(como(ids.edu2), "pendencias_email_definir", { p_frequencia: "de hora em hora" }), "invalido:frequencia");
await recusa("quem não é da equipe não mexe", () => rpc(como(ids.fora), "pendencias_email_ver"), "sem_permissao");
await espera("ligada, a rotina manda um resumo a quem tem pendência, nunca a quem está de férias", async () => {
  await rpc(como(ids.coord), "pendencias_email_ligar", { p_ligado: true });
  const n = (await linhas("select interno.pendencias_enviar() as n"))[0].n;
  return [n, await emails()];
}, ([n, lista]) => n > 0 && lista.some((e) => e.para === "rev@teste.local" && /^\d+ (item|itens) esperando você no painel$/.test(e.assunto) && e.texto.includes("esperando revisão")) && !lista.some((e) => e.para === "edu@teste.local") && !lista.some((e) => e.para === "edu2@teste.local"));
await espera("o texto não leva título, idioma nem nome de ninguém", () => emails(), (lista) => lista.every((e) => !e.texto.includes("alfabeto") && !e.texto.includes("Pessoa ") && !e.texto.includes("@teste")));
await espera("no mesmo dia, não manda de novo", async () => [(await linhas("select interno.pendencias_enviar() as n"))[0].n], ([n]) => n === 0);
await espera("ligar e desligar fica no registro de ações", () => linhas("select count(*)::int as n from interno.auditoria where acao = 'pendencias_email_ligado'"), (r) => r[0].n === 1);
await espera("a troca de \"quem sou\" para contar não vaza para fora da conta", () => linhas("select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') as c"), (r) => !r[0].c.includes(ids.rev));

// ── 5. Certificado de ponta a ponta ──
await dono("delete from interno.configuracoes where chave = 'horas_pesos'");
let codigo = "";
await espera("termo, aula aprovada contada pela plataforma, pedido, abertura, assinaturas, emissão e conferência pública", async () => {
  await rpc(como(ids.edu2), "termo_aceitar", { p_nome_completo: "Pessoa Educadora Dois", p_versao: "1" });
  const aula = await rpc(como(ids.edu2), "contribuir", { p: { tipo: "aula", disciplina: "historia", titulo: "A Revolta da Chibata", corpo: "Texto da aula com mais de vinte caracteres.", dados: { trilha: "historia-do-brasil", resumo: "Marinheiros contra a chibata." }, fontes: [{ titulo: "Fonte", autor: "Autor", url: "https://exemplo.test/a" }] } });
  await rpc(como(ids.rev), "contribuicao_decidir", { p_id: aula.id, p_aprovar: true, p_nota: "" });
  const minhas = await rpc(como(ids.edu2), "horas_minhas");
  const hoje = (await linhas("select interno.dia_de(now())::text as d"))[0].d;
  await rpc(como(ids.edu2), "certificado_pedir", { p_inicio: hoje, p_fim: hoje, p_mensagem: "" });
  const pedido = (await rpc(como(ids.coord), "certificado_pedidos"))[0];
  const aberto = await rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.edu2, inicio: hoje, fim: hoje, atividades: pedido.resumo, educador: ids.edu } });
  await rpc(como(ids.edu), "certificado_testemunhar", { p_id: aberto.id });
  await rpc(como(ids.vice), "certificado_testemunhar", { p_id: aberto.id });
  codigo = (await rpc(como(ids.coord), "certificado_emitir", { p_id: aberto.id })).codigo;
  const publico = await rpc(anon, "certificado_conferir", { p_codigo: `${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8)}` });
  return [Number(minhas.plataforma), Number(aberto.horas), publico];
}, ([plataforma, horas, publico]) => plataforma === 4 && horas === 4 && publico.valido === true && publico.nome === "Pessoa Educadora Dois" && Number(publico.horas) === 4 && publico.testemunhas.length === 3);
await espera("o código como a página manda (em minúsculas, com traços) também confere", () => rpc(anon, "certificado_conferir", { p_codigo: `${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8)}`.toLowerCase() }), (r) => r.valido === true);

// ── 6. Rádio só com canais de áudio ──
await espera("sem endereço de transmissão, com um canal e uma faixa, a rádio vai ao ar e o público vê o canal", async () => {
  const canal = await rpc(como(ids.radio), "radio_canal_salvar", { p_id: null, p_nome: "Formação", p_descricao: "Aulas em áudio.", p_ordem: 1 });
  await rpc(como(ids.radio), "radio_faixa_salvar", { p_id: null, p_canal: canal.id, p_titulo: "O que é mais-valia", p_artista: "Instituto Lúcia (licença livre)", p_url: "https://exemplo.test/a.opus", p_duracao: 60, p_ordem: 0 });
  await rpc(como(ids.radio), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" });
  return rpc(anon, "radio_estado");
}, (r) => r.no_ar === true && r.ao_vivo === "" && r.canais.length === 1 && r.canais[0].faixas.length === 1);
await espera("o endereço da transmissão continua vazio até a coordenação pôr um", () => linhas("select valor ->> 'ao_vivo' as a from interno.configuracoes where chave = 'radio'"), (r) => r[0].a === "");

// ── Rodar de novo não estraga ──
await espera("a migração roda duas vezes sem erro e sem duplicar", async () => {
  await banco.exclusivo(() => banco.pg.exec(sql));
  return linhas("select count(*)::int as n from interno.papeis where papel = 'parceiro'");
}, (r) => r[0].n === 1);

console.log(`\n${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
