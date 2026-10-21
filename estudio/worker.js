// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// estudio.institutolucia.org: os arquivos estáticos (pasta site/, com as regras do _headers) são entregues direto
// pela Cloudflare. Este Worker só roda quando o pedido não é um desses arquivos: entrega os poucos que passam de
// 25 MiB (o WebAssembly do FilmCraft, do EffectCraft e do WordCraft). Eles sobem cortados em partes de 20 MiB, que
// são arquivos estáticos comuns (<arquivo>.parte-0, .parte-1…), com um índice (<arquivo>.partes.json); aqui as partes
// são emendadas na hora, na ordem, sem passar pela memória. Assim não é preciso ativar o R2 na conta. Se o R2 estiver
// ligado (binding GRANDES) e tiver o arquivo inteiro, ele também serve.

const TIPOS = { wasm: "application/wasm", js: "text/javascript", json: "application/json", bin: "application/octet-stream", data: "application/octet-stream" };

const cabecalhos = (chave, extra) =>
  new Headers({
    "Content-Type": TIPOS[chave.split(".").pop()] ?? "application/octet-stream",
    // O endereço muda a cada versão (?v= ou nome com hash): um dia de cache basta e não prende versão velha.
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    ...extra,
  });

/** Emenda as partes de um arquivo grande guardadas como arquivos estáticos. null se o arquivo não foi cortado. */
export async function emendar(pedido, env, chave) {
  if (!env.ASSETS) return null;
  const base = new URL(pedido.url);
  const indice = await env.ASSETS.fetch(new URL(`/${chave}.partes.json`, base));
  if (!indice.ok) return null;
  const { tamanho, partes, sha256 } = await indice.json();
  const etag = `"${sha256}"`;
  const h = cabecalhos(chave, { "Content-Length": String(tamanho), ETag: etag });
  if (pedido.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers: h });
  if (pedido.method === "HEAD") return new Response(null, { headers: h });
  // FixedLengthStream avisa o tamanho certo ao navegador (barra de progresso) e confere que nada faltou.
  const Fluxo = globalThis.FixedLengthStream ?? TransformStream;
  const { readable, writable } = globalThis.FixedLengthStream ? new Fluxo(tamanho) : new Fluxo();
  (async () => {
    for (const parte of partes) {
      const r = await env.ASSETS.fetch(new URL(`/${parte}`, base));
      if (!r.ok || !r.body) throw new Error(`parte ausente: ${parte}`);
      await r.body.pipeTo(writable, { preventClose: true });
    }
    await writable.close();
  })().catch((erro) => writable.abort(erro).catch(() => undefined));
  return new Response(readable, { headers: h });
}

// O EffectCraft 0.11 sem nada no endereço abre a placa de vídeo em cada worker de quadros, quatro de uma vez, e trava
// o navegador inteiro em muitos computadores. Quem chega à página sem escolher o modo vai para o estável (só a tela usa
// a placa). Quem quer o WebGPU completo escolhe no site, que manda ?webgpu (parâmetro que o programa ignora).
const MODO_ESTAVEL = { "/effectcraft/": "nogpuworkers", "/effectcraft/index.html": "nogpuworkers" };

export default {
  async fetch(pedido, env) {
    if (pedido.method !== "GET" && pedido.method !== "HEAD") return new Response("Método não aceito", { status: 405 });
    const endereco = new URL(pedido.url);
    if (MODO_ESTAVEL[endereco.pathname]) {
      // Só quando a pessoa abre a página: o service worker do programa baixa "./" para guardar e não pode receber redirecionamento.
      if (!endereco.search && pedido.headers.get("Sec-Fetch-Mode") === "navigate") return Response.redirect(`${endereco.origin}${endereco.pathname}?${MODO_ESTAVEL[endereco.pathname]}`, 302);
      return env.ASSETS.fetch(pedido);
    }
    const chave = decodeURIComponent(new URL(pedido.url).pathname).replace(/^\/+/, "");
    if (!chave || chave.includes("..")) return new Response("Não encontrado", { status: 404 });
    const emendado = await emendar(pedido, env, chave);
    if (emendado) return emendado;
    const objeto = env.GRANDES ? await env.GRANDES.get(chave) : null;
    if (!objeto) return new Response("Não encontrado", { status: 404 });
    const h = cabecalhos(chave, { ETag: objeto.httpEtag });
    return new Response(pedido.method === "HEAD" ? null : objeto.body, { headers: h });
  },
};
