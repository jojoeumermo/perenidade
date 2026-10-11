// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
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
const nomes = { coord: "Jonathan", curadora: "Carla Curadora", prof: "Paulo Professor", jornal: "Joana Jornalista", revisor: "Rui Revisor", leitora: "Lia Leitora", troll: "Tito Troll", vice: "Vera Vice", mentora: "Marta Mentora", designer: "Davi Designer" };
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
await espera("coordenação lista voluntários", () => rpc(como(ids.coord), "voluntarios_listar"), (r) => r.length === 10);
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
let publica, doProf, artigo;
await espera("qualquer pessoa contribui", async () => (publica = await rpc(anon, "contribuir", { p: aula({ nome: "Visitante" }) })), (r) => Boolean(r.id));
await espera("campo-isca preenchido não guarda nada", () => rpc(anon, "contribuir", { p: aula({ site: "http://spam" }) }), (r) => Boolean(r.id));
await espera("isca não entrou na fila", () => dono("select count(*)::int as n from interno.contribuicoes"), (r) => r.rows[0].n === 1);
await espera("educador contribui na própria disciplina", async () => (doProf = await rpc(como(ids.prof), "contribuir", { p: aula({ titulo: "Regra de três" }) })), (r) => Boolean(r.id));
await espera("jornalista envia matéria", async () => (artigo = await rpc(como(ids.jornal), "contribuir", { p: aula({ tipo: "artigo", disciplina: null, titulo: "Greve dos metalúrgicos completa uma semana", dados: { subtitulo: "Categoria pede reposição." } }) })), (r) => Boolean(r.id));
await espera("contribuição do educador é marcada como tal e assinada", () => rpc(como(ids.prof), "contribuicao_ver", { p_id: doProf.id }), (r) => r.como === "educacao" && r.nome_autor === "Paulo Professor" && r.status === "pendente");
await espera("quem enviou sem conta fica com o nome que deu", () => rpc(como(ids.curadora), "contribuicao_ver", { p_id: publica.id }), (r) => r.nome_autor === "Visitante" && r.como === "publico");
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
await espera("leitora cria tópico", async () => (topico = await rpc(como(ids.leitora), "topico_criar", { p_titulo: "Dúvida sobre frações", p_corpo: "Como somo frações com denominadores diferentes?", p_disciplina: "matematica" })), (r) => Boolean(r.id));
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
await recusa("anônimo não anuncia no mural", () => rpc(anon, "mural_enviar", { p: anuncio() }), "entre_primeiro");
await recusa("categoria desconhecida é recusada", () => rpc(como(ids.prof), "mural_enviar", { p: anuncio({ categoria: "emprestimo" }) }), "invalido:categoria");
await recusa("link do mural precisa ser https", () => rpc(como(ids.prof), "mural_enviar", { p: anuncio({ link: "javascript:alert(1)" }) }), "invalido:link");
await recusa("descrição curta demais é recusada", () => rpc(como(ids.prof), "mural_enviar", { p: anuncio({ descricao: "curta" }) }), "invalido:descricao");
await espera("trabalhador envia anúncio", async () => (anuncioId = (await rpc(como(ids.prof), "mural_enviar", { p: anuncio() })).id), (r) => Boolean(r));
await espera("anúncio pendente não aparece para o público", () => rpc(anon, "mural_listar"), (r) => r.length === 0);
await espera("quem enviou vê o próprio anúncio aguardando", () => rpc(como(ids.prof), "mural_meus"), (r) => r.length === 1 && r[0].status === "pendente");
await recusa("educador não decide anúncios", () => rpc(como(ids.prof), "mural_decidir", { p_id: anuncioId, p_aprovar: true, p_nota: "" }), "sem_permissao");
await recusa("quem não é curadoria não vê a fila do mural", () => rpc(como(ids.jornal), "mural_fila"), "sem_permissao");
await espera("curadoria vê a fila do mural", () => rpc(como(ids.curadora), "mural_fila"), (r) => r.length === 1 && r[0].nome === "Paulo Professor");
await espera("curadoria aprova", () => rpc(como(ids.curadora), "mural_decidir", { p_id: anuncioId, p_aprovar: true, p_nota: "" }), (r) => r.ok);
await espera("anúncio aprovado aparece, com a sigla do estado corrigida", () => rpc(anon, "mural_listar"), (r) => r.length === 1 && r[0].uf === "PE" && r[0].status === undefined);
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
await espera("resumo do painel conta o mural", () => rpc(como(ids.curadora), "painel_resumo"), (r) => r.mural === 2);
await espera("curadoria retira anúncio indevido", () => rpc(como(ids.curadora), "mural_remover", { p_id: anuncioId }), (r) => r.ok);

