// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere a interdição do lado do site: a lógica de caminhos do proxy, e que a lista de áreas de lib/interdicao.ts é a
// mesma do banco (supabase/install.sql) e cobre todas as rotas públicas de app/[lang]. Uso: npm run testar:interdicao
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { areaDoCaminho, areasDeExpurgo, areasPublicas, fechado, lerEstado, semIdioma } from "../lib/interdicao.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const igual = (nome, valor, esperado) => {
  if (JSON.stringify(valor) === JSON.stringify(esperado)) certos++;
  else falhas.push(`${nome}: veio ${JSON.stringify(valor)}, esperava ${JSON.stringify(esperado)}`);
};

// A mesma lista nos dois lados.
const sql = fs.readFileSync(path.join(raiz, "supabase/install.sql"), "utf8");
const lista = (funcao) => {
  const achado = sql.match(new RegExp(`function interno\\.${funcao}\\(\\)[^$]*\\$\\$\\s*select array\\[([^\\]]*)\\]`));
  return achado ? [...achado[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : null;
};
igual("áreas do banco = áreas do site", lista("areas_publicas"), areasPublicas.map((area) => area.id));
igual("áreas de expurgo do banco = do site", lista("areas_expurgo"), areasDeExpurgo.map((area) => area.id));

// A versão do termo de cessão da Gaveta Aberta é a mesma no site e no banco.
const versaoNoSite = fs.readFileSync(path.join(raiz, "lib/gaveta.ts"), "utf8").match(/TERMO_VERSAO = "([^"]+)"/)?.[1];
const versaoNoBanco = sql.match(/function interno\.gaveta_termo_versao\(\)[^$]*\$\$ select '([^']+)' \$\$/)?.[1];
igual("versão do termo da Gaveta: site = banco", versaoNoSite, versaoNoBanco);

// Toda rota pública de app/[lang] pertence a uma área, ou é uma página geral (fecha só com o site inteiro).
const gerais = ["sobre", "guia", "privacidade", "termos", "certificado", "meus-dados", "historico", "explorar", "painel", "entrar", "fora-do-ar", "quem-somos", "creditos"];
for (const pasta of fs.readdirSync(path.join(raiz, "app/[lang]"), { withFileTypes: true })) {
  if (!pasta.isDirectory() || pasta.name.includes(".")) continue;
  if (gerais.includes(pasta.name)) continue;
  if (areaDoCaminho(`/${pasta.name}`)) certos++;
  else falhas.push(`a rota /${pasta.name} não está em nenhuma área de lib/interdicao.ts (nem na lista de páginas gerais deste roteiro)`);
}

// O idioma sai do caminho.
igual("idioma do caminho", semIdioma("/en/comunidade/abc"), ["en", "/comunidade/abc"]);
igual("sem idioma vale o português", semIdioma("/comunidade"), ["pt", "/comunidade"]);
igual("a raiz", semIdioma("/pt"), ["pt", "/"]);
igual("barra no fim", semIdioma("/pt/mural/"), ["pt", "/mural"]);

const aberto = { geral: false, areas: [], mensagem: "" };
const tudo = { geral: true, areas: [], mensagem: "Voltamos logo." };
const comunidade = { geral: false, areas: ["comunidade"], mensagem: "" };

igual("site aberto: nada fecha", ["/pt", "/pt/comunidade", "/pt/trilhas/x/y"].map((c) => fechado(c, aberto)), [null, null, null]);
igual("site fora do ar: o início fecha", fechado("/pt", tudo), "geral");
igual("site fora do ar: endereço sem idioma também", fechado("/", tudo), "geral");
igual("site fora do ar: uma aula fecha", fechado("/es/trilhas/matematica-fundamental/fracoes", tudo), "geral");
igual("site fora do ar: a entrada continua", fechado("/pt/entrar", tudo), null);
igual("site fora do ar: o painel continua", fechado("/pt/painel", tudo), null);
igual("site fora do ar: a página fantasma não fecha a si mesma", fechado("/ru/fora-do-ar", tudo), null);
igual("site fora do ar: arquivos continuam", ["/sw.js", "/manifest.webmanifest", "/.well-known/assetlinks.json", "/pt/indice.json"].map((c) => fechado(c, tudo)), [null, null, null, null]);
igual("só a comunidade: ela fecha", fechado("/pt/comunidade", comunidade), "comunidade");
igual("só a comunidade: uma conversa fecha", fechado("/en/comunidade/123", comunidade), "comunidade");
igual("só a comunidade: o resto abre", ["/pt", "/pt/trilhas", "/pt/mural", "/pt/acervo"].map((c) => fechado(c, comunidade)), [null, null, null, null]);
igual("prefixo parecido não conta", fechado("/pt/comunidades-tradicionais", comunidade), null);
igual("contribuir fecha a denúncia junto", fechado("/pt/denunciar", { geral: false, areas: ["contribuir"], mensagem: "" }), "contribuir");

igual("estado lido do site()", lerEstado({ faixa: "", interdicao: { geral: true, areas: ["mural", 3], mensagem: "x" } }), { geral: true, areas: ["mural"], mensagem: "x" });
igual("banco antigo, sem interdição: site aberto", lerEstado({ faixa: "" }), aberto);
igual("resposta estranha: site aberto", lerEstado(null), aberto);

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
