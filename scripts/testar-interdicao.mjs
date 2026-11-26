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
const gerais = ["sobre", "guia", "privacidade", "termos", "status", "seguranca-digital", "certificado", "meus-dados", "historico", "explorar", "painel", "entrar", "fora-do-ar", "quem-somos", "creditos", "original", "por-onde-andei", "modo-seguro",
  // Onda R3: a transparência (relatórios, pedidos de órgãos públicos, canário) fica sempre aberta, como a privacidade: uma área
  // que a coordenação pudesse fechar faria o canário sumir sem aviso.
  "transparencia",
  // A casca do aplicativo instalado (/app, /app/estudar, /app/jogos, /app/eu): só reúne e leva às áreas, cada uma fecha pelo seu
  // próprio caminho; o site inteiro fora do ar (interdição geral) fecha o /app junto.
  "app"];
// "por-onde-andei" é o histórico pessoal (fica no aparelho) e "modo-seguro" é a saída segura: nenhum dos dois pode
// fechar quando a busca ou uma área for interditada (Etapa 4, E4-05).
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
// A Alumia mudou de /comunidade para /alumia (PLANO-ALUMIA, F0): o caminho novo e o antigo fecham com a mesma área.
igual("Alumia: o caminho novo fecha com a área comunidade", fechado("/pt/alumia", comunidade), "comunidade");
igual("Alumia: uma tela nova fecha junto", fechado("/en/alumia/atos", comunidade), "comunidade");
igual("Alumia: o caminho antigo também fecha", fechado("/pt/comunidade/p/x", comunidade), "comunidade");
igual("Alumia: prefixo parecido não conta", fechado("/pt/alumiar", comunidade), null);
igual("Alumia: área do caminho", areaDoCaminho("/alumia/organizacoes"), "comunidade");
// O aplicativo instalado: as abas que mostram conteúdo de uma área fecham com ela, direto ou pelo idioma; o início e o Eu só fecham com o site todo.
const soEstudo = { geral: false, areas: ["estudo"], mensagem: "" };
const soFerramentas = { geral: false, areas: ["ferramentas"], mensagem: "" };
igual("app: o caderno do app fecha com ferramentas e a busca do app com estudo", [fechado("/pt/app/eu/caderno", soFerramentas), fechado("/pt/app/eu/caderno", soEstudo), fechado("/pt/app/estudar/buscar", soEstudo), fechado("/pt/app/eu", soFerramentas)], ["ferramentas", null, "estudo", null]);
const soVoluntariado = { geral: false, areas: ["voluntariado"], mensagem: "" };
igual("app: o apoio do app fecha com a área voluntariado", [fechado("/pt/app/eu/apoio", soVoluntariado), fechado("/pt/app/eu/apoio", soEstudo)], ["voluntariado", null]);
const soRadio = { geral: false, areas: ["radio"], mensagem: "" };
igual("app: a rádio do app fecha com a área radio", [fechado("/pt/app/eu/radio", soRadio), fechado("/pt/app/eu/radio", soEstudo)], ["radio", null]);
igual("app: o instituto do app fecha com a área voluntariado", [fechado("/pt/app/eu/instituto", soVoluntariado), fechado("/pt/app/eu/instituto", soEstudo)], ["voluntariado", null]);
igual("app: o voluntariado do app fecha com a área voluntariado", [fechado("/pt/app/eu/voluntarios", soVoluntariado), fechado("/pt/app/eu/voluntarios", soEstudo)], ["voluntariado", null]);
const soMural = { geral: false, areas: ["mural"], mensagem: "" };
igual("app: o mural de saúde do app fecha com a área mural", [fechado("/pt/app/eu/saude", soMural), fechado("/pt/app/eu/saude", soEstudo)], ["mural", null]);
igual("app: o mural dos trabalhadores do app fecha com a área mural", [fechado("/pt/app/eu/mural", soMural), fechado("/pt/app/eu/mural", soEstudo)], ["mural", null]);
const soAcervo = { geral: false, areas: ["acervo"], mensagem: "" };
igual("app: o acervo do app fecha com a área acervo", [fechado("/pt/app/eu/acervo", soAcervo), fechado("/pt/app/eu/acervo", soEstudo)], ["acervo", null]);
igual("app: o plantão do app fecha com a área estudo", [fechado("/pt/app/eu/plantao", soEstudo), fechado("/pt/app/eu/plantao", soAcervo)], ["estudo", null]);
const soMemoria = { geral: false, areas: ["memoria"], mensagem: "" };
igual("app: a dedicatória do app fecha com a área memoria", [fechado("/pt/app/eu/dedicatoria", soMemoria), fechado("/pt/app/eu/dedicatoria", soEstudo)], ["memoria", null]);
const soJornal = { geral: false, areas: ["jornal"], mensagem: "" };
igual("app: o jornal do app fecha com a área jornal", [fechado("/pt/app/eu/jornal", soJornal), fechado("/pt/app/eu/jornal", soEstudo)], ["jornal", null]);
igual("app: os podcasts do app fecham com a área radio", [fechado("/pt/app/eu/podcasts", soRadio), fechado("/pt/app/eu/podcasts", soEstudo)], ["radio", null]);
igual("app: /app/estudar fecha com a área estudo", [fechado("/pt/app/estudar", soEstudo), fechado("/en/app/estudar", soEstudo)], ["estudo", "estudo"]);
igual("app: /app/jogos fecha com a área ferramentas", [fechado("/pt/app/jogos", soFerramentas), fechado("/es/app/jogos", soFerramentas)], ["ferramentas", "ferramentas"]);
igual("app: os laboratórios do app fecham com a área ferramentas (prefixo /app/jogos)", [fechado("/pt/app/jogos/laboratorios", soFerramentas), fechado("/pt/app/jogos/laboratorios", soEstudo)], ["ferramentas", null]);
igual("app: estudo fechado não fecha jogos, início nem Eu", ["/pt/app/jogos", "/pt/app", "/pt/app/eu"].map((c) => fechado(c, soEstudo)), [null, null, null]);
igual("app: ferramentas fechada não fecha estudar, início nem Eu", ["/pt/app/estudar", "/pt/app", "/pt/app/eu"].map((c) => fechado(c, soFerramentas)), [null, null, null]);
igual("app: Alumia fechada não fecha nenhuma rota do app", ["/pt/app", "/pt/app/estudar", "/pt/app/jogos", "/pt/app/eu"].map((c) => fechado(c, comunidade)), [null, null, null, null]);
igual("app: site fora do ar fecha as quatro rotas", ["/pt/app", "/pt/app/estudar", "/pt/app/jogos", "/pt/app/eu"].map((c) => fechado(c, tudo)), ["geral", "geral", "geral", "geral"]);
igual("app: disciplina, trilha e aula do app fecham com a área estudo", ["/pt/app/estudar/historia", "/pt/app/estudar/historia/x", "/en/app/estudar/historia/x/y"].map((c) => fechado(c, soEstudo)), ["estudo", "estudo", "estudo"]);
igual("app: aula do app aberta com só ferramentas fechada", fechado("/pt/app/estudar/historia/x/y", soFerramentas), null);
igual("app: prefixo parecido não conta", fechado("/pt/app/estudar-mais", soEstudo), null);
igual("contribuir fecha a denúncia junto", fechado("/pt/denunciar", { geral: false, areas: ["contribuir"], mensagem: "" }), "contribuir");

igual("estado lido do site()", lerEstado({ faixa: "", interdicao: { geral: true, areas: ["mural", 3], mensagem: "x" } }), { geral: true, areas: ["mural"], mensagem: "x" });
igual("banco antigo, sem interdição: site aberto", lerEstado({ faixa: "" }), aberto);
igual("resposta estranha: site aberto", lerEstado(null), aberto);

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
