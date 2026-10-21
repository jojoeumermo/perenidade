// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a porta de saída do servidor para os serviços abertos (lib/externo.ts), sem rede: só https, só os destinos da
// lista, e redirecionamento seguido apenas quando o destino também está na lista. Uso: npm run testar:externo
import { buscarJson, buscarTexto, permitido, semHtml, termo } from "../lib/externo.ts";

let certos = 0;
const falhas = [];
async function confere(nome, fazer) {
  try {
    if (!(await fazer())) throw new Error("não confere");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

/** Um "fetch" de mentira: cada chamada consome a próxima resposta da lista e anota o endereço pedido. */
const pedidos = [];
function simular(respostas) {
  pedidos.length = 0;
  const fila = [...respostas];
  globalThis.fetch = async (url, opcoes) => {
    pedidos.push({ url: String(url), redirect: opcoes?.redirect });
    const proxima = fila.shift();
    if (!proxima) throw new Error("sem resposta simulada");
    return new Response(proxima.corpo ?? "", { status: proxima.status ?? 200, headers: proxima.cabecalhos ?? {} });
  };
}

await confere("só https e só a lista", () => permitido(new URL("https://pt.wikipedia.org/w/api.php")) && !permitido(new URL("http://pt.wikipedia.org/")) && !permitido(new URL("https://exemplo.com/")));

simular([{ corpo: "ok" }]);
await confere("endereço fora da lista não é nem pedido", async () => (await buscarTexto("https://exemplo.com/x")) === null && pedidos.length === 0);
await confere("endereço http não é nem pedido", async () => (await buscarTexto("http://pt.wikipedia.org/x")) === null && pedidos.length === 0);
await confere("endereço inválido devolve null", async () => (await buscarTexto("isto não é um endereço")) === null);

simular([{ corpo: "texto" }]);
await confere("resposta 200 devolve o texto, sem seguir redirecionamentos às cegas", async () => (await buscarTexto("https://pt.wikipedia.org/x")) === "texto" && pedidos[0].redirect === "manual");

simular([{ status: 302, cabecalhos: { location: "https://en.wikipedia.org/y" } }, { corpo: "destino" }]);
await confere("redirecionamento para destino da lista é seguido", async () => (await buscarTexto("https://pt.wikipedia.org/x")) === "destino" && pedidos.length === 2 && pedidos[1].url === "https://en.wikipedia.org/y");

simular([{ status: 301, cabecalhos: { location: "/z" } }, { corpo: "relativo" }]);
await confere("redirecionamento relativo fica no mesmo destino", async () => (await buscarTexto("https://openlibrary.org/x")) === "relativo" && pedidos[1].url === "https://openlibrary.org/z");

simular([{ status: 302, cabecalhos: { location: "https://169.254.169.254/latest/meta-data/" } }, { corpo: "segredo" }]);
await confere("redirecionamento para fora da lista é recusado e não é pedido", async () => (await buscarTexto("https://pt.wikipedia.org/x")) === null && pedidos.length === 1);

simular([{ status: 302, cabecalhos: { location: "http://pt.wikipedia.org/x" } }, { corpo: "inseguro" }]);
await confere("redirecionamento para http é recusado", async () => (await buscarTexto("https://pt.wikipedia.org/x")) === null && pedidos.length === 1);

simular([{ status: 302, cabecalhos: { location: "https://pt.wikipedia.org/1" } }, { status: 302, cabecalhos: { location: "https://pt.wikipedia.org/2" } }, { status: 302, cabecalhos: { location: "https://pt.wikipedia.org/3" } }, { corpo: "longe" }]);
await confere("mais de dois redirecionamentos seguidos é recusado", async () => (await buscarTexto("https://pt.wikipedia.org/x")) === null && pedidos.length === 3);

simular([{ status: 302 }]);
await confere("redirecionamento sem destino é recusado", async () => (await buscarTexto("https://pt.wikipedia.org/x")) === null);

simular([{ status: 404 }]);
await confere("404 vira o texto combinado quando pedido", async () => (await buscarTexto("https://api.dictionaryapi.dev/x", { se404: "[]" })) === "[]");
simular([{ status: 404 }]);
await confere("404 sem combinação é falha", async () => (await buscarTexto("https://api.dictionaryapi.dev/x")) === null);
simular([{ status: 500 }]);
await confere("erro do serviço é falha", async () => (await buscarTexto("https://api.dictionaryapi.dev/x")) === null);
simular([{ corpo: "x".repeat(2_000_001) }]);
await confere("resposta grande demais é descartada", async () => (await buscarTexto("https://api.dictionaryapi.dev/x")) === null);

simular([{ corpo: '{"a":1}' }]);
await confere("JSON é lido", async () => (await buscarJson("https://gutendex.com/books/"))?.a === 1);
simular([{ corpo: "isto não é json" }]);
await confere("JSON inválido vira null", async () => (await buscarJson("https://gutendex.com/books/")) === null);

await confere("termo limpa controle, espaços e tamanho", () => termo("  a\u0000b   c  ", 2, 80) === "a b c" && termo("x", 2) === "" && termo("y".repeat(100), 2, 80).length === 80);
await confere("semHtml tira marcação e desfaz entidades", () => semHtml('<b>a &amp; b</b> &lt;c&gt; &quot;d&quot;') === 'a & b <c> "d"');

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
