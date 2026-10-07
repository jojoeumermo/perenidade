// Confere se os links do acervo ainda respondem. Uso: npm run check:links
// Link quebrado é o contrário de perenidade: rode de tempos em tempos e conserte o que cair.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const dir = path.join(process.cwd(), "content", "acervo");
const files = fs.readdirSync(dir).filter((name) => name.endsWith(".md"));
let broken = 0;

for (const name of files) {
  const { url } = matter(fs.readFileSync(path.join(dir, name), "utf8")).data;
  let result;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (verificador de links do Projeto Lucia)" },
      signal: AbortSignal.timeout(30_000),
    });
    result = response.ok ? "ok" : `HTTP ${response.status}`;
  } catch (error) {
    result = `falhou (${error.cause?.code ?? error.name})`;
  }
  if (result !== "ok") broken++;
  console.log(`${result === "ok" ? "ok    " : "QUEBRADO"} ${name} -> ${url}${result === "ok" ? "" : ` [${result}]`}`);
}

console.log(`\n${files.length - broken} de ${files.length} links respondendo.`);
process.exit(broken ? 1 : 0);
