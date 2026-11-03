// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os agentes de trabalho, turma e equipe (Etapa 4, E4-16) sem rede e sem navegador: os modos novos no histórico e
// no pedido (sem mudar nenhum byte do pedido antigo), o pedido aceito pela Edge Function nos limites dela, a conta da
// entrevista, a medida da fala, o histórico dos ensaios (só números), a conferência de dado pessoal, o resumo da aula, a
// revisão de conteúdo, a conferência de tradução, os textos nos 6 idiomas e as amarrações da estrutura.
// Uso: npm run testar:agentes
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { apagarConversas, CHAVE_CONVERSAS, GUARDA, gravarConversa, LIMITES, lerConversas, MODOS_DO_ACOMPANHANTE, MODOS_DOS_AGENTES, montarPedido, validarConversa } from "../lib/escola/acompanhante.ts";
import { achaDadoPessoal, agenteDe, AGENTES, analisarFala, apagarEnsaios, CHAVE_ENSAIOS, CHAVE_RASCUNHO, conferirCampo, contextoDaEntrevista, etapaDaEntrevista, formatarDuracao, gravarEnsaio, LIMITES_DOS_AGENTES, lerEnsaios, levarRascunho, palavrasQueSeRepetem, pegarRascunho, resumoDaAula } from "../lib/escola/agentes.ts";
import { conferirTraducao, copiarComMarca, podeCopiarTraducao, revisarConteudo } from "../lib/escola/revisao-de-texto.ts";
import { LIMITES_DO_ACOMPANHANTE, validarEntrada } from "../supabase/functions/assistente/assistente.ts";
import { areaDoCaminho } from "../lib/interdicao.ts";
import { lerRecursos, ligado } from "../lib/recursos.ts";

let certos = 0;
const falhas = [];
const confere = (nome, condicao, detalhe = "") => (condicao ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const igual = (nome, valor, esperado) => confere(nome, JSON.stringify(valor) === JSON.stringify(esperado), `veio ${JSON.stringify(valor)?.slice(0, 220)}, esperado ${JSON.stringify(esperado)?.slice(0, 220)}`);
const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");

/** Um localStorage/sessionStorage de mentira. */
function armazenamento(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    mapa: m,
  };
}
const DIA = 24 * 60 * 60 * 1000;
const agora = Date.UTC(2026, 10, 3, 12);
const PNG = "iVBORw0KGgo=";

// ── Modos dos agentes no histórico e no pedido ──
{
  igual("MODOS_DOS_AGENTES é exatamente os 5 modos", [...MODOS_DOS_AGENTES], ["entrevista", "oratoria", "papelada", "turma", "educador"]);
  igual("MODOS_DO_ACOMPANHANTE não mudou", [...MODOS_DO_ACOMPANHANTE], ["socratico", "pistas", "outro-jeito", "redacao", "documento", "conversa"]);
  const base = (modo, extra = {}) => ({ id: `c-${modo}-01`, modo, titulo: "T", criada: agora, atualizada: agora, falas: [{ de: "pessoa", texto: "oi", em: agora }, { de: "assistente", texto: "olá", em: agora }], ...extra });
  for (const modo of [...MODOS_DO_ACOMPANHANTE, ...MODOS_DOS_AGENTES]) confere(`validarConversa aceita o modo ${modo}`, validarConversa(base(modo))?.modo === modo);
  igual("validarConversa rejeita modo desconhecido", validarConversa(base("traducao")), null);
  igual("validarConversa rejeita id ruim", validarConversa(base("turma", { id: "x" })), null);
  igual("fala sem texto é descartada", validarConversa(base("turma", { falas: [{ de: "pessoa", em: agora }, { de: "assistente", texto: "ok", em: agora }] }))?.falas.length, 1);

  const local = armazenamento();
  const sessao = armazenamento();
  for (let i = 25; i >= 1; i--) gravarConversa(base("entrevista", { id: `c-${String(i).padStart(4, "0")}`, atualizada: agora - i * 1000 }), { armazenamento: local, sessao, agora });
  igual("20 conversas de agente no máximo", lerConversas(local, agora).length, GUARDA.conversas);
  const velha = armazenamento();
  gravarConversa(base("oratoria", { id: "c-velha-1", atualizada: agora - 31 * DIA }), { armazenamento: velha, sessao, agora });
  igual("conversa de agente de mais de 30 dias não volta", lerConversas(velha, agora).length, 0);
  const segura = armazenamento();
  igual("modo seguro não grava conversa de agente", [gravarConversa(base("papelada"), { armazenamento: segura, sessao: armazenamento({ "lucia-seguro": "1" }), agora }), segura.mapa.size], [false, 0]);
  gravarConversa(base("educador"), { armazenamento: segura, sessao, agora });
  apagarConversas(undefined, segura);
  igual("apagar tudo remove a chave", segura.getItem(CHAVE_CONVERSAS), null);

  // Nenhum byte do pedido antigo mudou.
  igual(
    "pedido socrático igual ao de antes",
    montarPedido({ modo: "socratico", pergunta: " Por quê? ", idioma: "pt", falas: [{ de: "pessoa", texto: "oi" }], contexto: { trecho: " um trecho ", aula: "a-b/c-d" } }),
    { modo: "socratico", pergunta: "Por quê?", disciplina: "", idioma: "pt", aulas: [], historico: [{ de: "pessoa", texto: "oi" }], contexto: { aula: "a-b/c-d", trecho: "um trecho" } },
  );
}

