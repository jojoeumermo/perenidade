// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o laboratório da TRI (docs/ENEM-TRI.md): a conta do modelo de 3 parâmetros, o EAP, a escala (500, 100) e os
// parâmetros REAIS de public/tri/ (extraídos dos microdados do Inep), inclusive contra valores lidos à mão do arquivo
// ITENS_PROVA_2022.csv e contra o gabarito das questões do site. Uso: npm run testar:tri
import fs from "node:fs";
import path from "node:path";
import { corrigirLetras, D_PADRAO, estimarEap, estimarMl, faixaPorAcertos, itensDaArea, notaDeTheta, probabilidadeD, quadratura, thetaDeNota } from "../lib/enem-tri.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const perto = (x, y, tol) => Math.abs(x - y) <= tol;
const raiz = process.cwd();
const json = (...p) => JSON.parse(fs.readFileSync(path.join(raiz, ...p), "utf8"));

// ── 1. A conta do modelo (feita à mão) ──
{
  conferir("D padrão é 1,7", D_PADRAO === 1.7);
  for (const D of [1, 1.7]) conferir(`P(θ = b) = c + (1 − c)/2 com D = ${D}`, perto(probabilidadeD({ a: 1.3, b: 0.4, c: 0.2 }, 0.4, D), 0.6, 1e-12));
  // a = 1, b = 0, c = 0,2, θ = 1, D = 1,7: 0,2 + 0,8 / (1 + e^−1,7) = 0,2 + 0,8 × 0,845535 = 0,876428
  conferir("P(1 | a=1, b=0, c=0,2, D=1,7) = 0,876428", perto(probabilidadeD({ a: 1, b: 0, c: 0.2 }, 1, 1.7), 0.876428, 1e-6));
  conferir("sem o 1,7 (D=1) a mesma conta dá 0,2 + 0,8 × 0,731059 = 0,784847", perto(probabilidadeD({ a: 1, b: 0, c: 0.2 }, 1, 1), 0.784847, 1e-6));
  conferir("longe da dificuldade: embaixo sobra o chute, em cima chega a 1", perto(probabilidadeD({ a: 2, b: 0, c: 0.15 }, -20), 0.15, 1e-9) && perto(probabilidadeD({ a: 2, b: 0, c: 0.15 }, 20), 1, 1e-9));
}

// ── 2. A escala (500, 100) ──
{
  conferir("nota = 500 + 100·θ", notaDeTheta(0) === 500 && notaDeTheta(1.5) === 650 && notaDeTheta(-2) === 300);
  conferir("θ = (nota − 500)/100 é a inversa", thetaDeNota(notaDeTheta(0.37)) === 0.37 && perto(thetaDeNota(720), 2.2, 1e-12));
}

// ── 3. A quadratura de 40 pontos ──
{
  const { x, w } = quadratura(40);
  conferir("40 pontos de −4 a 4", x.length === 40 && x[0] === -4 && x[39] === 4);
  conferir("pesos somam 1 e são simétricos", perto(w.reduce((s, v) => s + v, 0), 1, 1e-12) && perto(w[0], w[39], 1e-15) && perto(w[5], w[34], 1e-15));
  const media = w.reduce((s, v, i) => s + v * x[i], 0);
  const dp = Math.sqrt(w.reduce((s, v, i) => s + v * x[i] * x[i], 0));
  conferir("a priori discreta tem média 0 e desvio ≈ 1", perto(media, 0, 1e-12) && perto(dp, 1, 0.01), String(dp));
}

// ── 4. O EAP contra uma integral feita por outro caminho (grade de 20001 pontos, regra do trapézio) ──
{
  const item = { a: 1, b: 0.5, c: 0.1 };
  const referencia = (certo, D) => {
    let n = 0, d = 0, n2 = 0;
    for (let k = -10000; k <= 10000; k++) {
      const t = k / 2500;
      const p = probabilidadeD(item, t, D);
      const l = (certo ? p : 1 - p) * Math.exp((-t * t) / 2);
      n += t * l; n2 += t * t * l; d += l;
    }
    const m = n / d;
    return { m, dp: Math.sqrt(n2 / d - m * m) };
  };
  for (const [certo, D] of [[true, 1], [false, 1], [true, 1.7], [false, 1.7]]) {
    const ref = referencia(certo, D);
    const est = estimarEap([item], [certo], { D });
    conferir(`EAP de 1 item (${certo ? "acertou" : "errou"}, D=${D}) bate com a integral`, perto(est.theta, ref.m, 0.005) && perto(est.dp, ref.dp, 0.005), `${est.theta} x ${ref.m}`);
  }
  const vazio = estimarEap([], []);
  conferir("sem item nenhum, a estimativa é a média da priori e a incerteza é a da priori", perto(vazio.theta, 0, 1e-9) && perto(vazio.dp, 1, 0.01) && perto(vazio.nota, 500, 1e-6));
  const comNulo = estimarEap([item, { a: 2, b: -3, c: 0 }], [true, null]);
  const so = estimarEap([item], [true]);
  conferir("item fora da conta (null) não muda nada", perto(comNulo.theta, so.theta, 1e-12));
  conferir("intervalo de 95% é a nota ± 1,96 desvio-padrão", perto(so.ic95[0], so.nota - 1.96 * so.notaDp, 1e-9) && perto(so.ic95[1], so.nota + 1.96 * so.notaDp, 1e-9));
}

