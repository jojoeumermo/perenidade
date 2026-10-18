// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o aplicador das tarefas aprovadas numa cópia temporária de obras: só o campo da tarefa muda, nada sai do acervo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { aplicarNaObra, aplicarTodas, arquivoDaObra } from "./tarefas.mjs";

let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const tenta = (f) => { try { return f(); } catch (e) { return `ERRO: ${e.message}`; } };

const obra = `---\ntitulo: "1984"\nautor: "George Orwell"\narea: literatura\nlicenca: "Conforme a fonte"\nfonte: "Gutenberg"\nurl: "https://exemplo.org/1984"\nidioma: "Inglês"\n---\n\nCurta.\n`;
conferir("põe o ano que faltava", tenta(() => aplicarNaObra(obra, { tipo: "ficha_ano", entrega: { ano: "1949" } })).includes('ano: "1949"'));
conferir("ano inválido não entra", String(tenta(() => aplicarNaObra(obra, { tipo: "ficha_ano", entrega: { ano: "1949; rm" } }))).startsWith("ERRO"));
conferir("troca a licença sem mexer no resto", (() => { const r = aplicarNaObra(obra, { tipo: "licenca", entrega: { licenca: "Domínio público" } }); return r.includes('licenca: "Domínio público"') && r.includes('autor: "George Orwell"') && r.includes("Curta."); })());
conferir("licença desconhecida não entra", String(tenta(() => aplicarNaObra(obra, { tipo: "licenca", entrega: { licenca: "Livre geral" } }))).startsWith("ERRO"));
const sinopse = "Um Estado que vigia tudo, reescreve o passado e controla até a linguagem das pessoas comuns.";
conferir("troca a sinopse (o corpo)", (() => { const r = aplicarNaObra(obra, { tipo: "ficha_sinopse", entrega: { sinopse } }); return r.endsWith(`${sinopse}\n`) && !r.includes("Curta.") && r.startsWith("---\ntitulo"); })());
conferir("sinopse com script não entra", String(tenta(() => aplicarNaObra(obra, { tipo: "ficha_sinopse", entrega: { sinopse: `${sinopse} <script>x</script>` } }))).startsWith("ERRO"));
conferir("aspas no valor não quebram o cabeçalho", aplicarNaObra(obra, { tipo: "link", entrega: { url: "https://exemplo.org/livro?a=1" } }).includes('url: "https://exemplo.org/livro?a=1"'));
conferir("link sem https não entra", String(tenta(() => aplicarNaObra(obra, { tipo: "link", entrega: { url: "javascript:alert(1)" } }))).startsWith("ERRO"));
conferir("tipo que não se aplica sozinho é recusado", String(tenta(() => aplicarNaObra(obra, { tipo: "biografia", entrega: {} }))).startsWith("ERRO"));

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "lucia-tarefas-"));
fs.mkdirSync(path.join(raiz, "content", "acervo"), { recursive: true });
fs.writeFileSync(path.join(raiz, "content", "acervo", "1984.md"), obra);
conferir("alvo fora do acervo é recusado", String(tenta(() => arquivoDaObra(raiz, "/acervo/../../etc/passwd"))).startsWith("ERRO"));
const r = aplicarTodas(raiz, [{ id: "a", tipo: "ficha_ano", alvo: "/acervo/1984", entrega: { ano: "1949" } }, { id: "b", tipo: "ficha_ano", alvo: "/acervo/nao-existe", entrega: { ano: "1900" } }]);
conferir("aplica a que dá e devolve o motivo da que não dá", r.ok.join() === "a" && /não existe/.test(r.falhas.b ?? ""));
conferir("o arquivo da cópia mudou", fs.readFileSync(path.join(raiz, "content", "acervo", "1984.md"), "utf8").includes('ano: "1949"'));
fs.rmSync(raiz, { recursive: true, force: true });

for (const f of falhas) console.log(`  ✗ ${f}`);
console.log(`tarefas: ${ok} conferências certas, ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