// ── O pedido passa na Edge Function ──
{
  const aceito = (pedido) => "entrada" in validarEntrada(pedido);
  const erro = (pedido) => validarEntrada(pedido).erro;
  const vaga = "Auxiliar administrativo";
  const comeco = montarPedido({ modo: "entrevista", pergunta: "Pode começar a entrevista.", idioma: "pt", contexto: contextoDaEntrevista(vaga, []) });
  confere("entrevista: pedido de abertura aceito", aceito(comeco));
  confere("entrevista: a primeira mensagem nunca vai vazia", comeco.pergunta.length > 0);
  igual("entrevista: sem vaga a função recusa", erro(montarPedido({ modo: "entrevista", pergunta: "Pode começar.", idioma: "pt" })), "contexto");
  igual("entrevista: a vaga vai cortada em 120", montarPedido({ modo: "entrevista", pergunta: "oi oi", idioma: "pt", contexto: contextoDaEntrevista("v".repeat(300), []) }).contexto.vaga.length, 120);
  confere("entrevista: o contexto leva a marca de etapa", /pergunta 1 de 5/.test(comeco.contexto.trecho));

  igual("oratória abaixo de 50 caracteres recusa pergunta_curta", erro(montarPedido({ modo: "oratoria", pergunta: "a".repeat(49), idioma: "pt" })), "pergunta_curta");
  confere("oratória com 50 caracteres é aceita", aceito(montarPedido({ modo: "oratoria", pergunta: "a".repeat(50), idioma: "pt" })));
  confere("oratória com o máximo da tela é aceita", aceito(montarPedido({ modo: "oratoria", pergunta: "a".repeat(LIMITES_DOS_AGENTES.falaMax), idioma: "pt" })));

  confere("papelada: texto de 10 caracteres sem imagem é aceito", aceito(montarPedido({ modo: "papelada", pergunta: "a".repeat(10), idioma: "pt" })));
  confere("papelada: imagem sem texto é aceita", aceito(montarPedido({ modo: "papelada", pergunta: "", idioma: "pt", imagem: { tipo: "image/png", dados: PNG } })));
  confere("papelada: menos de 10 sem imagem é recusada", Boolean(erro(montarPedido({ modo: "papelada", pergunta: "a".repeat(9), idioma: "pt" }))));
  confere("papelada: o máximo da tela é aceito", aceito(montarPedido({ modo: "papelada", pergunta: "a".repeat(LIMITES_DOS_AGENTES.papeladaMax), idioma: "pt" })));

  confere("turma: título e resumo são aceitos", aceito(montarPedido({ modo: "turma", pergunta: "Favela", idioma: "pt", contexto: { trecho: "um resumo" } })));
  confere("turma: sem resumo recusa", Boolean(erro(montarPedido({ modo: "turma", pergunta: "Favela", idioma: "pt" }))));
  confere("turma: título de 2 caracteres recusa", Boolean(erro(montarPedido({ modo: "turma", pergunta: "ab", idioma: "pt", contexto: { trecho: "um resumo" } }))));
  igual("turma: o resumo vai cortado em 1.200", montarPedido({ modo: "turma", pergunta: "Favela", idioma: "pt", contexto: { trecho: "x".repeat(2000) } }).contexto.trecho.length, 1200);

  igual("educador abaixo de 10 recusa", erro(montarPedido({ modo: "educador", pergunta: "a".repeat(9), idioma: "pt" })), "pergunta_curta");
  confere("educador com o máximo da tela é aceito", aceito(montarPedido({ modo: "educador", pergunta: "a".repeat(LIMITES_DOS_AGENTES.temaMax), idioma: "pt" })));

  const L = LIMITES_DOS_AGENTES;
  igual("limite da vaga igual ao da função", [L.vaga, LIMITES.vaga], [LIMITES_DO_ACOMPANHANTE.vaga, LIMITES_DO_ACOMPANHANTE.vaga]);
  igual("limite do resumo igual ao trecho da função", L.resumoMax, LIMITES_DO_ACOMPANHANTE.trecho);
  confere("a fala cabe no limite da redação/pergunta", L.falaMax <= LIMITES_DO_ACOMPANHANTE.redacao && L.papeladaMax <= LIMITES.pergunta);
  confere("a resposta da entrevista cabe no item do histórico", L.respostaMax <= LIMITES_DO_ACOMPANHANTE.item);
}

