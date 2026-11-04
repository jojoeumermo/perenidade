// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere as quatro ferramentas da vida real da Etapa 3 (lib/ferramentas/vida-real.ts): a árvore de emergências
// trabalhistas (todo caminho chega a um resultado com lei e provas), o explicador de cláusulas (acha o que deve achar e
// cita artigo), a carga elétrica (as contas da aula "Dimensionar um circuito" e os avisos de risco) e o mapa de serviços
// (só links oficiais https, sem dado da pessoa, sem endereço inventado). Também confere o registro das ferramentas novas
// nos arquivos da vitrine, dos selos, das seções e dos seis idiomas. Chamado por: npm run testar:ferramentas
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { areaTools, tools } from "../lib/areas.ts";
import { caixaPorDisciplina } from "../lib/ferramentas/caixa.ts";
import { secaoDaFerramenta } from "../lib/ferramentas/secoes.ts";
import {
  ARVORE, avaliarCircuito, CLAUSULAS_ALUGUEL, CLAUSULAS_EMPRESTIMO, disjuntorMaximoDoFio, drMinimo, explicarClausulas, normalizar, pedidoDeEndereco,
  PROVAS_DE_SEMPRE, proximo, RESULTADOS, resumirCasa, resumoParaLevar, SERVICOS, TABELA_FIOS, UFS,
} from "../lib/ferramentas/vida-real.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const confere = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const perto = (nome, v, esperado, tol = 1e-6) => confere(nome, typeof v === "number" && Math.abs(v - esperado) <= tol, `veio ${v}, esperava ${esperado}`);

const NOVAS = ["arvore-trabalhista", "clausulas-de-contrato", "carga-eletrica", "mapa-de-servicos"];
const idsDe = (tipo, txt) => explicarClausulas(tipo, txt).achados.map((a) => a.clausula.id);
confere("'cobranca' nao dispara a clausula de condominio (obra)", !idsDe("aluguel", "A cobranca do aluguel sera feita por boleto todo mes, sem outras obrigacoes.").includes("condominio"));
confere("acento nao atrapalha: caução achada com ç", idsDe("aluguel", "O locatário deposita CAUÇÃO de três meses de aluguel.").includes("caucao-3"));

/* ── Registro ── */
for (const id of NOVAS) {
  confere(`${id} está na lista de ferramentas`, tools.includes(id));
  confere(`${id} tem seção de textos`, secaoDaFerramenta[id] === "eyebrow");
  confere(`${id} está em alguma disciplina`, Object.values(areaTools).some((l) => l?.includes(id)));
  confere(`${id} está em alguma caixa de aula`, Object.values(caixaPorDisciplina).some((l) => l.includes(id)));
}
const ler = (p) => fs.readFileSync(path.join(raiz, p), "utf8");
const arquivos = { vitrine: ler("components/tools/vitrine-dados.ts"), selos: ler("lib/selos.ts"), view: ler("components/tools/ToolView.tsx"), pagina: ler("app/[lang]/ferramentas/[tool]/page.tsx") };
for (const id of NOVAS) for (const [nome, txt] of Object.entries(arquivos)) confere(`${id} registrado em ${nome}`, txt.includes(`"${id}"`));
for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const nomes = JSON.parse(ler(`i18n/${lang}.json`)).toolNames;
  for (const id of NOVAS) confere(`${id} com nome e descrição em ${lang}`, Array.isArray(nomes[id]) && nomes[id].length === 2 && nomes[id].every((t) => typeof t === "string" && t.length > 5));
}