// ── Rádio ──
await espera("rádio fora do ar: público só vê que está fora", () => rpc(anon, "radio_estado"), (r) => r.no_ar === false && r.canais === undefined);
await recusa("curadoria não configura a rádio", () => rpc(como(ids.curadora), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" }), "sem_permissao");
let canal, faixa;
await espera("coordenação cria canal", async () => (canal = await rpc(como(ids.coord), "radio_canal_salvar", { p_id: null, p_nome: "Formação", p_descricao: "Aulas em áudio.", p_ordem: 1 })), (r) => Boolean(r.id));
await recusa("endereço de faixa inválido", () => rpc(como(ids.coord), "radio_faixa_salvar", { p_id: null, p_canal: canal.id, p_titulo: "x", p_artista: "", p_url: "javascript:alert(1)", p_duracao: 10, p_ordem: 0 }), "invalido:url");
await espera("coordenação adiciona faixa", async () => (faixa = await rpc(como(ids.coord), "radio_faixa_salvar", { p_id: null, p_canal: canal.id, p_titulo: "O que é mais-valia", p_artista: "Instituto Lúcia", p_url: "https://exemplo.test/a.opus", p_duracao: 240, p_ordem: 0 })), (r) => Boolean(r.id));
await espera("coordenação pré-escuta com a rádio fora do ar", () => rpc(como(ids.coord), "radio_estado"), (r) => r.no_ar === false && r.canais.length === 1 && r.canais[0].faixas.length === 1);
await espera("público continua sem ver", () => rpc(como(ids.leitora), "radio_estado"), (r) => r.canais === undefined);
await espera("coordenação põe no ar", () => rpc(como(ids.coord), "radio_configurar", { p_no_ar: true, p_ao_vivo: "" }), (r) => r.no_ar === true);
await espera("agora o público vê", () => rpc(anon, "radio_estado"), (r) => r.no_ar === true && r.canais[0].faixas[0].titulo === "O que é mais-valia");
await recusa("anônimo não guarda progresso", () => rpc(anon, "progresso_salvar", { p_faixa: faixa.id, p_segundos: 30 }), "entre_primeiro");
await espera("progresso guardado e lido", async () => { await rpc(como(ids.leitora), "progresso_salvar", { p_faixa: faixa.id, p_segundos: 95 }); return rpc(como(ids.leitora), "progresso_listar"); }, (r) => r[faixa.id] === 95);
await espera("progresso é de cada pessoa", () => rpc(como(ids.prof), "progresso_listar"), (r) => Object.keys(r).length === 0);

// ── Liderança, vice-liderança e sucessão ──
await recusa("ninguém recebe a liderança por papel_conceder", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.vice, p_papel: "coordenacao", p_disciplina: null }), "invalido:papel");
await recusa("curadoria não nomeia vice-liderança", () => rpc(como(ids.curadora), "papel_conceder", { p_usuario: ids.vice, p_papel: "vice", p_disciplina: null }), "sem_permissao");
await espera("liderança nomeia a vice-liderança", () => rpc(como(ids.coord), "papel_conceder", { p_usuario: ids.vice, p_papel: "vice", p_disciplina: null }));
await espera("vice-liderança confia papéis de trabalho", async () => {
  await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.mentora, p_papel: "mentoria", p_disciplina: "matematica" });
  await rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.designer, p_papel: "design", p_disciplina: null });
  return rpc(como(ids.mentora), "eu");
}, (r) => r.papeis[0].papel === "mentoria" && r.avisos === 1);
await espera("vice-liderança faz tudo o que a curadoria faz", async () => [await rpc(como(ids.vice), "mural_fila"), await rpc(como(ids.vice), "denuncias_listar"), await rpc(como(ids.vice), "fila")], (r) => r.every(Array.isArray));
await recusa("vice-liderança não nomeia outra vice", () => rpc(como(ids.vice), "papel_conceder", { p_usuario: ids.curadora, p_papel: "vice", p_disciplina: null }), "sem_permissao");
await recusa("vice-liderança não remove a liderança", () => rpc(como(ids.vice), "papel_remover", { p_id: papelCoord }), "sem_permissao");
await recusa("vice-liderança não suspende a liderança", () => rpc(como(ids.vice), "usuario_suspender", { p_usuario: ids.coord, p_suspenso: true }), "sem_permissao");
await recusa("curadoria não suspende a vice-liderança", () => rpc(como(ids.curadora), "usuario_suspender", { p_usuario: ids.vice, p_suspenso: true }), "sem_permissao");
await espera("vice-liderança vê voluntários e registro", async () => [await rpc(como(ids.vice), "voluntarios_listar"), await rpc(como(ids.vice), "auditoria_listar")], (r) => r[0].length === 10 && r[1].some((a) => a.acao === "papel_confiado"));
await recusa("curadoria não lê o registro de atividades", () => rpc(como(ids.curadora), "auditoria_listar"), "sem_permissao");
await recusa("vice-liderança não define a sucessão", () => rpc(como(ids.vice), "sucessao_definir", { p_usuarios: [ids.vice] }), "sem_permissao");
await recusa("a liderança não entra na própria sucessão", () => rpc(como(ids.coord), "sucessao_definir", { p_usuarios: [ids.coord] }), "invalido:usuarios");
await espera("liderança define a ordem de sucessão", async () => { await rpc(como(ids.coord), "sucessao_definir", { p_usuarios: [ids.vice, ids.curadora] }); return rpc(como(ids.vice), "sucessao_ver"); }, (r) => r.ordem.length === 2 && r.ordem[0].nome === "Vera Vice");
await espera("com a liderança ativa nada muda", () => rpc(como(ids.vice), "eu"), (r) => r.papeis.some((p) => p.papel === "vice") && !r.papeis.some((p) => p.papel === "coordenacao"));
await espera("liderança parada há mais de 90 dias: a primeira da ordem assume", async () => {
  await dono("update interno.perfis set visto_em = now() - interval '91 days' where id = $1", [ids.coord]);
  const vice = await rpc(como(ids.vice), "eu");
  const antigo = (await dono("select papel from interno.papeis where usuario = $1", [ids.coord])).rows.map((x) => x.papel);
  return [vice.papeis.map((p) => p.papel), antigo];
}, (r) => r[0].includes("coordenacao") && !r[0].includes("vice") && r[1].includes("vice") && !r[1].includes("coordenacao"));
await espera("quem assumiu devolve a liderança", async () => { await rpc(como(ids.vice), "lideranca_passar", { p_usuario: ids.coord }); return rpc(como(ids.coord), "eu"); }, (r) => r.papeis.some((p) => p.papel === "coordenacao"));
await recusa("quem não lidera não passa a liderança", () => rpc(como(ids.vice), "lideranca_passar", { p_usuario: ids.vice }), "sem_permissao");

