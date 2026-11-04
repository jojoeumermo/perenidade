// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "visual" do Vale o Escrito (docs/vale-o-escrito/ESPEC.md): as funções puras que montam a teia e as
// visões (lib/vale-o-escrito/visual.ts), o tratamento da linha do Realtime (lib/vale-o-escrito/aovivo.ts), os textos de
// interface nos 6 idiomas, o CSS com escopo, D3 só na página do observatório e as rotas de ficha. Sem rede, sem navegador.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { acaoDaLinha } from "../lib/vale-o-escrito/aovivo.ts";
import {
  aplicarEntradaAoVivo,
  anoDe,
  casosDaOrganizacao,
  casosDaPessoa,
  centroPadrao,
  chaveDe,
  codigoDeArquivo,
  contarPorSituacao,
  dataParaMs,
  formatarData,
  indicesDeArquivo,
  juntarDossies,
  layoutFluxo,
  layoutGrupos,
  layoutLinha,
  layoutOrbita,
  listaComE,
  listaTextual,
  montarGrafo,
  nivelDaTeia,
  rotuloVisivel,
  saltosAPartirDe,
  veiculosDaEntrada,
  vizinhos,
} from "../lib/vale-o-escrito/visual.ts";
import { SITUACOES } from "../lib/vale-o-escrito/tipos.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const raiz = process.cwd();
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
const existe = (...p) => fs.existsSync(path.join(raiz, ...p));
const arquivosDe = (pasta, ext) => {
  const saida = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (ext.some((x) => e.name.endsWith(x))) saida.push(p);
    }
  };
  andar(path.join(raiz, pasta));
  return saida;
};

// ───────────────────────────── Exemplos ─────────────────────────────
const fonte = (extra = {}) => ({
  id: "f1",
  veiculo: "Repórter Brasil",
  tipo: "reportagem",
  titulo: "Fazenda é autuada por trabalho análogo ao de escravo",
  url: "https://reporterbrasil.org.br/exemplo",
  trecho: "A fiscalização encontrou trabalhadores alojados em barracos de lona, sem água potável.",
  data: "2026-03-10",
  acessadoEm: "2026-03-12",
  arquivoUrl: "https://web.archive.org/web/20260312100000/https://reporterbrasil.org.br/exemplo",
  ...extra,
});
const entrada = (extra = {}) => ({
  id: "2026-exemplo-fazenda",
  dossie: "trabalho-escravo",
  titulo: "Fazenda autuada por trabalho análogo ao de escravo",
  resumo: "Segundo a Repórter Brasil, a fiscalização autuou a fazenda por submeter trabalhadores a condições degradantes.",
  dataDoFato: "2026-03",
  lugar: { pais: "BR", regiao: "PA", municipioIbge: "1500602", nome: "Altamira" },
  situacao: "investigado",
  confianca: "reportado",
  fontes: [fonte()],
  pessoas: [{ pessoaId: "p1", situacao: "investigado", papelNoCaso: "Dono da fazenda, supostamente responsável pelo alojamento." }],
  organizacoes: ["o1"],
  etiquetas: ["fiscalização"],
  publicadoEm: "2026-03-15",
  atualizadoEm: "2026-03-15",
  ...extra,
});
const pessoa = (extra = {}) => ({ id: "p1", nome: "Fulano de Tal", publicaNoCaso: true, papel: "proprietario_rural", fonteIds: ["f1"], ...extra });
const org = (extra = {}) => ({ id: "o1", nome: "Fazenda Exemplo Ltda", tipo: "empresa", fonteIds: ["f1"], ...extra });

