// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as regras do banco: quem pode o quê. Uso: npm run testar:banco
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
const nomes = { coord: "Jonathan", curadora: "Carla Curadora", prof: "Paulo Professor", jornal: "Joana Jornalista", revisor: "Rui Revisor", leitora: "Lia Leitora", troll: "Tito Troll", vice: "Vera Vice", mentora: "Marta Mentora", designer: "Davi Designer", med: "Mauro Mediador" };
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
await espera("coordenação lista voluntários", () => rpc(como(ids.coord), "voluntarios_listar"), (r) => r.length === 11);
// ── Busca de pessoas para confiar função ──
await recusa("anônimo não busca pessoas", () => rpc(anon, "pessoas_buscar", { p_busca: "prof" }), "entre_primeiro");
await recusa("leitora não busca pessoas (a resposta tem e-mails)", () => rpc(como(ids.leitora), "pessoas_buscar", { p_busca: "prof" }), "sem_permissao");
await recusa("curadoria não busca pessoas", () => rpc(como(ids.curadora), "pessoas_buscar", { p_busca: "prof" }), "sem_permissao");
await espera("coordenação busca por parte do e-mail", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "PROF@teste" }), (r) => r.length === 1 && r[0].id === ids.prof && r[0].email === "prof@teste.local" && r[0].nome === "Paulo Professor");
await espera("busca por nome ignora acento e maiúsculas", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "paulo PROFESSOR" }), (r) => r.length === 1 && r[0].id === ids.prof);
await espera("busca devolve só quem corresponde", () => rpc(como(ids.coord), "pessoas_buscar", { p_busca: "teste.local" }), (r) => r.length === 11 && r.every((p) => p.email.endsWith("@teste.local")));
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
await recusa("educador não aprova", () => rpc(como(ids.prof), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("revisor não aprova", () => rpc(como(ids.revisor), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("jornalista não aprova a própria matéria", () => rpc(como(ids.jornal), "contribuicao_decidir", { p_id: artigo.id, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("troll não edita contribuição alheia", () => rpc(como(ids.troll), "contribuicao_editar", { p_id: doProf.id, p: aula({ titulo: "Hackeado" }) }), "sem_permissao");
await espera("autor edita enquanto está pendente", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: doProf.id, p: aula({ titulo: "Regra de três simples" }) }));
await recusa("edição não pode tirar a fonte", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: doProf.id, p: aula({ fontes: [] }) }), "falta_fonte");
await espera("curadoria aprova", () => rpc(como(ids.curadora), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: true, p_nota: "Ótima aula." }));
await recusa("decisão não se repete", () => rpc(como(ids.curadora), "contribuicao_decidir", { p_id: doProf.id, p_aprovar: false, p_nota: "" }), "ja_decidida");
await recusa("autor não edita depois de decidida", () => rpc(como(ids.prof), "contribuicao_editar", { p_id: doProf.id, p: aula() }), "ja_decidida");
await espera("coordenação recusa a pública", () => rpc(como(ids.coord), "contribuicao_decidir", { p_id: publica.id, p_aprovar: false, p_nota: "Faltou desenvolver." }));
await espera("autor acompanha as próprias", () => rpc(como(ids.prof), "contribuicoes_minhas"), (r) => r.length === 1 && r[0].status === "aprovada" && r[0].pareceres === 1);
await recusa("anônimo não lê o que vai ser publicado", () => rpc(anon, "publicacoes_pendentes"), "sem_permissao");
await recusa("coordenação logada também não (só a rotina de publicação)", () => rpc(como(ids.coord), "publicacoes_pendentes"), "sem_permissao");
await espera("rotina de publicação lê as aprovadas", () => rpc(servico, "publicacoes_pendentes"), (r) => r.length === 1 && r[0].titulo === "Regra de três simples" && r[0].nome_autor === "Paulo Professor");
await recusa("logado não marca como publicada", () => rpc(como(ids.coord), "publicacoes_marcar", { p_ids: [doProf.id] }), "sem_permissao");
await espera("rotina marca como publicada", () => rpc(servico, "publicacoes_marcar", { p_ids: [doProf.id] }));
await espera("nada mais a publicar", () => rpc(servico, "publicacoes_pendentes"), (r) => r.length === 0);
await espera("correção aprovada vira 'resolvida', não vai para publicação", async () => {
  const c = await rpc(anon, "contribuir", { p: { tipo: "correcao", titulo: "Erro de data", corpo: "A data da Lei Áurea está errada na aula tal.", alvo: "/trilhas/x/y" } });
  await rpc(como(ids.curadora), "contribuicao_decidir", { p_id: c.id, p_aprovar: true, p_nota: "Corrigido." });
  return rpc(como(ids.curadora), "contribuicao_ver", { p_id: c.id });
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
await espera("vice-coordenação vê voluntários e registro", async () => [await rpc(como(ids.vice), "voluntarios_listar"), await rpc(como(ids.vice), "auditoria_listar")], (r) => r[0].length === 13 && r[1].some((a) => a.acao === "papel_confiado"));
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
await espera("a equipe vê quem é quem, sem e-mail de ninguém", () => rpc(como(ids.designer), "equipe_membros"), (r) => r.length >= 6 && r.some((m) => m.eu && m.nome === "Davi Designer") && !JSON.stringify(r).includes("@"));

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

// ── Conversa da equipe ──
await recusa("quem não é da equipe não vê os canais", () => rpc(como(ids.troll), "equipe_canais"), "conta_suspensa");
await espera("designer vê geral, pedidos e design", () => rpc(como(ids.designer), "equipe_canais"), (r) => JSON.stringify(r.canais) === JSON.stringify(["geral", "pedidos", "design"]));
await espera("coordenação vê todos os canais", () => rpc(como(ids.coord), "equipe_canais"), (r) => r.canais.length === 12);
await espera("mediador vê o canal da mediação, e não o da curadoria", () => rpc(como(ids.med), "equipe_canais"), (r) => r.canais.includes("mediacao") && !r.canais.includes("curadoria"));
await recusa("designer não lê o canal dos educadores", () => rpc(como(ids.designer), "equipe_listar", { p_canal: "educacao" }), "sem_permissao");
await recusa("designer não escreve no canal da coordenação", () => rpc(como(ids.designer), "equipe_escrever", { p_canal: "coordenacao", p_corpo: "Olá" }), "sem_permissao");
await recusa("sem chave definida, ninguém escreve", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "sem_chave");
await recusa("vice não define a chave da equipe", () => rpc(como(ids.vice), "equipe_chave_definir", { p_prova: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "sem_permissao");
await recusa("prova da chave em texto aberto é recusada", () => rpc(como(ids.coord), "equipe_chave_definir", { p_prova: "instituto-lucia" }), "invalido:prova");
await espera("coordenação define a chave e todos recebem o sal e a prova", async () => { await rpc(como(ids.coord), "equipe_chave_definir", { p_prova: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }); return rpc(como(ids.designer), "equipe_canais"); }, (r) => /^[a-f0-9]{32}$/.test(r.sal) && r.prova === "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB");
await recusa("o banco recusa mensagem em texto aberto", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "Bom dia, pessoal." }), "invalido:corpo");
await recusa("pedido de ajuda precisa dizer para quem", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "invalido:para");
let recado;
await espera("educador pede ajuda ao design", async () => (recado = await rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB", p_resposta_a: null, p_para: "design" })), (r) => Boolean(r.id));
await espera("designer responde e o pedido aparece com a resposta", async () => { await rpc(como(ids.designer), "equipe_escrever", { p_canal: "pedidos", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB", p_resposta_a: recado.id }); return rpc(como(ids.designer), "equipe_listar", { p_canal: "pedidos" }); },
  (r) => r.length === 1 && r[0].para === "design" && r[0].respostas.length === 1 && r[0].autor === "Paulo Professor");
await recusa("outra pessoa não apaga recado alheio", () => rpc(como(ids.designer), "equipe_apagar", { p_id: recado.id }), "nao_encontrado");
await espera("autor marca o pedido como resolvido", () => rpc(como(ids.prof), "equipe_marcar", { p_id: recado.id, p_resolvido: true }), (r) => r.ok);
await recusa("vice-coordenação não define a sala da equipe", () => rpc(como(ids.vice), "equipe_sala_salvar", { p_url: "https://matrix.to/#/!sala:exemplo.org" }), "sem_permissao");
await espera("coordenação indica a sala cifrada", async () => { await rpc(como(ids.coord), "equipe_sala_salvar", { p_url: "https://matrix.to/#/!sala:exemplo.org" }); return rpc(como(ids.designer), "equipe_canais"); }, (r) => r.sala.startsWith("https://matrix.to/"));
await espera("indicar a sala não apaga a chave", () => rpc(como(ids.coord), "equipe_canais"), (r) => r.prova === "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" && r.sala.startsWith("https://"));
// O canal da mediação aparece para quem media; escrever nele (e pedir ajuda à mediação) precisa funcionar.
await espera("mediação vê o próprio canal", () => rpc({ ...como(ids.med), aal: "aal2" }, "equipe_canais"), (r) => r.canais.includes("mediacao"));
await espera("mediação escreve no próprio canal", () => rpc({ ...como(ids.med), aal: "aal2" }, "equipe_escrever", { p_canal: "mediacao", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), (r) => Boolean(r.id));
await espera("educador pede ajuda à mediação", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB", p_resposta_a: null, p_para: "mediacao" }), (r) => Boolean(r.id));
await recusa("quem não é da mediação não lê o canal dela", () => rpc(como(ids.designer), "equipe_listar", { p_canal: "mediacao" }), "sem_permissao");
await espera("mensagem com mais de trinta dias some sozinha", async () => { await dono("update interno.equipe_mensagens set criado_em = now() - interval '31 days' where resposta_a is null"); return rpc(como(ids.coord), "equipe_listar", { p_canal: "pedidos" }); }, (r) => r.length === 0);
await recusa("vice não apaga tudo", () => rpc(como(ids.vice), "equipe_apagar_tudo"), "sem_permissao");
await espera("o coordenador apaga todas as conversas de uma vez", async () => { await rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }); const r = await rpc(como(ids.coord), "equipe_apagar_tudo"); return [r.apagadas, (await dono("select count(*)::int as n from interno.equipe_mensagens")).rows[0].n]; }, (r) => r[0] === 1 && r[1] === 0);
await espera("trocar a chave apaga as conversas antigas", async () => { await rpc(como(ids.prof), "equipe_escrever", { p_canal: "geral", p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }); await rpc(como(ids.coord), "equipe_chave_definir", { p_prova: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }); return dono("select count(*)::int as n from interno.equipe_mensagens"); }, (r) => r.rows[0].n === 0);

// ── Conversas privadas e em grupo ──
await espera("a chave da equipe volta a existir para as conversas", () => rpc(como(ids.coord), "equipe_chave_definir", { p_prova: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), (r) => r.ok);
await recusa("quem não é da equipe não tem conversas", () => rpc(como(ids.leitora), "chat_conversas"), "sem_permissao");
await recusa("não se abre conversa com quem não é da equipe", () => rpc(como(ids.prof), "chat_direta", { p_usuario: ids.leitora }), "invalido:usuario");
await recusa("nem consigo mesmo", () => rpc(como(ids.prof), "chat_direta", { p_usuario: ids.prof }), "invalido:usuario");
let privada;
await espera("educador abre conversa privada com o designer, e abrir de novo cai na mesma", async () => { privada = (await rpc(como(ids.prof), "chat_direta", { p_usuario: ids.designer })).id; return (await rpc(como(ids.designer), "chat_direta", { p_usuario: ids.prof })).id; }, (r) => r === privada);
await recusa("o banco recusa mensagem privada em texto aberto", () => rpc(como(ids.prof), "chat_enviar", { p_id: privada, p_corpo: "Oi, Davi." }), "invalido:corpo");
await espera("mensagem privada cifrada entra", () => rpc(como(ids.prof), "chat_enviar", { p_id: privada, p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), (r) => Boolean(r.id));
await espera("o outro vê a conversa com uma mensagem não lida e o nome de quem escreveu", () => rpc(como(ids.designer), "chat_conversas"), (r) => r.length === 1 && r[0].nao_lidas === 1 && r[0].nome === "Paulo Professor" && r[0].tipo === "direta" && typeof r[0].online === "boolean");
await espera("o painel avisa que há conversa nova", () => rpc(como(ids.designer), "presenca"), (r) => r.conversas === 1);
await espera("abrir marca como lida", async () => { const aberta = await rpc(como(ids.designer), "chat_ver", { p_id: privada }); return [aberta.mensagens.length, aberta.membros.length, (await rpc(como(ids.designer), "presenca")).conversas]; }, (r) => r[0] === 1 && r[1] === 2 && r[2] === 0);
await recusa("a coordenação não lê conversa privada dos outros", () => rpc(como(ids.coord), "chat_ver", { p_id: privada }), "nao_encontrado");
await recusa("quem está de fora não escreve nela", () => rpc(como(ids.revisor), "chat_enviar", { p_id: privada, p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }), "nao_encontrado");
await espera("a conversa dos outros não aparece na lista de ninguém", () => rpc(como(ids.coord), "chat_conversas"), (r) => r.every((c) => c.id !== privada));
await recusa("grupo precisa de gente da equipe", () => rpc(como(ids.prof), "chat_grupo_criar", { p_nome: "Educadores", p_membros: [ids.leitora] }), "invalido:membros");
let grupo;
await espera("educador cria um grupo e os convidados são avisados", async () => { grupo = (await rpc(como(ids.prof), "chat_grupo_criar", { p_nome: "Educadores de exatas", p_membros: [ids.mentora, ids.designer] })).id; return rpc(como(ids.mentora), "avisos_meus"); }, (r) => r.some((x) => x.texto.includes("Educadores de exatas")));
await espera("todos do grupo leem o que um escreve", async () => { await rpc(como(ids.mentora), "chat_enviar", { p_id: grupo, p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }); return rpc(como(ids.designer), "chat_ver", { p_id: grupo }); }, (r) => r.mensagens.length === 1 && r.mensagens[0].nome === "Marta Mentora" && r.membros.length === 3 && r.dona === false);
await recusa("quem não criou o grupo não põe gente", () => rpc(como(ids.designer), "chat_grupo_mudar", { p_id: grupo, p_incluir: [ids.revisor] }), "sem_permissao");
await espera("quem criou põe e tira gente e troca o nome", async () => { await rpc(como(ids.prof), "chat_grupo_mudar", { p_id: grupo, p_nome: "Exatas", p_incluir: [ids.revisor], p_tirar: [ids.designer] }); return rpc(como(ids.prof), "chat_ver", { p_id: grupo }); }, (r) => r.nome === "Exatas" && r.membros.length === 3 && r.membros.some((m) => m.nome === "Rui Revisor"));
await recusa("quem foi tirado não lê mais", () => rpc(como(ids.designer), "chat_ver", { p_id: grupo }), "nao_encontrado");
await recusa("ninguém apaga mensagem de outra pessoa", async () => { const m = (await rpc(como(ids.prof), "chat_ver", { p_id: grupo })).mensagens[0]; return rpc(como(ids.prof), "chat_apagar", { p_id: m.id }); }, "nao_encontrado");
await espera("cada um apaga a própria mensagem", async () => { const m = (await rpc(como(ids.mentora), "chat_ver", { p_id: grupo })).mensagens[0]; await rpc(como(ids.mentora), "chat_apagar", { p_id: m.id }); return rpc(como(ids.prof), "chat_ver", { p_id: grupo }); }, (r) => r.mensagens.length === 0);
await espera("quem quiser sai do grupo", async () => { await rpc(como(ids.revisor), "chat_sair", { p_id: grupo }); return rpc(como(ids.revisor), "chat_conversas"); }, (r) => r.every((c) => c.id !== grupo));
await recusa("membro comum não apaga o grupo", () => rpc(como(ids.mentora), "chat_grupo_apagar", { p_id: grupo }), "sem_permissao");
await espera("mensagem privada com mais de trinta dias some sozinha", async () => { await dono("update interno.conversa_mensagens set criado_em = now() - interval '31 days'"); await rpc(como(ids.prof), "chat_conversas"); return dono("select count(*)::int as n from interno.conversa_mensagens"); }, (r) => r.rows[0].n === 0);
await espera("o botão de apagar tudo leva as conversas privadas junto", async () => { await rpc(como(ids.prof), "chat_enviar", { p_id: privada, p_corpo: "c1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBB" }); await rpc(como(ids.coord), "equipe_apagar_tudo"); return dono("select count(*)::int as n from interno.conversa_mensagens"); }, (r) => r.rows[0].n === 0);
await espera("quem criou apaga o grupo", async () => { await rpc(como(ids.prof), "chat_grupo_apagar", { p_id: grupo }); return rpc(como(ids.mentora), "chat_conversas"); }, (r) => r.every((c) => c.id !== grupo));
await espera("a equipe vê quem está online e quando cada um passou por aqui", () => rpc(como(ids.prof), "equipe_membros"), (r) => r.every((m) => typeof m.online === "boolean" && typeof m.visto_em === "string"));

// ── Materiais de campanha ──
const material = (extra = {}) => ({ tipo: "panfleto", titulo: "Panfleto da jornada de lutas", descricao: "Frente e verso, A5.", campanha: "Jornada de lutas", url: "/arquivos/abc123.pdf", publicado: true, ...extra });
let materialId;
await recusa("educador não cadastra material", () => rpc(como(ids.prof), "material_salvar", { p: material() }), "sem_permissao");
await recusa("endereço estranho é recusado", () => rpc(como(ids.designer), "material_salvar", { p: material({ url: "javascript:alert(1)" }) }), "invalido:url");
await espera("designer guarda o material, mas não publica", async () => (materialId = (await rpc(como(ids.designer), "material_salvar", { p: material() })).id), (r) => Boolean(r));
await espera("rascunho não aparece para o público", () => rpc(anon, "materiais_listar"), (r) => r.length === 0);
await espera("coordenação publica", async () => { await rpc(como(ids.coord), "material_salvar", { p: material({ id: materialId }) }); return rpc(anon, "materiais_listar"); }, (r) => r.length === 1 && r[0].publicado === true);
await recusa("designer não remove o que já está no ar", () => rpc(como(ids.designer), "material_remover", { p_id: materialId }), "nao_encontrado");

// ── Horas de voluntariado e certificados ──
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

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
