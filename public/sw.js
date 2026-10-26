// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Faz o site abrir sem internet. Guarda as páginas que a pessoa já visitou (e as trilhas que ela
// mandou guardar) e os arquivos fixos do site. Nada do painel nem da entrada é guardado.
// Mudou a VERSAO? Mude também o nome em components/Offline.tsx: os dois precisam ser iguais.
const VERSAO = "v4";
const PAGINAS = `lucia-paginas-${VERSAO}`;
const FIXOS = `lucia-fixos-${VERSAO}`;
const LIMITE_DE_PAGINAS = 300;

const SEM_REDE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão — Instituto Lúcia</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4ecd8;color:#1f1a14;font-family:Georgia,serif;padding:1.5rem}main{max-width:32rem}h1{font-size:2rem;margin:0 0 .75rem}p{font-size:1.15rem;line-height:1.5}a{color:#6e1f1a}@media(prefers-color-scheme:dark){body{background:#17130e;color:#efe4c8}a{color:#e0837a}}</style></head>
<body><main><h1>Você está sem conexão</h1><p>Esta página ainda não foi guardada neste aparelho. As aulas que você já abriu, e as trilhas que mandou guardar, continuam disponíveis.</p><p><a href="/pt/trilhas">Ir para as disciplinas</a></p></main></body></html>`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) if (nome.startsWith("lucia-") && nome !== PAGINAS && nome !== FIXOS) await caches.delete(nome);
      await self.clients.claim();
    })(),
  );
});

const fixo = (caminho) => /^\/(_next\/static\/|imagens\/|arquivos\/|marca|icon|apple-icon|cartao)/.test(caminho);
const privado = (caminho) => /^\/[a-z]{2}\/(painel|entrar|meus-dados|certificado)(\/|$)/.test(caminho) || caminho.startsWith("/_vercel/") || caminho.startsWith("/api/");

async function aparar(nome, maximo) {
  const cache = await caches.open(nome);
  const chaves = await cache.keys();
  for (const chave of chaves.slice(0, Math.max(0, chaves.length - maximo))) await cache.delete(chave);
}

/** Páginas: tenta a rede (para a pessoa ver sempre a versão mais nova) e, sem ela, usa a cópia guardada. */
async function primeiroARede(pedido) {
  const cache = await caches.open(PAGINAS);
  try {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 6000);
    const resposta = await fetch(pedido, { signal: controle.signal });
    clearTimeout(relogio);
    if (resposta.ok && resposta.type === "basic") {
      await cache.put(pedido.url, resposta.clone());
      void aparar(PAGINAS, LIMITE_DE_PAGINAS);
    }
    return resposta;
  } catch {
    const guardada = await cache.match(pedido.url, { ignoreSearch: true });
    return guardada ?? new Response(SEM_REDE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

/** Arquivos que nunca mudam de conteúdo (o nome muda quando o conteúdo muda): a cópia guardada basta. */
async function primeiroOGuardado(pedido) {
  const cache = await caches.open(FIXOS);
  const guardado = await cache.match(pedido.url);
  if (guardado) return guardado;
  const resposta = await fetch(pedido);
  if (resposta.ok && resposta.type === "basic") await cache.put(pedido.url, resposta.clone());
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || pedido.headers.has("range")) return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || privado(url.pathname)) return;
  if (fixo(url.pathname)) {
    evento.respondWith(primeiroOGuardado(pedido));
    return;
  }
  // Só documentos inteiros: os pedaços que o site troca entre páginas ficam por conta da rede e,
  // sem ela, o navegador pede o documento inteiro, que sai daqui.
  if (pedido.mode === "navigate") evento.respondWith(primeiroARede(pedido));
});