const e1 = entrada();
const e2 = entrada({
  id: "2025-exemplo-garimpo",
  dossie: "crimes-ambientais",
  titulo: "Garimpo ilegal em terra protegida",
  resumo: "Segundo o IBAMA, a fiscalização apreendeu equipamentos de garimpo.",
  dataDoFato: "2025-08-20",
  lugar: { pais: "BR", regiao: "PA", municipioIbge: "1500602", nome: "Altamira" },
  situacao: "denunciado",
  confianca: "primaria",
  fontes: [fonte({ id: "f1", veiculo: "IBAMA", tipo: "investigacao_oficial", titulo: "Auto de infração", url: "https://www.gov.br/ibama/exemplo" })],
  pessoas: [{ pessoaId: "p1", situacao: "denunciado" }],
  organizacoes: [],
  publicadoEm: "2025-09-01",
  atualizadoEm: "2025-10-01",
});
const e3 = entrada({
  id: "2024-exemplo-arquivado",
  dossie: "dinheiro-publico",
  titulo: "Contrato investigado e depois arquivado",
  resumo: "Segundo o TCU, o contrato foi investigado; a apuração foi arquivada.",
  dataDoFato: "2024",
  lugar: { pais: "BR", regiao: "SP" },
  situacao: "arquivado",
  confianca: "primaria",
  fontes: [fonte({ id: "f1", veiculo: "TCU", tipo: "dado_oficial", titulo: "Acórdão", url: "https://pesquisa.apps.tcu.gov.br/exemplo" })],
  pessoas: [],
  organizacoes: ["o1"],
  publicadoEm: "2024-06-01",
  atualizadoEm: "2025-02-10",
});
const dossies = [
  { slug: "povos-indigenas", ordem: 1, cor: "vermelho", titulo: "Povos indígenas", descricao: "d1" },
  { slug: "crimes-ambientais", ordem: 2, cor: "azul", titulo: "Crimes ambientais", descricao: "d2" },
  { slug: "trabalho-escravo", ordem: 3, cor: "amarelo", titulo: "Trabalho escravo", descricao: "d3" },
  { slug: "dinheiro-publico", ordem: 4, cor: "amarelo", titulo: "Dinheiro público", descricao: "d4" },
];
const lidos = [
  { pessoas: [pessoa()], organizacoes: [org()], ligacoes: [], entradas: [e1] },
  { pessoas: [pessoa()], organizacoes: [], ligacoes: [], entradas: [e2] },
  {
    pessoas: [],
    organizacoes: [org()],
    ligacoes: [{ id: "l1", de: { tipo: "organizacao", id: "o1" }, para: { tipo: "pessoa", id: "p1" }, tipo: "dirige", fonteIds: ["f1"], entradaId: "2026-exemplo-fazenda", rotulo: "segundo a Repórter Brasil, é dirigida por ele" }],
    entradas: [e3],
  },
];
const dados = juntarDossies(lidos, dossies);
// A ligação de e3 aponta para entrada de outro lote: só entra se a entrada existe no filtro.
dados.ligacoes[0].entradaId = "2026-exemplo-fazenda";

// ───────────────────────────── Dados e consultas ─────────────────────────────
console.log("Dados e consultas");
caso("juntarDossies não repete pessoa nem organização", () => {
  assert.equal(dados.pessoas.length, 1);
  assert.equal(dados.organizacoes.length, 1);
  assert.equal(dados.entradas.length, 3);
});
caso("casos da pessoa trazem a situação DELA em cada caso", () => {
  const c = casosDaPessoa(dados, "p1");
  assert.equal(c.length, 2);
  assert.deepEqual(c.map((x) => x.situacao).sort(), ["denunciado", "investigado"]);
});
caso("casos da organização", () => assert.deepEqual(casosDaOrganizacao(dados, "o1").map((e) => e.id).sort(), ["2024-exemplo-arquivado", "2026-exemplo-fazenda"]));
caso("veículos, lista com e, código de arquivo e data", () => {
  assert.deepEqual(veiculosDaEntrada(e1), ["Repórter Brasil"]);
  assert.equal(listaComE(["A", "B", "C"]), "A, B e C");
  assert.equal(listaComE(["A"]), "A");
  assert.equal(codigoDeArquivo(7), "VE-0007");
  assert.equal(formatarData("2026-11-04", "pt"), "04/11/2026");
  assert.equal(formatarData("2026-11-04", "en"), "2026-11-04");
  assert.equal(formatarData("2026-03", "pt"), "03/2026");
  assert.equal(anoDe("2026-03"), 2026);
  assert.ok(Number.isFinite(dataParaMs("2024")));
});
caso("índice de arquivo segue a ordem de publicação", () => {
  const i = indicesDeArquivo(dados.entradas);
  assert.equal(i.get("2024-exemplo-arquivado"), 1);
  assert.equal(i.get("2025-exemplo-garimpo"), 2);
  assert.equal(i.get("2026-exemplo-fazenda"), 3);
});
caso("contagem por situação soma o total", () => {
  const c = contarPorSituacao(dados.entradas);
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 3);
  assert.equal(c.arquivado, 1);
});

