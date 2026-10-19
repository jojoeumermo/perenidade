// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Confere os exercícios com explicação do erro (content/exercicios): o formato de cada arquivo, se a aula existe, ids
// únicos, e refaz cada conta de "conferir" contra a resposta certa. Também confere a leitura das respostas que a pessoa
// digita (frações, vírgula, milhar) e a correção. Uso: npm run testar:exercicios
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_SCHEMA, load } from "js-yaml";
import { conferirConta, corrigirEscolha, corrigirNumero, lerNumero, mesmoNumero, numeroDoTexto, validarExercicios } from "../lib/exercicios.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const valor = (t) => {
  const f = lerNumero(t);
  return f ? Number(f.n) / Number(f.d) : null;
};

// Leitura do que a pessoa digita
conferir("fração", valor("3/4") === 0.75);
conferir("vírgula", valor("0,75") === 0.75);
conferir("ponto decimal", valor("0.75") === 0.75);
conferir("milhar com ponto", valor("1.080") === 1080);
conferir("milhar e vírgula", valor("1.080,50") === 1080.5);
conferir("reais", valor("R$ 12,50") === 12.5);
conferir("porcentagem vira o número", valor("75%") === 75);
conferir("negativo e sinal tipográfico", valor("-3") === -3 && valor("−3") === -3);
conferir("fração negativa", valor("-1/2") === -0.5);
conferir("espaços", valor(" 3 / 4 ") === 0.75);
conferir("letra não é número", lerNumero("abc") === null && lerNumero("") === null && lerNumero("3/0") === null);
conferir("equivalentes", mesmoNumero("6/8", "3/4") && mesmoNumero("0,75", "3/4") && !mesmoNumero("0,7", "3/4"));
conferir("número no texto", Number(numeroDoTexto("R$ 1.280")?.n) === 1280 && Number(numeroDoTexto("5/6 da pizza")?.d) === 6);

// Correção
const [escolha] = validarExercicios(
  [{ id: "t-1", tema: "x", dificuldade: 1, enunciado: "1+1?", alternativas: [{ texto: "2", certa: true }, { texto: "3", erro: "contou um a mais" }], explicacao: "e", fonte: "f" }],
  "teste",
);
conferir("escolha certa", corrigirEscolha(escolha, 0).certo === true);
conferir("escolha errada traz o engano", corrigirEscolha(escolha, 1).certo === false && corrigirEscolha(escolha, 1).engano === "contou um a mais");
conferir("nasce em revisão", escolha.revisao.status === "em-revisao");
const [numero] = validarExercicios(
  [{ id: "t-2", tipo: "numero", tema: "x", dificuldade: 2, enunciado: "metade de 3/2?", resposta: "3/4", erros_comuns: [{ resposta: "3", explicacao: "dobrou" }], dica: "d", explicacao: "e", fonte: "f" }],
  "teste",
);
conferir("número certo, em outra forma", corrigirNumero(numero, "0,75").certo === true && corrigirNumero(numero, "6/8").certo === true);
conferir("erro comum explicado", corrigirNumero(numero, "3").engano === "dobrou");
conferir("erro desconhecido sem engano", corrigirNumero(numero, "5").certo === false && corrigirNumero(numero, "5").engano === undefined);
conferir("resposta ilegível não é erro", corrigirNumero(numero, "três quartos").certo === null);

// Arquivos que precisam falhar
const recusa = (nome, dado) => {
  try {
    validarExercicios(dado, "teste");
    falhas.push(`devia recusar: ${nome}`);
  } catch {
    ok++;
  }
};
const base = { id: "r-1", tema: "x", dificuldade: 1, enunciado: "?", explicacao: "e", fonte: "f" };
recusa("duas certas", [{ ...base, alternativas: [{ texto: "a", certa: true }, { texto: "b", certa: true }] }]);
recusa("errada sem explicação", [{ ...base, alternativas: [{ texto: "a", certa: true }, { texto: "b" }] }]);
recusa("dificuldade 4", [{ ...base, dificuldade: 4, alternativas: [{ texto: "a", certa: true }, { texto: "b", erro: "e" }] }]);
recusa("id repetido", [{ ...base, alternativas: [{ texto: "a", certa: true }, { texto: "b", erro: "e" }] }, { ...base, alternativas: [{ texto: "a", certa: true }, { texto: "b", erro: "e" }] }]);
recusa("revisada sem data", [{ ...base, revisao: { status: "revisada", por: "educador" }, alternativas: [{ texto: "a", certa: true }, { texto: "b", erro: "e" }] }]);
recusa("erro comum igual à resposta", [{ ...base, tipo: "numero", resposta: "1/2", erros_comuns: [{ resposta: "0,5", explicacao: "x" }], dica: "d" }]);
recusa("sem fonte", [{ ...base, fonte: "", alternativas: [{ texto: "a", certa: true }, { texto: "b", erro: "e" }] }]);
conferir("conta que não bate é apontada", conferirConta({ ...numero, conferir: "1/2" }).length === 1);

// Os arquivos de verdade
const pasta = path.join(raiz, "content/exercicios");
const ids = new Map();
let total = 0;
let nivelamento = 0;
if (fs.existsSync(pasta)) {
  for (const trilha of fs.readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const aulas = fs.existsSync(path.join(raiz, "content/trilhas", trilha.name)) ? fs.readdirSync(path.join(raiz, "content/trilhas", trilha.name)) : [];
    conferir(`a trilha ${trilha.name} existe`, aulas.length > 0);
    for (const nome of fs.readdirSync(path.join(pasta, trilha.name)).filter((n) => n.endsWith(".yml"))) {
      const aula = nome.slice(0, -4);
      const arquivo = `content/exercicios/${trilha.name}/${nome}`;
      conferir(`${arquivo}: a aula existe`, aulas.some((a) => a === `${aula}.md` || new RegExp(`^\\d+-${aula}\\.md$`).test(a)));
      let lista = [];
      try {
        lista = validarExercicios(load(fs.readFileSync(path.join(pasta, trilha.name, nome), "utf8"), { schema: CORE_SCHEMA }), arquivo);
        ok++;
      } catch (erro) {
        falhas.push(erro.message);
      }
      for (const ex of lista) {
        total++;
        if (ex.nivelamento) nivelamento++;
        conferir(`id único: ${ex.id}`, !ids.has(ex.id), ids.get(ex.id));
        ids.set(ex.id, arquivo);
        if (ex.tipo === "numero") conferir(`${ex.id}: questão de número tem "conferir"`, Boolean(ex.conferir));
        const problemas = conferirConta(ex);
        if (problemas.length) falhas.push(...problemas);
        else ok++;
      }
    }
  }
}
conferir("há exercícios", total > 0);

console.log(`exercícios: ${total} conferidos (${nivelamento} no nivelamento); ${ok} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
