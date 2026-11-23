// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 5, E1: o redesign atrás do recurso "design-novo" e o design de hoje guardado como "Contornos fortes".
//   · o recurso existe, é só pelo nome e nasce desligado ("todos" não o liga); no banco, o catálogo o tem só pelo nome e
//     ninguém o ligou (supabase/migracoes/20261126-p5-design.sql, que roda duas vezes sem erro);
//   · o <html> só ganha data-design="novo" com o recurso ligado, e a opção do botão de acessibilidade só aparece com ele;
//   · a escolha "Contornos fortes" fica no aparelho e é posta antes da primeira pintura (prefsScript), como o tema e o contraste;
//   · as peças do site leem as variáveis "--d-*" sempre com o valor de hoje como reserva, e as variáveis só ganham valor no
//     escopo do redesign, que deixa de fora "Contornos fortes", alto contraste, papel eletrônico e leitor de tinta;
//   · cada área com as suas variáveis: a Alumia, a Escola, o painel e o lambe-lambe ficam fora das regras do site;
//   · E4 e E5: os destaques da faixa principal e a ordem dos prédios no "Tudo o que tem aqui" só mudam o desenho.
// Uso: npm run testar:p5-design
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBanco } from "./banco-local.mjs";
import { noFimDoInstall } from "./install-posteriores.mjs";
import { ligado, lerRecursos, PADRAO, RECURSOS, SO_PELO_NOME } from "../lib/recursos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
const normal = (t) => t.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return undefined;
  }
}

// ═══════════════════ 1. O recurso ═══════════════════
ok("o recurso design-novo existe", "design-novo" in RECURSOS);
ok("é só pelo nome", SO_PELO_NOME.includes("design-novo"));
ok("não é padrão", !PADRAO.includes("design-novo"));
ok("\"todos\" (o que a produção usa) não o liga", !ligado("design-novo", lerRecursos("todos")));
ok("sem variável, desligado", !ligado("design-novo", lerRecursos(undefined)));
ok("com o nome na lista, ligado", ligado("design-novo", lerRecursos("todos,design-novo")));