// ───────────────────────────── Teia ─────────────────────────────
console.log("Teia");
const g = montarGrafo(dados);
caso("a teia tem nó de caso, pessoa, organização e lugar", () => {
  const tipos = new Set(g.nos.map((n) => n.tipo));
  for (const t of ["entrada", "pessoa", "organizacao", "lugar"]) assert.ok(tipos.has(t), t);
  assert.equal(g.nos.filter((n) => n.tipo === "entrada").length, 3);
});
caso("ligação pessoa→caso leva a situação jurídica da pessoa", () => {
  const a = g.arestas.find((x) => x.de === chaveDe("pessoa", "p1") && x.para === chaveDe("entrada", e2.id));
  assert.ok(a);
  assert.equal(a.situacao, "denunciado");
});
caso("toda aresta liga dois nós que existem (sem aresta solta)", () => {
  const chaves = new Set(g.nos.map((n) => n.chave));
  for (const a of g.arestas) assert.ok(chaves.has(a.de) && chaves.has(a.para), a.id);
});
caso("a ligação explícita do arquivo entra só com fonte e com os dois nós na teia", () => {
  assert.ok(g.arestas.some((a) => a.id === "l:l1" && a.implicita === false && a.tipo === "dirige"));
  const filtrado = montarGrafo(dados, "crimes-ambientais");
  assert.ok(!filtrado.arestas.some((a) => a.id === "l:l1"));
});
caso("filtro por dossiê deixa só os casos dele", () => {
  const f = montarGrafo(dados, "dinheiro-publico");
  assert.equal(f.nos.filter((n) => n.tipo === "entrada").length, 1);
  assert.equal(montarGrafo(dados, "povos-indigenas").nos.length, 0);
});
caso("pessoa com papel proibido NÃO vira nó (vítima, criança, testemunha)", () => {
  const ruim = { ...dados, pessoas: [pessoa({ cargo: "testemunha do caso" })] };
  const gr = montarGrafo(ruim);
  assert.ok(!gr.nos.some((n) => n.tipo === "pessoa"));
});
caso("pessoa desconhecida na entrada não vira nó", () => {
  const sem = { ...dados, pessoas: [] };
  assert.ok(!montarGrafo(sem).nos.some((n) => n.tipo === "pessoa"));
});
caso("grau conta as ligações e a vizinhança é simétrica", () => {
  const no = g.nos.find((n) => n.chave === chaveDe("pessoa", "p1"));
  assert.equal(no.grau, vizinhos(g, no.chave).length);
  assert.ok(no.grau >= 2);
});
caso("lista textual cobre todos os nós e cita as ligações em palavras", () => {
  const l = listaTextual(g);
  assert.equal(l.length, g.nos.length);
  assert.equal(l[0].no.tipo, "entrada");
  assert.ok(l.every((x) => Array.isArray(x.ligacoes)));
});
caso("grafo vazio não quebra nenhuma visão", () => {
  const v = montarGrafo({ ...dados, entradas: [], pessoas: [], organizacoes: [], ligacoes: [] });
  assert.equal(v.nos.length, 0);
  assert.equal(centroPadrao(v), null);
  assert.deepEqual(layoutOrbita(v, null, 1000, 640).nos, []);
  assert.equal(layoutGrupos(v, dossies, 1000, 640).nos.length, 0);
  assert.deepEqual(layoutFluxo([], dossies, 700, 640).faixas, []);
  assert.equal(layoutLinha([], dossies, 1000, 640).marcas.length, 0);
});