// ── Entrevista: a conta das 5 perguntas ──
{
  const p = (texto = "x") => ({ de: "pessoa", texto });
  const a = (texto = "y") => ({ de: "assistente", texto });
  igual("nenhuma fala: 0 respondidas", etapaDaEntrevista([]), { respondidas: 0, total: 5, terminou: false });
  igual("só a abertura: 0 respondidas", etapaDaEntrevista([p(), a()]), { respondidas: 0, total: 5, terminou: false });
  const ate = (n) => [p(), a(), ...Array.from({ length: n }, () => [p(), a()]).flat()];
  for (let n = 1; n <= 4; n++) igual(`${n} respostas não terminou`, etapaDaEntrevista(ate(n)), { respondidas: n, total: 5, terminou: false });
  igual("5 respostas e o resumo: terminou", etapaDaEntrevista(ate(5)), { respondidas: 5, total: 5, terminou: true });
  confere("5 respostas sem a fala do assistente ainda não terminou", !etapaDaEntrevista(ate(5).slice(0, -1)).terminou);
  const trechos = [0, 1, 2, 3, 4].map((n) => contextoDaEntrevista("vaga", ate(n)).trecho);
  confere("o contexto muda a cada etapa", new Set(trechos).size === 5);
  igual("o contexto na 3ª resposta", contextoDaEntrevista("vaga", ate(2)).trecho, "Esta é a resposta 3 de 5; a pergunta 3 já foi feita.");
  const cortado = montarPedido({ modo: "entrevista", pergunta: "quinta resposta", idioma: "pt", falas: ate(4), contexto: contextoDaEntrevista("vaga", ate(4)) });
  confere("o histórico cortado em 8 falas ainda leva a marca da 5ª resposta", cortado.historico.length === 8 && /resposta 5 de 5/.test(cortado.contexto.trecho));
}

// ── Oratória: a medida da fala ──
{
  const texto120 = Array.from({ length: 120 }, (_, i) => `palavra${i}`).join(" ");
  const m = analisarFala(texto120, 60, "pt");
  igual("120 palavras em 60 s = 120 ppm", [m.palavras, m.ppm, m.duracao], [120, 120, "1:00"]);
  igual("ppm arredonda", analisarFala(texto120, 70, "pt").ppm, 103);
  igual("menos de 10 s: nada de ppm", analisarFala(texto120, 9, "pt").ppm, null);
  igual("com 10 s já há ppm", analisarFala("a b c d e f g h i j", 10, "pt").ppm, 60);
  igual("sem tempo: sem ppm", analisarFala("duas palavras", 0, "pt").ppm, null);
  igual("formatarDuracao", [formatarDuracao(5), formatarDuracao(65), formatarDuracao(300)], ["0:05", "1:05", "5:00"]);
  const repete = "o trabalho muda a vida. o trabalho cansa. o trabalho une gente, e o trabalho paga. salario salario";
  igual("repetidas: só 4 vezes ou mais, em pt", palavrasQueSeRepetem(repete, "pt"), [{ palavra: "trabalho", vezes: 4 }]);
  igual("repetidas: nos outros idiomas, lista vazia", palavrasQueSeRepetem(repete, "en"), []);
  igual("repetidas: no máximo 3", palavrasQueSeRepetem("casa ".repeat(5) + "rua ".repeat(5) + "praca ".repeat(5) + "ponte ".repeat(5), "pt").length, 3);
  confere("a medida não tem rótulo qualitativo", !/bom|ruim|rapido|lento|ideal/i.test(Object.keys(m).join(" ")) && !("faixa" in m) && !("nivel" in m));
  igual("chinês conta caracteres", analisarFala("你好，世界！", 60, "zh").palavras, 4);
}

// ── Ensaios: só números, no aparelho ──
{
  const local = armazenamento();
  const sessao = armazenamento();
  const ensaio = (i, em = agora - i * 1000) => ({ id: `e-${String(i).padStart(4, "0")}`, em, segundos: 60, palavras: 100 + i, ppm: 100 + i });
  for (let i = 15; i >= 1; i--) gravarEnsaio(ensaio(i), { armazenamento: local, sessao, agora });
  const lidos = lerEnsaios(local, agora);
  igual("no máximo 10 ensaios, do mais novo para o mais velho", [lidos.length, lidos[0].id, lidos.at(-1).id], [10, "e-0001", "e-0010"]);
  const velhos = armazenamento();
  gravarEnsaio(ensaio(1, agora - 31 * DIA), { armazenamento: velhos, sessao, agora: agora - 31 * DIA });
  igual("ensaio de mais de 30 dias não volta", lerEnsaios(velhos, agora).length, 0);
  igual("validação ao ler: lixo é descartado", lerEnsaios(armazenamento({ [CHAVE_ENSAIOS]: JSON.stringify([{ id: "x" }, { id: "e-0001", em: agora, segundos: 5, palavras: "muitas", ppm: null }, { id: "e-0002", em: agora, segundos: 5, palavras: 9, ppm: null }]) }), agora).map((e) => e.id), ["e-0002"]);
  igual("JSON quebrado não derruba", lerEnsaios(armazenamento({ [CHAVE_ENSAIOS]: "{" }), agora), []);
  gravarEnsaio({ ...ensaio(1), texto: "minha fala secreta", transcricao: "voz" }, { armazenamento: velhos, sessao, agora });
  const guardado = velhos.getItem(CHAVE_ENSAIOS);
  confere("só números ficam gravados (sem texto, sem transcrição)", guardado && !/secreta|transcricao|texto/.test(guardado), guardado);
  igual("modo seguro não grava ensaio", (() => {
    const s = armazenamento();
    return [gravarEnsaio(ensaio(1), { armazenamento: s, sessao: armazenamento({ "lucia-seguro": "1" }), agora }), s.mapa.size];
  })(), [false, 0]);
  let eventos = 0;
  const antes = globalThis.dispatchEvent;
  globalThis.dispatchEvent = (e) => {
    if (e.type === "lucia:estudo") eventos++;
    return true;
  };
  gravarEnsaio(ensaio(2), { armazenamento: local, sessao, agora });
  apagarEnsaios(local);
  globalThis.dispatchEvent = antes;
  igual("apagar remove a chave e toda escrita avisa lucia:estudo", [local.getItem(CHAVE_ENSAIOS), eventos], [null, 2]);
  const quebrado = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); }, removeItem: () => { throw new Error("bloqueado"); } };
  confere("localStorage que lança exceção não derruba", (() => {
    try {
      return lerEnsaios(quebrado, agora).length === 0 && gravarEnsaio(ensaio(1), { armazenamento: quebrado, sessao, agora }) === false && apagarEnsaios(quebrado) === undefined;
    } catch {
      return false;
    }
  })());
  confere("a chave usa o prefixo privado", CHAVE_ENSAIOS === "lucia:escola-privado:ensaios");
  // Rascunho do educador para a revisão: lido uma vez.
  const aba = armazenamento();
  confere("levarRascunho grava na aba", levarRascunho("texto do rascunho", aba) && aba.getItem(CHAVE_RASCUNHO) === "texto do rascunho");
  igual("pegarRascunho lê uma vez e apaga", [pegarRascunho(aba), pegarRascunho(aba), aba.getItem(CHAVE_RASCUNHO)], ["texto do rascunho", "", null]);
  igual("sessionStorage que lança exceção não derruba", [pegarRascunho({ getItem: () => { throw new Error("x"); }, setItem() {}, removeItem() {} }), levarRascunho("a", { getItem() {}, setItem: () => { throw new Error("x"); }, removeItem() {} })], ["", false]);
  confere("a chave do rascunho usa o prefixo privado", CHAVE_RASCUNHO.startsWith("lucia:escola-privado:"));
}

