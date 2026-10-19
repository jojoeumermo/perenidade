// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// estudio.institutolucia.org: os arquivos estáticos (pasta site/, com as regras do _headers) são entregues direto
// pela Cloudflare. Este Worker só roda quando o pedido não é um desses arquivos: entrega os poucos que passam de
// 25 MiB (o WebAssembly do FilmCraft e do EffectCraft), guardados no R2 com o mesmo caminho.

const TIPOS = { wasm: "application/wasm", js: "text/javascript", json: "application/json", bin: "application/octet-stream" };

export default {
  async fetch(pedido, env) {
    if (pedido.method !== "GET" && pedido.method !== "HEAD") return new Response("Método não aceito", { status: 405 });
    const chave = decodeURIComponent(new URL(pedido.url).pathname).replace(/^\/+/, "");
    if (!chave || chave.includes("..")) return new Response("Não encontrado", { status: 404 });
    const objeto = env.GRANDES ? await env.GRANDES.get(chave) : null;
    if (!objeto) return new Response("Não encontrado", { status: 404 });
    const cabecalhos = new Headers({
      "Content-Type": TIPOS[chave.split(".").pop()] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
      "ETag": objeto.httpEtag,
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
    });
    return new Response(pedido.method === "HEAD" ? null : objeto.body, { headers: cabecalhos });
  },
};