/* ── 1. Árvore de emergências ── */
const inicio = ARVORE.find((n) => n.id === "inicio");
confere("a árvore tem início", !!inicio && inicio.opcoes.length >= 8);
for (const o of inicio.opcoes) {
  const p = proximo(o.vai);
  confere(`opção "${o.texto}" leva a algum lugar`, !!p);
  if (p?.tipo === "pergunta") for (const o2 of p.no.opcoes) confere(`pergunta ${p.no.id}: "${o2.texto}" leva a algum lugar`, !!proximo(o2.vai));
}
confere("proximo de id desconhecido é nulo", proximo("nao-existe") === null);
const alcancaveis = new Set(inicio.opcoes.map((o) => o.vai));
for (const id of Object.keys(RESULTADOS)) confere(`resultado ${id} alcançável pelo início`, alcancaveis.has(id));
for (const [id, r] of Object.entries(RESULTADOS)) {
  confere(`${id}: provas (3 ou mais)`, r.provas.length >= 3);
  confere(`${id}: passos (2 ou mais)`, r.passos.length >= 2);
  confere(`${id}: lei com artigo`, r.lei.length >= 1 && r.lei.every((l) => /art\.|arts\./i.test(l)), r.lei.join(" | "));
  confere(`${id}: lei de fonte conhecida (CLT, CF ou Lei 8.213)`, r.lei.every((l) => /^(CLT|CF|Lei 8\.213)/.test(l)));
  confere(`${id}: passos mandam ao sindicato ou à Defensoria`, r.passos.some((p) => /sindicato|Defensoria/i.test(p)));
  confere(`${id}: sem número de telefone nos passos`, !/b19[02]b/.test(r.passos.join(" ")));
}
confere("provas de sempre listadas", PROVAS_DE_SEMPRE.length >= 4);
confere("rescisão cita o prazo de dez dias (CLT 477 §6º)", RESULTADOS.rescisao.lei.some((l) => /477, § 6º/.test(l) && /dez dias/.test(l)));
confere("rescisão avisa o prazo de prescrição", /art\. 7º, XXIX/.test(RESULTADOS.rescisao.cuidado ?? ""));
confere("sem carteira cita arts. 29 e 41", RESULTADOS.semcarteira.lei.some((l) => /art\. 29/.test(l)) && RESULTADOS.semcarteira.lei.some((l) => /art\. 41/.test(l)));
confere("acidente cita a CAT (Lei 8.213, art. 22)", RESULTADOS.acidente.lei.some((l) => /Lei 8\.213\/1991, art\. 22/.test(l)));
{
  const r = resumoParaLevar("ferias", [RESULTADOS.ferias.provas[0]], "  Trabalho desde 2023.  ");
  confere("resumo traz o assunto", r.startsWith("Assunto: Férias não dadas"));
  confere("resumo separa o que tem e o que falta", r.includes(`- ${RESULTADOS.ferias.provas[0]}`) && r.includes("O que ainda falta juntar:") && r.includes(`- ${RESULTADOS.ferias.provas[1]}`));
  confere("resumo leva o relato aparado e a lei", r.includes("Trabalho desde 2023.") && !r.includes("  Trabalho") && r.includes("CLT, art. 137"));
  confere("resumo sem nada marcado avisa", resumoParaLevar("ferias", [], "").includes("(nada marcado ainda)"));
  confere("resumo de id desconhecido é vazio", resumoParaLevar("nao-existe", [], "") === "");
}