// ── Dado pessoal no campo ──
{
  const CPF = "529.982.247-25";
  const bloqueia = (t) => conferirCampo(t)?.bloqueia === true;
  confere("CPF com pontos bloqueia", bloqueia(`meu cpf é ${CPF}`));
  confere("CPF sem pontos (válido) bloqueia", bloqueia("cpf 52998224725"));
  confere("CPF com pontos mas dígitos errados também bloqueia", bloqueia("cpf 111.222.333-44"));
  confere("11 dígitos que não são CPF válido não bloqueiam", !conferirCampo("pedido 12345678901") && !bloqueia("12345678901"));
  confere("cartão com Luhn válido bloqueia", bloqueia("cartão 4111 1111 1111 1111") && bloqueia("4111-1111-1111-1111"));
  confere("número longo sem Luhn não bloqueia", !bloqueia("protocolo 1234 5678 9012 3456"));
  igual("e-mail só avisa", conferirCampo("fale com ana@exemplo.com.br"), { aviso: "email", bloqueia: false });
  igual("telefone só avisa", conferirCampo("ligue (21) 98765-4321"), { aviso: "telefone", bloqueia: false });
  igual("telefone sem formatação só avisa", conferirCampo("21987654321 é o meu"), { aviso: "telefone", bloqueia: false });
  igual("texto vazio não acusa nada", [achaDadoPessoal(""), conferirCampo("")], [[], null]);
  igual("texto comum não acusa nada", conferirCampo("Trabalhei 3 anos como atendente, das 8 às 17h."), null);
  igual("CPF e e-mail juntos: o CPF manda", conferirCampo(`${CPF} e ana@exemplo.com`), { aviso: "cpf", bloqueia: true });
  confere("achaDadoPessoal lista os tipos", achaDadoPessoal(`${CPF} ana@exemplo.com 4111111111111111`).sort().join() === "cartao,cpf,email");
}

// ── Resumo da aula ──
{
  const frase = "Esta é uma frase de teste bem comprida para o resumo da aula. ";
  const texto = frase.repeat(40);
  const r = resumoDaAula({ text: texto });
  confere("resumo até 1.200 caracteres", r.length <= 1200 && r.length > 1000, String(r.length));
  confere("resumo corta em frase inteira", r.endsWith("aula."));
  confere("resumo copiado como está (prefixo do texto)", texto.replace(/\s+/g, " ").startsWith(r));
  igual("texto curto fica inteiro", resumoDaAula({ text: "  Um   texto\ncurto. " }), "Um texto curto.");
  confere("uma frase só, gigante, corta em palavra", resumoDaAula({ text: "palavra ".repeat(400) }).length <= 1200);
  igual("sem texto, vazio", resumoDaAula({}), "");
}

