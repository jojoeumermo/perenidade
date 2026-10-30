// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o jogo Rumos: cada baralho de content/jogos/rumos-*.json passa no validador (com as aulas existindo), o
// validador recusa os erros de formato, o motor faz o que promete (semente, limites, marcas, encadeamento, fases,
// progressão) e a simulação de milhares de partidas alcança todas as cartas e todos os desfechos de cada baralho.
// Uso: npm run testar:jogos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { entraNaCopia } from "../lib/estudo.ts";
import { BARALHOS_DE_RUMOS } from "../lib/laboratorios.ts";
import { aulasDaPartida, CHAVE_JOGOS, escolher, faseAtual, lerProgresso, mexeCom, novaPartida, registrarPartida, validarBaralho } from "../lib/rumos.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const aulaExiste = (href) => fs.existsSync(path.join(raiz, "content", `${href.slice(1)}.md`));
const copia = (x) => JSON.parse(JSON.stringify(x));

// ───────────── Os baralhos de verdade ─────────────

const arquivos = fs.readdirSync(path.join(raiz, "content/jogos")).filter((f) => /^rumos-.+\.json$/.test(f));
const ids = arquivos.map((f) => f.replace(/^rumos-|\.json$/g, ""));
conferir("todo arquivo rumos-*.json está registrado em lib/laboratorios.ts", ids.every((id) => BARALHOS_DE_RUMOS.includes(id)), ids.join(", "));
conferir("todo baralho registrado tem arquivo", BARALHOS_DE_RUMOS.every((id) => ids.includes(id)));
const pagina = fs.readFileSync(path.join(raiz, "app/[lang]/laboratorios/jogos/page.tsx"), "utf8");
for (const id of BARALHOS_DE_RUMOS) conferir(`a página de jogos importa o baralho ${id}`, pagina.includes(`@/content/jogos/rumos-${id}.json`) && pagina.includes(`"${id}":`));

const baralhos = BARALHOS_DE_RUMOS.filter((id) => ids.includes(id)).map((id) => JSON.parse(fs.readFileSync(path.join(raiz, `content/jogos/rumos-${id}.json`), "utf8")));
for (const b of baralhos) {
  const erros = validarBaralho(b, { aulaExiste });
  conferir(`baralho ${b.id} válido`, erros.length === 0, erros.join("\n  "));
  conferir(`baralho ${b.id}: o id bate com o nome do arquivo`, ids.includes(b.id));
  conferir(`baralho ${b.id}: sem nome de pessoa da coordenação`, !/jonathan/i.test(JSON.stringify(b)));
  const fontes = b.cartas.filter((c) => c.historia?.fonte?.titulo && c.historia?.fonte?.autor).length;
  conferir(`baralho ${b.id}: toda carta com fato e fonte`, fontes === b.cartas.length);
}
const total = baralhos.reduce((s, b) => s + b.cartas.length, 0);
const idsDeTodas = baralhos.flatMap((b) => b.cartas.map((c) => `${b.id}/${c.id}`));
conferir("ids de carta únicos entre baralhos", new Set(idsDeTodas).size === idsDeTodas.length);

// ───────────── O validador recusa o que está errado ─────────────

