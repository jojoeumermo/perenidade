// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere o laboratório da TRI (docs/ENEM-TRI.md): a conta do modelo de 3 parâmetros, o EAP, a escala (500, 100) e os
// parâmetros REAIS de public/tri/ (extraídos dos microdados do Inep), inclusive contra valores lidos à mão do arquivo
// ITENS_PROVA_2022.csv e contra o gabarito das questões do site. Uso: npm run testar:tri
import fs from "node:fs";
import path from "node:path";
import { cenarioDeGabarito, corrigirLetras, D_PADRAO, ePadraoPerfeito, ESCALA_POR_AREA, estimarEap, estimarMl, faixaPorAcertos, itensDaArea, notaDeGabaritoDaProva, notaDeTheta, notaDeThetaDaArea, probabilidadeD, quadratura, thetaDeNota, thetaDeNotaDaArea } from "../lib/enem-tri.ts";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const perto = (x, y, tol) => Math.abs(x - y) <= tol;
const raiz = process.cwd();
const json = (...p) => JSON.parse(fs.readFileSync(path.join(raiz, ...p), "utf8"));

// ── 1. A conta do modelo (feita à mão) ──
{
  conferir("D padrão é 1 (o que reproduz as notas oficiais)", D_PADRAO === 1);
  for (const D of [1, 1.7]) conferir(`P(θ = b) = c + (1 − c)/2 com D = ${D}`, perto(probabilidadeD({ a: 1.3, b: 0.4, c: 0.2 }, 0.4, D), 0.6, 1e-12));
  // a = 1, b = 0, c = 0,2, θ = 1, D = 1,7: 0,2 + 0,8 / (1 + e^−1,7) = 0,2 + 0,8 × 0,845535 = 0,876428
  conferir("P(1 | a=1, b=0, c=0,2, D=1,7) = 0,876428", perto(probabilidadeD({ a: 1, b: 0, c: 0.2 }, 1, 1.7), 0.876428, 1e-6));
  conferir("sem o 1,7 (D=1) a mesma conta dá 0,2 + 0,8 × 0,731059 = 0,784847", perto(probabilidadeD({ a: 1, b: 0, c: 0.2 }, 1, 1), 0.784847, 1e-6));
  conferir("longe da dificuldade: embaixo sobra o chute, em cima chega a 1", perto(probabilidadeD({ a: 2, b: 0, c: 0.15 }, -20), 0.15, 1e-9) && perto(probabilidadeD({ a: 2, b: 0, c: 0.15 }, 20), 1, 1e-9));
}