// ── 5. Propriedades do modelo ──
{
  const simetricos = [-2, -1, 0, 1, 2].map((b) => ({ a: 1.2, b, c: 0 }));
  const tudo = estimarEap(simetricos, simetricos.map(() => true)).theta;
  const nada = estimarEap(simetricos, simetricos.map(() => false)).theta;
  conferir("sem chute e itens simétricos, acertar tudo e errar tudo dão θ opostos", perto(tudo, -nada, 1e-9) && tudo > 0);
  conferir("o EAP não vai ao infinito (fica dentro de −4 e 4)", Math.abs(tudo) < 4);
  const itens = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((b) => ({ a: 1.5, b, c: 0.2 }));
  const coerente = estimarEap(itens, itens.map((_, i) => i < 3)).nota;
  const incoerente = estimarEap(itens, itens.map((_, i) => i >= 4)).nota;
  conferir("mesmos acertos: quem acerta as fáceis fica acima de quem acerta as difíceis", coerente > incoerente);
  conferir("mais um acerto (de qualquer item) nunca baixa a nota", itens.every((_, i) => {
    const antes = itens.map(() => false);
    const depois = antes.map((_, k) => k === i);
    return estimarEap(itens, depois).nota > estimarEap(itens, antes).nota;
  }));
  conferir("ML não existe quando acertou ou errou tudo", estimarMl(itens, itens.map(() => true)) === null && estimarMl(itens, itens.map(() => false)) === null && estimarMl(itens, itens.map(() => null)) === null);
  const ml = estimarMl(itens, itens.map((_, i) => i < 5));
  const eap = estimarEap(itens, itens.map((_, i) => i < 5)).theta;
  conferir("ML existe nos casos mistos e o EAP o puxa para o centro", ml !== null && Math.abs(eap) < Math.abs(ml) + 1e-9);
  const faixa = faixaPorAcertos(itens);
  conferir("faixa por acertos: 8 linhas, cada uma com min ≤ max, e crescendo", faixa.length === 8 && faixa.every((f, i) => f.min <= f.max && (i === 0 || (f.min >= faixa[i - 1].min && f.max >= faixa[i - 1].max))));
  conferir("faixa por acertos: com 0 ou todos acertos não há folga; no meio há", perto(faixa[0].min, faixa[0].max, 1e-9) && perto(faixa[7].min, faixa[7].max, 1e-9) && faixa[3].max - faixa[3].min > 20);
  const gab = [{ g: "A" }, { g: "C" }, { g: "E" }, { g: "B" }];
  conferir("corrigir letras: acerta, erra, branco e ignora caixa e espaços", corrigirLetras(gab, "a c e-").join() === "true,true,true,false" && corrigirLetras(gab, "ABEB").join() === "true,false,true,true" && corrigirLetras(gab, "").every((x) => x === false));
}

