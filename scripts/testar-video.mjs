// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Testes dos vídeos curtos: roteiros e áudio (video:conferir), palco determinista, contas, clichês, legendas e bloco.
// Uso: npm run testar:video
import fs from "node:fs";
import path from "node:path";
import { lerVideoCurto } from "../lib/interativos.ts";
import { quadro, ruido } from "../lib/videos/palco.ts";
import { conferirTexto, expandir, frasesDe, validarRoteiro } from "../lib/videos/roteiro.ts";
import { normalizar } from "../lib/vozes/normalizar.ts";
import { carregar, conferir, edicao, ids, legendasDe, linhas42 } from "./video.mjs";

let ok = 0;
const falhas = [];
const conferirQue = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const RAIZ = path.resolve(import.meta.dirname, "..");

// 1. Todos os roteiros, áudios, legendas e o índice.
const { erros, resumo } = conferir(ids());
conferirQue("video:conferir sem erros", erros.length === 0, erros.join(" | "));

// 2. Palco: função pura do tempo.
const fonte = fs.readFileSync(path.join(RAIZ, "lib/videos/palco.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
conferirQue("palco sem Math.random nem Date", !/Math\.random|Date\.|new Date/.test(fonte));
conferirQue("ruído com semente fixa", ruido(42) === ruido(42) && ruido(42) !== ruido(43));
for (const id of ids()) {
  const arq = path.join(RAIZ, "public/videos-curtos", id, "pronto.json");
  if (!fs.existsSync(arq)) continue;
  const p = JSON.parse(fs.readFileSync(arq, "utf8"));
  const meio = Math.round(p.duracao / 2);
  conferirQue(`${id}: o mesmo instante dá o mesmo quadro`, quadro(p, meio) === quadro(JSON.parse(JSON.stringify(p)), meio));
  conferirQue(`${id}: instantes diferentes dão quadros diferentes`, quadro(p, 300) !== quadro(p, p.duracao - 300));
  const c = p.cenas[1];
  conferirQue(`${id}: movimento reduzido mostra a cena já pronta`, quadro(p, c.ini + 10, { reduzido: true }) === quadro(p, c.fim - 10, { reduzido: true }));
  conferirQue(`${id}: texto escapado no SVG`, !/<script/i.test(quadro(p, meio)));
  conferirQue(`${id}: a primeira cena começa em 0 e a última vai até o fim`, p.cenas[0].ini === 0 && p.cenas.at(-1).fim === p.duracao);
}

// 3. Contas refeitas: valor errado no roteiro não passa.
const base = carregar("desconto-sobre-desconto").roteiro;
const errado = structuredClone(base);
errado.contas.final.valor = 160;
let quebrou = false;
try {
  expandir(errado, edicao());
} catch {
  quebrou = true;
}
conferirQue("conta com valor errado é recusada", quebrou);
const comFato = structuredClone(base);
comFato.cenas[0].fala = "Isso não existe: {{enem:fato-que-nao-existe}}.";
quebrou = false;
try {
  expandir(comFato, edicao());
} catch {
  quebrou = true;
}
conferirQue("fato que não existe em edicao.yml é recusado", quebrou);

// 4. Clichês, exclamação e número escrito à mão.
const cliche = structuredClone(base);
cliche.cenas[0].fala = "Vamos mergulhar nessa jornada! Muito bem! Custa R$ 10,00.";
const ec = conferirTexto(cliche, expandir(cliche, edicao()));
conferirQue("clichê reprovado", ec.some((e) => e.includes("Vamos mergulhar")) && ec.some((e) => e.includes("jornada")) && ec.some((e) => e.includes("Muito bem")));
conferirQue("exclamação demais reprovada", ec.some((e) => e.includes("exclamação")));
conferirQue("dinheiro escrito à mão reprovado", ec.some((e) => e.includes("{{conta")));
conferirQue("roteiro sem revisão é recusado", validarRoteiro({ ...base, revisao: { status: "revisado" } }, "x").erros.length > 0);

// 5. Frases, legendas e normalizador.
conferirQue("frases", frasesDe("Custa R$ 162,00. Dá 19%? Sim.").length === 3);
conferirQue("decimal com vírgula não corta a frase", frasesDe("O fator é 0,81 no fim.").length === 1);
const cues = legendasDe([{ ini: 0, fim: 9000, texto: "O segundo desconto tira dez por cento de cento e oitenta reais, e não de duzentos reais, como muita gente pensa na hora." }]);
conferirQue("legenda: até 2 linhas de 42", cues.every((c) => linhas42(c.texto).length <= 2 && linhas42(c.texto).every((l) => l.length <= 42)), JSON.stringify(cues));
conferirQue("legenda: de 1 a 7 s", cues.every((c) => c.fim - c.ini >= 1000 && c.fim - c.ini <= 7000));
conferirQue("legenda: começa junto com a fala", cues[0].ini === 0 && cues.at(-1).fim === 9000);
conferirQue("normalizador: dinheiro", normalizar("R$ 162,00").includes("cento e sessenta e dois reais"));
conferirQue("normalizador: porcentagem", normalizar("19%").includes("dezenove por cento"));
conferirQue("normalizador: hora", /treze/.test(normalizar("às 13h30")));

// 6. Bloco da aula.
conferirQue("bloco videocurto lê o id", lerVideoCurto("desconto-sobre-desconto\n") === "desconto-sobre-desconto");
conferirQue("bloco videocurto recusa id estranho", lerVideoCurto("../etc/passwd") === null);

console.log(resumo);
if (falhas.length) {
  console.log(`${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exitCode = 1;
} else console.log(`testar:video: ${ok} conferências, tudo certo.`);
