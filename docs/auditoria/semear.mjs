// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Material da auditoria: põe um pouco de tudo no banco de teste local (contribuições, mensagens retidas, anúncios,
// reforço, candidaturas, horas, materiais), para cada seção do painel ter o que mostrar.
//
//   npm run dev:local 3201                 (em outro terminal; com PORTA_BANCO=54420 se quiser outra porta)
//   PORTA_BANCO=54420 node docs/auditoria/semear.mjs
const { CHAVE_ANON, URL_LOCAL } = await import(new URL("../../scripts/backend-local.mjs", import.meta.url));

async function pedir(caminho, token, corpo) {
  const resposta = await fetch(URL_LOCAL + caminho, { method: "POST", headers: { apikey: CHAVE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo ?? {}) });
  const texto = await resposta.text();
  return { status: resposta.status, dados: texto ? JSON.parse(texto) : null };
}
async function entrar(conta, fator) {
  let token = (await pedir("/auth/v1/token?grant_type=password", CHAVE_ANON, { email: `${conta}@local`, password: "x" })).dados.access_token;
  if (fator) {
    const novo = (await pedir("/auth/v1/factors", token, { factor_type: "totp" })).dados;
    token = (await pedir(`/auth/v1/factors/${novo.id}/verify`, token, { code: "123456" })).dados.access_token;
  }
  return token;
}
async function rpc(token, funcao, argumentos = {}) {
  const { status, dados } = await pedir(`/rest/v1/rpc/${funcao}`, token, argumentos);
  console.log(status === 200 ? "ok  " : "ERRO", funcao, status === 200 ? "" : dados?.message);
  return dados;
}
const fonte = [{ titulo: "Fonte de teste", autor: "Autor", ano: "2020", url: "https://pt.wikipedia.org/wiki/Fra%C3%A7%C3%A3o" }];
const aula = (titulo) => ({ tipo: "aula", disciplina: "matematica", titulo, corpo: "Texto da aula com mais de vinte caracteres.", dados: { trilha: "matematica-fundamental", resumo: "Resumo." }, fontes: fonte });

const coord = await entrar("coord", true);
const prof = await entrar("prof");
const leitora = await entrar("leitora");
const designer = await entrar("designer");
const jornal = await entrar("jornal");

await rpc(CHAVE_ANON, "contribuir", { p: aula("Envio de fora sem conta") });
await rpc(prof, "contribuir", { p: aula("Aula do professor") });
await rpc(jornal, "contribuir", { p: { tipo: "artigo", titulo: "Matéria de teste", corpo: "Corpo da matéria com mais de vinte caracteres para passar.", dados: {}, fontes: fonte } });
await rpc(leitora, "topico_criar", { p_titulo: "Pergunta com link", p_corpo: "Vejam https://exemplo.com.br/x por favor, é importante.", p_disciplina: "matematica", p_tipo: "duvida" });
const topico = await rpc(leitora, "topico_criar", { p_titulo: "Pergunta normal", p_corpo: "Como faço para somar frações com denominadores diferentes?", p_disciplina: "matematica", p_tipo: "duvida" });
await rpc(prof, "responder", { p_topico: topico.id, p_corpo: "Ache o mínimo múltiplo comum dos denominadores." });
await rpc(CHAVE_ANON, "denunciar", { p_alvo: `/pt/comunidade?t=${topico.id}`, p_motivo: "ofensa", p_detalhes: "Denúncia de teste com detalhes suficientes." });
await rpc(CHAVE_ANON, "mural_enviar", { p: { categoria: "servico", oficio: "Pedreiro", titulo: "Faço reformas", descricao: "Reformas pequenas e grandes, orçamento sem compromisso.", cidade: "Recife", uf: "PE", contato: "contato pelo telefone" } });
await rpc(leitora, "mural_enviar", { p: { categoria: "cooperativa", oficio: "", titulo: "Cooperativa de costura", descricao: "Costuramos uniformes e roupas sob medida para escolas.", cidade: "Belém", uf: "PA", contato: "falar na sede" } });
await rpc(CHAVE_ANON, "reforco_pedir", { p: { email: "aluno@exemplo.com", disciplina: "matematica", assunto: "Frações", duvida: "Não entendo como dividir uma fração por outra fração." } });
await rpc(CHAVE_ANON, "voluntariar", { p: { nome: "Fulana de Tal", email: "fulana@exemplo.com", papel: "revisao", mensagem: "Quero ajudar revisando os textos das aulas do instituto." } });
await rpc(leitora, "candidatar", { p_papel: "traducao", p_disciplina: null, p_mensagem: "Quero ajudar traduzindo aulas para o espanhol." });
await rpc(CHAVE_ANON, "boletim_assinar", { p_email: "leitor@exemplo.com" });
await rpc(prof, "termo_aceitar", { p_nome_completo: "Paulo Professor da Silva", p_versao: "1" });
await rpc(prof, "horas_registrar", { p_dia: new Date().toISOString().slice(0, 10), p_horas: 2, p_atividade: "Escrevi uma aula de frações" });
await rpc(coord, "material_salvar", { p: { tipo: "cartaz", titulo: "Cartaz de teste", descricao: "", campanha: "", url: "https://exemplo.com/cartaz", publicado: true } });
await rpc(designer, "material_salvar", { p: { tipo: "zine", titulo: "Zine em preparo", descricao: "", campanha: "", url: "https://exemplo.com/zine" } });
await rpc(coord, "radio_canal_salvar", { p_id: null, p_nome: "Canal de teste", p_descricao: "", p_ordem: 0 });
await rpc(coord, "apoiador_salvar", { p_id: null, p_nome: "Apoiadora Teste", p_mensagem: "Força!" });
await rpc(coord, "convite_criar", { p: { email: "convidada@exemplo.com", papel: "revisao" } });
await rpc(prof, "anotar", { p_caminho: "/trilhas/matematica-fundamental/fracoes", p_paragrafo: 1, p_trecho: "", p_corpo: "Anotação de teste do professor." });
console.log("pronto");