// ── Segundo fator, aparelhos e iscas ──
await recusa("exigência de segundo fator só liga com o próprio confirmado", () => rpc(como(ids.coord), "seguranca_configurar", { p_exigir_2fa: true }), "confirme_segundo_fator");
await espera("liderança liga a exigência já com o segundo fator", () => rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: true }), (r) => r.exigir_2fa === true);
await recusa("sem segundo fator, a curadoria não decide nada", () => rpc(como(ids.curadora), "mural_fila"), "sem_permissao");
await espera("com segundo fator, decide", () => rpc({ ...como(ids.curadora), aal: "aal2" }, "mural_fila"), (r) => Array.isArray(r));
await espera("o painel sabe que falta o segundo fator", () => rpc(como(ids.curadora), "eu"), (r) => r.exige_segundo_fator === true && r.segundo_fator === false);
await espera("educador não precisa de segundo fator", () => rpc(como(ids.prof), "eu"), (r) => r.exige_segundo_fator === false);
await recusa("sem segundo fator, nem a liderança desliga", () => rpc(como(ids.coord), "seguranca_configurar", { p_exigir_2fa: false }), "sem_permissao");
await espera("liderança desliga a exigência", () => rpc({ ...como(ids.coord), aal: "aal2" }, "seguranca_configurar", { p_exigir_2fa: false }), (r) => r.exigir_2fa === false);
const marca = (n) => String(n).repeat(64).slice(0, 64);
await recusa("marca de aparelho malformada", () => rpc(como(ids.prof), "acesso_registrar", { p_marca: "abc", p_rotulo: "Firefox" }), "invalido:marca");
await espera("primeiro aparelho não gera aviso", () => rpc(como(ids.prof), "acesso_registrar", { p_marca: marca("a"), p_rotulo: "Firefox em Linux" }), (r) => r.novo === false);
await espera("aparelho novo avisa a pessoa e a liderança", async () => {
  const antes = (await rpc(como(ids.coord), "avisos_meus")).length;
  const resposta = await rpc(como(ids.prof), "acesso_registrar", { p_marca: marca("b"), p_rotulo: "Chrome em Android" });
  return [resposta.novo, (await rpc(como(ids.prof), "avisos_meus")).some((a) => a.texto.includes("aparelho novo")), (await rpc(como(ids.coord), "avisos_meus")).length - antes];
}, (r) => r[0] === true && r[1] === true && r[2] === 1);
await espera("o mesmo aparelho de novo não avisa", () => rpc(como(ids.prof), "acesso_registrar", { p_marca: marca("b"), p_rotulo: "Chrome em Android" }), (r) => r.novo === false);
await espera("recados marcados como lidos", async () => { await rpc(como(ids.prof), "aviso_ler", { p_id: null }); return rpc(como(ids.prof), "eu"); }, (r) => r.avisos === 0);
await espera("função-isca devolve vazio, registra e suspende a conta comum", async () => {
  const curioso = await criarUsuario("curioso@teste.local", "Curioso");
  await rpc(como(curioso), "eu");
  const resposta = await rpc(como(curioso), "exportar_usuarios");
  const suspenso = (await dono("select suspenso from interno.perfis where id = $1", [curioso])).rows[0].suspenso;
  const registro = (await rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "armadilha" })).length;
  return [resposta.length, suspenso, registro];
}, (r) => r[0] === 0 && r[1] === true && r[2] === 1);
await espera("isca chamada sem conta também fica registrada", async () => { await rpc({ papel: "anon", ip: "203.0.113.50" }, "admin_senhas"); return rpc(como(ids.coord), "auditoria_listar", { p_pagina: 0, p_acao: "armadilha" }); }, (r) => r.length === 2);

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
  return [retida.retido, publico.respostas.length, fila.length, depois.respostas.length, (await rpc(como(ids.prof), "comunidade_retidos")).length];
}, (r) => r[0] === true && r[1] === 2 && r[2] === 1 && r[3] === 3 && r[4] === 0);
await recusa("leitora comum não lê a lista do filtro", () => rpc(como(ids.jornal), "filtro_listar"), "sem_permissao");
await espera("curadoria edita a lista do filtro", async () => { await rpc(como(ids.curadora), "filtro_salvar", { p_termo: "Palavrão Novo", p_incluir: true }); return rpc(como(ids.curadora), "filtro_listar"); }, (r) => r.includes("palavrao novo"));
await recusa("no máximo três conversas novas por hora", async () => { for (let i = 0; i < 4; i++) await rpc(como(ids.mentora), "topico_criar", { p_titulo: `Conversa número ${i}`, p_corpo: "Texto com mais de dez letras.", p_disciplina: null }); }, "muitos_pedidos");