// ── Revisão de conteúdo ──
{
  const regras = (texto, o) => revisarConteudo(texto, o).map((a) => a.regra);
  const tem = (nome, texto, regra, o) => confere(nome, regras(texto, o).includes(regra), regras(texto, o).join(","));
  const fontesOk = "\n## Fontes\n\n- IBGE, 2022, https://www.ibge.gov.br/\n";
  tem("link http", `[site](http://exemplo.org)${fontesOk}`, "http");
  confere("link https não acusa http", !regras(`[site](https://exemplo.org)${fontesOk}`).includes("http"));
  for (const host of ["bit.ly/abc", "tinyurl.com/x", "t.co/x", "goo.gl/x", "ow.ly/x", "is.gd/x", "cutt.ly/x"]) tem(`encurtador ${host}`, `veja https://${host}${fontesOk}`, "encurtador");
  tem("rastreio utm", `veja https://exemplo.org/a?utm_source=x${fontesOk}`, "rastreio");
  tem("rastreio fbclid", `veja https://exemplo.org/a?fbclid=1${fontesOk}`, "rastreio");
  tem("rastreio gclid", `veja https://exemplo.org/a?gclid=1${fontesOk}`, "rastreio");
  tem("link repetido", `[a](https://exemplo.org/p) e [b](https://exemplo.org/p)${fontesOk}`, "repetido");
  tem("texto de link vazio", `[](https://exemplo.org/p)${fontesOk}`, "texto-vazio");
  tem("clique aqui", `[clique aqui](https://exemplo.org/p)${fontesOk}`, "clique-aqui");
  tem("seção Fontes ausente", "Um texto sem fontes.", "sem-secao");
  tem("seção Fontes vazia", "Um texto.\n\n## Fontes\n\n## Outra\n", "secao-vazia");
  tem("marcador ainda no texto", "Um texto.\n\n**Fontes**\n\n[acrescente as fontes]\n", "marcador");
  confere("marcador sozinho não vira seção vazia", !regras("Um texto.\n\n**Fontes**\n\n[acrescente as fontes]\n").includes("secao-vazia"));
  tem("fonte sem ano nem endereço", "Texto.\n\n## Fontes\n\n- Um livro qualquer\n", "sem-ano-nem-endereco");
  confere("fonte com ano não acusa", !regras("Texto.\n\n## Fontes\n\n- Um livro qualquer, 1999\n").includes("sem-ano-nem-endereco"));
  tem("número sem fonte", "O desemprego chegou a 12% no país.", "numero-sem-fonte");
  confere("número com fonte não acusa", !regras(`O desemprego chegou a 12% no país.${fontesOk}`).includes("numero-sem-fonte"));
  confere("o modelo aponta o que falta", ["modelo-objetivo", "modelo-exemplo", "modelo-resumo", "modelo-exercicio", "modelo-explicacao"].every((r) => regras("Só um parágrafo.").includes(r)));
  confere("modelo: o que está aí não acusa", (() => {
    const aula = `## O que você vai aprender\n\nAlgo.\n\n## Exemplo resolvido\n\nAlgo.\n\n## Exercício\n\n1. a (certa)\n2. b (certa)\n3. c (certa)\n\n## Resumo\n\nAlgo.\n\n## Fontes\n\n- X, 2020\n`;
    const r = regras(aula);
    return !r.includes("modelo-objetivo") && !r.includes("modelo-exemplo") && !r.includes("modelo-resumo") && !r.includes("modelo-exercicio") && !r.includes("sem-secao");
  })());
  confere("o rascunho com títulos em negrito é entendido", !regras("**Objetivo**\n\nx\n\n**Exemplo resolvido**\n\ny\n\n**Resumo**\n\nz\n\n**Fontes**\n\n- X, 2020\n").includes("modelo-resumo"));
  confere("código não gera achado de link", !regras("```\nhttp://exemplo.org\n```\n" + fontesOk).includes("http"));
  // universidade e diploma só com naEscola
  for (const palavra of ["universidade", "universidad", "university", "université", "университет", "大学", "diploma", "diplôme", "диплом", "文凭"]) {
    confere(`"${palavra}" só acusa com naEscola`, !regras(`Texto com ${palavra} aqui.${fontesOk}`).some((r) => r === "universidade" || r === "diploma") && regras(`Texto com ${palavra} aqui.${fontesOk}`, { naEscola: true }).some((r) => r === "universidade" || r === "diploma"));
  }
  igual("determinística", revisarConteudo("[x](http://a.org) texto 50%", { naEscola: true }), revisarConteudo("[x](http://a.org) texto 50%", { naEscola: true }));
  confere("cada achado tem tipo, gravidade, linha, trecho e regra", revisarConteudo("[](http://bit.ly/x?utm_a=1)").every((a) => a.tipo && ["corrigir", "conferir"].includes(a.gravidade) && Number.isInteger(a.linha) && a.linha >= 1 && typeof a.trecho === "string" && a.regra));
  // Aulas do repositório
  const pasta = new URL("../content/trilhas/", import.meta.url);
  const arquivos = [];
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) andar(p);
      else if (nome.endsWith(".md")) arquivos.push(p);
    }
  };
  andar(pasta.pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " "));
  confere("há aulas no repositório", arquivos.length > 100, String(arquivos.length));
  const limpas = arquivos.filter((a) => !revisarConteudo(readFileSync(a, "utf8")).some((x) => x.gravidade === "corrigir"));
  confere("há aulas do repositório sem nenhum 'corrigir' (cabeçalho com fontes https)", limpas.length > 0, `${limpas.length} de ${arquivos.length}`);
  const uma = readFileSync(limpas[0], "utf8");
  igual("uma aula do repositório dá zero 'corrigir', sempre igual", [revisarConteudo(uma).filter((x) => x.gravidade === "corrigir").length, JSON.stringify(revisarConteudo(uma)) === JSON.stringify(revisarConteudo(uma))], [0, true]);
}

