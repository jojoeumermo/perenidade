// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// P5, B2: Teoria revolucionária e Lutas do povo moram na Escola, abertas para ler (lib/escola/aulas-abertas.ts).
// Confere: a lista guardada bate com o conteúdo; os endereços antigos vão para o novo (301, no proxy) e só os que mudaram; os
// links do site apontam direto para a Escola; com a Escola desligada, nada muda; as páginas abrem sem conta e ficam no endereço
// do instituto; nada nas páginas novas grava quem leu o quê.
// Uso: npm run testar:escola-aulas-abertas

import { execFileSync } from "node:child_process";
import fs from "node:fs";

let certos = 0;
const falhas = [];
const confere = (nome, ok) => (ok ? certos++ : falhas.push(nome));
const igual = (nome, a, b) => confere(`${nome} (veio ${JSON.stringify(a)}, esperado ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b));

// 1. A lista guardada está em dia com content/trilhas.
try {
  execFileSync(process.execPath, ["scripts/gerar-aulas-abertas.mjs", "--conferir"], { stdio: "pipe" });
  confere("aulas-abertas.json em dia", true);
} catch {
  confere("aulas-abertas.json em dia (rode node scripts/gerar-aulas-abertas.mjs)", false);
}
const dados = JSON.parse(fs.readFileSync("lib/escola/aulas-abertas.json", "utf8"));
igual("14 disciplinas de Teoria revolucionária", dados.grupos.teoria.length, 14);
igual("12 disciplinas de Lutas do povo", dados.grupos.lutas.length, 12);
confere("toda trilha da lista é de uma das 26 disciplinas", Object.values(dados.trilhas).every((a) => [...dados.grupos.teoria, ...dados.grupos.lutas].includes(a)));
confere("a lista tem trilhas (Marxismo, Lutas)", Object.values(dados.trilhas).includes("marxismo") && Object.values(dados.trilhas).includes("feminismo"));

// 2. Com a Escola ligada (o recurso só liga pelo nome).
process.env.NEXT_PUBLIC_RECURSOS = "escola";
const a = await import("../lib/escola/aulas-abertas.ts");
const trilhaDeMarxismo = Object.entries(dados.trilhas).find(([, area]) => area === "marxismo")[0];
const trilhaDoSite = fs.readdirSync("content/trilhas").find((t) => fs.existsSync(`content/trilhas/${t}/_trilha.md`) && !(t in dados.trilhas));

igual("a estante de Marxismo vai para a Escola", a.enderecoAntigoDaEscola("/pt/estantes/marxismo"), "/pt/escola/aulas/marxismo");
igual("a estante de Matemática fica", a.enderecoAntigoDaEscola("/pt/estantes/matematica"), null);
igual("a trilha vai para debaixo da disciplina", a.enderecoAntigoDaEscola(`/en/trilhas/${trilhaDeMarxismo}`), `/en/escola/aulas/marxismo/${trilhaDeMarxismo}`);
igual("a aula vai para a Escola", a.enderecoAntigoDaEscola(`/pt/trilhas/${trilhaDeMarxismo}/uma-aula`), `/pt/escola/aulas/marxismo/${trilhaDeMarxismo}/uma-aula`);
igual("a prova da trilha fica no site", a.enderecoAntigoDaEscola(`/pt/trilhas/${trilhaDeMarxismo}/prova`), null);
igual("o kit de núcleo fica no site", a.enderecoAntigoDaEscola(`/pt/trilhas/${trilhaDeMarxismo}/nucleo`), null);
igual("o texto puro da aula fica no site", a.enderecoAntigoDaEscola(`/pt/trilhas/${trilhaDeMarxismo}/uma-aula/texto`), null);
igual("o cordel da aula fica no site", a.enderecoAntigoDaEscola(`/pt/trilhas/${trilhaDeMarxismo}/uma-aula/cordel`), null);
igual("trilha de outra disciplina fica", a.enderecoAntigoDaEscola(`/pt/trilhas/${trilhaDoSite}`), null);
igual("sem idioma, o proxy põe o idioma antes", a.enderecoAntigoDaEscola(`/trilhas/${trilhaDeMarxismo}`), null);
igual("idioma estranho não vale", a.enderecoAntigoDaEscola("/xx/estantes/marxismo"), null);
igual("a lista de /trilhas fica", a.enderecoAntigoDaEscola("/pt/trilhas"), null);
igual("o caminho da estante", a.caminhoDaEstante("feminismo"), "/escola/aulas/feminismo");
igual("o caminho da estante do site", a.caminhoDaEstante("matematica"), "/estantes/matematica");
igual("o caminho da trilha pelo objeto", a.caminhoDaTrilha({ slug: trilhaDeMarxismo, area: "marxismo" }), `/escola/aulas/marxismo/${trilhaDeMarxismo}`);
igual("o caminho da trilha pelo nome", a.caminhoDaTrilha(trilhaDeMarxismo), `/escola/aulas/marxismo/${trilhaDeMarxismo}`);
igual("o caminho da aula", a.caminhoDaAula(trilhaDeMarxismo, "x"), `/escola/aulas/marxismo/${trilhaDeMarxismo}/x`);
igual("o caminho pelo lessonId", a.caminhoDoLessonId(`${trilhaDeMarxismo}/x`), `/escola/aulas/marxismo/${trilhaDeMarxismo}/x`);
igual("aula do site continua em /trilhas", a.caminhoDaAula(trilhaDoSite, "x"), `/trilhas/${trilhaDoSite}/x`);
confere("as aulas abertas são caminho da Escola aberta", a.caminhoDasAulasAbertas("/escola/aulas") && a.caminhoDasAulasAbertas("/escola/aulas/marxismo/x/y/") && !a.caminhoDasAulasAbertas("/escola/aulasx") && !a.caminhoDasAulasAbertas("/escola"));

// 3. A porta deixa passar, e as aulas ficam no endereço do instituto.
const rotas = await import("../lib/escola/rotas.ts");
confere("publicaDaEscola: as aulas abertas", rotas.publicaDaEscola("/escola/aulas") && rotas.publicaDaEscola("/escola/aulas/marxismo"));
confere("publicaDaEscola: o resto da Escola continua fechado", !rotas.publicaDaEscola("/escola") && !rotas.publicaDaEscola("/escola/formacao") && !rotas.publicaDaEscola("/escola/nucleo"));
const endereco = await import("../lib/escola/endereco.ts");
const BASE = "https://escola.institutolucia.org";
igual("no site, as aulas abertas não vão para o endereço da Escola", endereco.caminhoDoSiteParaEscola("/pt/escola/aulas/marxismo", "", BASE), null);
igual("no host da Escola, as aulas abertas voltam ao site", endereco.rotaNaEscola("/pt/escola/aulas/marxismo"), { tipo: "site", destino: "/pt/escola/aulas/marxismo" });
igual("a Escola fechada continua indo para lá", endereco.caminhoDoSiteParaEscola("/pt/escola/formacao", "", BASE), `${BASE}/pt/escola/formacao`);

// 4. O código: proxy com 301, porta sem casca nas aulas, links do site direto para a Escola, páginas sem gravar nada.
const ler = (f) => fs.readFileSync(f, "utf8");
const proxy = ler("proxy.ts");
confere("o proxy manda o endereço antigo com 301", /enderecoAntigoDaEscola\(pathname\)/.test(proxy) && /NextResponse\.redirect\(url, 301\)/.test(proxy.slice(proxy.indexOf("enderecoAntigoDaEscola(pathname)"))));
confere("a porta usa a moldura pública nas aulas, também para militante", /caminhoDasAulasAbertas\(semIdioma\) \|\|/.test(ler("components/escola/PortaDaEscola.tsx")));
for (const [f, padrao] of [
  ["components/DisciplineBrowser.tsx", /caminhoDaEstante\(card\.slug\)/],
  ["components/Cards.tsx", /caminhoDaTrilha\(track\)/],
  ["app/[lang]/trilhas/[track]/page.tsx", /caminhoDaAula\(track, item\.slug\)/],
  ["app/[lang]/trilhas/[track]/[lesson]/page.tsx", /const path = \(slug: string\) => caminhoDaAula\(track, slug\)/],
  ["app/sitemap.ts", /caminhoDaEstante\(area\)/],
  ["lib/dados-estruturados.ts", /caminhoDaAula\(trilha, aula\.slug\)/],
  ["lib/indice-de-busca.ts", /href: caminhoDaAula\(track, lesson\.slug\)/],
]) confere(`${f} aponta direto para a Escola`, padrao.test(ler(f)));
const paginas = ["app/[lang]/escola/aulas/page.tsx", "app/[lang]/escola/aulas/[area]/page.tsx", "app/[lang]/escola/aulas/[area]/[track]/page.tsx", "app/[lang]/escola/aulas/[area]/[track]/[lesson]/page.tsx", "components/escola/aulas/VoltarAsAulasAbertas.tsx"];
for (const f of paginas) {
  confere(`${f} existe`, fs.existsSync(f));
  confere(`${f} não chama o banco nem grava nada (quem lê não deixa rastro)`, !/\brpc\(|fetch\(|getClient|localStorage|sessionStorage|escola_eu|useEscola/.test(ler(f)));
}
confere("a aula da Escola é a mesma do site (mesmo módulo, mesmo lessonId)", /from "@\/app\/\[lang\]\/trilhas\/\[track\]\/\[lesson\]\/page"/.test(ler(paginas[3])));
confere("a página do site não monta de novo as trilhas da Escola", /filter\(\(track\) => !areaNaEscola\(track\.area\)\)/.test(ler("app/[lang]/trilhas/[track]/[lesson]/page.tsx")));
confere("o prebuild gera a lista", /gerar-aulas-abertas\.mjs/.test(JSON.parse(ler("package.json")).scripts.prebuild));
confere("a porta vermelha leva às aulas abertas", /\/escola\/aulas/.test(ler("components/escola/porta/PortaVermelha.tsx")));
const porta = JSON.parse(ler("i18n/escola/formacao-base/pt.json")).porta;
confere("a porta não diz mais que aqui dentro é só para militantes", !/só para militantes/.test(porta.texto) && /abertas/.test(porta.texto));

// 5. Com a Escola desligada, nada muda (em outro processo: o recurso é lido ao carregar).
const desligada = execFileSync(
  process.execPath,
  ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./scripts/carregar-ts.mjs", "--input-type=module", "-e",
    `const a = await import("./lib/escola/aulas-abertas.ts"); console.log(JSON.stringify([a.enderecoAntigoDaEscola("/pt/estantes/marxismo"), a.caminhoDaEstante("marxismo"), a.caminhoDaTrilha(${JSON.stringify(trilhaDeMarxismo)})]));`],
  { env: { ...process.env, NEXT_PUBLIC_RECURSOS: "" }, encoding: "utf8" },
).trim();
igual("com a Escola desligada, tudo fica no site", JSON.parse(desligada), [null, "/estantes/marxismo", `/trilhas/${trilhaDeMarxismo}`]);

// 6. O trecho da janela (aula do site que cita uma aula da Escola): título, sem as cercas dos blocos e sem marcação.
const { trechoDoTexto } = await import("../lib/escola/trecho.ts");
const tr = trechoDoTexto("O que é feminismo\nIgualdade · Instituto Lúcia\n\nResumo da aula.\n\n```provocacao\nJá ouviu dizer?\n```\n\n## O que é\n\nTexto com **negrito** e [link](/x).", 900);
igual("o trecho: título", tr.titulo, "O que é feminismo");
igual("o trecho: parágrafos limpos", tr.paragrafos, ["Resumo da aula.", "Já ouviu dizer?", "O que é", "Texto com negrito e link."]);
confere("o trecho: corta o texto longo", trechoDoTexto(`T\nx\n\n${"palavra ".repeat(400)}`, 300).paragrafos[0].length < 600);
const trechoTsx = ler("components/escola/aulas/TrechoDaEscola.tsx");
confere("a janela pega só o texto puro do próprio site (/texto)", /fetch\(`\/\$\{partes\[0\]\}\/trilhas\/\$\{partes\[2\]\}\/\$\{partes\[3\]\}\/texto`\)/.test(trechoTsx) && !/rpc\(|localStorage/.test(trechoTsx));
confere("a janela só entra nas aulas do site, com a Escola ligada", /ligado\("escola"\) && !areaNaEscola\(track\.area\) && <TrechoDaEscola/.test(ler("app/[lang]/trilhas/[track]/[lesson]/page.tsx")));

console.log(`escola-aulas-abertas: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
