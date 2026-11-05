// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere a integração das Etapas 5, 6, 8 e 9 (docs/plano-2026-11/notas/etapas-5-6-8-9.md): o install.sql traz, inteiras e na
// ordem, as migrações departamentos-termos, eixos-equipe, controles, backend-1 e backend-2 depois da Rede v2; a página Jogos lê
// os dois registros de jogos próprios e chama as checagens só no servidor; os textos novos fecham nos 6 idiomas; o menu, o
// rodapé, o sitemap e a interdição conhecem as rotas novas; o redirecionamento de /laboratorios/jogos é permanente.
// Uso: npm run testar:integracao-5689
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
let falhas = 0;
function conferir(nome, ok, detalhe = "") {
  if (!ok) {
    falhas++;
    console.error(`FALHOU: ${nome}${detalhe ? ` (${detalhe})` : ""}`);
  } else console.log(`ok: ${nome}`);
}
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");

// ── install.sql ──
const LOTE = ["departamentos-termos", "eixos-equipe", "controles", "backend-1", "backend-2"];
let resto = ler("supabase", "install.sql").trim();
for (const n of [...LOTE].reverse()) {
  const bloco = ler("supabase", "migracoes", `2026-11-${n}.sql`).trim();
  const ok = resto.endsWith(bloco);
  conferir(`o install.sql termina com a migração ${n}, idêntica ao arquivo`, ok);
  if (!ok) break;
  resto = resto.slice(0, -bloco.length).trim();
}
const ultimaRede = ler("supabase", "migracoes", "2026-11-rede-integracao.sql").trim();
conferir("antes do lote vêm os blocos da Rede v2 (o último é rede-integracao)", resto.endsWith(ultimaRede));
conferir("nenhuma migração do lote cria tabela no esquema public", LOTE.every((n) => !/create table (if not exists )?public\./i.test(ler("supabase", "migracoes", `2026-11-${n}.sql`))));

// ── Página Jogos ──
const pagina = ler("app", "[lang]", "jogos", "page.tsx");
conferir("a página Jogos lê JOGOS_PROPRIOS e JOGOS_PROPRIOS_2", pagina.includes("JOGOS_PROPRIOS.map") && pagina.includes("JOGOS_PROPRIOS_2.map"));
conferir("as checagens do 'Fato ou boato?' são lidas no servidor, na página", pagina.includes("lerChecagensParaJogo()") && !pagina.startsWith('"use client"'));
const cliente = ler("components", "jogos", "Proprios.tsx");
conferir("o componente de cartões é de cliente e não lê disco", cliente.includes('"use client"') && !/node:fs|readFileSync/.test(cliente));
const cat1 = ler("components", "jogos", "proprios", "Catalogo.tsx");
const cat2 = ler("components", "jogos", "proprios2", "Catalogo.tsx");
const reg1 = ler("components", "jogos", "proprios", "registro.ts");
const reg2 = ler("components", "jogos", "proprios2", "registro.ts");
const slugs1 = [...reg1.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
const ids2 = [...reg2.matchAll(/^\s+id: "([^"]+)"/gm)].map((m) => m[1]);
conferir("há 8 jogos em cada registro", slugs1.length === 8 && ids2.length === 8, `${slugs1.length} e ${ids2.length}`);
conferir("todo jogo do registro 1 tem caso em Catalogo.tsx", slugs1.every((s) => cat1.includes(`case "${s}"`)));
conferir("todo jogo do registro 2 tem caso em proprios2/Catalogo.tsx", ids2.every((s) => cat2.includes(`case "${s}"`)));
conferir("cada jogo é baixado só quando aberto (dynamic import)", (cat1.match(/dynamic\(/g) ?? []).length >= 8 && (cat2.match(/dynamic\(/g) ?? []).length >= 8);
const pastaJogos = fs.readdirSync(path.join(raiz, "components", "jogos", "proprios2")).filter((f) => f.endsWith(".tsx"));
conferir("os jogos de proprios2 existem como arquivo", ["QuemConstruiu", "ZoneamentoPopular", "TransicaoEnergetica", "MapaDaSaude", "QuadroDeDisjuntores", "AjusteOPonto", "BugNaMemoria", "RedundanciaDeServidores"].every((n) => pastaJogos.includes(`${n}.tsx`)));

// ── Textos nos 6 idiomas ──
const chaves = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? chaves(v, `${p}${k}.`) : [`${p}${k}`])).sort();
const textos = Object.fromEntries(["pt", "en", "es", "fr", "ru", "zh"].map((l) => [l, JSON.parse(ler("i18n", "jogos", `${l}.json`))]));
const base = chaves(textos.pt.proprios).join();
for (const [l, t] of Object.entries(textos)) {
  conferir(`i18n/jogos/${l}.json: a seção proprios fecha com o português`, chaves(t.proprios).join() === base);
  conferir(`i18n/jogos/${l}.json: pagina.irProprios existe e a lista de público está completa`, typeof t.pagina.irProprios === "string" && ["todos", "adultos", "jovens", "criancas"].every((k) => t.proprios.publico[k]));
  conferir(`i18n/jogos/${l}.json: {n} no texto de minutos`, t.proprios.minutos.includes("{n}"));
}
conferir("o texto de pt não usa universidade nem diploma", !/universidade|diploma/i.test(JSON.stringify(textos.pt)));

// ── Menus, rodapé, sitemap, interdição, redirecionamento ──
const footer = ler("components", "Footer.tsx");
conferir("o rodapé leva a /jogos e a /imprensa", footer.includes('"/jogos"') && footer.includes('"/imprensa"'));
const sitemap = ler("app", "sitemap.ts");
conferir("o sitemap tem /jogos e /imprensa (esta só em português)", sitemap.includes('"/jogos"') && sitemap.includes('"/imprensa"') && /soEm\.set\("\/imprensa", \[defaultLocale\]\)/.test(sitemap));
const interdicao = ler("lib", "interdicao.ts");
conferir("a interdição conhece /jogos, /imprensa e /vale-o-escrito", ["/jogos", "/imprensa", "/vale-o-escrito"].every((r) => interdicao.includes(`"${r}"`)));
const nav = ler("components", "NavLinks.tsx");
conferir("o menu Mais leva a /jogos", nav.includes('"/jogos"'));
const config = ler("next.config.ts");
conferir("/laboratorios/jogos redireciona de forma permanente para /jogos, com e sem idioma", /\/laboratorios\/jogos/.test(config) && /permanent:\s*true/.test(config));
conferir("a página antiga foi apagada", !fs.existsSync(path.join(raiz, "app", "[lang]", "laboratorios", "jogos", "page.tsx")));
conferir("a rota GET de operação exige token de sessão", /export async function GET\(pedido: Request\)[\s\S]{0,400}401/.test(ler("app", "api", "painel", "operacao", "route.ts")));
conferir("as fixadas do menu do painel não somem no celular", !/fixadas=\{compacto \? \[\]/.test(ler("components", "painel", "Painel.tsx")));
conferir("a integração está documentada", fs.existsSync(path.join(raiz, "docs", "plano-2026-11", "notas", "etapas-5-6-8-9.md")));

if (falhas) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nIntegração das etapas 5, 6, 8 e 9: tudo certo.");