// ── 2. A escala nominal (500, 100) e a escala efetiva por área ──
{
  conferir("escala nominal: nota = 500 + 100·θ", notaDeTheta(0) === 500 && notaDeTheta(1.5) === 650 && notaDeTheta(-2) === 300);
  conferir("escala nominal: θ = (nota − 500)/100 é a inversa", thetaDeNota(notaDeTheta(0.37)) === 0.37 && perto(thetaDeNota(720), 2.2, 1e-12));
  // A escala efetiva de cada área (ESCALA_POR_AREA): conferida na população completa do Enem 2024 — 12.330.462 notas
  // oficiais dos microdados reproduzidas com erro absoluto médio de 0,025 ponto (docs/ENEM-TRI.md).
  conferir("as quatro áreas têm régua própria, toda perto da nominal", ["linguagens", "humanas", "natureza", "matematica"].every((a) => { const e = ESCALA_POR_AREA[a]; return e.slope > 100 && e.slope < 135 && Math.abs(e.intercept - 500) < 2; }));
  conferir("matemática: nota = 129,646·θ + 500,019", perto(notaDeThetaDaArea(1, "matematica"), 629.6656, 1e-3) && perto(notaDeThetaDaArea(0, "matematica"), 500.0194, 1e-3));
  conferir("escala da área: θ e nota são inversas", ["linguagens", "humanas", "natureza", "matematica"].every((a) => perto(thetaDeNotaDaArea(notaDeThetaDaArea(0.37, a), a), 0.37, 1e-12)));
  const um = estimarEap([{ a: 1, b: 0.5, c: 0.1 }], [true], { area: "matematica" });
  conferir("o EAP usa a régua da área quando ela é informada", perto(um.nota, notaDeThetaDaArea(um.theta, "matematica"), 1e-9) && perto(um.notaDp, um.dp * ESCALA_POR_AREA.matematica.slope, 1e-9) && perto(um.ic95[0], notaDeThetaDaArea(um.theta - 1.96 * um.dp, "matematica"), 1e-9));
  const sem = estimarEap([{ a: 1, b: 0.5, c: 0.1 }], [true]);
  conferir("sem área, o EAP fica na régua nominal", perto(sem.nota, notaDeTheta(sem.theta), 1e-9));
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
  conferir("índice cobre 2009 a 2025", indice.anos.length === 17 && indice.anos[0] === 2009 && indice.anos[16] === 2025);
  let abandonados = 0;
  for (const ano of indice.anos) {
    const prova = json("public", "tri", `enem-${ano}.json`);
    // 2024 e 2025 ainda não têm banco de questões no site: os itens ficam sem ligação e os testes de ligação pulam.
    const arqQ = path.join(raiz, "public", "questoes", `enem-${ano}.json`);
    const questoes = fs.existsSync(arqQ) ? JSON.parse(fs.readFileSync(arqQ, "utf8")).questoes : [];
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

  // Valores lidos à mão do ITENS_PROVA_2024.csv (caderno azul de matemática, CO_PROVA 1407, 1ª aplicação):
  const m24 = json("public", "tri", "enem-2024.json").areas.matematica;
  const j1 = m24.itens.find((i) => i.co === 111708), j2 = m24.itens.find((i) => i.co === 15394);
  conferir("2024 matemática: item 111708 igual ao CSV do Inep", m24.prova === 1407 && m24.cor === "AZUL" && j1 && j1.p === 150 && j1.g === "C" && j1.a === 1.02692 && j1.b === 3.36222 && j1.c === 0.18689);
  conferir("2024 matemática: item 15394 igual ao CSV do Inep", j2 && j2.p === 151 && j2.g === "E" && j2.a === 3.90485 && j2.b === 2.50442 && j2.c === 0.11173);
  // Valores lidos à mão do ITENS_PROVA_2025.csv (caderno azul de matemática, CO_PROVA 1471, 1ª aplicação):
  const m25 = json("public", "tri", "enem-2025.json").areas.matematica;
  conferir("2025 matemática: caderno 1471 AZUL da 1ª aplicação", m25.prova === 1471 && m25.cor === "AZUL");

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
  const d17 = estimarEap(m22, m22.map((_, i) => i % 2 === 0), { D: 1.7 }).nota;
  conferir("trocar D de 1 para 1,7 muda a nota (por isso o laboratório deixa trocar)", Math.abs(d17 - media.nota) > 1);
}

// ── 6.5. A nota de gabarito (quem acerta tudo) ──
{
  conferir("padrão perfeito: tudo certo conta, qualquer erro ou tudo nulo não", ePadraoPerfeito([true, true]) && !ePadraoPerfeito([true, false]) && !ePadraoPerfeito([null, null]) && ePadraoPerfeito([true, null]));
  conferir("nota de gabarito: número direto, por idioma, ou ausente", notaDeGabaritoDaProva({ notaGabarito: 858.7 }) === 858.7 && notaDeGabaritoDaProva({ notaGabarito: { espanhol: 795.8 } }, "espanhol") === 795.8 && notaDeGabaritoDaProva({ notaGabarito: { espanhol: 795.8 } }, "ingles") === undefined && notaDeGabaritoDaProva({}) === undefined);
  const dois = [{ a: 2, b: 0, c: 0.2 }, { a: 1.5, b: 1, c: 0.15 }];
  const gab = estimarEap(dois, [true, true], { notaGabarito: 795.8 });
  conferir("com nota de gabarito, acertar tudo devolve exatamente ela, sem margem", gab.nota === 795.8 && gab.ic95[0] === 795.8 && gab.ic95[1] === 795.8 && gab.notaDp === 0);
  const quase = estimarEap(dois, [true, false], { notaGabarito: 795.8 });
  conferir("errando uma, a nota de gabarito não se aplica", quase.nota !== 795.8 && quase.notaDp > 0);
  // Dado real OBSERVADO (não regra geral comprovada do Inep): nos microdados de 2024, os 18 participantes que
  // gabaritaram LC em inglês (TP_LINGUA 0) receberam 795,8; os parâmetros da prova dariam 787,8. Conferido por nós
  // na população completa de 2024; o analise-enem observa o mesmo e descreve como a nota de gabarito de outro
  // caderno da edição. O valor vale só para esta prova, idioma e edição.
  const lc24 = json("public", "tri", "enem-2024.json").areas.linguagens;
  conferir("2024 linguagens: nota de gabarito só para o inglês", notaDeGabaritoDaProva(lc24, "ingles") === 795.8 && notaDeGabaritoDaProva(lc24, "espanhol") === undefined);
  const itIng = itensDaArea(lc24, "ingles");
  const gabIng = estimarEap(itIng, itIng.map((i) => (i.fora ? null : true)), { area: "linguagens", notaGabarito: notaDeGabaritoDaProva(lc24, "ingles") });
  conferir("2024 LC inglês: gabaritar devolve a nota oficial 795,8", gabIng.nota === 795.8);
  const itEsp = itensDaArea(lc24, "espanhol");
  const gabEsp = estimarEap(itEsp, itEsp.map((i) => (i.fora ? null : true)), { area: "linguagens", notaGabarito: notaDeGabaritoDaProva(lc24, "espanhol") });
  conferir("2024 LC espanhol: sem exceção, o modelo já cai em 795,8 (±0,1)", perto(gabEsp.nota, 795.8, 0.1), gabEsp.nota.toFixed(2));
  // 2025 VERIFICADO por nós nos microdados oficiais (RESULTADOS_2025.csv, 4.810.772 inscritos): LC 794,5
  // (inglês n=84; espanhol n=1), CN 858,7 (n=67), MT 980,3 (n=88). CH não precisa: o modelo já dá 856,4 exato.
  const p25 = json("public", "tri", "enem-2025.json").areas;
  conferir("2025: notas de gabarito verificadas nos microdados (LC 794,5 ing/esp; CN 858,7; MT 980,3; CH ausente)",
    notaDeGabaritoDaProva(p25.linguagens, "ingles") === 794.5 && notaDeGabaritoDaProva(p25.linguagens, "espanhol") === 794.5
    && notaDeGabaritoDaProva(p25.natureza) === 858.7 && notaDeGabaritoDaProva(p25.matematica) === 980.3 && notaDeGabaritoDaProva(p25.humanas) === undefined);
  const lc25Ing = itensDaArea(p25.linguagens, "ingles");
  const gab25 = estimarEap(lc25Ing, lc25Ing.map((i) => (i.fora ? null : true)), { area: "linguagens", notaGabarito: notaDeGabaritoDaProva(p25.linguagens, "ingles") });
  conferir("2025 LC inglês: gabaritar devolve a nota oficial 794,5", gab25.nota === 794.5);
  // Regra observada em 2025 para item anulado que MANTEVE a letra do gabarito (MT 1471: item 97593, "A"; CN 1483:
  // item 96748, "B"): a nota fixa só sai para quem acertou esse item; quem gabaritou os ativos e o errou (ou não o
  // respondeu) recebe a nota EAP normal (MT 967,7; CN 852,4). Itens anulados com gabarito "X" não contam.
  for (const [nome, bloco, area, fixa, eap] of [["MT 1471", p25.matematica, "matematica", 980.3, 967.7], ["CN 1483", p25.natureza, "natureza", 858.7, 852.4]]) {
    const its = itensDaArea(bloco);
    const resp = its.map((i) => (i.fora ? null : true));
    const anulados = its.filter((i) => i.fora && i.g && i.g !== "X");
    conferir(`${nome}: a prova tem exatamente 1 anulado-com-letra`, anulados.length === 1, String(anulados.length));
    const ng = notaDeGabaritoDaProva(bloco);
    const certo = estimarEap(its, resp, { area, notaGabarito: ng, anuladosComLetra: [true] });
    conferir(`${nome}: gabaritou tudo incluindo o anulado → nota fixa ${fixa}`, certo.nota === fixa);
    const errado = estimarEap(its, resp, { area, notaGabarito: ng, anuladosComLetra: [false] });
    conferir(`${nome}: gabaritou os ativos mas errou o anulado → EAP ${eap} (±0,1)`, perto(errado.nota, eap, 0.1), errado.nota.toFixed(2));
    const semResp = estimarEap(its, resp, { area, notaGabarito: ng, anuladosComLetra: [null] });
    conferir(`${nome}: sem resposta do anulado não concede a nota fixa`, perto(semResp.nota, eap, 0.1), semResp.nota.toFixed(2));
    conferir(`${nome}: cenário gabarito/indefinido/comum`,
      cenarioDeGabarito(resp, [true]) === "gabarito" && cenarioDeGabarito(resp, [null]) === "indefinido" && cenarioDeGabarito(resp, [false]) === "comum" && cenarioDeGabarito(resp.map((r, i) => (i === 0 ? false : r)), [true]) === "comum");
  }
  // A faixa "acertei X" usa a mesma régua da área: no topo, todos os padrões coincidem com o EAP da área.
  const mt24 = itensDaArea(json("public", "tri", "enem-2024.json").areas.matematica).filter((i) => !i.fora);
  const fArea = faixaPorAcertos(mt24, { area: "matematica" });
  const tudo = estimarEap(mt24, mt24.map(() => true), { area: "matematica" });
  conferir("faixa por acertos usa a régua da área (topo coincide com o EAP da área)", perto(fArea[mt24.length].min, tudo.nota, 1e-9) && perto(fArea[mt24.length].max, tudo.nota, 1e-9));
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