// ── 6. Os parâmetros reais de public/tri/ ──
{
  const indice = json("public", "tri", "indice.json");
  conferir("índice cobre 2009 a 2023", indice.anos.length === 15 && indice.anos[0] === 2009 && indice.anos[14] === 2023);
  let abandonados = 0;
  for (const ano of indice.anos) {
    const prova = json("public", "tri", `enem-${ano}.json`);
    const questoes = json("public", "questoes", `enem-${ano}.json`).questoes;
    const porId = new Map(questoes.map((q) => [q.id, q]));
    conferir(`${ano}: cita o zip dos microdados do Inep`, prova.url === `https://download.inep.gov.br/microdados/microdados_enem_${ano}.zip`);
    for (const area of ["linguagens", "humanas", "natureza", "matematica"]) {
      const A = prova.areas[area];
      const rotulo = `${ano} ${area}`;
      conferir(`${rotulo}: tem caderno e prova`, !!A && A.prova > 0 && typeof A.cor === "string");
      const variantes = area === "linguagens" ? ["ingles", "espanhol"] : [null];
      for (const v of variantes) {
        const itens = itensDaArea(A, v ?? "ingles");
        conferir(`${rotulo}${v ? " " + v : ""}: 45 itens`, itens.length === 45, String(itens.length));
        const cos = new Set(itens.map((i) => i.co));
        conferir(`${rotulo}${v ? " " + v : ""}: código de item sem repetição`, cos.size === 45);
        conferir(`${rotulo}${v ? " " + v : ""}: gabarito de A a E (X só nos abandonados)`, itens.every((i) => /^[A-E]$/.test(i.g) || (i.aban && i.g === "X")));
        for (const i of itens) {
          if (i.fora) { abandonados++; conferir(`${rotulo} ${i.co}: item fora da conta não traz parâmetro`, i.aban === true || i.a === undefined); continue; }
          // Há itens publicados com parâmetros extremos (a de 0,05 a 8, b até 17): são os do Inep e ficam como estão.
          if (!(i.a > 0 && i.a < 10 && Math.abs(i.b) < 20 && i.c >= 0 && i.c <= 0.5)) conferir(`${rotulo} ${i.co}: parâmetros plausíveis`, false, JSON.stringify(i));
        }
      }
      conferir(`${rotulo}: ligadas ao site conferem com o contador`, [...A.itens, ...(A.idiomas?.espanhol ?? [])].filter((i) => i.q).length === A.ligadas);
      // cada ligação confere: a questão existe, é da mesma área e o gabarito dela é o do Inep
      for (const i of [...A.itens, ...(A.idiomas?.espanhol ?? [])]) {
        if (!i.q) continue;
        const q = porId.get(i.q);
        if (!q || q.area !== area || "ABCDE"[q.resposta] !== i.g) conferir(`${rotulo} ${i.q}: ligação confere com o gabarito`, false, `${i.q} ${i.g}`);
      }
    }
  }
  conferir("pelo menos um item abandonado pelo Inep aparece marcado", abandonados > 0);

  // Valores lidos à mão do ITENS_PROVA_2022.csv (caderno azul de humanas, CO_PROVA 1055):
  //   46;CH;140506;D;26;0;;0.98121;1.34897;0.06218;AZUL;1055   e   90;CH;111984;A;3;0;;1.90716;1.36087;0.22521;AZUL;1055
  const h22 = json("public", "tri", "enem-2022.json").areas.humanas;
  const i1 = h22.itens.find((i) => i.co === 140506);
  const i2 = h22.itens.find((i) => i.co === 111984);
  conferir("2022 humanas: item 140506 igual ao CSV do Inep", h22.prova === 1055 && h22.cor === "AZUL" && i1 && i1.p === 46 && i1.g === "D" && i1.a === 0.98121 && i1.b === 1.34897 && i1.c === 0.06218);
  conferir("2022 humanas: item 111984 igual ao CSV do Inep", i2 && i2.p === 90 && i2.g === "A" && i2.a === 1.90716 && i2.b === 1.36087 && i2.c === 0.22521);
  conferir("2022 humanas: o item 84199 (bisserial negativa) está fora da conta", json("public", "tri", "enem-2022.json").areas.humanas.itens.some((i) => i.co === 84199 && i.aban));

  // Uma prova de verdade: acertar tudo e errar tudo dão notas plausíveis e o acaso (o c) não deixa a nota despencar.
  const m22 = itensDaArea(json("public", "tri", "enem-2022.json").areas.matematica).filter((i) => !i.fora);
  const todos = estimarEap(m22, m22.map(() => true));
  const nenhum = estimarEap(m22, m22.map(() => false));
  conferir("2022 matemática: tudo certo > 800 e tudo errado < 450 (sanidade da escala)", todos.nota > 800 && nenhum.nota < 450, `${todos.nota.toFixed(0)} / ${nenhum.nota.toFixed(0)}`);
  const media = estimarEap(m22, m22.map((_, i) => i % 2 === 0));
  conferir("a incerteza com ~43 itens fica entre 15 e 90 pontos", media.notaDp > 15 && media.notaDp < 90, media.notaDp.toFixed(1));
  const faixa = faixaPorAcertos(m22);
  const meio = faixa[Math.floor(m22.length / 2)];
  conferir("2022 matemática: com a metade de acertos, a nota varia mais de 50 pontos conforme o padrão", meio.max - meio.min > 50, String(meio.max - meio.min));
  const d1 = estimarEap(m22, m22.map((_, i) => i % 2 === 0), { D: 1 }).nota;
  conferir("trocar D de 1,7 para 1 muda a nota (por isso o laboratório avisa)", Math.abs(d1 - media.nota) > 1);
}

// ── 7. Texto e script ──
{
  const t = json("i18n", "estudo", "pt.json").enem.tri;
  const texto = JSON.stringify(t).toLowerCase();
  conferir("textos: sem as palavras proibidas na interface", !/universidade|diploma/.test(texto));
  conferir("textos: o aviso de estimativa existe e fala em margem de erro", /margem de erro/i.test(t.aviso) && /estimativa/i.test(t.aviso));
  conferir("textos: as fontes do Inep estão citadas", Array.isArray(t.fontes) && t.fontes.length >= 3 && t.fontes.every((f) => /^https:\/\/(download|www)\.[a-z.]*inep\.gov\.br|^https:\/\/www\.gov\.br\/inep/.test(f.url)));
  const gerador = fs.readFileSync(path.join(raiz, "scripts", "enem", "gerar-parametros-tri.mjs"), "utf8");
  conferir("gerador baixa só o CSV de itens (Range) e não inventa parâmetro", /ITENS_PROVA/.test(gerador) && fs.readFileSync(path.join(raiz, "scripts", "enem", "zip-remoto.mjs"), "utf8").includes("Range"));
}

console.log(`tri: ${ok} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
