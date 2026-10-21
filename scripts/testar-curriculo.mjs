// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O aplicador de currículo, numa cópia temporária dos arquivos do site: cria, edita e remove disciplinas e trilhas.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aplicarTodas, lerAreas } from "./curriculo.mjs";

const raizReal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "curriculo-"));
fs.mkdirSync(path.join(raiz, "lib"), { recursive: true });
fs.mkdirSync(path.join(raiz, "i18n"), { recursive: true });
fs.mkdirSync(path.join(raiz, "content/trilhas"), { recursive: true });
fs.copyFileSync(path.join(raizReal, "lib/areas.ts"), path.join(raiz, "lib/areas.ts"));
for (const l of ["pt", "en", "es", "ru", "zh", "fr"]) fs.copyFileSync(path.join(raizReal, `i18n/${l}.json`), path.join(raiz, `i18n/${l}.json`));
let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => { if (ok) certos++; else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`); };

let r = aplicarTodas(raiz, [{ id: "1", tipo: "disciplina", dados: { slug: "cooperativismo", grupo: "lutas", etapas: ["medio", "superior"], nomes: { pt: "Cooperativismo", en: "Cooperativism" }, descricoes: { pt: "Como se organiza uma cooperativa." } } }]);
confere("disciplina criada", r.ids.length === 1, JSON.stringify(r.falhas));
const areas = lerAreas(raiz);
confere("entrou no grupo lutas", areas.grupos.find((g) => g.id === "lutas").areas.includes("cooperativismo"));
confere("entrou nas etapas", /medio: \[[^\]]*"cooperativismo"/.test(areas.texto) && /superior: \[[^\]]*"cooperativismo"/.test(areas.texto));
const pt = JSON.parse(fs.readFileSync(path.join(raiz, "i18n/pt.json"), "utf8"));
const ru = JSON.parse(fs.readFileSync(path.join(raiz, "i18n/ru.json"), "utf8"));
confere("dicionários válidos com a entrada nova (russo recebe o português até a tradução)", pt.areas.cooperativismo[0] === "Cooperativismo" && ru.areas.cooperativismo[0] === "Cooperativismo");
r = aplicarTodas(raiz, [{ id: "2", tipo: "disciplina", dados: { slug: "cooperativismo", grupo: "lutas", nomes: { pt: "X" } } }]);
confere("disciplina repetida é recusada", Object.keys(r.falhas).length === 1 && /já existe/.test(r.falhas["2"]));
r = aplicarTodas(raiz, [{ id: "3", tipo: "trilha", dados: { slug: "cooperativas-do-zero", disciplina: "cooperativismo", titulo: "Cooperativas do zero", etapa: "medio", ordem: 1, resumo: "Primeiros passos.", aulas: ["O que é uma cooperativa", "Estatuto e assembleia", "O que é uma cooperativa"] } }]);
confere("trilha criada", r.ids.length === 1, JSON.stringify(r.falhas));
const plano = JSON.parse(fs.readFileSync(path.join(raiz, "content/trilhas/cooperativas-do-zero/plano.json"), "utf8"));
confere("plano com slugs únicos", plano.length === 3 && new Set(plano.map((p) => p.slug)).size === 3);
confere("_trilha.md com a área certa", /^area: cooperativismo$/m.test(fs.readFileSync(path.join(raiz, "content/trilhas/cooperativas-do-zero/_trilha.md"), "utf8")));
r = aplicarTodas(raiz, [{ id: "4", tipo: "editar_trilha", dados: { slug: "cooperativas-do-zero", titulo: "Cooperativas: do zero à assembleia", aulas: ["Estatuto e assembleia", "Finanças da cooperativa"] } }]);
confere("trilha editada", r.ids.length === 1 && /Cooperativas: do zero/.test(fs.readFileSync(path.join(raiz, "content/trilhas/cooperativas-do-zero/_trilha.md"), "utf8")));
r = aplicarTodas(raiz, [{ id: "5", tipo: "remover_disciplina", dados: { slug: "cooperativismo" } }]);
confere("disciplina com trilha não é removida", Object.keys(r.falhas).length === 1 && /ainda tem trilhas/.test(r.falhas["5"]));
r = aplicarTodas(raiz, [{ id: "6", tipo: "remover_trilha", dados: { slug: "cooperativas-do-zero" } }, { id: "7", tipo: "remover_disciplina", dados: { slug: "cooperativismo" } }]);
confere("trilha sem aulas e depois a disciplina são removidas", r.ids.length === 2, JSON.stringify(r.falhas));
const depois = lerAreas(raiz);
confere("areas.ts sem a disciplina e ainda válido", !depois.slugs.has("cooperativismo") && depois.grupos.length === areas.grupos.length);
confere("dicionário sem a entrada e válido", !("cooperativismo" in JSON.parse(fs.readFileSync(path.join(raiz, "i18n/pt.json"), "utf8")).areas));
r = aplicarTodas(raiz, [{ id: "8", tipo: "editar_disciplina", dados: { slug: "matematica", nomes: { en: "Mathematics (renamed)" } } }]);
confere("nome de disciplina editado num idioma", r.ids.length === 1 && JSON.parse(fs.readFileSync(path.join(raiz, "i18n/en.json"), "utf8")).areas.matematica[0] === "Mathematics (renamed)");
// Segunda leva: disciplina removida levando as trilhas para outra, trilha com aulas arquivada e citação que impede.
r = aplicarTodas(raiz, [
  { id: "9", tipo: "disciplina", dados: { slug: "hortas", grupo: "lutas", etapas: ["medio"], nomes: { pt: "Hortas" } } },
  { id: "10", tipo: "trilha", dados: { slug: "horta-em-casa", disciplina: "hortas", titulo: "Horta em casa", etapa: "medio", aulas: ["Sol e água"] } },
  { id: "11", tipo: "trilha", dados: { slug: "compostagem", disciplina: "hortas", titulo: "Compostagem", etapa: "medio", aulas: ["Minhocas"] } },
]);
confere("disciplina e duas trilhas criadas", r.ids.length === 3, JSON.stringify(r.falhas));
fs.writeFileSync(path.join(raiz, "content/trilhas/horta-em-casa/sol-e-agua.md"), "---\ntitulo: Sol e água\n---\nTexto.\n");
fs.mkdirSync(path.join(raiz, "content/exercicios/horta-em-casa"), { recursive: true });
fs.writeFileSync(path.join(raiz, "content/exercicios/horta-em-casa/ex.json"), "{}");
r = aplicarTodas(raiz, [{ id: "12", tipo: "remover_disciplina", dados: { slug: "hortas", destino: "biologia" } }]);
confere("disciplina removida, trilhas vão para a de destino", r.ids.length === 1 && /^area: biologia$/m.test(fs.readFileSync(path.join(raiz, "content/trilhas/compostagem/_trilha.md"), "utf8")) && !lerAreas(raiz).slugs.has("hortas"), JSON.stringify(r.falhas));
fs.mkdirSync(path.join(raiz, "content/paginas"), { recursive: true });
fs.writeFileSync(path.join(raiz, "content/paginas/guia.md"), "Veja [a trilha](/trilhas/compostagem/minhocas).\n");
r = aplicarTodas(raiz, [{ id: "13", tipo: "arquivar_trilha", dados: { slug: "compostagem" } }]);
confere("trilha citada não é arquivada (diz onde)", Object.keys(r.falhas).length === 1 && /content\/paginas\/guia\.md/.test(r.falhas["13"]), JSON.stringify(r.falhas));
r = aplicarTodas(raiz, [{ id: "14", tipo: "arquivar_trilha", dados: { slug: "horta-em-casa" } }]);
confere("trilha com aula escrita vai para o arquivo, com os exercícios", r.ids.length === 1 && fs.existsSync(path.join(raiz, "content/arquivo/trilhas/horta-em-casa/sol-e-agua.md")) && fs.existsSync(path.join(raiz, "content/arquivo/exercicios/horta-em-casa/ex.json")) && !fs.existsSync(path.join(raiz, "content/trilhas/horta-em-casa")), JSON.stringify(r.falhas));
r = aplicarTodas(raiz, [{ id: "15", tipo: "disciplina", dados: { slug: "pomares", grupo: "lutas", etapas: ["medio"], nomes: { pt: "Pomares" } } }, { id: "16", tipo: "trilha", dados: { slug: "frutas", disciplina: "pomares", titulo: "Frutas", etapa: "medio", aulas: ["Mudas"] } }, { id: "17", tipo: "remover_disciplina", dados: { slug: "pomares" } }]);
confere("sem destino nem arquivo, a disciplina com trilha fica", r.ids.length === 2 && /escolha para onde/.test(r.falhas["17"] ?? ""), JSON.stringify(r.falhas));
r = aplicarTodas(raiz, [{ id: "18", tipo: "remover_disciplina", dados: { slug: "pomares", arquivar: true } }]);
confere("disciplina removida arquivando as trilhas", r.ids.length === 1 && fs.existsSync(path.join(raiz, "content/arquivo/trilhas/frutas/_trilha.md")) && !lerAreas(raiz).slugs.has("pomares"), JSON.stringify(r.falhas));
fs.rmSync(raiz, { recursive: true, force: true });
console.log(`currículo: ${certos} conferências certas, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
