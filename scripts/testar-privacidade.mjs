// Instituto Lúcia — AGPL-3.0-or-later (veja LICENSE)
// Etapa 12: confere que a política de privacidade cobre os recursos novos, cita o artigo da lei certa,
// mantém as âncoras que outros testes usam e não usa palavras proibidas. Sem rede, sem navegador.
// Rodar: npm run testar:privacidade
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const t = fs.readFileSync(path.join(raiz, "content/paginas/privacidade.md"), "utf8");
let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const tem = (nome, re) => ok(nome, re.test(t));

const titulos = t.split("\n").filter((l) => /^## /.test(l));
for (const h of ["Se você só estuda", "Os serviços que mantêm o site no ar", "Se você envia algo sem ter conta", "Alumia (a comunidade renovada)", "Se você é da equipe de voluntários", "Com que base a lei permite isso", "Seus direitos"])
  ok(`título "${h}"`, titulos.includes(`## ${h}`));

tem("data de atualização", /Atualizada em \d{1,2} de novembro de 2026/);
// T03: o assistente em todas as páginas, sem conta: só a pergunta sai, o IP vira código embaralhado do dia e nunca é gravado.
tem("assistente aberto: só a pergunta, código do IP com chave do dia", /Assistente em todas as páginas[\s\S]{0,2500}chave que muda todo dia[\s\S]{0,600}nunca é gravado/);
tem("12 eixos no aparelho", /teste dos 12 eixos[\s\S]{0,400}`lucia:eixos`/);
tem("12 eixos: art. 5º, II e art. 11, I", /art\. 5º, II[\s\S]{0,2500}art\. 11, I/);
tem("pesquisa anônima só agregado, mínimo de cinco", /cinco ou mais respostas/);
tem("pesquisa: não dá para retirar", /não pode ser separada nem retirada/);
tem("Vale o Escrito: Lei 13.188/2015 art. 3º", /Lei 13\.188\/2015 \(arts\. 2º e 3º\)/);
tem("Vale o Escrito: sal que muda todo dia", /sal que muda todo dia/);
tem("Galène: só quem ensina é gravado", /Galène[\s\S]{0,1500}só a aula de quem ensina é gravada/);
tem("Galène: ECA/LGPD art. 14", /Galène[\s\S]{0,2500}art\. 14/);
tem("app: uso sem internet e caches", /`lucia-casca`[\s\S]{0,200}`lucia-cursos`/);
tem("app: push só se ligar", /só existe se você ligar/);
tem("sincronização por QR cifrada", /Levar o progresso para outro aparelho \(por QR\)[\s\S]{0,300}cifrado/);
tem("Rede v2: sem lista de apoios, sem IP, 18+", /ninguém vê lista de quem apoiou/);
tem("Rede v2: não grava endereço de rede", /A Rede não grava o seu endereço de rede/);
tem("Rede v2: ECA Digital art. 9º, § 1º", /Lei nº 15\.211\/2025, art\. 9º, § 1º/);
tem("Rede v2: push com número cifrado", /só um número cifrado/);
tem("jogos: nada sai do aparelho", /\*\*Jogos\.\*\*[\s\S]{0,500}não somam nada no banco/);
ok("sem 'universidade' nem 'diploma' como oferta", !/\b(diploma)\b/i.test(t) && !/universidade/i.test(t.replace(/parceria formal com universidade/g, "")));
ok("sem emoji", !/\p{Extended_Pictographic}/u.test(t));
ok("links internos apontam para rotas que existem", (() => {
  const ls = [...t.matchAll(/\]\((\/[^)#]*)\)/g)].map((m) => m[1]);
  return ls.every((l) => fs.existsSync(path.join(raiz, "app/[lang]", l.slice(1), "page.tsx")) || fs.existsSync(path.join(raiz, "app/[lang]", l.slice(1).split("/")[0])));
})());

console.log(`${certos} certas, ${falhas.length} falhas`);
if (falhas.length) { for (const f of falhas) console.log("FALHA:", f); process.exit(1); }