const base = baralhos.find((b) => b.modo === "fases");
const recusa = (nome, mudar, trecho) => {
  const b = copia(base);
  mudar(b);
  const erros = validarBaralho(b, { aulaExiste });
  conferir(`validador: ${nome}`, erros.some((e) => e.includes(trecho)), erros.join(" | ") || "nenhum erro");
};
if (base) {
  conferir("validador: o baralho de base passa", validarBaralho(base, { aulaExiste }).length === 0);
  recusa("formato errado", (b) => (b.formato = "outro"), "formato");
  recusa("três medidores", (b) => b.medidores.pop(), "exatamente 4");
  recusa("início fora da faixa", (b) => (b.inicio[b.medidores[0].id] = 100), `inicio.${base.medidores[0].id}`);
  recusa("efeito em medidor que não existe", (b) => (b.cartas[0].esquerda.efeito = { inexistente: 5 }), "medidor que não existe");
  recusa("efeito zero", (b) => (b.cartas[0].esquerda.efeito = { [b.medidores[0].id]: 0 }), "sem zero");
  recusa("efeito grande demais", (b) => (b.cartas[0].esquerda.efeito = { [b.medidores[0].id]: 45 }), "de -30 a 30");
  recusa("carta repetida", (b) => b.cartas.push(copia(b.cartas[0])), "carta repetida");
  recusa("encadeamento para carta que não existe", (b) => (b.cartas[0].direita.proxima = "nao-existe"), '"proxima" aponta');
  recusa("carta sem fonte", (b) => delete b.cartas[0].historia.fonte, "fonte precisa de título e autor");
  recusa("fonte sem https", (b) => (b.cartas[0].historia.fonte.url = "http://exemplo.org"), "https");
  recusa("aula fora de /trilhas", (b) => (b.cartas[0].aula.href = "/acervo/x"), "/trilhas/<trilha>/<aula>");
  recusa("aula que não existe", (b) => (b.cartas[0].aula.href = "/trilhas/nao-existe/aula-nenhuma"), "não existe");
  recusa("marca lida que ninguém liga", (b) => (b.cartas[0].condicao = { flags: ["marca-fantasma"] }), 'marca "marca-fantasma" é lida');
  recusa("marca ligada que ninguém lê", (b) => (b.cartas[0].esquerda.liga = ["marca-solta"]), 'marca "marca-solta" é ligada');
  recusa("falta um desfecho de queda", (b) => (b.finais = b.finais.filter((f) => !(f.tipo === "queda" && f.medidor === b.medidores[0].id && f.limite === "cem"))), "falta o desfecho");
  recusa("falta a chegada sem condição", (b) => (b.finais = b.finais.filter((f) => f.tipo !== "chegada" || f.condicao)), "chegada sem condição");
  recusa("personagem desconhecido", (b) => (b.cartas[0].personagem = "ninguem"), "personagem desconhecido");
  recusa("fase desconhecida", (b) => (b.cartas[0].fase = "fase-nenhuma"), "fase desconhecida");
  recusa("duas escolhas iguais", (b) => (b.cartas[0].direita.texto = b.cartas[0].esquerda.texto), "mesmo texto");
  recusa("texto com espaço sobrando", (b) => (b.cartas[0].texto = `${b.cartas[0].texto} `), "texto de 20 a 420");
  recusa("citar outro jogo", (b) => (b.sobre = "Igual ao Reigns."), "não cita outro jogo");
}
const sorteio = baralhos.find((b) => b.modo === "sorteio");
if (sorteio) {
  const b = copia(sorteio);
  b.cartas[0].esquerda.liga = ["x"];
  b.cartas[1].condicao = { flags: ["x"] };
  const erros = validarBaralho(b, { aulaExiste });
  conferir("validador: no sorteio não há marcas nem condições", erros.some((e) => e.includes("no modo sorteio")), erros.join(" | "));
  const semArea = copia(sorteio);
  delete semArea.cartas[0].area;
  conferir("validador: no sorteio toda carta tem área", validarBaralho(semArea).some((e) => e.includes("toda carta tem área")));
}

// ───────────── O motor ─────────────

