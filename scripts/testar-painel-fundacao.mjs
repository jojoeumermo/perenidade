// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere a fundação do painel novo (Etapa 8): nenhuma seção fora do mapa, 8 espaços, 4 moldes, um arquivo de tema só,
// nenhuma cor escrita à mão nos componentes novos e as bibliotecas instaladas. Rodar: npm run testar:painel-fundacao
import fs from "node:fs";
import path from "node:path";
import { ESPACOS, espacoDe, MAPA, MOLDES, moldeDe } from "../components/painel/estrutura.ts";

const raiz = path.join(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// 1. Todo id do registro de seções do painel está no mapa.
const painel = ler("components", "painel", "Painel.tsx");
const ids = [...painel.matchAll(/\{ id: "([a-z-]+)", nome: [^\n]*grupo: "[^"]*", mostra:/g)].map((m) => m[1]);
conferir("registro de seções lido", ids.length >= 53, `achei ${ids.length}`);
const semMapa = ids.filter((id) => !MAPA[id]);
conferir("nenhuma seção fora do mapa", semMapa.length === 0, semMapa.join(", "));
const sobrando = Object.keys(MAPA).filter((id) => !ids.includes(id));
conferir("mapa sem id que não existe mais", sobrando.length === 0, sobrando.join(", "));

// 2. Espaços e moldes.
conferir("8 espaços", ESPACOS.length === 8);
conferir("4 moldes", MOLDES.length === 4);
conferir("nomes dos espaços", ESPACOS.map((e) => e.nome).join("|") === "Mesa|Escrever e produzir|Revisar e publicar|Comunidade e atendimento|Equipe|Site e operação|Segurança|Minha conta");
const idsEsp = new Set(ESPACOS.map((e) => e.id));
const idsMol = new Set(MOLDES.map((m) => m.id));
conferir("todo mapeamento usa espaço e molde válidos", Object.values(MAPA).every((m) => idsEsp.has(m.espaco) && idsMol.has(m.molde)));
conferir("todo espaço tem pelo menos uma seção", ESPACOS.every((e) => Object.values(MAPA).some((m) => m.espaco === e.id)));
conferir("todo molde é usado", MOLDES.every((m) => Object.values(MAPA).some((x) => x.molde === m.id)));
conferir("seção nova cai no grupo antigo", espacoDe("inexistente", "Segurança") === "seguranca" && espacoDe("inexistente", "") === "mesa" && espacoDe("conta", "Produção") === "conta");
conferir("molde padrão é registro", moldeDe("inexistente") === "registro");

// 3. Um arquivo de tema; globals.css sem as camadas antigas do painel.
const tema = ler("styles", "painel-tema.css");
const globais = ler("app", "globals.css");
conferir("tema com os tokens", ["--pn-fundo", "--pn-superficie", "--pn-destaque: #a51810", "--pn-raio: 6px", "--pn-lutas"].every((t) => tema.includes(t)));
conferir("tema com escuro e alto contraste", tema.includes('[data-theme="dark"]') && tema.includes("prefers-color-scheme: dark") && tema.includes("data-contrast"));
conferir("linha das lutas com 2 px", /\.pn-menu-lutas\s*\{[^}]*height:\s*2px/.test(tema));
conferir("sem sombra deslocada no tema", !/box-shadow:s*-?[1-9]d*(px)?s+-?[1-9]d*(px)?s+0s/.test(tema));
conferir("sem pontilhado no tema", !/(?<!\[class~=")\b(dashed|dotted)\b\s*(?!"\])[^[]*;/.test(tema.replace(/\[class~="[a-z-]*(dashed|dotted)"\]/g, "").replace(/\.painel[^{]*(dashed|dotted)[^{]*\{/g, "")));
conferir("globals.css sem as camadas antigas", !/\.painel-item\b|\.painel-menu\b|\.painel-quadro\b|painel-trilho|painel-cunha|ambiente de trabalho \(30\/10/.test(globais));
conferir("Painel.tsx carrega o tema", painel.includes('import "@/styles/painel-tema.css"'));
conferir("Garamond só no título da página", /\.pn-titulo\s*\{[^}]*font-fonte|\.pn-titulo\s*\{[^}]*pn-fonte-titulo/.test(tema) && /\.painel:not\(\.painel-porta\) h1\s*\{[^}]*pn-fonte-titulo/.test(tema));

// 4. Componentes novos: sem cor à mão, sem window.confirm/prompt, sem palavras proibidas.
const novos = [];
for (const pasta of ["ui", "moldes"]) for (const a of fs.readdirSync(path.join(raiz, "components", "painel", pasta))) novos.push(["components", "painel", pasta, a]);
novos.push(["components", "painel", "Menu.tsx"], ["components", "painel", "estrutura.ts"]);
for (const caminho of novos) {
  const nome = caminho.slice(2).join("/");
  const t = ler(...caminho);
  conferir(`${nome}: sem cor escrita à mão`, !/#[0-9a-fA-F]{3,8}\b(?![^"']*["'])|["'`]#[0-9a-fA-F]{3,8}["'`]|\[#[0-9a-fA-F]{3,8}\]|rgba?\(/.test(t));
  conferir(`${nome}: sem window.confirm/prompt`, !/window\.(confirm|prompt)\b/.test(t));
  conferir(`${nome}: sem "universidade" nem "diploma"`, !/universidade|diploma/i.test(t));
  conferir(`${nome}: licença AGPL`, t.includes("AGPL-3.0-or-later"));
}

// 5. O menu mantém o que o tutorial e o resto do painel esperam.
const menu = ler("components", "painel", "Menu.tsx");
for (const tour of ["areas", "departamento", "ir-para", "recolher", "conta"]) conferir(`menu mantém data-tour="${tour}"`, menu.includes(`"${tour}"`));
conferir("menu usa o mapa", menu.includes("espacoDe") && menu.includes("ESPACOS"));
conferir("barra de baixo no celular", menu.includes("pn-barra-baixo"));

// 6. Bibliotecas.
const pkg = JSON.parse(ler("package.json"));
for (const dep of ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "@tanstack/react-table", "cmdk", "sonner"]) conferir(`dependência ${dep}`, Boolean(pkg.dependencies?.[dep]));
conferir("script testar:painel-fundacao registrado", Boolean(pkg.scripts?.["testar:painel-fundacao"]));

console.log(`painel-fundacao: ${ok} conferências ok, ${falhas.length} falhas.`);
if (falhas.length) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