// ═══════════════════ 2. O <html>, o botão e a escolha guardada ═══════════════════
{
  const layout = ler("app/[lang]/layout.tsx");
  ok("o layout lê o recurso", /const designNovo = ligado\("design-novo"\);/.test(layout));
  ok("o <html> só leva data-design com o recurso", /data-design=\{designNovo \? "novo" : undefined\}/.test(layout));
  ok("a opção do botão de acessibilidade só vem com o recurso", /<A11yWidget design=\{designNovo \? textosDoDesign\(lang\) : undefined\} \/>/.test(layout));
  ok("o layout carrega os estilos do redesign do site", /import "@\/styles\/design\/instituto\.css";/.test(layout));
  const botao = ler("components/A11yWidget.tsx");
  ok("o interruptor Contornos fortes existe e só aparece com os textos do redesign", /\{design && <Switch checked=\{prefs\.fortes\} onChange=\{\(fortes\) => setPrefs\(\{ fortes \}\)\}/.test(botao));
  const prefs = ler("lib/prefs.ts");
  ok("a preferência fortes vira data-fortes", /\["fortes", "fortes"\]/.test(prefs) && /fortes: false,/.test(prefs));
  const script = ler("lib/prefs-script.ts");
  ok("o script de antes da primeira pintura põe data-fortes", script.includes(`["cursor","cursor"],["fortes","fortes"]].forEach`));
  for (const idioma of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const t = JSON.parse(ler(`i18n/design/${idioma}.json`));
    ok(`textos do redesign em ${idioma}`, typeof t.fortes === "string" && t.fortes.trim() && typeof t.fortesDica === "string" && t.fortesDica.trim());
    if (idioma !== "pt") ok(`a tradução em ${idioma} está marcada como rascunho`, t._rascunho === true);
  }
}

// ═══════════════════ 3. As variáveis: valor de hoje como reserva, valor novo só no escopo ═══════════════════
/** Separa a lista de seletores pelas vírgulas de fora dos parênteses. */
function partes(sel) {
  const lista = [];
  let fundo = 0, atual = "";
  for (const c of sel) {
    if (c === "(") fundo++;
    if (c === ")") fundo--;
    if (c === "," && fundo === 0) {
      lista.push(atual.trim());
      atual = "";
    } else atual += c;
  }
  return [...lista, atual.trim()];
}
const ESCOPO = ':root[data-design="novo"]:not([data-fortes], [data-contrast], [data-eink], [data-leitor])';
for (const arquivo of ["app/globals.css", "app/celular.css", "app/app-casca.css"]) {
  const css = ler(arquivo);
  const semReserva = [...css.matchAll(/var\((--d-[a-z-]+)\s*\)/g)].map((m) => m[1]);
  ok(`${arquivo}: toda variável do redesign tem o valor de hoje como reserva (${semReserva.join(", ") || "nenhuma sem"})`, semReserva.length === 0);
  ok(`${arquivo}: não define nenhuma variável do redesign`, !/^\s*--d-[a-z-]+\s*:/m.test(css));
}
{
  const css = ler("app/globals.css");
  const usos = [...css.matchAll(/var\(--d-[a-z-]+,/g)].length;
  ok(`as peças do site leem as variáveis (${usos} usos)`, usos >= 80);
  ok("a sombra dura do cartão continua sendo a reserva", css.includes("box-shadow: var(--d-sombra, 6px 6px 0 var(--sombra));"));
  ok("o contorno de tinta de 2 px continua sendo a reserva", css.includes("border: var(--d-fio, 2px) solid var(--d-cor-fio, var(--ink));"));
}
{
  const css = ler("styles/design/instituto.css").replace(/\/\*[\s\S]*?\*\//g, "");
  // Toda regra que define uma variável do redesign com valor (não "initial") está no escopo.
  const blocos = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), corpo: m[2] }));
  const definicoes = blocos.filter((b) => /--d-[a-z-]+\s*:\s*(?!\s|initial)/.test(b.corpo));
  ok("as variáveis novas só ganham valor no escopo do redesign", definicoes.length >= 3 && definicoes.every((b) => b.sel.includes(':root[data-design="novo"]') && /:not\(\[data-theme="light"\], \[data-fortes\]|:not\(\[data-fortes\]/.test(b.sel) && b.sel.includes("[data-contrast]") && b.sel.includes("[data-eink]") && b.sel.includes("[data-leitor]")));
  const regras = blocos.filter((b) => !/^@/.test(b.sel) && !/--d-[a-z-]+\s*:/.test(b.corpo));
  const foraDoEscopo = regras.filter((b) => !partes(b.sel).every((parte) => parte.includes(ESCOPO) || parte.includes(':root[data-design="novo"]')));
  ok(`toda regra do arquivo depende do recurso (${foraDoEscopo.map((b) => b.sel.slice(0, 60)).join(" | ")})`, foraDoEscopo.length === 0);
  const semFortes = regras.filter((b) => partes(b.sel).some((parte) => !parte.includes(ESCOPO)));
  ok(`toda regra respeita Contornos fortes, contraste, papel eletrônico e leitor (${semFortes.map((b) => b.sel.slice(0, 60)).join(" | ")})`, semFortes.length === 0);
  ok("a barreira zera as variáveis na Alumia, na Escola, no painel e no lambe-lambe", /:is\(\[data-al\], \[data-escola\], \.painel, \.lambe-cartaz\) \{[^}]*--d-sombra: initial;[^}]*--d-fio: initial|:is\(\[data-al\], \[data-escola\], \.painel, \.lambe-cartaz\) \{[^}]*--d-fio: initial;[\s\S]*?--d-sombra: initial;/.test(css));
  // Toda regra que muda peça (não variável) pula as áreas com visual próprio (salvo as que só valem num lugar do site).
  const proprias = /(\.cabecalho-site|\.menu-do-site|\.indice-do-campus|\.capa-do-inicio|\.a11y-chave|:hover \{|prefers-reduced-motion)/;
  const vazam = regras.filter((b) => !proprias.test(b.sel) && !/\[data-al\][^)]*\[data-escola\][^)]*\.painel/.test(b.sel));
  ok(`nenhuma regra do site vaza para a Alumia, a Escola ou o painel (${vazam.map((b) => b.sel.slice(0, 80)).join(" | ")})`, vazam.length === 0);
  ok("o lambe-lambe fica de fora", (css.match(/\.lambe-cartaz/g) ?? []).length >= 10);
  ok("só na tela: a impressão continua com o desenho de antes", !/@media print/.test(css) && [...css.matchAll(/@media ([^{]+)\{/g)].every((m) => m[1].includes("screen")));
  ok("sem vidro fosco (E7)", !/backdrop-filter/.test(css));
  ok("animação só de transform e opacity (E7)", [...css.matchAll(/transition:\s*([^;]+);/g)].every((m) => /^(background-color|transform|opacity)( [\d.]+s[^,]*)?(, *(background-color|transform|opacity)( [\d.]+s[^,]*)?)*$/.test(m[1].trim())));
  ok("o foco do teclado continua bem visível", /:focus-visible[^{]*\{\s*outline: 3px solid var\(--gold\);\s*outline-offset: 3px;/.test(css));
}
{
  const painel = ler("styles/painel-tema.css");
  ok("o painel tem o bloco do redesign com as variáveis dele", painel.includes('[data-design="novo"]') && /\.painel \{[^}]*--pn-/.test(painel));
}

// ═══════════════════ 4. E4 e E5: só o desenho muda ═══════════════════
{
  const nav = ler("components/NavLinks.tsx");
  ok("E4: Formação, Vale o Escrito e Alumia marcados para o destaque", /const DESTAQUES = new Set\(\["\/escola", ROTA_DO_OBSERVATORIO, "\/alumia"\]\);/.test(nav) && /data-destaque=\{DESTAQUES\.has\(path\) \? "" : undefined\}/.test(nav));
  const mais = ler("components/MaisGaveta.tsx");
  ok("E5: cada prédio do índice diz quem é (data-predio), para a ordem nova", /data-predio=\{predio\.id\}/.test(mais));
  const css = ler("styles/design/instituto.css");
  const ordem = ["escola", "biblioteca", "praca", "memorial", "territorio", "oficinas", "radio", "secretaria"].map((id) => Number(new RegExp(`\\[data-predio="${id}"\\] \\{ order: (\\d+); \\}`).exec(css)?.[1]));
  ok("E5: Memória e luta e Território sobem para a segunda linha do meio", ordem.every((n, i) => n === i + 1));
  const campus = ler("lib/escola/campus.ts");
  ok("E5: nenhum prédio nem seção saiu do campus", ["escola", "biblioteca", "radio", "memorial", "oficinas", "praca", "territorio", "secretaria"].every((id) => campus.includes(`id: "${id}"`)));
}

// ═══════════════════ 5. O banco ═══════════════════
const SQL = normal(ler("supabase/migracoes/20261126-p5-design.sql"));
ok("a migração diz que roda depois do fim da R3 e antes do p5-fim", SQL.includes("Roda depois de 20261125-r3-fim.sql (banco na versão 16)") && SQL.includes("20261126-p5-fim.sql vem por último"));
ok("a migração termina passando a porta", /select interno\.alumia_trancar\(\);$/.test(SQL));
ok("a migração está no fim do install.sql (seguida só de migrações datadas)", noFimDoInstall(SQL));
ok("não mexe na versão nem na lista de exceções", !/function public\.rede_alumia_versao|alumia_porta_aberta/.test(SQL.replace(/--.*$/gm, "")));
ok("o primeiro insert do catálogo (install.sql e 2026-11-backend-1.sql) tem o recurso só pelo nome", ["supabase/install.sql", "supabase/migracoes/2026-11-backend-1.sql"].every((c) => ler(c).includes("('alumia-chat-so-app', true), ('design-novo', true),")));
const banco = await criarBanco();
const { dono } = banco;
await espera("o banco montado do zero tem o recurso só pelo nome e desligado", () => dono("select c.so_pelo_nome, v.ligado from interno.recursos_catalogo c left join interno.recursos_vivos v using (nome) where c.nome = 'design-novo'"), (r) => r.rows.length === 1 && r.rows[0].so_pelo_nome === true && r.rows[0].ligado == null);
await espera("a migração roda de novo por cima", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await espera("e de novo", () => banco.exclusivo(() => banco.pg.exec(SQL)));
await espera("continua uma linha só, só pelo nome", () => dono("select count(*)::int as n, bool_and(so_pelo_nome) as s from interno.recursos_catalogo where nome = 'design-novo'"), (r) => r.rows[0].n === 1 && r.rows[0].s === true);
await espera("nenhuma função sem porta", () => dono("select interno.alumia_trancar() as v"), (r) => {
  const v = r.rows[0].v;
  return !v || !v.abertas || v.abertas.length === 0;
});

console.log(`p5-design: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHOU:", f);
process.exit(falhas.length ? 1 : 0);