// ── Tradução supervisionada ──
{
  const origem = "# Título\n\nO Instituto Lúcia atende 1.200 pessoas em 2026.\n\n- primeiro item\n- segundo item\n\nVeja https://exemplo.org/a e a Escola Lúcia Maria.";
  const fiel = "# Title\n\nThe Instituto Lúcia serves 1,200 people in 2026.\n\n- first item\n- second item\n\nSee https://exemplo.org/a and the Escola Lúcia Maria.";
  igual("tradução fiel dá lista vazia", conferirTraducao(origem, fiel, "en"), []);
  const regras = (t, o = {}, destino = "en") => conferirTraducao(origem, t, destino, o).map((a) => a.regra);
  confere("perde um número", regras(fiel.replace("2026", "this year")).includes("numero"));
  confere("o separador de milhar não conta como número perdido", !regras(fiel.replace("1,200", "1 200")).includes("numero"));
  confere("perde um endereço", regras(fiel.replace("https://exemplo.org/a", "the site")).includes("endereco"));
  confere("endereço a mais é só conferir", conferirTraducao(origem, `${fiel}\nhttps://outro.org`, "en").some((a) => a.regra === "endereco-a-mais" && a.gravidade === "conferir"));
  confere("perde um parágrafo", regras(fiel.replace("\n\nSee https://exemplo.org/a and the Escola Lúcia Maria.", " See https://exemplo.org/a and the Escola Lúcia Maria.")).includes("paragrafos"));
  confere("perde um título", regras(fiel.replace("# Title\n\n", "")).includes("titulos"));
  confere("perde um item de lista", regras(fiel.replace("- second item", "second item")).includes("itens"));
  confere("perde um termo protegido", regras(fiel.replace("Instituto Lúcia", "Lucia Institute")).includes("termo"));
  confere("termo protegido que a pessoa acrescenta", conferirTraducao("Veja a Gaveta Aberta e o Mural.", "See the Open Drawer and the Mural.", "en", { termosProtegidos: ["Mural"] }).length === 1 && conferirTraducao("Veja a Gaveta Aberta e o Mural.", "See the Gaveta Aberta and the Wall.", "en", { termosProtegidos: ["Mural"] }).some((a) => a.detalhe === "Mural"));
  igual("termo que não está no original não é cobrado", conferirTraducao("Um texto simples.", "A simple text.", "en", { termosProtegidos: ["Mural"] }), []);
  igual("tradução vazia", conferirTraducao(origem, "  ", "en").map((a) => a.regra), ["vazia"]);
  const curta = conferirTraducao("a".repeat(100) + " 1", "b 1", "en");
  confere("tamanho só gera 'conferir', nunca 'corrigir'", curta.length === 1 && curta[0].regra === "tamanho" && curta[0].gravidade === "conferir");
  confere("o alerta de tamanho só abaixo de 30% ou acima de 300%", !conferirTraducao("a".repeat(100), "b".repeat(31), "en").some((a) => a.regra === "tamanho") && conferirTraducao("a".repeat(100), "b".repeat(29), "en").some((a) => a.regra === "tamanho") && !conferirTraducao("a".repeat(100), "b".repeat(299), "en").some((a) => a.regra === "tamanho") && conferirTraducao("a".repeat(100), "b".repeat(301), "en").some((a) => a.regra === "tamanho"));
  for (const [destino, palavra, esperado] of [["es", "universidad", "universidade"], ["fr", "université", "universidade"], ["ru", "университет", "universidade"], ["zh", "大学", "universidade"], ["en", "university", "universidade"], ["es", "diploma", "diploma"], ["fr", "diplôme", "diploma"], ["ru", "диплом", "diploma"], ["zh", "文凭", "diploma"]]) {
    const a = conferirTraducao("Um texto.", `Um ${palavra} aqui.`, destino, { naEscola: true });
    confere(`naEscola acusa "${palavra}" (${destino})`, a.some((x) => x.regra === esperado) && !conferirTraducao("Um texto.", `Um ${palavra} aqui.`, destino).some((x) => x.regra === esperado));
  }
  confere("a trava 'revisado por falante' libera a cópia só depois da caixa", !podeCopiarTraducao({ revisadoPorFalante: false, traducao: "x" }) && podeCopiarTraducao({ revisadoPorFalante: true, traducao: "x" }) && !podeCopiarTraducao({ revisadoPorFalante: true, traducao: " " }));
  confere("a cópia leva a marca em revisão", /^\[Translation under review\]\n\nHello/.test(copiarComMarca(" Hello ", "en")) && /^\[Tradução em revisão\]/.test(copiarComMarca("Olá", "pt")));
}