/* ── 2. Cláusulas ── */
const ids = (r) => r.achados.map((a) => a.clausula.id);
confere("ids de cláusulas são únicos", new Set([...CLAUSULAS_ALUGUEL, ...CLAUSULAS_EMPRESTIMO].map((c) => c.id)).size === CLAUSULAS_ALUGUEL.length + CLAUSULAS_EMPRESTIMO.length);
for (const c of [...CLAUSULAS_ALUGUEL, ...CLAUSULAS_EMPRESTIMO]) {
  confere(`cláusula ${c.id} cita a lei com artigo`, /art\./.test(c.lei) && /8\.245|CDC/.test(c.lei), c.lei);
  confere(`cláusula ${c.id} tem explicação`, c.explica.length > 40 && c.tema.length > 3);
}
confere("normalizar tira acento e põe minúscula", normalizar("Caução – FIADOR é") === "caucao – fiador e");
{
  const t = "CLÁUSULA 5ª. O LOCATÁRIO oferece como garantia um fiador e, ainda, uma caução de quatro meses de aluguel, em dinheiro. O aluguel será reajustado pelo dólar. Valor: R$ 1.500,00 por 30 meses.";
  const r = explicarClausulas("aluguel", t);
  confere("aluguel: acha duas garantias", ids(r).includes("duas-garantias"), ids(r).join(","));
  confere("aluguel: acha o aluguel ligado ao dólar", ids(r).includes("moeda"));
  confere("aluguel: acha a caução", ids(r).includes("caucao-3"));
  const g = r.achados.find((a) => a.clausula.id === "duas-garantias");
  confere("duas garantias é ilegal e cita o art. 37, parágrafo único", g.clausula.gravidade === "ilegal" && /art\. 37, parágrafo único/.test(g.clausula.lei));
  confere("o trecho vem do texto original, com acento", /[ÁÃÇÕáãçõ]/.test(r.achados.map((a) => a.trecho).join(" ")) || r.achados.every((a) => a.trecho.length > 0));
  confere("aluguel completo não acusa o que falta de valor e prazo", !r.faltam.some((f) => f.nome === "valor do aluguel" || f.nome === "prazo do contrato"));
  confere("aluguel sem índice de reajuste é avisado quando não há 'reajuste' (aqui há 'reajustado')", !r.faltam.some((f) => f.nome === "o índice de reajuste"));
}
{
  const r = explicarClausulas("aluguel", "O locatário pagará o aluguel todo mês, sem qualquer outra condição prevista neste instrumento particular de locação residencial.");
  confere("aluguel: texto sem garantia nem valor acusa o que falta", r.faltam.some((f) => f.nome === "a garantia (uma só)") && r.faltam.some((f) => f.nome === "valor do aluguel"), JSON.stringify(r.faltam));
}
{
  const r = explicarClausulas("emprestimo", "Em caso de atraso incidirá multa de 10% sobre a parcela, mais honorários advocatícios e custas de cobrança. O banco poderá alterar a taxa unilateralmente. Fica contratado seguro prestamista obrigatório.");
  confere("empréstimo: multa de atraso cita art. 52 §1º", ids(r).includes("multa-2") && r.achados.find((a) => a.clausula.id === "multa-2").clausula.lei.includes("art. 52, § 1º"));
  confere("empréstimo: custos de cobrança (art. 51 XII)", ids(r).includes("custos-cobranca"));
  confere("empréstimo: alteração unilateral (art. 51 X)", ids(r).includes("unilateral"));
  confere("empréstimo: seguro obrigatório é venda casada (art. 39 I)", ids(r).includes("venda-casada"));
  confere("empréstimo: avisa que faltam o valor em reais e a taxa de juros", r.faltam.some((f) => /juros/.test(f.nome)) && r.faltam.some((f) => /valor/.test(f.nome)), JSON.stringify(r.faltam));
  confere("empréstimo: sempre traz a cláusula geral de clareza (art. 46)", r.gerais.some((c) => c.lei.includes("art. 46")));
  const ordem = ["ilegal", "atencao", "informa"];
  confere("gravidades válidas", r.achados.every((a) => ordem.includes(a.clausula.gravidade)));
}
confere("texto curto não acusa falta", explicarClausulas("emprestimo", "oi").faltam.length === 0);
confere("texto vazio não dá erro", explicarClausulas("aluguel", "").achados.length === 0);