// ── Aviso de abertura ──
await espera("sem aviso definido, o público recebe 'não definido'", () => rpc(anon, "abertura"), (r) => r.definido === false);
await recusa("curadoria não muda o aviso de abertura", () => rpc(como(ids.curadora), "abertura_salvar", { p: { ativo: true, titulo: "x", texto: "y" } }), "sem_permissao");
await recusa("imagem do aviso precisa estar no próprio site", () => rpc(como(ids.coord), "abertura_salvar", { p: { ativo: true, titulo: "Aviso", texto: "Texto", imagem: "https://exemplo.test/x.png" } }), "invalido:imagem");
await espera("vice-liderança publica o aviso", async () => { await rpc(como(ids.vice), "abertura_salvar", { p: { ativo: true, titulo: "Aviso", texto: "Texto do aviso.", imagem: "/imagens/x.webp", link: "/pt/sobre", link_texto: "Saiba mais", ate: "2030-01-01" } }); return rpc(anon, "abertura"); },
  (r) => r.definido === true && r.ativo === true && r.titulo === "Aviso" && typeof r.versao === "number");

// ── Aula de reforço ──
const pedido = (extra = {}) => ({ disciplina: "matematica", assunto: "Equação do segundo grau", duvida: "Não consigo entender de onde vem a fórmula de Bhaskara.", email: "Aluna@Exemplo.com", ...extra });
let reforco;
await recusa("reforço precisa de conta", () => rpc(anon, "reforco_pedir", { p: pedido() }), "entre_primeiro");
await recusa("reforço precisa de e-mail válido", () => rpc(como(ids.jornal), "reforco_pedir", { p: pedido({ email: "sem-arroba" }) }), "invalido:email");
await espera("pedir reforço", async () => (reforco = await rpc(como(ids.jornal), "reforco_pedir", { p: pedido() })), (r) => Boolean(r.id));
await recusa("quem não é da área não vê a fila de reforço", () => rpc(como(ids.designer), "reforco_fila"), "sem_permissao");
await espera("mentora de matemática vê o pedido, sem o e-mail", () => rpc(como(ids.mentora), "reforco_fila"), (r) => r.length === 1 && r[0].email === "" && !JSON.stringify(r).includes("exemplo.com"));
await espera("educador de outra disciplina não vê", async () => {
  const quimico = await criarUsuario("quimico@teste.local", "Q");
  await rpc(como(quimico), "eu");
  await rpc(como(ids.coord), "papel_conceder", { p_usuario: quimico, p_papel: "educacao", p_disciplina: "quimica" });
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
await espera("liderança vê todos os canais", () => rpc(como(ids.coord), "equipe_canais"), (r) => r.canais.length === 11);
await recusa("designer não lê o canal dos educadores", () => rpc(como(ids.designer), "equipe_listar", { p_canal: "educacao" }), "sem_permissao");
await recusa("designer não escreve no canal da liderança", () => rpc(como(ids.designer), "equipe_escrever", { p_canal: "coordenacao", p_corpo: "Olá" }), "sem_permissao");
await recusa("pedido de ajuda precisa dizer para quem", () => rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: "Preciso de um diagrama." }), "invalido:para");
let recado;
await espera("educador pede ajuda ao design", async () => (recado = await rpc(como(ids.prof), "equipe_escrever", { p_canal: "pedidos", p_corpo: "Preciso de um diagrama do teorema de Pitágoras.", p_resposta_a: null, p_para: "design" })), (r) => Boolean(r.id));
await espera("designer responde e o pedido aparece com a resposta", async () => { await rpc(como(ids.designer), "equipe_escrever", { p_canal: "pedidos", p_corpo: "Faço até sexta.", p_resposta_a: recado.id }); return rpc(como(ids.designer), "equipe_listar", { p_canal: "pedidos" }); },
  (r) => r.length === 1 && r[0].para === "design" && r[0].respostas.length === 1 && r[0].autor === "Paulo Professor");
