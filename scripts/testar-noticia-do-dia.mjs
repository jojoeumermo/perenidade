// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// A notícia do dia do Explorar da Alumia (Prompt 5, A19): a escolha (lib/news.ts) e as promessas da rota e da tela. Só título,
// veículo, data e link (sem imagem e sem o texto da matéria); o navegador fala só com o próprio site; notícia velha não vira
// "do dia". Sem rede, sem navegador. Uso: npm run testar:noticia-do-dia
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { escolherNoticiaDoDia } from "../lib/news.ts";

let total = 0;
const caso = (nome, fn) => {
  fn();
  total++;
  console.log(`  ok  ${nome}`);
};
const ler = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const agora = Date.parse("2026-11-19T15:00:00Z");
const h = (horas, titulo, source = "Brasil de Fato") => ({ title: titulo, link: `https://exemplo.org/${horas}`, date: new Date(agora - horas * 3_600_000).toISOString(), source });

caso("a mais recente das últimas 36 horas, só com título, veículo, data e link", () => {
  const n = escolherNoticiaDoDia([h(5, "Cinco horas"), h(1, "Uma hora", "Agência Pública"), h(30, "Trinta horas")], agora);
  assert.deepEqual(Object.keys(n).sort(), ["data", "link", "titulo", "veiculo"]);
  assert.equal(n.titulo, "Uma hora");
  assert.equal(n.veiculo, "Agência Pública");
  assert.equal(n.link, "https://exemplo.org/1");
});
caso("sem manchete recente, nenhuma (notícia velha não é do dia)", () => {
  assert.equal(escolherNoticiaDoDia([h(40, "Velha"), h(100, "Mais velha")], agora), null);
  assert.equal(escolherNoticiaDoDia([], agora), null);
});
caso("a rota só devolve a escolha, com cache, e a tela abre a fonte fora sem mandar quem leu", () => {
  const rota = ler("app", "api", "noticia-do-dia", "route.ts");
  assert.match(rota, /escolherNoticiaDoDia\(latest\)/);
  assert.match(rota, /responder\(/);
  assert.doesNotMatch(rota.replace(/^\/\/.*$/gm, ""), /image|imagem|description|cookies\(|headers\(/i);
  const tela = ler("components", "rede", "descoberta", "Explorar.tsx");
  assert.match(tela, /fetch\("\/api\/noticia-do-dia"\)/);
  assert.match(tela, /rel="noopener noreferrer nofollow"/);
  assert.doesNotMatch(tela, /<img[^>]*noticia/i);
});
caso("o texto novo existe nos 6 idiomas", () => {
  for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const e = JSON.parse(ler("i18n", "rede", "descoberta", `${l}.json`)).explorar;
    assert.ok(e.noticiaDoDia && e.noticiaAjuda && e.lerNaFonte.includes("{veiculo}") && e.vazios, l);
  }
});
console.log(`\n${total} conferências da notícia do dia passaram.`);
