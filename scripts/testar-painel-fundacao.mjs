// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a fundação do painel (contrato: docs/PAINEL-REDESENHO.md): nenhuma seção fora do mapa, 8 espaços, 4 moldes, um
// arquivo de tema só com os tokens do redesenho, a casca sem o defeito do grid, nenhuma cor escrita à mão nos componentes,
// as bibliotecas só no painel e com versão fixa. Rodar: npm run testar:painel-fundacao
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ESPACOS, espacoDe, MAPA, MOLDES, moldeDe } from "../components/painel/estrutura.ts";

const raiz = path.join(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
function arquivos(pasta) {
  const lista = [];
  if (!fs.existsSync(pasta)) return lista;
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) lista.push(...arquivos(p));
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) lista.push(p);
  }
  return lista;
}

// 1. Todo id do registro de seções do painel está no mapa. O registro mudou de Painel.tsx para casca/Dentro.tsx (o
//    painel aberto passou a carregar só no navegador, por next/dynamic: contrato, seção 4).
const painel = ler("components", "painel", "Painel.tsx");
const dentro = ler("components", "painel", "casca", "Dentro.tsx");
const ids = [...dentro.matchAll(/\{ id: "([a-z-]+)", nome: [^\n]*grupo: "[^"]*", mostra:/g)].map((m) => m[1]);
conferir("registro de seções lido", ids.length >= 53, `achei ${ids.length}`);
const semMapa = ids.filter((id) => !MAPA[id]);
conferir("nenhuma seção fora do mapa", semMapa.length === 0, semMapa.join(", "));
const sobrando = Object.keys(MAPA).filter((id) => !ids.includes(id));
conferir("mapa sem id que não existe mais", sobrando.length === 0, sobrando.join(", "));
conferir("Painel.tsx carrega o painel aberto só no navegador", /dynamic\(\(\) => import\("\.\/casca\/Dentro"\)[\s\S]*ssr: false/.test(painel));

// 2. Espaços e moldes.
conferir("8 espaços", ESPACOS.length === 8);
conferir("4 moldes", MOLDES.length === 4);
conferir("nomes dos espaços", ESPACOS.map((e) => e.nome).join("|") === "Mesa|Escrever e produzir|Revisar e publicar|Comunidade e atendimento|Equipe|Site e operação|Segurança|Minha conta");
conferir("ícones Lucide dos espaços", ESPACOS.map((e) => e.icone).join("|") === "House|PenTool|CheckCheck|HeartHandshake|Users|Settings2|Shield|UserRound");
const idsEsp = new Set(ESPACOS.map((e) => e.id));
const idsMol = new Set(MOLDES.map((m) => m.id));
conferir("todo mapeamento usa espaço e molde válidos", Object.values(MAPA).every((m) => idsEsp.has(m.espaco) && idsMol.has(m.molde)));
conferir("todo espaço tem pelo menos uma seção", ESPACOS.every((e) => Object.values(MAPA).some((m) => m.espaco === e.id)));
conferir("todo molde é usado", MOLDES.every((m) => Object.values(MAPA).some((x) => x.molde === m.id)));
conferir("seção nova cai no grupo antigo", espacoDe("inexistente", "Segurança") === "seguranca" && espacoDe("inexistente", "") === "mesa" && espacoDe("conta", "Produção") === "conta");
conferir("molde padrão é registro", moldeDe("inexistente") === "registro");
const icones = ler("components", "painel", "icones.tsx");
const semIcone = Object.keys(MAPA).filter((id) => !new RegExp(`(^|\\s|")${id.replace("-", "\\-")}"?: [A-Z]`, "m").test(icones));
conferir("toda seção do mapa tem ícone Lucide", semIcone.length === 0, semIcone.join(", "));

// 3. Um arquivo de tema; globals.css sem as camadas antigas do painel.
const tema = ler("styles", "painel-tema.css");
const globais = ler("app", "globals.css");
conferir("tema com os tokens", ["--pn-fundo: color-mix(in srgb, var(--parchment) 50%, var(--parchment-deep))", "--pn-superficie: color-mix(in srgb, var(--parchment) 60%, var(--folha))", "--pn-destaque: #a51810", "--pn-raio: 6px", "--pn-raio-cartao: 10px", "--pn-lutas", "--pn-menu-fundo: #2a231c", "--pn-texto-mudo", "--pn-ouro"].every((t) => tema.includes(t)));
// T24/T25 (06/11/2026): o papel do painel nasce dos tokens do site e o menu lateral ficou um tom mais claro.
conferir("T25: papel do painel pelos tokens do site", tema.includes("--pn-texto: var(--ink);") && tema.includes("--pn-borda: var(--rule);"));
conferir("tema com escuro e alto contraste", tema.includes('[data-theme="dark"]') && tema.includes("prefers-color-scheme: dark") && tema.includes("data-contrast"));
// O contrato do redesenho engrossou a faixa das lutas do menu de 2 para 3 px (de propósito: é a marca no topo do menu).
conferir("faixa das lutas com 3 px", /\.pn-menu-lutas\s*\{[^}]*height:\s*3px/.test(tema));
conferir("sem fundo branco puro na área de trabalho", !/--pn-(fundo|superficie):\s*#fff(fff)?\b/.test(tema.split(":root:is([data-contrast], [data-eink])")[0]));
conferir("sem sombra deslocada no tema", !/box-shadow:\s*-?[1-9]\d*(px)?\s+-?[1-9]\d*(px)?\s+0\s/.test(tema));
conferir("sem pontilhado no tema", !/(?<!\[class~=")\b(dashed|dotted)\b\s*(?!"\])[^[]*;/.test(tema.replace(/\[class~="[a-z-]*(dashed|dotted)"\]/g, "").replace(/\.painel[^{]*(dashed|dotted)[^{]*\{/g, "")));
conferir("globals.css sem as camadas antigas", !/\.painel-item\b|\.painel-menu\b|\.painel-quadro\b|painel-trilho|painel-cunha|ambiente de trabalho \(30\/10/.test(globais));
conferir("Painel.tsx carrega o tema", painel.includes('import "@/styles/painel-tema.css"'));
// O contrato do redesenho devolveu a Garamond aos títulos de seção (h1, h2 e h3 em .font-serif), não só ao h1.
conferir("Garamond nos títulos", /\.pn-titulo\s*\{[^}]*pn-fonte-titulo/.test(tema) && /:is\(h1, h2, h3\)\.font-serif[\s\S]{0,80}pn-fonte-titulo/.test(tema));
conferir("rótulo em mono versalete", /\.pn-rotulo-mono\s*\{[^}]*pn-fonte-mono[^}]*uppercase/.test(tema));
conferir("foco visível em tudo", /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--pn-foco\)/.test(tema));
conferir("menos movimento respeitado", tema.includes("prefers-reduced-motion: reduce") && tema.includes("prefers-reduced-motion: no-preference"));

// 4. A casca sem o defeito do grid (contrato, seção 1): a raiz não é grade, a casca tem só o menu e a área, as camadas
//    vêm depois, e nada de regra que dependa da ordem dos filhos.
conferir("raiz .painel sem grid", !/className=\{?[^}\n]*"painel[^"]*\bgrid\b/.test(dentro) && !/lg:grid-cols-\[auto_minmax/.test(dentro + painel));
conferir("tema sem regra de ordem dos filhos", !/\.painel[^{,]*>\s*div:last-child/.test(tema) && !/\.painel\s*\{[^}]*grid-template-columns/.test(tema));
const fonte = ts.createSourceFile("Dentro.tsx", dentro, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let filhosDaCasca = null;
let ordemNaRaiz = null;
const nomeDe = (no) => (ts.isJsxElement(no) ? no.openingElement.tagName.getText(fonte) : no.tagName.getText(fonte));
const classeDe = (no) => {
  const abertura = ts.isJsxElement(no) ? no.openingElement : no;
  const attr = abertura.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(fonte) === "className");
  return attr?.initializer ? attr.initializer.getText(fonte) : "";
};
const filhosJsx = (no) => no.children.filter((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
(function andar(no) {
  if (ts.isJsxElement(no)) {
    const classe = classeDe(no);
    if (/"pn-casca"/.test(classe)) filhosDaCasca = filhosJsx(no).map((c) => `${nomeDe(c)}${classeDe(c).includes("pn-area") ? ".pn-area" : ""}`);
    if (/cx\("painel"/.test(classe)) ordemNaRaiz = filhosJsx(no).map((c) => `${nomeDe(c)}${/pn-casca/.test(classeDe(c)) ? ".pn-casca" : ""}`);
  }
  ts.forEachChild(no, andar);
})(fonte);
conferir("a casca tem exatamente o menu e a área", filhosDaCasca?.join(",") === "MenuDoPainel,div.pn-area", filhosDaCasca?.join(","));
conferir("a casca vem primeiro; barra de baixo e camadas depois", ordemNaRaiz?.join(",") === "div.pn-casca,BarraDeBaixo,Camadas", ordemNaRaiz?.join(","));
const camadas = ler("components", "painel", "casca", "Camadas.tsx");
conferir("avisos e confirmações só nas camadas", /<DialogosDoPainel\s*\/>/.test(camadas) && /<AvisosDoPainel\s*\/>/.test(camadas) && !/<AvisosDoPainel/.test(dentro));
conferir("troca de seção animada pela chave da seção", /<AnimatePresence[^>]*mode="popLayout"[^>]*initial=\{false\}/.test(dentro) && /<m\.div key=\{atual\.id\}/.test(dentro));
conferir("movimento passa pelo MotionConfig (reduzido para quem pediu)", /<MotionConfig reducedMotion=\{modoLeve \? "always" : "user"\}>/.test(dentro) && /<LazyMotion features=\{carregarRecursos\} strict>/.test(dentro));
conferir("pular para o conteúdo", dentro.includes('href="#pn-principal"') && dentro.includes('id="pn-principal"'));
// Nenhuma seção flutua com fixed no canto: só ui/, os avisos que bloqueiam a tela (termo, quadro de avisos, tutorial) e o
// editor de design (tela própria, intocado pelo redesenho). O convite dos 12 eixos ainda vem com "fixed" de
// EixosEquipe.tsx (a faixa "equipe" tira): até lá, a Mesa o monta dentro de .pn-convite-mesa, que o põe no fluxo.
const pastaPainel = path.join(raiz, "components", "painel");
const flutuantes = arquivos(pastaPainel)
  .map((a) => path.relative(pastaPainel, a).replaceAll("\\", "/"))
  .filter((r) => !/^(ui|design)\//.test(r) && !["Termo.tsx", "Avisos.tsx", "Tutorial.tsx"].includes(r))
  .filter((r) => /className="[^"]*\bfixed\b[^"]*\b(bottom|right)-/.test(ler("components", "painel", r)));
const pendentes = flutuantes.filter((r) => r !== "EixosEquipe.tsx");
conferir("nenhuma seção flutua no canto com fixed", pendentes.length === 0, pendentes.join(", "));
if (flutuantes.includes("EixosEquipe.tsx")) conferir("convite dos eixos no fluxo da Mesa", /<div className="pn-convite-mesa[^"]*">\s*<ConviteEixos/.test(dentro) && /\.pn-convite-mesa > aside\s*\{[^}]*position:\s*static/.test(tema));

// 5. Componentes da fundação: sem cor à mão, sem window.confirm/prompt, sem palavras proibidas, com a licença.
const novos = [];
for (const pasta of ["ui", "moldes", "casca"]) for (const a of fs.readdirSync(path.join(pastaPainel, pasta))) novos.push(["components", "painel", pasta, a]);
novos.push(["components", "painel", "Menu.tsx"], ["components", "painel", "estrutura.ts"], ["components", "painel", "estado.ts"], ["components", "painel", "icones.tsx"], ["components", "painel", "Atalhos.tsx"]);
for (const caminho of novos) {
  const nome = caminho.slice(2).join("/");
  const t = ler(...caminho);
  conferir(`${nome}: sem cor escrita à mão`, !/#[0-9a-fA-F]{3,8}\b(?![^"']*["'])|["'`]#[0-9a-fA-F]{3,8}["'`]|\[#[0-9a-fA-F]{3,8}\]|rgba?\(|text-white\b/.test(t));
  conferir(`${nome}: sem window.confirm/prompt`, !/window\.(confirm|prompt)\b/.test(t));
  conferir(`${nome}: sem "universidade" nem "diploma"`, !/universidade|diploma/i.test(t));
  conferir(`${nome}: licença AGPL`, t.includes("AGPL-3.0-or-later"));
  conferir(`${nome}: movimento só por m.* (LazyMotion strict)`, !/\bmotion\.[a-z]+\b/.test(t.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")));
}

// 6. O menu e a barra de cima mantêm o que o tutorial e o resto do painel esperam. O "ir-para" passou do menu para a
//    busca da barra de cima (contrato, seção 6), junto com o botão do menu do celular, o tutorial e o "Escrever".
const menu = ler("components", "painel", "Menu.tsx");
const barra = ler("components", "painel", "casca", "BarraSuperior.tsx");
for (const tour of ["areas", "departamento", "recolher", "conta"]) conferir(`menu mantém data-tour="${tour}"`, menu.includes(`"${tour}"`));
for (const tour of ["ir-para", "menu-celular", "tutorial", "escrever"]) conferir(`barra de cima tem data-tour="${tour}"`, barra.includes(`data-tour="${tour}"`));
conferir("menu usa o mapa", menu.includes("espacoDe") && menu.includes("ESPACOS"));
conferir("barra de baixo no celular", menu.includes("pn-barra-baixo"));
conferir("ativo do menu desliza (layoutId)", menu.includes('layoutId="pn-menu-ativo"') && menu.includes('aria-current={ativa ? "page" : undefined}'));
conferir("menu do celular é uma folha com foco preso", /Dialog\.Root/.test(menu) && /Dialog\.Title/.test(menu));
conferir("fixar tem nome e estado", /aria-label=\{`Fixar \$\{s\.nome\}`\}/.test(menu) && menu.includes("aria-pressed={fixada}"));

// 7. O estado da casca e a paleta.
const estado = ler("components", "painel", "estado.ts");
conferir("estado guardado só com as preferências", estado.includes('name: "lucia:painel-casca"') && /partialize:/.test(estado) && !/partialize:[\s\S]{0,400}(remendos|comandos|paleta):/.test(estado));
conferir("estado lê as chaves antigas uma vez", ["lucia:painel-compacto", "lucia:painel-grupos", "lucia:painel-atalhos", "lucia:painel-foco", "lucia:painel-leve"].every((c) => estado.includes(c)));
conferir("armazenamento com try/catch", /getItem: \(nome\) => \{\s*try \{/.test(estado));
const paleta = ler("components", "painel", "ui", "Paleta.tsx");
for (const grupo of ["Nesta seção", "Recentes", "Ir para", "Ações", "Pessoas", "Tarefas", "Preferências"]) conferir(`paleta com o grupo ${grupo}`, paleta.includes(`heading="${grupo}"`));
conferir("comando de perigo passa pelo confirmar", /c\.perigo && !\(await confirmar\(/.test(paleta));
const comum = ler("components", "painel", "comum.tsx");
conferir("Optimistic UI em comum.tsx", /export async function agirOtimista/.test(comum) && /export function useAcaoOtimista/.test(comum) && /tirarRemendo/.test(comum));

// 8. Bibliotecas: instaladas com versão fixa e importadas só no painel (o site público não paga por elas).
const pkg = JSON.parse(ler("package.json"));
for (const dep of ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@tanstack/react-table", "cmdk", "sonner"]) conferir(`dependência ${dep}`, Boolean(pkg.dependencies?.[dep]));
for (const dep of ["motion", "zustand", "lucide-react", "react-resizable-panels", "@radix-ui/react-dropdown-menu"]) conferir(`dependência ${dep} com versão fixa`, /^\d+\.\d+\.\d+$/.test(pkg.dependencies?.[dep] ?? ""), pkg.dependencies?.[dep]);
conferir("react-resizable-panels na linha 3", /^3\./.test(pkg.dependencies?.["react-resizable-panels"] ?? ""));
conferir("TipTap e Lexical não adotados", !Object.keys(pkg.dependencies ?? {}).some((d) => /tiptap|lexical/.test(d)));
const foraDoPainel = ["app", "components", "lib", "i18n"].flatMap((p) => arquivos(path.join(raiz, p))).filter((a) => !a.includes(`${path.sep}components${path.sep}painel${path.sep}`));
const vazadas = foraDoPainel.filter((a) => /from ["'](motion(\/[a-z-]+)?|framer-motion|zustand(\/[a-z]+)?|lucide-react|react-resizable-panels|@radix-ui\/react-dropdown-menu)["']/.test(fs.readFileSync(a, "utf8"))).map((a) => path.relative(raiz, a));
conferir("bibliotecas novas só em components/painel", vazadas.length === 0, vazadas.join(", "));
conferir("script testar:painel-fundacao registrado", Boolean(pkg.scripts?.["testar:painel-fundacao"]));

console.log(`painel-fundacao: ${ok} conferências ok, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