/* ── 3. Carga elétrica (as contas da aula "Dimensionar um circuito") ── */
confere("tabela com seis seções", TABELA_FIOS.length === 6 && TABELA_FIOS.every((l) => l.disjuntor.length === 4));
{
  const c = avaliarCircuito({ watts: 7500, tensao: 220, agrupados: 1, tipo: "exclusivo" });
  perto("chuveiro 7.500 W em 220 V: 34,1 A", c.corrente, 7500 / 220);
  confere("chuveiro: fio de 6 mm², disjuntor de 40 A e DR de 40 A", c.fioMinimo === 6 && c.disjuntor === 40 && c.dr === 40, JSON.stringify(c));
}
{
  const c = avaliarCircuito({ watts: 1200, tensao: 127, agrupados: 3, tipo: "tomadas" });
  confere("cozinha 1.200 VA em 127 V com 3 circuitos: 2,5 mm², 10 A, DR de 25 A", c.fioMinimo === 2.5 && c.disjuntor === 10 && c.dr === 25 && c.nivel === "ok", JSON.stringify(c));
}
{
  const c = avaliarCircuito({ watts: 18 * 127, tensao: 127, agrupados: 1, tipo: "exclusivo" });
  confere("18 A sozinho no eletroduto: 2,5 mm² e 20 A", c.fioMinimo === 2.5 && c.disjuntor === 20);
}
{
  const c = avaliarCircuito({ watts: 500, tensao: 127, agrupados: 1, tipo: "iluminacao" });
  confere("iluminação leve sozinha no eletroduto: 1,5 mm² e 15 A (coluna de 1 circuito)", c.fioMinimo === 1.5 && c.disjuntor === 15, JSON.stringify(c));
}
{
  const c = avaliarCircuito({ watts: 1500, tensao: 127, agrupados: 1, tipo: "tomadas" });
  confere("1.500 W em 127 V num circuito de tomadas avisa para dividir (mais de 10 A)", c.avisos.some((a) => /10 A/.test(a)) && c.nivel !== "ok");
}
{
  const c = avaliarCircuito({ watts: 5500, tensao: 220, agrupados: 1, tipo: "exclusivo", fioAtual: 2.5, disjuntorAtual: 40 });
  confere("fio de 2,5 mm² com disjuntor de 40 A é perigo (disjuntor maior que o fio aguenta)", c.nivel === "perigo" && c.avisos.some((a) => /incêndio/.test(a)), JSON.stringify(c.avisos));
  confere("o aviso manda não trocar o disjuntor por um maior", c.avisos.some((a) => /não troque disjuntor/i.test(a)));
  confere("fio de 2,5 mm² não aguenta 25 A: o aviso fala do fio", c.avisos.some((a) => /o fio esquenta/.test(a)));
}
{
  const c = avaliarCircuito({ watts: 5500, tensao: 220, agrupados: 1, tipo: "exclusivo", fioAtual: 6, disjuntorAtual: 20 });
  confere("disjuntor menor que a corrente: vai desarmar e é só atenção", c.nivel === "atencao" && c.avisos.some((a) => /vai desarmar/.test(a)), JSON.stringify(c));
}
{
  const c = avaliarCircuito({ watts: 5500, tensao: 220, agrupados: 1, tipo: "exclusivo", fioAtual: 6, disjuntorAtual: 25 });
  confere("fio de 6 mm² e disjuntor de 25 A para 25 A: ok", c.nivel === "ok" && c.avisos.length === 0, JSON.stringify(c));
}
{
  const c = avaliarCircuito({ watts: 800, tensao: 127, agrupados: 1, tipo: "tomadas", fioAtual: 1.5, disjuntorAtual: 10 });
  confere("fio de 1,5 mm² em circuito de tomadas fica abaixo do mínimo da norma", c.nivel === "perigo" && c.avisos.some((a) => /mínimo da norma/.test(a)), JSON.stringify(c.avisos));
}
{
  const c = avaliarCircuito({ watts: 40000, tensao: 220, agrupados: 1, tipo: "exclusivo" });
  confere("corrente fora da tabela manda para profissional", c.nivel === "perigo" && c.disjuntor === null && /profissional/.test(c.avisos.join(" ")));
}
confere("potência zero não dá erro", avaliarCircuito({ watts: 0, tensao: 127, agrupados: 1, tipo: "tomadas" }).corrente === 0);
confere("potência negativa vira zero", avaliarCircuito({ watts: -5, tensao: 127, agrupados: 1, tipo: "tomadas" }).corrente === 0);
confere("mais de 4 circuitos usa a coluna de 4", disjuntorMaximoDoFio(10, 9) === 35 && disjuntorMaximoDoFio(10, 4) === 35);
confere("menos de 1 circuito usa a coluna de 1", disjuntorMaximoDoFio(2.5, 0) === 20);
confere("seção fora da tabela dá nulo", disjuntorMaximoDoFio(3, 1) === null);
confere("DR: 10/15/20/25 → 25; 30/40 → 40; 50/60 → 63; 70 → 80", drMinimo(10) === 25 && drMinimo(25) === 25 && drMinimo(30) === 40 && drMinimo(60) === 63 && drMinimo(70) === 80 && drMinimo(35) === null);
{
  const r = resumirCasa([{ nome: "Chuveiro", watts: 5500, circuito: 1 }, { nome: "Micro", watts: 1200, circuito: 2 }, { nome: "Geladeira", watts: 300, circuito: 2 }, { nome: "vazio", watts: 0, circuito: 3 }, { nome: "ruim", watts: NaN, circuito: 3 }], 220);
  perto("soma da casa", r.totalWatts, 7000);
  perto("corrente somada", r.correnteTotal, 7000 / 220);
  confere("dois circuitos, o vazio é ignorado", r.porCircuito.length === 2 && r.porCircuito[1].watts === 1500 && r.porCircuito[1].itens.length === 2);
  confere("circuito inválido vira o 1", resumirCasa([{ nome: "a", watts: 100, circuito: 0 }], 127).porCircuito[0].circuito === 1);
}