// ── Estrutura ──
{
  const novos = ["lib/escola/agentes.ts", "lib/escola/revisao-de-texto.ts"];
  for (const f of novos) {
    const c = ler(f);
    confere(`${f} não tem "@/"`, !/from\s+["']@\//.test(c));
    confere(`${f} não tem node:fs`, !/^import .*["'](node:)?fs["']/m.test(c));
  }
  const listar = (dir) => {
    const dentro = new URL(`../${dir}/`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " ").replace(/%5B/g, "[").replace(/%5D/g, "]");
    const saida = [];
    const andar = (d) => {
      for (const nome of readdirSync(d)) {
        const p = join(d, nome);
        if (statSync(p).isDirectory()) andar(p);
        else saida.push(p);
      }
    };
    andar(dentro);
    return saida;
  };
  const arquivosDoPacote = [...listar("components/escola/agentes"), ...listar("app/[lang]/escola/agentes"), ...listar("i18n/escola/agentes")];
  confere("há arquivos do pacote", arquivosDoPacote.length >= 20, String(arquivosDoPacote.length));
  for (const f of arquivosDoPacote.filter((x) => /\.(tsx?|ts)$/.test(x))) {
    const c = readFileSync(f, "utf8");
    confere(`${f.split(/[\\/]/).slice(-3).join("/")} não importa fs nem path`, !/from\s+["'](node:)?(fs|path)["']/.test(c));
  }
  const dinamica = ler("app/[lang]/escola/agentes/[agente]/page.tsx");
  confere("generateStaticParams só existe em [agente]", /export function generateStaticParams/.test(dinamica) && !/generateStaticParams/.test(ler("app/[lang]/escola/agentes/page.tsx")) && dinamica.includes("dynamicParams = false"));
  igual("os 7 agentes", AGENTES.map((a) => a.chave), ["entrevista", "oratoria", "papelada", "turma", "educador", "revisao", "traducao"]);
  igual("só revisão e tradução ficam sem servidor", AGENTES.filter((a) => !a.usaServidor).map((a) => a.chave), ["revisao", "traducao"]);
  igual("os 5 que usam o servidor têm modo do assistente", AGENTES.filter((a) => a.usaServidor).map((a) => a.modo), [...MODOS_DOS_AGENTES]);
  confere("agenteDe acha e recusa", agenteDe("turma")?.caminho === "/escola/agentes/turma" && agenteDe("outro") === undefined);
  for (const a of AGENTES) {
    confere(`${a.caminho} está na interdição como estudo`, areaDoCaminho(a.caminho) === "estudo");
    confere(`${a.chave} tem componente`, existsSync(new URL(`../components/escola/agentes/${{ entrevista: "Entrevista", oratoria: "Oratoria", papelada: "Papelada", turma: "DebateDaTurma", educador: "RascunhoDoEducador", revisao: "RevisaoDeConteudo", traducao: "TraducaoSupervisionada" }[a.chave]}.tsx`, import.meta.url)));
    confere(`${a.chave} é atendido pela página [agente]`, dinamica.includes(`a.chave === "${a.chave}"`));
  }
  confere("/escola/agentes é estudo", areaDoCaminho("/escola/agentes") === "estudo");
  confere("o hub não é mais provisório (existe)", existsSync(new URL("../app/[lang]/escola/agentes/page.tsx", import.meta.url)));
  // Chaves do aparelho
  const tudo = arquivosDoPacote.filter((x) => /\.tsx?$/.test(x)).map((f) => readFileSync(f, "utf8")).join("\n") + ler("lib/escola/agentes.ts");
  const chaves = [...tudo.matchAll(/["'`](lucia[:-][a-z0-9:-]+)["'`]/g)].map((m) => m[1]);
  confere("as chaves do aparelho usam só lucia:escola-privado: ou o evento lucia:estudo", chaves.every((k) => k.startsWith("lucia:escola-privado:") || k === "lucia:estudo" || k === "lucia-seguro"), [...new Set(chaves)].join(","));
  confere("toda escrita no aparelho avisa lucia:estudo", /avisar\(\)/.test(ler("lib/escola/agentes.ts")) && (ler("lib/escola/agentes.ts").match(/avisar\(\);/g) ?? []).length >= 3);
  // A Conversa sem as props novas se comporta como antes
  const conversa = ler("components/escola/acompanhante/Conversa.tsx");
  confere("Conversa: as props novas são opcionais", /encerrarQuando\?:/.test(conversa) && /conferirTexto\?:/.test(conversa));
  confere("Conversa: sem as props o resultado é o de antes", /const conferido = p\.conferirTexto\?\.\(texto\) \?\? null;/.test(conversa) && /!conferido\?\.bloqueia/.test(conversa) && /Boolean\(p\.encerrarQuando\?\.\(falas\)\)/.test(conversa));
  confere("Escolha tem fallback para o nome do modo", /nomesDosModos as Record<string, string>\)\[c\.modo\] \?\? c\.modo/.test(ler("components/escola/acompanhante/Escolha.tsx")));
  confere("o hub do acompanhante leva um link aos agentes", /escola\/agentes/.test(ler("app/[lang]/escola/acompanhante/page.tsx")));
  // Recursos
  confere("ligado('escola') é falso sem NEXT_PUBLIC_RECURSOS e com 'todos'", !ligado("escola", lerRecursos(undefined)) && !ligado("escola", lerRecursos("todos")) && ligado("escola", lerRecursos("escola")));
  confere("o layout de /escola dá 404 com o recurso desligado", /if \(!ligado\("escola"\)\) notFound\(\)/.test(ler("app/[lang]/escola/layout.tsx")));
  confere("este pacote não mexe em package.json (o script já estava reservado)", /"testar:agentes"/.test(ler("package.json")));
  confere("nenhum contador novo (alvos de contagem)", !/agentes/.test(ler("scripts/alvos-de-contagem.mjs")));
  confere("o backend não foi tocado (sem modo 'traducao' no assistente)", !/traducao/.test(ler("supabase/functions/assistente/assistente.ts")) && !/AssistantMode[^;]*traducao/.test(ler("lib/backend.ts")));
  // A moldura
  const moldura = ler("components/escola/agentes/Moldura.tsx");
  confere("toda página de agente tem a marca 'em revisão' e o selo", /comum\.emRevisao/.test(moldura) && /SelosDePrivacidade/.test(moldura) && /SELOS_DE_FORA\.assistente/.test(moldura));
}

// ── Textos nos 6 idiomas ──
{
  const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
  const achatar = (v, p = "", m = new Map()) => {
    if (Array.isArray(v)) v.forEach((x, i) => achatar(x, p ? `${p}.${i}` : String(i), m));
    else if (v && typeof v === "object") Object.keys(v).forEach((k) => achatar(v[k], p ? `${p}.${k}` : k, m));
    else m.set(p, v);
    return m;
  };
  const dic = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler(`i18n/escola/agentes/${l}.json`))]));
  const ref = achatar(dic.pt);
  for (const l of IDIOMAS) {
    const plano = achatar(dic[l]);
    const faltam = [...ref.keys()].filter((k) => !plano.has(k));
    confere(`agentes/${l}.json tem as chaves do português`, faltam.length === 0, faltam.slice(0, 5).join(","));
    confere(`agentes/${l}.json sem valor vazio`, [...plano.values()].every((v) => typeof v === "string" && v.trim()));
    for (const [k, v] of ref) {
      const marcas = (t) => (String(t).match(/\{[a-z]+\}/g) ?? []).sort().join();
      if (typeof v === "string" && marcas(v) !== marcas(plano.get(k))) confere(`agentes/${l}.json "${k}" mantém os {marcadores}`, false, `${marcas(v)} / ${marcas(plano.get(k))}`);
    }
  }
  const pt = dic.pt;
  confere("a ferramenta de tradução diz que não traduz", /não traduz/.test(pt.traducao.lead));
  confere("papelada diz que não é orientação jurídica", /não é orientação jurídica/.test(pt.papelada.naoJuridica));
  confere("o rascunho do educador tem a moldura fixa", /Rascunho de máquina: confira cada fato e acrescente as fontes antes de qualquer uso\. Nada aqui é publicado\./.test(pt.educador.moldura));
  confere("o agente da turma avisa 'em revisão' e 'não escreva nomes de colegas'", /em revisão/.test(pt.turma.aviso) && /nomes de colegas/.test(pt.turma.aviso));
  confere("cada tela que usa o servidor tem a frase de não escrever dados pessoais", /dados de outras pessoas|dados pessoais/.test(pt.comum.naoEscreva) && /dados de ninguém/.test(pt.papelada.aviso) && /dados pessoais/.test(pt.educador.naoEscreva));
  confere("a revisão cita npm run conferir:links", /npm run conferir:links/.test(pt.revisao.links));
  // acompanhante: chaves novas
  for (const l of IDIOMAS) {
    const a = JSON.parse(ler(`i18n/escola/acompanhante/${l}.json`));
    const modos = [...MODOS_DO_ACOMPANHANTE.map((m) => m === "conversa" ? "conversa" : m), ...MODOS_DOS_AGENTES];
    confere(`acompanhante/${l}.json: nomesDosModos tem os ${modos.length} modos`, modos.every((m) => typeof a.hub.nomesDosModos[m] === "string" && a.hub.nomesDosModos[m].trim()), modos.filter((m) => !a.hub.nomesDosModos[m]).join(","));
    confere(`acompanhante/${l}.json: comum.itens tem vaga, fala, formulario, resumo e tema`, ["vaga", "fala", "formulario", "resumo", "tema"].every((i) => typeof a.comum.itens[i] === "string" && a.comum.itens[i].trim()));
  }
  // O que os componentes pedem em itens existe
  const usados = [...ler("components/escola/agentes/Entrevista.tsx").matchAll(/itens=\{\[([^\]]*)\]\}/g), ...ler("components/escola/agentes/Papelada.tsx").matchAll(/itens=\{\[([^\]]*)\]\}/g), ...ler("components/escola/agentes/Oratoria.tsx").matchAll(/itens=\{\[([^\]]*)\]\}/g), ...ler("components/escola/agentes/DebateDaTurma.tsx").matchAll(/itens=\{\[([^\]]*)\]\}/g), ...ler("components/escola/agentes/RascunhoDoEducador.tsx").matchAll(/itens=\{\[([^\]]*)\]\}/g)].flatMap((m) => [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]));
  const itens = JSON.parse(ler("i18n/escola/acompanhante/pt.json")).comum.itens;
  confere("todo item do aviso 'o que vai' existe no dicionário", usados.length >= 7 && usados.every((i) => typeof itens[i] === "string"), usados.join(","));
  // A interface nunca diz universidade nem diploma (fora das chaves "nao")
  const proibidas = ["universidade", "universidad", "university", "université", "университет", "大学", "diploma", "diplôme", "диплом", "文凭", "学位"];
  for (const l of IDIOMAS) for (const [k, v] of achatar(dic[l])) if (typeof v === "string" && !k.split(".").some((p) => /nao/i.test(p))) confere(`agentes/${l}.json "${k}" não diz universidade nem diploma`, !proibidas.some((p) => v.toLocaleLowerCase(l).includes(p)));
}

console.log(`agentes (E4-16): ${certos} conferências certas, ${falhas.length} falhas`);
if (falhas.length) {
  console.error(falhas.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}
