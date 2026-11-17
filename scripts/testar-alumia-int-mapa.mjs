// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a sobra 6 da onda 13 (o toque no mapa, components/rede/mapa/toque.ts e MapaDoBrasil.tsx), sem tela:
//   · no celular (390 px para o Brasil inteiro), as áreas de 44 px de cidades próximas se sobrepõem: o toque junta TODAS as cidades
//     daquele ponto, da mais perto para a mais longe, em vez de acertar uma por sorte;
//   · no computador (o desenho largo), as mesmas cidades ficam separadas e o toque acha uma só;
//   · fora de todas as áreas, nada; o alvo nunca é menor que o ladrilho;
//   · a tela usa a conta (a lista aparece com mais de uma), com botões de 44 px e os textos nos seis idiomas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-int-mapa.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALVO_PX, geometriaDoPonto, pontosNoToque } from "../components/rede/mapa/toque.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");
let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

const filtro = { chamados: true, eventos: true, nucleos: true };
const ponto = (nome, uf, x, y, extra = {}) => ({
  chave: `${nome}:${uf}`, municipio: { nome, uf, x, y }, chamados: null, chamados_ha: true, eventos: null, eventos_ha: false, nucleos_ha: false, orgs: [], escrito: nome, ...extra,
});
// Três cidades da Grande São Paulo, a 6 unidades do desenho uma da outra, e uma longe (Manaus).
const pontos = [ponto("São Paulo", "SP", 800, 700), ponto("Guarulhos", "SP", 806, 697), ponto("Osasco", "SP", 794, 701), ponto("Manaus", "AM", 300, 200)];
const LARGURA_DO_BRASIL = 1085;
const alvoEm = (px) => ALVO_PX / (px / LARGURA_DO_BRASIL);

// No celular: 390 px de desenho para 1085 unidades (~0,36 px por unidade): o alvo de 44 px vira ~122 unidades.
const celular = alvoEm(358);
const noCelular = pontosNoToque(pontos, filtro, 1, celular, 801, 700);
ok("no celular, o toque junta as três cidades próximas", noCelular.length === 3 && noCelular.every((p) => p.municipio.uf === "SP"));
ok("da mais perto para a mais longe do toque", noCelular[0].municipio.nome === "São Paulo" && noCelular.at(-1).municipio.nome === "Osasco");
ok("a cidade longe não entra", !noCelular.some((p) => p.municipio.nome === "Manaus"));

// No computador: ~900 px de desenho (~0,83 px por unidade): o alvo vira ~53 unidades; com a mesma conta, aproximar o Estado separa.
const computador = alvoEm(900);
ok("no computador, o alvo em unidades é menor que no celular", computador < celular);
const aproximado = pontosNoToque(pontos, filtro, 0.05, alvoEm(900) * 0.05, 806, 697);
ok("com o Estado aproximado, o toque acha uma cidade só", aproximado.length === 1 && aproximado[0].municipio.nome === "Guarulhos");
ok("fora de todas as áreas, nada", pontosNoToque(pontos, filtro, 1, celular, 100, 1000).length === 0);
ok("na área de uma só cidade, uma só", pontosNoToque(pontos, filtro, 1, celular, 300, 200).map((p) => p.municipio.nome).join() === "Manaus");

const g = geometriaDoPonto(ponto("Grande", "RJ", 0, 0, { chamados: 12, eventos: 4, eventos_ha: true, nucleos_ha: true }), filtro, 1, 5);
ok("o alvo nunca é menor que a fileira de ladrilhos", g.area.largura >= g.largura && g.area.altura >= g.lado && g.tipos.length === 3);
ok("sem desenho medido (alvo zero), a área é o próprio ladrilho", geometriaDoPonto(pontos[0], filtro, 1, 0).area.largura === 13);

const tela = ler("components/rede/mapa/MapaDoBrasil.tsx");
ok("a tela usa a conta do toque e abre a lista com mais de uma cidade", /pontosNoToque\(/.test(tela) && /achados\.length <= 1/.test(tela) && /className="mp-toque"/.test(tela));
ok("a lista tem o caminho para ver só o Estado", /aoEscolherUf\(ufDaLista\)/.test(tela));
const css = ler("components/rede/mapa/mapa.css");
ok("os botões da lista do toque têm 44 px", /\.mp-toque-cidade, \.mp-toque-estado, \.mp-toque-fechar \{\s*min-height: 44px/.test(css));
for (const l of ["pt", "en", "es", "fr", "ru", "zh"]) {
  const t = JSON.parse(ler(`i18n/rede/mapa/${l}.json`)).toque;
  ok(`mapa/${l}: os textos do toque`, ["titulo", "explica", "estado", "fechar"].every((k) => typeof t?.[k] === "string" && t[k]) && t.estado.includes("{uf}"));
}

console.log(`\n${certos} conferências certas.`);
if (falhas.length) {
  console.log(`\n${falhas.length} FALHA(S):`);
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
console.log("O toque no mapa: tudo certo.");
