// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as regras do banco: quem pode o quê. Uso: npm run testar:banco
import {
  abrirCopia, abrirPedido, abrirTexto, aparelhoCertificado, assinarTexto, certificarAparelho, cifrar, contextoDaConversa, contextoDaIdentidade, contextoDoEmbrulho, contextoDoMural,
  decifrar, deBase64, desembrulhar, desembrulharBytes, embrulhar, embrulharBytes, exportarIdentidade, importarIdentidade, novaChave, novaChaveDeRecuperacao, novaIdentidade,
  novoAparelho, novoCodigo, paraBase64, selarCopia, selarPedido,
} from "../lib/sigilo.ts";
import { criarBanco } from "./banco-local.mjs";

const banco = await criarBanco();
const { rpc, dono, criarUsuario } = banco;
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
/** A chamada precisa ser recusada com este código. */
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
const como = (sub) => ({ papel: "authenticated", sub });
const ids = {};
const nomes = { coord: "Jonathan", curadora: "Carla Curadora", prof: "Paulo Professor", jornal: "Joana Jornalista", revisor: "Rui Revisor", leitora: "Lia Leitora", troll: "Tito Troll", vice: "Vera Vice", mentora: "Marta Mentora", designer: "Davi Designer", med: "Mauro Mediador", vol: "Vânia Voluntária" };
for (const chave of Object.keys(nomes)) {
  ids[chave] = await criarUsuario(`${chave}@teste.local`, nomes[chave]);
}
const fonte = [{ titulo: "O Capital", autor: "Karl Marx", url: "https://www.marxists.org/portugues/marx/1867/capital/index.htm" }];
const aula = (extra = {}) => ({ tipo: "aula", disciplina: "matematica", titulo: "Equações do primeiro grau", corpo: "Texto da aula com mais de vinte caracteres.", dados: { trilha: "matematica-fundamental", resumo: "Como isolar a incógnita." }, fontes: fonte, ...extra });

// ── Instalação ──
await espera("instalar duas vezes não quebra", () => banco.instalarDeNovo());
await espera("tabelas ficam fora do alcance da API", () => dono("select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and grantee in ('anon', 'authenticated', 'PUBLIC')"), (r) => r.rows[0].n === 0);
await recusa("anônimo não lê tabela interna", () => banco.exclusivo(async () => { await banco.pg.exec("set role anon"); try { return await banco.pg.query("select * from interno.perfis"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");
await recusa("logado não lê tabela interna", () => banco.exclusivo(async () => { await banco.pg.exec("set role authenticated"); try { return await banco.pg.query("select * from interno.contribuicoes"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");
await recusa("função interna não é chamável de fora", () => banco.exclusivo(async () => { await banco.pg.exec("set role anon"); try { return await banco.pg.query("select interno.limite('x', 1, 1)"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");

// ── Segundo fator obrigatório: nasce ligado ──
const exigencia = () => dono("select valor from interno.configuracoes where chave = 'seguranca'");
await espera("a exigência de segundo fator nasce ligada", exigencia, (r) => r.rows[0].valor.exigir_2fa === true);
// As conferências de permissão abaixo rodam com a exigência desligada; ela tem a própria seção mais adiante.
await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
await espera("instalar de novo não religa o que foi desligado", async () => { await banco.instalarDeNovo(); return exigencia(); }, (r) => r.rows[0].valor.exigir_2fa === false);
await espera("banco antigo, instalado antes da regra, é virado uma única vez", async () => {
  await dono("update interno.configuracoes set valor = '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
  await banco.instalarDeNovo();
  const ligado = (await exigencia()).rows[0].valor.exigir_2fa;
  await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
  return ligado;
}, (r) => r === true);

// ── Conta e coordenação ──
await espera("sem login, eu() é nulo", () => rpc(anon, "eu"), (r) => r === null);
for (const chave of Object.keys(ids)) await espera(`perfil de ${chave} nasce no primeiro acesso`, () => rpc(como(ids[chave]), "eu"), (r) => r.id === ids[chave] && r.papeis.length === 0);
await espera("o nome público nasce como codinome, sem nada do e-mail", () => rpc(como(ids.leitora), "eu"), (r) => /^Estudante \d{5}$/.test(r.nome));
for (const chave of Object.keys(ids)) await rpc(como(ids[chave]), "perfil_salvar", { p_nome: nomes[chave], p_bio: "" });
await recusa("anônimo não se promove", () => rpc(anon, "promover_coordenacao", { p_email: "troll@teste.local" }), "permission denied");
await recusa("logado não se promove", () => rpc(como(ids.troll), "promover_coordenacao", { p_email: "troll@teste.local" }), "permission denied");
await espera("dono do banco promove a coordenação", () => dono("select public.promover_coordenacao('coord@teste.local') as r"), (r) => r.rows[0].r.startsWith("Pronto"));
await espera("coordenação aparece em eu()", () => rpc(como(ids.coord), "eu"), (r) => r.papeis.some((p) => p.papel === "coordenacao"));
await recusa("nome curto demais", () => rpc(como(ids.leitora), "perfil_salvar", { p_nome: "L", p_bio: "" }), "invalido:nome");
await espera("salvar perfil", () => rpc(como(ids.leitora), "perfil_salvar", { p_nome: "Lia Leitora", p_bio: "Estudante." }), (r) => r.bio === "Estudante.");

// ── Voluntariado ──
await recusa("anônimo não se candidata", () => rpc(anon, "candidatar", { p_papel: "educacao", p_disciplina: "matematica", p_mensagem: "Sou professor de matemática há dez anos." }), "entre_primeiro");
await recusa("não dá para se candidatar à coordenação", () => rpc(como(ids.troll), "candidatar", { p_papel: "coordenacao", p_disciplina: null, p_mensagem: "Quero mandar em tudo, por favor deixa." }), "invalido:papel");
await recusa("educador precisa dizer a disciplina", () => rpc(como(ids.prof), "candidatar", { p_papel: "educacao", p_disciplina: null, p_mensagem: "Sou professor de matemática há dez anos." }), "invalido:disciplina");
let candidatura;
await espera("candidatura de educador", async () => (candidatura = await rpc(como(ids.prof), "candidatar", { p_papel: "educacao", p_disciplina: "matematica", p_mensagem: "Sou professor de matemática há dez anos." })), (r) => Boolean(r.id));
await recusa("candidatura repetida", () => rpc(como(ids.prof), "candidatar", { p_papel: "educacao", p_disciplina: "matematica", p_mensagem: "Sou professor de matemática há dez anos." }), "ja_pediu");
await recusa("leitora não vê candidaturas", () => rpc(como(ids.leitora), "candidaturas_listar"), "sem_permissao");
await recusa("leitora não aceita candidatura", () => rpc(como(ids.leitora), "candidatura_decidir", { p_id: candidatura.id, p_aceitar: true }), "sem_permissao");
await espera("coordenação vê candidaturas com e-mail", () => rpc(como(ids.coord), "candidaturas_listar"), (r) => r.length === 1 && r[0].email === "prof@teste.local");
await espera("coordenação aceita", () => rpc(como(ids.coord), "candidatura_decidir", { p_id: candidatura.id, p_aceitar: true }));
await espera("professor virou educador de matemática", () => rpc(como(ids.prof), "eu"), (r) => r.papeis.length === 1 && r.papeis[0].papel === "educacao" && r.papeis[0].disciplina === "matematica");
await recusa("leitora não concede papel", () => rpc(como(ids.leitora), "papel_conceder", { p_usuario: ids.leitora, p_papel: "coordenacao", p_disciplina: null }), "sem_permissao");
await recusa("educador não concede papel", () => rpc(como(ids.prof), "papel_conceder", { p_usuario: ids.prof, p_papel: "curadoria", p_disciplina: null }), "sem_permissao");
await espera("coordenação concede curadoria", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.curadora, p_papel: "curadoria", p_disciplina: null }));
await espera("coordenação concede jornalismo", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.jornal, p_papel: "jornalismo", p_disciplina: null }));
await espera("coordenação concede revisão", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.revisor, p_papel: "revisao", p_disciplina: null }));
await recusa("curadoria não lista voluntários (tem e-mails)", () => rpc(como(ids.curadora), "voluntarios_listar"), "sem_permissao");
await espera("coordenação lista voluntários", () => rpc(como(ids.coord), "voluntarios_listar"), (r) => r.length === 12);
// ── Busca de pessoas para confiar função ──
await recusa("anônimo não busca pessoas", () => rpc(anon, "pessoas_buscar", { p_busca: "prof" }), "entre_primeiro");
await recusa("leitora não busca pessoas (a resposta tem e-mails)", () => rpc(como(ids.leitora), "pessoas_buscar", { p_busca: "prof" }), "sem_permissao");
await recusa("curadoria não busca pessoas", () => rpc(como(ids.curadora), "pessoas_buscar", { p_busca: "prof" }), "sem_permissao");
await espera("coordenação busca por parte do e-mail", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "PROF@teste" }), (r) => r.length === 1 && r[0].id === ids.prof && r[0].email === "prof@teste.local" && r[0].nome === "Paulo Professor");
await espera("busca por nome ignora acento e maiúsculas", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "paulo PROFESSOR" }), (r) => r.length === 1 && r[0].id === ids.prof);
await espera("busca devolve só quem corresponde", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "teste.local" }), (r) => r.length === 12 && r.every((p) => p.email.endsWith("@teste.local")));
await espera("menos de duas letras não devolve ninguém", async () => [await rpc(como(ids.coord), "pessoas_buscar", { p_busca: "a" }), await rpc(como(ids.coord), "pessoas_buscar", { p_busca: "  " }), await rpc(como(ids.coord), "pessoas_buscar", { p_busca: null })], (r) => r.every((l) => l.length === 0));
await espera("pontuação sozinha não vira busca que traz todo mundo", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "%%" }), (r) => r.length === 0);
await espera("quem não existe não aparece", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "fulano inexistente" }), (r) => r.length === 0);
await espera("a busca nunca devolve mais de vinte", async () => { for (let i = 0; i < 25; i++) await dono("insert into auth.users (email) values ($1)", [`lote${i}@busca.local`]); for (const u of (await dono("select id from auth.users where email like 'lote%@busca.local'")).rows) await rpc(como(u.id), "eu"); const r = await rpc(como(ids.coord), "pessoas_buscar", { p_busca: "busca.local" }); await dono("delete from auth.users where email like 'lote%@busca.local'"); return r; }, (r) => r.length === 20);
await espera("equipe pública não mostra e-mail", () => rpc(anon, "equipe"), (r) => r.length === 5 && !JSON.stringify(r).includes("@"));
const papelCoord = (await rpc(como(ids.coord), "eu")).papeis[0].id;
await recusa("a última coordenação não pode ser removida", () => rpc(como(ids.coord), "papel_remover", { p_id: papelCoord }), "ultima_coordenacao");
await recusa("a coordenação não suspende a si mesma", () => rpc(como(ids.coord), "usuario_suspender", { p_usuario: ids.coord, p_suspenso: true }), "invalido:usuario");

// ── Contribuições ──
await recusa("aula sem fonte é recusada", () => rpc(anon, "contribuir", { p: aula({ fontes: [] }) }), "falta_fonte");
await recusa("fonte com endereço estranho é recusada", () => rpc(anon, "contribuir", { p: aula({ fontes: [{ titulo: "x", url: "javascript:alert(1)" }] }) }), "invalido:fontes");
await recusa("tipo desconhecido", () => rpc(anon, "contribuir", { p: aula({ tipo: "virus" }) }), "invalido:tipo");
await recusa("título curto", () => rpc(anon, "contribuir", { p: aula({ titulo: "a" }) }), "invalido:titulo");
await recusa("disciplina com caracteres estranhos", () => rpc(anon, "contribuir", { p: aula({ disciplina: "../../etc" }) }), "invalido:disciplina");
await recusa("público não escreve no jornal", () => rpc(anon, "contribuir", { p: aula({ tipo: "artigo" }) }), "sem_permissao");
await recusa("educador não escreve no jornal", () => rpc(como(ids.prof), "contribuir", { p: aula({ tipo: "artigo" }) }), "sem_permissao");
// ── Mediação: o papel novo ──
await recusa("curadoria não confia a mediação", () => rpc(como(ids.curadora), "papel_conceder", { p_usuario: ids.med, p_papel: "mediacao", p_disciplina: null }), "sem_permissao");
await espera("coordenação confia a mediação", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.med, p_papel: "mediacao", p_disciplina: null }));
await espera("mediador aparece em eu() com o papel", () => rpc(como(ids.med), "eu"), (r) => r.papeis.length === 1 && r.papeis[0].papel === "mediacao");
await recusa("mediador não confia papéis", () => rpc(como(ids.med), "papel_conceder", { p_usuario: ids.troll, p_papel: "mediacao", p_disciplina: null }), "sem_permissao");
await recusa("mediador não lista voluntários (tem e-mails)", () => rpc(como(ids.med), "voluntarios_listar"), "sem_permissao");
await recusa("mediador não suspende conta", () => rpc(como(ids.med), "usuario_suspender", { p_usuario: ids.troll, p_suspenso: true }), "sem_permissao");
await recusa("mediador não mexe no filtro de palavras", () => rpc(como(ids.med), "filtro_listar"), "sem_permissao");
await recusa("mediador não mexe nos controles do site", () => rpc(como(ids.med), "site_salvar", { p: { faixa: "", pausa: true, motivo: "" } }), "sem_permissao");
await espera("dá para se candidatar à mediação, e a coordenação decide", async () => {
  const pedido = await rpc(como(ids.troll), "candidatar", { p_papel: "mediacao", p_disciplina: null, p_mensagem: "Quero ajudar a manter a comunidade em ordem." });
  await rpc(como(ids.coord), "candidatura_decidir", { p_id: pedido.id, p_aceitar: false });
  return rpc(como(ids.troll), "eu");
}, (r) => r.papeis.length === 0);
let publica, doProf, artigo;
await espera("qualquer pessoa contribui", async () => (publica = await rpc(anon, "contribuir", { p: aula({ nome: "Visitante" }) })), (r) => Boolean(r.id));
await espera("campo-isca preenchido não guarda nada", () => rpc(anon, "contribuir", { p: aula({ site: "http://spam" }) }), (r) => Boolean(r.id));
await espera("isca não entrou na fila", () => dono("select count(*)::int as n from interno.contribuicoes"), (r) => r.rows[0].n === 1);
await recusa("contribuição sem conta com apologia ao nazismo não chega à fila", () => rpc({ papel: "anon", ip: "198.51.100.30" }, "contribuir", { p: aula({ corpo: "Texto dizendo que o holocausto é mentira e outras coisas assim." }) }), "conteudo_recusado");
await espera("educador contribui na própria disciplina", async () => (doProf = await rpc(como(ids.prof), "contribuir", { p: aula({ titulo: "Regra de três" }) })), (r) => Boolean(r.id));
await espera("jornalista envia matéria", async () => (artigo = await rpc(como(ids.jornal), "contribuir", { p: aula({ tipo: "artigo", disciplina: null, titulo: "Greve dos metalúrgicos completa uma semana", dados: { subtitulo: "Categoria pede reposição." } }) })), (r) => Boolean(r.id));
await espera("contribuição do educador é marcada como tal e assinada", () => rpc(como(ids.prof), "contribuicao_ver", { p_id: doProf.id }), (r) => r.como === "educacao" && r.nome_autor === "Paulo Professor" && r.status === "pendente");
await espera("quem enviou sem conta fica com o nome que deu", () => rpc(como(ids.curadora), "contribuicao_ver", { p_id: publica.id }), (r) => r.nome_autor === "Visitante" && r.como === "publico");
// ── Triagem: a mediação lê primeiro o que vem de fora ──
await espera("o que vem de fora espera a triagem; o da equipe, não", () => rpc(como(ids.curadora), "fila"), (r) => r.find((c) => c.id === publica.id).triagem === "aguardando" && r.find((c) => c.id === doProf.id).triagem === "liberada");
await espera("antes da triagem, o envio de fora não chega ao educador nem ao revisor", async () => [await rpc(como(ids.prof), "fila"), await rpc(como(ids.revisor), "fila")], (r) => r.every((f) => f.length === 2 && !f.some((c) => c.id === publica.id)));
await recusa("educador não abre o que espera a triagem", () => rpc(como(ids.prof), "contribuicao_ver", { p_id: publica.id }), "sem_permissao");
await recusa("educador não vê a triagem", () => rpc(como(ids.prof), "triagem_fila"), "sem_permissao");
await recusa("leitora não faz triagem", () => rpc(como(ids.leitora), "triagem_decidir", { p_id: publica.id, p_liberar: true, p_nota: "" }), "sem_permissao");
await recusa("anônimo não faz triagem", () => rpc(anon, "triagem_decidir", { p_id: publica.id, p_liberar: true, p_nota: "" }), "entre_primeiro");
await espera("mediador vê a triagem", () => rpc(como(ids.med), "triagem_fila"), (r) => r.length === 1 && r[0].id === publica.id);
await espera("mediador abre o envio que espera a triagem", () => rpc(como(ids.med), "contribuicao_ver", { p_id: publica.id }), (r) => r.corpo.length > 20 && r.triagem === "aguardando");
await recusa("mediador não abre o que já está na fila de revisão", () => rpc(como(ids.med), "contribuicao_ver", { p_id: doProf.id }), "sem_permissao");
await espera("a fila de revisão não é do mediador", () => rpc(como(ids.med), "fila"), (r) => r.length === 0);
await recusa("mediador não aprova conteúdo: isso é da curadoria", () => rpc(como(ids.med), "contribuicao_decidir", { p_id: publica.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("mediador não dá parecer", () => rpc(como(ids.med), "parecer", { p_id: publica.id, p_favoravel: true, p_texto: "Parece bom." }), "sem_permissao");
await espera("resumo do mediador conta a triagem", () => rpc(como(ids.med), "painel_resumo"), (r) => r.triagem === 1 && r.fila === 0);
let spam;
await espera("chega um envio de propaganda", async () => (spam = await rpc({ papel: "anon", ip: "198.51.100.41" }, "contribuir", { p: aula({ titulo: "Renda extra sem sair de casa", nome: "Promo" }) })), (r) => Boolean(r.id));
await recusa("barrar na triagem exige nota", () => rpc(como(ids.med), "triagem_decidir", { p_id: spam.id, p_liberar: false, p_nota: "" }), "invalido:nota");
await espera("mediador barra a propaganda", () => rpc(como(ids.med), "triagem_decidir", { p_id: spam.id, p_liberar: false, p_nota: "Propaganda, não é material de estudo." }));
await espera("o que foi barrado não chega à fila de ninguém", async () => [await rpc(como(ids.curadora), "fila"), await rpc(como(ids.curadora), "contribuicao_ver", { p_id: spam.id })], (r) => !r[0].some((c) => c.id === spam.id) && r[1].status === "recusada");
await recusa("triagem não se repete", () => rpc(como(ids.med), "triagem_decidir", { p_id: spam.id, p_liberar: true, p_nota: "" }), "ja_decidida");
await espera("mediador acerta a forma antes de liberar", () => rpc(como(ids.med), "contribuicao_editar", { p_id: publica.id, p: aula({ corpo: "Texto da aula, agora com os parágrafos no lugar." }) }));
await espera("mediador libera e o envio chega à fila de revisão", async () => { await rpc(como(ids.med), "triagem_decidir", { p_id: publica.id, p_liberar: true, p_nota: "" }); return rpc(como(ids.revisor), "fila"); }, (r) => r.some((c) => c.id === publica.id && c.triagem === "liberada"));
await recusa("quem não tem nada com o envio sem conta não o abre", () => rpc(como(ids.leitora), "contribuicao_ver", { p_id: publica.id }), "sem_permissao");
await recusa("nem o edita", () => rpc(como(ids.leitora), "contribuicao_editar", { p_id: publica.id, p: aula({ titulo: "Tomado por outra pessoa" }) }), "sem_permissao");
await recusa("nem anônimo o abre", () => rpc(anon, "contribuicao_ver", { p_id: publica.id }), "sem_permissao");
await recusa("depois de liberado, o mediador não mexe mais", () => rpc(como(ids.med), "contribuicao_editar", { p_id: publica.id, p: aula() }), "sem_permissao");
await espera("triagem vazia depois do trabalho", () => rpc(como(ids.med), "triagem_fila"), (r) => r.length === 0);
await recusa("leitora não vê a fila", () => rpc(como(ids.leitora), "fila"), "sem_permissao");
await recusa("anônimo não vê a fila", () => rpc(anon, "fila"), "entre_primeiro");
await recusa("leitora não vê contribuição alheia", () => rpc(como(ids.leitora), "contribuicao_ver", { p_id: doProf.id }), "sem_permissao");
await espera("educador vê a fila da disciplina dele e as matérias do jornal", () => rpc(como(ids.prof), "fila"), (r) => r.length === 3 && r.every((c) => c.disciplina === "matematica" || c.tipo === "artigo"));
await espera("educador dá parecer em matéria do jornal, mas não aprova", () => rpc(como(ids.prof), "parecer", { p_id: artigo.id, p_favoravel: true, p_texto: "Conferi os números da matéria." }));
await espera("revisor vê a fila inteira", () => rpc(como(ids.revisor), "fila"), (r) => r.length === 3);
await espera("jornalista não vê aulas na fila", () => rpc(como(ids.jornal), "fila"), (r) => r.length === 0);
await espera("revisor dá parecer", () => rpc(como(ids.revisor), "parecer", { p_id: doProf.id, p_favoravel: true, p_texto: "Conferi as contas, está correto." }));
await recusa("leitora não dá parecer", () => rpc(como(ids.leitora), "parecer", { p_id: doProf.id, p_favoravel: true, p_texto: "Gostei muito." }), "sem_permissao");
await recusa("o autor não aprova a própria aula", () => rpc(como(ids.prof), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("a curadoria não decide aula: ela cuida do acervo", () => rpc(como(ids.curadora), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("jornalista não aprova a própria matéria", () => rpc(como(ids.jornal), "contribuicao_decidir", { p_id: artigo.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("troll não edita contribuição alheia", () => rpc(como(ids.troll), "contribuicao_editar", { p_id: doProf.id, p: aula({ titulo: "Hackeado" }) }), "sem_permissao");
await espera("autor edita enquanto está pendente", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: doProf.id, p: aula({ titulo: "Regra de três simples" }) }));
await recusa("edição não pode tirar a fonte", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: doProf.id, p: aula({ fontes: [] }) }), "falta_fonte");
await espera("a revisão aprova sozinha: uma pessoa basta", () => rpc(como(ids.revisor), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: true, p_nota: "Ótima aula." }));
await recusa("decisão não se repete", () => rpc(como(ids.revisor), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: false, p_nota: "" }), "ja_decidida");
await recusa("autor não edita depois de decidida", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: doProf.id, p: aula() }), "ja_decidida");
await espera("coordenação recusa a pública", () => rpc(como(ids.coord), "contribuicao_decidir", { p_id: publica.id, p_aprovar: false, p_nota: "Faltou desenvolver." }));
await espera("autor acompanha as próprias", () => rpc(como(ids.prof), "contribuicoes_minhas"), (r) => r.length === 1 && r[0].status === "aprovada" && r[0].pareceres >= 1);
await recusa("anônimo não lê o que vai ser publicado", () => rpc(anon, "publicacoes_pendentes"), "sem_permissao");
await recusa("coordenação logada também não (só a rotina de publicação)", () => rpc(como(ids.coord), "publicacoes_pendentes"), "sem_permissao");
await espera("rotina de publicação lê as aprovadas", () => rpc(servico, "publicacoes_pendentes"), (r) => r.length === 1 && r[0].titulo === "Regra de três simples" && r[0].nome_autor === "Paulo Professor");
await recusa("logado não marca como publicada", () => rpc(como(ids.coord), "publicacoes_marcar", { p_ids: [doProf.id] }), "sem_permissao");
await espera("rotina marca como publicada", () => rpc(servico, "publicacoes_marcar", { p_ids: [doProf.id] }));
await espera("nada mais a publicar", () => rpc(servico, "publicacoes_pendentes"), (r) => r.length === 0);
await espera("correção aprovada vira 'resolvida', não vai para publicação", async () => {
  const c = await rpc(anon, "contribuir", { p: { tipo: "correcao", titulo: "Erro de data", corpo: "A data da Lei Áurea está errada na aula tal.", alvo: "/trilhas/x/y" } });
  await rpc(como(ids.med), "triagem_decidir", { p_id: c.id, p_liberar: true, p_nota: "" });
  await rpc(como(ids.revisor), "contribuicao_decidir", { p_id: c.id, p_aprovar: true, p_nota: "Corrigido." });
  return rpc(como(ids.revisor), "contribuicao_ver", { p_id: c.id });
}, (r) => r.status === "resolvida");

// ── Limite de pedidos ──
await espera("anônimo é freado depois de alguns envios", async () => {
  let recusou = false;
  for (let i = 0; i < 8; i++) {
    try { await rpc({ papel: "anon", ip: "203.0.113.9" }, "contribuir", { p: aula({ titulo: `Tentativa ${i}` }) }); } catch (erro) { recusou = String(erro.message).includes("muitos_pedidos"); }
  }
  return recusou;
}, (r) => r === true);
await espera("o freio é por origem: outra origem continua passando", () => rpc({ papel: "anon", ip: "198.51.100.7" }, "contribuir", { p: aula({ titulo: "De outro lugar" }) }), (r) => Boolean(r.id));
await espera("o endereço não fica guardado", () => dono("select count(*)::int as n from interno.limites where chave like '%203.0.113.9%'"), (r) => r.rows[0].n === 0);

// ── Comunidade ──
await recusa("anônimo não cria tópico", () => rpc(anon, "topico_criar", { p_titulo: "Dúvida sobre frações", p_corpo: "Como somo frações diferentes?", p_disciplina: "matematica" }), "entre_primeiro");
let topico, resposta;
await espera("mensagem com endereço de site é caso de dúvida: espera a revisão", async () => (topico = await rpc(como(ids.leitora), "topico_criar", { p_titulo: "Dúvida sobre frações", p_corpo: "Como somo frações com denominadores diferentes? Vi uma conta em www.exemplo.com e não entendi.", p_disciplina: "matematica" })), (r) => Boolean(r.id) && r.retido === true && r.bloqueado === false);
await espera("o que espera a revisão não aparece para o público", () => rpc(anon, "topicos_listar"), (r) => r.length === 0);
await recusa("nem abre pelo endereço", () => rpc(anon, "topico_ver", { p_id: topico.id }), "nao_encontrado");
await recusa("outra pessoa logada também não vê", () => rpc(como(ids.jornal), "topico_ver", { p_id: topico.id }), "nao_encontrado");
await espera("quem escreveu acompanha a própria mensagem aguardando", async () => [await rpc(como(ids.leitora), "topicos_listar"), await rpc(como(ids.leitora), "topico_ver", { p_id: topico.id })], (r) => r[0].length === 1 && r[0][0].retido === true && r[1].retido === true);
await recusa("ninguém responde ao que ainda não foi aprovado", () => rpc(como(ids.jornal), "responder", { p_topico: topico.id, p_corpo: "Resposta apressada." }), "nao_encontrado");
await recusa("ninguém vota no que ainda não foi aprovado", () => rpc(como(ids.leitora), "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: 1 }), "nao_encontrado");
await recusa("quem escreveu não aprova a própria mensagem", () => rpc(como(ids.leitora), "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico.id, p_acao: "mostrar" }), "sem_permissao");
await recusa("jornalista não vê a fila de mediação", () => rpc(como(ids.jornal), "comunidade_retidos"), "sem_permissao");
await espera("mediador vê a fila de mediação", () => rpc(como(ids.med), "comunidade_retidos"), (r) => r.length === 1 && r[0].id === topico.id && r[0].filtro === false && r[0].motivo === "endereco");
await recusa("quem escreveu não edita pela porta da mediação", () => rpc(como(ids.leitora), "comunidade_editar", { p_tipo: "topico", p_alvo: topico.id, p_titulo: "Outro título qualquer", p_corpo: "Outro corpo qualquer aqui." }), "sem_permissao");
await espera("mediador edita antes de aprovar", async () => { await rpc(como(ids.med), "comunidade_editar", { p_tipo: "topico", p_alvo: topico.id, p_titulo: "Dúvida sobre frações", p_corpo: "Como eu somo frações com denominadores diferentes?" }); return rpc(como(ids.med), "topico_ver", { p_id: topico.id }); }, (r) => r.corpo.startsWith("Como eu somo") && r.autor === "Lia Leitora");
await recusa("edição da mediação respeita o tamanho mínimo", () => rpc(como(ids.med), "comunidade_editar", { p_tipo: "topico", p_alvo: topico.id, p_titulo: "x", p_corpo: "Como eu somo frações?" }), "invalido:titulo");
await espera("mediador aprova e o público passa a ver", async () => { await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico.id, p_acao: "mostrar" }); return [await rpc(anon, "topicos_listar"), await rpc(como(ids.med), "comunidade_retidos")]; }, (r) => r[0].length === 1 && r[0][0].retido === false && r[1].length === 0);
await espera("quem escreveu é avisado da aprovação", () => rpc(como(ids.leitora), "avisos_meus"), (r) => r.some((a) => a.texto.includes("foi aprovada")));
await espera("professor responde", async () => (resposta = await rpc(como(ids.prof), "responder", { p_topico: topico.id, p_corpo: "Iguale os denominadores primeiro." })), (r) => Boolean(r.id));
await recusa("anônimo não vota", () => rpc(anon, "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: 1 }), "entre_primeiro");
await espera("voto para cima", () => rpc(como(ids.prof), "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: 1 }), (r) => r.pontos === 1);
await espera("votar de novo não soma duas vezes", () => rpc(como(ids.prof), "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: 1 }), (r) => r.pontos === 1);
await espera("trocar para baixo", () => rpc(como(ids.prof), "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: -1 }), (r) => r.pontos === -1);
await espera("retirar o voto", () => rpc(como(ids.prof), "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: 0 }), (r) => r.pontos === 0);
await recusa("voto com valor inválido", () => rpc(como(ids.prof), "votar", { p_tipo: "topico", p_alvo: topico.id, p_valor: 50 }), "invalido:voto");
await espera("voto em resposta", () => rpc(como(ids.leitora), "votar", { p_tipo: "resposta", p_alvo: resposta.id, p_valor: 1 }), (r) => r.pontos === 1);
await espera("lista pública mostra o tópico", () => rpc(anon, "topicos_listar"), (r) => r.length === 1 && r[0].respostas === 1 && r[0].autor === "Lia Leitora");
await espera("tópico com respostas e meu voto", () => rpc(como(ids.leitora), "topico_ver", { p_id: topico.id }), (r) => r.respostas.length === 1 && r.respostas[0].meu_voto === 1 && r.meu === true && r.pode_cuidar === false);
await espera("resposta adequada do público aparece na hora, e a mediação pode ocultar depois", async () => {
  const nova = await rpc(como(ids.leitora), "responder", { p_topico: topico.id, p_corpo: "Entendi, muito obrigada!" });
  const publico = await rpc(anon, "topico_ver", { p_id: topico.id });
  const contagem = (await rpc(anon, "topicos_listar"))[0].respostas;
  const fila = await rpc(como(ids.med), "comunidade_retidos");
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: nova.id, p_acao: "ocultar" });
  const depois = await rpc(anon, "topico_ver", { p_id: topico.id });
  const avisos = await rpc(como(ids.leitora), "avisos_meus");
  return [nova.retido, nova.bloqueado, publico.respostas.length, contagem, fila.length, depois.respostas.length, (await rpc(anon, "topicos_listar"))[0].respostas, avisos.some((x) => x.texto.includes("foi ocultada"))];
}, (r) => r[0] === false && r[1] === false && r[2] === 2 && r[3] === 2 && r[4] === 0 && r[5] === 1 && r[6] === 1 && r[7] === true);
await espera("toda mensagem guarda o veredito que recebeu", () => dono("select (select avaliacao from interno.topicos where id = $1) as topico, (select array_agg(distinct avaliacao) from interno.respostas where topico = $1) as respostas", [topico.id]), (r) => r.rows[0].topico === "revisao" && r.rows[0].respostas.join() === "publicada");
await recusa("leitora não oculta", () => rpc(como(ids.leitora), "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico.id, p_acao: "ocultar" }), "sem_permissao");
await espera("educador tranca", () => rpc(como(ids.prof), "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico.id, p_acao: "trancar" }));
await recusa("tópico trancado não recebe resposta", () => rpc(como(ids.leitora), "responder", { p_topico: topico.id, p_corpo: "Obrigada!" }), "topico_trancado");
await espera("curadoria oculta", () => rpc(como(ids.curadora), "comunidade_cuidar", { p_tipo: "topico", p_alvo: topico.id, p_acao: "ocultar" }));
await espera("oculto some para o público", () => rpc(anon, "topicos_listar"), (r) => r.length === 0);
await recusa("oculto não abre para o público", () => rpc(anon, "topico_ver", { p_id: topico.id }), "nao_encontrado");
await espera("quem cuida ainda vê o oculto", () => rpc(como(ids.curadora), "topicos_listar"), (r) => r.length === 1 && r[0].oculto === true);
await espera("coordenação suspende o troll", () => rpc(como(ids.coord), "usuario_suspender", { p_usuario: ids.troll, p_suspenso: true }));
await recusa("suspenso não cria tópico", () => rpc(como(ids.troll), "topico_criar", { p_titulo: "Mentira qualquer", p_corpo: "Texto de provocação.", p_disciplina: null }), "conta_suspensa");
await recusa("suspenso não contribui", () => rpc(como(ids.troll), "contribuir", { p: aula() }), "conta_suspensa");
await espera("denúncia anônima", () => rpc(anon, "denunciar", { p_alvo: "/acervo/x", p_motivo: "Direitos autorais", p_detalhes: "Esta obra não está em domínio público." }));
await recusa("leitora não lê denúncias", () => rpc(como(ids.leitora), "denuncias_listar"), "sem_permissao");
await espera("curadoria lê e resolve denúncia", async () => { const lista = await rpc(como(ids.curadora), "denuncias_listar"); await rpc(como(ids.curadora), "denuncia_resolver", { p_id: lista[0].id, p_nota: "Removido." }); return rpc(como(ids.curadora), "denuncias_listar"); }, (r) => r[0].status === "resolvida");

// ── Anotações ──
await recusa("leitora sem papel não anota", () => rpc(como(ids.leitora), "anotar", { p_caminho: "/trilhas/introducao-ao-marxismo/mais-valia", p_paragrafo: 2, p_trecho: "força de trabalho", p_corpo: "É a capacidade de trabalhar." }), "sem_permissao");
await recusa("caminho malformado", () => rpc(como(ids.prof), "anotar", { p_caminho: "javascript:alert(1)", p_paragrafo: 2, p_trecho: "", p_corpo: "Texto qualquer." }), "invalido:caminho");
await espera("educador anota e sai direto", () => rpc(como(ids.prof), "anotar", { p_caminho: "/trilhas/introducao-ao-marxismo/mais-valia", p_paragrafo: 2, p_trecho: "força de trabalho", p_corpo: "É a capacidade de trabalhar, não o trabalho feito." }));
let pendente;
await espera("revisor anota e fica pendente", async () => (pendente = await rpc(como(ids.revisor), "anotar", { p_caminho: "/trilhas/introducao-ao-marxismo/mais-valia", p_paragrafo: 3, p_trecho: "", p_corpo: "Vale reler o exemplo da costureira." })), (r) => Boolean(r.id));
await espera("público só vê as aprovadas", () => rpc(anon, "anotacoes_listar", { p_caminho: "/trilhas/introducao-ao-marxismo/mais-valia" }), (r) => r.length === 1);
await espera("autor vê a própria pendente", () => rpc(como(ids.revisor), "anotacoes_listar", { p_caminho: "/trilhas/introducao-ao-marxismo/mais-valia" }), (r) => r.length === 2);
await recusa("revisor não aprova anotação", () => rpc(como(ids.revisor), "anotacao_decidir", { p_id: pendente.id, p_status: "aprovada" }), "sem_permissao");
await espera("curadoria aprova anotação", () => rpc(como(ids.curadora), "anotacao_decidir", { p_id: pendente.id, p_status: "aprovada" }));

// ── Apoiadores ──
await recusa("curadoria não mexe no mural", () => rpc(como(ids.curadora), "apoiador_salvar", { p_id: null, p_nome: "Fulano", p_mensagem: "" }), "sem_permissao");
await espera("coordenação adiciona apoiador", () => rpc(como(ids.coord), "apoiador_salvar", { p_id: null, p_nome: "Maria da Silva", p_mensagem: "Pela educação popular." }), (r) => Boolean(r.id));
await espera("mural é público", () => rpc(anon, "apoiadores_listar"), (r) => r.length === 1 && r[0].nome === "Maria da Silva");

// ── Mural dos Trabalhadores ──
const anuncio = (extra = {}) => ({ categoria: "cooperativa", titulo: "Cooperativa de costureiras", descricao: "Uniformes, consertos e bolsas feitos por doze costureiras associadas.", cidade: "Recife", uf: "pe", contato: "WhatsApp (81) 90000-0000", link: "", ...extra });
let anuncioId;
let semConta;
await espera("quem não tem conta anuncia e recebe um código de retirada", async () => (semConta = await rpc({ papel: "anon", ip: "198.51.100.7" }, "mural_enviar", { p: anuncio({ titulo: "Lavadeira no Ibura", oficio: "Lavadeira", cidade: "Recife" }) })), (r) => Boolean(r.id) && /^[0-9A-F]{10}$/.test(r.codigo));
await recusa("anúncio sem estado é recusado", () => rpc({ papel: "anon", ip: "198.51.100.8" }, "mural_enviar", { p: anuncio({ uf: "" }) }), "invalido:uf");
await recusa("estado que não existe é recusado", () => rpc({ papel: "anon", ip: "198.51.100.8" }, "mural_enviar", { p: anuncio({ uf: "XX" }) }), "invalido:uf");
await recusa("anúncio sem cidade é recusado", () => rpc({ papel: "anon", ip: "198.51.100.8" }, "mural_enviar", { p: anuncio({ cidade: "" }) }), "invalido:cidade");
await recusa("anúncio com ameaça não entra nem na fila", () => rpc({ papel: "anon", ip: "198.51.100.9" }, "mural_enviar", { p: anuncio({ descricao: "Faço serviço de pedreiro. Quem não pagar, eu sei onde você mora." }) }), "conteudo_recusado");
await espera("campo-isca no mural finge que deu certo e não guarda nada", async () => { await rpc({ papel: "anon", ip: "198.51.100.10" }, "mural_enviar", { p: anuncio({ site: "http://spam" }) }); return dono("select count(*)::int as n from interno.mural"); }, (r) => r.rows[0].n === 1);
await recusa("código errado não retira anúncio", () => rpc(anon, "mural_retirar", { p_codigo: "0000000000" }), "nao_encontrado");
await espera("o código não fica guardado, só o selo dele", () => dono("select codigo from interno.mural where id = $1", [semConta.id]), (r) => /^[a-f0-9]{64}$/.test(r.rows[0].codigo) && !r.rows[0].codigo.includes(semConta.codigo.toLowerCase()));
await recusa("categoria desconhecida é recusada", () => rpc(como(ids.prof), "mural_enviar", { p: anuncio({ categoria: "emprestimo" }) }), "invalido:categoria");
await recusa("link do mural precisa ser https", () => rpc(como(ids.prof), "mural_enviar", { p: anuncio({ link: "javascript:alert(1)" }) }), "invalido:link");
await recusa("descrição curta demais é recusada", () => rpc(como(ids.prof), "mural_enviar", { p: anuncio({ descricao: "curta" }) }), "invalido:descricao");
await espera("trabalhador envia anúncio", async () => (anuncioId = (await rpc(como(ids.prof), "mural_enviar", { p: anuncio() })).id), (r) => Boolean(r));
await espera("anúncio pendente não aparece para o público", () => rpc(anon, "mural_listar"), (r) => r.length === 0);
await recusa("curadoria não decide o mural: é da coordenação", () => rpc(como(ids.curadora), "mural_decidir", { p_id: anuncioId, p_aprovar: true, p_nota: "" }), "sem_permissao");
await espera("quem enviou vê o próprio anúncio aguardando", () => rpc(como(ids.prof), "mural_meus"), (r) => r.length === 1 && r[0].status === "pendente");
await recusa("educador não decide anúncios", () => rpc(como(ids.prof), "mural_decidir", { p_id: anuncioId, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("quem não é curadoria não vê a fila do mural", () => rpc(como(ids.jornal), "mural_fila"), "sem_permissao");
await espera("coordenação vê a fila do mural, com os dois pedidos", () => rpc(como(ids.coord), "mural_fila"), (r) => r.length === 2 && r.some((a) => a.nome === "Paulo Professor") && r.some((a) => a.sem_conta && a.oficio === "Lavadeira"));
await espera("coordenação aprova os dois", async () => { await rpc(como(ids.coord), "mural_decidir", { p_id: semConta.id, p_aprovar: true, p_nota: "" }); return rpc(como(ids.coord), "mural_decidir", { p_id: anuncioId, p_aprovar: true, p_nota: "" }); }, (r) => r.ok);
await espera("anúncio aprovado aparece, com a sigla do estado corrigida", () => rpc(anon, "mural_listar"), (r) => r.length === 2 && r.every((a) => a.uf === "PE" && a.status === undefined));
await espera("filtro por cidade ignora acento e maiúsculas", () => rpc(anon, "mural_listar", { p_categoria: null, p_uf: "PE", p_cidade: "RECIFE", p_busca: null }), (r) => r.length === 2);
await espera("busca por ofício", () => rpc(anon, "mural_listar", { p_categoria: null, p_uf: null, p_cidade: null, p_busca: "lavadeira" }), (r) => r.length === 1 && r[0].titulo === "Lavadeira no Ibura");
await espera("lista de cidades com anúncio no ar", () => rpc(anon, "mural_cidades", { p_uf: "pe" }), (r) => r.length === 1 && r[0].cidade === "Recife" && r[0].total === 2);
await espera("quem anunciou sem conta retira com o código", async () => { await rpc(anon, "mural_retirar", { p_codigo: semConta.codigo.toLowerCase() }); return rpc(anon, "mural_listar"); }, (r) => r.length === 1);
await espera("filtro por categoria", () => rpc(anon, "mural_listar", { p_categoria: "arte", p_uf: null }), (r) => r.length === 0);
await espera("filtro por estado", () => rpc(anon, "mural_listar", { p_categoria: null, p_uf: "pe" }), (r) => r.length === 1);
await recusa("outra pessoa não edita o anúncio alheio", () => rpc(como(ids.jornal), "mural_enviar", { p: anuncio({ id: anuncioId, titulo: "Tomado por outra pessoa" }) }), "nao_encontrado");
await recusa("outra pessoa não retira o anúncio alheio", () => rpc(como(ids.jornal), "mural_remover", { p_id: anuncioId }), "nao_encontrado");
await espera("editar devolve o anúncio para a curadoria", async () => { await rpc(como(ids.prof), "mural_enviar", { p: anuncio({ id: anuncioId, titulo: "Cooperativa de costura do Ibura" }) }); return rpc(anon, "mural_listar"); }, (r) => r.length === 0);
await espera("anúncio vencido sai do ar e pode ser renovado", async () => {
  await rpc(como(ids.coord), "mural_decidir", { p_id: anuncioId, p_aprovar: true, p_nota: "" });
  await dono("update interno.mural set validade = now() - interval '1 day' where id = $1", [anuncioId]);
  const vencido = await rpc(anon, "mural_listar");
  await rpc(como(ids.prof), "mural_renovar", { p_id: anuncioId });
  return [vencido.length, (await rpc(anon, "mural_listar")).length];
}, (r) => r[0] === 0 && r[1] === 1);
await recusa("no máximo três anúncios por pessoa", async () => { for (let i = 0; i < 3; i++) await rpc(como(ids.prof), "mural_enviar", { p: anuncio({ titulo: `Outro anúncio ${i}` }) }); }, "limite_anuncios");
await espera("resumo do painel conta o mural", () => rpc(como(ids.coord), "painel_resumo"), (r) => r.mural === 2);
await recusa("curadoria não retira anúncio do mural", () => rpc(como(ids.curadora), "mural_remover", { p_id: anuncioId }), "nao_encontrado");
await espera("coordenação retira anúncio indevido", () => rpc(como(ids.coord), "mural_remover", { p_id: anuncioId }), (r) => r.ok);
// O painel retira do ar sem apagar: o anúncio aprovado vira "não aprovado", com a nota que quem anunciou lê.
let noAr;
await espera("coordenação vê no painel os anúncios que estão no ar", async () => {
  noAr = (await rpc({ papel: "anon", ip: "198.51.100.71" }, "mural_enviar", { p: anuncio({ titulo: "Aulas de violão", categoria: "servico" }) })).id;
  await rpc(como(ids.coord), "mural_decidir", { p_id: noAr, p_aprovar: true, p_nota: "" });
  return rpc(como(ids.coord), "mural_fila", { p_status: "aprovado" });
}, (r) => r.some((a) => a.id === noAr && a.validade));
await espera("coordenação retira do ar com nota, sem apagar", async () => {
  await rpc(como(ids.coord), "mural_decidir", { p_id: noAr, p_aprovar: false, p_nota: "Anúncio fora das regras do mural." });
  return [await rpc(anon, "mural_listar"), (await dono("select status, nota from interno.mural where id = $1", [noAr])).rows[0]];
}, ([lista, linha]) => !lista.some((a) => a.id === noAr) && linha.status === "recusado" && linha.nota.startsWith("Anúncio fora"));

// ── Mediação no Mural dos Trabalhadores ──
let doMural;
await espera("chega um anúncio para a mediação", async () => (doMural = (await rpc({ papel: "anon", ip: "198.51.100.70" }, "mural_enviar", { p: anuncio({ titulo: "conserto de bicicleta", oficio: "Mecânico de bicicleta", categoria: "servico" }) })).id), (r) => Boolean(r));
await recusa("curadoria não edita anúncio do mural", () => rpc(como(ids.curadora), "mural_editar", { p_id: doMural, p: anuncio() }), "sem_permissao");
await espera("mediador vê a fila do mural", () => rpc(como(ids.med), "mural_fila"), (r) => r.some((a) => a.id === doMural));
await espera("resumo do mediador conta o mural", () => rpc(como(ids.med), "painel_resumo"), (r) => r.mural >= 1);
await recusa("edição do mediador não aceita link estranho", () => rpc(como(ids.med), "mural_editar", { p_id: doMural, p: anuncio({ link: "javascript:alert(1)" }) }), "invalido:link");
await espera("mediador acerta o texto do anúncio", () => rpc(como(ids.med), "mural_editar", { p_id: doMural, p: anuncio({ titulo: "Conserto de bicicleta", oficio: "Mecânico de bicicleta" }) }));
await espera("mediador aprova e o anúncio vai ao ar corrigido", async () => { await rpc(como(ids.med), "mural_decidir", { p_id: doMural, p_aprovar: true, p_nota: "" }); return rpc(anon, "mural_listar", { p_categoria: null, p_uf: null, p_cidade: null, p_busca: "bicicleta" }); }, (r) => r.length === 1 && r[0].titulo === "Conserto de bicicleta" && r[0].categoria === "servico");
await recusa("anúncio já decidido não se edita", () => rpc(como(ids.med), "mural_editar", { p_id: doMural, p: anuncio() }), "nao_encontrado");
await recusa("mediador não apaga anúncio: retirar do ar é da coordenação", () => rpc(como(ids.med), "mural_remover", { p_id: doMural }), "nao_encontrado");
await recusa("mediador não mexe na rádio", () => rpc(como(ids.med), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" }), "sem_permissao");
await espera("coordenação retira o anúncio de teste", () => rpc(como(ids.coord), "mural_remover", { p_id: doMural }), (r) => r.ok);
// ── Banimento pela mediação ──
await espera("o baderneiro cria conta e aparece de uma origem", async () => { ids.bagunca = await criarUsuario("bagunca@teste.local", "Bagunça"); return rpc({ ...como(ids.bagunca), ip: "203.0.113.77" }, "eu"); }, (r) => r.papeis.length === 0);
let ofensa;
await espera("ele escreve uma provocação com propaganda, que fica na fila", async () => (ofensa = await rpc({ ...como(ids.bagunca), ip: "203.0.113.77" }, "topico_criar", { p_titulo: "Vocês são todos uns vendidos", p_corpo: "Texto de provocação repetido em toda conversa, leiam a verdade em meusite.com.br agora.", p_disciplina: null })), (r) => r.retido === true);
await espera("a fila mostra ao mediador de quem é a mensagem", () => rpc(como(ids.med), "comunidade_retidos"), (r) => r.some((m) => m.id === ofensa.id && m.autor_id === ids.bagunca));
await recusa("educador não bane", () => rpc(como(ids.prof), "mediacao_banir", { p_usuario: ids.bagunca, p_motivo: "Provocação repetida.", p_origem: false }), "sem_permissao");
await recusa("participante não bane participante", () => rpc(como(ids.leitora), "mediacao_banir", { p_usuario: ids.bagunca, p_motivo: "Não gostei dele.", p_origem: false }), "sem_permissao");
await recusa("banir exige motivo", () => rpc(como(ids.med), "mediacao_banir", { p_usuario: ids.bagunca, p_motivo: "", p_origem: false }), "invalido:motivo");
await recusa("mediador não bane gente da equipe", () => rpc(como(ids.med), "mediacao_banir", { p_usuario: ids.prof, p_motivo: "Discordei do professor.", p_origem: false }), "sem_permissao");
await recusa("mediador não bane a coordenação", () => rpc(como(ids.med), "mediacao_banir", { p_usuario: ids.coord, p_motivo: "Tentativa de golpe.", p_origem: true }), "sem_permissao");
await recusa("mediador não bane a si mesmo", () => rpc(como(ids.med), "mediacao_banir", { p_usuario: ids.med, p_motivo: "Engano meu aqui.", p_origem: false }), "sem_permissao");
await espera("mediador bane a conta", () => rpc(como(ids.med), "mediacao_banir", { p_usuario: ids.bagunca, p_motivo: "Provocação repetida depois de avisado.", p_origem: false }), (r) => r.ok && r.origem === false);
await recusa("conta banida não escreve mais", () => rpc({ ...como(ids.bagunca), ip: "203.0.113.77" }, "topico_criar", { p_titulo: "Voltei para provocar", p_corpo: "Mais um texto de provocação.", p_disciplina: null }), "conta_suspensa");
await espera("o que ela tinha na fila sai da fila sem ir ao ar", async () => [await rpc(como(ids.med), "comunidade_retidos"), await rpc(anon, "topicos_listar")], (r) => !r[0].some((m) => m.id === ofensa.id) && !r[1].some((t) => t.id === ofensa.id));
await espera("sem o banimento de origem, a mesma rede continua podendo enviar", () => rpc({ papel: "anon", ip: "203.0.113.77" }, "denunciar", { p_alvo: "/acervo/x", p_motivo: "Outro", p_detalhes: "Teste de envio da mesma origem." }));
await espera("caso extremo: mediador bane de novo, agora com a origem", () => rpc(como(ids.med), "mediacao_banir", { p_usuario: ids.bagunca, p_motivo: "Criou contas novas para continuar atacando.", p_origem: true }), (r) => r.origem === true);
await recusa("da origem barrada não entra contribuição sem conta", () => rpc({ papel: "anon", ip: "203.0.113.77" }, "contribuir", { p: aula({ titulo: "Voltei sem conta" }) }), "acesso_bloqueado");
await recusa("nem anúncio no mural", () => rpc({ papel: "anon", ip: "203.0.113.77" }, "mural_enviar", { p: anuncio() }), "acesso_bloqueado");
await recusa("nem conta nova da mesma origem escreve na comunidade", async () => { const outra = await criarUsuario("bagunca2@teste.local", "Bagunça 2"); await rpc({ ...como(outra), ip: "203.0.113.77" }, "eu"); return rpc({ ...como(outra), ip: "203.0.113.77" }, "topico_criar", { p_titulo: "Conta nova, mesma rede", p_corpo: "Tentando de novo com outra conta.", p_disciplina: null }); }, "acesso_bloqueado");
await espera("outra origem continua enviando normalmente", () => rpc({ papel: "anon", ip: "203.0.113.78" }, "contribuir", { p: aula({ titulo: "De outra rede" }) }), (r) => Boolean(r.id));
await espera("a equipe não é barrada pela origem", () => rpc({ ...como(ids.prof), ip: "203.0.113.77" }, "responder", { p_topico: topico.id, p_corpo: "Resposta da equipe pela mesma rede." }).catch((e) => String(e.message)), (r) => r === "nao_encontrado" || r === "topico_trancado" || Boolean(r.id));
await espera("o banco não guarda o endereço de rede, só o código embaralhado", () => dono("select origem from interno.banimentos where origem is not null"), (r) => r.rows.length === 1 && /^[a-f0-9]{32}$/.test(r.rows[0].origem) && !r.rows[0].origem.includes("203"));
await recusa("participante não vê a lista de banimentos", () => rpc(como(ids.leitora), "banimentos_listar"), "sem_permissao");
let banimentos;
await espera("mediador vê os banimentos, sem e-mail de ninguém", async () => (banimentos = await rpc(como(ids.med), "banimentos_listar")), (r) => r.length === 2 && r.filter((b) => b.ativo).length === 1 && r.find((b) => b.ativo).origem === true && !JSON.stringify(r).includes("@"));
await recusa("mediador não desfaz banimento: é com a coordenação", () => rpc(como(ids.med), "banimento_encerrar", { p_id: banimentos.find((b) => b.ativo).id }), "sem_permissao");
await espera("a coordenação é avisada do banimento", () => rpc(como(ids.coord), "avisos_meus"), (r) => r.some((a) => a.texto.includes("baniu a conta")));
await espera("coordenação desfaz: a conta volta e a origem é liberada", async () => { await rpc(como(ids.coord), "banimento_encerrar", { p_id: banimentos.find((b) => b.ativo).id }); return [await rpc(como(ids.bagunca), "eu"), await rpc({ papel: "anon", ip: "203.0.113.77" }, "contribuir", { p: aula({ titulo: "Depois do perdão" }) })]; }, (r) => r[0].suspenso === false && Boolean(r[1].id));
await espera("banimento fica no registro de atividades", () => rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "conta_banida" }), (r) => r.length === 2);

// ── Rádio ──
await espera("rádio fora do ar: público só vê que está fora", () => rpc(anon, "radio_estado"), (r) => r.no_ar === false && r.canais === undefined);
await recusa("curadoria não configura a rádio", () => rpc(como(ids.curadora), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" }), "sem_permissao");
let canal, faixa;
await espera("coordenação cria canal", async () => (canal = await rpc(como(ids.coord), "radio_canal_salvar", { p_id: null, p_nome: "Formação", p_descricao: "Aulas em áudio.", p_ordem: 1 })), (r) => Boolean(r.id));
await recusa("endereço de faixa inválido", () => rpc(como(ids.coord), "radio_faixa_salvar", { p_id: null, p_canal: canal.id, p_titulo: "x", p_artista: "", p_url: "javascript:alert(1)", p_duracao: 10, p_ordem: 0 }), "invalido:url");
// O site é servido em https e a regra de conteúdo só deixa tocar áudio https: faixa em http aceita não tocaria nunca.
await recusa("faixa em http é recusada (não tocaria no site)", () => rpc(como(ids.coord), "radio_faixa_salvar", { p_id: null, p_canal: canal.id, p_titulo: "x", p_artista: "", p_url: "http://exemplo.test/a.mp3", p_duracao: 10, p_ordem: 0 }), "invalido:url");
await espera("coordenação adiciona faixa", async () => (faixa = await rpc(como(ids.coord), "radio_faixa_salvar", { p_id: null, p_canal: canal.id, p_titulo: "O que é mais-valia", p_artista: "Instituto Lúcia", p_url: "https://exemplo.test/a.opus", p_duracao: 240, p_ordem: 0 })), (r) => Boolean(r.id));
await espera("coordenação pré-escuta com a rádio fora do ar", () => rpc(como(ids.coord), "radio_estado"), (r) => r.no_ar === false && r.canais.length === 1 && r.canais[0].faixas.length === 1);
await espera("público continua sem ver", () => rpc(como(ids.leitora), "radio_estado"), (r) => r.canais === undefined);
await espera("coordenação põe no ar", () => rpc(como(ids.coord), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" }), (r) => r.no_ar === true);
await espera("agora o público vê", () => rpc(anon, "radio_estado"), (r) => r.no_ar === true && r.canais[0].faixas[0].titulo === "O que é mais-valia");
await recusa("mediador não gerencia a rádio", () => rpc(como(ids.med), "radio_canal_salvar", { p_id: null, p_nome: "Canal indevido", p_descricao: "", p_ordem: 9 }), "sem_permissao");
await recusa("educador não gerencia a rádio", () => rpc(como(ids.prof), "radio_configurar", { p_no_ar: false, p_ao_vivo: "" }), "sem_permissao");
let canalDoJornal, faixaDoJornal;
await espera("jornalista é radialista: cria canal", async () => (canalDoJornal = await rpc(como(ids.jornal), "radio_canal_salvar", { p_id: null, p_nome: "Jornal falado", p_descricao: "As notícias da semana em áudio.", p_ordem: 2 })), (r) => Boolean(r.id));
await espera("jornalista adiciona faixa", async () => (faixaDoJornal = await rpc(como(ids.jornal), "radio_faixa_salvar", { p_id: null, p_canal: canalDoJornal.id, p_titulo: "Boletim da greve", p_artista: "Redação", p_url: "https://exemplo.test/b.opus", p_duracao: 180, p_ordem: 0 })), (r) => Boolean(r.id));
await espera("jornalista tira a rádio do ar, pré-escuta e põe de volta", async () => { await rpc(como(ids.jornal), "radio_configurar", { p_no_ar: false, p_ao_vivo: "" }); const fora = await rpc(como(ids.jornal), "radio_estado"); const publico = await rpc(anon, "radio_estado"); await rpc(como(ids.jornal), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" }); return [fora, publico]; }, (r) => r[0].canais.length === 2 && r[1].canais === undefined);
await espera("jornalista remove a faixa e o canal que criou", async () => { await rpc(como(ids.jornal), "radio_faixa_remover", { p_id: faixaDoJornal.id }); await rpc(como(ids.jornal), "radio_canal_remover", { p_id: canalDoJornal.id }); return rpc(anon, "radio_estado"); }, (r) => r.canais.length === 1);
await recusa("anônimo não guarda progresso", () => rpc(anon, "progresso_salvar", { p_faixa: faixa.id, p_segundos: 30 }), "entre_primeiro");
await espera("progresso guardado e lido", async () => { await rpc(como(ids.leitora), "progresso_salvar", { p_faixa: faixa.id, p_segundos: 95 }); return rpc(como(ids.leitora), "progresso_listar"); }, (r) => r[faixa.id] === 95);
await espera("progresso é de cada pessoa", () => rpc(como(ids.prof), "progresso_listar"), (r) => Object.keys(r).length === 0);

// ── Coordenação, vice-coordenação e sucessão ──
await recusa("ninguém recebe a coordenação por papel_conceder", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.vice, p_papel: "coordenacao", p_disciplina: null }), "invalido:papel");
await recusa("curadoria não nomeia vice-coordenação", () => rpc(como(ids.curadora), "papel_conceder", { p_usuario: ids.vice, p_papel: "vice", p_disciplina: null }), "sem_permissao");
await espera("coordenação nomeia a vice-coordenação", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.vice, p_papel: "vice", p_disciplina: null }));
await espera("vice-coordenação confia papéis de trabalho", async () => {
  await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.mentora, p_papel: "mentoria", p_disciplina: "matematica" });
  await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.designer, p_papel: "design", p_disciplina: null });
  return rpc(como(ids.mentora), "eu");
}, (r) => r.papeis[0].papel === "mentoria" && r.avisos === 1);
await espera("vice-coordenação faz tudo o que a curadoria faz", async () => [await rpc(como(ids.vice), "mural_fila"), await rpc(como(ids.vice), "denuncias_listar"), await rpc(como(ids.vice), "fila")], (r) => r.every(Array.isArray));
await recusa("vice-coordenação não nomeia outra vice", () => rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.curadora, p_papel: "vice", p_disciplina: null }), "sem_permissao");
await recusa("vice-coordenação não remove a coordenação", () => rpc(como(ids.vice), "papel_remover", { p_id: papelCoord }), "sem_permissao");
await recusa("vice-coordenação não suspende a coordenação", () => rpc(como(ids.vice), "usuario_suspender", { p_usuario: ids.coord, p_suspenso: true }), "sem_permissao");
await recusa("curadoria não suspende a vice-coordenação", () => rpc(como(ids.curadora), "usuario_suspender", { p_usuario: ids.vice, p_suspenso: true }), "sem_permissao");
await espera("vice-coordenação vê voluntários e registro", async () => [await rpc(como(ids.vice), "voluntarios_listar"), await rpc(como(ids.vice), "auditoria_listar")], (r) => r[0].length === 14 && r[1].some((a) => a.acao === "papel_confiado"));
await recusa("curadoria não lê o registro de atividades", () => rpc(como(ids.curadora), "auditoria_listar"), "sem_permissao");
await recusa("vice-coordenação não define a sucessão", () => rpc(como(ids.vice), "sucessao_definir", { p_usuarios: [ids.vice] }), "sem_permissao");
await recusa("a coordenação não entra na própria sucessão", () => rpc(como(ids.coord), "sucessao_definir", { p_usuarios: [ids.coord] }), "invalido:usuarios");
await espera("coordenação define a ordem de sucessão", async () => { await rpc(como(ids.coord), "sucessao_definir", { p_usuarios: [ids.vice, ids.curadora] }); return rpc(como(ids.vice), "sucessao_ver"); }, (r) => r.ordem.length === 2 && r.ordem[0].nome === "Vera Vice");
await espera("com a coordenação ativa nada muda", () => rpc(como(ids.vice), "eu"), (r) => r.papeis.some((p) => p.papel === "vice") && !r.papeis.some((p) => p.papel === "coordenacao"));
await espera("coordenação parada há mais de 90 dias: a primeira da ordem assume", async () => {
  await dono("update interno.perfis set visto_em = now() - interval '91 days' where id = $1", [ids.coord]);
  const vice = await rpc(como(ids.vice), "eu");
  const antigo = (await dono("select papel from interno.papeis where usuario = $1", [ids.coord])).rows.map((x) => x.papel);
  return [vice.papeis.map((p) => p.papel), antigo];
}, (r) => r[0].includes("coordenacao") && !r[0].includes("vice") && r[1].includes("vice") && !r[1].includes("coordenacao"));
await espera("quem assumiu devolve a coordenação", async () => { await rpc(como(ids.vice), "lideranca_passar", { p_usuario: ids.coord }); return rpc(como(ids.coord), "eu"); }, (r) => r.papeis.some((p) => p.papel === "coordenacao"));
await recusa("quem não lidera não passa a coordenação", () => rpc(como(ids.vice), "lideranca_passar", { p_usuario: ids.vice }), "sem_permissao");

// ── Convites: não existe cadastro aberto ──
let convite;
// ── Cadastro aberto: participante da comunidade, sem função ──
await espera("qualquer pessoa cria conta sem convite e nasce sem função, com codinome", async () => { ids.povo = await criarUsuario("povo@teste.local", "Maria do Povo"); return rpc(como(ids.povo), "eu"); }, (r) => r.papeis.length === 0 && /^Estudante \d{5}$/.test(r.nome));
await espera("quem se cadastrou pergunta, e a pergunta aparece na hora", async () => { const t = await rpc(como(ids.povo), "topico_criar", { p_titulo: "O que é mais-valia?", p_corpo: "Li a palavra na aula e não entendi direito.", p_disciplina: null, p_tipo: "duvida" }); await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "topico", p_alvo: t.id, p_acao: "ocultar" }); return t; }, (r) => r.retido === false && r.bloqueado === false);
await recusa("quem se cadastrou não entra no painel da equipe", () => rpc(como(ids.povo), "fila"), "sem_permissao");
await recusa("nem faz triagem", () => rpc(como(ids.povo), "triagem_fila"), "sem_permissao");
await recusa("código inventado não cria conta", () => criarUsuario("penetra@teste.local", "Penetra", "0".repeat(64)), "convite_invalido");
await espera("o site informa que o cadastro está aberto", () => rpc(anon, "site"), (r) => r.cadastro === true);
await recusa("mediador não fecha o cadastro", () => rpc(como(ids.med), "site_salvar", { p: { faixa: "", pausa: false, motivo: "", cadastro: false } }), "sem_permissao");
await espera("coordenação fecha o cadastro", () => rpc(como(ids.coord), "site_salvar", { p: { faixa: "", pausa: false, motivo: "", cadastro: false } }), (r) => r.cadastro === false);
await recusa("com o cadastro fechado, conta sem convite não é criada", () => criarUsuario("penetra@teste.local", "Penetra"), "convite_obrigatorio");
await espera("guardar a faixa não reabre o cadastro por descuido", () => rpc(como(ids.coord), "site_salvar", { p: { faixa: "Ato na quinta", pausa: false, motivo: "" } }), (r) => r.cadastro === false);
await espera("coordenação reabre o cadastro", () => rpc(como(ids.coord), "site_salvar", { p: { faixa: "", pausa: false, motivo: "", cadastro: true } }), (r) => r.cadastro === true);

await recusa("educador não cria convite", () => rpc(como(ids.prof), "convite_criar", { p: { email: "nova@teste.local" } }), "sem_permissao");
await recusa("anônimo não cria convite", () => rpc(anon, "convite_criar", { p: { email: "nova@teste.local" } }), "entre_primeiro");
await recusa("convite com função precisa de e-mail", () => rpc(como(ids.coord), "convite_criar", { p: { papel: "revisao" } }), "invalido:email");
await recusa("convite de educador precisa de disciplina", () => rpc(como(ids.coord), "convite_criar", { p: { email: "nova@teste.local", papel: "educacao" } }), "invalido:disciplina");
await recusa("ninguém convida para a coordenação", () => rpc(como(ids.coord), "convite_criar", { p: { email: "nova@teste.local", papel: "coordenacao" } }), "invalido:papel");
await recusa("vice não convida curadoria", () => rpc(como(ids.vice), "convite_criar", { p: { email: "nova@teste.local", papel: "curadoria" } }), "sem_permissao");
await espera("coordenação cria convite pessoal de educadora de química", async () => (convite = await rpc(como(ids.coord), "convite_criar", { p: { email: "Quimica@Teste.Local", papel: "educacao", disciplina: "quimica", nota: "Professora da rede estadual" } })), (r) => /^[a-f0-9]{64}$/.test(r.codigo));
await espera("o banco guarda o selo, nunca o código", () => dono("select selo from interno.convites where id = $1", [convite.id]), (r) => r.rows[0].selo !== convite.codigo && r.rows[0].selo.length === 64);
await espera("a página de entrada reconhece o convite", () => rpc(anon, "convite_ver", { p_codigo: convite.codigo }), (r) => r.valido && r.email === "quimica@teste.local" && r.papel === "educacao");
await espera("de convite que não existe, não diz nada", () => rpc(anon, "convite_ver", { p_codigo: "abc" }), (r) => r.valido === false && Object.keys(r).length === 1);
await recusa("convite pessoal não serve para outro e-mail", () => criarUsuario("outra@teste.local", "Outra", convite.codigo), "convite_de_outro_email");
await espera("quem foi convidada cria a conta e já chega com a função", async () => { ids.quimica = await criarUsuario("quimica@teste.local", "Quitéria", convite.codigo); return rpc(como(ids.quimica), "eu"); }, (r) => r.papeis.length === 1 && r.papeis[0].papel === "educacao" && r.papeis[0].disciplina === "quimica" && /^Estudante \d{5}$/.test(r.nome));
await espera("o código gasto não fica guardado junto da conta", () => dono("select raw_user_meta_data from auth.users where id = $1", [ids.quimica]), (r) => !("convite" in r.rows[0].raw_user_meta_data));
await recusa("convite pessoal vale uma vez só", () => criarUsuario("quimica2@teste.local", "Q2", convite.codigo), "convite_invalido");
await espera("aceite fica no registro de atividades", () => rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "convite_aceito" }), (r) => r.length === 1);
let aberto;
await espera("vice cria convite da comunidade, para várias pessoas e sem função", async () => (aberto = await rpc(como(ids.vice), "convite_criar", { p: { usos: 2, dias: 3, nota: "Grupo do cursinho" } })), (r) => Boolean(r.codigo));
await espera("duas pessoas entram com o mesmo convite, sem função nenhuma", async () => { const a = await criarUsuario("aluna1@teste.local", "A1", aberto.codigo); await criarUsuario("aluno2@teste.local", "A2", aberto.codigo); return rpc(como(a), "eu"); }, (r) => r.papeis.length === 0);
await recusa("a terceira já não entra", () => criarUsuario("aluna3@teste.local", "A3", aberto.codigo), "convite_invalido");
await espera("coordenação vê os convites sem ver nenhum código", () => rpc(como(ids.coord), "convites_listar"), (r) => r.length === 2 && r.every((c) => !("selo" in c) && !("codigo" in c)) && r.every((c) => c.valido === false));
await espera("convite revogado deixa de valer", async () => { const c = await rpc(como(ids.coord), "convite_criar", { p: { email: "tarde@teste.local" } }); await rpc(como(ids.vice), "convite_revogar", { p_id: c.id }); return rpc(anon, "convite_ver", { p_codigo: c.codigo }); }, (r) => r.valido === false);
await espera("convite vencido deixa de valer", async () => { const c = await rpc(como(ids.coord), "convite_criar", { p: { email: "velho@teste.local" } }); await dono("update interno.convites set expira_em = now() - interval '1 minute' where id = $1", [c.id]); return rpc(anon, "convite_ver", { p_codigo: c.codigo }); }, (r) => r.valido === false);
await recusa("logado não gera convite pelo banco", () => rpc(como(ids.coord), "convidar_pelo_banco", { p_email: "x@teste.local" }), "permission denied");
await espera("dono do banco gera convite de emergência", () => dono("select public.convidar_pelo_banco('socorro@teste.local') as r"), (r) => /^\/pt\/entrar\?convite=[a-f0-9]{64}$/.test(r.rows[0].r));

// ── Candidatura pública de voluntariado ──
const inscricao = (extra = {}) => ({ nome: "Helena Trabalhadora", email: "Helena@Teste.Local", papel: "mediacao", mensagem: "Sou delegada sindical e quero ajudar a manter o debate em ordem.", ...extra });
let pedidoHelena, pedidoPovo;
await recusa("candidatura sem e-mail válido", () => rpc({ papel: "anon", ip: "198.51.100.90" }, "voluntariar", { p: inscricao({ email: "sem-arroba" }) }), "invalido:email");
await recusa("candidatura com apresentação curta", () => rpc({ papel: "anon", ip: "198.51.100.90" }, "voluntariar", { p: inscricao({ mensagem: "Quero ajudar." }) }), "invalido:mensagem");
await recusa("ninguém se candidata à coordenação", () => rpc({ papel: "anon", ip: "198.51.100.90" }, "voluntariar", { p: inscricao({ papel: "coordenacao" }) }), "invalido:papel");
await recusa("educador precisa dizer a disciplina na candidatura", () => rpc({ papel: "anon", ip: "198.51.100.90" }, "voluntariar", { p: inscricao({ papel: "educacao" }) }), "invalido:disciplina");
await espera("quem não tem conta se candidata a mediador", async () => (pedidoHelena = await rpc({ papel: "anon", ip: "198.51.100.91" }, "voluntariar", { p: inscricao() })), (r) => Boolean(r.id));
await recusa("candidatura repetida não entra duas vezes", () => rpc({ papel: "anon", ip: "198.51.100.91" }, "voluntariar", { p: inscricao() }), "ja_pediu");
await espera("campo-isca na candidatura não guarda nada", async () => { await rpc({ papel: "anon", ip: "198.51.100.92" }, "voluntariar", { p: inscricao({ email: "robo@teste.local", site: "http://spam" }) }); return dono("select count(*)::int as n from interno.inscricoes"); }, (r) => r.rows[0].n === 1);
await recusa("no máximo três candidaturas por dia da mesma origem", async () => { for (let i = 0; i < 4; i++) await rpc({ papel: "anon", ip: "198.51.100.93" }, "voluntariar", { p: inscricao({ email: `serie${i}@teste.local` }) }); }, "muitos_pedidos");
await espera("quem já tem conta também usa o formulário", async () => (pedidoPovo = await rpc({ papel: "anon", ip: "198.51.100.94" }, "voluntariar", { p: inscricao({ nome: "Maria do Povo", email: "povo@teste.local", papel: "educacao", disciplina: "historia", mensagem: "Sou professora de história da rede municipal há oito anos." }) })), (r) => Boolean(r.id));
await recusa("mediador não vê as candidaturas (têm e-mail)", () => rpc(como(ids.med), "inscricoes_listar"), "sem_permissao");
await recusa("anônimo não vê as candidaturas", () => rpc(anon, "inscricoes_listar"), "entre_primeiro");
await recusa("curadoria não decide candidatura", () => rpc(como(ids.curadora), "inscricao_decidir", { p_id: pedidoHelena.id, p_aceitar: true }), "sem_permissao");
await espera("coordenação vê a fila de candidaturas", () => rpc(como(ids.coord), "inscricoes_listar"), (r) => r.filter((i) => i.status === "pendente").length === 5 && r.find((i) => i.id === pedidoHelena.id).email === "helena@teste.local" && r.find((i) => i.id === pedidoPovo.id).tem_conta === true);
await espera("o resumo da coordenação conta as candidaturas", () => rpc(como(ids.coord), "painel_resumo"), (r) => r.candidaturas >= 5);
let aceite;
await espera("aceitar quem não tem conta gera um convite pessoal com a função", async () => (aceite = await rpc(como(ids.coord), "inscricao_decidir", { p_id: pedidoHelena.id, p_aceitar: true })), (r) => /^[a-f0-9]{64}$/.test(r.codigo) && r.email === "helena@teste.local");
await recusa("candidatura já decidida não se decide de novo", () => rpc(como(ids.coord), "inscricao_decidir", { p_id: pedidoHelena.id, p_aceitar: false }), "nao_encontrado");
await recusa("o convite da candidatura não serve para outro e-mail", () => criarUsuario("intrusa@teste.local", "Intrusa", aceite.codigo), "convite_de_outro_email");
await espera("a aprovada cria a conta pelo convite e já chega como mediadora", async () => { ids.helena = await criarUsuario("helena@teste.local", "Helena", aceite.codigo); return rpc(como(ids.helena), "eu"); }, (r) => r.papeis.length === 1 && r.papeis[0].papel === "mediacao");
await espera("aceitar quem já tem conta entrega a função na hora, sem convite", async () => { const r = await rpc(como(ids.vice), "inscricao_decidir", { p_id: pedidoPovo.id, p_aceitar: true }); return [r, await rpc(como(ids.povo), "eu")]; }, (r) => r[0].codigo === null && r[1].papeis.some((p) => p.papel === "educacao" && p.disciplina === "historia") && r[1].avisos >= 1);
await espera("coordenação recusa as demais e a fila esvazia", async () => { for (const i of (await rpc(como(ids.coord), "inscricoes_listar")).filter((x) => x.status === "pendente")) await rpc(como(ids.coord), "inscricao_decidir", { p_id: i.id, p_aceitar: false }); return rpc(como(ids.coord), "inscricoes_listar"); }, (r) => r.every((i) => i.status !== "pendente"));
await recusa("só o coordenador aceita candidatura à curadoria", async () => { const c = await rpc({ papel: "anon", ip: "198.51.100.95" }, "voluntariar", { p: inscricao({ email: "cura@teste.local", papel: "curadoria" }) }); try { return await rpc(como(ids.vice), "inscricao_decidir", { p_id: c.id, p_aceitar: true }); } finally { await rpc(como(ids.coord), "inscricao_decidir", { p_id: c.id, p_aceitar: false }).catch(() => {}); } }, "sem_permissao");

// ── Trabalho em conjunto ──
let conjunta;
await espera("educador envia uma aula que vai precisar de desenho", async () => (conjunta = await rpc(como(ids.prof), "contribuir", { p: aula({ titulo: "Função afim com gráficos" }) })), (r) => Boolean(r.id));
await recusa("designer não abre a aula de outro sem ser chamado", () => rpc(como(ids.designer), "contribuicao_ver", { p_id: conjunta.id }), "sem_permissao");
await recusa("designer não edita a aula sem ser chamado", () => rpc(como(ids.designer), "contribuicao_editar", { p_id: conjunta.id, p: aula({ titulo: "Tomada" }) }), "sem_permissao");
await recusa("ninguém libera a contribuição de outra pessoa", () => rpc(como(ids.jornal), "colaboracao_abrir", { p_id: conjunta.id, p_usuario: ids.designer }), "sem_permissao");
await recusa("não se chama quem não é da equipe", () => rpc(como(ids.prof), "colaboracao_abrir", { p_id: conjunta.id, p_usuario: ids.leitora }), "invalido:usuario");
await recusa("não se chama a si mesmo", () => rpc(como(ids.prof), "colaboracao_abrir", { p_id: conjunta.id, p_usuario: ids.prof }), "invalido:usuario");
await espera("educador chama o designer e ele recebe o recado na hora", async () => { await rpc(como(ids.prof), "colaboracao_abrir", { p_id: conjunta.id, p_usuario: ids.designer }); return rpc(como(ids.designer), "avisos_meus"); }, (r) => r.some((x) => x.texto.includes("Função afim com gráficos")));
await espera("a aula aparece em compartilhadas comigo", () => rpc(como(ids.designer), "colaboracoes_minhas"), (r) => r.length === 1 && r[0].id === conjunta.id);
await espera("o resumo do painel conta o que foi compartilhado", () => rpc(como(ids.designer), "painel_resumo"), (r) => r.juntas === 1);
await espera("o designer abre e vê que é colaborador", () => rpc(como(ids.designer), "contribuicao_ver", { p_id: conjunta.id }), (r) => r.colaboro === true && r.minha === false && r.colaboradores.length === 1 && r.colaboradores[0].nome === "Davi Designer");
let versaoAntiga;
await espera("a contribuição tem versão, que quem edita devolve", async () => (versaoAntiga = (await rpc(como(ids.prof), "contribuicao_ver", { p_id: conjunta.id })).versao), (r) => typeof r === "string" && r.length > 10);
await espera("o designer edita a aula do educador", async () => { await rpc(como(ids.designer), "contribuicao_editar", { p_id: conjunta.id, p: { titulo: "Função afim com gráficos", corpo: "Texto da aula, agora com a figura do gráfico da função.", dados: aula().dados, fontes: fonte } }); return rpc(como(ids.prof), "contribuicao_ver", { p_id: conjunta.id }); }, (r) => r.corpo.includes("figura do gráfico") && r.minha === true);
await recusa("quem guarda por cima de uma versão antiga é avisado, e nada é sobrescrito", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: conjunta.id, p: { ...aula({ titulo: "Função afim com gráficos" }), versao: versaoAntiga } }), "mudou_enquanto_editava");
await espera("o texto do designer continua lá, com o nome de quem mexeu por último", () => rpc(como(ids.prof), "contribuicao_ver", { p_id: conjunta.id }), (r) => r.corpo.includes("figura do gráfico") && r.editado_por === "Davi Designer" && r.versao !== versaoAntiga);
await espera("com a versão atual, o educador guarda normalmente", async () => { const agora = await rpc(como(ids.prof), "contribuicao_ver", { p_id: conjunta.id }); await rpc(como(ids.prof), "contribuicao_editar", { p_id: conjunta.id, p: { titulo: agora.titulo, corpo: agora.corpo + " Revisado pelo educador.", dados: agora.dados, fontes: agora.fontes, versao: agora.versao } }); return rpc(como(ids.prof), "contribuicao_ver", { p_id: conjunta.id }); }, (r) => r.corpo.endsWith("Revisado pelo educador.") && r.editado_por !== "Davi Designer");
await recusa("versão que não é data é recusada", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: conjunta.id, p: { ...aula({ titulo: "Função afim com gráficos" }), versao: "'; drop table x; --" } }), "invalido:versao");
await recusa("o acesso vale só para aquela contribuição", () => rpc(como(ids.designer), "contribuicao_ver", { p_id: doProf.id }), "sem_permissao");
await recusa("colaborador não chama mais gente", () => rpc(como(ids.designer), "colaboracao_abrir", { p_id: conjunta.id, p_usuario: ids.revisor }), "sem_permissao");
await espera("quem liberou tira o acesso, e ele acaba na hora", async () => { await rpc(como(ids.prof), "colaboracao_fechar", { p_id: conjunta.id, p_usuario: ids.designer }); return rpc(como(ids.designer), "colaboracoes_minhas"); }, (r) => r.length === 0);
await espera("sem o acesso, o resumo volta a zero", () => rpc(como(ids.designer), "painel_resumo"), (r) => r.juntas === 0);
await recusa("sem o acesso, o designer não edita mais", () => rpc(como(ids.designer), "contribuicao_editar", { p_id: conjunta.id, p: aula({ titulo: "De novo" }) }), "sem_permissao");
await espera("a pessoa chamada pode sair sozinha", async () => { await rpc(como(ids.prof), "colaboracao_abrir", { p_id: conjunta.id, p_usuario: ids.designer }); await rpc(como(ids.designer), "colaboracao_fechar", { p_id: conjunta.id, p_usuario: ids.designer }); return rpc(como(ids.prof), "contribuicao_ver", { p_id: conjunta.id }); }, (r) => r.colaboradores.length === 0);
await recusa("quem não é da equipe não vê a lista de membros", () => rpc(como(ids.leitora), "equipe_membros"), "sem_permissao");
await espera("a equipe vê quem é quem, sem e-mail de ninguém", () => rpc(como(ids.designer), "equipe_membros"), (r) => r.length >= 6 && r.some((m) => m.eu && m.nome === "Davi") && !JSON.stringify(r).includes("@"));

// ── Controles do site ──
await espera("o site lê a configuração pública", () => rpc(anon, "site"), (r) => r.pausa === false && r.faixa === "");
await recusa("curadoria não mexe nos controles do site", () => rpc({ ...como(ids.curadora), aal: "aal2" }, "site_salvar", { p: { faixa: "x", pausa: true } }), "sem_permissao");
await espera("coordenação troca a faixa do alto e pausa os envios", () => rpc({ ...como(ids.coord), aal: "aal2" }, "site_salvar", { p: { faixa: "Amanhã, ato na praça às 17h", pausa: true, motivo: "Manutenção" } }), (r) => r.pausa === true);
await recusa("com a pausa, o mural não recebe anúncio de fora", () => rpc({ papel: "anon", ip: "198.51.100.60" }, "mural_enviar", { p: anuncio() }), "envios_pausados");
await recusa("com a pausa, o boletim não recebe assinatura", () => rpc({ papel: "anon", ip: "198.51.100.61" }, "boletim_assinar", { p_email: "nova@exemplo.com" }), "envios_pausados");
await recusa("com a pausa, contribuição de fora não entra", () => rpc({ papel: "anon", ip: "198.51.100.62" }, "contribuir", { p: aula() }), "envios_pausados");
await espera("a equipe continua trabalhando durante a pausa", () => rpc(como(ids.prof), "contribuir", { p: aula({ titulo: "Aula escrita durante a pausa" }) }), (r) => Boolean(r.id));
await espera("coordenação retoma os envios", async () => { await rpc({ ...como(ids.coord), aal: "aal2" }, "site_salvar", { p: { faixa: "", pausa: false } }); return rpc({ papel: "anon", ip: "198.51.100.63" }, "boletim_assinar", { p_email: "volta@exemplo.com" }); }, (r) => r.ok);
await dono("delete from interno.boletim");

// ── Boletim do jornal ──
await recusa("boletim recusa endereço inválido", () => rpc({ papel: "anon", ip: "198.51.100.40" }, "boletim_assinar", { p_email: "sem-arroba" }), "invalido:email");
await espera("qualquer pessoa assina o boletim, e assinar duas vezes não duplica", async () => { await rpc({ papel: "anon", ip: "198.51.100.40" }, "boletim_assinar", { p_email: " Leitora@Exemplo.com " }); await rpc({ papel: "anon", ip: "198.51.100.41" }, "boletim_assinar", { p_email: "leitora@exemplo.com" }); return dono("select email from interno.boletim"); }, (r) => r.rows.length === 1 && r.rows[0].email === "leitora@exemplo.com");
await espera("campo-isca no boletim não guarda nada", async () => { await rpc({ papel: "anon", ip: "198.51.100.42" }, "boletim_assinar", { p_email: "robo@exemplo.com", p_site: "x" }); return dono("select count(*)::int as n from interno.boletim"); }, (r) => r.rows[0].n === 1);
await recusa("quem não é do jornal não lê a lista do boletim", () => rpc(como(ids.prof), "boletim_listar"), "sem_permissao");
await recusa("anônimo não lê a lista do boletim", () => rpc(anon, "boletim_listar"), "entre_primeiro");
await espera("jornalista lê a lista e tira um endereço", async () => { const antes = await rpc(como(ids.jornal), "boletim_listar"); await rpc(como(ids.jornal), "boletim_remover", { p_email: "leitora@exemplo.com" }); return [antes.length, (await rpc(como(ids.coord), "boletim_listar")).length]; }, (r) => r[0] === 1 && r[1] === 0);

// ── Segundo fator, aparelhos e iscas ──
await recusa("exigência de segundo fator só liga com o próprio confirmado", () => rpc(como(ids.coord), "seguranca_configurar", { p_exigir_2fa: true }), "confirme_segundo_fator");
await espera("coordenação liga a exigência já com o segundo fator", () => rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: true }), (r) => r.exigir_2fa === true);
await recusa("sem segundo fator, a curadoria não decide nada", () => rpc(como(ids.curadora), "denuncias_listar"), "sem_permissao");
await espera("com segundo fator, decide", () => rpc({ ...como(ids.curadora), aal: "aal2" }, "denuncias_listar"), (r) => Array.isArray(r));
await espera("o painel sabe que falta o segundo fator", () => rpc(como(ids.curadora), "eu"), (r) => r.exige_segundo_fator === true && r.segundo_fator === false);
await espera("educador não precisa de segundo fator", () => rpc(como(ids.prof), "eu"), (r) => r.exige_segundo_fator === false);
await recusa("sem segundo fator, nem a coordenação desliga", () => rpc(como(ids.coord), "seguranca_configurar", { p_exigir_2fa: false }), "sem_permissao");
await espera("coordenação desliga a exigência", () => rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: false }), (r) => r.exigir_2fa === false);
const marca = (n) => String(n).repeat(64).slice(0, 64);
await recusa("marca de aparelho malformada", () => rpc(como(ids.prof), "acesso_registrar", { p_marca: "abc", p_rotulo: "Firefox" }), "invalido:marca");
await espera("primeiro aparelho não gera aviso", () => rpc(como(ids.prof), "acesso_registrar", { p_marca: marca("a"), p_rotulo: "Firefox em Linux" }), (r) => r.novo === false);
await espera("aparelho novo avisa a pessoa e a coordenação", async () => {
  const antes = (await rpc(como(ids.coord), "avisos_meus")).length;
  const resposta = await rpc(como(ids.prof), "acesso_registrar", { p_marca: marca("b"), p_rotulo: "Chrome em Android" });
  return [resposta.novo, (await rpc(como(ids.prof), "avisos_meus")).some((a) => a.texto.includes("aparelho novo")), (await rpc(como(ids.coord), "avisos_meus")).length - antes];
}, (r) => r[0] === true && r[1] === true && r[2] === 1);
await espera("o mesmo aparelho de novo não avisa", () => rpc(como(ids.prof), "acesso_registrar", { p_marca: marca("b"), p_rotulo: "Chrome em Android" }), (r) => r.novo === false);
await espera("recados marcados como lidos", async () => { await rpc(como(ids.prof), "aviso_ler", { p_id: null }); return rpc(como(ids.prof), "eu"); }, (r) => r.avisos === 0);
await espera("função-isca devolve vazio, registra e suspende a conta comum", async () => {
  const curioso = await criarUsuario("curioso@teste.local", "Curioso", (await rpc(como(ids.coord), "convite_criar", { p: { email: "curioso@teste.local" } })).codigo);
  await rpc(como(curioso), "eu");
  const resposta = await rpc(como(curioso), "exportar_usuarios");
  const suspenso = (await dono("select suspenso from interno.perfis where id = $1", [curioso])).rows[0].suspenso;
  const registro = (await rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "armadilha" })).length;
  return [resposta.length, suspenso, registro];
}, (r) => r[0] === 0 && r[1] === true && r[2] === 1);
await espera("isca chamada sem conta também fica registrada", async () => { await rpc({ papel: "anon", ip: "203.0.113.50" }, "admin_senhas"); return rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "armadilha" }); }, (r) => r.length === 2);
await espera("endereço-isca do site fica registrado, sem endereço de rede", async () => { await rpc({ papel: "anon", ip: "203.0.113.60" }, "isca", { p_caminho: "/wp-admin/install.php", p_agente: "sqlmap/1.7" }); return rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "isca" }); }, (r) => r.length === 1 && r[0].alvo === "/wp-admin/install.php" && r[0].detalhes.agente === "sqlmap/1.7" && !("origem" in r[0].detalhes));
await recusa("enxurrada de iscas da mesma origem é barrada", async () => { for (let n = 0; n < 25; n++) await rpc({ papel: "anon", ip: "203.0.113.61" }, "isca", { p_caminho: "/.env", p_agente: "x" }); }, "muitos_pedidos");

// ── Comunidade: dúvidas, resposta aceita e filtro ──
let duvida, r2;
await espera("abrir uma dúvida", async () => (duvida = await rpc(como(ids.jornal), "topico_criar", { p_titulo: "Como calculo porcentagem?", p_corpo: "Quanto é 15% de 240? Não entendi a regra.", p_disciplina: "matematica", p_tipo: "duvida" })), (r) => Boolean(r.id) && r.retido === false);
await espera("duas respostas", async () => {
  await rpc(como(ids.revisor), "responder", { p_topico: duvida.id, p_corpo: "Multiplique 240 por 15 e divida por 100." });
  r2 = await rpc(como(ids.prof), "responder", { p_topico: duvida.id, p_corpo: "15% é 15/100. 240 × 0,15 = 36." });
  return rpc(anon, "topicos_listar", { p_ordem: "novos", p_disciplina: null, p_pagina: 0, p_tipo: "duvida" });
}, (r) => r.length === 1 && r[0].resolvida === false && r[0].tipo === "duvida");
await recusa("outra pessoa não escolhe a resposta", () => rpc(como(ids.designer), "resposta_aceitar", { p_topico: duvida.id, p_resposta: r2.id }), "sem_permissao");
await espera("quem perguntou escolhe a resposta e ela vem primeiro", async () => { await rpc(como(ids.jornal), "resposta_aceitar", { p_topico: duvida.id, p_resposta: r2.id }); return rpc(anon, "topico_ver", { p_id: duvida.id }); },
  (r) => r.aceita === r2.id && r.respostas[0].id === r2.id && r.respostas[0].aceita === true && r.respostas[0].da_equipe === true);
await espera("busca por título ignora acento", () => rpc(anon, "topicos_listar", { p_ordem: "novos", p_disciplina: null, p_pagina: 0, p_tipo: null, p_busca: "PORCENTAGEM" }), (r) => r.length === 1);
await espera("filtro 'sem resposta' não traz a dúvida respondida", () => rpc(anon, "topicos_listar", { p_ordem: "sem_resposta" }), (r) => r.length === 0);
await espera("mensagem com termo do filtro fica retida", async () => {
  const retida = await rpc(como(ids.designer), "responder", { p_topico: duvida.id, p_corpo: "Seu RETARDADO, isso é óbvio." });
  const publico = await rpc(anon, "topico_ver", { p_id: duvida.id });
  const fila = await rpc(como(ids.prof), "comunidade_retidos");
  await rpc(como(ids.prof), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: retida.id, p_acao: "mostrar" });
  const depois = await rpc(anon, "topico_ver", { p_id: duvida.id });
  return [retida.retido, publico.respostas.length, fila.length, depois.respostas.length, (await rpc(como(ids.prof), "comunidade_retidos")).length, fila[0].filtro, fila[0].motivo];
}, (r) => r[0] === true && r[1] === 2 && r[2] === 1 && r[3] === 3 && r[4] === 0 && r[5] === true && r[6] === "filtro");
await espera("quem cuida da comunidade publica direto, mas o filtro vale para todo mundo", async () => [
  await rpc(como(ids.med), "responder", { p_topico: duvida.id, p_corpo: "Boa pergunta, a conta está certa." }),
  await rpc(como(ids.med), "responder", { p_topico: duvida.id, p_corpo: "Só um RETARDADO erraria isso." }),
], (r) => r[0].retido === false && r[1].retido === true);
const avaliar = async (texto, equipe = false) => (await dono("select interno.veredito($1, $2, null) ->> 'veredito' as v, interno.veredito($1, $2, null) ->> 'motivo' as m", [texto, equipe])).rows[0];
await espera("a avaliação separa o adequado, o duvidoso e a violação clara", async () => [
  await avaliar("Alguém pode explicar a diferença entre valor de uso e valor de troca?"),
  await avaliar("Me chama no zap 11 98765-4321 que eu explico"),
  await avaliar("Escreve para fulano@exemplo.com que ele resolve"),
  await avaliar("COMPREM O MEU CURSO AGORA, É A ÚLTIMA CHANCE DE MUDAR DE VIDA"),
  await avaliar("kkkkkkkkkkkkkkkkkkkkkkkk"),
  await avaliar("O Holocausto é mentira, todo mundo sabe"),
  await avaliar("A aula está em https://exemplo.org/aula", true),
], (r) => r[0].v === "publicar" && r[1].m === "contato" && r[2].v === "revisar" && r[3].m === "gritaria" && r[4].m === "repeticao" && r[5].v === "bloquear" && r[6].v === "publicar" && r.slice(1, 5).every((x) => x.v === "revisar"));
let bloqueada;
await espera("violação clara é bloqueada: não vai ao ar nem para a fila, e fica no registro", async () => {
  bloqueada = await rpc(como(ids.designer), "responder", { p_topico: duvida.id, p_corpo: "Vou te matar se você repetir isso." });
  const publico = await rpc(anon, "topico_ver", { p_id: duvida.id });
  const fila = await rpc(como(ids.med), "comunidade_retidos");
  const registro = await dono("select count(*)::int as n from interno.auditoria where acao = 'comunidade_bloqueada' and alvo = $1", [bloqueada.id]);
  return [bloqueada.bloqueado, bloqueada.retido, publico.respostas.some((x) => x.id === bloqueada.id), fila.some((x) => x.id === bloqueada.id), registro.rows[0].n];
}, (r) => r[0] === true && r[1] === false && r[2] === false && r[3] === false && r[4] === 1);
await espera("o bloqueio vale também para a equipe", () => rpc(como(ids.med), "responder", { p_topico: duvida.id, p_corpo: "Heil Hitler, pronto, falei." }), (r) => r.bloqueado === true);
await espera("a mediação revê um bloqueio: a mensagem aparece, entra na contagem e quem escreveu é avisado", async () => {
  const antes = (await rpc(anon, "topico_ver", { p_id: duvida.id })).respostas.length;
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: bloqueada.id, p_acao: "mostrar" });
  const depois = (await rpc(anon, "topico_ver", { p_id: duvida.id })).respostas.length;
  const marca = (await dono("select avaliacao from interno.respostas where id = $1", [bloqueada.id])).rows[0].avaliacao;
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: bloqueada.id, p_acao: "ocultar" });
  return [depois - antes, marca, (await rpc(anon, "topico_ver", { p_id: duvida.id })).respostas.length - antes];
}, (r) => r[0] === 1 && r[1] === "revista" && r[2] === 0);
await espera("se a avaliação falhar, nada é aprovado sozinho: a mensagem vai para a fila", async () => {
  await dono("create or replace function interno.avaliar(p_texto text, p_equipe boolean, p_autor uuid) returns jsonb language plpgsql as $f$ begin raise exception 'quebrou'; end $f$");
  const comErro = await rpc(como(ids.med), "responder", { p_topico: duvida.id, p_corpo: "Resposta comum, escrita com a avaliação fora do ar." });
  await dono("create or replace function interno.avaliar(p_texto text, p_equipe boolean, p_autor uuid) returns jsonb language sql as $f$ select '{\"veredito\": \"tudo certo\"}'::jsonb $f$");
  const semSentido = await rpc(como(ids.med), "responder", { p_topico: duvida.id, p_corpo: "Outra resposta comum, com a avaliação devolvendo bobagem." });
  await banco.instalarDeNovo();
  const fila = await rpc(como(ids.med), "comunidade_retidos");
  const motivos = fila.filter((x) => x.id === comErro.id || x.id === semSentido.id).map((x) => x.motivo);
  for (const x of [comErro, semSentido]) await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: x.id, p_acao: "ocultar" });
  const volta = await rpc(como(ids.med), "responder", { p_topico: duvida.id, p_corpo: "Com a avaliação de volta, mensagem comum aparece na hora." });
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: volta.id, p_acao: "ocultar" });
  return [comErro.retido, semSentido.retido, motivos.join(), volta.retido];
}, (r) => r[0] === true && r[1] === true && r[2] === "avaliacao_falhou,avaliacao_falhou" && r[3] === false);
await espera("disfarce de expressão grave não passa direto: vai para leitura humana", async () => [
  await avaliar("v0u t3 m4t4r se continuar com isso"),
  await avaliar("v o u  t e  m a t a r, pode esperar"),
  await avaliar("vooou te mataaaar, pode esperar"),
  await avaliar("H0l0c4ust0 é m3nt1r4, pesquisem"),
  await avaliar("Vou te mostrar como se resolve essa equação."),
], (r) => r.slice(0, 4).every((x) => x.v === "revisar" && x.m === "disfarce") && r[4].v === "publicar");

// ── Comunidade: segunda avaliação, feita fora do banco (desligada de nascença) ──
const notasLimpas = { hate: 0.001, "hate/threatening": 0.0001, harassment: 0.002, "harassment/threatening": 0.0001, sexual: 0.0001, "sexual/minors": 0.00001, violence: 0.002, "violence/graphic": 0.0001, "self-harm": 0.0001 };
const resultado = (sinalizado = false, categorias = {}, notas = {}) => ({ sinalizado, categorias: { ...Object.fromEntries(Object.keys(notasLimpas).map((n) => [n, false])), ...categorias }, notas: { ...notasLimpas, ...notas } });
const naFila = async (id) => (await rpc(como(ids.med), "comunidade_retidos")).find((x) => x.id === id);
const contas = () => dono("select (select count(*)::int from interno.perfis where suspenso) as suspensos, (select count(*)::int from interno.banimentos) as banidos");
const contasAntes = (await contas()).rows[0];
const visivel = async (id) => (await rpc(anon, "topico_ver", { p_id: duvida.id })).respostas.some((x) => x.id === id);
const enviar = (texto, quem = ids.med) => rpc(como(quem), "responder", { p_topico: duvida.id, p_corpo: texto });
await recusa("anônimo não liga a segunda avaliação", () => rpc(anon, "comunidade_avaliacao_externa", { p_ligar: true }), "permission denied");
await recusa("nem a coordenação pelo painel: é só pelo banco", () => rpc({ ...como(ids.coord), aal: "aal2" }, "comunidade_avaliacao_externa", { p_ligar: true }), "permission denied");
await recusa("logado não pega mensagem para avaliar", () => rpc(como(ids.troll), "comunidade_para_avaliar", { p_tipo: "resposta", p_id: duvida.id }), "sem_permissao");
await recusa("logado não entrega resultado de avaliação", () => rpc(como(ids.troll), "comunidade_avaliada", { p_tipo: "resposta", p_id: duvida.id, p_resultado: resultado() }), "sem_permissao");
await recusa("nem quem cuida da comunidade", () => rpc(como(ids.med), "comunidade_avaliada", { p_tipo: "resposta", p_id: duvida.id, p_resultado: resultado() }), "sem_permissao");
await espera("desligada, mensagem adequada segue aparecendo na hora", async () => { const r = await enviar("Com a segunda avaliação desligada, isto aparece na hora."); await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: r.id, p_acao: "ocultar" }); return r; }, (r) => r.retido === false && r.avaliando === false);
await espera("dono do banco liga a segunda avaliação, e fica no registro", async () => [(await dono("select public.comunidade_avaliacao_externa(true) as r")).rows[0].r, (await dono("select count(*)::int as n from interno.auditoria where acao = 'comunidade_avaliacao_externa'")).rows[0].n], (r) => r[0].startsWith("Segunda avaliação ligada") && r[1] === 1);

let adequada, nociva, ambigua, comFalha, semSentido, esquecida, sensivel;
await espera("ligada, mensagem adequada espera a segunda avaliação: oculta e na fila", async () => {
  adequada = await enviar("Divida 15 por 100 e multiplique por 240: dá 36.");
  return [adequada, await visivel(adequada.id), (await naFila(adequada.id))?.motivo];
}, (r) => r[0].retido === true && r[0].avaliando === true && r[0].bloqueado === false && r[1] === false && r[2] === "aguardando_avaliacao");
await espera("as regras do banco continuam sendo a primeira camada", async () => [await enviar("Vou te matar se repetir isso.", ids.jornal), await enviar("Seu RETARDADO, estuda mais.", ids.jornal), await enviar("Leiam tudo em meusite.com.br agora mesmo.", ids.jornal)],
  (r) => r[0].bloqueado === true && r[0].avaliando === false && r[1].retido === true && r[1].avaliando === false && r[2].retido === true && r[2].avaliando === false);
await espera("resultado entregue sem a mensagem ter sido pega para avaliar é ignorado", () => rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: adequada.id, p_resultado: resultado() }), (r) => r.veredito === "ignorado");
await espera("a função pega o texto uma vez só", async () => [await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: adequada.id }), await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: adequada.id })], (r) => r[0].texto.startsWith("Divida 15") && r[1] === null);
await espera("conteúdo adequado: publica, entra na contagem e sai da fila", async () => {
  const antes = (await rpc(anon, "topicos_listar", { p_ordem: "novos", p_disciplina: null, p_pagina: 0, p_tipo: "duvida" }))[0].respostas;
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: adequada.id, p_resultado: resultado() });
  const depois = (await rpc(anon, "topicos_listar", { p_ordem: "novos", p_disciplina: null, p_pagina: 0, p_tipo: "duvida" }))[0].respostas;
  return [r.veredito, await visivel(adequada.id), await naFila(adequada.id), depois - antes];
}, (r) => r[0] === "publicar" && r[1] === true && r[2] === undefined && r[3] === 1);
await espera("o mesmo resultado entregue de novo não muda nada", () => rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: adequada.id, p_resultado: resultado(true, { "hate/threatening": true }) }), (r) => r.veredito === "ignorado");
await espera("conteúdo nocivo: barrado, fora da fila, no registro, e a conta não é banida", async () => {
  nociva = await enviar("Texto que as regras não pegam, mas que ameaça um grupo.", ids.mentora);
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: nociva.id });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: nociva.id, p_resultado: resultado(true, { "hate/threatening": true }, { "hate/threatening": 0.96, hate: 0.8 }) });
  const conta = await dono("select (select suspenso from interno.perfis where id = $1) as suspenso, (select count(*)::int from interno.banimentos where usuario = $1 and ativo) as banimentos, (select count(*)::int from interno.auditoria where acao = 'comunidade_bloqueada' and alvo = $2) as registro, (select avaliacao from interno.respostas where id = $2::uuid) as avaliacao", [ids.mentora, nociva.id]);
  return [r.veredito, await visivel(nociva.id), await naFila(nociva.id), conta.rows[0]];
}, (r) => r[0] === "bloquear" && r[1] === false && r[2] === undefined && r[3].suspenso === false && r[3].banimentos === 0 && r[3].registro === 1 && r[3].avaliacao === "bloqueada");
await espera("nota muito alta de ódio barra mesmo sem a categoria de ameaça", async () => {
  const m = await enviar("Outro texto que as regras não pegam.", ids.mentora);
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  return rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: resultado(true, { hate: true }, { hate: 0.95 }) });
}, (r) => r.veredito === "bloquear");
await espera("caso ambíguo (sinalizado, sem gravidade): fica na fila para o mediador", async () => {
  ambigua = await enviar("Texto ríspido, que pode ser ataque ou só discordância.");
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: ambigua.id });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: ambigua.id, p_resultado: resultado(true, { harassment: true }, { harassment: 0.71 }) });
  return [r.veredito, await visivel(ambigua.id), (await naFila(ambigua.id))?.motivo];
}, (r) => r[0] === "revisar" && r[1] === false && r[2] === "avaliacao_externa");
await espera("caso ambíguo (não sinalizado, mas com nota alta): também fica na fila", async () => {
  const m = await enviar("Relato de aula sobre a tortura na ditadura, com detalhes.");
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: resultado(false, {}, { violence: 0.58 }) });
  const fila = (await naFila(m.id))?.motivo;
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "mostrar" });
  return [r.veredito, fila, await visivel(m.id)];
}, (r) => r[0] === "revisar" && r[1] === "avaliacao_externa" && r[2] === true);
await espera("quem fala de se machucar não é barrado: vai para leitura humana, com cuidado", async () => {
  sensivel = await enviar("Desabafo de quem está muito mal e pensa em se machucar.", ids.povo);
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: sensivel.id });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: sensivel.id, p_resultado: resultado(true, { "self-harm": true, "self-harm/intent": true }, { "self-harm": 0.97 }) });
  return [r.veredito, (await naFila(sensivel.id))?.motivo];
}, (r) => r[0] === "revisar" && r[1] === "cuidado");
for (const [nome, falha] of [["tempo esgotado", { erro: "tempo_esgotado" }], ["limite de requisições", { erro: "limite" }], ["serviço fora do ar", { erro: "indisponivel" }], ["sem chave", { erro: "sem_chave" }]]) {
  await espera(`falha da avaliação (${nome}): fica na fila, nunca publica`, async () => {
    comFalha = await enviar(`Mensagem comum enviada com a avaliação em falha: ${nome}.`);
    await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: comFalha.id });
    const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: comFalha.id, p_resultado: falha });
    const motivo = (await naFila(comFalha.id))?.motivo;
    const publica = await visivel(comFalha.id);
    await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: comFalha.id, p_acao: "ocultar" });
    return [r.veredito, motivo, publica];
  }, (r) => r[0] === "revisar" && r[1] === "avaliacao_externa_falhou" && r[2] === false);
}
for (const [nome, torto] of [["vazio", {}], ["sem as notas", { sinalizado: false, categorias: {} }], ["notas vazias", { sinalizado: false, categorias: {}, notas: {} }], ["nota que não é número", { sinalizado: false, categorias: {}, notas: { hate: "baixa" } }], ["sinalização que não é sim ou não", { sinalizado: "nao", categorias: {}, notas: { hate: 0.001 } }], ["uma lista no lugar do resultado", [1, 2, 3]], ["só um 'aprovado' inventado", { veredito: "publicar" }]]) {
  await espera(`resultado que não se entende (${nome}): fica na fila`, async () => {
    semSentido = await enviar(`Mensagem comum com resultado torto: ${nome}.`);
    await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: semSentido.id });
    const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: semSentido.id, p_resultado: torto });
    const motivo = (await naFila(semSentido.id))?.motivo;
    await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: semSentido.id, p_acao: "ocultar" });
    return [r.veredito, motivo];
  }, (r) => r[0] === "revisar" && r[1] === "avaliacao_externa_falhou");
}
await espera("se a função nunca rodar, a mensagem não aparece sozinha: o mediador decide", async () => {
  esquecida = await enviar("Mensagem comum que ninguém mandou avaliar.");
  const antes = [await visivel(esquecida.id), (await naFila(esquecida.id))?.motivo];
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: esquecida.id, p_acao: "mostrar" });
  return [...antes, await visivel(esquecida.id)];
}, (r) => r[0] === false && r[1] === "aguardando_avaliacao" && r[2] === true);
await espera("se a função pegar o texto e morrer no caminho, a mensagem continua na fila", async () => {
  const m = await enviar("Mensagem comum cuja avaliação ficou pela metade.");
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  const estado = [await visivel(m.id), (await naFila(m.id))?.motivo];
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  return estado;
}, (r) => r[0] === false && r[1] === "em_avaliacao");
await recusa("logado não lista o que espera avaliação", () => rpc(como(ids.med), "comunidade_pendentes"), "sem_permissao");
await espera("mensagem que ficou para trás é recuperada: reavaliada com segurança, sem decisão duplicada", async () => {
  const m = await enviar("Mensagem comum cujo autor fechou o navegador antes da avaliação.");
  const lista1 = (await rpc(servico, "comunidade_pendentes")).some((x) => x.id === m.id && x.tipo === "resposta");
  // Primeira tentativa: a função pega o texto e some. Dentro de dois minutos ninguém mais pega.
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  const emAndamento = [await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id }), (await rpc(servico, "comunidade_pendentes")).some((x) => x.id === m.id)];
  // Passados os dois minutos, volta a poder ser entregue.
  await dono("update interno.respostas set avaliacao_em = now() - interval '3 minutes' where id = $1", [m.id]);
  const lista2 = (await rpc(servico, "comunidade_pendentes")).some((x) => x.id === m.id);
  const segunda = await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  const antes = await visivel(m.id);
  // Chegam dois resultados (o atrasado da primeira tentativa e o da segunda): só o primeiro decide.
  const r1 = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: resultado() });
  const contagem1 = (await rpc(anon, "topicos_listar", { p_ordem: "novos", p_disciplina: null, p_pagina: 0, p_tipo: "duvida" }))[0].respostas;
  const r2 = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: resultado(true, { "hate/threatening": true }) });
  const contagem2 = (await rpc(anon, "topicos_listar", { p_ordem: "novos", p_disciplina: null, p_pagina: 0, p_tipo: "duvida" }))[0].respostas;
  const fim = await visivel(m.id);
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  return [lista1, emAndamento[0], emAndamento[1], lista2, Boolean(segunda?.texto), antes, r1.veredito, r2.veredito, contagem2 - contagem1, fim];
}, (r) => r[0] === true && r[1] === null && r[2] === false && r[3] === true && r[4] === true && r[5] === false && r[6] === "publicar" && r[7] === "ignorado" && r[8] === 0 && r[9] === true);
await espera("falha repetida para na terceira tentativa: a mensagem fica com o mediador, sem nunca ter aparecido", async () => {
  const m = await enviar("Mensagem comum enviada com o serviço fora do ar por muito tempo.");
  const vistas = [];
  for (let n = 0; n < 4; n++) {
    const entregue = await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
    if (entregue) await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: { erro: "indisponivel" } });
    vistas.push(Boolean(entregue), await visivel(m.id));
    await dono("update interno.respostas set avaliacao_em = now() - interval '3 minutes' where id = $1", [m.id]);
  }
  const fila = await naFila(m.id);
  const pendente = (await rpc(servico, "comunidade_pendentes")).some((x) => x.id === m.id);
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  return [vistas.join(), fila?.motivo, pendente];
}, (r) => r[0] === "true,false,true,false,true,false,false,false" && r[1] === "avaliacao_externa_falhou" && r[2] === false);
await espera("decisão do mediador vale mais que resultado atrasado", async () => {
  const m = await enviar("Mensagem comum que o mediador recusou antes de a avaliação voltar.");
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  return [await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: resultado() }), await visivel(m.id)];
}, (r) => r[0].veredito === "ignorado" && r[1] === false);
await espera("tópico novo segue o mesmo caminho", async () => {
  const novo = await rpc(como(ids.jornal), "topico_criar", { p_titulo: "Como se calcula a taxa de mais-valia?", p_corpo: "Vi a fórmula na aula e queria um exemplo com números.", p_disciplina: null, p_tipo: "duvida" });
  const antes = (await rpc(anon, "topicos_listar")).some((x) => x.id === novo.id);
  const texto = await rpc(servico, "comunidade_para_avaliar", { p_tipo: "topico", p_id: novo.id });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "topico", p_id: novo.id, p_resultado: resultado() });
  const depois = (await rpc(anon, "topicos_listar")).some((x) => x.id === novo.id);
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "topico", p_alvo: novo.id, p_acao: "ocultar" });
  return [novo.avaliando, antes, texto.texto.includes("mais-valia") && texto.texto.includes("exemplo com números"), r.veredito, depois];
}, (r) => r[0] === true && r[1] === false && r[2] === true && r[3] === "publicar" && r[4] === true);
await espera("nenhuma decisão automática suspendeu ou baniu alguém", contas, (r) => r.rows[0].suspensos === contasAntes.suspensos && r.rows[0].banidos === contasAntes.banidos);
await espera("mural e triagem não passam pela segunda avaliação", async () => [
  await rpc({ papel: "anon", ip: "198.51.100.91" }, "mural_enviar", { p: { categoria: "servico", titulo: "Conserto de bicicletas", oficio: "Mecânico", descricao: "Conserto e revisão de bicicletas no bairro, com preço justo.", cidade: "Recife", uf: "PE", contato: "Rua da Aurora, 100" } }),
  (await dono("select count(*)::int as n from interno.mural where titulo = 'Conserto de bicicletas' and status = 'pendente'")).rows[0].n,
], (r) => Boolean(r[0].id) && r[0].avaliando === undefined && r[1] === 1);
// ── Modo de segurança: somente aprovação manual ──
ids.calma = await criarUsuario("calma@teste.local", "Clara Calma");
await rpc(como(ids.calma), "eu");
const coordenacao = { ...como(ids.coord), aal: "aal2" };
await recusa("anônimo não liga o modo de segurança", () => rpc(anon, "comunidade_modo_seguranca", { p_ligar: true }), "entre_primeiro");
await recusa("participante não liga o modo de segurança", () => rpc(como(ids.calma), "comunidade_modo_seguranca", { p_ligar: true }), "sem_permissao");
await recusa("mediador não liga o modo de segurança", () => rpc(como(ids.med), "comunidade_modo_seguranca", { p_ligar: true }), "sem_permissao");
await recusa("curadoria não vê os controles da moderação", () => rpc(como(ids.curadora), "comunidade_controles"), "sem_permissao");
await recusa("logado não grava resultado de teste de funcionamento", () => rpc(como(ids.coord), "comunidade_verificacao", { p: { chave: true, ok: true } }), "sem_permissao");
await espera("o painel separa habilitada, testada e usada de verdade", () => rpc(coordenacao, "comunidade_controles"), (r) => r.habilitada === true && r.aprovacao_manual === false && r.verificacao === null && Boolean(r.ultima_avaliacao?.em) && typeof r.esperando === "number");
await espera("teste de funcionamento com falha aparece como falha, mesmo com a avaliação habilitada", async () => { await rpc(servico, "comunidade_verificacao", { p: { chave: false, ok: false, falha: "sem_chave" } }); return rpc(coordenacao, "comunidade_controles"); }, (r) => r.habilitada === true && r.verificacao.ok === false && r.verificacao.chave === false && r.verificacao.falha === "sem_chave");
await espera("teste de funcionamento que deu certo fica anotado com a hora", async () => { await rpc(servico, "comunidade_verificacao", { p: { chave: true, ok: true, falha: "" } }); return rpc(coordenacao, "comunidade_controles"); }, (r) => r.verificacao.ok === true && r.verificacao.chave === true && Boolean(r.verificacao.em));
let presa;
await espera("mensagem que já tinha saído para avaliar quando o modo foi ligado não é publicada pelo resultado", async () => {
  presa = await enviar("Mensagem comum enviada um instante antes de o modo de segurança ser ligado.", ids.calma);
  await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: presa.id });
  const ligado = await rpc(coordenacao, "comunidade_modo_seguranca", { p_ligar: true });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: presa.id, p_resultado: resultado() });
  return [ligado.aprovacao_manual, r.veredito, await visivel(presa.id), (await naFila(presa.id))?.motivo];
}, (r) => r[0] === true && r[1] === "revisar" && r[2] === false && r[3] === "modo_seguranca");
await espera("ligar o modo fica no registro, com quem ligou", () => dono("select nome, detalhes from interno.auditoria where acao = 'comunidade_modo_seguranca' order by id desc limit 1"), (r) => r.rows[0].nome === nomes.coord && r.rows[0].detalhes.ligado === true);
let manual;
await espera("com o modo ligado, mensagem adequada espera aprovação manual e não sai para avaliação nenhuma", async () => {
  manual = await enviar("Mensagem comum enviada com o modo de segurança ligado.", ids.calma);
  return [manual, await visivel(manual.id), (await naFila(manual.id))?.motivo, await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: manual.id }), (await rpc(servico, "comunidade_pendentes")).length];
}, (r) => r[0].retido === true && r[0].avaliando === false && r[0].bloqueado === false && r[1] === false && r[2] === "modo_seguranca" && r[3] === null && r[4] === 0);
await espera("resultado forjado ou atrasado não publica nada com o modo ligado", async () => [await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: manual.id, p_resultado: resultado() }), await visivel(manual.id)], (r) => r[0].veredito === "ignorado" && r[1] === false);
await espera("tópico novo também espera", () => rpc(como(ids.calma), "topico_criar", { p_titulo: "O que é capital constante?", p_corpo: "Queria entender a diferença para o capital variável.", p_disciplina: null, p_tipo: "duvida" }), (r) => r.retido === true && r.avaliando === false);
await espera("as regras continuam barrando violação clara com o modo ligado", () => enviar("Vou te matar se repetir isso.", ids.calma), (r) => r.bloqueado === true);
await espera("a leitura pública segue aberta e nada do que estava no ar some", async () => [(await rpc(anon, "topicos_listar")).length, (await rpc(anon, "topico_ver", { p_id: duvida.id })).respostas.length], (r) => r[0] > 0 && r[1] > 0);
await espera("o fluxo manual continua funcionando: o mediador aprova e a mensagem aparece", async () => {
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: manual.id, p_acao: "mostrar" });
  const apareceu = await visivel(manual.id);
  const aviso = (await rpc(como(ids.calma), "avisos_meus")).some((x) => x.texto.includes("foi aprovada"));
  for (const m of [manual, presa]) await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  return [apareceu, aviso];
}, (r) => r[0] === true && r[1] === true);
await espera("o mural e a triagem das contribuições não mudam com o modo ligado", async () => [
  await rpc({ papel: "anon", ip: "198.51.100.92" }, "mural_enviar", { p: { categoria: "servico", titulo: "Aulas de violão no bairro", oficio: "Músico", descricao: "Aulas de violão para iniciantes, em grupo, aos sábados de manhã.", cidade: "Olinda", uf: "PE", contato: "Rua do Sol, 20" } }),
  await rpc({ papel: "anon", ip: "198.51.100.93" }, "contribuir", { p: { tipo: "sugestao", titulo: "Sugestão de aula sobre juros", corpo: "Seria bom ter uma aula sobre juros simples e compostos." } }),
], (r) => Boolean(r[0].id) && Boolean(r[1].id));
await espera("desligado o modo, volta a valer a avaliação automática", async () => {
  const desligado = await rpc(coordenacao, "comunidade_modo_seguranca", { p_ligar: false });
  ids.serena = await criarUsuario("serena@teste.local", "Sara Serena");
  await rpc(como(ids.serena), "eu");
  const m = await enviar("Mensagem comum enviada depois de o modo de segurança ser desligado.", ids.serena);
  const entregue = await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: m.id });
  const r = await rpc(servico, "comunidade_avaliada", { p_tipo: "resposta", p_id: m.id, p_resultado: resultado() });
  const apareceu = await visivel(m.id);
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  return [desligado.aprovacao_manual, m.avaliando, Boolean(entregue?.texto), r.veredito, apareceu, (await rpc(coordenacao, "comunidade_controles")).ultima_avaliacao.ok];
}, (r) => r[0] === false && r[1] === true && r[2] === true && r[3] === "publicar" && r[4] === true && r[5] === true);
await espera("instalar de novo não desfaz a escolha do modo de segurança", async () => { await rpc(coordenacao, "comunidade_modo_seguranca", { p_ligar: true }); await banco.instalarDeNovo(); const ligado = (await rpc(coordenacao, "comunidade_controles")).aprovacao_manual; await rpc(coordenacao, "comunidade_modo_seguranca", { p_ligar: false }); return ligado; }, (r) => r === true);
await espera("dono do banco desliga, e volta a valer só a primeira camada", async () => {
  await dono("select public.comunidade_avaliacao_externa(false)");
  for (const m of [ambigua, sensivel]) await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  for (const m of [adequada, esquecida]) await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: m.id, p_acao: "ocultar" });
  const r = await enviar("Desligada de novo, mensagem adequada aparece na hora.");
  await rpc(como(ids.med), "comunidade_cuidar", { p_tipo: "resposta", p_alvo: r.id, p_acao: "ocultar" });
  return [r, (await rpc(como(ids.med), "comunidade_retidos")).filter((x) => String(x.motivo).includes("avaliacao")).length];
}, (r) => r[0].retido === false && r[0].avaliando === false && r[1] === 0);
await espera("com a segunda avaliação desligada, a função não recebe texto nenhum", async () => [await rpc(servico, "comunidade_pendentes"), await rpc(servico, "comunidade_para_avaliar", { p_tipo: "resposta", p_id: duvida.id })], (r) => r[0].length === 0 && r[1] === null);
await espera("instalar de novo não religa nem desliga a segunda avaliação", async () => { await banco.instalarDeNovo(); return dono("select interno.avaliacao_externa() as ligada"); }, (r) => r.rows[0].ligada === false);
await recusa("leitora comum não lê a lista do filtro", () => rpc(como(ids.jornal), "filtro_listar"), "sem_permissao");
await espera("curadoria edita a lista do filtro", async () => { await rpc(como(ids.curadora), "filtro_salvar", { p_termo: "Palavrão Novo", p_incluir: true }); return rpc(como(ids.curadora), "filtro_listar"); }, (r) => r.includes("palavrao novo"));
await recusa("no máximo três conversas novas por hora", async () => { for (let i = 0; i < 4; i++) await rpc(como(ids.mentora), "topico_criar", { p_titulo: `Conversa número ${i}`, p_corpo: "Texto com mais de dez letras.", p_disciplina: null }); }, "muitos_pedidos");

// ── Aviso de abertura ──
await espera("sem aviso definido, o público recebe 'não definido'", () => rpc(anon, "abertura"), (r) => r.definido === false);
await recusa("curadoria não muda o aviso de abertura", () => rpc(como(ids.curadora), "abertura_salvar", { p: { ativo: true, titulo: "x", texto: "y" } }), "sem_permissao");
await recusa("imagem do aviso precisa estar no próprio site", () => rpc(como(ids.coord), "abertura_salvar", { p: { ativo: true, titulo: "Aviso", texto: "Texto", imagem: "https://exemplo.test/x.png" } }), "invalido:imagem");
await espera("vice-coordenação publica o aviso", async () => { await rpc(como(ids.vice), "abertura_salvar", { p: { ativo: true, titulo: "Aviso", texto: "Texto do aviso.", imagem: "/imagens/x.webp", link: "/pt/sobre", link_texto: "Saiba mais", ate: "2030-01-01" } }); return rpc(anon, "abertura"); },
  (r) => r.definido === true && r.ativo === true && r.titulo === "Aviso" && typeof r.versao === "number");

// ── Aula de reforço ──
const pedido = (extra = {}) => ({ disciplina: "matematica", assunto: "Equação do segundo grau", duvida: "Não consigo entender de onde vem a fórmula de Bhaskara.", email: "Aluna@Exemplo.com", ...extra });
let reforco;
let avulso;
await espera("quem não tem conta pede reforço", async () => (avulso = await rpc({ papel: "anon", ip: "198.51.100.20" }, "reforco_pedir", { p: pedido({ disciplina: "historia", assunto: "Revolução Francesa" }) })), (r) => Boolean(r.id));
await recusa("pedido com endereço de site é recusado", () => rpc({ papel: "anon", ip: "198.51.100.21" }, "reforco_pedir", { p: pedido({ duvida: "Olhem só isto aqui: https://exemplo.com/coisa e me respondam." }) }), "sem_links");
await recusa("pedido com nome de imagem é recusado", () => rpc({ papel: "anon", ip: "198.51.100.21" }, "reforco_pedir", { p: pedido({ duvida: "Segue a foto do exercício em anexo: exercicio.jpg, por favor." }) }), "sem_links");
await recusa("pedido com apologia ao nazismo é recusado", () => rpc({ papel: "anon", ip: "198.51.100.22" }, "reforco_pedir", { p: pedido({ duvida: "Quero que expliquem por que Hitler tinha razão em tudo." }) }), "conteudo_recusado");
await espera("campo-isca no reforço não guarda nada", async () => { await rpc({ papel: "anon", ip: "198.51.100.23" }, "reforco_pedir", { p: pedido({ site: "x" }) }); return dono("select count(*)::int as n from interno.reforco"); }, (r) => r.rows[0].n === 1);
await dono("delete from interno.reforco where id = $1", [avulso.id]);
await recusa("reforço precisa de e-mail válido", () => rpc(como(ids.jornal), "reforco_pedir", { p: pedido({ email: "sem-arroba" }) }), "invalido:email");
await espera("pedir reforço", async () => (reforco = await rpc(como(ids.jornal), "reforco_pedir", { p: pedido() })), (r) => Boolean(r.id));
await recusa("quem não é da área não vê a fila de reforço", () => rpc(como(ids.designer), "reforco_fila"), "sem_permissao");
await espera("mentora de matemática vê o pedido, sem o e-mail", () => rpc(como(ids.mentora), "reforco_fila"), (r) => r.length === 1 && r[0].email === "" && !JSON.stringify(r).includes("exemplo.com"));
await espera("educador de outra disciplina não vê", async () => {
  const quimico = ids.quimica;
  await rpc(como(quimico), "eu");

  return rpc(como(quimico), "reforco_fila");
}, (r) => r.length === 0);
await espera("ao assumir, a mentora recebe o e-mail", () => rpc(como(ids.mentora), "reforco_assumir", { p_id: reforco.id }), (r) => r.email === "aluna@exemplo.com");
await recusa("pedido assumido não é assumido de novo", () => rpc(como(ids.prof), "reforco_assumir", { p_id: reforco.id }), "nao_encontrado");
await espera("outro mentor vê o pedido em atendimento, sem o e-mail", () => rpc(como(ids.prof), "reforco_fila"), (r) => r.length === 1 && r[0].email === "" && r[0].mentor === "Marta Mentora");
await recusa("só quem assumiu conclui", () => rpc(como(ids.prof), "reforco_concluir", { p_id: reforco.id, p_nota: "" }), "sem_permissao");
await espera("concluir apaga o e-mail do banco", async () => { await rpc(como(ids.mentora), "reforco_concluir", { p_id: reforco.id, p_nota: "Respondido com um passo a passo." }); return dono("select email, status from interno.reforco where id = $1", [reforco.id]); }, (r) => r.rows[0].email === "" && r.rows[0].status === "atendido");
await espera("quem pediu acompanha", () => rpc(como(ids.jornal), "reforco_meus"), (r) => r.length === 1 && r[0].status === "atendido");

// ── Conversas da equipe: aparelhos, identidades e chaves ──
// Cada pessoa abre o painel num "aparelho" de teste, com par de chaves de verdade (lib/sigilo.ts). O banco só vê o cifrado.
// O aparelho de teste faz o que o navegador faz (lib/chaveiro.ts): cria a identidade no primeiro aparelho da conta, guarda a
// identidade que viu de cada colega, e só embrulha chaves para aparelhos certificados por essa identidade.
const aparelhos = {};
/** As identidades que "a equipe de teste" conhece de cada pessoa (como cada aparelho guarda no navegador). */
const conhecidas = {};
async function aparelhoDe(quem, rotuloDoAparelho = `teste de ${quem}`) {
  const par = await novoAparelho();
  const codigo = novoCodigo();
  const r = await rpc(como(ids[quem]), "chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: rotuloDoAparelho, p_pedido: await selarPedido(codigo, ids[quem], par.publica) });
  const aparelho = { quem, id: r.id, ...par, chaves: new Map(), codigo, estado: r.estado, identidade: null };
  if (r.estado === "pendente" && !r.identidade?.assina) {
    // Primeiro aparelho da conta: cria a identidade e se certifica.
    const identidade = await novaIdentidade();
    await rpc(como(ids[quem]), "chat_identidade_definir", { p_aparelho: r.id, p_assina: identidade.publica, p_certificado: await certificarAparelho(identidade, ids[quem], par.publica) });
    aparelho.identidade = identidade;
    aparelho.estado = "aprovado";
  }
  return aparelho;
}
/** Um aparelho aprovado aprova outro da mesma conta, com o código que o novo mostra. */
async function aprovar(aprovador, novo, codigo = novo.codigo) {
  const lista = await rpc(como(ids[aprovador.quem]), "chat_aparelhos_meus");
  const alvo = lista.find((a) => a.id === novo.id);
  const publica = alvo?.pedido ? await abrirPedido(codigo, ids[aprovador.quem], alvo.pedido) : null;
  if (!publica || publica !== alvo.publica) return false;
  const secreta = await exportarIdentidade(aprovador.identidade);
  await rpc(como(ids[aprovador.quem]), "chat_aparelho_aprovar", {
    p_id: novo.id, p_por: aprovador.id,
    p_certificado: await certificarAparelho(aprovador.identidade, ids[aprovador.quem], publica),
    p_identidade_embrulho: await embrulharBytes(secreta, aprovador.privada, publica, contextoDaIdentidade(ids[aprovador.quem], novo.id)),
  });
  return true;
}
/** O aparelho pendente confere se foi aprovado e recebe a identidade. */
async function conferirAprovacao(aparelho) {
  const r = await rpc(como(ids[aparelho.quem]), "chat_aparelho_estado", { p_id: aparelho.id });
  if (r.estado !== "aprovado" || !r.identidade_embrulho) return false;
  const secreta = await desembrulharBytes(r.identidade_embrulho, aparelho.privada, r.aprovado_publica, contextoDaIdentidade(ids[aparelho.quem], aparelho.id));
  if (!secreta) return false;
  aparelho.identidade = await importarIdentidade(secreta, r.identidade.assina);
  aparelho.estado = "aprovado";
  return true;
}
/** A identidade que a equipe de teste aceita para alguém: a que viu primeiro (e avisa se mudar). */
function aceitar(usuario, assina) {
  if (!assina) return null;
  if (!conhecidas[usuario]) conhecidas[usuario] = { assina, mudou: false };
  else if (conhecidas[usuario].assina !== assina) conhecidas[usuario] = { assina, mudou: true, anterior: conhecidas[usuario].assina };
  return conhecidas[usuario].assina;
}
/** Dos aparelhos que o banco lista, os que têm certificado válido pela identidade conhecida da pessoa. */
async function confiaveis(lista) {
  const saida = [];
  for (const a of lista) {
    const identidade = conhecidas[a.usuario]?.assina;
    if (identidade && (await aparelhoCertificado(identidade, a.usuario, a.publica, a.certificado))) saida.push(a);
  }
  return saida;
}
async function abrirChaves(aparelho, conversa) {
  const r = await rpc(como(ids[aparelho.quem]), "chat_chaves", { p_conversa: conversa, p_aparelho: aparelho.id });
  for (const pessoa of r.identidades) aceitar(pessoa.usuario, pessoa.assina);
  for (const item of r.minhas) {
    const chave = await desembrulhar(item.embrulho, aparelho.privada, item.de_publica, contextoDoEmbrulho(conversa, item.versao, aparelho.id));
    if (chave) aparelho.chaves.set(`${conversa}:${item.versao}`, chave);
  }
  return r;
}
/** Cifra (assinando) com a versão atual; sem ela (ou depois que alguém saiu), cria a seguinte, embrulhada só para aparelhos certificados. */
async function selar(aparelho, conversa, texto, contexto) {
  const r = await abrirChaves(aparelho, conversa);
  const atual = r.atual !== null && r.atual >= r.minima ? aparelho.chaves.get(`${conversa}:${r.atual}`) : undefined;
  if (atual) return cifrar(atual, r.atual, await assinarTexto(aparelho.identidade, texto, contexto, r.atual), contexto);
  const versao = Math.max((r.atual ?? 0) + 1, r.minima);
  const chave = await novaChave();
  const embrulhos = await Promise.all((await confiaveis(r.aparelhos)).map(async (a) => ({ para: a.id, embrulho: await embrulhar(chave, aparelho.privada, a.publica, contextoDoEmbrulho(conversa, versao, a.id)) })));
  await rpc(como(ids[aparelho.quem]), "chat_chave_nova", { p_conversa: conversa, p_aparelho: aparelho.id, p_versao: versao, p_embrulhos: embrulhos });
  aparelho.chaves.set(`${conversa}:${versao}`, chave);
  return cifrar(chave, versao, await assinarTexto(aparelho.identidade, texto, contexto, versao), contexto);
}
/** Abre e confere a assinatura do autor; devolve só o texto (ou null). "lerCom" devolve também a autoria. */
async function lerCom(aparelho, conversa, corpo, contexto, autor) {
  const versao = Number(corpo.split(".")[1]);
  const chave = `${conversa}:${versao}`;
  if (!aparelho.chaves.has(chave)) await abrirChaves(aparelho, conversa);
  if (!aparelho.chaves.has(chave)) return null;
  const aberto = await decifrar(aparelho.chaves.get(chave), corpo, contexto);
  return aberto === null ? null : abrirTexto(aberto, autor ? (conhecidas[autor]?.assina ?? null) : null, contexto, versao);
}
const ler = async (aparelho, conversa, corpo, contexto) => (await lerCom(aparelho, conversa, corpo, contexto, null))?.texto ?? null;
/** O que um aparelho faz com o painel aberto: repassa as chaves que tem para aparelhos certificados de colegas que ainda não as têm. */
async function repassar(aparelho) {
  const faltam = await rpc(como(ids[aparelho.quem]), "chat_chaves_pendentes", { p_aparelho: aparelho.id });
  const embrulhos = [];
  for (const item of faltam) {
    if (!aparelho.chaves.has(`${item.conversa}:${item.versao}`)) await abrirChaves(aparelho, item.conversa);
    const chave = aparelho.chaves.get(`${item.conversa}:${item.versao}`);
    const identidade = conhecidas[item.usuario]?.assina;
    if (!chave || !identidade || !(await aparelhoCertificado(identidade, item.usuario, item.publica, item.certificado))) continue;
    embrulhos.push({ conversa: item.conversa, versao: item.versao, para: item.para, embrulho: await embrulhar(chave, aparelho.privada, item.publica, contextoDoEmbrulho(item.conversa, item.versao, item.para)) });
  }
  return embrulhos.length ? (await rpc(como(ids[aparelho.quem]), "chat_chaves_dar", { p_aparelho: aparelho.id, p_embrulhos: embrulhos })).dadas : 0;
}
/** Só as mensagens de texto (os avisos do sistema, reações e edições ficam de fora). */
const textos = (r) => r.mensagens.filter((m) => m.tipo === "texto");
const departamento = async (quem, slug) => (await rpc(como(ids[quem]), "chat_conversas")).find((c) => c.tipo === "departamento" && c.departamento === slug);
const minimaDe = async (conversa) => (await dono("select versao_minima from interno.conversas where id = $1", [conversa])).rows[0].versao_minima;
const pedidoDe = async (quem, par, codigo) => ({ p_publica: par.publica, p_rotulo: "", p_pedido: await selarPedido(codigo, ids[quem], par.publica) });

await recusa("quem não é da equipe não registra aparelho", async () => rpc(como(ids.leitora), "chat_aparelho_registrar", await pedidoDe("leitora", await novoAparelho(), novoCodigo())), "sem_permissao");
await recusa("chave pública fora do formato é recusada", () => rpc(como(ids.prof), "chat_aparelho_registrar", { p_publica: "nao-e-uma-chave", p_rotulo: "" }), "invalido:publica");
await recusa("aparelho novo sem pedido de aprovação é recusado", async () => rpc(como(ids.prof), "chat_aparelho_registrar", { p_publica: (await novoAparelho()).publica, p_rotulo: "" }), "invalido:pedido");
await recusa("pedido fora do formato é recusado", async () => rpc(como(ids.prof), "chat_aparelho_registrar", { p_publica: (await novoAparelho()).publica, p_rotulo: "", p_pedido: { sal: "x", iv: "y", cifrado: "z" } }), "invalido:pedido");
for (const quem of ["coord", "vice", "prof", "designer", "mentora", "revisor", "med", "jornal"]) aparelhos[quem] = await aparelhoDe(quem);
await espera("o primeiro aparelho de cada conta cria a identidade e já entra aprovado", () => rpc(como(ids.prof), "chat_aparelhos_meus"), (r) => r.length === 1 && r[0].estado === "aprovado" && r[0].pedido === null);
await espera("registrar de novo o mesmo aparelho devolve o mesmo número e o estado", () => rpc(como(ids.prof), "chat_aparelho_registrar", { p_publica: aparelhos.prof.publica, p_rotulo: "" }), (r) => r.id === aparelhos.prof.id && r.estado === "aprovado" && r.identidade.assina === aparelhos.prof.identidade.publica);
await recusa("ninguém registra como sua a chave pública de outra pessoa", () => rpc(como(ids.designer), "chat_aparelho_registrar", { p_publica: aparelhos.prof.publica, p_rotulo: "" }), "invalido:publica");
await recusa("ninguém pede chaves com o aparelho de outra pessoa", async () => rpc(como(ids.designer), "chat_chaves", { p_conversa: (await departamento("designer", "geral")).id, p_aparelho: aparelhos.prof.id }), "aparelho_desconhecido");
await recusa("conta com identidade não recebe outra pela porta do primeiro aparelho", async () => { const par = await novoAparelho(); const id2 = await novaIdentidade(); return rpc(como(ids.prof), "chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: "", p_assina: id2.publica, p_certificado: await certificarAparelho(id2, ids.prof, par.publica) }); }, "identidade_existe");
await recusa("nem por chat_identidade_definir", async () => rpc(como(ids.prof), "chat_identidade_definir", { p_aparelho: aparelhos.prof.id, p_assina: (await novaIdentidade()).publica, p_certificado: "A".repeat(86) }), "identidade_existe");

// ── Grupos de departamento ──
await espera("quem tem função já está no grupo do departamento e no da equipe toda", () => rpc(como(ids.designer), "chat_conversas"), (r) => {
  const deps = r.filter((c) => c.tipo === "departamento").map((c) => c.departamento).sort();
  return JSON.stringify(deps) === JSON.stringify(["design", "geral"]);
});
await espera("a coordenação e a vice-coordenação estão em todos os treze grupos (com o da supervisão)", async () => [(await rpc(como(ids.coord), "chat_conversas")).filter((c) => c.tipo === "departamento").length, (await rpc(como(ids.vice), "chat_conversas")).filter((c) => c.tipo === "departamento").length], (r) => r[0] === 13 && r[1] === 13);
await espera("o grupo do jornalismo é também o da rádio e do podcast", () => departamento("jornal", "jornalismo"), (r) => r?.nome === "Jornalismo, rádio e podcast");
await recusa("ninguém sai do grupo do próprio departamento", async () => rpc(como(ids.designer), "chat_sair", { p_id: (await departamento("designer", "design")).id }), "departamento_fixo");
await recusa("nem a coordenação põe ou tira gente do grupo de departamento", async () => rpc(como(ids.coord), "chat_grupo_mudar", { p_id: (await departamento("coord", "design")).id, p_tirar: [ids.designer] }), "departamento_fixo");
await recusa("ninguém apaga um grupo de departamento", async () => rpc(como(ids.coord), "chat_grupo_apagar", { p_id: (await departamento("coord", "design")).id }), "sem_permissao");
await espera("função nova põe a pessoa no grupo do departamento na hora", async () => { await rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.revisor, p_papel: "design", p_disciplina: null }); return departamento("revisor", "design"); }, (r) => Boolean(r));
await espera("função retirada tira a pessoa do grupo e obriga a trocar a chave", async () => {
  const design = (await departamento("coord", "design")).id;
  await selar(aparelhos.designer, design, "Capa nova pronta.", contextoDaConversa(design, ids.designer)).then((corpo) => rpc(como(ids.designer), "chat_enviar", { p_id: design, p_corpo: corpo }));
  const antes = await minimaDe(design);
  const papel = (await rpc(como(ids.revisor), "eu")).papeis.find((p) => p.papel === "design");
  await rpc(como(ids.coord), "papel_remover", { p_id: papel.id });
  return [Boolean(await departamento("revisor", "design")), (await minimaDe(design)) > antes];
}, (r) => r[0] === false && r[1] === true);
await espera("conta suspensa sai dos grupos de departamento e volta ao ser reativada", async () => {
  await rpc(como(ids.coord), "usuario_suspender", { p_usuario: ids.designer, p_suspenso: true });
  const suspensa = (await dono("select count(*)::int as n from interno.conversa_membros m join interno.conversas c on c.id = m.conversa where c.tipo = 'departamento' and m.usuario = $1", [ids.designer])).rows[0].n;
  await rpc(como(ids.coord), "usuario_suspender", { p_usuario: ids.designer, p_suspenso: false });
  return [suspensa, (await dono("select count(*)::int as n from interno.conversa_membros m join interno.conversas c on c.id = m.conversa where c.tipo = 'departamento' and m.usuario = $1", [ids.designer])).rows[0].n];
}, (r) => r[0] === 0 && r[1] === 2);

// ── Mural da equipe ──
await recusa("quem não é da equipe não vê os canais", () => rpc(como(ids.troll), "equipe_canais"), "conta_suspensa");
await espera("designer vê geral, pedidos e design", () => rpc(como(ids.designer), "equipe_canais"), (r) => JSON.stringify(r.canais) === JSON.stringify(["geral", "pedidos", "aprendizado", "design"]));
await espera("cada canal usa a chave do grupo do departamento; geral e pedidos, a da equipe toda", async () => [await rpc(como(ids.designer), "equipe_canais"), (await departamento("designer", "geral")).id, (await departamento("designer", "design")).id],
  ([r, geral, design]) => r.conversas.geral === geral && r.conversas.pedidos === geral && r.conversas.design === design && !("educacao" in r.conversas));
await espera("a frase da equipe não existe mais", () => rpc(como(ids.coord), "equipe_canais"), (r) => !("prova" in r) && !("sal" in r));
await espera("coordenação vê todos os canais", () => rpc(como(ids.coord), "equipe_canais"), (r) => r.canais.length === 15);
await espera("mediador vê o canal da mediação, e não o da curadoria", () => rpc(como(ids.med), "equipe_canais"), (r) => r.canais.includes("mediacao") && !r.canais.includes("curadoria"));
await recusa("designer não lê o canal dos educadores", () => rpc(como(ids.designer), "equipe_listar", { p_canal: "educacao" }), "sem_permissao");
await recusa("designer não escreve no canal da coordenação", () => rpc(como(ids.designer), "equipe_escrever", { p_canal: "coordenacao", p_corpo: "Olá" }), "sem_permissao");
await recusa("o banco recusa mensagem em texto aberto", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "Bom dia, pessoal." }), "invalido:corpo");
await recusa("o banco recusa o formato antigo, da frase", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "invalido:corpo");
await recusa("versão de chave inventada é recusada", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "c2.7.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "chave_desatualizada");
const geral = (await rpc(como(ids.prof), "equipe_canais")).conversas.geral;
await recusa("pedido de ajuda precisa dizer para quem", async () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: await selar(aparelhos.prof, geral, "Preciso de uma capa.", contextoDoMural("pedidos", ids.prof)) }), "invalido:para");
let recado;
await espera("educador pede ajuda ao design", async () => (recado = await rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: await selar(aparelhos.prof, geral, "Preciso de uma capa para a aula de frações.", contextoDoMural("pedidos", ids.prof)), p_resposta_a: null, p_para: "design" })), (r) => Boolean(r.id));
await espera("designer abre o pedido no próprio aparelho", async () => { const [r] = await rpc(como(ids.designer), "equipe_listar", { p_canal: "pedidos" }); return ler(aparelhos.designer, geral, r.corpo, contextoDoMural("pedidos", r.autor_id)); }, (r) => r === "Preciso de uma capa para a aula de frações.");
await espera("o banco guarda só o texto cifrado", () => dono("select corpo from interno.equipe_mensagens where id = $1", [recado.id]), (r) => r.rows[0].corpo.startsWith("c2.") && !r.rows[0].corpo.includes("capa"));
await espera("designer responde e o pedido aparece com a resposta", async () => { await rpc(como(ids.designer), "equipe_escrever", { p_canal: "pedidos", p_corpo: await selar(aparelhos.designer, geral, "Faço hoje.", contextoDoMural("pedidos", ids.designer)), p_resposta_a: recado.id }); return rpc(como(ids.designer), "equipe_listar", { p_canal: "pedidos" }); },
  (r) => r.length === 1 && r[0].para === "design" && r[0].respostas.length === 1 && r[0].autor === "Paulo Professor" && r[0].respostas[0].autor_id === ids.designer);
await recusa("outra pessoa não apaga recado alheio", () => rpc(como(ids.designer), "equipe_apagar", { p_id: recado.id }), "nao_encontrado");
await espera("autor marca o pedido como resolvido", () => rpc(como(ids.prof), "equipe_marcar", { p_id: recado.id, p_resolvido: true }), (r) => r.ok);
await recusa("vice-coordenação não define a sala da equipe", () => rpc(como(ids.vice), "equipe_sala_salvar", { p_url: "https://matrix.to/#/!sala:exemplo.org" }), "sem_permissao");
await espera("coordenação indica a sala cifrada", async () => { await rpc(como(ids.coord), "equipe_sala_salvar", { p_url: "https://matrix.to/#/!sala:exemplo.org" }); return rpc(como(ids.designer), "equipe_canais"); }, (r) => r.sala.startsWith("https://matrix.to/"));
await espera("instalar de novo não apaga o mural cifrado", async () => { await banco.instalarDeNovo(); return dono("select count(*)::int as n from interno.equipe_mensagens"); }, (r) => r.rows[0].n === 2);
// O canal da mediação aparece para quem media; escrever nele (e pedir ajuda à mediação) precisa funcionar.
await espera("mediação vê o próprio canal", () => rpc({ ...como(ids.med), aal: "aal2" }, "equipe_canais"), (r) => r.canais.includes("mediacao"));
await espera("educador pede ajuda à mediação", async () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: await selar(aparelhos.prof, geral, "Preciso de ajuda com uma conversa difícil.", contextoDoMural("pedidos", ids.prof)), p_resposta_a: null, p_para: "mediacao" }), (r) => Boolean(r.id));
await recusa("quem não é da mediação não lê o canal dela", () => rpc(como(ids.designer), "equipe_listar", { p_canal: "mediacao" }), "sem_permissao");
await espera("mensagem com mais de trinta dias some sozinha", async () => { await dono("update interno.equipe_mensagens set criado_em = now() - interval '31 days' where resposta_a is null"); return rpc(como(ids.coord), "equipe_listar", { p_canal: "pedidos" }); }, (r) => r.length === 0);
await recusa("vice não apaga tudo", () => rpc(como(ids.vice), "equipe_apagar_tudo"), "sem_permissao");
await espera("o coordenador apaga todas as conversas de uma vez", async () => { await rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: await selar(aparelhos.prof, geral, "Bom dia.", contextoDoMural("geral", ids.prof)) }); const r = await rpc(como(ids.coord), "equipe_apagar_tudo"); return [r.apagadas, (await dono("select count(*)::int as n from interno.equipe_mensagens")).rows[0].n]; }, (r) => r[0] >= 1 && r[1] === 0);

/** Privado só para trabalho: as duas pessoas colaboram numa contribuição pendente (criada e desfeita em volta da chamada). */
async function comColaboracao(a, b, fazer) {
  const c = (await dono("insert into interno.contribuicoes (tipo, titulo, autor, status) values ('sugestao', 'Trabalho em conjunto de teste', $1, 'pendente') returning id", [ids[a]])).rows[0].id;
  await dono("insert into interno.colaboradores (contribuicao, usuario) values ($1, $2)", [c, ids[b]]);
  try { return await fazer(); } finally { await dono("delete from interno.contribuicoes where id = $1", [c]); }
}
const direta = (a, b) => comColaboracao(a, b, () => rpc(como(ids[a]), "chat_direta", { p_usuario: ids[b] }));
// ── Conversas privadas e em grupo ──
await recusa("quem não é da equipe não tem conversas", () => rpc(como(ids.leitora), "chat_conversas"), "sem_permissao");
await recusa("não se abre conversa com quem não é da equipe", () => rpc(como(ids.prof), "chat_direta", { p_usuario: ids.leitora }), "invalido:usuario");
await recusa("nem consigo mesmo", () => direta("prof", "prof"), "invalido:usuario");
await recusa("privado fechado entre colegas sem trabalho em conjunto", () => rpc(como(ids.prof), "chat_direta", { p_usuario: ids.designer }), "privado_fechado");
await espera("com a liderança o privado é livre, dos dois lados", async () => [(await rpc(como(ids.prof), "chat_direta", { p_usuario: ids.vice })).id, (await rpc(como(ids.coord), "chat_direta", { p_usuario: ids.revisor })).id], (r) => r.every(Boolean));
await espera("a lista da equipe diz com quem dá para abrir privado", () => rpc(como(ids.prof), "equipe_membros"), (r) => r.find((m) => m.id === ids.vice).privado === true && r.find((m) => m.id === ids.designer).privado === false);
let privada;
await espera("educador abre conversa privada com o designer, e abrir de novo cai na mesma", async () => { privada = (await direta("prof", "designer")).id; return (await direta("designer", "prof")).id; }, (r) => r === privada);
await recusa("o banco recusa mensagem privada em texto aberto", () => rpc(como(ids.prof), "chat_enviar", { p_id: privada, p_corpo: "Oi, Davi." }), "invalido:corpo");
await espera("mensagem privada cifrada entra", async () => rpc(como(ids.prof), "chat_enviar", { p_id: privada, p_corpo: await selar(aparelhos.prof, privada, "Oi, Davi. Tudo certo para amanhã?", contextoDaConversa(privada, ids.prof)) }), (r) => Boolean(r.id));
await espera("o outro vê a conversa com uma mensagem não lida e o nome de quem escreveu", () => rpc(como(ids.designer), "chat_conversas"), (r) => {
  const diretas = r.filter((c) => c.tipo === "direta");
  return diretas.length === 1 && diretas[0].nao_lidas === 1 && diretas[0].nome === "Paulo" && typeof diretas[0].online === "boolean" && diretas[0].ultima.autor_id === ids.prof;
});
await espera("o painel avisa que há conversa nova", () => rpc(como(ids.designer), "presenca"), (r) => r.conversas === 1);
let aberta;
await espera("abrir marca como lida", async () => { aberta = await rpc(como(ids.designer), "chat_ver", { p_id: privada }); return [aberta.mensagens.length, aberta.membros.length, (await rpc(como(ids.designer), "presenca")).conversas]; }, (r) => r[0] === 1 && r[1] === 2 && r[2] === 0);
await espera("o outro abre a mensagem no próprio aparelho", () => ler(aparelhos.designer, privada, aberta.mensagens[0].corpo, contextoDaConversa(privada, aberta.mensagens[0].autor)), (r) => r === "Oi, Davi. Tudo certo para amanhã?");
await espera("no banco, só o cifrado", () => dono("select corpo from interno.conversa_mensagens where conversa = $1", [privada]), (r) => r.rows.every((x) => x.corpo.startsWith("c2.") && !x.corpo.includes("Davi")));
await espera("mensagem atribuída a outra pessoa no banco não abre", async () => {
  const id = aberta.mensagens[0].id;
  await dono("update interno.conversa_mensagens set autor = $1 where id = $2", [ids.coord, id]);
  const corpo = (await dono("select corpo from interno.conversa_mensagens where id = $1", [id])).rows[0].corpo;
  const resultado = await ler(aparelhos.designer, privada, corpo, contextoDaConversa(privada, ids.coord));
  await dono("update interno.conversa_mensagens set autor = $1 where id = $2", [ids.prof, id]);
  return resultado;
}, (r) => r === null);
await recusa("a coordenação não lê conversa privada dos outros", () => rpc(como(ids.coord), "chat_ver", { p_id: privada }), "nao_encontrado");
await recusa("nem pega as chaves dela", () => rpc(como(ids.coord), "chat_chaves", { p_conversa: privada, p_aparelho: aparelhos.coord.id }), "nao_encontrado");
await espera("nenhuma chave da conversa privada foi embrulhada para aparelho de fora", () => dono("select count(*)::int as n from interno.chat_chaves k join interno.chat_aparelhos a on a.id = k.para where k.conversa = $1 and a.usuario not in ($2, $3)", [privada, ids.prof, ids.designer]), (r) => r.rows[0].n === 0);
await recusa("quem está de fora não escreve nela", async () => rpc(como(ids.revisor), "chat_enviar", { p_id: privada, p_corpo: "c2.1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "nao_encontrado");
await espera("a conversa dos outros não aparece na lista de ninguém", () => rpc(como(ids.coord), "chat_conversas"), (r) => r.every((c) => c.id !== privada));
await recusa("grupo precisa de gente da equipe", () => rpc(como(ids.prof), "chat_grupo_criar", { p_nome: "Educadores", p_membros: [ids.leitora] }), "invalido:membros");
let grupo;
await espera("educador cria um grupo e os convidados são avisados", async () => { grupo = (await rpc(como(ids.prof), "chat_grupo_criar", { p_nome: "Educadores de exatas", p_membros: [ids.mentora, ids.designer] })).id; return rpc(como(ids.mentora), "avisos_meus"); }, (r) => r.some((x) => x.texto.includes("Educadores de exatas")));
await espera("todos do grupo leem o que um escreve", async () => {
  await rpc(como(ids.mentora), "chat_enviar", { p_id: grupo, p_corpo: await selar(aparelhos.mentora, grupo, "Lista de exercícios revisada.", contextoDaConversa(grupo, ids.mentora)) });
  const r = await rpc(como(ids.designer), "chat_ver", { p_id: grupo });
  return [r, await ler(aparelhos.designer, grupo, textos(r)[0].corpo, contextoDaConversa(grupo, textos(r)[0].autor))];
}, ([r, texto]) => textos(r).length === 1 && textos(r)[0].nome === "Marta" && r.membros.length === 3 && r.dona === false && texto === "Lista de exercícios revisada." && r.mensagens[0].tipo === "sistema" && r.mensagens[0].detalhe.evento === "criou");
await recusa("quem não criou o grupo não põe gente", () => rpc(como(ids.designer), "chat_grupo_mudar", { p_id: grupo, p_incluir: [ids.revisor] }), "sem_permissao");
await espera("quem criou põe e tira gente e troca o nome", async () => { await rpc(como(ids.prof), "chat_grupo_mudar", { p_id: grupo, p_nome: "Exatas", p_incluir: [ids.revisor], p_tirar: [ids.designer] }); return rpc(como(ids.prof), "chat_ver", { p_id: grupo }); }, (r) => r.nome === "Exatas" && r.membros.length === 3 && r.membros.some((m) => m.nome === "Rui"));
await recusa("quem foi tirado não lê mais", () => rpc(como(ids.designer), "chat_ver", { p_id: grupo }), "nao_encontrado");
await espera("os embrulhos de quem saiu somem", () => dono("select count(*)::int as n from interno.chat_chaves where conversa = $1 and para = $2", [grupo, aparelhos.designer.id]), (r) => r.rows[0].n === 0);
await recusa("depois que alguém sai, a chave antiga não serve mais para enviar", async () => rpc(como(ids.mentora), "chat_enviar", { p_id: grupo, p_corpo: await cifrar(aparelhos.mentora.chaves.get(`${grupo}:1`), 1, "Ainda vale?", contextoDaConversa(grupo, ids.mentora)) }), "chave_desatualizada");
await espera("a próxima mensagem sai com chave nova, que quem saiu nunca recebeu", async () => {
  await rpc(como(ids.mentora), "chat_enviar", { p_id: grupo, p_corpo: await selar(aparelhos.mentora, grupo, "Agora com chave nova.", contextoDaConversa(grupo, ids.mentora)) });
  return [(await dono("select max(versao)::int as v from interno.chat_versoes where conversa = $1", [grupo])).rows[0].v, (await dono("select count(*)::int as n from interno.chat_chaves where conversa = $1 and para = $2", [grupo, aparelhos.designer.id])).rows[0].n];
}, (r) => r[0] === 2 && r[1] === 0);
await espera("quem entrou depois recebe as chaves pelos colegas e lê a conversa", async () => {
  await repassar(aparelhos.prof);
  const r = await rpc(como(ids.revisor), "chat_ver", { p_id: grupo });
  return Promise.all(textos(r).map((m) => ler(aparelhos.revisor, grupo, m.corpo, contextoDaConversa(grupo, m.autor))));
}, (r) => JSON.stringify(r) === JSON.stringify(["Lista de exercícios revisada.", "Agora com chave nova."]));
await espera("ninguém repassa chave de conversa em que não está", async () => rpc(como(ids.designer), "chat_chaves_dar", { p_aparelho: aparelhos.designer.id, p_embrulhos: [{ conversa: grupo, versao: 1, para: aparelhos.revisor.id, embrulho: `w1.${"A".repeat(16)}.${"B".repeat(64)}` }] }), (r) => r.dadas === 0);
await espera("embrulho que não abre volta para ser repassado de novo", async () => {
  await rpc(como(ids.revisor), "chat_chaves_recusar", { p_aparelho: aparelhos.revisor.id, p_conversa: grupo, p_versao: 1 });
  const sumiu = (await dono("select count(*)::int as n from interno.chat_chaves where conversa = $1 and versao = 1 and para = $2", [grupo, aparelhos.revisor.id])).rows[0].n === 0;
  return [sumiu, await repassar(aparelhos.prof)];
}, (r) => r[0] === true && r[1] >= 1);
await recusa("autodestruição só com os prazos da lista", () => rpc(como(ids.prof), "chat_autodestruir", { p_id: grupo, p_segundos: 1234 }), "invalido:prazo");
await recusa("quem está de fora não mexe na autodestruição", () => rpc(como(ids.designer), "chat_autodestruir", { p_id: grupo, p_segundos: 3600 }), "nao_encontrado");
await espera("com a autodestruição de uma hora, a mensagem nova sai com prazo", async () => {
  await rpc(como(ids.revisor), "chat_autodestruir", { p_id: grupo, p_segundos: 3600 });
  await rpc(como(ids.prof), "chat_enviar", { p_id: grupo, p_corpo: await selar(aparelhos.prof, grupo, "Some em uma hora.", contextoDaConversa(grupo, ids.prof)) });
  return rpc(como(ids.prof), "chat_ver", { p_id: grupo });
}, (r) => {
  const ultima = textos(r).at(-1);
  const falta = new Date(ultima.expira_em).getTime() - Date.now();
  return r.apagar_apos === 3600 && r.apagar_por === "Rui Revisor" && falta > 3500_000 && falta <= 3600_000 && textos(r)[0].expira_em === null;
});
await espera("mensagem vencida some do banco", async () => {
  await dono("update interno.conversa_mensagens set expira_em = now() - interval '1 second' where conversa = $1 and expira_em is not null", [grupo]);
  const r = await rpc(como(ids.mentora), "chat_ver", { p_id: grupo });
  return [textos(r).length, (await dono("select count(*)::int as n from interno.conversa_mensagens where conversa = $1 and tipo = 'texto'", [grupo])).rows[0].n];
}, (r) => r[0] === 2 && r[1] === 2);
await espera("autodestruição desligada", () => rpc(como(ids.mentora), "chat_autodestruir", { p_id: grupo, p_segundos: 0 }), (r) => r.apagar_apos === null);
await recusa("ninguém apaga mensagem de outra pessoa", async () => { const m = textos(await rpc(como(ids.prof), "chat_ver", { p_id: grupo }))[0]; return rpc(como(ids.prof), "chat_apagar", { p_id: m.id }); }, "nao_encontrado");
await recusa("aviso do sistema ninguém apaga", async () => { const m = (await rpc(como(ids.prof), "chat_ver", { p_id: grupo })).mensagens.find((x) => x.tipo === "sistema"); return rpc(como(ids.prof), "chat_apagar", { p_id: m.id }); }, "nao_encontrado");
await espera("cada um apaga a própria mensagem", async () => { for (const m of textos(await rpc(como(ids.mentora), "chat_ver", { p_id: grupo }))) await rpc(como(ids.mentora), "chat_apagar", { p_id: m.id }); return rpc(como(ids.prof), "chat_ver", { p_id: grupo }); }, (r) => textos(r).length === 0);
await espera("quem quiser sai do grupo", async () => { await rpc(como(ids.revisor), "chat_sair", { p_id: grupo }); return rpc(como(ids.revisor), "chat_conversas"); }, (r) => r.every((c) => c.id !== grupo));
await recusa("membro comum não apaga o grupo", () => rpc(como(ids.mentora), "chat_grupo_apagar", { p_id: grupo }), "sem_permissao");
await espera("a pessoa é avisada quando as conversas dela abrem num aparelho novo", async () => { aparelhos.prof2 = { ...(await aparelhoDe("prof")), quem: "prof" }; return rpc(como(ids.prof), "avisos_meus"); }, (r) => r.some((x) => x.texto.includes("aparelho novo")));
await espera("a pessoa vê os próprios aparelhos", () => rpc(como(ids.prof), "chat_aparelhos_meus"), (r) => r.length === 2 && r.some((a) => a.id === aparelhos.prof2.id));
await recusa("ninguém remove aparelho de outra pessoa", () => rpc(como(ids.designer), "chat_aparelho_remover", { p_id: aparelhos.prof2.id }), "nao_encontrado");
await espera("remover um aparelho troca a chave de todas as conversas da pessoa", async () => { const antes = await minimaDe(privada); await rpc(como(ids.prof), "chat_aparelho_remover", { p_id: aparelhos.prof2.id }); return [antes, await minimaDe(privada), (await rpc(como(ids.prof), "chat_aparelhos_meus")).length]; }, (r) => r[1] > r[0] && r[2] === 1);
await espera("mensagem privada com mais de trinta dias some sozinha", async () => { await dono("update interno.conversa_mensagens set criado_em = now() - interval '31 days'"); await rpc(como(ids.prof), "chat_conversas"); return dono("select count(*)::int as n from interno.conversa_mensagens"); }, (r) => r.rows[0].n === 0);
await espera("o botão de apagar tudo leva as conversas privadas junto", async () => { await rpc(como(ids.prof), "chat_enviar", { p_id: privada, p_corpo: await selar(aparelhos.prof, privada, "Mais uma.", contextoDaConversa(privada, ids.prof)) }); await rpc(como(ids.coord), "equipe_apagar_tudo"); return dono("select count(*)::int as n from interno.conversa_mensagens"); }, (r) => r.rows[0].n === 0);
await espera("quem criou apaga o grupo", async () => { await rpc(como(ids.prof), "chat_grupo_apagar", { p_id: grupo }); return rpc(como(ids.mentora), "chat_conversas"); }, (r) => r.every((c) => c.id !== grupo));
await espera("a equipe vê quem está online e quando cada um passou por aqui", () => rpc(como(ids.prof), "equipe_membros"), (r) => r.every((m) => typeof m.online === "boolean" && typeof m.visto_em === "string"));

// ── Confiança entre aparelhos: aprovação, aparelho falso, assinatura, identidade que muda, recuperação ──
let prof3;
await espera("aparelho novo numa conta que já tem identidade entra pendente, com código", async () => { prof3 = await aparelhoDe("prof", "celular novo"); return rpc(como(ids.prof), "chat_aparelhos_meus"); },
  (r) => prof3.estado === "pendente" && /^[0-9]{8}$/.test(prof3.codigo) && r.some((a) => a.id === prof3.id && a.estado === "pendente" && a.pedido?.cifrado));
await espera("a pessoa é avisada de que o aparelho novo espera aprovação", () => rpc(como(ids.prof), "avisos_meus"), (r) => r.some((x) => x.texto.includes("aparelho novo") && x.texto.includes("aprovar")));
await espera("aparelho pendente não aparece para os colegas nem na lista de quem falta receber chave", async () => [await rpc(como(ids.designer), "chat_chaves", { p_conversa: privada, p_aparelho: aparelhos.designer.id }), await rpc(como(ids.designer), "chat_chaves_pendentes", { p_aparelho: aparelhos.designer.id })],
  ([chaves, faltam]) => !chaves.aparelhos.some((a) => a.id === prof3.id) && chaves.aparelhos.every((a) => a.certificado) && !faltam.some((x) => x.para === prof3.id));
await espera("o banco não guarda embrulho para aparelho pendente, mesmo que alguém mande", async () => {
  const chave = await novaChave();
  const r = await abrirChaves(aparelhos.designer, privada);
  const versao = Math.max((r.atual ?? 0) + 1, r.minima);
  const embrulhos = [{ para: aparelhos.designer.id, embrulho: await embrulhar(chave, aparelhos.designer.privada, aparelhos.designer.publica, contextoDoEmbrulho(privada, versao, aparelhos.designer.id)) },
    { para: prof3.id, embrulho: await embrulhar(chave, aparelhos.designer.privada, prof3.publica, contextoDoEmbrulho(privada, versao, prof3.id)) }];
  await rpc(como(ids.designer), "chat_chave_nova", { p_conversa: privada, p_aparelho: aparelhos.designer.id, p_versao: versao, p_embrulhos: embrulhos });
  aparelhos.designer.chaves.set(`${privada}:${versao}`, chave);
  const dadas = await rpc(como(ids.designer), "chat_chaves_dar", { p_aparelho: aparelhos.designer.id, p_embrulhos: [{ conversa: privada, versao, para: prof3.id, embrulho: embrulhos[1].embrulho }] });
  return [(await dono("select count(*)::int as n from interno.chat_chaves where para = $1", [prof3.id])).rows[0].n, dadas.dadas];
}, (r) => r[0] === 0 && r[1] === 0);
await recusa("aparelho pendente não cria versão de chave", async () => rpc(como(ids.prof), "chat_chave_nova", { p_conversa: privada, p_aparelho: prof3.id, p_versao: 99, p_embrulhos: [{ para: prof3.id, embrulho: `w1.${"A".repeat(16)}.${"B".repeat(64)}` }] }), "aparelho_desconhecido");
await recusa("aparelho pendente não repassa chaves", () => rpc(como(ids.prof), "chat_chaves_dar", { p_aparelho: prof3.id, p_embrulhos: [] }), "aparelho_desconhecido");
await recusa("outra pessoa não aprova aparelho alheio", () => rpc(como(ids.designer), "chat_aparelho_aprovar", { p_id: prof3.id, p_por: aparelhos.designer.id, p_certificado: "A".repeat(86), p_identidade_embrulho: `w1.${"A".repeat(16)}.${"B".repeat(64)}` }), "nao_encontrado");
await recusa("aparelho pendente não aprova ninguém", () => rpc(como(ids.prof), "chat_aparelho_aprovar", { p_id: prof3.id, p_por: prof3.id, p_certificado: "A".repeat(86), p_identidade_embrulho: `w1.${"A".repeat(16)}.${"B".repeat(64)}` }), "aparelho_desconhecido");
await espera("o código errado não aprova", () => aprovar(aparelhos.prof, prof3, prof3.codigo === "00000000" ? "00000001" : "00000000"), (r) => r === false);
await espera("ainda pendente, o aparelho novo não tem a identidade", () => conferirAprovacao(prof3), (r) => r === false);
await espera("com o código certo, o aparelho aprovado certifica o novo e lhe repassa a identidade", async () => [await aprovar(aparelhos.prof, prof3), await conferirAprovacao(prof3)], (r) => r[0] === true && r[1] === true && prof3.identidade.publica === aparelhos.prof.identidade.publica);
await espera("aprovado, o aparelho novo aparece para os colegas, com certificado válido, e fica no registro", async () => {
  const chaves = await rpc(como(ids.designer), "chat_chaves", { p_conversa: privada, p_aparelho: aparelhos.designer.id });
  const novo = chaves.aparelhos.find((a) => a.id === prof3.id);
  return [Boolean(novo), novo && (await aparelhoCertificado(aparelhos.prof.identidade.publica, ids.prof, novo.publica, novo.certificado)), (await rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "chat_aparelho_aprovado" })).length];
}, (r) => r[0] === true && r[1] === true && r[2] === 1);
await recusa("aprovar duas vezes não dá", () => aprovar(aparelhos.prof, prof3).then(() => { throw new Error("nao_encontrado"); }), "nao_encontrado");
await espera("os colegas repassam as chaves ao aparelho aprovado, e ele lê a conversa com a autoria conferida", async () => {
  await rpc(como(ids.designer), "chat_enviar", { p_id: privada, p_corpo: await selar(aparelhos.designer, privada, "Mensagem para o celular novo.", contextoDaConversa(privada, ids.designer)) });
  const repassadas = await repassar(aparelhos.designer);
  const aberta = await rpc(como(ids.prof), "chat_ver", { p_id: privada });
  const ultima = aberta.mensagens.at(-1);
  return [repassadas >= 1, await lerCom(prof3, privada, ultima.corpo, contextoDaConversa(privada, ultima.autor), ultima.autor)];
}, (r) => r[0] === true && r[1]?.texto === "Mensagem para o celular novo." && r[1].autoria === "ok");
let falso;
await espera("aparelho falso cadastrado direto no banco (como faria quem tem a chave de serviço) não recebe chave de ninguém", async () => {
  const par = await novoAparelho();
  const idFalsa = await novaIdentidade();
  // O invasor assina com uma identidade que inventou: a dele, não a de Paulo.
  falso = (await dono("insert into interno.chat_aparelhos (usuario, publica, rotulo, certificado, aprovado_em) values ($1, $2, 'invasor', $3, now()) returning id", [ids.prof, par.publica, await certificarAparelho(idFalsa, ids.prof, par.publica)])).rows[0].id;
  const chaves = await rpc(como(ids.designer), "chat_chaves", { p_conversa: privada, p_aparelho: aparelhos.designer.id });
  // O banco lista o aparelho (não sabe conferir); o aparelho do colega confere e não embrulha para ele.
  await rpc(como(ids.designer), "chat_enviar", { p_id: privada, p_corpo: await selar(aparelhos.designer, privada, "Só para aparelhos de verdade.", contextoDaConversa(privada, ids.designer)) });
  const designerRepassou = await repassar(aparelhos.designer);
  const profRepassou = await repassar(aparelhos.prof);
  return [chaves.aparelhos.some((a) => a.id === falso), (await dono("select count(*)::int as n from interno.chat_chaves where para = $1", [falso])).rows[0].n, designerRepassou, profRepassou];
}, (r) => r[0] === true && r[1] === 0 && r[2] === 0 && r[3] === 0);
await espera("nem com o certificado copiado de um aparelho de verdade", async () => {
  const par = await novoAparelho();
  const copiado = (await dono("select certificado from interno.chat_aparelhos where id = $1", [prof3.id])).rows[0].certificado;
  const id = (await dono("insert into interno.chat_aparelhos (usuario, publica, rotulo, certificado, aprovado_em) values ($1, $2, 'invasor 2', $3, now()) returning id", [ids.prof, par.publica, copiado])).rows[0].id;
  await repassar(aparelhos.designer);
  await repassar(aparelhos.prof);
  const n = (await dono("select count(*)::int as n from interno.chat_chaves where para = $1", [id])).rows[0].n;
  await dono("delete from interno.chat_aparelhos where id in ($1, $2)", [id, falso]);
  return n;
}, (r) => r === 0);
await espera("o banco não consegue trocar o autor de uma mensagem assinada: a assinatura denuncia", async () => {
  // Mentora escreve no grupo com o próprio contexto; o banco troca o autor para o professor.
  const grupoDeTeste = (await rpc(como(ids.mentora), "chat_grupo_criar", { p_nome: "Grupo da assinatura", p_membros: [ids.prof, ids.designer] })).id;
  await direta("prof", "mentora");
  const corpoHonesto = await selar(aparelhos.mentora, grupoDeTeste, "Fui eu que escrevi.", contextoDaConversa(grupoDeTeste, ids.mentora));
  const { id } = await rpc(como(ids.mentora), "chat_enviar", { p_id: grupoDeTeste, p_corpo: corpoHonesto });
  const honesta = await lerCom(aparelhos.designer, grupoDeTeste, corpoHonesto, contextoDaConversa(grupoDeTeste, ids.mentora), ids.mentora);
  // Quem tem a chave do grupo (um membro) forja uma mensagem "do professor", assinando com a própria identidade.
  const versao = Number(corpoHonesto.split(".")[1]);
  const forjado = await cifrar(aparelhos.mentora.chaves.get(`${grupoDeTeste}:${versao}`), versao, await assinarTexto(aparelhos.mentora.identidade, "O professor nunca escreveu isto.", contextoDaConversa(grupoDeTeste, ids.prof), versao), contextoDaConversa(grupoDeTeste, ids.prof));
  await dono("insert into interno.conversa_mensagens (conversa, autor, corpo, versao) values ($1, $2, $3, $4)", [grupoDeTeste, ids.prof, forjado, versao]);
  const forjada = await lerCom(aparelhos.designer, grupoDeTeste, forjado, contextoDaConversa(grupoDeTeste, ids.prof), ids.prof);
  // E uma mensagem sem assinatura nenhuma (cliente antigo) abre, mas fica marcada.
  const semAssinatura = await cifrar(aparelhos.mentora.chaves.get(`${grupoDeTeste}:${versao}`), versao, "Sem assinatura.", contextoDaConversa(grupoDeTeste, ids.mentora));
  const antiga = await lerCom(aparelhos.designer, grupoDeTeste, semAssinatura, contextoDaConversa(grupoDeTeste, ids.mentora), ids.mentora);
  await rpc(como(ids.mentora), "chat_grupo_apagar", { p_id: grupoDeTeste });
  return [Boolean(id), honesta, forjada, antiga];
}, ([ok, honesta, forjada, antiga]) => ok && honesta.autoria === "ok" && forjada.texto === "O professor nunca escreveu isto." && forjada.autoria === "invalida" && antiga.autoria === "sem_assinatura");
await espera("a chave da conversa traz quando foi criada e quantas mensagens levou, para a rotação periódica", () => rpc(como(ids.designer), "chat_chaves", { p_conversa: privada, p_aparelho: aparelhos.designer.id }), (r) => typeof r.atual_em === "string" && typeof r.atual_mensagens === "number" && r.atual_mensagens >= 1);
await espera("identidade de colega que muda no banco é notada pelos aparelhos dos outros", async () => {
  const antes = conhecidas[ids.mentora].assina;
  const outra = await novaIdentidade();
  await dono("update interno.chat_identidades set assina = $1 where usuario = $2", [outra.publica, ids.mentora]);
  const privadaMentora = (await direta("prof", "mentora")).id;
  await abrirChaves(aparelhos.prof, privadaMentora);
  const mudou = conhecidas[ids.mentora].mudou && conhecidas[ids.mentora].anterior === antes;
  await dono("update interno.chat_identidades set assina = $1 where usuario = $2", [antes, ids.mentora]);
  conhecidas[ids.mentora] = { assina: antes, mudou: false };
  return mudou;
}, (r) => r === true);
// ── Cópia de recuperação ──
const frase = novaChaveDeRecuperacao();
await recusa("quem não é da equipe não guarda cópia", () => rpc(como(ids.leitora), "chat_recuperacao_guardar", { p_copia: { sal: "A".repeat(22), iv: "A".repeat(16), cifrado: "A".repeat(60) } }), "sem_permissao");
await recusa("cópia fora do formato é recusada", () => rpc(como(ids.prof), "chat_recuperacao_guardar", { p_copia: { sal: "x" } }), "invalido:copia");
await espera("a pessoa guarda a cópia cifrada da identidade; o banco não lê nada dela", async () => {
  const secreta = await exportarIdentidade(aparelhos.prof.identidade);
  const copia = { identidade: { secreta: paraBase64(secreta), publica: aparelhos.prof.identidade.publica }, chaves: [], quando: new Date().toISOString() };
  await rpc(como(ids.prof), "chat_recuperacao_guardar", { p_copia: await selarCopia(frase, ids.prof, copia) });
  const guardada = (await dono("select copia::text as c from interno.chat_recuperacoes where usuario = $1", [ids.prof])).rows[0].c;
  return [guardada.includes(copia.identidade.secreta.slice(0, 10)), await rpc(como(ids.designer), "chat_recuperacao_ler")];
}, (r) => r[0] === false && r[1] === null);
let prof4;
await espera("num aparelho novo, a chave de recuperação restaura a identidade sem precisar de outro aparelho", async () => {
  prof4 = await aparelhoDe("prof", "computador novo");
  const guardada = await rpc(como(ids.prof), "chat_recuperacao_ler");
  const copia = await abrirCopia(frase, ids.prof, guardada.copia);
  const identidade = await importarIdentidade(deBase64(copia.identidade.secreta), copia.identidade.publica);
  const r = await rpc(como(ids.prof), "chat_aparelho_recuperar", { p_id: prof4.id, p_assina: identidade.publica, p_certificado: await certificarAparelho(identidade, ids.prof, prof4.publica) });
  prof4.identidade = identidade;
  prof4.estado = r.estado;
  const chaves = await rpc(como(ids.designer), "chat_chaves", { p_conversa: privada, p_aparelho: aparelhos.designer.id });
  return [r.estado, chaves.aparelhos.some((a) => a.id === prof4.id), conhecidas[ids.prof].assina === identidade.publica];
}, (r) => r[0] === "aprovado" && r[1] === true && r[2] === true);
await recusa("identidade de outra conta não recupera", async () => { const p = await aparelhoDe("prof", "intruso"); const outra = await novaIdentidade(); return rpc(como(ids.prof), "chat_aparelho_recuperar", { p_id: p.id, p_assina: outra.publica, p_certificado: await certificarAparelho(outra, ids.prof, p.publica) }); }, "identidade_diferente");
await espera("pedido de aprovação esquecido some na faxina; aparelho pendente deixa pedido novo", async () => {
  const p = await aparelhoDe("prof", "esquecido");
  await dono("update interno.chat_aparelhos set pedido_em = now() - interval '2 days' where id = $1", [p.id]);
  await dono("select interno.limpeza()");
  const sumiu = (await dono("select count(*)::int as n from interno.chat_aparelhos where id = $1", [p.id])).rows[0].n === 0;
  const outro = await aparelhoDe("prof", "de novo");
  const novoCodigoDoOutro = novoCodigo();
  const r = await rpc(como(ids.prof), "chat_aparelho_pedir", { p_id: outro.id, p_pedido: await selarPedido(novoCodigoDoOutro, ids.prof, outro.publica) });
  outro.codigo = novoCodigoDoOutro;
  return [sumiu, r.estado, await aprovar(prof4, outro)];
}, (r) => r[0] === true && r[1] === "pendente" && r[2] === true);
await espera("quem perdeu tudo recomeça: aparelhos antigos saem, a identidade muda e os colegas notam", async () => {
  const antes = conhecidas[ids.mentora].assina;
  await rpc(como(ids.mentora), "chat_identidade_redefinir");
  const restaram = (await dono("select count(*)::int as n from interno.chat_aparelhos where usuario = $1", [ids.mentora])).rows[0].n;
  const linha = (await dono("select assina, versao from interno.chat_identidades where usuario = $1", [ids.mentora])).rows[0];
  aparelhos.mentora = await aparelhoDe("mentora", "recomeço");
  const privadaMentora = (await direta("prof", "mentora")).id;
  await abrirChaves(aparelhos.prof, privadaMentora);
  return [restaram, linha.assina, linha.versao, aparelhos.mentora.estado, conhecidas[ids.mentora].mudou && conhecidas[ids.mentora].anterior === antes && conhecidas[ids.mentora].assina === aparelhos.mentora.identidade.publica];
}, (r) => r[0] === 0 && r[1] === null && r[2] === 2 && r[3] === "aprovado" && r[4] === true);
await dono("delete from interno.chat_aparelhos where id in ($1, $2)", [prof3.id, prof4.id]);

// ── Mensagens: entrega, "digitando…", reações, edições, fixadas, favoritas e as preferências de privacidade ──
// Reação, edição, citação e encaminhada vão dentro do cifrado. O banco só sabe o tipo ("reacao"/"edicao") e qual mensagem é o alvo.
const jm = (await direta("jornal", "med")).id;
const enviaJornal = async (texto, extra = {}) => rpc(como(ids.jornal), "chat_enviar", { p_id: jm, p_corpo: await selar(aparelhos.jornal, jm, texto, contextoDaConversa(jm, ids.jornal)), ...extra });
const enviaMed = async (texto, extra = {}) => rpc(como(ids.med), "chat_enviar", { p_id: jm, p_corpo: await selar(aparelhos.med, jm, texto, contextoDaConversa(jm, ids.med)), ...extra });
const membroVisto = async (quem, outro) => (await rpc(como(ids[quem]), "chat_ver", { p_id: jm })).membros.find((m) => m.id === ids[outro]);
let pauta;
await espera("mensagem enviada: o outro ainda não recebeu nem leu (um tique)", async () => { pauta = (await enviaJornal("Pauta de amanhã: *greve* dos metroviários.")).id; const m = await membroVisto("jornal", "med"); const g = (await rpc(como(ids.jornal), "chat_ver", { p_id: jm })).mensagens[0]; return [m.recebido_em < g.criado_em, m.lido_em === null || m.lido_em < g.criado_em]; }, (r) => r[0] && r[1]);
await espera("o aparelho do outro avisa que recebeu (dois tiques), sem marcar como lida", async () => { await rpc(como(ids.med), "chat_recebidas", { p_id: jm }); const m = await membroVisto("jornal", "med"); const g = (await rpc(como(ids.jornal), "chat_ver", { p_id: jm })).mensagens[0]; return [m.recebido_em >= g.criado_em, m.lido_em === null || m.lido_em < g.criado_em]; }, (r) => r[0] && r[1]);
await recusa("ninguém marca recebimento em conversa em que não está", () => rpc(como(ids.revisor), "chat_recebidas", { p_id: jm }), "nao_encontrado");
await espera("abrir a conversa marca como lida (tiques de leitura)", async () => { await rpc(como(ids.med), "chat_ver", { p_id: jm }); const m = await membroVisto("jornal", "med"); const g = (await rpc(como(ids.jornal), "chat_ver", { p_id: jm })).mensagens[0]; return m.lido_em >= g.criado_em; }, (r) => r === true);
await espera("\"digitando…\" aparece para o outro e some ao parar", async () => {
  await rpc(como(ids.med), "chat_digitando", { p_id: jm, p_tipo: "texto" });
  const durante = (await membroVisto("jornal", "med")).digitando;
  const proprio = (await membroVisto("med", "med")).digitando;
  await rpc(como(ids.med), "chat_digitando", { p_id: jm, p_tipo: "" });
  return [durante, proprio, (await membroVisto("jornal", "med")).digitando];
}, (r) => r[0] === "texto" && r[1] === "" && r[2] === "");
await espera("\"gravando áudio…\" vence sozinho depois de oito segundos", async () => {
  await rpc(como(ids.med), "chat_digitando", { p_id: jm, p_tipo: "audio" });
  const durante = (await membroVisto("jornal", "med")).digitando;
  await dono("update interno.conversa_membros set digitando_em = now() - interval '20 seconds' where conversa = $1 and usuario = $2", [jm, ids.med]);
  return [durante, (await membroVisto("jornal", "med")).digitando];
}, (r) => r[0] === "audio" && r[1] === "");
await recusa("\"digitando\" só com os tipos da lista", () => rpc(como(ids.med), "chat_digitando", { p_id: jm, p_tipo: "video" }), "invalido:tipo");
await recusa("quem está de fora não avisa que digita", () => rpc(como(ids.revisor), "chat_digitando", { p_id: jm, p_tipo: "texto" }), "nao_encontrado");
await recusa("tipo de mensagem fora da lista é recusado", () => enviaMed("x", { p_tipo: "figurinha" }), "invalido:tipo");
await recusa("texto comum não aponta para outra mensagem", () => enviaMed("x", { p_alvo: pauta }), "invalido:alvo");
await recusa("reação precisa de uma mensagem de texto da mesma conversa", () => enviaMed("", { p_tipo: "reacao", p_alvo: crypto.randomUUID() }), "nao_encontrado");
await recusa("nem de outra conversa", async () => { const outra = (await direta("med", "revisor")).id; const m = await rpc(como(ids.med), "chat_enviar", { p_id: outra, p_corpo: await selar(aparelhos.med, outra, "oi", contextoDaConversa(outra, ids.med)) }); return enviaMed("", { p_tipo: "reacao", p_alvo: m.id }); }, "nao_encontrado");
let reacao;
await espera("reagir cria uma mensagem do tipo reação, apontando para o alvo, sem contar como não lida", async () => {
  await rpc(como(ids.jornal), "chat_ver", { p_id: jm });
  reacao = (await enviaMed("", { p_tipo: "reacao", p_alvo: pauta })).id;
  const r = await rpc(como(ids.jornal), "chat_ver", { p_id: jm });
  const lista = (await rpc(como(ids.jornal), "chat_conversas")).find((c) => c.id === jm);
  return [r.mensagens.find((m) => m.id === reacao), lista.nao_lidas, lista.ultima.corpo === r.mensagens.find((m) => m.id === pauta).corpo];
}, ([m, naoLidas, ultimaEhTexto]) => m?.tipo === "reacao" && m.alvo === pauta && m.nome === "Mauro" && naoLidas === 0 && ultimaEhTexto);
await espera("reagir de novo troca a reação: fica só uma por pessoa", async () => { await enviaMed("", { p_tipo: "reacao", p_alvo: pauta }); return dono("select count(*)::int as n from interno.conversa_mensagens where tipo = 'reacao' and alvo = $1 and autor = $2", [pauta, ids.med]); }, (r) => r.rows[0].n === 1);
await recusa("não se reage a uma reação", async () => { const atual = (await dono("select id from interno.conversa_mensagens where tipo = 'reacao' and alvo = $1", [pauta])).rows[0].id; return enviaJornal("", { p_tipo: "reacao", p_alvo: atual }); }, "nao_encontrado");
await recusa("ninguém edita mensagem de outra pessoa", () => enviaMed("Pauta trocada.", { p_tipo: "edicao", p_alvo: pauta }), "sem_permissao");
await espera("a autora edita a própria mensagem: a edição aponta para a original e não vira mensagem nova na lista", async () => {
  const antes = (await dono("select movida_em from interno.conversas where id = $1", [jm])).rows[0].movida_em;
  const edicao = (await enviaJornal("Pauta de amanhã: *greve* dos metroviários, às 6h.", { p_tipo: "edicao", p_alvo: pauta })).id;
  const r = await rpc(como(ids.med), "chat_ver", { p_id: jm });
  const m = r.mensagens.find((x) => x.id === edicao);
  const texto = await ler(aparelhos.med, jm, m.corpo, contextoDaConversa(jm, ids.jornal));
  return [m.tipo, m.alvo, texto, String((await dono("select movida_em from interno.conversas where id = $1", [jm])).rows[0].movida_em) === String(antes)];
}, (r) => r[0] === "edicao" && r[1] === pauta && r[2] === "Pauta de amanhã: *greve* dos metroviários, às 6h." && r[3] === true);
await recusa("depois de quinze minutos não dá mais para editar", async () => { await dono("update interno.conversa_mensagens set criado_em = criado_em - interval '16 minutes' where id = $1", [pauta]); return enviaJornal("Tarde demais.", { p_tipo: "edicao", p_alvo: pauta }); }, "fora_do_prazo");
await recusa("quem está de fora não fixa", () => rpc(como(ids.revisor), "chat_fixar", { p_mensagem: pauta }), "nao_encontrado");
await recusa("não se fixa uma reação", () => rpc(como(ids.med), "chat_fixar", { p_mensagem: reacao }), "nao_encontrado");
await espera("qualquer um da conversa fixa uma mensagem, e todos veem", async () => { await rpc(como(ids.med), "chat_fixar", { p_mensagem: pauta }); return rpc(como(ids.jornal), "chat_ver", { p_id: jm }); }, (r) => r.fixadas.length === 1 && r.fixadas[0] === pauta);
await recusa("no máximo cinco fixadas por conversa", async () => { for (let i = 0; i < 4; i++) await rpc(como(ids.med), "chat_fixar", { p_mensagem: (await enviaMed(`Recado ${i}`)).id }); return rpc(como(ids.med), "chat_fixar", { p_mensagem: (await enviaMed("A sexta")).id }); }, "limite_fixadas");
await espera("desafixar", async () => { await rpc(como(ids.jornal), "chat_fixar", { p_mensagem: pauta, p_fixar: false }); return rpc(como(ids.jornal), "chat_ver", { p_id: jm }); }, (r) => r.fixadas.length === 4 && !r.fixadas.includes(pauta));
await recusa("quem está de fora não favorita", () => rpc(como(ids.revisor), "chat_favoritar", { p_mensagem: pauta }), "nao_encontrado");
await espera("favoritar é de cada pessoa: aparece na conversa e na lista de favoritas, com o nome da conversa; o outro não vê", async () => {
  await rpc(como(ids.med), "chat_favoritar", { p_mensagem: pauta });
  return [(await rpc(como(ids.med), "chat_ver", { p_id: jm })).favoritas, (await rpc(como(ids.jornal), "chat_ver", { p_id: jm })).favoritas, await rpc(como(ids.med), "chat_favoritas"), await rpc(como(ids.jornal), "chat_favoritas")];
}, ([minhas, dele, lista, listaDele]) => minhas.length === 1 && minhas[0] === pauta && dele.length === 0 && lista.length === 1 && lista[0].conversa_nome === "Joana" && lista[0].nome === "Joana" && lista[0].corpo.startsWith("c2.") && listaDele.length === 0);
await espera("tirar das favoritas", async () => { await rpc(como(ids.med), "chat_favoritar", { p_mensagem: pauta, p_favoritar: false }); return rpc(como(ids.med), "chat_favoritas"); }, (r) => r.length === 0);
await espera("apagar o texto leva as reações, edições e fixadas junto", async () => { const fixada = (await rpc(como(ids.med), "chat_ver", { p_id: jm })).fixadas[0]; await rpc(como(ids.jornal), "chat_apagar", { p_id: pauta }); await rpc(como(ids.med), "chat_apagar", { p_id: fixada }); return [(await dono("select count(*)::int as n from interno.conversa_mensagens where alvo = $1 or id = $1", [pauta])).rows[0].n, (await rpc(como(ids.med), "chat_ver", { p_id: jm })).fixadas.length]; }, (r) => r[0] === 0 && r[1] === 3);
await espera("por padrão, cada um vê o 'visto por último' e a leitura do outro", async () => [await membroVisto("jornal", "med"), await membroVisto("med", "jornal")], ([a, b]) => typeof a.online === "boolean" && typeof a.visto_em === "string" && typeof a.lido_em === "string" && typeof b.online === "boolean");
await espera("quem esconde o 'visto por último' some para os outros e deixa de ver o dos outros (na conversa, na lista e na equipe)", async () => {
  await rpc(como(ids.med), "perfil_preferencias", { p_chat_visto: false, p_chat_leitura: null });
  const eu = await rpc(como(ids.med), "eu");
  const lista = (await rpc(como(ids.jornal), "chat_conversas")).find((c) => c.id === jm);
  const equipe = (await rpc(como(ids.jornal), "equipe_membros")).find((m) => m.id === ids.med);
  return [eu.chat_visto, await membroVisto("jornal", "med"), await membroVisto("med", "jornal"), lista.online, lista.visto_em, equipe.online, equipe.visto_em];
}, ([visto, a, b, online, vistoEm, eqOnline, eqVisto]) => visto === false && a.online === null && a.visto_em === null && typeof a.lido_em === "string" && b.online === null && b.visto_em === null && online === null && vistoEm === null && eqOnline === null && eqVisto === null);
await espera("quem desliga a confirmação de leitura não mostra nem vê a dos outros; o 'visto' volta ao ligar de novo", async () => {
  await rpc(como(ids.med), "perfil_preferencias", { p_chat_visto: true, p_chat_leitura: false });
  await rpc(como(ids.med), "chat_ver", { p_id: jm });
  return [await membroVisto("jornal", "med"), await membroVisto("med", "jornal"), (await rpc(como(ids.med), "eu")).chat_leitura];
}, ([a, b, leitura]) => a.lido_em === null && typeof a.online === "boolean" && b.lido_em === null && leitura === false);
await espera("a pessoa vê a própria leitura e presença mesmo com tudo desligado; e tudo volta ao ligar", async () => {
  const propria = await membroVisto("med", "med");
  await rpc(como(ids.med), "perfil_preferencias", { p_chat_visto: null, p_chat_leitura: true });
  return [propria, await membroVisto("jornal", "med")];
}, ([propria, a]) => typeof propria.lido_em === "string" && typeof propria.online === "boolean" && typeof a.lido_em === "string");

// ── Arquivos nas conversas: sobem cifrados, presos à mensagem; ver uma vez; somem com a mensagem ──
const cifradoFalso = (bytes = 64) => Buffer.from(Array.from({ length: bytes }, (_, i) => (i * 13) % 256)).toString("base64");
const jmGrupo = (await rpc(como(ids.jornal), "chat_grupo_criar", { p_nome: "Fotos da feira", p_membros: [ids.med, ids.revisor] })).id;
let anexo;
await recusa("quem está de fora não sobe arquivo", () => rpc(como(ids.designer), "chat_anexo_enviar", { p_conversa: jm, p_cifrado: cifradoFalso() }), "nao_encontrado");
await recusa("o que não é base64 é recusado", () => rpc(como(ids.jornal), "chat_anexo_enviar", { p_conversa: jm, p_cifrado: "isto não é base64!!" }), "invalido:arquivo");
await espera("o arquivo cifrado sobe solto, sem mensagem", async () => { anexo = (await rpc(como(ids.jornal), "chat_anexo_enviar", { p_conversa: jm, p_cifrado: cifradoFalso() })).id; return dono("select mensagem, tamanho, uma_vez from interno.conversa_anexos where id = $1", [anexo]); }, (r) => r.rows[0].mensagem === null && r.rows[0].tamanho === 64 && r.rows[0].uma_vez === false);
await recusa("solto, ninguém baixa (nem quem subiu)", () => rpc(como(ids.jornal), "chat_anexo_ler", { p_id: anexo }), "nao_encontrado");
await recusa("outra pessoa não prende o arquivo dos outros à própria mensagem", () => enviaMed("Foto", { p_anexos: [anexo] }), "invalido:anexos");
await recusa("reação não leva arquivo", async () => { const m = (await enviaJornal("Com texto")).id; return enviaMed("", { p_tipo: "reacao", p_alvo: m, p_anexos: [anexo] }); }, "invalido:anexos");
await recusa("arquivo de outra conversa não entra", async () => rpc(como(ids.jornal), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.jornal, jmGrupo, "Foto errada", contextoDaConversa(jmGrupo, ids.jornal)), p_anexos: [anexo] }), "invalido:anexos");
let comAnexo;
await espera("a mensagem prende o arquivo e todos da conversa veem o estado dele", async () => { comAnexo = (await enviaJornal("Foto da feira", { p_anexos: [anexo] })).id; const r = await rpc(como(ids.med), "chat_ver", { p_id: jm }); return r.mensagens.find((m) => m.id === comAnexo).anexos; }, (r) => r.length === 1 && r[0].id === anexo && r[0].uma_vez === false && r[0].disponivel === true && r[0].aberto === false);
await recusa("o mesmo arquivo não entra numa segunda mensagem", () => enviaJornal("De novo", { p_anexos: [anexo] }), "invalido:anexos");
await espera("quem está na conversa baixa o cifrado, quantas vezes quiser; quem subiu também", async () => [(await rpc(como(ids.med), "chat_anexo_ler", { p_id: anexo })).cifrado, (await rpc(como(ids.med), "chat_anexo_ler", { p_id: anexo })).cifrado, (await rpc(como(ids.jornal), "chat_anexo_ler", { p_id: anexo })).cifrado], (r) => r.every((c) => c.replace(/\s/g, "") === cifradoFalso()));
await recusa("quem está de fora não baixa", () => rpc(como(ids.designer), "chat_anexo_ler", { p_id: anexo }), "nao_encontrado");
await espera("no banco há só bytes cifrados, sem tipo, nome ou chave", () => dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'conversa_anexos'"), (r) => { const colunas = r.rows.map((x) => x.column_name); return !colunas.some((c) => /nome|tipo|mime|chave|legenda/.test(c)); });
await espera("apagar a mensagem leva o arquivo junto", async () => { await rpc(como(ids.jornal), "chat_apagar", { p_id: comAnexo }); return dono("select count(*)::int as n from interno.conversa_anexos where id = $1", [anexo]); }, (r) => r.rows[0].n === 0);
let umaVez;
await espera("ver uma vez: num grupo, quem enviou não relê; cada um dos outros lê uma só vez; os bytes somem quando todos leram", async () => {
  umaVez = (await rpc(como(ids.jornal), "chat_anexo_enviar", { p_conversa: jmGrupo, p_cifrado: cifradoFalso(96), p_uma_vez: true })).id;
  const m = (await rpc(como(ids.jornal), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.jornal, jmGrupo, "Só uma vez", contextoDaConversa(jmGrupo, ids.jornal)), p_anexos: [umaVez] })).id;
  const autora = await rpc(como(ids.jornal), "chat_anexo_ler", { p_id: umaVez }).then(() => "leu", (e) => e.message);
  const primeira = (await rpc(como(ids.med), "chat_anexo_ler", { p_id: umaVez })).cifrado.replace(/\s/g, "") === cifradoFalso(96);
  const segunda = await rpc(como(ids.med), "chat_anexo_ler", { p_id: umaVez }).then(() => "leu", (e) => e.message);
  const estadoMed = (await rpc(como(ids.med), "chat_ver", { p_id: jmGrupo })).mensagens.find((x) => x.id === m).anexos[0];
  const aindaTem = (await dono("select cifrado is not null as tem from interno.conversa_anexos where id = $1", [umaVez])).rows[0].tem;
  const ultima = (await rpc(como(ids.revisor), "chat_anexo_ler", { p_id: umaVez })).cifrado.replace(/\s/g, "") === cifradoFalso(96);
  const depois = (await dono("select cifrado is null as sumiu, cardinality(visto_por)::int as n from interno.conversa_anexos where id = $1", [umaVez])).rows[0];
  const estadoRevisor = (await rpc(como(ids.revisor), "chat_ver", { p_id: jmGrupo })).mensagens.find((x) => x.id === m).anexos[0];
  return [autora, primeira, segunda, estadoMed, aindaTem, ultima, depois, estadoRevisor];
}, ([autora, primeira, segunda, estadoMed, aindaTem, ultima, depois, estadoRevisor]) => autora.includes("ja_visto") && primeira && segunda.includes("ja_visto") && estadoMed.aberto === true && estadoMed.disponivel === true && aindaTem === true && ultima && depois.sumiu === true && depois.n === 2 && estadoRevisor.aberto === true && estadoRevisor.disponivel === false);
await espera("a faxina apaga arquivo solto há mais de uma hora e some com os bytes do 'ver uma vez' de catorze dias", async () => {
  const solto = (await rpc(como(ids.jornal), "chat_anexo_enviar", { p_conversa: jm, p_cifrado: cifradoFalso() })).id;
  const velho = (await rpc(como(ids.jornal), "chat_anexo_enviar", { p_conversa: jm, p_cifrado: cifradoFalso(), p_uma_vez: true })).id;
  await rpc(como(ids.jornal), "chat_enviar", { p_id: jm, p_corpo: await selar(aparelhos.jornal, jm, "Velha", contextoDaConversa(jm, ids.jornal)), p_anexos: [velho] });
  await dono("update interno.conversa_anexos set criado_em = now() - interval '15 days' where id in ($1, $2)", [solto, velho]);
  await dono("select interno.limpeza()");
  return [(await dono("select count(*)::int as n from interno.conversa_anexos where id = $1", [solto])).rows[0].n, (await dono("select cifrado is null as sumiu from interno.conversa_anexos where id = $1", [velho])).rows[0].sumiu];
}, (r) => r[0] === 0 && r[1] === true);
await recusa("arquivo acima do limite é recusado pelo banco", () => rpc(como(ids.jornal), "chat_anexo_enviar", { p_conversa: jm, p_cifrado: "A".repeat(16800001) }), "invalido:arquivo");
await espera("o botão de apagar tudo leva os arquivos junto", async () => { await rpc(como(ids.coord), "equipe_apagar_tudo"); return dono("select count(*)::int as n from interno.conversa_anexos where mensagem is not null"); }, (r) => r.rows[0].n === 0);

// ── Organização e grupos: fixar, arquivar, silenciar, não lida, trancar; administradores e permissões; avisos do sistema; enquete e evento; relato ──
const listaDe = async (quem) => rpc(como(ids[quem]), "chat_conversas");
const achar = async (quem, id) => (await listaDe(quem)).find((c) => c.id === id);
await recusa("quem está de fora não marca a conversa", () => rpc(como(ids.designer), "chat_conversa_marcar", { p_id: jm, p_fixar: true }), "nao_encontrado");
await recusa("silenciar só com os prazos da lista", () => rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_silenciar_horas: 3 }), "invalido:horas");
await espera("fixar põe a conversa no alto da lista; é só de quem fixou", async () => {
  await rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_fixar: true });
  const minha = await listaDe("med");
  return [minha[0].id === jm && minha[0].fixada === true, (await achar("jornal", jm)).fixada];
}, (r) => r[0] === true && r[1] === false);
await espera("silenciar tira da contagem do painel; marcar como não lida põe de volta; abrir desmarca", async () => {
  await rpc(como(ids.jornal), "chat_enviar", { p_id: jm, p_corpo: await selar(aparelhos.jornal, jm, "Chegou?", contextoDaConversa(jm, ids.jornal)) });
  const comNova = (await rpc(como(ids.med), "presenca")).conversas;
  await rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_silenciar_horas: 8 });
  const silenciada = (await rpc(como(ids.med), "presenca")).conversas;
  const marca = (await achar("med", jm)).silenciada;
  await rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_silenciar_horas: 0 });
  await rpc(como(ids.med), "chat_ver", { p_id: jm });
  const lida = (await rpc(como(ids.med), "presenca")).conversas;
  await rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_nao_lida: true });
  const naoLida = (await rpc(como(ids.med), "presenca")).conversas;
  const marcada = (await achar("med", jm)).marcada_nao_lida;
  await rpc(como(ids.med), "chat_ver", { p_id: jm });
  return [comNova, silenciada, marca, lida, naoLida, marcada, (await achar("med", jm)).marcada_nao_lida];
}, (r) => r[0] >= 1 && r[1] === r[0] - 1 && r[2] === true && r[3] === r[0] - 1 && r[4] === r[0] && r[5] === true && r[6] === false);
await espera("arquivar some da contagem e volta sozinha quando chega mensagem", async () => {
  await rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_arquivar: true, p_fixar: false });
  const arquivada = (await achar("med", jm)).arquivada;
  await rpc(como(ids.jornal), "chat_enviar", { p_id: jm, p_corpo: await selar(aparelhos.jornal, jm, "Oi de novo", contextoDaConversa(jm, ids.jornal)) });
  return [arquivada, (await achar("med", jm)).arquivada];
}, (r) => r[0] === true && r[1] === false);
await espera("trancar com a digital é marca da pessoa, em todos os aparelhos dela", async () => { await rpc(como(ids.med), "chat_conversa_marcar", { p_id: jm, p_trancar: true }); return [(await achar("med", jm)).trancada, (await achar("jornal", jm)).trancada]; }, (r) => r[0] === true && r[1] === false);
// Grupo: a jornalista criou (administradora); o mediador e o revisor são membros.
await espera("quem criou o grupo é administrador; os outros não", async () => rpc(como(ids.med), "chat_ver", { p_id: jmGrupo }), (r) => r.admin === false && r.membros.find((m) => m.id === ids.jornal).admin === true && r.membros.find((m) => m.id === ids.med).admin === false);
await recusa("membro comum não muda o nome enquanto só administradores mudam", () => rpc(como(ids.med), "chat_grupo_mudar", { p_id: jmGrupo, p_nome: "Outro nome" }), "sem_permissao");
await recusa("membro comum não promove ninguém", () => rpc(como(ids.med), "chat_grupo_mudar", { p_id: jmGrupo, p_admins: [ids.med] }), "sem_permissao");
await espera("administradora libera a edição para todos, põe descrição, e os avisos do sistema registram", async () => {
  await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_so_admins_mudam: false, p_descricao: "Fotos da feira de ciências" });
  await rpc(como(ids.med), "chat_grupo_mudar", { p_id: jmGrupo, p_nome: "Feira de ciências" });
  const r = await rpc(como(ids.revisor), "chat_ver", { p_id: jmGrupo });
  return [r.nome, r.descricao, r.so_admins_mudam, r.mensagens.filter((m) => m.tipo === "sistema").map((m) => m.detalhe.evento)];
}, ([nome, descricao, so, eventos]) => nome === "Feira de ciências" && descricao === "Fotos da feira de ciências" && so === false && eventos.includes("todos_mudam") && eventos.includes("descricao") && eventos.includes("nome"));
await recusa("mesmo com a edição liberada, membro comum não põe nem tira gente", () => rpc(como(ids.med), "chat_grupo_mudar", { p_id: jmGrupo, p_incluir: [ids.designer] }), "sem_permissao");
await espera("administradora promove o mediador; ele passa a poder pôr gente, e o aviso diz quem entrou", async () => {
  await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_admins: [ids.med] });
  await rpc(como(ids.med), "chat_grupo_mudar", { p_id: jmGrupo, p_incluir: [ids.designer] });
  const r = await rpc(como(ids.med), "chat_ver", { p_id: jmGrupo });
  return [r.admin, r.membros.length, r.mensagens.filter((m) => m.tipo === "sistema").map((m) => `${m.detalhe.evento}:${m.detalhe.alvo_nome}`)];
}, ([admin, n, eventos]) => admin === true && n === 4 && eventos.includes("admin:Mauro") && eventos.includes("entrou:Davi"));
await recusa("o último administrador não se rebaixa", async () => { await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_tirar_admin: [ids.med] }); return rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_tirar_admin: [ids.jornal] }); }, "ultimo_admin");
await espera("só administradores enviam: membro comum é barrado no servidor, mas ainda reage", async () => {
  await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_so_admins_enviam: true });
  const texto = await rpc(como(ids.revisor), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.revisor, jmGrupo, "Posso?", contextoDaConversa(jmGrupo, ids.revisor)) }).then(() => "passou", (e) => e.message);
  const minha = (await rpc(como(ids.jornal), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.jornal, jmGrupo, "Aviso da admin", contextoDaConversa(jmGrupo, ids.jornal)) })).id;
  const reacao = await rpc(como(ids.revisor), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.revisor, jmGrupo, "", contextoDaConversa(jmGrupo, ids.revisor)), p_tipo: "reacao", p_alvo: minha }).then(() => "passou", (e) => e.message);
  const r = await rpc(como(ids.revisor), "chat_ver", { p_id: jmGrupo });
  await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_so_admins_enviam: false });
  return [texto, reacao, r.posso_enviar, r.so_admins_enviam];
}, ([texto, reacao, posso, so]) => texto.includes("so_admins") && reacao === "passou" && posso === false && so === true);
await espera("a coordenação administra qualquer grupo em que esteja", async () => { await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_incluir: [ids.coord] }); return rpc(como(ids.coord), "chat_ver", { p_id: jmGrupo }); }, (r) => r.admin === true);
await espera("quando o último administrador sai, quem está há mais tempo assume", async () => {
  const outro = (await rpc(como(ids.revisor), "chat_grupo_criar", { p_nome: "Passa o bastão", p_membros: [ids.med, ids.jornal] })).id;
  await rpc(como(ids.revisor), "chat_sair", { p_id: outro });
  const r = await rpc(como(ids.med), "chat_ver", { p_id: outro });
  return [r.membros.filter((m) => m.admin).map((m) => m.id), r.mensagens.some((m) => m.tipo === "sistema" && m.detalhe.evento === "saiu" && m.detalhe.por === "Rui"), r.mensagens[0].tipo === "sistema" && r.mensagens[0].detalhe.evento === "criou" && r.mensagens[0].detalhe.por === "Rui"];
}, ([admins, saiu, criou]) => admins.length === 1 && admins[0] === ids.med && saiu === true && criou === true);
await espera("a autodestruição deixa aviso do sistema com o prazo", async () => { await rpc(como(ids.jornal), "chat_autodestruir", { p_id: jmGrupo, p_segundos: 3600 }); await rpc(como(ids.jornal), "chat_autodestruir", { p_id: jmGrupo, p_segundos: 0 }); return (await rpc(como(ids.jornal), "chat_ver", { p_id: jmGrupo })).mensagens.filter((m) => m.tipo === "sistema" && m.detalhe.evento === "autodestruicao").map((m) => m.detalhe.texto); }, (r) => r.includes("3600") && r.includes("0"));
await recusa("o aviso do sistema não vira alvo de reação", async () => { const aviso = (await rpc(como(ids.jornal), "chat_ver", { p_id: jmGrupo })).mensagens.find((m) => m.tipo === "sistema"); return rpc(como(ids.jornal), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.jornal, jmGrupo, "", contextoDaConversa(jmGrupo, ids.jornal)), p_tipo: "reacao", p_alvo: aviso.id }); }, "nao_encontrado");
await espera("foto do grupo: uma mensagem da conversa, cifrada como qualquer outra; a lista traz o cifrado dela", async () => {
  const m = (await rpc(como(ids.jornal), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.jornal, jmGrupo, "foto do grupo", contextoDaConversa(jmGrupo, ids.jornal)) })).id;
  await rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_foto: m });
  const lista = await achar("med", jmGrupo);
  return [lista.foto?.id === m && lista.foto.corpo.startsWith("c2."), (await rpc(como(ids.med), "chat_ver", { p_id: jmGrupo })).foto === m];
}, (r) => r[0] && r[1]);
await recusa("foto do grupo precisa ser mensagem desta conversa", () => rpc(como(ids.jornal), "chat_grupo_mudar", { p_id: jmGrupo, p_foto: pauta ?? crypto.randomUUID() }), "nao_encontrado");
await espera("enquete e evento: o voto e a resposta são uma linha por pessoa, trocada a cada nova, e o banco só vê o tipo", async () => {
  const enquete = (await rpc(como(ids.jornal), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.jornal, jmGrupo, "enquete cifrada", contextoDaConversa(jmGrupo, ids.jornal)) })).id;
  await rpc(como(ids.med), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.med, jmGrupo, "voto 1", contextoDaConversa(jmGrupo, ids.med)), p_tipo: "voto", p_alvo: enquete });
  await rpc(como(ids.med), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.med, jmGrupo, "voto 2", contextoDaConversa(jmGrupo, ids.med)), p_tipo: "voto", p_alvo: enquete });
  await rpc(como(ids.revisor), "chat_enviar", { p_id: jmGrupo, p_corpo: await selar(aparelhos.revisor, jmGrupo, "vou", contextoDaConversa(jmGrupo, ids.revisor)), p_tipo: "rsvp", p_alvo: enquete });
  const r = await rpc(como(ids.jornal), "chat_ver", { p_id: jmGrupo });
  const votos = r.mensagens.filter((m) => m.tipo === "voto" && m.alvo === enquete);
  const rsvps = r.mensagens.filter((m) => m.tipo === "rsvp" && m.alvo === enquete);
  const lista = await achar("jornal", jmGrupo);
  return [votos.length, await ler(aparelhos.jornal, jmGrupo, votos[0].corpo, contextoDaConversa(jmGrupo, ids.med)), rsvps.length, lista.ultima.corpo === r.mensagens.find((m) => m.id === enquete).corpo];
}, (r) => r[0] === 1 && r[1] === "voto 2" && r[2] === 1 && r[3] === true);
await recusa("relato só de conversa em que estou", () => rpc(como(ids.designer), "chat_relatar", { p_conversa: jm, p_contra: ids.jornal, p_motivo: "Assédio", p_mensagens: [] }), "nao_encontrado");
await recusa("relato aponta só para alguém da conversa", () => rpc(como(ids.med), "chat_relatar", { p_conversa: jm, p_contra: ids.designer, p_motivo: "Assédio", p_mensagens: [] }), "invalido:contra");
let relato;
await espera("quem está na conversa relata à coordenação com as mensagens que escolheu abrir; a liderança é avisada", async () => {
  relato = (await rpc(como(ids.med), "chat_relatar", { p_conversa: jm, p_contra: ids.jornal, p_motivo: "Mensagens ofensivas", p_mensagens: [{ id: "x", autor: "Joana Jornalista", quando: "2026-10-15T10:00:00Z", texto: "Texto aberto pelo aparelho de quem relatou", lixo: "não entra" }] })).id;
  return [await rpc(como(ids.coord), "chat_relatos"), (await rpc(como(ids.coord), "avisos_meus")).some((a) => a.texto.includes("Relato novo"))];
}, ([lista, avisado]) => lista.length >= 1 && lista[0].id === relato && lista[0].autor === "Mauro Mediador" && lista[0].contra === "Joana Jornalista" && lista[0].conversa_nome === "Conversa privada" && lista[0].mensagens[0].texto.startsWith("Texto aberto") && !("lixo" in lista[0].mensagens[0]) && lista[0].status === "aberto" && avisado);
await recusa("quem não gere a equipe não lê os relatos", () => rpc(como(ids.prof), "chat_relatos"), "sem_permissao");
await espera("a supervisão lê e resolve", async () => { await rpc(como(ids.vice), "chat_relato_resolver", { p_id: relato, p_nota: "Conversado com as duas pessoas." }); return (await rpc(como(ids.vice), "chat_relatos")).find((x) => x.id === relato); }, (r) => r.status === "resolvido" && r.nota.startsWith("Conversado"));
await espera("o banco nunca lê a conversa por conta própria: fora o relato, nada de texto aberto nas tabelas das conversas", () => dono("select count(*)::int as n from interno.conversa_mensagens where tipo <> 'sistema' and corpo !~ '^c[12][.]'"), (r) => r.rows[0].n === 0);

// ── Consenso dos educadores, nomes só para a coordenação, representante de departamento ──
const ed1 = await criarUsuario("ed1@teste.local", "Edna Primeira Silva");
const ed2 = await criarUsuario("ed2@teste.local", "Edu Segundo Souza");
const ed3 = await criarUsuario("ed3@teste.local", "Elis Terceira Lima");
await dono("insert into interno.papeis (usuario, papel, disciplina) values ($1, 'educacao', 'edicao-de-video'), ($2, 'educacao', 'edicao-de-video'), ($3, 'educacao', 'arquivologia')", [ed1, ed2, ed3]);
const aulaDe = async (autor, disciplina) => (await dono("insert into interno.contribuicoes (tipo, disciplina, titulo, corpo, autor, status, triagem) values ('aula', $2, 'Aula de consenso', 'Texto da aula com mais de vinte caracteres.', $1, 'pendente', 'liberada') returning id", [autor, disciplina])).rows[0].id;
const parecerDe = (autor, id) => dono("insert into interno.pareceres (contribuicao, autor, favoravel, texto) values ($1, $2, true, 'Pode ir ao ar.')", [id, autor]);
const aulaVideo = await aulaDe(ed1, "edicao-de-video");
await dono("update interno.perfis set nome = $2 where id = $1", [ed1, "Edna Primeira Silva"]);
const sup1 = await criarUsuario("sup1@teste.local", "Sueli Antes");
await rpc(como(ids.coord), "papel_conceder", { p_usuario: sup1, p_papel: "supervisao", p_disciplina: null });
await recusa("o autor não aprova a própria aula", () => rpc({ papel: "authenticated", sub: ed1 }, "contribuicao_decidir", { p_id: aulaVideo, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("a curadoria não decide aula (cuida do acervo)", () => rpc(como(ids.curadora), "contribuicao_decidir", { p_id: aulaVideo, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("educador de outra disciplina não decide", () => rpc({ papel: "authenticated", sub: ed3 }, "contribuicao_decidir", { p_id: aulaVideo, p_aprovar: true, p_nota: "" }), "sem_permissao");
await espera("outro educador da mesma disciplina aprova sozinho: uma pessoa basta", async () => { await rpc({ papel: "authenticated", sub: ed2 }, "contribuicao_decidir", { p_id: aulaVideo, p_aprovar: true, p_nota: "" }); return dono("select status from interno.contribuicoes where id = $1", [aulaVideo]); }, (r) => r.rows[0].status === "aprovada");
await espera("a supervisão também decide sozinha", async () => { const id = await aulaDe(ed1, "edicao-de-video"); await rpc({ papel: "authenticated", sub: sup1 }, "contribuicao_decidir", { p_id: id, p_aprovar: true, p_nota: "" }); return dono("select status from interno.contribuicoes where id = $1", [id]); }, (r) => r.rows[0].status === "aprovada");
await espera("a coordenação pedagógica também", async () => { const id = await aulaDe(ed1, "edicao-de-video"); await rpc(como(ids.vice), "contribuicao_decidir", { p_id: id, p_aprovar: true, p_nota: "" }); return dono("select status from interno.contribuicoes where id = $1", [id]); }, (r) => r.rows[0].status === "aprovada");
await espera("recusar segue a mesma regra de quem decide", async () => { const id = await aulaDe(ed1, "edicao-de-video"); await rpc(como(ids.revisor), "contribuicao_decidir", { p_id: id, p_aprovar: false, p_nota: "Faltam fontes." }); return dono("select status from interno.contribuicoes where id = $1", [id]); }, (r) => r.rows[0].status === "recusada");
// O que vem de fora: mediação → educador → revisão.
let deFora;
await espera("quem é de fora envia e a mediação libera na triagem", async () => { deFora = (await rpc(anon, "contribuir", { p: { ...aula({ titulo: "Aula de quem é de fora", disciplina: "edicao-de-video" }), nome: "Visitante" } })).id; await rpc(como(ids.med), "triagem_decidir", { p_id: deFora, p_liberar: true, p_nota: "" }); return dono("select triagem from interno.contribuicoes where id = $1", [deFora]); }, (r) => r.rows[0].triagem === "liberada");
await recusa("a revisão não põe no ar o que vem de fora sem o parecer de um educador", () => rpc(como(ids.revisor), "contribuicao_decidir", { p_id: deFora, p_aprovar: true, p_nota: "" }), "falta_educador");
await recusa("o educador dá o parecer, mas quem põe no ar é a revisão", async () => { await rpc({ papel: "authenticated", sub: ed1 }, "parecer", { p_id: deFora, p_favoravel: true, p_texto: "Conferi, está correto." }); return rpc({ papel: "authenticated", sub: ed1 }, "contribuicao_decidir", { p_id: deFora, p_aprovar: true, p_nota: "" }); }, "falta_educador");
await espera("com o parecer do educador, a revisão põe no ar", async () => { await rpc(como(ids.revisor), "contribuicao_decidir", { p_id: deFora, p_aprovar: true, p_nota: "" }); return dono("select status from interno.contribuicoes where id = $1", [deFora]); }, (r) => r.rows[0].status === "aprovada");
await espera("a coordenação aprova o que vem de fora a qualquer momento", async () => { const id = (await rpc(anon, "contribuir", { p: { ...aula({ titulo: "Outra de fora", disciplina: "edicao-de-video" }), nome: "Visitante" } })).id; await rpc(como(ids.med), "triagem_decidir", { p_id: id, p_liberar: true, p_nota: "" }); await rpc(como(ids.coord), "contribuicao_decidir", { p_id: id, p_aprovar: true, p_nota: "" }); return dono("select status from interno.contribuicoes where id = $1", [id]); }, (r) => r.rows[0].status === "aprovada");
await recusa("mediação não escreve aula pelo painel", () => rpc(como(ids.med), "contribuir", { p: aula({ titulo: "Aula do mediador" }) }), "sem_permissao");
await recusa("porta-voz precisa de nível: a supervisão nomeia", () => rpc(como(ids.prof), "papel_conceder", { p_usuario: ed3, p_papel: "porta_voz", p_disciplina: null }), "sem_permissao");
await espera("a supervisão nomeia um porta-voz, que fica só no grupo da equipe toda", async () => { await rpc({ papel: "authenticated", sub: sup1 }, "papel_conceder", { p_usuario: ed3, p_papel: "porta_voz", p_disciplina: null }); return [(await rpc({ papel: "authenticated", sub: ed3 }, "eu")).papeis.some((p) => p.papel === "porta_voz"), (await rpc({ papel: "authenticated", sub: ed3 }, "chat_conversas")).filter((c) => c.tipo === "departamento").map((c) => c.departamento)]; }, ([tem, deps]) => tem && deps.includes("geral") && !deps.includes("porta_voz"));
await espera("só a coordenação vê nome completo e e-mail; a vice vê o primeiro nome e nenhum e-mail", async () => [(await rpc(como(ids.coord), "voluntarios_listar")).find((p) => p.id === ed1), (await rpc(como(ids.vice), "voluntarios_listar")).find((p) => p.id === ed1), (await rpc(como(ids.prof), "equipe_membros")).find((p) => p.id === ed1)], ([coord, vice, colega]) => coord.nome === "Edna Primeira Silva" && coord.email.includes("@") && vice.nome === "Edna" && vice.email === "" && colega.nome === "Edna");
await recusa("representante precisa de um departamento", () => rpc(como(ids.vice), "papel_conceder", { p_usuario: ed2, p_papel: "representante", p_disciplina: null }), "invalido:departamento");
await espera("a vice nomeia representante do departamento de educação; ele administra o grupo do departamento", async () => {
  await rpc(como(ids.vice), "papel_conceder", { p_usuario: ed2, p_papel: "representante", p_disciplina: "educacao" });
  const dep = (await rpc({ papel: "authenticated", sub: ed2 }, "chat_conversas")).find((c) => c.tipo === "departamento" && c.departamento === "educacao");
  return rpc({ papel: "authenticated", sub: ed2 }, "chat_ver", { p_id: dep.id });
}, (r) => r.admin === true);
await recusa("representante não confia funções", () => rpc({ papel: "authenticated", sub: ed2 }, "papel_conceder", { p_usuario: ed1, p_papel: "revisao", p_disciplina: null }), "sem_permissao");
await espera("a coordenação vê quem está em conversa privada, sem o conteúdo", () => rpc(como(ids.coord), "chat_privadas"), (r) => r.length >= 1 && r.every((c) => Array.isArray(c.pessoas) && !("corpo" in c)));
await recusa("a vice não vê a lista de conversas privadas", () => rpc(como(ids.vice), "chat_privadas"), "sem_permissao");

// ── Materiais de campanha ──
const material = (extra = {}) => ({ tipo: "panfleto", titulo: "Panfleto da jornada de lutas", descricao: "Frente e verso, A5.", campanha: "Jornada de lutas", url: "/arquivos/abc123.pdf", publicado: true, credito_autor: "Equipe do instituto", credito_origem: "Feito pelo instituto", licenca: "cc-by-sa", ...extra });
let materialId;
await recusa("educador não cadastra material", () => rpc(como(ids.prof), "material_salvar", { p: material() }), "sem_permissao");
await recusa("endereço estranho é recusado", () => rpc(como(ids.designer), "material_salvar", { p: material({ url: "javascript:alert(1)" }) }), "invalido:url");
await espera("designer guarda o material, mas não publica", async () => (materialId = (await rpc(como(ids.designer), "material_salvar", { p: material() })).id), (r) => Boolean(r));
await espera("rascunho não aparece para o público", () => rpc(anon, "materiais_listar"), (r) => r.length === 0);
await espera("coordenação publica", async () => { await rpc(como(ids.coord), "material_salvar", { p: material({ id: materialId }) }); return rpc(anon, "materiais_listar"); }, (r) => r.length === 1 && r[0].publicado === true);
await recusa("designer não remove o que já está no ar", () => rpc(como(ids.designer), "material_remover", { p_id: materialId }), "nao_encontrado");

// ── Horas de voluntariado e certificados ──
// As horas que a plataforma conta sozinha têm seção própria, mais adiante: aqui a tabela fica zerada e só valem as registradas à mão.
await dono("insert into interno.configuracoes (chave, valor) select 'horas_pesos', jsonb_object_agg(x ->> 'chave', 0) from jsonb_array_elements(interno.horas_tabela()) x on conflict (chave) do update set valor = excluded.valor");
await recusa("horas só depois do termo de adesão", () => rpc(como(ids.prof), "horas_registrar", { p_dia: "2026-10-01", p_horas: 2, p_atividade: "Escrevi a aula de regra de três." }), "falta_termo");
await recusa("quem não é voluntário não aceita termo", () => rpc(como(ids.troll), "termo_aceitar", { p_nome_completo: "Tito Troll da Silva", p_versao: "1" }), "conta_suspensa");
await espera("aceitar o termo de adesão", () => rpc(como(ids.prof), "termo_aceitar", { p_nome_completo: "Paulo Roberto Professor", p_versao: "1" }), (r) => r.versao === "1");
await recusa("dia no futuro não vale", () => rpc(como(ids.prof), "horas_registrar", { p_dia: "2099-01-01", p_horas: 2, p_atividade: "Atividade no futuro." }), "invalido:dia");
const hoje = (await dono("select current_date::text as d")).rows[0].d;
await recusa("mais de doze horas no dia não vale", () => rpc(como(ids.prof), "horas_registrar", { p_dia: hoje, p_horas: 13, p_atividade: "Trabalhei sem parar." }), "invalido:horas");
let horaId;
await espera("registrar horas", async () => (horaId = (await rpc(como(ids.prof), "horas_registrar", { p_dia: hoje, p_horas: 3.5, p_atividade: "Escrevi e revisei a aula de regra de três." })).id), (r) => Boolean(r));
await recusa("curadoria não confere horas", () => rpc(como(ids.curadora), "horas_conferir", { p_id: horaId, p_confirmar: true }), "sem_permissao");
await espera("uma segunda pessoa passa a ensinar, para poder assinar", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.mentora, p_papel: "educacao", p_disciplina: "historia" }));
await recusa("sem horas confirmadas não há certificado", () => rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", educador: ids.mentora } }), "sem_horas");
await espera("vice-coordenação confere as horas", () => rpc(como(ids.vice), "horas_conferir", { p_id: horaId, p_confirmar: true }), (r) => r.ok);
await recusa("vice-coordenação não abre certificado", () => rpc(como(ids.vice), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", educador: ids.mentora } }), "sem_permissao");
await recusa("quem assina como educador precisa ensinar no instituto", () => rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", educador: ids.designer } }), "invalido:educador");
await recusa("ninguém assina o próprio certificado", () => rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", educador: ids.prof } }), "invalido:educador");
await recusa("a vice-coordenadora indicada precisa ser vice de verdade", () => rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", educador: ids.mentora, vice: ids.curadora } }), "falta_vice");
let certificado;
await espera("o coordenador abre o certificado, que já nasce com as três linhas de assinatura", async () => { certificado = await rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação e revisão de aulas de matemática.", educador: ids.mentora } }); return (await rpc(como(ids.coord), "certificados_listar")).find((c) => c.id === certificado.id); }, (r) => Number(r.horas) === 3.5 && r.testemunhas.map((a) => a.papel).join() === "educacao,vice,coordenacao" && r.testemunhas.every((a) => a.confirmou_em === null) && r.testemunhas[0].disciplina === "historia" && /^[a-f0-9]{64}$/.test(r.impressao));
await recusa("sem as outras duas assinaturas, o coordenador não emite", () => rpc(como(ids.coord), "certificado_emitir", { p_id: certificado.id }), "falta_assinatura");
await recusa("quem não está no certificado não assina", () => rpc(como(ids.revisor), "certificado_testemunhar", { p_id: certificado.id }), "sem_permissao");
await recusa("o coordenador não assina pela porta dos outros", () => rpc(como(ids.coord), "certificado_testemunhar", { p_id: certificado.id }), "sem_permissao");
await espera("a educadora vê o pedido no resumo e assina", async () => { const antes = (await rpc(como(ids.mentora), "painel_resumo")).testemunhar; await rpc(como(ids.mentora), "certificado_testemunhar", { p_id: certificado.id }); return [antes, (await rpc(como(ids.mentora), "painel_resumo")).testemunhar]; }, (r) => r[0] === 1 && r[1] === 0);
await recusa("ninguém assina duas vezes", () => rpc(como(ids.mentora), "certificado_testemunhar", { p_id: certificado.id }), "sem_permissao");
await recusa("só com a educadora ainda não emite", () => rpc(como(ids.coord), "certificado_emitir", { p_id: certificado.id }), "falta_assinatura");
await espera("a vice-coordenadora assina e o coordenador é avisado", async () => { await rpc(como(ids.vice), "certificado_testemunhar", { p_id: certificado.id }); return rpc(como(ids.coord), "avisos_meus"); }, (r) => r.some((x) => x.texto.includes("Falta a sua para emitir")));
await recusa("vice-coordenador não emite", () => rpc(como(ids.vice), "certificado_emitir", { p_id: certificado.id }), "sem_permissao");
let codigo;
await espera("o coordenador assina por último, e isso é a emissão", async () => (codigo = (await rpc(como(ids.coord), "certificado_emitir", { p_id: certificado.id })).codigo), (r) => /^[A-Z0-9]{12}$/.test(r));
await espera("o certificado emitido guarda as três assinaturas com data", () => rpc(como(ids.prof), "certificados_listar"), (r) => r[0].status === "emitido" && r[0].testemunhas.length === 3 && r[0].testemunhas.every((a) => typeof a.confirmou_em === "string") && r[0].testemunhas[2].papel === "coordenacao");
await espera("qualquer pessoa confere o código, com ou sem traços", () => rpc(anon, "certificado_conferir", { p_codigo: `${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8).toLowerCase()}` }), (r) => r.valido === true && r.nome === "Paulo Roberto Professor" && Number(r.horas) === 3.5 && r.testemunhas.length === 3 && r.testemunhas[0] === "Marta Mentora" && /^[a-f0-9]{64}$/.test(r.impressao));
await espera("código inventado não existe", () => rpc(anon, "certificado_conferir", { p_codigo: "AAAAAAAAAAAA" }), (r) => r.encontrado === false);
await espera("as mesmas horas não entram em dois certificados", () => rpc(como(ids.prof), "horas_minhas"), (r) => r.lista[0].certificado === true && Number(r.confirmadas) === 3.5);
await espera("quem recebeu vê o próprio certificado; os outros não", async () => [(await rpc(como(ids.prof), "certificados_listar")).length, (await rpc(como(ids.revisor), "certificados_listar")).length], (r) => r[0] === 1 && r[1] === 0);
await espera("certificado cancelado deixa de valer", async () => { await rpc(como(ids.coord), "certificado_cancelar", { p_id: certificado.id }); return rpc(anon, "certificado_conferir", { p_codigo: codigo }); }, (r) => r.encontrado === true && r.valido === false);

// ── Horas que a plataforma conta sozinha e pedidos de certificado ──
await dono("delete from interno.configuracoes where chave = 'horas_pesos'");
const hojeBr = (await dono("select interno.dia_de(now())::text as d")).rows[0].d;
const ontemBr = (await dono("select (interno.dia_de(now()) - 1)::text as d")).rows[0].d;
await espera("a coordenação confia o ensino de matemática a uma voluntária nova", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.vol, p_papel: "educacao", p_disciplina: "matematica" }));
let aulaDaVol, aulaParaParecer;
await espera("ela escreve uma aula e a revisão aprova", async () => { aulaDaVol = await rpc(como(ids.vol), "contribuir", { p: aula({ titulo: "Frações no dia a dia" }) }); return rpc(como(ids.revisor), "contribuicao_decidir", { p_id: aulaDaVol.id, p_aprovar: true, p_nota: "" }); }, (r) => r.ok);
await espera("ela dá dois pareceres na aula de outro educador", async () => {
  aulaParaParecer = await rpc(como(ids.prof), "contribuir", { p: aula({ titulo: "Porcentagem no mercado" }) });
  await rpc(como(ids.vol), "parecer", { p_id: aulaParaParecer.id, p_favoravel: true, p_texto: "As contas batem." });
  return rpc(como(ids.vol), "parecer", { p_id: aulaParaParecer.id, p_favoravel: true, p_texto: "Conferi de novo depois da edição." });
}, (r) => r.ok);
await espera("sem o termo de adesão, a plataforma ainda não conta nada", () => rpc(como(ids.vol), "horas_minhas"), (r) => r.lista.length === 0 && Number(r.livres) === 0);
await espera("com o termo, a aula aprovada e o parecer entram sozinhos, já confirmados", async () => {
  await rpc(como(ids.vol), "termo_aceitar", { p_nome_completo: "Vânia Souza Voluntária", p_versao: "1" });
  return rpc(como(ids.vol), "horas_minhas");
}, (r) => Number(r.plataforma) === 4.5 && r.lista.length === 2 && r.lista.every((h) => h.origem === "plataforma" && h.status === "confirmada") && r.lista.some((h) => h.atividade === 'Aula escrita e aprovada: "Frações no dia a dia"' && Number(h.horas) === 4) && r.lista.some((h) => h.atividade.startsWith("Parecer de revisão") && Number(h.horas) === 0.5));
await espera("olhar de novo não conta duas vezes", () => rpc(como(ids.vol), "horas_minhas"), (r) => r.lista.length === 2 && Number(r.livres) === 4.5);
await recusa("vice-coordenação não mexe na tabela de horas", () => rpc(como(ids.vice), "horas_pesos_salvar", { p: { aula: 6 } }), "sem_permissao");
await recusa("tipo de trabalho inventado não entra na tabela", () => rpc(como(ids.coord), "horas_pesos_salvar", { p: { churrasco: 2 } }), "invalido:tabela");
await recusa("nenhum trabalho vale mais de doze horas", () => rpc(como(ids.coord), "horas_pesos_salvar", { p: { aula: 13 } }), "invalido:aula");
await espera("o coordenador ajusta quanto vale uma aula", () => rpc(como(ids.coord), "horas_pesos_salvar", { p: { aula: 6 } }), (r) => Number(r.find((x) => x.chave === "aula").horas) === 6 && Number(r.find((x) => x.chave === "aula").padrao) === 4);
await espera("toda a equipe vê a tabela", () => rpc(como(ids.vol), "horas_pesos"), (r) => r.length === 26 && Number(r.find((x) => x.chave === "parecer").horas) === 0.5);
await recusa("quem não é da equipe não vê a tabela", () => rpc(como(ids.leitora), "horas_pesos"), "sem_permissao");
await espera("o ajuste não muda o que já foi contado", () => rpc(como(ids.vol), "horas_minhas"), (r) => Number(r.plataforma) === 4.5);
await espera("ela registra à mão sete horas do mesmo dia", () => rpc(como(ids.vol), "horas_registrar", { p_dia: hojeBr, p_horas: 7, p_atividade: "Preparei e gravei a videoaula de frações." }), (r) => Boolean(r.id));
await espera("uma segunda aula aprovada no mesmo dia só completa as doze horas", async () => {
  const outra = await rpc(como(ids.vol), "contribuir", { p: aula({ titulo: "Frações equivalentes" }) });
  await rpc(como(ids.revisor), "contribuicao_decidir", { p_id: outra.id, p_aprovar: true, p_nota: "" });
  return rpc(como(ids.vol), "horas_minhas");
}, (r) => Number(r.lista.find((h) => h.atividade.includes("Frações equivalentes"))?.horas) === 0.5 && Number(r.pendentes) === 7);
await espera("episódio publicado conta para quem produziu", async () => {
  await dono(`insert into interno.podcast_episodios (titulo, status, responsavel, publicado_em) values ('Episódio voluntário', 'publicado', '${ids.vol}', now() - interval '2 days')`);
  return rpc(como(ids.vol), "horas_minhas");
}, (r) => r.lista.some((h) => h.atividade === 'Episódio de podcast produzido: "Episódio voluntário"' && Number(h.horas) === 4));
await recusa("sem o termo, não há pedido de certificado", () => rpc(como(ids.revisor), "certificado_pedir", { p_inicio: hojeBr, p_fim: hojeBr, p_mensagem: "" }), "falta_termo");
await recusa("período ao contrário não vale", () => rpc(como(ids.vol), "certificado_pedir", { p_inicio: hojeBr, p_fim: "2020-01-01", p_mensagem: "" }), "invalido:periodo");
await espera("ela pede o certificado, e a coordenação e a vice são avisadas", async () => {
  await rpc(como(ids.vol), "certificado_pedir", { p_inicio: hojeBr, p_fim: hojeBr, p_mensagem: "É para as horas complementares da faculdade." });
  return [await rpc(como(ids.coord), "avisos_meus"), await rpc(como(ids.vice), "avisos_meus"), (await rpc(como(ids.coord), "painel_resumo")).pedidos, (await rpc(como(ids.vice), "painel_resumo")).pedidos,
    (await dono("select count(*)::int as n from interno.emails where tipo = 'certificado_pedido'")).rows[0].n];
}, ([c, v, nc, nv, emails]) => c.some((a) => a.texto.includes("pediu um certificado de horas: 12 h")) && v.some((a) => a.texto.includes("pediu um certificado")) && nc === 1 && nv === 0 && emails >= 2);
await recusa("um pedido de cada vez", () => rpc(como(ids.vol), "certificado_pedir", { p_inicio: hojeBr, p_fim: hojeBr, p_mensagem: "" }), "ja_pediu");
await recusa("curadoria não vê os pedidos", () => rpc(como(ids.curadora), "certificado_pedidos"), "sem_permissao");
let pedidoDela;
await espera("a vice vê o pedido com as horas do período e o resumo pronto para o certificado", async () => (pedidoDela = (await rpc(como(ids.vice), "certificado_pedidos"))[0]), (p) => p.nome_completo === "Vânia Souza Voluntária" && p.mensagem.startsWith("É para") && Number(p.livres) === 5 && Number(p.pendentes) === 7 && p.resumo === "Aulas escritas e aprovadas: 2 (4,5 h); pareceres de revisão: 1 (0,5 h)." && p.horas.length === 4);
const parecerDela = () => pedidoDela.horas.find((h) => h.atividade.startsWith("Parecer"));
await recusa("quem pediu não mexe nas próprias linhas", () => rpc(como(ids.vol), "horas_considerar", { p_id: parecerDela().id, p_considerar: false }), "sem_permissao");
await recusa("desconsiderar vale só para o que a plataforma contou", () => rpc(como(ids.vice), "horas_considerar", { p_id: pedidoDela.horas.find((h) => h.origem === "manual").id, p_considerar: false }), "nao_encontrado");
await espera("a vice desconsidera o parecer, e ele não volta sozinho", async () => { await rpc(como(ids.vice), "horas_considerar", { p_id: parecerDela().id, p_considerar: false }); return (await rpc(como(ids.vice), "certificado_pedidos"))[0]; }, (p) => Number(p.livres) === 4.5);
await espera("e volta a considerar", async () => { await rpc(como(ids.vice), "horas_considerar", { p_id: parecerDela().id, p_considerar: true }); return (await rpc(como(ids.vice), "certificado_pedidos"))[0]; }, (p) => Number(p.livres) === 5);
await recusa("vice-coordenação não responde o pedido pelo coordenador", () => rpc(como(ids.vice), "certificado_pedido_recusar", { p_id: pedidoDela.id, p_nota: "Ainda não dá." }), "sem_permissao");
await espera("a vice confere as horas registradas à mão", () => rpc(como(ids.vice), "horas_conferir", { p_id: pedidoDela.horas.find((h) => h.origem === "manual").id, p_confirmar: true }), (r) => r.ok);
await espera("o coordenador abre o certificado, e o pedido fica atendido", async () => {
  const aberto = await rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.vol, inicio: hojeBr, fim: hojeBr, atividades: pedidoDela.resumo, educador: ids.mentora } });
  return [aberto, await rpc(como(ids.vol), "horas_minhas"), await rpc(como(ids.vol), "avisos_meus"), (await rpc(como(ids.coord), "painel_resumo")).pedidos];
}, ([aberto, minhas, avisos, abertos]) => Number(aberto.horas) === 12 && minhas.pedido.status === "atendido" && Number(minhas.livres) === 4 && avisos.some((a) => a.texto.includes("pedido de certificado foi atendido")) && abertos === 0);
await recusa("sem horas livres no período, não há o que pedir", () => rpc(como(ids.vol), "certificado_pedir", { p_inicio: hojeBr, p_fim: hojeBr, p_mensagem: "" }), "sem_horas");
let segundo;
await espera("com mais uma hora registrada, ela pede de novo", async () => {
  await rpc(como(ids.vol), "horas_registrar", { p_dia: ontemBr, p_horas: 1, p_atividade: "Respondi dúvidas dos estudantes no grupo." });
  return (segundo = await rpc(como(ids.vol), "certificado_pedir", { p_inicio: ontemBr, p_fim: hojeBr, p_mensagem: "" }));
}, (r) => Number(r.pendentes) === 1 && Number(r.livres) === 0);
await recusa("ninguém cancela o pedido dos outros", () => rpc(como(ids.prof), "certificado_pedido_cancelar", { p_id: segundo.id }), "nao_encontrado");
await espera("ela cancela o próprio pedido", async () => { await rpc(como(ids.vol), "certificado_pedido_cancelar", { p_id: segundo.id }); return rpc(como(ids.vol), "horas_minhas"); }, (r) => r.pedido.status === "atendido");
await recusa("pedido cancelado não se cancela de novo", () => rpc(como(ids.vol), "certificado_pedido_cancelar", { p_id: segundo.id }), "nao_encontrado");
await espera("o coordenador responde sem abrir, com uma nota que ela lê no painel", async () => {
  const terceiro = await rpc(como(ids.vol), "certificado_pedir", { p_inicio: ontemBr, p_fim: hojeBr, p_mensagem: "" });
  try {
    await rpc(como(ids.coord), "certificado_pedido_recusar", { p_id: terceiro.id, p_nota: "Não." });
    return "a nota curta passou";
  } catch {
    // a nota curta precisa ser recusada
  }
  await rpc(como(ids.coord), "certificado_pedido_recusar", { p_id: terceiro.id, p_nota: "Vamos juntar mais horas e abrir no fim do semestre." });
  return rpc(como(ids.vol), "horas_minhas");
}, (r) => r.pedido?.status === "recusado" && r.pedido.nota.startsWith("Vamos juntar"));

// ── Questões de prova e arquivos ──
const questao = (extra = {}) => ({ tipo: "questao", disciplina: "matematica", titulo: "Questão sobre regra de três", corpo: "Se 3 pães custam 6 reais, quanto custam 5 pães?", alvo: "matematica-fundamental/regra-de-tres", dados: { opcoes: ["8 reais", "10 reais", "12 reais"], correta: 1, explicacao: "Cada pão custa 2 reais." }, ...extra });
await recusa("questão sem alternativas é recusada", () => rpc(como(ids.prof), "contribuir", { p: questao({ dados: { opcoes: ["só uma"], correta: 0 } }) }), "invalido:opcoes");
await recusa("alternativa certa fora da lista é recusada", () => rpc(como(ids.prof), "contribuir", { p: questao({ dados: { opcoes: ["a", "b"], correta: 4 } }) }), "invalido:correta");
await recusa("questão precisa apontar a aula", () => rpc(como(ids.prof), "contribuir", { p: questao({ alvo: "../segredo" }) }), "invalido:alvo");
await espera("educador envia questão de prova", () => rpc(como(ids.prof), "contribuir", { p: questao() }), (r) => Boolean(r.id));
await recusa("educador não bloqueia arquivo", () => rpc(como(ids.prof), "arquivo_bloquear", { p_sha256: marca("c"), p_motivo: "teste" }), "sem_permissao");
await espera("curadoria bloqueia e a rotina de publicação lê a lista", async () => { await rpc(como(ids.curadora), "arquivo_bloquear", { p_sha256: marca("c"), p_motivo: "PDF adulterado" }); return rpc(servico, "arquivos_bloqueados"); }, (r) => r.length === 1);
await recusa("ninguém logado lê a lista de bloqueados", () => rpc(como(ids.coord), "arquivos_bloqueados"), "sem_permissao");
const caminho = (dono) => `${dono}/imagem-de-teste-01.webp`;
await recusa("quem não escreve não registra arquivo", () => rpc(como(ids.revisor), "arquivo_registrar", { p_caminho: caminho(ids.revisor), p_nome: "Imagem" }), "sem_permissao");
await recusa("ninguém registra arquivo na pasta de outra pessoa", () => rpc(como(ids.prof), "arquivo_registrar", { p_caminho: caminho(ids.coord), p_nome: "Imagem alheia" }), "invalido:caminho");
await recusa("caminho com truque é recusado", () => rpc(como(ids.prof), "arquivo_registrar", { p_caminho: `${ids.prof}/../../segredo.webp`, p_nome: "Truque" }), "invalido:caminho");
let arquivoId;
await espera("educador registra o arquivo enviado", async () => (arquivoId = (await rpc(como(ids.prof), "arquivo_registrar", { p_caminho: caminho(ids.prof), p_nome: "Gráfico da função afim" })).id), (r) => Boolean(r));
await espera("toda a equipe vê o arquivo que espera apoio", async () => [(await rpc(como(ids.designer), "arquivos_listar")).length, (await rpc(como(ids.prof), "arquivos_listar")).length, (await rpc(como(ids.vice), "arquivos_listar")).length], (r) => r[0] === 1 && r[1] === 1 && r[2] === 1);
await recusa("quem enviou não apoia o próprio arquivo", () => rpc(como(ids.prof), "arquivo_apoiar", { p_id: arquivoId }), "nao_encontrado");
await recusa("quem não é da equipe não apoia", () => rpc(como(ids.leitora), "arquivo_apoiar", { p_id: arquivoId }), "sem_permissao");
await recusa("sem dois apoios, a vice não aprova", () => rpc(como(ids.vice), "arquivo_decidir", { p_id: arquivoId, p_aprovar: true }), "falta_apoio");
await espera("colegas apoiam, e apoiar duas vezes conta uma", async () => { await rpc(como(ids.designer), "arquivo_apoiar", { p_id: arquivoId }); await rpc(como(ids.designer), "arquivo_apoiar", { p_id: arquivoId }); return rpc(como(ids.revisor), "arquivo_apoiar", { p_id: arquivoId }); }, (r) => r.apoios === 2);
await espera("a lista mostra os apoios e quem já apoiou", () => rpc(como(ids.designer), "arquivos_listar"), (r) => r[0].apoios === 2 && r[0].apoiei === true && r[0].meu === false);
await recusa("curadoria não aprova arquivo", () => rpc(como(ids.curadora), "arquivo_decidir", { p_id: arquivoId, p_aprovar: true }), "sem_permissao");
await espera("arquivo pendente não vai para a publicação", () => rpc(servico, "arquivos_aprovados"), (r) => r.length === 0);
await espera("coordenação aprova e a rotina de publicação o encontra", async () => { await rpc(como(ids.coord), "arquivo_decidir", { p_id: arquivoId, p_aprovar: true }); return rpc(servico, "arquivos_aprovados"); }, (r) => r.length === 1 && r[0].caminho === caminho(ids.prof));
await recusa("logado não marca arquivo como publicado", () => rpc(como(ids.coord), "arquivo_publicado", { p_id: arquivoId, p_destino: "/arquivos/0123456789abcdef0123.webp" }), "sem_permissao");
await espera("a rotina anota o endereço final e avisa quem enviou", async () => { await rpc(servico, "arquivo_publicado", { p_id: arquivoId, p_destino: "/arquivos/0123456789abcdef0123.webp" }); return rpc(como(ids.prof), "arquivos_listar"); }, (r) => r[0].status === "publicado" && r[0].destino === "/arquivos/0123456789abcdef0123.webp");

// ── Painel e saída ──
await espera("resumo da coordenação", () => rpc(como(ids.coord), "painel_resumo"), (r) => typeof r.fila === "number" && r.candidaturas === 0);
await espera("resumo de quem não é voluntário não vaza a fila", () => rpc(como(ids.leitora), "painel_resumo"), (r) => r.fila === 0 && r.denuncias === 0);
await espera("apagar a conta leva o perfil e mantém o tópico sem dono", async () => { await rpc(como(ids.leitora), "conta_apagar"); return dono("select (select count(*) from interno.perfis where id = $1)::int as perfil, (select count(*) from interno.topicos where autor is null)::int as orfaos", [ids.leitora]); }, (r) => r.rows[0].perfil === 0 && r.rows[0].orfaos === 1);
await recusa("a última coordenação não apaga a conta", () => rpc(como(ids.coord), "conta_apagar"), "ultima_coordenacao");
await recusa("nem com a exigência de segundo fator ligada e a sessão só com senha", async () => {
  await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: true });
  try { return await rpc(como(ids.coord), "conta_apagar"); } finally { await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: false }); }
}, "ultima_coordenacao");

// ── Livro do acervo ──
const livro = (onde = "true") => dono(`select acao, via, campos, quem, titulo from interno.audit_logs where ${onde} order by id desc`);
await espera("o livro anotou envios, aprovações e publicações do acervo", () => dono("select array_agg(distinct acao) as acoes from interno.audit_logs where tabela = 'contribuicoes'"), (r) => ["insercao", "aprovacao", "recusa", "publicacao"].every((acao) => r.rows[0].acoes.includes(acao)));
await espera("e cada função dada ou tirada", () => dono("select array_agg(distinct acao) as acoes from interno.audit_logs where tabela = 'papeis'"), (r) => r.rows[0].acoes.includes("insercao") && r.rows[0].acoes.includes("exclusao"));
await espera("a aprovação leva a conta de quem aprovou", () => livro("tabela = 'contribuicoes' and acao = 'aprovacao'"), (r) => r.rows.length > 0 && r.rows.every((linha) => linha.quem && linha.via === "authenticated"));
await espera("mudança feita direto no banco também fica anotada", async () => {
  await dono("update interno.contribuicoes set titulo = titulo || ' (ajuste)' where id = (select id from interno.contribuicoes order by criado_em limit 1)");
  return livro("tabela = 'contribuicoes'");
}, (r) => r.rows[0].acao === "edicao" && r.rows[0].via === "banco" && r.rows[0].quem === null && r.rows[0].campos.join() === "titulo");
await espera("gravar a mesma coisa de novo não gera linha", async () => {
  const antes = (await livro()).rows.length;
  await dono("update interno.contribuicoes set titulo = titulo");
  return (await livro()).rows.length - antes;
}, (r) => r === 0);
await recusa("ninguém edita o livro, nem o dono do banco", () => dono("update interno.audit_logs set titulo = 'outra coisa'"), "audit_logs_imutavel");
await recusa("nem apaga uma linha", () => dono("delete from interno.audit_logs"), "audit_logs_imutavel");
await recusa("nem esvazia a tabela", () => dono("truncate interno.audit_logs"), "audit_logs_imutavel");
await espera("só o que passou do prazo de guarda sai", async () => {
  await dono("insert into interno.audit_logs (criado_em, tabela, acao) values (now() - interval '401 days', 'teste', 'edicao')");
  await dono("select interno.limpeza()");
  return dono("select count(*)::int as n from interno.audit_logs where tabela = 'teste'");
}, (r) => r.rows[0].n === 0);
await recusa("logado não lê o livro direto", () => banco.exclusivo(async () => { await banco.pg.exec("set role authenticated"); try { return await banco.pg.query("select * from interno.audit_logs"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");
await recusa("anônimo não lista o livro", () => rpc(anon, "audit_logs_listar"), "entre_primeiro");
await recusa("curadoria não lista o livro", () => rpc(como(ids.curadora), "audit_logs_listar"), "sem_permissao");
await espera("coordenação lista o livro, com o nome de quem fez", () => rpc(como(ids.coord), "audit_logs_listar", { p_tabela: "contribuicoes" }), (r) => r.length > 0 && r.every((linha) => linha.tabela === "contribuicoes") && r.some((linha) => linha.nome === nomes.curadora || linha.nome === nomes.coord));

// ── Segundo fator: quem cadastrou o aplicativo só usa a função depois do código ──
await dono("create table auth.mfa_factors (user_id uuid, status text)");
await dono("insert into auth.mfa_factors values ($1, 'verified')", [ids.revisor]);
await recusa("com aplicativo cadastrado e só a senha, não entra na equipe", () => rpc(como(ids.revisor), "equipe_membros"), "sem_permissao");
await recusa("nem apaga a conta", () => rpc(como(ids.revisor), "conta_apagar"), "confirme_segundo_fator");
await espera("com o código, entra", () => rpc({ ...como(ids.revisor), aal: "aal2" }, "equipe_membros"), (r) => r.length > 0);
await espera("quem não cadastrou o aplicativo segue como antes", () => rpc(como(ids.designer), "equipe_membros"), (r) => r.length > 0);
await dono("drop table auth.mfa_factors");
await espera("desligar pelo painel também sobrevive a uma nova instalação", async () => {
  await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: false });
  await banco.instalarDeNovo();
  return exigencia();
}, (r) => r.rows[0].valor.exigir_2fa === false && r.rows[0].valor.padrao_ligado === true);

// ── Segundo fator também para a mediação ──
await espera("com a exigência ligada, a mediação só age depois do código", async () => {
  await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: true });
  try {
    const semCodigo = await rpc(como(ids.med), "comunidade_retidos").then(() => "passou", (e) => e.message);
    const comCodigo = await rpc({ ...como(ids.med), aal: "aal2" }, "comunidade_retidos").then(() => "passou", (e) => e.message);
    const eu = await rpc(como(ids.med), "eu");
    return [semCodigo, comCodigo, eu.exige_segundo_fator];
  } finally {
    await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: false });
  }
}, (r) => r[0].includes("sem_permissao") && r[1] === "passou" && r[2] === true);

// ── E-mails automáticos ──
const caixa = (para, tipo) => dono("select tipo, assunto, texto, sair, status from interno.emails where para = $1 and ($2::text is null or tipo = $2) order by criado_em", [para, tipo ?? null]);
const anonDe = (ip) => ({ papel: "anon", ip });
await recusa("logado não lê a fila de e-mails direto", () => banco.exclusivo(async () => { await banco.pg.exec("set role authenticated"); try { return await banco.pg.query("select * from interno.emails"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");
await recusa("logado não pega e-mails para enviar", () => rpc(como(ids.coord), "emails_pendentes", { p_limite: 10 }), "sem_permissao");
await recusa("logado não marca e-mail como enviado", () => rpc(como(ids.coord), "email_resultado", { p_id: ids.coord, p_ok: true }), "sem_permissao");
await recusa("participante não vê a situação dos e-mails", () => rpc(como(ids.calma), "emails_situacao"), "sem_permissao");

let inscricaoMail;
await espera("candidatura pelo formulário: quem se candidatou e a coordenação recebem e-mail", async () => {
  inscricaoMail = await rpc(anonDe("198.51.100.120"), "voluntariar", { p: { nome: "Rosa Ribeiro", email: "Rosa.Ribeiro@Exemplo.org", papel: "revisao", mensagem: "Sou revisora de textos há dez anos e quero ajudar o instituto." } });
  return [await caixa("rosa.ribeiro@exemplo.org"), await caixa("coord@teste.local", "inscricao_nova")];
}, ([pessoa, coordenacao]) => pessoa.rows.length === 1 && pessoa.rows[0].tipo === "inscricao_recebida" && pessoa.rows[0].texto.includes("Rosa Ribeiro") && pessoa.rows[0].texto.includes("revisão")
  && coordenacao.rows.some((m) => m.texto.includes("Rosa Ribeiro") && m.texto.includes("rosa.ribeiro@exemplo.org") && m.texto.includes("/pt/painel")));
await espera("aceita a candidatura, o convite vai sozinho para o e-mail da pessoa", async () => {
  const r = await rpc(coordenacao, "inscricao_decidir", { p_id: inscricaoMail.id, p_aceitar: true });
  return [r.codigo, (await caixa("rosa.ribeiro@exemplo.org", "convite")).rows];
}, ([codigo, emails]) => Boolean(codigo) && emails.length === 1 && emails[0].texto.includes(`/pt/entrar?convite=${codigo}`) && emails[0].texto.includes("14 dias"));
await espera("recusada a candidatura, a pessoa também é avisada por e-mail", async () => {
  const outra = await rpc(anonDe("198.51.100.121"), "voluntariar", { p: { nome: "Paulo Pires", email: "paulo.pires@exemplo.org", papel: "design", mensagem: "Trabalho com diagramação e queria ajudar com os materiais." } });
  await rpc(coordenacao, "inscricao_decidir", { p_id: outra.id, p_aceitar: false });
  return (await caixa("paulo.pires@exemplo.org")).rows.map((m) => m.tipo);
}, (tipos) => tipos.join() === "inscricao_recebida,inscricao_recusada");
await espera("convite pessoal criado pela coordenação vai por e-mail; o da comunidade, não", async () => {
  const pessoal = await rpc(coordenacao, "convite_criar", { p: { email: "nova.pessoa@exemplo.org", papel: "traducao", dias: 5 } });
  const aberto = await rpc(coordenacao, "convite_criar", { p: { usos: 3, dias: 2 } });
  const emails = (await caixa("nova.pessoa@exemplo.org", "convite")).rows;
  return [pessoal.email_enviado, aberto.email_enviado, emails.length, emails[0]?.texto.includes(`convite=${pessoal.codigo}`), emails[0]?.texto.includes("5 dia(s)"), emails[0]?.texto.includes("tradução")];
}, (r) => r[0] === true && r[1] === false && r[2] === 1 && r[3] === true && r[4] === true && r[5] === true);
await espera("o mesmo endereço recebe no máximo três e-mails do mesmo tipo por dia", async () => {
  for (let n = 0; n < 5; n++) await dono("select interno.email('alvo@exemplo.org', 'teste_limite', 'Assunto', 'Texto')");
  return (await caixa("alvo@exemplo.org", "teste_limite")).rows.length;
}, (n) => n === 3);
await espera("endereço inválido não entra na fila", () => dono("select interno.email('isto não é e-mail', 'teste_invalido', 'Assunto', 'Texto') as r"), (r) => r.rows[0].r === false);
await espera("pedido de reforço: quem pediu recebe a confirmação", async () => {
  await rpc(anonDe("198.51.100.122"), "reforco_pedir", { p: { email: "estudante.reforco@exemplo.org", disciplina: "matematica", assunto: "Regra de três", duvida: "Não entendi quando a regra de três é inversa e quando é direta." } });
  return (await caixa("estudante.reforco@exemplo.org")).rows;
}, (r) => r.length === 1 && r[0].tipo === "reforco_recebido" && r[0].texto.includes("Regra de três"));

const codigoDe = async (email) => (await dono("select codigo, confirmado from interno.boletim where email = $1", [email])).rows[0];
// Boletim: sem nenhum e-mail enviado ainda, o pedido entra direto, como antes.
await espera("antes de o envio funcionar, pedir o boletim entra direto na lista", async () => {
  const r = await rpc(anonDe("198.51.100.140"), "boletim_assinar", { p_email: "antes.do.envio@exemplo.org" });
  return [r.confirmar, (await codigoDe("antes.do.envio@exemplo.org")).confirmado, (await caixa("antes.do.envio@exemplo.org")).rows.length];
}, (r) => r[0] === false && r[1] === true && r[2] === 0);
await dono(`insert into interno.configuracoes (chave, valor) values ('email', '{"ativo": true}') on conflict (chave) do update set valor = interno.configuracoes.valor || '{"ativo": true}'`);

// Boletim: confirmação em duas etapas, envio pelo painel e saída por link.
await espera("pedir o boletim manda um link de confirmação, e o endereço ainda não está na lista", async () => {
  await rpc(anonDe("198.51.100.123"), "boletim_assinar", { p_email: "Leitora.Boletim@Exemplo.org" });
  const linha = await codigoDe("leitora.boletim@exemplo.org");
  const emails = (await caixa("leitora.boletim@exemplo.org", "boletim_confirmar")).rows;
  return [linha.confirmado, emails.length, emails[0]?.texto.includes(`boletim=confirmar&codigo=${linha.codigo}`)];
}, (r) => r[0] === false && r[1] === 1 && r[2] === true);
await espera("pedir de novo reenvia o link, mas no máximo duas vezes por dia", async () => {
  for (let n = 0; n < 4; n++) await rpc(anonDe(`198.51.100.${130 + n}`), "boletim_assinar", { p_email: "leitora.boletim@exemplo.org" });
  return (await caixa("leitora.boletim@exemplo.org", "boletim_confirmar")).rows.length;
}, (n) => n === 2);
await recusa("código errado não confirma", () => rpc(anonDe("198.51.100.124"), "boletim_confirmar", { p_codigo: "0".repeat(32) }), "nao_encontrado");
await recusa("código fora do formato não confirma", () => rpc(anonDe("198.51.100.124"), "boletim_confirmar", { p_codigo: "' or 1=1 --" }), "nao_encontrado");
await espera("o link confirma", async () => { await rpc(anonDe("198.51.100.125"), "boletim_confirmar", { p_codigo: (await codigoDe("leitora.boletim@exemplo.org")).codigo }); return codigoDe("leitora.boletim@exemplo.org"); }, (r) => r.confirmado === true);
await espera("endereço já confirmado não recebe outro link", async () => { await rpc(anonDe("198.51.100.126"), "boletim_assinar", { p_email: "leitora.boletim@exemplo.org" }); return (await caixa("leitora.boletim@exemplo.org", "boletim_confirmar")).rows.length; }, (n) => n === 2);
await espera("pedido sem confirmação não recebe edição", async () => { await rpc(anonDe("198.51.100.127"), "boletim_assinar", { p_email: "sem.confirmar@exemplo.org" }); return true; }, (r) => r);
await recusa("participante não envia edição do boletim", () => rpc(como(ids.calma), "boletim_enviar", { p_assunto: "Edição falsa", p_texto: "Texto de edição falsa com mais de cinquenta caracteres para passar." }), "sem_permissao");
await recusa("edição precisa de texto de verdade", () => rpc(como(ids.jornal), "boletim_enviar", { p_assunto: "Edição", p_texto: "curto" }), "invalido:texto");
let edicao;
await espera("o jornalismo envia a edição: só para quem confirmou, cada um com o próprio link de saída", async () => {
  edicao = await rpc(como(ids.jornal), "boletim_enviar", { p_assunto: "Boletim do jornal, número 1", p_texto: "As matérias desta semana: a reforma da previdência, a greve dos professores e a nova aula de matemática." });
  const da = (await caixa("leitora.boletim@exemplo.org", "boletim")).rows;
  const naoConfirmada = (await caixa("sem.confirmar@exemplo.org", "boletim")).rows;
  const codigo = (await codigoDe("leitora.boletim@exemplo.org")).codigo;
  return [edicao.emails >= 1, da.length, da[0]?.sair.endsWith(`codigo=${codigo}`), da[0]?.texto.includes("Para sair da lista"), naoConfirmada.length];
}, (r) => r[0] === true && r[1] === 1 && r[2] === true && r[3] === true && r[4] === 0);
await recusa("segunda edição em menos de seis horas é recusada", () => rpc(como(ids.jornal), "boletim_enviar", { p_assunto: "Boletim número 2", p_texto: "Outra edição enviada logo em seguida, por engano, com mais de cinquenta caracteres." }), "boletim_recente");
await espera("a lista mostra quem confirmou", () => rpc(como(ids.jornal), "boletim_listar"), (r) => r.some((x) => x.email === "leitora.boletim@exemplo.org" && x.confirmado === true) && r.some((x) => x.email === "sem.confirmar@exemplo.org" && x.confirmado === false));
await espera("o link de saída tira da lista na hora", async () => { await rpc(anonDe("198.51.100.128"), "boletim_sair", { p_codigo: (await codigoDe("leitora.boletim@exemplo.org")).codigo }); return dono("select count(*)::int as n from interno.boletim where email = 'leitora.boletim@exemplo.org'"); }, (r) => r.rows[0].n === 0);

// A rotina de envio.
let lote;
await espera("a rotina pega a fila e marca como enviando", async () => { lote = await rpc(servico, "emails_pendentes", { p_limite: 100 }); return [lote, await rpc(servico, "emails_pendentes", { p_limite: 100 })]; },
  ([primeiro, segundo]) => primeiro.length > 5 && primeiro.every((m) => m.id && m.para && m.assunto && m.texto) && segundo.length === 0);
await espera("enviado: o texto sai do banco e fica só o registro", async () => {
  const convite = lote.find((m) => m.para === "rosa.ribeiro@exemplo.org" && m.texto.includes("convite="));
  await rpc(servico, "email_resultado", { p_id: convite.id, p_ok: true });
  return (await dono("select status, texto, enviado_em is not null as saiu from interno.emails where id = $1", [convite.id])).rows[0];
}, (r) => r.status === "enviado" && r.texto === "" && r.saiu === true);
await espera("falha: volta para a fila, com o motivo", async () => {
  const m = lote.find((x) => x.para === "paulo.pires@exemplo.org");
  await rpc(servico, "email_resultado", { p_id: m.id, p_ok: false, p_erro: "limite" });
  return (await dono("select status, erro, tentativas from interno.emails where id = $1", [m.id])).rows[0];
}, (r) => r.status === "pendente" && r.erro === "limite" && r.tentativas === 1);
await espera("envio que travou volta para a fila; depois de cinco tentativas, vira falho", async () => {
  const m = lote.find((x) => x.para === "estudante.reforco@exemplo.org");
  await dono("update interno.emails set tentado_em = now() - interval '20 minutes' where id = $1", [m.id]);
  const devolvido = (await rpc(servico, "emails_pendentes", { p_limite: 100 })).some((x) => x.id === m.id);
  await dono("update interno.emails set tentativas = 5, tentado_em = now() - interval '20 minutes' where id = $1", [m.id]);
  await rpc(servico, "emails_pendentes", { p_limite: 100 });
  return [devolvido, (await dono("select status from interno.emails where id = $1", [m.id])).rows[0].status];
}, (r) => r[0] === true && r[1] === "falhou");
await espera("a coordenação vê quantos esperam, saíram e falharam, sem endereço de ninguém", () => rpc(coordenacao, "emails_situacao"), (r) => r.enviados_7_dias >= 1 && r.falhos_7_dias >= 1 && typeof r.pendentes === "number" && !JSON.stringify(r).includes("@"));
await espera("a faxina apaga e-mails antigos e pedidos de boletim nunca confirmados", async () => {
  await dono("update interno.emails set criado_em = now() - interval '31 days' where para = 'alvo@exemplo.org'");
  await dono("update interno.boletim set criado_em = now() - interval '8 days' where email = 'sem.confirmar@exemplo.org'");
  await dono("select interno.limpeza()");
  return dono("select (select count(*)::int from interno.emails where para = 'alvo@exemplo.org') as emails, (select count(*)::int from interno.boletim where email = 'sem.confirmar@exemplo.org') as boletim");
}, (r) => r.rows[0].emails === 0 && r.rows[0].boletim === 0);

// ── Banimento não desfaz suspensão da coordenação ──
await espera("encerrar um banimento não tira a suspensão que a coordenação deu", async () => {
  ids.duplo = await criarUsuario("duplo@teste.local", "Dora Dupla");
  await rpc(como(ids.duplo), "eu");
  await rpc({ ...como(ids.coord), aal: "aal2" }, "usuario_suspender", { p_usuario: ids.duplo, p_suspenso: true });
  await rpc({ ...como(ids.med), aal: "aal2" }, "mediacao_banir", { p_usuario: ids.duplo, p_motivo: "Provocação repetida na comunidade.", p_origem: false });
  const b = (await dono("select id from interno.banimentos where usuario = $1 and ativo", [ids.duplo])).rows[0];
  await rpc({ ...como(ids.coord), aal: "aal2" }, "banimento_encerrar", { p_id: b.id });
  return (await dono("select suspenso from interno.perfis where id = $1", [ids.duplo])).rows[0].suspenso;
}, (r) => r === true);
await espera("e banimento sozinho, ao ser encerrado, reativa a conta", async () => {
  ids.solo = await criarUsuario("solo@teste.local", "Sol Solo");
  await rpc(como(ids.solo), "eu");
  await rpc({ ...como(ids.med), aal: "aal2" }, "mediacao_banir", { p_usuario: ids.solo, p_motivo: "Provocação repetida na comunidade.", p_origem: false });
  const b = (await dono("select id from interno.banimentos where usuario = $1 and ativo", [ids.solo])).rows[0];
  await rpc({ ...como(ids.coord), aal: "aal2" }, "banimento_encerrar", { p_id: b.id });
  return (await dono("select suspenso from interno.perfis where id = $1", [ids.solo])).rows[0].suspenso;
}, (r) => r === false);
await espera("e a ficha continua dizendo que quem suspendeu foi a coordenação", () => dono("select suspensao from interno.perfis where id = $1", [ids.duplo]), (r) => r.rows[0].suspensao === "coordenacao");

// ── Supervisão, marketing, edição de contas e as ferramentas de cada função ──
await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
const novos = { sup: "Sara Supervisora", mkt: "Mila Marketing", dev: "Duda Dev", trad: "Tito Tradutor", alvo: "Ana Alvo", outra: "Olga Outra" };
for (const [chave, nome] of Object.entries(novos)) {
  ids[chave] = await criarUsuario(`${chave}@teste.local`, nome);
  await rpc(como(ids[chave]), "eu");
  await rpc(como(ids[chave]), "perfil_salvar", { p_nome: nome, p_bio: "" });
}
const C1 = { ...como(ids.coord), aal: "aal2" };
const sup = como(ids.sup);
await recusa("supervisão não se pede pelo painel", () => rpc(como(ids.alvo), "candidatar", { p_papel: "supervisao", p_disciplina: null, p_mensagem: "Quero supervisionar o painel, tenho experiência." }), "invalido:papel");
await recusa("supervisão não se pede pelo formulário público", () => rpc({ papel: "anon", ip: "198.51.100.201" }, "voluntariar", { p: { nome: "Fulana de Tal", email: "fulana.sup@exemplo.org", papel: "supervisao", mensagem: "Quero supervisionar o painel do instituto, por favor." } }), "invalido:papel");
await espera("pedido de design continua sendo de design (o marketing é outra função)", async () => { await rpc(como(ids.outra), "candidatar", { p_papel: "design", p_disciplina: null, p_mensagem: "Faço cartazes e cuido de redes sociais há anos." }); return rpc(como(ids.outra), "candidaturas_minhas"); }, (r) => r.some((x) => x.papel === "design") && !r.some((x) => x.papel === "marketing"));
await recusa("curadoria não nomeia supervisão", () => rpc(como(ids.curadora), "papel_conceder", { p_usuario: ids.sup, p_papel: "supervisao", p_disciplina: null }), "sem_permissao");
await espera("vice-coordenação nomeia a supervisão", () => rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.sup, p_papel: "supervisao", p_disciplina: "matematica" }), (r) => r.ok);
await espera("supervisão é de todo o site, sem disciplina", () => rpc(sup, "eu"), (r) => r.papeis.some((p) => p.papel === "supervisao" && p.disciplina === null));
await recusa("aula de reforço sem disciplina é recusada", () => rpc(C1, "papel_conceder", { p_usuario: ids.alvo, p_papel: "mentoria", p_disciplina: null }), "invalido:disciplina");
for (const [quem, papel] of [["mkt", "marketing"], ["dev", "desenvolvimento"], ["trad", "traducao"], ["alvo", "revisao"], ["outra", "revisao"]]) await rpc(C1, "papel_conceder", { p_usuario: ids[quem], p_papel: papel, p_disciplina: null });

// O que a supervisão vê e faz.
await espera("supervisão vê a equipe sem nenhum e-mail", () => rpc(sup, "equipe_supervisao"), (r) => r.length > 5 && !JSON.stringify(r).includes("@") && r.find((m) => m.id === ids.coord)?.protegida === true && r.find((m) => m.id === ids.alvo)?.protegida === false);
await espera("supervisão lista voluntários, mas sem e-mail de ninguém", () => rpc(sup, "voluntarios_listar"), (r) => r.length > 0 && r.every((p) => p.email === ""));
await espera("supervisão busca pessoas pelo nome, sem e-mail", () => rpc(sup, "pessoas_buscar", { p_busca: "alvo" }), (r) => r.every((p) => p.email === ""));
await recusa("supervisão não confia funções", () => rpc(sup, "papel_conceder", { p_usuario: ids.alvo, p_papel: "curadoria", p_disciplina: null }), "sem_permissao");
await recusa("supervisão não convida", () => rpc(sup, "convite_criar", { p: { email: "x@exemplo.org", papel: "revisao" } }), "sem_permissao");
await recusa("supervisão não mexe na segurança", () => rpc(sup, "seguranca_configurar", { p_exigir_2fa: false }), "sem_permissao");
await recusa("supervisão não troca a faixa do alto", () => rpc(sup, "site_salvar", { p: { faixa: "Oi", pausa: false } }), "sem_permissao");
await recusa("supervisão não edita contas", () => rpc(sup, "usuario_editar", { p_usuario: ids.alvo, p_nome: "Outro Nome", p_bio: "" }), "sem_permissao");
await recusa("supervisão não redefine senha", () => rpc(sup, "usuario_senha_redefinir", { p_usuario: ids.alvo, p_senha: "uma-senha-bem-comprida" }), "sem_permissao");
await espera("supervisão vê os pedidos de voluntariado, sem e-mail", () => rpc(sup, "pedidos_supervisao"), (r) => r.length >= 1 && !JSON.stringify(r).includes("@"));
await recusa("revisor não vê os pedidos da supervisão", () => rpc(como(ids.alvo), "pedidos_supervisao"), "sem_permissao");
await recusa("suspensão pela supervisão exige motivo", () => rpc(sup, "usuario_suspender", { p_usuario: ids.alvo, p_suspenso: true, p_motivo: "" }), "invalido:motivo");
const avisosDaCoord = async () => (await rpc(como(ids.coord), "eu")).avisos;
let antes;
await espera("supervisão suspende em emergência e a coordenação é avisada", async () => {
  antes = await avisosDaCoord();
  await rpc(sup, "usuario_suspender", { p_usuario: ids.alvo, p_suspenso: true, p_motivo: "Conta publicando golpe no mural" });
  return [(await rpc(como(ids.alvo), "eu")).suspenso, await avisosDaCoord()];
}, (r) => r[0] === true && r[1] > antes);
await espera("a Mesa da supervisão conta as suspensões que ela fez", () => rpc(sup, "painel_resumo"), (r) => r.suspensas === 1);
await espera("o registro guarda o motivo", () => rpc(C1, "auditoria_listar", { p_pagina: 0, p_acao: "conta_suspensa" }), (r) => r[0].detalhes.justificativa === "Conta publicando golpe no mural");
await espera("supervisão reativa o que ela suspendeu", async () => { await rpc(sup, "usuario_suspender", { p_usuario: ids.alvo, p_suspenso: false, p_motivo: "Engano, era o irmão" }); return rpc(como(ids.alvo), "eu"); }, (r) => r.suspenso === false);
await espera("coordenação suspende sem precisar de motivo", async () => { await rpc(C1, "usuario_suspender", { p_usuario: ids.outra, p_suspenso: true }); return rpc(como(ids.outra), "eu"); }, (r) => r.suspenso === true);
await recusa("supervisão não reativa o que a coordenação suspendeu", () => rpc(sup, "usuario_suspender", { p_usuario: ids.outra, p_suspenso: false, p_motivo: "Quero reativar esta conta" }), "sem_permissao");
await espera("coordenação reativa", async () => { await rpc(C1, "usuario_suspender", { p_usuario: ids.outra, p_suspenso: false }); return rpc(como(ids.outra), "eu"); }, (r) => r.suspenso === false);
await recusa("supervisão não suspende a coordenação", () => rpc(sup, "usuario_suspender", { p_usuario: ids.coord, p_suspenso: true, p_motivo: "Teste de permissão" }), "sem_permissao");
await recusa("supervisão não suspende a vice-coordenação", () => rpc(sup, "usuario_suspender", { p_usuario: ids.vice, p_suspenso: true, p_motivo: "Teste de permissão" }), "sem_permissao");
await recusa("ninguém suspende a própria conta", () => rpc(sup, "usuario_suspender", { p_usuario: ids.sup, p_suspenso: true, p_motivo: "Teste de permissão" }), "invalido:usuario");
await recusa("nem a vice-coordenação suspende a si mesma", () => rpc(como(ids.vice), "usuario_suspender", { p_usuario: ids.vice, p_suspenso: true }), "invalido:usuario");
await espera("supervisão pausa os envios do público e a coordenação é avisada", async () => { antes = await avisosDaCoord(); const r = await rpc(sup, "site_pausa", { p_pausa: true, p_motivo: "Chuva de spam" }); return [r.pausa, (await rpc(anon, "site")).pausa, await avisosDaCoord()]; }, (r) => r[0] === true && r[1] === true && r[2] > antes);
await recusa("com a pausa, o público não envia", () => rpc({ papel: "anon", ip: "198.51.100.202" }, "boletim_assinar", { p_email: "pausa.sup@exemplo.org" }), "envios_pausados");
await espera("supervisão retoma os envios", () => rpc(sup, "site_pausa", { p_pausa: false }), (r) => r.pausa === false);
await recusa("revisor não pausa os envios", () => rpc(como(ids.alvo), "site_pausa", { p_pausa: true }), "sem_permissao");
await espera("supervisão liga e desliga o modo de segurança da Comunidade", async () => { const ligado = await rpc(sup, "comunidade_modo_seguranca", { p_ligar: true }); const desligado = await rpc(sup, "comunidade_modo_seguranca", { p_ligar: false }); return [ligado.aprovacao_manual, desligado.aprovacao_manual, ligado.habilitada]; }, (r) => r[0] === true && r[1] === false && r[2] === undefined);
await espera("supervisão lê o registro de atividades e o livro do acervo", async () => [await rpc(sup, "auditoria_listar", { p_pagina: 0 }), await rpc(sup, "audit_logs_listar", { p_pagina: 0 })], (r) => r[0].length > 0 && Array.isArray(r[1]));
await espera("supervisão vê os canais das funções, menos o da coordenação", () => rpc(sup, "equipe_canais"), (r) => r.canais.includes("supervisao") && r.canais.includes("marketing") && r.canais.includes("mediacao") && !r.canais.includes("coordenacao"));
await espera("supervisão entra nos grupos cifrados das funções, menos no da coordenação", () => rpc(sup, "chat_conversas"), (r) => { const deps = r.filter((c) => c.tipo === "departamento").map((c) => c.departamento); return deps.includes("supervisao") && deps.includes("mediacao") && deps.includes("marketing") && !deps.includes("coordenacao"); });
await espera("supervisão apaga publicação de outra pessoa no mural da equipe, e fica registrado", async () => {
  const m = await rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: await selar(aparelhos.prof, geral, "Recado para apagar.", contextoDoMural("geral", ids.prof)) });
  await rpc(sup, "equipe_apagar", { p_id: m.id });
  return [(await dono("select count(*)::int as n from interno.equipe_mensagens where id = $1", [m.id])).rows[0].n, (await rpc(C1, "auditoria_listar", { p_pagina: 0, p_acao: "equipe_mensagem_apagada" })).length];
}, (r) => r[0] === 0 && r[1] === 1);
await recusa("revisor não apaga publicação alheia", async () => { const m = await rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: await selar(aparelhos.prof, geral, "Outro recado.", contextoDoMural("geral", ids.prof)) }); return rpc(como(ids.revisor), "equipe_apagar", { p_id: m.id }); }, "nao_encontrado");
await espera("pedido de ajuda para a mediação é aceito e conta na Mesa dela", async () => { const antes = (await rpc(como(ids.med), "painel_resumo")).pedidos_ajuda; await rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: await selar(aparelhos.prof, geral, "Preciso de ajuda com a Comunidade.", contextoDoMural("pedidos", ids.prof)), p_resposta_a: null, p_para: "mediacao" }); return [antes, (await rpc(como(ids.med), "painel_resumo")).pedidos_ajuda]; }, ([antes, depois]) => depois === antes + 1);
await espera("com a exigência ligada, a supervisão precisa do segundo fator", async () => {
  await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": true}'::jsonb where chave = 'seguranca'");
  let sem = "";
  try { await rpc(sup, "equipe_supervisao"); } catch (erro) { sem = erro.message; }
  const com = await rpc({ ...sup, aal: "aal2" }, "equipe_supervisao");
  const eu = await rpc(sup, "eu");
  await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
  return [sem, com.length > 0, eu.exige_segundo_fator];
}, (r) => r[0].includes("sem_permissao") && r[1] && r[2] === true);
await recusa("só a coordenação tira a supervisão de quem também é vice", async () => {
  await rpc(C1, "papel_conceder", { p_usuario: ids.vice, p_papel: "supervisao", p_disciplina: null });
  const papel = (await rpc(como(ids.vice), "eu")).papeis.find((p) => p.papel === "supervisao");
  return rpc({ ...como(ids.vice), aal: "aal2" }, "papel_remover", { p_id: papel.id });
}, "sem_permissao");

// Marketing e divulgação.
const mkt = como(ids.mkt);
let post;
await espera("marketing põe um post no calendário", async () => (post = await rpc(mkt, "divulgacao_salvar", { p: { titulo: "Convite para a aula aberta", formato: "carrossel", legenda: "Sábado tem aula aberta de história.", data_prevista: "2026-11-02", material: "https://exemplo.org/pasta", situacao: "rascunho" } })), (r) => Boolean(r.id));
await recusa("material com endereço estranho é recusado", () => rpc(mkt, "divulgacao_salvar", { p: { titulo: "Outro post", material: "javascript:alert(1)" } }), "invalido:material");
await recusa("data inválida é recusada", () => rpc(mkt, "divulgacao_salvar", { p: { titulo: "Outro post", data_prevista: "amanhã" } }), "invalido:data_prevista");
await recusa("marketing não marca como pronto sozinho (é aprovação)", () => rpc(mkt, "divulgacao_situacao", { p_id: post.id, p_situacao: "pronto" }), "sem_permissao:aprovar");
await espera("a coordenação aprova: pronto para sair", () => rpc(C1, "divulgacao_situacao", { p_id: post.id, p_situacao: "pronto" }), (r) => r.ok);
await recusa("marketing não comenta como coordenação", () => rpc(mkt, "divulgacao_comentar", { p_id: post.id, p_nota: "Aprovado por mim mesma" }), "sem_permissao");
await recusa("devolver exige uma nota", () => rpc(C1, "divulgacao_comentar", { p_id: post.id, p_nota: "", p_devolver: true }), "invalido:nota");
await espera("coordenação devolve para rascunho e o marketing é avisado", async () => { await rpc(C1, "divulgacao_comentar", { p_id: post.id, p_nota: "Falta o crédito da foto.", p_devolver: true }); return [(await rpc(mkt, "divulgacao_listar")).itens.find((i) => i.id === post.id), (await rpc(mkt, "painel_resumo")).divulgacao, (await rpc(mkt, "eu")).avisos]; },
  (r) => r[0].situacao === "rascunho" && r[0].devolvido === true && r[0].nota === "Falta o crédito da foto." && r[1] === 1 && r[2] >= 1);
await espera("ao corrigir, a marca de devolvido sai (e a peça espera nova aprovação)", async () => { await rpc(mkt, "divulgacao_salvar", { p: { id: post.id, titulo: "Convite para a aula aberta", formato: "carrossel", legenda: "Sábado tem aula aberta de história. Foto: acervo próprio.", situacao: "rascunho" } }); return (await rpc(mkt, "divulgacao_listar")).itens.find((i) => i.id === post.id); }, (r) => r.devolvido === false && r.situacao === "rascunho");
await recusa("leitora não vê o calendário", () => rpc(como(ids.leitora), "divulgacao_listar"), "sem_permissao");
await recusa("o design antigo não vê o calendário", () => rpc(como(ids.designer), "divulgacao_listar"), "sem_permissao");
await recusa("revisor não apaga item do calendário", () => rpc(como(ids.alvo), "divulgacao_apagar", { p_id: post.id }), "sem_permissao");
await recusa("marketing não define o perfil do Instagram", () => rpc(mkt, "divulgacao_instagram_salvar", { p_url: "https://www.instagram.com/institutolucia" }), "sem_permissao");
await recusa("o perfil só aceita endereço do Instagram", () => rpc(C1, "divulgacao_instagram_salvar", { p_url: "https://golpe.exemplo/login" }), "invalido:instagram");
await espera("coordenação indica o perfil e o marketing vê", async () => { await rpc(C1, "divulgacao_instagram_salvar", { p_url: "https://www.instagram.com/institutolucia" }); return rpc(mkt, "divulgacao_listar"); }, (r) => r.instagram === "https://www.instagram.com/institutolucia");
await espera("marketing prepara materiais, como o design", () => rpc(mkt, "material_salvar", { p: { credito_autor: "Equipe do instituto", credito_origem: "Feito pelo instituto", licenca: "cc-by-sa", tipo: "cartaz", titulo: "Cartaz da aula aberta", descricao: "Cartaz A3.", campanha: "", url: "https://exemplo.org/cartaz" } }), (r) => Boolean(r.id));
await espera("marketing vê o canal dele e o do design no mural da equipe", () => rpc(mkt, "equipe_canais"), (r) => JSON.stringify(r.canais) === JSON.stringify(["geral", "pedidos", "aprendizado", "design", "marketing"]));
await espera("marketing apaga um item do calendário", () => rpc(mkt, "divulgacao_apagar", { p_id: post.id }), (r) => r.ok);

// Coordenação e vice-coordenação editam contas (menos o e-mail) e redefinem senhas.
await espera("coordenação acerta o nome e a apresentação de alguém, que é avisado", async () => { const antes2 = (await rpc(como(ids.alvo), "eu")).avisos; const r = await rpc(C1, "usuario_editar", { p_usuario: ids.alvo, p_nome: "Ana Alves", p_bio: "Revisora de português." }); const eu = await rpc(como(ids.alvo), "eu"); return [r.mudou, eu.nome, eu.bio, eu.avisos > antes2]; }, (r) => r[0] === true && r[1] === "Ana Alves" && r[2] === "Revisora de português." && r[3] === true);
await espera("o registro guarda o que mudou, não o texto", () => rpc(C1, "auditoria_listar", { p_pagina: 0, p_acao: "usuario_editado" }), (r) => JSON.stringify(r[0].detalhes.campos) === JSON.stringify(["nome", "apresentacao"]) && !JSON.stringify(r).includes("Revisora de português"));
await recusa("ninguém edita a própria conta por aqui", () => rpc(C1, "usuario_editar", { p_usuario: ids.coord, p_nome: "Jonathan S.", p_bio: "" }), "invalido:usuario");
await recusa("vice-coordenação não edita a coordenação", () => rpc({ ...como(ids.vice), aal: "aal2" }, "usuario_editar", { p_usuario: ids.coord, p_nome: "Outro", p_bio: "" }), "sem_permissao");
await recusa("vice-coordenação não redefine a senha da coordenação", () => rpc({ ...como(ids.vice), aal: "aal2" }, "usuario_senha_redefinir", { p_usuario: ids.coord, p_senha: "senha-trocada-pela-vice" }), "sem_permissao");
await recusa("curadoria não edita contas", () => rpc(como(ids.curadora), "usuario_editar", { p_usuario: ids.alvo, p_nome: "Outro", p_bio: "" }), "sem_permissao");
await recusa("não existe função para trocar o e-mail", () => rpc(C1, "usuario_email", { p_usuario: ids.alvo, p_email: "novo@exemplo.org" }), "usuario_email");
await recusa("senha curta é recusada", () => rpc(C1, "usuario_senha_redefinir", { p_usuario: ids.alvo, p_senha: "curta" }), "invalido:senha");
const senhaNova = "cavalo-bateria-grampo-certo";
await espera("coordenação redefine a senha: gravada como o serviço de contas grava, e a pessoa é marcada para trocar", async () => {
  await rpc(C1, "usuario_senha_redefinir", { p_usuario: ids.alvo, p_senha: senhaNova });
  const conta = (await dono("select encrypted_password = extensions.crypt($2, encrypted_password) as confere, encrypted_password like '$2%' as bcrypt from auth.users where id = $1", [ids.alvo, senhaNova])).rows[0];
  return [conta.confere, conta.bcrypt, (await rpc(como(ids.alvo), "eu")).trocar_senha];
}, (r) => r[0] === true && r[1] === true && r[2] === true);
await espera("a senha não vai para o registro", () => rpc(C1, "auditoria_listar", { p_pagina: 0, p_acao: "senha_redefinida" }), (r) => r.length === 1 && !JSON.stringify(r).includes(senhaNova));
await espera("vice-coordenação redefine a senha de quem não é coordenação", () => rpc({ ...como(ids.vice), aal: "aal2" }, "usuario_senha_redefinir", { p_usuario: ids.alvo, p_senha: `${senhaNova}-2` }), (r) => r.ok);
await espera("depois de escolher a própria senha, a marca sai", async () => { await rpc(como(ids.alvo), "senha_trocada"); return rpc(como(ids.alvo), "eu"); }, (r) => r.trocar_senha === false);
await espera("a coordenação vê na ficha quem ainda precisa trocar", async () => { await rpc(C1, "usuario_senha_redefinir", { p_usuario: ids.outra, p_senha: senhaNova }); return rpc(C1, "voluntarios_listar"); }, (r) => r.find((p) => p.id === ids.outra)?.trocar_senha === true && r.find((p) => p.id === ids.alvo)?.trocar_senha === false);

// Desenvolvimento e tradução têm ferramenta própria; curadoria cuida de conteúdo, não de reforço.
await espera("desenvolvimento vê o estado técnico, sem dado de pessoa", () => rpc(como(ids.dev), "diagnostico"), (r) => typeof r.aprovadas === "number" && typeof r.pgcrypto === "boolean" && !JSON.stringify(r).includes("@"));
await recusa("leitora não vê o estado técnico", () => rpc(como(ids.leitora), "diagnostico"), "sem_permissao");
await recusa("marketing não vê o estado técnico", () => rpc(mkt, "diagnostico"), "sem_permissao");
await espera("tradução vê as traduções a caminho", () => rpc(como(ids.trad), "traducoes_andamento"), (r) => Array.isArray(r));
await recusa("leitora não vê as traduções a caminho", () => rpc(como(ids.leitora), "traducoes_andamento"), "sem_permissao");
await recusa("curadoria não vê a fila de reforço (tem e-mail de estudante)", () => rpc(como(ids.curadora), "reforco_fila"), "sem_permissao");
await espera("a Mesa do revisor não conta o que espera a triagem", () => rpc(como(ids.alvo), "painel_resumo"), (r) => typeof r.fila === "number" && r.candidaturas === 0 && r.denuncias === 0 && r.mural === 0);
await espera("a Mesa do marketing não conta a fila de revisão nem a triagem", () => rpc(mkt, "painel_resumo"), (r) => r.fila === 0 && r.triagem === 0 && r.candidaturas === 0);

// ── Interdição do site, pedidos da supervisão e expurgo ──
const COORD = { ...como(ids.coord), aal: "aal2" };
const VICE = { ...como(ids.vice), aal: "aal2" };
const SUP = como(ids.sup);
const avisosDe = async (quem) => (await rpc(quem, "eu")).avisos;
await espera("site aberto: site() diz que não há interdição, sem motivo nem autor", () => rpc(anon, "site"), (r) => r.interdicao.geral === false && r.interdicao.areas.length === 0 && r.interdicao.motivo === undefined && r.interdicao.por === undefined);
await recusa("leitora não vê a interdição", () => rpc(como(ids.leitora), "interdicao_ver"), "sem_permissao");
await recusa("supervisão não aplica a interdição sozinha", () => rpc(SUP, "interdicao_definir", { p: { geral: true, motivo: "Teste da supervisão" } }), "sem_permissao");
await recusa("interdição exige motivo", () => rpc(COORD, "interdicao_definir", { p: { geral: false, areas: ["comunidade"], motivo: "" } }), "invalido:motivo");
await recusa("área desconhecida é recusada", () => rpc(COORD, "interdicao_definir", { p: { areas: ["cozinha"], motivo: "Teste de área" } }), "invalido:areas");
await espera("vice-coordenação interdita só a Comunidade, e a coordenação é avisada", async () => {
  const a0 = await avisosDe(como(ids.coord));
  const r = await rpc(VICE, "interdicao_definir", { p: { geral: false, areas: ["comunidade"], motivo: "Ataque de robôs na Comunidade", mensagem: "Voltamos logo." } });
  return [r.areas, r.motivo, (await avisosDe(como(ids.coord))) > a0, (await rpc(anon, "site")).interdicao];
}, (r) => JSON.stringify(r[0]) === '["comunidade"]' && r[1] === "Ataque de robôs na Comunidade" && r[2] && r[3].mensagem === "Voltamos logo." && r[3].motivo === undefined);
await recusa("área interditada recusa o público na leitura", () => rpc(anon, "topicos_listar", {}), "area_interditada");
await recusa("e na abertura de uma conversa", () => rpc(anon, "topico_ver", { p_id: "00000000-0000-0000-0000-000000000000" }), "area_interditada");
await recusa("e no envio de quem tem conta", () => rpc(como(ids.leitora), "topico_criar", { p_titulo: "Pergunta de teste", p_corpo: "Um corpo de pergunta qualquer.", p_disciplina: null }), "area_interditada");
await espera("quem cuida da Comunidade continua lendo", () => rpc(como(ids.med), "topicos_listar", {}), (r) => Array.isArray(r));
await espera("o resto do site segue aberto", () => rpc(anon, "mural_listar", {}), (r) => Array.isArray(r));
await espera("a supervisão vê o estado, com motivo e autor", () => rpc(SUP, "interdicao_ver"), (r) => r.areas.includes("comunidade") && r.motivo === "Ataque de robôs na Comunidade" && r.por === "Vera Vice" && r.pode_aplicar === false);
await espera("coordenação tira o site inteiro do ar", () => rpc(COORD, "interdicao_definir", { p: { geral: true, areas: [], motivo: "Manutenção geral" } }), (r) => r.geral === true);
await recusa("com o site fora do ar, o mural recusa o público", () => rpc(anon, "mural_listar", {}), "area_interditada");
await recusa("e a candidatura de voluntário", () => rpc({ papel: "anon", ip: "198.51.100.210" }, "voluntariar", { p: { nome: "Fulana de Tal", email: "fulana.fora@exemplo.org", papel: "revisao", mensagem: "Quero revisar textos do instituto, tenho experiência." } }), "area_interditada");
await recusa("e a denúncia", () => rpc(anon, "denunciar", { p_alvo: "/pt/comunidade", p_motivo: "spam", p_detalhes: "Detalhes da denúncia com mais de vinte letras." }), "area_interditada");
await recusa("e a rádio", () => rpc(anon, "radio_estado"), "area_interditada");
await espera("a equipe continua escrevendo pelo painel", () => rpc(como(ids.prof), "contribuir", { p: aula({ titulo: "Aula escrita com o site fora do ar" }) }), (r) => Boolean(r.id));
await espera("o jornalismo continua cuidando da rádio", () => rpc(como(ids.jornal), "radio_estado"), (r) => Array.isArray(r.canais));
await espera("coordenação reabre tudo", () => rpc(COORD, "interdicao_definir", { p: { geral: false, areas: [], motivo: "Manutenção concluída" } }), (r) => r.geral === false && r.areas.length === 0);
await espera("reaberto, o público lê de topicoNovo", () => rpc(anon, "topicos_listar", {}), (r) => Array.isArray(r));

// Os pedidos da supervisão.
await recusa("pedido precisa de justificativa de pelo menos 30 letras", () => rpc(SUP, "pedido_criar", { p_tipo: "interdicao", p_dados: { areas: ["mural"] }, p_justificativa: "Spam" }), "invalido:justificativa");
await recusa("coordenação não faz pedido: aplica direto", () => rpc(COORD, "pedido_criar", { p_tipo: "liberacao", p_dados: {}, p_justificativa: "A coordenação não precisa pedir nada a ninguém." }), "sem_permissao");
await recusa("revisor não faz pedido", () => rpc(como(ids.alvo), "pedido_criar", { p_tipo: "liberacao", p_dados: {}, p_justificativa: "Um revisor tentando pedir algo que não pode." }), "sem_permissao");
await recusa("pedido de interdição sem área nem site inteiro", () => rpc(SUP, "pedido_criar", { p_tipo: "interdicao", p_dados: { areas: [] }, p_justificativa: "Pedido sem dizer o que fechar, não deve passar." }), "invalido:areas");
let pedidoSup;
await espera("supervisão pede a interdição do mural; nada muda ainda, e a coordenação é avisada", async () => {
  const a0 = await avisosDe(como(ids.coord));
  pedidoSup = await rpc(SUP, "pedido_criar", { p_tipo: "interdicao", p_dados: { areas: ["mural"], mensagem: "Mural em revisão." }, p_justificativa: "O mural está recebendo dezenas de anúncios falsos por minuto." });
  return [Boolean(pedidoSup.id), (await avisosDe(como(ids.coord))) > a0, (await rpc(anon, "site")).interdicao.areas];
}, (r) => r[0] && r[1] && r[2].length === 0);
await espera("a Mesa da coordenação conta o pedido", () => rpc(COORD, "painel_resumo"), (r) => r.pedidos_supervisao === 1);
await espera("a supervisão acompanha o próprio pedido", () => rpc(SUP, "pedidos_listar"), (r) => r.some((p) => p.id === pedidoSup.id && p.meu && p.situacao === "pendente"));
await recusa("supervisão não decide o próprio pedido", () => rpc(SUP, "pedido_decidir", { p_id: pedidoSup.id, p_aprovar: true }), "sem_permissao");
await espera("coordenação aprova: a interdição vale com os dados do pedido, e a supervisão é avisada", async () => {
  const a0 = await avisosDe(SUP);
  await rpc(COORD, "pedido_decidir", { p_id: pedidoSup.id, p_aprovar: true, p_nota: "Pode fechar." });
  return [(await rpc(anon, "site")).interdicao, (await avisosDe(SUP)) > a0, (await rpc(SUP, "pedidos_listar")).find((p) => p.id === pedidoSup.id)];
}, (r) => JSON.stringify(r[0].areas) === '["mural"]' && r[0].mensagem === "Mural em revisão." && r[1] && r[2].situacao === "aprovado" && r[2].nota === "Pode fechar." && r[2].decidido_por === "Jonathan");
await recusa("pedido decidido não se decide de topicoNovo", () => rpc(COORD, "pedido_decidir", { p_id: pedidoSup.id, p_aprovar: false }), "ja_decidida");
await espera("liberação recusada: nada muda", async () => {
  const p2 = await rpc(SUP, "pedido_criar", { p_tipo: "liberacao", p_dados: {}, p_justificativa: "O spam parou há uma hora, dá para reabrir o mural." });
  await rpc(VICE, "pedido_decidir", { p_id: p2.id, p_aprovar: false, p_nota: "Espere até amanhã." });
  return (await rpc(anon, "site")).interdicao.areas;
}, (r) => JSON.stringify(r) === '["mural"]');
await espera("pedido parado há mais de 72 horas vence e não se aprova", async () => {
  const p3 = await rpc(SUP, "pedido_criar", { p_tipo: "liberacao", p_dados: {}, p_justificativa: "Pedido de reabertura que ninguém viu a tempo." });
  await dono("update interno.pedidos set criado_em = now() - interval '73 hours' where id = $1", [p3.id]);
  let erro = "";
  try {
    await rpc(COORD, "pedido_decidir", { p_id: p3.id, p_aprovar: true });
  } catch (e) {
    erro = e.message;
  }
  return [erro, (await rpc(anon, "site")).interdicao.areas, (await rpc(COORD, "pedidos_listar")).find((p) => p.id === p3.id).situacao];
}, (r) => r[0].includes("pedido_vencido") && JSON.stringify(r[1]) === '["mural"]' && r[2] === "vencido");
await espera("liberação aprovada reabre", async () => {
  const p4 = await rpc(SUP, "pedido_criar", { p_tipo: "liberacao", p_dados: {}, p_justificativa: "O mural já foi limpo pela mediação, pode reabrir." });
  await rpc(COORD, "pedido_decidir", { p_id: p4.id, p_aprovar: true });
  return (await rpc(anon, "site")).interdicao;
}, (r) => r.geral === false && r.areas.length === 0);

// Expurgo.
ids.robo = await criarUsuario("robo@teste.local", "Robô de Spam");
await rpc(como(ids.robo), "eu");
const inserir = async (sql, valores) => (await dono(sql, valores)).rows[0].id;
const topicoTeste = (autor, horas) => inserir("insert into interno.topicos (autor, titulo, corpo, criado_em) values ($1, 'Tópico de teste do expurgo', 'Corpo de teste do expurgo.', now() - make_interval(hours => $2::int)) returning id", [autor, horas]);
const respostaTeste = (topico, autor) => inserir("insert into interno.respostas (topico, autor, corpo) values ($1, $2, 'Resposta de teste do expurgo.') returning id", [topico, autor]);
const existeLinha = async (tabela, id) => (await dono(`select count(*)::int as n from interno.${tabela} where id = $1`, [id])).rows[0].n === 1;
const pExp = { areas: ["comunidade", "mural", "anotacoes", "reforco"], periodo: "24h", poupar_equipe: true };
const antesExp = await rpc(SUP, "expurgo_previa", { p: pExp });
const topicoSpam = await topicoTeste(ids.robo, 0);
const topicoVelho = await topicoTeste(ids.robo, 48);
const topicoDaEquipe = await topicoTeste(ids.prof, 0);
const respostaSpam = await respostaTeste(topicoVelho, ids.robo);
const respostaEquipe = await respostaTeste(topicoVelho, ids.prof);
await dono("insert into interno.votos (usuario, tipo, alvo, valor) values ($1, 'topico', $2, 1)", [ids.robo, topicoVelho]);
await dono("update interno.topicos set respostas = 2, pontos = 1 where id = $1", [topicoVelho]);
const anuncioSpam = await inserir("insert into interno.mural (autor, categoria, titulo, descricao, cidade, contato) values ($1, 'servico', 'Anúncio de spam', 'Descrição de spam com mais de vinte letras.', 'Recife', 'contato de spam') returning id", [ids.robo]);
const anotacaoSpam = await inserir("insert into interno.anotacoes (caminho, paragrafo, corpo, autor) values ('/trilhas/x/y', 1, 'Anotação de spam aqui.', $1) returning id", [ids.robo]);
const reforcoSpam = await inserir("insert into interno.reforco (autor, disciplina, assunto, duvida) values ($1, 'matematica', 'Spam de reforço', 'Uma dúvida de spam com mais de vinte letras.') returning id", [ids.robo]);
await espera("a prévia conta o que entrou no período e não é da equipe", () => rpc(SUP, "expurgo_previa", { p: pExp }),
  (r) => r.topicos - antesExp.topicos === 1 && r.respostas - antesExp.respostas === 1 && r.votos - antesExp.votos === 1 && r.mural - antesExp.mural === 1 && r.anotacoes - antesExp.anotacoes === 1 && r.reforco - antesExp.reforco === 1);
await espera("sem poupar a equipe, a prévia conta também o que a equipe escreveu", async () => [await rpc(SUP, "expurgo_previa", { p: { ...pExp, poupar_equipe: false } }), await rpc(SUP, "expurgo_previa", { p: pExp })], (r) => r[0].topicos > r[1].topicos);
await espera("a prévia não apaga nada", async () => [await existeLinha("topicos", topicoSpam), await existeLinha("mural", anuncioSpam)], (r) => r[0] && r[1]);
await recusa("leitora não vê a prévia", () => rpc(como(ids.robo), "expurgo_previa", { p: pExp }), "sem_permissao");
await recusa("supervisão não aplica o expurgo", () => rpc(SUP, "expurgo_aplicar", { p: { ...pExp, confirmacao: "EXPURGAR" } }), "sem_permissao");
await recusa("sem digitar EXPURGAR, nada acontece", () => rpc(COORD, "expurgo_aplicar", { p: { ...pExp, confirmacao: "expurgar" } }), "invalido:confirmacao");
await recusa("período desconhecido", () => rpc(COORD, "expurgo_previa", { p: { ...pExp, periodo: "ontem" } }), "invalido:periodo");
await recusa("área que não se expurga", () => rpc(COORD, "expurgo_previa", { p: { ...pExp, areas: ["acervo"] } }), "invalido:areas");
await espera("coordenação expurga: some o do período e de fora da equipe; o resto fica, com as contas refeitas", async () => {
  const r = await rpc(COORD, "expurgo_aplicar", { p: { ...pExp, confirmacao: "EXPURGAR" } });
  const v = (await dono("select respostas, pontos from interno.topicos where id = $1", [topicoVelho])).rows[0];
  return [r.topicos >= 1, await existeLinha("topicos", topicoSpam), await existeLinha("topicos", topicoVelho), await existeLinha("topicos", topicoDaEquipe), await existeLinha("respostas", respostaSpam), await existeLinha("respostas", respostaEquipe), v.respostas, v.pontos, await existeLinha("mural", anuncioSpam), await existeLinha("anotacoes", anotacaoSpam), await existeLinha("reforco", reforcoSpam)];
}, (r) => JSON.stringify(r) === JSON.stringify([true, false, true, true, false, true, 1, 0, false, false, false]));
await espera("o expurgo fica no registro, com as contas", () => rpc(COORD, "auditoria_listar", { p_pagina: 0, p_acao: "expurgo" }), (r) => r.length === 1 && r[0].detalhes.apagados.topicos >= 1 && r[0].detalhes.periodo === "24h");
await espera("expurgo pedido pela supervisão, com pausa: aprovado, apaga e pausa os envios", async () => {
  const topicoNovo = await topicoTeste(ids.robo, 0);
  const pe = await rpc(SUP, "pedido_criar", { p_tipo: "expurgo", p_dados: { areas: ["comunidade"], periodo: "1h", poupar_equipe: true, pausar: true }, p_justificativa: "Nova leva de spam na Comunidade, mais de cem tópicos." });
  const r = await rpc(COORD, "pedido_decidir", { p_id: pe.id, p_aprovar: true });
  const site = await rpc(anon, "site");
  const sobrou = await existeLinha("topicos", topicoNovo);
  await rpc(COORD, "site_salvar", { p: { faixa: "", pausa: false } });
  return [r.resultado.topicos >= 1, site.pausa, sobrou];
}, (r) => r[0] === true && r[1] === true && r[2] === false);
await recusa("pedido de expurgo com área que não se expurga é recusado já no pedido", () => rpc(SUP, "pedido_criar", { p_tipo: "expurgo", p_dados: { areas: ["acervo"], periodo: "1h" }, p_justificativa: "Pedido com área que não existe para expurgo." }), "invalido:areas");
await espera("o estado da interdição mostra o histórico recente", () => rpc(COORD, "interdicao_ver"), (r) => r.historico.some((h) => h.acao === "expurgo") && r.historico.some((h) => h.acao === "pedido_supervisao_aprovado"));

// ── Gaveta Aberta ──
ids.estudante = await criarUsuario("estudante@teste.local", "Edu Estudante");
await rpc(como(ids.estudante), "eu");
await rpc(como(ids.estudante), "perfil_salvar", { p_nome: "Edu Estudante", p_bio: "" });
const EST = como(ids.estudante);
const MED = como(ids.med);
const trabalho = (extra = {}) => ({
  titulo: "Hortas comunitárias na periferia de Recife", tipo: "tcc", disciplina: "geografia", curso: "Geografia", instituicao: "Universidade Federal de Pernambuco", ano: "2019",
  comentario: "Mapeei doze hortas comunitárias e entrevistei quem cuida delas; serve para quem quer começar uma no próprio bairro.",
  link: "https://repositorio.exemplo.br/handle/123", licenca: "CC BY 4.0", credito: "Edu Estudante", termo: true, termo_versao: "1", termo_nome: "Eduardo Estudante da Silva", ...extra,
});
const pdfDe = (dono) => `${dono}/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`;
await recusa("anônimo não publica na Gaveta", () => rpc(anon, "gaveta_enviar", { p: trabalho() }), "entre_primeiro");
await recusa("sem aceitar o termo, não publica", () => rpc(EST, "gaveta_enviar", { p: trabalho({ termo: false }) }), "falta_termo");
await recusa("termo de outra versão não vale", () => rpc(EST, "gaveta_enviar", { p: trabalho({ termo_versao: "0" }) }), "falta_termo");
await recusa("o termo pede o nome completo", () => rpc(EST, "gaveta_enviar", { p: trabalho({ termo_nome: "Edu" }) }), "invalido:termo_nome");
await recusa("link e PDF juntos não", () => rpc(EST, "gaveta_enviar", { p: trabalho({ arquivo: pdfDe(ids.estudante) }) }), "invalido:arquivo");
await recusa("nem link nem PDF também não", () => rpc(EST, "gaveta_enviar", { p: trabalho({ link: "" }) }), "invalido:arquivo");
await recusa("link sem https", () => rpc(EST, "gaveta_enviar", { p: trabalho({ link: "http://repositorio.exemplo.br/123" }) }), "invalido:link");
await recusa("PDF na pasta de outra pessoa", () => rpc(EST, "gaveta_enviar", { p: trabalho({ link: "", arquivo: pdfDe(ids.prof) }) }), "invalido:arquivo");
await recusa("comentário curto demais", () => rpc(EST, "gaveta_enviar", { p: trabalho({ comentario: "Bom trabalho." }) }), "invalido:comentario");
await recusa("ano no futuro", () => rpc(EST, "gaveta_enviar", { p: trabalho({ ano: "2999" }) }), "invalido:ano");
await recusa("licença fora da lista", () => rpc(EST, "gaveta_enviar", { p: trabalho({ licenca: "Todos os direitos reservados" }) }), "invalido:licenca");
await recusa("tipo fora da lista", () => rpc(EST, "gaveta_enviar", { p: trabalho({ tipo: "livro" }) }), "invalido:tipo");
await recusa("o filtro de palavras vale aqui", () => rpc(EST, "gaveta_enviar", { p: trabalho({ comentario: "Trabalho dizendo que o holocausto é mentira, com muitas páginas de argumentos." }) }), "conteudo_recusado");
let gav;
await espera("estudante publica com link; fica esperando a mediação", async () => {
  gav = await rpc(EST, "gaveta_enviar", { p: trabalho() });
  return [await rpc(anon, "gaveta_listar", { p: {} }), await rpc(EST, "gaveta_minhas")];
}, (r) => !r[0].some((g) => g.id === gav.id) && r[1][0].id === gav.id && r[1][0].status === "pendente" && r[1][0].termo_nome === undefined);
await espera("PDF da própria pasta é aceito (o banco de teste não tem depósito)", () => rpc(EST, "gaveta_enviar", { p: trabalho({ titulo: "Apostila de cartografia social", tipo: "apostila", link: "", arquivo: pdfDe(ids.estudante) }) }), (r) => Boolean(r.id));
await espera("a Mesa da mediação conta a Gaveta", () => rpc(MED, "painel_resumo"), (r) => r.gaveta === 2);
await recusa("revisor não vê a fila da Gaveta", () => rpc(como(ids.alvo), "gaveta_fila"), "sem_permissao");
await recusa("supervisão não decide a Gaveta (é cargo interno)", () => rpc(SUP, "gaveta_fila"), "sem_permissao");
await espera("quem decide vê o nome do termo e a versão aceita", () => rpc(MED, "gaveta_fila"), (r) => r.find((g) => g.id === gav.id)?.termo_nome === "Eduardo Estudante da Silva" && r.find((g) => g.id === gav.id)?.termo_versao === "1");
await recusa("recusar exige um motivo", () => rpc(MED, "gaveta_decidir", { p_id: gav.id, p_aprovar: false, p_nota: "" }), "invalido:nota");
await recusa("revisor não decide", () => rpc(como(ids.alvo), "gaveta_decidir", { p_id: gav.id, p_aprovar: true }), "sem_permissao");
await espera("mediação aprova: aparece no público, sem o nome do termo, e quem publicou é avisado", async () => {
  const a0 = await avisosDe(EST);
  await rpc(MED, "gaveta_decidir", { p_id: gav.id, p_aprovar: true });
  return [await rpc(anon, "gaveta_listar", { p: {} }), (await avisosDe(EST)) > a0];
}, (r) => r[0].some((g) => g.id === gav.id && g.licenca === "CC BY 4.0" && g.credito === "Edu Estudante") && !JSON.stringify(r[0]).includes("Eduardo Estudante da Silva") && r[1]);
await espera("filtros por disciplina, tipo e texto", async () => [
  (await rpc(anon, "gaveta_listar", { p: { disciplina: "geografia" } })).length,
  (await rpc(anon, "gaveta_listar", { p: { disciplina: "fisica" } })).length,
  (await rpc(anon, "gaveta_listar", { p: { tipo: "artigo" } })).length,
  (await rpc(anon, "gaveta_listar", { p: { busca: "HORTAS comunitarias" } })).length,
], (r) => r[0] === 1 && r[1] === 0 && r[2] === 0 && r[3] === 1);
await espera("o PDF só fica público depois da aprovação", async () => {
  const pendente = (await rpc(MED, "gaveta_fila")).find((g) => g.arquivo === pdfDe(ids.estudante));
  const antes = (await dono("select interno.gaveta_publico($1) as p", [pdfDe(ids.estudante)])).rows[0].p;
  await rpc(MED, "gaveta_decidir", { p_id: pendente.id, p_aprovar: true });
  return [antes, (await dono("select interno.gaveta_publico($1) as p", [pdfDe(ids.estudante)])).rows[0].p];
}, (r) => r[0] === false && r[1] === true);
await espera("interditada, a Gaveta recusa o público e deixa a mediação trabalhar", async () => {
  await rpc(COORD, "interdicao_definir", { p: { areas: ["gaveta"], motivo: "Teste da Gaveta" } });
  const erros = [];
  for (const chamada of [() => rpc(anon, "gaveta_listar", { p: {} }), () => rpc(EST, "gaveta_enviar", { p: trabalho({ titulo: "Trabalho durante a interdição" }) })]) {
    try {
      await chamada();
      erros.push("passou");
    } catch (e) {
      erros.push(e.message);
    }
  }
  const fila = await rpc(MED, "gaveta_fila");
  await rpc(COORD, "interdicao_definir", { p: { areas: [], motivo: "Fim do teste da Gaveta" } });
  return [...erros, fila.length > 0];
}, (r) => r[0].includes("area_interditada") && r[1].includes("area_interditada") && r[2] === true);
await recusa("com a pausa geral, a Gaveta não recebe", async () => {
  await rpc(SUP, "site_pausa", { p_pausa: true });
  try {
    return await rpc(EST, "gaveta_enviar", { p: trabalho({ titulo: "Trabalho durante a pausa" }) });
  } finally {
    await rpc(SUP, "site_pausa", { p_pausa: false });
  }
}, "envios_pausados");
await recusa("outra pessoa não retira a ficha", () => rpc(como(ids.alvo), "gaveta_retirar", { p_id: gav.id }), "nao_encontrado");
await espera("quem publicou retira a ficha do ar", async () => {
  const r = await rpc(EST, "gaveta_retirar", { p_id: gav.id });
  return [r.ok, await rpc(anon, "gaveta_listar", { p: {} }), await rpc(EST, "gaveta_minhas")];
}, (r) => r[0] && !r[1].some((g) => g.id === gav.id) && !r[2].some((g) => g.id === gav.id));
await espera("o expurgo da Gaveta apaga o que entrou no período", async () => {
  const novo = await rpc(EST, "gaveta_enviar", { p: trabalho({ titulo: "Trabalho de spam na Gaveta" }) });
  const previa = await rpc(COORD, "expurgo_previa", { p: { areas: ["gaveta"], periodo: "1h", poupar_equipe: true } });
  await rpc(COORD, "expurgo_aplicar", { p: { areas: ["gaveta"], periodo: "1h", poupar_equipe: true, confirmacao: "EXPURGAR" } });
  return [previa.gaveta >= 1, (await dono("select count(*)::int as n from interno.gaveta where id = $1", [novo.id])).rows[0].n];
}, (r) => r[0] === true && r[1] === 0);
await espera("banir a conta recusa o que ela tinha esperando na Gaveta", async () => {
  const novo = await rpc(EST, "gaveta_enviar", { p: trabalho({ titulo: "Trabalho de quem vai ser banido" }) });
  await rpc({ ...MED, aal: "aal2" }, "mediacao_banir", { p_usuario: ids.estudante, p_motivo: "Envios repetidos de spam.", p_origem: false });
  return (await dono("select status from interno.gaveta where id = $1", [novo.id])).rows[0].status;
}, (r) => r === "recusado");
await recusa("conta banida não publica", () => rpc(EST, "gaveta_enviar", { p: trabalho({ titulo: "Mais um trabalho" }) }), "conta_suspensa");

// ── Assistente de reforço: o banco decide quem pergunta e conta os usos; pergunta e resposta nunca passam por aqui ──
ids.aluna = await criarUsuario("aluna@teste.local", "Ana Aluna");
ids.aluno = await criarUsuario("aluno@teste.local", "Beto Aluno");
ids.aluno3 = await criarUsuario("aluno3@teste.local", "Caio Aluno");
const ALUNA = como(ids.aluna);
await espera("assistente nasce desligado", () => rpc(anon, "assistente_estado"), (r) => r.ligado === false);
await recusa("visitante sem conta não pergunta", () => rpc(anon, "assistente_usar"), "entre_primeiro");
await recusa("desligado, ninguém pergunta", () => rpc(ALUNA, "assistente_usar"), "assistente_desligado");
await recusa("estudante não vê os controles do assistente", () => rpc(ALUNA, "assistente_controles"), "sem_permissao");
await recusa("supervisão não liga o assistente (é serviço pago)", () => rpc(SUP, "assistente_configurar", { p: { ligado: true } }), "sem_permissao");
await recusa("limite por pessoa fora da faixa", () => rpc(VICE, "assistente_configurar", { p: { por_pessoa: 0 } }), "invalido:por_pessoa");
await recusa("teto do dia fora da faixa", () => rpc(VICE, "assistente_configurar", { p: { por_dia: 99999 } }), "invalido:por_dia");
await recusa("limite que não é número", () => rpc(VICE, "assistente_configurar", { p: { por_dia: "muitos" } }), "invalido:limite");
await espera("vice-coordenação liga com limites", () => rpc(VICE, "assistente_configurar", { p: { ligado: true, por_pessoa: 2, por_dia: 3 } }), (r) => r.ligado === true && r.por_pessoa === 2 && r.por_dia === 3 && r.hoje === 0);
await espera("ligar fica no registro e avisa a coordenação", async () => [
  (await dono("select count(*)::int as n from interno.auditoria where acao = 'assistente_configurado'")).rows[0].n,
  (await dono("select count(*)::int as n from interno.avisos where texto like 'O assistente de reforço%'")).rows[0].n,
], (r) => r[0] >= 1 && r[1] >= 1);
await espera("ligado, o site mostra o quadro", () => rpc(anon, "assistente_estado"), (r) => r.ligado === true);
await espera("primeira pergunta conta um uso", () => rpc(ALUNA, "assistente_usar"), (r) => r.ok === true && r.restantes === 1 && r.usuario === ids.aluna);
await espera("segunda pergunta usa a última vaga da pessoa", () => rpc(ALUNA, "assistente_usar"), (r) => r.restantes === 0);
await recusa("passou do limite por pessoa", () => rpc(ALUNA, "assistente_usar"), "assistente_limite");
await recusa("estudante não devolve a própria vez", () => rpc(ALUNA, "assistente_resultado", { p: { ok: false, falha: "x", usuario: ids.aluna } }), "sem_permissao");
await recusa("estudante não grava teste de funcionamento", () => rpc(ALUNA, "assistente_verificacao", { p: { ok: true, chave: true } }), "sem_permissao");
await espera("falha do serviço devolve a vez da pessoa", async () => {
  await rpc(servico, "assistente_resultado", { p: { ok: false, falha: "indisponivel", usuario: ids.aluna } });
  return rpc(ALUNA, "assistente_usar");
}, (r) => r.ok === true && r.restantes === 0);
await espera("outra pessoa pergunta enquanto há vaga no dia", () => rpc(como(ids.aluno), "assistente_usar"), (r) => r.ok === true && r.restantes === 1);
await recusa("passou do teto do dia, para o site inteiro", () => rpc(como(ids.aluno3), "assistente_usar"), "assistente_lotado");
await espera("o painel mostra usos, pessoas e a última pergunta de verdade", () => rpc(COORD, "assistente_controles"), (r) => r.hoje === 3 && r.pessoas_hoje === 2 && r.semana === 3 && r.ultimo?.ok === false && r.ultimo?.falha === "indisponivel");
await espera("resultado que deu certo não mexe no contador", async () => {
  await rpc(servico, "assistente_resultado", { p: { ok: true, falha: "", usuario: ids.aluno } });
  return rpc(COORD, "assistente_controles");
}, (r) => r.hoje === 3 && r.ultimo.ok === true);
await espera("teste de funcionamento fica anotado com o modelo", async () => {
  await rpc(servico, "assistente_verificacao", { p: { chave: true, ok: true, falha: "", modelo: "claude-opus-5-5" } });
  return rpc(COORD, "assistente_controles");
}, (r) => r.verificacao.ok === true && r.verificacao.chave === true && r.verificacao.modelo === "claude-opus-5-5" && Boolean(r.verificacao.em));
await espera("o banco não guarda pergunta nem resposta, só contadores", async () => (await dono("select column_name from information_schema.columns where table_schema = 'interno' and table_name = 'assistente_uso' order by 1")).rows.map((c) => c.column_name), (r) => JSON.stringify(r) === JSON.stringify(["dia", "usos", "usuario"]));
await rpc(COORD, "assistente_configurar", { p: { por_dia: 100 } });
await recusa("com a pausa de envios, o assistente não responde", async () => {
  await rpc(SUP, "site_pausa", { p_pausa: true });
  try {
    return await rpc(como(ids.aluno3), "assistente_usar");
  } finally {
    await rpc(SUP, "site_pausa", { p_pausa: false });
  }
}, "envios_pausados");
await espera("com a aula de reforço interditada, o quadro some e ninguém pergunta", async () => {
  await rpc(COORD, "interdicao_definir", { p: { geral: false, areas: ["reforco"], motivo: "Teste do assistente" } });
  try {
    const estado = await rpc(anon, "assistente_estado");
    const erro = await rpc(como(ids.aluno3), "assistente_usar").then(() => "", (e) => String(e?.message ?? e));
    return [estado.ligado, erro, (await rpc(COORD, "assistente_controles")).interditado];
  } finally {
    await rpc(COORD, "interdicao_definir", { p: { geral: false, areas: [], motivo: "Fim do teste" } });
  }
}, (r) => r[0] === false && r[1].includes("area_interditada") && r[2] === true);
await recusa("conta banida não pergunta", () => rpc(EST, "assistente_usar"), "conta_suspensa");
await espera("desligado de novo, ninguém pergunta", async () => {
  await rpc(COORD, "assistente_configurar", { p: { ligado: false } });
  return rpc(como(ids.aluno3), "assistente_usar").then(() => "", (e) => String(e?.message ?? e));
}, (r) => r.includes("assistente_desligado"));
await espera("a limpeza apaga contadores com mais de 90 dias", async () => {
  await dono("insert into interno.assistente_uso (dia, usuario, usos) values (interno.assistente_dia() - 120, $1, 4)", [ids.aluna]);
  await dono("select interno.limpeza()");
  return (await dono("select count(*)::int as n from interno.assistente_uso where dia < interno.assistente_dia() - 90")).rows[0].n;
}, (r) => r === 0);
await espera("instalar de novo mantém a configuração do assistente", async () => {
  await banco.instalarDeNovo();
  return rpc(COORD, "assistente_controles");
}, (r) => r.ligado === false && r.por_pessoa === 2 && r.por_dia === 100);

// ── Educação secundária, marketing, material avulso e temas para as próximas aulas ──
ids.segunda = await criarUsuario("segunda@teste.local", "Sebastiana Segunda");
ids.divulga = await criarUsuario("divulga@teste.local", "Diva Divulga");
await rpc(como(ids.segunda), "eu");
await rpc(como(ids.divulga), "eu");
await recusa("educação secundária precisa de disciplina", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.segunda, p_papel: "educacao_secundaria", p_disciplina: null }), "invalido:disciplina");
await espera("coordenação confia a educação secundária de física", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.segunda, p_papel: "educacao_secundaria", p_disciplina: "fisica" }));
await espera("coordenação confia o marketing", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.divulga, p_papel: "marketing", p_disciplina: null }));
const materialAvulso = (extra = {}) => ({ tipo: "avulso", disciplina: "fisica", titulo: "Lista de exercícios de cinemática", corpo: "Vinte exercícios de movimento uniforme, com respostas no fim.", dados: { formato: "Lista de exercícios", resumo: "Exercícios de velocidade média." }, fontes: fonte, ...extra });
let doAvulso;
await recusa("material avulso sem fonte é recusado", () => rpc(como(ids.segunda), "contribuir", { p: materialAvulso({ fontes: [] }) }), "falta_fonte");
await espera("educadora secundária envia um material avulso", async () => (doAvulso = await rpc(como(ids.segunda), "contribuir", { p: materialAvulso() })), (r) => Boolean(r.id));
await espera("o envio dela conta como da educação e pula a triagem", () => rpc(como(ids.segunda), "contribuicao_ver", { p_id: doAvulso.id }), (r) => r.como === "educacao" && r.triagem === "liberada");
await espera("ela vê a fila da física, como um educador", () => rpc(como(ids.segunda), "fila"), (r) => r.some((c) => c.id === doAvulso.id));
await recusa("tema sem trilha é recusado", () => rpc(como(ids.segunda), "contribuir", { p: { tipo: "temas", disciplina: "fisica", titulo: "Óptica do cotidiano", corpo: "Faltam aulas de óptica aplicada.", dados: { temas: "Lentes e óculos" }, fontes: [] } }), "invalido:trilha");
await recusa("mais de vinte temas de uma vez são recusados", () => rpc(como(ids.segunda), "contribuir", { p: { tipo: "temas", disciplina: "fisica", titulo: "Muitos temas", corpo: "Faltam muitas aulas aqui.", dados: { trilha: "fisica-medio", temas: Array.from({ length: 21 }, (_, i) => `Tema número ${i + 1}`).join("\n") }, fontes: [] } }), "invalido:temas");
await espera("temas para as próximas aulas de uma trilha entram na fila", () => rpc(como(ids.segunda), "contribuir", { p: { tipo: "temas", disciplina: "fisica", titulo: "Óptica do cotidiano", corpo: "Faltam aulas de óptica aplicada ao dia a dia.", dados: { trilha: "fisica-medio", temas: "Lentes e óculos\nA câmera do celular" }, fontes: [] } }), (r) => Boolean(r.id));
await espera("marketing cadastra material de divulgação, como o design", () => rpc(como(ids.divulga), "material_salvar", { p: material({ titulo: "Cartaz da campanha de voluntariado", publicado: false }) }), (r) => Boolean(r.id));
await espera("marketing vê o próprio canal no mural da equipe", () => rpc(como(ids.divulga), "equipe_canais"), (r) => r.canais.includes("marketing") && !r.canais.includes("educacao"));
await recusa("marketing não lê a fila de revisão de aulas", () => rpc(como(ids.divulga), "triagem_fila"), "sem_permissao");

// ── Registro de atividades: ações que mudam o que o público vê também deixam rastro ──
await espera("apoiadores, rádio, denúncia, anotação e retirada de anúncio entram no registro", async () => {
  const coordenacao2 = { ...como(ids.coord), aal: "aal2" };
  const apoio = await rpc(coordenacao2, "apoiador_salvar", { p_id: null, p_nome: "Apoio de teste", p_mensagem: "" });
  await rpc(coordenacao2, "apoiador_remover", { p_id: apoio.id });
  const canalNovo = await rpc(coordenacao2, "radio_canal_salvar", { p_id: null, p_nome: "Canal do registro", p_descricao: "", p_ordem: 5 });
  const faixaNova = await rpc(coordenacao2, "radio_faixa_salvar", { p_id: null, p_canal: canalNovo.id, p_titulo: "Faixa do registro", p_artista: "", p_url: "https://exemplo.test/r.opus", p_duracao: 10, p_ordem: 0 });
  await rpc(coordenacao2, "radio_faixa_remover", { p_id: faixaNova.id });
  await rpc(coordenacao2, "radio_canal_remover", { p_id: canalNovo.id });
  await rpc({ papel: "anon", ip: "198.51.100.90" }, "denunciar", { p_alvo: "/pt/acervo/x", p_motivo: "Outro motivo", p_detalhes: "Denúncia para conferir o registro de atividades." });
  const denuncia = (await rpc(coordenacao2, "denuncias_listar")).find((d) => d.status === "aberta");
  await rpc(coordenacao2, "denuncia_resolver", { p_id: denuncia.id, p_nota: "Conferido." });
  const nota = await rpc(como(ids.revisor), "anotar", { p_caminho: "/trilhas/x/y", p_paragrafo: 0, p_trecho: "", p_corpo: "Anotação para o registro." });
  await rpc(coordenacao2, "anotacao_decidir", { p_id: nota.id, p_status: "oculta" });
  const anuncioRemovido = await rpc({ papel: "anon", ip: "198.51.100.91" }, "mural_enviar", { p: anuncio({ titulo: "Anúncio para remover" }) });
  await rpc(coordenacao2, "mural_remover", { p_id: anuncioRemovido.id });
  return dono("select array_agg(distinct acao) as acoes from interno.auditoria");
}, (r) => ["apoiador_salvo", "apoiador_removido", "radio_canal_salvo", "radio_canal_removido", "radio_faixa_salva", "radio_faixa_removida", "denuncia_resolvida", "anotacao_oculta", "anuncio_removido"].every((acao) => r.rows[0].acoes.includes(acao)));

// ── Candidatura aceita e conta criada com o e-mail de outra pessoa ──
// Com "Confirm email" ligado no serviço de contas, conta nova nasce sem email_confirmed_at. Quem cria uma conta com o
// e-mail de alguém que se candidatou não pode receber a função dessa pessoa quando a candidatura for aceita.
await espera("candidatura aceita não entrega a função a conta com e-mail não confirmado", async () => {
  await dono("alter table auth.users add column if not exists email_confirmed_at timestamptz");
  await dono("update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())");
  await rpc({ papel: "anon", ip: "198.51.100.95" }, "voluntariar", { p: { nome: "Pessoa Candidata", email: "candidata@exemplo.org", papel: "revisao", mensagem: "Quero revisar as aulas do instituto com cuidado." } });
  const invasor = await criarUsuario("candidata@exemplo.org", "Invasor");
  const inscricao = (await rpc({ ...como(ids.coord), aal: "aal2" }, "inscricoes_listar")).find((i) => i.email === "candidata@exemplo.org");
  let erro = "";
  try {
    await rpc({ ...como(ids.coord), aal: "aal2" }, "inscricao_decidir", { p_id: inscricao.id, p_aceitar: true });
  } catch (falha) {
    erro = falha.message;
  }
  return [erro, (await dono("select count(*)::int as n from interno.papeis where usuario = $1", [invasor])).rows[0].n];
}, ([erro, papeis]) => erro.includes("email_nao_confirmado") && papeis === 0);

// ── Cargos múltiplos: uma pessoa com vários papéis, a hierarquia de quem dá e tira, a supervisão e o histórico ──
nomes.super = "Sueli Supervisora";
nomes.poli = "Pedro Polivalente";
ids.super = await criarUsuario("super@teste.local", nomes.super);
ids.poli = await criarUsuario("poli@teste.local", nomes.poli);
for (const chave of ["super", "poli"]) {
  await rpc(como(ids[chave]), "eu");
  await rpc(como(ids[chave]), "perfil_salvar", { p_nome: nomes[chave], p_bio: "" });
}
const departamentosDe = async (quem) => (await rpc(como(ids[quem]), "chat_conversas")).filter((c) => c.tipo === "departamento").map((c) => c.departamento).sort();
await espera("pessoa sem papel nenhum: nível zero e nada do painel da equipe", async () => [await rpc(como(ids.poli), "eu"), await rpc(como(ids.poli), "fila").catch((e) => e.message)], ([eu, fila]) => eu.papeis.length === 0 && eu.nivel === 0 && fila.includes("sem_permissao"));
await espera("vice-coordenação também nomeia a supervisão", async () => { await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.super, p_papel: "supervisao", p_disciplina: null }); return rpc(como(ids.super), "eu"); }, (r) => r.papeis.some((p) => p.papel === "supervisao"));
await espera("coordenação nomeia a supervisão, que fica no nível 2", async () => { await rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.super, p_papel: "supervisao", p_disciplina: null }); return rpc(como(ids.super), "eu"); }, (r) => r.papeis.length === 1 && r.papeis[0].papel === "supervisao" && r.nivel === 2);
await espera("a supervisão está no grupo da equipe toda e nos departamentos", () => departamentosDe("super"), (r) => r.includes("geral") && r.includes("educacao"));
await espera("supervisão confia o primeiro papel a quem não tinha nenhum", async () => { await rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "revisao", p_disciplina: null }); return rpc(como(ids.poli), "eu"); }, (r) => r.papeis.length === 1 && r.papeis[0].papel === "revisao" && r.nivel === 1 && r.avisos === 1);
await espera("com um papel, a pessoa abre a fila, mas não o que é de outras funções", async () => [await rpc(como(ids.poli), "fila"), await rpc(como(ids.poli), "boletim_listar").catch((e) => e.message), await rpc(como(ids.poli), "reforco_fila").catch((e) => e.message)], (r) => Array.isArray(r[0]) && r[1].includes("sem_permissao") && r[2].includes("sem_permissao"));
await espera("a mesma pessoa acumula jornalismo e tradução: três papéis", async () => {
  await rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "jornalismo", p_disciplina: null });
  await rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "traducao", p_disciplina: null });
  return rpc(como(ids.poli), "eu");
}, (r) => r.papeis.map((p) => p.papel).sort().join() === "jornalismo,revisao,traducao" && r.nivel === 1);
await espera("o mesmo papel confiado duas vezes não duplica", async () => { await rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "revisao", p_disciplina: null }); return rpc(como(ids.poli), "eu"); }, (r) => r.papeis.length === 3);
await espera("as permissões são a soma dos papéis: fila (revisão), boletim e rádio (jornalismo), tradução no envio", async () => [
  await rpc(como(ids.poli), "fila"),
  await rpc(como(ids.poli), "boletim_listar"),
  await rpc(como(ids.poli), "radio_canal_salvar", { p_id: null, p_nome: "Canal da polivalente", p_descricao: "", p_ordem: 9 }),
  await rpc(como(ids.poli), "contribuir", { p: { tipo: "traducao", titulo: "Tradução de teste", corpo: "Texto traduzido com mais de vinte letras.", alvo: "/trilhas/x/y" } }),
  await rpc(como(ids.poli), "equipe_canais"),
], ([fila, boletim, canal, traducao, canais]) => Array.isArray(fila) && Array.isArray(boletim) && Boolean(canal.id) && Boolean(traducao.id) && ["revisao", "jornalismo", "traducao"].every((c) => canais.canais.includes(c)) && !canais.canais.includes("design"));
await espera("o envio da tradução é marcado como da tradução", async () => (await rpc(como(ids.poli), "contribuicoes_minhas"))[0], (r) => r.como === "traducao");
await espera("com vários papéis, a pessoa está em todos os grupos de departamento correspondentes", () => departamentosDe("poli"), (r) => JSON.stringify(r) === JSON.stringify(["geral", "jornalismo", "revisao", "traducao"]));
await espera("quem cria um grupo marcando uma função pega quem tem a função entre outras", () => rpc(como(ids.prof), "equipe_membros"), (r) => r.find((m) => m.id === ids.poli)?.papeis.length === 3);
await recusa("supervisão não confia curadoria", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "curadoria", p_disciplina: null }), "sem_permissao");
await recusa("supervisão não confia mediação", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "mediacao", p_disciplina: null }), "sem_permissao");
await recusa("supervisão não nomeia outra supervisão", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "supervisao", p_disciplina: null }), "sem_permissao");
await recusa("supervisão não nomeia vice-coordenação", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "vice", p_disciplina: null }), "sem_permissao");
await recusa("ninguém dá a coordenação por esse caminho", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.poli, p_papel: "coordenacao", p_disciplina: null }), "invalido:papel");
await recusa("supervisão não mexe nos cargos da vice-coordenação", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.vice, p_papel: "revisao", p_disciplina: null }), "sem_permissao");
await recusa("supervisão não mexe nos cargos da coordenação", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.coord, p_papel: "revisao", p_disciplina: null }), "sem_permissao");
await recusa("supervisão não tira papel de quem está acima", async () => rpc(como(ids.super), "papel_remover", { p_id: (await rpc(como(ids.vice), "eu")).papeis.find((p) => p.papel === "vice").id }), "sem_permissao");
await recusa("ninguém mexe nos próprios cargos: a supervisão", () => rpc(como(ids.super), "papel_conceder", { p_usuario: ids.super, p_papel: "revisao", p_disciplina: null }), "sem_permissao");
await recusa("ninguém mexe nos próprios cargos: a vice-coordenação", () => rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.vice, p_papel: "design", p_disciplina: null }), "sem_permissao");
await recusa("ninguém mexe nos próprios cargos: a coordenação", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.coord, p_papel: "design", p_disciplina: null }), "sem_permissao");
await espera("vice-coordenação confia papel de trabalho à supervisão, que está abaixo dela", async () => { await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.super, p_papel: "revisao", p_disciplina: null }); return rpc(como(ids.super), "eu"); }, (r) => r.papeis.length === 2 && r.nivel === 2);
await espera("vice-coordenação tira e devolve a supervisão de quem não é vice", async () => { await rpc(como(ids.vice), "papel_remover", { p_id: (await rpc(como(ids.super), "eu")).papeis.find((p) => p.papel === "supervisao").id }); const sem = (await rpc(como(ids.super), "eu")).papeis.some((p) => p.papel === "supervisao"); await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.super, p_papel: "supervisao", p_disciplina: null }); return [sem, (await rpc(como(ids.super), "eu")).papeis.some((p) => p.papel === "supervisao")]; }, (r) => r[0] === false && r[1] === true);
await recusa("vice-coordenação não mexe nos cargos de outra vice", async () => { const outra = await criarUsuario("vice2@teste.local", "Vilma Vice"); await rpc(como(outra), "eu"); await rpc(como(ids.coord), "papel_conceder", { p_usuario: outra, p_papel: "vice", p_disciplina: null }); ids.vice2 = outra; return rpc(como(ids.vice), "papel_conceder", { p_usuario: outra, p_papel: "revisao", p_disciplina: null }); }, "sem_permissao");
await espera("a coordenação mexe em todos: dá e tira papel de trabalho da vice", async () => { await rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.vice2, p_papel: "revisao", p_disciplina: null }); const papel = (await rpc(como(ids.vice2), "eu")).papeis.find((p) => p.papel === "revisao"); await rpc(como(ids.coord), "papel_remover", { p_id: papel.id }); return rpc(como(ids.vice2), "eu"); }, (r) => r.papeis.length === 1 && r.papeis[0].papel === "vice");
await espera("supervisão busca pessoas e lista voluntários, sem ver e-mail de ninguém", async () => [await rpc(como(ids.super), "pessoas_buscar", { p_busca: "polivalente" }), await rpc(como(ids.super), "pessoas_buscar", { p_busca: "poli@teste" }), await rpc(como(ids.super), "voluntarios_listar")],
  ([porNome, porEmail, todos]) => porNome.length === 1 && porNome[0].id === ids.poli && porNome[0].email === "" && porNome[0].nivel === 1 && porEmail.length === 0 && todos.length > 10 && todos.every((p) => p.email === "" && typeof p.nivel === "number") && !JSON.stringify(todos).includes("@"));
await espera("coordenação continua vendo o e-mail e o nível de cada pessoa", () => rpc(como(ids.coord), "voluntarios_listar"), (r) => r.find((p) => p.id === ids.poli).email === "poli@teste.local" && r.find((p) => p.id === ids.super).nivel === 2 && r.find((p) => p.id === ids.coord).nivel === 4);
await recusa("supervisão não decide candidaturas (têm e-mail)", () => rpc(como(ids.super), "candidaturas_listar"), "sem_permissao");
await recusa("supervisão não cria convite", () => rpc(como(ids.super), "convite_criar", { p: { email: "x@teste.local", papel: "revisao" } }), "sem_permissao");
await recusa("quem não gere cargos não vê o histórico", () => rpc(como(ids.curadora), "papeis_historico_listar", { p_usuario: ids.poli }), "sem_permissao");
await recusa("nem a supervisão (o histórico é da coordenação)", () => rpc(como(ids.super), "papeis_historico_listar", { p_usuario: ids.poli }), "sem_permissao");
await espera("supervisão retira um papel, e o histórico guarda quem confiou e quem tirou", async () => {
  const traducao = (await rpc(como(ids.poli), "eu")).papeis.find((p) => p.papel === "traducao");
  await rpc(como(ids.super), "papel_remover", { p_id: traducao.id });
  return [await rpc(como(ids.poli), "eu"), await rpc(como(ids.coord), "papeis_historico_listar", { p_usuario: ids.poli })];
}, ([eu, historico]) => eu.papeis.length === 2 && historico.length === 3
  && historico.find((h) => h.papel === "traducao").removido_por === nomes.super && typeof historico.find((h) => h.papel === "traducao").removido_em === "string"
  && historico.filter((h) => h.papel !== "traducao").every((h) => h.removido_em === null && h.concedido_por === nomes.super && h.via === "authenticated"));
await espera("perder o papel tira a pessoa do grupo daquele departamento e troca a chave dele", async () => {
  const minima = (await dono("select versao_minima from interno.conversas where tipo = 'departamento' and departamento = 'traducao'")).rows[0].versao_minima;
  return [await departamentosDe("poli"), minima];
}, ([deps, minima]) => JSON.stringify(deps) === JSON.stringify(["geral", "jornalismo", "revisao"]) && minima >= 1);
await espera("a sucessão automática entra no histórico como obra do sistema, não de quem abriu o painel", async () => {
  const antes = (await dono("select count(*)::int as n from interno.papeis_historico where via = 'sistema'")).rows[0].n;
  await rpc(como(ids.coord), "sucessao_definir", { p_usuarios: [ids.vice] });
  await dono("update interno.perfis set visto_em = now() - interval '91 days' where id = $1", [ids.coord]);
  await rpc(como(ids.prof), "eu");
  const total = (await dono("select count(*)::int as n from interno.papeis_historico where via = 'sistema'")).rows[0].n;
  const depois = (await dono("select via, removido_por, concedido_por from interno.papeis_historico order by id desc limit 2")).rows;
  await rpc(como(ids.vice), "lideranca_passar", { p_usuario: ids.coord });
  await dono("update interno.perfis set visto_em = now() where id = $1", [ids.coord]);
  return [total - antes, depois];
}, ([novas, depois]) => novas === 2 && depois.length === 2 && depois.every((h) => h.via === "sistema" && h.removido_por === null && h.concedido_por === null));
await espera("papéis dados antes do histórico existir entram nele na instalação, uma vez só", async () => {
  await dono("alter table interno.papeis disable trigger lucia_papeis_historico");
  await dono("insert into interno.papeis (usuario, papel) values ($1, 'desenvolvimento')", [ids.poli]);
  await dono("alter table interno.papeis enable trigger lucia_papeis_historico");
  const semHistorico = (await dono("select count(*)::int as n from interno.papeis p where not exists (select 1 from interno.papeis_historico h where h.papel_id = p.id)")).rows[0].n;
  await banco.instalarDeNovo();
  await banco.instalarDeNovo();
  const migrados = (await dono("select count(*)::int as n from interno.papeis_historico where via = 'migracao' and usuario = $1", [ids.poli])).rows[0].n;
  const abertos = (await dono("select count(*)::int as n from interno.papeis_historico where usuario = $1 and removido_em is null", [ids.poli])).rows[0].n;
  return [semHistorico, migrados, abertos, (await rpc(como(ids.poli), "eu")).papeis.length];
}, (r) => r[0] === 1 && r[1] === 1 && r[2] === 3 && r[3] === 3);
await espera("instalar de novo não perde nenhum papel de ninguém", async () => {
  const antes = (await dono("select count(*)::int as n from interno.papeis")).rows[0].n;
  await banco.instalarDeNovo();
  return [antes, (await dono("select count(*)::int as n from interno.papeis")).rows[0].n];
}, (r) => r[0] === r[1] && r[0] > 10);
await recusa("ninguém edita o histórico pela API", () => banco.exclusivo(async () => { await banco.pg.exec("set role authenticated"); try { return await banco.pg.query("select * from interno.papeis_historico"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");
await espera("com a exigência de segundo fator ligada, a supervisão só gere cargos depois do código", async () => {
  await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: true });
  try {
    return [await rpc(como(ids.super), "voluntarios_listar").then(() => "passou", (e) => e.message), await rpc({ ...como(ids.super), aal: "aal2" }, "voluntarios_listar").then(() => "passou", (e) => e.message), (await rpc(como(ids.super), "eu")).exige_segundo_fator];
  } finally {
    await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: false });
  }
}, (r) => r[0].includes("sem_permissao") && r[1] === "passou" && r[2] === true);
await espera("a equipe pública mostra todos os papéis de quem tem vários, sem e-mail", () => rpc(anon, "equipe"), (r) => r.filter((m) => m.nome === nomes.poli).length === 3 && !JSON.stringify(r).includes("@"));
// ── Aulas em vídeo ──
const videoaula = (extra = {}) => ({
  disciplina: "matematica",
  titulo: "Frações em dez minutos",
  descricao: "Uma explicação curta, com exemplos do dia a dia.",
  caminho: `${ids.prof}/${crypto.randomUUID()}.webm`,
  tipo: "video/webm",
  duracao: "540",
  largura: "854",
  altura: "480",
  tamanho: "41000000",
  fontes: fonte,
  ...extra,
});
const curadoria2 = como(ids.revisor);
let video;
await recusa("quem não ensina não envia aula em vídeo", () => rpc(como(ids.leitora), "videoaula_enviar", { p: videoaula({ caminho: `${ids.leitora}/${crypto.randomUUID()}.webm` }) }), "sem_permissao");
await recusa("educador não envia para a pasta de outra pessoa", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ caminho: `${ids.leitora}/${crypto.randomUUID()}.webm` }) }), "invalido:caminho");
await recusa("mais de dez minutos é recusado", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ duracao: "601" }) }), "invalido:duracao");
await recusa("1080p é recusado", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ largura: "1920", altura: "1080" }) }), "invalido:resolucao");
await espera("vídeo em pé de 480 por 854 é aceito como 480p", async () => (await rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ largura: "480", altura: "854" }) })).id, (r) => Boolean(r));
await recusa("arquivo acima de 50 MB é recusado", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ tamanho: "60000000" }) }), "invalido:tamanho");
await recusa("aula em vídeo sem fonte é recusada", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ fontes: [] }) }), "falta_fonte");
await recusa("legenda que não é WebVTT é recusada", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ legenda: "1\n00:00:01,000 --> 00:00:02,000\nOi" }) }), "invalido:legenda");
await recusa("educador de matemática não envia aula de física", () => rpc(como(ids.prof), "videoaula_enviar", { p: videoaula({ disciplina: "fisica" }) }), "sem_permissao");
await espera("educador envia a aula em vídeo da própria disciplina", async () => (video = videoaula()) && rpc(como(ids.prof), "videoaula_enviar", { p: video }), (r) => Boolean(r.id) && (video.id = r.id));
await espera("ela fica fora da lista pública enquanto espera", () => rpc(anon, "videoaulas_publicas"), (r) => !r.some((x) => x.id === video.id));
await espera("o visitante ainda não lê o arquivo", () => rpc(anon, "videoaula_pode_ler", { p_nome: video.caminho }), (r) => r === false);
await espera("quem enviou e a revisão leem o arquivo pendente", async () => [await rpc(como(ids.prof), "videoaula_pode_ler", { p_nome: video.caminho }), await rpc(curadoria2, "videoaula_pode_ler", { p_nome: video.caminho })], (r) => r[0] === true && r[1] === true);
await espera("a revisão vê a aula na fila, com a transcrição", () => rpc(curadoria2, "videoaulas_fila"), (r) => r.some((x) => x.id === video.id && "transcricao" in x));
await recusa("educador não decide a própria aula", () => rpc(como(ids.prof), "videoaula_decidir", { p_id: video.id, p_aprovar: true }), "sem_permissao");
await recusa("recusar exige nota", () => rpc(curadoria2, "videoaula_decidir", { p_id: video.id, p_aprovar: false, p_nota: "" }), "invalido:nota");
await espera("a revisão aprova", () => rpc(curadoria2, "videoaula_decidir", { p_id: video.id, p_aprovar: true }), (r) => r.ok === true);
await espera("aprovada, entra na lista pública da disciplina e o visitante lê o arquivo", async () => [await rpc(anon, "videoaulas_publicas", { p_disciplina: "matematica" }), await rpc(anon, "videoaula_pode_ler", { p_nome: video.caminho })], (r) => r[0].some((x) => x.id === video.id && !("nota" in x)) && r[1] === true);
await espera("o visitante abre a aula com a transcrição", () => rpc(anon, "videoaula_ver", { p_id: video.id }), (r) => r.id === video.id && "transcricao" in r);
await recusa("quem enviou não apaga a aula que está no ar", () => rpc(como(ids.prof), "videoaula_apagar", { p_id: video.id }), "sem_permissao");
await espera("a coordenação apaga e recebe o caminho do arquivo", () => rpc({ ...como(ids.coord), aal: "aal2" }, "videoaula_apagar", { p_id: video.id }), (r) => r.caminho === video.caminho);
await espera("apagado o registro, quem enviou e a coordenação ainda leem o arquivo (para tirá-lo do depósito)", async () => [await rpc(como(ids.prof), "videoaula_pode_ler", { p_nome: video.caminho }), await rpc({ ...como(ids.coord), aal: "aal2" }, "videoaula_pode_ler", { p_nome: video.caminho })], (r) => r[0] === true && r[1] === true);
await espera("o arquivo sem registro não fica aberto ao visitante nem a outra conta", async () => [await rpc(anon, "videoaula_pode_ler", { p_nome: video.caminho }), await rpc(como(ids.leitora), "videoaula_pode_ler", { p_nome: video.caminho })], (r) => r[0] === false && r[1] === false);

// ── Avisos à equipe (o quadro por cima do painel) ──
const coord2 = { ...como(ids.coord), aal: "aal2" };
// Uma estudante nova, sem função: a conta da aluna foi apagada mais acima.
ids.aluna = await criarUsuario("estudante-nova@teste.local", "Ana Aluna");
await rpc(como(ids.aluna), "eu");
let avisoGeral;
let avisoDesign;
await recusa("quem não lidera não manda aviso à equipe", () => rpc(como(ids.prof), "aviso_geral_enviar", { p: { titulo: "Reunião", texto: "Sábado às 10h." } }), "sem_permissao");
await recusa("destino desconhecido é recusado", () => rpc(coord2, "aviso_geral_enviar", { p: { titulo: "Reunião", texto: "Sábado às 10h.", para: ["chefia"] } }), "invalido:para");
await espera("coordenação manda aviso para a equipe toda", () => rpc(coord2, "aviso_geral_enviar", { p: { titulo: "Reunião geral", texto: "Sábado às 10h, na sala da equipe." } }), (r) => Boolean(r.id) && (avisoGeral = r.id));
await espera("educador vê o aviso pendente", () => rpc(como(ids.prof), "avisos_gerais_pendentes"), (r) => r.some((a) => a.id === avisoGeral));
await espera("quem não tem função não recebe aviso da equipe", () => rpc(como(ids.aluna), "avisos_gerais_pendentes"), (r) => r.length === 0);
await espera("fechar o aviso tira-o da lista", async () => { await rpc(como(ids.prof), "aviso_geral_fechar", { p_id: avisoGeral }); return rpc(como(ids.prof), "avisos_gerais_pendentes"); }, (r) => !r.some((a) => a.id === avisoGeral));
await espera("aviso só para o design", () => rpc(coord2, "aviso_geral_enviar", { p: { titulo: "Capas", texto: "Precisamos de três capas até sexta.", para: ["design"], importante: true } }), (r) => Boolean(r.id) && (avisoDesign = r.id));
await espera("educador não vê o aviso do design", () => rpc(como(ids.prof), "avisos_gerais_pendentes"), (r) => !r.some((a) => a.id === avisoDesign));
await espera("designer vê o aviso do design, marcado como importante", () => rpc(como(ids.designer), "avisos_gerais_pendentes"), (r) => r.some((a) => a.id === avisoDesign && a.importante));
await espera("a lista de quem manda mostra quantos já fecharam", () => rpc(coord2, "avisos_gerais_listar"), (r) => r.some((a) => a.id === avisoGeral && a.vistos === 1));
await recusa("educador não lista os avisos enviados", () => rpc(como(ids.prof), "avisos_gerais_listar"), "sem_permissao");
await recusa("designer não apaga aviso", () => rpc(como(ids.designer), "aviso_geral_apagar", { p_id: avisoDesign }), "sem_permissao");
await espera("a supervisão do podcast também manda aviso", async () => { await rpc(coord2, "podcast_funcoes_definir", { p_usuario: ids.revisor, p_funcoes: ["supervisao"] }); return rpc(como(ids.revisor), "aviso_geral_enviar", { p: { titulo: "Podcast", texto: "Gravação na quinta.", para: ["podcast"] } }); }, (r) => Boolean(r.id));
await espera("quem faz o podcast recebe o aviso do podcast", () => rpc(como(ids.revisor), "avisos_gerais_pendentes"), (r) => r.some((a) => a.titulo === "Podcast"));
await espera("a coordenação apaga o aviso", () => rpc(coord2, "aviso_geral_apagar", { p_id: avisoDesign }), (r) => r.ok === true);
await espera("o painel diz quem pode mandar avisos", async () => [await rpc(coord2, "eu"), await rpc(como(ids.prof), "eu")], (r) => r[0].supervisao === true && r[1].supervisao === false);

// ── Rascunhos que não se perdem ──
await recusa("chave de rascunho inválida", () => rpc(como(ids.prof), "rascunho_salvar", { p_chave: "Escrever Aula", p_dados: { titulo: "x" } }), "invalido:chave");
await espera("educador guarda um rascunho", () => rpc(como(ids.prof), "rascunho_salvar", { p_chave: "escrever:aula", p_dados: { titulo: "Frações", corpo: "Começo da aula…" } }), (r) => Boolean(r.atualizado_em));
await espera("e lê de volta", () => rpc(como(ids.prof), "rascunho_ver", { p_chave: "escrever:aula" }), (r) => r.dados.titulo === "Frações");
await espera("quem só participa da comunidade também guarda rascunho", () => rpc(como(ids.aluna), "rascunho_salvar", { p_chave: "escrever:sugestao", p_dados: { titulo: "Ideia" } }), (r) => Boolean(r.atualizado_em));
await espera("o rascunho de um não aparece para outro", () => rpc(como(ids.aluna), "rascunho_ver", { p_chave: "escrever:aula" }), (r) => r === null);
await espera("a lista traz só o título e a data", () => rpc(como(ids.prof), "rascunhos_listar"), (r) => r.some((x) => x.chave === "escrever:aula" && x.titulo === "Frações" && !("dados" in x)));
await espera("apagar o rascunho", async () => { await rpc(como(ids.prof), "rascunho_apagar", { p_chave: "escrever:aula" }); return rpc(como(ids.prof), "rascunho_ver", { p_chave: "escrever:aula" }); }, (r) => r === null);

// ── Aulas ao vivo: agenda, inscrição, sala e bate-papo ──
const emUmaHora = new Date(Date.now() + 3600_000).toISOString();
const aulaNova = (extra = {}) => ({ titulo: "Frações ao vivo", descricao: "Tira-dúvidas sobre frações.", disciplina: "matematica", trilha: "matematica-fundamental", inicio: emUmaHora, duracao: 60, co_educadores: [ids.mentora], ...extra });
let aulaViva;
let fala;
await recusa("quem não ensina não marca aula ao vivo", () => rpc(como(ids.aluna), "aula_ao_vivo_salvar", { p_id: null, p: aulaNova() }), "sem_permissao");
await recusa("co-educador precisa ensinar", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: null, p: aulaNova({ co_educadores: [ids.aluna] }) }), "invalido:co_educadores");
await recusa("data inválida é recusada", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: null, p: aulaNova({ inicio: "amanhã" }) }), "invalido:inicio");
await espera("educador marca a aula e chama a mentora", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: null, p: aulaNova() }), (r) => r.id && r.status === "agendada" && r.co_educadores.some((c) => c.id === ids.mentora) && (aulaViva = r.id));
await espera("a mentora recebe o recado do chamado", () => rpc(como(ids.mentora), "avisos_meus"), (r) => r.some((a) => a.texto.includes("Frações ao vivo")));
await espera("a agenda pública mostra a aula, com quem dá", () => rpc(anon, "aulas_ao_vivo_listar"), (r) => r.some((a) => a.id === aulaViva && a.educador.nome));
await espera("a mentora conduz a aula junto", () => rpc(como(ids.mentora), "aula_ao_vivo_ver", { p_id: aulaViva }), (r) => r.conduzo === true);
await espera("a aluna se inscreve", () => rpc(como(ids.aluna), "aula_ao_vivo_inscrever", { p_id: aulaViva }), (r) => r.inscritos === 1);
await recusa("o bate-papo só abre perto da hora", () => rpc(como(ids.aluna), "aula_chat_enviar", { p_aula: aulaViva, p_corpo: "Oi!" }), "topico_trancado");
await recusa("quem não conduz não começa a aula", () => rpc(como(ids.aluna), "aula_ao_vivo_estado", { p_id: aulaViva, p_status: "ao_vivo" }), "sem_permissao");
await espera("o educador começa a aula", () => rpc(como(ids.prof), "aula_ao_vivo_estado", { p_id: aulaViva, p_status: "ao_vivo" }), (r) => r.status === "ao_vivo");
await espera("quem se inscreveu é avisado", () => rpc(como(ids.aluna), "avisos_meus"), (r) => r.some((a) => a.texto.includes("começou agora")));
await espera("a aluna pergunta no bate-papo", () => rpc(como(ids.aluna), "aula_chat_enviar", { p_aula: aulaViva, p_corpo: "Não entendi a divisão de frações.", p_tipo: "pergunta" }), (r) => r.id && r.tipo === "pergunta" && (fala = r.id));
await recusa("palavra vetada não entra no bate-papo", () => rpc(como(ids.aluna), "aula_chat_enviar", { p_aula: aulaViva, p_corpo: "palavrão novo aqui" }), "conteudo_recusado");
await recusa("sem conta não se fala", () => rpc(anon, "aula_chat_enviar", { p_aula: aulaViva, p_corpo: "Oi" }), "entre_primeiro");
await espera("qualquer visitante lê o bate-papo, com a fala do sistema", () => rpc(anon, "aula_chat_listar", { p_aula: aulaViva }), (r) => r.some((m) => m.id === fala) && r.some((m) => m.tipo === "sistema"));
await recusa("quem não conduz nem media não esconde a fala dos outros", () => rpc(como(ids.jornal), "aula_chat_moderar", { p_id: fala, p_ocultar: true }), "sem_permissao");
await espera("o educador esconde a fala e o visitante deixa de ver", async () => { await rpc(como(ids.prof), "aula_chat_moderar", { p_id: fala, p_ocultar: true }); return rpc(anon, "aula_chat_listar", { p_aula: aulaViva }); }, (r) => !r.some((m) => m.id === fala));
await espera("quem conduz ainda vê a fala escondida", () => rpc(como(ids.mentora), "aula_chat_listar", { p_aula: aulaViva }), (r) => r.some((m) => m.id === fala && m.oculta));
await recusa("a aluna não apaga a aula", () => rpc(como(ids.aluna), "aula_ao_vivo_apagar", { p_id: aulaViva }), "sem_permissao");
await espera("o educador encerra a aula", () => rpc(como(ids.prof), "aula_ao_vivo_estado", { p_id: aulaViva, p_status: "encerrada" }), (r) => r.status === "encerrada");
await recusa("encerrada, o bate-papo fecha", () => rpc(como(ids.aluna), "aula_chat_enviar", { p_aula: aulaViva, p_corpo: "Ainda dá?" }), "topico_trancado");
await recusa("aula encerrada não se edita", () => rpc(como(ids.prof), "aula_ao_vivo_salvar", { p_id: aulaViva, p: aulaNova() }), "ja_decidida");
await espera("sem gravação, a aula encerrada sai da agenda pública", () => rpc(anon, "aulas_ao_vivo_listar"), (r) => !r.some((a) => a.id === aulaViva));
await espera("o educador vê a aula entre as dele", () => rpc(como(ids.prof), "aulas_ao_vivo_minhas"), (r) => r.some((a) => a.id === aulaViva));
await espera("a coordenação apaga a aula", () => rpc(coord2, "aula_ao_vivo_apagar", { p_id: aulaViva }), (r) => r.ok === true);

// ── Estúdio de design ──
const design = { titulo: "Post de lançamento", formato: "post", largura: 1080, altura: 1350, dados: { camadas: [{ tipo: "texto", texto: "Estamos no ar" }] } };
let desenho;
await recusa("quem não é do design nem do marketing não usa o estúdio", () => rpc(como(ids.prof), "design_salvar", { p_id: null, p: design }), "sem_permissao");
await espera("a designer guarda um trabalho", () => rpc(como(ids.designer), "design_salvar", { p_id: null, p: design }), (r) => r.id && r.meu === true && (desenho = r.id));
await recusa("prévia que não é imagem é recusada", () => rpc(como(ids.designer), "design_salvar", { p_id: desenho, p: { ...design, miniatura: "javascript:alert(1)" } }), "invalido:miniatura");
await espera("o marketing vê o trabalho compartilhado, sem o desenho", () => rpc(como(ids.divulga), "designs_listar"), (r) => r.some((d) => d.id === desenho && d.dados === null));
await espera("e abre o desenho inteiro", () => rpc(como(ids.divulga), "design_ver", { p_id: desenho }), (r) => r.dados.camadas.length === 1);
await espera("o marketing edita o trabalho compartilhado", () => rpc(como(ids.divulga), "design_salvar", { p_id: desenho, p: { ...design, titulo: "Post de lançamento (v2)" } }), (r) => r.titulo === "Post de lançamento (v2)");
await recusa("quem não fez não apaga", () => rpc(como(ids.divulga), "design_apagar", { p_id: desenho }), "sem_permissao");
await recusa("educador não lista os trabalhos", () => rpc(como(ids.prof), "designs_listar"), "sem_permissao");
await espera("a designer apaga o trabalho", () => rpc(como(ids.designer), "design_apagar", { p_id: desenho }), (r) => r.ok === true);

// ── Prática lúdica de idioma (vai pela fila, como toda contribuição) ──
const pratica = { tipo: "pratica", titulo: "Prática: alfabeto e sons", corpo: "Exercícios da aula de alfabeto.", disciplina: "ingles", alvo: "ingles-do-zero/alfabeto-e-sons", dados: { exercicios: [{ tipo: "escolha", pergunta: "Como se diz A?", opcoes: ["ei", "a"], resposta: 0 }] } };
await recusa("prática de idioma sem conta é recusada", () => rpc(anon, "contribuir", { p: pratica }), "entre_primeiro");
await recusa("exercício de tipo desconhecido é recusado", () => rpc(como(ids.prof), "contribuir", { p: { ...pratica, dados: { exercicios: [{ tipo: "palavras-cruzadas" }] } } }), "invalido:exercicios");
await recusa("prática precisa apontar a aula", () => rpc(como(ids.prof), "contribuir", { p: { ...pratica, alvo: "/trilhas/x" } }), "invalido:alvo");
await espera("educador envia a prática da aula", () => rpc(como(ids.prof), "contribuir", { p: pratica }), (r) => Boolean(r.id));

// ── Reuniões da equipe (Jitsi dentro do painel; a liderança marca, qualquer voluntário propõe) ──
const daqui = (h) => new Date(Date.now() + h * 3600e3).toISOString();
await recusa("voluntário não cria reunião", () => rpc(como(ids.prof), "reuniao_salvar", { p_id: null, p: { titulo: "Reunião geral", inicio: daqui(1) } }), "sem_permissao");
let reuniao;
await espera("a coordenação marca uma reunião aberta com sala sorteada", async () => { reuniao = await rpc(como(ids.coord), "reuniao_salvar", { p_id: null, p: { titulo: "Reunião geral", pauta: "Pauta", inicio: daqui(1), duracao: 60, tipo: "aberta" } }); return reuniao; }, (r) => /^InstitutoLucia-[0-9a-f]{32}$/.test(r.sala) && r.conduzo === true);
await espera("quem é da equipe vê a reunião aberta e a sala", () => rpc(como(ids.prof), "reunioes_listar"), (r) => r.some((x) => x.id === reuniao.id && x.sala && x.posso_entrar && !x.conduzo));
await espera("reunião só da coordenação não aparece para o voluntário", async () => { const r = await rpc(como(ids.coord), "reuniao_salvar", { p_id: null, p: { titulo: "Só coordenação", inicio: daqui(2), tipo: "coordenacao" } }); return (await rpc(como(ids.prof), "reunioes_listar")).find((x) => x.id === r.id); }, (x) => x === undefined);
await espera("voluntário propõe uma reunião", () => rpc(como(ids.prof), "reuniao_propor", { p: { titulo: "Reunião da disciplina", assunto: "Planejar", inicio: daqui(24), duracao: 45 } }), (r) => Boolean(r.id));
await recusa("voluntário não decide proposta", async () => { const p = (await rpc(como(ids.prof), "reunioes_propostas"))[0]; return rpc(como(ids.prof), "reuniao_proposta_decidir", { p_id: p.id, p_status: "aprovada" }); }, "sem_permissao");
await espera("a coordenação aprova e a proposta vira reunião de convidados com o autor dentro", async () => { const p = (await rpc(como(ids.coord), "reunioes_propostas")).find((x) => x.status === "pendente"); const r = await rpc(como(ids.coord), "reuniao_proposta_decidir", { p_id: p.id, p_status: "aprovada" }); return (await rpc(como(ids.prof), "reunioes_listar")).find((x) => x.id === r.reuniao); }, (x) => Boolean(x && x.tipo === "convidados" && x.posso_entrar && x.sala));
await espera("entrar registra presença; encerrar fecha a sala e a presença", async () => { await rpc(como(ids.prof), "reuniao_presenca", { p_id: reuniao.id, p_entrou: true }); await rpc(como(ids.coord), "reuniao_estado", { p_id: reuniao.id, p_status: "ao_vivo" }); await rpc(como(ids.coord), "reuniao_estado", { p_id: reuniao.id, p_status: "encerrada" }); return (await rpc(como(ids.coord), "reunioes_listar")).find((x) => x.id === reuniao.id); }, (x) => x.status === "encerrada" && x.presentes === 1 && x.sala === null && x.presencas.length === 1 && Boolean(x.presencas[0].saiu_em));
await espera("a ata fica no histórico", () => rpc(como(ids.coord), "reuniao_ata", { p_id: reuniao.id, p_ata: "Decidimos X." }), (r) => r.ata === "Decidimos X.");

// ── Currículo pelo painel: a coordenação cria (nasce aprovada), o voluntário sugere, a rotina aplica e marca ──
await recusa("quem é de fora não propõe currículo", () => rpc(anon, "curriculo_propor", { p_tipo: "trilha", p_dados: { slug: "x-y", titulo: "X" } }), "entre_primeiro");
await recusa("slug inválido é recusado", () => rpc(como(ids.prof), "curriculo_propor", { p_tipo: "trilha", p_dados: { slug: "Com Espaço", titulo: "Trilha" } }), "invalido:slug");
await espera("voluntário sugere uma trilha e ela fica pendente", () => rpc(como(ids.prof), "curriculo_propor", { p_tipo: "trilha", p_dados: { slug: "fracoes-na-feira", disciplina: "matematica", titulo: "Frações na feira", etapa: "fundamental", aulas: ["O que é fração", "Metade e dobro"] } }), (r) => r.status === "pendente" && r.minha === true);
await espera("a coordenação cria uma disciplina direto, já aprovada", () => rpc(como(ids.coord), "curriculo_propor", { p_tipo: "disciplina", p_dados: { slug: "cooperativismo", grupo: "lutas", etapas: ["medio"], nomes: { pt: "Cooperativismo" }, descricoes: { pt: "Como se organiza uma cooperativa." } } }), (r) => r.status === "aprovada");
await recusa("educador não decide proposta", async () => { const p = (await rpc(como(ids.prof), "curriculo_listar")).find((x) => x.status === "pendente"); return rpc(como(ids.prof), "curriculo_decidir", { p_id: p.id, p_aprovar: true }); }, "sem_permissao");
await espera("a coordenação pedagógica aprova a sugestão", async () => { const p = (await rpc(como(ids.vice), "curriculo_listar")).find((x) => x.status === "pendente"); return rpc(como(ids.vice), "curriculo_decidir", { p_id: p.id, p_aprovar: true }); }, (r) => r.status === "aprovada");
await recusa("só o serviço lê as aprovadas", () => rpc(como(ids.coord), "curriculo_aprovadas"), "sem_permissao");
await espera("o serviço lê as aprovadas e marca uma aplicada e uma com falha", async () => { const lista = await rpc({ papel: "service_role" }, "curriculo_aprovadas"); await rpc({ papel: "service_role" }, "curriculo_marcar", { p_ids: [lista[0].id], p_falhas: { [lista[1].id]: "a disciplina já existe" } }); return rpc(como(ids.coord), "curriculo_listar"); }, (r) => r.some((x) => x.status === "aplicada") && r.some((x) => x.status === "falhou" && x.nota === "a disciplina já existe"));

// ── Minha conta: códigos de recuperação, meus dados, atividade, avisos por e-mail, sessões ──
await dono("create table if not exists auth.mfa_factors (user_id uuid, status text, created_at timestamptz default now())");
await dono("delete from auth.mfa_factors");
await dono("insert into auth.mfa_factors values ($1, 'verified', now())", [ids.revisor]);
await recusa("sem aplicativo cadastrado, não há códigos de recuperação", () => rpc({ ...como(ids.designer), aal: "aal2" }, "conta_codigos_gerar"), "sem_segundo_fator");
await recusa("com aplicativo e só a senha, não gera códigos", () => rpc(como(ids.revisor), "conta_codigos_gerar"), "confirme_segundo_fator");
const codigos = (await rpc({ ...como(ids.revisor), aal: "aal2" }, "conta_codigos_gerar")).codigos;
await espera("gera dez códigos no formato XXXXX-XXXXX", async () => codigos, (r) => r.length === 10 && r.every((c) => /^[0-9A-F]{5}-[0-9A-F]{5}$/.test(c)));
await espera("o banco guarda só o resumo", () => dono("select count(*)::int as n from interno.codigos_recuperacao where hash = any($1)", [codigos]), (r) => r.rows[0].n === 0);
await espera("a proteção mostra dez restantes", () => rpc(como(ids.revisor), "conta_protecao"), (r) => r.segundo_fator === true && Number(r.codigos_restantes) === 10);
await espera("código errado não vale (e fica no registro)", () => rpc(como(ids.revisor), "conta_codigo_usar", { p_codigo: "00000-00000" }), (r) => r.ok === false && r.motivo === "codigo_invalido");
await espera("código certo (com minúsculas e sem traço) tira o aplicativo", () => rpc(como(ids.revisor), "conta_codigo_usar", { p_codigo: codigos[0].replace("-", "").toLowerCase() }), (r) => r.ok === true && Number(r.restantes) === 9);
await espera("o aplicativo saiu da conta", () => dono("select count(*)::int as n from auth.mfa_factors where user_id = $1", [ids.revisor]), (r) => r.rows[0].n === 0);
await espera("o mesmo código não vale duas vezes", () => rpc(como(ids.revisor), "conta_codigo_usar", { p_codigo: codigos[0] }), (r) => r.ok === false);
await espera("a coordenação é avisada", () => dono("select count(*)::int as n from interno.avisos where texto like '%código de recuperação%'"), (r) => r.rows[0].n >= 2);
await espera("outra pessoa não usa o código de ninguém", () => rpc(como(ids.designer), "conta_codigo_usar", { p_codigo: codigos[1] }), (r) => r.ok === false);
await recusa("a sexta tentativa na mesma hora para", async () => { for (let i = 0; i < 6; i++) await rpc(como(ids.designer), "conta_codigo_usar", { p_codigo: "11111-11111" }); }, "muitos_pedidos");
await espera("as tentativas erradas aparecem na atividade", () => rpc(como(ids.designer), "conta_atividade"), (r) => r.filter((e) => e.acao === "codigo_recuperacao_errado").length >= 5);
await dono("drop table auth.mfa_factors");
await recusa("evento fora da lista não entra no registro", () => rpc(como(ids.prof), "conta_evento", { p_acao: "papel_concedido" }), "invalido:acao");
await espera("troca de senha entra na atividade", async () => { await rpc(como(ids.prof), "conta_evento", { p_acao: "senha_trocada" }); return rpc(como(ids.prof), "conta_atividade"); }, (r) => r.some((e) => e.acao === "senha_trocada"));
await espera("a atividade de uma pessoa não mostra a de outra", () => rpc(como(ids.designer), "conta_atividade"), (r) => !r.some((e) => e.acao === "senha_trocada"));
await espera("meus dados traz o perfil e o e-mail, sem o resumo dos códigos", () => rpc(como(ids.revisor), "conta_meus_dados"), (r) => r.perfil && r.conta.email && !Object.keys(r).some((k) => k.startsWith("codigos_recuperacao")) && !("limites.chave" in r));
await recusa("anônimo não baixa dados", () => rpc(anon, "conta_meus_dados"), "entre_primeiro");
await espera("desliga o aviso da equipe por e-mail (e ignora o que não é opcional)", () => rpc(como(ids.prof), "conta_emails_salvar", { p_desligados: ["aviso_equipe", "convite"] }), (r) => JSON.stringify(r.desligados) === JSON.stringify(["aviso_equipe"]));
await espera("o e-mail desligado não entra na fila", async () => {
  const email = (await dono("select email from auth.users where id = $1", [ids.prof])).rows[0].email;
  const r = await dono("select interno.email($1, 'aviso_equipe', 'Teste', 'x') as entrou, interno.email($1, 'convite', 'Teste', 'x') as convite", [email]);
  return r.rows[0];
}, (r) => r.entrou === false && r.convite === true);
await recusa("só a coordenação muda o prazo das sessões", () => rpc({ ...como(ids.curadora), aal: "aal2" }, "seguranca_sessoes", { p_dias: 30 }), "sem_permissao");
await recusa("prazo fora do intervalo é recusado", () => rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_sessoes", { p_dias: 2 }), "invalido:dias");
await espera("a coordenação muda o prazo e aparelhos parados saem", async () => {
  await rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_sessoes", { p_dias: 30 });
  await dono("insert into interno.aparelhos (usuario, marca, rotulo, primeiro, ultimo) values ($1, repeat('d0', 32), 'Velho', now() - interval '90 days', now() - interval '90 days')", [ids.prof]);
  await dono("insert into interno.aparelhos (usuario, marca, rotulo) values ($1, repeat('d1', 32), 'Novo')", [ids.prof]);
  await dono("select interno.vencer_sessoes()");
  return dono("select marca from interno.aparelhos where marca in (repeat('d0', 32), repeat('d1', 32))");
}, (r) => r.rows.length === 1 && r.rows[0].marca.startsWith("d1"));
await espera("qualquer pessoa da equipe sobe foto própria", () => rpc(como(ids.prof), "perfil_avatar", { p_avatar: "data:image/webp;base64,UklGRg==" }), (r) => r.ok === true);

// ── Boletim: edições por blocos, teste para mim, envio com histórico e pausa de endereço com falhas ──
await recusa("quem não é do jornal não escreve edição", () => rpc(como(ids.designer), "boletim_edicao_salvar", { p_id: null, p_assunto: "x", p_preheader: "", p_blocos: [], p_texto: "" }), "sem_permissao");
await recusa("imagem de fora não entra (rastreio)", () => rpc(como(ids.jornal), "boletim_edicao_salvar", { p_id: null, p_assunto: "Edição", p_preheader: "", p_blocos: [{ tipo: "imagem", src: "https://rastreio.exemplo/pixel.gif", alt: "x" }], p_texto: "" }), "invalido:imagem");
await recusa("imagem sem descrição não entra", () => rpc(como(ids.jornal), "boletim_edicao_salvar", { p_id: null, p_assunto: "Edição", p_preheader: "", p_blocos: [{ tipo: "imagem", src: "/arquivos/a.webp", alt: "" }], p_texto: "" }), "invalido:descricao");
await recusa("link javascript não entra", () => rpc(como(ids.jornal), "boletim_edicao_salvar", { p_id: null, p_assunto: "Edição", p_preheader: "", p_blocos: [{ tipo: "botao", texto: "x", url: "javascript:alert(1)" }], p_texto: "" }), "invalido:url");
const edicaoBoletim = await rpc(como(ids.jornal), "boletim_edicao_salvar", { p_id: null, p_assunto: "Boletim de outubro", p_preheader: "As novidades do mês", p_blocos: [{ tipo: "titulo", texto: "Novidades" }, { tipo: "paragrafo", texto: "Um texto longo o bastante para valer como edição de verdade, com mais de cinquenta letras." }, { tipo: "materia", titulo: "Greve", url: "/pt/jornal/greve", campo_estranho: "x" }], p_texto: "NOVIDADES\n\nUm texto longo o bastante para valer como edição de verdade, com mais de cinquenta letras." });
await espera("o rascunho fica guardado, sem campo estranho", () => rpc(como(ids.jornal), "boletim_edicoes_listar"), (r) => r.some((e) => e.id === edicaoBoletim.id && e.status === "rascunho" && e.blocos.length === 3 && !("campo_estranho" in e.blocos[2])));
await espera("teste para mim vai só para quem pediu", async () => { await rpc(como(ids.jornal), "boletim_testar", { p_id: edicaoBoletim.id }); return dono("select count(*)::int as n, min(assunto) as assunto from interno.emails where tipo = 'boletim_teste'"); }, (r) => r.rows[0].n === 1 && r.rows[0].assunto.startsWith("[Teste]"));
await dono("insert into interno.boletim (email, confirmado, codigo) values ('leitor1@exemplo.com', true, replace(gen_random_uuid()::text, '-', '')), ('leitor2@exemplo.com', true, replace(gen_random_uuid()::text, '-', '')), ('pausado@exemplo.com', true, replace(gen_random_uuid()::text, '-', '')) on conflict do nothing");
await dono("update interno.boletim set pausado = true where email = 'pausado@exemplo.com'");
await dono("delete from interno.emails where tipo = 'boletim'");
await espera("a edição vai para os confirmados, menos o pausado, e entra no histórico", async () => {
  const r = await rpc(como(ids.jornal), "boletim_edicao_enviar", { p_id: edicaoBoletim.id });
  const pausado = await dono("select count(*)::int as n from interno.emails where tipo = 'boletim' and para = 'pausado@exemplo.com'");
  const lista = await rpc(como(ids.jornal), "boletim_edicoes_listar");
  return { r, pausado: pausado.rows[0].n, e: lista.find((x) => x.id === edicaoBoletim.id) };
}, (v) => v.r.emails >= 2 && v.pausado === 0 && v.e.status === "enviada" && v.e.destinatarios === v.r.emails && v.e.enviada_por);
await recusa("edição enviada não muda", () => rpc(como(ids.jornal), "boletim_edicao_salvar", { p_id: edicaoBoletim.id, p_assunto: "Outro", p_preheader: "", p_blocos: [], p_texto: "" }), "nao_encontrado");
await espera("a fila leva os blocos e o texto de pré-visualização", () => rpc(servico, "emails_pendentes", { p_limite: 100 }), (r) => r.some((e) => e.para === "leitor1@exemplo.com" && Array.isArray(e.blocos) && e.blocos.length === 3 && e.preheader === "As novidades do mês"));
await espera("três falhas seguidas pausam o endereço", async () => {
  for (let i = 0; i < 3; i++) {
    const id = (await dono("insert into interno.emails (para, tipo, assunto, texto, status, tentativas, tentado_em) values ('leitor2@exemplo.com', 'boletim', 'x', 'y', 'enviando', 5, now()) returning id")).rows[0].id;
    await rpc(servico, "email_resultado", { p_id: id, p_ok: false, p_erro: "recusado" });
  }
  return dono("select falhas, pausado from interno.boletim where email = 'leitor2@exemplo.com'");
}, (r) => r.rows[0].pausado === true && r.rows[0].falhas >= 3);
await espera("o jornal reativa o endereço", async () => { await rpc(como(ids.jornal), "boletim_reativar", { p_email: "leitor2@exemplo.com" }); return dono("select falhas, pausado from interno.boletim where email = 'leitor2@exemplo.com'"); }, (r) => r.rows[0].pausado === false && r.rows[0].falhas === 0);

// ── Divulgação: responsável, aprovação para "pronto" e registro de acesso ao Instagram ──
const marketing = await criarUsuario("mkt@exemplo.org", "Mara Marketing");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'marketing')", [marketing]);
await recusa("o marketing não aprova sozinho", () => rpc(como(marketing), "divulgacao_salvar", { p: { titulo: "Post da greve", situacao: "pronto" } }), "sem_permissao:aprovar");
const peca = await rpc(como(marketing), "divulgacao_salvar", { p: { titulo: "Post da greve", legenda: "Legenda", situacao: "rascunho", responsavel: marketing } });
await recusa("responsável precisa ser da equipe", () => rpc(como(marketing), "divulgacao_salvar", { p: { id: peca.id, titulo: "Post da greve", responsavel: ids.leitora } }), "invalido:responsavel");
await recusa("nem pela troca rápida de situação", () => rpc(como(marketing), "divulgacao_situacao", { p_id: peca.id, p_situacao: "pronto" }), "sem_permissao:aprovar");
await espera("a supervisão aprova e fica anotado quem aprovou", async () => { await rpc({ ...como(ids.revisor), aal: "aal2" }, "divulgacao_situacao", { p_id: peca.id, p_situacao: "pronto" }).catch(() => rpc(coordenacao, "divulgacao_situacao", { p_id: peca.id, p_situacao: "pronto" })); return (await rpc(como(marketing), "divulgacao_listar")).itens.find((i) => i.id === peca.id); }, (i) => i.situacao === "pronto" && Boolean(i.aprovado_por) && i.responsavel_id === marketing && Boolean(i.responsavel));
await espera("mexer no texto de uma peça aprovada a devolve para rascunho", () => rpc(como(marketing), "divulgacao_salvar", { p: { id: peca.id, titulo: "Post da greve", legenda: "Outra legenda", situacao: "pronto", responsavel: marketing } }), (r) => r.situacao === "rascunho");
await recusa("o marketing não vê o registro do Instagram", () => rpc(como(marketing), "instagram_acessos_listar"), "sem_permissao");
await recusa("conta com espaço não entra", () => rpc(coordenacao, "instagram_acesso_salvar", { p: { nome: "Mara", conta: "@mara marketing" } }), "violates check constraint");
await espera("a coordenação registra o convite", () => rpc(coordenacao, "instagram_acesso_salvar", { p: { nome: "Mara Marketing", pessoa: marketing, conta: "@mara.mkt", permissoes: "publicar posts e stories", situacao: "ativo" } }), (r) => Boolean(r.id));
await espera("quem saiu do painel com acesso gera lembrete para a coordenação", async () => {
  await dono("delete from interno.papeis where usuario = $1", [marketing]);
  const lista = await rpc(coordenacao, "instagram_acessos_listar");
  const aviso = await dono("select count(*)::int as n from interno.avisos where texto like '%ainda aparece com acesso ao Instagram%'");
  return { fora: lista.find((a) => a.pessoa === marketing)?.na_equipe, avisos: aviso.rows[0].n };
}, (r) => r.fora === false && r.avisos >= 1);

// ── Materiais: arquivo no próprio formulário, crédito e licença obrigatórios, regras de candidatura ──
const designer = como(ids.designer);
const base = { tipo: "cartaz", titulo: "Cartaz da jornada", url: "https://exemplo.org/cartaz.pdf", credito_autor: "Equipe de design", credito_origem: "Feito pelo instituto", licenca: "cc-by-sa" };
await recusa("material sem crédito não entra", () => rpc(designer, "material_salvar", { p: { ...base, credito_autor: "" } }), "invalido:credito_autor");
await recusa("material sem licença não entra", () => rpc(designer, "material_salvar", { p: { ...base, licenca: "" } }), "invalido:licenca");
await recusa("apoio a candidatura pede quem responde", () => rpc(designer, "material_salvar", { p: { ...base, candidatura: true, candidatura_sem_impulsionamento: true } }), "invalido:candidatura_responsavel");
await recusa("e que não haja impulsionamento pago", () => rpc(designer, "material_salvar", { p: { ...base, candidatura: true, candidatura_responsavel: "Fulana de Tal, CPF 000" } }), "invalido:candidatura_impulsionamento");
const hojeIso = (await dono("select current_date::text as d")).rows[0].d;
await recusa("não publica novidade de candidatura no dia da votação", () => rpc(C1, "material_salvar", { p: { ...base, publicado: true, candidatura: true, candidatura_responsavel: "Fulana de Tal, CPF 000", candidatura_sem_impulsionamento: true, candidatura_votacao: hojeIso } }), "candidatura_dia_da_votacao");
const arquivoDoForm = (await dono("insert into interno.arquivos (caminho, nome, dono) values ($1, 'Cartaz em PDF', $2) returning id", [`${ids.designer}/cartaz-teste-01.pdf`, ids.designer])).rows[0].id;
const comArquivo = await rpc(designer, "material_salvar", { p: { ...base, url: "", arquivo: arquivoDoForm } });
await espera("com o arquivo do formulário, o material fica esperando a publicação", () => rpc(designer, "materiais_listar"), (r) => r.some((m) => m.id === comArquivo.id && m.url === "" && m.estado === "rascunho" && m.arquivo === arquivoDoForm));
await recusa("e não vai ao ar sem o arquivo publicado", () => rpc(C1, "material_salvar", { p: { ...base, id: comArquivo.id, url: "", arquivo: arquivoDoForm, publicado: true } }), "arquivo_nao_publicado");
await espera("publicado o arquivo, o endereço aparece sozinho", async () => { await dono("update interno.arquivos set status = 'publicado', destino = '/arquivos/0123456789abcdef0123.pdf' where id = $1", [arquivoDoForm]); return rpc(designer, "materiais_listar"); }, (r) => r.some((m) => m.id === comArquivo.id && m.url === "/arquivos/0123456789abcdef0123.pdf" && m.estado === "aprovado"));
await recusa("arquivo de outra pessoa não se usa", async () => { const outro = (await dono("insert into interno.arquivos (caminho, nome, dono) values ($1, 'Outro', $2) returning id", [`${ids.prof}/outro-arquivo-01.pdf`, ids.prof])).rows[0].id; return rpc(designer, "material_salvar", { p: { ...base, url: "", arquivo: outro } }); }, "invalido:arquivo");
await espera("o público vê crédito e licença, e não vê o arquivo interno", async () => { await rpc(C1, "material_salvar", { p: { ...base, id: comArquivo.id, url: "", arquivo: arquivoDoForm, publicado: true } }); return rpc(anon, "materiais_listar"); }, (r) => r.some((m) => m.id === comArquivo.id && m.licenca === "cc-by-sa" && m.credito_autor === "Equipe de design" && m.arquivo == null && m.arquivo_caminho == null));

// ── Traduções: reserva de aula, glossário por trilha e o envio que libera a reserva ──
const tradutor = await criarUsuario("trad@exemplo.org", "Tânia Tradutora");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'traducao')", [tradutor]);
const outroTradutor = await criarUsuario("trad2@exemplo.org", "Túlio Tradutor");
await dono("insert into interno.papeis (usuario, papel) values ($1, 'traducao')", [outroTradutor]);
const aulaAlvo = "/trilhas/matematica-fundamental/fracoes";
await recusa("quem não traduz não reserva", () => rpc(como(ids.designer), "traducao_reservar", { p_alvo: aulaAlvo, p_idioma: "en" }), "sem_permissao");
await espera("a tradutora reserva a aula para o inglês", () => rpc(como(tradutor), "traducao_reservar", { p_alvo: aulaAlvo, p_idioma: "en" }), (r) => r.ok === true);
await recusa("outra pessoa não reserva a mesma aula no mesmo idioma", () => rpc(como(outroTradutor), "traducao_reservar", { p_alvo: aulaAlvo, p_idioma: "en" }), "traducao_reservada");
await espera("mas pode reservar em outro idioma", () => rpc(como(outroTradutor), "traducao_reservar", { p_alvo: aulaAlvo, p_idioma: "es" }), (r) => r.ok === true);
await espera("a reserva aparece em andamento, com prazo", () => rpc(como(outroTradutor), "traducoes_andamento"), (r) => r.some((x) => x.alvo === aulaAlvo && x.idioma === "en" && x.status === "em_andamento" && x.prazo && x.minha === false));
await espera("reserva vencida cai sozinha", async () => { await dono("update interno.traducao_reservas set prazo = current_date - 1 where idioma = 'es'"); return rpc(como(outroTradutor), "traducoes_andamento"); }, (r) => !r.some((x) => x.idioma === "es" && x.alvo === aulaAlvo));
await espera("enviar a tradução tira a reserva", async () => {
  await rpc(como(tradutor), "contribuir", { p: { tipo: "traducao", titulo: "Fractions", corpo: "A fraction is a part of a whole. ".repeat(6), disciplina: null, dados: { idioma: "en" }, fontes: [], alvo: aulaAlvo } });
  return dono("select count(*)::int as n from interno.traducao_reservas where alvo = $1 and idioma = 'en'", [aulaAlvo]);
}, (r) => r.rows[0].n === 0);
await recusa("e ninguém reserva o que já está a caminho", () => rpc(como(outroTradutor), "traducao_reservar", { p_alvo: aulaAlvo, p_idioma: "en" }), "traducao_a_caminho");
await espera("o glossário da trilha guarda um termo", async () => { await rpc(como(tradutor), "traducao_glossario_salvar", { p_trilha: "matematica-fundamental", p_idioma: "en", p_termo: "fração", p_traducao: "fraction", p_nota: "" }); return rpc(como(outroTradutor), "traducao_glossario", { p_trilha: "matematica-fundamental", p_idioma: "en" }); }, (r) => r.length === 1 && r[0].traducao === "fraction");
await recusa("quem não traduz não mexe no glossário", () => rpc(como(ids.designer), "traducao_glossario_salvar", { p_trilha: "matematica-fundamental", p_idioma: "en", p_termo: "x", p_traducao: "y" }), "sem_permissao");

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