const mini = {
  formato: "rumos/1",
  id: "mini",
  titulo: "Mini",
  resumo: "Baralho de teste.",
  papel: "Você testa.",
  sobre: "Só para o teste.",
  modo: "fases",
  medidores: ["a", "b", "c", "d"].map((id) => ({ id, nome: `Medidor ${id}`, descricao: `Medidor ${id} de teste.` })),
  inicio: { a: 50, b: 50, c: 50, d: 90 },
  personagens: [{ id: "p", nome: "Pessoa", papel: "de teste" }],
  fases: [
    { id: "um", nome: "Fase um", cartas: 2 },
    { id: "dois", nome: "Fase dois", cartas: 2 },
  ],
  cartas: [],
  finais: [],
};
const nota = { texto: "Um fato qualquer, com fonte, só para o teste do motor.", fonte: { titulo: "Teste", autor: "Teste" } };
const aula = { titulo: "Aula", href: "/trilhas/historia-do-brasil/a-era-vargas" };
const carta = (id, fase, esquerda, direita, extra = {}) => ({ id, titulo: `Carta ${id}`, personagem: "p", fase, texto: "Texto da carta para o teste do motor.", esquerda: { texto: "Esquerda", retorno: "Retorno da esquerda no teste.", ...esquerda }, direita: { texto: "Direita", retorno: "Retorno da direita no teste.", ...direita }, historia: nota, aula, ...extra });
mini.cartas = [
  carta("u1", "um", { efeito: { a: 5 }, liga: ["marca"] }, { efeito: { a: -5 }, proxima: "puxada" }),
  carta("u2", "um", { efeito: { b: 5 } }, { efeito: { b: -5 } }),
  carta("u3", "um", { efeito: { c: 5 } }, { efeito: { c: -5 } }),
  carta("puxada", "um", { efeito: { c: 1 } }, { efeito: { c: -1 } }, { soEncadeada: true }),
  carta("d1", "dois", { efeito: { a: 5 } }, { efeito: { d: 20 } }),
  carta("d2", "dois", { efeito: { b: 5 } }, { efeito: { b: -5 } }),
  carta("d3", "dois", { efeito: { c: 5 } }, { efeito: { c: -5 } }),
  carta("so-com-marca", "dois", { efeito: { a: 1 } }, { efeito: { a: -1 } }, { condicao: { flags: ["marca"] }, peso: 10 }),
  carta("segunda-vez", "dois", { efeito: { a: 1 } }, { efeito: { a: -1 } }, { condicao: { partidas: 1 }, peso: 10 }),
  carta("u4", "um", { efeito: { a: 1 } }, { efeito: { a: -1 } }),
  carta("d4", "dois", { efeito: { a: 1 } }, { efeito: { a: -1 } }),
  carta("d5", "dois", { efeito: { a: 1 } }, { efeito: { a: -1 } }),
];
mini.finais = [
  ...mini.medidores.flatMap((m) => ["zero", "cem"].map((limite) => ({ id: `${m.id}-${limite}`, tipo: "queda", medidor: m.id, limite, titulo: `Queda ${m.id}`, texto: "Desfecho de queda para o teste." }))),
  { id: "com-marca", tipo: "chegada", condicao: { flags: ["marca"] }, titulo: "Com marca", texto: "Chegou ao fim com a marca ligada." },
  { id: "chegada", tipo: "chegada", titulo: "Chegada", texto: "Chegou ao fim sem marca nenhuma." },
];
conferir("o baralho de teste é válido", validarBaralho(mini).length === 0, validarBaralho(mini).join(" | "));