// ───────────────────────────── Visões ─────────────────────────────
console.log("Visões");
caso("órbita: o centro fica no meio e os anéis crescem", () => {
  const c = chaveDe("pessoa", "p1");
  const o = layoutOrbita(g, c, 1000, 640);
  const centro = o.nos.find((n) => n.chave === c);
  assert.equal(centro.x, 500);
  assert.equal(centro.y, 320);
  assert.equal(o.nos.length, g.nos.length);
  const salto = saltosAPartirDe(g, c);
  assert.equal(salto.get(c), 0);
  assert.ok(o.nos.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
  assert.ok(o.aneis.every((r, i, a) => i === 0 || r > a[i - 1]));
});
caso("grupos: um aglomerado por dossiê que tem nó, todos os nós posicionados", () => {
  const gr = layoutGrupos(g, dossies, 1000, 640);
  assert.ok(gr.grupos.length >= 3);
  assert.equal(gr.nos.length, g.nos.length);
  assert.ok(gr.nos.every((n) => Number.isFinite(n.x) && n.x >= 0 && n.x <= 1000));
});
caso("fluxo: a soma das faixas é o número de casos e cada situação aparece", () => {
  const f = layoutFluxo(dados.entradas, dossies, 700, 640);
  assert.equal(f.faixas.reduce((a, x) => a + x.total, 0), 3);
  assert.equal(f.direita.reduce((a, x) => a + x.total, 0), 3);
  assert.ok(f.direita.every((c) => SITUACOES.includes(c.chave)));
  assert.ok(f.faixas.every((x) => Number.isFinite(x.y0) && Number.isFinite(x.y1)));
});
caso("linha do tempo: uma marca por caso, na ordem das datas", () => {
  const l = layoutLinha(dados.entradas, dossies, 1000, 640);
  assert.equal(l.marcas.length, 3);
  for (let i = 1; i < l.marcas.length; i++) assert.ok(l.marcas[i].ms >= l.marcas[i - 1].ms);
  assert.ok(l.anos.length >= 1);
});
caso("linha do tempo com um caso só ainda desenha", () => {
  const l = layoutLinha([e1], dossies, 1000, 640);
  assert.equal(l.marcas.length, 1);
  assert.ok(Number.isFinite(l.marcas[0].x));
});
caso("níveis de zoom nomeados da teia e rótulos por nível", () => {
  assert.equal(nivelDaTeia(0.5), "panorama");
  assert.equal(nivelDaTeia(1), "dossie");
  assert.equal(nivelDaTeia(2), "caso");
  assert.equal(nivelDaTeia(5), "detalhe");
  assert.equal(rotuloVisivel("pessoa", "panorama", false), false);
  assert.equal(rotuloVisivel("entrada", "dossie", false), true);
  assert.equal(rotuloVisivel("pessoa", "dossie", false), false);
  assert.equal(rotuloVisivel("pessoa", "panorama", true), true);
});

// ───────────────────────────── Ao vivo (Realtime) ─────────────────────────────
console.log("Ao vivo");
caso("entrada nova aprovada entra; a atualização troca; a retirada tira", () => {
  const a = aplicarEntradaAoVivo(dados, "novo", { ...e1, id: "novo" });
  assert.equal(a.entradas.length, 4);
  const b = aplicarEntradaAoVivo(a, "novo", { ...e1, id: "novo", situacao: "absolvido", atualizadoEm: "2026-09-01" });
  assert.equal(b.entradas.length, 4);
  assert.equal(b.entradas.find((e) => e.id === "novo").situacao, "absolvido");
  assert.equal(aplicarEntradaAoVivo(b, "novo", null).entradas.length, 3);
  assert.equal(dados.entradas.length, 3, "não mexe no original");
});
caso("linha do Realtime válida vira ação 'pôr'", () => {
  const r = acaoDaLinha({ id: e1.id, dossie: e1.dossie, doc: e1, retirado_em: null }, dados);
  assert.equal(r.tipo, "pôr");
});
caso("linha retirada vira 'tirar'", () => assert.deepEqual(acaoDaLinha({ id: "x", doc: e1, retirado_em: "2026-10-01T00:00:00Z" }, dados), { tipo: "tirar", id: "x" }));
caso("linha sem fonte, sem situação ou sem arquivo do Internet Archive é ignorada", () => {
  assert.equal(acaoDaLinha({ id: e1.id, doc: { ...e1, fontes: [] } }, dados).tipo, "ignorar");
  const semSituacao = { ...e1 };
  delete semSituacao.situacao;
  assert.equal(acaoDaLinha({ id: e1.id, doc: semSituacao }, dados).tipo, "ignorar");
  assert.equal(acaoDaLinha({ id: e1.id, doc: { ...e1, fontes: [fonte({ arquivoUrl: undefined })] } }, dados).tipo, "ignorar");
  assert.equal(acaoDaLinha(null, dados).tipo, "ignorar");
  assert.equal(acaoDaLinha({ id: "outro", doc: e1 }, dados).tipo, "ignorar");
});
caso("pessoa desconhecida no canal é cortada (nome de pessoa nunca chega pelo canal)", () => {
  const r = acaoDaLinha({ id: e1.id, doc: { ...e1, pessoas: [{ pessoaId: "estranha", situacao: "reu" }, ...e1.pessoas] } }, dados);
  assert.equal(r.tipo, "pôr");
  assert.deepEqual(r.entrada.pessoas.map((p) => p.pessoaId), ["p1"]);
});

// ───────────────────────────── Textos, estilo e estrutura ─────────────────────────────
console.log("Textos, estilo e estrutura");
const idiomas = ["pt", "en", "es", "fr", "ru", "zh"];
const chavesDe = (o, prefixo = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chavesDe(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]));
const textos = Object.fromEntries(idiomas.map((l) => [l, JSON.parse(ler("i18n", "vale-o-escrito", `${l}.json`))]));
caso("seção 'visual' existe nos 6 idiomas com as mesmas chaves e nenhum valor vazio", () => {
  const base = chavesDe(textos.pt.visual).sort();
  assert.ok(base.length > 60);
  for (const l of idiomas) {
    assert.deepEqual(chavesDe(textos[l].visual).sort(), base, l);
    const vazios = base.filter((k) => String(k.split(".").reduce((o, p) => o?.[p], textos[l].visual) ?? "").trim() === "");
    assert.deepEqual(vazios, [], `${l}: vazios`);
  }
});
caso("todo tipo de ligação e de nó tem rótulo", () => {
  for (const l of idiomas) {
    for (const t of ["integra", "dirige", "financia", "contrata", "doa_para", "investiga", "denuncia", "citado_em", "ocorreu_em", "relacionada"]) assert.ok(textos[l].visual.ligacao[t], `${l} ${t}`);
    for (const t of ["pessoa", "organizacao", "entrada", "lugar"]) assert.ok(textos[l].visual.tipoNo[t], `${l} ${t}`);
    for (const t of ["panorama", "dossie", "caso", "detalhe"]) assert.ok(textos[l].visual.zoomTeia[t], `${l} ${t}`);
  }
});
caso("nunca 'universidade' nem 'diploma' na interface, em nenhum idioma", () => {
  for (const l of idiomas) assert.ok(!/universidad|universit|diplom|университет|大学|文凭/i.test(JSON.stringify(textos[l])), l);
  for (const f of arquivosDe("components/vale-o-escrito", [".tsx", ".ts"])) {
    if (/Formulario/.test(f)) continue;
    assert.ok(!/universidade|diploma/i.test(fs.readFileSync(f, "utf8")), f);
  }
});
caso("CSS próprio, todo com escopo .ve (nada de :root, html ou body solto)", () => {
  const css = ler("styles", "vale-o-escrito.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/(^|[}\s,])(:root|html|body)\b/m.test(css.replace(/\.ve[^{]*\{/g, "")), "seletor solto");
  const seletores = css.split("}").map((b) => b.split("{")[0].trim()).filter((s) => s && !s.startsWith("@"));
  const soltos = seletores.filter((sel) => sel.split(",").some((p) => !p.trim().startsWith(".ve") && !/^\d+%$/.test(p.trim()) && p.trim() !== "from" && p.trim() !== "to"));
  assert.deepEqual(soltos, [], "regras fora do escopo .ve");
});
caso("só a página do observatório carrega o peso: d3-force só em Teia.tsx, sem import estático nos outros", () => {
  const donos = [...arquivosDe("components", [".tsx", ".ts"]), ...arquivosDe("lib", [".ts"]), ...arquivosDe("app", [".tsx", ".ts"])].filter((f) => /from\s+["']d3/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(donos.map((f) => path.basename(f)), ["Teia.tsx"]);
  const obs = ler("components", "vale-o-escrito", "Observatorio.tsx");
  assert.ok(/dynamic\(\(\) => import\("\.\/Teia"\)/.test(obs), "Teia dinâmica");
  assert.ok(/dynamic<PropsDoMapa>\(\(\) => import\("\.\/Mapa"\)/.test(obs), "Mapa dinâmico (encaixe do pacote mapa)");
  assert.ok(!/from "\.\/Teia"/.test(obs) && !/from "\.\/Mapa"/.test(obs));
  assert.ok(existe("components", "vale-o-escrito", "Mapa.tsx"));
});
caso("o layout raiz e o layout do observatório não importam nada daqui nem leem disco", () => {
  const lay = ler("app", "[lang]", "vale-o-escrito", "layout.tsx");
  assert.ok(!/^import .*from ".*(dados|consulta|node:fs|visual)/m.test(lay));
  for (const f of ["app/layout.tsx", "app/[lang]/layout.tsx"]) {
    if (existe(...f.split("/"))) assert.ok(!/vale-o-escrito/.test(ler(...f.split("/"))), f);
  }
});
caso("componentes de cliente não leem disco nem importam dados.ts/consulta.ts", () => {
  for (const f of arquivosDe("components/vale-o-escrito", [".tsx", ".ts"])) {
    const t = fs.readFileSync(f, "utf8").replace(/^import type .*$/gm, ""); // import de tipo some na compilação
    assert.ok(!/node:fs|from "fs"|vale-o-escrito\/dados"|vale-o-escrito\/consulta"|vale-o-escrito\/textos"/.test(t), f);
  }
  for (const f of ["visual.ts", "aovivo.ts"]) assert.ok(!/node:fs|@\//.test(ler("lib", "vale-o-escrito", f).replace(/\/\/.*$/gm, "")), f);
});
caso("rotas: página, caso, pessoa e organização; correção com ?caso= em toda ficha", () => {
  for (const r of ["page.tsx", "caso/[id]/page.tsx", "pessoa/[id]/page.tsx", "organizacao/[id]/page.tsx"]) assert.ok(existe("app", "[lang]", "vale-o-escrito", ...r.split("/")), r);
  const fichas = ler("components", "vale-o-escrito", "Fichas.tsx");
  // A página do pacote publico lê o código no caminho (correcao/[id]); ela ignora ?caso=, então o botão tem de usar o caminho.
  assert.ok(fichas.includes("/vale-o-escrito/correcao/${encodeURIComponent(casoId)}"));
  assert.ok(!fichas.includes("correcao?caso="));
  assert.ok(fichas.includes("direito_de_resposta") && fichas.includes("pedirCorrecao") && fichas.includes("direitoDeResposta"));
  assert.ok(/nunca|nuncaVitima/.test(fichas));
});
caso("fichas mostram situação jurídica, 'segundo [fonte]', fontes numeradas, 'atualizado em' e crédito da foto", () => {
  const fichas = ler("components", "vale-o-escrito", "Fichas.tsx");
  for (const t of ["SituacaoJuridica", "visual.ficha.segundo", "fontesNumeradas", "ficha.atualizadoEm", "fotoCredito"]) assert.ok(fichas.includes(t), t);
  const cartao = ler("components", "vale-o-escrito", "CartaoDeArquivo.tsx");
  assert.ok(cartao.includes("ve-clipe") && cartao.includes("foto.credito") && cartao.includes("foto.licenca") && cartao.includes("no-referrer"));
});
caso("acessibilidade: abas com papel, lista textual equivalente e atalho para ela", () => {
  const obs = ler("components", "vale-o-escrito", "Observatorio.tsx");
  for (const t of ['role="tablist"', 'role="tab"', 'role="tabpanel"', "aria-selected", 'id="ve-lista"', "pularParaLista", "<details", "ArrowDown", "ArrowRight"]) assert.ok(obs.includes(t), t);
  const teia = ler("components", "vale-o-escrito", "Teia.tsx");
  assert.ok(teia.includes("onKeyDown") && teia.includes("ArrowLeft") && teia.includes("zoomMais"));
  assert.ok(ler("components", "vale-o-escrito", "Primitivas.tsx").includes('role="button"'));
});
caso("ao vivo: Broadcast do banco (sem tabela exposta), só com serviço, cliente baixado sob demanda", () => {
  const h = ler("components", "vale-o-escrito", "useAoVivo.ts");
  assert.ok(h.includes('"broadcast"') && h.includes('"mudou"') && h.includes('"vale_publicada"') && h.includes('"retirada"') && !h.includes("postgres_changes") && h.includes("hasBackend") && h.includes('import("@/lib/vale-o-escrito/aovivo")'));
  assert.ok(!/localStorage|sessionStorage|document\.cookie|navigator\./.test(h), "sem rastreio");
});
caso("os seis nomes de visão e os três níveis de zoom do mapa existem nos textos", () => {
  for (const l of idiomas) {
    for (const v of ["teia", "orbita", "grupos", "fluxo", "mapa", "linha"]) assert.ok(textos[l].visoes[v], `${l} ${v}`);
    for (const z of ["pais", "estado", "municipio"]) assert.ok(textos[l].zoom[z], `${l} ${z}`);
  }
});

console.log(`\n${total} conferências do visual passaram.`);
