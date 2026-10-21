// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o que o site diz aos buscadores: os dados estruturados (JSON-LD) de organização, site, curso, aula, livro e
// migalhas; o robots.txt (áreas privadas fechadas, buscadores abertos, robôs de treino de IA conforme a escolha); o
// hreflang que não anuncia tradução inexistente; e que nada disso leva nome de pessoa da coordenação.
// Uso: npm run testar:seo
import { curso, emTexto, livro, migalhas, organizacao, recursoDeAula, siteWeb } from "../lib/dados-estruturados.ts";
import { alternatesDe, paginaMeta } from "../lib/seo.ts";
import robots from "../app/robots.ts";

let certos = 0;
const falhas = [];
const confere = (nome, cond) => (cond ? certos++ : falhas.push(nome));

const aula = { slug: "fracoes", title: "Frações", summary: "O que é uma fração.", authors: [], minutes: 12, translated: false, file: "content/x.md" };
const trilha = { slug: "matematica-basica", title: "Matemática básica", summary: "Do zero às frações.", translated: true, lessons: [aula], file: "content/y.md" };
const obra = { id: "o-capital", title: "O Capital", author: "Karl Marx", year: "1867", language: "de", synopsis: "Crítica da economia política.", url: "https://exemplo.org", translated: true };

const org = organizacao();
confere("organização é EducationalOrganization com nome do instituto", org["@type"] === "EducationalOrganization" && org.name === "Instituto Lúcia");
confere("organização não traz pessoa física", !JSON.stringify(org).includes("Person"));
confere("site no idioma da página", siteWeb("en", "x").inLanguage === "en");
const c = curso("pt", trilha);
confere("curso gratuito com as aulas", c["@type"] === "Course" && c.isAccessibleForFree === true && c.hasPart.length === 1);
const a = recursoDeAula("en", trilha, aula);
confere("aula sem tradução declara o idioma do texto (pt-BR)", a.inLanguage === "pt-BR");
confere("aula sem autor não inventa autor", !("author" in a));
confere("tempo da aula em ISO 8601", a.timeRequired === "PT12M");
const l = livro("pt", obra);
confere("livro com autor e ano que a ficha tem", l.author.name === "Karl Marx" && l.datePublished === "1867");
confere("ano estranho não vira data", !("datePublished" in livro("pt", { ...obra, year: "c. séc. XIX" })));
const m = migalhas("pt", [["Disciplinas", "/trilhas"], ["Frações", "/trilhas/x/fracoes"]]);
confere("migalhas numeradas a partir de 1", m.itemListElement[0].position === 1 && m.itemListElement[1].item.endsWith("/pt/trilhas/x/fracoes"));
confere("JSON-LD não fecha a tag script", !emTexto({ x: "</script><script>alert(1)</script>" }).includes("</script>"));

// hreflang
const todos = alternatesDe("en", "/sobre");
confere("página traduzida em todos: canônico no próprio idioma", todos.canonical.endsWith("/en/sobre") && Object.keys(todos.languages).length === 7);
const soPt = alternatesDe("en", "/trilhas/x/fracoes", ["pt"]);
confere("sem tradução: canônico vai para o português", soPt.canonical.endsWith("/pt/trilhas/x/fracoes"));
confere("sem tradução: o inglês não é anunciado", !Object.keys(soPt.languages).includes("en"));
confere("vitrine da saúde fica fora dos buscadores", paginaMeta("pt", "/saude", "x").robots?.index === false);
confere("página pública não leva noindex", !paginaMeta("pt", "/sobre", "x").robots);

// robots.txt
const r = robots();
const regras = r.rules;
const geral = regras.find((x) => x.userAgent === "*");
confere("painel e API fechados", geral.disallow.includes("/*/painel") && geral.disallow.includes("/api/"));
confere("o resto aberto para todo buscador", geral.allow === "/");
const bloqueio = regras.find((x) => Array.isArray(x.userAgent) && x.disallow === "/");
confere("robôs de treino de IA bloqueados", bloqueio && bloqueio.userAgent.includes("GPTBot") && bloqueio.userAgent.includes("CCBot"));
confere("buscadores com IA que citam a fonte não são bloqueados", bloqueio && !bloqueio.userAgent.includes("OAI-SearchBot") && !bloqueio.userAgent.includes("PerplexityBot"));
confere("Googlebot nunca bloqueado", !regras.some((x) => [].concat(x.userAgent).includes("Googlebot") && x.disallow === "/"));
confere("aponta o sitemap", r.sitemap.endsWith("/sitemap.xml"));

console.log(`seo: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
