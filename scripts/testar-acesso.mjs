// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Acesso e confiança (E4-04): confere que cada frase do selo de privacidade é verdade e que o painel de qualidade bate
// com uma contagem feita de outro jeito.
//   1. Toda ferramenta da caixa (lib/areas.ts e os "case" de components/tools/ToolView.tsx) tem selo em lib/selos.ts.
//   2. O selo bate com o código da ferramenta: quem chama /api/... tem selo "instituto" com essa rota; quem usa a voz
//      do navegador, o assistente ou uma página de fora tem a parte certa; quem diz "fica no aparelho" não chama nada.
//   3. Cada rota "instituto" foi lida: existe, o método é o declarado, GET nunca promete "não guarda" e, quando o selo
//      promete, a rota não grava o que a pessoa mandou.
//   4. As âncoras da privacidade existem; os seis idiomas têm as mesmas frases; nada chama a Escola de universidade.
//   5. lib/qualidade.ts bate com uma contagem independente dos arquivos de content/.
//   6. O espelho: o passo de publicar fica inerte sem os segredos; a documentação fala da variável.
// Uso: npm run testar:acesso
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";
import { load } from "js-yaml";
import { tools } from "../lib/areas.ts";
import { lerAulasParaQualidade, resumirQualidade } from "../lib/qualidade.ts";
import { estiloDaPosicao, ladoDe, posicaoDoPonto } from "../lib/flutuantes.ts";
import { ANCORAS, fraseDoSelo, PARTES, SELOS_DAS_FERRAMENTAS, SELOS_DE_FORA, SERVICOS } from "../lib/selos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");
let certos = 0;
const falhas = [];
const ok = (nome, condicao, detalhe = "") => {
  if (condicao) certos++;
  else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
};
const igual = (nome, valor, esperado) => ok(nome, JSON.stringify(valor) === JSON.stringify(esperado), `veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);

// ───────────── 1. Toda ferramenta tem selo ─────────────
const ids = Object.keys(SELOS_DAS_FERRAMENTAS);
for (const id of tools) ok(`selo de ${id}`, ids.includes(id), "ferramenta sem selo em lib/selos.ts");
for (const id of ids) ok(`selo ${id} é ferramenta`, tools.includes(id), "entrada em lib/selos.ts sem ferramenta em lib/areas.ts");
const toolView = ler("components/tools/ToolView.tsx");
const casos = [...toolView.matchAll(/case "([a-z0-9-]+)":/g)].map((m) => m[1]);
for (const id of casos) ok(`case "${id}" do ToolView tem selo`, ids.includes(id));
ok("o ToolView mostra o selo", /selosDaFerramenta\(id\)/.test(toolView) && /<SelosDePrivacidade/.test(toolView));

// ───────────── 2. O selo bate com o código ─────────────
/** O corpo de uma função (do "function Nome(" até a chave que fecha no começo da linha). */
function corpoDe(texto, nome) {
  const inicio = texto.search(new RegExp(`(?:^|\\n)(?:export )?(?:default )?function ${nome}\\(`));
  if (inicio < 0) return "";
  const fim = texto.indexOf("\n}\n", inicio + 1);
  return texto.slice(inicio, fim < 0 ? undefined : fim + 2);
}
/** Os componentes carregados com dynamic() num arquivo: nome → { arquivo, exportado }. */
function dinamicos(texto, pasta) {
  const mapa = new Map();
  for (const m of texto.matchAll(/const (\w+) = dynamic\(\(\) => import\("([^"]+)"\)\.then\(\(m\) => m\.(\w+)\)/g)) mapa.set(m[1], { arquivo: resolver(pasta, m[2]), exportado: m[3] });
  return mapa;
}
function resolver(pasta, especificador) {
  const base = especificador.startsWith("@/") ? path.join(raiz, especificador.slice(2)) : path.resolve(pasta, especificador);
  for (const fim of [".tsx", ".ts", "/index.tsx"]) if (fs.existsSync(base + fim)) return base + fim;
  return base;
}
/** O texto que uma função usa: o corpo dela, o das funções do mesmo arquivo que ela chama e o dos componentes dynamic(). */
function textoUsado(arquivo, nome, vistos = new Set()) {
  const chave = `${arquivo}#${nome}`;
  if (vistos.has(chave) || !fs.existsSync(arquivo)) return "";
  vistos.add(chave);
  const texto = fs.readFileSync(arquivo, "utf8");
  const corpo = corpoDe(texto, nome);
  let tudo = corpo;
  const locais = new Set([...texto.matchAll(/(?:^|\n)(?:export )?function (\w+)\(/g)].map((m) => m[1]));
  const dyn = dinamicos(texto, path.dirname(arquivo));
  for (const usado of new Set([...corpo.matchAll(/<(\w+)[\s/>]|\b(\w+)\(/g)].map((m) => m[1] ?? m[2]))) {
    if (usado !== nome && locais.has(usado)) tudo += textoUsado(arquivo, usado, vistos);
    if (dyn.has(usado)) tudo += textoUsado(dyn.get(usado).arquivo, dyn.get(usado).exportado, vistos);
  }
  // Importações estáticas de componentes de outros arquivos (como PhetLista), quando usadas no corpo.
  for (const m of texto.matchAll(/import \{([^}]+)\} from "(\.{1,2}\/[^"]+|@\/components\/[^"]+)";/g)) {
    for (const importado of m[1].split(",").map((x) => x.trim().replace(/^type /, ""))) {
      if (importado && new RegExp(`<${importado}[\\s/>]`).test(corpo)) tudo += textoUsado(resolver(path.dirname(arquivo), m[2]), importado, vistos);
    }
  }
  return tudo;
}

const pastaDasFerramentas = path.join(raiz, "components/tools");
const dynDoToolView = dinamicos(toolView, pastaDasFerramentas);
const casoParaComponente = new Map();
{
  let pendentes = [];
  for (const linha of corpoDe(toolView, "Ferramenta").split("\n")) {
    const caso = /case "([a-z0-9-]+)":/.exec(linha);
    if (caso) pendentes.push(caso[1]);
    const tag = [...linha.matchAll(/<(\w+)[\s/>]/g)].map((m) => m[1]).find((n) => dynDoToolView.has(n) || n === "AtalhoDaIde");
    if (tag && pendentes.length) {
      for (const id of pendentes) casoParaComponente.set(id, tag);
      pendentes = [];
    }
  }
}
for (const id of tools) ok(`o código de ${id} foi achado no ToolView`, casoParaComponente.has(id));

const MARCAS = {
  api: (t) => [...t.matchAll(/fetch\(`\/api\/([a-z0-9-]+)/g)].map((m) => m[1]),
  assistente: (t) => /askAssistant\(/.test(t),
  voz: (t) => /speechSynthesis|\bfalar\(/.test(t),
  reconhecimento: (t) => /SpeechRecognition/.test(t),
  paginaDeFora: (t) => /<iframe src=\{/.test(t) || /fetch\(["`]https?:/.test(t),
};

for (const id of tools) {
  const componente = casoParaComponente.get(id);
  if (!componente) continue;
  const texto = componente === "AtalhoDaIde" ? corpoDe(toolView, "AtalhoDaIde") : textoUsado(dynDoToolView.get(componente).arquivo, dynDoToolView.get(componente).exportado);
  ok(`${id}: o corpo do componente ${componente} foi lido`, texto.length > 50);
  const selos = [SELOS_DAS_FERRAMENTAS[id].principal, ...(SELOS_DAS_FERRAMENTAS[id].partes ?? [])];
  const rotas = MARCAS.api(texto);
  for (const rota of rotas) ok(`${id} chama /api/${rota}: tem selo "instituto" com a rota`, selos.some((s) => s.tipo === "instituto" && s.rota === `app/api/${rota}/route.ts`));
  for (const s of selos.filter((s) => s.tipo === "instituto" && s.rota?.startsWith("app/api/"))) ok(`${id}: a rota ${s.rota} do selo é chamada pelo código`, rotas.some((r) => s.rota === `app/api/${r}/route.ts`));
  igual(`${id}: usa o assistente ⇔ selo do provedor de IA`, MARCAS.assistente(texto), selos.some((s) => s.servico === "ia"));
  igual(`${id}: usa a voz do navegador ⇔ selo da voz`, MARCAS.voz(texto), selos.some((s) => s.servico === "vozDoNavegador"));
  igual(`${id}: usa reconhecimento de fala ⇔ selo`, MARCAS.reconhecimento(texto), selos.some((s) => s.servico === "reconhecimentoDeFala"));
  igual(`${id}: abre página de fora ⇔ selo "externo" principal`, MARCAS.paginaDeFora(texto), SELOS_DAS_FERRAMENTAS[id].principal.tipo === "externo");
  if (SELOS_DAS_FERRAMENTAS[id].principal.tipo === "aparelho" && !SELOS_DAS_FERRAMENTAS[id].partes) {
    ok(`${id}: "fica no aparelho" e não chama nada`, !rotas.length && !MARCAS.assistente(texto) && !MARCAS.voz(texto) && !MARCAS.reconhecimento(texto) && !MARCAS.paginaDeFora(texto));
  }
}
// Os selos de fora da caixa, nos arquivos onde aparecem.
ok("selo do reforço no Assistente", /SELOS_DE_FORA\.assistente/.test(ler("components/Assistente.tsx")) && /askAssistant\(/.test(ler("components/Assistente.tsx")));
ok("selo do VLibras no botão", /SELOS_DE_FORA\.vlibras/.test(ler("components/estudo/AtivarVLibras.tsx")));
ok("selo do reconhecimento de fala na prática", /SELOS_DE_FORA\.reconhecimentoDeFala/.test(ler("components/Pratica.tsx")) && /SpeechRecognition/.test(ler("components/Pratica.tsx")));
ok("o VLibras vem do governo federal", /vlibras\.gov\.br/.test(ler("lib/vlibras.ts")));

// T11 (06/11/2026): os botões flutuantes (acessibilidade e VLibras) se movem, e o VLibras desliga de volta.
{
  const widget = ler("components/A11yWidget.tsx");
  const flutuantes = ler("lib/flutuantes.ts");
  const ativar = ler("components/estudo/AtivarVLibras.tsx");
  ok("T11: o botão de acessibilidade arrasta (mouse e dedo: pointer events e touch-none)", /arrastavel\(botao/.test(widget) && /touch-none/.test(widget) && /pointermove/.test(flutuantes));
  ok("T11: o canto se escolhe pelo painel (teclado), para os dois botões", /legenda=\{a\.move\}/.test(widget) && /legenda=\{a\.moveVLibras\}/.test(widget) && /gravarPosicao\("vlibras"/.test(widget));
  ok("T11: a posição fica só no aparelho, com try/catch, sem fetch", /localStorage\.setItem\(CHAVE_DOS_FLUTUANTES/.test(flutuantes) && /catch/.test(flutuantes) && !/fetch\(/.test(flutuantes));
  ok("T11: o VLibras tem botão para desligar", /desligarVLibras\(\)/.test(ativar) && /s\.desligar/.test(ativar) && /export function desligarVLibras/.test(ler("lib/vlibras.ts")));
  igual("T11: canto de cima à esquerda", estiloDaPosicao({ canto: "sup-esq" }, "2.75rem").right, "auto");
  igual("T11: ponto livre no meio da tela", ladoDe(posicaoDoPonto(512, 384, 44, 44, { w: 1024, h: 768 })), { direita: true, baixo: true });
  igual("T11: ponto livre no canto de cima à esquerda", posicaoDoPonto(0, 0, 44, 44, { w: 1024, h: 768 }), { x: 0, y: 0 });
  igual("T11: sem posição, o lugar de sempre", ladoDe(null), { direita: true, baixo: true });
}

// ───────────── 3. As rotas "instituto" ─────────────
const todosOsSelos = [...Object.values(SELOS_DAS_FERRAMENTAS), ...Object.values(SELOS_DE_FORA)].flatMap((item) => [item.principal, ...(item.partes ?? [])]);
const PALAVRAS_DO_PEDIDO = /\b(corpo|conferido|entrada|pergunta|imagem|palavra|busca|texto)\b/;
for (const selo of todosOsSelos.filter((s) => s.tipo === "instituto")) {
  ok(`selo "instituto" tem rota e método`, Boolean(selo.rota && selo.metodo), JSON.stringify(selo));
  if (!selo.rota) continue;
  ok(`a rota ${selo.rota} existe`, fs.existsSync(path.join(raiz, selo.rota)));
  if (!fs.existsSync(path.join(raiz, selo.rota))) continue;
  const codigo = ler(selo.rota);
  const metodo = selo.rota.startsWith("app/api/")
    ? ["GET", "POST", "PUT", "DELETE"].filter((m) => new RegExp(`export (async )?function ${m}\\b`).test(codigo))
    : [...codigo.matchAll(/method !== "(\w+)"/g)].map((m) => m[1]);
  igual(`${selo.rota}: método`, metodo, [selo.metodo]);
  // GET com o texto no endereço: a hospedagem registra o endereço por pouco tempo (privacidade, "Registros técnicos").
  if (selo.metodo === "GET") ok(`${selo.rota}: GET não promete "não guarda"`, !selo.naoGuarda);
  // Nenhuma rota do selo grava em banco ou arquivo direto.
  ok(`${selo.rota}: não grava em tabela nem arquivo`, !/\.(insert|upsert|update)\(|writeFile|appendFile|createWriteStream/.test(codigo));
  if (selo.naoGuarda) {
    // As únicas escritas da Edge Function são as chamadas ao banco (contagens): nenhuma leva o que a pessoa mandou.
    for (const chamada of codigo.match(/banco\("[a-z_]+",[^\n]*/g) ?? []) ok(`${selo.rota}: ${chamada.slice(0, 40)}… não leva o pedido`, !PALAVRAS_DO_PEDIDO.test(chamada.replace(/banco\("[a-z_]+"/, "")));
    for (const registro of codigo.match(/console\.\w+\([^\n]*/g) ?? []) ok(`${selo.rota}: o registro não leva o pedido`, !PALAVRAS_DO_PEDIDO.test(registro), registro);
    ok(`${selo.rota}: o próprio arquivo diz que não guarda`, /não\s*(?:\/\/\s*)?são guardadas nem registradas/.test(codigo));
  }
  if (selo.servico) {
    // "Quem é consultado não fica sabendo quem você é": o servidor pede com o próprio nome e só os cabeçalhos dele.
    ok(`${selo.rota}: consulta um serviço de fora pelo servidor`, /from "@\/lib\/externo"/.test(codigo) && /https:\/\//.test(codigo));
  }
}
const externo = ler("lib/externo.ts");
ok("lib/externo não repassa o endereço nem os cabeçalhos de quem pediu", !/x-forwarded-for|x-real-ip|cf-connecting-ip|pedido\.headers|request\.headers/i.test(externo.split("export function responder")[0]));

// ───────────── 4. Âncoras, idiomas e palavras proibidas ─────────────
const privacidade = ler("content/paginas/privacidade.md");
const slugger = new GithubSlugger();
const idsDaPrivacidade = new Set(privacidade.split("\n").map((l) => /^#{1,6} (.+)$/.exec(l)?.[1]).filter(Boolean).map((t) => slugger.slug(t.replace(/[*_`]/g, "").trim())));
for (const [tipo, ancora] of Object.entries(ANCORAS)) ok(`âncora de "${tipo}" existe na privacidade`, idsDaPrivacidade.has(ancora), ancora);
ok("a privacidade fala do dicionário consultado pelo servidor", /o dicionário, as frases traduzidas/.test(privacidade) && /nunca o seu navegador/.test(privacidade));
ok("a privacidade fala da voz do navegador gerada pela empresa", /essa voz é gerada pela empresa do navegador/.test(privacidade));

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"];
const textos = Object.fromEntries(IDIOMAS.map((l) => [l, JSON.parse(ler(`i18n/escola/acesso/${l}.json`))]));
const chaves = (obj, prefixo = "") => Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" ? chaves(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]));
const valores = (obj) => Object.values(obj).flatMap((v) => (typeof v === "object" ? valores(v) : [v]));
const chavesPt = chaves(textos.pt).sort();
for (const l of IDIOMAS) {
  igual(`i18n/escola/acesso/${l}.json tem as mesmas chaves do pt`, chaves(textos[l]).sort(), chavesPt);
  ok(`${l}: nenhum valor vazio`, valores(textos[l]).every((v) => typeof v === "string" && v.trim()));
  ok(`${l}: nada de universidade nem diploma`, !valores(textos[l]).some((v) => /universidade|universidad|university|université|университет|大学|diploma|diplôme|диплом|文凭|学位/i.test(v)));
  for (const s of SERVICOS) ok(`${l}: serviço ${s}`, Boolean(textos[l].servicos[s]));
  for (const p of PARTES) ok(`${l}: parte ${p}`, Boolean(textos[l].partes[p]));
  for (const selo of todosOsSelos) ok(`${l}: frase ${fraseDoSelo(selo)}`, Boolean(textos[l].selo[fraseDoSelo(selo)]));
  ok(`${l}: a frase de consulta tem {servico}`, textos[l].selo.institutoConsulta.includes("{servico}") && textos[l].selo.externo.includes("{servico}"));
}
igual("frase do dicionário", fraseDoSelo(SELOS_DAS_FERRAMENTAS.dicionario.principal), "institutoConsulta");
igual("frase do reforço", fraseDoSelo(SELOS_DE_FORA.assistente.principal), "institutoNaoGuarda");
igual("frase da calculadora", fraseDoSelo(SELOS_DAS_FERRAMENTAS.calculadora.principal), "aparelho");

// ───────────── 5. A qualidade bate com uma contagem independente ─────────────
const agora = new Date("2026-11-03T15:00:00Z");
igual(
  "resumirQualidade com dados de exemplo",
  resumirQualidade(
    [
      { trilha: "a", aula: "1", situacao: "revisada", faltam: 0, fontes: 2, quiz: 3, exercicios: 0 },
      { trilha: "a", aula: "2", situacao: "aprovada", faltam: 1, fontes: 0, quiz: 0, exercicios: 4 },
      { trilha: "a", aula: "3", situacao: "em-revisao", faltam: 0, fontes: 1, quiz: 1, exercicios: 0 },
      { trilha: "b", aula: "4", situacao: "em-revisao", faltam: 2, fontes: 0, quiz: 0, exercicios: 0 },
    ],
    [{ slug: "a", aulas: 3 }, { slug: "b", aulas: 1 }, { slug: "c", aulas: 0 }],
    agora,
  ),
  { data: "2026-11-03", aulas: 4, revisadas: 2, emRevisaoProntas: 1, emRevisaoFaltam: 1, comFontes: 2, comTeste: 2, comExercicio: 1, trilhas: 3, trilhasComAula: 2, trilhasSemAula: 1 },
);
igual("data no horário de Brasília (02h UTC ainda é o dia anterior)", resumirQualidade([], [], new Date("2026-11-04T02:00:00Z")).data, "2026-11-03");

/** A contagem independente: lê os arquivos com o js-yaml direto, sem lib/content, lib/frontmatter nem lib/pendencias. */
function contarDeOutroJeito() {
  const cabecalho = (texto) => {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
    return m ? (load(m[1]) ?? {}) : {};
  };
  const pasta = path.join(raiz, "content/trilhas");
  const conta = { aulas: 0, revisadas: 0, comFontes: 0, comTeste: 0, comExercicio: 0, trilhas: 0, trilhasComAula: 0, trilhasSemAula: 0 };
  for (const trilha of fs.readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const arquivoDaTrilha = path.join(pasta, trilha.name, "_trilha.md");
    if (!fs.existsSync(arquivoDaTrilha) || cabecalho(fs.readFileSync(arquivoDaTrilha, "utf8")).ativo === false) continue;
    conta.trilhas++;
    let n = 0;
    for (const nome of fs.readdirSync(path.join(pasta, trilha.name))) {
      if (!nome.endsWith(".md") || nome === "_trilha.md" || /\.[a-z]{2}\.md$/.test(nome)) continue;
      const dados = cabecalho(fs.readFileSync(path.join(pasta, trilha.name, nome), "utf8"));
      if (dados.ativo === false) continue;
      n++;
      conta.aulas++;
      if ((Array.isArray(dados.revisoes) && dados.revisoes.length > 0) || dados.revisada === true) conta.revisadas++;
      if (Array.isArray(dados.fontes) && dados.fontes.length) conta.comFontes++;
      if (Array.isArray(dados.quiz) && dados.quiz.length) conta.comTeste++;
      const aula = nome.replace(/^\d+-/, "").replace(/\.md$/, "");
      const ex = path.join(raiz, "content/exercicios", trilha.name, `${aula}.yml`);
      if (fs.existsSync(ex) && (load(fs.readFileSync(ex, "utf8")) ?? []).length > 0) conta.comExercicio++;
    }
    if (n) conta.trilhasComAula++;
    else conta.trilhasSemAula++;
  }
  return conta;
}
const lidas = lerAulasParaQualidade(raiz);
const q = resumirQualidade(lidas.aulas, lidas.trilhas, agora);
const independente = contarDeOutroJeito();
for (const chave of Object.keys(independente)) igual(`qualidade.${chave} bate com a contagem independente`, q[chave], independente[chave]);
igual("em revisão (prontas + faltam) = aulas - revisadas", q.emRevisaoProntas + q.emRevisaoFaltam, q.aulas - q.revisadas);
ok("há aulas para contar", q.aulas > 100, String(q.aulas));

// ───────────── 6. Espelho ─────────────
const espelho = ler(".github/workflows/espelho.yml");
ok("espelho.yml continua gerando e guardando o .zip", /node scripts\/gerar-espelho\.mjs/.test(espelho) && /retention-days: 90/.test(espelho));
const passoDePublicar = espelho.split(/\n\s+- name: /).find((p) => /wrangler/.test(p)) ?? "";
ok("o passo de publicar existe e só roda com os segredos", Boolean(passoDePublicar) && /if: \$\{\{ env\.PUBLICAR_ESPELHO == 'true' \}\}/.test(passoDePublicar) && /PUBLICAR_ESPELHO: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN != '' && secrets\.CLOUDFLARE_ACCOUNT_ID != '' && vars\.ESPELHO_PROJETO != '' \}\}/.test(espelho));
// Os segredos só aparecem no passo que publica: o npm ci e o gerador do espelho não os recebem.
ok("os segredos ficam só no passo de publicar", espelho.split("secrets.CLOUDFLARE_API_TOKEN }}").length === 2 && /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/.test(passoDePublicar));
ok("nenhum segredo escrito no workflow", !/[A-Za-z0-9_-]{32,}/.test(espelho.replace(/@[0-9a-f]{40}/g, "")));
ok("a versão do wrangler é fixa", /wrangler@\d+\.\d+\.\d+/.test(espelho));
const doc = ler("docs/ESPELHO-E-COPIAS.md");
ok("a documentação explica NEXT_PUBLIC_ESPELHOS", /NEXT_PUBLIC_ESPELHOS/.test(doc));
ok("a documentação explica os segredos do passo de publicar", /CLOUDFLARE_API_TOKEN/.test(doc) && /ESPELHO_PROJETO/.test(doc));
ok("a página fora do ar mostra os espelhos", /htmlDosEspelhos\(lang\)/.test(ler("app/[lang]/fora-do-ar/route.ts")));
ok("/status mostra espelhos e qualidade", /<EspelhosDoSite/.test(ler("app/[lang]/status/page.tsx")) && /<QualidadeDoConteudo/.test(ler("app/[lang]/status/page.tsx")));

console.log(`testar-acesso: ${certos} conferências certas, ${falhas.length} falhas`);
console.log(`  qualidade: ${JSON.stringify(q)}`);
if (falhas.length) {
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