const p1 = novaPartida(mini, { semente: 42 });
const p2 = novaPartida(mini, { semente: 42 });
conferir("mesma semente, mesma carta", p1.atual === p2.atual);
conferir("a primeira carta é da primeira fase", mini.cartas.find((c) => c.id === p1.atual).fase === "um");
conferir("a carta só encadeada não sai no sorteio", Array.from({ length: 200 }, (_, i) => novaPartida(mini, { semente: i }).atual).every((id) => id !== "puxada"));
// Força a carta u1 na mesa para testar marca e encadeamento.
const naMesa = { ...p1, atual: "u1" };
const comMarca = escolher(mini, naMesa, "esquerda");
conferir("a escolha liga a marca", comMarca.flags.includes("marca"));
conferir("a partida antiga não muda", naMesa.jogadas.length === 0 && naMesa.flags.length === 0);
const puxou = escolher(mini, naMesa, "direita");
conferir("a escolha puxa a carta encadeada", puxou.atual === "puxada");
conferir("a jogada guarda antes e depois", puxou.jogadas[0].antes.a === 50 && puxou.jogadas[0].depois.a === 45);
// Queda: d começa em 90 e d1 à direita soma 20.
const quase = { ...p1, atual: "d1" };
const caiu = escolher(mini, quase, "direita");
conferir("chegar a 100 encerra com o desfecho certo", caiu.fim === "d-cem" && caiu.atual === null, String(caiu.fim));
conferir("o medidor não passa de 100", caiu.medidores.d === 100);
conferir("partida encerrada não aceita escolha", escolher(mini, caiu, "esquerda") === caiu);
// Fases: as duas primeiras cartas são da fase um, as duas seguintes da dois; depois, chegada.
const jogarAteOFim = (b, semente, politica, progresso, area = null) => {
  let p = novaPartida(b, { semente, progresso, area });
  let passos = 0;
  while (!p.fim && passos < 200) {
    const c = b.cartas.find((x) => x.id === p.atual);
    p = escolher(b, p, politica(c, p), progresso);
    passos++;
  }
  return p;
};
const alternar = (c, p) => (p.jogadas.length % 2 ? "esquerda" : "direita");
let fasesCertas = true;
for (let s = 0; s < 100; s++) {
  const p = jogarAteOFim(mini, s, (c) => (c.id === "d1" ? "esquerda" : "esquerda"));
  const fases = p.jogadas.filter((j) => !mini.cartas.find((c) => c.id === j.carta).soEncadeada).map((j) => mini.cartas.find((c) => c.id === j.carta).fase);
  if (fases.join() !== "um,um,dois,dois") fasesCertas = false;
}
conferir("as fases vêm na ordem e com o número certo de cartas", fasesCertas);
conferir("faseAtual no começo é a primeira", faseAtual(mini, { jogadas: [] }).id === "um");
const fins = new Set(Array.from({ length: 300 }, (_, s) => jogarAteOFim(mini, s, alternar).fim));
conferir("chega ao fim com desfecho de chegada", fins.has("chegada") || fins.has("com-marca"), [...fins].join());
let viuSegunda = false;
let viuSegundaSemPartida = false;
let viuMarcada = false;
let viuMarcadaSemMarca = false;
for (let s = 0; s < 300; s++) {
  const primeira = jogarAteOFim(mini, s, () => "esquerda", { partidas: 0, finais: [] });
  if (primeira.jogadas.some((j) => j.carta === "segunda-vez")) viuSegundaSemPartida = true;
  const depois = jogarAteOFim(mini, s, () => "esquerda", { partidas: 1, finais: [] });
  if (depois.jogadas.some((j) => j.carta === "segunda-vez")) viuSegunda = true;
  const semMarca = jogarAteOFim(mini, s, () => "direita");
  if (semMarca.jogadas.some((j) => j.carta === "so-com-marca")) viuMarcadaSemMarca = true;
  if (primeira.jogadas.some((j) => j.carta === "so-com-marca")) viuMarcada = true;
}
conferir("carta de segunda partida não sai na primeira", !viuSegundaSemPartida);
conferir("carta de segunda partida sai a partir da segunda", viuSegunda);
conferir("carta com condição de marca só sai com a marca", viuMarcada && !viuMarcadaSemMarca);
conferir("mexeCom diz o peso, não o rumo", JSON.stringify(mexeCom({ efeito: { a: -20, b: 5 } })) === JSON.stringify([{ medidor: "a", forte: true }, { medidor: "b", forte: false }]));
const pAulas = jogarAteOFim(mini, 1, alternar);
conferir("as aulas da partida não repetem", aulasDaPartida(mini, pAulas).length === 1);

