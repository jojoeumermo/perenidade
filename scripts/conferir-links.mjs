// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
//
// Confere se os endereços citados no conteúdo ainda respondem: fichas do acervo, fontes das aulas,
// vídeos, arquivos de autores e links dentro dos textos. Uso: npm run conferir:links
// Link quebrado é o contrário de preservar: rode de tempos em tempos e conserte o que cair.
//
//   npm run conferir:links -- --catalogo    inclui também o catálogo ampliado (milhares de links; demora)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const conteudo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content");
const comCatalogo = process.argv.includes("--catalogo");
const enderecos = new Map(); // endereço -> primeiro arquivo em que aparece

function visitar(pasta) {
  for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "catalogo" || comCatalogo) visitar(caminho);
    } else if (/\.(md|json)$/.test(entrada.name)) {
      for (const achado of fs.readFileSync(caminho, "utf8").matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
        const url = achado[0].replace(/[.,;:]+$/, "");
        if (!enderecos.has(url)) enderecos.set(url, path.relative(conteudo, caminho).replaceAll("\\", "/"));
      }
    }
  }
}
visitar(conteudo);

async function testar(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const resposta = await fetch(url, {
        method,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(25_000),
      });
      if (resposta.ok) return "ok";
      // Vários sites recusam robôs (403, 429) mas abrem normalmente no navegador: é aviso, não erro.
      if ([401, 403, 405, 429, 999].includes(resposta.status)) {
        if (method === "HEAD") continue;
        return `aviso: HTTP ${resposta.status} (o site pode estar barrando robôs; confira no navegador)`;
      }
      if (method === "GET") return `QUEBRADO: HTTP ${resposta.status}`;
    } catch (erro) {
      if (method === "GET") return `aviso: sem resposta (${erro.cause?.code ?? erro.name})`;
    }
  }
  return "aviso: sem resposta";
}

const fila = [...enderecos];
let quebrados = 0;
let avisos = 0;
async function trabalhar() {
  for (let item = fila.pop(); item; item = fila.pop()) {
    const [url, arquivo] = item;
    const resultado = await testar(url);
    if (resultado.startsWith("QUEBRADO")) quebrados++;
    if (resultado.startsWith("aviso")) avisos++;
    if (resultado !== "ok") console.log(`${resultado}\n   ${url}\n   em ${arquivo}`);
  }
}
await Promise.all(Array.from({ length: 8 }, trabalhar));

console.log(`\n${enderecos.size} endereços conferidos: ${enderecos.size - quebrados - avisos} ok, ${avisos} aviso(s), ${quebrados} quebrado(s).`);
process.exit(quebrados ? 1 : 0);