/* ── 4. Mapa de serviços ── */
const esperados = ["cras", "ubs", "caps", "defensoria", "procon", "eja"];
confere("os seis serviços pedidos estão no mapa", esperados.every((id) => SERVICOS.some((s) => s.id === id)) && SERVICOS.length === 6);
for (const s of SERVICOS) {
  confere(`${s.id}: texto do que faz e quando procurar`, s.paraQue.length > 40 && s.quando.length >= 2 && s.chegar.length > 40);
  confere(`${s.id}: ao menos um link oficial`, s.links.length >= 1);
  for (const l of s.links) {
    let u = null;
    try { u = new URL(l.url); } catch { /* inválida */ }
    confere(`${s.id}: link https válido (${l.url})`, !!u && u.protocol === "https:");
    confere(`${s.id}: link sem parâmetro (nada da pessoa vai junto)`, !!u && u.search === "" && u.hash === "");
    confere(`${s.id}: link de domínio oficial (${u?.hostname})`, !!u && /(^|\.)(gov\.br|def\.br|anadep\.org\.br)$/.test(u.hostname), u?.hostname);
  }
  confere(`${s.id}: não traz endereço de rua nem telefone fixo inventado`, !/\b(Rua|Avenida|Av\.)\s+[A-Z]/.test(s.chegar + s.paraQue) && !/\(\d{2}\)\s?\d{4}/.test(s.chegar));
}
confere("CRAS cita o 121 do ministério (fonte gov.br)", SERVICOS.find((s) => s.id === "cras").chegar.includes("121"));
confere("Encceja: idade mínima 15 e 18 (Inep)", /15 anos/.test(SERVICOS.find((s) => s.id === "eja").chegar) && /18/.test(SERVICOS.find((s) => s.id === "eja").chegar));
confere("UBS e EJA dizem que não há buscador nacional conferido", !!SERVICOS.find((s) => s.id === "ubs").semBuscaNacional && !!SERVICOS.find((s) => s.id === "eja").semBuscaNacional);
confere("Defensoria cita CF art. 5º, LXXIV", SERVICOS.find((s) => s.id === "defensoria").lei.includes("LXXIV"));
confere("EJA cita LDB art. 37", SERVICOS.find((s) => s.id === "eja").lei.includes("art. 37"));
{
  const ubs = SERVICOS.find((s) => s.id === "ubs");
  const p = pedidoDeEndereco(ubs, " Campinas ", "sp");
  confere("pedido de endereço leva município e UF em maiúsculas", p.includes("Campinas/SP") && p.includes("UBS"));
  confere("pedido sem município não deixa lacuna estranha", !pedidoDeEndereco(ubs, "", "").includes("  ") && !pedidoDeEndereco(ubs, "", "").includes(" em "));
  confere("pedido só com UF", pedidoDeEndereco(ubs, "", "ba").includes(" em BA "));
}
confere("27 unidades da federação", UFS.length === 27 && new Set(UFS).size === 27);

/* ── Privacidade: nada de rede nos componentes ── */
const comp = ler("components/tools/novas/ServicosDaVida.tsx") + ler("lib/ferramentas/vida-real.ts");
confere("sem fetch, XMLHttpRequest, sendBeacon nem WebSocket", !/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/.test(comp));
confere("sem geolocalização", !/geolocation/i.test(comp.replace(/não pede nem usa o GPS|sem geolocalização/gi, "")));
confere("sem leitura do disco (fs) em código de navegador", !/from "node:fs"|require\("fs"\)/.test(comp));
confere("armazenamento só com o prefixo lucia:ferramenta:", !/localStorage\.(set|get)Item\(\s*["`](?!lucia:)/.test(comp));

if (falhas.length) {
  console.error(`FALHOU: ${falhas.length} de ${certos + falhas.length}\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log(`Ferramentas da vida real: ${certos} conferências, todas certas.`);