// Progresso no aparelho
class Memoria {
  constructor() { this.d = {}; }
  getItem(k) { return k in this.d ? this.d[k] : null; }
  setItem(k, v) { this.d[k] = String(v); }
}
const mem = new Memoria();
conferir("progresso vazio no começo", Object.keys(lerProgresso(mem)).length === 0);
registrarPartida({ baralho: "mini", fim: "chegada" }, mem);
registrarPartida({ baralho: "mini", fim: "chegada" }, mem);
const prog = registrarPartida({ baralho: "mini", fim: "a-zero" }, mem);
conferir("o progresso conta partidas e desfechos sem repetir", prog.mini.partidas === 3 && prog.mini.finais.join() === "chegada,a-zero");
conferir("partida sem fim não conta", registrarPartida({ baralho: "mini", fim: null }, mem).mini.partidas === 3);
mem.setItem(CHAVE_JOGOS, "{quebrado");
conferir("progresso quebrado vira vazio", Object.keys(lerProgresso(mem)).length === 0);
mem.setItem(CHAVE_JOGOS, JSON.stringify({ mini: { partidas: "x", finais: [1, "ok"] } }));
conferir("progresso com lixo é limpo", lerProgresso(mem).mini.partidas === 0 && lerProgresso(mem).mini.finais.join() === "ok");
conferir("a chave do progresso entra na cópia de segurança e no apagar", entraNaCopia(CHAVE_JOGOS));
const privacidade = fs.readFileSync(path.join(raiz, "content/paginas/privacidade.md"), "utf8");
conferir("a página de privacidade fala do progresso do jogo", /Rumos/.test(privacidade));

// ───────────── Simulação: cada baralho alcança todas as cartas e todos os desfechos ─────────────

for (const b of baralhos) {
  const cartasVistas = new Set();
  const finaisVistos = new Set();
  let maisLonga = 0;
  let travou = false;
  const registrar = (p) => {
    if (!p.fim) travou = true;
    finaisVistos.add(p.fim);
    for (const j of p.jogadas) cartasVistas.add(j.carta);
    maisLonga = Math.max(maisLonga, p.jogadas.length);
  };
  const progressos = [{ partidas: 0, finais: [] }, { partidas: 3, finais: [] }];
  const areas = b.modo === "sorteio" ? [null, "historia", "geografia", "filosofia", "sociologia"] : [null];
  for (const progresso of progressos)
    for (const area of areas)
      for (let s = 0; s < 1500; s++) {
        let sorte = (s * 2654435761) >>> 0;
        const acaso = () => ((sorte = (Math.imul(sorte ^ (sorte >>> 13), 1103515245) + 12345) >>> 0) & 1 ? "esquerda" : "direita");
        registrar(jogarAteOFim(b, s, acaso, progresso, area));
      }
  // Quem empurra um medidor para um lado, carta após carta, precisa conseguir cada queda.
  for (const m of b.medidores)
    for (const sinal of [1, -1])
      for (const area of areas)
        for (let s = 0; s < 200; s++)
          registrar(
            jogarAteOFim(b, s, (c) => ((c.esquerda.efeito[m.id] ?? 0) * sinal >= (c.direita.efeito[m.id] ?? 0) * sinal ? "esquerda" : "direita"), progressos[s % 2], area),
          );
  const faltamCartas = b.cartas.filter((c) => !cartasVistas.has(c.id)).map((c) => c.id);
  const faltamFinais = b.finais.filter((f) => !finaisVistos.has(f.id)).map((f) => f.id);
  conferir(`simulação ${b.id}: toda partida termina`, !travou);
  conferir(`simulação ${b.id}: toda carta aparece em alguma partida`, faltamCartas.length === 0, faltamCartas.join(", "));
  conferir(`simulação ${b.id}: todo desfecho acontece em alguma partida`, faltamFinais.length === 0, faltamFinais.join(", "));
  conferir(`simulação ${b.id}: partida cabe numa sentada (até 30 cartas)`, maisLonga <= 30, String(maisLonga));
}

console.log(`Rumos: ${baralhos.length} baralhos, ${total} cartas, ${baralhos.reduce((s, b) => s + b.finais.length, 0)} desfechos.`);
console.log(`${ok} conferências certas, ${falhas.length} com problema.`);
for (const f of falhas) console.log(`  FALHOU  ${f}`);
process.exit(falhas.length ? 1 : 0);
