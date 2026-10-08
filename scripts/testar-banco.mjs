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
for (const [chave, nome] of Object.entries({ coord: "Jonathan", curadora: "Carla Curadora", prof: "Paulo Professor", jornal: "Joana Jornalista", revisor: "Rui Revisor", leitora: "Lia Leitora", troll: "Tito Troll" })) {
  ids[chave] = await criarUsuario(`${chave}@teste.local`, nome);
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
await espera("coordenação lista voluntários", () => rpc(como(ids.coord), "voluntarios_listar"), (r) => r.length === 7);
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
await espera("educador vê só a fila da disciplina dele", () => rpc(como(ids.prof), "fila"), (r) => r.length === 2 && r.every((c) => c.disciplina === "matematica"));
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

// ── Painel e saída ──
await espera("resumo da coordenação", () => rpc(como(ids.coord), "painel_resumo"), (r) => typeof r.fila === "number" && r.candidaturas === 0);
await espera("resumo de quem não é voluntário não vaza a fila", () => rpc(como(ids.leitora), "painel_resumo"), (r) => r.fila === 0 && r.denuncias === 0);
await espera("apagar a conta leva o perfil e mantém o tópico sem dono", async () => { await rpc(como(ids.leitora), "conta_apagar"); return dono("select (select count(*) from interno.perfis where id = $1)::int as perfil, (select count(*) from interno.topicos where autor is null)::int as orfaos", [ids.leitora]); }, (r) => r.rows[0].perfil === 0 && r.rows[0].orfaos === 1);
await recusa("a última coordenação não apaga a conta", () => rpc(como(ids.coord), "conta_apagar"), "ultima_coordenacao");

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