await recusa("outra pessoa não apaga recado alheio", () => rpc(como(ids.designer), "equipe_apagar", { p_id: recado.id }), "nao_encontrado");
await espera("autor marca o pedido como resolvido", () => rpc(como(ids.prof), "equipe_marcar", { p_id: recado.id, p_resolvido: true }), (r) => r.ok);
await recusa("vice-liderança não define a sala da equipe", () => rpc(como(ids.vice), "equipe_sala_salvar", { p_url: "https://matrix.to/#/!sala:exemplo.org" }), "sem_permissao");
await espera("liderança indica a sala cifrada", async () => { await rpc(como(ids.coord), "equipe_sala_salvar", { p_url: "https://matrix.to/#/!sala:exemplo.org" }); return rpc(como(ids.designer), "equipe_canais"); }, (r) => r.sala.startsWith("https://matrix.to/"));

// ── Materiais de campanha ──
const material = (extra = {}) => ({ tipo: "panfleto", titulo: "Panfleto da jornada de lutas", descricao: "Frente e verso, A5.", campanha: "Jornada de lutas", url: "/arquivos/abc123.pdf", publicado: true, ...extra });
let materialId;
await recusa("educador não cadastra material", () => rpc(como(ids.prof), "material_salvar", { p: material() }), "sem_permissao");
await recusa("endereço estranho é recusado", () => rpc(como(ids.designer), "material_salvar", { p: material({ url: "javascript:alert(1)" }) }), "invalido:url");
await espera("designer guarda o material, mas não publica", async () => (materialId = (await rpc(como(ids.designer), "material_salvar", { p: material() })).id), (r) => Boolean(r));
await espera("rascunho não aparece para o público", () => rpc(anon, "materiais_listar"), (r) => r.length === 0);
await espera("liderança publica", async () => { await rpc(como(ids.coord), "material_salvar", { p: material({ id: materialId }) }); return rpc(anon, "materiais_listar"); }, (r) => r.length === 1 && r[0].publicado === true);
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
await recusa("sem horas confirmadas não há certificado", () => rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", testemunhas: [] } }), "sem_horas");
await espera("vice-liderança confere as horas", () => rpc(como(ids.vice), "horas_conferir", { p_id: horaId, p_confirmar: true }), (r) => r.ok);
await recusa("vice-liderança não abre certificado", () => rpc(como(ids.vice), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", testemunhas: [] } }), "sem_permissao");
await recusa("testemunha precisa ser da equipe de ensino", () => rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação de aulas de matemática.", testemunhas: [ids.designer] } }), "invalido:testemunhas");
let certificado;
await espera("liderança abre o certificado com uma testemunha", async () => (certificado = await rpc(como(ids.coord), "certificado_abrir", { p: { usuario: ids.prof, inicio: hoje, fim: hoje, atividades: "Redação e revisão de aulas de matemática.", testemunhas: [ids.curadora] } })), (r) => Number(r.horas) === 3.5);
await recusa("sem a testemunha confirmar, não emite", () => rpc(como(ids.coord), "certificado_emitir", { p_id: certificado.id }), "falta_testemunha");
await recusa("quem não é testemunha não confirma", () => rpc(como(ids.revisor), "certificado_testemunhar", { p_id: certificado.id }), "sem_permissao");
await espera("testemunha vê o pedido no resumo e confirma", async () => { const antes = (await rpc(como(ids.curadora), "painel_resumo")).testemunhar; await rpc(como(ids.curadora), "certificado_testemunhar", { p_id: certificado.id }); return [antes, (await rpc(como(ids.curadora), "painel_resumo")).testemunhar]; }, (r) => r[0] === 1 && r[1] === 0);
let codigo;
await espera("liderança emite", async () => (codigo = (await rpc(como(ids.coord), "certificado_emitir", { p_id: certificado.id })).codigo), (r) => /^[A-Z0-9]{12}$/.test(r));
await espera("qualquer pessoa confere o código, com ou sem traços", () => rpc(anon, "certificado_conferir", { p_codigo: `${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8).toLowerCase()}` }), (r) => r.valido === true && r.nome === "Paulo Roberto Professor" && Number(r.horas) === 3.5 && r.testemunhas[0] === "Carla Curadora");
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
await espera("cada um vê os próprios arquivos; a liderança vê todos", async () => [(await rpc(como(ids.designer), "arquivos_listar")).length, (await rpc(como(ids.prof), "arquivos_listar")).length, (await rpc(como(ids.vice), "arquivos_listar")).length], (r) => r[0] === 0 && r[1] === 1 && r[2] === 1);
await recusa("curadoria não aprova arquivo", () => rpc(como(ids.curadora), "arquivo_decidir", { p_id: arquivoId, p_aprovar: true }), "sem_permissao");
await espera("arquivo pendente não vai para a publicação", () => rpc(servico, "arquivos_aprovados"), (r) => r.length === 0);
await espera("liderança aprova e a rotina de publicação o encontra", async () => { await rpc(como(ids.coord), "arquivo_decidir", { p_id: arquivoId, p_aprovar: true }); return rpc(servico, "arquivos_aprovados"); }, (r) => r.length === 1 && r[0].caminho === caminho(ids.prof));
await recusa("logado não marca arquivo como publicado", () => rpc(como(ids.coord), "arquivo_publicado", { p_id: arquivoId, p_destino: "/arquivos/0123456789abcdef0123.webp" }), "sem_permissao");
await espera("a rotina anota o endereço final e avisa quem enviou", async () => { await rpc(servico, "arquivo_publicado", { p_id: arquivoId, p_destino: "/arquivos/0123456789abcdef0123.webp" }); return rpc(como(ids.prof), "arquivos_listar"); }, (r) => r[0].status === "publicado" && r[0].destino === "/arquivos/0123456789abcdef0123.webp");

// ── Painel e saída ──
await espera("resumo da coordenação", () => rpc(como(ids.coord), "painel_resumo"), (r) => typeof r.fila === "number" && r.candidaturas === 0);
await espera("resumo de quem não é voluntário não vaza a fila", () => rpc(como(ids.leitora), "painel_resumo"), (r) => r.fila === 0 && r.denuncias === 0);
await espera("apagar a conta leva o perfil e mantém o tópico sem dono", async () => { await rpc(como(ids.leitora), "conta_apagar"); return dono("select (select count(*) from interno.perfis where id = $1)::int as perfil, (select count(*) from interno.topicos where autor is null)::int as orfaos", [ids.leitora]); }, (r) => r.rows[0].perfil === 0 && r.rows[0].orfaos === 1);
await recusa("a última coordenação não apaga a conta", () => rpc(como(ids.coord), "conta_apagar"), "ultima_coordenacao");

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
